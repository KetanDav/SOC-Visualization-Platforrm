// Enterprise: Acme Financial Services Corp — Realistic Log Generator
// Produces 6 CSV files with internally consistent entities across all sources.
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = p => join(__dirname, p);

// ── Shared Enterprise Entities ─────────────────────────────────────────────
const ENV = {
  domain: 'corp.local',
  org: 'ACME Financial Services',
  asn: '64512',
  asnName: 'CorpNet',
};

// Internal hosts — consistent across all log sources
const H = {
  // Finance workstations (VLAN 10 = 10.10.10.0/24)
  'ws-finance-21': { ip:'10.10.10.21', mac:'AA:BB:CC:10:21:01', user:'jdavis@corp.local', os:'Windows 11', dept:'Finance', vlan:10, port:'GigabitEthernet1/0/1', nas:'10.10.80.1', nasPort:'GigabitEthernet1/0/1' },
  'ws-finance-22': { ip:'10.10.10.22', mac:'AA:BB:CC:10:22:01', user:'mchen@corp.local',  os:'Windows 11', dept:'Finance', vlan:10, port:'GigabitEthernet1/0/2', nas:'10.10.80.1', nasPort:'GigabitEthernet1/0/2' },
  'ws-finance-23': { ip:'10.10.10.23', mac:'AA:BB:CC:10:23:01', user:'tpatel@corp.local', os:'Windows 10', dept:'Finance', vlan:10, port:'GigabitEthernet1/0/3', nas:'10.10.80.1', nasPort:'GigabitEthernet1/0/3' },
  'ws-finance-24': { ip:'10.10.10.24', mac:'AA:BB:CC:10:24:01', user:'kreyes@corp.local', os:'Windows 11', dept:'Finance', vlan:10, port:'GigabitEthernet1/0/4', nas:'10.10.80.2', nasPort:'GigabitEthernet1/0/4' },
  'ws-finance-25': { ip:'10.10.10.25', mac:'AA:BB:CC:10:25:01', user:'lwang@corp.local',  os:'Windows 11', dept:'Finance', vlan:10, port:'GigabitEthernet1/0/5', nas:'10.10.80.2', nasPort:'GigabitEthernet1/0/5' },
  'ws-finance-26': { ip:'10.10.10.26', mac:'AA:BB:CC:10:26:01', user:'bsmith@corp.local', os:'Windows 10', dept:'Finance', vlan:10, port:'GigabitEthernet1/0/6', nas:'10.10.80.2', nasPort:'GigabitEthernet1/0/6' }, // INSIDER THREAT
  // HR workstations (VLAN 11 = 10.10.11.0/24)
  'ws-hr-31':      { ip:'10.10.11.31', mac:'AA:BB:CC:11:31:01', user:'scode@corp.local',  os:'Windows 11', dept:'HR',      vlan:11, port:'GigabitEthernet2/0/1', nas:'10.10.80.1', nasPort:'GigabitEthernet2/0/1' },
  'ws-hr-32':      { ip:'10.10.11.32', mac:'AA:BB:CC:11:32:01', user:'pramos@corp.local', os:'Windows 10', dept:'HR',      vlan:11, port:'GigabitEthernet2/0/2', nas:'10.10.80.1', nasPort:'GigabitEthernet2/0/2' },
  'ws-hr-33':      { ip:'10.10.11.33', mac:'AA:BB:CC:11:33:01', user:'nkirk@corp.local',  os:'Windows 11', dept:'HR',      vlan:11, port:'GigabitEthernet2/0/3', nas:'10.10.80.2', nasPort:'GigabitEthernet2/0/3' },
  // IT workstations (VLAN 12 = 10.10.12.0/24)
  'ws-it-41':      { ip:'10.10.12.41', mac:'AA:BB:CC:12:41:01', user:'admin-jkim@corp.local',   os:'Windows 11', dept:'IT', vlan:12, port:'GigabitEthernet3/0/1', nas:'10.10.80.1', nasPort:'GigabitEthernet3/0/1' },
  'ws-it-42':      { ip:'10.10.12.42', mac:'AA:BB:CC:12:42:01', user:'admin-rwilson@corp.local', os:'Windows 11', dept:'IT', vlan:12, port:'GigabitEthernet3/0/2', nas:'10.10.80.2', nasPort:'GigabitEthernet3/0/2' },
  // Executive (VLAN 13 = 10.10.13.0/24)
  'ws-exec-51':    { ip:'10.10.13.51', mac:'AA:BB:CC:13:51:01', user:'ceo@corp.local',    os:'macOS 14', dept:'Executive', vlan:13, port:'GigabitEthernet4/0/1', nas:'10.10.80.1', nasPort:'GigabitEthernet4/0/1' },
  'ws-exec-52':    { ip:'10.10.13.52', mac:'AA:BB:CC:13:52:01', user:'cfo@corp.local',    os:'Windows 11', dept:'Executive', vlan:13, port:'GigabitEthernet4/0/2', nas:'10.10.80.2', nasPort:'GigabitEthernet4/0/2' },
  // Servers (VLAN 20 = 10.10.20.0/24)
  'app-erp-04':    { ip:'10.10.20.10', mac:'00:50:56:20:10:04', user:'', os:'RHEL 9.3',    dept:'Servers', vlan:20 },
  'app-crm-05':    { ip:'10.10.20.11', mac:'00:50:56:20:11:05', user:'', os:'RHEL 9.3',    dept:'Servers', vlan:20 },
  'fs-payroll-01': { ip:'10.10.20.12', mac:'00:50:56:B2:20:12', user:'', os:'Windows Server 2022', dept:'Servers', vlan:20 },
  'fs-hr-02':      { ip:'10.10.20.13', mac:'00:50:56:B2:20:13', user:'', os:'Windows Server 2022', dept:'Servers', vlan:20 },
  'db-finance-03': { ip:'10.10.20.14', mac:'00:50:56:B2:20:14', user:'', os:'Windows Server 2022', dept:'Servers', vlan:20 },
  'db-hr-06':      { ip:'10.10.20.15', mac:'00:50:56:B2:20:15', user:'', os:'Windows Server 2022', dept:'Servers', vlan:20 },
  'auth-dc-01':    { ip:'10.10.20.16', mac:'00:50:56:A0:20:16', user:'', os:'Windows Server 2022', dept:'Servers', vlan:20 },
  'auth-dc-02':    { ip:'10.10.20.17', mac:'00:50:56:A0:20:17', user:'', os:'Windows Server 2022', dept:'Servers', vlan:20 },
  'mail-01':       { ip:'10.10.20.18', mac:'00:50:56:A0:20:18', user:'', os:'Windows Server 2022', dept:'Servers', vlan:20 },
  'backup-01':     { ip:'10.10.20.19', mac:'00:50:56:A0:20:19', user:'', os:'RHEL 9.3',    dept:'Servers', vlan:20 },
  // DMZ (VLAN 30 = 10.10.30.0/24)
  'web-dmz-01':   { ip:'10.10.30.1',  mac:'00:50:56:30:01:01', user:'', os:'Ubuntu 22.04', dept:'DMZ', vlan:30 },
  'web-dmz-02':   { ip:'10.10.30.2',  mac:'00:50:56:30:02:01', user:'', os:'Ubuntu 22.04', dept:'DMZ', vlan:30 },
  'vpn-gw-01':    { ip:'10.10.30.5',  mac:'00:50:56:30:05:01', user:'', os:'Cisco ASA 9.20', dept:'DMZ', vlan:30 },
  // Ops (VLAN 40 = 10.10.40.0/24)
  'ops-jump-55':  { ip:'10.10.40.55', mac:'00:50:56:E5:40:55', user:'', os:'Ubuntu 22.04', dept:'Ops', vlan:40 },
  'ops-mon-56':   { ip:'10.10.40.56', mac:'00:50:56:E5:40:56', user:'', os:'Ubuntu 22.04', dept:'Ops', vlan:40 },
  // Network infra (VLAN 70 = 10.10.70.0/24)
  'sw-core-01':   { ip:'10.10.70.1',  mac:'00:1A:A2:70:01:00', user:'', os:'Arista EOS 4.30.1F', dept:'Network', vlan:70 },
  'sw-core-02':   { ip:'10.10.70.2',  mac:'00:1A:A2:70:02:00', user:'', os:'Arista EOS 4.30.1F', dept:'Network', vlan:70 },
  'sw-dist-01':   { ip:'10.10.70.10', mac:'00:1A:A2:70:10:00', user:'', os:'Cisco Catalyst 9300', dept:'Network', vlan:70 },
  'sw-dist-02':   { ip:'10.10.70.11', mac:'00:1A:A2:70:11:00', user:'', os:'Cisco Catalyst 9300', dept:'Network', vlan:70 },
  'fw-edge-01':   { ip:'10.10.70.20', mac:'00:1A:A2:70:20:01', user:'', os:'Cisco Firepower 7.4', dept:'Network', vlan:70 },
  'fw-edge-02':   { ip:'10.10.70.21', mac:'00:1A:A2:70:21:01', user:'', os:'Cisco Firepower 7.4', dept:'Network', vlan:70 },
  // Management (VLAN 80 = 10.10.80.0/24)
  'sw-access-01': { ip:'10.10.80.1',  mac:'00:1A:A2:80:01:00', user:'', os:'Cisco Catalyst 9200', dept:'Network', vlan:80 },
  'sw-access-02': { ip:'10.10.80.2',  mac:'00:1A:A2:80:02:00', user:'', os:'Cisco Catalyst 9200', dept:'Network', vlan:80 },
  'corp-stealthwatch-01': { ip:'10.10.80.50', mac:'00:50:56:80:50:01', user:'', os:'StealthWatch 7.4', dept:'Security', vlan:80 },
};

// External / threat actors
const EXT = {
  'shodan-scan-156':   { ip:'45.33.32.156',   mac:'00:11:22:33:44:88', country:'NL', lat:52.3676, lon:4.9041 },
  'tor-exit-42':       { ip:'185.220.101.42',  mac:'00:AA:BB:CC:DD:42', country:'DE', lat:51.1657, lon:10.4515 },
  'c2-server-50':      { ip:'203.0.113.50',    mac:'', country:'CN', lat:39.9042, lon:116.4074 },
  'threat-actor-30':   { ip:'198.51.100.30',   mac:'', country:'RU', lat:55.7558, lon:37.6176 },
  'rogue-device':      { ip:'10.10.10.200',    mac:'DE:AD:BE:EF:CA:FE', country:'US', lat:37.3382, lon:-121.8863 }, // rogue device on VLAN 10
  'cloudflare-dns':    { ip:'1.1.1.1',         mac:'', country:'US', lat:37.7749, lon:-122.4194 },
  'google-dns':        { ip:'8.8.8.8',         mac:'', country:'US', lat:37.4056, lon:-122.0775 },
  'azure-ad':          { ip:'52.96.14.0',      mac:'', country:'US', lat:37.3382, lon:-122.0838 },
  'microsoft-update':  { ip:'13.107.4.52',     mac:'', country:'US', lat:47.6062, lon:-122.3321 },
};

function ip(name) { return (H[name] || EXT[name])?.ip || name; }
function mac(name) { return (H[name] || EXT[name])?.mac || ''; }
function user(name) { return H[name]?.user || ''; }

// ── Timestamp helpers ──────────────────────────────────────────────────────
const BASE = new Date('2026-06-29T06:00:00.000Z');
function ts(hh, mm, ss=0) {
  const d = new Date(BASE);
  d.setUTCHours(hh, mm, ss, 0);
  return d.toISOString();
}
function tsEnd(hh, mm, ss=0, addSec=45) {
  const d = new Date(BASE);
  d.setUTCHours(hh, mm, ss + addSec, 0);
  return d.toISOString();
}

// ── CSV helpers ────────────────────────────────────────────────────────────
function escape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function row(fields) { return fields.map(escape).join(','); }
function csv(headers, rows) { return [headers.join(','), ...rows.map(r => row(headers.map(h => r[h] ?? '')))].join('\n') + '\n'; }

// ─────────────────────────────────────────────────────────────────────────────
// 1. QRadar Events (86 rows)
// ─────────────────────────────────────────────────────────────────────────────
const QR_HEADERS = ['event_id','qid','qid_name','category','severity','credibility','relevance','magnitude','start_time','source_ip','source_port','source_mac','source_hostname','source_country','destination_ip','destination_port','destination_mac','destination_hostname','destination_country','protocol','application','direction','packet_count','byte_count','username','authentication_type','process_name','command_line','filename','md5','sha256','url','domain','dns_query','user_agent','offense_id','risk_score','log_source_name','raw_event'];

function qr(n, qid, qname, cat, sev, cred, rel, mag, t, src, sport, dst, dport, proto, app, dir, pkts, bytes, uname, auth, proc, cmd, fname, md5, sha256, url, domain, dns, ua, off, risk, raw) {
  const sh = H[src] || EXT[src] || {};
  const dh = H[dst] || EXT[dst] || {};
  return {
    event_id: `QR-${1000+n}`, qid, qid_name: qname, category: cat,
    severity: sev, credibility: cred, relevance: rel, magnitude: mag,
    start_time: t,
    source_ip: sh.ip || ip(src), source_port: sport, source_mac: sh.mac||mac(src), source_hostname: src, source_country: sh.country||'US',
    destination_ip: dh.ip||ip(dst), destination_port: dport, destination_mac: dh.mac||mac(dst), destination_hostname: dst, destination_country: dh.country||'US',
    protocol: proto, application: app, direction: dir, packet_count: pkts, byte_count: bytes,
    username: uname, authentication_type: auth, process_name: proc, command_line: cmd,
    filename: fname, md5, sha256, url, domain, dns_query: dns, user_agent: ua,
    offense_id: off, risk_score: risk, log_source_name: 'QRadar_Core',
    raw_event: raw || `${qname}: ${src} -> ${dst} [${app||proto}]`
  };
}

const qrRows = [
  // ── Normal morning SMB access (Finance → Payroll file server) ──────────────
  qr(0,  5000,'Windows SMB Connection','Access',2,9,5,2,  ts(6,0),  'ws-finance-21',53288,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',12,8192,  user('ws-finance-21'),'Kerberos','explorer.exe','','','','','','fs-payroll-01','','OFF-3000',17,''),
  qr(1,  5000,'Windows SMB Connection','Access',2,9,5,2,  ts(6,2),  'ws-finance-22',62802,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',8,6144,   user('ws-finance-22'),'Kerberos','explorer.exe','','','','','','fs-payroll-01','','OFF-3000',15,''),
  qr(2,  5001,'MS-SQL Connection','Database',2,9,5,2,     ts(6,4),  'ws-finance-23',51778,'db-finance-03',1433,'TCP','MSSQL','OUTBOUND',6,4096, user('ws-finance-23'),'Kerberos','ssms.exe','','','','','','db-finance-03','','OFF-3000',10,''),
  qr(3,  5000,'Windows SMB Connection','Access',2,9,5,2,  ts(6,6),  'ws-hr-31',50432,'fs-hr-02',445,'TCP','SMB','OUTBOUND',7,5120,             user('ws-hr-31'),'Kerberos','explorer.exe','','','','','','fs-hr-02','','OFF-3000',14,''),
  qr(4,  5002,'HTTPS Web Access','Web',2,9,5,1,           ts(6,8),  'ws-finance-21',58402,'app-erp-04',8443,'TCP','HTTPS','OUTBOUND',22,18900, user('ws-finance-21'),'Kerberos','chrome.exe','','','','https://erp.corp.local/','app-erp-04','','OFF-3000',9,''),
  qr(5,  5002,'HTTPS Web Access','Web',2,9,5,1,           ts(6,10), 'ws-finance-22',59104,'app-erp-04',8443,'TCP','HTTPS','OUTBOUND',18,14400, user('ws-finance-22'),'Kerberos','chrome.exe','','','','https://erp.corp.local/','app-erp-04','','OFF-3000',8,''),
  qr(6,  5003,'Kerberos Authentication','Authentication',2,9,8,1,   ts(6,12), 'ws-finance-23',49200,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',4,1024, user('ws-finance-23'),'Kerberos','lsass.exe','','','','','','auth-dc-01','','OFF-3000',5,''),
  qr(7,  5003,'Kerberos Authentication','Authentication',2,9,8,1,   ts(6,14), 'ws-hr-32',49215,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',4,1024, user('ws-hr-32'),'Kerberos','lsass.exe','','','','','','auth-dc-01','','OFF-3000',5,''),
  qr(8,  5000,'Windows SMB Connection','Access',2,9,5,2,  ts(6,16), 'ws-hr-32',61994,'fs-hr-02',445,'TCP','SMB','OUTBOUND',9,6656,             user('ws-hr-32'),'Kerberos','explorer.exe','','','','','','fs-hr-02','','OFF-3000',13,''),
  qr(9,  5001,'MS-SQL Connection','Database',2,9,5,2,     ts(6,18), 'ws-hr-31',51890,'db-hr-06',1433,'TCP','MSSQL','OUTBOUND',5,3584,          user('ws-hr-31'),'Kerberos','ssms.exe','','','','','','db-hr-06','','OFF-3000',11,''),
  qr(10, 5004,'DNS Query Resolved','DNS',2,9,5,1,         ts(6,20), 'ws-finance-24',53,'auth-dc-01',53,'UDP','DNS','OUTBOUND',2,256,            user('ws-finance-24'),'','','','','','','','','update.microsoft.com','OFF-3000',4,''),
  qr(11, 5004,'DNS Query Resolved','DNS',2,9,5,1,         ts(6,22), 'ws-finance-25',53,'auth-dc-01',53,'UDP','DNS','OUTBOUND',2,256,            user('ws-finance-25'),'','','','','','','','','ocsp.pki.goog','OFF-3000',4,''),
  qr(12, 5000,'Windows SMB Connection','Access',2,9,5,2,  ts(6,24), 'ws-finance-24',57832,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',10,7168,  user('ws-finance-24'),'Kerberos','excel.exe','','','','','','fs-payroll-01','','OFF-3000',16,''),
  qr(13, 5002,'HTTPS Web Access','Web',2,9,5,1,           ts(6,26), 'ws-exec-51',60111,'app-erp-04',8443,'TCP','HTTPS','OUTBOUND',25,22500,    user('ws-exec-51'),'Kerberos','safari.exe','','','','https://erp.corp.local/exec','app-erp-04','','OFF-3000',7,''),
  qr(14, 5002,'HTTPS Web Access','Web',2,9,5,1,           ts(6,28), 'ws-exec-52',60222,'app-erp-04',8443,'TCP','HTTPS','OUTBOUND',20,17600,    user('ws-exec-52'),'Kerberos','chrome.exe','','','','https://erp.corp.local/fin','app-erp-04','','OFF-3000',6,''),
  qr(15, 5005,'SMTP Email Relay','Email',2,9,5,1,         ts(6,30), 'ws-finance-21',49255,'mail-01',25,'TCP','SMTP-TLS','OUTBOUND',15,12288,   user('ws-finance-21'),'Kerberos','outlook.exe','','','','','','','','OFF-3000',8,''),
  qr(16, 5000,'Windows SMB Connection','Access',2,9,5,2,  ts(6,32), 'ws-finance-25',63100,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',8,6144,  user('ws-finance-25'),'Kerberos','excel.exe','','','','','','fs-payroll-01','','OFF-3000',15,''),
  qr(17, 5002,'HTTPS Web Access','Web',2,9,5,1,           ts(6,34), 'ws-hr-33',58774,'app-crm-05',8443,'TCP','HTTPS','OUTBOUND',20,16000,     user('ws-hr-33'),'Kerberos','chrome.exe','','','','https://crm.corp.local/','app-crm-05','','OFF-3000',8,''),
  qr(18, 5001,'MS-SQL Connection','Database',2,9,5,2,     ts(6,36), 'ws-finance-24',54321,'db-finance-03',1433,'TCP','MSSQL','OUTBOUND',7,5120, user('ws-finance-24'),'Kerberos','ssms.exe','','','','','','db-finance-03','','OFF-3000',12,''),
  qr(19, 5003,'Kerberos Authentication','Authentication',2,9,8,1,   ts(6,38), 'ws-it-41',49250,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',4,1024, user('ws-it-41'),'Kerberos','lsass.exe','','','','','','auth-dc-01','','OFF-3000',5,''),
  // ── IT Admin activity ──────────────────────────────────────────────────────
  qr(20, 5006,'SSH Admin Session','Management',2,9,8,2,   ts(6,40), 'ws-it-41',54922,'ops-jump-55',22,'TCP','SSH','OUTBOUND',32,65536,         user('ws-it-41'),'RSA-Key','putty.exe','','','','','','','','OFF-3001',20,''),
  qr(21, 5006,'SSH Admin Session','Management',2,9,8,2,   ts(6,42), 'ws-it-42',55104,'ops-jump-55',22,'TCP','SSH','OUTBOUND',28,57344,         user('ws-it-42'),'RSA-Key','putty.exe','','','','','','','','OFF-3001',18,''),
  qr(22, 5007,'RDP Session Established','Management',2,9,8,2, ts(6,44), 'ws-it-41',59987,'auth-dc-01',3389,'TCP','RDP','OUTBOUND',45,92160,   user('ws-it-41'),'NLA','mstsc.exe','','','','','','','','OFF-3001',22,''),
  // ── Backup operations ──────────────────────────────────────────────────────
  qr(23, 5008,'File Backup Transfer','Storage',2,9,5,1,   ts(7,0),  'backup-01',49400,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',320,524288,   '','','backup-agent.exe','','','','','','','','OFF-3000',10,''),
  qr(24, 5008,'File Backup Transfer','Storage',2,9,5,1,   ts(7,5),  'backup-01',49401,'fs-hr-02',445,'TCP','SMB','OUTBOUND',280,458752,        '','','backup-agent.exe','','','','','','','','OFF-3000',10,''),
  qr(25, 5008,'File Backup Transfer','Storage',2,9,5,1,   ts(7,10), 'backup-01',49402,'db-finance-03',1433,'TCP','MSSQL','OUTBOUND',180,294912,'','','backup-agent.exe','','','','','','','','OFF-3000',10,''),
  // ── Normal user activity continues ─────────────────────────────────────────
  qr(26, 5002,'HTTPS Web Access','Web',2,9,5,1,           ts(7,15), 'ws-finance-21',58900,'app-erp-04',8443,'TCP','HTTPS','OUTBOUND',22,19200, user('ws-finance-21'),'Kerberos','chrome.exe','','','','https://erp.corp.local/payroll','app-erp-04','','OFF-3000',9,''),
  qr(27, 5000,'Windows SMB Connection','Access',2,9,5,2,  ts(7,20), 'ws-hr-31',64200,'fs-hr-02',445,'TCP','SMB','OUTBOUND',11,8192,            user('ws-hr-31'),'Kerberos','word.exe','','','','','','fs-hr-02','','OFF-3000',14,''),
  qr(28, 5005,'SMTP Email Relay','Email',2,9,5,1,         ts(7,25), 'ws-exec-51',49356,'mail-01',25,'TCP','SMTP-TLS','OUTBOUND',18,15360,      user('ws-exec-51'),'Kerberos','outlook.exe','','','','','','','','OFF-3000',7,''),
  qr(29, 5004,'DNS Query Resolved','DNS',2,9,5,1,         ts(7,28), 'ws-finance-26',53,'auth-dc-01',53,'UDP','DNS','OUTBOUND',2,256,           user('ws-finance-26'),'','','','','','','','','update.microsoft.com','OFF-3000',4,''),
  // ── bsmith starts accessing payroll data (still looks normal) ──────────────
  qr(30, 5000,'Windows SMB Connection','Access',2,9,5,2,  ts(7,30), 'ws-finance-26',58400,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',12,8192,  user('ws-finance-26'),'Kerberos','explorer.exe','','','','','','fs-payroll-01','','OFF-3000',17,''),
  qr(31, 5001,'MS-SQL Connection','Database',2,9,5,2,     ts(7,35), 'ws-finance-26',52100,'db-finance-03',1433,'TCP','MSSQL','OUTBOUND',8,5632, user('ws-finance-26'),'Kerberos','ssms.exe','','','','','','db-finance-03','','OFF-3000',12,''),
  // ── External port scan begins ──────────────────────────────────────────────
  qr(32, 6001,'External Port Scan Detected','Recon',7,9,9,7,       ts(9,0),  'shodan-scan-156',51000,'ops-jump-55',22,'TCP','SSH','INBOUND',6,360,    '','','','','','','','','','','OFF-4000',72,QR_RAW_SCAN('shodan-scan-156','ops-jump-55',22,'SSH')),
  qr(33, 6001,'External Port Scan Detected','Recon',7,9,9,7,       ts(9,0,15),'shodan-scan-156',51001,'ops-jump-55',3389,'TCP','RDP','INBOUND',4,240,  '','','','','','','','','','','OFF-4000',68,QR_RAW_SCAN('shodan-scan-156','ops-jump-55',3389,'RDP')),
  qr(34, 6001,'External Port Scan Detected','Recon',6,9,9,6,       ts(9,1),  'shodan-scan-156',51002,'fw-edge-01',443,'TCP','HTTPS','INBOUND',3,180,   '','','','','','','','','','','OFF-4000',61,QR_RAW_SCAN('shodan-scan-156','fw-edge-01',443,'HTTPS')),
  qr(35, 6001,'External Port Scan Detected','Recon',7,9,9,7,       ts(9,1,30),'shodan-scan-156',51003,'fs-payroll-01',445,'TCP','SMB','INBOUND',4,240, '','','','','','','','','','','OFF-4001',80,QR_RAW_SCAN('shodan-scan-156','fs-payroll-01',445,'SMB')),
  qr(36, 6002,'External Firewall Deny','Firewall',5,9,9,5,         ts(9,2),  'shodan-scan-156',51004,'fw-edge-01',8080,'TCP','HTTP','INBOUND',2,120,   '','','','','','','','','','','OFF-4000',55,'Firewall DENY: 45.33.32.156:51004 -> fw-edge-01:8080 [DROP]'),
  qr(37, 6002,'External Firewall Deny','Firewall',5,9,9,5,         ts(9,2,30),'shodan-scan-156',51005,'web-dmz-01',80,'TCP','HTTP','INBOUND',2,120,   '','','','','','','','','','','OFF-4000',50,'Firewall DENY: 45.33.32.156:51005 -> web-dmz-01:80 [DROP]'),
  qr(38, 6001,'External Port Scan Detected','Recon',6,9,9,6,       ts(9,3),  'shodan-scan-156',51010,'web-dmz-01',443,'TCP','HTTPS','INBOUND',3,180,   '','','','','','','','','','','OFF-4000',62,QR_RAW_SCAN('shodan-scan-156','web-dmz-01',443,'HTTPS')),
  // ── SSH Brute Force ────────────────────────────────────────────────────────
  qr(39, 6003,'SSH Brute Force Detected','Brute Force',8,9,9,8,    ts(12,0), 'tor-exit-42',54001,'ops-jump-55',22,'TCP','SSH','INBOUND',12,1440,  '','','','','','','','','','','OFF-4002',85,'SSH BF: 185.220.101.42 -> ops-jump-55:22 attempt #1 [failed]'),
  qr(40, 6003,'SSH Brute Force Detected','Brute Force',8,9,9,8,    ts(12,0,30),'tor-exit-42',54002,'ops-jump-55',22,'TCP','SSH','INBOUND',12,1440,'','','','','','','','','','','OFF-4002',85,'SSH BF: 185.220.101.42 -> ops-jump-55:22 attempt #2 [failed]'),
  qr(41, 6003,'SSH Brute Force Detected','Brute Force',8,9,9,8,    ts(12,1), 'tor-exit-42',54003,'ops-jump-55',22,'TCP','SSH','INBOUND',12,1440,  '','','','','','','','','','','OFF-4002',85,'SSH BF: 185.220.101.42 -> ops-jump-55:22 attempt #3 [failed]'),
  qr(42, 6003,'SSH Brute Force Detected','Brute Force',8,9,9,8,    ts(12,1,30),'tor-exit-42',54004,'ops-jump-55',22,'TCP','SSH','INBOUND',12,1440,'','','','','','','','','','','OFF-4002',85,'SSH BF: 185.220.101.42 -> ops-jump-55:22 attempt #4 [failed]'),
  qr(43, 6004,'SSH Auth Success After Failures','Brute Force',9,9,9,9, ts(12,2),'tor-exit-42',54005,'ops-jump-55',22,'TCP','SSH','INBOUND',20,2560, 'root','password','bash','','','','','','','','OFF-4002',92,'SSH BF SUCCESS: 185.220.101.42 -> ops-jump-55:22 after 4 failures [CRITICAL]'),
  // ── C2 Beacon from compromised ws-finance-26 ───────────────────────────────
  qr(44, 6005,'C2 Beacon Detected','Malware',9,9,9,9,              ts(10,0), 'ws-finance-26',55000,'c2-server-50',443,'TCP','HTTPS','OUTBOUND',8,4096,  user('ws-finance-26'),'','chrome.exe','','','','https://203.0.113.50/beacon','','','','OFF-4003',91,'C2 Beacon: 10.10.10.26 -> 203.0.113.50:443 [TLS beaconing every 5min]'),
  qr(45, 6005,'C2 Beacon Detected','Malware',9,9,9,9,              ts(10,5), 'ws-finance-26',55001,'c2-server-50',443,'TCP','HTTPS','OUTBOUND',8,4096,  user('ws-finance-26'),'','chrome.exe','','','','https://203.0.113.50/beacon','','','','OFF-4003',91,'C2 Beacon: 10.10.10.26 -> 203.0.113.50:443 interval#2'),
  qr(46, 6005,'C2 Beacon Detected','Malware',9,9,9,9,              ts(10,10),'ws-finance-26',55002,'c2-server-50',443,'TCP','HTTPS','OUTBOUND',8,4096,  user('ws-finance-26'),'','chrome.exe','','','','https://203.0.113.50/beacon','','','','OFF-4003',91,'C2 Beacon: 10.10.10.26 -> 203.0.113.50:443 interval#3'),
  qr(47, 6005,'C2 Beacon Detected','Malware',9,9,9,9,              ts(10,15),'ws-finance-26',55003,'c2-server-50',443,'TCP','HTTPS','OUTBOUND',8,4096,  user('ws-finance-26'),'','chrome.exe','','','','https://203.0.113.50/beacon','','','','OFF-4003',91,'C2 Beacon: 10.10.10.26 -> 203.0.113.50:443 interval#4'),
  // ── Data exfiltration by bsmith (insider threat) ───────────────────────────
  qr(48, 6006,'Large Data Transfer Outbound','Exfil',8,9,9,8,      ts(13,0), 'ws-finance-26',58800,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',850,1310720, user('ws-finance-26'),'Kerberos','robocopy.exe','robocopy \\\\fs-payroll-01\\payroll C:\\Users\\bsmith\\AppData\\Temp\\p /E','','','','','','','OFF-4004',88,'LARGE SMB TRANSFER: ws-finance-26 bulk-reading fs-payroll-01 1.25MB [unusual volume]'),
  qr(49, 6006,'Large Data Transfer Outbound','Exfil',8,9,9,8,      ts(13,10),'ws-finance-26',58801,'db-finance-03',1433,'TCP','MSSQL','OUTBOUND',620,1048576, user('ws-finance-26'),'Kerberos','sqlcmd.exe','sqlcmd -S db-finance-03 -Q "SELECT * FROM payroll.dbo.employee_compensation"','','','','','','','OFF-4004',87,'MSSQL mass SELECT: ws-finance-26 reading all payroll data [1MB unusual for user]'),
  qr(50, 6006,'Large Data Transfer Outbound','Exfil',9,9,9,9,      ts(13,20),'ws-finance-26',55100,'c2-server-50',443,'TCP','HTTPS','OUTBOUND',1240,2097152, user('ws-finance-26'),'','chrome.exe','','','','','','','','OFF-4003',96,'DATA EXFIL: ws-finance-26 uploading 2MB to 203.0.113.50 [C2 upload pattern]'),
  // ── Lateral movement attempt ───────────────────────────────────────────────
  qr(51, 6007,'Lateral Movement Detected','LateralMovement',9,9,9,9, ts(15,0),'ws-finance-26',49500,'auth-dc-01',445,'TCP','SMB','OUTBOUND',25,20480, user('ws-finance-26'),'Kerberos','cmd.exe','net use \\\\auth-dc-01\\admin$ /user:administrator','','','','','auth-dc-01','','OFF-4005',95,'LATERAL MOVEMENT: ws-finance-26 probing auth-dc-01 admin share [PtH attempt]'),
  qr(52, 6007,'Lateral Movement Detected','LateralMovement',9,9,9,9, ts(15,5),'ws-finance-26',49501,'fs-hr-02',445,'TCP','SMB','OUTBOUND',18,14336,   user('ws-finance-26'),'Kerberos','cmd.exe','net use \\\\fs-hr-02\\c$ /user:administrator','','','','','fs-hr-02','','OFF-4005',90,'LATERAL MOVEMENT: ws-finance-26 accessing HR server admin share'),
  qr(53, 6007,'Lateral Movement Detected','LateralMovement',8,9,9,8, ts(15,10),'ws-finance-26',49502,'db-hr-06',1433,'TCP','MSSQL','OUTBOUND',15,12288, user('ws-finance-26'),'Kerberos','sqlcmd.exe','sqlcmd -S db-hr-06 -Q "SELECT * FROM hr.dbo.personnel"','','','','','db-hr-06','','OFF-4005',87,'LATERAL MOVEMENT: ws-finance-26 querying HR DB (out-of-scope access)'),
  // ── Rogue device attempting NAC bypass ─────────────────────────────────────
  qr(54, 6008,'Rogue Device NAC Bypass Attempt','NAC',7,9,8,7,     ts(16,0), 'rogue-device',52000,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',4,1024, '','','','','','','','','','','OFF-4006',75,'NAC BYPASS: Unknown MAC DE:AD:BE:EF:CA:FE on VLAN 10 attempting Kerberos auth'),
  qr(55, 6009,'Policy Violation Access Attempt','Authorization',6,9,8,6, ts(16,10),'ws-finance-23',54888,'db-hr-06',1433,'TCP','MSSQL','OUTBOUND',4,1024, user('ws-finance-23'),'Kerberos','ssms.exe','','','','','','db-hr-06','','OFF-4007',70,'POLICY VIOLATION: Finance user tpatel attempting access to HR DB (denied by APIC)'),
  qr(56, 6009,'Policy Violation Access Attempt','Authorization',6,9,8,6, ts(16,12),'ws-finance-21',54899,'db-hr-06',1433,'TCP','MSSQL','OUTBOUND',4,1024, user('ws-finance-21'),'Kerberos','ssms.exe','','','','','','db-hr-06','','OFF-4007',68,'POLICY VIOLATION: Finance user jdavis attempting access to HR DB (denied by APIC)'),
  // ── VPN remote access ──────────────────────────────────────────────────────
  qr(57, 5009,'VPN Tunnel Established','VPN',2,9,7,2,              ts(8,0),  'vpn-gw-01',4500,'azure-ad',443,'UDP','IKEv2','OUTBOUND',15,8192,   'jdavis@corp.local','Cert+MFA','vpnd.exe','','','','','','','','OFF-3000',18,''),
  qr(58, 5009,'VPN Tunnel Established','VPN',2,9,7,2,              ts(8,5),  'vpn-gw-01',4500,'azure-ad',443,'UDP','IKEv2','OUTBOUND',15,8192,   'mchen@corp.local','Cert+MFA','vpnd.exe','','','','','','','','OFF-3000',17,''),
  // ── DNS anomalies ──────────────────────────────────────────────────────────
  qr(59, 6010,'DNS Tunneling Suspected','DNS',7,8,8,7,             ts(10,20),'ws-finance-26',53,'auth-dc-01',53,'UDP','DNS','OUTBOUND',12,3072, user('ws-finance-26'),'','','','','','','','','update.windowsdefender-security.com','OFF-4003',76,'DNS TUNNEL: ws-finance-26 querying suspicious long subdomain [C2 DNS exfil]'),
  qr(60, 6010,'DNS Tunneling Suspected','DNS',7,8,8,7,             ts(10,25),'ws-finance-26',53,'auth-dc-01',53,'UDP','DNS','OUTBOUND',14,3584, user('ws-finance-26'),'','','','','','','','','aGVsbG8td29ybGQ.update.windowsdefender-security.com','OFF-4003',78,'DNS TUNNEL: encoded subdomain exfil attempt #2'),
  // ── Windows Update / legitimate external ───────────────────────────────────
  qr(61, 5010,'Windows Update Download','Patching',2,9,5,1,        ts(8,30), 'ws-finance-21',60000,'microsoft-update',443,'TCP','HTTPS','OUTBOUND',180,294912, user('ws-finance-21'),'','svchost.exe','','','','https://update.microsoft.com/','','','','OFF-3000',6,''),
  qr(62, 5010,'Windows Update Download','Patching',2,9,5,1,        ts(8,32), 'ws-finance-22',60001,'microsoft-update',443,'TCP','HTTPS','OUTBOUND',165,270336, user('ws-finance-22'),'','svchost.exe','','','','https://update.microsoft.com/','','','','OFF-3000',6,''),
  qr(63, 5010,'Windows Update Download','Patching',2,9,5,1,        ts(8,34), 'ws-hr-31',60002,'microsoft-update',443,'TCP','HTTPS','OUTBOUND',155,253952, user('ws-hr-31'),'','svchost.exe','','','','https://update.microsoft.com/','','','','OFF-3000',6,''),
  // ── More normal activity ───────────────────────────────────────────────────
  qr(64, 5002,'HTTPS Web Access','Web',2,9,5,1,                    ts(9,30), 'ws-it-42',60200,'app-crm-05',8443,'TCP','HTTPS','OUTBOUND',20,16000, user('ws-it-42'),'Kerberos','chrome.exe','','','','https://crm.corp.local/admin','app-crm-05','','OFF-3000',9,''),
  qr(65, 5006,'SSH Admin Session','Management',2,9,8,2,            ts(11,0), 'ws-it-42',55200,'auth-dc-02',22,'TCP','SSH','OUTBOUND',30,61440, user('ws-it-42'),'RSA-Key','putty.exe','','','','','','','','OFF-3001',19,''),
  qr(66, 5000,'Windows SMB Connection','Access',2,9,5,2,           ts(11,10),'ws-finance-23',63400,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',10,7168, user('ws-finance-23'),'Kerberos','excel.exe','','','','','','fs-payroll-01','','OFF-3000',15,''),
  qr(67, 5001,'MS-SQL Connection','Database',2,9,5,2,              ts(11,20),'ws-finance-25',54500,'db-finance-03',1433,'TCP','MSSQL','OUTBOUND',8,5632, user('ws-finance-25'),'Kerberos','ssms.exe','','','','','','db-finance-03','','OFF-3000',11,''),
  qr(68, 5002,'HTTPS Web Access','Web',2,9,5,1,                    ts(11,30),'ws-hr-33',59100,'app-crm-05',8443,'TCP','HTTPS','OUTBOUND',18,14400, user('ws-hr-33'),'Kerberos','firefox.exe','','','','https://crm.corp.local/hr','app-crm-05','','OFF-3000',8,''),
  qr(69, 5003,'Kerberos Authentication','Authentication',2,9,8,1,  ts(11,40),'ws-exec-51',49300,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',4,1024, user('ws-exec-51'),'Kerberos','lsass.exe','','','','','','auth-dc-01','','OFF-3000',5,''),
  qr(70, 5011,'NTP Sync','Infrastructure',1,9,5,1,                 ts(7,0),  'sw-dist-01',123,'auth-dc-01',123,'UDP','NTP','OUTBOUND',2,128, '','','','','','','','','','','OFF-3000',2,''),
  qr(71, 5011,'NTP Sync','Infrastructure',1,9,5,1,                 ts(7,0),  'sw-dist-02',123,'auth-dc-01',123,'UDP','NTP','OUTBOUND',2,128, '','','','','','','','','','','OFF-3000',2,''),
  // ── Afternoon normal activity ──────────────────────────────────────────────
  qr(72, 5000,'Windows SMB Connection','Access',2,9,5,2,           ts(14,0), 'ws-hr-32',62300,'fs-hr-02',445,'TCP','SMB','OUTBOUND',9,6656, user('ws-hr-32'),'Kerberos','explorer.exe','','','','','','fs-hr-02','','OFF-3000',13,''),
  qr(73, 5002,'HTTPS Web Access','Web',2,9,5,1,                    ts(14,5), 'ws-finance-23',61000,'app-erp-04',8443,'TCP','HTTPS','OUTBOUND',22,18400, user('ws-finance-23'),'Kerberos','chrome.exe','','','','https://erp.corp.local/report','app-erp-04','','OFF-3000',8,''),
  qr(74, 5005,'SMTP Email Relay','Email',2,9,5,1,                  ts(14,10),'ws-hr-31',49400,'mail-01',25,'TCP','SMTP-TLS','OUTBOUND',14,12288, user('ws-hr-31'),'Kerberos','outlook.exe','','','','','','','','OFF-3000',7,''),
  qr(75, 5000,'Windows SMB Connection','Access',2,9,5,2,           ts(14,15),'ws-finance-25',64100,'fs-payroll-01',445,'TCP','SMB','OUTBOUND',11,8192, user('ws-finance-25'),'Kerberos','excel.exe','','','','','','fs-payroll-01','','OFF-3000',16,''),
  // ── Malware detection on compromised host ──────────────────────────────────
  qr(76, 6011,'Malware Process Detected','Malware',9,9,9,9,        ts(13,5), 'ws-finance-26',0,'',0,'','','','',0,0, user('ws-finance-26'),'','lsass.exe','lsass.exe -dump credentials.dmp','credentials.dmp','5d41402abc4b2a76b9719d911017c592','e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','','','','','OFF-4004',94,'MALWARE: ws-finance-26 process lsass credential dump detected [mimikatz pattern]'),
  qr(77, 6012,'Suspicious Registry Write','Malware',8,9,9,8,       ts(13,7), 'ws-finance-26',0,'',0,'','','','',0,0, user('ws-finance-26'),'','reg.exe','reg add HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run /v updater /d C:\\Windows\\Temp\\svcupdate.exe','C:\\Windows\\Temp\\svcupdate.exe','','','','','','','OFF-4004',89,'PERSISTENCE: ws-finance-26 writing Run key for svcupdate.exe'),
  qr(78, 6013,'Suspicious PowerShell Execution','Malware',8,9,9,8, ts(13,12),'ws-finance-26',0,'',0,'','','','',0,0, user('ws-finance-26'),'','powershell.exe','powershell.exe -enc UwB0AGEAcgB0AC0AUAByAG8AYwBlAHMAcwAgAC0ATgBvAG4AZQB3AGkAbgBkAG8AdwA=','','','','','','','','OFF-4004',91,'EXECUTION: ws-finance-26 encoded PowerShell [Base64 decode: Start-Process -Nonewindo...]'),
  // ── Threat actor reconnaissance ────────────────────────────────────────────
  qr(79, 6001,'External Reconnaissance','Recon',6,8,9,6,           ts(17,0), 'threat-actor-30',55500,'web-dmz-01',443,'TCP','HTTPS','INBOUND',8,4096, '','','','','','','https://web-dmz-01/wp-admin','','','','OFF-4008',65,'RECON: 198.51.100.30 probing web-dmz-01 admin panel'),
  qr(80, 6001,'External Reconnaissance','Recon',6,8,9,6,           ts(17,2), 'threat-actor-30',55501,'web-dmz-01',443,'TCP','HTTPS','INBOUND',12,6144, '','','','','','','https://web-dmz-01/.env','','','','OFF-4008',68,'RECON: 198.51.100.30 directory traversal attempt on web-dmz-01'),
  // ── End of day normal activity ─────────────────────────────────────────────
  qr(81, 5002,'HTTPS Web Access','Web',2,9,5,1,                    ts(17,30),'ws-finance-22',61200,'app-erp-04',8443,'TCP','HTTPS','OUTBOUND',20,17000, user('ws-finance-22'),'Kerberos','chrome.exe','','','','https://erp.corp.local/close','app-erp-04','','OFF-3000',8,''),
  qr(82, 5000,'Windows SMB Connection','Access',2,9,5,2,           ts(17,35),'ws-hr-33',63800,'fs-hr-02',445,'TCP','SMB','OUTBOUND',8,5632, user('ws-hr-33'),'Kerberos','explorer.exe','','','','','','fs-hr-02','','OFF-3000',13,''),
  qr(83, 5003,'Kerberos Authentication','Authentication',2,9,8,1,  ts(17,40),'ws-finance-24',49600,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',4,1024, user('ws-finance-24'),'Kerberos','lsass.exe','','','','','','auth-dc-01','','OFF-3000',5,''),
  qr(84, 5012,'User Logoff Event','Authentication',1,9,5,1,        ts(17,45),'ws-finance-21',0,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',2,256, user('ws-finance-21'),'Kerberos','lsass.exe','','','','','','','','OFF-3000',3,'User jdavis@corp.local logged off ws-finance-21'),
  qr(85, 5012,'User Logoff Event','Authentication',1,9,5,1,        ts(17,50),'ws-hr-31',0,'auth-dc-01',88,'TCP','Kerberos','OUTBOUND',2,256, user('ws-hr-31'),'Kerberos','lsass.exe','','','','','','','','OFF-3000',3,'User scode@corp.local logged off ws-hr-31'),
];

function QR_RAW_SCAN(src, dst, port, app) { return `Port Scan: ${EXT[src]?.ip||src} -> ${H[dst]?.ip||dst}:${port} [${app}] Nmap/7.93`; }

// ─────────────────────────────────────────────────────────────────────────────
// 2. SNA Flows (79 rows) — 96-column StealthWatch format
// ─────────────────────────────────────────────────────────────────────────────
const SNA_HEADERS = ['Flow ID','Domain','Start','End','Duration','Flow Action','Subject ASN','Subject ASN Assignment','Subject Byte Ratio','Subject IP Address','Subject Hostname','Subject MAC Address','Subject MAC Vendor','Subject NAT','Subject NAT Hostname','Subject NAT Port','Subject Orientation','Subject Port/Protocol','Subject Host Groups','Subject Location','Subject User','Subject Bytes','Subject Byte Rate','Subject Interfaces','Subject Packets','Subject Packet Rate','Subject Payload','Subject Process Account','Subject Process Name','Subject File Hash','Subject Parent Process Name','Subject Parent File Hash','Subject TrustSec ID','Subject TrustSec Name','Subject FIN Packets','Subject RST Packets','Subject SYN Packets','Subject SYN/ACK Packets','Appliance','Application','Application (Flow Sensor)','Application (NBAR)','Application (PacketShaper)','Application (Palo Alto Networks)','Byte Rate','Total Bytes','Packet Rate','Total Packets','Total Traffic (bps)','protocol','Service','TCP Connections','TCP Retransmissions','TCP Retransmission Ratio','MPLS Label','RTT Average','RTT Maximum','RTT Minimum','SRT Average','SRT Maximum','SRT Minimum','VLAN ID','Encryption TLS/SSL Version','Encryption Key Exchange','Encryption Authentication Algorithm','Encryption Algorithm and Key Length','Encryption MAC','Peer ASN','Peer ASN Assignment','Peer Byte Ratio','Peer IP Address','Peer Hostname','Peer MAC Address','Peer MAC Vendor','Peer NAT','Peer NAT Hostname','Peer NAT Port','Peer Orientation','Peer Port/Protocol','Peer Host Groups','Peer Location','Peer User','Peer Bytes','Peer Byte Rate','Peer Interfaces','Peer Packets','Peer Packet Rate','Peer Payload','Peer Process Account','Peer Process Name','Peer File Hash','Peer TrustSec Name','Peer FIN Packets','Peer RST Packets','Peer SYN Packets','Peer SYN/ACK Packets'];

let snaId = 24200000000;
function sna(startH, startM, durSec, action, subj, subjPort, subjProto, peer, peerPort, subjBytes, peerBytes, app, vlan, hgSubj, hgPeer, trustSecSubj, trustSecPeer, encType='', encKex='', encAlg='') {
  const sh = H[subj] || EXT[subj] || {};
  const ph = H[peer] || EXT[peer] || {};
  const sb = subjBytes; const pb = peerBytes;
  const tbytes = sb + pb;
  const spkts = Math.ceil(sb/512); const ppkts = Math.ceil(pb/512);
  const tpkts = spkts + ppkts;
  const byteRate = Math.round(tbytes / durSec);
  const start = ts(startH, startM);
  const endT = new Date(new Date(start).getTime() + durSec*1000).toISOString();
  const iface = '10.10.70.1(ifIndex-10), 10.10.70.1(ifIndex-110)';
  const peerIface = '10.10.70.1(ifIndex-20), 10.10.70.1(ifIndex-120)';
  const id = snaId++;
  const isExt = !!(EXT[subj] || EXT[peer]);
  const subjAsn = isExt ? (EXT[subj]?.ip ? '65535' : '64512') : '64512';
  const peerAsn = isExt ? (EXT[peer]?.ip ? '65535' : '64512') : '64512';
  return {
    'Flow ID': id, 'Domain': 'CORP', 'Start': start, 'End': endT,
    'Duration': `${durSec}s`, 'Flow Action': action,
    'Subject ASN': subjAsn, 'Subject ASN Assignment': subjAsn==='64512'?'CorpNet':'Internet',
    'Subject Byte Ratio': Math.round(sb/tbytes*100*100)/100,
    'Subject IP Address': sh.ip||subj, 'Subject Hostname': subj, 'Subject MAC Address': sh.mac||'',
    'Subject MAC Vendor': sh.mac?'Corp-NIC':'', 'Subject NAT':'','Subject NAT Hostname':'','Subject NAT Port':'',
    'Subject Orientation': 'Client',
    'Subject Port/Protocol': `${subjPort}/${subjProto}`,
    'Subject Host Groups': hgSubj,
    'Subject Location': sh.country||'US', 'Subject User': sh.user||'',
    'Subject Bytes': fmtBytes(sb), 'Subject Byte Rate': fmtBytes(Math.round(sb/durSec)),
    'Subject Interfaces': iface,
    'Subject Packets': spkts, 'Subject Packet Rate': (spkts/durSec).toFixed(2),
    'Subject Payload':'','Subject Process Account':'','Subject Process Name':'','Subject File Hash':'',
    'Subject Parent Process Name':'','Subject Parent File Hash':'',
    'Subject TrustSec ID': sh.vlan||vlan||10, 'Subject TrustSec Name': trustSecSubj,
    'Subject FIN Packets':0,'Subject RST Packets':0,'Subject SYN Packets':1,'Subject SYN/ACK Packets':0,
    'Appliance': 'corp-stealthwatch-01 (10.10.80.50)',
    'Application': app+' (unclassified)', 'Application (Flow Sensor)':'','Application (NBAR)':'',
    'Application (PacketShaper)':'','Application (Palo Alto Networks)':'',
    'Byte Rate': fmtBytes(byteRate), 'Total Bytes': fmtBytes(tbytes),
    'Packet Rate': (tpkts/durSec).toFixed(2), 'Total Packets': tpkts,
    'Total Traffic (bps)': fmtBps(tbytes*8/durSec),
    'protocol': subjProto==='UDP'?'UDP':'TCP',
    'Service': app.toLowerCase().replace(/ /g,'-'),
    'TCP Connections': subjProto==='UDP'?'':1, 'TCP Retransmissions':subjProto==='UDP'?'':0,
    'TCP Retransmission Ratio':subjProto==='UDP'?'':'0.00',
    'MPLS Label':'','RTT Average':'','RTT Maximum':'','RTT Minimum':'',
    'SRT Average':'','SRT Maximum':'','SRT Minimum':'',
    'VLAN ID': vlan || sh.vlan || 10,
    'Encryption TLS/SSL Version': encType, 'Encryption Key Exchange': encKex,
    'Encryption Authentication Algorithm':'','Encryption Algorithm and Key Length': encAlg,
    'Encryption MAC':'',
    'Peer ASN': peerAsn, 'Peer ASN Assignment': peerAsn==='64512'?'CorpNet':'Internet',
    'Peer Byte Ratio': Math.round(pb/tbytes*100*100)/100,
    'Peer IP Address': ph.ip||peer, 'Peer Hostname': peer, 'Peer MAC Address': ph.mac||'',
    'Peer MAC Vendor': ph.mac?'Corp-NIC':'',
    'Peer NAT':'','Peer NAT Hostname':'','Peer NAT Port':'',
    'Peer Orientation': 'Server',
    'Peer Port/Protocol': `${peerPort}/${subjProto}`,
    'Peer Host Groups': hgPeer, 'Peer Location': ph.country||'US', 'Peer User': ph.user||'',
    'Peer Bytes': fmtBytes(pb), 'Peer Byte Rate': fmtBytes(Math.round(pb/durSec)),
    'Peer Interfaces': peerIface,
    'Peer Packets': ppkts, 'Peer Packet Rate': (ppkts/durSec).toFixed(2),
    'Peer Payload':'','Peer Process Account':'','Peer Process Name':'','Peer File Hash':'',
    'Peer TrustSec Name': trustSecPeer,
    'Peer FIN Packets':0,'Peer RST Packets':0,'Peer SYN Packets':0,'Peer SYN/ACK Packets':1,
  };
}

function fmtBytes(n) {
  if (n >= 1e9) return `${(n/1e9).toFixed(2)} G`;
  if (n >= 1e6) return `${(n/1e6).toFixed(2)} M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(2)} K`;
  return String(n);
}
function fmtBps(n) {
  if (n >= 1e9) return `${(n/1e9).toFixed(2)} G`;
  if (n >= 1e6) return `${(n/1e6).toFixed(2)} M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(2)} K`;
  return n.toFixed(2);
}

const snaRows = [
  // Normal Finance SMB flows
  sna(6,0,45,'permitted','ws-finance-21',49152,'TCP','fs-payroll-01',445,8190,65540,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(6,1,38,'permitted','ws-finance-22',49153,'TCP','fs-payroll-01',445,6140,49150,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(6,2,30,'permitted','ws-finance-23',49154,'TCP','db-finance-03',1433,4100,32770,'MSSQL',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Database'),
  sna(6,3,35,'permitted','ws-hr-31',49155,'TCP','fs-hr-02',445,5120,40960,'SMB',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-HR','Servers-FileShare'),
  sna(6,4,52,'permitted','ws-finance-21',49200,'TCP','app-erp-04',8443,18900,15240,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-Finance','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(6,5,48,'permitted','ws-finance-22',49201,'TCP','app-erp-04',8443,14400,11520,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-Finance','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(6,6,10,'permitted','ws-finance-23',49202,'TCP','auth-dc-01',88,1024,512,'Kerberos',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Finance','Servers-DC'),
  sna(6,7,12,'permitted','ws-hr-32',49203,'TCP','auth-dc-01',88,1024,512,'Kerberos',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-HR','Servers-DC'),
  sna(6,8,40,'permitted','ws-hr-32',61994,'TCP','fs-hr-02',445,6656,53248,'SMB',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-HR','Servers-FileShare'),
  sna(6,9,28,'permitted','ws-hr-31',51890,'TCP','db-hr-06',1433,3584,28672,'MSSQL',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-HR','Servers-Database'),
  sna(6,11,6,'permitted','ws-finance-24',49300,'UDP','auth-dc-01',53,256,128,'DNS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Finance','Servers-DC'),
  sna(6,13,6,'permitted','ws-finance-25',49301,'UDP','auth-dc-01',53,256,128,'DNS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Finance','Servers-DC'),
  sna(6,14,42,'permitted','ws-finance-24',57832,'TCP','fs-payroll-01',445,7168,57344,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(6,16,58,'permitted','ws-exec-51',60111,'TCP','app-erp-04',8443,22500,18000,'HTTPS',13,'EXEC_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-Executive','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(6,18,55,'permitted','ws-exec-52',60222,'TCP','app-erp-04',8443,17600,14080,'HTTPS',13,'EXEC_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-Executive','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(6,19,38,'permitted','ws-finance-21',49255,'TCP','mail-01',25,12288,8192,'SMTP',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','MAIL_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Mail','TLSv1.2','RSA','AES-128-CBC'),
  sna(6,20,40,'permitted','ws-finance-25',63100,'TCP','fs-payroll-01',445,6144,49152,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(6,21,52,'permitted','ws-hr-33',58774,'TCP','app-crm-05',8443,16000,12800,'HTTPS',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-HR','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(6,22,32,'permitted','ws-finance-24',54321,'TCP','db-finance-03',1433,5120,40960,'MSSQL',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Database'),
  sna(6,23,8,'permitted','ws-it-41',49250,'TCP','auth-dc-01',88,1024,512,'Kerberos',12,'IT_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','IT-Admins','Servers-DC'),
  // IT Admin SSH
  sna(6,24,280,'permitted','ws-it-41',54922,'TCP','ops-jump-55',22,65536,131072,'SSH',12,'IT_WORKSTATIONS, CORP_ENDPOINTS','OPS_SERVERS, CORP_SERVERS','IT-Admins','Servers-Ops','','',''),
  sna(6,26,240,'permitted','ws-it-42',55104,'TCP','ops-jump-55',22,57344,114688,'SSH',12,'IT_WORKSTATIONS, CORP_ENDPOINTS','OPS_SERVERS, CORP_SERVERS','IT-Admins','Servers-Ops','','',''),
  sna(6,28,600,'permitted','ws-it-41',59987,'TCP','auth-dc-01',3389,92160,184320,'RDP',12,'IT_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','IT-Admins','Servers-DC'),
  // Backup
  sna(7,0,1800,'permitted','backup-01',49400,'TCP','fs-payroll-01',445,524288,131072,'SMB',20,'BACKUP_SERVERS, CORP_SERVERS','FILE_SERVERS, CORP_SERVERS','Servers-Backup','Servers-FileShare'),
  sna(7,5,1500,'permitted','backup-01',49401,'TCP','fs-hr-02',445,458752,114688,'SMB',20,'BACKUP_SERVERS, CORP_SERVERS','FILE_SERVERS, CORP_SERVERS','Servers-Backup','Servers-FileShare'),
  sna(7,10,1200,'permitted','backup-01',49402,'TCP','db-finance-03',1433,294912,73728,'MSSQL',20,'BACKUP_SERVERS, CORP_SERVERS','DB_SERVERS, CORP_SERVERS','Servers-Backup','Servers-Database'),
  // Windows Update
  sna(8,30,420,'permitted','ws-finance-21',60000,'TCP','microsoft-update',443,294912,65536,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','INTERNET','Employees-Finance','External','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(8,32,380,'permitted','ws-finance-22',60001,'TCP','microsoft-update',443,270336,61440,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','INTERNET','Employees-Finance','External','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(8,34,360,'permitted','ws-hr-31',60002,'TCP','microsoft-update',443,253952,57344,'HTTPS',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','INTERNET','Employees-HR','External','TLSv1.3','ECDHE','AES-256-GCM'),
  // VPN
  sna(8,0,300,'permitted','vpn-gw-01',4500,'UDP','azure-ad',443,8192,4096,'IKEv2',30,'DMZ, VPN_GATEWAYS','INTERNET','DMZ-Services','External'),
  // External port scan
  sna(9,0,10,'denied','shodan-scan-156',51000,'TCP','ops-jump-55',22,360,0,'SSH',40,'INTERNET','OPS_SERVERS, CORP_SERVERS','External','Servers-Ops'),
  sna(9,0,10,'denied','shodan-scan-156',51001,'TCP','ops-jump-55',3389,240,0,'RDP',40,'INTERNET','OPS_SERVERS, CORP_SERVERS','External','Servers-Ops'),
  sna(9,1,8,'denied','shodan-scan-156',51002,'TCP','fw-edge-01',443,180,0,'HTTPS',70,'INTERNET','NETWORK_INFRA','External','Servers-Network'),
  sna(9,1,8,'denied','shodan-scan-156',51003,'TCP','fs-payroll-01',445,240,0,'SMB',20,'INTERNET','FILE_SERVERS, CORP_SERVERS','External','Servers-FileShare'),
  sna(9,2,5,'denied','shodan-scan-156',51004,'TCP','fw-edge-01',8080,120,0,'HTTP',70,'INTERNET','NETWORK_INFRA','External','Servers-Network'),
  sna(9,3,8,'denied','shodan-scan-156',51010,'TCP','web-dmz-01',443,180,0,'HTTPS',30,'INTERNET','DMZ_SERVERS','External','Servers-DMZ'),
  // SSH Brute Force
  sna(12,0,30,'permitted','tor-exit-42',54001,'TCP','ops-jump-55',22,1440,960,'SSH',40,'INTERNET, TOR_EXIT','OPS_SERVERS, CORP_SERVERS','External','Servers-Ops'),
  sna(12,0,30,'permitted','tor-exit-42',54002,'TCP','ops-jump-55',22,1440,960,'SSH',40,'INTERNET, TOR_EXIT','OPS_SERVERS, CORP_SERVERS','External','Servers-Ops'),
  sna(12,1,30,'permitted','tor-exit-42',54003,'TCP','ops-jump-55',22,1440,960,'SSH',40,'INTERNET, TOR_EXIT','OPS_SERVERS, CORP_SERVERS','External','Servers-Ops'),
  sna(12,1,30,'permitted','tor-exit-42',54004,'TCP','ops-jump-55',22,1440,960,'SSH',40,'INTERNET, TOR_EXIT','OPS_SERVERS, CORP_SERVERS','External','Servers-Ops'),
  sna(12,2,3600,'permitted','tor-exit-42',54005,'TCP','ops-jump-55',22,2560,192000,'SSH',40,'INTERNET, TOR_EXIT','OPS_SERVERS, CORP_SERVERS','External','Servers-Ops'), // successful brute force session
  // C2 Beacons (ws-finance-26 → 203.0.113.50) — regular 5-minute interval
  sna(10,0,60,'permitted','ws-finance-26',55000,'TCP','c2-server-50',443,4096,2048,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','INTERNET, THREAT_INTEL','Employees-Finance','External','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(10,5,60,'permitted','ws-finance-26',55001,'TCP','c2-server-50',443,4096,2048,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','INTERNET, THREAT_INTEL','Employees-Finance','External','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(10,10,60,'permitted','ws-finance-26',55002,'TCP','c2-server-50',443,4096,2048,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','INTERNET, THREAT_INTEL','Employees-Finance','External','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(10,15,60,'permitted','ws-finance-26',55003,'TCP','c2-server-50',443,4096,2048,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','INTERNET, THREAT_INTEL','Employees-Finance','External','TLSv1.3','ECDHE','AES-256-GCM'),
  // DNS tunnel
  sna(10,20,8,'permitted','ws-finance-26',59000,'UDP','auth-dc-01',53,3072,512,'DNS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Finance','Servers-DC'),
  sna(10,25,8,'permitted','ws-finance-26',59001,'UDP','auth-dc-01',53,3584,512,'DNS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Finance','Servers-DC'),
  // Data exfiltration (unusual large SMB reads + upload to C2)
  sna(13,0,300,'permitted','ws-finance-26',58800,'TCP','fs-payroll-01',445,1310720,131072,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(13,10,240,'permitted','ws-finance-26',58801,'TCP','db-finance-03',1433,1048576,104857,'MSSQL',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Database'),
  sna(13,20,180,'permitted','ws-finance-26',55100,'TCP','c2-server-50',443,2097152,131072,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','INTERNET, THREAT_INTEL','Employees-Finance','External','TLSv1.3','ECDHE','AES-256-GCM'),
  // Lateral movement
  sna(15,0,90,'permitted','ws-finance-26',49500,'TCP','auth-dc-01',445,20480,10240,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Finance','Servers-DC'),
  sna(15,5,60,'permitted','ws-finance-26',49501,'TCP','fs-hr-02',445,14336,7168,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(15,10,45,'permitted','ws-finance-26',49502,'TCP','db-hr-06',1433,12288,6144,'MSSQL',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Database'),
  // Rogue device
  sna(16,0,5,'denied','rogue-device',52000,'TCP','auth-dc-01',88,1024,0,'Kerberos',10,'UNKNOWN, FLAGGED','DC_SERVERS, CORP_SERVERS','Unknown-Device','Servers-DC'),
  // Policy violations
  sna(16,10,5,'denied','ws-finance-23',54888,'TCP','db-hr-06',1433,1024,0,'MSSQL',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Database'),
  sna(16,12,5,'denied','ws-finance-21',54899,'TCP','db-hr-06',1433,1024,0,'MSSQL',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Database'),
  // Afternoon normal
  sna(11,0,38,'permitted','ws-finance-23',63400,'TCP','fs-payroll-01',445,7168,57344,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(11,10,32,'permitted','ws-finance-25',54500,'TCP','db-finance-03',1433,5632,45056,'MSSQL',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DB_SERVERS, CORP_SERVERS','Employees-Finance','Servers-Database'),
  sna(11,20,50,'permitted','ws-hr-33',59100,'TCP','app-crm-05',8443,14400,11520,'HTTPS',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-HR','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(11,30,8,'permitted','ws-exec-51',49300,'TCP','auth-dc-01',88,1024,512,'Kerberos',13,'EXEC_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Executive','Servers-DC'),
  sna(11,40,52,'permitted','ws-it-42',60200,'TCP','app-crm-05',8443,16000,12800,'HTTPS',12,'IT_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','IT-Admins','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(11,50,280,'permitted','ws-it-42',55200,'TCP','auth-dc-02',22,61440,122880,'SSH',12,'IT_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','IT-Admins','Servers-DC'),
  sna(14,0,40,'permitted','ws-hr-32',62300,'TCP','fs-hr-02',445,6656,53248,'SMB',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-HR','Servers-FileShare'),
  sna(14,5,52,'permitted','ws-finance-23',61000,'TCP','app-erp-04',8443,18400,14720,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-Finance','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(14,10,35,'permitted','ws-hr-31',49400,'TCP','mail-01',25,12288,8192,'SMTP',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','MAIL_SERVERS, CORP_SERVERS','Employees-HR','Servers-Mail','TLSv1.2','RSA','AES-128-CBC'),
  sna(14,15,42,'permitted','ws-finance-25',64100,'TCP','fs-payroll-01',445,8192,65536,'SMB',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-Finance','Servers-FileShare'),
  sna(17,0,20,'denied','threat-actor-30',55500,'TCP','web-dmz-01',443,4096,0,'HTTPS',30,'INTERNET, THREAT_INTEL','DMZ_SERVERS','External','Servers-DMZ'),
  sna(17,2,25,'denied','threat-actor-30',55501,'TCP','web-dmz-01',443,6144,0,'HTTPS',30,'INTERNET, THREAT_INTEL','DMZ_SERVERS','External','Servers-DMZ'),
  sna(17,30,50,'permitted','ws-finance-22',61200,'TCP','app-erp-04',8443,17000,13600,'HTTPS',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','APP_SERVERS, CORP_SERVERS','Employees-Finance','Servers-App','TLSv1.3','ECDHE','AES-256-GCM'),
  sna(17,35,40,'permitted','ws-hr-33',63800,'TCP','fs-hr-02',445,5632,45056,'SMB',11,'HR_WORKSTATIONS, CORP_ENDPOINTS','FILE_SERVERS, CORP_SERVERS','Employees-HR','Servers-FileShare'),
  sna(17,40,8,'permitted','ws-finance-24',49600,'TCP','auth-dc-01',88,1024,512,'Kerberos',10,'FIN_WORKSTATIONS, CORP_ENDPOINTS','DC_SERVERS, CORP_SERVERS','Employees-Finance','Servers-DC'),
  // NTP
  sna(7,0,5,'permitted','sw-dist-01',123,'UDP','auth-dc-01',123,128,64,'NTP',70,'NETWORK_INFRA','DC_SERVERS, CORP_SERVERS','Servers-Network','Servers-DC'),
  sna(7,0,5,'permitted','sw-dist-02',123,'UDP','auth-dc-01',123,128,64,'NTP',70,'NETWORK_INFRA','DC_SERVERS, CORP_SERVERS','Servers-Network','Servers-DC'),
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Arista NDR Alerts/Flows (47 rows)
// ─────────────────────────────────────────────────────────────────────────────
const AR_HEADERS = ['alert_id','flow_id','alert_name','alert_type','severity','confidence','risk_score','start_time','end_time','src_ip','src_port','src_mac','src_hostname','src_country','dst_ip','dst_port','dst_mac','dst_hostname','dst_country','protocol','application','packets','bytes','dns_query','dns_response','http_method','http_host','http_uri','http_status','http_user_agent','tls_version','cipher_suite','ja3','ja3s','sni','filename','md5','sha256','ioc_match','malware_family','c2_activity','beaconing','lateral_movement','data_exfiltration','port_scanning','user_name','authentication_result','anomaly_score','geo_latitude','geo_longitude','mitre_technique','raw_metadata'];

let arId = 3000; let arFlId = 2020;
function ar(name, type, sev, conf, risk, startH, startM, startS=0, durSec=10, src, sport, dst, dport, proto, app, pkts, bytes, dns='', dnsR='', httpM='', httpH='', httpU='', httpSt='', ua='', tls='', cs='', ja3='', ja3s='', sni='', fname='', md5='', sha256='', ioc='no', malFam='', c2='no', beacon='no', lat='no', exfil='no', scan='no', uname='', authR='', anom=0, mitre='', extra='') {
  const sh = H[src] || EXT[src] || {};
  const dh = H[dst] || EXT[dst] || {};
  const start = ts(startH, startM, startS);
  const end = new Date(new Date(start).getTime() + durSec*1000).toISOString();
  return {
    alert_id: `AR-${arId++}`, flow_id: `SN-${arFlId++}`,
    alert_name: name, alert_type: type,
    severity: sev, confidence: conf, risk_score: risk,
    start_time: start, end_time: end,
    src_ip: sh.ip||src, src_port: sport, src_mac: sh.mac||'', src_hostname: src, src_country: sh.country||'US',
    dst_ip: dh.ip||dst, dst_port: dport, dst_mac: dh.mac||'', dst_hostname: dst, dst_country: dh.country||'US',
    protocol: proto, application: app, packets: pkts, bytes,
    dns_query: dns, dns_response: dnsR, http_method: httpM, http_host: httpH, http_uri: httpU,
    http_status: httpSt, http_user_agent: ua, tls_version: tls, cipher_suite: cs, ja3, ja3s, sni,
    filename: fname, md5, sha256, ioc_match: ioc, malware_family: malFam,
    c2_activity: c2, beaconing: beacon, lateral_movement: lat, data_exfiltration: exfil,
    port_scanning: scan, user_name: uname, authentication_result: authR,
    anomaly_score: anom, geo_latitude: sh.lat||(EXT[src]?.lat||''), geo_longitude: sh.lon||(EXT[src]?.lon||''),
    mitre_technique: mitre,
    raw_metadata: extra || `Arista NDR: ${name} ${sh.ip||src}->${dh.ip||dst}:${dport} [${type}]`
  };
}

const aristaRows = [
  // External port scan
  ar('Port Scan Detected','Reconnaissance','high',91,78, 9,0,0,10,'shodan-scan-156',51000,'ops-jump-55',22,'TCP','SSH',6,360,'','','','','','','Nmap/7.93','','','','','','','','','no','','no','no','no','no','yes','','failed',72,'','','T1046','Arista NDR: Port Scan shodan-scan-156->ops-jump-55:22'),
  ar('Port Scan Detected','Reconnaissance','high',88,75, 9,0,15,10,'shodan-scan-156',51001,'ops-jump-55',3389,'TCP','RDP',4,240,'','','','','','','Nmap/7.93','','','','','','','','','no','','no','no','no','no','yes','','failed',68,'','','T1046',''),
  ar('Port Scan Detected','Reconnaissance','medium',82,68, 9,1,0,8,'shodan-scan-156',51002,'fw-edge-01',443,'TCP','HTTPS',3,180,'','','','','','','Nmap/7.93','','','','','','','','','no','','no','no','no','no','yes','','failed',61,'','','T1046',''),
  ar('SMB Probe','Reconnaissance','high',87,80, 9,1,30,8,'shodan-scan-156',51003,'fs-payroll-01',445,'TCP','SMB',4,240,'','','','','','','','','','','','','','','','no','','no','no','no','no','yes','','failed',73,'','','T1046','Arista NDR: External SMB probe on payroll server'),
  ar('HTTP Directory Traversal','Reconnaissance','medium',75,65, 9,2,0,5,'shodan-scan-156',51004,'fw-edge-01',8080,'TCP','HTTP',2,120,'','','GET','','/.env','404','Nmap/7.93','','','','','','','','','no','','no','no','no','no','yes','','failed',60,'','','T1083',''),
  ar('External Web Probe','Reconnaissance','medium',72,62, 9,3,0,8,'shodan-scan-156',51010,'web-dmz-01',443,'TCP','HTTPS',3,180,'','','GET','web-dmz-01','/admin','403','Nmap/7.93','TLSv1.3','TLS_AES_256_GCM_SHA384','aad2b1d1b5a96b3d0d0f16d5e6e23f4e','','web-dmz-01','','','','no','','no','no','no','no','yes','','failed',59,'','','T1046',''),
  // SSH Brute Force
  ar('SSH Brute Force Attempt','BruteForce','high',95,83, 12,0,0,30,'tor-exit-42',54001,'ops-jump-55',22,'TCP','SSH',12,1440,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','root','failed',80,'','','T1110.001','Arista NDR: SSH BF attempt #1 from Tor exit node'),
  ar('SSH Brute Force Attempt','BruteForce','high',95,83, 12,0,30,30,'tor-exit-42',54002,'ops-jump-55',22,'TCP','SSH',12,1440,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','root','failed',80,'','','T1110.001','Arista NDR: SSH BF attempt #2 from Tor exit node'),
  ar('SSH Brute Force Attempt','BruteForce','high',95,83, 12,1,0,30,'tor-exit-42',54003,'ops-jump-55',22,'TCP','SSH',12,1440,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','root','failed',80,'','','T1110.001','Arista NDR: SSH BF attempt #3 from Tor exit node'),
  ar('SSH Brute Force Attempt','BruteForce','high',95,83, 12,1,30,30,'tor-exit-42',54004,'ops-jump-55',22,'TCP','SSH',12,1440,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','root','failed',80,'','','T1110.001','Arista NDR: SSH BF attempt #4 from Tor exit node'),
  ar('SSH Credential Compromise','BruteForce','critical',98,95, 12,2,0,3600,'tor-exit-42',54005,'ops-jump-55',22,'TCP','SSH',20,192000,'','','','','','','','','','','','','','','','no','','yes','no','no','no','no','root','success',94,'','','T1110.001','CRITICAL: SSH brute force SUCCESS - active session established'),
  // C2 Beacons
  ar('C2 Beacon Detected','Command-and-Control','critical',97,91, 10,0,0,60,'ws-finance-26',55000,'c2-server-50',443,'TCP','HTTPS',8,4096,'','','POST','203.0.113.50','/api/beacon','200','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120','TLSv1.3','TLS_AES_256_GCM_SHA384','a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6','b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7','203.0.113.50','','','','yes','Cobalt-Strike','yes','yes','no','no','no','bsmith@corp.local','','89,','','','T1071.001,T1571','Arista NDR: CobaltStrike beacon TLS JA3 match 203.0.113.50'),
  ar('C2 Beacon Detected','Command-and-Control','critical',97,91, 10,5,0,60,'ws-finance-26',55001,'c2-server-50',443,'TCP','HTTPS',8,4096,'','','POST','203.0.113.50','/api/beacon','200','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120','TLSv1.3','TLS_AES_256_GCM_SHA384','a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6','b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7','203.0.113.50','','','','yes','Cobalt-Strike','yes','yes','no','no','no','bsmith@corp.local','','89','','','T1071.001,T1571','Arista NDR: CobaltStrike beacon interval #2'),
  ar('C2 Beacon Detected','Command-and-Control','critical',97,91, 10,10,0,60,'ws-finance-26',55002,'c2-server-50',443,'TCP','HTTPS',8,4096,'','','POST','203.0.113.50','/api/beacon','200','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120','TLSv1.3','TLS_AES_256_GCM_SHA384','a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6','b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7','203.0.113.50','','','','yes','Cobalt-Strike','yes','yes','no','no','no','bsmith@corp.local','','89','','','T1071.001,T1571',''),
  ar('C2 Beacon Detected','Command-and-Control','critical',97,91, 10,15,0,60,'ws-finance-26',55003,'c2-server-50',443,'TCP','HTTPS',8,4096,'','','POST','203.0.113.50','/api/beacon','200','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120','TLSv1.3','TLS_AES_256_GCM_SHA384','a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6','b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7','203.0.113.50','','','','yes','Cobalt-Strike','yes','yes','no','no','no','bsmith@corp.local','','89','','','T1071.001,T1571',''),
  // DNS Tunneling
  ar('DNS Tunneling Detected','Exfiltration','high',88,76, 10,20,0,8,'ws-finance-26',59000,'auth-dc-01',53,'UDP','DNS',12,3072,'aGVsbG8td29ybGQ.update.windowsdefender-security.com','NXDOMAIN','','','','','','','','','','','','','','','yes','','no','no','no','yes','no','bsmith@corp.local','',75,'','','T1071.004','Arista NDR: DNS tunnel detected - encoded subdomain exfil'),
  ar('DNS Tunneling Detected','Exfiltration','high',88,76, 10,25,0,8,'ws-finance-26',59001,'auth-dc-01',53,'UDP','DNS',14,3584,'dGhpcyBpcyBhIHRlc3Q.update.windowsdefender-security.com','NXDOMAIN','','','','','','','','','','','','','','','yes','','no','no','no','yes','no','bsmith@corp.local','',78,'','','T1071.004','Arista NDR: DNS tunnel attempt #2'),
  // Credential Dump
  ar('Credential Dump Process Detected','CredentialAccess','critical',96,94, 13,5,0,30,'ws-finance-26',0,'',0,'','',0,0,'','','','','','','','','','','','','credentials.dmp','5d41402abc4b2a76b9719d911017c592','e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','no','Mimikatz','yes','no','no','no','no','bsmith@corp.local','',93,'','','T1003.001','Arista NDR: Mimikatz LSASS dump detected on ws-finance-26'),
  // Data Exfiltration
  ar('Bulk Data Read - SMB','Exfiltration','critical',94,88, 13,0,0,300,'ws-finance-26',58800,'fs-payroll-01',445,'TCP','SMB',850,1310720,'','','','','','','','','','','','','','','','yes','','no','no','no','yes','no','bsmith@corp.local','success',88,'','','T1039','Arista NDR: Bulk SMB read 1.25MB ws-finance-26->fs-payroll-01 [exfil pattern]'),
  ar('Bulk SQL Query Exfiltration','Exfiltration','critical',92,87, 13,10,0,240,'ws-finance-26',58801,'db-finance-03',1433,'TCP','MSSQL',620,1048576,'','','','','','','','','','','','','','','','yes','','no','no','no','yes','no','bsmith@corp.local','success',87,'','','T1213','Arista NDR: Mass SQL SELECT ws-finance-26->db-finance-03 payroll table exfil'),
  ar('Outbound Large Upload to C2','Exfiltration','critical',96,96, 13,20,0,180,'ws-finance-26',55100,'c2-server-50',443,'TCP','HTTPS',1240,2097152,'','','POST','203.0.113.50','/upload','200','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120','TLSv1.3','TLS_AES_256_GCM_SHA384','a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6','b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7','203.0.113.50','','','','yes','Cobalt-Strike','yes','yes','no','yes','no','bsmith@corp.local','',96,'','','T1041','Arista NDR: 2MB upload to C2 203.0.113.50 [data exfiltration confirmed]'),
  // Lateral Movement
  ar('Lateral Movement - Admin Share Access','LateralMovement','critical',93,95, 15,0,0,90,'ws-finance-26',49500,'auth-dc-01',445,'TCP','SMB',25,20480,'','','','','','','','','','','','','','','','no','','yes','no','yes','no','no','bsmith@corp.local','success',95,'','','T1021.002','Arista NDR: Admin share access FINANCE->DC [PtH indicator]'),
  ar('Lateral Movement - Cross-Segment SMB','LateralMovement','high',90,90, 15,5,0,60,'ws-finance-26',49501,'fs-hr-02',445,'TCP','SMB',18,14336,'','','','','','','','','','','','','','','','no','','yes','no','yes','no','no','bsmith@corp.local','success',90,'','','T1021.002','Arista NDR: Finance WS accessing HR FS admin share'),
  ar('Lateral Movement - Cross-Segment SQL','LateralMovement','high',88,87, 15,10,0,45,'ws-finance-26',49502,'db-hr-06',1433,'TCP','MSSQL',15,12288,'','','','','','','','','','','','','','','','no','','yes','no','yes','no','no','bsmith@corp.local','success',87,'','','T1078','Arista NDR: Finance user accessing out-of-scope HR database'),
  // Rogue device
  ar('Rogue Endpoint Detected','Reconnaissance','high',85,75, 16,0,0,5,'rogue-device',52000,'auth-dc-01',88,'TCP','Kerberos',4,1024,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','','failed',73,'','','T1078','Arista NDR: Unknown MAC DE:AD:BE:EF:CA:FE on VLAN 10 - rogue device NAC bypass'),
  // Policy violations
  ar('Cross-Segment Policy Violation','PolicyViolation','medium',80,70, 16,10,0,5,'ws-finance-23',54888,'db-hr-06',1433,'TCP','MSSQL',4,1024,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','tpatel@corp.local','failed',68,'','','T1078','Arista NDR: Finance->HR DB access denied by segmentation policy'),
  ar('Cross-Segment Policy Violation','PolicyViolation','medium',78,68, 16,12,0,5,'ws-finance-21',54899,'db-hr-06',1433,'TCP','MSSQL',4,1024,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','jdavis@corp.local','failed',65,'','','T1078','Arista NDR: Finance->HR DB access denied by segmentation policy'),
  // Threat actor web recon
  ar('External Web Application Probe','Reconnaissance','medium',78,65, 17,0,0,20,'threat-actor-30',55500,'web-dmz-01',443,'TCP','HTTPS',8,4096,'','','GET','web-dmz-01','/wp-admin','403','python-requests/2.31.0','TLSv1.3','TLS_AES_256_GCM_SHA384','c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8','','web-dmz-01','','','','no','','no','no','no','no','yes','','failed',62,'','','T1190',''),
  ar('Directory Traversal Attempt','Injection','medium',80,68, 17,2,0,25,'threat-actor-30',55501,'web-dmz-01',443,'TCP','HTTPS',12,6144,'','','GET','web-dmz-01','/../../../etc/passwd','400','python-requests/2.31.0','TLSv1.3','TLS_AES_256_GCM_SHA384','c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8','','web-dmz-01','','','','no','','no','no','no','no','yes','','failed',66,'','','T1190',''),
  // Persistence
  ar('Suspicious Scheduled Task Creation','Persistence','high',89,89, 13,8,0,30,'ws-finance-26',0,'',0,'','',0,0,'','','','','','','','','','','','','svcupdate.exe','','','no','Cobalt-Strike','yes','no','no','no','no','bsmith@corp.local','',88,'','','T1053.005','Arista NDR: schtasks creation for C:\\Windows\\Temp\\svcupdate.exe on ws-finance-26'),
  // Normal flows detected but flagged for baseline
  ar('High-Volume SMB Transfer','AnomalyDetection','low',65,35, 7,0,0,1800,'backup-01',49400,'fs-payroll-01',445,'TCP','SMB',320,524288,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','','success',30,'','','','Arista NDR: Backup agent large SMB transfer [expected from backup host]'),
  ar('High-Volume SMB Transfer','AnomalyDetection','low',65,35, 7,5,0,1500,'backup-01',49401,'fs-hr-02',445,'TCP','SMB',280,458752,'','','','','','','','','','','','','','','','no','','no','no','no','no','no','','success',28,'','','','Arista NDR: Backup agent large SMB transfer [expected]'),
  // Additional normal flows for coverage
  ar('Encrypted Traffic Baseline','AnomalyDetection','info',40,12, 6,4,0,52,'ws-finance-21',49200,'app-erp-04',8443,'TCP','HTTPS',22,18900,'','','','','','','Mozilla/5.0 Chrome/120','TLSv1.3','TLS_AES_256_GCM_SHA384','d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6','e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7','erp.corp.local','','','','no','','no','no','no','no','no',user('ws-finance-21'),'success',8,'','','','Arista NDR: Normal HTTPS to ERP [TLS session established]'),
  ar('Encrypted Traffic Baseline','AnomalyDetection','info',40,10, 6,16,0,58,'ws-exec-51',60111,'app-erp-04',8443,'TCP','HTTPS',25,22500,'','','','','','','Safari/17.0','TLSv1.3','TLS_AES_256_GCM_SHA384','f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8','a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9','erp.corp.local','','','','no','','no','no','no','no','no',user('ws-exec-51'),'success',6,'','','',''),
  ar('Encrypted Traffic Baseline','AnomalyDetection','info',38,8, 6,21,0,52,'ws-hr-33',58774,'app-crm-05',8443,'TCP','HTTPS',20,16000,'','','','','','','Firefox/120','TLSv1.3','TLS_AES_256_GCM_SHA384','b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0','c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1','crm.corp.local','','','','no','','no','no','no','no','no',user('ws-hr-33'),'success',5,'','','',''),
  ar('SSH Admin Session Monitored','Management','info',55,18, 6,24,0,280,'ws-it-41',54922,'ops-jump-55',22,'TCP','SSH',32,65536,'','','','','','','','','','d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2','','ops-jump-55','','','','no','','no','no','no','no','no',user('ws-it-41'),'success',15,'','','','Arista NDR: IT admin SSH session [authorized user, RSA key auth]'),
  ar('SSH Admin Session Monitored','Management','info',52,16, 11,50,0,280,'ws-it-42',55200,'auth-dc-02',22,'TCP','SSH',30,61440,'','','','','','','','','','d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2','','auth-dc-02','','','','no','','no','no','no','no','no',user('ws-it-42'),'success',14,'','','',''),
  ar('SMTP Submission Observed','Email','info',45,8, 6,19,0,38,'ws-finance-21',49255,'mail-01',25,'TCP','SMTP-TLS',15,12288,'','','','','','','Outlook/16.0','TLSv1.2','TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256','','','mail-01','','','','no','','no','no','no','no','no',user('ws-finance-21'),'success',5,'','','','Arista NDR: SMTP submission via TLS'),
  ar('Windows Update Traffic','Patching','info',42,6, 8,30,0,420,'ws-finance-21',60000,'microsoft-update',443,'TCP','HTTPS',180,294912,'','','GET','update.microsoft.com','/windowsupdate','200','Windows-Update-Agent/10.0','TLSv1.3','TLS_AES_256_GCM_SHA384','e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3','','update.microsoft.com','','','','no','','no','no','no','no','no',user('ws-finance-21'),'success',4,'','','',''),
  ar('Windows Update Traffic','Patching','info',40,6, 8,32,0,380,'ws-finance-22',60001,'microsoft-update',443,'TCP','HTTPS',165,270336,'','','GET','update.microsoft.com','/windowsupdate','200','Windows-Update-Agent/10.0','TLSv1.3','TLS_AES_256_GCM_SHA384','e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3','','update.microsoft.com','','','','no','','no','no','no','no','no',user('ws-finance-22'),'success',4,'','','',''),
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cisco ISE Events (48 rows)
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: col-1 = "timestamp" (actual ISO timestamp), col-2 = "event_id"
const ISE_HEADERS = ['timestamp','event_id','event_name','category','severity','username','src_ip','src_port','dst_ip','dst_port','nas_ip','mac_address','hostname','os_type','device_type','identity_group','auth_protocol','failure_reason','risk_score','src_country','session_id','framed_ip','policy_set','auth_rule','posture_status','endpoint_profile','vlan_assignment','nas_port_type','nas_port_id','audit_session_id'];

let iseId = 5200001; let iseSeq = 1;
function ise(t, name, cat, sev, host, dstNas, authP='EAP-TLS', failReason='', risk=5, postStatus='compliant', policySet='Corp-Dot1x', authRule='Allow-All-Corp', vlan=10) {
  const sh = H[host] || EXT[host] || {};
  const nasH = H[dstNas] || {};
  const sesId = `ISE-SES-${String(iseSeq).padStart(4,'0')}`;
  const auditId = `0a0a${Math.floor(sh.ip?.split('.').pop()*1 || 0).toString(16).padStart(4,'0')}${String(Date.now()).slice(-8).padStart(8,'0')}`;
  iseSeq++;
  return {
    timestamp: t,
    event_id: `ISE-${iseId++}`,
    event_name: name, category: cat, severity: sev,
    username: sh.user || '',
    src_ip: sh.ip || host, src_port: 49200 + iseSeq,
    dst_ip: nasH.ip || dstNas, dst_port: 1812,
    nas_ip: nasH.ip || dstNas,
    mac_address: sh.mac || '',
    hostname: host, os_type: sh.os || 'Windows 10', device_type: 'Workstation',
    identity_group: sh.dept || 'Domain Users', auth_protocol: authP,
    failure_reason: failReason, risk_score: risk, src_country: 'US',
    session_id: sesId, framed_ip: sh.ip || host,
    policy_set: policySet, auth_rule: authRule,
    posture_status: postStatus,
    endpoint_profile: sh.os?.startsWith('Windows')?'Windows-Workstation':sh.os?.startsWith('mac')?'MacOS-Workstation':'Workstation',
    vlan_assignment: vlan, nas_port_type: 'Ethernet',
    nas_port_id: H[host]?.nasPort || 'GigabitEthernet1/0/1',
    audit_session_id: auditId.slice(0,20)
  };
}

const iseRows = [
  // Normal morning authentications
  ise(ts(6,0,0),  '5200 Authentication succeeded','Authentication','notice','ws-finance-21','sw-access-01','EAP-TLS','',7,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  ise(ts(6,4,0),  '5200 Authentication succeeded','Authentication','notice','ws-finance-22','sw-access-01','EAP-TLS','',8,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  ise(ts(6,8,0),  '5200 Authentication succeeded','Authentication','notice','ws-finance-23','sw-access-01','EAP-TLS','',12,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  ise(ts(6,12,0), '5200 Authentication succeeded','Authentication','notice','ws-finance-24','sw-access-02','EAP-TLS','',9,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  ise(ts(6,16,0), '5200 Authentication succeeded','Authentication','notice','ws-finance-25','sw-access-02','EAP-TLS','',11,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  ise(ts(6,20,0), '5200 Authentication succeeded','Authentication','notice','ws-hr-31','sw-access-01','EAP-TLS','',9,'compliant','Corp-Dot1x','Allow-All-Corp',11),
  ise(ts(6,24,0), '5200 Authentication succeeded','Authentication','notice','ws-hr-32','sw-access-01','EAP-TLS','',10,'compliant','Corp-Dot1x','Allow-All-Corp',11),
  ise(ts(6,28,0), '5200 Authentication succeeded','Authentication','notice','ws-hr-33','sw-access-02','EAP-TLS','',8,'compliant','Corp-Dot1x','Allow-All-Corp',11),
  ise(ts(6,32,0), '5200 Authentication succeeded','Authentication','notice','ws-it-41','sw-access-01','EAP-TLS','',14,'compliant','Corp-Dot1x','Allow-All-Corp-Admin',12),
  ise(ts(6,36,0), '5200 Authentication succeeded','Authentication','notice','ws-it-42','sw-access-02','EAP-TLS','',13,'compliant','Corp-Dot1x','Allow-All-Corp-Admin',12),
  ise(ts(6,40,0), '5200 Authentication succeeded','Authentication','notice','ws-exec-51','sw-access-01','EAP-TLS','',6,'compliant','Corp-Dot1x','Allow-Exec',13),
  ise(ts(6,44,0), '5200 Authentication succeeded','Authentication','notice','ws-exec-52','sw-access-02','EAP-TLS','',7,'compliant','Corp-Dot1x','Allow-Exec',13),
  // bsmith auth — appears normal initially
  ise(ts(6,48,0), '5200 Authentication succeeded','Authentication','notice','ws-finance-26','sw-access-02','EAP-TLS','',10,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  // Session re-authentication (normal — 8-hour Kerberos ticket renewal)
  ise(ts(8,0,0),  '5200 Authentication succeeded','Authentication','notice','ws-finance-21','sw-access-01','EAP-TLS','',7,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  ise(ts(8,30,0), '5200 Authentication succeeded','Authentication','notice','ws-finance-22','sw-access-01','EAP-TLS','',8,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  // Posture check events
  ise(ts(7,0,0),  '80002 Passed-Healthy','Posture','notice','ws-finance-21','sw-access-01','EAP-TLS','',5,'compliant','Corp-Dot1x','Posture-Redirect',10),
  ise(ts(7,4,0),  '80002 Passed-Healthy','Posture','notice','ws-finance-22','sw-access-01','EAP-TLS','',5,'compliant','Corp-Dot1x','Posture-Redirect',10),
  ise(ts(7,8,0),  '80002 Passed-Healthy','Posture','notice','ws-finance-23','sw-access-01','EAP-TLS','',5,'compliant','Corp-Dot1x','Posture-Redirect',10),
  ise(ts(7,12,0), '80002 Passed-Healthy','Posture','notice','ws-hr-31','sw-access-01','EAP-TLS','',5,'compliant','Corp-Dot1x','Posture-Redirect',11),
  // ws-finance-26 posture check — OUTDATED AV detected
  ise(ts(7,20,0), '80003 Passed-Noncompliant','Posture','warning','ws-finance-26','sw-access-02','EAP-TLS','Endpoint non-compliant: AV definitions outdated > 30 days',35,'non-compliant','Corp-Dot1x','Posture-Redirect',10),
  // SSH brute force ISE perspective — failed machine auth from external
  ise(ts(12,0,0), '5400 Authentication failed','Authentication','error','ops-jump-55','sw-access-01','CHAP','15039 Rejected per authorization profile',65,'unknown','External-Auth','Deny-All',0),
  ise(ts(12,0,30),'5400 Authentication failed','Authentication','error','ops-jump-55','sw-access-01','CHAP','15039 Rejected per authorization profile',65,'unknown','External-Auth','Deny-All',0),
  ise(ts(12,1,0), '5400 Authentication failed','Authentication','error','ops-jump-55','sw-access-01','CHAP','15039 Rejected per authorization profile',65,'unknown','External-Auth','Deny-All',0),
  ise(ts(12,1,30),'5400 Authentication failed','Authentication','error','ops-jump-55','sw-access-01','CHAP','15039 Rejected per authorization profile',65,'unknown','External-Auth','Deny-All',0),
  ise(ts(12,2,0), '5411 Supplicant stopped responding','Authentication','warning','ops-jump-55','sw-access-01','CHAP','12321 PEAP failed SSL/TLS handshake',72,'unknown','External-Auth','Deny-All',0),
  // Rogue device — NAC failure
  ise(ts(16,0,0), '5411 Supplicant stopped responding','Authentication','error','rogue-device','sw-access-01','EAP-TLS','12309 EAPOL timeout - endpoint not responding to EAP',70,'unknown','Corp-Dot1x','Deny-Unknown-Devices',10),
  ise(ts(16,0,30),'5400 Authentication failed','Authentication','error','rogue-device','sw-access-01','EAP-TLS','24408 User not found in Active Directory',75,'unknown','Corp-Dot1x','Deny-Unknown-Devices',10),
  ise(ts(16,1,0), '5434 Endpoint abandoned EAP session','Authentication','warning','rogue-device','sw-access-01','EAP-TLS','Rogue endpoint MAC DE:AD:BE:EF:CA:FE attempted VLAN 10 access',78,'unknown','Corp-Dot1x','Quarantine-Unknown',10),
  // VPN auth
  ise(ts(8,0,5),  '5200 Authentication succeeded','Authentication','notice','ws-finance-21','sw-access-01','EAP-TLS','',18,'compliant','VPN-Auth','Allow-VPN',30),
  ise(ts(8,5,5),  '5200 Authentication succeeded','Authentication','notice','ws-finance-22','sw-access-01','EAP-TLS','',17,'compliant','VPN-Auth','Allow-VPN',30),
  // Afternoon re-auths
  ise(ts(13,0,0), '5200 Authentication succeeded','Authentication','notice','ws-finance-26','sw-access-02','EAP-TLS','',22,'non-compliant','Corp-Dot1x','Allow-All-Corp-Quarantine',10),
  // Elevated risk alert on bsmith — posture re-check triggered
  ise(ts(13,15,0),'80004 Failed','Posture','error','ws-finance-26','sw-access-02','EAP-TLS','Posture non-compliant: EDR agent disabled, firewall off',82,'non-compliant','Corp-Dot1x','Quarantine-Noncompliant',10),
  // Admin accounts
  ise(ts(9,0,0),  '5200 Authentication succeeded','Authentication','notice','ws-it-41','sw-access-01','EAP-TLS','',14,'compliant','Corp-Dot1x','Allow-All-Corp-Admin',12),
  ise(ts(9,30,0), '5200 Authentication succeeded','Authentication','notice','ws-it-42','sw-access-02','EAP-TLS','',13,'compliant','Corp-Dot1x','Allow-All-Corp-Admin',12),
  // HR workstations midday
  ise(ts(12,30,0),'5200 Authentication succeeded','Authentication','notice','ws-hr-31','sw-access-01','EAP-TLS','',9,'compliant','Corp-Dot1x','Allow-All-Corp',11),
  ise(ts(12,34,0),'5200 Authentication succeeded','Authentication','notice','ws-hr-32','sw-access-01','EAP-TLS','',10,'compliant','Corp-Dot1x','Allow-All-Corp',11),
  ise(ts(12,38,0),'5200 Authentication succeeded','Authentication','notice','ws-hr-33','sw-access-02','EAP-TLS','',8,'compliant','Corp-Dot1x','Allow-All-Corp',11),
  // CoA — Change of Authorization on compromised host
  ise(ts(13,20,0),'5231 Guest user authenticated','Authorization','warning','ws-finance-26','sw-access-02','EAP-TLS','CoA Issued: quarantine due to posture non-compliance and C2 indicators',85,'quarantined','Corp-Dot1x','CoA-Quarantine',998), // VLAN 998 = quarantine
  ise(ts(13,22,0),'5236 Authorize VLAN-change failed','Authorization','error','ws-finance-26','sw-access-02','EAP-TLS','Endpoint failed to change VLAN after CoA — manual disconnect required',87,'quarantined','Corp-Dot1x','Force-Disconnect',998),
  // End-of-day logoff events
  ise(ts(17,45,0),'5201 Authentication ended','Authentication','notice','ws-finance-21','sw-access-01','EAP-TLS','Session ended: user logoff',3,'compliant','Corp-Dot1x','Allow-All-Corp',10),
  ise(ts(17,50,0),'5201 Authentication ended','Authentication','notice','ws-hr-31','sw-access-01','EAP-TLS','Session ended: user logoff',3,'compliant','Corp-Dot1x','Allow-All-Corp',11),
  ise(ts(17,55,0),'5201 Authentication ended','Authentication','notice','ws-exec-51','sw-access-01','EAP-TLS','Session ended: user logoff',2,'compliant','Corp-Dot1x','Allow-Exec',13),
  // WiFi/RADIUS entries for mobile
  ise(ts(9,10,0), '5200 Authentication succeeded','Authentication','notice','ws-exec-51','sw-access-01','PEAP-MSCHAPv2','',8,'compliant','Corp-Wifi','Allow-SSID-Corp',13),
  ise(ts(9,15,0), '5200 Authentication succeeded','Authentication','notice','ws-exec-52','sw-access-02','PEAP-MSCHAPv2','',9,'compliant','Corp-Wifi','Allow-SSID-Corp',13),
  ise(ts(11,0,0), '5200 Authentication succeeded','Authentication','notice','ws-finance-23','sw-access-01','PEAP-MSCHAPv2','',10,'compliant','Corp-Wifi','Allow-SSID-Corp',10),
  ise(ts(11,5,0), '5200 Authentication succeeded','Authentication','notice','ws-hr-33','sw-access-02','PEAP-MSCHAPv2','',9,'compliant','Corp-Wifi','Allow-SSID-Corp',11),
  ise(ts(14,0,0), '5200 Authentication succeeded','Authentication','notice','ws-finance-24','sw-access-01','PEAP-MSCHAPv2','',10,'compliant','Corp-Wifi','Allow-SSID-Corp',10),
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cisco DNAC Events (30 rows)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Per normalizer — col-1 "timestamp" holds the event_id, col-2 "event_id" holds the actual ISO timestamp
const DNAC_HEADERS = ['timestamp','event_id','event_name','category','severity','src_ip','src_port','dst_ip','dst_port','src_hostname','dst_hostname','device_name','site','issue_type','bytes','packets','protocol','risk_score','username','vlan','ssid','ap_name','latency_ms','alert_name','client_health','network_health','band','rssi_dbm','channel','client_onboard_time_ms','auth_type','device_os'];

let dnacSeq = 1;
function dnac(t, name, cat, sev, src, sport, dst, dport, device, site, issue, bytes, pkts, proto, risk, uname='', vlan=10, ssid='CorpSSID', ap='', lat=0, alertN='', cHealth=85, nHealth=80, band='5GHz', rssi=-55, ch=36, onboard=500, authT='EAP-TLS', os='Windows 11') {
  const sh = H[src] || EXT[src] || {};
  const dh = H[dst] || EXT[dst] || {};
  const id = `DNAC-${String(dnacSeq++).padStart(4,'0')}`;
  return {
    timestamp: id,           // col-1: event_id goes here (swapped headers!)
    event_id: t,             // col-2: actual timestamp goes here
    event_name: name, category: cat, severity: sev,
    src_ip: sh.ip||src, src_port: sport,
    dst_ip: dh.ip||dst, dst_port: dport,
    src_hostname: src, dst_hostname: dst,
    device_name: device, site, issue_type: issue,
    bytes, packets: pkts, protocol: proto, risk_score: risk,
    username: uname||sh.user||'', vlan, ssid, ap_name: ap,
    latency_ms: lat, alert_name: alertN,
    client_health: cHealth, network_health: nHealth,
    band, rssi_dbm: rssi, channel: ch,
    client_onboard_time_ms: onboard, auth_type: authT, device_os: os
  };
}

const dnacRows = [
  // Client onboarding events (matches ISE auth timeline)
  dnac(ts(6,2),  'Client-Onboard-Success','ClientAssurance','info','ws-finance-21',54976,'app-erp-04',8443,'sw-dist-01','Campus-A/Building-1/Floor-1','ClientOnboarding',18900,22,'HTTPS',9,user('ws-finance-21'),10,'CorpSSID','AP-B1-F1-01',14,'',85,79,'5GHz',-55,36,669,'EAP-TLS','Windows 11'),
  dnac(ts(6,6),  'Client-Onboard-Success','ClientAssurance','info','ws-finance-22',54806,'fs-payroll-01',445,'sw-dist-02','Campus-A/Building-1/Floor-2','ClientOnboarding',6144,8,'SMB',12,user('ws-finance-22'),10,'CorpSSID','AP-B1-F1-02',13,'',88,91,'5GHz',-58,40,717,'EAP-TLS','Windows 11'),
  dnac(ts(6,10), 'Client-Onboard-Success','ClientAssurance','info','ws-finance-23',54910,'db-finance-03',1433,'sw-dist-01','Campus-B/Building-2/Floor-1','ClientOnboarding',4096,6,'MSSQL',13,user('ws-finance-23'),10,'CorpSSID','AP-B1-F2-01',8,'',82,91,'5GHz',-62,44,355,'EAP-TLS','Windows 10'),
  dnac(ts(6,14), 'Client-Onboard-Success','ClientAssurance','info','ws-hr-31',54713,'app-crm-05',8443,'sw-dist-02','Campus-A/Building-1/Floor-1','ClientOnboarding',12288,16,'HTTPS',13,user('ws-hr-31'),11,'CorpSSID','AP-B2-F1-01',22,'',91,80,'5GHz',-52,36,512,'EAP-TLS','Windows 11'),
  dnac(ts(6,18), 'Client-Onboard-Success','ClientAssurance','info','ws-hr-32',55100,'fs-hr-02',445,'sw-dist-01','Campus-A/Building-2/Floor-1','ClientOnboarding',5120,7,'SMB',11,user('ws-hr-32'),11,'CorpSSID','AP-B2-F1-02',18,'',87,84,'5GHz',-60,40,431,'EAP-TLS','Windows 10'),
  dnac(ts(6,22), 'Client-Onboard-Success','ClientAssurance','info','ws-it-41',55200,'ops-jump-55',22,'sw-dist-01','Campus-A/Building-3/Floor-1','ClientOnboarding',65536,32,'SSH',14,user('ws-it-41'),12,'CorpSSID','AP-B3-F1-01',9,'',93,88,'5GHz',-48,36,312,'EAP-TLS','Windows 11'),
  dnac(ts(6,26), 'Client-Onboard-Success','ClientAssurance','info','ws-exec-51',56000,'app-erp-04',8443,'sw-dist-02','Campus-A/Building-4/Floor-1','ClientOnboarding',22500,25,'HTTPS',8,user('ws-exec-51'),13,'CorpSSID','AP-B4-F1-01',11,'',95,95,'5GHz',-45,36,289,'EAP-TLS','macOS 14'),
  // Network health events
  dnac(ts(6,30), 'Switch-CPU-High','NetworkHealth','warning','sw-dist-01',0,'',0,'sw-dist-01','Campus-A/Building-1','CpuHighUsage',0,0,'',30,'',70,'','',0,'Switch CPU utilization exceeded 80% threshold',62,72,'','','','','',''),
  dnac(ts(6,45), 'AP-Client-Disconnect','ClientAssurance','warning','ws-hr-33',0,'',0,'sw-dist-02','Campus-B/Building-1/Floor-2','ClientDisconnect',0,0,'',15,user('ws-hr-33'),11,'CorpSSID','AP-B1-F2-03',0,'Repeated disassociation events',72,80,'2.4GHz',-72,6,0,'EAP-TLS','Windows 11'),
  dnac(ts(7,0),  'AP-Client-Reconnect','ClientAssurance','info','ws-hr-33',55900,'fs-hr-02',445,'sw-dist-02','Campus-B/Building-1/Floor-2','ClientOnboarding',5120,7,'SMB',10,user('ws-hr-33'),11,'CorpSSID','AP-B1-F2-03',24,'',80,80,'5GHz',-65,36,822,'EAP-TLS','Windows 11'),
  // bsmith onboarding — posture non-compliant flag
  dnac(ts(6,50), 'Client-Onboard-Posture-Fail','ClientAssurance','warning','ws-finance-26',58000,'',0,'sw-dist-01','Campus-A/Building-1/Floor-1','PostureFailed',0,0,'',35,user('ws-finance-26'),10,'CorpSSID','AP-B1-F1-01',0,'Endpoint posture failed: AV outdated',55,79,'5GHz',-61,36,1204,'EAP-TLS','Windows 10'),
  dnac(ts(6,52), 'Client-Onboard-Quarantine','ClientAssurance','warning','ws-finance-26',58100,'',0,'sw-dist-01','Campus-A/Building-1/Floor-1','QuarantineApplied',0,0,'',40,user('ws-finance-26'),998,'CorpSSID','AP-B1-F1-01',0,'Client quarantined to VLAN 998 pending remediation',50,79,'5GHz',-61,36,0,'EAP-TLS','Windows 10'),
  dnac(ts(7,30), 'Client-Onboard-Success','ClientAssurance','info','ws-finance-26',58200,'fs-payroll-01',445,'sw-dist-01','Campus-A/Building-1/Floor-1','ClientOnboarding',8192,12,'SMB',18,user('ws-finance-26'),10,'CorpSSID','AP-B1-F1-01',17,'',60,79,'5GHz',-61,36,1455,'EAP-TLS','Windows 10'),
  // Application performance
  dnac(ts(8,0),  'App-Performance-Degraded','AppExperience','warning','ws-finance-21',58400,'app-erp-04',8443,'sw-dist-01','Campus-A/Building-1','AppLatency',0,0,'HTTPS',20,user('ws-finance-21'),10,'CorpSSID','AP-B1-F1-01',210,'ERP response time > 200ms P95',70,79,'5GHz',-55,36,0,'EAP-TLS','Windows 11'),
  dnac(ts(8,30), 'App-Performance-Restored','AppExperience','info','ws-finance-21',58401,'app-erp-04',8443,'sw-dist-01','Campus-A/Building-1','AppLatency',0,0,'HTTPS',10,user('ws-finance-21'),10,'CorpSSID','AP-B1-F1-01',45,'',85,85,'5GHz',-55,36,0,'EAP-TLS','Windows 11'),
  // Security advisory — C2 detected on managed device
  dnac(ts(10,5),  'Security-Advisory-C2-Detected','SecurityAdvisory','critical','ws-finance-26',55001,'c2-server-50',443,'sw-dist-01','Campus-A/Building-1/Floor-1','C2Communication',4096,8,'HTTPS',91,user('ws-finance-26'),10,'CorpSSID','AP-B1-F1-01',0,'C2 beacon to 203.0.113.50 detected via Threat Intelligence','',79,'5GHz',-61,36,0,'EAP-TLS','Windows 10'),
  dnac(ts(13,20), 'Security-Advisory-Data-Exfil','SecurityAdvisory','critical','ws-finance-26',55100,'c2-server-50',443,'sw-dist-01','Campus-A/Building-1/Floor-1','DataExfiltration',2097152,1240,'HTTPS',96,user('ws-finance-26'),10,'CorpSSID','AP-B1-F1-01',0,'Bulk data upload to suspected C2 endpoint','',79,'5GHz',-61,36,0,'EAP-TLS','Windows 10'),
  // Network assurance
  dnac(ts(9,0),  'Network-Health-Degraded','NetworkHealth','warning','sw-core-01',0,'',0,'sw-core-01','Campus-A/Core','InterfaceError',0,0,'',25,'',65,60,'','','',0,'Core switch GigabitEthernet0/1 CRC errors > threshold','','','','','',''),
  dnac(ts(9,30), 'Network-Health-Restored','NetworkHealth','info','sw-core-01',0,'',0,'sw-core-01','Campus-A/Core','InterfaceError',0,0,'',5,'',90,88,'','','',0,'','','','','','',''),
  // SSID client counts
  dnac(ts(10,0), 'Client-Count-High','NetworkHealth','info','sw-dist-01',0,'',0,'sw-dist-01','Campus-A/Building-1','HighClientCount',0,0,'',5,'',88,91,'5GHz','','',0,'','','','','','',''),
  // Onboarding issues
  dnac(ts(11,0), 'Client-Onboard-Auth-Fail','ClientAssurance','error','ws-finance-23',59000,'sw-access-01',1812,'sw-dist-01','Campus-B/Building-2/Floor-1','AuthFailed',0,0,'RADIUS',40,user('ws-finance-23'),10,'CorpSSID','AP-B1-F2-01',0,'Client auth failed: certificate expired',55,91,'5GHz',-62,44,0,'EAP-TLS','Windows 10'),
  dnac(ts(11,5), 'Client-Onboard-Success','ClientAssurance','info','ws-finance-23',59001,'db-finance-03',1433,'sw-dist-01','Campus-B/Building-2/Floor-1','ClientOnboarding',4096,6,'MSSQL',12,user('ws-finance-23'),10,'CorpSSID','AP-B1-F2-01',8,'',82,91,'5GHz',-62,44,590,'EAP-TLS','Windows 10'),
  // Path trace events
  dnac(ts(12,0), 'Path-Trace-Completed','PathTrace','info','ws-finance-21',0,'fs-payroll-01',445,'sw-dist-01','Campus-A','PathAnalysis',0,0,'SMB',5,user('ws-finance-21'),10,'','',0,'Path trace: ws-finance-21 -> fs-payroll-01 (6 hops, latency 3ms)',90,90,'','','','','',''),
  // Late afternoon
  dnac(ts(15,0), 'Client-Roam-Event','ClientAssurance','info','ws-hr-32',62300,'fs-hr-02',445,'sw-dist-01','Campus-A/Building-2','ClientRoaming',6656,9,'SMB',12,user('ws-hr-32'),11,'CorpSSID','AP-B2-F1-01',19,'',84,83,'5GHz',-59,40,0,'EAP-TLS','Windows 10'),
  dnac(ts(16,0), 'Rogue-AP-Detected','SecurityAdvisory','high','',0,'',0,'sw-dist-02','Campus-B/Building-2','RogueAP',0,0,'',60,'',0,0,'','','',0,'Rogue AP detected: SSID CorpSSID-Clone, channel 6, BSSID DE:AD:BE:EF:CA:01','','','','','',''),
  dnac(ts(16,30), 'Client-Onboard-Success','ClientAssurance','info','ws-finance-24',60500,'app-erp-04',8443,'sw-dist-01','Campus-A/Building-1','ClientOnboarding',15360,20,'HTTPS',11,user('ws-finance-24'),10,'CorpSSID','AP-B1-F1-01',12,'',87,82,'5GHz',-54,36,445,'EAP-TLS','Windows 11'),
  dnac(ts(16,45), 'Client-Onboard-Success','ClientAssurance','info','ws-hr-33',61200,'app-crm-05',8443,'sw-dist-02','Campus-B/Building-1','ClientOnboarding',14400,20,'HTTPS',10,user('ws-hr-33'),11,'CorpSSID','AP-B2-F1-01',17,'',89,84,'5GHz',-57,40,388,'EAP-TLS','Windows 11'),
  dnac(ts(17,0), 'Client-Disconnect','ClientAssurance','info','ws-finance-21',0,'',0,'sw-dist-01','Campus-A/Building-1','ClientDisconnect',0,0,'',3,user('ws-finance-21'),10,'CorpSSID','AP-B1-F1-01',0,'',88,82,'5GHz',-55,36,0,'EAP-TLS','Windows 11'),
  dnac(ts(17,15), 'Client-Disconnect','ClientAssurance','info','ws-hr-31',0,'',0,'sw-dist-01','Campus-A/Building-2','ClientDisconnect',0,0,'',3,user('ws-hr-31'),11,'CorpSSID','AP-B2-F1-01',0,'',87,80,'5GHz',-52,36,0,'EAP-TLS','Windows 11'),
  dnac(ts(17,20), 'Daily-Network-Summary','NetworkHealth','info','sw-dist-01',0,'',0,'sw-dist-01','Campus-A','DailySummary',0,0,'',2,'',89,88,'','','',0,'Daily summary: 47 clients, avg health 87, 2 incidents','','','','','',''),
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cisco APIC Events (36 rows)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Per normalizer — col-1 "timestamp" holds the event_id, col-2 "event_id" holds the actual ISO timestamp
const APIC_HEADERS = ['timestamp','event_id','event_name','category','src_ip','src_port','dst_ip','dst_port','src_epg','dst_epg','tenant','vrf','contract','subject','action','protocol','bytes','packets','severity','risk_score','fault_code','alert_name','src_hostname','dst_hostname','bd','ap','src_class','dst_class','policy_name','hit_count','last_hit','vzentry'];

let apicSeq = 1;
function apic(t, name, cat, src, sport, dst, dport, srcEpg, dstEpg, tenant, vrf, contract, subj, action, proto, bytes, pkts, sev, risk, fault='', alertN='', bd='', ap='Prod-Tenant-AP', srcClass='', dstClass='', hitCount=1) {
  const sh = H[src] || EXT[src] || {};
  const dh = H[dst] || EXT[dst] || {};
  const id = `APIC-POL-${String(apicSeq++).padStart(4,'0')}`;
  return {
    timestamp: id,   // col-1: event_id goes here
    event_id: t,     // col-2: actual ISO timestamp
    event_name: name, category: cat,
    src_ip: sh.ip||src, src_port: sport,
    dst_ip: dh.ip||dst, dst_port: dport,
    src_epg: srcEpg, dst_epg: dstEpg,
    tenant, vrf, contract, subject: subj, action,
    protocol: proto, bytes, packets: pkts,
    severity: sev, risk_score: risk, fault_code: fault, alert_name: alertN,
    src_hostname: src, dst_hostname: dst,
    bd: bd || `${srcEpg}-BD`, ap,
    src_class: srcClass || '13954', dst_class: dstClass || '25476',
    policy_name: contract, hit_count: hitCount,
    last_hit: new Date(new Date(t).getTime() + 60000).toISOString(),
    vzentry: subj+'-vzentry'
  };
}

const apicRows = [
  // Normal Finance → Servers (permitted flows)
  apic(ts(6,1),  'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-21',49300,'fs-payroll-01',445,'Finance-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','Finance-to-Servers','smb-access','permit','TCP',8192,12,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','25476',2),
  apic(ts(6,3),  'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-22',49301,'fs-payroll-01',445,'Finance-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','Finance-to-Servers','smb-access','permit','TCP',6144,10,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','25476',47),
  apic(ts(6,5),  'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-23',49302,'db-finance-03',1433,'Finance-EPG','DB-EPG','Prod-Tenant','Prod-VRF','Finance-to-DB','mssql-access','permit','TCP',4096,6,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','17904','23604',17),
  apic(ts(6,7),  'Zoning-Rule-Permit','PolicyEnforcement','ws-hr-31',49303,'fs-hr-02',445,'HR-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','HR-to-Servers','smb-access','permit','TCP',5120,7,'info',4,'','','HR-EPG-BD','Prod-Tenant-AP','13094','37822',30),
  apic(ts(6,9),  'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-21',49304,'app-erp-04',8443,'Finance-EPG','App-EPG','Prod-Tenant','Prod-VRF','Finance-to-App','https-access','permit','TCP',18900,22,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','22300',120),
  apic(ts(6,11), 'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-22',49305,'app-erp-04',8443,'Finance-EPG','App-EPG','Prod-Tenant','Prod-VRF','Finance-to-App','https-access','permit','TCP',14400,18,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','22300',118),
  apic(ts(6,13), 'Zoning-Rule-Permit','PolicyEnforcement','ws-hr-31',49306,'db-hr-06',1433,'HR-EPG','DB-EPG','Prod-Tenant','Prod-VRF','HR-to-DB','mssql-access','permit','TCP',3584,5,'info',4,'','','HR-EPG-BD','Prod-Tenant-AP','13094','23604',22),
  apic(ts(6,15), 'Zoning-Rule-Permit','PolicyEnforcement','ws-hr-32',49307,'fs-hr-02',445,'HR-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','HR-to-Servers','smb-access','permit','TCP',6656,9,'info',4,'','','HR-EPG-BD','Prod-Tenant-AP','13094','37822',28),
  apic(ts(6,17), 'Zoning-Rule-Permit','PolicyEnforcement','ws-it-41',49308,'ops-jump-55',22,'IT-EPG','Ops-EPG','Prod-Tenant','Prod-VRF','IT-to-Ops','ssh-access','permit','TCP',65536,32,'info',6,'','','IT-EPG-BD','Prod-Tenant-AP','11234','44321',5),
  apic(ts(6,19), 'Zoning-Rule-Permit','PolicyEnforcement','ws-exec-51',49309,'app-erp-04',8443,'Exec-EPG','App-EPG','Prod-Tenant','Prod-VRF','Exec-to-App','https-access','permit','TCP',22500,25,'info',4,'','','Exec-EPG-BD','Prod-Tenant-AP','12001','22300',60),
  // IT Admin flows
  apic(ts(6,21), 'Zoning-Rule-Permit','PolicyEnforcement','ws-it-42',49310,'ops-jump-55',22,'IT-EPG','Ops-EPG','Prod-Tenant','Prod-VRF','IT-to-Ops','ssh-access','permit','TCP',57344,28,'info',6,'','','IT-EPG-BD','Prod-Tenant-AP','11234','44321',4),
  apic(ts(6,23), 'Zoning-Rule-Permit','PolicyEnforcement','ws-it-41',49311,'auth-dc-01',3389,'IT-EPG','DC-EPG','Prod-Tenant','Prod-VRF','IT-to-DC','rdp-access','permit','TCP',92160,45,'info',7,'','','IT-EPG-BD','Prod-Tenant-AP','11234','30011',3),
  // Backup flows
  apic(ts(7,1),  'Zoning-Rule-Permit','PolicyEnforcement','backup-01',49400,'fs-payroll-01',445,'Backup-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','Backup-to-Servers','backup-access','permit','TCP',524288,320,'info',5,'','','Backup-EPG-BD','Prod-Tenant-AP','19900','25476',1),
  apic(ts(7,6),  'Zoning-Rule-Permit','PolicyEnforcement','backup-01',49401,'db-finance-03',1433,'Backup-EPG','DB-EPG','Prod-Tenant','Prod-VRF','Backup-to-DB','backup-access','permit','TCP',294912,180,'info',5,'','','Backup-EPG-BD','Prod-Tenant-AP','19900','23604',1),
  // ── POLICY VIOLATIONS / DENIES ─────────────────────────────────────────────
  // Finance → HR DB denied (cross-EPG policy violation)
  apic(ts(16,10), 'Contract-Deny','PolicyViolation','ws-finance-23',54888,'db-hr-06',1433,'Finance-EPG','HR-DB-EPG','Prod-Tenant','Prod-VRF','Finance-to-HR-DB','mssql-deny','deny','TCP',0,4,'warning',70,'F0467','Finance EPG denied accessing HR DB EPG — contract violation','Finance-EPG-BD','Prod-Tenant-AP','13954','23806',1),
  apic(ts(16,12), 'Contract-Deny','PolicyViolation','ws-finance-21',54899,'db-hr-06',1433,'Finance-EPG','HR-DB-EPG','Prod-Tenant','Prod-VRF','Finance-to-HR-DB','mssql-deny','deny','TCP',0,4,'warning',68,'F0467','Finance EPG denied accessing HR DB EPG — repeat violation','Finance-EPG-BD','Prod-Tenant-AP','13954','23806',2),
  // bsmith C2 traffic — external EPG (Untrust) - policy should deny but internal→external may be permitted
  apic(ts(10,0),  'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-26',55000,'c2-server-50',443,'Finance-EPG','Untrust-EPG','Prod-Tenant','Prod-VRF','Finance-to-Internet','https-external','permit','TCP',4096,8,'info',60,'','C2 traffic permitted by default outbound policy — REVIEW REQUIRED','Finance-EPG-BD','Prod-Tenant-AP','13954','65535',8),
  apic(ts(13,20), 'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-26',55100,'c2-server-50',443,'Finance-EPG','Untrust-EPG','Prod-Tenant','Prod-VRF','Finance-to-Internet','https-external','permit','TCP',2097152,1240,'critical',96,'F0501','CRITICAL: 2MB upload to threat actor IP — exfiltration via permitted HTTPS contract','Finance-EPG-BD','Prod-Tenant-AP','13954','65535',1),
  // Lateral movement denies
  apic(ts(15,0),  'Contract-Deny','PolicyViolation','ws-finance-26',49500,'auth-dc-01',445,'Finance-EPG','DC-EPG','Prod-Tenant','Prod-VRF','Finance-to-DC','admin-share-deny','deny','TCP',0,25,'critical',95,'F0502','LATERAL MOVEMENT: Finance EPG → DC admin share denied — INCIDENT RESPONSE REQUIRED','Finance-EPG-BD','Prod-Tenant-AP','13954','30011',1),
  apic(ts(15,5),  'Contract-Deny','PolicyViolation','ws-finance-26',49501,'fs-hr-02',445,'Finance-EPG','HR-EPG','Prod-Tenant','Prod-VRF','Finance-to-HR','hr-access-deny','deny','TCP',0,18,'critical',90,'F0502','LATERAL MOVEMENT: Finance EPG → HR FS admin share denied','Finance-EPG-BD','Prod-Tenant-AP','13954','37823',1),
  apic(ts(15,10), 'Contract-Deny','PolicyViolation','ws-finance-26',49502,'db-hr-06',1433,'Finance-EPG','HR-DB-EPG','Prod-Tenant','Prod-VRF','Finance-to-HR-DB','hr-db-deny','deny','TCP',0,15,'critical',87,'F0502','LATERAL MOVEMENT: Finance → HR DB denied','Finance-EPG-BD','Prod-Tenant-AP','13954','23806',1),
  // Rogue device denied
  apic(ts(16,0),  'Contract-Deny','PolicyViolation','rogue-device',52000,'auth-dc-01',88,'Unknown-EPG','DC-EPG','Prod-Tenant','Prod-VRF','Unknown-to-DC','default-deny','deny','TCP',0,4,'critical',75,'F0505','ROGUE: Unknown endpoint DE:AD:BE:EF:CA:FE attempting DC access — denied by implicit deny','Unknown-EPG-BD','Prod-Tenant-AP','0','30011',1),
  // Normal ERP access
  apic(ts(7,15),  'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-24',49312,'fs-payroll-01',445,'Finance-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','Finance-to-Servers','smb-access','permit','TCP',7168,10,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','25476',34),
  apic(ts(7,20),  'Zoning-Rule-Permit','PolicyEnforcement','ws-exec-52',49313,'app-erp-04',8443,'Exec-EPG','App-EPG','Prod-Tenant','Prod-VRF','Exec-to-App','https-access','permit','TCP',17600,20,'info',4,'','','Exec-EPG-BD','Prod-Tenant-AP','12001','22300',55),
  apic(ts(8,0),   'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-25',49314,'fs-payroll-01',445,'Finance-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','Finance-to-Servers','smb-access','permit','TCP',6144,8,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','25476',29),
  apic(ts(8,5),   'Zoning-Rule-Permit','PolicyEnforcement','ws-hr-33',49315,'app-crm-05',8443,'HR-EPG','App-EPG','Prod-Tenant','Prod-VRF','HR-to-App','https-access','permit','TCP',16000,20,'info',4,'','','HR-EPG-BD','Prod-Tenant-AP','13094','22300',92),
  // Fault codes (fabric faults)
  apic(ts(9,0),   'Fabric-Fault-Detected','FabricHealth','sw-core-01',0,'',0,'','','Infra-Tenant','Infra-VRF','','','','info',15,'F1296','Fabric link down: node 101 uplink to border leaf','Infra-BD','Infra-AP','','','',0),
  apic(ts(9,15),  'Fabric-Fault-Cleared','FabricHealth','sw-core-01',0,'',0,'','','Infra-Tenant','Infra-VRF','','','','info',5,'','','Infra-BD','Infra-AP','','','',0),
  apic(ts(11,0),  'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-23',49316,'app-erp-04',8443,'Finance-EPG','App-EPG','Prod-Tenant','Prod-VRF','Finance-to-App','https-access','permit','TCP',18400,22,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','22300',108),
  apic(ts(11,10), 'Zoning-Rule-Permit','PolicyEnforcement','ws-hr-33',49317,'fs-hr-02',445,'HR-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','HR-to-Servers','smb-access','permit','TCP',5632,8,'info',4,'','','HR-EPG-BD','Prod-Tenant-AP','13094','37822',24),
  apic(ts(14,0),  'Zoning-Rule-Permit','PolicyEnforcement','ws-hr-32',49318,'fs-hr-02',445,'HR-EPG','Servers-EPG','Prod-Tenant','Prod-VRF','HR-to-Servers','smb-access','permit','TCP',6656,9,'info',4,'','','HR-EPG-BD','Prod-Tenant-AP','13094','37822',31),
  apic(ts(14,10), 'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-25',49319,'db-finance-03',1433,'Finance-EPG','DB-EPG','Prod-Tenant','Prod-VRF','Finance-to-DB','mssql-access','permit','TCP',5632,8,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','23604',15),
  apic(ts(17,30), 'Zoning-Rule-Permit','PolicyEnforcement','ws-finance-22',49320,'app-erp-04',8443,'Finance-EPG','App-EPG','Prod-Tenant','Prod-VRF','Finance-to-App','https-access','permit','TCP',17000,20,'info',5,'','','Finance-EPG-BD','Prod-Tenant-AP','13954','22300',115),
  apic(ts(17,40), 'Zoning-Rule-Permit','PolicyEnforcement','ws-hr-33',49321,'app-crm-05',8443,'HR-EPG','App-EPG','Prod-Tenant','Prod-VRF','HR-to-App','https-access','permit','TCP',14400,20,'info',4,'','','HR-EPG-BD','Prod-Tenant-AP','13094','22300',89),
];

// ── Write files ──────────────────────────────────────────────────────────────
writeFileSync(out('qradar_events.csv'),      csv(QR_HEADERS,  qrRows));
writeFileSync(out('sna_flows.csv'),          csv(SNA_HEADERS, snaRows));
writeFileSync(out('arista_ndr.csv'),         csv(AR_HEADERS,  aristaRows));
writeFileSync(out('cisco_ise_events.csv'),   csv(ISE_HEADERS, iseRows));
writeFileSync(out('cisco_dnac_events.csv'),  csv(DNAC_HEADERS,dnacRows));
writeFileSync(out('cisco_apic_events.csv'),  csv(APIC_HEADERS,apicRows));

console.log(`Generated:`);
console.log(`  QRadar:  ${qrRows.length} rows`);
console.log(`  SNA:     ${snaRows.length} rows`);
console.log(`  Arista:  ${aristaRows.length} rows`);
console.log(`  ISE:     ${iseRows.length} rows`);
console.log(`  DNAC:    ${dnacRows.length} rows`);
console.log(`  APIC:    ${apicRows.length} rows`);
console.log(`  Total:   ${qrRows.length + snaRows.length + aristaRows.length + iseRows.length + dnacRows.length + apicRows.length} rows`);
