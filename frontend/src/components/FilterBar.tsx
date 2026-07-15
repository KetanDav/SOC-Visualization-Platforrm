import { useRef, useState } from 'react';
import type { TelemetryFilters } from '../lib/telemetry';

type TimePreset = 'all' | '5m' | '1h' | '4h' | '12h' | '24h' | 'custom';

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(val: string): string {
  return val ? new Date(val).toISOString() : '';
}

const FIELD_TOKENS = [
  { key: 'ip:',         desc: 'src or dst IP' },
  { key: 'src:',        desc: 'source IP' },
  { key: 'dst:',        desc: 'destination IP' },
  { key: 'proto:',      desc: 'protocol / app' },
  { key: 'host:',       desc: 'hostname / domain' },
  { key: 'severity:',   desc: 'high · medium · low' },
  { key: 'alert:',      desc: 'alert name' },
  { key: 'event:',      desc: 'event name' },
  { key: 'port:',       desc: 'src or dst port' },
  { key: 'risk:',       desc: 'risk score 0–100' },
  { key: 'bytes:',      desc: 'transfer bytes' },
  { key: 'country:',    desc: 'asset country' },
  { key: 'username:',   desc: 'username' },
  { key: 'vendor:',     desc: 'qradar · sna · arista' },
  { key: 'type:',       desc: 'flow · event · alert · asset' },
  { key: 'url:',        desc: 'request URL' },
  { key: 'filename:',   desc: 'file name' },
  { key: 'process:',    desc: 'process name' },
  { key: 'ioc:',        desc: 'IOC match' },
  { key: 'malware:',    desc: 'malware family' },
];

const LOGIC_TOKENS = [
  { key: 'AND', desc: 'both must match', insert: ' AND ' },
  { key: 'OR',  desc: 'either must match', insert: ' OR ' },
  { key: 'NOT', desc: 'exclude matches', insert: ' NOT ' },
  { key: '( )', desc: 'group expressions', insert: '(' },
  { key: '-',   desc: 'negate next term', insert: '-' },
];

const COMPARE_TOKENS = [
  { key: ':>',    desc: 'greater than',          insert: ':>' },
  { key: ':>=',   desc: 'greater than or equal', insert: ':>=' },
  { key: ':<',    desc: 'less than',             insert: ':<' },
  { key: ':<=',   desc: 'less than or equal',    insert: ':<=' },
  { key: ':=',    desc: 'exact match',           insert: ':=' },
  { key: ':*',    desc: 'wildcard (* or ?)',      insert: ':*' },
  { key: ':x..y', desc: 'range (e.g. risk:50..90)', insert: ':' },
];

const EXAMPLES = [
  'severity:high AND risk:>75',
  '(ip:10.0.0.1 OR ip:10.0.0.2) AND proto:TCP',
  'NOT severity:low vendor:qradar',
  'ip:10.0.* risk:50..100',
  'alert:"lateral movement" OR malware:ransomware',
  '-type:asset bytes:>50000',
];

const TIME_PRESETS: Array<{ id: TimePreset; label: string }> = [
  { id: 'all',    label: 'All time' },
  { id: '5m',     label: 'Last 5 min' },
  { id: '1h',     label: 'Last 1 hour' },
  { id: '4h',     label: 'Last 4 hours' },
  { id: '12h',    label: 'Last 12 hours' },
  { id: '24h',    label: 'Last 24 hours' },
  { id: 'custom', label: 'Custom range…' },
];

interface FilterBarProps {
  filters: TelemetryFilters;
  playbackIndex: number;
  playbackMax: number;
  isPlaying: boolean;
  dataTimeMin?: string;
  dataTimeMax?: string;
  onFiltersChange: (filters: TelemetryFilters) => void;
  onPlaybackChange: (value: number) => void;
  onPlayToggle: () => void;
}

export function FilterBar({
  filters,
  playbackIndex,
  playbackMax,
  isPlaying,
  dataTimeMin,
  dataTimeMax,
  onFiltersChange,
  onPlaybackChange,
  onPlayToggle,
}: FilterBarProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<TimePreset>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const applyPreset = (preset: TimePreset) => {
    setActivePreset(preset);
    if (preset === 'all') {
      onFiltersChange({ ...filters, timeFrom: undefined, timeTo: undefined });
      return;
    }
    if (preset === 'custom') {
      onFiltersChange({
        ...filters,
        timeFrom: dataTimeMin ?? undefined,
        timeTo: dataTimeMax ?? undefined,
      });
      return;
    }
    const anchorMs = Date.now();
    const minutes = preset === '5m' ? 5 : 0;
    const hours = preset === '1h' ? 1 : preset === '4h' ? 4 : preset === '12h' ? 12 : preset === '24h' ? 24 : 0;
    const offsetMs = minutes * 60 * 1000 + hours * 3600 * 1000;
    const fromIso = new Date(anchorMs - offsetMs).toISOString();
    const toIso   = new Date(anchorMs).toISOString();
    onFiltersChange({ ...filters, timeFrom: fromIso, timeTo: toIso });
  };

  const insertAt = (insert: string) => {
    const el = inputRef.current;
    const current = filters.query;
    if (!el) {
      onFiltersChange({ query: (current.trimEnd() + ' ' + insert).trimStart() });
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end   = el.selectionEnd   ?? current.length;
    const next  = current.slice(0, start) + insert + current.slice(end);
    onFiltersChange({ query: next });
    requestAnimationFrame(() => {
      el.focus();
      const cur = start + insert.length;
      el.setSelectionRange(cur, cur);
    });
  };

  const handleFieldClick = (key: string) => {
    const current = filters.query;
    const prefix = current.trimEnd() ? current.trimEnd() + ' ' : '';
    onFiltersChange({ query: prefix + key });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleExampleClick = (ex: string) => {
    onFiltersChange({ query: ex });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <section className="filter-bar">
      <div className="filter-main-row">
        <div className="query-filter-wrap">
          <div className="query-input-row">
            <input
              ref={inputRef}
              id="filter-query"
              type="text"
              className="query-input"
              value={filters.query}
              placeholder='Filter: severity:high AND risk:>75   OR   ip:10.0.*'
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => onFiltersChange({ query: e.target.value })}
              onFocus={() => setHintOpen(true)}
              onBlur={() => setTimeout(() => setHintOpen(false), 180)}
            />
            {filters.query && (
              <button
                className="query-clear"
                type="button"
                title="Clear filter"
                onClick={() => { onFiltersChange({ query: '' }); inputRef.current?.focus(); }}
              >
                ✕
              </button>
            )}
          </div>

          {hintOpen && (
            <div className="query-hint-dropdown">
              <div className="qhd-section">
                <div className="qhd-section-label">Logic operators</div>
                <div className="qhd-chips">
                  {LOGIC_TOKENS.map(({ key, desc, insert }) => (
                    <button key={key} type="button" className="qhd-chip qhd-chip--logic"
                      onMouseDown={(e) => { e.preventDefault(); insertAt(insert); }}>
                      <span className="qhd-key">{key}</span>
                      <span className="qhd-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="qhd-section">
                <div className="qhd-section-label">Comparison operators (append after field name)</div>
                <div className="qhd-chips">
                  {COMPARE_TOKENS.map(({ key, desc, insert }) => (
                    <button key={key} type="button" className="qhd-chip qhd-chip--compare"
                      onMouseDown={(e) => { e.preventDefault(); insertAt(insert); }}>
                      <span className="qhd-key">{key}</span>
                      <span className="qhd-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="qhd-section">
                <div className="qhd-section-label">Fields — click to append</div>
                <div className="qhd-chips">
                  {FIELD_TOKENS.map(({ key, desc }) => (
                    <button key={key} type="button" className="qhd-chip qhd-chip--field"
                      onMouseDown={(e) => { e.preventDefault(); handleFieldClick(key); }}>
                      <span className="qhd-key">{key}</span>
                      <span className="qhd-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="qhd-section">
                <div className="qhd-section-label">Examples — click to load</div>
                <div className="qhd-examples">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} type="button" className="qhd-example"
                      onMouseDown={(e) => { e.preventDefault(); handleExampleClick(ex); }}>
                      <code>{ex}</code>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="time-preset-wrap">
          <select
            className="time-preset-select"
            value={activePreset}
            onChange={(e) => applyPreset(e.target.value as TimePreset)}
          >
            {TIME_PRESETS.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>

          {activePreset === 'custom' && (
            <div className="time-custom-inputs">
              <input
                type="datetime-local"
                className="time-input"
                value={filters.timeFrom ? toDatetimeLocal(filters.timeFrom) : (dataTimeMin ? toDatetimeLocal(dataTimeMin) : '')}
                min={dataTimeMin ? toDatetimeLocal(dataTimeMin) : undefined}
                max={dataTimeMax ? toDatetimeLocal(dataTimeMax) : undefined}
                onChange={(e) => onFiltersChange({ ...filters, timeFrom: fromDatetimeLocal(e.target.value) || undefined })}
              />
              <span className="time-custom-sep">→</span>
              <input
                type="datetime-local"
                className="time-input"
                value={filters.timeTo ? toDatetimeLocal(filters.timeTo) : (dataTimeMax ? toDatetimeLocal(dataTimeMax) : '')}
                min={dataTimeMin ? toDatetimeLocal(dataTimeMin) : undefined}
                max={dataTimeMax ? toDatetimeLocal(dataTimeMax) : undefined}
                onChange={(e) => onFiltersChange({ ...filters, timeTo: fromDatetimeLocal(e.target.value) || undefined })}
              />
            </div>
          )}
        </div>

        <div className="timeline-group">
          <button
            className="play-btn"
            onClick={onPlayToggle}
            title={isPlaying ? 'Pause playback' : 'Play playback'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={playbackMax}
            value={playbackIndex}
            onChange={(event) => onPlaybackChange(Number(event.target.value))}
            className="timeline-slider"
          />
          <span className="timeline-counter">
            {playbackIndex + 1} / {Math.max(1, playbackMax + 1)}
          </span>
        </div>
      </div>
    </section>
  );
}
