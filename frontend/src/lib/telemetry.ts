import type {
  AlertRecord,
  Asset,
  EventRecord,
  Flow,
  NormalizedPayload
} from '@soc/telemetry-shared';

export interface TelemetryPayload extends NormalizedPayload {
  sourceCounts: {
    qradar: number;
    sna: number;
    arista: number;
  };
}

export interface TelemetryFilters {
  ip: string;
  protocol: string;
  hostname: string;
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  kind: 'flow' | 'event' | 'alert';
  label: string;
  source?: string;
  target?: string;
  protocol?: string;
  bytes?: number;
  severity?: string;
  risk?: number;
}

const normalize = (value: string) => value.trim().toLowerCase();

export const assetLabel = (asset: Asset) => asset.hostname ?? asset.ip;

export const protocolTone = (protocol?: string) => {
  const key = normalize(protocol ?? '');
  if (key.includes('tcp') || key.includes('https') || key.includes('tls')) return '#4cc9f0';
  if (key.includes('udp') || key.includes('dns')) return '#ffd166';
  if (key.includes('smb')) return '#f97316';
  if (key.includes('http')) return '#7c3aed';
  return '#8b9bb4';
};

export const severityTone = (severity?: string) => {
  const key = normalize(severity ?? '');
  if (key.includes('critical') || key === '10' || key === 'high') return '#ff5d73';
  if (key.includes('medium') || key === '6' || key === '7') return '#ffb84d';
  if (key.includes('low') || key === '3' || key === '4') return '#6ee7b7';
  return '#8b9bb4';
};

export const buildTimeline = (payload: TelemetryPayload): TimelineEntry[] => {
  const flowEntries = payload.flows.map((flow) => ({
    id: `flow-${flow.id}`,
    timestamp: flow.timestamp,
    kind: 'flow' as const,
    label: `${flow.src_ip} → ${flow.dst_ip}`,
    source: flow.src_ip,
    target: flow.dst_ip,
    protocol: flow.protocol,
    bytes: flow.bytes,
    risk: flow.risk_score
  }));

  const eventEntries = payload.events.map((event) => ({
    id: `event-${event.id}`,
    timestamp: event.timestamp,
    kind: 'event' as const,
    label: event.event_name,
    source: event.src_ip,
    target: event.dst_ip,
    severity: event.severity
  }));

  const alertEntries = payload.alerts.map((alert) => ({
    id: `alert-${alert.id}`,
    timestamp: alert.timestamp,
    kind: 'alert' as const,
    label: alert.alert_name,
    source: alert.src_ip,
    target: alert.dst_ip,
    severity: alert.severity,
    risk: alert.risk_score
  }));

  return [...flowEntries, ...eventEntries, ...alertEntries].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
};

const textMatches = (haystack: string | undefined, needle: string) => Boolean(haystack && haystack.toLowerCase().includes(needle));

export const matchesFilters = (
  filters: TelemetryFilters,
  ipCandidates: Array<string | undefined>,
  protocolCandidates: Array<string | undefined>,
  hostnameCandidates: Array<string | undefined>
) => {
  const ipNeedle = normalize(filters.ip);
  const protocolNeedle = normalize(filters.protocol);
  const hostnameNeedle = normalize(filters.hostname);

  const ipMatch = !ipNeedle || ipCandidates.some((value) => textMatches(value, ipNeedle));
  const protocolMatch = !protocolNeedle || protocolCandidates.some((value) => textMatches(value, protocolNeedle));
  const hostnameMatch = !hostnameNeedle || hostnameCandidates.some((value) => textMatches(value, hostnameNeedle));

  return ipMatch && protocolMatch && hostnameMatch;
};

export const filterPayload = (payload: TelemetryPayload, filters: TelemetryFilters, cutoff?: string): {
  assets: Asset[];
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
} => {
  const cutoffTime = cutoff ? new Date(cutoff).getTime() : Number.POSITIVE_INFINITY;
  const withinPlayback = (timestamp: string) => new Date(timestamp).getTime() <= cutoffTime;

  const flows = payload.flows.filter((flow) => withinPlayback(flow.timestamp) && matchesFilters(filters, [flow.src_ip, flow.dst_ip], [flow.protocol, flow.application], [flow.sni, flow.dns_query]));
  const events = payload.events.filter((event) => withinPlayback(event.timestamp) && matchesFilters(filters, [event.src_ip, event.dst_ip], [event.category, event.severity], [event.domain, event.url, event.filename]));
  const alerts = payload.alerts.filter((alert) => withinPlayback(alert.timestamp) && matchesFilters(filters, [alert.src_ip, alert.dst_ip], [alert.severity, alert.alert_name], [alert.alert_name, alert.ioc_match, alert.malware_family]));
  const assets = payload.assets.filter((asset) => matchesFilters(filters, [asset.ip], [asset.deviceType], [asset.hostname, asset.username]));

  return { assets, flows, events, alerts };
};

export const uniqueProtocols = (payload: TelemetryPayload) => Array.from(new Set(payload.flows.map((flow) => flow.protocol).filter((value): value is string => Boolean(value)))).sort();

export const uniqueHostnames = (payload: TelemetryPayload) => Array.from(new Set(payload.assets.map((asset) => asset.hostname).filter((value): value is string => Boolean(value)))).sort();

export const uniqueIps = (payload: TelemetryPayload) => Array.from(new Set(payload.assets.map((asset) => asset.ip))).sort();

export const buildPlaybackCutoff = (timeline: TimelineEntry[], index: number) => timeline[Math.min(index, timeline.length - 1)]?.timestamp;
