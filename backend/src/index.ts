import cors from 'cors';
import express from 'express';
import { loadSourceRows } from './loadCsv.js';
import { normalizeTelemetry } from './normalize.js';
import { exportNormalizedCsv } from './exportNormalized.js';

interface RuntimeSnapshot {
  assets: ReturnType<typeof normalizeTelemetry>['assets'];
  flows: ReturnType<typeof normalizeTelemetry>['flows'];
  events: ReturnType<typeof normalizeTelemetry>['events'];
  alerts: ReturnType<typeof normalizeTelemetry>['alerts'];
  sourceCounts: {
    qradar: number;
    sna: number;
    arista: number;
  };
}

const buildRuntimeSnapshot = async (): Promise<RuntimeSnapshot> => {
  const sources = await loadSourceRows();
  const normalized = normalizeTelemetry(sources);
  const snapshot: RuntimeSnapshot = {
    ...normalized,
    sourceCounts: {
      qradar: sources.qradar.length,
      sna: sources.sna.length,
      arista: sources.arista.length
    }
  };

  await exportNormalizedCsv(snapshot);
  return snapshot;
};

const app = express();
const port = 3001;

app.use(cors());

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

app.listen(port, () => {
  console.log(`SOC telemetry backend listening on http://localhost:${port}`);
});

void buildRuntimeSnapshot().catch((error) => {
  console.error('Failed to build runtime snapshot', error);
});
