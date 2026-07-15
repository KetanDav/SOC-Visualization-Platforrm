# SOC Telemetry Visualization Platform

> **Phase-1 POC** — A local-only, analyst-facing cyber telemetry exploration tool that ingests raw vendor exports from IBM QRadar, Cisco SNA, and Arista NDR, normalizes them into a unified schema, and renders an interactive multi-view SOC dashboard.

![Platform Preview](./docs/preview.png)

---

## 🚀 Quick Start

```bash
# Install all workspace dependencies
npm install

# Start backend (port 3001) + frontend (port 5173) together
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗂 Project Structure

```
IAF/
├── backend/           # Express + TypeScript API server
│   └── src/
│       ├── index.ts           # Entry point, /api/payload endpoint
│       ├── loadCsv.ts         # CSV file reader (papaparse)
│       └── normalize.ts       # Multi-vendor normalization engine
│
├── frontend/          # React + Vite + TypeScript dashboard
│   └── src/
│       ├── App.tsx                        # Root: state, filters, playback
│       ├── styles.css                     # SOC dark-theme design system
│       ├── lib/telemetry.ts               # Filter helpers, color utilities
│       └── components/
│           ├── CommunicationGraph.tsx     # Cytoscape.js force-directed graph
│           ├── SequencePanel.tsx          # SVG swimlane sequence diagram
│           ├── SankeyChart.tsx            # ECharts Sankey diagram
│           ├── TimelineChart.tsx          # ECharts timeline bar+scatter
│           ├── EntityWorkspace.tsx        # Tabbed view (Assets/Flows/Events/Alerts)
│           ├── DetailsPanel.tsx           # Entity inspector panel
│           └── FilterBar.tsx             # IP/Protocol/Hostname filters + playback
│
├── data/              # Raw vendor CSV exports
│   ├── qradar_events.csv     # IBM QRadar SIEM events (130 rows)
│   ├── sna_flows.csv         # Cisco Secure Network Analytics flows (130 rows)
│   ├── arista_ndr.csv        # Arista NDR alerts (102 rows)
│   └── generate.mjs          # Data generator script (run with: node generate.mjs)
│
└── shared/            # Shared TypeScript types
    └── src/index.ts          # NormalizedPayload, Asset, Flow, EventRecord, AlertRecord
```

---

## 📡 Data Architecture

### Vendor Sources → Unified Schema

| Vendor | File | Generates |
|--------|------|-----------|
| IBM QRadar | `qradar_events.csv` | `flows[]` + `events[]` |
| Cisco SNA | `sna_flows.csv` | `flows[]` + `alerts[]` |
| Arista NDR | `arista_ndr.csv` | enriches SNA flows + `alerts[]` |

### Cross-Vendor Correlation

Arista NDR rows reference SNA `flow_id` values (e.g., `SN-2001`). The normalizer uses this to **enrich** existing SNA flows with Arista metadata (JA3 fingerprints, SNI, malware family) rather than creating duplicate flow records. Risk scores are escalated to the higher of the two vendors.

### Simulated Attack Scenario

The dataset represents a multi-phase APT intrusion across `~28 unique IPs`:

```
Phase 0: Normal background traffic
Phase 1: External port scan (45.33.32.156 → internal hosts)
Phase 2: Qakbot initial compromise (ws-finance-21 → C2 203.0.113.45)
Phase 3: Credential harvesting (Kerberoasting, LDAP enum, DCSync)
Phase 4: Lateral movement (SMB spread across finance/eng/ops subnets)
Phase 5: TrickBot on engineering workstations → C2 beaconing
Phase 6: TOR traffic (port 9001 to 185.220.101.33)
Phase 7: Privilege escalation via jump hosts → domain controllers
Phase 8: Data exfiltration to cloud (198.51.100.77:8443, 1GB+)
Phase 9: DNS C2 tunneling from lab hosts
Phase 10: Log tampering / SIEM evasion attempt
```

---

## 🖥 Dashboard Views

### Home Tab
- **Communication Graph** — Cytoscape.js force-directed graph. Nodes colored by subnet, sized by traffic volume, edges colored by risk score. Hover to highlight neighbors; click to anchor the inspector.
- **Communication Chain** — SVG swimlane sequence diagram showing IP→IP→IP flows with protocol badges, timestamps, and risk indicators.
- **Entity Inspector** — Rich detail panel: asset metadata, malware families, IOC matches, high-risk flow list, critical alert summary.
- **Sankey Diagram** — Traffic volume flows between source/destination pairs.
- **Timeline** — Bytes over time (bar), events (line), alert risk (scatter).

### Assets Tab
Deduplicated inventory across all three vendors. Merges hostname, MAC, country, ASN, username from whichever vendor knows the most about each IP.

### Flows Tab
Full flow table (source, destination, protocol, bytes, risk bar) + the sequence diagram side by side.

### Events Tab
QRadar security events with severity color-banding (left border: red=critical, amber=medium, green=low), category, domain, and linked username.

### Alerts Tab
Combined SNA + Arista alert feed with risk bar meters, IOC red-pill badges, malware family labels, and anomaly scores.

---

## 🔧 Re-generating Test Data

```bash
cd data
node generate.mjs
```

The generator creates fully interconnected rows — the same IPs, hostnames, and MACs appear consistently across all three vendor files. Arista `flow_id` values reference SNA `flow_id` values for cross-vendor correlation.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Graph | Cytoscape.js |
| Charts | Apache ECharts |
| Sequence | Custom SVG/React |
| Backend | Express + Node.js + tsx |
| CSV parsing | PapaParse |
| Shared types | TypeScript workspace package |
| Monorepo | npm workspaces |

---

## 📋 Phase-1 Constraints

- **Local-only** — no external database, no auth, no cloud dependencies
- **Static data** — CSV files are loaded once at startup
- **No persistence** — all state lives in React memory
- **No tests** — this is an exploratory POC

---

## 🗺 Roadmap (Phase 2+)

- [ ] Real-time WebSocket streaming from SIEM
- [ ] PostgreSQL/TimescaleDB persistence
- [ ] MITRE ATT&CK tactic/technique tagging
- [ ] IP geolocation map overlay
- [ ] Alert correlation rules engine
- [ ] Multi-tenant authentication

---

*Built as a Phase-1 SOC investigation platform POC.*
