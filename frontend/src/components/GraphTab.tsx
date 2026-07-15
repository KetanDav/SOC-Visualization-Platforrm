import { useState } from 'react';
import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { severityTone } from '../lib/telemetry';

interface FilterOptions {
  ips: string[];
  protocols: string[];
  applications: string[];
  countries: string[];
  severities: string[];
  vendors: string[];
}

interface GraphTabProps {
  filtered: { assets: Asset[]; flows: Flow[]; events: EventRecord[]; alerts: AlertRecord[] };
  activeQuery: string;
  selectedIp: string | null;
  onFilterQuery: (query: string) => void;
  filterOptions: FilterOptions | null;
}

interface NodeItem {
  primary: string;
  secondary?: string;
  badge?: string;
  badgeColor?: string;
  filterQuery?: string;
}

interface GraphNode {
  id: string;
  label: string;
  count: number;
  color: string;
  bg: string;
  items: NodeItem[];
  allItems: NodeItem[];
  totalCount: number;
}

const MAX_ITEMS = 8;

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff5d73',
  high: '#ff5d73',
  medium: '#ffb84d',
  low: '#6ee7b7',
};

function truncate(str: string | undefined | null, len = 26): string {
  if (!str) return '-';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function riskColor(score?: number | string | null): string {
  const v = score != null ? Number(score) : null;
  if (v == null || isNaN(v)) return '#8fa1bc';
  if (v >= 80) return '#ff5d73';
  if (v >= 50) return '#ffb84d';
  return '#6ee7b7';
}

interface SidebarSectionProps {
  title: string;
  icon: string;
  items: string[];
  activeQuery: string;
  onSelect: (query: string) => void;
  buildQuery: (val: string) => string;
  colorFn?: (val: string) => string;
  search?: boolean;
}

function SidebarSection({ title, icon, items, activeQuery, onSelect, buildQuery, colorFn, search = false }: SidebarSectionProps) {
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState('');

  const visible = search && q.trim()
    ? items.filter((v) => v.toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div className="gsb-section">
      <button className="gsb-section-header" onClick={() => setOpen((o) => !o)}>
        <span className="gsb-section-icon">{icon}</span>
        <span className="gsb-section-title">{title}</span>
        <span className="gsb-section-count">{items.length}</span>
        <span className="gsb-section-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="gsb-section-body">
          {search && items.length > 6 && (
            <input
              className="gsb-search"
              placeholder={`Search ${title.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
          <ul className="gsb-list">
            {visible.slice(0, 80).map((val) => {
              const query = buildQuery(val);
              const isActive = activeQuery.includes(val);
              const color = colorFn ? colorFn(val) : undefined;
              return (
                <li key={val}>
                  <button
                    className={`gsb-item${isActive ? ' gsb-item--active' : ''}`}
                    style={isActive && color ? { borderColor: color, color } : color ? { '--item-dot': color } as React.CSSProperties : undefined}
                    onClick={() => onSelect(query)}
                    title={`Filter: ${query}`}
                  >
                    {color && <span className="gsb-dot" style={{ background: color }} />}
                    <span className="gsb-item-label">{val}</span>
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="gsb-no-results">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterSidebar({ filterOptions, activeQuery, onFilterQuery }: {
  filterOptions: FilterOptions;
  activeQuery: string;
  onFilterQuery: (q: string) => void;
}) {
  return (
    <aside className="graph-sidebar">
      <div className="gsb-header">
        <span className="gsb-header-title">Filters</span>
        {activeQuery && (
          <button className="gsb-clear" onClick={() => onFilterQuery('')}>Clear ✕</button>
        )}
      </div>

      <div className="gsb-scroll">
        <SidebarSection
          title="IP Address"
          icon="🌐"
          items={filterOptions.ips}
          activeQuery={activeQuery}
          onSelect={onFilterQuery}
          buildQuery={(ip) => `ip:=${ip}`}
          search
        />
        <SidebarSection
          title="Severity"
          icon="⚠️"
          items={filterOptions.severities}
          activeQuery={activeQuery}
          onSelect={onFilterQuery}
          buildQuery={(s) => `severity:${s}`}
          colorFn={(s) => SEVERITY_COLORS[s.toLowerCase()] ?? '#8fa1bc'}
        />
        <SidebarSection
          title="Protocol"
          icon="🔌"
          items={filterOptions.protocols}
          activeQuery={activeQuery}
          onSelect={onFilterQuery}
          buildQuery={(p) => `proto:${p}`}
        />
        <SidebarSection
          title="Application"
          icon="📱"
          items={filterOptions.applications}
          activeQuery={activeQuery}
          onSelect={onFilterQuery}
          buildQuery={(a) => `proto:${a}`}
          search
        />
        <SidebarSection
          title="Vendor"
          icon="🏢"
          items={filterOptions.vendors}
          activeQuery={activeQuery}
          onSelect={onFilterQuery}
          buildQuery={(v) => `vendor:${v}`}
        />
        <SidebarSection
          title="Country"
          icon="🌍"
          items={filterOptions.countries}
          activeQuery={activeQuery}
          onSelect={onFilterQuery}
          buildQuery={(c) => `country:${c}`}
          search
        />
      </div>
    </aside>
  );
}

export function GraphTab({ filtered, activeQuery, selectedIp, onFilterQuery, filterOptions }: GraphTabProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const hasFilter = activeQuery.trim().length > 0 || selectedIp !== null;

  const emptyContent = (
    <div className="graph-empty">
      <div className="graph-empty-inner">
        <div className="graph-empty-icon">🔍</div>
        <h2>No filter selected</h2>
        <p>Pick a filter from the panel on the left, or click an IP address in any other tab.</p>
      </div>
    </div>
  );

  let mainContent: React.ReactNode = emptyContent;

  if (hasFilter) {
    const rootLabel = selectedIp ?? activeQuery;

    const allPeerIps = Array.from(
      new Set(
        filtered.flows.flatMap((f) => [f.src_ip, f.dst_ip]).filter((ip) => ip && ip !== selectedIp)
      )
    );

    const allConnectedAssets: NodeItem[] = allPeerIps.map((ip) => {
      const asset = filtered.assets.find((a) => a.ip === ip);
      return {
        primary: ip,
        secondary: asset?.hostname ?? asset?.deviceType ?? undefined,
        filterQuery: ip,
      };
    });

    const allFlowItems: NodeItem[] = filtered.flows.map((f) => {
      const peerIp = f.dst_ip !== selectedIp ? f.dst_ip : f.src_ip;
      return {
        primary: peerIp,
        secondary: `${f.protocol ?? '?'} · ${f.bytes.toLocaleString()} B · ${f.packets} pkts`,
        badge: f.risk_score != null ? String(f.risk_score) : undefined,
        badgeColor: riskColor(f.risk_score),
        filterQuery: peerIp,
      };
    });

    const allEventItems: NodeItem[] = filtered.events.map((e) => ({
      primary: truncate(e.event_name, 28),
      secondary: `${e.category ?? '?'} · ${new Date(e.timestamp).toLocaleTimeString()}`,
      badge: e.severity ?? undefined,
      badgeColor: severityTone(e.severity),
      filterQuery: e.src_ip ?? e.dst_ip ?? undefined,
    }));

    const allAlertItems: NodeItem[] = filtered.alerts.map((a) => ({
      primary: truncate(a.alert_name, 28),
      secondary: a.malware_family ? `Malware: ${a.malware_family}` : a.ioc_match ? `IOC: ${a.ioc_match}` : undefined,
      badge: a.severity ?? undefined,
      badgeColor: severityTone(a.severity),
      filterQuery: a.src_ip ?? a.dst_ip ?? undefined,
    }));

    const nodes: GraphNode[] = [
      {
        id: 'flows',
        label: 'Flows',
        count: allFlowItems.length,
        color: '#4cc9f0',
        bg: 'rgba(76,201,240,0.12)',
        items: allFlowItems.slice(0, MAX_ITEMS),
        allItems: allFlowItems,
        totalCount: allFlowItems.length,
      },
      {
        id: 'events',
        label: 'Events',
        count: allEventItems.length,
        color: '#ffb84d',
        bg: 'rgba(255,184,77,0.12)',
        items: allEventItems.slice(0, MAX_ITEMS),
        allItems: allEventItems,
        totalCount: allEventItems.length,
      },
      {
        id: 'alerts',
        label: 'Alerts',
        count: allAlertItems.length,
        color: '#ff5d73',
        bg: 'rgba(255,93,115,0.12)',
        items: allAlertItems.slice(0, MAX_ITEMS),
        allItems: allAlertItems,
        totalCount: allAlertItems.length,
      },
      {
        id: 'assets',
        label: 'Connected IPs',
        count: allConnectedAssets.length,
        color: '#6ee7b7',
        bg: 'rgba(110,231,183,0.12)',
        items: allConnectedAssets.slice(0, MAX_ITEMS),
        allItems: allConnectedAssets,
        totalCount: allConnectedAssets.length,
      },
    ];

    mainContent = (
      <div className="graph-scroll">
        <div className="graph-canvas">
          <div className="graph-root-row">
            <div className="graph-root-node">
              <span className="graph-root-icon">🖥</span>
              <span className="graph-root-label">{rootLabel}</span>
            </div>
          </div>

          {nodes.map((node, idx) => {
            const side = idx % 2 === 0 ? 'right' : 'left';
            const isLast = idx === nodes.length - 1;
            const isExpanded = Boolean(expandedNodes[node.id]);
            const visibleItems = isExpanded ? node.allItems : node.items;
            const moreCount = node.totalCount - MAX_ITEMS;

            return (
              <div key={node.id} className="graph-section">
                <div
                  className={`graph-connector graph-connector--${side === 'right' ? 'left' : 'right'}`}
                  style={{ borderColor: node.color }}
                />
                <div className={`graph-row graph-row--${side}`}>
                  <div className="graph-node-card" style={{ borderColor: node.color, background: node.bg }}>
                    <div className="graph-node-header" style={{ background: node.color }}>
                      <span className="graph-node-label">{node.label}</span>
                      <span className="graph-node-count">{node.count}</span>
                    </div>
                    {node.allItems.length === 0 ? (
                      <div className="graph-node-empty">No data for this filter</div>
                    ) : (
                      <ul className="graph-item-list" style={{ maxHeight: isExpanded ? '380px' : 'none', overflowY: isExpanded ? 'auto' : 'visible' }}>
                        {visibleItems.map((item, i) => (
                          <li
                            key={i}
                            className={`graph-item ${item.filterQuery ? 'clickable-item' : ''}`}
                            onClick={() => {
                              if (item.filterQuery) onFilterQuery(item.filterQuery);
                            }}
                            style={{ cursor: item.filterQuery ? 'pointer' : 'default', transition: 'background 0.15s ease' }}
                            title={item.filterQuery ? `Click to filter graph by ${item.filterQuery}` : undefined}
                          >
                            <span className="graph-item-primary">{item.primary}</span>
                            {item.secondary && (
                              <span className="graph-item-secondary">{item.secondary}</span>
                            )}
                            {item.badge && (
                              <span
                                className="graph-item-badge"
                                style={{
                                  color: item.badgeColor,
                                  borderColor: `${item.badgeColor}44`,
                                  background: `${item.badgeColor}12`,
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </li>
                        ))}
                        {!isExpanded && moreCount > 0 && (
                          <li
                            className="graph-item graph-item--more"
                            onClick={() => setExpandedNodes((prev) => ({ ...prev, [node.id]: true }))}
                            title={`Click to view all ${node.totalCount} items in this card`}
                            style={{
                              cursor: 'pointer',
                              fontWeight: 700,
                              color: node.color,
                              background: `${node.color}15`,
                              border: `1px dashed ${node.color}55`,
                              borderRadius: 6,
                              padding: '6px 10px',
                              marginTop: 4,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = `${node.color}28`; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = `${node.color}15`; }}
                          >
                            <span>+{moreCount} more… (Click to expand)</span>
                            <span style={{ fontSize: '0.8rem' }}>▾</span>
                          </li>
                        )}
                        {isExpanded && moreCount > 0 && (
                          <li
                            className="graph-item graph-item--more"
                            onClick={() => setExpandedNodes((prev) => ({ ...prev, [node.id]: false }))}
                            title="Click to collapse card"
                            style={{
                              cursor: 'pointer',
                              fontWeight: 700,
                              color: '#8fa1bc',
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px dashed rgba(143,161,188,0.3)',
                              borderRadius: 6,
                              padding: '6px 10px',
                              marginTop: 4,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                          >
                            <span>Show less (Showing all {node.totalCount})</span>
                            <span style={{ fontSize: '0.8rem' }}>▴</span>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
                {!isLast && (
                  <div
                    className={`graph-connector graph-connector--${side}`}
                    style={{ borderColor: nodes[idx + 1].color }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className="graph-tab">
      {filterOptions && (
        <FilterSidebar
          filterOptions={filterOptions}
          activeQuery={activeQuery}
          onFilterQuery={onFilterQuery}
        />
      )}
      <div className="graph-tab-main">
        {mainContent}
      </div>
    </main>
  );
}
