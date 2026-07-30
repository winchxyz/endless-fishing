import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type ResizeOptions } from 'sharp';
import { TEXTURES, WANTED_MAPS, type TextureEntry } from './asset-manifest.js';

/**
 * Turns everything `npm run assets` downloaded into what the runtime actually loads.
 *
 * Three jobs, one pass:
 *   1. PBR materials  — power-of-two WebP, with occlusion, roughness and metalness packed
 *      into one three-channel image. Six fetched maps become three or four loaded ones, and
 *      the three data channels then share a single set of mips.
 *   2. The Moon       — colour albedo, plus a tangent-space normal map *derived* from the
 *      LOLA elevation model, so real crater relief catches the terminator.
 *   3. Star catalogue — a 12-byte-per-star binary, brightest first, that goes straight into
 *      a `Points` geometry without parsing 1.7 MB of fixed-width ASCII at boot.
 *
 * Guarantees:
 *   - Idempotent. Every output records a digest of the sources and settings it was built
 *     from; a second run with unchanged inputs writes nothing and says so.
 *   - Licensed. Every source is checked against `assets.lock.json` before it is read, so
 *     nothing that is not a credited CC0 / public-domain asset can reach assets/processed.
 *
 * Usage:
 *   npm run textures
 *   npm run textures -- --force   rebuild everything, ignoring the digests
 *
 * Output is WebP rather than KTX2/Basis — see DECISIONS.md §10 for why.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');
const PROCESSED = join(ASSETS, 'processed');
const LOCK_PATH = join(ROOT, 'assets.lock.json');
const MANIFEST_PATH = join(PROCESSED, 'manifest.json');

const FORCE = new Set(process.argv.slice(2)).has('--force');

/**
 * Bump this to invalidate every cached output at once. The tunable constants below are folded
 * into each digest individually, so changing a quality or a height scale already forces a
 * rebuild — this is for changes to the *code*, such as the Sobel maths or the channel order,
 * that no constant captures.
 */
const RECIPE = 1;

const ALBEDO_QUALITY = 88;
/** Normals band badly, and a banded normal terraces a whole surface, so they get more bits. */
const NORMAL_QUALITY = 92;
const ORM_QUALITY = 90;
/** Height only drives parallax and vertex displacement, both low-frequency. */
const HEIGHT_QUALITY = 85;
const MOON_ALBEDO_QUALITY = 92;

/** Non-square sources are stretched rather than cropped — nothing may be thrown away. */
const FILL: ResizeOptions = { fit: 'fill', kernel: 'lanczos3' };

/* --------------------------------------------------------------------- the Moon */

const MOON_MAP_WIDTH = 2048;
const MOON_MAP_HEIGHT = 1024;
/** Volumetric mean radius, IAU 2015. Sets the equirectangular pixel spacing. */
const MOON_RADIUS_M = 1737400;
/**
 * LOLA ships elevation as unsigned counts at half a metre each, biased so that count 20000 is
 * the reference radius. Only the scale matters here: the bias cancels in a gradient.
 */
const LOLA_METRES_PER_COUNT = 0.5;
/**
 * Vertical exaggeration of the lunar relief, as a multiple of the true slope.
 *
 * The surface at 4 pixels per degree is not flat to begin with: between 60 S and 60 N the
 * measured Sobel slope is about 2 degrees at the median, 12 at the 99th percentile, and 25 at
 * the steepest scarps. Rendered honestly that is real but timid, because the lunar disc is
 * only a few hundred pixels across — the map is minified three or four mip levels and
 * averaging normals flattens them further. 3x puts the median near 6 degrees and crater rims
 * in the 20-35 band, which survives both the minification and WebP quantisation. Going to the
 * 10x or 20x that "make the craters pop" usually lands on turns the maria into crumpled foil
 * under a low sun, which is the one lighting condition this map exists for.
 */
const MOON_RELIEF_EXAGGERATION = 3;
/**
 * Latitude beyond which the cos(latitude) divisor stops shrinking.
 *
 * Equirectangular columns converge towards the poles, so the horizontal sample spacing is
 * cos(latitude) times the equatorial one and the x-gradient has to be divided by it — without
 * that the poles erupt into false relief. But past about 85 degrees adjacent columns are
 * closer together than a single LOLA footprint, so what is left there is resampling rather
 * than topography, and dividing by a vanishing number just amplifies it. Clamping caps the
 * amplification at about 11x.
 */
const MOON_POLE_CLAMP_LAT_DEG = 85;

/* ---------------------------------------------------------------- star catalogue */

/** The Bright Star Catalogue is complete to V 6.5 — roughly the naked-eye limit. */
const STAR_MAGNITUDE_LIMIT = 6.5;
/** Sanity bounds on the survivor count. A column off-by-one gives a plausible but wrong sky. */
const STAR_COUNT_MIN = 8000;
const STAR_COUNT_MAX = 9200;
/** B-V for stars with no published UBV photometry. The solar value: a safe mid-yellow. */
const DEFAULT_COLOUR_INDEX = 0.65;
const BSC5_MAGIC = 0x42534335;
const BSC5_VERSION = 1;
const BSC5_HEADER_BYTES = 16;
const BSC5_STAR_BYTES = 12;

const HOURS_TO_RAD = Math.PI / 12;
const DEG_TO_RAD = Math.PI / 180;

let rebuilt = 0;
let unchanged = 0;
const failures: string[] = [];

/* ------------------------------------------------------------------- lock & I/O */

interface LockEntry {
  sha256: string;
  bytes: number;
  source: string;
}
type Lockfile = Record<string, LockEntry>;

/** Undefined when there is no lockfile at all, which is the only case we let slide. */
let lock: Lockfile | undefined;

interface Source {
  /** Path relative to assets/, which is also the lockfile key. */
  relPath: string;
  data: Buffer;
  digest: string;
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

async function bytesOf(paths: readonly string[]): Promise<number> {
  let total = 0;
  for (const path of paths) total += (await stat(path)).size;
  return total;
}

/**
 * Read a source asset and verify it against the lockfile. CC0-or-public-domain is a hard
 * constraint (CLAUDE.md), and a file that is not in the lock is a file that is not in
 * CREDITS.md — so it must not be baked into a shipped texture.
 */
async function loadSource(relPath: string): Promise<Source> {
  const data = await readFile(join(ASSETS, relPath));
  const digest = createHash('sha256').update(data).digest('hex');

  if (lock !== undefined) {
    const known = lock[relPath];
    if (known === undefined) {
      throw new Error(
        `${relPath} is not listed in assets.lock.json, so it is not a credited asset. ` +
          'Run npm run assets.',
      );
    }
    if (known.sha256 !== digest) {
      throw new Error(
        `${relPath} does not match assets.lock.json.\n` +
          `  expected ${known.sha256}\n  actual   ${digest}\n` +
          '  Run npm run assets to restore it.',
      );
    }
  }
  return { relPath, data, digest };
}

/** One digest over the sources and the settings that shaped them. */
function recipeDigest(parts: readonly string[], sources: readonly Source[]): string {
  const hash = createHash('sha256').update(`recipe ${RECIPE}\n`);
  for (const part of parts) hash.update(`${part}\n`);
  for (const source of sources) hash.update(`${source.relPath} ${source.digest}\n`);
  return hash.digest('hex');
}

async function isCurrent(
  digest: string,
  previous: { digest: string } | undefined,
  outputs: readonly string[],
): Promise<boolean> {
  if (FORCE || previous === undefined || previous.digest !== digest) return false;
  for (const path of outputs) {
    if (!(await exists(path))) return false;
  }
  return true;
}

/* -------------------------------------------------------------------- manifest */

type OutputMap = 'albedo' | 'normal' | 'orm' | 'height';

interface MaterialRecord {
  id: string;
  role: string;
  /** Edge length of every output map. Always a power of two, always square. */
  size: number;
  /** Source dimensions before the square resize. 2:1 sources exist — see `stretched`. */
  sourceWidth: number;
  sourceHeight: number;
  /** True when a source was not already `size` x `size` and had to be stretched to fit. */
  stretched: boolean;
  /** Only the maps that were actually produced. The runtime keys off this, not off 404s. */
  maps: Partial<Record<OutputMap, string>>;
  /** Whether the ORM's R and B channels carry real data or the flat dielectric defaults. */
  occlusion: 'measured' | 'default';
  metalness: 'measured' | 'default';
  digest: string;
  bytes: number;
}

interface MoonRecord {
  albedo: string;
  normal: string;
  width: number;
  height: number;
  /** Multiple of true lunar relief baked into the normal map. */
  reliefExaggeration: number;
  digest: string;
  bytes: number;
}

interface StarRecord {
  file: string;
  count: number;
  magnitudeLimit: number;
  /** V magnitude of the brightest and faintest star kept. */
  brightest: number;
  faintest: number;
  /** Stars with no published B-V, given the solar value instead. */
  colourDefaulted: number;
  digest: string;
  bytes: number;
}

/**
 * There is deliberately no timestamp in here: the manifest carries the digests that make the
 * next run a no-op, and a date would make every run rewrite the file it just compared against.
 */
interface ProcessedManifest {
  version: number;
  recipe: number;
  materials: MaterialRecord[];
  moon: MoonRecord;
  stars: StarRecord;
  totalBytes: number;
}

/* -------------------------------------------------------------------- materials */

type MapName = (typeof WANTED_MAPS)[number];

/** Nearest power of two in log space, clamped to sizes a GPU will actually take. */
function nearestPowerOfTwo(value: number): number {
  const exponent = Math.round(Math.log2(Math.max(1, value)));
  return 2 ** Math.min(12, Math.max(4, exponent));
}

/**
 * ambientCG names files `<id>_<resolution>-JPG_<Map>.jpg`, and an `npm run assets -- --hq`
 * over an existing web-profile fetch leaves both a 1K and a 2K set in the folder, so match on
 * the map suffix and keep the highest resolution found.
 */
async function findSourceMaps(id: string): Promise<Map<MapName, string>> {
  const relDir = `textures/${id}`;
  const best = new Map<MapName, { relPath: string; resolution: number }>();

  for (const file of await readdir(join(ASSETS, relDir))) {
    for (const map of WANTED_MAPS) {
      if (!/\.(jpg|png)$/i.test(file) || !file.includes(`_${map}.`)) continue;
      const resolution = Number(/_(\d+)K-/.exec(file)?.[1] ?? '0');
      const current = best.get(map);
      if (current === undefined || resolution > current.resolution) {
        best.set(map, { relPath: `${relDir}/${file}`, resolution });
      }
    }
  }
  return new Map([...best].map(([map, { relPath }]) => [map, relPath]));
}

/** One 8-bit channel of a map, squared off to the material's power-of-two size. */
async function channelOf(source: Source, size: number): Promise<Buffer> {
  return sharp(source.data).resize(size, size, FILL).extractChannel(0).raw().toBuffer();
}

async function processMaterial(
  entry: TextureEntry,
  previous: ProcessedManifest | undefined,
): Promise<MaterialRecord> {
  const found = await findSourceMaps(entry.id);
  const sources = new Map<MapName, Source>();
  for (const map of WANTED_MAPS) {
    const relPath = found.get(map);
    if (relPath !== undefined) sources.set(map, await loadSource(relPath));
  }

  const colour = sources.get('Color');
  const normal = sources.get('NormalGL');
  const roughness = sources.get('Roughness');
  if (colour === undefined || normal === undefined || roughness === undefined) {
    throw new Error(
      `needs at least Color, NormalGL and Roughness; found ${[...sources.keys()].join(', ') || 'nothing'}`,
    );
  }
  const occlusion = sources.get('AmbientOcclusion');
  const metalness = sources.get('Metalness');
  const displacement = sources.get('Displacement');

  // Measure the geometry rather than trusting the 1024x1024 the archives usually contain:
  // Rope001 and WoodFloor043 arrive 1024x512. They are squared off here and the source
  // dimensions go into the manifest, because a 2:1 source stretched to 1:1 has to be undone
  // by the material's UV repeat or the rope lays visibly too fat.
  const base = await sharp(colour.data).metadata();
  const size = nearestPowerOfTwo(Math.max(base.width, base.height));
  let stretched = false;
  for (const source of sources.values()) {
    const meta = await sharp(source.data).metadata();
    if (meta.width !== size || meta.height !== size) stretched = true;
  }

  const relDir = `textures/${entry.id}`;
  const dir = join(PROCESSED, relDir);
  const produced: readonly OutputMap[] =
    displacement === undefined
      ? ['albedo', 'normal', 'orm']
      : ['albedo', 'normal', 'orm', 'height'];
  const maps: Partial<Record<OutputMap, string>> = {};
  for (const name of produced) maps[name] = `${relDir}/${name}.webp`;
  const outputs = produced.map((name) => join(dir, `${name}.webp`));

  const digest = recipeDigest(
    [
      `role ${entry.role}`,
      `size ${size}`,
      `quality ${ALBEDO_QUALITY} ${NORMAL_QUALITY} ${ORM_QUALITY} ${HEIGHT_QUALITY}`,
    ],
    [...sources.values()],
  );
  const record: MaterialRecord = {
    id: entry.id,
    role: entry.role,
    size,
    sourceWidth: base.width,
    sourceHeight: base.height,
    stretched,
    maps,
    occlusion: occlusion === undefined ? 'default' : 'measured',
    metalness: metalness === undefined ? 'default' : 'measured',
    digest,
    bytes: 0,
  };

  if (await isCurrent(digest, previous?.materials.find((m) => m.id === entry.id), outputs)) {
    unchanged += 1;
    record.bytes = await bytesOf(outputs);
    process.stdout.write(`  mat   ${entry.id} (unchanged)\n`);
    return record;
  }

  await mkdir(dir, { recursive: true });

  // Occlusion defaults to fully unoccluded, metalness to dielectric — most of this set is
  // wood, rope, canvas, sand and rock, and a stray 1 in the metalness channel turns a plank
  // into a mirror. Six of the eleven sets do ship a metalness map, and those are used.
  const [occlusionChannel, roughnessChannel, metalnessChannel] = await Promise.all([
    occlusion === undefined ? Buffer.alloc(size * size, 255) : channelOf(occlusion, size),
    channelOf(roughness, size),
    metalness === undefined ? Buffer.alloc(size * size, 0) : channelOf(metalness, size),
  ]);
  const grey = { raw: { width: size, height: size, channels: 1 } } as const;

  await Promise.all([
    sharp(colour.data)
      .resize(size, size, FILL)
      .webp({ quality: ALBEDO_QUALITY })
      .toFile(join(dir, 'albedo.webp')),
    sharp(normal.data)
      .resize(size, size, FILL)
      .webp({ quality: NORMAL_QUALITY })
      .toFile(join(dir, 'normal.webp')),
    // Occlusion R, roughness G, metalness B. That order is not arbitrary: lossy WebP is always
    // YUV 4:2:0, and green carries ~59% of luma, so roughness — the map whose detail is most
    // visible — gets the full-resolution plane while occlusion and metalness ride the
    // half-resolution chroma. The cost lands on hard-edged masks (Metal063's rust boundary
    // moves by up to ~200/255 on single pixels); on the smooth maps it is invisible.
    sharp(occlusionChannel, grey)
      .joinChannel(roughnessChannel, grey)
      .joinChannel(metalnessChannel, grey)
      .webp({ quality: ORM_QUALITY })
      .toFile(join(dir, 'orm.webp')),
    ...(displacement === undefined
      ? []
      : [
          sharp(displacement.data)
            .resize(size, size, FILL)
            // libwebp has no greyscale mode, so this lands as RGB with three equal channels.
            // It costs almost nothing — the encoder finds no chroma to spend bits on.
            .toColourspace('b-w')
            .webp({ quality: HEIGHT_QUALITY })
            .toFile(join(dir, 'height.webp')),
        ]),
  ]);

  rebuilt += 1;
  record.bytes = await bytesOf(outputs);
  const from = stretched ? ` from ${base.width}x${base.height}` : '';
  process.stdout.write(
    `  mat   ${entry.id} (${size} px${from}, ${produced.join(' ')}, ${human(record.bytes)})\n`,
  );
  return record;
}

/* ------------------------------------------------------------------- the Moon */

/** Pack one component of a unit normal into a byte. */
function encodeNormal(component: number): number {
  return Math.min(255, Math.max(0, Math.round((component * 0.5 + 0.5) * 255)));
}

/**
 * Tangent-space normal map from the LOLA elevation model, OpenGL convention (+Y up), which is
 * what three.js expects and what every ambientCG `_NormalGL` above already uses.
 */
async function moonNormalFromElevation(elevation: Source, outPath: string): Promise<void> {
  const { data, info } = await sharp(elevation.data)
    .toColourspace('grey16')
    .raw({ depth: 'ushort' })
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) {
    throw new Error(`expected a single-channel elevation model, got ${info.channels} channels`);
  }
  const width = info.width;
  const height = info.height;
  // Copy into a fresh, 2-byte-aligned buffer: sharp's output comes from a pool and a raw
  // Uint16Array view over it is not guaranteed to be alignable.
  const heights = new Uint16Array(new Uint8Array(data).buffer);

  const sample = (x: number, y: number): number => {
    const column = ((x % width) + width) % width;
    const row = Math.min(height - 1, Math.max(0, y));
    // Wrapped in longitude and clamped in latitude, so this index cannot miss — the fallback
    // is what `noUncheckedIndexedAccess` costs, not a real branch.
    return heights[row * width + column] ?? 0;
  };

  const normals = Buffer.alloc(width * height * 3);
  const metresPerRow = (Math.PI * MOON_RADIUS_M) / height;
  const cosFloor = Math.cos(MOON_POLE_CLAMP_LAT_DEG * DEG_TO_RAD);
  // Sobel sums eight times the central difference, so /8 turns the kernel into counts/pixel.
  const countsToMetres = (LOLA_METRES_PER_COUNT * MOON_RELIEF_EXAGGERATION) / 8;

  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - ((y + 0.5) * Math.PI) / height;
    const metresPerColumn =
      (Math.max(Math.abs(Math.cos(latitude)), cosFloor) * 2 * Math.PI * MOON_RADIUS_M) / width;

    for (let x = 0; x < width; x += 1) {
      const left = sample(x - 1, y - 1) + 2 * sample(x - 1, y) + sample(x - 1, y + 1);
      const right = sample(x + 1, y - 1) + 2 * sample(x + 1, y) + sample(x + 1, y + 1);
      const top = sample(x - 1, y - 1) + 2 * sample(x, y - 1) + sample(x + 1, y - 1);
      const bottom = sample(x - 1, y + 1) + 2 * sample(x, y + 1) + sample(x + 1, y + 1);
      const slopeX = ((right - left) * countsToMetres) / metresPerColumn;
      const slopeDown = ((bottom - top) * countsToMetres) / metresPerRow;

      // n = normalize(-dh/du, -dh/dv, 1). Image rows run downwards while v runs upwards, so
      // dh/dv = -slopeDown and the green channel keeps the sign it was measured with.
      const inverseLength = 1 / Math.hypot(slopeX, slopeDown, 1);
      const offset = (y * width + x) * 3;
      normals[offset] = encodeNormal(-slopeX * inverseLength);
      normals[offset + 1] = encodeNormal(slopeDown * inverseLength);
      normals[offset + 2] = encodeNormal(inverseLength);
    }
  }

  // Derived at the model's native 4 pixels/degree and upsampled afterwards: differencing an
  // already-interpolated height field would give stair-stepped gradients.
  await sharp(normals, { raw: { width, height, channels: 3 } })
    .resize(MOON_MAP_WIDTH, MOON_MAP_HEIGHT, FILL)
    .webp({ quality: NORMAL_QUALITY })
    .toFile(outPath);
}

async function processMoon(previous: ProcessedManifest | undefined): Promise<MoonRecord> {
  const colour = await loadSource('moon/lroc_color_poles_2k.tif');
  const elevation = await loadSource('moon/ldem_4_uint.tif');

  const record: MoonRecord = {
    albedo: 'moon/albedo.webp',
    normal: 'moon/normal.webp',
    width: MOON_MAP_WIDTH,
    height: MOON_MAP_HEIGHT,
    reliefExaggeration: MOON_RELIEF_EXAGGERATION,
    digest: recipeDigest(
      [
        `size ${MOON_MAP_WIDTH}x${MOON_MAP_HEIGHT}`,
        `relief ${MOON_RELIEF_EXAGGERATION} clamp ${MOON_POLE_CLAMP_LAT_DEG} scale ${LOLA_METRES_PER_COUNT}`,
        `quality ${MOON_ALBEDO_QUALITY} ${NORMAL_QUALITY}`,
      ],
      [colour, elevation],
    ),
    bytes: 0,
  };
  const outputs = [join(PROCESSED, record.albedo), join(PROCESSED, record.normal)];

  if (await isCurrent(record.digest, previous?.moon, outputs)) {
    unchanged += 1;
    record.bytes = await bytesOf(outputs);
    process.stdout.write('  moon  albedo + normal (unchanged)\n');
    return record;
  }

  await mkdir(join(PROCESSED, 'moon'), { recursive: true });
  await Promise.all([
    sharp(colour.data)
      .resize(MOON_MAP_WIDTH, MOON_MAP_HEIGHT, FILL)
      .webp({ quality: MOON_ALBEDO_QUALITY })
      .toFile(join(PROCESSED, 'moon', 'albedo.webp')),
    moonNormalFromElevation(elevation, join(PROCESSED, 'moon', 'normal.webp')),
  ]);

  rebuilt += 1;
  record.bytes = await bytesOf(outputs);
  process.stdout.write(
    `  moon  albedo + normal (${MOON_MAP_WIDTH}x${MOON_MAP_HEIGHT}, ` +
      `relief x${MOON_RELIEF_EXAGGERATION}, ${human(record.bytes)})\n`,
  );
  return record;
}

/* ------------------------------------------------------------------ star catalogue */

interface Star {
  rightAscension: number;
  declination: number;
  magnitude: number;
  colourIndex: number;
}

/** A fixed-width field. Columns are 1-indexed and inclusive, as the ADC ReadMe gives them. */
function field(line: string, from: number, to: number): string {
  return line.slice(from - 1, to).trim();
}

/**
 * Parse the Yale Bright Star Catalogue, 5th ed. (ADC V/50).
 *
 * Records with blank coordinates or a blank magnitude are catalogue placeholders — novae and
 * objects since reclassified as non-stellar — and are dropped rather than fixed up.
 */
function parseCatalogue(text: string): { stars: Star[]; colourDefaulted: number } {
  const stars: Star[] = [];
  let colourDefaulted = 0;

  for (const line of text.split('\n')) {
    if (line.length === 0) continue;

    const raHours = field(line, 76, 77);
    const raMinutes = field(line, 78, 79);
    const raSeconds = field(line, 80, 83);
    const decSign = field(line, 84, 84);
    const decDegrees = field(line, 85, 86);
    const decArcminutes = field(line, 87, 88);
    const decArcseconds = field(line, 89, 90);
    const visualMagnitude = field(line, 103, 107);
    const colour = field(line, 110, 114);

    if (raHours === '' || decDegrees === '' || (decSign !== '+' && decSign !== '-')) continue;
    if (visualMagnitude === '') continue;
    const magnitude = Number(visualMagnitude);
    if (!Number.isFinite(magnitude) || magnitude > STAR_MAGNITUDE_LIMIT) continue;

    const rightAscension =
      (Number(raHours) + Number(raMinutes) / 60 + Number(raSeconds) / 3600) * HOURS_TO_RAD;
    const declination =
      (decSign === '-' ? -1 : 1) *
      (Number(decDegrees) + Number(decArcminutes) / 60 + Number(decArcseconds) / 3600) *
      DEG_TO_RAD;
    if (!Number.isFinite(rightAscension) || !Number.isFinite(declination)) continue;

    const colourIndex = Number(colour);
    const hasColour = colour !== '' && Number.isFinite(colourIndex);
    if (!hasColour) colourDefaulted += 1;

    stars.push({
      rightAscension,
      declination,
      magnitude,
      colourIndex: hasColour ? colourIndex : DEFAULT_COLOUR_INDEX,
    });
  }

  // Brightest first, so a low quality preset can draw the first N records and get exactly the
  // N brightest stars. Sorting at load time would cost a full pass over the buffer.
  stars.sort((a, b) => a.magnitude - b.magnitude);
  return { stars, colourDefaulted };
}

/**
 * `stars/bsc5.bin` — the catalogue as the renderer wants it. Little-endian throughout.
 *
 *   offset  type       field
 *   0       uint32     magic, 0x42534335
 *   4       uint32     format version, currently 1
 *   8       uint32     star count N
 *   12      uint32     reserved, zero
 *   16      N x 12     star records, sorted by magnitude, brightest first:
 *             +0      float32  right ascension, radians, J2000
 *             +4      float32  declination, radians, J2000
 *             +8      int16    V magnitude x 100 (Sirius is -146)
 *             +10     int16    B-V colour index x 100 — signed, about -40 to +250
 */
function packCatalogue(stars: readonly Star[]): Buffer {
  const buffer = Buffer.alloc(BSC5_HEADER_BYTES + stars.length * BSC5_STAR_BYTES);
  buffer.writeUInt32LE(BSC5_MAGIC, 0);
  buffer.writeUInt32LE(BSC5_VERSION, 4);
  buffer.writeUInt32LE(stars.length, 8);
  buffer.writeUInt32LE(0, 12);

  let offset = BSC5_HEADER_BYTES;
  for (const star of stars) {
    buffer.writeFloatLE(star.rightAscension, offset);
    buffer.writeFloatLE(star.declination, offset + 4);
    buffer.writeInt16LE(Math.round(star.magnitude * 100), offset + 8);
    buffer.writeInt16LE(Math.round(star.colourIndex * 100), offset + 10);
    offset += BSC5_STAR_BYTES;
  }
  return buffer;
}

async function processStars(previous: ProcessedManifest | undefined): Promise<StarRecord> {
  const source = await loadSource('stars/bsc5.dat');
  // Latin-1, not UTF-8: the catalogue is fixed-width ASCII and a multi-byte decode would shift
  // every column after the first non-ASCII byte.
  const { stars, colourDefaulted } = parseCatalogue(source.data.toString('latin1'));

  if (stars.length < STAR_COUNT_MIN || stars.length > STAR_COUNT_MAX) {
    throw new Error(
      `kept ${stars.length} stars, expected ${STAR_COUNT_MIN}-${STAR_COUNT_MAX}. ` +
        'The column offsets are wrong — this would produce a plausible-looking but wrong sky.',
    );
  }
  const brightest = stars[0];
  const faintest = stars[stars.length - 1];
  if (brightest === undefined || faintest === undefined) throw new Error('no stars survived');

  const record: StarRecord = {
    file: 'stars/bsc5.bin',
    count: stars.length,
    magnitudeLimit: STAR_MAGNITUDE_LIMIT,
    brightest: brightest.magnitude,
    faintest: faintest.magnitude,
    colourDefaulted,
    digest: recipeDigest(
      [`limit ${STAR_MAGNITUDE_LIMIT}`, `default b-v ${DEFAULT_COLOUR_INDEX}`, `format ${BSC5_VERSION}`],
      [source],
    ),
    bytes: 0,
  };
  const output = join(PROCESSED, record.file);

  if (await isCurrent(record.digest, previous?.stars, [output])) {
    unchanged += 1;
    record.bytes = await bytesOf([output]);
    process.stdout.write(`  stars ${stars.length} stars (unchanged)\n`);
    return record;
  }

  await mkdir(join(PROCESSED, 'stars'), { recursive: true });
  const packed = packCatalogue(stars);
  await writeFile(output, packed);

  rebuilt += 1;
  record.bytes = packed.length;
  process.stdout.write(
    `  stars ${stars.length} stars to V ${STAR_MAGNITUDE_LIMIT} ` +
      `(${brightest.magnitude} .. ${faintest.magnitude}, ${human(packed.length)})\n`,
  );
  return record;
}

/* ------------------------------------------------------------------------ main */

async function main(): Promise<void> {
  process.stdout.write('Processing assets into assets/processed\n');
  await mkdir(PROCESSED, { recursive: true });

  if (await exists(LOCK_PATH)) {
    lock = JSON.parse(await readFile(LOCK_PATH, 'utf8')) as Lockfile;
  } else {
    process.stdout.write('  note  no assets.lock.json — sources cannot be licence-checked\n');
  }

  let previous: ProcessedManifest | undefined;
  if (await exists(MANIFEST_PATH)) {
    previous = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as ProcessedManifest;
    // A manifest from another recipe, or one somebody has been editing, is not a cache.
    if (previous.recipe !== RECIPE || !Array.isArray(previous.materials)) previous = undefined;
  }

  // Materials run one at a time so the log reads in manifest order; the four encodes inside
  // each one already saturate sharp's thread pool.
  const materials: MaterialRecord[] = [];
  for (const entry of TEXTURES) {
    try {
      materials.push(await processMaterial(entry, previous));
    } catch (error) {
      failures.push(`material ${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let moon: MoonRecord | undefined;
  try {
    moon = await processMoon(previous);
  } catch (error) {
    failures.push(`moon: ${error instanceof Error ? error.message : String(error)}`);
  }

  let stars: StarRecord | undefined;
  try {
    stars = await processStars(previous);
  } catch (error) {
    failures.push(`stars: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (failures.length > 0 || moon === undefined || stars === undefined) {
    process.stderr.write(`\n${failures.length} item(s) failed:\n`);
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
    process.exitCode = 1;
    return;
  }

  const totalBytes =
    materials.reduce((sum, material) => sum + material.bytes, 0) + moon.bytes + stars.bytes;
  const manifest: ProcessedManifest = {
    version: 1,
    recipe: RECIPE,
    materials,
    moon,
    stars,
    totalBytes,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `\nDone. ${materials.length} materials, the Moon and ${stars.count} stars — ` +
      `${human(totalBytes)} in assets/processed (${rebuilt} rebuilt, ${unchanged} unchanged).\n` +
      `${stars.colourDefaulted} stars had no published B-V and were given the solar ` +
      `${DEFAULT_COLOUR_INDEX}.\nNext: npm run dev\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `\nAsset processing failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
