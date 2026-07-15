import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import type { LoadedSourceRows } from '@soc/telemetry-shared';

export const dataDirectory = fileURLToPath(new URL('../../data', import.meta.url));

const VENDOR_FILE_MAP: Record<keyof LoadedSourceRows, string | null> = {
  qradar:     'qradar_events.csv',
  sna:        'sna_flows.csv',
  arista:     'arista_ndr.csv',
  cisco_ise:  'cisco_ise_events.csv',
  cisco_dnac: 'cisco_dnac_events.csv',
  cisco_apic: 'cisco_apic_events.csv',
  other:      null,
};

const parseCsvFile = async (filePath: string): Promise<Array<Record<string, string>>> => {
  const content = await readFile(filePath, 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try { await access(filePath); return true; } catch { return false; }
};

export const loadSourceRows = async (): Promise<LoadedSourceRows> => {
  const vendors = Object.keys(VENDOR_FILE_MAP) as Array<keyof LoadedSourceRows>;
  const rows = await Promise.all(
    vendors.map(async (vendor) => {
      const defaultFile = VENDOR_FILE_MAP[vendor];
      if (!defaultFile) return [];
      return parseCsvFile(path.join(dataDirectory, defaultFile));
    })
  );
  const [qradar, sna, arista, cisco_ise, cisco_dnac, cisco_apic, other] = rows;
  return { qradar, sna, arista, cisco_ise, cisco_dnac, cisco_apic, other };
};

export const loadSourceRowsWithUploads = async (uploadsDir: string): Promise<LoadedSourceRows> => {
  const coreVendors = (['qradar', 'sna', 'arista', 'cisco_ise', 'cisco_dnac', 'cisco_apic'] as const);

  const coreRows = await Promise.all(
    coreVendors.map(async (vendor) => {
      const uploadPath = path.join(uploadsDir, `${vendor}.csv`);
      const useUpload = await fileExists(uploadPath);
      if (useUpload) return parseCsvFile(uploadPath);
      const defaultFile = VENDOR_FILE_MAP[vendor];
      if (!defaultFile) return [];
      return parseCsvFile(path.join(dataDirectory, defaultFile));
    })
  );

  const [qradar, sna, arista, cisco_ise, cisco_dnac, cisco_apic] = coreRows;

  // Load all other_0.csv … other_9.csv that exist and merge into one array
  const otherResults = await Promise.all(
    Array.from({ length: 10 }, (_, i) => i).map(async (i) => {
      const p = path.join(uploadsDir, `other_${i}.csv`);
      return (await fileExists(p)) ? parseCsvFile(p) : [];
    })
  );
  const other = otherResults.flat();

  return { qradar, sna, arista, cisco_ise, cisco_dnac, cisco_apic, other };
};

export const getUploadedVendors = async (uploadsDir: string): Promise<Array<keyof LoadedSourceRows>> => {
  const coreVendors = (['qradar', 'sna', 'arista', 'cisco_ise', 'cisco_dnac', 'cisco_apic'] as const);
  const results = await Promise.all(
    coreVendors.map(async (v) => ({ v, exists: await fileExists(path.join(uploadsDir, `${v}.csv`)) }))
  );
  const found: Array<keyof LoadedSourceRows> = results.filter((r) => r.exists).map((r) => r.v);

  // Check if any other_*.csv files exist
  const otherChecks = await Promise.all(
    Array.from({ length: 10 }, (_, i) => fileExists(path.join(uploadsDir, `other_${i}.csv`)))
  );
  if (otherChecks.some(Boolean)) found.push('other');

  return found;
};
