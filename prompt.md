# Phase-1 POC Plan

## Project Name

SOC Telemetry Visualization Platform

## Goal

Build a fully working cybersecurity telemetry visualization POC that helps SOC analysts visually explore communications, relationships, flows, and events. The first version must be simple, local-only, and demo-friendly.

## Phase-1 Constraints

- No database
- No real APIs
- No Kafka
- No ML or AI
- No authentication
- No multi-user support
- No backend scaling or microservices

All data processing stays in memory. CSV files are the only input source.

## Data Sources

The backend will ingest three vendor CSV dumps:

1. `qradar_events.csv`
2. `sna_flows.csv`
3. `arista_ndr.csv`

## Unified Runtime Tables

Normalize all vendor data into four in-memory logical tables:

1. `assets`
2. `flows`
3. `events`
4. `alerts`

These tables do not need a database. They can be arrays, JSON payloads, or shared runtime objects.

## Step-by-Step Build Plan

### 1. Set up the monorepo skeleton

- Create `frontend`, `backend`, `shared`, and `data` folders.
- Initialize a React + TypeScript + Vite app in `frontend`.
- Initialize a Node.js + Express app in `backend`.
- Add a small shared package or folder for common types and field mapping helpers.
- Make `npm install` and `npm run dev` work from the repo root.

### 2. Implement CSV loading in the backend

- Read all CSV files from the `data` folder.
- Parse rows from each vendor file.
- Keep the parsing layer small and explicit.
- Preserve the raw row payload for debugging and drill-down.

### 3. Build the normalization layer

- Map vendor-specific source and destination fields into unified names.
- Normalize timestamps into one format.
- Normalize host, IP, MAC, protocol, application, and risk fields.
- Convert QRadar, Cisco SNA, and Arista NDR rows into shared internal records.

### 4. Produce the unified tables

- Generate deduplicated `assets` records from all sources.
- Build `flows` as the primary communication dataset.
- Build `events` for security and activity records.
- Build `alerts` for notable detections and risk items.
- Expose a simple JSON endpoint that returns the normalized payload.

### 5. Define shared types and field contracts

- Add shared TypeScript interfaces for assets, flows, events, and alerts.
- Keep the backend and frontend aligned on the same shape definitions.
- Add a small mapping module for vendor-to-unified field translation.

### 6. Create the frontend shell

- Build a dark SOC-style layout with a dense analytical dashboard feel.
- Add a header, filter bar, main visualization area, and supporting detail panels.
- Keep the UI professional and restrained, not flashy or gimmicky.

### 7. Build the communication graph first

- Use an interactive force-directed graph.
- Render IPs and hosts as nodes.
- Render communications as edges.
- Scale edge thickness by bytes.
- Color edges by protocol or severity.
- Scale node size by communication volume.
- Support zoom, pan, hover details, and click-to-filter behavior.

### 8. Build the communication sequence view

- Show ordered communication chains over time.
- Display timestamp, protocol, bytes, hostname, destination, and sequence order.
- Make it read like an investigation path or packet flow chain.
- Keep it visually clear enough to show IP1 → IP2 → IP3 style movement.

### 9. Build the Sankey diagram

- Show major traffic movement and source/destination relationships.
- Use it to emphasize communication volume and dominant paths.
- Keep it secondary to the graph and sequence views.

### 10. Build the timeline view

- Show events, alerts, and communication spikes over time.
- Make it easy to spot bursts, anomalies, and notable periods.
- Keep the time axis consistent with the rest of the visualizations.

### 11. Add global filtering

- Filter by IP.
- Filter by protocol.
- Filter by hostname.
- Make all visualizations react to the same filter state.

### 12. Add playback mode

- Replay CSV rows gradually to simulate live telemetry.
- Update the graph, sequence view, and timeline as data streams in.
- Keep playback simple and deterministic.

### 13. Add detail and inspection panels

- Show selected node, edge, flow, event, or alert details.
- Expose raw record data for analyst review.
- Keep the details view readable and compact.

### 14. Polish the UI

- Refine spacing, typography, colors, and contrast.
- Keep the theme dark, futuristic, and professional.
- Avoid excessive glow, animation, or decorative clutter.

### 15. Validate the end-to-end flow

- Confirm all CSVs load successfully.
- Confirm the unified tables populate correctly.
- Confirm all major visualizations render.
- Confirm filters affect all views.
- Confirm playback updates the UI.

## Recommended Delivery Order

1. CSV parsing
2. Normalization pipeline
3. Unified tables
4. Communication graph
5. Sequence visualization
6. Timeline
7. Filters
8. Playback mode
9. UI polish

## Success Criteria

- Runs locally with `npm install` and `npm run dev`
- No database or external service required
- Communication graph is the main showcase view
- Sequence view clearly communicates flow order
- Filters and playback work end-to-end
- The UI feels like a modern SOC telemetry exploration tool, not a generic dashboard

## Design Guardrails

- Prioritize usefulness and clarity over performance tuning
- Keep architecture lightweight
- Avoid fake hacking aesthetics
- Avoid unnecessary widgets and complexity
- Optimize for analyst comprehension and visual correlation

Edge color:

- based on protocol or severity

Node size:

- based on communication volume

Features:

- zoom
- pan
- hover details
- click node filtering

---

# 2. Sequence Diagram / Communication Timeline

VERY IMPORTANT.

Create a visualization showing:

IP1 → IP2 → IP3 communications over time.

The sequence visualization should show:

- timestamp
- protocol
- bytes
- hostname
- destination
- communication order

This should visually resemble:

- network communication chain
- packet flow sequence
- analyst investigation timeline

This is one of the CORE showcase visuals.

---

# 3. Sankey Diagram

Show:

- communication volume
- traffic movement
- major source/destination relationships

---

# 4. Timeline Visualization

Show:

- events over time
- communication spikes
- alerts

#

---

# REQUIRED FILTERING

Simple but working filters:

- filter by IP
- filter by protocol
- filter by hostname

Global filtering should update visualizations.

---

# REAL-TIME PLAYBACK MODE

Add a simple playback mode.

The system should:

- replay CSV rows gradually
- simulate live telemetry
- update graphs dynamically

Simple implementation is enough.

---

# FRONTEND REQUIREMENTS

Use:

- React
- TypeScript
- Vite

Recommended visualization stack:

- D3.js
- Cytoscape.js
- Apache ECharts

Choose whichever works best for each visualization.

---

# BACKEND REQUIREMENTS

Use:

- Node.js
- Express

Responsibilities:

- CSV parsing
- normalization
- simple aggregation
- serving normalized JSON

No database required.

---

# PROJECT STRUCTURE

Use a SIMPLE monorepo structure:

/frontend
/backend
/data
/shared

Keep architecture clean but lightweight.

---

# IMPORTANT ENGINEERING GOALS

Prioritize:

1. Working POC
2. Visual impact
3. Useful visualizations
4. Clean interactions
5. Simple architecture

DO NOT overengineer.

DO NOT optimize prematurely.

DO NOT build enterprise infrastructure.

---

# IMPORTANT DESIGN PHILOSOPHY

The product should feel like:

"A modern cyber telemetry exploration platform that helps SOC analysts visually understand communication relationships much faster than traditional SIEM dashboards."

NOT:

- a log table viewer
- a generic admin dashboard
- a fake hacking UI

---

# IMPLEMENTATION PRIORITY

Build in this order:

1. CSV parsing
2. Normalization pipeline
3. Unified tables
4. Communication graph
5. Sequence visualization
6. Timeline
7. Filters
8. Playback mode
9. UI polish

---

# FINAL EXPECTATION

The final result should be:

- visually impressive
- actually useful
- smooth
- interactive
- correlation-oriented
- realistic enough for demos
- fully working locally
- simple to run

The entire system should run with:

npm install
npm run dev

without additional infrastructure.
