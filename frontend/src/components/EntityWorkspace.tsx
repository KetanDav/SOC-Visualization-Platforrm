import { useEffect, useState, type ReactNode } from 'react';
import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { severityTone } from '../lib/telemetry';
import { generatePCRATReport, getRATScore, getRATTier, scoreColor, tierColor, tierLabel, type PCRATReport } from '../lib/compliance';
import { CommunicationGraph } from './CommunicationGraph';
import { DashboardTab } from './DashboardTab';
import { DetailsPanel } from './DetailsPanel';
import { GraphTab } from './GraphTab';
import { IpActivityTab } from './IpActivityTab';
import { RATReportModal } from './RATReport';
import { AskAITab } from './AskAITab';
import { RawLogsTab } from './RawLogsTab';
import { SankeyChart } from './SankeyChart';
import { SequencePanel } from './SequencePanel';
import { TimelineChart, type TimelineSeries } from './TimelineChart';

function fmtBytes(n: number): string {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(1) + ' GB';
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

export type WorkspaceTab = 'dashboard' | 'home' | 'assets' | 'flows' | 'events' | 'alerts' | 'graph' | 'activity' | 'rawlogs' | 'askai';

interface FilteredData {
  assets: Asset[];
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
}

interface FilterOptions {
  ips: string[];
  protocols: string[];
  applications: string[];
  countries: string[];
  severities: string[];
  vendors: string[];
}

interface EntityWorkspaceProps {
  activeTab: WorkspaceTab;
  filtered: FilteredData;
  selectedIp: string | null;
  setSelectedIp: (ip: string | null) => void;
  onFilterQuery: (query: string) => void;
  onAnalyzeIncident: (target: { kind: 'ip' | 'alert'; ip?: string; alertId?: string; label?: string; query?: string }) => void;
  activeQuery: string;
  filterOptions: FilterOptions | null;
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'dashboard', label: '⬡ Dashboard' },
  { id: 'home', label: 'Home' },
  { id: 'assets', label: 'Assets' },
  { id: 'flows', label: 'Flows' },
  { id: 'events', label: 'Events' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'graph', label: 'Graph' },
  { id: 'activity', label: 'IP Activity' },
  { id: 'rawlogs', label: '📄 Raw Logs' },
  { id: 'askai', label: '✦ Ask AI' },
];

export function ViewTabs({ activeTab, onChange }: { activeTab: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  return (
    <nav className="view-tabs" aria-label="Workspace views">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? 'view-tab active' : 'view-tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function severityClass(severity?: string) {
  if (!severity) return '';
  const s = severity.toLowerCase();
  if (s === 'critical' || s === '10' || s === '9') return 'sev-critical';
  if (s === 'high' || s === '8' || s === '7') return 'sev-high';
  if (s === 'medium' || s === '6' || s === '5') return 'sev-medium';
  if (s === 'low' || s === '4' || s === '3' || s === '2' || s === '1') return 'sev-low';
  // Numeric catch-all
  const n = parseInt(severity, 10);
  if (!isNaN(n)) {
    if (n >= 9) return 'sev-critical';
    if (n >= 7) return 'sev-high';
    if (n >= 5) return 'sev-medium';
    return 'sev-low';
  }
  return '';
}

function SeverityCell({ severity }: { severity?: string }) {
  const color = severityTone(severity);
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 8px',
      borderRadius: 999,
      fontSize: '0.75rem',
      fontWeight: 700,
      color,
      border: `1px solid ${color}44`,
      background: `${color}12`,
      letterSpacing: '0.04em'
    }}>
      {severity ?? '-'}
    </span>
  );
}

function RiskCell({ risk }: { risk?: number | string | null }) {
  const val = risk != null ? Number(risk) : null;
  if (val == null || isNaN(val)) return <span>-</span>;
  const pct = Math.min(100, Math.max(0, val));
  const color = val >= 80 ? '#ff5d73' : val >= 50 ? '#ffb84d' : '#6ee7b7';
  return (
    <div className="risk-bar-wrap">
      <div className="risk-bar" style={{ width: `${pct * 0.6}px`, background: color }} />
      <span className="risk-label" style={{ color }}>{val}</span>
    </div>
  );
}

export function EntityWorkspace({ activeTab, filtered, selectedIp, setSelectedIp, onFilterQuery, onAnalyzeIncident, activeQuery, filterOptions }: EntityWorkspaceProps) {
  const selectedAsset = filtered.assets.find((asset) => asset.ip === selectedIp) ?? null;
  const relatedFlows = filtered.flows.filter((flow) => flow.src_ip === selectedIp || flow.dst_ip === selectedIp);
  const relatedEvents = filtered.events.filter((event) => event.src_ip === selectedIp || event.dst_ip === selectedIp);
  const relatedAlerts = filtered.alerts.filter((alert) => alert.src_ip === selectedIp || alert.dst_ip === selectedIp);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [timelineSeries, setTimelineSeries] = useState<TimelineSeries[]>(['bytes', 'events', 'alerts']);
  const [expandedProtocols, setExpandedProtocols] = useState<string[]>([]);
  const [ratReport, setRatReport] = useState<PCRATReport | null>(null);
  const [ratAsset, setRatAsset] = useState<Asset | null>(null);

  const openPCRAT = (asset: Asset) => {
    setRatReport(generatePCRATReport(asset.ip, asset));
    setRatAsset(asset);
  };

  const toggleTimelineSeries = (s: TimelineSeries) => {
    setTimelineSeries((prev) =>
      prev.includes(s)
        ? prev.length > 1 ? prev.filter((x) => x !== s) : prev
        : [...prev, s]
    );
  };

  const toggleExpandedProtocol = (proto: string) => {
    setExpandedProtocols((prev) =>
      prev.includes(proto) ? prev.filter((p) => p !== proto) : [...prev, proto]
    );
  };

  // Reset protocol filter when a different panel is expanded
  useEffect(() => {
    setExpandedProtocols([]);
  }, [expanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (activeTab === 'dashboard') {
    return (
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '0 4px' }}>
        <DashboardTab
          flows={filtered.flows}
          events={filtered.events}
          alerts={filtered.alerts}
          assets={filtered.assets}
          onFilterQuery={onFilterQuery}
          setSelectedIp={setSelectedIp}
          onAnalyzeIncident={onAnalyzeIncident}
        />
      </main>
    );
  }

  if (activeTab === 'home') {
    // Protocol-filtered data — shared across all expanded panels
    const allProtos = Array.from(new Set(filtered.flows.map(f => f.protocol).filter(Boolean) as string[])).sort();
    const exFlows = expandedProtocols.length > 0
      ? filtered.flows.filter(f => f.protocol && expandedProtocols.includes(f.protocol))
      : filtered.flows;
    const exIpPairs = expandedProtocols.length > 0
      ? new Set(exFlows.flatMap(f => [`${f.src_ip}-${f.dst_ip}`, `${f.dst_ip}-${f.src_ip}`]))
      : null;
    const exEvents = exIpPairs
      ? filtered.events.filter(e => exIpPairs.has(`${e.src_ip}-${e.dst_ip}`) || exIpPairs.has(`${e.dst_ip}-${e.src_ip}`))
      : filtered.events;
    const exAlerts = exIpPairs
      ? filtered.alerts.filter(a => exIpPairs.has(`${a.src_ip}-${a.dst_ip}`) || exIpPairs.has(`${a.dst_ip}-${a.src_ip}`))
      : filtered.alerts;

    const panels = [
      {
        id: 'graph',
        kicker: 'Network',
        title: 'Communication Graph',
        note: 'Zoom, pan, click nodes to investigate.',
        content: (
          <CommunicationGraph
            flows={exFlows}
            assets={filtered.assets}
            onSelectIp={setSelectedIp}
            onFilterQuery={onFilterQuery}
            selectedIp={selectedIp}
            activeQuery={activeQuery}
          />
        ),
      },
      {
        id: 'sequence',
        kicker: 'Sequence',
        title: 'Communication Chain',
        note: 'IP→IP flow chain with protocol context.',
        content: <SequencePanel flows={exFlows} assets={filtered.assets} />,
      },
      {
        id: 'sankey',
        kicker: 'Relationship Volume',
        title: 'Sankey Diagram',
        note: 'Traffic flow across source and destination pairs.',
        content: <SankeyChart flows={exFlows} assets={filtered.assets} />,
      },
      {
        id: 'timeline',
        kicker: 'Activity Over Time',
        title: 'Timeline',
        note: 'Events, alerts, and flow volume over time.',
        content: <TimelineChart flows={exFlows} events={exEvents} alerts={exAlerts} visibleSeries={timelineSeries} />,
      },
    ];

    const SERIES_CONFIG: Array<{ id: TimelineSeries; label: string; color: string }> = [
      { id: 'bytes', label: 'Bytes', color: '#4cc9f0' },
      { id: 'events', label: 'Events', color: '#ffb84d' },
      { id: 'alerts', label: 'Alerts', color: '#ff5d73' },
    ];

    const PROTO_COLORS: Record<string, string> = {
      TCP: '#4cc9f0', UDP: '#ffd166', HTTP: '#7c3aed', HTTPS: '#06b6d4',
      SMB: '#f97316', MSSQL: '#a855f7', RADIUS: '#10b981',
      Kerberos: '#3b82f6', 'SMTP-TLS': '#ec4899',
    };

    return (
      <>
        {expanded && (
          <div className="panel-overlay" onClick={() => setExpanded(null)}>
            <div className="panel-overlay-inner panel" onClick={(e) => e.stopPropagation()}>
              {panels.filter(p => p.id === expanded).map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div className="panel-header compact">
                    <div>
                      <p className="panel-kicker">{p.kicker}</p>
                      <h2>{p.title}</h2>
                    </div>
                    {p.id === 'timeline' && (
                      <div className="timeline-series-toggles">
                        {SERIES_CONFIG.map(({ id, label, color }) => {
                          const active = timelineSeries.includes(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              className="timeline-series-btn"
                              style={{
                                borderColor: active ? color : 'rgba(130,155,190,0.2)',
                                background: active ? `${color}1a` : 'rgba(255,255,255,0.03)',
                                color: active ? color : '#8fa1bc',
                              }}
                              onClick={() => toggleTimelineSeries(id)}
                              title={active ? `Hide ${label}` : `Show ${label}`}
                            >
                              <span
                                className="timeline-series-dot"
                                style={{ background: active ? color : 'rgba(130,155,190,0.3)' }}
                              />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      className="expand-btn"
                      title="Collapse (Esc)"
                      onClick={() => setExpanded(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {allProtos.length > 0 && (
                    <div className="timeline-proto-row">
                      <span className="timeline-proto-label">Protocol</span>
                      <button
                        type="button"
                        className={`timeline-proto-chip${expandedProtocols.length === 0 ? ' active-all' : ''}`}
                        onClick={() => setExpandedProtocols([])}
                      >
                        All
                      </button>
                      {allProtos.map((proto) => {
                        const active = expandedProtocols.includes(proto);
                        const color = PROTO_COLORS[proto] ?? '#8fa1bc';
                        return (
                          <button
                            key={proto}
                            type="button"
                            className="timeline-proto-chip"
                            style={{
                              borderColor: active ? color : 'rgba(130,155,190,0.18)',
                              background: active ? `${color}22` : 'rgba(255,255,255,0.03)',
                              color: active ? color : '#8fa1bc',
                            }}
                            onClick={() => toggleExpandedProtocol(proto)}
                          >
                            {proto}
                            <span className="timeline-proto-count">
                              {filtered.flows.filter(f => f.protocol === proto).length}
                            </span>
                          </button>
                        );
                      })}
                      {expandedProtocols.length > 0 && (
                        <button
                          type="button"
                          className="timeline-proto-clear"
                          onClick={() => setExpandedProtocols([])}
                          title="Clear protocol filter"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {p.content}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className={`dashboard-with-inspector${selectedIp ? ' inspector-open' : ''}`} style={{ flex: 1, minHeight: 0 }}>
            <main className="dashboard-grid">
              {panels.map(p => (
                <section key={p.id} className="panel">
                  <div className="panel-header compact">
                    <div>
                      <p className="panel-kicker">{p.kicker}</p>
                      <h2>{p.title}</h2>
                    </div>
                    <button
                      className="expand-btn"
                      title="Expand"
                      onClick={() => setExpanded(p.id)}
                    >
                      ⤢
                    </button>
                  </div>
                  {p.content}
                </section>
              ))}
            </main>
            <aside className="ip-inspector">
              <div className="ip-inspector-inner">
                <button
                  className="ip-inspector-close"
                  onClick={() => setSelectedIp(null)}
                  title="Close inspector"
                >✕</button>
                <DetailsPanel
                  selectedAsset={selectedAsset}
                  relatedFlows={relatedFlows}
                  relatedEvents={relatedEvents}
                  relatedAlerts={relatedAlerts}
                  totalCount={filtered.flows.length + filtered.events.length + filtered.alerts.length}
                  onAnalyzeIncident={onAnalyzeIncident}
                />
              </div>
            </aside>
          </div>


        </div>
      </>
    );
  }

  if (activeTab === 'assets') {
    return (
      <>
        {ratReport && ratAsset && (
          <RATReportModal
            report={ratReport}
            asset={ratAsset}
            onClose={() => { setRatReport(null); setRatAsset(null); }}
          />
        )}
        <main className="tab-layout">
          <section className="panel tab-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Asset Inventory</p>
                <h2>Assets View</h2>
              </div>
              <p className="panel-note">Click any row to open the full RAT report for that PC.</p>
            </div>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    {['IP', 'Hostname', 'MAC', 'Country', 'Vendor', 'Device Type', 'VLAN', 'Switch', 'Port', 'Group', 'Posture', 'Endpoint Profile', 'Policy', 'Auth Rule', 'Session', 'Volume', 'RAT Score', 'NAC Risk', 'Major', 'Minor'].map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.assets.map((asset) => {
                    const rat = generatePCRATReport(asset.ip, asset);
                    const score = getRATScore(rat);
                    const tier = getRATTier(score);
                    const sc = scoreColor(score);
                    return (
                      <tr
                        key={asset.ip}
                        style={{ cursor: 'pointer' }}
                        onClick={() => openPCRAT(asset)}
                      >
                        <td>
                          <code
                            className="ip-link"
                            title={`Filter: ip:=${asset.ip}`}
                            onClick={(e) => { e.stopPropagation(); onFilterQuery(`ip:=${asset.ip}`); }}
                          >{asset.ip}</code>
                        </td>
                        <td>{asset.hostname ?? '-'}</td>
                        <td><code style={{ fontSize: '0.78rem', color: '#8fa1bc' }}>{asset.mac ?? '-'}</code></td>
                        <td>{asset.country ?? '-'}</td>
                        <td>
                          {asset.sourceVendor.map((v) => (
                            <span key={v} style={{
                              display: 'inline-block', marginRight: 4, padding: '2px 7px',
                              borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                              background: 'rgba(76,201,240,0.1)', border: '1px solid rgba(76,201,240,0.2)',
                              color: '#4cc9f0', letterSpacing: '0.04em'
                            }}>{v}</span>
                          ))}
                        </td>
                        <td style={{ color: '#8fa1bc' }}>{asset.deviceType ?? '-'}</td>
                        <td style={{ color: '#dce6f5', fontFamily: 'monospace' }}>{asset.vlan ?? '-'}</td>
                        <td style={{ color: '#8fa1bc', fontFamily: 'monospace' }}>{asset.switchIp ?? '-'}</td>
                        <td style={{ color: '#8fa1bc', fontFamily: 'monospace' }}>{asset.switchPort ?? '-'}</td>
                        <td style={{ color: '#ffb84d' }}>{asset.securityGroup ?? '-'}</td>
                        <td style={{ color: '#8fa1bc' }}>{asset.postureStatus ?? '-'}</td>
                        <td style={{ color: '#8fa1bc' }}>{asset.endpointProfile ?? '-'}</td>
                        <td style={{ color: '#8fa1bc' }}>{asset.policySet ?? '-'}</td>
                        <td style={{ color: '#8fa1bc' }}>{asset.authRule ?? '-'}</td>
                        <td style={{ color: '#8fa1bc' }}>{asset.auditSessionId ?? '-'}</td>
                        <td>{fmtBytes(asset.communicationVolume)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, minWidth: 44, height: 5, borderRadius: 999, background: 'rgba(130,155,190,0.12)', overflow: 'hidden' }}>
                              <div style={{ width: `${score}%`, height: '100%', background: sc, borderRadius: 999 }} />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: sc, minWidth: 22 }}>{score}</span>
                            <span style={{
                              fontSize: '0.63rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                              border: `1px solid ${sc}44`, background: `${sc}12`, color: sc, whiteSpace: 'nowrap',
                            }}>{tierLabel(tier)}</span>
                          </div>
                        </td>
                        <td><RiskCell risk={asset.riskScore} /></td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                            color: rat.majorViolations.length > 0 ? '#ff5d73' : '#6ee7b7',
                            background: rat.majorViolations.length > 0 ? 'rgba(255,93,115,0.1)' : 'rgba(110,231,183,0.08)',
                            border: `1px solid ${rat.majorViolations.length > 0 ? 'rgba(255,93,115,0.25)' : 'rgba(110,231,183,0.2)'}`,
                          }}>{rat.majorViolations.length}</span>
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                            color: rat.minorViolations.length > 0 ? '#ffb84d' : '#6ee7b7',
                            background: rat.minorViolations.length > 0 ? 'rgba(255,184,77,0.1)' : 'rgba(110,231,183,0.08)',
                            border: `1px solid ${rat.minorViolations.length > 0 ? 'rgba(255,184,77,0.25)' : 'rgba(110,231,183,0.2)'}`,
                          }}>{rat.minorViolations.length}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (activeTab === 'flows') {
    const seqContent = <SequencePanel flows={filtered.flows} assets={filtered.assets} />;
    return (
      <>
        {expanded === 'flows-sequence' && (
          <div className="panel-overlay" onClick={() => setExpanded(null)}>
            <div className="panel-overlay-inner panel" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="panel-header compact">
                  <div>
                    <p className="panel-kicker">Sequence Diagram</p>
                    <h2>Communication Chain</h2>
                  </div>
                  <button className="expand-btn" title="Collapse (Esc)" onClick={() => setExpanded(null)}>✕</button>
                </div>
                {seqContent}
              </div>
            </div>
          </div>
        )}
        <main className="tab-layout flows-tab-layout">
          <section className="panel tab-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Flow Records</p>
                <h2>Flows View</h2>
              </div>
              <p className="panel-note">Primary communication records ordered by time.</p>
            </div>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Timestamp', 'Source', 'Src Port', 'Destination', 'Dst Port', 'Protocol', 'App', 'Bytes', 'Packets', 'Risk'].map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.flows.map((flow) => (
                    <tr key={flow.id} onClick={() => setSelectedIp(flow.src_ip)}>
                      <td style={{ color: '#8fa1bc', fontSize: '0.82rem' }}>{new Date(flow.timestamp).toLocaleString()}</td>
                      <td>
                        <code
                          className="ip-link ip-link--src"
                          title={`Filter: ip:=${flow.src_ip}`}
                          onClick={(e) => { e.stopPropagation(); onFilterQuery(`ip:=${flow.src_ip}`); }}
                        >{flow.src_ip}</code>
                      </td>
                      <td>
                        <code
                          style={{ fontSize: '0.78rem', color: '#8fa1bc', cursor: 'pointer' }}
                          title={`Filter: port:=${flow.src_port}`}
                          onClick={(e) => { e.stopPropagation(); if (flow.src_port) onFilterQuery(`port:=${flow.src_port}`); }}
                        >{flow.src_port ?? '-'}</code>
                      </td>
                      <td>
                        <code
                          className="ip-link ip-link--dst"
                          title={`Filter: src:=${flow.src_ip} AND dst:=${flow.dst_ip}`}
                          onClick={(e) => { e.stopPropagation(); onFilterQuery(`src:=${flow.src_ip} AND dst:=${flow.dst_ip}`); }}
                        >{flow.dst_ip}</code>
                      </td>
                      <td>
                        <code
                          style={{ fontSize: '0.78rem', color: '#8fa1bc', cursor: 'pointer' }}
                          title={`Filter: port:=${flow.dst_port}`}
                          onClick={(e) => { e.stopPropagation(); if (flow.dst_port) onFilterQuery(`port:=${flow.dst_port}`); }}
                        >{flow.dst_port ?? '-'}</code>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                          fontSize: '0.74rem', fontWeight: 700,
                          background: 'rgba(76,201,240,0.1)', border: '1px solid rgba(76,201,240,0.2)', color: '#4cc9f0'
                        }}>{flow.protocol ?? '-'}</span>
                      </td>
                      <td style={{ color: '#8fa1bc' }}>{flow.application ?? '-'}</td>
                      <td>{fmtBytes(flow.bytes)}</td>
                      <td>{flow.packets.toLocaleString()}</td>
                      <td><RiskCell risk={flow.risk_score} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel sequence-full-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Sequence Diagram</p>
                <h2>Communication Chain</h2>
              </div>
              <button className="expand-btn" title="Expand" onClick={() => setExpanded('flows-sequence')}>⤢</button>
            </div>
            {seqContent}
          </section>
        </main>
      </>
    );
  }

  if (activeTab === 'events') {
    return (
      <main className="tab-layout tab-layout--split">
        <section className="panel tab-panel">
          <div className="panel-header compact">
            <div>
              <p className="panel-kicker">Security Events</p>
              <h2>Events View</h2>
            </div>
            <p className="panel-note">Security and activity events normalized across vendors.</p>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  {['Timestamp', 'Event', 'Category', 'Severity', 'Source', 'Destination', 'User', 'Domain', 'AI'].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.events.map((event) => (
                  <tr key={event.id} className={severityClass(event.severity)} onClick={() => setSelectedIp(event.src_ip ?? null)}>
                    <td style={{ color: '#8fa1bc', fontSize: '0.82rem' }}>{new Date(event.timestamp).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>
                      <span
                        style={{ cursor: 'pointer', textDecoration: 'underline dotted rgba(76,201,240,0.4)' }}
                        title={`Show only: ${event.event_name}`}
                        onClick={(e) => { e.stopPropagation(); onFilterQuery(`event:"${event.event_name}"`); }}
                      >{event.event_name}</span>
                    </td>
                    <td style={{ color: '#8fa1bc' }}>
                      {event.category ? (
                        <span
                          style={{ cursor: 'pointer', textDecoration: 'underline dotted rgba(148,163,184,0.5)' }}
                          title={`Show only category: ${event.category}`}
                          onClick={(e) => { e.stopPropagation(); onFilterQuery(`category:${event.category}`); }}
                        >{event.category}</span>
                      ) : '-'}
                    </td>
                    <td><SeverityCell severity={event.severity} /></td>
                    <td>
                      {event.src_ip ? (
                        <code
                          className="ip-link ip-link--src"
                          title={`Filter: ip:=${event.src_ip}`}
                          onClick={(e) => { e.stopPropagation(); onFilterQuery(`ip:=${event.src_ip!}`); }}
                        >{event.src_ip}</code>
                      ) : <span style={{ color: '#8fa1bc' }}>-</span>}
                    </td>
                    <td>
                      {event.dst_ip ? (
                        <code
                          className="ip-link ip-link--dst"
                          title={`Filter: ip:=${event.dst_ip}`}
                          onClick={(e) => { e.stopPropagation(); onFilterQuery(`ip:=${event.dst_ip!}`); }}
                        >{event.dst_ip}</code>
                      ) : <span style={{ color: '#8fa1bc' }}>-</span>}
                    </td>
                    <td>{event.username ?? '-'}</td>
                    <td style={{ color: '#8fa1bc' }}>{event.domain ?? event.url ?? '-'}</td>
                    <td>
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 11px', borderRadius: 8,
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
                            kind: 'ip',
                            ip: event.src_ip ?? event.dst_ip ?? undefined,
                            label: event.event_name,
                            query: `event:"${event.event_name}"`,
                          });
                        }}
                        title="AI Analyze this event"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        AI Analyze
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="panel mini-panel">
          <div className="panel-header compact">
            <div><p className="panel-kicker">Activity Over Time</p><h2>Timeline Visualization</h2></div>
          </div>
          <TimelineChart flows={filtered.flows} events={filtered.events} alerts={filtered.alerts} />
        </div>
      </main>
    );
  }

  if (activeTab === 'graph') {
    return (
      <GraphTab
        filtered={filtered}
        activeQuery={activeQuery}
        selectedIp={selectedIp}
        onFilterQuery={onFilterQuery}
        filterOptions={filterOptions}
      />
    );
  }

  if (activeTab === 'activity') {
    return (
      <IpActivityTab
        flows={filtered.flows}
        events={filtered.events}
        alerts={filtered.alerts}
        assets={filtered.assets}
        onFilterQuery={onFilterQuery}
      />
    );
  }

  if (activeTab === 'rawlogs') {
    return <RawLogsTab activeQuery={activeQuery} />;
  }

  if (activeTab === 'askai') {
    return (
      <AskAITab
        flows={filtered.flows}
        events={filtered.events}
        alerts={filtered.alerts}
        assets={filtered.assets}
      />
    );
  }

  // Alerts tab
  return (
    <main className="tab-layout tab-layout--split">
      <section className="panel tab-panel">
        <div className="panel-header compact">
          <div>
            <p className="panel-kicker">Threat Detections</p>
            <h2>Alerts View</h2>
          </div>
          <p className="panel-note">Notable detections, risk scores, and threat context.</p>
        </div>
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                {['Timestamp', 'Alert', 'Severity', 'Risk', 'Source', 'Destination', 'IOC', 'Malware Family', 'Anomaly', 'AI'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.alerts.map((alert) => (
                <tr key={alert.id} className={severityClass(alert.severity)} onClick={() => setSelectedIp(alert.src_ip ?? null)}>
                  <td style={{ color: '#8fa1bc', fontSize: '0.82rem' }}>{new Date(alert.timestamp).toLocaleString()}</td>
                  <td>
                    <span
                      style={{ fontWeight: 600, color: '#e7eefb', cursor: 'pointer', textDecoration: 'underline dotted rgba(76,201,240,0.4)' }}
                      title={`Show only: ${alert.alert_name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onFilterQuery(`alert:"${alert.alert_name}"`);
                      }}
                    >{alert.alert_name}</span>
                  </td>
                  <td><SeverityCell severity={alert.severity} /></td>
                  <td><RiskCell risk={alert.risk_score} /></td>
                  <td>
                    {alert.src_ip ? (
                      <code
                        className="ip-link ip-link--src"
                        title={`Filter: ip:=${alert.src_ip}`}
                        onClick={(e) => { e.stopPropagation(); onFilterQuery(`ip:=${alert.src_ip!}`); }}
                      >{alert.src_ip}</code>
                    ) : <span style={{ color: '#8fa1bc' }}>-</span>}
                  </td>
                  <td>
                    {alert.dst_ip ? (
                      <code
                        className="ip-link ip-link--dst"
                        title={`Filter: ip:=${alert.dst_ip}`}
                        onClick={(e) => { e.stopPropagation(); onFilterQuery(`ip:=${alert.dst_ip!}`); }}
                      >{alert.dst_ip}</code>
                    ) : <span style={{ color: '#8fa1bc' }}>-</span>}
                  </td>
                  <td>
                    {alert.ioc_match ? (
                      <span style={{
                        display: 'inline-block', padding: '2px 7px', borderRadius: 999,
                        fontSize: '0.72rem', fontWeight: 700,
                        background: 'rgba(255,93,115,0.12)', border: '1px solid rgba(255,93,115,0.3)',
                        color: '#ff5d73'
                      }}>{alert.ioc_match}</span>
                    ) : '-'}
                  </td>
                  <td>{alert.malware_family ?? '-'}</td>
                  <td><RiskCell risk={alert.anomaly_score} /></td>
                  <td>
                      <button
                        type="button"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 11px', borderRadius: 8,
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
                            alertId: alert.id,
                            ip: alert.src_ip ?? alert.dst_ip ?? undefined,
                            label: alert.alert_name,
                            query: `alert:"${alert.alert_name}"`,
                          });
                        }}
                        title="AI Analyze this alert"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        AI Analyze
                      </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="panel mini-panel">
        <div className="panel-header compact">
          <div><p className="panel-kicker">Traffic Correlation</p><h2>Sankey Diagram</h2></div>
        </div>
        <SankeyChart flows={filtered.flows} assets={filtered.assets} />
      </div>
    </main>
  );
}