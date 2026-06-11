import cytoscape from 'cytoscape';
import { useEffect, useRef } from 'react';
import type { Asset, Flow } from '@soc/telemetry-shared';
import { protocolTone } from '../lib/telemetry';

interface CommunicationGraphProps {
  flows: Flow[];
  assets: Asset[];
  onSelectIp: (ip: string | null) => void;
  selectedIp: string | null;
}

const SUBNET_COLORS: Record<string, string> = {
  '10.10.10': '#4cc9f0',  // Finance workstations — cyan
  '10.10.20': '#a78bfa',  // File/DB servers — purple
  '10.10.30': '#34d399',  // Eng workstations — green
  '10.10.40': '#f59e0b',  // Ops/Jump hosts — amber
  '10.10.50': '#60a5fa',  // Lab hosts — blue
  '10.10.60': '#f472b6',  // Domain controllers — pink
  '10.10.70': '#94a3b8',  // SIEM — gray
};

const EXTERNAL_COLOR = '#ff5d73'; // red for external

const getSubnetColor = (ip: string): string => {
  const prefix = ip.split('.').slice(0, 3).join('.');
  return SUBNET_COLORS[prefix] ?? EXTERNAL_COLOR;
};

const isInternal = (ip: string) => ip.startsWith('10.');

const riskToEdgeColor = (risk?: number): string => {
  if (!risk) return 'rgba(76,201,240,0.35)';
  if (risk >= 85) return 'rgba(255,93,115,0.75)';
  if (risk >= 65) return 'rgba(255,184,77,0.65)';
  if (risk >= 40) return 'rgba(76,201,240,0.55)';
  return 'rgba(110,231,183,0.4)';
};

export function CommunicationGraph({ flows, assets, onSelectIp, selectedIp }: CommunicationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Build node set from assets + any IPs in flows not already there
    const assetMap = new Map(assets.map(a => [a.ip, a]));

    // Collect all unique IPs from flows
    const ipSet = new Set<string>();
    flows.forEach(f => { ipSet.add(f.src_ip); ipSet.add(f.dst_ip); });
    assets.forEach(a => ipSet.add(a.ip));

    // Aggregate edges: group by src+dst, sum bytes, take max risk
    type EdgeAgg = { src: string; dst: string; bytes: number; risk: number; protocol: string; count: number };
    const edgeMap = new Map<string, EdgeAgg>();
    flows.forEach(f => {
      const key = `${f.src_ip}|${f.dst_ip}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.bytes += f.bytes;
        existing.risk = Math.max(existing.risk, f.risk_score ?? 0);
        existing.count++;
      } else {
        edgeMap.set(key, { src: f.src_ip, dst: f.dst_ip, bytes: f.bytes, risk: f.risk_score ?? 0, protocol: f.protocol ?? 'TCP', count: 1 });
      }
    });

    // Compute per-node total bytes for sizing
    const nodeBytes = new Map<string, number>();
    edgeMap.forEach(e => {
      nodeBytes.set(e.src, (nodeBytes.get(e.src) ?? 0) + e.bytes);
      nodeBytes.set(e.dst, (nodeBytes.get(e.dst) ?? 0) + e.bytes);
    });
    const maxBytes = Math.max(...nodeBytes.values(), 1);

    // Compute per-node max risk
    const nodeRisk = new Map<string, number>();
    flows.forEach(f => {
      const r = f.risk_score ?? 0;
      nodeRisk.set(f.src_ip, Math.max(nodeRisk.get(f.src_ip) ?? 0, r));
      nodeRisk.set(f.dst_ip, Math.max(nodeRisk.get(f.dst_ip) ?? 0, r));
    });

    // Build Cytoscape elements
    const nodes: cytoscape.ElementDefinition[] = Array.from(ipSet).map(ip => {
      const asset = assetMap.get(ip);
      const bytes = nodeBytes.get(ip) ?? 0;
      const risk = nodeRisk.get(ip) ?? 0;
      const size = 28 + (bytes / maxBytes) * 52;
      const color = getSubnetColor(ip);
      const label = asset?.hostname ?? ip;
      return {
        data: {
          id: ip,
          label: label.length > 16 ? label.slice(0, 14) + '…' : label,
          fullLabel: label,
          ip,
          bytes,
          risk,
          size,
          color,
          borderColor: risk >= 85 ? '#ff5d73' : risk >= 65 ? '#ffb84d' : color,
          borderWidth: risk >= 65 ? 3 : 1.5,
          internal: isInternal(ip),
        }
      };
    });

    const edges: cytoscape.ElementDefinition[] = Array.from(edgeMap.values()).map((e, i) => ({
      data: {
        id: `edge-${i}`,
        source: e.src,
        target: e.dst,
        bytes: e.bytes,
        risk: e.risk,
        count: e.count,
        protocol: e.protocol,
        color: riskToEdgeColor(e.risk),
        width: Math.max(1, Math.min(6, 1 + (e.bytes / maxBytes) * 8)),
      }
    }));

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: { nodes, edges },
      style: [
        {
          selector: 'node',
          style: {
            'width': 'data(size)',
            'height': 'data(size)',
            'background-color': 'data(color)',
            'background-opacity': 0.85,
            'border-color': 'data(borderColor)',
            'border-width': 'data(borderWidth)',
            'label': 'data(label)',
            'color': '#e7eefb',
            'font-size': '10px',
            'font-family': '"Inter", "Outfit", sans-serif',
            'font-weight': '600',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'text-outline-width': 2,
            'text-outline-color': '#04091a',
            'text-outline-opacity': 0.9,
            'transition-property': 'background-opacity, border-width',
            'transition-duration': '200ms',
          } as cytoscape.Css.Node
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#ffffff',
            'background-opacity': 1,
          } as cytoscape.Css.Node
        },
        {
          selector: 'node.dimmed',
          style: {
            'background-opacity': 0.18,
            'color': 'rgba(231,238,251,0.2)',
          } as cytoscape.Css.Node
        },
        {
          selector: 'edge',
          style: {
            'line-color': 'data(color)',
            'width': 'data(width)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'data(color)',
            'arrow-scale': 0.7,
            'opacity': 0.75,
          } as cytoscape.Css.Edge
        },
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.06,
          } as cytoscape.Css.Edge
        },
        {
          selector: 'edge.highlighted',
          style: {
            'opacity': 1,
            'width': 3,
          } as cytoscape.Css.Edge
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        gravity: 0.6,
        numIter: 1000,
        randomize: false,
      } as cytoscape.CoseLayoutOptions,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      autoungrabify: false,
    });

    const cy = cyRef.current;

    // Hover: dim unrelated nodes/edges
    cy.on('mouseover', 'node', (e) => {
      const node = e.target;
      cy.batch(() => {
        cy.elements().addClass('dimmed');
        node.removeClass('dimmed');
        node.connectedEdges().removeClass('dimmed').addClass('highlighted');
        node.connectedEdges().connectedNodes().removeClass('dimmed');
      });
    });
    cy.on('mouseout', 'node', () => {
      cy.batch(() => {
        cy.elements().removeClass('dimmed').removeClass('highlighted');
      });
    });

    // Click: select + propagate
    cy.on('tap', 'node', (e) => {
      const ip = e.target.data('ip') as string;
      onSelectIp(ip);
    });
    cy.on('tap', (e) => {
      if (e.target === cy) onSelectIp(null);
    });

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'graph-tooltip';
    tooltip.style.cssText = 'position:fixed;pointer-events:none;display:none;background:rgba(4,10,26,0.95);border:1px solid rgba(76,201,240,0.3);border-radius:10px;padding:10px 14px;font-size:0.78rem;color:#e7eefb;z-index:9999;font-family:Inter,sans-serif;max-width:240px;line-height:1.6;box-shadow:0 4px 24px rgba(0,0,0,0.5)';
    document.body.appendChild(tooltip);

    cy.on('mouseover', 'node', (e) => {
      const d = e.target.data();
      const asset = assetMap.get(d.ip);
      tooltip.innerHTML = `
        <div style="font-weight:700;font-size:0.85rem;color:${d.color};margin-bottom:4px">${d.fullLabel}</div>
        <div style="color:#8fa1bc">${d.ip}</div>
        ${asset?.username ? `<div>👤 ${asset.username}</div>` : ''}
        ${asset?.country ? `<div>🌍 ${asset.country} ${asset.asn ? `· ASN ${asset.asn}` : ''}</div>` : ''}
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(130,155,190,0.15)">
          <span style="color:#ffb84d">⬆ ${(d.bytes / 1024).toFixed(1)} KB</span>
          ${d.risk > 0 ? `&nbsp; <span style="color:${d.risk >= 85 ? '#ff5d73' : '#ffb84d'}">⚡ Risk ${d.risk}</span>` : ''}
        </div>
      `;
      tooltip.style.display = 'block';
    });
    cy.on('mousemove', 'node', (e) => {
      const evt = e.originalEvent as MouseEvent;
      tooltip.style.left = `${evt.clientX + 16}px`;
      tooltip.style.top = `${evt.clientY - 10}px`;
    });
    cy.on('mouseout', 'node', () => { tooltip.style.display = 'none'; });

    // Pre-select if selectedIp
    if (selectedIp) {
      cy.$(`[id="${selectedIp}"]`).select();
    }

    return () => {
      cy.destroy();
      cyRef.current = null;
      tooltip.remove();
    };
  }, [flows, assets]);

  // Keep selection in sync without full re-render
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().unselect();
    if (selectedIp) cy.$(`[id="${selectedIp}"]`).select();
  }, [selectedIp]);

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 340 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 340 }} />
      {/* Subnet legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        display: 'flex', flexWrap: 'wrap', gap: '6px 10px',
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(4,10,20,0.82)', border: '1px solid rgba(130,155,190,0.12)',
        maxWidth: 320, fontSize: '0.72rem', fontFamily: 'Inter, sans-serif'
      }}>
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
      {/* Risk edge legend */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(4,10,20,0.82)', border: '1px solid rgba(130,155,190,0.12)',
        fontSize: '0.72rem', fontFamily: 'Inter, sans-serif', color: '#8fa1bc'
      }}>
        <span style={{ fontWeight: 700, marginBottom: 2, color: '#e7eefb' }}>Edge Risk</span>
        {[['≥85', '#ff5d73'], ['≥65', '#ffb84d'], ['≥40', '#4cc9f0'], ['<40', '#6ee7b7']].map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 20, height: 2, background: color, borderRadius: 1, flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
