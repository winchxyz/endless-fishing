import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  DIRECT_FILES,
  HDRIS,
  LICENCE_TEXT,
  TEXTURES,
  WANTED_MAPS,
  type HdriEntry,
  type Licence,
} from './asset-manifest.js';
import { extractMatching } from './lib/zip.js';

/**
 * Manifest-driven CC0 asset downloader.
 *
 * Guarantees:
 *   - Idempotent. A second run downloads nothing and exits in under a second.
 *   - Reproducible. Every file's SHA-256 is recorded in `assets/assets.lock.json`, which IS
 *     committed. A later run that gets different bytes fails loudly rather than silently
 *     shipping a different asset.
 *   - Attributed. `assets/CREDITS.md` is regenerated from the manifest every run, so the
 *     credits cannot drift from what is actually on disk.
 *
 * Usage:
 *   npm run assets              web profile: 2k hero skies, 1k secondary, 1k textures
 *   npm run assets -- --hq      4k skies and 2k textures, for local hero renders
 *   npm run assets -- --update-lock   accept new checksums (use when bumping the manifest)
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');
// The lockfile lives at the repo root, not under assets/, because assets/ is git-ignored and
// the whole point of the lock is that it IS committed.
const LOCK_PATH = join(ROOT, 'assets.lock.json');
const CONCURRENCY = 5;
const POLYHAVEN_API = 'https://api.polyhaven.com';

const args = new Set(process.argv.slice(2));
const HQ = args.has('--hq');
const UPDATE_LOCK = args.has('--update-lock');

interface LockEntry {
  sha256: string;
  bytes: number;
  source: string;
}
type Lockfile = Record<string, LockEntry>;

interface SkyMetadata {
  slug: string;
  file: string;
  weather: string;
  note: string;
  /** Shooting location, degrees. The runtime derives the baked sun position from this. */
  latitudeDeg: number;
  longitudeDeg: number;
  /** UTC epoch milliseconds the panorama was shot. */
  capturedAtMs: number;
  /** Poly Haven's own coarse labels, kept for the debug panel. */
  timeOfDay: string;
  /** Median luminance in the upper hemisphere, used to exposure-match against the analytic sky. */
  resolution: string;
}

let downloadedBytes = 0;
let reusedBytes = 0;
const failures: string[] = [];

/* ------------------------------------------------------------------- utilities */

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchBuffer(url: string, attempt = 1): Promise<Buffer> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'endless-fishing-asset-fetcher/1.0 (+CC0 assets only)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return fetchBuffer(url, attempt + 1);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const buffer = await fetchBuffer(url);
  return JSON.parse(buffer.toString('utf8')) as T;
}

/** Run tasks with a bounded number in flight. Keeps us polite to the CDNs. */
async function pool<T>(items: readonly T[], worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/**
 * Write a file and record its checksum. If the lockfile already knows this path, the bytes
 * must match — otherwise the upstream asset changed under us and we stop.
 */
async function commit(
  lock: Lockfile,
  relPath: string,
  data: Buffer,
  source: string,
): Promise<void> {
  const digest = sha256(data);
  const known = lock[relPath];

  if (known !== undefined && known.sha256 !== digest && !UPDATE_LOCK) {
    throw new Error(
      `Checksum mismatch for ${relPath}.\n` +
        `  expected ${known.sha256}\n  actual   ${digest}\n` +
        '  The upstream file changed. Re-run with --update-lock once you have verified the new file.',
    );
  }

  const full = join(ASSETS, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
  lock[relPath] = { sha256: digest, bytes: data.length, source };
}

/** True when the file is already on disk and matches the lockfile. */
async function isSatisfied(lock: Lockfile, relPath: string): Promise<boolean> {
  const known = lock[relPath];
  if (known === undefined) return false;
  const full = join(ASSETS, relPath);
  if (!(await exists(full))) return false;
  const data = await readFile(full);
  if (sha256(data) !== known.sha256) return false;
  reusedBytes += data.length;
  return true;
}

/* ------------------------------------------------------------------------ HDRI */

interface PolyHavenFiles {
  hdri: Record<string, { hdr?: { url: string; size: number } }>;
}
interface PolyHavenInfo {
  coords?: [number, number];
  date_taken?: number;
  attributes?: { time_of_day?: string };
}

function hdriResolution(entry: HdriEntry): string {
  if (HQ) return entry.tier === 'hero' ? '4k' : '2k';
  return entry.tier === 'hero' ? '2k' : '1k';
}

async function fetchHdri(entry: HdriEntry, lock: Lockfile, skies: SkyMetadata[]): Promise<void> {
  const resolution = hdriResolution(entry);
  const relPath = `hdri/${entry.slug}_${resolution}.hdr`;

  const [files, info] = await Promise.all([
    fetchJson<PolyHavenFiles>(`${POLYHAVEN_API}/files/${entry.slug}`),
    fetchJson<PolyHavenInfo>(`${POLYHAVEN_API}/info/${entry.slug}`),
  ]);

  const coords = info.coords;
  const dateTaken = info.date_taken;
  if (coords === undefined || dateTaken === undefined) {
    throw new Error(
      `${entry.slug}: Poly Haven has no shooting coordinates or timestamp for this sky, so its ` +
        'baked sun position cannot be derived. Remove it from the manifest.',
    );
  }

  skies.push({
    slug: entry.slug,
    file: relPath,
    weather: entry.weather,
    note: entry.note,
    latitudeDeg: coords[0],
    longitudeDeg: coords[1],
    capturedAtMs: dateTaken * 1000,
    timeOfDay: info.attributes?.time_of_day ?? 'unknown',
    resolution,
  });

  if (await isSatisfied(lock, relPath)) return;

  const file = files.hdri[resolution]?.hdr;
  if (file === undefined) throw new Error(`${entry.slug}: no ${resolution} HDR available`);

  const data = await fetchBuffer(file.url);
  downloadedBytes += data.length;
  await commit(lock, relPath, data, `https://polyhaven.com/a/${entry.slug}`);
  process.stdout.write(`  sky   ${entry.slug} (${resolution}, ${human(data.length)})\n`);
}

/* -------------------------------------------------------------------- textures */

async function fetchTexture(
  id: string,
  resolution: string,
  lock: Lockfile,
): Promise<void> {
  // Check the cheapest map first; if it is present and locked, the whole set was extracted.
  //
  // The probe has to be spelt the way the *archive* spells it, which includes the resolution and
  // the format — `Rock064_1K-JPG_Color.jpg`, not `Rock064_Color.jpg`. It did not, so it never
  // matched a lockfile entry, `isSatisfied` was always false and all eleven ambientCG archives
  // came down again on every single run: seventy-three megabytes of exactly the files already on
  // disk. Silent, because the extraction that follows is idempotent and the checksums agree.
  const probe = `textures/${id}/${id}_${resolution}-JPG_Color.jpg`;
  if (await isSatisfied(lock, probe)) return;

  const url = `https://ambientcg.com/get?file=${id}_${resolution}-JPG.zip`;
  const archive = await fetchBuffer(url);
  downloadedBytes += archive.length;

  const wanted = extractMatching(archive, (basename) => {
    if (!/\.(jpg|png)$/i.test(basename)) return false;
    // ambientCG ships large sphere/cube preview renders in the same archive; drop them.
    if (/preview|sphere|cube|flat/i.test(basename)) return false;
    return WANTED_MAPS.some((map) => basename.includes(`_${map}.`));
  });

  if (wanted.size === 0) {
    throw new Error(`${id}: archive contained none of the expected PBR maps`);
  }

  for (const [basename, data] of wanted) {
    await commit(lock, `textures/${id}/${basename}`, data, `https://ambientcg.com/view?id=${id}`);
  }
  process.stdout.write(
    `  tex   ${id} (${resolution}, ${wanted.size} maps, ${human(archive.length)} archive)\n`,
  );
}

/* ---------------------------------------------------------------- direct files */

async function fetchDirect(
  entry: (typeof DIRECT_FILES)[number],
  lock: Lockfile,
): Promise<void> {
  // The star catalogue ships gzipped; store it expanded so the runtime does not need zlib.
  const dest = entry.dest.endsWith('.gz') ? entry.dest.slice(0, -3) : entry.dest;
  if (await isSatisfied(lock, dest)) return;

  const raw = await fetchBuffer(entry.url);
  downloadedBytes += raw.length;
  const data = entry.dest.endsWith('.gz') ? gunzipSync(raw) : raw;
  await commit(lock, dest, data, entry.source);
  process.stdout.write(`  file  ${dest} (${human(data.length)})\n`);
}

/* --------------------------------------------------------------------- credits */

async function writeCredits(lock: Lockfile, skies: readonly SkyMetadata[]): Promise<void> {
  const lines: string[] = [];
  const licences = new Set<Licence>();

  lines.push('# Asset credits');
  lines.push('');
  lines.push(
    'Every file in `assets/` is listed below with its source and licence. This file is',
    'generated by `npm run assets` from `scripts/asset-manifest.ts` — do not edit it by hand.',
    '',
    '**Nothing in this project uses an asset that is not CC0 or public domain.**',
    'All geometry — boat, fish, islands, trees, props — is authored procedurally in code and',
    'is covered by the repository\'s MIT licence.',
    '',
  );

  lines.push('## Sky panoramas — Poly Haven, CC0 1.0');
  lines.push('');
  lines.push(
    'Sky-only ("pure sky") HDRIs, chosen to span weather state against sun altitude. The baked',
    'sun position of each is derived at runtime from the shooting coordinates and timestamp',
    'below, using the same NOAA solar solver that drives the live sun — which is how the HDRI',
    'highlight is made to coincide with the rendered sun disc.',
    '',
  );
  lines.push('| Sky | Weather | Shot at | Location | Source |');
  lines.push('|---|---|---|---|---|');
  for (const sky of skies) {
    licences.add('CC0-1.0');
    const when = new Date(sky.capturedAtMs).toISOString().replace('T', ' ').slice(0, 16);
    const where = `${sky.latitudeDeg.toFixed(3)}, ${sky.longitudeDeg.toFixed(3)}`;
    lines.push(
      `| \`${sky.slug}\` | ${sky.weather} | ${when} UTC | ${where} | [polyhaven.com/a/${sky.slug}](https://polyhaven.com/a/${sky.slug}) |`,
    );
  }
  lines.push('');

  lines.push('## PBR materials — ambientCG, CC0 1.0');
  lines.push('');
  lines.push('| Material | Used for | Source |');
  lines.push('|---|---|---|');
  for (const texture of TEXTURES) {
    licences.add('CC0-1.0');
    lines.push(
      `| \`${texture.id}\` | ${texture.role} | [ambientcg.com/view?id=${texture.id}](https://ambientcg.com/view?id=${texture.id}) |`,
    );
  }
  lines.push('');

  lines.push('## Astronomical data — public domain');
  lines.push('');
  for (const entry of DIRECT_FILES) {
    licences.add(entry.licence);
    lines.push(`### \`${entry.dest.replace(/\.gz$/, '')}\``);
    lines.push('');
    lines.push(`- **Credit**: ${entry.credit}`);
    lines.push(`- **Source**: <${entry.source}>`);
    lines.push(`- **Licence**: ${LICENCE_TEXT[entry.licence]}`);
    lines.push(`- ${entry.note}`);
    lines.push('');
  }

  lines.push('## Generated procedurally, not downloaded');
  lines.push('');
  lines.push(
    'These are authored in code because a photograph could not do the job, not because a',
    'licence was unavailable — each has to tile exactly and be parameterised at runtime:',
    '',
    '- **Ocean detail normals** (two scales) — built from a filtered noise spectrum so the two',
    '  scales are decorrelated and both tile seamlessly at their own period.',
    '- **Foam** — coverage and breakup driven by wave steepness, so it must respond to the sea',
    '  state rather than being a fixed pattern.',
    '- **Fish scales** — a Voronoi scale field parameterised per species (scale size, iridescence,',
    '  countershading), which is twelve materials from one generator.',
    '- **Milky Way band** — placed in true galactic coordinates by the same equatorial-to-horizontal',
    '  transform as the star catalogue. See DECISIONS.md for why this replaced the NASA panorama.',
    '- **Water caustics, wet-sand band, lens droplets, star point-spread sprite.**',
    '',
  );

  lines.push('## Licence texts');
  lines.push('');
  for (const licence of licences) lines.push(`- **${licence}** — ${LICENCE_TEXT[licence]}`);
  lines.push('');

  const total = Object.values(lock).reduce((sum, entry) => sum + entry.bytes, 0);
  lines.push(
    `_${Object.keys(lock).length} files, ${human(total)} on disk. ` +
      `Generated ${new Date().toISOString().slice(0, 10)}._`,
  );
  lines.push('');

  await writeFile(join(ASSETS, 'CREDITS.md'), lines.join('\n'), 'utf8');
}

/* ------------------------------------------------------------------------ main */

async function main(): Promise<void> {
  process.stdout.write(`Fetching CC0 assets (${HQ ? 'high quality' : 'web'} profile)\n`);
  await mkdir(ASSETS, { recursive: true });

  let lock: Lockfile = {};
  if (await exists(LOCK_PATH)) {
    lock = JSON.parse(await readFile(LOCK_PATH, 'utf8')) as Lockfile;
  }

  const skies: SkyMetadata[] = [];

  await pool(HDRIS, async (entry) => {
    try {
      await fetchHdri(entry, lock, skies);
    } catch (error) {
      failures.push(`sky ${entry.slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const textureResolution = HQ ? '2K' : '1K';
  await pool(TEXTURES, async (entry) => {
    try {
      await fetchTexture(entry.id, HQ ? '2K' : entry.resolution, lock);
    } catch (error) {
      failures.push(`texture ${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await pool(DIRECT_FILES, async (entry) => {
    try {
      await fetchDirect(entry, lock);
    } catch (error) {
      failures.push(`file ${entry.dest}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length} asset(s) failed:\n`);
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
    process.exitCode = 1;
    return;
  }

  skies.sort((a, b) => a.slug.localeCompare(b.slug));
  await writeFile(
    join(ASSETS, 'sky-library.json'),
    `${JSON.stringify({ profile: HQ ? 'hq' : 'web', textureResolution, skies }, null, 2)}\n`,
    'utf8',
  );

  const ordered: Lockfile = {};
  for (const key of Object.keys(lock).sort()) {
    const entry = lock[key];
    if (entry !== undefined) ordered[key] = entry;
  }
  await writeFile(LOCK_PATH, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
  await writeCredits(ordered, skies);

  const total = Object.values(ordered).reduce((sum, entry) => sum + entry.bytes, 0);
  process.stdout.write(
    `\nDone. ${Object.keys(ordered).length} files, ${human(total)} on disk ` +
      `(${human(downloadedBytes)} downloaded, ${human(reusedBytes)} reused).\n` +
      'Next: npm run textures\n',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`\nAsset fetch failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
