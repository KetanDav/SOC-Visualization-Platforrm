import type { AlertRecord, Asset, EventRecord, Flow, IncidentAnalysisContextPackage, IncidentAnalysisTarget, IncidentRelationship, IncidentTimelinePoint } from '@soc/telemetry-shared';
import type { TelemetryPayload } from './telemetry';

export interface IncidentScopeData {
  assets: Asset[];
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
}

const MAX_FLOW_CONTEXT = 8;
const MAX_EVENT_CONTEXT = 6;
const MAX_ALERT_CONTEXT = 6;
const MAX_TIMELINE_POINTS = 12;
const MAX_RELATIONSHIPS = 10;
const MAX_INDICATORS = 8;

function uniqueValues(values: Array<string | undefined | null>, limit = MAX_INDICATORS): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim())))).slice(0, limit);
}

function sortByTimeDesc<T extends { timestamp: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
}

function sortByTimeAsc<T extends { timestamp: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

function flowScore(flow: Flow): number {
  return Number(flow.risk_score ?? 0) + Math.min(10, Math.log10(flow.bytes + 1));
}

function alertScore(alert: AlertRecord): number {
  return Number(alert.risk_score ?? 0) + Number(alert.anomaly_score ?? 0) / 10 + (alert.severity?.toLowerCase() === 'critical' ? 10 : 0);
}

function eventScore(event: EventRecord): number {
  const severity = (event.severity ?? '').toLowerCase();
  if (severity === 'critical') return 90;
  if (severity === 'high') return 70;
  if (severity === 'medium') return 50;
  if (severity === 'low') return 30;
  return 10;
}

function extractTargetIps(target: IncidentAnalysisTarget, selectedAlert: AlertRecord | null): string[] {
  const ips = new Set<string>();

  if (target.ip) {
    ips.add(target.ip);
  }

  if (selectedAlert?.src_ip) {
    ips.add(selectedAlert.src_ip);
  }
  if (selectedAlert?.dst_ip) {
    ips.add(selectedAlert.dst_ip);
  }

  return Array.from(ips);
}

function buildRelationshipEvidence(flow: Flow, focusIps: Set<string>): IncidentRelationship | null {
  const isRelevant = focusIps.has(flow.src_ip) || focusIps.has(flow.dst_ip);
  if (!isRelevant) {
    return null;
  }

  const direction = focusIps.has(flow.src_ip)
    ? `${flow.src_ip} -> ${flow.dst_ip}`
    : `${flow.dst_ip} <- ${flow.src_ip}`;

  return {
    source: flow.src_ip,
    target: flow.dst_ip,
    kind: 'flow',
    evidence: `${direction} ${flow.protocol ?? 'flow'} ${flow.application ? `(${flow.application})` : ''}`.trim(),
    protocol: flow.protocol,
    bytes: flow.bytes,
    risk: flow.risk_score,
  };
}

function buildTimelinePoint(record: Flow | EventRecord | AlertRecord): IncidentTimelinePoint {
  if ('alert_name' in record) {
    return {
      timestamp: record.timestamp,
      kind: 'alert',
      label: record.alert_name,
      detail: [record.severity, record.malware_family, record.ioc_match].filter(Boolean).join(' · '),
      src_ip: record.src_ip,
      dst_ip: record.dst_ip,
      severity: record.severity,
      risk: record.risk_score,
    };
  }

  if ('event_name' in record) {
    return {
      timestamp: record.timestamp,
      kind: 'event',
      label: record.event_name,
      detail: [record.category, record.severity, record.username, record.domain].filter(Boolean).join(' · '),
      src_ip: record.src_ip,
      dst_ip: record.dst_ip,
      severity: record.severity,
    };
  }

  return {
    timestamp: record.timestamp,
    kind: 'flow',
    label: `${record.protocol ?? 'flow'} ${record.application ?? ''}`.trim(),
    detail: [record.direction, `${record.bytes.toLocaleString()} bytes`, `risk ${record.risk_score ?? 0}`].filter(Boolean).join(' · '),
    src_ip: record.src_ip,
    dst_ip: record.dst_ip,
    risk: record.risk_score,
  };
}

export function buildIncidentAnalysisContext(
  payload: TelemetryPayload,
  scope: IncidentScopeData,
  target: IncidentAnalysisTarget,
): IncidentAnalysisContextPackage {
  const selectedAlert = target.kind === 'alert'
    ? scope.alerts.find((alert) => alert.id === target.alertId)
      ?? payload.alerts.find((alert) => alert.id === target.alertId)
      ?? null
    : null;

  const targetIps = extractTargetIps(target, selectedAlert);
  const selectedAsset = targetIps.length > 0
    ? scope.assets.find((asset) => targetIps.includes(asset.ip))
      ?? payload.assets.find((asset) => targetIps.includes(asset.ip))
      ?? null
    : null;
  const focusIps = new Set<string>([...targetIps, selectedAsset?.ip].filter((ip): ip is string => Boolean(ip)));

  const relatedFlows = sortByTimeDesc(
    scope.flows.filter((flow) => focusIps.has(flow.src_ip) || focusIps.has(flow.dst_ip))
      .sort((left, right) => flowScore(right) - flowScore(left))
  ).slice(0, MAX_FLOW_CONTEXT);

  const relatedEvents = sortByTimeDesc(
    scope.events.filter((event) => focusIps.has(event.src_ip ?? '') || focusIps.has(event.dst_ip ?? ''))
      .sort((left, right) => eventScore(right) - eventScore(left))
  ).slice(0, MAX_EVENT_CONTEXT);

  const relatedAlerts = sortByTimeDesc(
    scope.alerts.filter((alert) => {
      if (selectedAlert && alert.id === selectedAlert.id) {
        return true;
      }

      const sharesIp = focusIps.has(alert.src_ip ?? '') || focusIps.has(alert.dst_ip ?? '');
      const sharesIndicators = Boolean(selectedAlert && (
        (selectedAlert.ioc_match && alert.ioc_match === selectedAlert.ioc_match) ||
        (selectedAlert.malware_family && alert.malware_family === selectedAlert.malware_family)
      ));

      return sharesIp || sharesIndicators;
    }).sort((left, right) => alertScore(right) - alertScore(left))
  ).slice(0, MAX_ALERT_CONTEXT);

  const relatedIpSet = new Set<string>([...focusIps]);
  for (const flow of relatedFlows) {
    relatedIpSet.add(flow.src_ip);
    relatedIpSet.add(flow.dst_ip);
  }
  for (const event of relatedEvents) {
    if (event.src_ip) relatedIpSet.add(event.src_ip);
    if (event.dst_ip) relatedIpSet.add(event.dst_ip);
  }
  for (const alert of relatedAlerts) {
    if (alert.src_ip) relatedIpSet.add(alert.src_ip);
    if (alert.dst_ip) relatedIpSet.add(alert.dst_ip);
  }

  const relatedAssets = payload.assets.filter((asset) => relatedIpSet.has(asset.ip));

  const relationships = Array.from(new Map(
    relatedFlows
      .map((flow) => buildRelationshipEvidence(flow, focusIps))
      .filter((relationship): relationship is IncidentRelationship => Boolean(relationship))
      .map((relationship) => [`${relationship.source}|${relationship.target}|${relationship.kind}|${relationship.protocol ?? ''}`, relationship])
  ).values()).slice(0, MAX_RELATIONSHIPS);

  const timeline = sortByTimeAsc([
    ...relatedFlows.map(buildTimelinePoint),
    ...relatedEvents.map(buildTimelinePoint),
    ...relatedAlerts.map(buildTimelinePoint),
  ]).slice(-MAX_TIMELINE_POINTS);

  const ips = uniqueValues([
    ...targetIps,
    ...relatedFlows.flatMap((flow) => [flow.src_ip, flow.dst_ip]),
    ...relatedEvents.flatMap((event) => [event.src_ip, event.dst_ip]),
    ...relatedAlerts.flatMap((alert) => [alert.src_ip, alert.dst_ip]),
  ]);

  const hosts = uniqueValues([
    selectedAsset?.hostname,
    ...relatedAssets.map((asset) => asset.hostname),
    ...relatedEvents.map((event) => event.domain),
    ...relatedFlows.map((flow) => flow.sni),
    ...relatedFlows.map((flow) => flow.dns_query),
  ]);

  const users = uniqueValues([
    selectedAsset?.username,
    ...relatedAssets.map((asset) => asset.username),
    ...relatedEvents.map((event) => event.username),
  ]);

  const domains = uniqueValues([
    ...relatedEvents.map((event) => event.domain),
    ...relatedEvents.map((event) => event.url),
    ...relatedFlows.map((flow) => flow.sni),
    ...relatedFlows.map((flow) => flow.dns_query),
  ]);

  const protocols = uniqueValues(relatedFlows.map((flow) => flow.protocol ?? flow.application));
  const malwareFamilies = uniqueValues(relatedAlerts.map((alert) => alert.malware_family));
  const iocMatches = uniqueValues(relatedAlerts.map((alert) => alert.ioc_match).filter((ioc) => ioc && ioc !== 'no'));
  const vendors = uniqueValues([
    ...relatedAssets.flatMap((asset) => asset.sourceVendor),
    ...relatedFlows.map((flow) => flow.sourceVendor),
    ...relatedEvents.map((event) => event.sourceVendor),
    ...relatedAlerts.map((alert) => alert.sourceVendor),
  ]);

  const allTimestamps = [...relatedFlows, ...relatedEvents, ...relatedAlerts]
    .map((entry) => new Date(entry.timestamp).getTime())
    .filter((value) => Number.isFinite(value));

  const timeRange = allTimestamps.length > 0
    ? {
        from: new Date(Math.min(...allTimestamps)).toISOString(),
        to: new Date(Math.max(...allTimestamps)).toISOString(),
      }
    : undefined;

  const totalBytes = relatedFlows.reduce((sum, flow) => sum + flow.bytes, 0);
  const maxRisk = Math.max(
    0,
    ...relatedFlows.map((flow) => flow.risk_score ?? 0),
    ...relatedAlerts.map((alert) => alert.risk_score ?? 0),
    ...relatedEvents.map((event) => event.severity?.toLowerCase() === 'critical' ? 100 : event.severity?.toLowerCase() === 'high' ? 80 : 0),
  );

  const scopeLabel = target.label
    ?? selectedAsset?.hostname
    ?? selectedAsset?.ip
    ?? selectedAlert?.alert_name
    ?? target.ip
    ?? target.alertId
    ?? 'incident';

  const notes = [
    `Context assembled from the current dashboard scope with ${relatedFlows.length} flows, ${relatedEvents.length} events, and ${relatedAlerts.length} alerts.`,
    selectedAlert ? `Alert focus: ${selectedAlert.alert_name}.` : 'No single alert was selected; analysis is anchored on the incident scope.',
    relatedAssets.length > 0 ? `Related assets discovered: ${relatedAssets.length}.` : 'No directly related asset record was found in the normalized asset inventory.',
  ];

  return {
    generatedAt: new Date().toISOString(),
    target,
    scopeLabel,
    selectedIp: selectedAsset?.ip ?? target.ip ?? null,
    selectedAsset,
    selectedAlert,
    summary: {
      totalAssets: payload.assets.length,
      totalFlows: payload.flows.length,
      totalEvents: payload.events.length,
      totalAlerts: payload.alerts.length,
      relatedAssets: relatedAssets.length,
      relatedFlows: relatedFlows.length,
      relatedEvents: relatedEvents.length,
      relatedAlerts: relatedAlerts.length,
      uniqueIps: ips.length,
      maxRisk,
      totalBytes,
      timeRange,
    },
    indicators: {
      ips,
      hosts,
      users,
      domains,
      protocols,
      malwareFamilies,
      iocMatches,
      vendors,
    },
    relatedAssets,
    relatedFlows,
    relatedEvents,
    relatedAlerts,
    relationships,
    timeline,
    notes,
  };
}
