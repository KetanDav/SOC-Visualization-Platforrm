import type { IncidentAnalysisContextPackage } from '@soc/telemetry-shared';

const SYSTEM_PROMPT = `You are a SOC analyst. Analyze the incident described below and return ONLY a JSON object.

The JSON must have exactly these keys:
{
  "incidentSummary": "one sentence describing what happened",
  "severity": "informational" or "low" or "medium" or "high" or "critical",
  "confidence": a number 0 to 100,
  "likelyStage": "one phrase e.g. Reconnaissance, Lateral Movement, Exfiltration",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "supportingEvidence": ["evidence 1", "evidence 2", "evidence 3"],
  "affectedEntities": [{"type": "ip", "value": "1.2.3.4", "role": "attacker source"}],
  "recommendedNextSteps": ["step 1", "step 2", "step 3"],
  "evidenceGaps": ["gap 1", "gap 2"],
  "iocCandidates": ["ioc 1", "ioc 2"],
  "analystNotes": "one sentence of analyst commentary"
}

Rules:
- Use ONLY evidence from the supplied data. Do not invent anything.
- Max 3 items per array. One sentence per string.
- Return ONLY the JSON object. No markdown, no explanation, no extra text.`;

/**
 * Converts the context package into a compact plain-text summary.
 * Sending structured text instead of raw JSON is far more reliable for small models —
 * it avoids them mirroring the input schema back as output.
 */
function buildContextSummary(ctx: IncidentAnalysisContextPackage): string {
  const lines: string[] = [];

  // Target / anchor
  if (ctx.selectedAlert) {
    const a = ctx.selectedAlert;
    lines.push(`ALERT: ${a.alert_name} | severity=${a.severity ?? 'unknown'} risk=${a.risk_score ?? 0} | ${a.src_ip ?? '?'} -> ${a.dst_ip ?? '?'} | ${a.timestamp} | source=${a.sourceVendor}`);
    if (a.malware_family) lines.push(`  malware_family=${a.malware_family}`);
    if (a.ioc_match && a.ioc_match !== 'no') lines.push(`  ioc_match=${a.ioc_match}`);
  } else if (ctx.selectedIp) {
    lines.push(`FOCUS IP: ${ctx.selectedIp}`);
  }

  // Asset
  if (ctx.selectedAsset) {
    const a = ctx.selectedAsset;
    lines.push(`ASSET: ${a.ip} hostname=${a.hostname ?? '?'} user=${a.username ?? '?'} type=${a.deviceType ?? '?'} risk=${a.riskScore ?? 0}`);
  }

  lines.push('');

  // Summary stats
  const sum = ctx.summary || { relatedFlows: 0, relatedEvents: 0, relatedAlerts: 0, relatedAssets: 0, maxRisk: 0, totalBytes: 0 };
  lines.push(`SCOPE: ${sum.relatedFlows ?? 0} flows, ${sum.relatedEvents ?? 0} events, ${sum.relatedAlerts ?? 0} alerts, ${sum.relatedAssets ?? 0} assets | maxRisk=${sum.maxRisk ?? 0} | bytes=${sum.totalBytes ?? 0}`);
  if (sum.timeRange) {
    lines.push(`TIME RANGE: ${sum.timeRange.from} to ${sum.timeRange.to}`);
  }

  lines.push('');

  // Indicators
  const ind = ctx.indicators || { ips: [], hosts: [], users: [], domains: [], protocols: [], malwareFamilies: [], iocMatches: [] };
  if (ind.ips?.length) lines.push(`IPs: ${ind.ips.join(', ')}`);
  if (ind.hosts?.length) lines.push(`HOSTS: ${ind.hosts.join(', ')}`);
  if (ind.users?.length) lines.push(`USERS: ${ind.users.join(', ')}`);
  if (ind.domains?.length) lines.push(`DOMAINS: ${ind.domains.join(', ')}`);
  if (ind.protocols?.length) lines.push(`PROTOCOLS: ${ind.protocols.join(', ')}`);
  if (ind.malwareFamilies?.length) lines.push(`MALWARE: ${ind.malwareFamilies.join(', ')}`);
  if (ind.iocMatches?.length) lines.push(`IOC MATCHES: ${ind.iocMatches.join(', ')}`);

  lines.push('');

  // Top flows
  if (ctx.relatedFlows?.length) {
    lines.push('TOP FLOWS:');
    for (const f of ctx.relatedFlows) {
      const parts = [`${f.src_ip}:${f.src_port ?? '?'} -> ${f.dst_ip}:${f.dst_port ?? '?'}`, f.protocol ?? '', f.application ?? '', `${f.bytes}B`, `risk=${f.risk_score ?? 0}`];
      if (f.sni) parts.push(`sni=${f.sni}`);
      if (f.dns_query) parts.push(`dns=${f.dns_query}`);
      lines.push(`  ${parts.filter(Boolean).join(' | ')}`);
    }
    lines.push('');
  }

  // Top events
  if (ctx.relatedEvents?.length) {
    lines.push('TOP EVENTS:');
    for (const e of ctx.relatedEvents) {
      const parts = [e.event_name, e.category ?? '', e.severity ?? '', e.username ?? '', e.src_ip ?? '', e.domain ?? '', e.url ?? ''];
      lines.push(`  ${parts.filter(Boolean).join(' | ')}`);
    }
    lines.push('');
  }

  // Related alerts
  if (ctx.relatedAlerts?.length) {
    lines.push('RELATED ALERTS:');
    for (const a of ctx.relatedAlerts) {
      const parts = [a.alert_name, a.severity ?? '', `risk=${a.risk_score ?? 0}`, a.src_ip ?? '', a.dst_ip ?? ''];
      if (a.malware_family) parts.push(`malware=${a.malware_family}`);
      lines.push(`  ${parts.filter(Boolean).join(' | ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function buildIncidentAnalysisMessages(context: IncidentAnalysisContextPackage): Array<{ role: 'system' | 'user'; content: string }> {
  const summary = buildContextSummary(context);
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analyze this incident and return the JSON object:\n\n${summary}`,
    },
  ];
}

/**
 * Returns system prompt and user message as separate strings.
 * Used by providers that take them separately (e.g. Gemini's system_instruction + contents).
 */
export function buildIncidentAnalysisPromptParts(context: IncidentAnalysisContextPackage): {
  systemPrompt: string;
  userMessage: string;
} {
  const summary = buildContextSummary(context);
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Analyze this incident and return the JSON object:\n\n${summary}`,
  };
}
