import type { AlertRecord, Asset, EventRecord, Flow } from '@soc/telemetry-shared';
import { severityTone } from '../lib/telemetry';

interface DetailsPanelProps {
  selectedAsset: Asset | null;
  relatedFlows: Flow[];
  relatedEvents: EventRecord[];
  relatedAlerts: AlertRecord[];
  totalCount: number;
}

const pill = (label: string, color: string, bg?: string) => (
  <span key={label} style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
    color, border: `1px solid ${color}44`, background: bg ?? `${color}12`
  }}>{label}</span>
);

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 70, padding: '10px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(130,155,190,0.12)',
      display: 'flex', flexDirection: 'column', gap: 4
    }}>
      <span style={{ fontSize: '0.68rem', color: '#8fa1bc', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: color ?? '#e7eefb', lineHeight: 1 }}>{value}</span>
    </div>
  );
}

function maxRisk(alerts: AlertRecord[]): number {
  return alerts.reduce((m, a) => Math.max(m, a.risk_score ?? 0), 0);
}

function SeverityBadge({ severity }: { severity?: string }) {
  const color = severityTone(severity);
  return severity ? pill(severity.toUpperCase(), color) : null;
}

function MalwarePill({ family }: { family?: string }) {
  if (!family) return null;
  return pill(family, '#ff5d73');
}

export function DetailsPanel({ selectedAsset, relatedFlows, relatedEvents, relatedAlerts }: DetailsPanelProps) {
  if (!selectedAsset) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: '28px 18px', textAlign: 'center', color: '#8fa1bc'
      }}>
        <div style={{ fontSize: '2.5rem', opacity: 0.4 }}>🔍</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a8bbd4' }}>No asset selected</div>
        <div style={{ fontSize: '0.78rem', lineHeight: 1.6, maxWidth: 200 }}>
          Click a node in the communication graph to inspect its flows, events, and alerts.
        </div>
      </div>
    );
  }

  const highRiskFlows = relatedFlows.filter(f => (f.risk_score ?? 0) >= 65);
  const criticalAlerts = relatedAlerts.filter(a => (a.risk_score ?? 0) >= 80 || a.severity === 'critical');
  const malwareFamilies = [...new Set(relatedAlerts.flatMap(a => a.malware_family ? [a.malware_family] : []))];
  const iocAlerts = relatedAlerts.filter(a => a.ioc_match && a.ioc_match !== 'no');
  const totalBytes = relatedFlows.reduce((s, f) => s + f.bytes, 0);
  const protocols = [...new Set(relatedFlows.map(f => f.protocol).filter(Boolean))];
  const topRisk = maxRisk(relatedAlerts);

  const riskColor = topRisk >= 85 ? '#ff5d73' : topRisk >= 65 ? '#ffb84d' : topRisk >= 40 ? '#4cc9f0' : '#6ee7b7';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '2px 0' }}>
      {/* Asset header */}
      <div style={{
        padding: '14px 16px', borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(76,201,240,0.08), rgba(76,201,240,0.02))',
        border: '1px solid rgba(76,201,240,0.15)'
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
          {topRisk > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '6px 10px', borderRadius: 10, background: `${riskColor}15`,
              border: `1px solid ${riskColor}44`
            }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: riskColor, lineHeight: 1 }}>{topRisk}</span>
              <span style={{ fontSize: '0.62rem', color: '#8fa1bc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>risk</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {selectedAsset.country && pill(`🌍 ${selectedAsset.country}`, '#8fa1bc')}
          {selectedAsset.mac && pill(selectedAsset.mac, '#6b7a99')}
          {selectedAsset.username && pill(`👤 ${selectedAsset.username}`, '#a78bfa')}
          {selectedAsset.asn && pill(`ASN ${selectedAsset.asn}`, '#60a5fa')}
          {selectedAsset.sourceVendor.map(v => pill(v, '#4cc9f0'))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {malwareFamilies.map(m => <MalwarePill key={m} family={m} />)}
          {iocAlerts.length > 0 && pill(`IOC MATCH ×${iocAlerts.length}`, '#ff5d73')}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatBox label="Flows" value={relatedFlows.length} />
        <StatBox label="Events" value={relatedEvents.length} />
        <StatBox label="Alerts" value={relatedAlerts.length} color={relatedAlerts.length > 0 ? '#ff5d73' : undefined} />
        <StatBox label="Volume" value={totalBytes >= 1024*1024 ? `${(totalBytes/1024/1024).toFixed(1)}MB` : `${(totalBytes/1024).toFixed(0)}KB`} />
      </div>

      {/* High-risk flows */}
      {highRiskFlows.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#ff5d73', marginBottom: 6, fontWeight: 700 }}>
            ⚡ High-Risk Flows ({highRiskFlows.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {highRiskFlows.slice(0, 4).map(f => (
              <div key={f.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 10px', borderRadius: 8,
                background: 'rgba(255,93,115,0.06)', border: '1px solid rgba(255,93,115,0.15)',
                fontSize: '0.78rem', gap: 8
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#4cc9f0', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {f.src_ip} → <span style={{ color: '#ffb84d' }}>{f.dst_ip}</span>
                  </span>
                  <span style={{ color: '#8fa1bc', fontSize: '0.72rem' }}>{f.application ?? f.protocol} · {(f.bytes/1024).toFixed(1)}KB</span>
                </div>
                <span style={{ fontWeight: 800, color: (f.risk_score ?? 0) >= 85 ? '#ff5d73' : '#ffb84d', whiteSpace: 'nowrap' }}>
                  ⚡{f.risk_score}
                </span>
              </div>
            ))}
            {highRiskFlows.length > 4 && (
              <div style={{ fontSize: '0.75rem', color: '#8fa1bc', paddingLeft: 4 }}>
                +{highRiskFlows.length - 4} more high-risk flows
              </div>
            )}
          </div>
        </div>
      )}

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#ff5d73', marginBottom: 6, fontWeight: 700 }}>
            🚨 Critical Alerts ({criticalAlerts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {criticalAlerts.slice(0, 4).map(a => (
              <div key={a.id} style={{
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(255,93,115,0.07)', border: '1px solid rgba(255,93,115,0.2)',
                fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 4
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#e7eefb' }}>{a.alert_name}</span>
                  <SeverityBadge severity={a.severity} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.malware_family && <MalwarePill family={a.malware_family} />}
                  {a.ioc_match && a.ioc_match !== 'no' && pill('IOC', '#ff5d73')}
                  {a.risk_score && <span style={{ color: '#ffb84d', fontSize: '0.72rem' }}>Risk {a.risk_score}</span>}
                </div>
              </div>
            ))}
            {criticalAlerts.length > 4 && (
              <div style={{ fontSize: '0.75rem', color: '#8fa1bc', paddingLeft: 4 }}>
                +{criticalAlerts.length - 4} more critical alerts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Protocols observed */}
      {protocols.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8fa1bc', marginBottom: 6, fontWeight: 700 }}>
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
