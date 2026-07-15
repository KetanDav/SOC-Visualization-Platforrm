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
    cisco_ise: number;
    cisco_dnac: number;
    cisco_apic: number;
  };
}

export interface TelemetryFilters {
  query: string;
  timeFrom?: string;
  timeTo?: string;
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

// ─── Query Language ──────────────────────────────────────────────────────────
//
// Supported syntax:
//   ip:10.0.0.1              field contains
//   ip:=10.0.0.1             field exact match
//   risk:>75                 numeric greater-than
//   risk:>=75                numeric gte
//   risk:<50                 numeric less-than
//   risk:<=50                numeric lte
//   risk:50..100             numeric range (inclusive)
//   ip:10.0.*                wildcard (* = any chars, ? = one char)
//   alert:"lateral move"     quoted phrase
//   severity:high AND risk:>75
//   proto:TCP OR proto:UDP
//   NOT severity:low  / -severity:low
//   (ip:10.0.0.1 OR ip:10.0.0.2) AND proto:TCP
//   bare words search all fields
//   Implicit AND between space-separated terms

type CompareOp = 'contains' | 'exact' | 'gt' | 'lt' | 'gte' | 'lte' | 'range';

interface TermNode {
  kind: 'TERM';
  field: string | null;
  op: CompareOp;
  value: string;
}

interface AndNode { kind: 'AND'; nodes: QueryNode[] }
interface OrNode  { kind: 'OR';  nodes: QueryNode[] }
interface NotNode { kind: 'NOT'; node: QueryNode }

type QueryNode = TermNode | AndNode | OrNode | NotNode;

// ─── Lexer ───────────────────────────────────────────────────────────────────

type LexTok =
  | { t: 'AND' }
  | { t: 'OR' }
  | { t: 'NOT' }
  | { t: 'LP' }
  | { t: 'RP' }
  | { t: 'TERM'; field: string | null; op: CompareOp; value: string };

const FIELD_ALIASES: Record<string, string> = {
  proto: 'protocol',
  host: 'hostname',
  malware: 'malware_family',
  family: 'malware_family',
  ioc: 'ioc_match',
};

function resolveField(raw: string): string {
  return FIELD_ALIASES[raw] ?? raw;
}

function parseOp(rest: string): { op: CompareOp; rest: string } {
  if (rest.startsWith('>=')) return { op: 'gte', rest: rest.slice(2) };
  if (rest.startsWith('<=')) return { op: 'lte', rest: rest.slice(2) };
  if (rest.startsWith('>'))  return { op: 'gt',  rest: rest.slice(1) };
  if (rest.startsWith('<'))  return { op: 'lt',  rest: rest.slice(1) };
  if (rest.startsWith('='))  return { op: 'exact', rest: rest.slice(1) };
  return { op: 'contains', rest };
}

function lexQuery(input: string): LexTok[] {
  const toks: LexTok[] = [];
  let i = 0;

  while (i < input.length) {
    // whitespace
    if (/\s/.test(input[i])) { i++; continue; }

    // parens
    if (input[i] === '(') { toks.push({ t: 'LP' }); i++; continue; }
    if (input[i] === ')') { toks.push({ t: 'RP' }); i++; continue; }

    // leading - as NOT shorthand (only at start or after whitespace/LP)
    if (input[i] === '-') {
      const prev = i === 0 ? ' ' : input[i - 1];
      if (/[\s(]/.test(prev)) { toks.push({ t: 'NOT' }); i++; continue; }
    }

    // quoted bare string (no field prefix)
    if (input[i] === '"') {
      const end = input.indexOf('"', i + 1);
      const val = end === -1 ? input.slice(i + 1) : input.slice(i + 1, end);
      toks.push({ t: 'TERM', field: null, op: 'contains', value: val.toLowerCase() });
      i = end === -1 ? input.length : end + 1;
      continue;
    }

    // collect chars until whitespace or paren
    let j = i;
    while (j < input.length && !/[\s()]/.test(input[j])) j++;
    let word = input.slice(i, j);

    // For field:"quoted value with spaces" — if the field value opens a quote
    // but doesn't close it within this token, extend across spaces to the closing quote.
    // e.g. event:"User Login" would otherwise split into event:"User  and  Login"
    {
      const cIdx = word.indexOf(':');
      if (cIdx > 0 && cIdx < word.length) {
        const afterColon = word.slice(cIdx + 1).replace(/^(>=?|<=?|=)/, '');
        if (afterColon.startsWith('"') && afterColon.indexOf('"', 1) === -1) {
          const closeQ = input.indexOf('"', j);
          if (closeQ !== -1) {
            word = input.slice(i, closeQ + 1);
            j = closeQ + 1;
          }
        }
      }
    }

    i = j;

    // keywords
    const up = word.toUpperCase();
    if (up === 'AND') { toks.push({ t: 'AND' }); continue; }
    if (up === 'OR')  { toks.push({ t: 'OR' });  continue; }
    if (up === 'NOT') { toks.push({ t: 'NOT' }); continue; }

    // field:value or bare word
    const colon = word.indexOf(':');
    // Silently skip lone "field:" tokens with nothing after the colon so they
    // don't fall through as bare-word searches that match nothing.
    if (colon > 0 && colon === word.length - 1) continue;
    if (colon > 0 && colon < word.length - 1) {
      const rawField = resolveField(word.slice(0, colon).toLowerCase());
      let rest = word.slice(colon + 1);

      const { op, rest: afterOp } = parseOp(rest);
      rest = afterOp;

      // quoted value after operator
      if (rest.startsWith('"')) {
        const endQ = rest.indexOf('"', 1);
        rest = endQ >= 1 ? rest.slice(1, endQ) : rest.slice(1);
      }

      // range detection: value..value
      const rangeMatch = rest.match(/^(.+?)\.\.(.+)$/);
      if (rangeMatch) {
        toks.push({ t: 'TERM', field: rawField, op: 'range', value: `${rangeMatch[1].toLowerCase()}..${rangeMatch[2].toLowerCase()}` });
      } else {
        toks.push({ t: 'TERM', field: rawField, op, value: rest.toLowerCase() });
      }
    } else {
      // bare word (skip lone colon-only words)
      if (word !== ':') {
        toks.push({ t: 'TERM', field: null, op: 'contains', value: word.toLowerCase() });
      }
    }
  }

  return toks;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

class QueryParser {
  private toks: LexTok[];
  private pos = 0;

  constructor(toks: LexTok[]) { this.toks = toks; }

  private peek(): LexTok | undefined { return this.toks[this.pos]; }
  private eat(): LexTok | undefined  { return this.toks[this.pos++]; }

  parse(): QueryNode {
    if (this.toks.length === 0) return { kind: 'AND', nodes: [] };
    return this.parseOr();
  }

  private parseOr(): QueryNode {
    const nodes = [this.parseAnd()];
    while (this.peek()?.t === 'OR') {
      this.eat();
      nodes.push(this.parseAnd());
    }
    return nodes.length === 1 ? nodes[0] : { kind: 'OR', nodes };
  }

  private parseAnd(): QueryNode {
    const nodes = [this.parseNot()];
    while (this.peek() && this.peek()!.t !== 'OR' && this.peek()!.t !== 'RP') {
      if (this.peek()!.t === 'AND') this.eat(); // explicit AND
      if (!this.peek() || this.peek()!.t === 'OR' || this.peek()!.t === 'RP') break;
      nodes.push(this.parseNot());
    }
    return nodes.length === 1 ? nodes[0] : { kind: 'AND', nodes };
  }

  private parseNot(): QueryNode {
    if (this.peek()?.t === 'NOT') {
      this.eat();
      return { kind: 'NOT', node: this.parseAtom() };
    }
    return this.parseAtom();
  }

  private parseAtom(): QueryNode {
    const tok = this.peek();
    if (!tok) return { kind: 'AND', nodes: [] };

    if (tok.t === 'LP') {
      this.eat();
      const inner = this.parseOr();
      if (this.peek()?.t === 'RP') this.eat();
      return inner;
    }

    if (tok.t === 'TERM') {
      this.eat();
      return { kind: 'TERM', field: tok.field, op: tok.op, value: tok.value };
    }

    this.eat(); // skip unexpected token
    return { kind: 'AND', nodes: [] };
  }
}

export function parseQuery(query: string): QueryNode {
  return new QueryParser(lexQuery(query)).parse();
}

// Expose the parsed AST for the UI to highlight syntax errors / tokens
export function lexQueryTokens(query: string): LexTok[] {
  return lexQuery(query);
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

type AnyRecord = Flow | EventRecord | AlertRecord | Asset;
type RecordKind = 'flow' | 'event' | 'alert' | 'asset';

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function hasGlob(v: string): boolean {
  return v.includes('*') || v.includes('?');
}

function matchStr(haystack: string | undefined | null, op: CompareOp, needle: string): boolean {
  if (haystack === undefined || haystack === null) return false;
  const h = haystack.toLowerCase();

  if (op === 'contains') {
    if (hasGlob(needle)) return globToRegex(needle).test(h);
    return h.includes(needle);
  }
  if (op === 'exact') return h === needle;
  if (op === 'gt')  { const n = parseFloat(h); return !isNaN(n) && n >  parseFloat(needle); }
  if (op === 'lt')  { const n = parseFloat(h); return !isNaN(n) && n <  parseFloat(needle); }
  if (op === 'gte') { const n = parseFloat(h); return !isNaN(n) && n >= parseFloat(needle); }
  if (op === 'lte') { const n = parseFloat(h); return !isNaN(n) && n <= parseFloat(needle); }
  if (op === 'range') {
    const [lo, hi] = needle.split('..').map(parseFloat);
    const n = parseFloat(h);
    return !isNaN(n) && n >= lo && n <= hi;
  }
  return h.includes(needle);
}

function matchNumeric(score: number | undefined, op: CompareOp, needle: string): boolean {
  if (score === undefined) return false;
  if (op === 'contains' || op === 'exact') return String(score).includes(needle);
  if (op === 'gt')  return score >  parseFloat(needle);
  if (op === 'lt')  return score <  parseFloat(needle);
  if (op === 'gte') return score >= parseFloat(needle);
  if (op === 'lte') return score <= parseFloat(needle);
  if (op === 'range') {
    const [lo, hi] = needle.split('..').map(parseFloat);
    return score >= lo && score <= hi;
  }
  return String(score).includes(needle);
}

function evalTerm(node: TermNode, record: AnyRecord, kind: RecordKind): boolean {
  const { field, op, value } = node;
  const ms = (h: string | undefined | null) => matchStr(h, op, value);

  if (!field) {
    // bare word — check all string fields
    const allStrings = Object.values(record).flatMap((v) => {
      if (typeof v === 'string') return [v];
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
      if (v !== null && typeof v === 'object') return Object.values(v).filter((x): x is string => typeof x === 'string');
      return [];
    });
    return allStrings.some((s) => matchStr(s, op, value));
  }

  if (field === 'type')   return kind.includes(value);

  if (field === 'vendor') {
    const v = record.sourceVendor;
    if (Array.isArray(v)) return v.some((s) => matchStr(s, op, value));
    return ms(v as string);
  }

  if (field === 'risk')     return matchNumeric((record as Flow | AlertRecord).risk_score, op, value);
  if (field === 'bytes')    return matchNumeric((record as Flow).bytes, op, value);
  if (field === 'packets')  return matchNumeric((record as Flow).packets, op, value);

  if (field === 'ip') return [
    (record as Flow | EventRecord | AlertRecord).src_ip,
    (record as Flow | EventRecord | AlertRecord).dst_ip,
    (record as Asset).ip,
  ].some(ms);

  if (field === 'src') return ms((record as Flow | EventRecord | AlertRecord).src_ip);
  if (field === 'dst') return ms((record as Flow | EventRecord | AlertRecord).dst_ip);

  if (field === 'protocol') return [
    (record as Flow).protocol,
    (record as Flow).application,
    (record as EventRecord).category,
  ].some(ms);

  if (field === 'hostname') return [
    (record as Asset).hostname,
    (record as Flow).sni,
    (record as Flow).dns_query,
    (record as EventRecord).domain,
  ].some(ms);

  if (field === 'severity')      return ms((record as EventRecord | AlertRecord).severity);
  if (field === 'alert')         return ms((record as AlertRecord).alert_name);
  if (field === 'event')         return ms((record as EventRecord).event_name);
  if (field === 'port')          return [(record as Flow).src_port, (record as Flow).dst_port].some(ms);
  if (field === 'mac')           return ms((record as Asset).mac);
  if (field === 'country')       return ms((record as Asset).country);
  if (field === 'username')      return ms((record as Asset | EventRecord).username);
  if (field === 'malware_family') return ms((record as AlertRecord).malware_family);
  if (field === 'ioc_match')     return ms((record as AlertRecord).ioc_match);
  if (field === 'process')       return ms((record as EventRecord).process_name);
  if (field === 'filename')      return ms((record as EventRecord).filename);
  if (field === 'url')           return ms((record as EventRecord).url);
  if (field === 'domain')        return ms((record as EventRecord).domain);
  if (field === 'asn')           return ms((record as Asset).asn);
  if (field === 'devicetype')    return ms((record as Asset).deviceType);

  // unknown field — try raw field match via record keys
  const rawVal = (record as unknown as Record<string, unknown>)[field];
  if (typeof rawVal === 'string') return ms(rawVal);
  if (typeof rawVal === 'number') return matchNumeric(rawVal, op, value);
  return false;
}

function evalNode(node: QueryNode, record: AnyRecord, kind: RecordKind): boolean {
  switch (node.kind) {
    case 'AND': return node.nodes.length === 0 || node.nodes.every((n) => evalNode(n, record, kind));
    case 'OR':  return node.nodes.some((n) => evalNode(n, record, kind));
    case 'NOT': return !evalNode(node.node, record, kind);
    case 'TERM': return evalTerm(node, record, kind);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

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

  return [...flowEntries, ...eventEntries, ...alertEntries].sort(
    (l, r) => new Date(l.timestamp).getTime() - new Date(r.timestamp).getTime()
  );
};

export const filterPayload = (
  payload: TelemetryPayload,
  filters: TelemetryFilters,
  cutoff?: string
): { assets: Asset[]; flows: Flow[]; events: EventRecord[]; alerts: AlertRecord[] } => {
  const cutoffTime = cutoff ? new Date(cutoff).getTime() : Number.POSITIVE_INFINITY;
  const withinPlayback = (ts: string) => new Date(ts).getTime() <= cutoffTime;

  const fromTime = filters.timeFrom ? new Date(filters.timeFrom).getTime() : Number.NEGATIVE_INFINITY;
  const toTime   = filters.timeTo   ? new Date(filters.timeTo).getTime()   : Number.POSITIVE_INFINITY;
  const withinRange = (ts: string) => {
    const t = new Date(ts).getTime();
    return t >= fromTime && t <= toTime;
  };

  const ast = parseQuery(filters.query);

  return {
    flows:  payload.flows.filter((r) => withinPlayback(r.timestamp) && withinRange(r.timestamp) && evalNode(ast, r, 'flow')),
    events: payload.events.filter((r) => withinPlayback(r.timestamp) && withinRange(r.timestamp) && evalNode(ast, r, 'event')),
    alerts: payload.alerts.filter((r) => withinPlayback(r.timestamp) && withinRange(r.timestamp) && evalNode(ast, r, 'alert')),
    assets: payload.assets.filter((r) => evalNode(ast, r, 'asset')),
  };
};

export const uniqueProtocols = (payload: TelemetryPayload) =>
  Array.from(new Set(payload.flows.map((f) => f.protocol).filter((v): v is string => Boolean(v)))).sort();

export const uniqueHostnames = (payload: TelemetryPayload) =>
  Array.from(new Set(payload.assets.map((a) => a.hostname).filter((v): v is string => Boolean(v)))).sort();

export const uniqueIps = (payload: TelemetryPayload) =>
  Array.from(new Set(payload.assets.map((a) => a.ip))).sort();

export const buildPlaybackCutoff = (timeline: TimelineEntry[], index: number) =>
  timeline[Math.min(index, timeline.length - 1)]?.timestamp;
