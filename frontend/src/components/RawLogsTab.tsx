import { useEffect, useState, useMemo } from 'react';

interface RawLogsTabProps {
  activeQuery: string; // current IP filter from the global filter bar
}

type VendorKey = 'qradar' | 'sna' | 'arista' | 'cisco_ise' | 'cisco_dnac' | 'cisco_apic';

const VENDOR_CONFIG: Record<VendorKey, { label: string; color: string; description: string }> = {
  qradar:     { label: 'QRadar',      color: '#a78bfa', description: 'IBM QRadar SIEM — Security events, offenses, flow data' },
  sna:        { label: 'Cisco SNA',   color: '#4cc9f0', description: 'Cisco Secure Network Analytics (StealthWatch) — NetFlow records' },
  arista:     { label: 'Arista NDR',  color: '#34d399', description: 'Arista NDR — Threat detections, JA3, malware alerts' },
  cisco_ise:  { label: 'Cisco ISE',   color: '#f59e0b', description: 'Cisco Identity Services Engine — NAC auth events, posture' },
  cisco_dnac: { label: 'Cisco DNAC',  color: '#60a5fa', description: 'Cisco DNA Center — Network device inventory, config audit' },
  cisco_apic: { label: 'Cisco APIC',  color: '#f472b6', description: 'Cisco ACI APIC — SDN fabric policy & endpoint events' },
};

const PAGE_SIZE = 50;

function fmtCellValue(val: string): string {
  if (!val || val === '' || val === '----') return '—';
  return val.length > 80 ? val.slice(0, 80) + '…' : val;
}

function isSensitiveColumn(col: string): boolean {
  const c = col.toLowerCase();
  return c.includes('password') || c.includes('secret') || c.includes('key') || c.includes('token');
}

export function RawLogsTab({ activeQuery }: RawLogsTabProps) {
  const [vendor, setVendor] = useState<VendorKey>('qradar');
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [isUploaded, setIsUploaded] = useState<boolean | null>(null);
  const [page, setPage] = useState(0);
  const [localFilter, setLocalFilter] = useState('');

  // Extract IP from activeQuery for backend filtering
  const ipFromQuery = useMemo(() => {
    const m = activeQuery.match(/ip:=?([0-9.]+)/);
    return m ? m[1] : '';
  }, [activeQuery]);

  useEffect(() => {
    setPage(0);
    setIsUploaded(null);
  }, [vendor, ipFromQuery]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const url = `/api/raw?vendor=${vendor}${ipFromQuery ? `&ip=${encodeURIComponent(ipFromQuery)}` : ''}`;

    // Use fetch with improved error reporting
    const controller = new AbortController();
    const signal = controller.signal;
    const fetchPromise = fetch(url, { signal });

    fetchPromise
      .then(async (r) => {
        if (!r.ok) {
          // try to parse backend JSON error message when available
          try {
            const body = await r.json();
            const msg = body && body.message ? String(body.message) : `API error ${r.status}`;
            throw new Error(msg);
          } catch (parseErr) {
            throw new Error(`API error ${r.status}`);
          }
        }
        return r.json() as Promise<{ vendor: string; totalRows: number; rows: Array<Record<string, string>>; isUploaded: boolean }>;
      })
      .then(data => {
        if (!alive) return;
        setIsUploaded(data.isUploaded ?? false);
        setRows(data.rows);
        setTotalRows(data.totalRows);
        // columns are set by a separate effect so user toggle persists
      })
      .catch(e => {
        if (!alive) return;
        if (e instanceof Error) {
          setError(e.name === 'AbortError' ? 'Request timed out' : e.message);
        } else {
          setError('Failed to fetch raw logs');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    // Abort the request if it takes longer than 10s
    const timeout = setTimeout(() => controller.abort(), 10000);

    return () => { alive = false; clearTimeout(timeout); controller.abort(); };
  }, [vendor, ipFromQuery]);

  // Default per-vendor curated column lists
  const DEFAULT_COLUMNS: Partial<Record<VendorKey, string[]>> = {
    cisco_ise: [
      'timestamp','event_id','event_name','category','severity','username',
      'src_ip','src_port','dst_ip','dst_port','mac_address','hostname','os_type',
      'device_type','identity_group','auth_protocol','failure_reason','risk_score',
      'session_id','framed_ip','policy_set','auth_rule','posture_status','endpoint_profile',
      'vlan_assignment','nas_ip','nas_port_type','nas_port_id','audit_session_id','src_country'
    ]
  };

  // Update columns when rows arrive or when user toggles between curated/all
  useEffect(() => {
    if (!rows || rows.length === 0) {
      setColumns([]);
      return;
    }
    const allCols = Object.keys(rows[0]);
    if (showAllColumns) {
      setColumns(allCols);
      return;
    }

    const defaults = DEFAULT_COLUMNS[vendor];
    if (defaults && defaults.length > 0) {
      // keep only defaults that actually exist in the CSV
      setColumns(defaults.filter(c => allCols.includes(c)));
    } else {
      setColumns(allCols);
    }
  }, [rows, showAllColumns, vendor]);

  // Local text filter applied on top of IP-filtered rows
  const filteredRows = useMemo(() => {
    if (!localFilter.trim()) return rows;
    const lf = localFilter.toLowerCase();
    return rows.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(lf))
    );
  }, [rows, localFilter]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const cfg = VENDOR_CONFIG[vendor];

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '0 4px' }}>
      <section className="panel tab-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Header */}
        <div className="panel-header compact" style={{ flexShrink: 0 }}>
          <div>
            <p className="panel-kicker">Raw Source Telemetry</p>
            <h2>Raw Vendor Logs</h2>
          </div>
          <p className="panel-note" style={{ margin: 0 }}>
            Unprocessed rows from selected vendor. No cross-vendor correlation applied.
          </p>
        </div>

        {/* Vendor Picker */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {(Object.entries(VENDOR_CONFIG) as [VendorKey, typeof cfg][]).map(([key, c]) => {
              const active = vendor === key;
              return (
                <button
                  key={key}
                  onClick={() => setVendor(key)}
                  style={{
                    padding: '5px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700,
                    cursor: 'pointer', border: `1px solid ${active ? c.color : 'rgba(130,155,190,0.2)'}`,
                    background: active ? `${c.color}20` : 'rgba(255,255,255,0.03)',
                    color: active ? c.color : '#8fa1bc',
                    transition: 'all 0.15s', letterSpacing: '0.02em'
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Vendor description + stats banner */}
          <div style={{
            padding: '8px 14px', borderRadius: 10, marginBottom: 10,
            background: `${cfg.color}0c`, border: `1px solid ${cfg.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: cfg.color }}>{cfg.description}</span>
              {ipFromQuery && (
                <span style={{ fontSize: '0.72rem', color: '#ffb84d' }}>
                  🔍 Filtered by IP: <code style={{ color: '#ffb84d' }}>{ipFromQuery}</code>
                </span>
              )}
              {!ipFromQuery && (
                <span style={{ fontSize: '0.72rem', color: '#8fa1bc' }}>
                  Showing all rows — apply an IP filter to narrow results
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#8fa1bc' }}>
                <strong style={{ color: cfg.color }}>{filteredRows.length.toLocaleString()}</strong>
                {localFilter ? ` / ${totalRows.toLocaleString()}` : ''} rows
              </span>
              <span style={{ fontSize: '0.72rem', color: '#8fa1bc' }}>
                {columns.length} columns
              </span>
              <button
                onClick={() => setShowAllColumns(s => !s)}
                style={{
                  marginLeft: 6, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                  background: showAllColumns ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: '1px solid rgba(130,155,190,0.12)', color: '#dce6f5', fontSize: '0.75rem'
                }}
              >
                {showAllColumns ? 'Curated columns' : 'Show all columns'}
              </button>
            </div>
          </div>

          {/* Local search */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(130,155,190,0.15)',
              borderRadius: 8, padding: '6px 12px'
            }}>
              <span style={{ color: '#8fa1bc', fontSize: '0.85rem' }}>🔎</span>
              <input
                type="text"
                placeholder="Search within these rows…"
                value={localFilter}
                onChange={e => { setLocalFilter(e.target.value); setPage(0); }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#e7eefb', fontSize: '0.85rem', fontFamily: 'inherit'
                }}
              />
              {localFilter && (
                <button
                  onClick={() => { setLocalFilter(''); setPage(0); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8fa1bc', fontSize: '1rem', padding: 0, lineHeight: 1 }}
                >✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Table area */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 16px 12px' }}>
          {loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8fa1bc', fontSize: '0.9rem' }}>
              Loading raw logs from {cfg.label}…
            </div>
          )}

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,93,115,0.08)', border: '1px solid rgba(255,93,115,0.25)', color: '#ff5d73', fontSize: '0.85rem' }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && isUploaded === false && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: '2rem' }}>📂</span>
              <span style={{ color: '#8fa1bc', fontSize: '0.9rem', textAlign: 'center' }}>
                No uploaded data for <strong style={{ color: cfg.color }}>{cfg.label}</strong>
              </span>
              <span style={{ color: '#6b7a99', fontSize: '0.8rem', textAlign: 'center' }}>
                Use <strong style={{ color: '#dce6f5' }}>↑ Upload CSV</strong> in the top bar to load your own logs for this vendor.
              </span>
            </div>
          )}

          {!loading && !error && isUploaded === true && columns.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8fa1bc', fontSize: '0.9rem' }}>
              No rows found{ipFromQuery ? ` for IP ${ipFromQuery}` : ''} in {cfg.label}
            </div>
          )}

          {!loading && !error && isUploaded === true && columns.length > 0 && (
            <>
              <div className="table-shell" style={{ flex: 1, minHeight: 0 }}>
                <table className="data-table" style={{ fontSize: '0.76rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36, textAlign: 'center', color: '#8fa1bc' }}>#</th>
                      {columns.map(col => (
                        <th key={col} style={{
                          color: isSensitiveColumn(col) ? '#8fa1bc' : cfg.color,
                          whiteSpace: 'nowrap', fontSize: '0.7rem', letterSpacing: '0.03em'
                        }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: 'center', color: '#6b7a99', fontSize: '0.7rem' }}>
                          {page * PAGE_SIZE + i + 1}
                        </td>
                        {columns.map(col => {
                          const val = row[col] ?? '';
                          const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(val);
                          const isRisk = col.toLowerCase().includes('risk') || col.toLowerCase().includes('score');
                          const isTimestamp = col.toLowerCase().includes('time') || col.toLowerCase().includes('start') || col.toLowerCase().includes('end');
                          const numVal = isRisk ? Number(val) : NaN;

                          return (
                            <td key={col} style={{
                              fontFamily: (isIp || col.toLowerCase().includes('mac') || col.toLowerCase().includes('port')) ? 'monospace' : 'inherit',
                              color: isIp ? '#4cc9f0'
                                : isTimestamp ? '#8fa1bc'
                                : isSensitiveColumn(col) ? '#6b7a99'
                                : '#dce6f5',
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {isRisk && !isNaN(numVal) ? (
                                <span style={{
                                  fontWeight: 700,
                                  color: numVal >= 80 ? '#ff5d73' : numVal >= 50 ? '#ffb84d' : '#6ee7b7'
                                }}>{val}</span>
                              ) : (
                                fmtCellValue(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: 8, flexShrink: 0, gap: 10
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#8fa1bc' }}>
                    Page {page + 1} of {totalPages} · rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      disabled={page === 0}
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: '0.8rem', cursor: page === 0 ? 'not-allowed' : 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(130,155,190,0.2)',
                        color: page === 0 ? '#6b7a99' : '#dce6f5'
                      }}
                    >← Prev</button>
                    <button
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: '0.8rem', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(130,155,190,0.2)',
                        color: page >= totalPages - 1 ? '#6b7a99' : '#dce6f5'
                      }}
                    >Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
