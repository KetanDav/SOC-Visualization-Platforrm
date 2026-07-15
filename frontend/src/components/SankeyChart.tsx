import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { Asset, Flow } from '@soc/telemetry-shared';
import { assetLabel, protocolTone } from '../lib/telemetry';

interface SankeyChartProps {
  flows: Flow[];
  assets: Asset[];
}

function fmtTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

export function SankeyChart({ flows, assets }: SankeyChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const { nodes, links } = useMemo(() => {
    const labelByIp = new Map(assets.map((asset) => [asset.ip, assetLabel(asset)]));
    const nodeIds = new Set<string>();
    const nodes: Array<{ name: string; itemStyle?: { color: string } }> = [];

    // Group by (source, target, protocol) so each protocol gets its own band
    const linkMap = new Map<string, {
      source: string;
      target: string;
      protocol: string;
      bytes: number;
      packets: number;
      count: number;
      timestamps: string[];
      application?: string;
    }>();

    for (const flow of flows) {
      const source = labelByIp.get(flow.src_ip) ?? flow.src_ip;
      const target = labelByIp.get(flow.dst_ip) ?? flow.dst_ip;
      const protocol = flow.protocol ?? 'UNKNOWN';
      const key = `${source}||${target}||${protocol}`;

      if (!nodeIds.has(source)) {
        nodeIds.add(source);
        nodes.push({ name: source, itemStyle: { color: '#4cc9f0' } });
      }
      if (!nodeIds.has(target)) {
        nodeIds.add(target);
        nodes.push({ name: target, itemStyle: { color: '#ffb84d' } });
      }

      const existing = linkMap.get(key);
      if (existing) {
        existing.bytes += flow.bytes;
        existing.packets += flow.packets;
        existing.count += 1;
        existing.timestamps.push(flow.timestamp);
        if (!existing.application && flow.application) {
          existing.application = flow.application;
        }
      } else {
        linkMap.set(key, {
          source,
          target,
          protocol,
          bytes: Math.max(flow.bytes, 1),
          packets: flow.packets,
          count: 1,
          timestamps: [flow.timestamp],
          application: flow.application,
        });
      }
    }

    const links = Array.from(linkMap.values()).map((entry) => {
      const sorted = [...entry.timestamps].sort();
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const durationMs = new Date(last).getTime() - new Date(first).getTime();
      const durationStr = durationMs > 0
        ? durationMs >= 60000
          ? `${Math.round(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`
          : `${Math.round(durationMs / 1000)}s`
        : '<1s';

      return {
        source: entry.source,
        target: entry.target,
        value: Math.max(entry.bytes, 1),
        protocol: entry.protocol,
        bytes: entry.bytes,
        packets: entry.packets,
        count: entry.count,
        firstSeen: first,
        lastSeen: last,
        duration: durationStr,
        application: entry.application,
        lineStyle: {
          color: protocolTone(entry.protocol),
          opacity: 0.5,
        },
      };
    });

    return { nodes, links };
  }, [assets, flows]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const d = params.data;
          if (params.dataType === 'edge') {
            const proto = d.protocol ?? '—';
            const app = d.application ? `<br/><span style="color:#aaa">App:</span> ${d.application}` : '';
            const time = d.firstSeen
              ? `<br/><span style="color:#aaa">First:</span> ${fmtTime(d.firstSeen)}<br/><span style="color:#aaa">Last:</span> ${fmtTime(d.lastSeen)}<br/><span style="color:#aaa">Duration:</span> ${d.duration}`
              : '';
            const color = protocolTone(proto);
            return `
              <div style="font-size:12px;line-height:1.8">
                <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};margin-right:5px"></span>
                <strong>${d.source} → ${d.target}</strong><br/>
                <span style="color:#aaa">Protocol:</span> <strong style="color:${color}">${proto}</strong>${app}<br/>
                <span style="color:#aaa">Volume:</span> ${fmtBytes(d.bytes)}<br/>
                <span style="color:#aaa">Packets:</span> ${d.packets}<br/>
                <span style="color:#aaa">Flows:</span> ${d.count}${time}
              </div>`;
          }
          return `<strong>${d.name}</strong>`;
        },
      },
      series: [
        {
          type: 'sankey',
          emphasis: { focus: 'adjacency' },
          nodeAlign: 'left',
          data: nodes,
          links,
          draggable: false,
          lineStyle: { curveness: 0.5 },
          label: { color: '#e7eefb', fontSize: 11 },
          itemStyle: { borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1 },
          edgeLabel: {
            show: true,
            formatter: (params: any) => {
              const proto = params.data.protocol ?? '';
              const bytes = params.data.bytes ?? 0;
              return `${proto} · ${fmtBytes(bytes)}`;
            },
            fontSize: 9,
            color: '#ccd6f6',
            backgroundColor: 'rgba(0,0,0,0.45)',
            padding: [2, 4],
            borderRadius: 3,
          },
        },
      ],
    });
  }, [links, nodes]);

  return <div className="chart-canvas sankey-canvas" ref={containerRef} />;
}
