import { useState } from 'react';
import type { Asset } from '@soc/telemetry-shared';
import {
  MAJOR_VIOLATIONS, MINOR_VIOLATIONS,
  getRATScore, getRATTier, scoreColor, tierColor, tierLabel,
  type PCRATReport,
} from '../lib/compliance';

interface Props {
  report: PCRATReport;
  asset: Asset;
  onClose: () => void;
}

type Tab = 'violations' | 'info' | 'source';

const TABS: Array<{ id: Tab; label: string; group: 'rat' | 'source' }> = [
  { id: 'violations', label: 'RAT Violations',  group: 'rat'    },
  { id: 'info',       label: 'RAT Info',        group: 'rat'    },
  { id: 'source',     label: 'Source Telemetry', group: 'source' },
];

const C = {
  major: '#ff5d73',
  minor: '#ffb84d',
  info:  '#4cc9f0',
  ok:    '#6ee7b7',
  muted: '#8fa1bc',
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
      color, border: `1px solid ${color}44`, background: `${color}12`,
    }}>{label}</span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '1px solid rgba(130,155,190,0.08)', gap: 12,
    }}>
      <span style={{ fontSize: '0.78rem', color: C.muted, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: '0.8rem', fontWeight: 600, color: '#e7eefb', textAlign: 'right',
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children, color = C.info }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em',
      color, fontWeight: 700, marginBottom: 10, marginTop: 4,
    }}>{children}</div>
  );
}

function ViolationRow({ label, present, severity }: { label: string; present: boolean; severity: 'major' | 'minor' }) {
  const color = present ? (severity === 'major' ? C.major : C.minor) : C.ok;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 10px', borderRadius: 8, marginBottom: 3,
      background: present
        ? (severity === 'major' ? 'rgba(255,93,115,0.06)' : 'rgba(255,184,77,0.05)')
        : 'rgba(110,231,183,0.03)',
      border: `1px solid ${present ? `${color}22` : 'rgba(110,231,183,0.08)'}`,
    }}>
      <span style={{ fontSize: '0.85rem', flexShrink: 0, width: 18, textAlign: 'center' }}>
        {present ? '✗' : '✓'}
      </span>
      <span style={{ fontSize: '0.8rem', color: present ? '#e7eefb' : C.muted, fontWeight: present ? 600 : 400, flex: 1 }}>
        {label}
      </span>
      {present && (
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
          color, border: `1px solid ${color}44`, background: `${color}12`,
          letterSpacing: '0.05em', whiteSpace: 'nowrap',
        }}>
          {severity === 'major' ? 'MAJOR' : 'MINOR'}
        </span>
      )}
    </div>
  );
}

export function RATReportModal({ report, asset, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('violations');
  const score = getRATScore(report);
  const tier = getRATTier(score);
  const sc = scoreColor(score);
  const tc = tierColor(tier);
  const circ = 2 * Math.PI * 34;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4,9,26,0.82)',
        backdropFilter: 'blur(6px)', zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg,#0a1628,#060e1c)',
          border: '1px solid rgba(76,201,240,0.2)', borderRadius: 20,
          width: '100%', maxWidth: 780, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(130,155,190,0.1)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.info, fontWeight: 700, marginBottom: 4 }}>
                Remote Audit Tool — PC Report
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e7eefb', lineHeight: 1.2 }}>
                {report.hostname}
              </div>
              <div style={{ fontSize: '0.82rem', color: C.info, fontFamily: 'monospace', marginTop: 4 }}>
                {report.ip}
              </div>
            </div>

            {/* Score ring */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <svg width={80} height={80} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(130,155,190,0.1)" strokeWidth={7} />
                  <circle
                    cx={40} cy={40} r={34} fill="none"
                    stroke={sc} strokeWidth={7}
                    strokeDasharray={`${(score / 100) * circ} ${circ}`}
                    strokeLinecap="round"
                  />
                  <text
                    x={40} y={40} textAnchor="middle" dominantBaseline="central"
                    style={{ transform: 'rotate(90deg)', transformOrigin: '40px 40px', fill: sc, fontSize: 17, fontWeight: 800, fontFamily: 'inherit' }}
                  >{score}</text>
                </svg>
                <div style={{ fontSize: '0.65rem', color: C.muted, marginTop: -4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>score</div>
              </div>

              {/* Violation badges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Badge label={`${report.majorViolations.length} Major`} color={report.majorViolations.length > 0 ? C.major : C.ok} />
                <Badge label={`${report.minorViolations.length} Minor`} color={report.minorViolations.length > 0 ? C.minor : C.ok} />
                <Badge label={tierLabel(tier)} color={tc} />
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(130,155,190,0.08)', border: '1px solid rgba(130,155,190,0.2)',
                borderRadius: 8, color: C.muted, cursor: 'pointer', fontSize: '0.85rem',
                padding: '4px 8px', alignSelf: 'flex-start',
              }}
            >✕</button>
          </div>

          <div style={{ fontSize: '0.72rem', color: C.muted, marginTop: 10 }}>
            Generated {new Date(report.generatedAt).toLocaleString()}
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2, padding: '10px 24px 0',
          borderBottom: '1px solid rgba(130,155,190,0.1)',
          overflowX: 'auto', flexShrink: 0,
        }}>
          {TABS.map((t, i) => {
            const prevGroup = i > 0 ? TABS[i - 1].group : t.group;
            const groupColor = t.group === 'rat' ? C.info : '#a78bfa';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center' }}>
                {t.group !== prevGroup && (
                  <div style={{
                    width: 1, height: 20, background: 'rgba(130,155,190,0.2)',
                    margin: '0 8px',
                  }} />
                )}
                <button
                  onClick={() => setTab(t.id)}
                  title={t.group === 'rat' ? 'From RAT audit report' : 'Raw telemetry from log sources (ISE, QRadar, SNA, etc.)'}
                  style={{
                    padding: '6px 14px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: tab === t.id ? 700 : 500,
                    background: tab === t.id ? `${groupColor}1a` : 'transparent',
                    border: tab === t.id ? `1px solid ${groupColor}44` : '1px solid transparent',
                    borderBottom: 'none',
                    color: tab === t.id ? groupColor : C.muted,
                    whiteSpace: 'nowrap',
                  }}
                >{t.label}</button>
              </div>
            );
          })}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '4px 24px 0',
          fontSize: '0.62rem', color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          <span>{tab === 'source' ? '' : '← From RAT audit'}</span>
          <span>{tab === 'source' ? 'Raw source telemetry →' : ''}</span>
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {tab === 'violations' && (
            <div>
              <SectionTitle color={C.major}>Major Violations ({report.majorViolations.length} / {MAJOR_VIOLATIONS.length})</SectionTitle>
              {MAJOR_VIOLATIONS.map(v => (
                <ViolationRow key={v} label={v} present={report.majorViolations.includes(v)} severity="major" />
              ))}

              <div style={{ marginTop: 20 }} />
              <SectionTitle color={C.minor}>Minor Violations ({report.minorViolations.length} / {MINOR_VIOLATIONS.length})</SectionTitle>
              {MINOR_VIOLATIONS.map(v => (
                <ViolationRow key={v} label={v} present={report.minorViolations.includes(v)} severity="minor" />
              ))}
            </div>
          )}

          {tab === 'info' && (
            <div>
              <SectionTitle color={C.info}>Dev Info</SectionTitle>
              <InfoRow label="Device Serial Number" value={report.devInfo.serialNumber} mono />
              <InfoRow label="AV Install Name"   value={report.devInfo.avInstallName} />
              <InfoRow label="AV Patch Date"     value={report.devInfo.avPatchDate} mono />
              <InfoRow label="Virtualization"    value={report.devInfo.virtualization} />

              <div style={{ marginTop: 20 }} />
              <SectionTitle color={C.info}>OS Info</SectionTitle>
              <InfoRow label="OS Name"          value={report.osInfo.name} />
              <InfoRow label="Version"          value={report.osInfo.version} mono />
              <InfoRow label="Install Date"     value={report.osInfo.installDate} mono />
              <InfoRow label="Last Boot Time"   value={report.osInfo.lastBootTime} mono />
              <InfoRow label="Patch Installed"  value={report.osInfo.patchInstalled} mono />

              <div style={{ marginTop: 20 }} />
              <SectionTitle color={C.info}>MACs Found ({report.macs.length})</SectionTitle>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['MAC Address', 'Device Type', 'Status'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '8px 10px',
                        fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em',
                        color: C.muted, borderBottom: '1px solid rgba(130,155,190,0.15)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.macs.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(130,155,190,0.07)' }}>
                      <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: '0.82rem', color: C.info }}>{m.mac}</td>
                      <td style={{ padding: '9px 10px', fontSize: '0.8rem', color: '#e7eefb' }}>{m.deviceType}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <Badge
                          label={m.status}
                          color={m.status === 'Active' ? C.ok : m.status === 'Inactive' ? C.muted : C.minor}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 20 }} />
              <SectionTitle color={C.info}>User Accounts ({report.userAccounts.length})</SectionTitle>
              {report.userAccounts.map((u, i) => (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(130,155,190,0.1)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e7eefb', fontSize: '0.88rem' }}>{u.username}</span>
                    <Badge
                      label={u.status}
                      color={u.status === 'Active' ? C.ok : u.status === 'Disabled' ? C.muted : C.major}
                    />
                  </div>
                  <InfoRow label="Password Age" value={`${u.passwordAge} days`} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 6 }}>
                    <span style={{ fontSize: '0.7rem', color: C.muted, marginRight: 4 }}>Member of:</span>
                    {u.memberOf.map(g => <Badge key={g} label={g} color="#a78bfa" />)}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 20 }} />
              <SectionTitle color={C.info}>Software Installed ({report.softwareInstalled.length})</SectionTitle>
              {report.softwareInstalled.map((s, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(130,155,190,0.08)',
                  fontSize: '0.8rem', color: '#e7eefb', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ color: C.muted, fontSize: '0.72rem', width: 22, flexShrink: 0, textAlign: 'right' }}>{i + 1}.</span>
                  {s}
                </div>
              ))}

              <div style={{ marginTop: 20 }} />
              <SectionTitle color={C.info}>Running Services ({report.runningServices.length})</SectionTitle>
              {report.runningServices.map((s, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 4,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(130,155,190,0.08)',
                  fontSize: '0.8rem', color: '#e7eefb', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ color: C.ok, fontSize: '0.65rem', flexShrink: 0 }}>●</span>
                  {s}
                </div>
              ))}
            </div>
          )}

          {tab === 'source' && (
            <div>
              <div style={{
                fontSize: '0.75rem', color: C.muted, marginBottom: 16, padding: '10px 12px',
                borderRadius: 8, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)',
              }}>
                Raw normalized fields collected for this endpoint across all ingested log sources
                (Cisco ISE / NAC, QRadar, Cisco SNA, Arista NDR, etc.) — not part of the RAT audit.
              </div>

              <SectionTitle color="#a78bfa">Identity & Network</SectionTitle>
              <InfoRow label="IP Address"     value={asset.ip} mono />
              <InfoRow label="Hostname"       value={asset.hostname ?? '-'} />
              <InfoRow label="MAC Address"    value={asset.mac ?? '-'} mono />
              <InfoRow label="Username"       value={asset.username ?? '-'} />
              <InfoRow label="Country"        value={asset.country ?? '-'} />
              <InfoRow label="ASN"            value={asset.asn ?? '-'} mono />
              <InfoRow label="Device Type"    value={asset.deviceType ?? '-'} />

              <div style={{ marginTop: 20 }} />
              <SectionTitle color="#a78bfa">Cisco ISE / NAC</SectionTitle>
              <InfoRow label="VLAN"                value={asset.vlan ?? '-'} mono />
              <InfoRow label="Switch IP"           value={asset.switchIp ?? '-'} mono />
              <InfoRow label="Switch Port"         value={asset.switchPort ?? '-'} mono />
              <InfoRow label="Switch Port Type"    value={asset.switchPortType ?? '-'} />
              <InfoRow label="Security Group"      value={asset.securityGroup ?? '-'} />
              <InfoRow label="Policy Set"          value={asset.policySet ?? '-'} />
              <InfoRow label="Auth Rule"           value={asset.authRule ?? '-'} />
              <InfoRow label="Posture Status"      value={asset.postureStatus ?? '-'} />
              <InfoRow label="Endpoint Profile"    value={asset.endpointProfile ?? '-'} />
              <InfoRow label="Audit Session ID"    value={asset.auditSessionId ?? '-'} mono />
              <InfoRow label="Risk Score"          value={asset.riskScore ?? '-'} />

              <div style={{ marginTop: 20 }} />
              <SectionTitle color="#a78bfa">Aggregate Telemetry</SectionTitle>
              <InfoRow label="Communication Volume" value={asset.communicationVolume.toLocaleString() + ' bytes'} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 10 }}>
                <span style={{ fontSize: '0.7rem', color: C.muted, marginRight: 4 }}>Source Vendors:</span>
                {asset.sourceVendor.map(v => <Badge key={v} label={v} color="#a78bfa" />)}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
