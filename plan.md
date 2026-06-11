# PHASE-1 POC MASTER PROMPT FOR COPILOT AGENT

# Project Name

SOC Telemetry Visualization Platform (Phase-1 POC)

---

# Core Goal

Build a FULLY WORKING cybersecurity telemetry visualization POC focused on:

- visually impressive
- highly useful
- minimal unnecessary complexity
- SOC analyst friendly
- strong communication visualization
- strong entity correlation
- modern cyber UI

This is NOT a SIEM.

This is a SUPPORTING visualization and exploration platform for SIEM/NDR telemetry.

The system should help analysts visually understand communications, relationships, flows, and events more easily than traditional SIEM dashboards.

The PRIMARY FOCUS is:

1. Visualization complexity and usefulness
2. Correlation between entities
3. Smooth interactive exploration
4. Beautiful cyber-style UI
5. Working end-to-end POC

Performance optimization is NOT important for this phase.

---

# IMPORTANT PHASE-1 CONSTRAINTS

- NO DATABASE
- NO REAL APIs
- NO KAFKA
- NO ML
- NO AI
- NO AUTHENTICATION
- NO MULTI-USER SUPPORT
- NO BACKEND SCALING
- NO MICROSERVICES

Everything should remain SIMPLE and WORKING.

All processing can happen in memory.

CSV files act as the data source.

One CSV = one vendor dump.

---

# CSV INPUT FILES

The system will ingest:

1. qradar_events.csv
2. sna_flows.csv
3. arista_ndr.csv

Each CSV contains vendor-specific fields.

The backend must normalize these dumps into unified internal structures.

---

# EXPECTED OUTPUT TABLES

Normalize data into FOUR unified logical tables:

1. assets
2. flows
3. events
4. alerts

These do NOT need to be stored in a database.

They can exist as:

- in-memory arrays
- generated JSON objects
- normalized runtime structures

---

# CSV ATTRIBUTES

# 1. QRadar Fields

Use these attributes from qradar_events.csv:

- event_id
- qid
- qid_name
- category
- severity
- credibility
- relevance
- magnitude
- start_time
- source_ip
- source_port
- source_mac
- source_hostname
- source_country
- destination_ip
- destination_port
- destination_mac
- destination_hostname
- destination_country
- protocol
- application
- direction
- packet_count
- byte_count
- username
- authentication_type
- process_name
- command_line
- filename
- md5
- sha256
- url
- domain
- dns_query
- user_agent
- offense_id
- risk_score
- log_source_name
- raw_event

---

# 2. Cisco SNA Fields

Use these attributes from sna_flows.csv:

- flow_id
- conversation_id
- first_seen
- last_seen
- duration
- src_ip
- src_port
- src_mac
- src_hostname
- src_country
- src_asn
- dst_ip
- dst_port
- dst_mac
- dst_hostname
- dst_country
- dst_asn
- protocol
- application
- packets
- bytes
- packet_rate
- byte_rate
- tcp_flags
- latency
- flow_direction
- vlan
- interface_in
- interface_out
- ja3
- ja3s
- tls_version
- cipher_suite
- sni
- dns_query
- http_host
- http_uri
- http_user_agent
- threat_score
- risk_score
- anomaly_score
- beaconing_score
- lateral_movement_score
- alarm_name
- alarm_severity
- ioc_match
- raw_flow

---

# 3. Arista NDR Fields

Use these attributes from arista_ndr.csv:

- alert_id
- flow_id
- alert_name
- alert_type
- severity
- confidence
- risk_score
- start_time
- end_time
- src_ip
- src_port
- src_mac
- src_hostname
- src_country
- dst_ip
- dst_port
- dst_mac
- dst_hostname
- dst_country
- protocol
- application
- packets
- bytes
- dns_query
- dns_response
- http_method
- http_host
- http_uri
- http_status
- http_user_agent
- tls_version
- cipher_suite
- ja3
- ja3s
- sni
- filename
- md5
- sha256
- ioc_match
- malware_family
- c2_activity
- beaconing
- lateral_movement
- data_exfiltration
- port_scanning
- user_name
- authentication_result
- anomaly_score
- geo_latitude
- geo_longitude
- raw_metadata

---

# REQUIRED ETL / NORMALIZATION PIPELINE

Backend must:

1. Load all CSV files
2. Parse rows
3. Normalize vendor fields
4. Generate unified structures

Examples:

QRadar source_ip
Cisco src_ip
Arista src_ip

→ unified src_ip

Similarly:

- destination fields
- protocol fields
- timestamps
- hostnames
- communication metadata

---

# REQUIRED UNIFIED TABLES

# ASSETS

Unified asset objects should contain:

- ip
- hostname
- mac
- country
- ASN
- username
- device_type
- source_vendor

Assets should be deduplicated.

---

# FLOWS

Unified flow objects should contain:

- timestamp
- src_ip
- src_port
- dst_ip
- dst_port
- protocol
- application
- bytes
- packets
- direction
- ja3
- sni
- dns_query
- risk_score

This is the MOST IMPORTANT table.

---

# EVENTS

Unified event objects should contain:

- timestamp
- event_name
- category
- severity
- src_ip
- dst_ip
- username
- process_name
- filename
- domain
- url
- raw_event

---

# ALERTS

Unified alert objects should contain:

- alert_name
- severity
- risk_score
- src_ip
- dst_ip
- ioc_match
- malware_family
- anomaly_score
- timestamp

---

# REQUIRED UI/UX STYLE

The UI should be:

- dark SOC theme
- futuristic but professional
- clean
- visually dense
- cyber analytics inspired
- not overloaded with random glow effects

Avoid:

- childish cyberpunk
- excessive animations
- unnecessary widgets

Focus on:

- useful visual density
- clear relationships
- analyst readability

---

# REQUIRED VISUALIZATIONS

# 1. Communication Graph (MOST IMPORTANT)

Create an interactive force-directed graph.

Nodes:

- IPs
- hosts

Edges:

- communications

Edge thickness:

- based on bytes

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
