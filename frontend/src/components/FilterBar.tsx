import type { TelemetryFilters } from '../lib/telemetry';

interface FilterBarProps {
  filters: TelemetryFilters;
  playbackIndex: number;
  playbackMax: number;
  isPlaying: boolean;
  ips: string[];
  hostnames: string[];
  protocols: string[];
  sourceCounts?: {
    qradar: number;
    sna: number;
    arista: number;
  };
  onFiltersChange: (filters: TelemetryFilters) => void;
  onPlaybackToggle: () => void;
  onPlaybackChange: (value: number) => void;
}

export function FilterBar({
  filters,
  playbackIndex,
  playbackMax,
  isPlaying,
  ips,
  hostnames,
  protocols,
  sourceCounts,
  onFiltersChange,
  onPlaybackToggle,
  onPlaybackChange
}: FilterBarProps) {
  return (
    <section className="filter-bar">
      <div className="filter-group">
        <label htmlFor="filter-ip">IP</label>
        <input
          id="filter-ip"
          list="ip-options"
          value={filters.ip}
          placeholder="Search by IP"
          onChange={(event) => onFiltersChange({ ...filters, ip: event.target.value })}
        />
        <datalist id="ip-options">
          {ips.map((ip) => <option key={ip} value={ip} />)}
        </datalist>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-protocol">Protocol</label>
        <input
          id="filter-protocol"
          list="protocol-options"
          value={filters.protocol}
          placeholder="TCP, UDP, SMB, DNS"
          onChange={(event) => onFiltersChange({ ...filters, protocol: event.target.value })}
        />
        <datalist id="protocol-options">
          {protocols.map((protocol) => <option key={protocol} value={protocol} />)}
        </datalist>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-hostname">Hostname</label>
        <input
          id="filter-hostname"
          list="hostname-options"
          value={filters.hostname}
          placeholder="Search by hostname"
          onChange={(event) => onFiltersChange({ ...filters, hostname: event.target.value })}
        />
        <datalist id="hostname-options">
          {hostnames.map((hostname) => <option key={hostname} value={hostname} />)}
        </datalist>
      </div>

      <div className="filter-group">
        <span>Playback</span>
        <button className="playback-button" type="button" onClick={onPlaybackToggle}>
          {isPlaying ? 'Pause' : 'Play'} live replay
        </button>
      </div>

      <div className="playback-row">
        <span>Stream replay</span>
        <input
          type="range"
          min={0}
          max={playbackMax}
          value={playbackIndex}
          onChange={(event) => onPlaybackChange(Number(event.target.value))}
        />
        <span>{playbackIndex + 1} / {Math.max(1, playbackMax + 1)}</span>
        <div className="source-pills">
          {sourceCounts && (
            <>
              <span className="source-pill">QRadar {sourceCounts.qradar}</span>
              <span className="source-pill">SNA {sourceCounts.sna}</span>
              <span className="source-pill">Arista {sourceCounts.arista}</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
