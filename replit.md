# SOC Telemetry Visualization Platform

A local-only, analyst-facing cyber telemetry exploration tool that ingests raw vendor exports from IBM QRadar, Cisco SNA, and Arista NDR, normalizes them into a unified schema, and renders an interactive multi-view SOC dashboard.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite (port 5000) |
| Backend | Express + Node.js + tsx (port 3001) |
| Monorepo | npm workspaces (backend / frontend / shared) |
| Charts | Apache ECharts, Cytoscape.js |
| CSV parsing | PapaParse / csv-parse |

## How to Run

Two workflows must both be running:

1. **Backend** — builds the shared types package then starts the Express API on port 3001
   ```
   npm run build --workspace shared && cd backend && npx tsx watch src/index.ts
   ```
2. **Start application** — starts the Vite dev server on port 5000 (proxies `/api` → backend)
   ```
   cd frontend && npx vite
   ```

Open the app at port 5000 in the preview pane.

## Project Structure

```
├── backend/      # Express API — loads & normalizes CSV data, serves /api/*
├── frontend/     # React + Vite dashboard
├── shared/       # TypeScript types shared between frontend & backend
└── data/         # Raw vendor CSV exports (qradar, sna, arista, cisco_*)
```

## No External Secrets Required

The app is entirely local — no API keys, database connections, or auth tokens needed to run. CSV data lives in `data/`.

## User Preferences
