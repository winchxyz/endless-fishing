import { clamp, smoothstep } from '../math/Noise.js';

/**
 * The numbers behind the sound, and the pure functions that shape them.
 *
 * `AudioBeds.ts` owns the graph — the nodes, the buses, the update paths. This file owns the
 * tuning: every threshold, gain, corner frequency and rate the beds are driven by, and the handful
 * of mappings from a world quantity to a synthesis parameter.
 *
 * It imports nothing but `math/Noise.js`, and that is a constraint rather than an accident. Web
 * Audio does not exist in node and neither does `vite-plugin-glsl`, so anything that reaches a
 * `.vert` or an `AudioContext` cannot be unit-tested; keeping the arithmetic here means
 * `test/audio.test.ts` can import and check it without a browser.
 */

// ------------------------------------------------------------------------------ the sea

/** Significant wave height at which the sea bed is at full level, metres. */
export const SEA_FULL_HS_M = 5;
/** A flat calm is not silent — there is always water working against a hull. */
const SEA_FLOOR_GAIN = 0.032;
const SEA_RUMBLE_GAIN = 0.2;
export const SEA_RUMBLE_HZ = 130;
export const SEA_RUMBLE_SPAN_HZ = 190;
export const SEA_WASH_FLOOR_GAIN = 0.018;
export const SEA_WASH_GAIN = 0.11;
export const SEA_WASH_HZ = 480;

/**
 * Whitecaps appear at force 4 and cover the sea by force 7–8. That is the observational
 * definition of the scale rather than a fade chosen by ear, and it is why the hiss of breaking
 * crests is genuinely absent from a force 3 day instead of merely quiet.
 */
const WHITECAP_ONSET_BF = 3.6;
const WHITECAP_FULL_BF = 7.5;
const WHITECAP_GAIN = 0.15;
export const WHITECAP_HZ = 2100;
export const WHITECAP_SPAN_HZ = 1500;

// ------------------------------------------------------------------------------ the wind

export const WIND_FULL_MS = 22;
export const WIND_BED_FLOOR_GAIN = 0.01;
export const WIND_BED_GAIN = 0.14;
export const WIND_BED_HZ = 210;
/** Centre frequency of the broadband bed per m/s: faster air, smaller eddies, brighter noise. */
export const WIND_BED_HZ_PER_MS = 62;

/**
 * Strouhal number for a circular cylinder in a cross-flow.
 *
 * Wind in rigging is not a hiss, it is a *tone*: a wire sheds vortices alternately off each side
 * at `f = St·U/d`, and that is the note you hear rising as it breezes up. Two diameters give two
 * peaks a fifth or so apart, which is what stops a single resonance sounding like a filter sweep.
 */
const STROUHAL = 0.2;
export const SHROUD_DIAMETER_M = 0.006;
export const HALYARD_DIAMETER_M = 0.0032;
export const SHROUD_Q = 7;
export const HALYARD_Q = 9;
export const SING_ONSET_MS = 4;
export const SING_FULL_MS = 17;
export const SING_GAIN = 0.052;
/** The tone is only meaningful inside the range a biquad can resolve without ringing. */
export const SING_MIN_HZ = 90;
const SING_MAX_HZ = 3600;

// ------------------------------------------------------------------------------ the rain

export const RAIN_HISS_GAIN = 0.3;
export const RAIN_HISS_HZ = 1600;
export const RAIN_HISS_SPAN_HZ = 5200;
export const RAIN_DECK_GAIN = 0.15;
export const RAIN_DECK_HZ = 190;

// ------------------------------------------------------------------------------ the engine

export const IDLE_RPM = 700;
export const MAX_RPM = 2450;
/** How fast the engine answers the throttle, s⁻¹. A marine diesel is not a motorcycle. */
export const RPM_RATE = 1.7;
/** Governor droop: a loaded engine runs slower than the same throttle unloaded. */
export const RPM_DROOP = 0.16;
/** Four-stroke four, so two power strokes per revolution. */
const CYLINDERS = 4;
/** Design speed of the hull, knots. `Boat` sizes its thrust for this. */
export const TOP_SPEED_KNOTS = 8;
export const ENGINE_IDLE_GAIN = 0.03;
export const ENGINE_GAIN = 0.085;
/** Modulation index at no load and the span added by load — the whole idle-to-labouring range. */
export const ENGINE_INDEX_MIN = 1.6;
export const ENGINE_INDEX_SPAN = 4.6;
export const EXHAUST_FLOOR_GAIN = 0.016;
export const EXHAUST_GAIN = 0.055;
/** Wet exhaust: a low box of noise whose corner rides three harmonics above the firing rate. */
export const EXHAUST_BASE_HZ = 90;
export const EXHAUST_HZ_PER_FIRING = 3;
/** How quickly the engine dies when the anchor goes down, s⁻¹. */
export const ENGINE_STOP_RATE = 1.1;

// ------------------------------------------------------------------------------ the hull slap

/**
 * Vertical acceleration that counts as a landing rather than as heave, m/s².
 *
 * Deliberately above the camera's own slam threshold of 11: a twitch of the shot is cheap and can
 * afford to fire on the merely lively, but a bang is expensive and firing one on ordinary heave
 * turns a force 6 sea into a drum solo. 1.4 g upward is the hull being stopped by water, not
 * lifted by it. The release threshold is the Schmitt half of the trigger — the accelerometer rings
 * for several steps after an impact, and without hysteresis one landing is three bangs.
 */
const SLAM_THRESHOLD_MS2 = 14;
export const SLAM_RELEASE_MS2 = 8;
const SLAM_FULL_SCALE_MS2 = 26;
/** Shortest gap between two slams, seconds. A hull cannot land twice in a quarter of a second. */
export const SLAM_REARM_S = 0.25;

// ------------------------------------------------------------------------------ under water

/** How far the above-water beds are pulled down when the camera goes under. */
export const SUBMERGED_DUCK = 0.72;
export const SUBMERGED_GAIN = 0.14;
export const SUBMERGED_HZ = 220;

// ------------------------------------------------------------------------------ the tackle

/** Rate of line loss that pins the drag, m/s. */
export const DRAG_FULL_MPS = 1.6;
export const DRAG_GAIN = 0.17;
export const DRAG_BASE_HZ = 700;
export const DRAG_SPAN_HZ = 1500;
export const DRAG_Q = 6;
export const DRAG_RESPONSE = 8;

// ------------------------------------------------------------------------------ the thunder

const THUNDER_CRACK_GAIN = 0.85;
/**
 * Distance over which the crack is absorbed, metres.
 *
 * Air absorption is steeply frequency dependent, so the sharp edge of a stroke is gone within a
 * kilometre or two while the low end survives for tens. That single fact is the whole difference
 * between a crack and a rumble, and it is why this is two sounds and not one with a volume knob.
 */
const CRACK_ABSORPTION_M = 850;
const THUNDER_RUMBLE_GAIN = 0.75;
/** Spherical spreading reference: the rumble falls as 1/(1 + d/d₀). */
const RUMBLE_REFERENCE_M = 1100;
const THUNDER_NEAR_CUTOFF_HZ = 1400;
const THUNDER_MIN_CUTOFF_HZ = 55;
const THUNDER_ABSORPTION_SCALE_M = 3000;
/**
 * The rumble's length.
 *
 * A stroke is a channel several kilometres long, so the sound from its near and far ends reaches
 * the ear seconds apart, and the further away the whole channel is the more of that spread is
 * audible. Hence a duration that grows with distance rather than a fixed tail.
 */
const THUNDER_MIN_DECAY_S = 0.35;
const THUNDER_DECAY_PER_M = 0.00055;
const THUNDER_MAX_DECAY_S = 6;
/** Height the report is placed at, metres. Panning is direction only; distance is modelled here. */
export const THUNDER_HEIGHT_M = 300;
export const THUNDER_PANNERS = 4;
export const THUNDER_REVERB_SEND = 0.5;
/**
 * How much of the above-water mix is sent to the reverb.
 *
 * Small, because open water has almost nothing to reflect off. It is not there to make a room; it
 * is there because the impulse response is stereo and the noise buffers are mono, and without it
 * the entire sea sits in a point between the player's ears.
 */
export const AIR_REVERB_SEND = 0.18;

// ------------------------------------------------------------------------------ pure mappings

/**
 * Level of the low bed, from the significant wave height.
 *
 * The square root is the ear's, not the sea's: radiated power grows roughly with the energy in the
 * surface, and loudness with the logarithm of power, so a linear map makes a gale forty times
 * louder than a chop and everything below force 6 inaudible.
 */
export function seaRumbleGain(significantWaveHeight: number): number {
  const normalised = clamp(significantWaveHeight / SEA_FULL_HS_M, 0, 1);
  return SEA_FLOOR_GAIN + SEA_RUMBLE_GAIN * Math.sqrt(normalised);
}

/** Level of the breaking-crest hiss. Zero below force 4, because whitecaps are. */
export function whitecapGain(beaufort: number): number {
  return WHITECAP_GAIN * smoothstep(WHITECAP_ONSET_BF, WHITECAP_FULL_BF, beaufort);
}

/** Vortex-shedding frequency of a wire of this diameter in this wind, Hz. */
export function riggingFrequency(windSpeedMps: number, diameterM: number): number {
  const raw = (STROUHAL * Math.max(0, windSpeedMps)) / Math.max(1e-4, diameterM);
  return clamp(raw, SING_MIN_HZ, SING_MAX_HZ);
}

/** Firing frequency of the engine, Hz. Every audible partial is a harmonic of this. */
export function engineFiringHz(rpm: number): number {
  return (Math.max(0, rpm) / 60) * (CYLINDERS / 2);
}

/**
 * Loudness of a landing, 0 for anything that is merely heave.
 *
 * The exponent compresses the top of the range: past about two and a half g the difference between
 * a hard landing and a very hard one is in the spectrum rather than in the level.
 */
export function slamAmplitude(verticalAccelerationMs2: number): number {
  const impact = verticalAccelerationMs2 - SLAM_THRESHOLD_MS2;
  if (impact <= 0) return 0;
  return Math.pow(clamp(impact / SLAM_FULL_SCALE_MS2, 0, 1), 0.7);
}

/** How a stroke sounds from here. Filled in place; the handler holds one and reuses it. */
export interface ThunderProfile {
  /** Peak level of the initial report. Effectively zero past a couple of kilometres. */
  crackGain: number;
  /** Peak level of the rumble that follows it. Still audible at ten kilometres. */
  rumbleGain: number;
  /** Corner frequency of the rumble, Hz. This is the number that says "far away". */
  cutoffHz: number;
  /** How long the rumble takes to die, seconds. */
  decayS: number;
}

export function createThunderProfile(): ThunderProfile {
  return { crackGain: 0, rumbleGain: 0, cutoffHz: THUNDER_NEAR_CUTOFF_HZ, decayS: THUNDER_MIN_DECAY_S };
}

/**
 * Turn a stroke's distance and energy into the two sounds it makes.
 *
 * The arrival *time* is not computed here: `Weather` already carries `thunderDelaySeconds` on the
 * strike, and recomputing it would mean a second copy of the speed of sound. What this owns is the
 * spectrum, which is the part that has to be got right — a strike at four hundred metres is a
 * crack with almost no tail, and one at eight kilometres is four seconds of low rumble with no
 * crack in it at all.
 */
export function thunderProfile(distanceM: number, intensity: number, out: ThunderProfile): void {
  const distance = Math.max(0, distanceM);
  const energy = clamp(intensity, 0, 1);
  out.crackGain = THUNDER_CRACK_GAIN * energy * Math.exp(-distance / CRACK_ABSORPTION_M);
  out.rumbleGain =
    THUNDER_RUMBLE_GAIN * energy * (RUMBLE_REFERENCE_M / (RUMBLE_REFERENCE_M + distance));
  out.cutoffHz = Math.max(
    THUNDER_MIN_CUTOFF_HZ,
    THUNDER_NEAR_CUTOFF_HZ * Math.exp(-distance / THUNDER_ABSORPTION_SCALE_M),
  );
  out.decayS = Math.min(THUNDER_MAX_DECAY_S, THUNDER_MIN_DECAY_S + distance * THUNDER_DECAY_PER_M);
}
