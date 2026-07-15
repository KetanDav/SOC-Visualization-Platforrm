import { useState } from 'react';
import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { severityTone } from '../lib/telemetry';
import {
  generatePCRATReport, getRATScore, getRATTier,
  scoreColor, tierColor, tierLabel,
  MAJOR_VIOLATIONS, MINOR_VIOLATIONS,
} from '../lib/compliance';

interface DetailsPanelProps {
  selectedAsset: Asset | null;
  relatedFlows: Flow[];
  relatedEvents: EventRecord[];
  relatedAlerts: AlertRecord[];
  totalCount: number;
  onAnalyzeIncident: (target: { kind: 'ip' | 'alert'; ip?: string; alertId?: string; label?: string; query?: string }) => void;
}

const pill = (label: string, color: string) => (
  <span key={label} style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
    color, border: `1px solid ${color}44`, background: `${color}12`,
  }}>{label}</span>
);

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 60, padding: '8px 10px', borderRadius: 9,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(130,155,190,0.12)',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <span style={{ fontSize: '0.64rem', color: '#8fa1bc', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: color ?? '#e7eefb', lineHeight: 1 }}>{value}</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const color = severityTone(severity);
  return severity ? pill(severity.toUpperCase(), color) : null;
}

function MalwarePill({ family }: { family?: string }) {
  if (!family) return null;
  return pill(family, '#ff5d73');
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ff5d73', high: '#ffb84d', medium: '#ffd166', low: '#6ee7b7',
};

type ViolTab = 'major' | 'minor';

export function DetailsPanel({ selectedAsset, relatedFlows, relatedEvents, relatedAlerts, onAnalyzeIncident }: DetailsPanelProps) {
  const [violTab, setViolTab] = useState<ViolTab>('major');
  const [violOpen, setViolOpen] = useState(true);

  if (!selectedAsset) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '28px 18px', textAlign: 'center', color: '#8fa1bc',
      }}>
        <div style={{ fontSize: '2.5rem', opacity: 0.4 }}>🔍</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a8bbd4' }}>No asset selected</div>
        <div style={{ fontSize: '0.78rem', lineHeight: 1.6, maxWidth: 200 }}>
          Click a node in the graph to inspect its RAT violations, flows, events, and alerts.
        </div>
      </div>
    );
  }

  const rat = generatePCRATReport(selectedAsset.ip, selectedAsset);
  const score = getRATScore(rat);
  const tier = getRATTier(score);
  const sc = scoreColor(score);
  const tc = tierColor(tier);

  const highRiskFlows = relatedFlows.filter(f => (f.risk_score ?? 0) >= 65);
  const criticalAlerts = relatedAlerts.filter(a => (a.risk_score ?? 0) >= 80 || a.severity === 'critical');
  const malwareFamilies = [...new Set(relatedAlerts.flatMap(a => a.malware_family ? [a.malware_family] : []))];
  const iocAlerts = relatedAlerts.filter(a => a.ioc_match && a.ioc_match !== 'no');
  const totalBytes = relatedFlows.reduce((s, f) => s + f.bytes, 0);
  const protocols = [...new Set(relatedFlows.map(f => f.protocol).filter(Boolean))];
  const topRisk = relatedAlerts.reduce((m, a) => Math.max(m, a.risk_score ?? 0), 0);
  const riskColor = topRisk >= 85 ? '#ff5d73' : topRisk >= 65 ? '#ffb84d' : topRisk >= 40 ? '#4cc9f0' : '#6ee7b7';

  const activeViolations = violTab === 'major' ? rat.majorViolations : rat.minorViolations;
  const allViolations = violTab === 'major'
    ? (MAJOR_VIOLATIONS as readonly string[])
    : (MINOR_VIOLATIONS as readonly string[]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 0' }}>

      {/* Asset header */}
      <div style={{
        padding: '13px 15px', borderRadius: 13,
        background: 'linear-gradient(135deg,rgba(76,201,240,0.08),rgba(76,201,240,0.02))',
        border: '1px solid rgba(76,201,240,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#e7eefb', lineHeight: 1.2 }}>
              {selectedAsset.hostname ?? selectedAsset.ip}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#4cc9f0', fontFamily: 'monospace', marginTop: 3 }}>
              {selectedAsset.ip}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 9,
                border: '1px solid rgba(129,140,248,0.35)',
                background: 'rgba(129,140,248,0.1)',
                color: '#818cf8', fontSize: '0.8rem', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.01em',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(129,140,248,0.1)'; }}
              onClick={() => onAnalyzeIncident({
                kind: 'ip',
                ip: selectedAsset.ip,
                label: selectedAsset.hostname ?? selectedAsset.ip,
                query: `ip:=${selectedAsset.ip}`,
              })}
              title="AI Analyze this incident scope"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              AI Analyze
            </button>
            {topRisk > 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '5px 9px', borderRadius: 9, background: `${riskColor}15`, border: `1px solid ${riskColor}44`,
              }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: riskColor, lineHeight: 1 }}>{topRisk}</span>
                <span style={{ fontSize: '0.58rem', color: '#8fa1bc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>risk</span>
              </div>
            )}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '5px 9px', borderRadius: 9, background: `${sc}15`, border: `1px solid ${sc}44`, minWidth: 44,
            }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: sc, lineHeight: 1 }}>{score}</span>
              <span style={{ fontSize: '0.58rem', color: '#8fa1bc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>rat</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 9px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
            color: tc, border: `1px solid ${tc}44`, background: `${tc}12`,
          }}>
            {tier === 'blocked' ? '⛔' : tier === 'conditional' ? '⚠️' : '✅'} {tierLabel(tier)}
            {' '}&mdash; {rat.majorViolations.length}M / {rat.minorViolations.length}m violations
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {selectedAsset.country && pill(`🌍 ${selectedAsset.country}`, '#8fa1bc')}
          {selectedAsset.mac && pill(selectedAsset.mac, '#6b7a99')}
          {selectedAsset.username && pill(`👤 ${selectedAsset.username}`, '#a78bfa')}
          {selectedAsset.sourceVendor.map(v => pill(v, '#4cc9f0'))}
          {malwareFamilies.map(m => <MalwarePill key={m} family={m} />)}
          {iocAlerts.length > 0 && pill(`IOC ×${iocAlerts.length}`, '#ff5d73')}
        </div>
      </div>

      {/* Network / NAC details */}
      <div style={{ padding: '10px 12px', borderRadius: 11, border: '1px solid rgba(130,155,190,0.08)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontSize: '0.72rem', color: '#8fa1bc', marginBottom: 8, fontWeight: 700 }}>Network / NAC</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selectedAsset.vlan && <div style={{ fontSize: '0.82rem', color: '#dce6f5' }}>VLAN: <strong style={{ color: '#4cc9f0' }}>{selectedAsset.vlan}</strong></div>}
          {selectedAsset.switchIp && <div style={{ fontSize: '0.82rem', color: '#dce6f5' }}>Switch: <strong style={{ color: '#4cc9f0' }}>{selectedAsset.switchIp}</strong></div>}
          {selectedAsset.switchPort && <div style={{ fontSize: '0.82rem', color: '#dce6f5' }}>Port: <strong style={{ color: '#dce6f5' }}>{selectedAsset.switchPort}</strong></div>}
          {selectedAsset.switchPortType && <div style={{ fontSize: '0.82rem', color: '#8fa1bc' }}>Port Type: {selectedAsset.switchPortType}</div>}
          {selectedAsset.securityGroup && <div style={{ fontSize: '0.82rem', color: '#dce6f5' }}>Group: <strong style={{ color: '#ffb84d' }}>{selectedAsset.securityGroup}</strong></div>}
          {selectedAsset.policySet && <div style={{ fontSize: '0.82rem', color: '#8fa1bc' }}>Policy: {selectedAsset.policySet}</div>}
          {selectedAsset.authRule && <div style={{ fontSize: '0.82rem', color: '#8fa1bc' }}>Auth Rule: {selectedAsset.authRule}</div>}
          {selectedAsset.postureStatus && <div style={{ fontSize: '0.82rem', color: '#8fa1bc' }}>Posture: {selectedAsset.postureStatus}</div>}
          {selectedAsset.endpointProfile && <div style={{ fontSize: '0.82rem', color: '#8fa1bc' }}>Profile: {selectedAsset.endpointProfile}</div>}
          {selectedAsset.auditSessionId && <div style={{ fontSize: '0.82rem', color: '#8fa1bc' }}>Session: {selectedAsset.auditSessionId}</div>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <StatBox label="Flows" value={relatedFlows.length} />
        <StatBox label="Events" value={relatedEvents.length} />
        <StatBox label="Alerts" value={relatedAlerts.length} color={relatedAlerts.length > 0 ? '#ff5d73' : undefined} />
        <StatBox label="Volume" value={totalBytes >= 1_048_576 ? `${(totalBytes / 1_048_576).toFixed(1)}MB` : `${(totalBytes / 1024).toFixed(0)}KB`} />
      </div>

      {/* RAT Violations */}
      <div style={{
        borderRadius: 11, overflow: 'hidden',
        border: `1px solid ${rat.majorViolations.length > 0 ? 'rgba(255,93,115,0.2)' : 'rgba(110,231,183,0.2)'}`,
        background: rat.majorViolations.length > 0 ? 'rgba(255,93,115,0.03)' : 'rgba(110,231,183,0.03)',
      }}>
        <button
          onClick={() => setViolOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 11px', background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: violOpen ? '1px solid rgba(130,155,190,0.1)' : 'none',
          }}
        >
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, color: '#ff5d73', display: 'flex', alignItems: 'center', gap: 6 }}>
            🛡️ RAT Violations
            {rat.majorViolations.length > 0 && (
              <span style={{ padding: '1px 5px', borderRadius: 999, background: 'rgba(255,93,115,0.2)', color: '#ff5d73', fontSize: '0.65rem' }}>
                {rat.majorViolations.length} MAJOR
              </span>
            )}
          </span>
          <span style={{ color: '#8fa1bc', fontSize: '0.8rem' }}>{violOpen ? '▲' : '▼'}</span>
        </button>

        {violOpen && (
          <>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(130,155,190,0.08)' }}>
              {(['major', 'minor'] as ViolTab[]).map(v => (
                <button
                  key={v}
                  onClick={() => setViolTab(v)}
                  style={{
                    flex: 1, padding: '6px 4px', background: 'transparent', cursor: 'pointer',
                    border: 'none', borderBottom: violTab === v ? `2px solid ${v === 'major' ? '#ff5d73' : '#ffb84d'}` : '2px solid transparent',
                    fontSize: '0.72rem', fontWeight: violTab === v ? 700 : 500,
                    color: violTab === v ? (v === 'major' ? '#ff5d73' : '#ffb84d') : '#8fa1bc',
                  }}
                >
                  {v === 'major' ? `Major (${rat.majorViolations.length})` : `Minor (${rat.minorViolations.length})`}
                </button>
              ))}
            </div>

            <div style={{ padding: '6px 8px' }}>
              {allViolations.map((v, i) => {
                const present = (activeViolations as readonly string[]).includes(v);
                const color = present ? (violTab === 'major' ? '#ff5d73' : '#ffb84d') : '#6ee7b7';
                return (
                  <div key={v} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
                    borderRadius: 6, marginBottom: 2,
                    background: present ? `${color}08` : 'transparent',
                  }}>
                    <span style={{ fontSize: '0.75rem', color, flexShrink: 0, width: 14, textAlign: 'center' }}>
                      {present ? '✗' : '✓'}
                    </span>
                    <span style={{ fontSize: '0.76rem', color: present ? '#e7eefb' : '#8fa1bc', fontWeight: present ? 600 : 400 }}>
                      {v}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* High-risk flows */}
      {highRiskFlows.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#ff5d73', marginBottom: 5, fontWeight: 700 }}>
            ⚡ High-Risk Flows ({highRiskFlows.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {highRiskFlows.slice(0, 4).map(f => (
              <div key={f.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 9px', borderRadius: 7,
                background: 'rgba(255,93,115,0.06)', border: '1px solid rgba(255,93,115,0.15)',
                fontSize: '0.76rem', gap: 8,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#4cc9f0', fontFamily: 'monospace', fontSize: '0.73rem' }}>
                    {f.src_ip} → <span style={{ color: '#ffb84d' }}>{f.dst_ip}</span>
                  </span>
                  <span style={{ color: '#8fa1bc', fontSize: '0.7rem' }}>{f.application ?? f.protocol} · {(f.bytes / 1024).toFixed(1)}KB</span>
                </div>
                <span style={{ fontWeight: 800, color: (f.risk_score ?? 0) >= 85 ? '#ff5d73' : '#ffb84d', whiteSpace: 'nowrap' }}>
                  ⚡{f.risk_score}
                </span>
              </div>
            ))}
            {highRiskFlows.length > 4 && (
              <div style={{ fontSize: '0.73rem', color: '#8fa1bc', paddingLeft: 4 }}>+{highRiskFlows.length - 4} more</div>
            )}
          </div>
        </div>
      )}

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#ff5d73', marginBottom: 5, fontWeight: 700 }}>
            🚨 Critical Alerts ({criticalAlerts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {criticalAlerts.slice(0, 4).map(a => (
              <div key={a.id} style={{
                padding: '7px 9px', borderRadius: 7,
                background: 'rgba(255,93,115,0.07)', border: '1px solid rgba(255,93,115,0.2)',
                fontSize: '0.76rem', display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#e7eefb' }}>{a.alert_name}</span>
                  <SeverityBadge severity={a.severity} />
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {a.malware_family && <MalwarePill family={a.malware_family} />}
                  {a.ioc_match && a.ioc_match !== 'no' && pill('IOC', '#ff5d73')}
                  {a.risk_score && <span style={{ color: '#ffb84d', fontSize: '0.7rem' }}>Risk {a.risk_score}</span>}
                </div>
              </div>
            ))}
            {criticalAlerts.length > 4 && (
              <div style={{ fontSize: '0.73rem', color: '#8fa1bc', paddingLeft: 4 }}>+{criticalAlerts.length - 4} more</div>
            )}
          </div>
        </div>
      )}

      {/* Protocols */}
      {protocols.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8fa1bc', marginBottom: 5, fontWeight: 700 }}>
            Protocols Observed
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {protocols.map(p => pill(p!, '#4cc9f0'))}
          </div>
        </div>
      )}
    </div>
  );
}
