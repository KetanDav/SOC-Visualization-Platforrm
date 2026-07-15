// ── Ollama defaults ───────────────────────────────────────────────────────────
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'qwen3:4b';
const DEFAULT_OLLAMA_TIMEOUT_MS = 120000;
const DEFAULT_OLLAMA_TEMPERATURE = 0.2;
const DEFAULT_OLLAMA_MAX_TOKENS = 800;

// ── Gemini defaults ───────────────────────────────────────────────────────────
const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';
const DEFAULT_GEMINI_TIMEOUT_MS = 30000;
const DEFAULT_GEMINI_TEMPERATURE = 0.2;
const DEFAULT_GEMINI_MAX_TOKENS = 1200;

// ── Helpers ───────────────────────────────────────────────────────────────────
function toNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return (value?.trim() || fallback).replace(/\/$/, '');
}

// ── Provider selection ────────────────────────────────────────────────────────
export type AnalysisProvider = 'ollama' | 'gemini';

export function getAnalysisProvider(): AnalysisProvider {
  const raw = process.env.ANALYSIS_PROVIDER?.trim().toLowerCase();
  return raw === 'gemini' ? 'gemini' : 'ollama';
}

// ── Ollama settings ───────────────────────────────────────────────────────────
export interface OllamaAnalysisSettings {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
}

export function getOllamaAnalysisSettings(): OllamaAnalysisSettings {
  return {
    baseUrl: normalizeBaseUrl(process.env.OLLAMA_BASE_URL, DEFAULT_OLLAMA_BASE_URL),
    model: process.env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL,
    timeoutMs: toNumber(process.env.OLLAMA_TIMEOUT_MS, DEFAULT_OLLAMA_TIMEOUT_MS),
    temperature: toNumber(process.env.OLLAMA_TEMPERATURE, DEFAULT_OLLAMA_TEMPERATURE),
    maxTokens: toNumber(process.env.OLLAMA_MAX_TOKENS, DEFAULT_OLLAMA_MAX_TOKENS),
  };
}

// ── Gemini settings ───────────────────────────────────────────────────────────
export interface GeminiAnalysisSettings {
  apiKey: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
}

export function getGeminiAnalysisSettings(): GeminiAnalysisSettings {
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() || '',
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    timeoutMs: toNumber(process.env.GEMINI_TIMEOUT_MS, DEFAULT_GEMINI_TIMEOUT_MS),
    temperature: toNumber(process.env.GEMINI_TEMPERATURE, DEFAULT_GEMINI_TEMPERATURE),
    maxTokens: toNumber(process.env.GEMINI_MAX_TOKENS, DEFAULT_GEMINI_MAX_TOKENS),
  };
}

/** Returns the active model name regardless of which provider is selected. */
export function getActiveModelName(providerOverride?: AnalysisProvider): string {
  const provider = providerOverride || getAnalysisProvider();
  return provider === 'gemini'
    ? getGeminiAnalysisSettings().model
    : getOllamaAnalysisSettings().model;
}
