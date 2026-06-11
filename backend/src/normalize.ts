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

export const normalizeTelemetry = (sources: LoadedSourceRows) => {
  const assets = new Map<string, Asset>();
  const flows: Flow[] = [];
  const events: EventRecord[] = [];
  const alerts: AlertRecord[] = [];

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

  sources.sna.forEach((row, index) => {
    const timestamp = toTimestamp(row.first_seen);
    const srcIp = toStringValue(row.src_ip);
    const dstIp = toStringValue(row.dst_ip);
    const bytes = toNumberValue(row.bytes) ?? 0;
    const packets = toNumberValue(row.packets) ?? 0;
    const risk = toNumberValue(row.risk_score);
    const threat = toNumberValue(row.threat_score);
    const effectiveRisk = risk ?? threat;

    if (srcIp && dstIp) {
      flows.push({
        id: `sna-flow-${index + 1}`,
        timestamp,
        src_ip: srcIp,
        src_port: toStringValue(row.src_port),
        dst_ip: dstIp,
        dst_port: toStringValue(row.dst_port),
        protocol: toStringValue(row.protocol),
        application: toStringValue(row.application),
        bytes,
        packets,
        direction: toStringValue(row.flow_direction),
        ja3: toStringValue(row.ja3),
        sni: toStringValue(row.sni) ?? toStringValue(row.http_host),
        dns_query: toStringValue(row.dns_query),
        risk_score: effectiveRisk,
        sourceVendor: 'sna',
        raw: row
      });
      connectAssets(assets, srcIp, dstIp, {
        hostname: toStringValue(row.src_hostname),
        mac: toStringValue(row.src_mac),
        country: toStringValue(row.src_country),
        asn: toStringValue(row.src_asn),
        sourceVendor: ['sna'],
        communicationVolume: bytes
      }, {
        hostname: toStringValue(row.dst_hostname),
        mac: toStringValue(row.dst_mac),
        country: toStringValue(row.dst_country),
        asn: toStringValue(row.dst_asn),
        sourceVendor: ['sna'],
        communicationVolume: bytes
      });
    }

    if (isNotEmpty(toStringValue(row.alarm_name)) || isNotEmpty(toStringValue(row.ioc_match))) {
      alerts.push({
        id: `sna-alert-${index + 1}`,
        alert_name: toStringValue(row.alarm_name) ?? `Cisco SNA Alert ${index + 1}`,
        severity: toStringValue(row.alarm_severity),
        risk_score: effectiveRisk,
        src_ip: srcIp,
        dst_ip: dstIp,
        ioc_match: toStringValue(row.ioc_match),
        malware_family: undefined,
        anomaly_score: toNumberValue(row.anomaly_score),
        timestamp,
        sourceVendor: 'sna',
        raw: row
      });
    }
  });

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

  const sortedAssets = Array.from(assets.values()).sort((left, right) => right.communicationVolume - left.communicationVolume);
  const sortedFlows = flows.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  const sortedEvents = events.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  const sortedAlerts = alerts.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  return {
    assets: sortedAssets,
    flows: sortedFlows,
    events: sortedEvents,
    alerts: sortedAlerts
  };
};
