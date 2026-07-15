# SOC Telemetry Visualization Platform

> **Phase-1 POC** — A local-only, analyst-facing cyber telemetry exploration tool that ingests raw vendor exports, normalizes them into a unified schema, and renders an interactive multi-view SOC dashboard.

---

## Table of Contents

1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Architecture](#architecture)
6. [Data Pipeline](#data-pipeline)
7. [Backend](#backend)
8. [Frontend](#frontend)
9. [Shared Types](#shared-types)
10. [API Reference](#api-reference)
11. [Dashboard Views](#dashboard-views)
12. [AI Incident Analysis](#ai-incident-analysis)
13. [CSV Upload System](#csv-upload-system)
14. [Running the Project](#running-the-project)
15. [Data Generation](#data-generation)
16. [Phase-1 Constraints](#phase-1-constraints)
17. [Roadmap](#roadmap)

---

## Overview

The SOC Telemetry Visualization Platform is a **supporting visualization and exploration tool** for SIEM/NDR telemetry — not a SIEM replacement. It is designed to help SOC analysts visually understand communication relationships, entity correlations, and threat timelines far faster than traditional log-table dashboards.

The platform ingests CSV exports from up to six vendor sources, normalizes them into four unified logical tables (assets, flows, events, alerts), and renders them across an interactive dark-themed dashboard with multiple synchronized visualizations.

---

## Design Philosophy

- **Visualization first** — every design decision prioritizes clarity of communication relationships over raw data density
- **Analyst-friendly** — SOC dark theme, readable at a glance, interaction flows match how an analyst investigates
- **Minimal complexity** — no database, no auth, no external services required to run
- **Correlation-oriented** — the same IP, host, or flow appears consistently across all views and visualizations
- **Simple to run** — `npm install && npm run dev` is all that's needed

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend framework | React 18 + TypeScript | Component-based UI |
| Build tool | Vite 7 | Dev server + HMR + bundling |
| Graph visualization | Cytoscape.js | Force-directed communication graph |
| Chart library | Apache ECharts | Sankey, timeline bar/scatter charts |
| Sequence diagram | Custom SVG/React | Swimlane communication chain |
| Backend runtime | Node.js + Express | REST API, CSV loading, normalization |
| TypeScript runner | tsx (watch mode) | Hot-reload backend in development |
| CSV parsing | csv-parse (backend), PapaParse (frontend) | Vendor CSV ingestion |
| Monorepo | npm workspaces | Shared types between frontend and backend |
| AI analysis (optional) | Google Gemini API / Ollama | Local incident narrative generation |

---

## Project Structure

```
soc-telemetry-visualization-platform/
│
├── backend/                    # Express API server
│   ├── src/
│   │   ├── index.ts            # App entry point, all API routes
│   │   ├── loadCsv.ts          # CSV file loading (default + uploaded)
│   │   ├── normalize.ts        # Multi-vendor normalization engine
│   │   ├── exportNormalized.ts # Writes normalized tables to data/normalized/
│   │   ├── incidentAnalysis.ts # AI analysis orchestration
│   │   ├── incidentPrompt.ts   # Prompt builder for LLM context
│   │   ├── geminiClient.ts     # Google Gemini API client
│   │   ├── ollamaClient.ts     # Local Ollama LLM client
│   │   ├── analysisConfig.ts   # LLM provider config via env vars
│   │   └── zipBuilder.ts       # ZIP archive builder for CSV export
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # React + Vite dashboard
│   ├── src/
│   │   ├── App.tsx             # Root component: state, filters, routing
│   │   ├── main.tsx            # React DOM entry point
│   │   ├── styles.css          # Global SOC dark-theme design system
│   │   ├── lib/
│   │   │   └── telemetry.ts    # Filter helpers, color utilities
│   │   └── components/
│   │       ├── CommunicationGraph.tsx   # Cytoscape.js force-directed graph
│   │       ├── SequencePanel.tsx        # SVG swimlane sequence diagram
│   │       ├── SankeyChart.tsx          # ECharts Sankey traffic diagram
│   │       ├── TimelineChart.tsx        # ECharts bar+line+scatter timeline
│   │       ├── SnakeTimeline.tsx        # Vertical winding incident timeline
│   │       ├── DashboardTab.tsx         # Dashboard overview tab
│   │       ├── GraphTab.tsx             # Full-screen graph tab
│   │       ├── IpActivityTab.tsx        # Per-IP activity deep-dive tab
│   │       ├── RawLogsTab.tsx           # Unprocessed vendor CSV viewer
│   │       ├── EntityWorkspace.tsx      # Tabbed asset/flow/event/alert inspector
│   │       ├── DetailsPanel.tsx         # Entity metadata inspector panel
│   │       ├── FilterBar.tsx            # Global filters + playback slider
│   │       ├── IncidentAnalysisPanel.tsx# AI analysis trigger + result display
│   │       ├── UploadModal.tsx          # CSV upload dialog
│   │       └── RATReport.tsx            # Remote Access Trojan report view
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                     # TypeScript types shared across workspaces
│   ├── src/
│   │   └── index.ts            # All interfaces, types, and utility functions
│   ├── package.json
│   └── tsconfig.json
│
├── data/                       # Raw vendor CSV exports
│   ├── qradar_events.csv       # IBM QRadar SIEM events
│   ├── sna_flows.csv           # Cisco Secure Network Analytics flows
│   ├── arista_ndr.csv          # Arista NDR threat alerts
│   ├── cisco_ise_events.csv    # Cisco Identity Services Engine
│   ├── cisco_dnac_events.csv   # Cisco DNA Center
│   ├── cisco_apic_events.csv   # Cisco ACI APIC
│   ├── normalized/             # Auto-generated normalized CSV exports
│   ├── uploads/                # User-uploaded CSVs (runtime, gitignored)
│   ├── generate.mjs            # Simulated dataset generator
│   └── gen_realistic.mjs       # Realistic APT scenario generator
│
├── package.json                # Root workspace config + dev scripts
├── tsconfig.base.json          # Shared TypeScript base config
├── replit.nix                  # Nix environment (Replit)
└── README.md
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (port 5000)                       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │Dashboard │  │  Graph   │  │ Raw Logs │  │  IP Activity   │  │
│  │   Tab    │  │   Tab    │  │   Tab    │  │     Tab        │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│         │             │             │               │            │
│         └─────────────┴─────────────┴───────────────┘           │
│                               │                                  │
│                         React App.tsx                            │
│                     (state, filters, routing)                    │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTP  /api/*
                                │ (Vite proxy → port 3001)
┌───────────────────────────────▼─────────────────────────────────┐
│                    Express Backend (port 3001)                    │
│                                                                  │
│   GET /api/payload      ←── loads + normalizes all CSVs         │
│   GET /api/raw          ←── returns raw unprocessed rows         │
│   POST /api/upload      ←── receives & saves custom CSVs        │
│   DELETE /api/upload    ←── clears uploads, reverts to default   │
│   GET /api/upload/status←── which vendors have custom data      │
│   POST /api/analysis/incident ←── triggers LLM analysis         │
│   GET /api/export/csv   ←── downloads normalized tables as ZIP   │
│   GET /api/health       ←── service health check                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                        Data Layer (CSV files)                     │
│                                                                  │
│   data/qradar_events.csv      (default or uploaded override)    │
│   data/sna_flows.csv          (default or uploaded override)    │
│   data/arista_ndr.csv         (default or uploaded override)    │
│   data/cisco_ise_events.csv   (default or uploaded override)    │
│   data/cisco_dnac_events.csv  (default or uploaded override)    │
│   data/cisco_apic_events.csv  (default or uploaded override)    │
│   data/uploads/               (user-uploaded overrides)         │
│   data/normalized/            (auto-written on each load)       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

- **No database** — all data lives in memory as typed arrays after CSV parse. Fast enough for POC-scale datasets.
- **Vite proxy** — frontend dev server proxies `/api/*` to the backend, so there are no CORS issues and the app works identically in dev and production builds.
- **Upload-then-override** — uploaded CSVs are saved to `data/uploads/<vendor>.csv`. The loader checks this directory first; if found it uses the upload, otherwise falls back to the built-in default. Each vendor is independent.
- **Normalized export** — on every payload load, the backend writes four CSVs (`flows.csv`, `events.csv`, `alerts.csv`, `assets.csv`) plus a `manifest.json` to `data/normalized/`. These power the ZIP export endpoint.
- **Runtime snapshot cache** — the normalized snapshot is cached in memory. Any upload or clear invalidates the cache and triggers a fresh build.

---

## Data Pipeline

### Vendor Sources → Unified Schema

```
qradar_events.csv   ──┐
sna_flows.csv       ──┤   loadCsv.ts          normalize.ts          NormalizedPayload
arista_ndr.csv      ──┼──► LoadedSourceRows ──► normalizeTelemetry ──► assets[]
cisco_ise_events    ──┤                                                  flows[]
cisco_dnac_events   ──┤                                                  events[]
cisco_apic_events   ──┘                                                  alerts[]
```

### Normalization Logic (`backend/src/normalize.ts`)

Each vendor maps its proprietary field names to the unified schema:

| Vendor field | Unified field |
|---|---|
| QRadar `source_ip` / SNA `src_ip` / Arista `src_ip` | `Flow.src_ip` |
| QRadar `destination_ip` / SNA `dst_ip` / Arista `dst_ip` | `Flow.dst_ip` |
| QRadar `start_time` / SNA `first_seen` / Arista `start_time` | `Flow.timestamp` |
| QRadar `byte_count` / SNA `bytes` / Arista `bytes` | `Flow.bytes` |
| QRadar `risk_score` / SNA `risk_score` / Arista `risk_score` | `Flow.risk_score` |

**Cross-vendor enrichment**: Arista NDR rows reference SNA `flow_id` values. The normalizer uses this to enrich existing SNA flows with Arista metadata (JA3 fingerprints, SNI, malware family) rather than creating duplicate flow records. Risk scores are escalated to the higher of the two vendors.

**Asset deduplication**: Assets are keyed by IP address. Each vendor's view of the same IP is merged — whichever vendor knows more about a field (hostname, MAC, country, ASN, username) wins. The `sourceVendor[]` array records all contributing vendors.

**Timestamp normalisation**: The normalizer shifts all event timestamps from their raw dates to a recent window so the timeline visualization always shows current-looking data.

**SI unit parsing**: Byte values expressed as `"1.2 MB"`, `"450 KB"`, etc. are parsed into raw byte counts.

### Simulated Attack Scenario

The default dataset represents a multi-phase APT intrusion across ~28 unique IPs:

| Phase | Description |
|---|---|
| 0 | Normal background traffic |
| 1 | External port scan (`45.33.32.156` → internal hosts) |
| 2 | Qakbot initial compromise (`ws-finance-21` → C2 `203.0.113.45`) |
| 3 | Credential harvesting (Kerberoasting, LDAP enum, DCSync) |
| 4 | Lateral movement (SMB spread across finance/eng/ops subnets) |
| 5 | TrickBot on engineering workstations → C2 beaconing |
| 6 | TOR traffic (port 9001 to `185.220.101.33`) |
| 7 | Privilege escalation via jump hosts → domain controllers |
| 8 | Data exfiltration to cloud (`198.51.100.77:8443`, 1 GB+) |
| 9 | DNS C2 tunneling from lab hosts |
| 10 | Log tampering / SIEM evasion attempt |

---

## Backend

### Entry Point — `backend/src/index.ts`

Bootstraps the Express app, mounts all routes, and pre-warms the normalized snapshot on startup. Key behaviors:

- Reads `.env` from the project root for optional LLM keys (falls back gracefully if missing)
- Creates `data/uploads/` on startup if it doesn't exist
- Caches the normalized snapshot in memory; invalidated on upload or clear
- In production mode (when `NODE_ENV=production` or `PORT` env var is set), serves the built frontend from `frontend/dist/`

### CSV Loader — `backend/src/loadCsv.ts`

- `loadSourceRows()` — loads built-in default CSVs only
- `loadSourceRowsWithUploads(uploadsDir)` — for each core vendor, checks `uploads/<vendor>.csv` first; falls back to built-in default if not found. Merges all `other_0.csv` through `other_9.csv` into a single `other[]` array.
- `getUploadedVendors(uploadsDir)` — returns which vendors currently have custom uploaded files on disk

### Normalizer — `backend/src/normalize.ts`

Pure function `normalizeTelemetry(sources)` → `{ assets, flows, events, alerts }`. No side effects. Handles all six vendors plus `other` (generic unknown format).

### Analysis Modules

| File | Purpose |
|---|---|
| `analysisConfig.ts` | Reads `GEMINI_API_KEY`, `OLLAMA_HOST`, `OLLAMA_MODEL` env vars; exposes active model name and provider settings |
| `geminiClient.ts` | Calls Google Generative Language API with model fallback logic (`gemini-2.0-flash` → `gemini-1.5-flash`) |
| `ollamaClient.ts` | Calls local Ollama `/api/chat` endpoint (default model: `llama3`) |
| `incidentPrompt.ts` | Builds a structured LLM prompt from an `IncidentAnalysisContextPackage` |
| `incidentAnalysis.ts` | Orchestrates analysis: selects provider, calls client, parses JSON response, times execution |

---

## Frontend

### App Root — `frontend/src/App.tsx`

Owns all global state:

- **`payload`** — the full `NormalizedPayload` fetched from `/api/payload` on mount
- **`filters`** — IP, protocol, hostname, severity filter state; applied to derive `filtered*` arrays
- **`playbackIndex`** — current step in the timeline playback slider
- **`activeTab`** — which top-level tab is visible
- **`analysisState`** — current AI analysis target, loading state, response

Computed from filters + playback:
- `filteredAssets`, `filteredFlows`, `filteredEvents`, `filteredAlerts`
- `timeline` — sorted list of unique timestamps used by the playback slider
- `dataTimeRange` — earliest and latest timestamps in the dataset

### Component Reference

| Component | Description |
|---|---|
| `FilterBar` | Top search bar: `severity:high AND risk:>75 OR ip:10.0.*` syntax; time-range selector; playback slider with play/pause |
| `CommunicationGraph` | Cytoscape.js force-directed graph. Nodes sized by `communicationVolume`, colored by subnet. Edges colored by risk score, weighted by bytes. Hover highlights neighbors; click anchors the entity inspector. |
| `SequencePanel` | Pure SVG swimlane sequence diagram. One vertical lane per unique IP/host. Horizontal arrows between lanes labeled with protocol badge, byte size, and timestamp. Scrollable horizontally. Core showcase visual. |
| `SankeyChart` | ECharts Sankey showing traffic volume flow between source/destination pairs. |
| `TimelineChart` | ECharts multi-series: byte volume as bars, event count as line, alert risk scores as scatter dots. |
| `SnakeTimeline` | Vertical winding timeline of incident events for narrative-style investigation. |
| `DashboardTab` | Summary stat cards + Top Communicating IPs, Top Alerting IPs, Protocol Distribution, Event Categories, Asset Origin Countries, Top Talker Pairs. |
| `GraphTab` | Full-screen Cytoscape communication graph view. |
| `IpActivityTab` | Deep-dive into a single IP: all flows, events, and alerts involving that address. |
| `RawLogsTab` | Unprocessed vendor CSV viewer. Vendor selector tabs. Shows "○ Default Data" badge when using built-in data, "● Custom Upload" badge in green when using uploaded file. Includes local text search and pagination. |
| `EntityWorkspace` | Tabbed panel: Assets, Flows, Events, Alerts — each a sortable/filterable table for the currently filtered dataset. |
| `DetailsPanel` | Rich entity inspector: asset metadata, malware families, IOC matches, high-risk flow list, critical alert summary. |
| `IncidentAnalysisPanel` | Floating panel for triggering AI incident analysis. Shows provider selector (Gemini/Ollama), structured result with severity badge, key findings, recommended next steps, and IOC candidates. |
| `UploadModal` | Six-vendor CSV drop zones + up to five "Other Logs" slots. Base64-encodes files client-side and POSTs as JSON. |

### Vite Configuration — `frontend/vite.config.ts`

```ts
server: {
  port: 5000,
  host: '0.0.0.0',          // Required for Replit preview proxy
  allowedHosts: true,        // Accepts any host header (proxied iframe)
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3001',
      changeOrigin: true     // Backend API proxy — no CORS config needed
    }
  }
}
```

---

## Shared Types

Defined in `shared/src/index.ts`, consumed by both frontend and backend via the `@soc/telemetry-shared` workspace package.

### Core Data Types

```ts
// Deduplicated network asset merged from all vendors
interface Asset {
  ip: string;
  hostname?: string;
  mac?: string;
  country?: string;
  asn?: string;
  username?: string;
  deviceType?: string;
  // Cisco ISE NAC attributes
  vlan?: string;
  switchIp?: string;
  securityGroup?: string;
  policySet?: string;
  postureStatus?: string;
  riskScore?: number;
  sourceVendor: VendorName[];      // All vendors that reported this IP
  communicationVolume: number;     // Total bytes in/out
}

// Unified network flow record
interface Flow {
  id: string;
  timestamp: string;
  src_ip: string;        src_port?: string;
  dst_ip: string;        dst_port?: string;
  protocol?: string;
  application?: string;
  bytes: number;         packets: number;
  direction?: string;
  ja3?: string;          sni?: string;     dns_query?: string;
  risk_score?: number;
  sourceVendor: VendorName;
  raw: Record<string, string>;    // Original vendor row
}

// Security event (primarily from QRadar)
interface EventRecord {
  id: string;
  timestamp: string;
  event_name: string;
  category?: string;     severity?: string;
  src_ip?: string;       dst_ip?: string;
  username?: string;     process_name?: string;
  filename?: string;     domain?: string;     url?: string;
  raw_event?: string;
  sourceVendor: VendorName;
  raw: Record<string, string>;
}

// Threat alert (from SNA + Arista)
interface AlertRecord {
  id: string;
  alert_name: string;
  severity?: string;     risk_score?: number;
  src_ip?: string;       dst_ip?: string;
  ioc_match?: string;    malware_family?: string;
  anomaly_score?: number;
  timestamp: string;
  sourceVendor: VendorName;
  raw: Record<string, string>;
}
```

### Analysis Types

```ts
// Input to the AI analysis endpoint
interface IncidentAnalysisContextPackage {
  target: { kind: 'ip' | 'alert'; ip?: string; alertId?: string; }
  scopeLabel: string;
  relatedAssets: Asset[];
  relatedFlows: Flow[];
  relatedEvents: EventRecord[];
  relatedAlerts: AlertRecord[];
  relationships: IncidentRelationship[];
  timeline: IncidentTimelinePoint[];
  indicators: { ips, hosts, users, domains, protocols, malwareFamilies, iocMatches, vendors }
  // ...summary counts
}

// Structured AI output
interface IncidentAnalysisResult {
  incidentSummary: string;
  severity: 'informational' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  likelyStage: string;
  keyFindings: string[];
  supportingEvidence: string[];
  affectedEntities: IncidentAnalysisEntity[];
  recommendedNextSteps: string[];
  evidenceGaps: string[];
  iocCandidates: string[];
  analystNotes: string;
}
```

### Utility Functions

```ts
toNumberValue(value)   // Parses "1.2 MB", "450", null → number | undefined
toTimestamp(value)     // Parses any date string → ISO 8601 string
toStringValue(value)   // Trims and null-checks any input → string | undefined
isNotEmpty(value)      // Type guard for non-empty strings
```

---

## API Reference

### `GET /api/health`
Returns service status.
```json
{ "ok": true, "service": "soc-telemetry-backend" }
```

---

### `GET /api/payload`
Returns the full normalized snapshot. Loads and caches all CSVs on first call.
```json
{
  "assets": [...],
  "flows": [...],
  "events": [...],
  "alerts": [...],
  "sourceCounts": {
    "qradar": 130, "sna": 130, "arista": 102,
    "cisco_ise": 0, "cisco_dnac": 0, "cisco_apic": 0
  }
}
```

---

### `GET /api/raw?vendor=<name>&ip=<filter>`
Returns raw unprocessed CSV rows for a single vendor.

- `vendor`: one of `qradar | sna | arista | cisco_ise | cisco_dnac | cisco_apic | other`
- `ip` (optional): filters rows where any column contains this string
- `isUploaded`: `true` if serving uploaded data, `false` if serving built-in default

```json
{ "vendor": "qradar", "totalRows": 130, "rows": [...], "isUploaded": false }
```

---

### `POST /api/upload`
Accepts base64-encoded CSV files. Saves to `data/uploads/`, invalidates cache, returns fresh normalized snapshot.

Request body:
```json
{
  "qradar": "<base64>",
  "sna": "<base64>",
  "other_0": "<base64>"
}
```

---

### `GET /api/upload/status`
Returns which vendors currently have custom uploaded files.
```json
{ "ok": true, "uploadedVendors": ["qradar"], "hasCustomData": true }
```

---

### `DELETE /api/upload`
Removes all uploaded files and reverts all vendors to built-in defaults. Invalidates cache.

---

### `POST /api/analysis/incident`
Triggers AI incident analysis. Requires either `GEMINI_API_KEY` or a running Ollama instance.

Request body:
```json
{
  "context": { /* IncidentAnalysisContextPackage */ },
  "provider": "gemini" | "ollama"   // optional override
}
```

Response:
```json
{
  "ok": true,
  "model": "gemini-2.0-flash",
  "durationMs": 3240,
  "analysis": { /* IncidentAnalysisResult */ }
}
```

---

### `GET /api/export/csv`
Streams a ZIP archive containing:
- `flows.csv` — all normalized flows
- `events.csv` — all normalized events
- `alerts.csv` — all normalized alerts
- `assets.csv` — all deduplicated assets
- `manifest.json` — row counts and export timestamp

---

## Dashboard Views

### Dashboard Tab
Summary stat cards (Total Flows, Data Transferred, Avg Flow Risk, Total Alerts, High-Risk Alerts, Unique IPs, Total Events, Assets) with supporting breakdowns: Top Communicating IPs, Top Alerting IPs, Alert Severity Breakdown, Protocol Distribution, Event Categories, Asset Origin Countries, Top Talker Pairs, Recent Critical Alerts.

### Home Tab
- **Communication Graph** — Cytoscape.js force-directed graph
- **Communication Chain** — SVG swimlane sequence diagram
- **Entity Inspector** — rich detail panel for selected node
- **Sankey Diagram** — traffic volume between src/dst pairs
- **Timeline** — bytes over time, event counts, alert risk scatter

### Assets Tab
Deduplicated inventory merged across all vendors. Columns: IP, hostname, MAC, country, ASN, username, device type, vendor badges, risk score, communication volume.

### Flows Tab
Full flow table (source IP, destination IP, protocol badge, bytes, risk bar) + sequence diagram rendered side by side.

### Events Tab
QRadar security events with severity color banding (left border: red = critical, amber = medium, green = low), event name, category, domain, username.

### Alerts Tab
Combined SNA + Arista alert feed with risk bar meters, IOC red-pill badges, malware family labels, and anomaly scores.

### Graph Tab
Full-screen Cytoscape communication graph for deep network topology exploration.

### IP Activity Tab
All flows, events, and alerts scoped to a single selected IP address.

### Raw Logs Tab
Unprocessed vendor CSV rows. Vendor selector tabs. Displays a **"○ Default Data"** badge when using built-in sample data, and a **"● Custom Upload"** badge in green after uploading a custom CSV. Local text search and pagination (50 rows/page). Sensitive columns (password, token, key, secret) are dimmed. Curated column sets for complex vendors (e.g. Cisco ISE).

---

## AI Incident Analysis

The platform includes an optional LLM-powered incident analysis feature. When triggered from any entity in the dashboard, the frontend builds an `IncidentAnalysisContextPackage` containing all related flows, events, alerts, assets, relationships, and a temporal timeline, then POSTs it to `/api/analysis/incident`.

### Supported Providers

| Provider | Setup |
|---|---|
| **Google Gemini** | Set `GEMINI_API_KEY` environment variable. Uses `gemini-2.0-flash` with fallback to `gemini-1.5-flash`. |
| **Ollama (local)** | Run [Ollama](https://ollama.ai) locally. Set `OLLAMA_HOST` (default: `http://localhost:11434`) and `OLLAMA_MODEL` (default: `llama3`). |

### Analysis Output

The AI returns a structured `IncidentAnalysisResult`:
- **Incident summary** — narrative description of what happened
- **Severity** — `informational | low | medium | high | critical`
- **Confidence** — 0–100 score
- **Likely stage** — MITRE ATT&CK-style phase (e.g., "Lateral Movement")
- **Key findings** — bullet list of observations
- **Supporting evidence** — specific data points from the telemetry
- **Affected entities** — IPs, users, hosts, processes involved
- **Recommended next steps** — analyst action items
- **Evidence gaps** — what data is missing for higher confidence
- **IOC candidates** — suggested indicators of compromise

---

## CSV Upload System

The platform supports replacing any vendor's built-in sample data with real exports:

1. Click **↑ Upload CSV** in the top bar
2. Drop or select CSV files into the vendor slots (IBM QRadar, Cisco SNA, Arista NDR, Cisco ISE, Cisco DNAC, Cisco APIC) or the "Other Logs" slots for unknown formats
3. Click **Upload & Load** — files are base64-encoded client-side and posted to `/api/upload`
4. The backend saves them to `data/uploads/`, re-runs normalization, and returns the fresh payload

**Per-vendor independence**: uploading QRadar data only replaces QRadar; all other vendors continue using their defaults.

**Raw Logs view**: shows a **"● Custom Upload"** green badge for vendors with uploaded data and **"○ Default Data"** for those using defaults.

**Clearing**: click **✕ Clear / Reset Default** in the top bar to remove all uploads and revert to built-in sample data.

---

## Running the Project

### Prerequisites

- Node.js 18+
- npm 10+

### Setup

```bash
# Install all workspace dependencies
npm install
```

### Development (two workflows required)

**Workflow 1 — Backend** (port 3001):
```bash
npm run build --workspace shared && cd backend && npx tsx watch src/index.ts
```

**Workflow 2 — Frontend** (port 5000):
```bash
cd frontend && npx vite
```

Open **port 5000** in your browser. The Vite dev server proxies all `/api/*` requests to the backend automatically.

### Production Build

```bash
npm run build
# Builds: shared types → backend → frontend dist
# Then serve with:
npm start   # starts backend which also serves frontend/dist
```

---

## Data Generation

The `data/` directory contains two generator scripts for creating fresh synthetic datasets:

```bash
# Generate a new simulated APT scenario dataset
cd data
node generate.mjs        # Basic generator
node gen_realistic.mjs   # Realistic multi-phase APT scenario
```

The generators create fully cross-referenced rows — the same IPs, hostnames, and MACs appear consistently across all vendor files. Arista `flow_id` values reference SNA `flow_id` values for cross-vendor correlation.

---

## Phase-1 Constraints

This is a POC. The following are intentional non-goals for Phase 1:

| Constraint | Reason |
|---|---|
| No database | Keep it simple — in-memory arrays are sufficient for POC-scale data |
| No authentication | Single-analyst local tool |
| No real-time streaming | CSV files simulate telemetry; WebSocket streaming is Phase 2 |
| No multi-user support | Out of scope for Phase 1 |
| No ML / AI (built-in) | LLM analysis is optional and external |
| No persistence | All state lives in React memory and reloads from CSV |
| No tests | Exploratory POC — correctness validated visually |

---

## Roadmap

Planned for Phase 2+:

- [ ] Real-time WebSocket streaming from SIEM
- [ ] PostgreSQL / TimescaleDB persistence
- [ ] MITRE ATT&CK tactic and technique tagging on alerts
- [ ] IP geolocation map overlay
- [ ] Alert correlation rules engine
- [ ] Multi-tenant authentication
- [ ] Automated IOC enrichment (VirusTotal, Shodan)
- [ ] Report generation (PDF export of investigation)

---

*Built as a Phase-1 SOC investigation platform POC by Ketan & Saaransh.*
