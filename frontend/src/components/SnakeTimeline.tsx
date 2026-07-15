import { useState } from 'react';
import { severityTone } from '../lib/telemetry';

export interface SnakeEntry {
  kind: 'flow' | 'event' | 'alert';
  id: string;
  timestamp: string;
  title: string;
  subtitle?: string;
  src_ip?: string;
  dst_ip?: string;
  protocol?: string;
  bytes?: number;
  severity?: string;
  risk?: number;
  vendor: string;
  meta: Record<string, string | number | undefined>;
}

interface SnakeTimelineProps {
  entries: SnakeEntry[];
  ip: string;
  hostname?: string;
  onFilterQuery?: (q: string) => void;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const ITEMS_PER_ROW = 5;
const LEFT_X        = 90;
const RIGHT_X       = 850;
const VB_WIDTH      = 940;
const TURN_CTRL     = 58;
const STEP_X        = (RIGHT_X - LEFT_X) / (ITEMS_PER_ROW - 1);  // 190
const ROW_H         = 130;
const TOP_PAD       = 72;
const BOTTOM_PAD    = 60;
const DOT_RX        = 15;
const DOT_RY        = 11;

const KIND_COLOR: Record<string, string> = {
  flow:  '#4cc9f0',
  event: '#a78bfa',
  alert: '#ff5d73',
};
const KIND_LABEL: Record<string, string> = {
  flow: 'FLOW', event: 'EVENT', alert: 'ALERT',
};
const VENDOR_LABEL: Record<string, string> = {
  qradar: 'QRadar', sna: 'SNA', arista: 'Arista',
  cisco_ise: 'ISE', cisco_dnac: 'DNAC', cisco_apic: 'APIC',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtBytes(b?: number) {
  if (b == null) return null;
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
  if (b >= 1024)    return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}
function riskColor(r?: number) {
  if (!r) return '#8fa1bc';
  return r >= 80 ? '#ff5d73' : r >= 50 ? '#ffb84d' : '#6ee7b7';
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ── Build SVG snake path ──────────────────────────────────────────────────────
function buildSnakePath(numRows: number): string {
  let d = '';
  for (let row = 0; row < numRows; row++) {
    const y    = TOP_PAD + row * ROW_H;
    const ltr  = row % 2 === 0;
    const startX = ltr ? LEFT_X : RIGHT_X;
    const endX   = ltr ? RIGHT_X : LEFT_X;

    if (row === 0) d += `M ${startX} ${y} `;
    d += `L ${endX} ${y} `;

    if (row < numRows - 1) {
      const nextY = y + ROW_H;
      if (ltr) {
        d += `C ${RIGHT_X + TURN_CTRL} ${y}  ${RIGHT_X + TURN_CTRL} ${nextY}  ${RIGHT_X} ${nextY} `;
      } else {
        d += `C ${LEFT_X - TURN_CTRL}  ${y}  ${LEFT_X - TURN_CTRL}  ${nextY}  ${LEFT_X}  ${nextY} `;
      }
    }
  }
  return d;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SnakeTimeline({ entries, ip, hostname, onFilterQuery }: SnakeTimelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sort oldest → newest for the snake layout
  const sorted = [...entries].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="snake-empty">
        <span style={{ fontSize: '2rem' }}>🔍</span>
        <p>No activity recorded for <code>{ip}</code></p>
      </div>
    );
  }

  const numRows  = Math.ceil(sorted.length / ITEMS_PER_ROW);
  const VB_HEIGHT = TOP_PAD + numRows * ROW_H + BOTTOM_PAD;

  // Item positions on the snake
  const positions = sorted.map((entry, i) => {
    const row = Math.floor(i / ITEMS_PER_ROW);
    const j   = i % ITEMS_PER_ROW;
    const ltr = row % 2 === 0;
    const y   = TOP_PAD + row * ROW_H;
    const x   = ltr ? LEFT_X + j * STEP_X : RIGHT_X - j * STEP_X;
    return { entry, x, y, i };
  });

  const activePt = positions.find(p => p.entry.id === activeId);
  const snakePath = buildSnakePath(numRows);

  return (
    <div className="snake-wrap">
      {/* ── Header ── */}
      <div className="snake-header">
        <div className="snake-header-left">
          <span className="snake-ip">{ip}</span>
          {hostname && <span className="snake-host">· {hostname}</span>}
          <span className="snake-count">{sorted.length} events</span>
        </div>
        <div className="snake-header-right">
          <span className="snake-legend-dot" style={{ background: '#4cc9f0' }} />Flow
          <span className="snake-legend-dot" style={{ background: '#a78bfa' }} />Event
          <span className="snake-legend-dot" style={{ background: '#ff5d73' }} />Alert
          {onFilterQuery && (
            <button className="activity-filter-btn" onClick={() => onFilterQuery(`ip:=${ip}`)}>
              Filter app ↗
            </button>
          )}
        </div>
      </div>

      {/* ── SVG snake ── */}
      <div className="snake-svg-scroll">
        <svg
          viewBox={`-${TURN_CTRL} 0 ${VB_WIDTH + TURN_CTRL * 2} ${VB_HEIGHT}`}
          width="100%"
          style={{ display: 'block', minHeight: Math.min(VB_HEIGHT, 600) }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Glow filter */}
          <defs>
            <filter id="dot-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="dot-glow-active" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Snake track */}
          <path
            d={snakePath}
            fill="none"
            stroke="rgba(30,60,100,0.6)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={snakePath}
            fill="none"
            stroke="rgba(76,201,240,0.12)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Items */}
          {positions.map(({ entry, x, y, i }) => {
            const color    = KIND_COLOR[entry.kind];
            const isActive = activeId === entry.id;
            const rx       = isActive ? DOT_RX + 4 : DOT_RX;
            const ry       = isActive ? DOT_RY + 3 : DOT_RY;

            // Alternate label position: odd items label below dot, even above (relative to text)
            const labelAbove = i % 2 === 0;
            const dateY = labelAbove ? y - ry - 28 : y + ry + 14;
            const timeY = labelAbove ? y - ry - 16 : y + ry + 24;
            const titleY = labelAbove ? y + ry + 14 : y - ry - 16;

            return (
              <g
                key={entry.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveId(isActive ? null : entry.id)}
              >
                {/* Date */}
                <text
                  x={x} y={dateY}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="Inter, sans-serif"
                  fill="#8fa1bc"
                  fontWeight="600"
                >
                  {fmtDateShort(entry.timestamp)}
                </text>
                {/* Time */}
                <text
                  x={x} y={timeY}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="'JetBrains Mono', monospace"
                  fill="rgba(143,161,188,0.75)"
                >
                  {fmtTime(entry.timestamp)}
                </text>

                {/* Oval dot (active has outer ring) */}
                {isActive && (
                  <ellipse
                    cx={x} cy={y}
                    rx={rx + 5} ry={ry + 4}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    opacity="0.4"
                  />
                )}
                <ellipse
                  cx={x} cy={y}
                  rx={rx} ry={ry}
                  fill={color}
                  opacity={isActive ? 1 : 0.82}
                  filter={isActive ? 'url(#dot-glow-active)' : 'url(#dot-glow)'}
                />
                {/* Kind label inside dot */}
                <text
                  x={x} y={y + 3.5}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="Inter, sans-serif"
                  fontWeight="800"
                  fill="rgba(4,9,26,0.85)"
                  letterSpacing="0.04em"
                >
                  {KIND_LABEL[entry.kind]}
                </text>

                {/* Title below/above the dot */}
                <text
                  x={x} y={titleY}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontFamily="Inter, sans-serif"
                  fill={isActive ? '#e7eefb' : 'rgba(231,238,251,0.7)'}
                  fontWeight={isActive ? '700' : '400'}
                >
                  {truncate(entry.title, 16)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Detail card for active entry ── */}
      {activePt && (
        <div className="snake-detail">
          <div className="snake-detail-header">
            <span
              className="snake-detail-kind"
              style={{
                background: `${KIND_COLOR[activePt.entry.kind]}22`,
                border: `1px solid ${KIND_COLOR[activePt.entry.kind]}66`,
                color: KIND_COLOR[activePt.entry.kind],
              }}
            >
              {KIND_LABEL[activePt.entry.kind]}
            </span>
            <span className="snake-detail-title">{activePt.entry.title}</span>
            <span className="snake-detail-ts">
              {fmtDateShort(activePt.entry.timestamp)} {fmtTime(activePt.entry.timestamp)}
            </span>
            <button className="snake-detail-close" onClick={() => setActiveId(null)}>✕</button>
          </div>

          <div className="snake-detail-body">
            {/* IPs */}
            {(activePt.entry.src_ip || activePt.entry.dst_ip) && (
              <div className="snake-detail-ips">
                {activePt.entry.src_ip && (
                  <code className="activity-ip-chip src">{activePt.entry.src_ip}</code>
                )}
                {activePt.entry.src_ip && activePt.entry.dst_ip && (
                  <span className="activity-arrow">→</span>
                )}
                {activePt.entry.dst_ip && (
                  <code className="activity-ip-chip dst">{activePt.entry.dst_ip}</code>
                )}
                {activePt.entry.protocol && (
                  <span className="activity-proto">{activePt.entry.protocol}</span>
                )}
                {activePt.entry.bytes != null && (
                  <span className="activity-bytes">{fmtBytes(activePt.entry.bytes)}</span>
                )}
                {activePt.entry.severity && (
                  <span className="activity-severity" style={{ color: severityTone(activePt.entry.severity) }}>
                    {activePt.entry.severity.toUpperCase()}
                  </span>
                )}
                {activePt.entry.risk != null && (
                  <span className="activity-risk" style={{ color: riskColor(activePt.entry.risk) }}>
                    ⚡{activePt.entry.risk}
                  </span>
                )}
                <span className="activity-vendor">
                  {VENDOR_LABEL[activePt.entry.vendor] ?? activePt.entry.vendor}
                </span>
              </div>
            )}

            {/* Metadata grid */}
            <div className="snake-detail-meta">
              {Object.entries(activePt.entry.meta)
                .filter(([, v]) => v != null && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="activity-meta-row">
                    <span className="activity-meta-key">{k}</span>
                    <span className="activity-meta-val">{String(v)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
