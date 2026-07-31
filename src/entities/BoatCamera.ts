import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Engine, System } from '../core/Engine.js';
import type { Input } from '../core/Input.js';
import { clamp, damp } from '../math/Noise.js';
import type { Boat, WaterSurface } from './Boat.js';

/**
 * The camera that watches the boat.
 *
 * Three things make a chase camera on water read as a camera rather than as a rig bolted to the
 * transom, and all three are here:
 *
 *   1. **It lags, and it lags twice.** The rig chases the boat and the camera chases the rig,
 *      so a turn opens out and settles instead of snapping. Two cascaded exponential filters
 *      give a second-order response with the overshoot of a spring and — unlike a spring
 *      integrated with Euler — no timestep at which it can go unstable. Every stage goes
 *      through `damp`, so 30 fps and 144 fps produce the *same* motion rather than merely a
 *      similar one.
 *   2. **It flinches.** Landing off a crest is the loudest thing that happens in this game and
 *      the camera has to acknowledge it, scaled by the sea state so a force 2 slam is a twitch
 *      and a force 8 slam nearly throws the shot.
 *   3. **It never goes under.** The ocean is a displaced surface; a camera eleven metres behind
 *      a boat spends a good part of a rough day inside a wave that has risen over it. Sampling
 *      `heightAt` at the camera's own position and floating it clear is the only reliable fix —
 *      no rest height covers a crest that arrives from astern.
 */

/** Chase rig, in the boat's own frame: astern, above, aimed a little over the cabin top. */
const FOLLOW_DISTANCE = 11.5;
const FOLLOW_HEIGHT = 4.6;
const FOLLOW_AIM_HEIGHT = 1.9;
/** How far the camera is pulled back along the velocity vector, in seconds of travel. */
const FOLLOW_LEAD = 0.35;

/** The two stages of the lag, s⁻¹. The rig is quick; the camera itself is not. */
const AIM_RATE = 6.5;
const CHASE_RATE = 4.2;
/** The heading the rig hangs from lags the hull's, which is what makes a turn swing open. */
const HEADING_RATE = 2.6;

/** Fraction of the hull's heel the chase camera inherits. All of it would be seasickening. */
const FOLLOW_ROLL = 0.32;

/**
 * Metres of clear air kept between the camera and the water surface below it.
 *
 * A floor plus a share of the significant wave height, because a fixed clearance is only ever
 * right for one sea. `heightAt` is a point sample directly beneath the eye, and what actually
 * fills the frame is the crest *in front* of it — which within one wavelength can stand Hs/2
 * higher. Three quarters of a metre is ample on a calm and nothing at all in a force 9: the
 * camera sat legally clear of the water under it and looked straight into the back of the next
 * wave, and because the ocean is `DoubleSide` that came out as the underside of the sea filling
 * the bottom of the frame.
 */
const WATER_CLEARANCE_M = 0.75;
const WATER_CLEARANCE_PER_WAVE_HEIGHT = 0.22;

/** Field-of-view kick: degrees per m/s² of surge acceleration, and its limits. */
const FOV_PER_ACCELERATION = 0.55;
const FOV_KICK_MIN = -2.5;
const FOV_KICK_MAX = 6;
const FOV_RATE = 5;

/** Vertical acceleration, m/s², above which a landing counts as an impact rather than heave. */
const SLAM_THRESHOLD = 11;
const SLAM_GAIN = 0.011;
const SHAKE_DECAY = 3.4;
/** Shake frequencies, rad/s. Deliberately incommensurate, so it never settles into a pattern. */
const SHAKE_FREQ_X = 27.3;
const SHAKE_FREQ_Y = 19.7;
const MAX_SHAKE = 0.85;

const EYE_HEIGHT = 1.15;
const LOOK_SENSITIVITY = 0.0026;
const ORBIT_MIN_DISTANCE = 4;
const ORBIT_MAX_DISTANCE = 60;

const WORLD_UP = new Vector3(0, 1, 0);
/** The camera looks down its own −Z, so a roll is a rotation about +Z. */
const CAMERA_ROLL_AXIS = new Vector3(0, 0, 1);

const desired = new Vector3();
const aim = new Vector3();
const heading = new Vector3();
const hullAxis = new Vector3();
const shakeOffset = new Vector3();
const twist = new Quaternion();
const basis = new Matrix4();

export type CameraMode = 'follow' | 'firstPerson' | 'orbit';

const MODE_ORDER: readonly CameraMode[] = ['follow', 'firstPerson', 'orbit'];

/** Exponential smoothing on an angle, taking the short way round the circle. */
function dampAngle(current: number, target: number, rate: number, dt: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta <= -Math.PI) delta += Math.PI * 2;
  return damp(current, current + delta, rate, dt);
}

/** Per-axis exponential smoothing. Frame-rate independent, and it allocates nothing. */
function dampVector(current: Vector3, towards: Vector3, rate: number, dt: number): void {
  current.set(
    damp(current.x, towards.x, rate, dt),
    damp(current.y, towards.y, rate, dt),
    damp(current.z, towards.z, rate, dt),
  );
}

export class BoatCamera implements System {
  readonly name = 'boatCamera';
  readonly priority = 30;

  private readonly boat: Boat;
  private readonly water: WaterSurface;
  private readonly baseFov: number;

  private modeIndex = 0;
  /** Stage one of the lag: where the rig wants to be. */
  private readonly rig = new Vector3();
  /** Stage two: where the camera actually is. */
  private readonly eye = new Vector3();
  /** The smoothed aim point, so the camera swings onto a target rather than snapping to it. */
  private readonly target = new Vector3();
  /** Orientation for this frame, built before the shake and then perturbed by it. */
  private readonly attitude = new Quaternion();

  private chaseHeading = 0;
  private fov: number;
  private shake = 0;
  private shakePhase = 0;
  private previousSurgeSpeed = 0;

  private lookYaw = 0;
  private lookPitch = -0.05;
  private orbitDistance = 14;

  constructor(engine: Engine, boat: Boat, water: WaterSurface) {
    this.boat = boat;
    this.water = water;
    this.baseFov = engine.camera.fov;
    this.fov = this.baseFov;
    this.chaseHeading = boat.heading;

    boat.deckPoint(this.target);
    this.target.y += FOLLOW_AIM_HEIGHT;
    heading.set(Math.sin(this.chaseHeading), 0, -Math.cos(this.chaseHeading));
    this.rig.copy(boat.position).addScaledVector(heading, -FOLLOW_DISTANCE);
    this.rig.y = boat.position.y + FOLLOW_HEIGHT;
    this.eye.copy(this.rig);
    engine.camera.position.copy(this.eye);
  }

  get mode(): CameraMode {
    return MODE_ORDER[this.modeIndex] ?? 'follow';
  }

  update(dt: number, engine: Engine): void {
    const input = engine.input;
    if (input.wasPressed('cameraMode')) {
      this.modeIndex = (this.modeIndex + 1) % MODE_ORDER.length;
    }

    this.accumulateShake(dt, engine.world.significantWaveHeight, engine.world.beaufort);
    this.updateFieldOfView(dt);

    switch (this.mode) {
      case 'firstPerson':
        this.driveFirstPerson(input);
        break;
      case 'orbit':
        this.driveOrbit(dt, input);
        break;
      default:
        this.driveFollow(dt);
        break;
    }

    // Shake first, then float clear — and that order is the whole point.
    //
    // The shake is a view-space throw, so a third of it is vertical and in a big sea it is the
    // largest single displacement applied to the eye. Running it *after* the clamp put the camera
    // back under the crest the clamp had just lifted it out of, on the frames where the shake
    // happened to be pointing down and the sea was steep enough to matter — which is to say, in a
    // storm and nowhere else. What that looks like is a corner of the frame filled with the
    // underside of a wave: `side: DoubleSide` on the ocean, so the back of the surface is drawn
    // rather than culled, and it comes out as hard-edged dark facets across the near water. One
    // of them is in the committed force 9 screenshot.
    //
    // With the clamp last, the shake can throw the eye wherever it likes and the water is still
    // the floor.
    this.applyShake();
    this.floatClearOfCrest(engine.world.significantWaveHeight);

    engine.camera.position.copy(this.eye);
    engine.camera.quaternion.copy(this.attitude);
    if (Math.abs(engine.camera.fov - this.fov) > 0.01) {
      engine.camera.fov = this.fov;
      engine.camera.updateProjectionMatrix();
    }
  }

  /**
   * Impacts.
   *
   * Only the part of the vertical acceleration above the threshold counts, so ordinary heave in
   * a swell never registers and a landing off a crest does. The sea state scales it because the
   * same acceleration means something different in a force 2 chop and a force 8 gale — and a
   * camera that shakes identically in both flattens the whole weather system into one note.
   */
  private accumulateShake(dt: number, waveHeight: number, beaufort: number): void {
    const impact = Math.abs(this.boat.verticalAcceleration) - SLAM_THRESHOLD;
    if (impact > 0) {
      const seaState = 1 + waveHeight * 0.4 + beaufort * 0.06;
      this.shake = Math.min(MAX_SHAKE, Math.max(this.shake, impact * SLAM_GAIN * seaState));
    }
    this.shake = damp(this.shake, 0, SHAKE_DECAY, dt);
    this.shakePhase += dt;
  }

  /** A mild widening under acceleration and a slight closing when the throttle comes off. */
  private updateFieldOfView(dt: number): void {
    const surge = Math.hypot(this.boat.velocity.x, this.boat.velocity.z);
    const acceleration = dt > 1e-6 ? (surge - this.previousSurgeSpeed) / dt : 0;
    this.previousSurgeSpeed = surge;

    const kick = clamp(acceleration * FOV_PER_ACCELERATION, FOV_KICK_MIN, FOV_KICK_MAX);
    // First person sits inside the hull, where a wide angle reads as a fisheye; halve the kick.
    const scale = this.mode === 'firstPerson' ? 0.5 : 1;
    this.fov = damp(this.fov, this.baseFov + kick * scale, FOV_RATE, dt);
  }

  private driveFollow(dt: number): void {
    this.chaseHeading = dampAngle(this.chaseHeading, this.boat.heading, HEADING_RATE, dt);

    // Hung off the *lagged* heading, then pulled back along the velocity so a boat under way
    // opens up the water ahead of it instead of filling the frame with its own transom.
    heading.set(Math.sin(this.chaseHeading), 0, -Math.cos(this.chaseHeading));
    desired
      .copy(this.boat.position)
      .addScaledVector(heading, -FOLLOW_DISTANCE)
      .addScaledVector(this.boat.velocity, -FOLLOW_LEAD);
    desired.y = this.boat.position.y + FOLLOW_HEIGHT;

    dampVector(this.rig, desired, AIM_RATE, dt);
    dampVector(this.eye, this.rig, CHASE_RATE, dt);

    this.boat.deckPoint(aim);
    aim.y += FOLLOW_AIM_HEIGHT;
    dampVector(this.target, aim, AIM_RATE, dt);

    this.aimAt(this.target, this.hullHeel() * FOLLOW_ROLL);
  }

  /**
   * At the helm.
   *
   * The eye is carried by the hull's own attitude rather than by a world-space offset, so the
   * horizon rolls behind the windows exactly as much as the boat does — which is the entire
   * reason to have a first-person mode on a boat.
   */
  private driveFirstPerson(input: Input): void {
    this.readLook(input);

    this.boat.deckPoint(this.eye);
    hullAxis.set(0, 1, 0).applyQuaternion(this.boat.orientation);
    this.eye.addScaledVector(hullAxis, EYE_HEIGHT);
    this.rig.copy(this.eye);

    // Both look rotations are applied on the right, so they act in the hull's frame: the helm
    // turns their head about the mast, not about world up.
    this.attitude.copy(this.boat.orientation);
    twist.setFromAxisAngle(WORLD_UP, this.lookYaw);
    this.attitude.multiply(twist);
    twist.setFromAxisAngle(hullAxis.set(1, 0, 0), this.lookPitch);
    this.attitude.multiply(twist);

    this.boat.deckPoint(this.target);
  }

  /** Free orbit: drag to swing round, wheel to pull in and out. */
  private driveOrbit(dt: number, input: Input): void {
    if (input.primaryDown || input.pointerLocked) this.readLook(input);
    this.orbitDistance = clamp(
      this.orbitDistance * (1 + input.wheel * 0.0012),
      ORBIT_MIN_DISTANCE,
      ORBIT_MAX_DISTANCE,
    );

    this.boat.deckPoint(aim);
    aim.y += 0.8;
    dampVector(this.target, aim, AIM_RATE, dt);

    const pitch = clamp(this.lookPitch, -1.2, 0.35);
    const reach = Math.cos(pitch) * this.orbitDistance;
    desired.set(
      this.target.x + Math.sin(this.lookYaw) * reach,
      this.target.y - Math.sin(pitch) * this.orbitDistance,
      this.target.z + Math.cos(this.lookYaw) * reach,
    );
    dampVector(this.rig, desired, AIM_RATE, dt);
    dampVector(this.eye, this.rig, CHASE_RATE, dt);
    this.aimAt(this.target, 0);
  }

  private readLook(input: Input): void {
    this.lookYaw -= input.pointerDeltaX * LOOK_SENSITIVITY;
    this.lookPitch = clamp(this.lookPitch - input.pointerDeltaY * LOOK_SENSITIVITY, -1.25, 1.25);
  }

  /** Heel angle of the hull, radians, positive to starboard. */
  private hullHeel(): number {
    hullAxis.set(1, 0, 0).applyQuaternion(this.boat.orientation);
    return Math.asin(clamp(hullAxis.y, -1, 1));
  }

  private aimAt(point: Vector3, roll: number): void {
    basis.lookAt(this.eye, point, WORLD_UP);
    this.attitude.setFromRotationMatrix(basis);
    twist.setFromAxisAngle(CAMERA_ROLL_AXIS, roll);
    this.attitude.multiply(twist);
  }

  /**
   * Lift the camera out of any crest that has risen over it.
   *
   * Applied to the smoothed rig as well as to the eye, or the filter would spend the next frame
   * pulling the camera back under the surface and the result would chatter at exactly the
   * frequency of the waves.
   */
  private floatClearOfCrest(seaState: number): void {
    const clearance = WATER_CLEARANCE_M + WATER_CLEARANCE_PER_WAVE_HEIGHT * seaState;
    const floor = this.water.heightAt(this.eye.x, this.eye.z) + clearance;
    if (this.eye.y < floor) {
      this.eye.y = floor;
      if (this.rig.y < floor) this.rig.y = floor;
    }
  }

  private applyShake(): void {
    if (this.shake <= 1e-4) return;
    // Applied in view space, so the throw is always across the frame rather than in world axes.
    const x = Math.sin(this.shakePhase * SHAKE_FREQ_X) * this.shake;
    const y = Math.sin(this.shakePhase * SHAKE_FREQ_Y + 1.7) * this.shake * 0.8;
    shakeOffset.set(x, y, 0).applyQuaternion(this.attitude);
    this.eye.add(shakeOffset);
    twist.setFromAxisAngle(CAMERA_ROLL_AXIS, x * 0.35);
    this.attitude.multiply(twist);
  }
}
