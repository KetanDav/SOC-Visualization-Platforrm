import cytoscape from 'cytoscape';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { severityTone } from '../lib/telemetry';
import { SnakeTimeline } from './SnakeTimeline';

interface IpActivityTabProps {
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
  assets: Asset[];
  onFilterQuery: (query: string) => void;
}

type ActivityKind = 'flow' | 'event' | 'alert';

interface ActivityEntry {
  kind: ActivityKind;
  id: string;
  ts: number;
  timestamp: string;
  src_ip?: string;
  dst_ip?: string;
  title: string;
  subtitle?: string;
  protocol?: string;
  bytes?: number;
  severity?: string;
  risk?: number;
  vendor: string;
  meta: Record<string, string | number | undefined>;
}

const VENDOR_LABEL: Record<string, string> = {
  qradar: 'QRadar', sna: 'SNA', arista: 'Arista',
  cisco_ise: 'ISE', cisco_dnac: 'DNAC', cisco_apic: 'APIC',
};

const KIND_CONFIG = {
  flow:  { label: 'FLOW',  bg: 'rgba(76,201,240,0.12)',  border: 'rgba(76,201,240,0.35)',  color: '#4cc9f0'  },
  event: { label: 'EVENT', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)', color: '#a78bfa' },
  alert: { label: 'ALERT', bg: 'rgba(255,93,115,0.12)',  border: 'rgba(255,93,115,0.35)',  color: '#ff5d73'  },
};

const SUBNET_COLORS: Record<string, string> = {
  '10.10.10': '#4cc9f0', '10.10.20': '#a78bfa', '10.10.30': '#34d399',
  '10.10.40': '#f59e0b', '10.10.50': '#60a5fa', '10.10.60': '#f472b6',
  '10.10.70': '#94a3b8',
};
const EXTERNAL_COLOR = '#ff5d73';

const getSubnetColor = (ip: string) => {
  const prefix = ip.split('.').slice(0, 3).join('.');
  return SUBNET_COLORS[prefix] ?? EXTERNAL_COLOR;
};

const riskToEdgeColor = (risk: number) => {
  if (risk >= 85) return 'rgba(255,93,115,0.7)';
  if (risk >= 65) return 'rgba(255,184,77,0.6)';
  if (risk >= 40) return 'rgba(76,201,240,0.5)';
  return 'rgba(110,231,183,0.35)';
};

function buildEntries(flows: Flow[], events: EventRecord[], alerts: AlertRecord[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const f of flows) {
    entries.push({
      kind: 'flow', id: f.id,
      ts: new Date(f.timestamp).getTime(), timestamp: f.timestamp,
      src_ip: f.src_ip, dst_ip: f.dst_ip,
      title: `${f.protocol ?? 'Flow'} · ${f.application ?? ''}`.replace(/ · $/, ''),
      subtitle: f.dns_query ?? f.sni ?? undefined,
      protocol: f.protocol, bytes: f.bytes,
      risk: f.risk_score, vendor: String(f.sourceVendor),
      meta: { Bytes: f.bytes, Packets: f.packets, Protocol: f.protocol, App: f.application, Risk: f.risk_score, JA3: f.ja3, SNI: f.sni, DNS: f.dns_query, Direction: f.direction },
    });
  }
  for (const ev of events) {
    entries.push({
      kind: 'event', id: ev.id,
      ts: new Date(ev.timestamp).getTime(), timestamp: ev.timestamp,
      src_ip: ev.src_ip, dst_ip: ev.dst_ip,
      title: ev.event_name,
      subtitle: ev.category ?? ev.domain ?? undefined,
      severity: ev.severity, vendor: String(ev.sourceVendor),
      meta: { Category: ev.category, Severity: ev.severity, User: ev.username, Process: ev.process_name, File: ev.filename, Domain: ev.domain, URL: ev.url },
    });
  }
  for (const al of alerts) {
    entries.push({
      kind: 'alert', id: al.id,
      ts: new Date(al.timestamp).getTime(), timestamp: al.timestamp,
      src_ip: al.src_ip, dst_ip: al.dst_ip,
      title: al.alert_name,
      subtitle: al.malware_family ?? al.ioc_match ?? undefined,
      severity: al.severity, risk: al.risk_score, vendor: String(al.sourceVendor),
      meta: { Severity: al.severity, Risk: al.risk_score, IOC: al.ioc_match, Malware: al.malware_family, Anomaly: al.anomaly_score },
    });
  }
  return entries.sort((a, b) => b.ts - a.ts);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtBytes(b?: number) {
  if (b == null) return null;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}
function riskColor(r?: number) {
  if (!r) return '#8fa1bc';
  return r >= 80 ? '#ff5d73' : r >= 50 ? '#ffb84d' : '#6ee7b7';
}

export function IpActivityTab({ flows, events, alerts, assets, onFilterQuery }: IpActivityTabProps) {
  const graphRef = useRef<HTMLDivElement>(null);
  const cyRef    = useRef<cytoscape.Core | null>(null);
  const [focusIp, setFocusIp] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<ActivityKind | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const assetMap = useMemo(() => new Map(assets.map(a => [a.ip, a])), [assets]);
  const allEntries = useMemo(() => buildEntries(flows, events, alerts), [flows, events, alerts]);

  // Per-IP stats for node sizing / ring colours
  const ipStats = useMemo(() => {
    const map = new Map<string, { flows: number; events: number; alerts: number; bytes: number; maxRisk: number }>();
    const touch = (ip?: string) => {
      if (ip && !map.has(ip)) map.set(ip, { flows: 0, events: 0, alerts: 0, bytes: 0, maxRisk: 0 });
    };
    for (const e of allEntries) {
      touch(e.src_ip); touch(e.dst_ip);
      [e.src_ip, e.dst_ip].forEach(ip => {
        if (!ip) return;
        const s = map.get(ip)!;
        if (e.kind === 'flow')  { s.flows++;  s.bytes += (e.bytes ?? 0); }
        if (e.kind === 'event') s.events++;
        if (e.kind === 'alert') s.alerts++;
        if (e.risk) s.maxRisk = Math.max(s.maxRisk, e.risk);
      });
    }
    return map;
  }, [allEntries]);

  // ── Build & destroy Cytoscape whenever data changes ─────────────────────
  useEffect(() => {
    if (!graphRef.current) return;

    const ipSet = new Set<string>();
    flows.forEach(f => { ipSet.add(f.src_ip); ipSet.add(f.dst_ip); });
    events.forEach(e => { if (e.src_ip) ipSet.add(e.src_ip); if (e.dst_ip) ipSet.add(e.dst_ip); });
    alerts.forEach(a => { if (a.src_ip) ipSet.add(a.src_ip); if (a.dst_ip) ipSet.add(a.dst_ip); });

    type EdgeAgg = { src: string; dst: string; bytes: number; risk: number; count: number };
    const edgeMap = new Map<string, EdgeAgg>();
    flows.forEach(f => {
      const key = `${f.src_ip}|${f.dst_ip}`;
      const ex = edgeMap.get(key);
      if (ex) { ex.bytes += f.bytes; ex.risk = Math.max(ex.risk, f.risk_score ?? 0); ex.count++; }
      else edgeMap.set(key, { src: f.src_ip, dst: f.dst_ip, bytes: f.bytes, risk: f.risk_score ?? 0, count: 1 });
    });

    const maxBytes = Math.max(...Array.from(ipStats.values()).map(s => s.bytes), 1);

    const nodes: cytoscape.NodeDefinition[] = Array.from(ipSet).map(ip => {
      const stat = ipStats.get(ip) ?? { flows: 0, events: 0, alerts: 0, bytes: 0, maxRisk: 0 };
      const asset = assetMap.get(ip);
      const label = asset?.hostname ?? ip;
      const color = getSubnetColor(ip);
      const size  = 28 + (stat.bytes / maxBytes) * 50;
      const borderColor = stat.maxRisk >= 85 ? '#ff5d73' : stat.maxRisk >= 65 ? '#ffb84d' : color;
      const borderWidth = stat.alerts > 0 ? 3.5 : stat.events > 0 ? 2.5 : 1.5;
      return {
        data: {
          id: ip, ip,
          label: label.length > 16 ? label.slice(0, 14) + '…' : label,
          fullLabel: label, color, borderColor, borderWidth, size,
          hasAlerts: stat.alerts > 0, hasEvents: stat.events > 0,
          flowCount: stat.flows, eventCount: stat.events, alertCount: stat.alerts,
          maxRisk: stat.maxRisk,
        }
      };
    });

    const edges: cytoscape.EdgeDefinition[] = Array.from(edgeMap.values()).map((e, i) => ({
      data: {
        id: `e${i}`, source: e.src, target: e.dst,
        color: riskToEdgeColor(e.risk),
        width: Math.max(1, Math.min(6, 1 + (e.bytes / maxBytes) * 8)),
        bytes: e.bytes, risk: e.risk, count: e.count,
      }
    }));

    if (cyRef.current) cyRef.current.destroy();

    cyRef.current = cytoscape({
      container: graphRef.current,
      elements: { nodes, edges },
      style: [
        {
          selector: 'node',
          style: {
            'width': 'data(size)', 'height': 'data(size)',
            'background-color': 'data(color)', 'background-opacity': 0.85,
            'border-color': 'data(borderColor)', 'border-width': 'data(borderWidth)',
            'label': 'data(label)', 'color': '#e7eefb',
            'font-size': '10px', 'font-family': '"Inter","Outfit",sans-serif', 'font-weight': '600',
            'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 4,
            'text-outline-width': 2, 'text-outline-color': '#04091a', 'text-outline-opacity': 0.9,
            'transition-property': 'background-opacity, border-width',
            'transition-duration': '200ms',
          } as unknown as cytoscape.Css.Node
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 4, 'border-color': '#ffffff', 'background-opacity': 1 } as unknown as cytoscape.Css.Node
        },
        {
          selector: 'node.dimmed',
          style: { 'background-opacity': 0.15, 'color': 'rgba(231,238,251,0.18)' } as unknown as cytoscape.Css.Node
        },
        {
          selector: 'node.focused',
          style: { 'border-width': 4, 'border-color': '#4cc9f0', 'background-opacity': 1 } as unknown as cytoscape.Css.Node
        },
        {
          selector: 'edge',
          style: {
            'line-color': 'data(color)', 'width': 'data(width)',
            'curve-style': 'bezier', 'target-arrow-shape': 'triangle',
            'target-arrow-color': 'data(color)', 'arrow-scale': 0.7, 'opacity': 0.7,
          } as unknown as cytoscape.Css.Edge
        },
        {
          selector: 'edge.dimmed', style: { 'opacity': 0.05 } as unknown as cytoscape.Css.Edge
        },
        {
          selector: 'edge.highlighted', style: { 'opacity': 1, 'width': 4 } as unknown as cytoscape.Css.Edge
        },
      ],
      layout: {
        name: 'cose', animate: false,
        nodeRepulsion: () => 9000, idealEdgeLength: () => 130,
        gravity: 0.5, numIter: 1000, randomize: false,
      } as unknown as cytoscape.CoseLayoutOptions,
      userZoomingEnabled: true, userPanningEnabled: true, autoungrabify: false,
      boxSelectionEnabled: false,
    });

    const cy = cyRef.current;

    // tooltip
    const tooltip = document.createElement('div');
    tooltip.style.cssText = 'position:fixed;pointer-events:none;display:none;background:rgba(4,10,26,0.97);border:1px solid rgba(76,201,240,0.3);border-radius:10px;padding:10px 14px;font-size:0.78rem;color:#e7eefb;z-index:9999;font-family:Inter,sans-serif;max-width:260px;line-height:1.6;box-shadow:0 4px 24px rgba(0,0,0,0.5)';
    document.body.appendChild(tooltip);

    const moveTooltip = (e: cytoscape.EventObject) => {
      const ev = e.originalEvent as MouseEvent;
      tooltip.style.left = `${ev.clientX + 16}px`;
      tooltip.style.top  = `${ev.clientY - 10}px`;
    };

    const canvas = graphRef.current?.querySelector('canvas');
    cy.on('mouseover', 'node edge', () => { if (canvas) canvas.style.cursor = 'pointer'; });
    cy.on('mouseout',  'node edge', () => { if (canvas) canvas.style.cursor = ''; });

    cy.on('mouseover', 'node', (e) => {
      const node = e.target;
      cy.batch(() => {
        cy.elements().addClass('dimmed');
        node.removeClass('dimmed');
        node.connectedEdges().removeClass('dimmed').addClass('highlighted');
        node.connectedEdges().connectedNodes().removeClass('dimmed');
      });
      const d = node.data();
      const asset = assetMap.get(d.ip);
      tooltip.innerHTML = `
        <div style="font-weight:700;font-size:0.85rem;color:${d.color};margin-bottom:4px">${d.fullLabel}</div>
        <div style="color:#8fa1bc">${d.ip}</div>
        ${asset?.username ? `<div>👤 ${asset.username}</div>` : ''}
        ${asset?.country  ? `<div>🌍 ${asset.country}</div>` : ''}
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(130,155,190,0.15);display:flex;gap:10px;flex-wrap:wrap;font-size:0.72rem">
          ${d.flowCount  ? `<span style="color:#4cc9f0">↔ ${d.flowCount} flows</span>` : ''}
          ${d.eventCount ? `<span style="color:#a78bfa">📋 ${d.eventCount} events</span>` : ''}
          ${d.alertCount ? `<span style="color:#ff5d73">🚨 ${d.alertCount} alerts</span>` : ''}
          ${d.maxRisk    ? `<span style="color:${d.maxRisk >= 80 ? '#ff5d73' : '#ffb84d'}">⚡ Risk ${d.maxRisk}</span>` : ''}
        </div>
        <div style="margin-top:6px;font-size:0.72rem;color:rgba(76,201,240,0.7);border-top:1px solid rgba(130,155,190,0.1);padding-top:5px">🔍 Click to inspect activity</div>
      `;
      tooltip.style.display = 'block';
    });
    cy.on('mousemove', 'node', moveTooltip);
    cy.on('mouseout',  'node', () => {
      cy.batch(() => cy.elements().removeClass('dimmed').removeClass('highlighted'));
      tooltip.style.display = 'none';
    });

    cy.on('tap', 'node', (e) => {
      const ip = e.target.data('ip') as string;
      setFocusIp(prev => prev === ip ? null : ip);
    });

    cy.on('tap', (e) => {
      if (e.target === cy) setFocusIp(null);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
      tooltip.remove();
    };
  }, [flows, events, alerts, assets]);

  // Highlight focused node
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('focused').removeClass('dimmed').removeClass('highlighted');
    cy.edges().removeClass('dimmed').removeClass('highlighted');
    if (focusIp) {
      cy.nodes().addClass('dimmed');
      cy.edges().addClass('dimmed');
      const node = cy.$(`[id="${focusIp}"]`);
      node.removeClass('dimmed').addClass('focused');
      node.connectedEdges().removeClass('dimmed').addClass('highlighted');
      node.connectedEdges().connectedNodes().removeClass('dimmed');
    }
  }, [focusIp]);

  const focusAsset = focusIp ? assetMap.get(focusIp) : null;
  const focusStat  = focusIp ? ipStats.get(focusIp)  : null;

  const feed = useMemo(() => {
    let items = focusIp
      ? allEntries.filter(e => e.src_ip === focusIp || e.dst_ip === focusIp)
      : allEntries;
    if (kindFilter !== 'all') items = items.filter(e => e.kind === kindFilter);
    if (sortAsc) items = [...items].reverse();
    return items;
  }, [allEntries, focusIp, kindFilter, sortAsc]);

  return (
    <main className="activity-shell">

      {/* ── Left: Cytoscape graph ── */}
      <div className="activity-graph-pane">
        <div ref={graphRef} style={{ width: '100%', height: '100%' }} />

        {/* Graph legend overlay */}
        <div className="activity-graph-legend">
          {Object.entries(SUBNET_COLORS).map(([subnet, color]) => (
            <span key={subnet} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8fa1bc' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {subnet}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8fa1bc' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: EXTERNAL_COLOR, flexShrink: 0 }} />
            External
          </span>
        </div>

        {/* hint */}
        <div className="activity-graph-hint">Click a node to inspect its activity</div>
      </div>

      {/* ── Right: snake timeline (when IP focused) or feed (when none) ── */}
      <section className="activity-feed-wrap">
        {focusIp ? (
          <SnakeTimeline
            entries={feed}
            ip={focusIp}
            hostname={focusAsset?.hostname}
            onFilterQuery={onFilterQuery}
          />
        ) : (
          <>
            {/* Header */}
            <div className="activity-feed-header">
              <div className="activity-feed-title">
                <span style={{ color: '#e7eefb', fontWeight: 700 }}>All Activity</span>
                <span className="activity-feed-stats">{allEntries.length} events total</span>
              </div>
              <div className="activity-feed-controls">
                {(['all', 'flow', 'event', 'alert'] as const).map(k => (
                  <button
                    key={k}
                    className={`activity-kind-btn${kindFilter === k ? ' active' : ''} ${k}`}
                    onClick={() => setKindFilter(k)}
                  >
                    {k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1) + 's'}
                  </button>
                ))}
                <button className="activity-sort-btn" onClick={() => setSortAsc(v => !v)}>
                  {sortAsc ? '↑ Oldest' : '↓ Newest'}
                </button>
              </div>
            </div>

            {/* Feed list */}
            <div className="activity-feed">
              {feed.length === 0 && (
                <div className="activity-empty">
                  <span style={{ fontSize: '2rem' }}>🔍</span>
                  <p>No activity to show</p>
                  <p style={{ color: '#8fa1bc', fontSize: '0.82rem' }}>Click a node in the graph to inspect its timeline</p>
                </div>
              )}
              {(() => {
                let lastDate = '';
                return feed.map(entry => {
                  const cfg = KIND_CONFIG[entry.kind];
                  const dateStr = fmtDate(entry.timestamp);
                  const showDate = dateStr !== lastDate;
                  if (showDate) lastDate = dateStr;
                  const isExpanded = expandedId === entry.id;
                  const metaEntries = Object.entries(entry.meta).filter(([, v]) => v != null && v !== '');
                  return (
                    <div key={entry.id}>
                      {showDate && (
                        <div className="activity-date-divider"><span>{dateStr}</span></div>
                      )}
                      <div
                        className={`activity-entry${isExpanded ? ' expanded' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <div className="activity-entry-time">
                          <span className="activity-time">{fmtTime(entry.timestamp)}</span>
                        </div>
                        <div className="activity-entry-kind">
                          <span className="activity-kind-badge" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="activity-entry-body">
                          <div className="activity-entry-top">
                            <span className="activity-entry-title">{entry.title}</span>
                            {entry.subtitle && <span className="activity-entry-subtitle">{entry.subtitle}</span>}
                          </div>
                          <div className="activity-entry-ips">
                            {entry.src_ip && (
                              <code className="activity-ip-chip src" onClick={(e) => { e.stopPropagation(); setFocusIp(entry.src_ip!); }}>{entry.src_ip}</code>
                            )}
                            {entry.src_ip && entry.dst_ip && <span className="activity-arrow">→</span>}
                            {entry.dst_ip && (
                              <code className="activity-ip-chip dst" onClick={(e) => { e.stopPropagation(); setFocusIp(entry.dst_ip!); }}>{entry.dst_ip}</code>
                            )}
                            {entry.protocol && <span className="activity-proto">{entry.protocol}</span>}
                            {entry.bytes != null && <span className="activity-bytes">{fmtBytes(entry.bytes)}</span>}
                            {entry.severity && (
                              <span className="activity-severity" style={{ color: severityTone(entry.severity) }}>
                                {entry.severity.toUpperCase()}
                              </span>
                            )}
                          </div>
                          {isExpanded && metaEntries.length > 0 && (
                            <div className="activity-entry-meta">
                              {metaEntries.map(([k, v]) => (
                                <div key={k} className="activity-meta-row">
                                  <span className="activity-meta-key">{k}</span>
                                  <span className="activity-meta-val">{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="activity-entry-right">
                          <span className="activity-vendor">{VENDOR_LABEL[entry.vendor] ?? entry.vendor}</span>
                          {entry.risk != null && (
                            <span className="activity-risk" style={{ color: riskColor(entry.risk) }}>⚡{entry.risk}</span>
                          )}
                          <span className="activity-expand-icon">{isExpanded ? '▴' : '▾'}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
