import { useEffect, useMemo, useState } from 'react';
import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import type { TelemetryFilters, TelemetryPayload, TimelineEntry } from './lib/telemetry';
import { buildPlaybackCutoff, buildTimeline, filterPayload, uniqueHostnames, uniqueIps, uniqueProtocols } from './lib/telemetry';
import { FilterBar } from './components/FilterBar';
import { CommunicationGraph } from './components/CommunicationGraph';
import { SankeyChart } from './components/SankeyChart';
import { TimelineChart } from './components/TimelineChart';
import { SequencePanel } from './components/SequencePanel';
import { DetailsPanel } from './components/DetailsPanel';
import { EntityWorkspace, ViewTabs, type WorkspaceTab } from './components/EntityWorkspace';

const initialFilters: TelemetryFilters = {
  ip: '',
  protocol: '',
  hostname: ''
};

export default function App() {
  const [payload, setPayload] = useState<TelemetryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/payload');
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data = (await response.json()) as TelemetryPayload;
        if (alive) {
          setPayload(data);
          setError(null);
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load telemetry payload');
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  const timeline = useMemo(() => (payload ? buildTimeline(payload) : []), [payload]);
  const cutoff = useMemo(() => buildPlaybackCutoff(timeline, playbackIndex), [playbackIndex, timeline]);
  const filtered: { assets: Asset[]; flows: Flow[]; events: EventRecord[]; alerts: AlertRecord[] } = useMemo(() => (payload ? filterPayload(payload, filters, cutoff) : { assets: [], flows: [], events: [], alerts: [] }), [payload, filters, cutoff]);

  useEffect(() => {
    if (!isPlaying || timeline.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setPlaybackIndex((current) => (current >= timeline.length - 1 ? current : current + 1));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [isPlaying, timeline.length]);

  useEffect(() => {
    if (playbackIndex >= Math.max(0, timeline.length - 1)) {
      setIsPlaying(false);
    }
  }, [playbackIndex, timeline.length]);

  useEffect(() => {
    setSelectedIp(null);
  }, [filters.ip, filters.hostname, filters.protocol]);

  const selectedAsset: Asset | null = filtered.assets.find((asset: Asset) => asset.ip === selectedIp) ?? null;
  const relatedFlows: Flow[] = filtered.flows.filter((flow: Flow) => flow.src_ip === selectedIp || flow.dst_ip === selectedIp);
  const relatedEvents: EventRecord[] = filtered.events.filter((event: EventRecord) => event.src_ip === selectedIp || event.dst_ip === selectedIp);
  const relatedAlerts: AlertRecord[] = filtered.alerts.filter((alert: AlertRecord) => alert.src_ip === selectedIp || alert.dst_ip === selectedIp);

  const activeCount = filtered.flows.length + filtered.events.length + filtered.alerts.length;
  const totalCount = payload ? payload.flows.length + payload.events.length + payload.alerts.length : 0;

  const handleFilterChange = (nextFilters: TelemetryFilters) => {
    setFilters(nextFilters);
    setPlaybackIndex(0);
    setIsPlaying(true);
  };

  const handlePlaybackSlider = (value: number) => {
    setPlaybackIndex(value);
    setIsPlaying(false);
  };

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="hero">
        <div>
          <p className="eyebrow">SOC Telemetry Visualization Platform</p>
          <h1>Communication-first cyber exploration for analyst workflow.</h1>
          <p className="hero-copy">
            Correlate assets, follow flows, inspect alerts, and replay telemetry as if it were arriving live.
          </p>
        </div>
        <div className="hero-stats">
          <StatCard label="Assets" value={payload?.assets.length ?? 0} icon="🖥" />
          <StatCard label="Flows" value={payload?.flows.length ?? 0} icon="⬆" />
          <StatCard label="Events" value={payload?.events.length ?? 0} icon="📋" />
          <StatCard label="Alerts" value={payload?.alerts.length ?? 0} icon="🚨" accent />
          <StatCard
            label="High-Risk"
            value={payload?.alerts.filter(a => (a.risk_score ?? 0) >= 75).length ?? 0}
            icon="⚡"
            accent
          />
          <StatCard
            label="Unique IPs"
            value={payload ? new Set([...payload.flows.map(f => f.src_ip), ...payload.flows.map(f => f.dst_ip)]).size : 0}
            icon="🌐"
          />
        </div>
      </header>

      <FilterBar
        filters={filters}
        playbackIndex={playbackIndex}
        playbackMax={Math.max(0, timeline.length - 1)}
        isPlaying={isPlaying}
        onFiltersChange={handleFilterChange}
        onPlaybackToggle={() => setIsPlaying((current) => !current)}
        onPlaybackChange={handlePlaybackSlider}
        ips={payload ? uniqueIps(payload) : []}
        hostnames={payload ? uniqueHostnames(payload) : []}
        protocols={payload ? uniqueProtocols(payload) : []}
        sourceCounts={payload?.sourceCounts}
      />

      <ViewTabs activeTab={activeTab} onChange={setActiveTab} />

      {loading && <div className="status-banner">Loading telemetry payload...</div>}
      {error && <div className="status-banner error">{error}</div>}

      {payload && (
        <EntityWorkspace
          activeTab={activeTab}
          filtered={filtered}
          selectedIp={selectedIp}
          setSelectedIp={setSelectedIp}
        />
      )}

      {!loading && payload && (
        <footer className="footer-note">
          Showing {activeCount} of {totalCount} communication records at playback step {playbackIndex + 1}/{timeline.length || 1}.
        </footer>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon?: string; accent?: boolean }) {
  return (
    <div className="stat-card" style={accent ? { borderColor: 'rgba(255,93,115,0.3)', background: 'rgba(255,93,115,0.06)' } : undefined}>
      {icon && <span style={{ fontSize: '1.1rem' }}>{icon}</span>}
      <strong style={accent ? { color: '#ff5d73' } : undefined}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
