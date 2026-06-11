import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import type { LoadedSourceRows } from '@soc/telemetry-shared';

const dataDirectory = fileURLToPath(new URL('../../data', import.meta.url));

const readCsvRows = async (fileName: string) => {
  const filePath = path.join(dataDirectory, fileName);
  const fileContent = await readFile(filePath, 'utf8');
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;
};

export const loadSourceRows = async (): Promise<LoadedSourceRows> => {
  const [qradar, sna, arista] = await Promise.all([
    readCsvRows('qradar_events.csv'),
    readCsvRows('sna_flows.csv'),
    readCsvRows('arista_ndr.csv')
  ]);

  return { qradar, sna, arista };
};
