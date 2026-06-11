import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { AlertRecord, EventRecord, Flow } from '@soc/telemetry-shared';

interface TimelineChartProps {
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
}

const bucketLabel = (timestamp: string) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function TimelineChart({ flows, events, alerts }: TimelineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const option = useMemo(() => {
    const labels = Array.from(new Set([
      ...flows.map((flow) => bucketLabel(flow.timestamp)),
      ...events.map((event) => bucketLabel(event.timestamp)),
      ...alerts.map((alert) => bucketLabel(alert.timestamp))
    ])).sort();

    const flowSeries = labels.map((label) => flows.filter((flow) => bucketLabel(flow.timestamp) === label).reduce((sum, flow) => sum + flow.bytes, 0));
    const eventSeries = labels.map((label) => events.filter((event) => bucketLabel(event.timestamp) === label).length);
    const alertSeries = labels.map((label) => alerts.filter((alert) => bucketLabel(alert.timestamp) === label).length);

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: 36, right: 18, top: 24, bottom: 36, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#8fa1bc' },
        axisLine: { lineStyle: { color: 'rgba(130,155,190,0.18)' } }
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { color: '#8fa1bc' },
          splitLine: { lineStyle: { color: 'rgba(130,155,190,0.12)' } }
        },
        {
          type: 'value',
          axisLabel: { color: '#8fa1bc' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Bytes',
          type: 'bar',
          data: flowSeries,
          itemStyle: { color: '#4cc9f0' }
        },
        {
          name: 'Events',
          type: 'line',
          yAxisIndex: 1,
          data: eventSeries,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: '#ffb84d', width: 3 },
          itemStyle: { color: '#ffb84d' }
        },
        {
          name: 'Alerts',
          type: 'scatter',
          yAxisIndex: 1,
          data: alertSeries,
          symbolSize: 12,
          itemStyle: { color: '#ff5d73' }
        }
      ]
    };
  }, [alerts, events, flows]);

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
    chartRef.current?.setOption(option);
  }, [option]);

  return <div className="chart-canvas timeline-canvas" ref={containerRef} />;
}
