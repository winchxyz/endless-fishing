import { PRNG } from '../math/PRNG.js';
import type { Settings } from './Settings.js';

/**
 * The Web Audio graph, and the synthesis toolkit every sound in the game is built from.
 *
 * Nothing here is a sample. That is partly a licensing convenience, but mostly it is the only
 * way the sea can respond *continuously* to sea state: a recorded ocean gives you three loops
 * and a cross-fade, and the cross-fade is audible every time the wind changes.
 *
 *   voices ─▶ [panner] ─▶ sfx ─┬───────────────────────────▶ muffle ─▶ comp ─▶ master ─▶ out
 *                              └▶ reverb send ─▶ convolver ─┘
 *   pad ──────────────────────▶ music ─────────────────────┘
 *
 * `muffle` is a lowpass that does nothing until the camera goes under. The compressor sits
 * *before* the master gain so the player's volume slider scales an already-controlled signal
 * rather than changing how hard the compressor works — otherwise turning the game down also
 * turns the dynamics up.
 */

export type NoiseKind = 'white' | 'pink' | 'brown';

/** Seconds of noise per looping buffer. Long enough that the loop period is not a rhythm. */
const NOISE_SECONDS = 4;
/** Cross-fade at the loop seam, seconds. */
const LOOP_FADE_SECONDS = 0.05;

const NOISE_SEEDS: Record<NoiseKind, number> = { white: 0x7a1e_3b05, pink: 0x9c33_11ad, brown: 0x4d81_7fe3 };

/** Lowest gain an exponential ramp may target; the curve is undefined at zero. */
const GAIN_FLOOR = 0.0001;

/** Cutoff of the master lowpass when the camera is fully submerged, Hz. */
const SUBMERGED_CUTOFF_HZ = 420;
const DRY_CUTOFF_HZ = 20000;

// ---------------------------------------------------------------------------------------------
// Pure generators. No AudioContext, no DOM — these are what the unit tests exercise.
// ---------------------------------------------------------------------------------------------

/** Uniform white noise in [-1, 1]. Flat power spectrum: 0 dB per octave. */
export function fillWhiteNoise(out: Float32Array, rng: PRNG): void {
  for (let i = 0; i < out.length; i += 1) out[i] = rng.next() * 2 - 1;
}

/**
 * Pink noise — Paul Kellett's seven-pole approximation, accurate to about ±0.3 dB from
 * 10 Hz to 20 kHz.
 *
 * A true 1/f filter has infinite order; this is a sum of one-pole lowpasses whose corner
 * frequencies are spaced to straddle the ideal slope. The alternative — synthesising in the
 * frequency domain and inverse-transforming — cannot be looped without a seam.
 */
export function fillPinkNoise(out: Float32Array, rng: PRNG): void {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  // The slowest pole has a time constant of thousands of samples, so the filter has to settle
  // before the first sample is kept or the buffer opens with an audible swell.
  const warmup = 4096;
  for (let i = -warmup; i < out.length; i += 1) {
    const white = rng.next() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const sample = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    if (i >= 0) out[i] = sample;
  }
  normalisePeak(out, 0.9);
}

/**
 * Brown noise — white integrated by a leaky one-pole, giving 1/f² above the leak corner
 * (about 0.003 of the sample rate, ~150 Hz at 48 kHz).
 *
 * The leak is what keeps it usable: a pure integrator random-walks away from zero and the
 * buffer ends up as a DC ramp with a little noise on it.
 */
export function fillBrownNoise(out: Float32Array, rng: PRNG): void {
  let state = 0;
  const warmup = 4096;
  for (let i = -warmup; i < out.length; i += 1) {
    const white = rng.next() * 2 - 1;
    state = (state + 0.02 * white) / 1.02;
    if (i >= 0) out[i] = state;
  }
  normalisePeak(out, 0.9);
}

/** Scale in place so the largest magnitude is `peak`. Silent buffers are left alone. */
export function normalisePeak(out: Float32Array, peak: number): void {
  let max = 0;
  for (let i = 0; i < out.length; i += 1) {
    const value = Math.abs(out[i] ?? 0);
    if (value > max) max = value;
  }
  if (max <= 0) return;
  const scale = peak / max;
  for (let i = 0; i < out.length; i += 1) out[i] = (out[i] ?? 0) * scale;
}

/**
 * Turn `source` (length `out.length + fade`) into a seamless loop in `out`.
 *
 * The extra `fade` samples past the end are cross-faded over the head, so the sample that
 * follows `out[n-1]` on the next lap is the one that genuinely followed it in the source.
 * Weights are cos/sin rather than linear because the two halves are uncorrelated noise, and
 * only an equal-*power* fade keeps the variance — and so the loudness — constant across the seam.
 */
export function seamlessLoop(source: Float32Array, out: Float32Array, fade: number): void {
  const n = out.length;
  for (let i = 0; i < n; i += 1) out[i] = source[i] ?? 0;
  const overlap = Math.min(fade, n);
  for (let i = 0; i < overlap; i += 1) {
    const t = (i / overlap) * Math.PI * 0.5;
    out[i] = (source[n + i] ?? 0) * Math.cos(t) + (source[i] ?? 0) * Math.sin(t);
  }
}

/**
 * A convolution reverb impulse: decaying noise, progressively darkened.
 *
 * Open water has almost no reflectors, so this is deliberately short and quiet — it stands in
 * for scattering off the sea surface and the haze, and it exists mainly so that thunder and the
 * foghorn have somewhere to roll away to.
 */
export function fillImpulseResponse(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  decaySeconds: number,
  rng: PRNG,
): void {
  let lowLeft = 0;
  let lowRight = 0;
  const total = Math.min(left.length, right.length);
  for (let i = 0; i < total; i += 1) {
    const t = i / sampleRate / decaySeconds;
    const envelope = Math.pow(Math.max(0, 1 - t), 2.6);
    // High frequencies are absorbed by air fastest, so the tail must get darker as it decays.
    // A fixed cutoff gives the metallic ring that betrays a synthetic reverb instantly.
    const coefficient = 0.65 * (1 - t) + 0.04;
    lowLeft += ((rng.next() * 2 - 1) * envelope - lowLeft) * coefficient;
    lowRight += ((rng.next() * 2 - 1) * envelope - lowRight) * coefficient;
    left[i] = lowLeft;
    right[i] = lowRight;
  }
  normalisePeak(left, 0.7);
  normalisePeak(right, 0.7);
}

/** Equal-tempered frequency of a MIDI note number. */
export function noteFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// ---------------------------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------------------------

export interface NoiseVoiceOptions {
  kind: NoiseKind;
  filter?: BiquadFilterType;
  frequency?: number;
  q?: number;
  gain?: number;
  /** Loop playback rate. Below 1 drags the whole spectrum down without a second buffer. */
  rate?: number;
  destination?: AudioNode;
}

/**
 * A continuously running filtered-noise layer.
 *
 * Every parameter moves with `setTargetAtTime` rather than a ramp: the beds push new targets
 * every frame from world state, and a first-order approach to a moving target is both free of
 * zipper noise and immune to the scheduling races that per-frame ramps get into.
 */
export class NoiseVoice {
  private readonly source: AudioBufferSourceNode;
  private readonly filter: BiquadFilterNode;
  private readonly amp: GainNode;
  private readonly context: BaseAudioContext;
  private running = false;

  constructor(context: BaseAudioContext, buffer: AudioBuffer, options: NoiseVoiceOptions, fallback: AudioNode) {
    this.context = context;
    this.source = context.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.source.playbackRate.value = options.rate ?? 1;

    this.filter = context.createBiquadFilter();
    this.filter.type = options.filter ?? 'lowpass';
    this.filter.frequency.value = options.frequency ?? 800;
    this.filter.Q.value = options.q ?? 0.7;

    this.amp = context.createGain();
    this.amp.gain.value = options.gain ?? 0;

    this.source.connect(this.filter);
    this.filter.connect(this.amp);
    this.amp.connect(options.destination ?? fallback);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // A random start offset stops several layers built from the same buffer phase-locking into
    // a single louder copy of it.
    this.source.start(0, Math.random() * (this.source.buffer?.duration ?? 1));
  }

  setGain(value: number, timeConstant = 0.15): void {
    this.amp.gain.setTargetAtTime(Math.max(0, value), this.context.currentTime, timeConstant);
  }

  setFrequency(hz: number, timeConstant = 0.25): void {
    this.filter.frequency.setTargetAtTime(Math.max(10, hz), this.context.currentTime, timeConstant);
  }

  setQ(q: number): void {
    this.filter.Q.setTargetAtTime(Math.max(0.05, q), this.context.currentTime, 0.2);
  }

  setRate(rate: number, timeConstant = 0.4): void {
    this.source.playbackRate.setTargetAtTime(Math.max(0.05, rate), this.context.currentTime, timeConstant);
  }

  dispose(): void {
    if (this.running) this.source.stop();
    this.source.disconnect();
    this.filter.disconnect();
    this.amp.disconnect();
    this.running = false;
  }
}

export interface FmVoiceOptions {
  carrier?: number;
  /** Modulator frequency as a multiple of the carrier. Integer ratios stay harmonic. */
  ratio?: number;
  index?: number;
  gain?: number;
  carrierType?: OscillatorType;
  modulatorType?: OscillatorType;
  destination?: AudioNode;
}

/**
 * Two-operator FM. The engine note is this and nothing else: modulation index is the whole
 * difference between an idling diesel and one under load, and no filter sweep imitates it.
 */
export class FmVoice {
  private readonly carrier: OscillatorNode;
  private readonly modulator: OscillatorNode;
  private readonly modGain: GainNode;
  private readonly amp: GainNode;
  private readonly context: BaseAudioContext;
  private ratio: number;
  private index: number;
  private frequency: number;
  private running = false;

  constructor(context: BaseAudioContext, options: FmVoiceOptions, fallback: AudioNode) {
    this.context = context;
    this.frequency = options.carrier ?? 110;
    this.ratio = options.ratio ?? 2;
    this.index = options.index ?? 1;

    this.carrier = context.createOscillator();
    this.carrier.type = options.carrierType ?? 'sine';
    this.carrier.frequency.value = this.frequency;

    this.modulator = context.createOscillator();
    this.modulator.type = options.modulatorType ?? 'sine';
    this.modulator.frequency.value = this.frequency * this.ratio;

    this.modGain = context.createGain();
    this.modGain.gain.value = this.frequency * this.ratio * this.index;

    this.amp = context.createGain();
    this.amp.gain.value = options.gain ?? 0;

    this.modulator.connect(this.modGain);
    this.modGain.connect(this.carrier.frequency);
    this.carrier.connect(this.amp);
    this.amp.connect(options.destination ?? fallback);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.carrier.start();
    this.modulator.start();
  }

  setFrequency(hz: number, timeConstant = 0.08): void {
    this.frequency = Math.max(1, hz);
    const now = this.context.currentTime;
    this.carrier.frequency.setTargetAtTime(this.frequency, now, timeConstant);
    this.modulator.frequency.setTargetAtTime(this.frequency * this.ratio, now, timeConstant);
    this.modGain.gain.setTargetAtTime(this.frequency * this.ratio * this.index, now, timeConstant);
  }

  setIndex(index: number, timeConstant = 0.12): void {
    this.index = Math.max(0, index);
    this.modGain.gain.setTargetAtTime(
      this.frequency * this.ratio * this.index,
      this.context.currentTime,
      timeConstant,
    );
  }

  setGain(value: number, timeConstant = 0.1): void {
    this.amp.gain.setTargetAtTime(Math.max(0, value), this.context.currentTime, timeConstant);
  }

  dispose(): void {
    if (this.running) {
      this.carrier.stop();
      this.modulator.stop();
    }
    this.carrier.disconnect();
    this.modulator.disconnect();
    this.modGain.disconnect();
    this.amp.disconnect();
    this.running = false;
  }
}

export interface BurstOptions {
  kind?: NoiseKind;
  filter?: BiquadFilterType;
  frequency?: number;
  /** Cutoff at the end of the burst. Omit to hold `frequency`. */
  sweepTo?: number;
  q?: number;
  gain?: number;
  attack?: number;
  decay?: number;
  rate?: number;
  destination?: AudioNode;
  /** Absolute context time. Omit for "now". */
  when?: number;
}

export interface ToneOptions {
  frequency: number;
  sweepTo?: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  decay?: number;
  filter?: BiquadFilterType;
  filterFrequency?: number;
  q?: number;
  destination?: AudioNode;
  when?: number;
}

/**
 * Percussive envelope on a gain param, returning the time it finishes.
 *
 * Both ramps are exponential and floored at `GAIN_FLOOR`: a linear release makes a struck
 * sound seem switched off rather than decayed, and an exponential ramp to exactly zero is
 * undefined and silently kills the whole automation curve.
 */
function scheduleEnvelope(param: AudioParam, start: number, peak: number, attack: number, decay: number): number {
  const top = Math.max(GAIN_FLOOR * 2, peak);
  param.setValueAtTime(GAIN_FLOOR, start);
  param.exponentialRampToValueAtTime(top, start + attack);
  param.exponentialRampToValueAtTime(GAIN_FLOOR, start + attack + decay);
  return start + attack + decay;
}

export class AudioEngine {
  readonly context: AudioContext;
  /** Everything that is not music. Beds connect voices here, or to a panner that lands here. */
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  /** Input of the convolver. Route a send gain here for a wetter voice. */
  readonly reverbInput: AudioNode;

  private readonly masterGain: GainNode;
  private readonly muffle: BiquadFilterNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly convolver: ConvolverNode;
  private readonly settings: Settings;
  private readonly unsubscribe: () => void;
  private readonly noiseBuffers = new Map<NoiseKind, AudioBuffer>();
  private readonly resumeHandler: () => void;
  private duck = 1;
  private disposed = false;

  /** Null when the browser has no Web Audio at all; the beds then run as a no-op. */
  static create(settings: Settings): AudioEngine | null {
    if (typeof AudioContext === 'undefined') return null;
    return new AudioEngine(settings);
  }

  private constructor(settings: Settings) {
    this.settings = settings;
    // 'interactive' asks for the smallest buffer the device will give us. Hull slaps are
    // triggered from the physics and a 100 ms latency reads as the boat landing twice.
    this.context = new AudioContext({ latencyHint: 'interactive' });

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.context.destination);

    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.25;
    this.compressor.connect(this.masterGain);

    this.muffle = this.context.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = DRY_CUTOFF_HZ;
    this.muffle.Q.value = 0.7;
    this.muffle.connect(this.compressor);

    this.sfxBus = this.context.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.muffle);

    this.musicBus = this.context.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.muffle);

    this.convolver = this.context.createConvolver();
    this.convolver.buffer = this.buildImpulseResponse(1.9);
    this.convolver.connect(this.muffle);
    this.reverbInput = this.convolver;

    const listener = this.context.listener;
    listener.forwardZ.value = -1;
    listener.upY.value = 1;

    this.applySettings();
    this.unsubscribe = settings.onChange((_all, changed) => {
      if (changed === 'audio') this.applySettings();
    });

    this.resumeHandler = (): void => {
      this.resume();
    };
    this.installGestureListeners();
  }

  /** Current audio-clock time, seconds. The only clock one-shots may be scheduled against. */
  now(): number {
    return this.context.currentTime;
  }

  get running(): boolean {
    return this.context.state === 'running';
  }

  noiseBuffer(kind: NoiseKind): AudioBuffer {
    const cached = this.noiseBuffers.get(kind);
    if (cached !== undefined) return cached;
    const built = this.buildNoise(kind);
    this.noiseBuffers.set(kind, built);
    return built;
  }

  createNoiseVoice(options: NoiseVoiceOptions): NoiseVoice {
    return new NoiseVoice(this.context, this.noiseBuffer(options.kind), options, this.sfxBus);
  }

  createFmVoice(options: FmVoiceOptions): FmVoice {
    return new FmVoice(this.context, options, this.sfxBus);
  }

  /**
   * A positional node in world space, already connected to the SFX bus.
   *
   * The defaults describe a room. Ours is open water, so the reference distance is large and
   * the rolloff gentle: a gull at eighty metres has to be quiet but still clearly *placed*,
   * and the room default puts it below the sea noise long before it is out of sight.
   */
  createPanner(): PannerNode {
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 12;
    panner.maxDistance = 4000;
    panner.rolloffFactor = 0.9;
    panner.connect(this.sfxBus);
    return panner;
  }

  /** A gain feeding the reverb, for voices that need a longer tail than the default send. */
  createReverbSend(amount: number): GainNode {
    const send = this.context.createGain();
    send.gain.value = amount;
    send.connect(this.convolver);
    return send;
  }

  /** Place a panner in world space. Uses the AudioParam API, not the deprecated setters. */
  setPosition(panner: PannerNode, x: number, y: number, z: number): void {
    const time = this.context.currentTime;
    panner.positionX.setValueAtTime(x, time);
    panner.positionY.setValueAtTime(y, time);
    panner.positionZ.setValueAtTime(z, time);
  }

  setListener(
    x: number,
    y: number,
    z: number,
    forwardX: number,
    forwardY: number,
    forwardZ: number,
  ): void {
    const listener = this.context.listener;
    const time = this.context.currentTime;
    // Ramped rather than set: on a boat the camera moves every frame, and stepping the
    // listener produces a click on every panned source at the frame rate.
    listener.positionX.setTargetAtTime(x, time, 0.02);
    listener.positionY.setTargetAtTime(y, time, 0.02);
    listener.positionZ.setTargetAtTime(z, time, 0.02);
    listener.forwardX.setTargetAtTime(forwardX, time, 0.05);
    listener.forwardY.setTargetAtTime(forwardY, time, 0.05);
    listener.forwardZ.setTargetAtTime(forwardZ, time, 0.05);
  }

  /** 0 = above water, 1 = fully under. Drives the master lowpass. */
  setSubmersion(amount: number): void {
    const t = Math.min(1, Math.max(0, amount));
    // Interpolate the cutoff geometrically: the ear hears cutoff in octaves, and a linear
    // sweep from 20 kHz spends its first half doing nothing audible at all.
    const cutoff = DRY_CUTOFF_HZ * Math.pow(SUBMERGED_CUTOFF_HZ / DRY_CUTOFF_HZ, t);
    this.muffle.frequency.setTargetAtTime(cutoff, this.context.currentTime, 0.12);
  }

  /** Multiplier applied on top of the music volume setting. */
  setMusicDuck(amount: number): void {
    this.duck = Math.min(1, Math.max(0, amount));
    this.applySettings();
  }

  playNoiseBurst(options: BurstOptions): void {
    const context = this.context;
    const start = options.when ?? context.currentTime;
    const attack = options.attack ?? 0.004;
    const decay = options.decay ?? 0.25;

    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer(options.kind ?? 'white');
    source.loop = true;
    source.playbackRate.value = options.rate ?? 1;

    const filter = context.createBiquadFilter();
    filter.type = options.filter ?? 'bandpass';
    const frequency = options.frequency ?? 900;
    filter.frequency.setValueAtTime(frequency, start);
    if (options.sweepTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, options.sweepTo), start + attack + decay);
    }
    filter.Q.value = options.q ?? 1;

    const amp = context.createGain();
    const end = scheduleEnvelope(amp.gain, start, options.gain ?? 0.4, attack, decay);

    source.connect(filter);
    filter.connect(amp);
    amp.connect(options.destination ?? this.sfxBus);
    source.start(start, Math.random() * NOISE_SECONDS * 0.5);
    source.stop(end + 0.02);
    source.onended = (): void => {
      source.disconnect();
      filter.disconnect();
      amp.disconnect();
    };
  }

  playTone(options: ToneOptions): void {
    const context = this.context;
    const start = options.when ?? context.currentTime;
    const attack = options.attack ?? 0.01;
    const decay = options.decay ?? 0.5;

    const osc = context.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(1, options.frequency), start);
    if (options.sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.sweepTo), start + attack + decay);
    }

    const amp = context.createGain();
    const end = scheduleEnvelope(amp.gain, start, options.gain ?? 0.3, attack, decay);

    let tail: AudioNode = osc;
    let filter: BiquadFilterNode | null = null;
    if (options.filter !== undefined) {
      filter = context.createBiquadFilter();
      filter.type = options.filter;
      filter.frequency.value = options.filterFrequency ?? options.frequency * 2;
      filter.Q.value = options.q ?? 1;
      osc.connect(filter);
      tail = filter;
    }
    tail.connect(amp);
    amp.connect(options.destination ?? this.sfxBus);
    osc.start(start);
    osc.stop(end + 0.02);
    osc.onended = (): void => {
      osc.disconnect();
      filter?.disconnect();
      amp.disconnect();
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.removeGestureListeners();
    this.sfxBus.disconnect();
    this.musicBus.disconnect();
    this.convolver.disconnect();
    this.muffle.disconnect();
    this.compressor.disconnect();
    this.masterGain.disconnect();
    this.noiseBuffers.clear();
    void this.context.close().catch(() => undefined);
  }

  /**
   * Autoplay policy: a context created without a prior user gesture starts suspended, and
   * calling `resume()` from anywhere but a gesture handler rejects. Both the rejection and the
   * "was not allowed to start" warning are swallowed here — the player has not done anything
   * wrong by not having clicked yet, and the console must stay clean.
   */
  private resume(): void {
    if (this.disposed || this.context.state === 'running') return;
    void this.context
      .resume()
      .then(() => {
        this.removeGestureListeners();
      })
      .catch(() => undefined);
  }

  private installGestureListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('pointerdown', this.resumeHandler, { passive: true });
    window.addEventListener('keydown', this.resumeHandler, { passive: true });
    window.addEventListener('touchend', this.resumeHandler, { passive: true });
  }

  private removeGestureListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.resumeHandler);
    window.removeEventListener('keydown', this.resumeHandler);
    window.removeEventListener('touchend', this.resumeHandler);
  }

  private applySettings(): void {
    const audio = this.settings.audio;
    const time = this.context.currentTime;
    const master = audio.muted ? 0 : Math.min(1, Math.max(0, audio.masterVolume));
    this.masterGain.gain.setTargetAtTime(master, time, 0.05);
    this.musicBus.gain.setTargetAtTime(Math.min(1, Math.max(0, audio.musicVolume)) * this.duck, time, 0.4);
  }

  private buildNoise(kind: NoiseKind): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const length = Math.floor(NOISE_SECONDS * sampleRate);
    const fade = Math.floor(LOOP_FADE_SECONDS * sampleRate);
    const source = new Float32Array(length + fade);
    const rng = new PRNG(NOISE_SEEDS[kind]);
    if (kind === 'white') fillWhiteNoise(source, rng);
    else if (kind === 'pink') fillPinkNoise(source, rng);
    else fillBrownNoise(source, rng);

    const looped = new Float32Array(length);
    seamlessLoop(source, looped, fade);
    const buffer = this.context.createBuffer(1, length, sampleRate);
    buffer.copyToChannel(looped, 0);
    return buffer;
  }

  private buildImpulseResponse(decaySeconds: number): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const length = Math.max(1, Math.floor(decaySeconds * sampleRate));
    const buffer = this.context.createBuffer(2, length, sampleRate);
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    fillImpulseResponse(left, right, sampleRate, decaySeconds, new PRNG(0x1f0a_9d47));
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    return buffer;
  }
}
