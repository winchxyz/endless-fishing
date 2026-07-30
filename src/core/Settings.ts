/**
 * Central, reactive settings store.
 *
 * Every quality knob in the game lives here. Systems subscribe with `onChange` and rebuild
 * themselves; nothing reads a quality value from anywhere else. The preset table is the
 * literal encoding of the degradation priority in CLAUDE.md — read down a column and you are
 * reading the order in which we give things up.
 */

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

/** Knobs that actually change what the GPU does. */
export interface GraphicsSettings {
  preset: QualityPreset;
  /** Multiplier on devicePixelRatio for the main render target. */
  renderScale: number;
  /** Number of Gerstner waves evaluated. Never below 6 above the Low preset. */
  waveCount: number;
  /** Vertices along one edge of a clipmap ring block. */
  oceanGridResolution: number;
  /** Number of clipmap rings; each ring doubles the covered radius. */
  oceanRings: number;
  /** Raymarch steps through the cloud layer. First thing to be cut. */
  cloudSteps: number;
  /** Cloud buffer resolution as a fraction of the main target. */
  cloudScale: number;
  /** Refraction / screen-space reflection target scale. */
  refractionScale: number;
  shadowsEnabled: boolean;
  shadowCascades: number;
  shadowMapSize: number;
  ssaoEnabled: boolean;
  bloomEnabled: boolean;
  dofEnabled: boolean;
  godRaysEnabled: boolean;
  motionBlurEnabled: boolean;
  chromaticAberrationEnabled: boolean;
  grainEnabled: boolean;
  vignetteEnabled: boolean;
  antialias: 'none' | 'smaa';
  /** Metres. Islands and props beyond this are not streamed in. */
  drawDistance: number;
  /** Multiplier on instanced density: grass, birds, debris. */
  instanceDensity: number;
  /** Fish per school. */
  schoolSize: number;
  /** Faces of the environment cubemap refreshed per frame. */
  probeFacesPerFrame: number;
  probeResolution: number;
  anisotropy: number;
}

/** Knobs that change the simulation, not the pixels. */
export interface WorldSettings {
  /** 1 = real time. Test/screenshot only; always 1 by default. */
  timeScale: number;
  /** null = follow the system clock. A number is a UTC epoch ms override. */
  timeOverrideMs: number | null;
  latitudeDeg: number;
  longitudeDeg: number;
  /** Seed for the procedural world. Same seed, same ocean. */
  seed: number;
  /** null = let the synoptic model decide. A name pins the weather for testing. */
  weatherOverride: string | null;
}

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  muted: boolean;
}

export interface AllSettings {
  graphics: GraphicsSettings;
  world: WorldSettings;
  audio: AudioSettings;
}

const PRESETS: Record<QualityPreset, Omit<GraphicsSettings, 'anisotropy'>> = {
  low: {
    preset: 'low',
    renderScale: 0.75,
    waveCount: 5,
    oceanGridResolution: 96,
    oceanRings: 5,
    cloudSteps: 14,
    cloudScale: 0.4,
    refractionScale: 0.35,
    shadowsEnabled: false,
    shadowCascades: 1,
    shadowMapSize: 1024,
    ssaoEnabled: false,
    bloomEnabled: true,
    dofEnabled: false,
    godRaysEnabled: false,
    motionBlurEnabled: false,
    chromaticAberrationEnabled: false,
    grainEnabled: false,
    vignetteEnabled: true,
    antialias: 'none',
    drawDistance: 2200,
    instanceDensity: 0.3,
    schoolSize: 24,
    probeFacesPerFrame: 1,
    probeResolution: 64,
  },
  medium: {
    preset: 'medium',
    renderScale: 1.0,
    waveCount: 6,
    oceanGridResolution: 128,
    oceanRings: 6,
    cloudSteps: 24,
    cloudScale: 0.5,
    refractionScale: 0.5,
    shadowsEnabled: true,
    shadowCascades: 2,
    shadowMapSize: 1024,
    ssaoEnabled: false,
    bloomEnabled: true,
    dofEnabled: false,
    godRaysEnabled: true,
    motionBlurEnabled: false,
    chromaticAberrationEnabled: true,
    grainEnabled: true,
    vignetteEnabled: true,
    antialias: 'smaa',
    drawDistance: 3600,
    instanceDensity: 0.55,
    schoolSize: 40,
    probeFacesPerFrame: 1,
    probeResolution: 128,
  },
  high: {
    preset: 'high',
    renderScale: 1.0,
    waveCount: 7,
    oceanGridResolution: 160,
    oceanRings: 7,
    cloudSteps: 40,
    cloudScale: 0.6,
    refractionScale: 0.65,
    shadowsEnabled: true,
    shadowCascades: 3,
    shadowMapSize: 2048,
    ssaoEnabled: true,
    bloomEnabled: true,
    dofEnabled: true,
    godRaysEnabled: true,
    motionBlurEnabled: true,
    chromaticAberrationEnabled: true,
    grainEnabled: true,
    vignetteEnabled: true,
    antialias: 'smaa',
    drawDistance: 5200,
    instanceDensity: 0.8,
    schoolSize: 64,
    probeFacesPerFrame: 2,
    probeResolution: 128,
  },
  ultra: {
    preset: 'ultra',
    renderScale: 1.0,
    waveCount: 8,
    oceanGridResolution: 192,
    oceanRings: 8,
    cloudSteps: 64,
    cloudScale: 0.75,
    refractionScale: 0.85,
    shadowsEnabled: true,
    shadowCascades: 4,
    shadowMapSize: 2048,
    ssaoEnabled: true,
    bloomEnabled: true,
    dofEnabled: true,
    godRaysEnabled: true,
    motionBlurEnabled: true,
    chromaticAberrationEnabled: true,
    grainEnabled: true,
    vignetteEnabled: true,
    antialias: 'smaa',
    drawDistance: 7000,
    instanceDensity: 1.0,
    schoolSize: 96,
    probeFacesPerFrame: 3,
    probeResolution: 256,
  },
};

export type SettingsListener = (settings: AllSettings, changed: keyof AllSettings) => void;

const STORAGE_KEY = 'endless-fishing/settings/v1';

/** Fallback location if geolocation is denied and the timezone lookup misses. */
export const DEFAULT_LATITUDE_DEG = 32.08;
export const DEFAULT_LONGITUDE_DEG = 34.78;

export class Settings {
  readonly graphics: GraphicsSettings;
  readonly world: WorldSettings;
  readonly audio: AudioSettings;

  private readonly listeners = new Set<SettingsListener>();
  /** True once a stored or user-chosen position exists, so guesses stop overwriting it. */
  private locationExplicit = false;

  constructor(maxAnisotropy: number) {
    this.graphics = { ...PRESETS.high, anisotropy: maxAnisotropy };
    this.world = {
      timeScale: 1,
      timeOverrideMs: null,
      latitudeDeg: DEFAULT_LATITUDE_DEG,
      longitudeDeg: DEFAULT_LONGITUDE_DEG,
      seed: 0x5eed_f15e,
      weatherOverride: null,
    };
    this.audio = { masterVolume: 0.8, musicVolume: 0.35, muted: false };
    this.load();
  }

  /**
   * Seed the location from a guess (currently the timezone lookup) without overriding a
   * position the player has already chosen or that geolocation has already supplied.
   */
  setLocationIfUnset(latitudeDeg: number, longitudeDeg: number): void {
    if (this.locationExplicit) return;
    this.world.latitudeDeg = latitudeDeg;
    this.world.longitudeDeg = longitudeDeg;
  }

  /** Mark the location as chosen, so later guesses stop overwriting it. */
  setLocation(latitudeDeg: number, longitudeDeg: number): void {
    this.world.latitudeDeg = latitudeDeg;
    this.world.longitudeDeg = longitudeDeg;
    this.locationExplicit = true;
    this.emit('world');
  }

  /** Swap in a whole preset, preserving device-derived values like anisotropy. */
  applyPreset(preset: QualityPreset): void {
    Object.assign(this.graphics, PRESETS[preset]);
    this.emit('graphics');
  }

  /** Read-only view of a preset, for the debug panel to show what a preset would do. */
  static previewPreset(preset: QualityPreset): Readonly<Omit<GraphicsSettings, 'anisotropy'>> {
    return PRESETS[preset];
  }

  onChange(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Call after mutating a settings group directly. */
  emit(changed: keyof AllSettings): void {
    const snapshot: AllSettings = {
      graphics: this.graphics,
      world: this.world,
      audio: this.audio,
    };
    for (const listener of this.listeners) listener(snapshot, changed);
    if (changed !== 'world' || this.world.timeOverrideMs === null) this.save();
  }

  private save(): void {
    try {
      const payload = {
        graphics: this.graphics,
        audio: this.audio,
        world: {
          latitudeDeg: this.world.latitudeDeg,
          longitudeDeg: this.world.longitudeDeg,
          seed: this.world.seed,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Private-browsing or quota. Settings simply do not persist; not worth surfacing.
    }
  }

  private load(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (raw === null) return;
    try {
      const parsed = JSON.parse(raw) as Partial<AllSettings>;
      // Merge field-by-field so a settings version with new keys still loads old saves.
      if (parsed.graphics) {
        const anisotropy = this.graphics.anisotropy;
        Object.assign(this.graphics, parsed.graphics, { anisotropy });
      }
      if (parsed.audio) Object.assign(this.audio, parsed.audio);
      if (parsed.world) {
        const { latitudeDeg, longitudeDeg, seed } = parsed.world;
        if (typeof latitudeDeg === 'number' && typeof longitudeDeg === 'number') {
          this.world.latitudeDeg = latitudeDeg;
          this.world.longitudeDeg = longitudeDeg;
          this.locationExplicit = true;
        }
        if (typeof seed === 'number') this.world.seed = seed;
      }
    } catch {
      // Corrupt payload; defaults stand.
    }
  }
}
