export type VendorName = 'qradar' | 'sna' | 'arista' | 'cisco_ise' | 'cisco_dnac' | 'cisco_apic' | 'other' | (string & {});

export interface Asset {
  ip: string;
  hostname?: string;
  mac?: string;
  country?: string;
  asn?: string;
  username?: string;
  deviceType?: string;
  // Cisco ISE / NAC attributes
  vlan?: string;
  switchIp?: string;
  switchPort?: string;
  switchPortType?: string;
  securityGroup?: string;
  policySet?: string;
  authRule?: string;
  postureStatus?: string;
  endpointProfile?: string;
  auditSessionId?: string;
  riskScore?: number;
  sourceVendor: VendorName[];
  communicationVolume: number;
}

export interface Flow {
  id: string;
  timestamp: string;
  src_ip: string;
  src_port?: string;
  dst_ip: string;
  dst_port?: string;
  protocol?: string;
  application?: string;
  bytes: number;
  packets: number;
  direction?: string;
  ja3?: string;
  sni?: string;
  dns_query?: string;
  risk_score?: number;
  sourceVendor: VendorName;
  raw: Record<string, string>;
}

export interface EventRecord {
  id: string;
  timestamp: string;
  event_name: string;
  category?: string;
  severity?: string;
  src_ip?: string;
  dst_ip?: string;
  username?: string;
  process_name?: string;
  filename?: string;
  domain?: string;
  url?: string;
  raw_event?: string;
  sourceVendor: VendorName;
  raw: Record<string, string>;
}

export interface AlertRecord {
  id: string;
  alert_name: string;
  severity?: string;
  risk_score?: number;
  src_ip?: string;
  dst_ip?: string;
  ioc_match?: string;
  malware_family?: string;
  anomaly_score?: number;
  timestamp: string;
  sourceVendor: VendorName;
  raw: Record<string, string>;
}

export interface NormalizedPayload {
  assets: Asset[];
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
  summary: {
    qradarRows: number;
    snaRows: number;
    aristaRows: number;
    ciscoIseRows: number;
    ciscoDnacRows: number;
    ciscoApicRows: number;
    otherRows: number;
    totalRows: number;
  };
}

export interface LoadedSourceRows {
  qradar: Array<Record<string, string>>;
  sna: Array<Record<string, string>>;
  arista: Array<Record<string, string>>;
  cisco_ise: Array<Record<string, string>>;
  cisco_dnac: Array<Record<string, string>>;
  cisco_apic: Array<Record<string, string>>;
  other: Array<Record<string, string>>;
}

export const isNotEmpty = (value: string | undefined | null): value is string => Boolean(value && value.trim().length > 0);

export const toStringValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

export const toNumberValue = (value: unknown): number | undefined => {
  const text = toStringValue(value);
  if (!text) {
    return undefined;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const toTimestamp = (value: unknown): string => {
  const text = toStringValue(value);
  if (!text) {
    return new Date().toISOString();
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
};

export interface IncidentAnalysisTarget {
  kind: 'ip' | 'alert';
  ip?: string;
  alertId?: string;
  label?: string;
  query?: string;
}

export interface IncidentAnalysisEntity {
  type: 'ip' | 'host' | 'user' | 'domain' | 'alert' | 'process' | 'protocol' | 'ioc';
  value: string;
  role: string;
}

export interface IncidentTimelinePoint {
  timestamp: string;
  kind: 'flow' | 'event' | 'alert';
  label: string;
  detail?: string;
  src_ip?: string;
  dst_ip?: string;
  severity?: string;
  risk?: number;
}

export interface IncidentRelationship {
  source: string;
  target: string;
  kind: 'flow' | 'alert' | 'event';
  evidence: string;
  protocol?: string;
  bytes?: number;
  risk?: number;
}

export interface IncidentAnalysisContextPackage {
  generatedAt: string;
  target: IncidentAnalysisTarget;
  scopeLabel: string;
  selectedIp?: string | null;
  selectedAsset?: Asset | null;
  selectedAlert?: AlertRecord | null;
  summary: {
    totalAssets: number;
    totalFlows: number;
    totalEvents: number;
    totalAlerts: number;
    relatedAssets: number;
    relatedFlows: number;
    relatedEvents: number;
    relatedAlerts: number;
    uniqueIps: number;
    maxRisk: number;
    totalBytes: number;
    timeRange?: {
      from: string;
      to: string;
    };
  };
  indicators: {
    ips: string[];
    hosts: string[];
    users: string[];
    domains: string[];
    protocols: string[];
    malwareFamilies: string[];
    iocMatches: string[];
    vendors: string[];
  };
  relatedAssets: Asset[];
  relatedFlows: Flow[];
  relatedEvents: EventRecord[];
  relatedAlerts: AlertRecord[];
  relationships: IncidentRelationship[];
  timeline: IncidentTimelinePoint[];
  notes: string[];
}

export interface IncidentAnalysisResult {
  incidentSummary: string;
  severity: 'informational' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  likelyStage: string;
  keyFindings: string[];
  supportingEvidence: string[];
  affectedEntities: IncidentAnalysisEntity[];
  recommendedNextSteps: string[];
  evidenceGaps: string[];
  iocCandidates: string[];
  analystNotes: string;
}

export interface IncidentAnalysisResponse {
  ok: boolean;
  model: string;
  durationMs: number;
  analysis: IncidentAnalysisResult | null;
  fallbackMessage?: string;
  error?: {
    code: string;
    message: string;
  };
}
