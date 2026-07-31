import { Vector3 } from 'three';
import { AudioEngine, type FmVoice, type NoiseKind, type NoiseVoice } from '../core/Audio.js';
import type { Engine, System } from '../core/Engine.js';
import type { Settings } from '../core/Settings.js';
import { clamp, damp, smoothstep } from '../math/Noise.js';
import {
  AIR_REVERB_SEND,
  DRAG_BASE_HZ,
  DRAG_FULL_MPS,
  DRAG_GAIN,
  DRAG_Q,
  DRAG_RESPONSE,
  DRAG_SPAN_HZ,
  ENGINE_GAIN,
  ENGINE_IDLE_GAIN,
  ENGINE_INDEX_MIN,
  ENGINE_INDEX_SPAN,
  ENGINE_STOP_RATE,
  EXHAUST_BASE_HZ,
  EXHAUST_FLOOR_GAIN,
  EXHAUST_GAIN,
  EXHAUST_HZ_PER_FIRING,
  HALYARD_DIAMETER_M,
  HALYARD_Q,
  IDLE_RPM,
  MAX_RPM,
  RAIN_DECK_GAIN,
  RAIN_DECK_HZ,
  RAIN_HISS_GAIN,
  RAIN_HISS_HZ,
  RAIN_HISS_SPAN_HZ,
  RPM_DROOP,
  RPM_RATE,
  SEA_FULL_HS_M,
  SEA_RUMBLE_HZ,
  SEA_RUMBLE_SPAN_HZ,
  SEA_WASH_FLOOR_GAIN,
  SEA_WASH_GAIN,
  SEA_WASH_HZ,
  SHROUD_DIAMETER_M,
  SHROUD_Q,
  SING_FULL_MS,
  SING_GAIN,
  SING_MIN_HZ,
  SING_ONSET_MS,
  SLAM_REARM_S,
  SLAM_RELEASE_MS2,
  SUBMERGED_DUCK,
  SUBMERGED_GAIN,
  SUBMERGED_HZ,
  THUNDER_HEIGHT_M,
  THUNDER_PANNERS,
  THUNDER_REVERB_SEND,
  TOP_SPEED_KNOTS,
  WHITECAP_HZ,
  WHITECAP_SPAN_HZ,
  WIND_BED_FLOOR_GAIN,
  WIND_BED_GAIN,
  WIND_BED_HZ,
  WIND_BED_HZ_PER_MS,
  WIND_FULL_MS,
  createThunderProfile,
  engineFiringHz,
  riggingFrequency,
  seaRumbleGain,
  slamAmplitude,
  type ThunderProfile,
  thunderProfile,
  whitecapGain,
} from './AudioCurves.js';
import { continuousBeaufort, type LightningListener, type LightningStrike } from './Weather.js';

/**
 * The sound of the place, driven from the world state.
 *
 * `core/Audio.ts` owns the graph and the synthesis toolkit; this file owns the *mapping* — which
 * number in `WorldState` moves which parameter, and by how much. Nothing here is a sample and
 * nothing is a loop cross-fade: every bed is a filtered noise or an FM voice whose parameters are
 * pushed towards a moving target once a frame, so the sea gets louder as the sea gets bigger,
 * continuously, and a wind that freshens over four minutes is heard freshening.
 *
 * Two layers are event-driven rather than continuous and both have the same shape: something in
 * the simulation crosses a line, and a one-shot is scheduled against the audio clock. The hull
 * slap fires off the boat's vertical acceleration, and the thunder fires off a lightning stroke —
 * delayed by the real distance, because the delay and the dullness together are the only things
 * that tell you how far away the storm is.
 *
 * Everything is silent until the player touches the page, and that is not politeness. A Web Audio
 * context created outside a user gesture starts suspended *and logs a warning*, and one console
 * warning fails `npm run verify`. So the context and the whole graph are built inside the first
 * gesture handler and do not exist before it; every update path is a no-op until they do.
 */

// ------------------------------------------------------------------------------ the sources

/**
 * The slice of the boat the beds need. `Boat` satisfies it structurally.
 *
 * Structural rather than a `Boat` import for the reason `Ocean.setCloudShadows` and
 * `FishingSystem`'s tackle interfaces give: the sound of an engine does not depend on the class
 * that owns the throttle, and a test can hand over a plain object.
 */
export interface BoatAudioSource {
  readonly speedKnots: number;
  /** −1 full astern .. +1 full ahead, after smoothing. */
  readonly throttleSetting: number;
  /** m/s². Positive is upward — the hull being stopped by the water. */
  readonly verticalAcceleration: number;
  /** The engine is shut down at anchor, which is most of why anchoring feels like arriving. */
  readonly isAnchored: boolean;
}

/** The slice of the underwater system the beds need. `Underwater` satisfies it. */
export interface SubmersionSource {
  /** 0 above the water, 1 fully under, ramped over the last few centimetres. */
  readonly submersion: number;
}

/** The slice of the weather the beds need. `Weather` satisfies it. */
export interface StormAudioSource {
  onLightning(listener: LightningListener): () => void;
}

/**
 * The slice of the fishing loop the beds need. `FishingSystem` satisfies it.
 *
 * `state` arrives as a bare string because `FishingState` is declared in `src/gameplay`, which
 * `src/world` may not import — see the layering rules in CLAUDE.md. The four names this system
 * listens for are checked against literals, and the state machine itself stays the only thing that
 * decides which of them is current.
 */
export interface TackleAudioSource {
  readonly state: string;
  /** 0..1 fraction of the line's breaking strain in use. Non-zero only with a fish on. */
  readonly tension: number;
  /** Metres from the rod tip to the fish. Growing means line is leaving the spool. */
  readonly fishDistanceM: number;
}

export interface AudioBedSources {
  readonly boat: BoatAudioSource;
  readonly underwater: SubmersionSource;
  readonly weather: StormAudioSource;
  readonly tackle: TackleAudioSource;
}

/** Every node that lives for the session. Built once, inside the first gesture. */
interface Beds {
  readonly airBus: GainNode;
  readonly airSend: GainNode;
  readonly thunderBus: GainNode;
  readonly thunderSend: GainNode;
  readonly panners: readonly PannerNode[];
  readonly seaRumble: NoiseVoice;
  readonly seaWash: NoiseVoice;
  readonly whitecaps: NoiseVoice;
  readonly windBed: NoiseVoice;
  readonly shroud: NoiseVoice;
  readonly halyard: NoiseVoice;
  readonly rainHiss: NoiseVoice;
  readonly rainDeck: NoiseVoice;
  readonly exhaust: NoiseVoice;
  readonly engine: FmVoice;
  readonly submerged: NoiseVoice;
  readonly reelDrag: NoiseVoice;
}

const listenerForward = new Vector3();

export class AudioBeds implements System {
  readonly name = 'audio';
  /**
   * After the camera, the boat, the tackle and the underwater test, so the listener is placed from
   * this frame's viewpoint and every level describes the frame that was just simulated.
   */
  readonly priority = 92;

  private readonly boat: BoatAudioSource;
  private readonly underwater: SubmersionSource;
  private readonly tackle: TackleAudioSource;
  private readonly settings: Settings;
  private readonly unsubscribeLightning: () => void;
  private readonly startHandler: () => void;
  private readonly thunder: ThunderProfile = createThunderProfile();

  private audio: AudioEngine | null = null;
  private graph: Beds | null = null;
  /** Set once the first gesture has been handled, whether or not a context could be made. */
  private booted = false;
  private disposed = false;

  private rpm = 0;
  private running = 0;
  private slamArmed = true;
  private slamLockout = 0;
  private tackleState = 'idle';
  private fishDistance = 0;
  private lineOutRate = 0;
  private peakTension = 0;
  private pannerCursor = 0;

  constructor(engine: Engine, sources: AudioBedSources) {
    this.boat = sources.boat;
    this.underwater = sources.underwater;
    this.tackle = sources.tackle;
    this.settings = engine.settings;

    // Subscribed now rather than at boot: the handle has to be held for `dispose`, and a stroke
    // that arrives before the player has clicked is simply dropped inside the handler.
    this.unsubscribeLightning = sources.weather.onLightning(this.handleStrike);

    this.startHandler = (): void => {
      this.boot();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.startHandler, { passive: true });
      window.addEventListener('keydown', this.startHandler, { passive: true });
      window.addEventListener('touchend', this.startHandler, { passive: true });
    }
  }

  /**
   * The impact detector, on the fixed clock.
   *
   * It has to be here rather than in `update`: a rendered frame can cover six physics steps, and
   * the peak of a landing lasts one of them. Sampling the acceleration once a frame misses most
   * slams outright and mis-sizes the rest.
   */
  fixedUpdate(dt: number): void {
    const audio = this.audio;
    const graph = this.graph;
    if (audio === null || graph === null) return;

    this.slamLockout = Math.max(0, this.slamLockout - dt);
    const acceleration = this.boat.verticalAcceleration;
    if (!this.slamArmed) {
      if (acceleration < SLAM_RELEASE_MS2) this.slamArmed = true;
      return;
    }

    const amplitude = slamAmplitude(acceleration);
    if (amplitude <= 0) return;
    // Disarmed on the excursion, not on the sound: a slam suppressed by the lockout is still one
    // excursion, and re-arming would let its own ringing fire the next one.
    this.slamArmed = false;
    if (this.slamLockout > 0) return;
    this.slamLockout = SLAM_REARM_S;
    this.playSlam(audio, graph, amplitude);
  }

  update(dt: number, engine: Engine): void {
    const audio = this.audio;
    const graph = this.graph;
    if (audio === null || graph === null) return;

    const camera = engine.camera;
    camera.getWorldDirection(listenerForward);
    audio.setListener(
      camera.position.x,
      camera.position.y,
      camera.position.z,
      listenerForward.x,
      listenerForward.y,
      listenerForward.z,
    );

    const world = engine.world;
    const force = continuousBeaufort(world.windSpeed);
    this.updateSea(graph, world.significantWaveHeight, force);
    this.updateWind(graph, world.windSpeed);
    this.updateRain(graph, world.precipitation);
    this.updateEngine(dt, graph);
    this.updateSubmersion(audio, graph, world.significantWaveHeight);
    this.updateTackle(dt, audio, graph);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeLightning();
    this.removeGestureListeners();

    const graph = this.graph;
    if (graph !== null) {
      graph.seaRumble.dispose();
      graph.seaWash.dispose();
      graph.whitecaps.dispose();
      graph.windBed.dispose();
      graph.shroud.dispose();
      graph.halyard.dispose();
      graph.rainHiss.dispose();
      graph.rainDeck.dispose();
      graph.exhaust.dispose();
      graph.engine.dispose();
      graph.submerged.dispose();
      graph.reelDrag.dispose();
      for (const panner of graph.panners) panner.disconnect();
      graph.thunderSend.disconnect();
      graph.thunderBus.disconnect();
      graph.airSend.disconnect();
      graph.airBus.disconnect();
      this.graph = null;
    }
    this.audio?.dispose();
    this.audio = null;
  }

  /**
   * Build the context and the whole graph, inside the gesture that allows it.
   *
   * Runs at most once. A browser with no Web Audio, or one that refuses another context, leaves
   * the game silent and otherwise completely correct — which is the only acceptable failure, since
   * the alternative is a console line and a failed verify.
   */
  private boot(): void {
    if (this.booted || this.disposed) return;
    this.booted = true;
    this.removeGestureListeners();

    let audio: AudioEngine | null = null;
    try {
      audio = AudioEngine.create(this.settings);
    } catch {
      // Nothing to report and nothing the player can do. Stay silent rather than noisy.
      return;
    }
    if (audio === null) return;
    this.audio = audio;
    this.graph = this.buildGraph(audio);
  }

  private removeGestureListeners(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerdown', this.startHandler);
    window.removeEventListener('keydown', this.startHandler);
    window.removeEventListener('touchend', this.startHandler);
  }

  private buildGraph(audio: AudioEngine): Beds {
    const context = audio.context;

    // Everything that happens in air hangs off one gain, so going under is a single parameter
    // rather than twelve. Thunder is deliberately not on it: you hear thunder under water, dull,
    // and the master lowpass is the right place for that to happen to it.
    const airBus = context.createGain();
    airBus.gain.value = 1;
    airBus.connect(audio.sfxBus);
    const airSend = audio.createReverbSend(AIR_REVERB_SEND);
    airBus.connect(airSend);

    const thunderBus = context.createGain();
    thunderBus.gain.value = 1;
    thunderBus.connect(audio.sfxBus);
    const thunderSend = audio.createReverbSend(THUNDER_REVERB_SEND);
    thunderBus.connect(thunderSend);

    const panners: PannerNode[] = [];
    for (let i = 0; i < THUNDER_PANNERS; i += 1) {
      const panner = audio.createPanner();
      // Direction only. The panner's inverse-distance law describes a room; thunder over water
      // carries an order of magnitude further than that, so the level is modelled in
      // `thunderProfile` and the rolloff here is switched off rather than fought.
      panner.rolloffFactor = 0;
      panner.refDistance = 1;
      panner.disconnect();
      panner.connect(thunderBus);
      panners.push(panner);
    }

    const engine = audio.createFmVoice({
      carrier: engineFiringHz(IDLE_RPM),
      // Unity ratio, so the partials are every harmonic of the firing frequency rather than only
      // the odd ones. A diesel is a lump of broadband combustion, not a clarinet.
      ratio: 1,
      index: ENGINE_INDEX_MIN,
      gain: 0,
      carrierType: 'sine',
      modulatorType: 'triangle',
      destination: airBus,
    });
    engine.start();

    // Every bed is the same object with different numbers in it, so the numbers are all the table
    // below shows. Each one runs for the whole session at a gain the update methods drive; none of
    // them is ever created, stopped or restarted while the game is running.
    const bed = (
      kind: NoiseKind,
      filter: BiquadFilterType,
      frequency: number,
      q: number,
      rate: number,
      destination: AudioNode = airBus,
    ): NoiseVoice => {
      const voice = audio.createNoiseVoice({ kind, filter, frequency, q, rate, destination });
      voice.start();
      return voice;
    };

    return {
      airBus,
      airSend,
      thunderBus,
      thunderSend,
      panners,
      engine,
      seaRumble: bed('brown', 'lowpass', SEA_RUMBLE_HZ, 0.6, 0.85),
      seaWash: bed('pink', 'bandpass', SEA_WASH_HZ, 0.8, 1),
      whitecaps: bed('white', 'highpass', WHITECAP_HZ, 0.7, 1),
      windBed: bed('pink', 'bandpass', WIND_BED_HZ, 0.9, 1),
      shroud: bed('white', 'bandpass', SING_MIN_HZ, SHROUD_Q, 1),
      halyard: bed('white', 'bandpass', SING_MIN_HZ, HALYARD_Q, 1),
      rainHiss: bed('white', 'lowpass', RAIN_HISS_HZ, 1.3, 1),
      rainDeck: bed('pink', 'bandpass', RAIN_DECK_HZ, 1.1, 1),
      exhaust: bed('brown', 'lowpass', EXHAUST_BASE_HZ, 0.8, 1),
      reelDrag: bed('white', 'bandpass', DRAG_BASE_HZ, DRAG_Q, 1),
      // Straight to the SFX bus rather than the air bus: the whole point of the submerged bed is
      // that it is the one thing that comes *up* as everything in the air goes down.
      submerged: bed('brown', 'lowpass', SUBMERGED_HZ, 0.9, 0.7, audio.sfxBus),
    };
  }

  /** Swell, wash and breaking crests: three layers because the sea is three sounds. */
  private updateSea(graph: Beds, significantWaveHeight: number, force: number): void {
    const normalised = clamp(significantWaveHeight / SEA_FULL_HS_M, 0, 1);
    graph.seaRumble.setGain(seaRumbleGain(significantWaveHeight), 0.7);
    graph.seaRumble.setFrequency(SEA_RUMBLE_HZ + SEA_RUMBLE_SPAN_HZ * normalised, 0.9);
    graph.seaWash.setGain(SEA_WASH_FLOOR_GAIN + SEA_WASH_GAIN * Math.sqrt(normalised), 0.7);
    graph.whitecaps.setGain(whitecapGain(force), 0.9);
    graph.whitecaps.setFrequency(WHITECAP_HZ + (WHITECAP_SPAN_HZ * force) / 12, 1.2);
  }

  /**
   * The wind: a broadband bed and two shed-vortex tones.
   *
   * The bed's level goes as the 3/2 power of the speed because the sound radiated by a bluff body
   * in a flow is a dipole, whose power goes as U⁶ over the near field but flattens to about U³ once
   * the whole rig is contributing; amplitude is the square root of that.
   */
  private updateWind(graph: Beds, windSpeed: number): void {
    const normalised = clamp(windSpeed / WIND_FULL_MS, 0, 1);
    graph.windBed.setGain(WIND_BED_FLOOR_GAIN + WIND_BED_GAIN * Math.pow(normalised, 1.5), 0.6);
    graph.windBed.setFrequency(WIND_BED_HZ + WIND_BED_HZ_PER_MS * windSpeed, 0.8);

    // The tone needs a real flow before it exists at all — below a few metres a second the wake is
    // laminar and a wire simply does not sing.
    const singing = smoothstep(SING_ONSET_MS, SING_FULL_MS, windSpeed);
    const tone = SING_GAIN * singing * singing;
    graph.shroud.setGain(tone, 0.5);
    graph.shroud.setFrequency(riggingFrequency(windSpeed, SHROUD_DIAMETER_M), 0.4);
    graph.halyard.setGain(tone * 0.65, 0.5);
    graph.halyard.setFrequency(riggingFrequency(windSpeed, HALYARD_DIAMETER_M), 0.4);
  }

  /** Rain on the water and rain on the wheelhouse roof, both from one rate. */
  private updateRain(graph: Beds, precipitation: number): void {
    const rate = clamp(precipitation, 0, 1);
    graph.rainHiss.setGain(RAIN_HISS_GAIN * Math.pow(rate, 0.7), 0.5);
    graph.rainHiss.setFrequency(RAIN_HISS_HZ + RAIN_HISS_SPAN_HZ * rate, 0.6);
    graph.rainDeck.setGain(RAIN_DECK_GAIN * rate, 0.5);
  }

  /**
   * The engine, pitched by its own revolutions and coloured by its load.
   *
   * `Boat` publishes a throttle and a speed, not an RPM, so the RPM is integrated here: demand from
   * the throttle, droop from the load, and a first-order lag for the flywheel. The load term is the
   * difference between the speed the throttle is asking for and the speed the boat has actually
   * got — full throttle from rest is a propeller biting on a hull that has not started moving, and
   * the engine labours; the same throttle at cruise is the same revolutions with nothing to push
   * against. That difference is entirely in the modulation index, which is what FM is for.
   */
  private updateEngine(dt: number, graph: Beds): void {
    const throttle = clamp(Math.abs(this.boat.throttleSetting), 0, 1);
    const speedFraction = clamp(this.boat.speedKnots / TOP_SPEED_KNOTS, 0, 1);
    const load = clamp(throttle - speedFraction, 0, 1);

    // The engine is stopped at anchor, so the revs fall away to nothing and the note goes with
    // them. Weighing brings it back up through idle, which is the sound of a start.
    this.running = damp(this.running, this.boat.isAnchored ? 0 : 1, ENGINE_STOP_RATE, dt);
    const demand = (IDLE_RPM + (MAX_RPM - IDLE_RPM) * throttle * (1 - RPM_DROOP * load)) * this.running;
    this.rpm = damp(this.rpm, demand, RPM_RATE, dt);

    const firing = engineFiringHz(this.rpm);
    const revs = clamp(this.rpm / MAX_RPM, 0, 1);
    graph.engine.setFrequency(Math.max(1, firing));
    graph.engine.setIndex(ENGINE_INDEX_MIN + ENGINE_INDEX_SPAN * load);
    graph.engine.setGain((ENGINE_IDLE_GAIN + ENGINE_GAIN * throttle) * this.running);

    const exhaust = EXHAUST_FLOOR_GAIN + EXHAUST_GAIN * revs * (0.4 + 0.6 * load);
    graph.exhaust.setGain(exhaust * this.running, 0.2);
    graph.exhaust.setFrequency(EXHAUST_BASE_HZ + firing * EXHAUST_HZ_PER_FIRING, 0.2);
  }

  /**
   * Going under.
   *
   * The master lowpass is `AudioEngine`'s and takes the whole mix down to a few hundred hertz —
   * that is the dullness. The air bus coming down is the *level*: under water you do not hear a
   * quieter wind, you hear no wind at all. And the submerged bed coming up is what stops the
   * result sounding like a mute button.
   */
  private updateSubmersion(audio: AudioEngine, graph: Beds, significantWaveHeight: number): void {
    const submersion = clamp(this.underwater.submersion, 0, 1);
    audio.setSubmersion(submersion);
    graph.airBus.gain.setTargetAtTime(1 - SUBMERGED_DUCK * submersion, audio.now(), 0.08);

    const sea = clamp(significantWaveHeight / SEA_FULL_HS_M, 0, 1);
    graph.submerged.setGain(SUBMERGED_GAIN * submersion * (0.55 + 0.45 * sea), 0.12);
  }

  /**
   * The tackle: splashes on the transitions, and the drag while line is going out.
   *
   * The state machine is `FishingSystem`'s and is not mirrored here — this watches the name change
   * and nothing else, so there is no second copy of the graph to fall out of step with the first.
   */
  private updateTackle(dt: number, audio: AudioEngine, graph: Beds): void {
    const tackle = this.tackle;
    const state = tackle.state;
    if (state !== this.tackleState) {
      const previous = this.tackleState;
      this.tackleState = state;
      if (state === 'sinking' && previous === 'casting') this.playCastSplash(audio, graph);
      else if (state === 'bite') this.playBite(audio, graph);
      else if (state === 'fighting') {
        this.peakTension = 0;
        this.lineOutRate = 0;
        // Seeded on entry, so the first frame of a fight is not a step from zero to thirty metres.
        this.fishDistance = tackle.fishDistanceM;
      } else if (state === 'landed') this.playLandingSplash(audio, graph);
    }

    const tension = clamp(tackle.tension, 0, 1);
    let taking = 0;
    if (state === 'fighting') {
      if (tension > this.peakTension) this.peakTension = tension;
      const distance = tackle.fishDistanceM;
      if (dt > 1e-4) taking = clamp((distance - this.fishDistance) / dt / DRAG_FULL_MPS, 0, 1);
      this.fishDistance = distance;
    }
    this.lineOutRate = damp(this.lineOutRate, taking, DRAG_RESPONSE, dt);

    const run = this.lineOutRate;
    graph.reelDrag.setGain(DRAG_GAIN * run * (0.3 + 0.7 * tension), 0.05);
    graph.reelDrag.setFrequency(DRAG_BASE_HZ + DRAG_SPAN_HZ * run, 0.05);
    // The buffer's own playback rate as well as the filter, so the grain of the noise speeds up
    // with the spool rather than only its colour. A drag is a ratchet, not a whistle.
    graph.reelDrag.setRate(0.7 + run, 0.06);
  }

  /**
   * A landing: the boom of the hull, and the sheet of water it throws.
   *
   * Three one-shots rather than one, because the three parts of a slam have completely different
   * envelopes — the thud is over in a quarter of a second, the spray hangs for half a second after
   * it, and only the low thump scales all the way to the top of the range.
   */
  private playSlam(audio: AudioEngine, graph: Beds, amplitude: number): void {
    const destination = graph.airBus;
    audio.playTone({
      frequency: 78 - 22 * amplitude, sweepTo: 34, type: 'sine',
      gain: 0.45 * amplitude, attack: 0.004, decay: 0.26 + 0.2 * amplitude, destination,
    });
    audio.playNoiseBurst({
      kind: 'pink', filter: 'lowpass', frequency: 900 + 700 * amplitude, sweepTo: 160, q: 0.9,
      gain: 0.5 * amplitude, attack: 0.002, decay: 0.22 + 0.18 * amplitude, destination,
    });
    audio.playNoiseBurst({
      kind: 'white', filter: 'highpass', frequency: 2600, q: 0.7,
      gain: 0.22 * amplitude, attack: 0.02, decay: 0.5 + 0.4 * amplitude, destination,
    });
  }

  /** A float arriving: the crown of water it throws, and the hole it leaves behind it. */
  private playCastSplash(audio: AudioEngine, graph: Beds): void {
    const destination = graph.airBus;
    audio.playNoiseBurst({
      kind: 'white', filter: 'bandpass', frequency: 2400, sweepTo: 700, q: 0.8,
      gain: 0.3, attack: 0.003, decay: 0.3, destination,
    });
    audio.playTone({
      frequency: 420, sweepTo: 150, type: 'sine',
      gain: 0.16, attack: 0.004, decay: 0.16, destination,
    });
  }

  /** The float going under. Quiet, and the only warning the player gets before the strike. */
  private playBite(audio: AudioEngine, graph: Beds): void {
    audio.playTone({
      frequency: 640, sweepTo: 260, type: 'sine',
      gain: 0.12, attack: 0.003, decay: 0.12, destination: graph.airBus,
    });
  }

  /** A fish coming over the gunwale, sized by how hard it fought. */
  private playLandingSplash(audio: AudioEngine, graph: Beds): void {
    const size = 0.4 + 0.6 * this.peakTension;
    const destination = graph.airBus;
    audio.playNoiseBurst({
      kind: 'white', filter: 'bandpass', frequency: 1800, sweepTo: 420, q: 0.7,
      gain: 0.42 * size, attack: 0.004, decay: 0.2 + 0.55 * size, destination,
    });
    audio.playTone({
      frequency: 300, sweepTo: 110, type: 'sine',
      gain: 0.24 * size, attack: 0.005, decay: 0.3, destination,
    });
  }

  /**
   * Schedule the report of a stroke.
   *
   * The delay is `Weather`'s own — 2.9 seconds per kilometre — and the panner carries the bearing,
   * so a strike on the beam is heard on the beam however long it took to arrive. Both bursts are
   * scheduled against the audio clock rather than counted down on the frame clock: at eight
   * kilometres that is twenty-three seconds away, and no frame-rate hiccup should be able to move
   * it by even a millisecond.
   */
  private readonly handleStrike = (strike: Readonly<LightningStrike>): void => {
    const audio = this.audio;
    const graph = this.graph;
    if (audio === null || graph === null) return;

    const panner = graph.panners[this.pannerCursor % graph.panners.length];
    this.pannerCursor += 1;
    if (panner === undefined) return;
    audio.setPosition(panner, strike.x, THUNDER_HEIGHT_M, strike.z);

    const profile = this.thunder;
    thunderProfile(strike.distanceM, strike.intensity, profile);
    const when = audio.now() + strike.thunderDelaySeconds;

    if (profile.crackGain > 1e-3) {
      audio.playNoiseBurst({
        kind: 'white', filter: 'bandpass', frequency: 1800, sweepTo: 420, q: 0.7,
        gain: profile.crackGain, attack: 0.002, decay: 0.32, destination: panner, when,
      });
    }

    audio.playNoiseBurst({
      kind: 'brown', filter: 'lowpass', q: 0.9, rate: 0.7,
      frequency: profile.cutoffHz * 2.2,
      sweepTo: profile.cutoffHz * 0.5,
      gain: profile.rumbleGain,
      // A distant report has no attack at all — it swells, because the near end of the channel is
      // still kilometres away and the sound has been smeared by everything it came through.
      attack: Math.min(0.4, 0.015 + profile.decayS * 0.12),
      decay: profile.decayS,
      destination: panner,
      when: when + 0.04,
    });
  };
}
