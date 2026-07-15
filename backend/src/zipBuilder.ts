import { deflateRawSync } from 'node:zlib';

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(): { date: number; time: number } {
  const now = new Date();
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  return { date: date >>> 0, time: time >>> 0 };
}

export function buildZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const { date, time } = dosDateTime();

  const entries = files.map((file) => {
    const nameBytes = Buffer.from(file.name, 'utf8');
    const compressed = deflateRawSync(file.data, { level: 6 });
    const checksum = crc32(file.data);
    return { nameBytes, compressed, checksum, uncompressedSize: file.data.length };
  });

  const localParts: Buffer[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const header = Buffer.allocUnsafe(30 + entry.nameBytes.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(entry.checksum, 14);
    header.writeUInt32LE(entry.compressed.length, 18);
    header.writeUInt32LE(entry.uncompressedSize, 22);
    header.writeUInt16LE(entry.nameBytes.length, 26);
    header.writeUInt16LE(0, 28);
    entry.nameBytes.copy(header, 30);

    offsets.push(offset);
    const chunk = Buffer.concat([header, entry.compressed]);
    localParts.push(chunk);
    offset += chunk.length;
  }

  const centralDirStart = offset;
  const centralParts: Buffer[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const cdEntry = Buffer.allocUnsafe(46 + entry.nameBytes.length);
    cdEntry.writeUInt32LE(0x02014b50, 0);
    cdEntry.writeUInt16LE(20, 4);
    cdEntry.writeUInt16LE(20, 6);
    cdEntry.writeUInt16LE(0, 8);
    cdEntry.writeUInt16LE(8, 10);
    cdEntry.writeUInt16LE(time, 12);
    cdEntry.writeUInt16LE(date, 14);
    cdEntry.writeUInt32LE(entry.checksum, 16);
    cdEntry.writeUInt32LE(entry.compressed.length, 20);
    cdEntry.writeUInt32LE(entry.uncompressedSize, 24);
    cdEntry.writeUInt16LE(entry.nameBytes.length, 28);
    cdEntry.writeUInt16LE(0, 30);
    cdEntry.writeUInt16LE(0, 32);
    cdEntry.writeUInt16LE(0, 34);
    cdEntry.writeUInt16LE(0, 36);
    cdEntry.writeUInt32LE(0, 38);
    cdEntry.writeUInt32LE(offsets[i], 42);
    entry.nameBytes.copy(cdEntry, 46);
    centralParts.push(cdEntry);
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.allocUnsafe(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(centralDirStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}
