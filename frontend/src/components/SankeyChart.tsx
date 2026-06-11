import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { Asset, Flow } from '@soc/telemetry-shared';
import { assetLabel, protocolTone } from '../lib/telemetry';

interface SankeyChartProps {
  flows: Flow[];
  assets: Asset[];
}

export function SankeyChart({ flows, assets }: SankeyChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const { nodes, links } = useMemo(() => {
    const labelByIp = new Map(assets.map((asset) => [asset.ip, assetLabel(asset)]));
    const nodeIds = new Set<string>();
    const nodes: Array<{ name: string; itemStyle?: { color: string } }> = [];
    const links = flows.map((flow) => {
      const source = labelByIp.get(flow.src_ip) ?? flow.src_ip;
      const target = labelByIp.get(flow.dst_ip) ?? flow.dst_ip;
      if (!nodeIds.has(source)) {
        nodeIds.add(source);
        nodes.push({ name: source, itemStyle: { color: '#4cc9f0' } });
      }
      if (!nodeIds.has(target)) {
        nodeIds.add(target);
        nodes.push({ name: target, itemStyle: { color: '#ffb84d' } });
      }
      return {
        source,
        target,
        value: Math.max(flow.bytes, 1),
        lineStyle: { color: protocolTone(flow.protocol), opacity: 0.4 }
      };
    });

    return { nodes, links };
  }, [assets, flows]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

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
    if (!chartRef.current) {
      return;
    }

    chartRef.current.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'sankey',
          emphasis: { focus: 'adjacency' },
          nodeAlign: 'left',
          data: nodes,
          links,
          draggable: false,
          lineStyle: { curveness: 0.5 },
          label: { color: '#e7eefb' },
          itemStyle: { borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1 }
        }
      ]
    });
  }, [links, nodes]);

  return <div className="chart-canvas sankey-canvas" ref={containerRef} />;
}
