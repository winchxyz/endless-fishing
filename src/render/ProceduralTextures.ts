import {
  DataTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from 'three';

/**
 * Textures generated in code rather than downloaded.
 *
 * These five are procedural because a photograph could not do the job, not because a licence
 * was unavailable (see DECISIONS.md §9):
 *
 *   * **Ocean detail normals** must tile *exactly* at two different, mutually incommensurate
 *     periods, and be built from a filtered noise spectrum rather than whatever was in front
 *     of the camera. A tiling artefact on open water is visible from a kilometre away.
 *   * **Foam** has to break up at a controllable scale so the same texture reads correctly on
 *     a Beaufort 2 ripple and a Beaufort 9 breaking crest.
 *   * **Caustics** must be animated by the same wave field that drives the surface.
 *   * **Fish scales** are twelve materials from one generator, parameterised per species.
 *   * **Lens droplets** need a controlled size distribution and no baked lighting.
 *
 * All of them use periodic value noise: the hash wraps its integer lattice coordinates at the
 * period, which makes the result seamless by construction rather than by cross-fading the
 * edges, which softens exactly the high frequencies the detail normals exist to provide.
 */

/** Integer hash — wraps at `period` so the resulting lattice is genuinely periodic. */
function hash2(ix: number, iy: number, period: number, seed: number): number {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Periodic value noise in [0, 1], tiling exactly at `period` lattice cells. */
function periodicNoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smootherstep(x - ix);
  const fy = smootherstep(y - iy);

  const a = hash2(ix, iy, period, seed);
  const b = hash2(ix + 1, iy, period, seed);
  const c = hash2(ix, iy + 1, period, seed);
  const d = hash2(ix + 1, iy + 1, period, seed);

  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** Periodic fBm in [0, 1]. */
function periodicFbm(
  x: number,
  y: number,
  basePeriod: number,
  octaves: number,
  seed: number,
  gain = 0.5,
): number {
  let sum = 0;
  let norm = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * periodicNoise(x * frequency, y * frequency, basePeriod * frequency, seed + i * 97);
    norm += amplitude;
    amplitude *= gain;
    frequency *= 2;
  }
  return norm === 0 ? 0 : sum / norm;
}

/**
 * Capillary-ripple normal map.
 *
 * The height field is a ridged fBm rather than plain fBm: real capillary waves have sharp
 * crests and broad troughs, and plain fBm's symmetric bumps read as a plastic-wrap surface
 * under a low sun. Two independent height fields go into RG and BA, so one texture provides
 * both detail scales in a single fetch.
 *
 * The strength is deliberately restrained. Detail normals are the classic place where an ocean
 * tips from "water" into "hammered metal"; the wave geometry should carry the shape and this
 * should only break up the specular.
 */
export function createOceanDetailNormal(size = 512, seed = 1337): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const periodA = 8;
  const periodB = 13; // Coprime with 8, so the two layers never line up.
  const strengthA = 2.2;
  const strengthB = 1.4;

  const heightA = new Float32Array(size * size);
  const heightB = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * periodA;
      const v = (y / size) * periodA;
      const ridged = 1 - Math.abs(periodicFbm(u, v, periodA, 4, seed) * 2 - 1);
      heightA[y * size + x] = ridged * ridged;

      const u2 = (x / size) * periodB;
      const v2 = (y / size) * periodB;
      const ridged2 = 1 - Math.abs(periodicFbm(u2, v2, periodB, 3, seed + 811) * 2 - 1);
      heightB[y * size + x] = ridged2 * ridged2;
    }
  }

  const sample = (field: Float32Array, x: number, y: number): number =>
    field[(((y % size) + size) % size) * size + (((x % size) + size) % size)] ?? 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Central differences on the wrapped field keep the derivative seamless too.
      const dxA = sample(heightA, x + 1, y) - sample(heightA, x - 1, y);
      const dyA = sample(heightA, x, y + 1) - sample(heightA, x, y - 1);
      const dxB = sample(heightB, x + 1, y) - sample(heightB, x - 1, y);
      const dyB = sample(heightB, x, y + 1) - sample(heightB, x, y - 1);

      const index = (y * size + x) * 4;
      // Only the XY of each normal is stored; Z is reconstructed in the shader, which is both
      // cheaper and more accurate than quantising it to 8 bits.
      data[index] = Math.round((Math.max(-1, Math.min(1, -dxA * strengthA)) * 0.5 + 0.5) * 255);
      data[index + 1] = Math.round((Math.max(-1, Math.min(1, -dyA * strengthA)) * 0.5 + 0.5) * 255);
      data[index + 2] = Math.round((Math.max(-1, Math.min(1, -dxB * strengthB)) * 0.5 + 0.5) * 255);
      data[index + 3] = Math.round((Math.max(-1, Math.min(1, -dyB * strengthB)) * 0.5 + 0.5) * 255);
    }
  }

  return finishTexture(new DataTexture(data, size, size, RGBAFormat, UnsignedByteType));
}

/**
 * Foam coverage and breakup.
 *
 * R holds a cellular-ish coverage mask driven by inverted fBm — foam is bubbles, so the useful
 * structure is the *gaps*. G holds a much finer field used to erode the edges as foam decays,
 * so a dissipating wake thins out from its boundary rather than fading uniformly, which is
 * what makes it look like it is being absorbed by the water rather than turned transparent.
 * B holds a slow, large-scale variation so adjacent crests do not foam identically.
 */
export function createFoamTexture(size = 512, seed = 4242): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const period = 6;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * period;
      const v = (y / size) * period;

      const clumps = periodicFbm(u * 2, v * 2, period * 2, 5, seed, 0.55);
      const coverage = Math.pow(Math.max(0, 1 - Math.abs(clumps * 2 - 1)), 1.6);
      const fine = periodicFbm(u * 7, v * 7, period * 7, 3, seed + 313);
      const broad = periodicFbm(u * 0.6, v * 0.6, Math.max(1, Math.round(period * 0.6)), 2, seed + 77);

      const index = (y * size + x) * 4;
      data[index] = Math.round(Math.min(1, coverage) * 255);
      data[index + 1] = Math.round(fine * 255);
      data[index + 2] = Math.round(broad * 255);
      data[index + 3] = 255;
    }
  }

  return finishTexture(new DataTexture(data, size, size, RGBAFormat, UnsignedByteType));
}

/**
 * Caustic light pattern for the seabed.
 *
 * Built from the *gradient* of a smooth height field rather than from the field itself: real
 * caustics are the places where refracted rays converge, which is where the surface curvature
 * focuses them, so a curvature-derived pattern has the right sharp filaments and dark voids.
 * Two channels at different phases let the shader cross-fade between them for animation.
 */
export function createCausticsTexture(size = 256, seed = 9091): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const period = 5;

  const caustic = (x: number, y: number, phaseSeed: number): number => {
    const u = (x / size) * period;
    const v = (y / size) * period;
    const h = periodicFbm(u, v, period, 3, phaseSeed, 0.6);
    const hx = periodicFbm(u + 0.04, v, period, 3, phaseSeed, 0.6) - h;
    const hy = periodicFbm(u, v + 0.04, period, 3, phaseSeed, 0.6) - h;
    const focus = 1 - Math.min(1, Math.hypot(hx, hy) * 26);
    return Math.pow(Math.max(0, focus), 4);
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      data[index] = Math.round(caustic(x, y, seed) * 255);
      data[index + 1] = Math.round(caustic(x, y, seed + 1201) * 255);
      data[index + 2] = Math.round(caustic(x, y, seed + 2402) * 255);
      data[index + 3] = 255;
    }
  }

  return finishTexture(new DataTexture(data, size, size, RGBAFormat, UnsignedByteType));
}

/**
 * Fish scale pattern, parameterised per species.
 *
 * `scaleDensity` sets how many scales fit across the texture, `iridescence` how strongly the
 * scales vary in hue. R is the scale height field for the normal, G an ambient-occlusion-like
 * crevice mask, B the iridescence variation, A a per-scale random value the shader uses to
 * break up specular highlights.
 */
export function createScaleTexture(
  size = 256,
  scaleDensity = 24,
  iridescence = 0.5,
  seed = 5150,
): DataTexture {
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Offset every other row by half a scale: fish scales are laid in overlapping courses,
      // like roof tiles, and a square grid immediately reads as fabric instead.
      const gy = (y / size) * scaleDensity;
      const row = Math.floor(gy);
      const gx = (x / size) * scaleDensity + (row % 2 === 0 ? 0 : 0.5);
      const cellX = Math.floor(gx);
      const fx = gx - cellX;
      const fy = gy - row;

      // Distance to the scale's rounded lower edge, which is what catches the light.
      const dx = (fx - 0.5) * 2;
      const dy = (fy - 0.5) * 2;
      const radial = Math.sqrt(dx * dx + dy * dy * 0.55);
      const height = Math.max(0, 1 - radial);
      const crevice = Math.pow(Math.min(1, radial), 2.5);

      const jitter = hash2(cellX, row, 9973, seed);
      const hue = 0.5 + (jitter - 0.5) * iridescence;

      const index = (y * size + x) * 4;
      data[index] = Math.round(Math.pow(height, 0.7) * 255);
      data[index + 1] = Math.round((1 - crevice * 0.85) * 255);
      data[index + 2] = Math.round(Math.max(0, Math.min(1, hue)) * 255);
      data[index + 3] = Math.round(jitter * 255);
    }
  }

  return finishTexture(new DataTexture(data, size, size, RGBAFormat, UnsignedByteType));
}

function finishTexture(texture: DataTexture): DataTexture {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
