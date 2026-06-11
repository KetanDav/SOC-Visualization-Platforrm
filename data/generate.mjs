// generate.mjs - generates 100+ interconnected rows for all 3 vendor CSVs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Shared Network Topology ─────────────────────────────────────────────────
const HOSTS = [
  { ip: '10.10.10.21', mac: '00:50:56:a1:10:21', hostname: 'ws-finance-21',      country: 'US', asn: '64512', username: 'finance.user',    type: 'workstation' },
  { ip: '10.10.10.22', mac: '00:50:56:a1:10:22', hostname: 'ws-finance-22',      country: 'US', asn: '64512', username: 'finance2.user',   type: 'workstation' },
  { ip: '10.10.10.23', mac: '00:50:56:a1:10:23', hostname: 'ws-hr-23',           country: 'US', asn: '64512', username: 'hr.user',          type: 'workstation' },
  { ip: '10.10.10.24', mac: '00:50:56:a1:10:24', hostname: 'ws-finance-24',      country: 'US', asn: '64512', username: 'finance3.user',   type: 'workstation' },
  { ip: '10.10.20.12', mac: '00:50:56:b2:20:12', hostname: 'fs-payroll-01',      country: 'US', asn: '64513', username: 'svc-payroll',      type: 'server' },
  { ip: '10.10.20.13', mac: '00:50:56:b2:20:13', hostname: 'fs-hr-02',           country: 'US', asn: '64513', username: 'svc-hr',           type: 'server' },
  { ip: '10.10.20.14', mac: '00:50:56:b2:20:14', hostname: 'db-finance-01',      country: 'US', asn: '64513', username: 'svc-db',           type: 'database' },
  { ip: '10.10.20.15', mac: '00:50:56:b2:20:15', hostname: 'app-internal-01',    country: 'US', asn: '64513', username: 'svc-app',          type: 'server' },
  { ip: '10.10.30.44', mac: '00:50:56:c3:30:44', hostname: 'eng-workstation-44', country: 'US', asn: '64520', username: 'eng.user',         type: 'workstation' },
  { ip: '10.10.30.45', mac: '00:50:56:c3:30:45', hostname: 'eng-workstation-45', country: 'US', asn: '64520', username: 'eng2.user',        type: 'workstation' },
  { ip: '10.10.30.46', mac: '00:50:56:c3:30:46', hostname: 'eng-workstation-46', country: 'US', asn: '64520', username: 'eng3.user',        type: 'workstation' },
  { ip: '10.10.30.1',  mac: '00:50:56:d4:30:01', hostname: 'proxy-01',           country: 'US', asn: '64521', username: 'svc-proxy',        type: 'proxy' },
  { ip: '10.10.40.55', mac: '00:50:56:e5:40:55', hostname: 'ops-jump-55',        country: 'US', asn: '64530', username: 'ops.admin',        type: 'jumphost' },
  { ip: '10.10.40.56', mac: '00:50:56:e5:40:56', hostname: 'ops-jump-56',        country: 'US', asn: '64530', username: 'ops2.admin',       type: 'jumphost' },
  { ip: '10.10.40.10', mac: '00:50:56:f6:40:10', hostname: 'mgmt-portal-01',     country: 'US', asn: '64531', username: 'svc-mgmt',         type: 'server' },
  { ip: '10.10.50.18', mac: '00:50:56:aa:50:18', hostname: 'rd-lab-18',          country: 'US', asn: '64540', username: 'lab.user',         type: 'workstation' },
  { ip: '10.10.50.19', mac: '00:50:56:aa:50:19', hostname: 'rd-lab-19',          country: 'US', asn: '64540', username: 'lab2.user',        type: 'workstation' },
  { ip: '10.10.60.100',mac: '00:50:56:bb:60:01', hostname: 'dc-primary-01',      country: 'US', asn: '64550', username: 'svc-dc',           type: 'domain-controller' },
  { ip: '10.10.60.101',mac: '00:50:56:bb:60:02', hostname: 'dc-secondary-02',    country: 'US', asn: '64550', username: 'svc-dc2',          type: 'domain-controller' },
  { ip: '10.10.70.200',mac: '00:50:56:cc:70:01', hostname: 'siem-collector-01',  country: 'US', asn: '64560', username: 'svc-siem',         type: 'siem' },
];

const EXTERNAL = [
  { ip: '8.8.8.8',         mac: '00:00:00:00:00:01', hostname: 'google-dns',        country: 'US',  asn: '15169' },
  { ip: '9.9.9.9',         mac: '00:00:00:00:00:02', hostname: 'public-dns-01',     country: 'US',  asn: '19281' },
  { ip: '198.51.100.77',   mac: '00:11:22:33:44:55', hostname: 'cloud-dropbox-01',  country: 'US',  asn: '64599' },
  { ip: '203.0.113.45',    mac: '00:11:22:33:44:66', hostname: 'c2-server-45',      country: 'RU',  asn: '25180' },
  { ip: '185.220.101.33',  mac: '00:11:22:33:44:77', hostname: 'tor-exit-33',       country: 'DE',  asn: '60729' },
  { ip: '45.33.32.156',    mac: '00:11:22:33:44:88', hostname: 'scan-host-156',     country: 'NL',  asn: '63949' },
  { ip: '1.1.1.1',         mac: '00:00:00:00:00:03', hostname: 'cloudflare-dns',    country: 'AU',  asn: '13335' },
  { ip: '104.21.15.88',    mac: '00:11:22:33:44:99', hostname: 'cdn-edge-88',       country: 'US',  asn: '13335' },
  { ip: '192.0.2.10',      mac: '00:11:22:33:45:10', hostname: 'mail-gateway-ext',  country: 'US',  asn: '64600' },
];

const ALL_HOSTS = [...HOSTS, ...EXTERNAL];
const getHost = (ip) => ALL_HOSTS.find(h => h.ip === ip) || { ip, mac: '00:00:00:00:00:00', hostname: ip, country: 'US', asn: '0', username: 'unknown', type: 'unknown' };

const BASE = new Date('2026-06-10T06:00:00Z').getTime();
const min = (m) => m * 60 * 1000;

// ─── Scenario Builder ─────────────────────────────────────────────────────────
const sc = (t, src, dst, port, proto, app, bytes, pkts, risk, sev, cat, alarm, malware='', c2=false, beacon=false, lateral=false, exfil=false, scan=false) =>
  ({ t, src, dst, port, proto, app, bytes, pkts, risk, sev, cat, alarm, malware, c2, beacon, lateral, exfil, scan });

const SCENARIOS = [
  // === PHASE 0: BACKGROUND NORMAL TRAFFIC (t=0 to t=10) ===
  sc(0,  '10.10.10.21','10.10.20.12',  445,  'TCP','SMB',      8000,  12, 20, 2,'Normal',  '', '', false,false,false,false,false),
  sc(1,  '10.10.10.22','10.10.20.12',  445,  'TCP','SMB',      6000,  10, 18, 2,'Normal',  '', '', false,false,false,false,false),
  sc(2,  '10.10.10.23','10.10.20.13',  445,  'TCP','SMB',      5000,   8, 15, 2,'Normal',  '', '', false,false,false,false,false),
  sc(3,  '10.10.30.44','10.10.60.100', 389,  'TCP','LDAP',     3200,  10, 20, 2,'Normal',  '', '', false,false,false,false,false),
  sc(4,  '10.10.10.22','8.8.8.8',       53,  'UDP','DNS',       420,   5, 12, 1,'Normal',  '', '', false,false,false,false,false),
  sc(5,  '10.10.50.18','1.1.1.1',        53,  'UDP','DNS',       640,   8, 15, 2,'Normal',  '', '', false,false,false,false,false),
  sc(6,  '10.10.40.55','10.10.40.10',  443,  'TCP','HTTPS',   15000,  22, 25, 3,'Normal',  '', '', false,false,false,false,false),
  sc(7,  '10.10.30.45','10.10.60.100', 88,   'TCP','Kerberos', 1200,   6, 18, 2,'Normal',  '', '', false,false,false,false,false),
  sc(8,  '10.10.20.12','10.10.60.100', 445,  'TCP','SMB',      5000,   8, 20, 2,'Normal',  '', '', false,false,false,false,false),
  sc(9,  '10.10.40.56','10.10.60.100', 389,  'TCP','LDAP',     2800,   9, 22, 2,'Normal',  '', '', false,false,false,false,false),
  sc(10, '10.10.10.24','10.10.20.12',  445,  'TCP','SMB',      7200,  11, 20, 2,'Normal',  '', '', false,false,false,false,false),
  sc(11, '10.10.10.21','10.10.60.100', 88,   'TCP','Kerberos', 1800,   8, 22, 2,'Normal',  '', '', false,false,false,false,false),
  sc(12, '10.10.30.44','10.10.30.1',   8080, 'TCP','HTTP',     9000,  14, 25, 3,'Normal',  '', '', false,false,false,false,false),
  sc(13, '10.10.50.19','10.10.60.100', 389,  'TCP','LDAP',     2400,   8, 18, 2,'Normal',  '', '', false,false,false,false,false),
  sc(14, '10.10.20.15','10.10.60.100', 445,  'TCP','SMB',      4000,   7, 18, 2,'Normal',  '', '', false,false,false,false,false),

  // === PHASE 1: EXTERNAL RECONNAISSANCE (t=20 to t=35) ===
  sc(20, '45.33.32.156','10.10.40.55',  22,  'TCP','SSH',       480,   8, 72, 7,'Recon', 'Port Scan Detected',    '', false,false,false,false,true),
  sc(21, '45.33.32.156','10.10.40.10',  443, 'TCP','HTTPS',     360,   6, 65, 6,'Recon', 'Port Scan Detected',    '', false,false,false,false,true),
  sc(22, '45.33.32.156','10.10.20.12',  445, 'TCP','SMB',       240,   4, 78, 7,'Recon', 'SMB Probe',             '', false,false,false,false,true),
  sc(23, '45.33.32.156','10.10.60.100', 389, 'TCP','LDAP',      320,   5, 81, 8,'Recon', 'LDAP Enumeration',      '', false,false,false,false,true),
  sc(24, '45.33.32.156','10.10.20.14',  3306,'TCP','MySQL',     180,   3, 75, 7,'Recon', 'DB Port Probe',         '', false,false,false,false,true),
  sc(25, '45.33.32.156','10.10.50.18',  8080,'TCP','HTTP',      240,   4, 60, 5,'Recon', 'Web Probe',             '', false,false,false,false,true),
  sc(26, '45.33.32.156','10.10.10.21',  139, 'TCP','SMB',       160,   3, 70, 7,'Recon', 'NetBIOS Probe',         '', false,false,false,false,true),
  sc(27, '45.33.32.156','10.10.20.15',  80,  'TCP','HTTP',      200,   4, 62, 6,'Recon', 'HTTP Probe',            '', false,false,false,false,true),
  sc(28, '45.33.32.156','10.10.60.101', 389, 'TCP','LDAP',      280,   5, 76, 7,'Recon', 'LDAP Enumeration',      '', false,false,false,false,true),
  sc(29, '45.33.32.156','10.10.10.22',  22,  'TCP','SSH',       220,   4, 68, 6,'Recon', 'SSH Probe',             '', false,false,false,false,true),
  sc(30, '45.33.32.156','10.10.30.44',  3389,'TCP','RDP',       300,   5, 74, 7,'Recon', 'RDP Probe',             '', false,false,false,false,true),
  sc(31, '45.33.32.156','10.10.40.56',  22,  'TCP','SSH',       260,   4, 69, 6,'Recon', 'SSH Probe',             '', false,false,false,false,true),
  sc(32, '45.33.32.156','10.10.20.13',  445, 'TCP','SMB',       200,   4, 73, 7,'Recon', 'SMB Probe',             '', false,false,false,false,true),
  sc(33, '45.33.32.156','10.10.70.200', 514, 'UDP','Syslog',    120,   2, 55, 5,'Recon', 'Syslog Probe',          '', false,false,false,false,true),

  // === PHASE 2: INITIAL COMPROMISE — Qakbot on ws-finance-21 (t=40 to t=65) ===
  sc(40, '10.10.10.21','203.0.113.45',  443, 'TCP','HTTPS',   4200,  18, 88, 9, 'Malware','C2 Beacon Detected',  'Qakbot',true,true,false,false,false),
  sc(41, '10.10.10.21','203.0.113.45',  443, 'TCP','HTTPS',   3800,  16, 90, 9, 'Malware','C2 Beacon Detected',  'Qakbot',true,true,false,false,false),
  sc(42, '10.10.10.21','203.0.113.45',  443, 'TCP','HTTPS',   4100,  17, 90, 9, 'Malware','C2 Beacon Detected',  'Qakbot',true,true,false,false,false),
  sc(43, '10.10.10.21','8.8.8.8',        53, 'UDP','DNS',     1200,  20, 82, 7, 'Network','DNS Tunneling Suspected','Qakbot',false,false,false,true,false),
  sc(44, '10.10.10.21','8.8.8.8',        53, 'UDP','DNS',      980,  16, 80, 7, 'Network','DNS Tunneling Suspected','Qakbot',false,false,false,true,false),
  sc(45, '10.10.10.21','8.8.8.8',        53, 'UDP','DNS',     1050,  18, 79, 7, 'Network','DNS Tunneling Suspected','Qakbot',false,false,false,true,false),
  sc(50, '10.10.10.21','203.0.113.45',  443, 'TCP','HTTPS',   3950,  16, 89, 9, 'Malware','C2 Beacon Detected',  'Qakbot',true,true,false,false,false),
  sc(55, '10.10.10.21','203.0.113.45',  443, 'TCP','HTTPS',   4050,  17, 89, 9, 'Malware','C2 Beacon Detected',  'Qakbot',true,true,false,false,false),
  sc(60, '10.10.10.21','203.0.113.45',  443, 'TCP','HTTPS',   4020,  17, 88, 9, 'Malware','C2 Beacon Detected',  'Qakbot',true,true,false,false,false),
  sc(65, '10.10.10.21','203.0.113.45',  443, 'TCP','HTTPS',   3900,  16, 87, 9, 'Malware','C2 Beacon Detected',  'Qakbot',true,true,false,false,false),

  // === PHASE 3: CREDENTIAL HARVESTING (t=70 to t=90) ===
  sc(70, '10.10.10.21','10.10.60.100',  88,  'TCP','Kerberos',2800,  12, 85, 8,'Authentication','Kerberoasting',       '', false,false,true,false,false),
  sc(71, '10.10.10.21','10.10.60.100',  389, 'TCP','LDAP',    6400,  24, 84, 8,'Authentication','LDAP Enumeration',    '', false,false,true,false,false),
  sc(72, '10.10.10.21','10.10.60.100',  445, 'TCP','SMB',    12400,  42, 86, 8,'Authentication','Credentials Access',  '', false,false,true,false,false),
  sc(73, '10.10.10.21','10.10.60.101',  88,  'TCP','Kerberos',3000,  14, 84, 8,'Authentication','Pass-the-Ticket',     '', false,false,true,false,false),
  sc(74, '10.10.10.21','10.10.20.12',   445, 'TCP','SMB',    58320,  42, 74, 8,'Authentication','Credentials Access',  '', false,false,true,false,false),
  sc(75, '10.10.10.21','10.10.20.12',   445, 'TCP','SMB',    58000,  39, 74, 8,'Authentication','Credentials Access',  '', false,false,true,false,false),
  sc(76, '10.10.10.22','10.10.60.100',  88,  'TCP','Kerberos',2200,  10, 80, 7,'Authentication','Kerberoasting',       '', false,false,true,false,false),
  sc(77, '10.10.10.22','10.10.60.100',  389, 'TCP','LDAP',    4800,  18, 78, 7,'Authentication','LDAP Enumeration',    '', false,false,true,false,false),
  sc(80, '10.10.10.21','10.10.60.100',  636, 'TCP','LDAPS',   5600,  22, 83, 8,'Authentication','LDAP over SSL',       '', false,false,true,false,false),
  sc(81, '10.10.10.22','10.10.60.100',  445, 'TCP','SMB',     9800,  36, 79, 7,'Authentication','Credentials Access',  '', false,false,true,false,false),
  sc(82, '10.10.10.24','10.10.60.100',  88,  'TCP','Kerberos',1800,   8, 72, 6,'Authentication','Kerberos Anomaly',    '', false,false,true,false,false),
  sc(85, '10.10.10.23','10.10.60.100',  389, 'TCP','LDAP',    3600,  14, 76, 7,'Authentication','LDAP Enumeration',    '', false,false,true,false,false),
  sc(88, '10.10.10.21','10.10.20.14',   3306,'TCP','MySQL',  128000,  88, 91, 9,'Authentication','DB Credential Use',  '', false,false,true,true, false),
  sc(90, '10.10.10.21','10.10.20.15',   80,  'TCP','HTTP',    24000,  32, 72, 7,'Authentication','Internal App Access', '', false,false,true,false,false),

  // === PHASE 4: LATERAL MOVEMENT (t=95 to t=120) ===
  sc(95, '10.10.10.21','10.10.20.13',   445, 'TCP','SMB',    42000,  35, 82, 8,'LateralMovement','Lateral Movement',  '', false,false,true,false,false),
  sc(96, '10.10.10.21','10.10.20.14',   3306,'TCP','MySQL', 128000,  88, 91, 9,'LateralMovement','DB Access',         '', false,false,true,true, false),
  sc(97, '10.10.10.22','10.10.20.12',   445, 'TCP','SMB',    36000,  30, 68, 6,'LateralMovement','Lateral Movement',  '', false,false,true,false,false),
  sc(98, '10.10.10.23','10.10.20.13',   445, 'TCP','SMB',    28000,  24, 65, 6,'LateralMovement','Lateral Movement',  '', false,false,true,false,false),
  sc(99, '10.10.10.21','10.10.10.22',   445, 'TCP','SMB',    14000,  18, 76, 7,'LateralMovement','Internal SMB Spread','', false,false,true,false,false),
  sc(100,'10.10.10.22','10.10.10.23',   445, 'TCP','SMB',     9800,  12, 72, 7,'LateralMovement','Internal SMB Spread','',false,false,true,false,false),
  sc(101,'10.10.10.21','10.10.30.44',   445, 'TCP','SMB',    22000,  26, 84, 8,'LateralMovement','Cross-Segment SMB', '', false,false,true,false,false),
  sc(102,'10.10.10.22','10.10.30.45',   445, 'TCP','SMB',    18000,  22, 78, 7,'LateralMovement','Cross-Segment SMB', '', false,false,true,false,false),
  sc(103,'10.10.10.21','10.10.40.55',   22,  'TCP','SSH',    11000,  16, 82, 8,'LateralMovement','SSH Lateral Move',  '', false,false,true,false,false),
  sc(104,'10.10.10.21','10.10.50.18',   445, 'TCP','SMB',    16000,  20, 74, 7,'LateralMovement','Cross-Segment SMB', '', false,false,true,false,false),
  sc(105,'10.10.40.55','10.10.60.100',  88,  'TCP','Kerberos',5200,  22, 87, 8,'LateralMovement','Privilege Escalation','',false,false,true,false,false),
  sc(106,'10.10.40.55','10.10.20.12',   445, 'TCP','SMB',    75000,  58, 89, 9,'LateralMovement','Admin Lateral Move','', false,false,true,false,false),
  sc(107,'10.10.40.56','10.10.20.13',   445, 'TCP','SMB',    60000,  48, 85, 8,'LateralMovement','Admin Lateral Move','', false,false,true,false,false),
  sc(108,'10.10.40.55','10.10.20.14',   3306,'TCP','MySQL', 240000, 180, 94, 9,'LateralMovement','Admin DB Access',   '', false,false,true,true, false),
  sc(110,'10.10.10.24','10.10.20.12',   445, 'TCP','SMB',    12000,  16, 66, 6,'LateralMovement','Lateral Movement',  '', false,false,true,false,false),

  // === PHASE 5: ENG NETWORK COMPROMISE — TrickBot (t=120 to t=150) ===
  sc(120,'10.10.30.44','203.0.113.45',  443, 'TCP','HTTPS',  4200,   18, 95,10,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(121,'10.10.30.44','203.0.113.45',  443, 'TCP','HTTPS',  3900,   16, 95,10,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(122,'10.10.30.44','203.0.113.45',  443, 'TCP','HTTPS',  4050,   17, 95,10,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(123,'10.10.30.44','10.10.30.1',    8080,'TCP','HTTP',  188040,  120, 91, 9,'Malware','Payload Download', 'TrickBot',false,false,false,false,false),
  sc(124,'10.10.30.44','10.10.30.45',   445, 'TCP','SMB',    22000,   20, 88, 9,'LateralMovement','Lateral SMB',  'TrickBot',false,false,true,false,false),
  sc(125,'10.10.30.45','203.0.113.45',  443, 'TCP','HTTPS',  3800,   16, 93, 9,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(126,'10.10.30.45','203.0.113.45',  443, 'TCP','HTTPS',  4000,   17, 93, 9,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(127,'10.10.30.46','10.10.30.44',   445, 'TCP','SMB',    14000,   18, 80, 8,'LateralMovement','Internal SMB','',        false,false,true,false,false),
  sc(128,'10.10.30.46','203.0.113.45',  443, 'TCP','HTTPS',  3700,   15, 90, 9,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(130,'10.10.30.44','203.0.113.45',  443, 'TCP','HTTPS',  4200,   18, 95,10,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(135,'10.10.30.45','203.0.113.45',  443, 'TCP','HTTPS',  3900,   16, 93, 9,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),
  sc(140,'10.10.30.46','203.0.113.45',  443, 'TCP','HTTPS',  3750,   15, 90, 9,'Malware','C2 Beacon Detected',  'TrickBot',true,true,false,false,false),

  // === PHASE 6: TOR TRAFFIC (t=145 to t=160) ===
  sc(145,'10.10.30.44','185.220.101.33',9001,'TCP','TOR',    28000,   40, 96, 9,'Malware','TOR Traffic',         'TrickBot',true,false,false,false,false),
  sc(146,'10.10.30.45','185.220.101.33',9001,'TCP','TOR',    24000,   35, 95, 9,'Malware','TOR Traffic',         'TrickBot',true,false,false,false,false),
  sc(147,'10.10.10.21','185.220.101.33',9001,'TCP','TOR',    18000,   28, 94, 9,'Malware','TOR Traffic',         'Qakbot',  true,false,false,false,false),
  sc(148,'10.10.10.22','185.220.101.33',9001,'TCP','TOR',    16000,   25, 90, 9,'Malware','TOR Traffic',         'Qakbot',  true,false,false,false,false),
  sc(149,'10.10.30.46','185.220.101.33',9001,'TCP','TOR',    20000,   30, 92, 9,'Malware','TOR Traffic',         'TrickBot',true,false,false,false,false),

  // === PHASE 7: PRIVILEGE ESCALATION & DATA STAGING (t=155 to t=175) ===
  sc(155,'10.10.40.55','10.10.40.10',   443, 'TCP','HTTPS',  42120,   64, 63, 5,'Authentication','Admin Login',        '', false,false,false,false,false),
  sc(156,'10.10.40.55','10.10.60.100',  88,  'TCP','Kerberos',5200,   22, 87, 8,'Authentication','Privilege Escalation','',false,false,true,false,false),
  sc(157,'10.10.40.55','10.10.20.12',   445, 'TCP','SMB',    75000,   58, 89, 9,'LateralMovement','Admin Lateral Move','',false,false,true,false,false),
  sc(158,'10.10.40.55','10.10.20.14',   3306,'TCP','MySQL', 240000,  180, 94, 9,'DataExfiltration','DB Exfil','',      false,false,false,true,false),
  sc(159,'10.10.40.56','10.10.40.10',   443, 'TCP','HTTPS',  38000,   52, 70, 7,'Authentication','Admin Login',        '', false,false,false,false,false),
  sc(160,'10.10.40.56','10.10.20.12',   445, 'TCP','SMB',    62000,   50, 86, 8,'LateralMovement','Admin Lateral Move','',false,false,true,false,false),
  sc(161,'10.10.40.56','10.10.20.13',   445, 'TCP','SMB',    55000,   44, 84, 8,'LateralMovement','Admin Lateral Move','',false,false,true,false,false),
  sc(162,'10.10.40.55','10.10.20.15',   80,  'TCP','HTTP',   88000,   72, 78, 8,'DataExfiltration','App Data Access','',false,false,false,true,false),
  sc(163,'10.10.40.55','10.10.60.101',  88,  'TCP','Kerberos',4800,   20, 85, 8,'Authentication','DCSync Attack',      '', false,false,true,false,false),
  sc(164,'10.10.40.56','10.10.20.14',   3306,'TCP','MySQL', 180000,  140, 92, 9,'DataExfiltration','DB Exfil',         '', false,false,false,true,false),
  sc(165,'10.10.40.55','10.10.70.200',  514, 'UDP','Syslog',  8000,   12, 68, 6,'Tampering','SIEM Log Tampering',    '', false,false,false,false,false),

  // === PHASE 8: DATA EXFILTRATION (t=175 to t=195) ===
  sc(175,'10.10.40.55','198.51.100.77', 8443,'TCP','HTTPS', 912540,  184, 99,10,'DataExfiltration','Data Exfil',       '', false,false,false,true,false),
  sc(176,'10.10.40.55','198.51.100.77', 8443,'TCP','HTTPS',1024000,  210, 99,10,'DataExfiltration','Data Exfil',       '', false,false,false,true,false),
  sc(177,'10.10.40.56','198.51.100.77', 8443,'TCP','HTTPS', 768000,  160, 97,10,'DataExfiltration','Data Exfil',       '', false,false,false,true,false),
  sc(178,'10.10.20.14','198.51.100.77', 8443,'TCP','HTTPS', 524288,  128, 96, 9,'DataExfiltration','DB Data Exfil',   '', false,false,false,true,false),
  sc(179,'10.10.20.13','198.51.100.77', 8443,'TCP','HTTPS', 420000,  100, 94, 9,'DataExfiltration','HR Data Exfil',   '', false,false,false,true,false),
  sc(180,'10.10.40.55','198.51.100.77', 8443,'TCP','HTTPS', 650000,  140, 98,10,'DataExfiltration','Data Exfil',       '', false,false,false,true,false),
  sc(181,'10.10.10.21','198.51.100.77', 8443,'TCP','HTTPS', 320000,   80, 93, 9,'DataExfiltration','Data Exfil',       '', false,false,false,true,false),
  sc(182,'10.10.30.44','198.51.100.77', 8443,'TCP','HTTPS', 280000,   70, 91, 9,'DataExfiltration','Data Exfil',   'TrickBot',false,false,false,true,false),
  sc(183,'10.10.40.56','104.21.15.88',  443, 'TCP','HTTPS', 512000,  120, 90, 9,'DataExfiltration','CDN Exfil',        '', false,false,false,true,false),

  // === PHASE 9: DNS C2 — Lab hosts (t=195 to t=215) ===
  sc(195,'10.10.50.18','9.9.9.9',        53, 'UDP','DNS',    1680,    22, 58, 5,'Network','DNS Spike',                '', false,false,false,false,false),
  sc(196,'10.10.50.18','8.8.8.8',         53, 'UDP','DNS',   2400,    30, 66, 6,'Network','DNS Tunneling Suspected',  '', false,false,false,true, false),
  sc(197,'10.10.50.19','8.8.8.8',         53, 'UDP','DNS',   1900,    24, 62, 6,'Network','DNS Tunneling Suspected',  '', false,false,false,true, false),
  sc(198,'10.10.50.18','203.0.113.45',   443, 'TCP','HTTPS', 3600,    15, 88, 8,'Malware','C2 Contact',               '', true, true, false,false,false),
  sc(199,'10.10.50.19','203.0.113.45',   443, 'TCP','HTTPS', 3400,    14, 85, 8,'Malware','C2 Contact',               '', true, true, false,false,false),
  sc(200,'10.10.50.18','9.9.9.9',         53, 'UDP','DNS',   2100,    26, 64, 6,'Network','DNS Tunneling Suspected',  '', false,false,false,true, false),
  sc(201,'10.10.50.18','203.0.113.45',   443, 'TCP','HTTPS', 3700,    15, 88, 8,'Malware','C2 Beacon Detected',       '', true, true, false,false,false),
  sc(202,'10.10.50.19','185.220.101.33',9001, 'TCP','TOR',  14000,    22, 88, 8,'Malware','TOR Traffic',              '', true, false,false,false,false),
  sc(205,'10.10.50.18','1.1.1.1',         53, 'UDP','DNS',    720,     9, 20,  2,'Normal','',                          '', false,false,false,false,false),

  // === PHASE 10: CLEANUP ATTEMPT / SIEM EVASION (t=210 to t=220) ===
  sc(210,'10.10.40.55','10.10.70.200',  514, 'UDP','Syslog',12000,    16, 76, 7,'Tampering','Log Deletion Attempt',  '', false,false,false,false,false),
  sc(211,'10.10.40.56','10.10.70.200',  514, 'UDP','Syslog', 8000,    12, 72, 6,'Tampering','Log Modification',      '', false,false,false,false,false),
  sc(212,'10.10.40.55','10.10.60.100',  445, 'TCP','SMB',   32000,    28, 80,  8,'Tampering','GPO Modification',      '', false,false,true,false,false),
  sc(213,'10.10.40.55','10.10.60.101',  389, 'TCP','LDAP',  18000,    24, 78,  7,'Tampering','Account Modification',  '', false,false,true,false,false),

  // === PHASE 11: LATE NORMAL TRAFFIC (t=220+) ===
  sc(220,'10.10.10.22','10.10.20.12',   445, 'TCP','SMB',    8500,    12, 22,  2,'Normal','',                         '', false,false,false,false,false),
  sc(221,'10.10.10.23','10.10.20.13',   445, 'TCP','SMB',    6200,    10, 18,  2,'Normal','',                         '', false,false,false,false,false),
  sc(222,'10.10.30.46','10.10.60.100',  389, 'TCP','LDAP',   3000,     9, 20,  2,'Normal','',                         '', false,false,false,false,false),
  sc(223,'10.10.10.24','8.8.8.8',         53,'UDP','DNS',     380,     4, 12,  1,'Normal','',                         '', false,false,false,false,false),
  sc(224,'10.10.20.15','10.10.60.100',  445, 'TCP','SMB',    4200,     7, 18,  2,'Normal','',                         '', false,false,false,false,false),
  sc(225,'10.10.50.19','1.1.1.1',         53,'UDP','DNS',     560,     7, 15,  2,'Normal','',                         '', false,false,false,false,false),
  sc(226,'10.10.40.56','10.10.40.10',   443, 'TCP','HTTPS', 18000,    26, 28,  3,'Normal','',                         '', false,false,false,false,false),
  sc(227,'10.10.30.46','10.10.30.1',    8080,'TCP','HTTP',   9500,    15, 25,  3,'Normal','',                         '', false,false,false,false,false),
  sc(228,'10.10.20.12','10.10.60.100',  445, 'TCP','SMB',    5200,     8, 20,  2,'Normal','',                         '', false,false,false,false,false),
  sc(229,'10.10.60.101','10.10.60.100', 389, 'TCP','LDAP',   2200,     7, 18,  2,'Normal','',                         '', false,false,false,false,false),
  sc(230,'10.10.10.21','10.10.60.100',  88,  'TCP','Kerberos',1400,    6, 22,  2,'Normal','',                         '', false,false,false,false,false),
  sc(231,'10.10.30.44','10.10.60.100',  88,  'TCP','Kerberos',1600,    7, 20,  2,'Normal','',                         '', false,false,false,false,false),
];

SCENARIOS.sort((a, b) => a.t - b.t);

// Utility functions
const ts = (offsetMin, jitterSec = 0) =>
  new Date(BASE + min(offsetMin) + jitterSec * 1000).toISOString();

const rnd = (seed, len=8) => String(seed).replace(/[^a-z0-9]/gi,'').slice(0,len).padEnd(len,'a');
const randMd5  = (s) => `md5_${rnd(s,12)}`;
const randSha  = (s) => `sha256_${rnd(s,16)}`;
const randJa3  = (s) => `ja3_${rnd(s,10)}`;

const userAgents = {
  'SMB':'Windows SMB Client','DNS':'Windows DNS Resolver','HTTPS':'Python-Requests/2.31',
  'HTTP':'Windows Defender','Kerberos':'Windows Kerberos','LDAP':'ldapsearch/64',
  'LDAPS':'ldapsearch-ssl/64','MySQL':'MySQL Connector/8.0','TOR':'Tor Browser/13',
  'SSH':'OpenSSH_8.9','Syslog':'rsyslog/8.2','RDP':'mstsc.exe/10.0',
};
const authTypes = ['NTLM','Kerberos','LDAP','SSO','Local','OAuth'];
const processMap = {
  'SMB':'explorer.exe','DNS':'svchost.exe','HTTPS':'cmd.exe','HTTP':'powershell.exe',
  'Kerberos':'lsass.exe','LDAP':'dsquery.exe','LDAPS':'dsquery.exe','MySQL':'python.exe',
  'TOR':'tor.exe','SSH':'plink.exe','Syslog':'syslog-ng.exe','RDP':'mstsc.exe',
};
const ciphers = ['TLS_AES_128_GCM_SHA256','TLS_AES_256_GCM_SHA384','TLS_CHACHA20_POLY1305_SHA256'];
const sevLabel = {10:'critical',9:'critical',8:'high',7:'high',6:'medium',5:'medium',4:'low',3:'low',2:'info',1:'info'};

const escapeCSV = (v) => {
  const s = String(v ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
};
const row = (fields) => fields.map(escapeCSV).join(',');

// ─── QRadar CSV ──────────────────────────────────────────────────────────────
const qHeaders = ['event_id','qid','qid_name','category','severity','credibility','relevance','magnitude','start_time','source_ip','source_port','source_mac','source_hostname','source_country','destination_ip','destination_port','destination_mac','destination_hostname','destination_country','protocol','application','direction','packet_count','byte_count','username','authentication_type','process_name','command_line','filename','md5','sha256','url','domain','dns_query','user_agent','offense_id','risk_score','log_source_name','raw_event'];

const qRows = SCENARIOS.map((s, i) => {
  const src = getHost(s.src), dst = getHost(s.dst);
  const t = ts(s.t, (i % 5) * 3);
  const fn = s.malware ? `payload_${s.malware.toLowerCase()}.bin` : '';
  const domain = dst.hostname;
  const url = ['HTTPS','HTTP'].includes(s.app) ? `${s.app.toLowerCase()}://${dst.hostname}/data` : '';
  const dns = s.app === 'DNS' ? `${dst.hostname}` : '';
  const proc = processMap[s.app] || 'svchost.exe';
  const cmd = `${proc} --target ${dst.ip} --op ${s.cat.toLowerCase().replace(/\s/g,'_')}`;
  return row([
    `QR-${1000+i}`, `QID-${50000+i}`, s.alarm || s.cat, s.cat,
    s.sev, Math.max(1,9-Math.floor(s.sev*0.3)), Math.min(10,5+i%5), Math.min(10,Math.round(s.risk/10)),
    t, src.ip, 49152+(i%10000), src.mac, src.hostname, src.country,
    dst.ip, s.port, dst.mac, dst.hostname, dst.country,
    s.proto, s.app, 'OUTBOUND', s.pkts, s.bytes,
    src.username||'unknown', authTypes[i%authTypes.length], proc, cmd,
    fn, fn?randMd5(fn):'', fn?randSha(fn):'',
    url, domain, dns, userAgents[s.app]||'Windows',
    `off-${3000+Math.floor(i/5)}`, s.risk, 'QRadar Core',
    `${s.alarm||s.cat} detected: ${src.hostname} -> ${dst.hostname} via ${s.app}`
  ]);
});

// ─── SNA Flows CSV ────────────────────────────────────────────────────────────
const sHeaders = ['flow_id','conversation_id','first_seen','last_seen','duration','src_ip','src_port','src_mac','src_hostname','src_country','src_asn','dst_ip','dst_port','dst_mac','dst_hostname','dst_country','dst_asn','protocol','application','packets','bytes','packet_rate','byte_rate','tcp_flags','latency','flow_direction','vlan','interface_in','interface_out','ja3','ja3s','tls_version','cipher_suite','sni','dns_query','http_host','http_uri','http_user_agent','threat_score','risk_score','anomaly_score','beaconing_score','lateral_movement_score','alarm_name','alarm_severity','ioc_match','raw_flow'];

const sRows = SCENARIOS.map((s, i) => {
  const src = getHost(s.src), dst = getHost(s.dst);
  const first = ts(s.t, (i%5)*3);
  const dur = Math.max(5, Math.floor(s.pkts*0.35 + 8 + i%18));
  const last = new Date(new Date(first).getTime() + dur*1000).toISOString();
  const isTLS = ['HTTPS','TOR'].includes(s.app);
  const tls = isTLS ? '1.3' : '';
  const cipher = isTLS ? ciphers[i%3] : '';
  const sni = isTLS ? dst.hostname : '';
  const ja3v = isTLS ? randJa3(`s${i}src`) : '';
  const ja3sv = isTLS ? randJa3(`s${i}dst`) : '';
  const dns = s.app==='DNS' ? dst.hostname : '';
  const httpHost = ['HTTP','HTTPS'].includes(s.app) ? dst.hostname : '';
  const httpUri = s.exfil ? '/upload' : s.c2 ? '/beacon' : httpHost ? '/data' : '';
  const ua = userAgents[s.app]||'';
  const ioc = (s.c2||s.exfil||s.malware) ? 'yes' : 'no';
  return row([
    `SN-${2000+i}`, `CV-${9000+i}`, first, last, dur,
    src.ip, 49152+(i%10000), src.mac, src.hostname, src.country, src.asn||'64512',
    dst.ip, s.port, dst.mac, dst.hostname, dst.country, dst.asn||'64599',
    s.proto, s.app, s.pkts, s.bytes,
    (s.pkts/dur).toFixed(2), Math.floor(s.bytes/dur),
    s.proto==='TCP'?'PA':'.', 10+i%25, 'egress',
    100+(i%6)*20, `eth${i%4}`, `eth${(i+1)%4}`,
    ja3v, ja3sv, tls, cipher, sni,
    dns, httpHost, httpUri, ua,
    Math.floor(s.risk*0.65), s.risk,
    Math.floor(s.risk*0.28+i%12), s.beacon?Math.floor(s.risk*0.55):0, s.lateral?Math.floor(s.risk*0.45):0,
    s.alarm||s.cat, sevLabel[s.sev]||'low', ioc,
    `${src.hostname}->${dst.hostname} ${s.proto}/${s.app} ${s.bytes}B ${s.pkts}pkts`
  ]);
});

// ─── Arista NDR CSV ───────────────────────────────────────────────────────────
const aHeaders = ['alert_id','flow_id','alert_name','alert_type','severity','confidence','risk_score','start_time','end_time','src_ip','src_port','src_mac','src_hostname','src_country','dst_ip','dst_port','dst_mac','dst_hostname','dst_country','protocol','application','packets','bytes','dns_query','dns_response','http_method','http_host','http_uri','http_status','http_user_agent','tls_version','cipher_suite','ja3','ja3s','sni','filename','md5','sha256','ioc_match','malware_family','c2_activity','beaconing','lateral_movement','data_exfiltration','port_scanning','user_name','authentication_result','anomaly_score','geo_latitude','geo_longitude','raw_metadata'];

// Arista generates alerts for all risk>=50 or alarmed scenarios
const aristaScenarios = SCENARIOS.filter(s => s.risk >= 50 || s.alarm);

const aRows = aristaScenarios.map((s, i) => {
  const src = getHost(s.src), dst = getHost(s.dst);
  const idx = SCENARIOS.indexOf(s);
  const first = ts(s.t, (i%5)*3+5);
  const dur = Math.max(5, Math.floor(s.pkts*0.35+8));
  const last = new Date(new Date(first).getTime() + dur*1000).toISOString();
  const isTLS = ['HTTPS','TOR'].includes(s.app);
  const tls = isTLS ? '1.3' : '';
  const cipher = isTLS ? ciphers[i%3] : '';
  const sni = isTLS ? dst.hostname : '';
  const ja3v = isTLS ? randJa3(`a${i}src`) : '';
  const ja3sv = isTLS ? randJa3(`a${i}dst`) : '';
  const fn = s.malware ? `payload_${s.malware.toLowerCase()}.bin` : '';
  const dns = s.app==='DNS' ? dst.hostname : '';
  const dnsR = dns ? 'NOERROR' : '';
  const httpM = ['HTTP','HTTPS'].includes(s.app) ? (s.exfil?'POST':'GET') : '';
  const httpH = httpM ? dst.hostname : '';
  const httpU = s.exfil?'/upload':s.c2?'/beacon':httpM?'/data':'';
  const httpSt = httpM ? '200' : '';
  const ua = userAgents[s.app]||'';
  const ioc = (s.c2||s.exfil||s.malware) ? 'yes' : 'no';
  const alarmType = s.malware?'Malware':s.c2?'C2':s.exfil?'Data Exfiltration':s.lateral?'Behavioral':s.scan?'Reconnaissance':'Behavioral';
  const conf = Math.min(99, s.risk + 3);
  const geoLat = { US:'37.7749', RU:'55.7558', DE:'52.5200', NL:'52.3676', AU:'-33.8688' }[src.country] || '37.7749';
  const geoLon = { US:'-122.4194', RU:'37.6173', DE:'13.4050', NL:'4.9041', AU:'151.2093' }[src.country] || '-122.4194';
  return row([
    `AR-${3000+i}`, `SN-${2000+idx}`,
    s.alarm||s.cat, alarmType, sevLabel[s.sev]||'low', conf, s.risk,
    first, last,
    src.ip, 49152+(idx%10000), src.mac, src.hostname, src.country,
    dst.ip, s.port, dst.mac, dst.hostname, dst.country,
    s.proto, s.app, s.pkts, s.bytes,
    dns, dnsR, httpM, httpH, httpU, httpSt, ua,
    tls, cipher, ja3v, ja3sv, sni,
    fn, fn?randMd5(fn):'', fn?randSha(fn):'',
    ioc, s.malware||'', s.c2?'yes':'no', s.beacon?'yes':'no',
    s.lateral?'yes':'no', s.exfil?'yes':'no', s.scan?'yes':'no',
    src.username||'unknown', 'success',
    Math.floor(s.risk*0.35+i%12), geoLat, geoLon,
    `Arista NDR: ${s.alarm||s.cat} on ${src.hostname}->${dst.hostname} [${s.app}]`
  ]);
});

// ─── Write Files ───────────────────────────────────────────────────────────────
const writeCSV = (filename, headers, rows) => {
  const content = [headers.join(','), ...rows].join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, filename), content, 'utf8');
  console.log(`✓ ${filename}: ${rows.length} data rows`);
};

writeCSV('qradar_events.csv', qHeaders, qRows);
writeCSV('sna_flows.csv', sHeaders, sRows);
writeCSV('arista_ndr.csv', aHeaders, aRows);

const uniqueIPs = [...new Set(SCENARIOS.flatMap(s => [s.src, s.dst]))];
console.log(`\nTotals  → QRadar: ${qRows.length}  SNA: ${sRows.length}  Arista: ${aRows.length}`);
console.log(`Unique IPs: ${uniqueIPs.length}`);
console.log(`Attack phases: Recon → Initial Compromise (Qakbot) → Credential Harvesting → Lateral Movement → TrickBot → TOR → Privilege Escalation → Exfiltration → DNS C2 → Cleanup`);
