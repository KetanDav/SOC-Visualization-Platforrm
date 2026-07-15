import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlertRecord, Asset, EventRecord, Flow, IncidentAnalysisResponse, IncidentAnalysisTarget } from '@soc/telemetry-shared';
import type { TelemetryFilters, TelemetryPayload, TimelineEntry } from './lib/telemetry';
import { buildPlaybackCutoff, buildTimeline, filterPayload } from './lib/telemetry';
import { FilterBar } from './components/FilterBar';
import { EntityWorkspace, ViewTabs, type WorkspaceTab } from './components/EntityWorkspace';
import { IncidentAnalysisPanel } from './components/IncidentAnalysisPanel';
import { buildIncidentAnalysisContext } from './lib/incidentAnalysis';
import { UploadModal } from './components/UploadModal';

const initialFilters: TelemetryFilters = {
  query: ''
};

interface AnalysisState {
  target: IncidentAnalysisTarget | null;
  response: IncidentAnalysisResponse | null;
  loading: boolean;
  error: string | null;
}

export default function App() {
  const [payload, setPayload] = useState<TelemetryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    target: null,
    response: null,
    loading: false,
    error: null,
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isCustomData, setIsCustomData] = useState(false);
  const analysisAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);

        // Check if custom data is already saved on the server (persists across refreshes)
        const [payloadRes, statusRes] = await Promise.all([
          fetch('/api/payload'),
          fetch('/api/upload/status'),
        ]);

        if (!payloadRes.ok) throw new Error(`Backend returned ${payloadRes.status}`);

        const data = (await payloadRes.json()) as TelemetryPayload;
        const status = statusRes.ok
          ? (await statusRes.json()) as { hasCustomData: boolean }
          : { hasCustomData: false };

        if (alive) {
          setPayload(data);
          setIsCustomData(status.hasCustomData);
          setError(null);
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load telemetry payload');
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort();
    };
  }, []);

  const timeline = useMemo(() => (payload ? buildTimeline(payload) : []), [payload]);
  const cutoff = useMemo(() => buildPlaybackCutoff(timeline, playbackIndex), [playbackIndex, timeline]);
  const filtered: { assets: Asset[]; flows: Flow[]; events: EventRecord[]; alerts: AlertRecord[] } = useMemo(() => {
    if (!payload) return { assets: [], flows: [], events: [], alerts: [] };

    const base = filterPayload(payload, filters, cutoff);

    // Detect if the query is scoped to alert-type or event/category fields.
    // These fields don't exist on flows/assets, so those tabs go empty without this fix.
    const q = filters.query;
    const hasAlertField = /\balert:/i.test(q) || /\btype:=?alert\b/i.test(q);
    const hasEventField = /\b(event:|category:)/i.test(q) || /\btype:=?event\b/i.test(q);

    if (!hasAlertField && !hasEventField) return base;

    // Collect every IP involved in the matched alerts / events
    const relatedIps = new Set<string>();
    if (hasAlertField) {
      base.alerts.forEach(a => {
        if (a.src_ip) relatedIps.add(a.src_ip);
        if (a.dst_ip) relatedIps.add(a.dst_ip);
      });
    }
    if (hasEventField) {
      base.events.forEach(e => {
        if (e.src_ip) relatedIps.add(e.src_ip);
        if (e.dst_ip) relatedIps.add(e.dst_ip);
      });
    }

    // Nothing matched → fall back to standard filtered results
    if (relatedIps.size === 0) {
      return base;
    }

    // Time-bound helper (respects playback + custom range)
    const cutoffMs = cutoff ? new Date(cutoff).getTime() : Infinity;
    const fromMs = filters.timeFrom ? new Date(filters.timeFrom).getTime() : -Infinity;
    const toMs = filters.timeTo ? new Date(filters.timeTo).getTime() : Infinity;
    const withinTime = (ts: string) => {
      const t = new Date(ts).getTime();
      return t <= cutoffMs && t >= fromMs && t <= toMs;
    };
    const ipHit = (...ips: (string | undefined | null)[]) =>
      ips.some(v => v && relatedIps.has(v));

    return {
      // Primary filtered tab stays scoped to the query
      alerts: base.alerts,
      events: hasEventField ? base.events : payload.events.filter(e =>
        withinTime(e.timestamp) && ipHit(e.src_ip, e.dst_ip)
      ),
      // Flows and assets expand to show all traffic for the related IPs
      flows: payload.flows.filter(f =>
        withinTime(f.timestamp) && ipHit(f.src_ip, f.dst_ip)
      ),
      assets: payload.assets.filter(a => ipHit(a.ip)),
    };
  }, [payload, filters, cutoff]);

  const SKIP_SMALL = 10;
  const SKIP_LARGE = 50;

  useEffect(() => {
    if (!isPlaying || timeline.length === 0) {
      return;
    }

    const interval = Math.round(1200 / playbackSpeed);
    const timer = window.setInterval(() => {
      setPlaybackIndex((current) => (current >= timeline.length - 1 ? current : current + 1));
    }, interval);

    return () => window.clearInterval(timer);
  }, [isPlaying, timeline.length, playbackSpeed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const max = Math.max(0, timeline.length - 1);

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const skip = e.shiftKey ? SKIP_LARGE : SKIP_SMALL;
        setIsPlaying(false);
        setPlaybackIndex((i) => Math.max(0, i - skip));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const skip = e.shiftKey ? SKIP_LARGE : SKIP_SMALL;
        setIsPlaying(false);
        setPlaybackIndex((i) => Math.min(max, i + skip));
      } else if (e.code === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setPlaybackIndex(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        setIsPlaying(false);
        setPlaybackIndex(max);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timeline.length]);

  useEffect(() => {
    if (playbackIndex >= Math.max(0, timeline.length - 1)) {
      setIsPlaying(false);
    }
  }, [playbackIndex, timeline.length]);

  useEffect(() => {
    setSelectedIp(null);
  }, [filters.query]);

  const selectedAsset: Asset | null = filtered.assets.find((asset: Asset) => asset.ip === selectedIp) ?? null;
  const relatedFlows: Flow[] = filtered.flows.filter((flow: Flow) => flow.src_ip === selectedIp || flow.dst_ip === selectedIp);
  const relatedEvents: EventRecord[] = filtered.events.filter((event: EventRecord) => event.src_ip === selectedIp || event.dst_ip === selectedIp);
  const relatedAlerts: AlertRecord[] = filtered.alerts.filter((alert: AlertRecord) => alert.src_ip === selectedIp || alert.dst_ip === selectedIp);

  const activeCount = filtered.flows.length + filtered.events.length + filtered.alerts.length;
  const totalCount = payload ? payload.flows.length + payload.events.length + payload.alerts.length : 0;

  const dataTimeRange = useMemo(() => {
    if (!payload) return null;
    const allTs = [
      ...payload.flows.map(f => f.timestamp),
      ...payload.events.map(e => e.timestamp),
      ...payload.alerts.map(a => a.timestamp),
    ].filter(Boolean).map(ts => new Date(ts).getTime()).filter(t => !isNaN(t));
    if (allTs.length === 0) return null;
    return {
      min: new Date(Math.min(...allTs)).toISOString(),
      max: new Date(Math.max(...allTs)).toISOString(),
    };
  }, [payload]);

  const filterOptions = useMemo(() => {
    if (!payload) return null;
    const ips = Array.from(new Set([
      ...payload.assets.map((a) => a.ip),
      ...payload.flows.map((f) => f.src_ip),
      ...payload.flows.map((f) => f.dst_ip),
    ])).sort();
    const protocols = Array.from(new Set(payload.flows.map((f) => f.protocol).filter(Boolean))).sort() as string[];
    const applications = Array.from(new Set(payload.flows.map((f) => f.application).filter(Boolean))).sort() as string[];
    const countries = Array.from(new Set(payload.assets.map((a) => a.country).filter(Boolean))).sort() as string[];
    const severities = ['critical', 'high', 'medium', 'low'];
    const extractVendors = (sv: string | string[] | undefined): string[] => {
      if (!sv) return [];
      if (Array.isArray(sv)) return sv;
      return [sv];
    };
    const vendors = Array.from(new Set([
      ...payload.flows.flatMap((f) => extractVendors(f.sourceVendor as string | string[] | undefined)),
      ...payload.events.flatMap((e) => extractVendors(e.sourceVendor as string | string[] | undefined)),
      ...payload.alerts.flatMap((a) => extractVendors(a.sourceVendor as string | string[] | undefined)),
      ...payload.assets.flatMap((a) => extractVendors(a.sourceVendor as unknown as string | string[] | undefined)),
    ].filter(Boolean))).sort() as string[];
    return { ips, protocols, applications, countries, severities, vendors };
  }, [payload]);

  const handleFilterChange = (nextFilters: TelemetryFilters) => {
    setFilters(nextFilters);
  };

  const handleFilterByClick = (query: string) => {
    handleFilterChange({ query });
  };

  const handlePlaybackSlider = (value: number) => {
    setPlaybackIndex(value);
    setIsPlaying(false);
  };

  const handleUploadedPayload = (data: unknown) => {
    setPayload(data as TelemetryPayload);
    setPlaybackIndex(0);
    setIsPlaying(false);
    setFilters(initialFilters);
    setSelectedIp(null);
    setError(null);
    setIsCustomData(true);
  };

  const handleClearCustomData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Delete saved CSV files from the server so defaults are used on next load too
      await fetch('/api/upload', { method: 'DELETE' });
      const res = await fetch('/api/payload');
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data = (await res.json()) as TelemetryPayload;
      setPayload(data);
      setPlaybackIndex(0);
      setIsPlaying(true);
      setFilters(initialFilters);
      setSelectedIp(null);
      setIsCustomData(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reload default data');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAnalysis = () => {
    analysisAbortRef.current?.abort();
    setAnalysisState({
      target: null,
      response: null,
      loading: false,
      error: null,
    });
  };

  const setAnalysisTarget = (target: IncidentAnalysisTarget) => {
    analysisAbortRef.current?.abort();
    setAnalysisState({ target, response: null, loading: false, error: null });
  };

  const handleAnalyzeIncident = async (target: IncidentAnalysisTarget, provider: 'ollama' | 'gemini' = 'ollama') => {
    if (!payload) {
      setAnalysisState({
        target,
        response: null,
        loading: false,
        error: 'Telemetry data is still loading. Try again after the dashboard finishes loading.',
      });
      return;
    }

    const context = buildIncidentAnalysisContext(payload, filtered, target);
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    setAnalysisState({
      target,
      response: null,
      loading: true,
      error: null,
    });

    try {
      const response = await fetch('/api/analysis/incident', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context, provider }),
        signal: controller.signal,
      });

      const data = (await response.json()) as IncidentAnalysisResponse;

      if (controller.signal.aborted) {
        return;
      }

      setAnalysisState({
        target,
        response: data,
        loading: false,
        error: data.ok ? null : (data.fallbackMessage ?? data.error?.message ?? 'Local analysis could not be completed.'),
      });
    } catch (analysisError) {
      if (controller.signal.aborted) {
        return;
      }

      const message = analysisError instanceof Error ? analysisError.message : 'Failed to request local analysis.';
      setAnalysisState({
        target,
        response: null,
        loading: false,
        error: message,
      });
    }
  };

  return (
    <div className="app-shell">
      <div className="top-bar">
        <span className="top-bar-brand">SOC Telemetry</span>
        <span className="top-bar-credit">made by Ketan &amp; Saaransh</span>
        {isCustomData && (
          <span className="custom-data-badge">● Custom Data</span>
        )}
        {isCustomData && (
          <button className="clear-data-btn" onClick={handleClearCustomData} title="Revert to default built-in data">
            ✕ Clear / Reset Default
          </button>
        )}
        <a
          className="export-csv-btn"
          href="/api/export/csv"
          download
          title="Download normalized data as ZIP (flows, events, alerts, assets)"
        >
          ↓ Export ZIP
        </a>
        <button className="upload-csv-btn" onClick={() => setUploadModalOpen(true)} title="Upload custom CSV data">
          ↑ Upload CSV
        </button>
      </div>

      {uploadModalOpen && (
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onPayloadLoaded={handleUploadedPayload}
        />
      )}

      <FilterBar
        filters={filters}
        playbackIndex={playbackIndex}
        playbackMax={Math.max(0, timeline.length - 1)}
        dataTimeMin={dataTimeRange?.min}
        dataTimeMax={dataTimeRange?.max}
        onFiltersChange={handleFilterChange}
        onPlaybackChange={handlePlaybackSlider}
      />

      <ViewTabs activeTab={activeTab} onChange={setActiveTab} />

      <IncidentAnalysisPanel
        target={analysisState.target}
        response={analysisState.response}
        loading={analysisState.loading}
        error={analysisState.error}
        onAnalyze={(provider) => {
          if (analysisState.target) {
            void handleAnalyzeIncident(analysisState.target, provider);
          }
        }}
        onClear={handleClearAnalysis}
      />

      {loading && <div className="status-banner">Loading telemetry payload...</div>}
      {error && <div className="status-banner error">{error}</div>}

      {payload && (
        <EntityWorkspace
          activeTab={activeTab}
          filtered={filtered}
          selectedIp={selectedIp}
          setSelectedIp={setSelectedIp}
          onFilterQuery={handleFilterByClick}
          onAnalyzeIncident={setAnalysisTarget}
          activeQuery={filters.query}
          filterOptions={filterOptions}
        />
      )}

    </div>
  );
}

