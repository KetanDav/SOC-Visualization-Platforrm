# Current Work State

## Starting Point

Read [prompt.md](prompt.md) and [plan.md](plan.md) before making changes. The prompt is the source of truth for the Phase-1 POC goals and constraints, and the plan describes the current implementation order.

## What Is Already Working

- Root monorepo runs with npm install and npm run dev.
- Backend loads the three vendor CSVs from data and normalizes them into assets, flows, events, and alerts.
- Backend now exports normalized tables into data/normalized as CSV files plus a manifest.
- Frontend renders the SOC dashboard with tabs: Home, Assets, Flows, Events, and Alerts.
- All five tabs have been validated in the browser.

## Completed Visualizations

1. **Communication Graph** — Cytoscape.js force-directed graph, nodes scale by volume, edges by bytes, protocol-color-coded, click-to-select, zoom/pan.
2. **Communication Chain (Sequence Diagram)** — Full SVG swimlane diagram: lane per unique IP/host, horizontal arrows between lanes labeled with protocol badge + byte size + timestamp. Scrollable, hover-highlighted. Core showcase visual.
3. **Sankey Diagram** — ECharts sankey showing source/destination traffic volume flows.
4. **Timeline Chart** — ECharts bar+line+scatter chart: bytes over time (bar), events (line), alerts (scatter).
5. **Playback Mode** — Slider + play/pause auto-advances through 36 timeline steps.
6. **Global Filtering** — IP, protocol, hostname filters update all visualizations simultaneously.

## Completed Tab Views

- **Home** — Graph + Communication Chain + Entity Details inspector + Sankey + Timeline.
- **Assets** — Rich table with styled vendor badges, IP in cyan, MAC in muted code format.
- **Flows** — Table (source in cyan, dest in amber, protocol badge, risk bar) + Sequence Diagram side-by-side.
- **Events** — Table with severity color banding on rows, SeverityCell pill badges, Domain column.
- **Alerts** — Table with severity color banding, risk bar meter, IOC badge (red pill), anomaly score.

## Current Data State

- Raw sources live in data/qradar_events.csv, data/sna_flows.csv, and data/arista_ndr.csv.
- Normalized exports live in data/normalized.
- The dataset has 10 assets, 18 flows, 6 events, 12 alerts.

## What To Do Next (future agent)

1. Open prompt.md and plan.md first, then continue from the current implementation.
2. Could add hover tooltips in the communication chain (SVG title tags or a floating div).
3. Could add keyboard shortcut or click-to-filter from the sequence diagram lanes.
4. Could improve the Entity Details inspector to show a mini sequence filtered to that IP.
5. UI polish: consider adding subtle animated glow to nodes in graph, or animated edge drawing.

## Useful Notes

- Backend port: 3001. Frontend (Vite dev): 5173 or 5174.
- Backend writes normalized exports on payload load.
- Keep source CSV rows valid and column-aligned; strict parsing will fail on malformed rows.
- Use the existing shared types under shared/src/index.ts for any new UI or backend work.
- Sequence diagram is in frontend/src/components/SequencePanel.tsx — pure React + SVG, no additional lib needed.