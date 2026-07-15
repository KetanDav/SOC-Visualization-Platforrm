import cors from 'cors';
import express from 'express';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dataDirectory, getUploadedVendors, loadSourceRows, loadSourceRowsWithUploads } from './loadCsv.js';
import { normalizeTelemetry } from './normalize.js';
import { exportNormalizedCsv } from './exportNormalized.js';
import { runIncidentAnalysis } from './incidentAnalysis.js';
import { chatWithGeminiFreeForm } from './geminiClient.js';
import { chatWithOllama } from './ollamaClient.js';
import { getOllamaAnalysisSettings, getActiveModelName } from './analysisConfig.js';
import { buildZip } from './zipBuilder.js';
import type { IncidentAnalysisContextPackage } from '@soc/telemetry-shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the project root (two levels up from backend/src)
try {
  const envPath = path.resolve(__dirname, '../../.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // no .env or unreadable — rely on process.env defaults
}

const uploadsDir = path.join(dataDirectory, 'uploads');

interface RuntimeSnapshot {
  assets: ReturnType<typeof normalizeTelemetry>['assets'];
  flows: ReturnType<typeof normalizeTelemetry>['flows'];
  events: ReturnType<typeof normalizeTelemetry>['events'];
  alerts: ReturnType<typeof normalizeTelemetry>['alerts'];
  sourceCounts: {
    qradar: number;
    sna: number;
    arista: number;
    cisco_ise: number;
    cisco_dnac: number;
    cisco_apic: number;
  };
}

let cachedSources: Awaited<ReturnType<typeof loadSourceRows>> | null = null;
let cachedSnapshot: RuntimeSnapshot | null = null;

const buildRuntimeSnapshot = async (): Promise<RuntimeSnapshot> => {
  const sources = await loadSourceRowsWithUploads(uploadsDir);
  cachedSources = sources;
  const normalized = normalizeTelemetry(sources);
  const snapshot: RuntimeSnapshot = {
    ...normalized,
    sourceCounts: {
      qradar:     sources.qradar.length,
      sna:        sources.sna.length,
      arista:     sources.arista.length,
      cisco_ise:  sources.cisco_ise.length,
      cisco_dnac: sources.cisco_dnac.length,
      cisco_apic: sources.cisco_apic.length,
    }
  };
  cachedSnapshot = snapshot;
  await exportNormalizedCsv(snapshot);
  return snapshot;
};

const invalidateCache = () => {
  cachedSources = null;
  cachedSnapshot = null;
};

const app = express();
const port = parseInt(process.env.PORT ?? '3001', 10);
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.PORT;

app.use(cors());
app.use(express.json({ limit: '150mb' }));

const VENDOR_FIELDS = ['qradar', 'sna', 'arista', 'cisco_ise', 'cisco_dnac', 'cisco_apic'] as const;
type VendorKey = typeof VENDOR_FIELDS[number];

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'soc-telemetry-backend' });
});

app.get('/api/payload', async (_request, response) => {
  try {
    const snapshot = await buildRuntimeSnapshot();
    response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    response.status(500).json({ ok: false, message });
  }
});

app.post('/api/analysis/incident', async (request, response) => {
  try {
    const context = request.body?.context as IncidentAnalysisContextPackage | undefined;
    const providerOverride = request.body?.provider as 'ollama' | 'gemini' | undefined;
    if (!context) {
      response.json({
        ok: false,
        model: getActiveModelName(),
        durationMs: 0,
        analysis: null,
        fallbackMessage: 'Missing incident context for analysis request.',
        error: { code: 'invalid_request', message: 'Request body must include a context object.' },
      });
      return;
    }

    console.info('[analysis] request', {
      target: context.target.kind,
      label: context.scopeLabel,
      counts: { flows: context.relatedFlows.length, events: context.relatedEvents.length, alerts: context.relatedAlerts.length, assets: context.relatedAssets.length },
      model: getActiveModelName(providerOverride),
      snapshotLoaded: Boolean(cachedSnapshot),
    });

    const result = await runIncidentAnalysis(context, providerOverride);

    console.info('[analysis] complete', { ok: result.ok, durationMs: result.durationMs, model: result.model, label: context.scopeLabel });
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis error';
    console.error('[analysis] failed', message);
    response.json({
      ok: false,
      model: getActiveModelName(),
      durationMs: 0,
      analysis: null,
      fallbackMessage: 'The local incident analysis service is unavailable right now.',
      error: { code: 'analysis_failed', message },
    });
  }
});

// ── Upload status — which vendors have saved files on disk ──
app.get('/api/upload/status', async (_request, response) => {
  try {
    const uploadedVendors = await getUploadedVendors(uploadsDir);
    response.json({ ok: true, uploadedVendors, hasCustomData: uploadedVendors.length > 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    response.status(500).json({ ok: false, message });
  }
});

// ── Clear uploaded files — revert to built-in defaults ──
app.delete('/api/upload', async (_request, response) => {
  try {
    const uploaded = await getUploadedVendors(uploadsDir);
    await Promise.all([
      ...uploaded.map((v) => rm(path.join(uploadsDir, `${String(v)}.csv`), { force: true })),
      ...Array.from({ length: 10 }, (_, i) => rm(path.join(uploadsDir, `other_${i}.csv`), { force: true })),
    ]);
    invalidateCache();
    console.info('[upload] cleared', { removedVendors: uploaded });
    response.json({ ok: true, removedVendors: uploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clear failed';
    console.error('[upload] clear error', message);
    response.status(500).json({ ok: false, message });
  }
});

// ── CSV upload — receives base64-encoded files as JSON, saves to disk ──
app.post('/api/upload', async (request, response) => {
  try {
    const body = request.body as Record<string, string> | undefined;
    const uploadedVendors = VENDOR_FIELDS.filter((f) => typeof body?.[f] === 'string' && body[f].length > 0);
    const otherKeys = Array.from({ length: 10 }, (_, i) => `other_${i}`)
      .filter((k) => typeof body?.[k] === 'string' && (body[k] as string).length > 0);

    if (uploadedVendors.length === 0 && otherKeys.length === 0) {
      response.status(400).json({ ok: false, message: 'No CSV files received.' });
      return;
    }

    await Promise.all([
      ...uploadedVendors.map((vendor) => {
        const buf = Buffer.from(body![vendor], 'base64');
        return writeFile(path.join(uploadsDir, `${vendor}.csv`), buf);
      }),
      ...otherKeys.map((key) => {
        const buf = Buffer.from(body![key], 'base64');
        return writeFile(path.join(uploadsDir, `${key}.csv`), buf);
      }),
    ]);

    console.info('[upload] saved to disk', { uploadedVendors, otherFiles: otherKeys.length });
    invalidateCache();

    const snapshot = await buildRuntimeSnapshot();
    response.json({ ok: true, snapshot, uploadedVendors, otherFiles: otherKeys.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload processing failed';
    console.error('[upload] error', message);
    response.status(400).json({ ok: false, message });
  }
});

// Raw vendor rows — unprocessed CSV data for a single vendor
app.get('/api/raw', async (request, response) => {
  try {
    const vendor = String(request.query.vendor ?? '').toLowerCase();
    const ipFilter = String(request.query.ip ?? '').toLowerCase().trim();

    const validVendors = ['qradar', 'sna', 'arista', 'cisco_ise', 'cisco_dnac', 'cisco_apic', 'other'] as const;
    type VendorKey = typeof validVendors[number];
    if (!validVendors.includes(vendor as VendorKey)) {
      response.status(400).json({ ok: false, message: `Invalid vendor. Must be one of: ${validVendors.join(', ')}` });
      return;
    }

    // Check whether this vendor has an uploaded file (or is using built-in defaults)
    const uploadedVendors = await getUploadedVendors(uploadsDir);
    const isUploaded = uploadedVendors.includes(vendor as VendorKey);

    const sources = cachedSources ?? await loadSourceRowsWithUploads(uploadsDir);
    if (!cachedSources) cachedSources = sources;

    let rows: Array<Record<string, string>> = sources[vendor as VendorKey];
    if (ipFilter) {
      rows = rows.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(ipFilter)));
    }

    response.json({ vendor, totalRows: rows.length, rows, isUploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    response.status(500).json({ ok: false, message });
  }
});

// ── Natural language query endpoint ──
app.post('/api/query', async (request, response) => {
  try {
    const { question, context, provider = 'gemini' } = request.body as {
      question: string;
      context: string;
      provider?: 'ollama' | 'gemini';
    };

    if (!question?.trim()) {
      response.status(400).json({ ok: false, message: 'question is required' });
      return;
    }

    const systemPrompt = `You are a senior SOC (Security Operations Center) analyst assistant.
The user is viewing a live telemetry dashboard. You will be given a snapshot of the current filtered dataset and a question.
Answer clearly, concisely, and accurately using only the data provided.
Use bullet points for lists. Highlight IPs, hostnames, or alert names using backticks.
If the answer cannot be determined from the provided data, say so honestly.
Do NOT hallucinate data that isn't in the snapshot.`;

    const userMessage = `=== TELEMETRY DATA ===\n${context}\n\n=== QUESTION ===\n${question}`;

    if (provider === 'gemini') {
      const result = await chatWithGeminiFreeForm({ systemPrompt, userMessage });
      response.json({ ok: true, answer: result.content, model: result.model, durationMs: result.durationMs });
    } else {
      const result = await chatWithOllama({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
      // Ollama may return JSON-wrapped text; try to extract plain text
      let answer = result.content;
      try {
        const parsed = JSON.parse(answer) as Record<string, unknown>;
        answer = (parsed.answer ?? parsed.text ?? parsed.response ?? answer) as string;
      } catch { /* not JSON, use raw */ }
      response.json({ ok: true, answer, model: result.model, durationMs: result.durationMs });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    response.status(500).json({ ok: false, message });
  }
});

// ── Export normalized data as a ZIP of 4 CSVs ──
app.get('/api/export/csv', async (_request, response) => {
  try {
    // Ensure snapshot is built (normalized CSVs are written to data/normalized/)
    if (!cachedSnapshot) await buildRuntimeSnapshot();

    const normalizedDir = path.join(dataDirectory, 'normalized');
    const exportedAt = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const zipName = `soc-telemetry-export-${exportedAt}.zip`;

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const fileNames = ['flows.csv', 'events.csv', 'alerts.csv', 'assets.csv', 'manifest.json'];
    const files = await Promise.all(
      fileNames.map(async (name) => ({ name, data: await readFile(path.join(normalizedDir, name)) }))
    );

    const zipBuffer = buildZip(files);
    response.setHeader('Content-Length', zipBuffer.length);
    response.end(zipBuffer);
    console.info('[export] zip sent', { zipName, bytes: zipBuffer.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    console.error('[export] error', message);
    if (!response.headersSent) {
      response.status(500).json({ ok: false, message });
    }
  }
});

app.get(['/DOCUMENTATION.html', '/docs'], (_req, res) => {
  const docPath = path.resolve(__dirname, '../../DOCUMENTATION.html');
  res.sendFile(docPath);
});

if (isProduction) {
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`SOC telemetry backend listening on http://0.0.0.0:${port}`);
});

// Ensure uploads directory exists, then pre-warm the cache
void mkdir(uploadsDir, { recursive: true })
  .then(() => buildRuntimeSnapshot())
  .catch((error) => console.error('Startup error', error));
