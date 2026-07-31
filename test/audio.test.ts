import { describe, expect, it } from 'vitest';
import {
  fillBrownNoise,
  fillImpulseResponse,
  fillPinkNoise,
  fillWhiteNoise,
  noteFrequency,
  normalisePeak,
  seamlessLoop,
} from '../src/core/Audio.js';
import {
  createThunderProfile,
  engineFiringHz,
  riggingFrequency,
  seaRumbleGain,
  slamAmplitude,
  thunderProfile,
  whitecapGain,
} from '../src/world/AudioCurves.js';
import { PRNG } from '../src/math/PRNG.js';

/**
 * The audio, validated without a browser.
 *
 * There is no `AudioContext` in node, so nothing here touches one. What can be tested is the half
 * that decides *what* the graph should be doing: the noise generators that fill the looping
 * buffers, and the mappings from world state to gain, frequency and duration. Both halves are
 * deliberately pure functions for exactly this reason.
 *
 * The claims below are the ones that would be either inaudible as bugs or maddening as artefacts:
 * a noise buffer with a seam in it ticks once every four seconds forever, a whitecap hiss that
 * does not actually vanish below force 4 flattens the entire weather system into one texture, and
 * a thunder profile that does not get duller with distance turns a storm eight kilometres away
 * into one happening inside the wheelhouse.
 */

/** Mean-square of a signal — the only honest measure of "how loud" a noise buffer is. */
function power(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }
  return sum / Math.max(1, samples.length);
}

/** Power above roughly a quarter of Nyquist, by way of a one-pole highpass difference. */
function highBandPower(samples: Float32Array): number {
  let sum = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const difference = (samples[i] ?? 0) - (samples[i - 1] ?? 0);
    sum += difference * difference;
  }
  return sum / Math.max(1, samples.length - 1);
}

describe('noise generators', () => {
  it('normalises to an exact peak and leaves silence alone', () => {
    const samples = new Float32Array([0.1, -0.4, 0.2]);
    normalisePeak(samples, 0.8);
    // Six places, not twelve: these are Float32Array, and the buffers the engine hands to Web
    // Audio are too, so single precision is the honest tolerance everywhere in this file.
    expect(Math.max(...Array.from(samples, Math.abs))).toBeCloseTo(0.8, 6);

    const silence = new Float32Array(8);
    normalisePeak(silence, 0.9);
    expect(Array.from(silence).every((value) => value === 0)).toBe(true);
  });

  it('produces finite, bounded noise of every colour', () => {
    for (const fill of [fillWhiteNoise, fillPinkNoise, fillBrownNoise]) {
      const samples = new Float32Array(8192);
      fill(samples, new PRNG(0x1234_5678));
      for (let i = 0; i < samples.length; i += 1) {
        const value = samples[i] ?? Number.NaN;
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThanOrEqual(1);
      }
      expect(power(samples)).toBeGreaterThan(1e-4);
    }
  });

  it('gets darker from white through pink to brown', () => {
    const size = 1 << 15;
    const white = new Float32Array(size);
    const pink = new Float32Array(size);
    const brown = new Float32Array(size);
    fillWhiteNoise(white, new PRNG(0x2222_3333));
    fillPinkNoise(pink, new PRNG(0x2222_3333));
    fillBrownNoise(brown, new PRNG(0x2222_3333));

    // Normalised to equal total power, so this compares spectral tilt and not level.
    const tilt = (samples: Float32Array): number => highBandPower(samples) / power(samples);
    expect(tilt(pink)).toBeLessThan(tilt(white));
    expect(tilt(brown)).toBeLessThan(tilt(pink));
  });

  it('joins a loop without a step at the seam', () => {
    const fade = 256;
    const length = 4096;
    const source = new Float32Array(length + fade);
    fillPinkNoise(source, new PRNG(0x0bad_c0de));

    const looped = new Float32Array(length);
    seamlessLoop(source, looped, fade);

    // The seam is the join from the last sample back to the first. A cut buffer steps by roughly
    // the full amplitude there; a cross-faded one steps by no more than an ordinary neighbouring
    // pair does anywhere else in the buffer.
    let worstInterior = 0;
    for (let i = 1; i < length; i += 1) {
      worstInterior = Math.max(worstInterior, Math.abs((looped[i] ?? 0) - (looped[i - 1] ?? 0)));
    }
    const seam = Math.abs((looped[0] ?? 0) - (looped[length - 1] ?? 0));
    expect(seam).toBeLessThanOrEqual(worstInterior);
  });

  it('builds an impulse response that decays and darkens', () => {
    const sampleRate = 48000;
    const length = sampleRate;
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    fillImpulseResponse(left, right, sampleRate, 1, new PRNG(0x5150_5150));

    const head = left.subarray(0, length >> 3);
    const tail = left.subarray(length - (length >> 3));
    expect(power(head)).toBeGreaterThan(power(tail) * 100);
    // The two channels are independent noise, which is what makes the tail stereo rather than a
    // mono reverb played twice.
    expect(left[100]).not.toBe(right[100]);
  });

  it('puts A4 at 440 Hz and an octave at twice the frequency', () => {
    expect(noteFrequency(69)).toBeCloseTo(440, 9);
    expect(noteFrequency(81) / noteFrequency(69)).toBeCloseTo(2, 9);
  });
});

describe('sea and wind mappings', () => {
  it('never goes completely silent, and rises with the sea', () => {
    expect(seaRumbleGain(0)).toBeGreaterThan(0);
    let previous = seaRumbleGain(0);
    for (let hs = 0.25; hs <= 8; hs += 0.25) {
      const gain = seaRumbleGain(hs);
      expect(gain).toBeGreaterThanOrEqual(previous);
      previous = gain;
    }
    // Saturating rather than unbounded: a force 10 sea must not be able to open the compressor up.
    expect(seaRumbleGain(40)).toBe(seaRumbleGain(5));
  });

  it('has no whitecap hiss below force 4 and full hiss by force 8', () => {
    expect(whitecapGain(0)).toBe(0);
    expect(whitecapGain(3)).toBe(0);
    expect(whitecapGain(5)).toBeGreaterThan(0);
    expect(whitecapGain(8)).toBeGreaterThan(whitecapGain(5));
    expect(whitecapGain(12)).toBe(whitecapGain(8));
  });

  it('sings the Strouhal frequency, higher on a thinner wire', () => {
    const shroud = riggingFrequency(12, 0.006);
    // St · U / d = 0.2 · 12 / 0.006 = 400 Hz.
    expect(shroud).toBeCloseTo(400, 6);
    expect(riggingFrequency(12, 0.003)).toBeGreaterThan(shroud);
    expect(riggingFrequency(24, 0.006)).toBeGreaterThan(shroud);
    // Clamped into the range a biquad can hold, so a dead calm is not a 0 Hz filter.
    expect(riggingFrequency(0, 0.006)).toBeGreaterThan(0);
    expect(riggingFrequency(400, 0.001)).toBeLessThan(20000);
  });
});

describe('engine and hull mappings', () => {
  it('fires twice a revolution', () => {
    expect(engineFiringHz(0)).toBe(0);
    expect(engineFiringHz(1500)).toBeCloseTo(50, 9);
    expect(engineFiringHz(3000)).toBeCloseTo(100, 9);
  });

  it('ignores ordinary heave and scales with the impact', () => {
    // Free fall is 9.81 m/s² and a lively sea is a few more; none of that is a landing.
    expect(slamAmplitude(9.81)).toBe(0);
    expect(slamAmplitude(13.9)).toBe(0);
    expect(slamAmplitude(16)).toBeGreaterThan(0);
    expect(slamAmplitude(24)).toBeGreaterThan(slamAmplitude(16));
    expect(slamAmplitude(1000)).toBeLessThanOrEqual(1);
    expect(slamAmplitude(1000)).toBeCloseTo(1, 9);
  });
});

describe('thunder', () => {
  it('is a crack near to and a rumble far from the boat', () => {
    const near = createThunderProfile();
    const far = createThunderProfile();
    thunderProfile(400, 1, near);
    thunderProfile(8000, 1, far);

    // The crack is an entirely local phenomenon: air absorption has eaten it long before eight
    // kilometres, which is the whole reason distant thunder has no edge on it.
    expect(near.crackGain).toBeGreaterThan(0.4);
    expect(far.crackGain).toBeLessThan(1e-3);

    // The rumble survives, quieter, much lower and far longer.
    expect(far.rumbleGain).toBeGreaterThan(0);
    expect(far.rumbleGain).toBeLessThan(near.rumbleGain);
    expect(near.cutoffHz).toBeGreaterThan(800);
    expect(far.cutoffHz).toBeLessThan(150);
    expect(far.decayS).toBeGreaterThan(near.decayS * 4);
  });

  it('gets steadily duller, quieter and longer with distance', () => {
    const profile = createThunderProfile();
    let previousCutoff = Number.POSITIVE_INFINITY;
    let previousGain = Number.POSITIVE_INFINITY;
    let previousDecay = 0;
    for (let distance = 0; distance <= 12000; distance += 250) {
      thunderProfile(distance, 1, profile);
      expect(profile.cutoffHz).toBeLessThanOrEqual(previousCutoff);
      expect(profile.rumbleGain).toBeLessThanOrEqual(previousGain);
      expect(profile.decayS).toBeGreaterThanOrEqual(previousDecay);
      expect(profile.decayS).toBeLessThanOrEqual(6);
      expect(profile.cutoffHz).toBeGreaterThanOrEqual(55);
      previousCutoff = profile.cutoffHz;
      previousGain = profile.rumbleGain;
      previousDecay = profile.decayS;
    }
  });

  it('scales with the energy of the stroke and never exceeds unity gain', () => {
    const weak = createThunderProfile();
    const strong = createThunderProfile();
    thunderProfile(1000, 0.3, weak);
    thunderProfile(1000, 1, strong);
    expect(weak.rumbleGain).toBeLessThan(strong.rumbleGain);
    expect(weak.crackGain).toBeLessThan(strong.crackGain);
    expect(strong.crackGain).toBeLessThanOrEqual(1);
    expect(strong.rumbleGain).toBeLessThanOrEqual(1);
  });
});
