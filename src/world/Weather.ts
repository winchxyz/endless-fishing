import { Color, PointLight, type Scene } from 'three';
import type { Engine, System } from '../core/Engine.js';
import { Noise, clamp, damp, lerp, smoothstep } from '../math/Noise.js';
import { PRNG } from '../math/PRNG.js';
import type { SkyWeatherFamily } from './SkyLibrary.js';
import type { Sky } from './Sky.js';

/**
 * The weather, as a synoptic model rather than as a list of moods.
 *
 * There is one field here and everything else is read off it: a slowly evolving sea-level
 * pressure surface, sampled from 3D fBm over position and time. The wind is that field's
 * geostrophic response — perpendicular to the pressure gradient, with a magnitude set by the
 * gradient and the Coriolis parameter at the player's latitude — so a low crossing the world
 * produces a wind that freshens, veers through the front and backs again afterwards without
 * any of that being scripted. Cloud follows falling pressure, rain follows cloud, and the eight
 * named states are a *classification* of the result, never its cause.
 *
 * That distinction is the whole design. A state machine has to be told that clear cannot become
 * storm; here it simply cannot happen, because the wind and the cloud fraction are continuous
 * quantities with bounded rates of change, and to reach force 8 the wind must first pass through
 * forces 3, 4, 5, 6 and 7 with the cloud thickening the entire way.
 *
 * The clock is compressed: a real minute is about three quarters of a synoptic hour, which puts
 * a frontal veer at three or four real minutes and a whole change of regime at half an hour or
 * so. Slower and a session would only ever see one kind of day; faster and the wind would jump
 * between forces instead of working its way there, which is the one thing this must not do.
 */

// ------------------------------------------------------------------------------ the scale

/**
 * Upper wind-speed limit of each Beaufort force, m/s.
 *
 * Duplicated deliberately from `core/WorldState.ts`, which owns the classification function —
 * this array is what turns the scale into *continuous* forces for the state memberships below,
 * and `test/weather.test.ts` asserts the two agree at every boundary rather than trusting them
 * to. Force 12 has no upper limit.
 */
export const BEAUFORT_UPPER_LIMITS_MS: readonly number[] = [
  0.5, 1.5, 3.3, 5.5, 7.9, 10.7, 13.8, 17.1, 20.7, 24.4, 28.4, 32.6,
];

/**
 * Beaufort force with the fractional position inside the band, so `floor` recovers the integer
 * scale exactly. The memberships need a continuous quantity: an integer force would make every
 * state boundary a step, and the blend between neighbouring states would be meaningless.
 */
export function continuousBeaufort(metresPerSecond: number): number {
  const v = Math.max(0, metresPerSecond);
  let low = 0;
  for (let force = 0; force < BEAUFORT_UPPER_LIMITS_MS.length; force += 1) {
    const high = BEAUFORT_UPPER_LIMITS_MS[force];
    if (high === undefined) break;
    if (v < high) return force + (v - low) / (high - low);
    low = high;
  }
  return 12;
}

// ------------------------------------------------------------------------------ the states

export type WeatherStateName =
  | 'dead-calm'
  | 'light-breeze'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'thunderstorm'
  | 'storm';

export interface WeatherStateDescriptor {
  readonly name: WeatherStateName;
  /** Which panorama family the sky should draw from while this state holds. */
  readonly family: SkyWeatherFamily;
  /** Beaufort forces this state occupies, inclusive at both ends. */
  readonly beaufortLow: number;
  readonly beaufortHigh: number;
  /** What the continuous field is driven towards when this state is pinned by a setting. */
  readonly cloudiness: number;
  readonly precipitation: number;
  readonly visibilityM: number;
  readonly label: string;
}

/**
 * The eight states, in the order the classification array uses.
 *
 * The Beaufort windows are the real ones from the brief; the cloud, rain and visibility figures
 * are only used when `settings.world.weatherOverride` pins a state, because in normal play those
 * three come from the field and not from this table.
 */
export const WEATHER_STATES: readonly WeatherStateDescriptor[] = [
  { name: 'dead-calm', family: 'clear', beaufortLow: 0, beaufortHigh: 1, cloudiness: 0.1, precipitation: 0, visibilityM: 30000, label: 'Dead calm' },
  { name: 'light-breeze', family: 'clear', beaufortLow: 2, beaufortHigh: 3, cloudiness: 0.22, precipitation: 0, visibilityM: 27000, label: 'Light breeze' },
  { name: 'partly-cloudy', family: 'partly-cloudy', beaufortLow: 3, beaufortHigh: 4, cloudiness: 0.5, precipitation: 0, visibilityM: 23000, label: 'Partly cloudy' },
  { name: 'overcast', family: 'overcast', beaufortLow: 3, beaufortHigh: 5, cloudiness: 0.88, precipitation: 0.05, visibilityM: 15000, label: 'Overcast' },
  { name: 'fog', family: 'fog', beaufortLow: 0, beaufortHigh: 2, cloudiness: 0.7, precipitation: 0, visibilityM: 120, label: 'Sea fog' },
  { name: 'rain', family: 'overcast', beaufortLow: 4, beaufortHigh: 5, cloudiness: 0.95, precipitation: 0.55, visibilityM: 4500, label: 'Rain' },
  { name: 'thunderstorm', family: 'storm', beaufortLow: 5, beaufortHigh: 7, cloudiness: 0.97, precipitation: 0.8, visibilityM: 2400, label: 'Thunderstorm' },
  { name: 'storm', family: 'storm', beaufortLow: 8, beaufortHigh: 10, cloudiness: 0.98, precipitation: 0.85, visibilityM: 1400, label: 'Storm' },
];

// ------------------------------------------------------------------------------ field constants

/** Real seconds per hour of synoptic time. */
const SECONDS_PER_SYNOPTIC_HOUR = 75;
/** Kilometres of ocean per unit of the noise lattice. Calibrated — see `pressureAt`. */
const SYNOPTIC_SCALE_KM = 2900;
const PRESSURE_AMPLITUDE_HPA = 30;
const MEAN_PRESSURE_HPA = 1013.25;
/** Synoptic hours for the pattern to morph one lattice unit along its own time axis. */
const EVOLUTION_HOURS = 46;
/** Speed at which the whole pressure pattern is carried across the world, km/h. */
const STEERING_SPEED_KMH = 64;
/** Half-width of the central difference used for the gradient, metres. */
const GRADIENT_SAMPLE_M = 30000;
/** Hours between the two barometer readings that make the trend. */
const TREND_WINDOW_HOURS = 1;

const AIR_DENSITY = 1.225;
const EARTH_ANGULAR_RATE = 7.2921159e-5;
/** Geostrophic balance fails in the tropics, so the Coriolis parameter is floored. */
const MIN_CORIOLIS_LATITUDE_DEG = 16;
/** Surface wind as a fraction of the geostrophic wind, over open water. */
const SURFACE_FRICTION_FACTOR = 0.72;
/** Radians the surface wind is turned across the isobars towards low pressure by friction. */
const CROSS_ISOBAR_ANGLE = 0.3;
/** Force 10 is as hard as this model blows; violent storm is not a fishable sea. */
const MAX_WIND_SPEED_MS = 26.5;

const PRESSURE_CLOUD_SPAN = 26;
const TREND_CLOUD_GAIN = 0.34;
const BASE_TEMPERATURE_C = 3.5;
const TEMPERATURE_SPAN_C = 12.5;

const DEG_TO_RAD = Math.PI / 180;

// ------------------------------------------------------------------------------ sample

/** One instantaneous reading of the field. Filled in place; never allocated in a loop. */
export interface SynopticSample {
  pressureHpa: number;
  trendHpaPerHour: number;
  windX: number;
  windZ: number;
  windSpeed: number;
  windDirection: number;
  cloudiness: number;
  precipitation: number;
  fogginess: number;
  instability: number;
  temperatureC: number;
  visibilityM: number;
}

export function createSynopticSample(): SynopticSample {
  return {
    pressureHpa: MEAN_PRESSURE_HPA,
    trendHpaPerHour: 0,
    windX: 0,
    windZ: 0,
    windSpeed: 0,
    windDirection: 0,
    cloudiness: 0.2,
    precipitation: 0,
    fogginess: 0,
    instability: 0,
    temperatureC: 12,
    visibilityM: 25000,
  };
}

export interface StormWarning {
  approaching: boolean;
  /**
   * Real minutes until severe weather arrives. Zero means it is already here, and the forecast
   * horizon means the model looked that far and found nothing.
   */
  minutesAway: number;
}

/** How far ahead the barometer can see, in real minutes, and the resolution of that look. */
const FORECAST_HORIZON_MIN = 30;
const FORECAST_PROBES = 20;

function above(x: number, edge: number, width: number): number {
  return smoothstep(edge - width, edge + width, x);
}

function below(x: number, edge: number, width: number): number {
  return smoothstep(edge + width, edge - width, x);
}

function within(x: number, low: number, high: number, width: number): number {
  return Math.min(above(x, low, width), below(x, high, width));
}

/**
 * Membership of a Beaufort window, continuous across its edges.
 *
 * A window quoted as "forces 3 to 4" covers continuous forces [3, 5), so the taper is placed
 * half a force outside each end. Overlapping windows are intentional: several states are
 * plausible at force 4 and which one wins is settled by cloud and rain, not by wind alone.
 */
function beaufortMembership(force: number, low: number, high: number): number {
  return Math.min(
    smoothstep(low - 2.0, low - 0.5, force),
    smoothstep(high + 2.0, high + 0.5, force),
  );
}

/**
 * Fuzzy membership of one state, in 0..1.
 *
 * The Beaufort window multiplies everything, and the sky conditions only ever modulate it
 * between a small floor and one. That floor is load-bearing: without it a wind that no state's
 * *conditions* recognise — a force 9 under a clear sky, say — scores zero everywhere and the
 * argmax falls back to whichever state happens to sit first in the array. With it, the wind
 * band alone always names a plausible state and the conditions decide between the candidates
 * that share it. Which is also the correct meteorology: at force 9 you are in a storm whatever
 * the cloud is doing.
 */
export function scoreState(name: WeatherStateName, force: number, sample: SynopticSample): number {
  const dry = below(sample.precipitation, 0.14, 0.08);
  const clearOfFog = below(sample.fogginess, 0.42, 0.18);
  switch (name) {
    case 'dead-calm':
      return graded(force, 0, 1, below(sample.cloudiness, 0.8, 0.2) * dry * clearOfFog);
    case 'light-breeze':
      return graded(force, 2, 3, below(sample.cloudiness, 0.5, 0.18) * dry * clearOfFog);
    case 'partly-cloudy':
      return graded(force, 3, 4, within(sample.cloudiness, 0.3, 0.72, 0.12) * dry * clearOfFog);
    case 'overcast':
      return graded(
        force,
        3,
        5,
        above(sample.cloudiness, 0.7, 0.12) * below(sample.precipitation, 0.2, 0.1) * clearOfFog,
      );
    case 'fog':
      return graded(force, 0, 2, above(sample.fogginess, 0.42, 0.18));
    case 'rain':
      return graded(
        force,
        4,
        5,
        above(sample.precipitation, 0.2, 0.12) * below(sample.instability, 0.6, 0.15),
      );
    case 'thunderstorm':
      return graded(
        force,
        5,
        7,
        above(sample.precipitation, 0.25, 0.15) * above(sample.instability, 0.62, 0.14),
      );
    case 'storm':
      return graded(force, 8, 10, above(sample.cloudiness, 0.55, 0.2));
  }
}

/** Beaufort window times the sky conditions, with the floor described above. */
function graded(force: number, low: number, high: number, conditions: number): number {
  return beaufortMembership(force, low, high) * (0.06 + 0.94 * conditions);
}

/** A secondary field channel in 0..1: airmass moisture, airmass warmth. */
function channel(
  noise: Noise,
  xMetres: number,
  zMetres: number,
  synopticHours: number,
  scale: number,
  evolution: number,
): number {
  const k = scale / (SYNOPTIC_SCALE_KM * 1000);
  const n = noise.fbm3(
    xMetres * k,
    zMetres * k,
    synopticHours / (EVOLUTION_HOURS * evolution),
    3,
    2,
    0.5,
  );
  return clamp(n * 0.5 + 0.5, 0, 1);
}

/** Middle of a state's Beaufort window in m/s, used when a state is pinned by a setting. */
function beaufortCentreSpeed(descriptor: WeatherStateDescriptor): number {
  const low =
    descriptor.beaufortLow === 0 ? 0 : BEAUFORT_UPPER_LIMITS_MS[descriptor.beaufortLow - 1] ?? 0;
  const high = BEAUFORT_UPPER_LIMITS_MS[descriptor.beaufortHigh] ?? MAX_WIND_SPEED_MS;
  return (low + high) * 0.5;
}

function copySample(from: SynopticSample, to: SynopticSample): void {
  to.pressureHpa = from.pressureHpa;
  to.trendHpaPerHour = from.trendHpaPerHour;
  to.windX = from.windX;
  to.windZ = from.windZ;
  to.windSpeed = from.windSpeed;
  to.windDirection = from.windDirection;
  to.cloudiness = from.cloudiness;
  to.precipitation = from.precipitation;
  to.fogginess = from.fogginess;
  to.instability = from.instability;
  to.temperatureC = from.temperatureC;
  to.visibilityM = from.visibilityM;
}

function angleDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// ------------------------------------------------------------------------------ the model

/**
 * The synoptic field, and the smoothed state read off it.
 *
 * Pure: no three.js, no engine, no clock of its own beyond the seconds it is handed. `probeAt`
 * is a deterministic function of position and time and nothing else, which is what makes the
 * field testable; `step` adds the memory — cloud that takes minutes to build and to burn off,
 * and a sea whose fetch grows while the wind holds and collapses when it veers.
 */
export class WeatherModel {
  readonly current: SynopticSample = createSynopticSample();
  readonly target: SynopticSample = createSynopticSample();

  private readonly pressureNoise: Noise;
  private readonly moistureNoise: Noise;
  private readonly warmthNoise: Noise;
  private readonly forecastSample: SynopticSample = createSynopticSample();
  private readonly scores = new Float64Array(WEATHER_STATES.length);

  /** m/s of geostrophic wind per hPa per 100 km, at this latitude. */
  private geostrophicPerUnit = 1;
  /** +1 in the northern hemisphere, −1 in the southern; flips the sense of the circulation. */
  private hemisphere = 1;
  private latitudeDeg = Number.NaN;

  private readonly steeringU: number;
  private readonly steeringV: number;

  private elapsedSeconds = 0;
  private fetchKm = 200;
  private previousDirection = 0;
  private primed = false;
  private override: WeatherStateDescriptor | null = null;

  private stateIndex = 1;
  private neighbourIndex = 1;
  private blendValue = 0;

  constructor(seed: number, latitudeDeg: number) {
    this.pressureNoise = new Noise(seed);
    this.moistureNoise = new Noise((seed ^ 0x9e37_79b9) >>> 0);
    this.warmthNoise = new Noise((seed ^ 0x85eb_ca6b) >>> 0);

    // The steering bearing is a property of the world rather than of the weather: one seed
    // always gets its fronts from the same quarter, which is what gives a place a prevailing
    // wind instead of a wind that comes from everywhere equally over a long enough session.
    const bearing = new PRNG((seed ^ 0x27d4_eb2f) >>> 0).next() * Math.PI * 2;
    const perUnit = STEERING_SPEED_KMH / SYNOPTIC_SCALE_KM;
    this.steeringU = Math.cos(bearing) * perUnit;
    this.steeringV = Math.sin(bearing) * perUnit;

    this.setLatitude(latitudeDeg);
  }

  /** Elapsed synoptic hours. One real minute is an hour and a half of weather. */
  get synopticHours(): number {
    return this.elapsedSeconds / SECONDS_PER_SYNOPTIC_HOUR;
  }

  get descriptor(): WeatherStateDescriptor {
    return WEATHER_STATES[this.stateIndex] ?? FALLBACK_STATE;
  }

  get state(): WeatherStateName {
    return this.descriptor.name;
  }

  /** The state the field is closest to becoming. Equal to `state` when nothing else is close. */
  get neighbour(): WeatherStateDescriptor {
    return WEATHER_STATES[this.neighbourIndex] ?? this.descriptor;
  }

  /** 0 = firmly in this state, 1 = exactly on the boundary with `neighbour`. */
  get blend(): number {
    return this.blendValue;
  }

  get fetch(): number {
    return this.fetchKm;
  }

  /** Score of one state at the last classification, for the debug panel. */
  scoreAt(index: number): number {
    return this.scores[index] ?? 0;
  }

  /**
   * Coriolis depends on latitude, and the player's latitude arrives asynchronously from the
   * browser's geolocation, so this is written to be safe to call every frame.
   */
  setLatitude(latitudeDeg: number): void {
    if (latitudeDeg === this.latitudeDeg) return;
    this.latitudeDeg = latitudeDeg;
    this.hemisphere = latitudeDeg < 0 ? -1 : 1;
    const effective = Math.max(MIN_CORIOLIS_LATITUDE_DEG, Math.abs(latitudeDeg));
    const coriolis = 2 * EARTH_ANGULAR_RATE * Math.sin(effective * DEG_TO_RAD);
    // One hPa per 100 km is 1e-3 Pa/m, so V = |∇p| / (ρf) comes out in m/s directly.
    this.geostrophicPerUnit = 1e-3 / (AIR_DENSITY * coriolis);
  }

  /** Pin a named state, or pass null to hand the sky back to the field. */
  setOverride(name: string | null): void {
    this.override = name === null ? null : WEATHER_STATES.find((s) => s.name === name) ?? null;
  }

  /**
   * Sea-level pressure in hPa at a world position and a synoptic hour.
   *
   * Scale and amplitude are not independent knobs: between them they fix the pressure
   * *gradient*, and the gradient is the wind. Both were chosen by measuring what the field
   * actually produces rather than by taste — they put the gradient between roughly 0.2 and
   * 4 hPa per 100 km, which spans a slack summer ridge and a severe North Atlantic low, and
   * they keep the barometer inside the range a real one on this coast would show.
   *
   * The cubic shaping is there because real pressure fields are not Gaussian. The middle of the
   * range is broad flat ridges and cols where very little happens; all the interest is at the
   * ends, where lows are tight and deep. Flattening the middle and steepening the extremes is
   * what gives the world mostly ordinary days and occasionally a genuinely bad one.
   */
  pressureAt(xMetres: number, zMetres: number, synopticHours: number): number {
    const scale = 1 / (SYNOPTIC_SCALE_KM * 1000);
    const u = xMetres * scale + this.steeringU * synopticHours;
    const v = zMetres * scale + this.steeringV * synopticHours;
    const w = synopticHours / EVOLUTION_HOURS;
    // Three octaves at a gain well below 0.5 keeps the small scales out of the gradient, which
    // is right twice over: the wind is set by the shape of the whole system rather than by the
    // texture drawn on top of it, and a fourth octave advects past the observer fast enough to
    // put a visible step in the wind between one minute and the next.
    const n = this.pressureNoise.fbm3(u, v, w, 3, 2, 0.42);
    return MEAN_PRESSURE_HPA + PRESSURE_AMPLITUDE_HPA * n * (0.42 + 0.58 * n * n);
  }

  /**
   * The whole field at one point in space and time. Deterministic, allocation-free, and the
   * only place any of these quantities are decided.
   */
  probeAt(xMetres: number, zMetres: number, synopticHours: number, out: SynopticSample): void {
    const d = GRADIENT_SAMPLE_M;
    const pressure = this.pressureAt(xMetres, zMetres, synopticHours);
    const east1 = this.pressureAt(xMetres + d, zMetres, synopticHours);
    const east0 = this.pressureAt(xMetres - d, zMetres, synopticHours);
    const south1 = this.pressureAt(xMetres, zMetres + d, synopticHours);
    const south0 = this.pressureAt(xMetres, zMetres - d, synopticHours);
    const before = this.pressureAt(xMetres, zMetres, synopticHours - TREND_WINDOW_HOURS);

    // hPa per 100 km in the meteorological frame. North is −Z in world space, hence the swap.
    const gradEast = ((east1 - east0) / (2 * d)) * 1e5;
    const gradNorth = ((south0 - south1) / (2 * d)) * 1e5;

    // Geostrophic balance: the wind runs along the isobars with low pressure on its left in the
    // northern hemisphere and on its right in the southern. Friction over water then turns it
    // about seventeen degrees across the isobars towards the low, which is why a surface wind
    // spirals into a depression instead of circling it forever — and why the sky closes in on
    // the way through rather than only at the centre.
    const gain = this.geostrophicPerUnit * this.hemisphere;
    const geoEast = -gradNorth * gain;
    const geoNorth = gradEast * gain;
    const turn = CROSS_ISOBAR_ANGLE * this.hemisphere;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const east = geoEast * cos - geoNorth * sin;
    const north = geoEast * sin + geoNorth * cos;

    const raw = Math.hypot(east, north);
    const speed = Math.min(raw * SURFACE_FRICTION_FACTOR, MAX_WIND_SPEED_MS);
    const inverse = raw > 1e-6 ? 1 / raw : 0;
    const unitEast = east * inverse;
    const unitNorth = north * inverse;

    out.pressureHpa = pressure;
    out.trendHpaPerHour = (pressure - before) / TREND_WINDOW_HOURS;
    out.windX = unitEast * speed;
    out.windZ = -unitNorth * speed;
    out.windSpeed = speed;
    out.windDirection = Math.atan2(unitEast, unitNorth);

    const moisture = channel(this.moistureNoise, xMetres, zMetres, synopticHours, 0.62, 1.4);
    const warmth = channel(this.warmthNoise, xMetres, zMetres, synopticHours, 0.38, 2.1);
    const anomaly = pressure - MEAN_PRESSURE_HPA;
    const trend = out.trendHpaPerHour;

    // Cloud is a proxy for ascent, and ascent goes with low pressure and with pressure that is
    // still falling. The trend term is what thickens the sky *ahead* of a front rather than at
    // the moment the wind changes, which is the order a real one arrives in.
    const cloudiness = clamp(
      clamp(0.5 - anomaly / PRESSURE_CLOUD_SPAN, 0, 1) +
        clamp(-trend * TREND_CLOUD_GAIN, -0.2, 0.45) +
        (moisture - 0.5) * 0.3,
      0,
      1,
    );
    const precipitation = clamp(
      smoothstep(0.74, 0.96, cloudiness) * smoothstep(0.0, -0.9, trend) * (0.25 + 0.75 * moisture),
      0,
      1,
    );
    // A CAPE proxy: a warm moist airmass under a deepening low, and only where there is already
    // enough cloud for a tower to grow out of.
    const instability = clamp(
      (moisture * 1.15 + warmth * 0.55 - 0.5 - anomaly / 45) * smoothstep(0.5, 0.85, cloudiness),
      0,
      1,
    );
    // Sea fog is advection fog: warm moist air lying over cold water, and it needs a slack
    // gradient to survive. Any real wind mixes it out and rain scavenges it.
    const fogginess = clamp(
      smoothstep(4.6, 1.4, speed) *
        smoothstep(0.44, 0.74, moisture) *
        (1 - smoothstep(0.02, 0.2, precipitation)),
      0,
      1,
    );

    out.cloudiness = cloudiness;
    out.precipitation = precipitation;
    out.instability = instability;
    out.fogginess = fogginess;
    out.temperatureC = BASE_TEMPERATURE_C + TEMPERATURE_SPAN_C * warmth - 2.2 * precipitation;

    // Koschmieder: visibility is the distance at which contrast falls to two per cent, so this
    // is the same number the aerial-perspective shader divides by. Clear northern air runs to
    // tens of kilometres, rain takes it to single figures, fog to the length of the boat.
    const clearAir = 34000 - 12000 * moisture;
    const inRain = clearAir / (1 + precipitation * 8);
    out.visibilityM = lerp(inRain, 90, smoothstep(0.3, 0.95, fogginess));
  }

  /**
   * Advance the smoothed state by `dtSeconds` of real time at a world position.
   *
   * Everything visible changes here and only here, through exponential damping with time
   * constants measured in minutes. That is not a smoothing convenience: it is the reason the
   * state sequence is physically ordered, because a damped quantity cannot skip a value on its
   * way to another one.
   */
  step(dtSeconds: number, xMetres: number, zMetres: number): void {
    const dt = Math.max(0, dtSeconds);
    this.elapsedSeconds += dt;
    this.probeAt(xMetres, zMetres, this.synopticHours, this.target);

    const pinned = this.override;
    if (pinned !== null) {
      // A pinned state still arrives smoothly. Only the magnitude is forced; the direction stays
      // with the field, so even an overridden storm veers as its front goes through.
      const centre = beaufortCentreSpeed(pinned);
      const scale = this.target.windSpeed > 1e-4 ? centre / this.target.windSpeed : 0;
      this.target.windX *= scale;
      this.target.windZ *= scale;
      this.target.windSpeed = centre;
      this.target.cloudiness = pinned.cloudiness;
      this.target.precipitation = pinned.precipitation;
      this.target.visibilityM = pinned.visibilityM;
      this.target.fogginess = pinned.name === 'fog' ? 0.95 : 0;
      this.target.instability = pinned.name === 'thunderstorm' ? 0.9 : 0;
    }

    const current = this.current;
    if (!this.primed) {
      this.primed = true;
      copySample(this.target, current);
      this.previousDirection = current.windDirection;
    } else {
      // The wind *vector* is damped, never the speed and bearing separately: damping an angle
      // through the ±π wrap is how you get a gust that spins the flag right round.
      current.windX = damp(current.windX, this.target.windX, 0.035, dt);
      current.windZ = damp(current.windZ, this.target.windZ, 0.035, dt);
      current.windSpeed = Math.hypot(current.windX, current.windZ);
      current.windDirection = Math.atan2(current.windX, -current.windZ);
      current.pressureHpa = this.target.pressureHpa;
      current.trendHpaPerHour = damp(current.trendHpaPerHour, this.target.trendHpaPerHour, 0.05, dt);
      current.cloudiness = damp(current.cloudiness, this.target.cloudiness, 0.006, dt);
      current.precipitation = damp(current.precipitation, this.target.precipitation, 0.01, dt);
      current.fogginess = damp(current.fogginess, this.target.fogginess, 0.008, dt);
      current.instability = damp(current.instability, this.target.instability, 0.008, dt);
      current.temperatureC = damp(current.temperatureC, this.target.temperatureC, 0.005, dt);
      current.visibilityM = damp(current.visibilityM, this.target.visibilityM, 0.02, dt);
    }

    this.updateFetch(dt);
    this.classify();
  }

  /**
   * Fetch: how far the wind has blown over open water, which is what JONSWAP needs in order to
   * know whether the sea is young and confused or old and organised.
   *
   * It builds at roughly the group velocity of the dominant wave while the wind holds its
   * bearing, and a veer knocks it back — which is exactly what happens behind a cold front,
   * where a new short-crested sea climbs on top of the swell the old wind left behind.
   */
  private updateFetch(dt: number): void {
    const veer = Math.abs(angleDelta(this.current.windDirection, this.previousDirection));
    this.previousDirection = this.current.windDirection;
    this.fetchKm *= Math.exp(-veer * 0.9);
    const synopticSeconds = dt * (3600 / SECONDS_PER_SYNOPTIC_HOUR);
    this.fetchKm += (this.current.windSpeed * 0.45 * synopticSeconds) / 1000;
    this.fetchKm = clamp(this.fetchKm, 25, 700);
  }

  /**
   * Score every state against the smoothed field and keep the best two.
   *
   * The scores are products of fuzzy memberships rather than a decision tree, so two states are
   * routinely close together — which is the point. A sky two thirds of the way from overcast to
   * rain should report exactly that, so the cloud renderer and the fishing tables can cross-fade
   * instead of snapping at the moment the winner changes.
   */
  private classify(): void {
    const sample = this.current;
    const force = continuousBeaufort(sample.windSpeed);

    let bestIndex = 0;
    let best = -1;
    let secondIndex = 0;
    let second = -1;
    for (let i = 0; i < WEATHER_STATES.length; i += 1) {
      const descriptor = WEATHER_STATES[i];
      const score = descriptor === undefined ? 0 : scoreState(descriptor.name, force, sample);
      this.scores[i] = score;
      if (score > best) {
        second = best;
        secondIndex = bestIndex;
        best = score;
        bestIndex = i;
      } else if (score > second) {
        second = score;
        secondIndex = i;
      }
    }

    const pinned = this.override;
    if (pinned !== null) {
      const index = WEATHER_STATES.indexOf(pinned);
      this.stateIndex = index < 0 ? bestIndex : index;
      this.neighbourIndex = this.stateIndex;
      this.blendValue = 0;
      return;
    }

    this.stateIndex = bestIndex;
    this.neighbourIndex = secondIndex;
    this.blendValue = best > 1e-6 ? clamp(second / best, 0, 1) : 0;
  }

  /**
   * Look ahead along the field for severe weather.
   *
   * A real forecast rather than a countdown: the field is a function of time, so the model can
   * simply be asked what it will be doing in twenty minutes. That is what makes a falling
   * barometer worth watching — the warning comes out of the same physics as the weather it
   * warns about, so it is right for the right reason, and occasionally wrong for the right
   * reason too, when a front slides past instead of over.
   */
  forecast(xMetres: number, zMetres: number, out: StormWarning): void {
    const stepMinutes = FORECAST_HORIZON_MIN / FORECAST_PROBES;
    const hoursPerMinute = 60 / SECONDS_PER_SYNOPTIC_HOUR;
    for (let i = 0; i <= FORECAST_PROBES; i += 1) {
      const minutes = i * stepMinutes;
      const hours = this.synopticHours + minutes * hoursPerMinute;
      this.probeAt(xMetres, zMetres, hours, this.forecastSample);
      const ahead = this.forecastSample;
      if (ahead.windSpeed >= 13.8 || (ahead.cloudiness > 0.85 && ahead.instability > 0.6)) {
        out.approaching = true;
        out.minutesAway = minutes;
        return;
      }
    }
    out.approaching = false;
    out.minutesAway = FORECAST_HORIZON_MIN;
  }
}

const FALLBACK_STATE: WeatherStateDescriptor = {
  name: 'light-breeze',
  family: 'clear',
  beaufortLow: 2,
  beaufortHigh: 3,
  cloudiness: 0.2,
  precipitation: 0,
  visibilityM: 25000,
  label: 'Light breeze',
};

// ------------------------------------------------------------------------------ lightning

/**
 * One stroke, as the audio system needs it.
 *
 * `thunderDelaySeconds` is the whole reason the distance is carried: thunder arrives 2.9 seconds
 * per kilometre after the flash, and a storm where the crack is simultaneous with the light is a
 * storm happening inside your head rather than four kilometres to windward.
 */
export interface LightningStrike {
  x: number;
  y: number;
  z: number;
  /** Relative energy of the stroke, 0..1. Scales both the flash and the thunder. */
  intensity: number;
  distanceM: number;
  thunderDelaySeconds: number;
}

export type LightningListener = (strike: Readonly<LightningStrike>) => void;

/** Strikes kept for polling consumers. Small, fixed, and reused — nothing here allocates. */
const STRIKE_HISTORY = 8;
/** Strikes per second at the very worst a cell in this model produces. */
const MAX_STRIKE_RATE = 0.22;
/** Metres above the sea the flash is centred, roughly the base of the tower. */
const FLASH_HEIGHT_M = 850;
const SPEED_OF_SOUND = 343;

// ------------------------------------------------------------------------------ the system

const FLASH_COLOUR = new Color(0.82, 0.88, 1.0);
/**
 * Peak intensity of the flash light, candela.
 *
 * A return stroke is a few times 10^9 candela at source; at a kilometre that is still tens of
 * thousands of lux, which is why a night strike briefly reads as daylight. Scaled down here
 * because the ephemeris-driven exposure is metering a night scene and the real figure would
 * saturate the frame for several frames after the stroke rather than for the stroke itself.
 */
const FLASH_INTENSITY_CD = 2.6e9;
/** Seconds the leader-to-return-stroke pair takes; the eye reads it as one flicker. */
const RESTRIKE_DELAY = 0.07;

/**
 * The weather system. Sole writer of the wind, the sky cover, the rain, the visibility, the
 * barometer, the air temperature and the fetch.
 *
 * Runs at priority 1, immediately after the sky: the ephemeris it wants for the temperature's
 * diurnal swing is written by `Sky` at priority 0 in the same frame, and the cloud fraction it
 * writes is picked up by the sky on the next one, which is a frame of latency on a quantity that
 * takes minutes to move.
 */
export class Weather implements System {
  readonly name = 'weather';
  readonly priority = 1;

  readonly model: WeatherModel;

  private readonly warning: StormWarning = { approaching: false, minutesAway: FORECAST_HORIZON_MIN };
  private readonly strikePool: LightningStrike[] = [];
  private readonly listeners = new Set<LightningListener>();
  private readonly flashLight: PointLight;
  private readonly random: PRNG;

  private strikeCount = 0;
  private strikeCountdown = 4;
  private restrikeCountdown = -1;
  private restrikeIntensity = 0;
  private flash = 0;
  private forecastCountdown = 0;
  private family: SkyWeatherFamily = 'partly-cloudy';
  private sky: Sky | undefined;
  private readonly scene: Scene;

  constructor(engine: Engine) {
    const settings = engine.settings;
    this.model = new WeatherModel(settings.world.seed, settings.world.latitudeDeg);
    this.random = new PRNG((settings.world.seed ^ 0x11ce_4a7d) >>> 0);

    for (let i = 0; i < STRIKE_HISTORY; i += 1) {
      this.strikePool.push({ x: 0, y: 0, z: 0, intensity: 0, distanceM: 0, thunderDelaySeconds: 0 });
    }

    // Decay is generous — a point light with a distance of zero never falls off, and the
    // inverse-square term is what makes a strike four kilometres away light the sea and not the
    // boat. `visible` is the switch; the intensity is only meaningful while it is on.
    this.flashLight = new PointLight(FLASH_COLOUR, 0, 0, 2);
    this.flashLight.visible = false;
    this.flashLight.castShadow = false;
    this.scene = engine.scene;
    this.scene.add(this.flashLight);
  }

  get state(): WeatherStateName {
    return this.model.state;
  }

  get descriptor(): WeatherStateDescriptor {
    return this.model.descriptor;
  }

  /** The state the sky is drifting towards, for consumers that want to cross-fade. */
  get nextState(): WeatherStateName {
    return this.model.neighbour.name;
  }

  /** 0 = firmly in `state`, 1 = evenly balanced with `nextState`. */
  get blend(): number {
    return this.model.blend;
  }

  /** hPa per synoptic hour. Negative is falling, and falling is what to watch. */
  get barometricTrendHpaPerHour(): number {
    return this.model.current.trendHpaPerHour;
  }

  get stormWarning(): Readonly<StormWarning> {
    return this.warning;
  }

  /** 0..1 CAPE proxy. The cloud renderer builds its towers out of this. */
  get instability(): number {
    return this.model.current.instability;
  }

  get fogginess(): number {
    return this.model.current.fogginess;
  }

  /** 0..1 brightness of the lightning flash right now, for shaders that cannot see lights. */
  get lightningFlash(): number {
    return this.flash;
  }

  /** World position of the most recent stroke, for the same shaders. */
  get lastStrike(): Readonly<LightningStrike> | undefined {
    return this.strikeCount === 0
      ? undefined
      : this.strikePool[(this.strikeCount - 1) % STRIKE_HISTORY];
  }

  /** The most recent strokes, newest last. A fixed ring; never reallocated. */
  get recentStrikes(): readonly Readonly<LightningStrike>[] {
    return this.strikePool;
  }

  /**
   * Subscribe to strokes as they happen. The audio system holds one of these for the life of the
   * session and schedules the thunder against `thunderDelaySeconds`.
   */
  onLightning(listener: LightningListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(_dt: number, engine: Engine): void {
    const world = engine.world;
    const settings = engine.settings;
    const camera = engine.camera.position;

    this.model.setLatitude(settings.world.latitudeDeg);
    this.model.setOverride(settings.world.weatherOverride);

    // Driven by the *world* clock rather than the frame clock, so weather and sky stay in step
    // when the debug panel scales time. Clamped because a jump in the clock is a cut, and the
    // weather should arrive at the new moment rather than sweep through everything in between.
    const seconds = Math.min(30, Math.max(0, engine.time.deltaMs / 1000));
    this.model.step(seconds, camera.x, camera.z);

    const current = this.model.current;
    world.windX = current.windX;
    world.windZ = current.windZ;
    world.windSpeed = current.windSpeed;
    world.windDirection = current.windDirection;
    world.cloudiness = current.cloudiness;
    world.precipitation = current.precipitation;
    world.visibility = current.visibilityM;
    world.pressureHpa = current.pressureHpa;
    world.fetchKm = this.model.fetch;

    // The airmass sets the temperature and the sun modulates it. Two and a half degrees between
    // dawn and mid-afternoon is about right over open water, where the sea's heat capacity does
    // most of the damping; it matters because the refraction model reads this number.
    const dayFactor = world.ephemeris?.dayFactor ?? 0.5;
    world.temperatureC = current.temperatureC + 2.5 * (dayFactor - 0.5);

    this.updateForecast(seconds, camera.x, camera.z);
    this.updateLightning(seconds, camera.x, camera.y, camera.z);

    const family = this.model.descriptor.family;
    if (family !== this.family) {
      this.family = family;
      this.sky ??= engine.get<Sky>('sky');
      this.sky?.setWeather(family);
    }
  }

  dispose(): void {
    this.scene.remove(this.flashLight);
    this.flashLight.dispose();
    this.listeners.clear();
  }

  /** The forecast is recomputed on a slow cadence and counted down between recomputations. */
  private updateForecast(seconds: number, x: number, z: number): void {
    this.forecastCountdown -= seconds;
    if (this.forecastCountdown <= 0) {
      this.forecastCountdown = 4;
      this.model.forecast(x, z, this.warning);
      return;
    }
    if (this.warning.approaching) {
      this.warning.minutesAway = Math.max(0, this.warning.minutesAway - seconds / 60);
    }
  }

  /**
   * Strokes arrive as a Poisson process whose rate is the storm's own instability, so a cell
   * that is only just convective flickers every half minute and a mature one is almost
   * continuous. The double flash is the leader and the return stroke: they are seventy
   * milliseconds apart, which is exactly slow enough for the eye to see two of them.
   */
  private updateLightning(seconds: number, cameraX: number, cameraY: number, cameraZ: number): void {
    this.flash *= Math.exp(-seconds / 0.11);
    if (this.flash < 1e-3) this.flash = 0;

    if (this.restrikeCountdown >= 0) {
      this.restrikeCountdown -= seconds;
      if (this.restrikeCountdown < 0) this.flash = Math.max(this.flash, this.restrikeIntensity);
    }

    const sample = this.model.current;
    const rate =
      MAX_STRIKE_RATE * sample.instability * smoothstep(0.3, 0.75, sample.precipitation);
    if (rate > 1e-4) {
      this.strikeCountdown -= seconds * rate;
      if (this.strikeCountdown <= 0) {
        // Exponential waiting time, which is what a Poisson process actually has: the gaps are
        // clustered, not evenly spaced, and that irregularity is most of what sells a storm.
        this.strikeCountdown = -Math.log(Math.max(1e-6, 1 - this.random.next()));
        this.emitStrike(cameraX, cameraY, cameraZ);
      }
    }

    if (this.flash > 0) {
      const strike = this.lastStrike;
      if (strike !== undefined) {
        this.flashLight.position.set(strike.x, FLASH_HEIGHT_M, strike.z);
        this.flashLight.intensity = FLASH_INTENSITY_CD * this.flash;
        this.flashLight.visible = true;
        return;
      }
    }
    this.flashLight.visible = false;
  }

  private emitStrike(cameraX: number, cameraY: number, cameraZ: number): void {
    const slot = this.strikePool[this.strikeCount % STRIKE_HISTORY];
    this.strikeCount += 1;
    if (slot === undefined) return;

    // Strikes are placed on an annulus around the listener rather than uniformly over a disc:
    // uniform placement puts almost everything at the far edge, and a storm you can only ever
    // hear rumbling on the horizon is not the storm the state is named after.
    const bearing = this.random.next() * Math.PI * 2;
    const distance = 350 + this.random.next() * this.random.next() * 9000;
    slot.x = cameraX + Math.sin(bearing) * distance;
    slot.y = 0;
    slot.z = cameraZ + Math.cos(bearing) * distance;
    slot.intensity = 0.55 + 0.45 * this.random.next();
    slot.distanceM = Math.hypot(slot.x - cameraX, cameraY, slot.z - cameraZ);
    slot.thunderDelaySeconds = slot.distanceM / SPEED_OF_SOUND;

    // Distant strokes are dimmer on screen because they are behind more air and more rain, not
    // because they are smaller. Koschmieder again, with the visibility the model just produced.
    const seen = Math.exp((-3.912 / Math.max(500, this.model.current.visibilityM)) * distance);
    this.flash = Math.max(this.flash, slot.intensity * (0.25 + 0.75 * seen));
    this.restrikeIntensity = this.flash * 0.55;
    this.restrikeCountdown = RESTRIKE_DELAY;

    for (const listener of this.listeners) listener(slot);
  }
}
