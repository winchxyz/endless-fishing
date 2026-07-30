import { Quaternion, Vector3 } from 'three';
import { clamp, smoothstep } from '../math/Noise.js';

/**
 * Archimedes, by hand, at 120 Hz.
 *
 * Ten probes are spread over the hull. Each one owns a slice of the waterplane, asks the ocean
 * how high the water is directly above it, and pushes up with the weight of the water its slice
 * has displaced. That is the whole model, and it is enough: a boat that buries its bow in a
 * swell, heels into a turn and lands hard off a crest all fall out of the probe distribution
 * rather than being scripted anywhere.
 *
 * The solver takes the surface as a callback, so it can be stepped against a synthetic sea in a
 * unit test with no GPU anywhere near it. That is not a testing convenience bolted on
 * afterwards — buoyancy is the one part of this game whose failure mode (a boat that slowly
 * sinks, or explodes on frame 4000) is invisible until it has already ruined the session.
 *
 * The hull form lives here rather than in `BoatGeometry` because it is the *shared* description:
 * physics reads it to place probes and geometry reads it to loft plating. Two descriptions of
 * one hull is how a boat ends up floating half a metre above its own waterline.
 */

/** Density of sea water at 10 °C, kg/m³. Fresh water would float this boat 2.5% deeper. */
export const SEA_WATER_DENSITY = 1025;
const GRAVITY = 9.80665;

export interface HullForm {
  /** Length overall, metres. */
  length: number;
  /** Maximum beam, metres. */
  beam: number;
  /** Design draught at rest, metres below the still waterline. */
  designDraught: number;
  /** Half-beam as a fraction of `beam / 2`, at station `t` running 0 (stem) to 1 (transom). */
  halfBeamAt(t: number): number;
  /** Height of the keel line above the design waterline — negative everywhere. */
  keelAt(t: number): number;
  /** Height of the sheer line (the deck edge) above the design waterline. */
  sheerAt(t: number): number;
}

/**
 * A 7.2 m open workboat: hard chine, raked stem, transom stern.
 *
 * The curves are analytic rather than tabulated because every one of them has to be evaluated
 * at arbitrary `t` by both the loft and the probe layout, and a table plus interpolation is a
 * table plus an interpolation bug.
 */
export const WORKBOAT_FORM: HullForm = {
  length: 7.2,
  beam: 2.6,
  designDraught: 0.52,

  halfBeamAt(t: number): number {
    // Beam builds quickly out of a fine entry, peaks just abaft midships and holds most of it
    // back to the transom, which is what gives a small workboat its carrying capacity aft.
    if (t < 0.62) return 0.02 + 0.98 * smoothstep(0, 1, (t / 0.62) ** 0.85);
    return 1 - 0.17 * smoothstep(0, 1, (t - 0.62) / 0.38);
  },

  keelAt(t: number): number {
    const forefoot = 1 - smoothstep(0, 0.3, t);
    const skeg = smoothstep(0.78, 1, t);
    return -WORKBOAT_FORM.designDraught * (1 - 0.82 * forefoot ** 1.4 - 0.28 * skeg);
  },

  sheerAt(t: number): number {
    // Freeboard is highest forward — the sheer sweeps up towards the stem to throw the water
    // off, which is the single most recognisable line on a working hull.
    return 0.78 + 0.4 * (1 - smoothstep(0, 0.45, t)) ** 1.6 + 0.1 * smoothstep(0.55, 1, t);
  },
};

export interface BuoyancyProbe {
  /** Position of the probe in hull coordinates: on the keel line of its own slice. */
  readonly offset: Vector3;
  /** Waterplane area this probe answers for, m². */
  readonly area: number;
  /** Depth from the probe to the sheer. Past this the slice is full and stops lifting. */
  readonly span: number;
}

/**
 * Lay out probes: `stations` slices along the length, port and starboard on each.
 *
 * Both sides matter. A centreline-only layout gives correct heave and pitch and *no roll
 * restoring moment at all*, which produces a boat that lies over in a beam sea and never comes
 * back up — a bug that reads on screen as "the physics is broken" long before anyone works out
 * that it is a probe-placement problem.
 */
export function hullProbes(form: HullForm, stations = 5): BuoyancyProbe[] {
  const probes: BuoyancyProbe[] = [];
  const sliceLength = form.length / stations;

  for (let i = 0; i < stations; i += 1) {
    const t = (i + 0.5) / stations;
    const halfBeam = (form.beam / 2) * form.halfBeamAt(t);
    const keel = form.keelAt(t);
    const z = -form.length / 2 + t * form.length;
    const span = Math.max(0.05, form.sheerAt(t) - keel);
    // Each side owns half of its slice's waterplane, and sits at the centroid of that half.
    const area = sliceLength * halfBeam;

    for (const side of [-1, 1]) {
      probes.push({
        offset: new Vector3((side * halfBeam) / 2, keel, z),
        area,
        span,
      });
    }
  }
  return probes;
}

/**
 * Volume displaced when the still water surface sits `waterY` above the hull origin.
 *
 * Deliberately evaluated through the *probe* model rather than by integrating the true hull
 * form: it is the number the solver will actually converge to, so deriving the boat's mass
 * from it makes the design draught an identity instead of a value someone tuned by eye.
 */
export function displacedVolume(probes: readonly BuoyancyProbe[], waterY: number): number {
  let volume = 0;
  for (const probe of probes) {
    volume += probe.area * clamp(waterY - probe.offset.y, 0, probe.span);
  }
  return volume;
}

/** Mass that floats this probe set at exactly the design waterline. */
export function displacementMass(probes: readonly BuoyancyProbe[], density = SEA_WATER_DENSITY): number {
  return displacedVolume(probes, 0) * density;
}

export interface BuoyancyConfig {
  mass: number;
  probes: readonly BuoyancyProbe[];
  /** Box half-extents for the inertia tensor: (beam/2, depth/2, length/2). */
  halfExtents: Vector3;
  waterDensity: number;
  /** Viscous linear damping, s⁻¹, applied in proportion to how much hull is wetted. */
  linearDamping: number;
  /** Viscous angular damping, s⁻¹. This is what stops a released heel from ringing forever. */
  angularDamping: number;
  /**
   * Quadratic drag reference area per hull axis, m². Surge is small and sway and heave are
   * large — that asymmetry is the entire reason a boat tracks straight instead of sliding.
   */
  dragArea: Vector3;
  dragCoefficient: number;
}

/** The only thing the solver needs to know about the sea. */
export type HeightSampler = (x: number, z: number) => number;

/**
 * Numerical guards, not gameplay limits.
 *
 * A probe that surfaces and re-enters inside one step can hand the integrator an arbitrarily
 * large impulse. These caps are far outside anything the boat reaches under power (30 m/s is
 * 58 knots) and exist so that a pathological step degrades into a hard landing rather than
 * into NaN, which would propagate into the camera and black the whole frame.
 */
const MAX_SPEED = 30;
const MAX_ANGULAR_SPEED = 6;

const worldProbe = new Vector3();
const lever = new Vector3();
const force = new Vector3();
const pointVelocity = new Vector3();
const localVelocity = new Vector3();
const torque = new Vector3();
const bodyOmega = new Vector3();
const bodySpin = new Vector3();
const bodyTorque = new Vector3();
const angularAcceleration = new Vector3();
const inverseOrientation = new Quaternion();
const spin = new Quaternion();

export class BuoyancySolver {
  readonly position = new Vector3();
  readonly orientation = new Quaternion();
  readonly velocity = new Vector3();
  readonly angularVelocity = new Vector3();
  readonly config: BuoyancyConfig;

  /** Volume of water pushed aside last step, m³. Equals mass/density when floating at rest. */
  submergedVolume = 0;
  /** Fraction of the probes with any part of their slice in the water, 0..1. */
  wettedFraction = 0;
  /** Vertical acceleration of the hull, m/s². What the camera's slam detector watches. */
  verticalAcceleration = 0;

  private readonly forceAccumulator = new Vector3();
  private readonly torqueAccumulator = new Vector3();
  private readonly inertia = new Vector3();
  private readonly inverseInertia = new Vector3();

  constructor(config: BuoyancyConfig) {
    this.config = config;
    this.refreshInertia();
  }

  /**
   * Recompute the inertia tensor after a mass or dimension change.
   *
   * A solid box is a poor model of a hull in absolute terms, but the ratios between the three
   * axes — very hard to yaw, moderately hard to pitch, easy to roll — are what the handling
   * actually reads as, and a box gets those ratios right for a hull of this proportion.
   */
  refreshInertia(): void {
    const { mass, halfExtents } = this.config;
    const x = (2 * halfExtents.x) ** 2;
    const y = (2 * halfExtents.y) ** 2;
    const z = (2 * halfExtents.z) ** 2;
    this.inertia.set((mass * (y + z)) / 12, (mass * (x + z)) / 12, (mass * (x + y)) / 12);
    this.inverseInertia.set(1 / this.inertia.x, 1 / this.inertia.y, 1 / this.inertia.z);
  }

  /** Queue a world-space force. `worldPoint` null applies it through the centre of gravity. */
  addForce(worldForce: Vector3, worldPoint: Vector3 | null): void {
    this.forceAccumulator.add(worldForce);
    if (worldPoint === null) return;
    lever.copy(worldPoint).sub(this.position);
    torque.copy(lever).cross(worldForce);
    this.torqueAccumulator.add(torque);
  }

  addTorque(worldTorque: Vector3): void {
    this.torqueAccumulator.add(worldTorque);
  }

  /** Hull-local point to world space. */
  localToWorld(local: Vector3, out: Vector3): Vector3 {
    return out.copy(local).applyQuaternion(this.orientation).add(this.position);
  }

  step(dt: number, sampleHeight: HeightSampler): void {
    const { mass, probes, waterDensity, dragArea, dragCoefficient } = this.config;
    const previousVerticalVelocity = this.velocity.y;

    let volume = 0;
    let wetted = 0;
    inverseOrientation.copy(this.orientation).invert();

    for (const probe of probes) {
      this.localToWorld(probe.offset, worldProbe);
      const submergence = clamp(sampleHeight(worldProbe.x, worldProbe.z) - worldProbe.y, 0, probe.span);
      if (submergence <= 0) continue;

      const displaced = probe.area * submergence;
      volume += displaced;
      wetted += 1;

      lever.copy(worldProbe).sub(this.position);

      // Archimedes: the weight of the fluid displaced, straight up, at the probe.
      force.set(0, waterDensity * GRAVITY * displaced, 0);
      this.forceAccumulator.add(force);
      this.torqueAccumulator.add(torque.copy(lever).cross(force));

      // Quadratic drag on this probe's own velocity through the water, resolved in hull axes so
      // the boat resists sideways and vertical motion far more than it resists going ahead.
      pointVelocity.copy(this.angularVelocity).cross(lever).add(this.velocity);
      localVelocity.copy(pointVelocity).applyQuaternion(inverseOrientation);
      const submergedFraction = submergence / probe.span;
      const scale = -0.5 * waterDensity * dragCoefficient * submergedFraction / probes.length;
      localVelocity.set(
        scale * dragArea.x * Math.abs(localVelocity.x) * localVelocity.x,
        scale * dragArea.y * Math.abs(localVelocity.y) * localVelocity.y,
        scale * dragArea.z * Math.abs(localVelocity.z) * localVelocity.z,
      );
      force.copy(localVelocity).applyQuaternion(this.orientation);
      this.forceAccumulator.add(force);
      this.torqueAccumulator.add(torque.copy(lever).cross(force));
    }

    this.submergedVolume = volume;
    this.wettedFraction = probes.length === 0 ? 0 : wetted / probes.length;

    this.forceAccumulator.y -= mass * GRAVITY;

    // Viscous terms. Both scale with how much hull is in the water, so a boat launched clear of
    // a crest keeps its momentum through the air instead of being dragged by nothing.
    const viscous = this.wettedFraction;
    this.forceAccumulator.addScaledVector(this.velocity, -this.config.linearDamping * mass * viscous);
    this.torqueAccumulator.addScaledVector(
      this.angularVelocity,
      -this.config.angularDamping * viscous,
    );

    this.velocity.addScaledVector(this.forceAccumulator, dt / mass);
    if (this.velocity.lengthSq() > MAX_SPEED * MAX_SPEED) this.velocity.setLength(MAX_SPEED);
    this.position.addScaledVector(this.velocity, dt);

    // Euler's rigid-body equation in body axes, gyroscopic term included: with a hull this far
    // from spherical, ω × Iω is what couples a hard turn into a bow-down pitch.
    bodyTorque.copy(this.torqueAccumulator).applyQuaternion(inverseOrientation);
    bodyOmega.copy(this.angularVelocity).applyQuaternion(inverseOrientation);
    bodySpin.set(
      bodyOmega.x * this.inertia.x,
      bodyOmega.y * this.inertia.y,
      bodyOmega.z * this.inertia.z,
    );
    bodySpin.cross(bodyOmega).add(bodyTorque);
    angularAcceleration
      .set(
        bodySpin.x * this.inverseInertia.x,
        bodySpin.y * this.inverseInertia.y,
        bodySpin.z * this.inverseInertia.z,
      )
      .applyQuaternion(this.orientation);
    this.angularVelocity.addScaledVector(angularAcceleration, dt);
    if (this.angularVelocity.lengthSq() > MAX_ANGULAR_SPEED * MAX_ANGULAR_SPEED) {
      this.angularVelocity.setLength(MAX_ANGULAR_SPEED);
    }

    // q̇ = ½ ω q. Integrated then renormalised, because 120 Hz of first-order quaternion
    // integration otherwise drifts off the unit sphere and shears the whole boat.
    spin.set(this.angularVelocity.x, this.angularVelocity.y, this.angularVelocity.z, 0);
    spin.multiply(this.orientation);
    this.orientation.set(
      this.orientation.x + spin.x * 0.5 * dt,
      this.orientation.y + spin.y * 0.5 * dt,
      this.orientation.z + spin.z * 0.5 * dt,
      this.orientation.w + spin.w * 0.5 * dt,
    );
    this.orientation.normalize();

    this.verticalAcceleration = (this.velocity.y - previousVerticalVelocity) / dt;
    this.forceAccumulator.set(0, 0, 0);
    this.torqueAccumulator.set(0, 0, 0);
  }
}
