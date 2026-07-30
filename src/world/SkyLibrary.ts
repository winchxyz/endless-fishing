import { DataUtils, type DataTexture, type Texture } from 'three';
import type { ResourceManager } from '../core/ResourceManager.js';
import { astroTime, RAD_TO_DEG } from '../astro/AstroTime.js';
import { solarPosition } from '../astro/SolarPosition.js';

/**
 * The HDRI sky library.
 *
 * Eighteen CC0 sky-only panoramas indexed by (weather family, sun altitude). Given the real
 * solar altitude right now, it picks the two nearest entries in the right weather family,
 * hands back a cross-fade weight, and — the part that matters — hands back the rotation that
 * puts each panorama's baked sun on the real solar azimuth.
 *
 * That baked azimuth is **not** eyeballed metadata. `fetch-assets.ts` records where and when
 * each panorama was photographed, straight from the Poly Haven API, and this class runs those
 * coordinates through the same NOAA solver that drives the live sun. The baked sun's position
 * is therefore known to the same 0.01° as everything else in the sky, which is what allows the
 * panorama's bright spot and the analytically drawn solar disc to sit exactly on top of one
 * another. A couple of degrees of mismatch there reads instantly as fake.
 *
 * Textures load lazily and only a handful stay resident: eighteen 2K float panoramas would be
 * around 190 MB of VRAM for no reason, when at any instant only two are on screen.
 */

export type SkyWeatherFamily = 'clear' | 'partly-cloudy' | 'overcast' | 'fog' | 'storm' | 'night';

interface SkyManifestEntry {
  slug: string;
  file: string;
  weather: string;
  note: string;
  latitudeDeg: number;
  longitudeDeg: number;
  capturedAtMs: number;
  timeOfDay: string;
  resolution: string;
}

interface SkyManifest {
  profile: string;
  textureResolution: string;
  skies: SkyManifestEntry[];
}

export interface SkyEntry {
  slug: string;
  file: string;
  weather: SkyWeatherFamily;
  note: string;
  /** Solar altitude at the moment the panorama was shot, degrees. Derived, not stated. */
  bakedSunAltitudeDeg: number;
  /** Solar azimuth at that moment, degrees from north eastward. Derived. */
  bakedSunAzimuthDeg: number;
}

export interface SkySelection {
  a: SkyEntry;
  b: SkyEntry;
  /** 0 = entirely `a`, 1 = entirely `b`. */
  blend: number;
}

/** A loaded panorama plus the statistics the shader needs to normalise it. */
interface LoadedSky {
  texture: DataTexture;
  /** Mean luminance over the upper hemisphere, solid-angle weighted. */
  meanLuminance: number;
  lastUsedFrame: number;
}

/** How many panoramas stay in VRAM. Two are in use; the spares absorb weather transitions. */
const RESIDENT_LIMIT = 5;

const FAMILIES: readonly SkyWeatherFamily[] = [
  'clear',
  'partly-cloudy',
  'overcast',
  'fog',
  'storm',
  'night',
];

/** Where to look when a family has no entry bracketing the current altitude. */
const FAMILY_FALLBACK: Record<SkyWeatherFamily, readonly SkyWeatherFamily[]> = {
  clear: ['partly-cloudy', 'overcast'],
  'partly-cloudy': ['clear', 'overcast'],
  overcast: ['storm', 'partly-cloudy'],
  fog: ['overcast', 'partly-cloudy'],
  storm: ['overcast', 'partly-cloudy'],
  night: ['clear', 'partly-cloudy'],
};

function isFamily(value: string): value is SkyWeatherFamily {
  return (FAMILIES as readonly string[]).includes(value);
}

export class SkyLibrary {
  private readonly entries: SkyEntry[] = [];
  private readonly byFamily = new Map<SkyWeatherFamily, SkyEntry[]>();
  private readonly loaded = new Map<string, LoadedSky>();
  private readonly pending = new Set<string>();
  private readonly resources: ResourceManager;
  private frame = 0;

  private constructor(resources: ResourceManager) {
    this.resources = resources;
  }

  static async load(resources: ResourceManager): Promise<SkyLibrary> {
    const library = new SkyLibrary(resources);
    const buffer = await resources.loadBinary('sky-library.json');
    const manifest = JSON.parse(new TextDecoder().decode(buffer)) as SkyManifest;

    for (const raw of manifest.skies) {
      const family = isFamily(raw.weather) ? raw.weather : 'partly-cloudy';
      // Derive the baked sun from where and when the shutter opened.
      const sun = solarPosition(astroTime(raw.capturedAtMs), {
        latitudeDeg: raw.latitudeDeg,
        longitudeDeg: raw.longitudeDeg,
        elevationM: 0,
      });
      library.entries.push({
        slug: raw.slug,
        file: raw.file,
        weather: family,
        note: raw.note,
        bakedSunAltitudeDeg: sun.horizontal.altitude * RAD_TO_DEG,
        bakedSunAzimuthDeg: sun.horizontal.azimuth * RAD_TO_DEG,
      });
    }

    for (const family of FAMILIES) {
      const list = library.entries
        .filter((entry) => entry.weather === family)
        .sort((a, b) => a.bakedSunAltitudeDeg - b.bakedSunAltitudeDeg);
      if (list.length > 0) library.byFamily.set(family, list);
    }

    if (library.entries.length === 0) {
      throw new Error('sky-library.json contained no usable skies — run `npm run assets`');
    }
    return library;
  }

  get all(): readonly SkyEntry[] {
    return this.entries;
  }

  /**
   * Pick the two panoramas bracketing the current solar altitude within a weather family.
   *
   * Below −6° solar altitude nothing in the daylight families is usable — a clear-noon sky
   * normalised and multiplied into a nautical-twilight atmosphere still carries daytime cloud
   * contrast — so the night family takes over regardless of the weather.
   */
  select(weather: SkyWeatherFamily, sunAltitudeDeg: number): SkySelection {
    const family = sunAltitudeDeg < -6 ? 'night' : weather;
    const candidates = this.candidatesFor(family);

    const first = candidates[0];
    const last = candidates[candidates.length - 1];
    if (first === undefined || last === undefined) {
      throw new Error(`No sky panoramas available for weather family "${family}"`);
    }
    if (sunAltitudeDeg <= first.bakedSunAltitudeDeg) return { a: first, b: first, blend: 0 };
    if (sunAltitudeDeg >= last.bakedSunAltitudeDeg) return { a: last, b: last, blend: 0 };

    for (let i = 0; i < candidates.length - 1; i += 1) {
      const a = candidates[i];
      const b = candidates[i + 1];
      if (a === undefined || b === undefined) break;
      if (sunAltitudeDeg >= a.bakedSunAltitudeDeg && sunAltitudeDeg <= b.bakedSunAltitudeDeg) {
        const span = b.bakedSunAltitudeDeg - a.bakedSunAltitudeDeg;
        const blend = span < 1e-4 ? 0 : (sunAltitudeDeg - a.bakedSunAltitudeDeg) / span;
        return { a, b, blend };
      }
    }
    return { a: last, b: last, blend: 0 };
  }

  /**
   * Rotation in radians to apply to the sampling direction so this panorama's baked sun sits
   * at the real solar azimuth. Positive rotation about +Y decreases azimuth, which is why this
   * is (real − baked) rather than its negation.
   */
  rotationFor(entry: SkyEntry, realSunAzimuthDeg: number): number {
    return ((realSunAzimuthDeg - entry.bakedSunAzimuthDeg) * Math.PI) / 180;
  }

  /** Texture if resident, otherwise undefined and a load is kicked off. */
  texture(entry: SkyEntry): Texture | undefined {
    const loaded = this.loaded.get(entry.slug);
    if (loaded !== undefined) {
      loaded.lastUsedFrame = this.frame;
      return loaded.texture;
    }
    void this.ensureLoaded(entry);
    return undefined;
  }

  /** Reciprocal mean luminance, or 1 while the panorama is still loading. */
  inverseMeanLuminance(entry: SkyEntry): number {
    const loaded = this.loaded.get(entry.slug);
    if (loaded === undefined) return 1;
    return 1 / Math.max(1e-4, loaded.meanLuminance);
  }

  async ensureLoaded(entry: SkyEntry): Promise<void> {
    if (this.loaded.has(entry.slug) || this.pending.has(entry.slug)) return;
    this.pending.add(entry.slug);
    try {
      const texture = await this.resources.loadHDRI(entry.file);
      this.loaded.set(entry.slug, {
        texture,
        meanLuminance: upperHemisphereMeanLuminance(texture),
        lastUsedFrame: this.frame,
      });
      this.evict();
    } finally {
      this.pending.delete(entry.slug);
    }
  }

  /** Advance the frame counter used by the eviction policy. */
  tick(): void {
    this.frame += 1;
  }

  dispose(): void {
    for (const loaded of this.loaded.values()) {
      this.resources.untrack(loaded.texture);
      loaded.texture.dispose();
    }
    this.loaded.clear();
  }

  private candidatesFor(family: SkyWeatherFamily): SkyEntry[] {
    const direct = this.byFamily.get(family);
    if (direct !== undefined && direct.length > 0) return direct;
    for (const fallback of FAMILY_FALLBACK[family]) {
      const list = this.byFamily.get(fallback);
      if (list !== undefined && list.length > 0) return list;
    }
    return this.entries;
  }

  private evict(): void {
    while (this.loaded.size > RESIDENT_LIMIT) {
      let oldestSlug: string | undefined;
      let oldestFrame = Number.POSITIVE_INFINITY;
      for (const [slug, loaded] of this.loaded) {
        if (loaded.lastUsedFrame < oldestFrame) {
          oldestFrame = loaded.lastUsedFrame;
          oldestSlug = slug;
        }
      }
      if (oldestSlug === undefined) return;
      const victim = this.loaded.get(oldestSlug);
      if (victim !== undefined) {
        this.resources.untrack(victim.texture);
        victim.texture.dispose();
      }
      this.loaded.delete(oldestSlug);
    }
  }
}

/**
 * Solid-angle-weighted mean luminance of the upper hemisphere.
 *
 * Weighted by sin(θ) because an equirectangular projection massively over-samples the poles:
 * an unweighted average of the pixels would be dominated by the zenith and would badly
 * misjudge a sky whose interest is all near the horizon. Sampled on a stride — a few thousand
 * texels is plenty for a mean, and this runs on the main thread during loading.
 */
function upperHemisphereMeanLuminance(texture: DataTexture): number {
  const image = texture.image as { data: ArrayBufferView; width: number; height: number };
  const { width, height } = image;
  const data = image.data;

  const isHalf = data instanceof Uint16Array;
  const readChannel: (index: number) => number = isHalf
    ? (index) => DataUtils.fromHalfFloat(data[index] ?? 0)
    : (index) => (data as unknown as Float32Array)[index] ?? 0;

  const stride = Math.max(1, Math.floor(Math.min(width, height) / 96));
  let weightedSum = 0;
  let weightTotal = 0;

  for (let y = 0; y < height / 2; y += stride) {
    // v runs from the zenith down; sin of the polar angle is the solid-angle weight.
    const theta = ((y + 0.5) / height) * Math.PI;
    const weight = Math.sin(theta);
    for (let x = 0; x < width; x += stride) {
      const base = (y * width + x) * 4;
      const r = readChannel(base);
      const g = readChannel(base + 1);
      const b = readChannel(base + 2);
      weightedSum += weight * (0.2126 * r + 0.7152 * g + 0.0722 * b);
      weightTotal += weight;
    }
  }

  return weightTotal === 0 ? 1 : weightedSum / weightTotal;
}
