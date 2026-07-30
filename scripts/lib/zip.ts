import { inflateRawSync } from 'node:zlib';

/**
 * Minimal ZIP reader — enough to pull named entries out of an ambientCG material archive.
 *
 * Written by hand rather than pulled in as a dependency: we need exactly two things (list
 * entries, extract one by name), the archives are well-formed store/deflate produced by a
 * single known tool, and an unaudited archive-extraction package is a poor trade for
 * ~90 lines. It reads the central directory, so it is correct for archives with data
 * descriptors, which the naive "walk local headers" approach is not.
 */

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_COMMENT = 0xffff;

function findEndOfCentralDirectory(buffer: Buffer): number {
  const start = Math.max(0, buffer.length - MAX_COMMENT - 22);
  for (let i = buffer.length - 22; i >= start; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error('Not a ZIP archive: end-of-central-directory record not found');
}

export function listZipEntries(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`Corrupt ZIP: bad central directory signature at entry ${i}`);
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function extractZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const local = entry.localHeaderOffset;
  if (buffer.readUInt32LE(local) !== LOCAL_SIGNATURE) {
    throw new Error(`Corrupt ZIP: bad local header for ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const dataStart = local + 30 + nameLength + extraLength;
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return Buffer.from(raw);
  if (entry.compressionMethod === 8) return inflateRawSync(raw);
  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}`);
}

/**
 * Extract every entry whose basename matches `predicate`, keyed by basename.
 * Directory entries and macOS resource forks are skipped.
 */
export function extractMatching(
  buffer: Buffer,
  predicate: (basename: string) => boolean,
): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  for (const entry of listZipEntries(buffer)) {
    if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX/')) continue;
    const basename = entry.name.split('/').pop() ?? entry.name;
    if (!predicate(basename)) continue;
    result.set(basename, extractZipEntry(buffer, entry));
  }
  return result;
}
