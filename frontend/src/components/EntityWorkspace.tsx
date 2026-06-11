import type { ReactNode } from 'react';
import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { severityTone } from '../lib/telemetry';
import { CommunicationGraph } from './CommunicationGraph';
import { DetailsPanel } from './DetailsPanel';
import { SankeyChart } from './SankeyChart';
import { SequencePanel } from './SequencePanel';
import { TimelineChart } from './TimelineChart';

export type WorkspaceTab = 'home' | 'assets' | 'flows' | 'events' | 'alerts';

interface FilteredData {
  assets: Asset[];
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
}

interface EntityWorkspaceProps {
  activeTab: WorkspaceTab;
  filtered: FilteredData;
  selectedIp: string | null;
  setSelectedIp: (ip: string | null) => void;
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'assets', label: 'Assets' },
  { id: 'flows', label: 'Flows' },
  { id: 'events', label: 'Events' },
  { id: 'alerts', label: 'Alerts' }
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

export function EntityWorkspace({ activeTab, filtered, selectedIp, setSelectedIp }: EntityWorkspaceProps) {
  const selectedAsset = filtered.assets.find((asset) => asset.ip === selectedIp) ?? null;
  const relatedFlows = filtered.flows.filter((flow) => flow.src_ip === selectedIp || flow.dst_ip === selectedIp);
  const relatedEvents = filtered.events.filter((event) => event.src_ip === selectedIp || event.dst_ip === selectedIp);
  const relatedAlerts = filtered.alerts.filter((alert) => alert.src_ip === selectedIp || alert.dst_ip === selectedIp);

  if (activeTab === 'home') {
    return (
      <main className="dashboard-grid">
        <section className="panel graph-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Primary View</p>
              <h2>Communication Graph</h2>
            </div>
            <p className="panel-note">Zoom, pan, hover, and click nodes to anchor the investigation.</p>
          </div>
          <CommunicationGraph flows={filtered.flows} assets={filtered.assets} onSelectIp={setSelectedIp} selectedIp={selectedIp} />
        </section>

        <aside className="side-stack">
          <section className="panel sequence-viz-panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Sequence</p>
                <h2>Communication Chain</h2>
              </div>
              <p className="panel-note">IP→IP flow chain with protocol and byte context.</p>
            </div>
            <SequencePanel flows={filtered.flows} assets={filtered.assets} />
          </section>

          <section className="panel">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">Inspector</p>
                <h2>Entity Details</h2>
              </div>
            </div>
            <DetailsPanel
              selectedAsset={selectedAsset}
              relatedFlows={relatedFlows}
              relatedEvents={relatedEvents}
              relatedAlerts={relatedAlerts}
              totalCount={filtered.flows.length + filtered.events.length + filtered.alerts.length}
            />
          </section>
        </aside>

        <section className="panel sankey-panel">
          <div className="panel-header compact">
            <div>
              <p className="panel-kicker">Relationship Volume</p>
              <h2>Sankey Diagram</h2>
            </div>
            <p className="panel-note">Traffic movement across dominant source and destination pairs.</p>
          </div>
          <SankeyChart flows={filtered.flows} assets={filtered.assets} />
        </section>

        <section className="panel timeline-panel">
          <div className="panel-header compact">
            <div>
              <p className="panel-kicker">Activity Over Time</p>
              <h2>Timeline Visualization</h2>
            </div>
            <p className="panel-note">Events, alerts, and flow volume through the current playback window.</p>
          </div>
          <TimelineChart flows={filtered.flows} events={filtered.events} alerts={filtered.alerts} />
        </section>
      </main>
    );
  }

  if (activeTab === 'assets') {
    return (
      <main className="tab-layout">
        <section className="panel tab-panel">
          <div className="panel-header compact">
            <div>
              <p className="panel-kicker">Asset Inventory</p>
              <h2>Assets View</h2>
            </div>
            <p className="panel-note">Deduplicated asset inventory with communication volume and provenance.</p>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  {['IP', 'Hostname', 'MAC', 'Country', 'ASN', 'Username', 'Vendor', 'Volume'].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.assets.map((asset) => (
                  <tr key={asset.ip} onClick={() => setSelectedIp(asset.ip)}>
                    <td><code style={{ color: '#4cc9f0', fontSize: '0.84rem' }}>{asset.ip}</code></td>
                    <td>{asset.hostname ?? '-'}</td>
                    <td><code style={{ fontSize: '0.78rem', color: '#8fa1bc' }}>{asset.mac ?? '-'}</code></td>
                    <td>{asset.country ?? '-'}</td>
                    <td>{asset.asn ?? '-'}</td>
                    <td>{asset.username ?? '-'}</td>
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
                    <td>{asset.communicationVolume.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    );
  }

  if (activeTab === 'flows') {
    return (
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
                  {['Timestamp', 'Source', 'Destination', 'Protocol', 'App', 'Bytes', 'Packets', 'Risk'].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.flows.map((flow) => (
                  <tr key={flow.id} onClick={() => setSelectedIp(flow.src_ip)}>
                    <td style={{ color: '#8fa1bc', fontSize: '0.82rem' }}>{new Date(flow.timestamp).toLocaleString()}</td>
                    <td><code style={{ color: '#4cc9f0', fontSize: '0.84rem' }}>{flow.src_ip}</code></td>
                    <td><code style={{ color: '#ffb84d', fontSize: '0.84rem' }}>{flow.dst_ip}</code></td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                        fontSize: '0.74rem', fontWeight: 700,
                        background: 'rgba(76,201,240,0.1)', border: '1px solid rgba(76,201,240,0.2)', color: '#4cc9f0'
                      }}>{flow.protocol ?? '-'}</span>
                    </td>
                    <td style={{ color: '#8fa1bc' }}>{flow.application ?? '-'}</td>
                    <td>{flow.bytes.toLocaleString()}</td>
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
            <p className="panel-note">Visual IP→IP→IP flow sequence for analyst investigation.</p>
          </div>
          <SequencePanel flows={filtered.flows} assets={filtered.assets} />
        </section>
      </main>
    );
  }

  if (activeTab === 'events') {
    return (
      <main className="tab-layout">
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
                  {['Timestamp', 'Event', 'Category', 'Severity', 'Source', 'Destination', 'User', 'Domain'].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.events.map((event) => (
                  <tr key={event.id} className={severityClass(event.severity)} onClick={() => setSelectedIp(event.src_ip ?? null)}>
                    <td style={{ color: '#8fa1bc', fontSize: '0.82rem' }}>{new Date(event.timestamp).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{event.event_name}</td>
                    <td style={{ color: '#8fa1bc' }}>{event.category ?? '-'}</td>
                    <td><SeverityCell severity={event.severity} /></td>
                    <td><code style={{ color: '#4cc9f0', fontSize: '0.84rem' }}>{event.src_ip ?? '-'}</code></td>
                    <td><code style={{ color: '#ffb84d', fontSize: '0.84rem' }}>{event.dst_ip ?? '-'}</code></td>
                    <td>{event.username ?? '-'}</td>
                    <td style={{ color: '#8fa1bc' }}>{event.domain ?? event.url ?? '-'}</td>
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

  // Alerts tab
  return (
    <main className="tab-layout">
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
                {['Timestamp', 'Alert', 'Severity', 'Risk', 'Source', 'Destination', 'IOC', 'Malware Family', 'Anomaly'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.alerts.map((alert) => (
                <tr key={alert.id} className={severityClass(alert.severity)} onClick={() => setSelectedIp(alert.src_ip ?? null)}>
                  <td style={{ color: '#8fa1bc', fontSize: '0.82rem' }}>{new Date(alert.timestamp).toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: '#e7eefb' }}>{alert.alert_name}</td>
                  <td><SeverityCell severity={alert.severity} /></td>
                  <td><RiskCell risk={alert.risk_score} /></td>
                  <td><code style={{ color: '#4cc9f0', fontSize: '0.84rem' }}>{alert.src_ip ?? '-'}</code></td>
                  <td><code style={{ color: '#ffb84d', fontSize: '0.84rem' }}>{alert.dst_ip ?? '-'}</code></td>
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