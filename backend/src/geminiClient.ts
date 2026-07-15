import { getGeminiAnalysisSettings } from './analysisConfig.js';

export interface GeminiResponse {
  content: string;
  model: string;
  durationMs: number;
}

export interface GeminiPromptInput {
  systemPrompt: string;
  userMessage: string;
}

export async function chatWithGemini(input: GeminiPromptInput | string[]): Promise<GeminiResponse> {
  const settings = getGeminiAnalysisSettings();
  if (!settings.apiKey) {
    throw new Error('GEMINI_API_KEY is not set in .env');
  }

  const candidateModels = Array.from(new Set([
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-flash-latest',
    settings.model,
  ]));

  let lastError: Error | null = null;

  const requestBody: Record<string, unknown> = {
    generationConfig: {
      temperature: settings.temperature,
      maxOutputTokens: settings.maxTokens,
      responseMimeType: 'application/json',
    },
  };

  if (Array.isArray(input)) {
    requestBody.contents = [
      {
        role: 'user',
        parts: [{ text: input.join('\n\n') }],
      },
    ];
  } else {
    requestBody.system_instruction = {
      parts: [{ text: input.systemPrompt }],
    };
    requestBody.contents = [
      {
        role: 'user',
        parts: [{ text: input.userMessage }],
      },
    ];
  }

  for (const candidateModel of candidateModels) {
    const cleanModel = candidateModel.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${settings.apiKey}`;

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), settings.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[gemini] Model ${cleanModel} returned HTTP ${response.status}, falling back to next candidate...`);
        lastError = new Error(`Gemini returned ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        lastError = new Error('Gemini returned an empty response.');
        continue;
      }

      return {
        content: text.trim(),
        model: cleanModel,
        durationMs,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error('Gemini request timed out');
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
      console.warn(`[gemini] Model ${cleanModel} threw error (${lastError.message}), falling back to next candidate...`);
    }
  }

  throw lastError ?? new Error('All Gemini models failed.');
}
