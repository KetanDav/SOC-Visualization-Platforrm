import type { Asset } from '@soc/telemetry-shared';

// ── Fixed violation lists ─────────────────────────────────────────────────

export const MAJOR_VIOLATIONS = [
  'AV not installed',
  'AV malfunction',
  'USB violation',
  'VM installed',
  'Virus intrusion',
  'Cisco ISE not installed',
  'Multiple NIC enabled',
  'AV not patched',
  'Not in domain',
  'Unauthorized CD/DVD',
  'Wireless adapter found',
  'Firewall off',
  'Unrecognized software',
  'OS not patched',
  'AV malfunction (Solidifier)',
] as const;

export const MINOR_VIOLATIONS = [
  'VeraCrypt not found',
  'OS not active',
  'Old password',
  'SCCM faulty',
  'Shared folder',
  'UAV disabled',
  'Multiple admin',
] as const;

export type MajorViolation = typeof MAJOR_VIOLATIONS[number];
export type MinorViolation = typeof MINOR_VIOLATIONS[number];

// ── Info sub-types ────────────────────────────────────────────────────────

export interface MacEntry {
  mac: string;
  deviceType: string;
  status: 'Active' | 'Inactive' | 'Unknown';
}

export interface UserAccount {
  username: string;
  passwordAge: number;
  memberOf: string[];
  status: 'Active' | 'Disabled' | 'Locked';
}

export interface RATDeviceInfo {
  serialNumber: string;
  avPatchDate: string;
  virtualization: 'Enabled' | 'Disabled';
  avInstallName: string;
}

export interface RATOsInfo {
  name: string;
  version: string;
  installDate: string;
  lastBootTime: string;
  patchInstalled: string;
}

export interface PCRATReport {
  ip: string;
  hostname: string;
  majorViolations: MajorViolation[];
  minorViolations: MinorViolation[];
  devInfo: RATDeviceInfo;
  osInfo: RATOsInfo;
  macs: MacEntry[];
  userAccounts: UserAccount[];
  softwareInstalled: string[];
  runningServices: string[];
  generatedAt: string;
}

// ── Deterministic helpers ─────────────────────────────────────────────────

function strHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function seededPick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

function seededSubset<T>(arr: readonly T[], seed: number, min: number, max: number): T[] {
  const count = min + (strHash(String(seed)) % (max - min + 1));
  const result: T[] = [];
  const used = new Set<number>();
  for (let i = 0; result.length < Math.min(count, arr.length); i++) {
    const idx = strHash(String(seed * 31 + i * 7919)) % arr.length;
    if (!used.has(idx)) { used.add(idx); result.push(arr[idx]); }
  }
  return result;
}

function fakeDate(seed: number, minDays: number, maxDays: number): string {
  const base = new Date('2024-03-01T08:00:00Z');
  const days = minDays + (strHash(String(seed)) % (maxDays - minDays + 1));
  const d = new Date(base.getTime() - days * 86_400_000);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

function fakeMac(ip: string, idx: number): string {
  const h = strHash(ip + String(idx));
  const b = (n: number) => ((h >> (n * 4)) & 0xff).toString(16).padStart(2, '0');
  return `${b(5)}:${b(4)}:${b(3)}:${b(2)}:${b(1)}:${b(0)}`.toUpperCase();
}

// ── Data pools ────────────────────────────────────────────────────────────

const OS_POOL: Array<{ name: string; version: string }> = [
  { name: 'Windows 10 Pro',         version: '10.0.19045' },
  { name: 'Windows 10 Enterprise',  version: '10.0.19044' },
  { name: 'Windows 11 Enterprise',  version: '10.0.22621' },
  { name: 'Windows Server 2019',    version: '10.0.17763' },
  { name: 'Windows Server 2022',    version: '10.0.20348' },
  { name: 'Windows 7 Professional', version: '6.1.7601'   },
];

const PATCH_POOL = [
  'KB5034441', 'KB5035853', 'KB5031455', 'KB5029244',
  'KB5027231', 'KB5026361', 'KB5025239', 'KB5023696',
];

const DEVICE_TYPES = ['Laptop', 'Desktop', 'Workstation', 'Server', 'Printer', 'IP Camera', 'Network Switch', 'VoIP Phone'];
const MAC_STATUSES = ['Active', 'Active', 'Active', 'Inactive', 'Unknown'] as const;

const USER_BASES = ['admin', 'administrator', 'operator', 'svc.backup', 'svc.monitor', 'helpdesk', 'auditor', 'it.support'];
const GROUPS = [
  'Domain Admins', 'Domain Users', 'Local Administrators', 'Backup Operators',
  'Remote Desktop Users', 'Network Configuration Operators', 'Power Users',
  'Guests', 'Print Operators', 'Event Log Readers',
];
const USER_STATUSES = ['Active', 'Active', 'Active', 'Disabled', 'Locked'] as const;

const SOFTWARE_POOL = [
  'Microsoft Office 365 ProPlus 16.0.17126', 'Adobe Acrobat Reader DC 23.006',
  'Google Chrome 121.0.6167', 'Mozilla Firefox 122.0', '7-Zip 23.01',
  'VLC Media Player 3.0.20', 'Notepad++ 8.6.2', 'Python 3.11.7',
  'Java Runtime Environment 8.0.401', 'Cisco AnyConnect 4.10.08029',
  'WinRAR 6.24', 'Zoom 5.17.11', 'Slack 4.36.140',
  'Visual Studio Code 1.86.2', 'Git 2.43.0', 'PuTTY 0.80',
  'Wireshark 4.2.2', 'TeraTerm 4.106', 'WinSCP 6.1.2', 'FileZilla 3.66.5',
  'Trellix Endpoint Security 10.7.0', 'Malwarebytes 4.6.11',
  'Microsoft .NET Framework 4.8.1', 'Visual C++ Redistributable 2022 14.38',
  'VirtualBox 7.0.14', 'VMware Workstation 17.5', 'Docker Desktop 4.27.2',
  'SQL Server Management Studio 19.3', 'Remote Desktop Connection Manager 2.93',
  'CCleaner 6.19.10897',
];

const SERVICE_POOL = [
  'wuauserv — Windows Update',
  'spooler — Print Spooler',
  'w32tm — Windows Time',
  'eventlog — Windows Event Log',
  'lanmanserver — Server',
  'lanmanworkstation — Workstation',
  'netlogon — Netlogon',
  'dnscache — DNS Client',
  'dhcp — DHCP Client',
  'lmhosts — TCP/IP NetBIOS Helper',
  'wscsvc — Security Center',
  'MsMpSvc — Microsoft Defender Antivirus',
  'Winmgmt — Windows Management Instrumentation',
  'RpcSs — Remote Procedure Call',
  'SamSs — Security Accounts Manager',
  'TermService — Remote Desktop Services',
  'BITS — Background Intelligent Transfer',
  'CryptSvc — Cryptographic Services',
  'DPS — Diagnostic Policy Service',
  'Themes — Themes',
  'BFE — Base Filtering Engine',
  'mpssvc — Windows Defender Firewall',
  'WSearch — Windows Search',
  'Schedule — Task Scheduler',
  'seclogon — Secondary Logon',
  'WinDefend — Windows Defender',
  'SCardSvr — Smart Card',
  'wlanSvc — WLAN AutoConfig',
  'AudioSrv — Windows Audio',
  'TapiSrv — Telephony',
];

// ── Main generator ────────────────────────────────────────────────────────

export function generatePCRATReport(ip: string, asset?: Asset): PCRATReport {
  const seed = strHash(ip);
  const hostname = asset?.hostname ?? `WKS-${ip.replace(/\./g, '-')}`;

  // Violations — each entry is present if its per-entry hash passes a threshold
  // ~33% chance per major violation → ~5 per PC on average
  const majorViolations = MAJOR_VIOLATIONS.filter(
    v => strHash(ip + v) % 3 === 0
  ) as MajorViolation[];

  // ~43% chance per minor violation → ~3 per PC on average
  const minorViolations = MINOR_VIOLATIONS.filter(
    v => strHash(ip + v) % 7 < 3
  ) as MinorViolation[];

  // OS info
  const osEntry = seededPick(OS_POOL, seed);
  const osInfo: RATOsInfo = {
    name: osEntry.name,
    version: osEntry.version,
    installDate: fakeDate(seed + 10, 90, 730),
    lastBootTime: fakeDate(seed + 11, 1, 30),
    patchInstalled: seededPick(PATCH_POOL, seed + 3),
  };

  // Dev info
  const avMissing = majorViolations.includes('AV not installed');
  const devInfo: RATDeviceInfo = {
    serialNumber: `SN${seed.toString(36).toUpperCase().padStart(8, '0').slice(0, 10)}`,
    avPatchDate: avMissing ? 'N/A' : fakeDate(seed + 20, 0, 60),
    virtualization: strHash(ip + 'virt') % 4 === 0 ? 'Enabled' : 'Disabled',
    avInstallName: avMissing ? 'Not installed' : 'Trellix Endpoint Security 10.7',
  };

  // MACs
  const macCount = 1 + (seed % 3);
  const macs: MacEntry[] = Array.from({ length: macCount }, (_, i) => ({
    mac: fakeMac(ip, i),
    deviceType: seededPick(DEVICE_TYPES, seed + i * 13),
    status: seededPick(MAC_STATUSES, seed + i * 7),
  }));

  // User accounts
  const userCount = 2 + (seed % 3);
  const userAccounts: UserAccount[] = Array.from({ length: userCount }, (_, i) => ({
    username: seededPick(USER_BASES, seed + i * 11),
    passwordAge: 10 + (strHash(ip + String(i)) % 180),
    memberOf: seededSubset(GROUPS, seed + i * 17, 1, 3),
    status: seededPick(USER_STATUSES, seed + i * 23),
  }));

  // Software & services
  const softwareInstalled = seededSubset(SOFTWARE_POOL, seed + 50, 8, 16);
  const runningServices   = seededSubset(SERVICE_POOL,  seed + 60, 12, 20);

  return {
    ip,
    hostname,
    majorViolations,
    minorViolations,
    devInfo,
    osInfo,
    macs,
    userAccounts,
    softwareInstalled,
    runningServices,
    generatedAt: new Date().toISOString(),
  };
}

// ── Score helpers (derived from violations) ───────────────────────────────

export function getRATScore(report: PCRATReport): number {
  const score = 100 - report.majorViolations.length * 10 - report.minorViolations.length * 3;
  return Math.max(0, score);
}

export function getRATTier(score: number): 'ready' | 'conditional' | 'blocked' {
  if (score >= 80) return 'ready';
  if (score >= 55) return 'conditional';
  return 'blocked';
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#6ee7b7';
  if (score >= 60) return '#ffd166';
  if (score >= 40) return '#ffb84d';
  return '#ff5d73';
}

export function tierColor(tier: 'ready' | 'conditional' | 'blocked'): string {
  return tier === 'ready' ? '#6ee7b7' : tier === 'conditional' ? '#ffb84d' : '#ff5d73';
}

export function tierLabel(tier: 'ready' | 'conditional' | 'blocked'): string {
  return tier === 'ready' ? 'Production Ready' : tier === 'conditional' ? 'Conditional' : 'Blocked';
}
