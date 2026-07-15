import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = fileURLToPath(new URL('../../data', import.meta.url));
const normalizedDirectory = path.join(rootDirectory, 'normalized');

const escapeCell = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows, columns) => {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column])).join(','));
  return [header, ...body].join('\n');
};

export const exportNormalizedCsv = async (snapshot) => {
  await mkdir(normalizedDirectory, { recursive: true });

  await Promise.all([
    writeFile(path.join(normalizedDirectory, 'assets.csv'), toCsv(snapshot.assets, ['ip', 'hostname', 'mac', 'country', 'asn', 'username', 'deviceType', 'sourceVendor', 'communicationVolume']), 'utf8'),
    writeFile(path.join(normalizedDirectory, 'flows.csv'), toCsv(snapshot.flows, ['id', 'timestamp', 'src_ip', 'src_port', 'dst_ip', 'dst_port', 'protocol', 'application', 'bytes', 'packets', 'direction', 'ja3', 'sni', 'dns_query', 'risk_score', 'sourceVendor']), 'utf8'),
    writeFile(path.join(normalizedDirectory, 'events.csv'), toCsv(snapshot.events, ['id', 'timestamp', 'event_name', 'category', 'severity', 'src_ip', 'dst_ip', 'username', 'process_name', 'filename', 'domain', 'url', 'raw_event', 'sourceVendor']), 'utf8'),
    writeFile(path.join(normalizedDirectory, 'alerts.csv'), toCsv(snapshot.alerts, ['id', 'alert_name', 'severity', 'risk_score', 'src_ip', 'dst_ip', 'ioc_match', 'malware_family', 'anomaly_score', 'timestamp', 'sourceVendor']), 'utf8'),
    writeFile(path.join(normalizedDirectory, 'manifest.json'), JSON.stringify({
      sourceCounts: snapshot.sourceCounts,
      exportedAt: new Date().toISOString(),
      tables: {
        assets: snapshot.assets.length,
        flows: snapshot.flows.length,
        events: snapshot.events.length,
        alerts: snapshot.alerts.length
      }
    }, null, 2), 'utf8')
  ]);
};