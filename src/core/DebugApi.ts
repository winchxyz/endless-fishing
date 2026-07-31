import type { Engine } from './Engine.js';
import type { GraphicsSettings, QualityPreset } from './Settings.js';
import type { Boat } from '../entities/Boat.js';
import type { Ocean } from '../world/Ocean.js';
import type { Sky } from '../world/Sky.js';
import type { SkyWeatherFamily } from '../world/SkyLibrary.js';
import type { ParityResult } from '../render/GerstnerParity.js';

/**
 * The control surface `npm run verify` drives the game through.
 *
 * Deliberately a real, typed interface rather than a pile of globals poked in from a test:
 * the settings panel uses the same methods, so a screenshot harness and a player changing the
 * date in the UI go through identical code paths, and there is nothing here that only exists
 * for tests to reach.
 */

export interface FrameStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  programs: number;
  geometries: number;
  textures: number;
  renderer: string;
  webgpuAvailable: boolean;
  preset: QualityPreset;
  pixelRatio: number;
  /**
   * Whether the post chain is driving the frame.
   *
   * Reported because "the scene renders but looks unexposed" and "the composer never took
   * over" produce very similar-looking frames, and telling them apart by eye costs far more
   * than surfacing one boolean.
   */
  usingComposer: boolean;
}

export interface EphemerisSummary {
  utc: string;
  localTime: string;
  latitudeDeg: number;
  longitudeDeg: number;
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  moonAltitudeDeg: number;
  moonAzimuthDeg: number;
  moonIlluminatedFraction: number;
  moonPhase: string;
  twilight: string;
  sunIlluminanceLux: number;
  moonIlluminanceLux: number;
  exposure: number;
  significantWaveHeight: number;
  beaufort: number;
}

export interface HelmSummary {
  speedKnots: number;
  headingDeg: number;
  /** −1 (full astern) .. +1 (full ahead), after the throttle lever's own lag. */
  throttle: number;
  /** Fraction of the hull's probes under water this step. Thrust scales with it. */
  wettedFraction: number;
  anchored: boolean;
}

export interface EndlessFishingApi {
  readonly version: 1;
  /** True once the first frame has been presented. */
  ready(): boolean;
  /** ISO-8601 UTC string to freeze the clock at, or null to return to real time. */
  setTime(isoUtc: string | null): void;
  setTimeScale(scale: number): void;
  setLocation(latitudeDeg: number, longitudeDeg: number): void;
  setWeather(family: SkyWeatherFamily): void;
  setWind(speedMetresPerSecond: number, directionDeg: number): void;
  setCloudiness(fraction: number): void;
  setPreset(preset: QualityPreset): void;
  /**
   * Override individual graphics knobs on top of the current preset.
   *
   * This is how a rendering defect gets attributed to the effect that causes it: capture the same
   * moment with one knob off and diff the two frames. Guessing which pass owns a one-pixel
   * artefact costs far more than being able to switch each one off in turn.
   */
  setGraphics(patch: Partial<GraphicsSettings>): void;
  stats(): FrameStats;
  /**
   * What the hull is actually doing.
   *
   * Added because "the boat does not move" and "the boat moves and nothing on screen says so"
   * look identical from outside, and telling them apart by watching a screenshot of a HUD is
   * slower and less reliable than reading six numbers.
   */
  helm(): HelmSummary | null;
  ephemeris(): EphemerisSummary | null;
  /** CPU/GPU wave agreement, in metres. */
  waveParity(): ParityResult | null;
  /**
   * Measured radiance at the zenith and at the horizon, in candela per square metre, plus the
   * exposure that will be applied to them. The three numbers that decide whether a frame is
   * correctly exposed, readable without guessing.
   */
  photometry(): {
    zenithLuminance: number;
    horizonLuminance: number;
    exposure: number;
    exposedZenith: number;
    exposedHorizon: number;
  } | null;
}

declare global {
  interface Window {
    endlessFishing?: EndlessFishingApi;
  }
}

export function installDebugApi(engine: Engine): EndlessFishingApi {
  let firstFrame = false;
  const markReady = (): void => {
    firstFrame = true;
  };
  requestAnimationFrame(() => requestAnimationFrame(markReady));

  const api: EndlessFishingApi = {
    version: 1,

    ready(): boolean {
      return firstFrame;
    },

    setTime(isoUtc: string | null): void {
      if (isoUtc === null) {
        engine.settings.world.timeOverrideMs = null;
      } else {
        const parsed = Date.parse(isoUtc);
        if (Number.isNaN(parsed)) throw new Error(`Not a parsable date: ${isoUtc}`);
        engine.settings.world.timeOverrideMs = parsed;
      }
      engine.settings.emit('world');
      // A clock jump is a cut, not a sunset. Re-meter instead of crawling across five decades.
      engine.get<Sky>('sky')?.resetAdaptation();
    },

    setTimeScale(scale: number): void {
      engine.settings.world.timeScale = Math.max(0, scale);
      engine.settings.emit('world');
    },

    setLocation(latitudeDeg: number, longitudeDeg: number): void {
      engine.settings.setLocation(latitudeDeg, longitudeDeg);
    },

    setWeather(family: SkyWeatherFamily): void {
      engine.get<Sky>('sky')?.setWeather(family);
    },

    setWind(speedMetresPerSecond: number, directionDeg: number): void {
      const radians = (directionDeg * Math.PI) / 180;
      engine.world.windSpeed = Math.max(0, speedMetresPerSecond);
      engine.world.windDirection = radians;
      engine.world.windX = Math.sin(radians) * engine.world.windSpeed;
      engine.world.windZ = -Math.cos(radians) * engine.world.windSpeed;
    },

    setCloudiness(fraction: number): void {
      engine.world.cloudiness = Math.min(1, Math.max(0, fraction));
    },

    setPreset(preset: QualityPreset): void {
      engine.settings.applyPreset(preset);
    },

    setGraphics(patch: Partial<GraphicsSettings>): void {
      Object.assign(engine.settings.graphics, patch);
      engine.settings.emit('graphics');
    },

    stats(): FrameStats {
      const info = engine.renderer.info;
      return {
        fps: engine.loop.fps,
        frameMs: engine.loop.frameMs,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        programs: info.programs?.length ?? 0,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        renderer: engine.capabilities.rendererName,
        webgpuAvailable: engine.capabilities.webgpu,
        preset: engine.settings.graphics.preset,
        pixelRatio: engine.pixelRatio,
        usingComposer: engine.renderOverride !== null,
      };
    },

    helm(): HelmSummary | null {
      const boat = engine.get<Boat>('boat');
      if (boat === undefined) return null;
      return {
        speedKnots: boat.speedKnots,
        headingDeg: (boat.heading * 180) / Math.PI,
        throttle: boat.throttleSetting,
        wettedFraction: boat.solver.wettedFraction,
        anchored: boat.isAnchored,
      };
    },

    ephemeris(): EphemerisSummary | null {
      const state = engine.world.ephemeris;
      if (state === null) return null;
      const date = new Date(engine.time.epochMs);
      return {
        utc: date.toISOString(),
        localTime: date.toLocaleTimeString('en-GB'),
        latitudeDeg: state.location.latitudeDeg,
        longitudeDeg: state.location.longitudeDeg,
        sunAltitudeDeg: state.sunAltitudeDeg,
        sunAzimuthDeg: state.sunAzimuthDeg,
        moonAltitudeDeg: state.moonAltitudeDeg,
        moonAzimuthDeg: state.moonAzimuthDeg,
        moonIlluminatedFraction: state.moon.illuminatedFraction,
        moonPhase: state.moon.phaseName,
        twilight: state.twilight,
        sunIlluminanceLux: state.sunIlluminanceLux,
        moonIlluminanceLux: state.moonIlluminanceLux,
        exposure: engine.world.exposure,
        significantWaveHeight: engine.world.significantWaveHeight,
        beaufort: engine.world.beaufort,
      };
    },

    waveParity(): ParityResult | null {
      const ocean = engine.get<Ocean>('ocean');
      return ocean === undefined ? null : ocean.parityCheck(engine);
    },

    photometry() {
      const sky = engine.get<Sky>('sky');
      if (sky === undefined) return null;
      // v = 1 is straight up in the sky-view parameterisation; v = 0.5 is the horizon.
      const zenith = sky.atmosphere.sampleSkyView(engine.renderer, 0.5, 1);
      const horizon = sky.atmosphere.sampleSkyView(engine.renderer, 0.5, 0.51);
      const scale = sky.skyIntensity;
      const toLuminance = (rgb: [number, number, number]): number =>
        (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) * scale;
      // The night floor is added by the fragment shader on top of the table, so a reading taken
      // from the table alone reports zero for a sky that is plainly lit. Include it.
      const floor = sky.nightFloor;
      const zenithLuminance = toLuminance(zenith) + floor;
      const horizonLuminance = toLuminance(horizon) + floor * 0.55;
      const exposure = engine.world.exposure;
      return {
        zenithLuminance,
        horizonLuminance,
        exposure,
        exposedZenith: zenithLuminance * exposure,
        exposedHorizon: horizonLuminance * exposure,
      };
    },
  };

  window.endlessFishing = api;
  return api;
}
