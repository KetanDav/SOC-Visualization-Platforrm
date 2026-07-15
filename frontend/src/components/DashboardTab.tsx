import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';

interface DashboardTabProps {
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
  assets: Asset[];
  onFilterQuery: (q: string) => void;
  setSelectedIp: (ip: string | null) => void;
  onAnalyzeIncident: (target: { kind: 'ip' | 'alert'; ip?: string; alertId?: string; label?: string; query?: string }) => void;
}

function fmtBytes(n: number): string {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(1) + ' GB';
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(130,155,190,0.1)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
  );
}

function SevBadge({ severity }: { severity?: string }) {
  const s = (severity ?? '').toLowerCase();
  const color =
    s === 'critical' ? '#ff5d73' :
      s === 'high' ? '#ffb84d' :
        s === 'medium' ? '#f0e04a' :
          '#6ee7b7';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: '0.68rem', fontWeight: 700,
      color, border: `1px solid ${color}44`, background: `${color}12`,
      letterSpacing: '0.05em', textTransform: 'uppercase'
    }}>{severity ?? 'unknown'}</span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: 'rgba(13,22,37,0.9)', border: '1px solid rgba(130,155,190,0.12)',
      borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4,
      borderTop: accent ? `2px solid ${accent}` : '2px solid rgba(130,155,190,0.12)',
      flex: '1 1 0', minWidth: 120
    }}>
      <span style={{ fontSize: '0.65rem', color: '#7a91ad', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '1.55rem', fontWeight: 800, color: accent ?? '#dce6f5', lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: '0.7rem', color: '#7a91ad', marginTop: 2 }}>{sub}</span>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 10px 0', fontSize: '0.65rem', color: '#7a91ad', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
      {children}
    </p>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(13,22,37,0.9)', border: '1px solid rgba(130,155,190,0.12)',
      borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column',
      ...style
    }}>
      {children}
    </div>
  );
}

export function DashboardTab({ flows, events, alerts, assets, onFilterQuery, setSelectedIp, onAnalyzeIncident }: DashboardTabProps) {
  // ── KPIs ──────────────────────────────────────────────────────────────
  const totalBytes = flows.reduce((s, f) => s + (f.bytes ?? 0), 0);
  const avgRisk = flows.length > 0
    ? Math.round(flows.reduce((s, f) => s + (Number(f.risk_score) || 0), 0) / flows.length)
    : 0;
  const criticalAlerts = alerts.filter(a => (a.severity ?? '').toLowerCase() === 'critical').length;
  const highRisk = alerts.filter(a => (a.risk_score ?? 0) >= 75).length;
  const uniqueIPs = new Set([...flows.map(f => f.src_ip), ...flows.map(f => f.dst_ip)]).size;

  // ── Top communicating IPs (by flow count) ─────────────────────────────
  const ipFlowCount: Record<string, number> = {};
  const ipByteCount: Record<string, number> = {};
  for (const f of flows) {
    ipFlowCount[f.src_ip] = (ipFlowCount[f.src_ip] ?? 0) + 1;
    ipFlowCount[f.dst_ip] = (ipFlowCount[f.dst_ip] ?? 0) + 1;
    ipByteCount[f.src_ip] = (ipByteCount[f.src_ip] ?? 0) + (f.bytes ?? 0);
    ipByteCount[f.dst_ip] = (ipByteCount[f.dst_ip] ?? 0) + (f.bytes ?? 0);
  }
  const topTalkers = Object.entries(ipFlowCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxFlows = topTalkers[0]?.[1] ?? 1;

  // ── Top src→dst pairs by bytes ────────────────────────────────────────
  const pairBytes: Record<string, number> = {};
  const pairCount: Record<string, number> = {};
  for (const f of flows) {
    const key = `${f.src_ip} → ${f.dst_ip}`;
    pairBytes[key] = (pairBytes[key] ?? 0) + (f.bytes ?? 0);
    pairCount[key] = (pairCount[key] ?? 0) + 1;
  }
  const topPairs = Object.entries(pairBytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxPairBytes = topPairs[0]?.[1] ?? 1;

  // ── Protocol distribution ─────────────────────────────────────────────
  const protoCounts: Record<string, number> = {};
  const protoBytes: Record<string, number> = {};
  for (const f of flows) {
    const p = f.protocol ?? 'Unknown';
    protoCounts[p] = (protoCounts[p] ?? 0) + 1;
    protoBytes[p] = (protoBytes[p] ?? 0) + (f.bytes ?? 0);
  }
  const topProtos = Object.entries(protoCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxProtoCount = topProtos[0]?.[1] ?? 1;

  const PROTO_COLORS: Record<string, string> = {
    TCP: '#4cc9f0', UDP: '#ffd166', HTTP: '#a78bfa', HTTPS: '#06b6d4',
    SMB: '#f97316', MSSQL: '#a855f7', RADIUS: '#10b981',
    Kerberos: '#3b82f6', 'SMTP-TLS': '#ec4899', Unknown: '#7a91ad',
  };
  const protoColor = (p: string) => PROTO_COLORS[p] ?? '#8fa1bc';

  // ── Alert severity breakdown ──────────────────────────────────────────
  const sevCounts: Record<string, number> = {};
  for (const a of alerts) {
    const s = (a.severity ?? 'unknown').toLowerCase();
    sevCounts[s] = (sevCounts[s] ?? 0) + 1;
  }
  const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'unknown'];
  const SEV_COLORS: Record<string, string> = {
    critical: '#ff5d73', high: '#ffb84d', medium: '#f0e04a', low: '#6ee7b7', unknown: '#7a91ad'
  };
  const totalAlerts = alerts.length;
  const sevBreakdown = SEV_ORDER.filter(s => sevCounts[s]).map(s => ({
    label: s, count: sevCounts[s], color: SEV_COLORS[s]
  }));
  const maxSev = Math.max(...sevBreakdown.map(s => s.count), 1);

  // ── Top alerting IPs ──────────────────────────────────────────────────
  const ipAlertCount: Record<string, number> = {};
  const ipMaxRisk: Record<string, number> = {};
  for (const a of alerts) {
    if (a.src_ip) {
      ipAlertCount[a.src_ip] = (ipAlertCount[a.src_ip] ?? 0) + 1;
      ipMaxRisk[a.src_ip] = Math.max(ipMaxRisk[a.src_ip] ?? 0, a.risk_score ?? 0);
    }
  }
  const topAlertIPs = Object.entries(ipAlertCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxAlertCount = topAlertIPs[0]?.[1] ?? 1;

  // ── Event category breakdown ──────────────────────────────────────────
  const catCounts: Record<string, number> = {};
  for (const e of events) {
    const c = e.category ?? 'Unknown';
    catCounts[c] = (catCounts[c] ?? 0) + 1;
  }
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCatCount = topCats[0]?.[1] ?? 1;

  // ── Recent critical / high alerts ────────────────────────────────────
  const recentAlerts = [...alerts]
    .filter(a => ['critical', 'high'].includes((a.severity ?? '').toLowerCase()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  // ── Source vendor coverage ────────────────────────────────────────────
  const vendorCounts: Record<string, { flows: number; events: number; alerts: number }> = {};
  for (const f of flows) {
    const vs = Array.isArray(f.sourceVendor) ? f.sourceVendor : f.sourceVendor ? [f.sourceVendor as string] : [];
    for (const v of vs) { if (!vendorCounts[v]) vendorCounts[v] = { flows: 0, events: 0, alerts: 0 }; vendorCounts[v].flows++; }
  }
  for (const e of events) {
    const vs = Array.isArray(e.sourceVendor) ? e.sourceVendor : e.sourceVendor ? [e.sourceVendor as string] : [];
    for (const v of vs) { if (!vendorCounts[v]) vendorCounts[v] = { flows: 0, events: 0, alerts: 0 }; vendorCounts[v].events++; }
  }
  for (const a of alerts) {
    const vs = Array.isArray(a.sourceVendor) ? a.sourceVendor : a.sourceVendor ? [a.sourceVendor as string] : [];
    for (const v of vs) { if (!vendorCounts[v]) vendorCounts[v] = { flows: 0, events: 0, alerts: 0 }; vendorCounts[v].alerts++; }
  }

  // ── Top countries ─────────────────────────────────────────────────────
  const countryCounts: Record<string, number> = {};
  for (const a of assets) {
    if (a.country) countryCounts[a.country] = (countryCounts[a.country] ?? 0) + 1;
  }
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCountry = topCountries[0]?.[1] ?? 1;

  // ── Top applications ──────────────────────────────────────────────────
  const appCounts: Record<string, number> = {};
  const appBytes: Record<string, number> = {};
  for (const f of flows) {
    if (f.application) {
      appCounts[f.application] = (appCounts[f.application] ?? 0) + 1;
      appBytes[f.application] = (appBytes[f.application] ?? 0) + (f.bytes ?? 0);
    }
  }
  const topApps = Object.entries(appBytes).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxAppBytes = topApps[0]?.[1] ?? 1;

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
    borderBottom: '1px solid rgba(130,155,190,0.07)', cursor: 'pointer'
  };
  const ipCodeStyle: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: '0.8rem', color: '#4cc9f0',
    minWidth: 120, flexShrink: 0
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '12px 4px 20px' }}>
      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <KpiCard label="Total Flows" value={flows.length.toLocaleString()} accent="#4cc9f0" />
        <KpiCard label="Data Transferred" value={fmtBytes(totalBytes)} accent="#06b6d4" />
        <KpiCard label="Avg Flow Risk" value={avgRisk} sub="out of 100" accent={avgRisk >= 70 ? '#ff5d73' : avgRisk >= 40 ? '#ffb84d' : '#6ee7b7'} />
        <KpiCard label="Total Alerts" value={alerts.length.toLocaleString()} sub={`${criticalAlerts} critical`} accent="#ffb84d" />
        <KpiCard label="High-Risk Alerts" value={highRisk} sub="risk ≥ 75" accent="#ff5d73" />
        <KpiCard label="Unique IPs" value={uniqueIPs.toLocaleString()} accent="#a78bfa" />
        <KpiCard label="Total Events" value={events.length.toLocaleString()} accent="#10b981" />
        <KpiCard label="Assets" value={assets.length.toLocaleString()} accent="#3aacce" />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* Top Communicating IPs */}
        <Panel style={{ gridColumn: '1', gridRow: '1' }}>
          <SectionTitle>Top Communicating IPs</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topTalkers.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No data</span>}
            {topTalkers.map(([ip, count]) => (
              <div
                key={ip}
                style={{ ...rowStyle }}
                onClick={() => { onFilterQuery(`ip:=${ip}`); setSelectedIp(ip); }}
                title={`Filter: ip:=${ip}`}
              >
                <span style={ipCodeStyle}>{ip}</span>
                <HBar value={count} max={maxFlows} color="#4cc9f0" />
                <span style={{ fontSize: '0.78rem', color: '#dce6f5', fontWeight: 600, minWidth: 32, textAlign: 'right' }}>{count}</span>
                <span style={{ fontSize: '0.68rem', color: '#7a91ad', minWidth: 54, textAlign: 'right' }}>{fmtBytes(ipByteCount[ip] ?? 0)}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Top Alerting IPs */}
        <Panel style={{ gridColumn: '2', gridRow: '1' }}>
          <SectionTitle>Top Alerting IPs</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topAlertIPs.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No alerts</span>}
            {topAlertIPs.map(([ip, count]) => {
              const risk = ipMaxRisk[ip] ?? 0;
              const riskColor = risk >= 80 ? '#ff5d73' : risk >= 50 ? '#ffb84d' : '#6ee7b7';
              return (
                <div
                  key={ip}
                  style={{ ...rowStyle }}
                  onClick={() => { onFilterQuery(`ip:=${ip}`); setSelectedIp(ip); }}
                  title={`Filter: ip:=${ip}`}
                >
                  <span style={ipCodeStyle}>{ip}</span>
                  <HBar value={count} max={maxAlertCount} color="#ff5d73" />
                  <span style={{ fontSize: '0.78rem', color: '#ff5d73', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{count}</span>
                  <span style={{ fontSize: '0.72rem', color: riskColor, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>R:{risk}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Alert Severity Breakdown */}
        <Panel style={{ gridColumn: '3', gridRow: '1' }}>
          <SectionTitle>Alert Severity Breakdown</SectionTitle>
          {sevBreakdown.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No alerts</span>}
          {sevBreakdown.map(({ label, count, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(130,155,190,0.07)', cursor: 'pointer' }}
              onClick={() => onFilterQuery(`severity:${label}`)}
            >
              <span style={{ width: 70, fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'capitalize', flexShrink: 0 }}>{label}</span>
              <HBar value={count} max={maxSev} color={color} />
              <span style={{ fontSize: '0.78rem', color, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{count}</span>
              <span style={{ fontSize: '0.68rem', color: '#7a91ad', minWidth: 32, textAlign: 'right' }}>
                {totalAlerts > 0 ? Math.round((count / totalAlerts) * 100) : 0}%
              </span>
            </div>
          ))}
          {/* visual donut-style row */}
          {sevBreakdown.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
              {sevBreakdown.map(({ label, count, color }) => (
                <div key={label} style={{ flex: count, background: color, minWidth: 2 }} title={`${label}: ${count}`} />
              ))}
            </div>
          )}
        </Panel>

        {/* Top Talker Pairs */}
        <Panel style={{ gridColumn: '1', gridRow: '2' }}>
          <SectionTitle>Top Talker Pairs (by Bytes)</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topPairs.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No data</span>}
            {topPairs.map(([pair, bytes]) => (
              <div key={pair} style={{ ...rowStyle }}
                onClick={() => {
                  const [src, dst] = pair.split(' → ');
                  onFilterQuery(`src:=${src} AND dst:=${dst}`);
                }}
                title={`Filter pair`}
              >
                <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#dce6f5', flex: 1, minWidth: 0 }}>{pair}</span>
                <HBar value={bytes} max={maxPairBytes} color="#a78bfa" />
                <span style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 600, minWidth: 54, textAlign: 'right' }}>{fmtBytes(bytes)}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Protocol Distribution */}
        <Panel style={{ gridColumn: '2', gridRow: '2' }}>
          <SectionTitle>Protocol Distribution</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topProtos.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No flows</span>}
            {topProtos.map(([proto, count]) => (
              <div key={proto} style={{ ...rowStyle, cursor: 'pointer' }}
                onClick={() => onFilterQuery(`protocol:=${proto}`)}
              >
                <span style={{ width: 72, fontSize: '0.75rem', fontWeight: 700, color: protoColor(proto), flexShrink: 0 }}>{proto}</span>
                <HBar value={count} max={maxProtoCount} color={protoColor(proto)} />
                <span style={{ fontSize: '0.78rem', color: '#dce6f5', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{count}</span>
                <span style={{ fontSize: '0.68rem', color: '#7a91ad', minWidth: 54, textAlign: 'right' }}>{fmtBytes(protoBytes[proto] ?? 0)}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Event Category Breakdown */}
        <Panel style={{ gridColumn: '3', gridRow: '2' }}>
          <SectionTitle>Event Categories</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topCats.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No events</span>}
            {topCats.map(([cat, count], i) => {
              const colors = ['#10b981', '#4cc9f0', '#a78bfa', '#ffb84d', '#f97316', '#ec4899'];
              const c = colors[i % colors.length];
              return (
                <div key={cat} style={{ ...rowStyle }}
                  onClick={() => onFilterQuery(`category:${cat}`)}
                >
                  <span style={{ flex: 1, fontSize: '0.75rem', color: '#dce6f5', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                  <HBar value={count} max={maxCatCount} color={c} />
                  <span style={{ fontSize: '0.78rem', color: c, fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Recent Critical/High Alerts Feed */}
        <Panel style={{ gridColumn: '1 / 3', gridRow: '3' }}>
          <SectionTitle>Recent Critical &amp; High Alerts</SectionTitle>
          {recentAlerts.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No critical or high alerts</span>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentAlerts.map((a) => {
              const sev = (a.severity ?? '').toLowerCase();
              const sevColor = sev === 'critical' ? '#ff5d73' : '#ffb84d';
              const riskColor = (a.risk_score ?? 0) >= 80 ? '#ff5d73' : (a.risk_score ?? 0) >= 50 ? '#ffb84d' : '#6ee7b7';
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 8,
                  background: `${sevColor}08`, border: `1px solid ${sevColor}20`,
                  marginBottom: 4, cursor: 'pointer'
                }}
                  onClick={() => { if (a.src_ip) setSelectedIp(a.src_ip); }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: sevColor, flexShrink: 0,
                    boxShadow: `0 0 6px ${sevColor}`
                  }} />
                  <SevBadge severity={a.severity} />
                  <span style={{ flex: 1, fontSize: '0.8rem', color: '#dce6f5', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.alert_name}
                  </span>
                  {a.malware_family && (
                    <span style={{ fontSize: '0.7rem', color: '#a78bfa', padding: '1px 6px', borderRadius: 99, border: '1px solid #a78bfa44', background: '#a78bfa12', flexShrink: 0 }}>
                      {a.malware_family}
                    </span>
                  )}
                  <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#4cc9f0', flexShrink: 0, minWidth: 100 }}>{a.src_ip ?? '-'}</span>
                  <span style={{ fontSize: '0.68rem', color: '#7a91ad', flexShrink: 0 }}>→</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#8fa1bc', flexShrink: 0, minWidth: 100 }}>{a.dst_ip ?? '-'}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: riskColor, flexShrink: 0, minWidth: 40, textAlign: 'right' }}>R:{a.risk_score ?? '-'}</span>
                  <span style={{ fontSize: '0.68rem', color: '#7a91ad', flexShrink: 0, minWidth: 130, textAlign: 'right' }}>
                    {a.timestamp ? new Date(a.timestamp).toLocaleString() : '-'}
                  </span>
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 11px', borderRadius: 8, flexShrink: 0,
                      border: '1px solid rgba(129,140,248,0.3)',
                      background: 'rgba(129,140,248,0.08)',
                      color: '#818cf8', fontSize: '0.72rem', fontWeight: 700,
                      cursor: 'pointer', letterSpacing: '0.01em',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.16)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.5)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.08)'; e.currentTarget.style.borderColor = 'rgba(129,140,248,0.3)'; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnalyzeIncident({
                        kind: 'alert',
                        alertId: a.id,
                        ip: a.src_ip ?? a.dst_ip ?? undefined,
                        label: a.alert_name,
                        query: `alert:"${a.alert_name}"`,
                      });
                    }}
                    title="AI Analyze this alert"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    AI Analyze
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Right column: Geo + Apps + Vendor Coverage */}
        <div style={{ gridColumn: '3', gridRow: '3', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Top Countries */}
          <Panel>
            <SectionTitle>Asset Origin Countries</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topCountries.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No geo data</span>}
              {topCountries.map(([country, count]) => (
                <div key={country} style={{ ...rowStyle, cursor: 'default' }}>
                  <span style={{ flex: 1, fontSize: '0.75rem', color: '#dce6f5' }}>{country}</span>
                  <HBar value={count} max={maxCountry} color="#10b981" />
                  <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, minWidth: 20, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Top Applications */}
          <Panel>
            <SectionTitle>Top Applications (Bytes)</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topApps.length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No app data</span>}
              {topApps.map(([app, bytes]) => (
                <div key={app} style={{ ...rowStyle, cursor: 'pointer' }}
                  onClick={() => onFilterQuery(`app:${app}`)}
                >
                  <span style={{ flex: 1, fontSize: '0.75rem', color: '#dce6f5', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app}</span>
                  <HBar value={bytes} max={maxAppBytes} color="#06b6d4" />
                  <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 600, minWidth: 54, textAlign: 'right' }}>{fmtBytes(bytes)}</span>
                </div>
              ))}
            </div>
          </Panel>

        </div>

        {/* Data Source Coverage */}
        <Panel style={{ gridColumn: '1 / 4', gridRow: '4' }}>
          <SectionTitle>Data Source Coverage</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(vendorCounts).length === 0 && <span style={{ color: '#7a91ad', fontSize: '0.8rem' }}>No vendor data</span>}
            {Object.entries(vendorCounts).map(([vendor, counts]) => (
              <div key={vendor} style={{
                flex: '1 1 160px', background: 'rgba(76,201,240,0.05)', border: '1px solid rgba(76,201,240,0.15)',
                borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4cc9f0', letterSpacing: '0.05em' }}>{vendor}</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {counts.flows > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#7a91ad' }}>
                      <span style={{ color: '#4cc9f0', fontWeight: 700 }}>{counts.flows.toLocaleString()}</span> flows
                    </span>
                  )}
                  {counts.events > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#7a91ad' }}>
                      <span style={{ color: '#ffb84d', fontWeight: 700 }}>{counts.events.toLocaleString()}</span> events
                    </span>
                  )}
                  {counts.alerts > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#7a91ad' }}>
                      <span style={{ color: '#ff5d73', fontWeight: 700 }}>{counts.alerts.toLocaleString()}</span> alerts
                    </span>
                  )}
                </div>
                {/* mini bar row */}
                <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 99, overflow: 'hidden' }}>
                  {counts.flows > 0 && <div style={{ flex: counts.flows, background: '#4cc9f0', opacity: 0.7 }} />}
                  {counts.events > 0 && <div style={{ flex: counts.events, background: '#ffb84d', opacity: 0.7 }} />}
                  {counts.alerts > 0 && <div style={{ flex: counts.alerts, background: '#ff5d73', opacity: 0.7 }} />}
                </div>
              </div>
            ))}
          </div>
        </Panel>

      </div>
    </div>
  );
}
