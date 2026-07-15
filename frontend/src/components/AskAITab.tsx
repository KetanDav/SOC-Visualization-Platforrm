import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { renderMarkdown } from '../lib/markdown';

type Provider = 'ollama' | 'gemini';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  durationMs?: number;
  error?: boolean;
}

interface AskAITabProps {
  flows: Flow[];
  events: EventRecord[];
  alerts: AlertRecord[];
  assets: Asset[];
}

const providers: { id: Provider; icon: string; name: string; sub: string; color: string }[] = [
  { id: 'gemini', icon: '✦', name: 'Gemini', sub: 'Google Cloud · fast', color: '#34d399' },
  { id: 'ollama', icon: '🖥', name: 'Local LLM', sub: 'Ollama · private', color: '#818cf8' },
];

const SUGGESTED: string[] = [
  'Which IP has the highest risk score?',
  'Summarize the top alerts in this dataset',
  'What protocols are most active?',
  'Are there any signs of lateral movement?',
  'List all unique external IPs',
  'What events involve credential access?',
];

function val(v: string | number | undefined | null): string {
  return (v === undefined || v === null || v === '') ? '-' : String(v);
}

function rawFields(raw: Record<string, string>): string {
  const entries = Object.entries(raw).filter(([, v]) => v && v.trim());
  if (!entries.length) return '';
  return '    RAW: ' + entries.map(([k, v]) => `${k}=${v}`).join(' | ');
}

function buildContext(flows: Flow[], events: EventRecord[], alerts: AlertRecord[], assets: Asset[]): string {
  const fmtBytes = (n: number) => n >= 1_048_576 ? (n / 1_048_576).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';

  // Assets: send ALL of them with every field — this is the network topology / NAC data
  const assetLines = assets.map(a => [
    `  IP: ${a.ip}`,
    `    hostname:${val(a.hostname)} | mac:${val(a.mac)} | country:${val(a.country)} | asn:${val(a.asn)}`,
    `    username:${val(a.username)} | deviceType:${val(a.deviceType)} | vendors:${a.sourceVendor.join(',')}`,
    `    switchIp:${val(a.switchIp)} | switchPort:${val(a.switchPort)} | switchPortType:${val(a.switchPortType)} | vlan:${val(a.vlan)}`,
    `    securityGroup:${val(a.securityGroup)} | policySet:${val(a.policySet)} | authRule:${val(a.authRule)}`,
    `    postureStatus:${val(a.postureStatus)} | endpointProfile:${val(a.endpointProfile)} | auditSession:${val(a.auditSessionId)}`,
    `    riskScore:${val(a.riskScore)} | volume:${fmtBytes(a.communicationVolume)}`,
  ].join('\n'));

  // Flows: up to 100 by risk, including raw
  const topFlows = [...flows].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).slice(0, 100);
  const flowLines = topFlows.map(f => {
    const raw = rawFields(f.raw);
    return [
      `  ${f.timestamp} | ${f.src_ip}:${val(f.src_port)} → ${f.dst_ip}:${val(f.dst_port)}`,
      `    proto:${val(f.protocol)} | app:${val(f.application)} | ${fmtBytes(f.bytes)} | pkts:${f.packets} | dir:${val(f.direction)} | risk:${val(f.risk_score)}`,
      f.sni ? `    sni:${f.sni}` : '',
      f.dns_query ? `    dns:${f.dns_query}` : '',
      f.ja3 ? `    ja3:${f.ja3}` : '',
      raw,
    ].filter(Boolean).join('\n');
  });

  // Events: up to 100 by severity, including raw
  const sevRank = (s?: string) => s?.toLowerCase() === 'critical' ? 4 : s?.toLowerCase() === 'high' ? 3 : s?.toLowerCase() === 'medium' ? 2 : 1;
  const topEvents = [...events].sort((a, b) => sevRank(b.severity) - sevRank(a.severity)).slice(0, 100);
  const eventLines = topEvents.map(e => {
    const raw = rawFields(e.raw);
    return [
      `  ${e.timestamp} | [${val(e.severity)}] ${e.event_name}`,
      `    src:${val(e.src_ip)} → dst:${val(e.dst_ip)} | user:${val(e.username)} | cat:${val(e.category)}`,
      e.domain ? `    domain:${e.domain}` : '',
      e.url ? `    url:${e.url}` : '',
      e.process_name ? `    process:${e.process_name}` : '',
      e.filename ? `    file:${e.filename}` : '',
      e.raw_event ? `    raw_event:${e.raw_event}` : '',
      raw,
    ].filter(Boolean).join('\n');
  });

  // Alerts: up to 100 by risk, including raw
  const topAlerts = [...alerts].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).slice(0, 100);
  const alertLines = topAlerts.map(a => {
    const raw = rawFields(a.raw);
    return [
      `  ${a.timestamp} | [${val(a.severity)}] ${a.alert_name}`,
      `    src:${val(a.src_ip)} → dst:${val(a.dst_ip)} | risk:${val(a.risk_score)} | anomaly:${val(a.anomaly_score)}`,
      a.ioc_match && a.ioc_match !== 'no' ? `    ioc:${a.ioc_match}` : '',
      a.malware_family ? `    malware:${a.malware_family}` : '',
      raw,
    ].filter(Boolean).join('\n');
  });

  return [
    `=== SOC TELEMETRY SNAPSHOT ===`,
    `Totals: ${flows.length} flows, ${events.length} events, ${alerts.length} alerts, ${assets.length} assets`,
    ``,
    `--- ASSETS (ALL ${assets.length} — includes switch/port/VLAN/NAC details) ---`,
    assetLines.join('\n\n') || '  (none)',
    ``,
    `--- FLOWS (top ${topFlows.length} of ${flows.length} by risk) ---`,
    flowLines.join('\n\n') || '  (none)',
    ``,
    `--- EVENTS (top ${topEvents.length} of ${events.length} by severity) ---`,
    eventLines.join('\n\n') || '  (none)',
    ``,
    `--- ALERTS (top ${topAlerts.length} of ${alerts.length} by risk) ---`,
    alertLines.join('\n\n') || '  (none)',
  ].join('\n');
}

function ProviderPicker({ anchorRef, current, onPick, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  current: Provider;
  onPick: (p: Provider) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorRef, onClose]);

  if (!pos) return null;
  return createPortal(
    <div ref={ref} style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999,
      width: 220, borderRadius: 12,
      background: 'rgba(10,16,30,0.98)',
      border: '1px solid rgba(130,155,190,0.2)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(20px)',
      overflow: 'hidden',
    }}>
      {providers.map((p, i) => (
        <button key={p.id} onClick={() => { onPick(p.id); onClose(); }} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: p.id === current ? `${p.color}12` : 'transparent',
          border: 'none',
          borderTop: i > 0 ? '1px solid rgba(130,155,190,0.08)' : 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
          onMouseEnter={e => { if (p.id !== current) e.currentTarget.style.background = `${p.color}0c`; }}
          onMouseLeave={e => { if (p.id !== current) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: '1rem', width: 24, textAlign: 'center' }}>{p.icon}</span>
          <span>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: p.id === current ? p.color : '#dce6f5' }}>{p.name}</div>
            <div style={{ fontSize: '0.68rem', color: '#4b6080' }}>{p.sub}</div>
          </span>
          {p.id === current && <span style={{ marginLeft: 'auto', color: p.color, fontSize: '0.7rem' }}>✓</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function AskAITab({ flows, events, alerts, assets }: AskAITabProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('askai-messages');
      return saved ? (JSON.parse(saved) as Message[]) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>(() => {
    try {
      const saved = localStorage.getItem('askai-provider');
      return (saved === 'ollama' || saved === 'gemini') ? saved : 'gemini';
    } catch { return 'gemini'; }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const providerBtnRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeProv = providers.find(p => p.id === provider)!;

  // Persist messages and provider to localStorage
  useEffect(() => {
    try { localStorage.setItem('askai-messages', JSON.stringify(messages)); } catch { /* quota */ }
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem('askai-provider', provider); } catch { /* quota */ }
  }, [provider]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (question: string) => {
    if (!question.trim() || loading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: question.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const context = buildContext(flows, events, alerts, assets);
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), context, provider }),
        signal: abortRef.current.signal,
      });
      const rawText = await res.text();
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json') || rawText.trim().startsWith('<')) {
        throw new Error(`Backend server returned an HTML/non-JSON response (status ${res.status}). Ensure the backend server on port 3001 is running and your API keys are configured.`);
      }
      const data = JSON.parse(rawText) as { ok: boolean; answer?: string; model?: string; durationMs?: number; message?: string };
      if (!data.ok || !data.answer) throw new Error(data.message ?? 'No answer returned');
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer!,
        model: data.model,
        durationMs: data.durationMs,
      }]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Request failed',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendQuestion(input); }
  };

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', padding: '0 4px' }}>
      <style>{`
        @keyframes msgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes typingPulse { 0%,80%,100% { opacity:0.3; transform:scale(0.8); } 40% { opacity:1; transform:scale(1); } }
        .ask-msg { animation: msgIn 0.22s ease both; }
      `}</style>

      <section className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Header */}
        <div className="panel-header compact" style={{ flexShrink: 0, borderBottom: '1px solid rgba(130,155,190,0.08)', paddingBottom: 10 }}>
          <div>
            <p className="panel-kicker">Natural Language</p>
            <h2>Ask AI</h2>
          </div>
          <p className="panel-note" style={{ margin: 0 }}>
            Ask questions about the current telemetry in plain English. Context is built from the active filtered dataset.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} style={{
                padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(130,155,190,0.15)',
                background: 'transparent', color: '#5a6f8a', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}>Clear chat</button>
            )}
            <button ref={providerBtnRef} onClick={() => setPickerOpen(o => !o)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '5px 12px', borderRadius: 7,
              border: `1px solid ${activeProv.color}44`,
              background: `${activeProv.color}0c`,
              color: activeProv.color, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
            }}>
              <span>{activeProv.icon}</span>
              {activeProv.name}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.6 }}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {pickerOpen && (
              <ProviderPicker
                anchorRef={providerBtnRef}
                current={provider}
                onPick={(p) => setProvider(p)}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12,
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(130,155,190,0.2) transparent' }}>

          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <div style={{ fontSize: '2.4rem', opacity: 0.25 }}>✦</div>
              <div style={{ color: '#4b6080', fontSize: '0.85rem', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
                Ask anything about the current telemetry — top threats, suspicious IPs, protocol patterns, event summaries.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', maxWidth: 560 }}>
                {SUGGESTED.map(q => (
                  <button key={q} onClick={() => void sendQuestion(q)} style={{
                    padding: '6px 13px', borderRadius: 99, fontSize: '0.76rem', fontWeight: 500,
                    border: '1px solid rgba(130,155,190,0.15)', background: 'rgba(255,255,255,0.03)',
                    color: '#8fa1bc', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${activeProv.color}55`; e.currentTarget.style.color = activeProv.color; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(130,155,190,0.15)'; e.currentTarget.style.color = '#8fa1bc'; }}
                  >{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className="ask-msg" style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              gap: 10, alignItems: 'flex-start',
            }}>
              {/* Avatar */}
              <div style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: msg.role === 'user' ? '0.75rem' : '0.9rem',
                background: msg.role === 'user' ? 'rgba(76,201,240,0.12)' : `${activeProv.color}12`,
                border: `1px solid ${msg.role === 'user' ? 'rgba(76,201,240,0.25)' : `${activeProv.color}30`}`,
                color: msg.role === 'user' ? '#4cc9f0' : activeProv.color,
              }}>
                {msg.role === 'user' ? '›' : activeProv.icon}
              </div>

              {/* Bubble */}
              <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{
                  padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: msg.role === 'user'
                    ? 'rgba(76,201,240,0.08)'
                    : msg.error ? 'rgba(248,113,113,0.07)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(76,201,240,0.15)' : msg.error ? 'rgba(248,113,113,0.2)' : 'rgba(130,155,190,0.1)'}`,
                  color: msg.error ? '#fca5a5' : '#dce6f5',
                  fontSize: '0.87rem', lineHeight: 1.65,
                  whiteSpace: msg.role === 'assistant' && !msg.error ? 'normal' : 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.role === 'assistant' && !msg.error ? renderMarkdown(msg.content) : msg.content}
                </div>
                {msg.role === 'assistant' && (msg.model || msg.durationMs) && (
                  <div style={{ fontSize: '0.65rem', color: '#3a4f68', paddingLeft: 4 }}>
                    {msg.model && <span>{msg.model}</span>}
                    {msg.model && msg.durationMs && <span> · </span>}
                    {msg.durationMs && <span>{(msg.durationMs / 1000).toFixed(1)}s</span>}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="ask-msg" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
                background: `${activeProv.color}12`, border: `1px solid ${activeProv.color}30`, color: activeProv.color,
              }}>{activeProv.icon}</div>
              <div style={{
                padding: '12px 16px', borderRadius: '4px 14px 14px 14px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(130,155,190,0.1)',
                display: 'flex', gap: 5, alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: activeProv.color,
                    display: 'inline-block',
                    animation: `typingPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          flexShrink: 0, padding: '10px 16px 12px',
          borderTop: '1px solid rgba(130,155,190,0.08)',
        }}>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(130,155,190,0.15)',
            borderRadius: 12, padding: '8px 8px 8px 14px',
            transition: 'border-color 0.15s',
          }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = `${activeProv.color}44`)}
            onBlurCapture={e => (e.currentTarget.style.borderColor = 'rgba(130,155,190,0.15)')}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the telemetry… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#e7eefb', fontSize: '0.87rem', fontFamily: 'inherit',
                resize: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
            <button
              disabled={!input.trim() || loading}
              onClick={() => void sendQuestion(input)}
              style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: 8,
                border: 'none',
                background: !input.trim() || loading ? 'rgba(130,155,190,0.08)' : activeProv.color,
                color: !input.trim() || loading ? '#3a4f68' : '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', fontSize: '0.9rem',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#2d3f58', marginTop: 5, paddingLeft: 2 }}>
            Context: {flows.length} flows · {events.length} events · {alerts.length} alerts · {assets.length} assets
          </div>
        </div>
      </section>
    </main>
  );
}
