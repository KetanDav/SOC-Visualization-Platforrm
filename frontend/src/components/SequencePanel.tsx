import { useMemo, useRef, useState } from 'react';
import type { Asset, Flow } from '@soc/telemetry-shared';
import { assetLabel, protocolTone } from '../lib/telemetry';

interface SequencePanelProps {
  flows: Flow[];
  assets: Asset[];
}

const LANE_WIDTH = 160;
const LANE_HEADER_HEIGHT = 64;
const ROW_HEIGHT = 58;
const SIDE_PAD = 24;
const ARROW_END_OFFSET = 18;

export function SequencePanel({ flows, assets }: SequencePanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.ip, a])), [assets]);

  // Sort flows by timestamp, take top 14
  const sortedFlows = useMemo(
    () => [...flows].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(0, 14),
    [flows]
  );

  // Collect unique IPs in order of appearance
  const laneIps = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const flow of sortedFlows) {
      if (!seen.has(flow.src_ip)) { seen.add(flow.src_ip); result.push(flow.src_ip); }
      if (!seen.has(flow.dst_ip)) { seen.add(flow.dst_ip); result.push(flow.dst_ip); }
    }
    return result;
  }, [sortedFlows]);

  const svgWidth = SIDE_PAD * 2 + laneIps.length * LANE_WIDTH;
  const svgHeight = LANE_HEADER_HEIGHT + sortedFlows.length * ROW_HEIGHT + 32;

  const laneX = (ip: string) => SIDE_PAD + laneIps.indexOf(ip) * LANE_WIDTH + LANE_WIDTH / 2;

  if (flows.length === 0) {
    return (
      <div className="empty-state">
        No flows match the current filters or playback step.
      </div>
    );
  }

  if (laneIps.length === 0) {
    return <div className="empty-state">No IP data available.</div>;
  }

  return (
    <div className="sequence-diagram-wrap">
      <div className="sequence-diagram-scroll">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', minWidth: svgWidth }}
        >
          <defs>
            {/* Arrowhead marker per protocol color would need multiple — use one default */}
            {['#4cc9f0', '#ffd166', '#f97316', '#7c3aed', '#8b9bb4', '#ff5d73'].map((color, i) => (
              <marker
                key={i}
                id={`arrow-${i}`}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L8,3 z" fill={color} />
              </marker>
            ))}
          </defs>

          {/* Lane vertical guide lines */}
          {laneIps.map((ip) => {
            const x = laneX(ip);
            return (
              <line
                key={ip}
                x1={x}
                y1={LANE_HEADER_HEIGHT}
                x2={x}
                y2={svgHeight - 16}
                stroke="rgba(130,155,190,0.15)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Lane headers */}
          {laneIps.map((ip) => {
            const x = laneX(ip);
            const asset = assetMap.get(ip);
            const label = assetLabel(asset ?? { ip, sourceVendor: [], communicationVolume: 0 });
            return (
              <g key={ip}>
                <rect
                  x={x - 64}
                  y={6}
                  width={128}
                  height={48}
                  rx={12}
                  fill="rgba(11,21,36,0.92)"
                  stroke="rgba(76,201,240,0.22)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={24}
                  textAnchor="middle"
                  fill="#4cc9f0"
                  fontSize={9}
                  fontWeight="700"
                  letterSpacing="0.06em"
                  fontFamily="Inter, monospace"
                >
                  {ip}
                </text>
                <text
                  x={x}
                  y={40}
                  textAnchor="middle"
                  fill="#8fa1bc"
                  fontSize={9}
                  fontFamily="Inter, sans-serif"
                  style={{ fontVariant: 'normal' }}
                >
                  {label !== ip ? label.slice(0, 18) : ''}
                </text>
              </g>
            );
          })}

          {/* Flow arrows */}
          {sortedFlows.map((flow, index) => {
            const y = LANE_HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
            const x1 = laneX(flow.src_ip);
            const x2 = laneX(flow.dst_ip);
            const isHovered = hoveredFlow === flow.id;
            const proto = flow.protocol ?? '';
            const color = protocolTone(proto);

            // Pick arrow marker index by matching color
            const colors = ['#4cc9f0', '#ffd166', '#f97316', '#7c3aed', '#8b9bb4', '#ff5d73'];
            const markerIndex = colors.indexOf(color) >= 0 ? colors.indexOf(color) : 4;

            const isSelf = x1 === x2;
            const goingRight = x2 > x1;

            const arrowX1 = x1 + (goingRight ? ARROW_END_OFFSET : -ARROW_END_OFFSET);
            const arrowX2 = x2 + (goingRight ? -ARROW_END_OFFSET : ARROW_END_OFFSET);
            const midX = (arrowX1 + arrowX2) / 2;
            const labelY = y - 8;

            // Row highlight band
            return (
              <g
                key={flow.id}
                onMouseEnter={() => setHoveredFlow(flow.id)}
                onMouseLeave={() => setHoveredFlow(null)}
                style={{ cursor: 'default' }}
              >
                {/* Row background */}
                <rect
                  x={SIDE_PAD - 8}
                  y={y - ROW_HEIGHT / 2 + 3}
                  width={svgWidth - (SIDE_PAD - 8) * 2}
                  height={ROW_HEIGHT - 6}
                  rx={10}
                  fill={isHovered ? 'rgba(76,201,240,0.07)' : 'transparent'}
                  stroke={isHovered ? 'rgba(76,201,240,0.14)' : 'transparent'}
                  strokeWidth={1}
                />

                {/* Timestamp label on left */}
                <text
                  x={SIDE_PAD - 2}
                  y={y + 4}
                  fill="#5a6f88"
                  fontSize={8}
                  fontFamily="Inter, monospace"
                  textAnchor="start"
                >
                  {new Date(flow.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </text>

                {isSelf ? (
                  // Self-loop: draw a small arc
                  <path
                    d={`M ${x1} ${y - 12} C ${x1 + 40} ${y - 28}, ${x1 + 40} ${y + 4}, ${x1} ${y + 12}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    opacity={isHovered ? 1 : 0.7}
                    markerEnd={`url(#arrow-${markerIndex})`}
                  />
                ) : (
                  <>
                    {/* Main arrow line */}
                    <line
                      x1={arrowX1}
                      y1={y}
                      x2={arrowX2}
                      y2={y}
                      stroke={color}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      opacity={isHovered ? 1 : 0.72}
                      markerEnd={`url(#arrow-${markerIndex})`}
                    />

                    {/* Protocol badge pill */}
                    <rect
                      x={midX - 22}
                      y={labelY - 11}
                      width={44}
                      height={16}
                      rx={8}
                      fill="rgba(7,17,31,0.92)"
                      stroke={color}
                      strokeWidth={0.8}
                      strokeOpacity={0.7}
                    />
                    <text
                      x={midX}
                      y={labelY + 1}
                      textAnchor="middle"
                      fill={color}
                      fontSize={8}
                      fontWeight="700"
                      fontFamily="Inter, monospace"
                      letterSpacing="0.05em"
                    >
                      {proto || 'FLOW'}
                    </text>

                    {/* Bytes label below arrow */}
                    <text
                      x={midX}
                      y={y + 14}
                      textAnchor="middle"
                      fill="#8fa1bc"
                      fontSize={8}
                      fontFamily="Inter, sans-serif"
                    >
                      {flow.bytes >= 1024
                        ? `${(flow.bytes / 1024).toFixed(1)}KB`
                        : `${flow.bytes}B`}
                      {flow.risk_score != null && flow.risk_score >= 70 ? ' ⚠' : ''}
                    </text>
                  </>
                )}

                {/* Source dot */}
                <circle cx={x1} cy={y} r={4} fill={color} opacity={0.85} />
                {/* Target dot */}
                {!isSelf && <circle cx={x2} cy={y} r={4} fill={color} fillOpacity={0.5} stroke={color} strokeWidth={1} />}
              </g>
            );
          })}

          {/* Row index numbers */}
          {sortedFlows.map((flow, index) => {
            const y = LANE_HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;
            return (
              <text
                key={`idx-${flow.id}`}
                x={svgWidth - SIDE_PAD + 4}
                y={y + 4}
                textAnchor="end"
                fill="rgba(76,201,240,0.35)"
                fontSize={9}
                fontFamily="Inter, monospace"
                fontWeight="700"
              >
                {index + 1}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
