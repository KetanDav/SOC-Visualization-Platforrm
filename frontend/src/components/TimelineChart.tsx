import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { AlertRecord, EventRecord, Flow } from '@soc/telemetry-shared';

export type TimelineSeries = 'bytes' | 'events' | 'alerts';

interface TimelineChartProps {
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
  visibleSeries?: TimelineSeries[];
}

const ALL_SERIES: TimelineSeries[] = ['bytes', 'events', 'alerts'];

const bucketLabel = (timestamp: string) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function TimelineChart({ flows, events, alerts, visibleSeries = ALL_SERIES }: TimelineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  const option = useMemo(() => {
    const showBytes  = visibleSeries.includes('bytes');
    const showEvents = visibleSeries.includes('events');
    const showAlerts = visibleSeries.includes('alerts');

    const labels = Array.from(new Set([
      ...(showBytes  ? flows.map((f) => bucketLabel(f.timestamp))   : []),
      ...(showEvents ? events.map((e) => bucketLabel(e.timestamp))  : []),
      ...(showAlerts ? alerts.map((a) => bucketLabel(a.timestamp))  : []),
    ])).sort();

    if (labels.length === 0) {
      return {
        backgroundColor: 'transparent',
        graphic: [{
          type: 'text',
          left: 'center', top: 'middle',
          style: { text: 'No data for selected series', fill: '#8fa1bc', fontSize: 13 }
        }]
      };
    }

    const flowSeries  = labels.map((l) => flows.filter((f) => bucketLabel(f.timestamp) === l).reduce((s, f) => s + f.bytes, 0));
    const eventSeries = labels.map((l) => events.filter((e) => bucketLabel(e.timestamp) === l).length);
    const alertSeries = labels.map((l) => alerts.filter((a) => bucketLabel(a.timestamp) === l).length);

    const needsRightAxis = showEvents || showAlerts;

    const series: object[] = [];

    if (showBytes) {
      series.push({
        name: 'Bytes',
        type: 'bar',
        yAxisIndex: 0,
        data: flowSeries,
        itemStyle: { color: '#4cc9f0', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 32,
      });
    }

    if (showEvents) {
      series.push({
        name: 'Events',
        type: 'line',
        yAxisIndex: needsRightAxis && showBytes ? 1 : 0,
        data: eventSeries,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#ffb84d', width: 2.5 },
        itemStyle: { color: '#ffb84d' },
        areaStyle: { color: 'rgba(255,184,77,0.08)' },
      });
    }

    if (showAlerts) {
      series.push({
        name: 'Alerts',
        type: 'scatter',
        yAxisIndex: needsRightAxis && showBytes ? 1 : 0,
        data: alertSeries,
        symbolSize: (val: number) => Math.max(8, Math.min(24, 8 + val * 2)),
        itemStyle: { color: '#ff5d73', opacity: 0.85 },
      });
    }

    const yAxes: echarts.EChartsCoreOption['yAxis'] = showBytes && needsRightAxis
      ? [
          {
            type: 'value',
            name: 'Bytes',
            nameTextStyle: { color: '#4cc9f0', fontSize: 11 },
            axisLabel: { color: '#8fa1bc', formatter: (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v) },
            splitLine: { lineStyle: { color: 'rgba(130,155,190,0.12)' } },
          },
          {
            type: 'value',
            name: 'Count',
            nameTextStyle: { color: '#ffb84d', fontSize: 11 },
            axisLabel: { color: '#8fa1bc' },
            splitLine: { show: false },
          },
        ]
      : [
          {
            type: 'value',
            axisLabel: {
              color: '#8fa1bc',
              formatter: showBytes
                ? (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : String(v)
                : undefined
            },
            splitLine: { lineStyle: { color: 'rgba(130,155,190,0.12)' } },
          },
        ];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(7,17,31,0.92)',
        borderColor: 'rgba(130,155,190,0.2)',
        textStyle: { color: '#e7eefb', fontSize: 12 },
        formatter: (params: echarts.TooltipComponentFormatterCallbackParams) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const time = params[0].name;
          const lines = params.map((p) => {
            const val = typeof p.value === 'number' && showBytes && p.seriesName === 'Bytes'
              ? p.value >= 1e6 ? `${(p.value / 1e6).toFixed(2)} MB` : p.value >= 1e3 ? `${(p.value / 1e3).toFixed(1)} KB` : `${p.value} B`
              : p.value;
            return `<span style="color:${p.color}">${p.seriesName}</span>: <b>${val}</b>`;
          });
          return `<div style="font-size:11px;color:#8fa1bc;margin-bottom:4px">${time}</div>${lines.join('<br/>')}`;
        },
      },
      legend: {
        show: false,
      },
      grid: { left: 12, right: needsRightAxis && showBytes ? 12 : 12, top: 16, bottom: 32, containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#8fa1bc', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(130,155,190,0.18)' } },
        axisTick: { lineStyle: { color: 'rgba(130,155,190,0.18)' } },
      },
      yAxis: yAxes,
      series,
    };
  }, [alerts, events, flows, visibleSeries]);

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
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div className="chart-canvas timeline-canvas" ref={containerRef} />;
}
