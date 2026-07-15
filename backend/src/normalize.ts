import type { AlertRecord, Asset, EventRecord, Flow, LoadedSourceRows, VendorName } from '@soc/telemetry-shared';
import { isNotEmpty, toNumberValue, toStringValue, toTimestamp } from '@soc/telemetry-shared';

const mergeVendorLists = (current: VendorName[], incoming?: VendorName[]) => Array.from(new Set([
  ...current,
  ...(incoming ?? [])
]));

const getAsset = (assets: Map<string, Asset>, ip: string, patch: Partial<Asset>) => {
  const existing = assets.get(ip);
  if (existing) {
    assets.set(ip, {
      ...existing,
      ...patch,
      sourceVendor: mergeVendorLists(existing.sourceVendor, patch.sourceVendor),
      communicationVolume: existing.communicationVolume + (patch.communicationVolume ?? 0)
    });
    return;
  }

  assets.set(ip, {
    ip,
    hostname: patch.hostname,
    mac: patch.mac,
    country: patch.country,
    asn: patch.asn,
    username: patch.username,
    deviceType: patch.deviceType,
    sourceVendor: patch.sourceVendor ?? [],
    communicationVolume: patch.communicationVolume ?? 0
  });
};

const connectAssets = (assets: Map<string, Asset>, srcIp?: string, dstIp?: string, srcPatch?: Partial<Asset>, dstPatch?: Partial<Asset>) => {
  if (srcIp) {
    getAsset(assets, srcIp, srcPatch ?? {});
  }

  if (dstIp) {
    getAsset(assets, dstIp, dstPatch ?? {});
  }
};

// Parse StealthWatch SI-formatted numbers: "148.17 K" → 148170, "14.34 M" → 14340000
const parseSiNum = (val: unknown): number => {
  const s = String(val ?? '').trim();
  if (!s || s === '----' || s === '0') return 0;
  const m = s.match(/^([\d.]+)\s*([KMGTP]?)$/i);
  if (!m) return parseFloat(s) || 0;
  const mult: Record<string, number> = { K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15 };
  return Math.round(parseFloat(m[1]) * (mult[m[2].toUpperCase()] ?? 1));
};

// Parse "61198/TCP" → "61198"
const parsePortProto = (val: unknown): string | undefined => {
  const s = String(val ?? '').trim();
  if (!s || s === '----') return undefined;
  const port = s.split('/')[0];
  return port || undefined;
};

export const normalizeTelemetry = (sources: LoadedSourceRows) => {
  const assets = new Map<string, Asset>();
  const flows: Flow[] = [];
  const events: EventRecord[] = [];
  const alerts: AlertRecord[] = [];

  // ── QRadar ──────────────────────────────────────────────────────────────
  sources.qradar.forEach((row, index) => {
    const timestamp = toTimestamp(row.start_time);
    const srcIp = toStringValue(row.source_ip);
    const dstIp = toStringValue(row.destination_ip);
    const bytes = toNumberValue(row.byte_count) ?? 0;
    const packets = toNumberValue(row.packet_count) ?? 0;
    const risk = toNumberValue(row.risk_score);

    if (srcIp && dstIp) {
      flows.push({
        id: `qradar-flow-${index + 1}`,
        timestamp,
        src_ip: srcIp,
        src_port: toStringValue(row.source_port),
        dst_ip: dstIp,
        dst_port: toStringValue(row.destination_port),
        protocol: toStringValue(row.protocol),
        application: toStringValue(row.application),
        bytes,
        packets,
        direction: toStringValue(row.direction),
        ja3: undefined,
        sni: toStringValue(row.domain) ?? toStringValue(row.url),
        dns_query: toStringValue(row.dns_query),
        risk_score: risk,
        sourceVendor: 'qradar',
        raw: row
      });
      connectAssets(assets, srcIp, dstIp, {
        hostname: toStringValue(row.source_hostname),
        mac: toStringValue(row.source_mac),
        country: toStringValue(row.source_country),
        username: toStringValue(row.username),
        sourceVendor: ['qradar'],
        communicationVolume: bytes
      }, {
        hostname: toStringValue(row.destination_hostname),
        mac: toStringValue(row.destination_mac),
        country: toStringValue(row.destination_country),
        sourceVendor: ['qradar'],
        communicationVolume: bytes
      });
    }

    events.push({
      id: `qradar-event-${index + 1}`,
      timestamp,
      event_name: toStringValue(row.qid_name) ?? `QRadar Event ${index + 1}`,
      category: toStringValue(row.category),
      severity: toStringValue(row.severity),
      src_ip: srcIp,
      dst_ip: dstIp,
      username: toStringValue(row.username),
      process_name: toStringValue(row.process_name),
      filename: toStringValue(row.filename),
      domain: toStringValue(row.domain),
      url: toStringValue(row.url),
      raw_event: toStringValue(row.raw_event),
      sourceVendor: 'qradar',
      raw: row
    });
  });

  // ── Cisco SNA (StealthWatch) ─────────────────────────────────────────────
  // Real SNA flow export: 96-column format with SI-formatted byte/packet values.
  // Subject = initiating (Client) side; Peer = responding (Server) side.
  // SNA flow exports do not include alarm data — that is a separate report type.
  sources.sna.forEach((row, index) => {
    const timestamp = toTimestamp(row['Start']);
    const srcIp = toStringValue(row['Subject IP Address']);
    const dstIp = toStringValue(row['Peer IP Address']);
    const bytes = parseSiNum(row['Total Bytes']);
    const packets = parseSiNum(row['Total Packets']);

    if (srcIp && dstIp) {
      flows.push({
        id: `sna-flow-${index + 1}`,
        timestamp,
        src_ip: srcIp,
        src_port: parsePortProto(row['Subject Port/Protocol']),
        dst_ip: dstIp,
        dst_port: parsePortProto(row['Peer Port/Protocol']),
        protocol: toStringValue(row['protocol']),
        application: toStringValue(row['Application']),
        bytes,
        packets,
        direction: toStringValue(row['Subject Orientation']) === 'Client' ? 'OUTBOUND' : 'INBOUND',
        ja3: undefined,
        sni: undefined,
        dns_query: undefined,
        risk_score: undefined,
        sourceVendor: 'sna',
        raw: row
      });
      connectAssets(assets, srcIp, dstIp, {
        hostname: toStringValue(row['Subject Hostname']),
        mac: toStringValue(row['Subject MAC Address']),
        country: toStringValue(row['Subject Location']),
        asn: toStringValue(row['Subject ASN']),
        username: toStringValue(row['Subject User']),
        sourceVendor: ['sna'],
        communicationVolume: bytes
      }, {
        hostname: toStringValue(row['Peer Hostname']),
        mac: toStringValue(row['Peer MAC Address']),
        country: toStringValue(row['Peer Location']),
        asn: toStringValue(row['Peer ASN']),
        sourceVendor: ['sna'],
        communicationVolume: bytes
      });
    }
  });

  // ── Arista NDR ────────────────────────────────────────────────────────────
  sources.arista.forEach((row, index) => {
    const timestamp = toTimestamp(row.start_time);
    const srcIp = toStringValue(row.src_ip);
    const dstIp = toStringValue(row.dst_ip);
    const bytes = toNumberValue(row.bytes) ?? 0;
    const packets = toNumberValue(row.packets) ?? 0;
    const risk = toNumberValue(row.risk_score);

    if (srcIp && dstIp) {
      flows.push({
        id: `arista-flow-${index + 1}`,
        timestamp,
        src_ip: srcIp,
        src_port: toStringValue(row.src_port),
        dst_ip: dstIp,
        dst_port: toStringValue(row.dst_port),
        protocol: toStringValue(row.protocol),
        application: toStringValue(row.application),
        bytes,
        packets,
        direction: undefined,
        ja3: toStringValue(row.ja3),
        sni: toStringValue(row.sni),
        dns_query: toStringValue(row.dns_query),
        risk_score: risk,
        sourceVendor: 'arista',
        raw: row
      });
      connectAssets(assets, srcIp, dstIp, {
        hostname: toStringValue(row.src_hostname),
        mac: toStringValue(row.src_mac),
        country: toStringValue(row.src_country),
        sourceVendor: ['arista'],
        communicationVolume: bytes
      }, {
        hostname: toStringValue(row.dst_hostname),
        mac: toStringValue(row.dst_mac),
        country: toStringValue(row.dst_country),
        sourceVendor: ['arista'],
        communicationVolume: bytes
      });
    }

    alerts.push({
      id: `arista-alert-${index + 1}`,
      alert_name: toStringValue(row.alert_name) ?? `Arista Alert ${index + 1}`,
      severity: toStringValue(row.severity),
      risk_score: risk,
      src_ip: srcIp,
      dst_ip: dstIp,
      ioc_match: toStringValue(row.ioc_match),
      malware_family: toStringValue(row.malware_family),
      anomaly_score: toNumberValue(row.anomaly_score),
      timestamp,
      sourceVendor: 'arista',
      raw: row
    });
  });

  // ── Cisco ISE ─────────────────────────────────────────────────────────────
  // ISE records are NAC authentication events. Each row may carry a network flow
  // from the endpoint (src_ip) to the NAS/switch (nas_ip), and always produces
  // an event. Failed auths with elevated risk become alerts.
  sources.cisco_ise.forEach((row, index) => {
    const timestamp = toTimestamp(row.timestamp);
    const srcIp = toStringValue(row.src_ip);
    const nasIp = toStringValue(row.nas_ip) ?? toStringValue(row.dst_ip);
    const risk = toNumberValue(row.risk_score);
    const failureReason = toStringValue(row.failure_reason);

    // Auth session as a flow: endpoint → NAS switch on RADIUS port
    if (srcIp && nasIp) {
      flows.push({
        id: `ise-flow-${index + 1}`,
        timestamp,
        src_ip: srcIp,
        src_port: toStringValue(row.src_port),
        dst_ip: nasIp,
        dst_port: toStringValue(row.dst_port) ?? '1812',
        protocol: 'RADIUS',
        application: toStringValue(row.auth_protocol) ?? 'EAP',
        bytes: 0,
        packets: 0,
        direction: 'OUTBOUND',
        risk_score: risk,
        sourceVendor: 'cisco_ise',
        raw: row
      });
      connectAssets(assets, srcIp, nasIp, {
        hostname: toStringValue(row.hostname),
        mac: toStringValue(row.mac_address),
        country: toStringValue(row.src_country),
        username: toStringValue(row.username),
        deviceType: toStringValue(row.device_type),
        // NAC / ISE attributes
        vlan: toStringValue(row.vlan_assignment),
        switchIp: nasIp,
        switchPort: toStringValue(row.nas_port_id),
        switchPortType: toStringValue(row.nas_port_type),
        securityGroup: toStringValue(row.identity_group),
        policySet: toStringValue(row.policy_set),
        authRule: toStringValue(row.auth_rule),
        postureStatus: toStringValue(row.posture_status),
        endpointProfile: toStringValue(row.endpoint_profile),
        auditSessionId: toStringValue(row.audit_session_id),
        riskScore: toNumberValue(row.risk_score),
        sourceVendor: ['cisco_ise'],
        communicationVolume: 0
      }, {
        // NAS / switch asset
        hostname: toStringValue(row.nas_ip) ?? nasIp,
        deviceType: 'Network_Switch',
        switchPort: toStringValue(row.nas_port_id),
        switchPortType: toStringValue(row.nas_port_type),
        sourceVendor: ['cisco_ise'],
        communicationVolume: 0
      });
    }

    // Auth event (every ISE row)
    events.push({
      id: `ise-event-${index + 1}`,
      timestamp,
      event_name: toStringValue(row.event_name) ?? `ISE Event ${index + 1}`,
      category: toStringValue(row.category) ?? 'Authentication',
      severity: toStringValue(row.severity),
      src_ip: srcIp,
      dst_ip: nasIp,
      username: toStringValue(row.username),
      raw_event: failureReason,
      domain: toStringValue(row.identity_group),
      sourceVendor: 'cisco_ise',
      raw: row
    });

    // Auth failure or elevated risk → alert
    const isFailure = toStringValue(row.event_name)?.toLowerCase().includes('failed') ||
                      toStringValue(row.event_name)?.toLowerCase().includes('dropped') ||
                      toStringValue(row.event_name)?.toLowerCase().includes('abandoned') ||
                      isNotEmpty(failureReason);
    if (isFailure || (risk !== undefined && risk >= 55)) {
      alerts.push({
        id: `ise-alert-${index + 1}`,
        alert_name: toStringValue(row.event_name) ?? `ISE Auth Failure ${index + 1}`,
        severity: toStringValue(row.severity),
        risk_score: risk,
        src_ip: srcIp,
        dst_ip: nasIp,
        ioc_match: undefined,
        malware_family: undefined,
        anomaly_score: undefined,
        timestamp,
        sourceVendor: 'cisco_ise',
        raw: row
      });
    }
  });

  // ── Cisco DNA Centre ──────────────────────────────────────────────────────
  // DNA Centre records cover client assurance, network health, app performance,
  // and security advisories. Traffic rows produce flows; every row is an event;
  // security advisories and high-severity issues become alerts.
  // NOTE: The DNAC CSV has col-1 labeled "timestamp" but it holds the event ID,
  // and col-2 labeled "event_id" holds the actual ISO timestamp — swapped headers.
  sources.cisco_dnac.forEach((row, index) => {
    const timestamp = toTimestamp(row.event_id);
    const srcIp = toStringValue(row.src_ip);
    const dstIp = toStringValue(row.dst_ip);
    const bytes = toNumberValue(row.bytes) ?? 0;
    const packets = toNumberValue(row.packets) ?? 0;
    const risk = toNumberValue(row.risk_score);
    const alertName = toStringValue(row.alert_name);

    // Only create a flow when there is real traffic data
    if (srcIp && dstIp && bytes > 0) {
      flows.push({
        id: `dnac-flow-${index + 1}`,
        timestamp,
        src_ip: srcIp,
        src_port: toStringValue(row.src_port),
        dst_ip: dstIp,
        dst_port: toStringValue(row.dst_port),
        protocol: toStringValue(row.protocol),
        application: toStringValue(row.ssid) ?? toStringValue(row.issue_type),
        bytes,
        packets,
        direction: 'OUTBOUND',
        risk_score: risk,
        sourceVendor: 'cisco_dnac',
        raw: row
      });
      connectAssets(assets, srcIp, dstIp, {
        hostname: toStringValue(row.src_hostname),
        username: toStringValue(row.username),
        sourceVendor: ['cisco_dnac'],
        communicationVolume: bytes
      }, {
        hostname: toStringValue(row.dst_hostname),
        sourceVendor: ['cisco_dnac'],
        communicationVolume: bytes
      });
    } else if (srcIp) {
      // Network device events without traffic — still register the asset
      getAsset(assets, srcIp, {
        hostname: toStringValue(row.src_hostname) ?? toStringValue(row.device_name),
        deviceType: 'Network_Device',
        sourceVendor: ['cisco_dnac'],
        communicationVolume: 0
      });
    }

    // Every row is a network/client event
    events.push({
      id: `dnac-event-${index + 1}`,
      timestamp,
      event_name: toStringValue(row.event_name) ?? `DNA Centre Event ${index + 1}`,
      category: toStringValue(row.category),
      severity: toStringValue(row.severity),
      src_ip: srcIp,
      dst_ip: dstIp,
      username: toStringValue(row.username),
      domain: toStringValue(row.site),
      url: toStringValue(row.ssid),
      raw_event: toStringValue(row.issue_type),
      sourceVendor: 'cisco_dnac',
      raw: row
    });

    // Security advisories and high/critical issues become alerts
    const isSecurity = toStringValue(row.category) === 'SecurityAdvisory';
    const sevStr = (toStringValue(row.severity) ?? '').toLowerCase();
    const isHighSev = sevStr === 'high' || sevStr === 'critical';
    if (isSecurity || (isHighSev && isNotEmpty(alertName))) {
      alerts.push({
        id: `dnac-alert-${index + 1}`,
        alert_name: alertName ?? toStringValue(row.event_name) ?? `DNA Centre Alert ${index + 1}`,
        severity: toStringValue(row.severity),
        risk_score: risk,
        src_ip: srcIp,
        dst_ip: dstIp,
        ioc_match: undefined,
        malware_family: undefined,
        anomaly_score: undefined,
        timestamp,
        sourceVendor: 'cisco_dnac',
        raw: row
      });
    }
  });

  // ── Cisco APIC / ACI ──────────────────────────────────────────────────────
  // APIC records are ACI fabric policy enforcement events. Permitted EPG flows
  // produce network flows; all rows become policy events; denied flows and fabric
  // faults become security alerts.
  // NOTE: The APIC CSV has col-1 labeled "timestamp" but it holds the event ID,
  // and col-2 labeled "event_id" holds the actual ISO timestamp — swapped headers.
  sources.cisco_apic.forEach((row, index) => {
    const timestamp = toTimestamp(row.event_id);
    const srcIp = toStringValue(row.src_ip);
    const dstIp = toStringValue(row.dst_ip);
    const bytes = toNumberValue(row.bytes) ?? 0;
    const packets = toNumberValue(row.packets) ?? 0;
    const risk = toNumberValue(row.risk_score);
    const action = toStringValue(row.action);
    const faultCode = toStringValue(row.fault_code);
    const alertName = toStringValue(row.alert_name);

    // Create a flow for actual traffic records (non-zero bytes, or permitted flows with IPs)
    if (srcIp && dstIp && (bytes > 0 || action === 'permit')) {
      flows.push({
        id: `apic-flow-${index + 1}`,
        timestamp,
        src_ip: srcIp,
        src_port: toStringValue(row.src_port),
        dst_ip: dstIp,
        dst_port: toStringValue(row.dst_port),
        protocol: toStringValue(row.protocol),
        application: toStringValue(row.contract) ?? toStringValue(row.src_epg),
        bytes,
        packets,
        direction: action === 'permit' ? 'OUTBOUND' : undefined,
        risk_score: risk,
        sourceVendor: 'cisco_apic',
        raw: row
      });
      connectAssets(assets, srcIp, dstIp, {
        hostname: toStringValue(row.src_hostname),
        deviceType: toStringValue(row.src_epg),
        sourceVendor: ['cisco_apic'],
        communicationVolume: bytes
      }, {
        hostname: toStringValue(row.dst_hostname),
        deviceType: toStringValue(row.dst_epg),
        sourceVendor: ['cisco_apic'],
        communicationVolume: bytes
      });
    }

    // Every APIC row is a policy event
    events.push({
      id: `apic-event-${index + 1}`,
      timestamp,
      event_name: toStringValue(row.event_name) ?? `APIC Event ${index + 1}`,
      category: toStringValue(row.category),
      severity: toStringValue(row.severity),
      src_ip: srcIp,
      dst_ip: dstIp,
      domain: `${toStringValue(row.tenant) ?? ''} / ${toStringValue(row.vrf) ?? ''}`.replace(/^ \/ $/, ''),
      raw_event: faultCode,
      sourceVendor: 'cisco_apic',
      raw: row
    });

    // Contract denies, fault codes, and high-risk events become alerts
    const isDeny = action === 'deny';
    const hasFault = isNotEmpty(faultCode);
    if (isDeny || hasFault || (risk !== undefined && risk >= 60)) {
      alerts.push({
        id: `apic-alert-${index + 1}`,
        alert_name: alertName ?? toStringValue(row.event_name) ?? `APIC Policy Alert ${index + 1}`,
        severity: toStringValue(row.severity),
        risk_score: risk,
        src_ip: srcIp,
        dst_ip: dstIp,
        ioc_match: faultCode,
        malware_family: undefined,
        anomaly_score: undefined,
        timestamp,
        sourceVendor: 'cisco_apic',
        raw: row
      });
    }
  });

  const sortedAssets = Array.from(assets.values()).sort((left, right) => right.communicationVolume - left.communicationVolume);
  const sortedFlows = flows.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  const sortedEvents = events.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  const sortedAlerts = alerts.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  // Shift all timestamps so the latest record = now, preserving relative gaps.
  // This makes time-window presets (Last 1h, Last 4h, etc.) work against real current time.
  const allTimestamps = [
    ...sortedFlows.map(r => new Date(r.timestamp).getTime()),
    ...sortedEvents.map(r => new Date(r.timestamp).getTime()),
    ...sortedAlerts.map(r => new Date(r.timestamp).getTime()),
  ].filter(t => !isNaN(t));

  if (allTimestamps.length > 0) {
    const dataMaxMs = Math.max(...allTimestamps);
    const shiftMs = Date.now() - dataMaxMs;
    const shiftTs = (ts: string): string => new Date(new Date(ts).getTime() + shiftMs).toISOString();

    sortedFlows.forEach(r => { r.timestamp = shiftTs(r.timestamp); });
    sortedEvents.forEach(r => { r.timestamp = shiftTs(r.timestamp); });
    sortedAlerts.forEach(r => { r.timestamp = shiftTs(r.timestamp); });
  }

  // ── Other Logs (generic best-effort) ────────────────────────────────────
  const pickField = (row: Record<string, string>, candidates: string[]): string | undefined => {
    for (const key of candidates) {
      const val = toStringValue(row[key]);
      if (val) return val;
    }
    for (const k of Object.keys(row)) {
      const lk = k.toLowerCase();
      if (candidates.some(c => lk.includes(c.replace('_', '')))) {
        const val = toStringValue(row[k]);
        if (val) return val;
      }
    }
    return undefined;
  };

  sources.other.forEach((row, index) => {
    const srcIp   = pickField(row, ['src_ip', 'source_ip', 'srcip', 'src', 'source']);
    const dstIp   = pickField(row, ['dst_ip', 'dest_ip', 'destination_ip', 'dstip', 'dst', 'destination']);
    const tsRaw   = pickField(row, ['timestamp', 'time', 'datetime', 'event_time', 'log_time', 'date']);
    const evtName = pickField(row, ['event_name', 'event', 'message', 'log_message', 'description', 'type', 'action']);
    const sev     = pickField(row, ['severity', 'level', 'priority', 'risk']);
    const user    = pickField(row, ['username', 'user', 'account', 'login']);
    const timestamp = tsRaw ? toTimestamp(tsRaw) : new Date().toISOString();

    events.push({
      id: `other-event-${index + 1}`,
      timestamp,
      event_name: evtName ?? `Other Log #${index + 1}`,
      category:   'other',
      severity:   sev ?? 'low',
      src_ip:     srcIp,
      dst_ip:     dstIp,
      username:   user,
      raw_event:  JSON.stringify(row),
      sourceVendor: 'other',
      raw: row,
    });

    if (srcIp || dstIp) {
      connectAssets(assets, srcIp, dstIp,
        { sourceVendor: ['other'], communicationVolume: 1 },
        { sourceVendor: ['other'], communicationVolume: 0 }
      );
    }
  });

  return {
    assets: sortedAssets,
    flows: sortedFlows,
    events: sortedEvents,
    alerts: sortedAlerts,
    summary: {
      qradarRows: sources.qradar.length,
      snaRows: sources.sna.length,
      aristaRows: sources.arista.length,
      ciscoIseRows: sources.cisco_ise.length,
      ciscoDnacRows: sources.cisco_dnac.length,
      ciscoApicRows: sources.cisco_apic.length,
      otherRows: sources.other.length,
      totalRows: sources.qradar.length + sources.sna.length + sources.arista.length +
                 sources.cisco_ise.length + sources.cisco_dnac.length + sources.cisco_apic.length +
                 sources.other.length
    }
  };
};
