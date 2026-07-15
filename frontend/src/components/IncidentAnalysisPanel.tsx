import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { IncidentAnalysisResponse, IncidentAnalysisTarget } from '@soc/telemetry-shared';

type Provider = 'ollama' | 'gemini';

interface IncidentAnalysisPanelProps {
    target: IncidentAnalysisTarget | null;
    response: IncidentAnalysisResponse | null;
    loading: boolean;
    error: string | null;
    onAnalyze: (provider: Provider) => void;
    onClear: () => void;
}

const severityColors: Record<string, { primary: string; glow: string }> = {
    informational: { primary: '#8fa1bc', glow: 'rgba(143,161,188,0.12)' },
    low:           { primary: '#34d399', glow: 'rgba(52,211,153,0.12)' },
    medium:        { primary: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
    high:          { primary: '#f87171', glow: 'rgba(248,113,113,0.15)' },
    critical:      { primary: '#ff5d73', glow: 'rgba(255,93,115,0.18)' },
};

const providers: { id: Provider; icon: string; name: string; sub: string; color: string; glow: string }[] = [
    {
        id: 'ollama',
        icon: '🖥',
        name: 'Local LLM',
        sub: 'qwen3:4b · Private · ~30s',
        color: '#818cf8',
        glow: 'rgba(129,140,248,0.18)',
    },
    {
        id: 'gemini',
        icon: '✦',
        name: 'Gemini 2.0 Flash',
        sub: 'Google Cloud AI · ~2s',
        color: '#34d399',
        glow: 'rgba(52,211,153,0.18)',
    },
];

function ConfidenceBar({ value, color }: { value: number; color: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.63rem', color: '#6b82a0', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>Confidence</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color }}>{Math.round(value)}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(130,155,190,0.1)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${value}%`,
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${color}77, ${color})`,
                    transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
                }} />
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(130,155,190,0.08)' }}>
            <div style={{ fontSize: '0.62rem', color: '#6b82a0', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>{label}</div>
            <div style={{ marginTop: 6, fontSize: '0.89rem', fontWeight: 800, color: color ?? '#dce6f5', textTransform: 'capitalize' }}>{value}</div>
        </div>
    );
}

function Section({ title, items, icon }: { title: string; items: string[]; icon: string }) {
    if (!items.length) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.78rem' }}>{icon}</span>
                <span style={{ fontSize: '0.63rem', color: '#6b82a0', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>{title}</span>
            </div>
            {items.map((item, i) => (
                <div key={i} style={{
                    display: 'flex', gap: 9, alignItems: 'flex-start',
                    padding: '8px 11px', borderRadius: 9,
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(130,155,190,0.07)',
                    fontSize: '0.82rem', color: '#c8d8ee', lineHeight: 1.55,
                }}>
                    <span style={{ color: '#3d5470', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>›</span>
                    {item}
                </div>
            ))}
        </div>
    );
}

function EntityChip({ type, value, role }: { type: string; value: string; role: string }) {
    const cols: Record<string, string> = {
        ip: '#60a5fa', host: '#a78bfa', user: '#34d399',
        domain: '#fbbf24', alert: '#f87171', process: '#fb923c',
        protocol: '#38bdf8', ioc: '#f472b6',
    };
    const c = cols[type] ?? '#8fa1bc';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 99,
            background: `${c}0e`, border: `1px solid ${c}2e`,
            fontSize: '0.76rem',
        }}>
            <span style={{ fontSize: '0.62rem', color: c, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{type}</span>
            <span style={{ color: '#dce6f5', fontWeight: 600 }}>{value}</span>
            {role && <span style={{ color: '#4b6080' }}>· {role}</span>}
        </span>
    );
}

/* ── Provider Picker Popover (portal — escapes overflow:hidden) ──── */
function ProviderPicker({
    anchorRef,
    onPick,
    onClose,
}: {
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    onPick: (p: Provider) => void;
    onClose: () => void;
}) {
    const pickerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

    // Position below the button
    useEffect(() => {
        if (anchorRef.current) {
            const r = anchorRef.current.getBoundingClientRect();
            setPos({
                top: r.bottom + 8,
                right: window.innerWidth - r.right,
            });
        }
    }, [anchorRef]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(e.target as Node)
            ) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [anchorRef, onClose]);

    if (!pos) return null;

    return createPortal(
        <div
            ref={pickerRef}
            style={{
                position: 'fixed',
                top: pos.top,
                right: pos.right,
                zIndex: 99999,
                width: 280,
                borderRadius: 14,
                background: 'rgba(10,16,30,0.98)',
                border: '1px solid rgba(130,155,190,0.2)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
                animation: 'pickerIn 0.16s cubic-bezier(0.34,1.56,0.64,1)',
            }}
        >
            <div style={{
                padding: '10px 14px 8px',
                fontSize: '0.67rem', color: '#4b6080',
                textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
            }}>
                Choose AI provider
            </div>
            {providers.map((p, i) => (
                <button
                    key={p.id}
                    type="button"
                    id={`pick-provider-${p.id}`}
                    onClick={() => { onPick(p.id); onClose(); }}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderTop: i === 0 ? '1px solid rgba(130,155,190,0.08)' : 'none',
                        borderBottom: '1px solid rgba(130,155,190,0.08)',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = p.glow)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <span style={{
                        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${p.color}10`, border: `1px solid ${p.color}30`,
                        fontSize: '1.15rem',
                    }}>{p.icon}</span>
                    <span style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: p.color }}>{p.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#4b6080', marginTop: 2 }}>{p.sub}</div>
                    </span>
                    <span style={{ color: '#2d3f58', fontSize: '1rem', marginRight: 2 }}>›</span>
                </button>
            ))}
        </div>,
        document.body,
    );
}

/* ── Main Panel ─────────────────────────────────────────────────── */
export function IncidentAnalysisPanel({ target, response, loading, error, onAnalyze, onClear }: IncidentAnalysisPanelProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [activeProvider, setActiveProvider] = useState<(typeof providers)[0] | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    if (!target && !response && !error && !loading) return null;

    const analysis = response?.analysis ?? null;
    const fallbackMessage = response?.fallbackMessage ?? error;
    const confidence = analysis ? Math.max(0, Math.min(100, analysis.confidence)) : null;
    const severity = analysis?.severity ?? 'informational';
    const { primary: sevColor, glow: sevGlow } = severityColors[severity] ?? severityColors.informational;

    const handlePick = (id: Provider) => {
        const p = providers.find(x => x.id === id)!;
        setActiveProvider(p);
        onAnalyze(id);
    };

    return (
        <>
            <style>{`
                @keyframes pickerIn {
                    from { opacity:0; transform:translateY(-6px) scale(0.97); }
                    to   { opacity:1; transform:translateY(0) scale(1); }
                }
                @keyframes spin { to { transform:rotate(360deg); } }
                @keyframes fadeUp {
                    from { opacity:0; transform:translateY(10px); }
                    to   { opacity:1; transform:translateY(0); }
                }
                @keyframes progressShimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
                .analysis-result {
                    animation: fadeUp 0.3s ease both;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(130,155,190,0.22) transparent;
                }
                .analysis-result::-webkit-scrollbar { width: 6px; }
                .analysis-result::-webkit-scrollbar-track { background: transparent; }
                .analysis-result::-webkit-scrollbar-thumb { background: rgba(130,155,190,0.22); border-radius: 6px; }
            `}</style>

            <section className="panel" style={{
                marginTop: 2, marginBottom: 2,
                borderColor: analysis ? `${sevColor}33` : 'rgba(130,155,190,0.1)',
                boxShadow: analysis ? `0 0 28px ${sevGlow}` : 'none',
                transition: 'box-shadow 0.4s ease, border-color 0.4s ease',
            }}>

                {/* ── Header ─────────────────────────────────────── */}
                <div className="panel-header compact" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                        <p className="panel-kicker" style={{ marginBottom: 2 }}>AI Incident Analysis</p>
                        <h2 style={{ margin: 0 }}>
                            {target?.label ?? target?.ip ?? target?.alertId ?? 'Selected incident'}
                        </h2>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Severity badge when result available */}
                        {analysis && (
                            <span style={{
                                padding: '4px 11px', borderRadius: 99,
                                border: `1px solid ${sevColor}44`, background: `${sevColor}12`,
                                color: sevColor, fontSize: '0.71rem', fontWeight: 700,
                                letterSpacing: '0.05em', textTransform: 'uppercase',
                            }}>
                                {severity}
                            </span>
                        )}

                        {/* Analyze button + popover */}
                        <div style={{ position: 'relative' }}>
                            <button
                                ref={btnRef}
                                id="analyze-btn"
                                type="button"
                                disabled={loading}
                                onClick={() => !loading && setPickerOpen(o => !o)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '9px 20px', borderRadius: 10,
                                    border: loading
                                        ? '1.5px solid rgba(130,155,190,0.2)'
                                        : '1.5px solid rgba(130,155,190,0.3)',
                                    background: loading
                                        ? 'rgba(255,255,255,0.04)'
                                        : 'linear-gradient(135deg,rgba(130,155,190,0.12),rgba(255,255,255,0.05))',
                                    color: loading ? '#6b82a0' : '#dce6f5',
                                    fontSize: '0.85rem', fontWeight: 700,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: loading ? 'none' : '0 2px 12px rgba(0,0,0,0.25)',
                                    letterSpacing: '0.01em',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {/* Spark icon */}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                </svg>
                                Analyze
                                {/* Dropdown caret */}
                                {!loading && (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}>
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                )}
                            </button>

                            {pickerOpen && !loading && (
                                <ProviderPicker
                                    anchorRef={btnRef}
                                    onPick={handlePick}
                                    onClose={() => setPickerOpen(false)}
                                />
                            )}
                        </div>

                        {/* Clear button */}
                        <button
                            id="clear-analysis-btn"
                            type="button"
                            onClick={onClear}
                            style={{
                                padding: '9px 14px', borderRadius: 10,
                                border: '1px solid rgba(130,155,190,0.13)',
                                background: 'transparent',
                                color: '#5a6f8a', fontSize: '0.82rem', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.2s ease',
                            }}
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* ── Loading state ─────────────────────────────── */}
                {loading && (
                    <div style={{
                        margin: '0 16px 16px',
                        padding: '16px 18px',
                        borderRadius: 12,
                        background: activeProvider
                            ? `linear-gradient(135deg, ${activeProvider.glow}, rgba(255,255,255,0.02))`
                            : 'rgba(255,255,255,0.03)',
                        border: activeProvider
                            ? `1px solid ${activeProvider.color}28`
                            : '1px solid rgba(130,155,190,0.1)',
                        display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                        <span style={{
                            flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                            border: `2.5px solid ${activeProvider ? activeProvider.color : '#818cf8'}22`,
                            borderTopColor: activeProvider ? activeProvider.color : '#818cf8',
                            animation: 'spin 0.9s linear infinite',
                            display: 'inline-block',
                        }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.87rem', fontWeight: 700, color: activeProvider ? activeProvider.color : '#818cf8' }}>
                                {activeProvider ? `${activeProvider.icon} Analyzing with ${activeProvider.name}…` : 'Preparing analysis…'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#5a6f8a', marginTop: 3 }}>
                                {activeProvider?.id === 'gemini'
                                    ? 'Waiting for Gemini API — usually 3–5s.'
                                    : 'Local inference in progress — usually 30–60s on CPU.'}
                            </div>
                            <div style={{ marginTop: 10, height: 3, borderRadius: 99, background: 'rgba(130,155,190,0.1)', overflow: 'hidden', position: 'relative' }}>
                                <div style={{
                                    height: '100%', width: '40%', borderRadius: 99,
                                    background: `linear-gradient(90deg, transparent, ${activeProvider ? activeProvider.color : '#818cf8'}, transparent)`,
                                    animation: 'progressShimmer 1.8s ease-in-out infinite',
                                }} />
                            </div>
                        </div>
                        <button type="button" onClick={onClear} style={{
                            flexShrink: 0, padding: '6px 12px', borderRadius: 8,
                            border: '1px solid rgba(130,155,190,0.15)', background: 'rgba(255,255,255,0.03)',
                            color: '#5a6f8a', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        }}>Cancel</button>
                    </div>
                )}

                {/* ── Error / fallback ──────────────────────────── */}
                {fallbackMessage && !loading && (
                    <div style={{
                        margin: '0 16px 14px',
                        padding: '11px 14px', borderRadius: 11,
                        background: 'rgba(248,113,113,0.07)',
                        border: '1px solid rgba(248,113,113,0.18)',
                        color: '#fca5a5', fontSize: '0.83rem', lineHeight: 1.6,
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                        <span style={{ marginTop: 1 }}>⚠️</span>
                        {fallbackMessage}
                    </div>
                )}

                {/* ── Results ───────────────────────────────────── */}
                {analysis && (
                    <div className="analysis-result" style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '62vh', overflowY: 'auto', overflowX: 'hidden' }}>

                        {/* Summary + stats row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 164px', gap: 12, alignItems: 'start' }}>
                            <div style={{
                                padding: '14px 16px', borderRadius: 12,
                                background: `linear-gradient(135deg, ${sevGlow}, rgba(255,255,255,0.02))`,
                                border: `1px solid ${sevColor}20`,
                            }}>
                                <div style={{ fontSize: '0.63rem', color: '#6b82a0', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, marginBottom: 8 }}>
                                    Incident Summary
                                </div>
                                <div style={{ color: '#e7eefb', fontSize: '0.9rem', lineHeight: 1.7 }}>
                                    {analysis.incidentSummary}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: `1px solid ${sevColor}20` }}>
                                    <div style={{ fontSize: '0.62rem', color: '#6b82a0', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>Severity</div>
                                    <div style={{ marginTop: 6, fontSize: '1rem', fontWeight: 800, color: sevColor, textTransform: 'capitalize' }}>{severity}</div>
                                </div>
                                {confidence != null && (
                                    <div style={{ padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(130,155,190,0.08)' }}>
                                        <ConfidenceBar value={confidence} color={sevColor} />
                                    </div>
                                )}
                                <StatCard label="Stage" value={analysis.likelyStage} />
                                <StatCard label="Model" value={response?.model ?? '—'} />
                            </div>
                        </div>

                        {/* Findings + entities grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Section title="Key Findings" icon="🔍" items={analysis.keyFindings} />
                                <Section title="Supporting Evidence" icon="📋" items={analysis.supportingEvidence} />
                                <Section title="Recommended Next Steps" icon="🛡" items={analysis.recommendedNextSteps} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {/* Entities */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                        <span style={{ fontSize: '0.78rem' }}>🎯</span>
                                        <span style={{ fontSize: '0.63rem', color: '#6b82a0', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700 }}>Affected Entities</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {analysis.affectedEntities.length === 0
                                            ? <span style={{ color: '#4b6080', fontSize: '0.82rem' }}>None identified</span>
                                            : analysis.affectedEntities.map((e, i) => (
                                                <EntityChip key={i} type={e.type} value={e.value} role={e.role} />
                                            ))
                                        }
                                    </div>
                                </div>
                                <Section title="IOC Candidates" icon="⚡" items={analysis.iocCandidates} />
                                <Section title="Evidence Gaps" icon="🔓" items={analysis.evidenceGaps} />
                                {analysis.analystNotes && (
                                    <div style={{ padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(130,155,190,0.07)' }}>
                                        <div style={{ fontSize: '0.62rem', color: '#6b82a0', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700, marginBottom: 7 }}>💬 Analyst Notes</div>
                                        <div style={{ color: '#b8cce0', fontSize: '0.83rem', lineHeight: 1.65, fontStyle: 'italic' }}>{analysis.analystNotes}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </>
    );
}
