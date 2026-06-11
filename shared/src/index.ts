export type VendorName = 'qradar' | 'sna' | 'arista';

export interface Asset {
  ip: string;
  hostname?: string;
  mac?: string;
  country?: string;
  asn?: string;
  username?: string;
  deviceType?: string;
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
    totalRows: number;
  };
}

export interface LoadedSourceRows {
  qradar: Array<Record<string, string>>;
  sna: Array<Record<string, string>>;
  arista: Array<Record<string, string>>;
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
