import type { IncidentAnalysisContextPackage, IncidentAnalysisResponse, IncidentAnalysisResult } from '@soc/telemetry-shared';
import { buildIncidentAnalysisMessages, buildIncidentAnalysisPromptParts } from './incidentPrompt.js';
import { chatWithOllama } from './ollamaClient.js';
import { chatWithGemini } from './geminiClient.js';
import { getAnalysisProvider, getActiveModelName } from './analysisConfig.js';

interface NormalizedAnalysisResult {
  incidentSummary: string;
  severity: 'informational' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  likelyStage: string;
  keyFindings: string[];
  supportingEvidence: string[];
  affectedEntities: IncidentAnalysisResult['affectedEntities'];
  recommendedNextSteps: string[];
  evidenceGaps: string[];
  iocCandidates: string[];
  analystNotes: string;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function readArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
}

function readConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value));
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, parsed));
    }
  }

  return 0;
}

function readSeverity(value: unknown): NormalizedAnalysisResult['severity'] {
  const severity = readString(value, 'informational').toLowerCase();
  if (severity === 'low' || severity === 'medium' || severity === 'high' || severity === 'critical') {
    return severity;
  }

  return 'informational';
}

function readAffectedEntities(value: unknown): IncidentAnalysisResult['affectedEntities'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entity) => {
    if (!entity || typeof entity !== 'object') {
      return [];
    }

    const candidate = entity as Record<string, unknown>;
    const type = readString(candidate.type, 'ip') as IncidentAnalysisResult['affectedEntities'][number]['type'];
    const valueText = readString(candidate.value);
    const role = readString(candidate.role, 'related evidence');

    if (!valueText) {
      return [];
    }

    return [{ type, value: valueText, role }];
  });
}

function normalizeAnalysisResult(value: unknown): IncidentAnalysisResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Ollama returned an invalid JSON object');
  }

  const candidate = value as Record<string, unknown>;

  const normalized: NormalizedAnalysisResult = {
    incidentSummary: readString(candidate.incidentSummary ?? candidate.incident_summary, 'No summary was returned.'),
    severity: readSeverity(candidate.severity),
    confidence: readConfidence(candidate.confidence),
    likelyStage: readString(candidate.likelyStage ?? candidate.likely_stage, 'unknown'),
    keyFindings: readArray(candidate.keyFindings ?? candidate.key_findings),
    supportingEvidence: readArray(candidate.supportingEvidence ?? candidate.supporting_evidence),
    affectedEntities: readAffectedEntities(candidate.affectedEntities ?? candidate.affected_entities),
    recommendedNextSteps: readArray(candidate.recommendedNextSteps ?? candidate.recommended_next_steps),
    evidenceGaps: readArray(candidate.evidenceGaps ?? candidate.evidence_gaps),
    iocCandidates: readArray(candidate.iocCandidates ?? candidate.ioc_candidates),
    analystNotes: readString(candidate.analystNotes ?? candidate.analyst_notes, ''),
  };

  return normalized;
}

export async function runIncidentAnalysis(
  context: IncidentAnalysisContextPackage,
  providerOverride?: 'ollama' | 'gemini',
): Promise<IncidentAnalysisResponse> {
  const startedAt = Date.now();
  const provider = providerOverride ?? getAnalysisProvider();
  let rawContent = '';

  try {
    let chatResult: { content: string; model: string; durationMs: number };

    if (provider === 'gemini') {
      const parts = buildIncidentAnalysisPromptParts(context);
      chatResult = await chatWithGemini(parts);
    } else {
      const messages = buildIncidentAnalysisMessages(context);
      chatResult = await chatWithOllama({ messages });
    }

    rawContent = chatResult.content;
    console.info(`[analysis][${provider}] raw length: ${rawContent.length} | preview: ${rawContent.substring(0, 120)}`);

    const parsed = JSON.parse(stripCodeFences(rawContent));
    const analysis = normalizeAnalysisResult(parsed);

    return {
      ok: true,
      model: chatResult.model,
      durationMs: chatResult.durationMs,
      analysis,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis error';
    const isTimeout = /timed out/i.test(message);
    const isMissingKey = /api_key/i.test(message);

    console.error(`[analysis][${provider}] error:`, message);
    if (rawContent) {
      console.error(`[analysis][${provider}] raw response (first 500):`, rawContent.substring(0, 500));
    }

    const fallbackMessage = isMissingKey
      ? 'Gemini API key is missing or invalid. Add GEMINI_API_KEY to your .env file.'
      : isTimeout
        ? `${provider === 'gemini' ? 'Gemini' : 'Ollama'} timed out while analyzing this incident. The dashboard remains available.`
        : `${provider === 'gemini' ? 'Gemini' : 'Ollama'} is unavailable or returned invalid output. The dashboard remains available.`;

    return {
      ok: false,
      model: getActiveModelName(),
      durationMs: Date.now() - startedAt,
      analysis: null,
      fallbackMessage,
      error: {
        code: isMissingKey ? 'missing_api_key' : isTimeout ? 'analysis_timeout' : 'analysis_unavailable',
        message,
      },
    };
  }
}
