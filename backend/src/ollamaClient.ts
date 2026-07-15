import { getOllamaAnalysisSettings } from './analysisConfig.js';

export interface OllamaChatResult {
  content: string;
  model: string;
  durationMs: number;
}

export interface OllamaChatOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  signal?: AbortSignal;
}

function buildAbortError(): Error {
  return new Error('Ollama request timed out');
}

export async function chatWithOllama(options: OllamaChatOptions): Promise<OllamaChatResult> {
  const settings = getOllamaAnalysisSettings();
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), settings.timeoutMs);
  const cleanupSignal = options.signal;
  const onExternalAbort = () => controller.abort();

  if (cleanupSignal) {
    if (cleanupSignal.aborted) {
      controller.abort();
    } else {
      cleanupSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(`${settings.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: options.messages,
        stream: false,
        format: 'json',
        think: false,
        options: {
          temperature: settings.temperature,
          num_predict: settings.maxTokens,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Ollama returned ${response.status}: ${text || response.statusText}`);
    }

    const data = await response.json() as {
      model?: string;
      message?: { content?: string };
      response?: string;
    };

    const content = data.message?.content ?? data.response ?? '';
    if (!content) {
      throw new Error('Ollama returned an empty response');
    }

    return {
      content,
      model: data.model ?? settings.model,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw buildAbortError();
    }

    throw error instanceof Error ? error : new Error('Unexpected Ollama error');
  } finally {
    globalThis.clearTimeout(timer);
    if (cleanupSignal) {
      cleanupSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
