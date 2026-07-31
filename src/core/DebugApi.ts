import type { Engine } from './Engine.js';
import type { GraphicsSettings, QualityPreset } from './Settings.js';
import type { Boat } from '../entities/Boat.js';
import type { FishingSystem } from '../gameplay/FishingSystem.js';
import type { Clouds } from '../world/Clouds.js';
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
  /**
   * The weather field as the rest of the game sees it.
   *
   * Reported because "the storm is not arriving" and "the storm arrived and the sky is not
   * drawing it" produce identical pictures, and telling them apart by looking cost an hour.
   */
  windSpeed: number;
  cloudiness: number;
  precipitation: number;
  visibilityM: number;
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

export interface FishingSummary {
  /** idle, charging, casting, sinking, waiting, bite, fighting, landed, escaped. */
  state: string;
  /** 0..1 of the line's breaking strain. Pin it and the line goes. */
  tension: number;
  hooked: boolean;
  /** Metres from the rod tip to the fish. */
  fishDistanceM: number;
  /** The last specimen landed, or null if nothing has been landed yet this session. */
  lastCatch: { species: string; massKg: number; lengthM: number; value: number } | null;
}

export interface EndlessFishingApi {
  readonly version: 1;
  /** True once the first frame has been presented. */
  ready(): boolean;
  /** ISO-8601 UTC string to freeze the clock at, or null to return to real time. */
  setTime(isoUtc: string | null): void;
  setTimeScale(scale: number): void;
  setLocation(latitudeDeg: number, longitudeDeg: number): void;
  /** Pick the panorama family only. The sea is unaffected — use `setWeatherState` for that. */
  setWeather(family: SkyWeatherFamily): void;
  /**
   * Pin the whole synoptic state by name, or `null` to hand the sky and the sea back to the
   * pressure field.
   *
   * This is what `setWind` looks like it does and does not: the weather system rewrites the wind
   * every frame from its own field, so poking `world.windSpeed` is overwritten before the next
   * frame is drawn. Pinning the state is the only way to photograph a gale.
   *
   * Names come from `WEATHER_STATES`: dead-calm, light-breeze, partly-cloudy, overcast, fog,
   * rain, thunderstorm, storm.
   */
  setWeatherState(name: string | null): void;
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
  /**
   * Where the fishing loop is.
   *
   * The state machine, the bite model, the fight and the save format all have unit tests. What
   * they cannot cover is whether pressing the keys a player presses actually walks the machine
   * from idle to landed — every one of those pieces was, at one point, written and wired to
   * nothing. `scripts/playtest.ts` reads this and plays the loop for real.
   */
  fishing(): FishingSummary | null;
  /**
   * What the cloud layer is doing, read back from the buffer the march actually wrote.
   *
   * Stalls the pipeline. A debug call only.
   */
  clouds(): {
    coverage: number;
    baseM: number;
    topM: number;
    density: number;
    convection: number;
    anvil: number;
    meanTransmittance: number;
    meanScatter: number;
  } | null;
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

    setWeatherState(name: string | null): void {
      engine.settings.world.weatherOverride = name;
      engine.settings.emit('world');
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

    fishing(): FishingSummary | null {
      const fishing = engine.get<FishingSystem>('fishing');
      if (fishing === undefined) return null;
      const caught = fishing.lastCatch;
      return {
        state: fishing.state,
        tension: fishing.tension,
        hooked: fishing.hooked,
        fishDistanceM: fishing.fishDistanceM,
        lastCatch:
          caught === null
            ? null
            : {
                species: caught.species.name,
                massKg: caught.massKg,
                lengthM: caught.lengthM,
                value: caught.value,
              },
      };
    },

    clouds() {
      return engine.get<Clouds>('clouds')?.diagnostics(engine.renderer) ?? null;
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
        windSpeed: engine.world.windSpeed,
        cloudiness: engine.world.cloudiness,
        precipitation: engine.world.precipitation,
        visibilityM: engine.world.visibility,
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
