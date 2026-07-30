import { Quaternion, Vector3, type MeshStandardMaterial } from 'three';
import type { Engine, System } from '../core/Engine.js';
import { clamp, damp } from '../math/Noise.js';
import {
  BuoyancySolver,
  SEA_WATER_DENSITY,
  WORKBOAT_FORM,
  displacementMass,
  hullProbes,
  type BuoyancyConfig,
  type BuoyancyProbe,
  type HeightSampler,
} from './Buoyancy.js';
import { buildBoat, type BoatParts, type MaterialSource } from './BoatGeometry.js';

/**
 * The boat: hull, engine, rudder, ground tackle and lights.
 *
 * Everything the player does to the world goes through here. The solver in `Buoyancy.ts` does
 * the floating; this file decides where the loads come from, and every one of them is a real
 * load applied at a real point rather than a velocity nudged towards a target. Thrust goes in
 * at the propeller, low and aft, so opening the throttle lifts the bow because that is what a
 * force below the centre of gravity does. The rudder is a side force on the stern, so the boat
 * pivots about a point a third of the way back from the bow like a boat and not like a car.
 *
 * Two loads live here rather than in `BuoyancyConfig`, and both for the same reason: the
 * solver's damping terms are *isotropic*, and a hull is not. A hull that heaves makes waves and
 * loses energy an order of magnitude faster than a hull that surges, and a model that damps
 * both equally has to choose between a boat that bobs like a cork and a boat with an engine the
 * size of a tug's. See `applyHullLoads`.
 */

const GRAVITY = 9.80665;
const KNOTS_PER_MPS = 1.943844;

/**
 * Solar altitude at which the navigation lights come on: −0.833°, the standard sunset
 * definition — the sun's upper limb touching a sea horizon, refraction included.
 *
 * This is the real threshold from the live ephemeris, not a clock. On a June evening in
 * Reykjavík the lights stay off until nearly midnight, and they should.
 */
const SUNSET_ALTITUDE_DEG = -0.833;

/** Peak thrust of the engine, newtons. Sized for about 8 knots on a 6.5 t displacement hull. */
const MAX_THRUST = 6000;
/** Astern thrust as a fraction of ahead. A propeller in reverse is a badly shaped propeller. */
const REVERSE_FRACTION = 0.4;
const BOOST_FACTOR = 1.65;

/**
 * Rudder side force per (m/s)², newtons. With the lever below it works out at about 19°/s of
 * yaw at cruise, or a turning circle of a little under two boat lengths.
 */
const RUDDER_AUTHORITY = 120;
/**
 * Slipstream over the rudder with the throttle open, m/s. A rudder behind a propeller has bite
 * at rest; without this term the boat cannot be turned off a mooring, which is simply wrong.
 */
const PROP_WASH = 1.6;

/** Windage of the topsides, cabin and mast: area m², drag coefficient, air density kg/m³. */
const WINDAGE_AREA = 4.6;
const WINDAGE_DRAG = 1.05;
const AIR_DENSITY = 1.225;

/** Ground tackle. The rode is a spring with a lot of damping in it and a finite breaking load. */
const ANCHOR_SPRING = 5200;
const ANCHOR_DAMPING = 11000;
const ANCHOR_MAX_TENSION = 42000;

/** Emissive radiance of the lenses when lit. Linear HDR; the composer tone maps. */
const SIDELIGHT_RADIANCE = 9;
const MASTHEAD_RADIANCE = 14;
const LANTERN_RADIANCE = 7;

/** Hull-space points the control loads are applied at. */
const THRUST_POINT = new Vector3(0, -0.34, 3.1);
const RUDDER_POINT = new Vector3(0, -0.28, 3.35);
const WINDAGE_POINT = new Vector3(0, 1.15, 0.2);
const BOW_FAIRLEAD = new Vector3(0, 0.9, -3.3);

/** Vertical centre of gravity below the design waterline: engine, tanks and batteries. */
const VERTICAL_CG = -0.18;

/** Target damping ratios. Sized against the hull's own natural frequencies, not by eye. */
const HEAVE_DAMPING_RATIO = 0.26;
const ROLL_DAMPING_RATIO = 0.38;
const PITCH_DAMPING_RATIO = 0.3;
/** Time constants for the modes with no restoring force at all, seconds. */
const YAW_TIME_CONSTANT = 0.85;
const SWAY_TIME_CONSTANT = 0.75;
const SURGE_TIME_CONSTANT = 7.5;

/** The only thing the boat needs from the sea. `Ocean` satisfies it structurally. */
export interface WaterSurface {
  heightAt(x: number, z: number): number;
}

export interface HullPhysics {
  readonly config: BuoyancyConfig;
  /** Centre of gravity in hull coordinates: abaft midships, low in the bilge. */
  readonly centreOfGravity: Vector3;
  /** Linear wave-radiation damping in hull axes, N per m/s: (sway, heave, surge). */
  readonly radiationDamping: Vector3;
  /** Rotational wave-radiation damping about hull axes, N·m per rad/s: (pitch, yaw, roll). */
  readonly rotationalRadiationDamping: Vector3;
  /** Righting moment the probe quadrature loses, N·m per radian. See `quadratureRighting`. */
  readonly metacentricCorrection: { readonly roll: number; readonly pitch: number };
}

/**
 * The righting moment ten probes cannot see.
 *
 * `hullProbes` is a coarse quadrature of the waterplane and it is coarse in two ways that both
 * cost stability, and both are exactly computable:
 *
 *   1. **Two point areas at ±b/2 carry three quarters of the second moment of the strip they
 *      stand for.** A strip of half-beam `b` has `I = 2b³/3` per metre of length; two probes of
 *      area `b` at `±b/2` give `b³/2`. So BM comes out a third short of the truth, always.
 *   2. **Each probe lifts on the keel, not at the middle of the water it displaces.** The slice
 *      the model displaces is a prism from the keel up to the surface, whose centroid is half a
 *      draught above the keel; applying the force a whole draught lower drags the effective
 *      centre of buoyancy down with it and takes the same distance straight off GM.
 *
 * The two together cost this hull two thirds of its transverse stability — GM 0.14 m from the
 * probes against 0.78 m from the form — and 0.14 m is not a stiff boat, it is a boat that lies
 * down in a beam sea and stays down. The buoyancy test suite found exactly that.
 *
 * So the deficit is computed from the probe set's own moments and applied as a couple. This
 * corrects a known quadrature error rather than inventing a force: give `hullProbes` a finer
 * lattice and every term below shrinks towards zero on its own.
 */
function quadratureRighting(
  probes: readonly BuoyancyProbe[],
  density: number,
  sliceLength: number,
): { roll: number; pitch: number } {
  let area = 0;
  let transverse = 0;
  let depth = 0;
  for (const probe of probes) {
    area += probe.area;
    transverse += probe.area * probe.offset.x * probe.offset.x;
    depth += probe.area * probe.offset.y * probe.offset.y;
  }
  const scale = density * GRAVITY;
  // Longitudinally the probes sit at the midpoint of their slice, so the error there is the
  // midpoint rule's own: ∫z² over a slice exceeds `length · z_mid²` by `length³/12`.
  return {
    roll: scale * (transverse / 3 + depth / 2),
    pitch: scale * ((area * sliceLength * sliceLength) / 12 + depth / 2),
  };
}

/**
 * The box inertia tensor `BuoyancySolver.refreshInertia` builds.
 *
 * Recomputed here rather than read off the solver because the solver keeps it private, and the
 * rotational damping below is meaningless unless it is sized against the same numbers.
 */
function boxInertia(mass: number, halfExtents: Vector3, out: Vector3): Vector3 {
  const x = (2 * halfExtents.x) ** 2;
  const y = (2 * halfExtents.y) ** 2;
  const z = (2 * halfExtents.z) ** 2;
  return out.set((mass * (y + z)) / 12, (mass * (x + z)) / 12, (mass * (x + y)) / 12);
}

/**
 * Longitudinal centre of buoyancy at rest, metres abaft midships.
 *
 * A workboat carries its beam aft, so its buoyancy is aft too. With the weight applied at the
 * body origin the hull would settle seven degrees down by the head — visibly, permanently wrong.
 * Putting the centre of gravity here instead is not a fudge; it is where the engine, the tanks
 * and the helmsman actually are on a boat shaped like this one.
 */
function restingCentreOfBuoyancy(probes: readonly BuoyancyProbe[]): number {
  let volume = 0;
  let moment = 0;
  for (const probe of probes) {
    const displaced = probe.area * clamp(-probe.offset.y, 0, probe.span);
    volume += displaced;
    moment += displaced * probe.offset.z;
  }
  return volume === 0 ? 0 : moment / volume;
}

/**
 * Restoring stiffness of the three modes that have one — the numbers the damping is sized from.
 *
 * Heave is the waterplane area. Roll and pitch are the second moments of that area *less* the
 * probes' own depth below the origin: the `−y²` term is the buoyant force's lever working
 * against the hull, and dropping it is how a boat ends up with a righting moment that looks
 * plausible and is far too large. Then the two things that add stability back: the weight
 * couple, because the centre of gravity is below the origin, and the quadrature correction.
 */
function restoringStiffness(
  probes: readonly BuoyancyProbe[],
  density: number,
  mass: number,
  centreOfGravity: Vector3,
  correction: { roll: number; pitch: number },
): { heave: number; roll: number; pitch: number } {
  let area = 0;
  let roll = 0;
  let pitch = 0;
  for (const probe of probes) {
    const { x, y, z } = probe.offset;
    area += probe.area;
    roll += probe.area * (x * x - y * y);
    pitch += probe.area * (z * z - y * y);
  }
  const scale = density * GRAVITY;
  const pendulum = -centreOfGravity.y * mass * GRAVITY;
  return {
    heave: scale * area,
    roll: Math.max(1, scale * roll + pendulum + correction.roll),
    pitch: Math.max(1, scale * pitch + pendulum + correction.pitch),
  };
}

/**
 * The complete physical description of the workboat.
 *
 * Mass is *derived* from the probe set rather than chosen, so the design draught in
 * `WORKBOAT_FORM` is an identity instead of a number somebody nudged until it looked right.
 * Every damping coefficient below is then derived from that mass and the hull's own restoring
 * stiffnesses, which means the numbers stay correct if the hull form is ever changed.
 */
export function createWorkboatPhysics(): HullPhysics {
  const probes = hullProbes(WORKBOAT_FORM);
  const mass = displacementMass(probes);
  const depth = WORKBOAT_FORM.sheerAt(0.5) - WORKBOAT_FORM.keelAt(0.5);
  const halfExtents = new Vector3(WORKBOAT_FORM.beam / 2, depth / 2, WORKBOAT_FORM.length / 2);

  const centreOfGravity = new Vector3(0, VERTICAL_CG, restingCentreOfBuoyancy(probes));
  // Two probes per station, so the station count — and therefore the slice length — falls out.
  const sliceLength = WORKBOAT_FORM.length / Math.max(1, probes.length / 2);
  const metacentricCorrection = quadratureRighting(probes, SEA_WATER_DENSITY, sliceLength);
  const stiffness = restoringStiffness(
    probes,
    SEA_WATER_DENSITY,
    mass,
    centreOfGravity,
    metacentricCorrection,
  );
  const inertia = boxInertia(mass, halfExtents, new Vector3());

  const config: BuoyancyConfig = {
    mass,
    probes,
    halfExtents,
    waterDensity: SEA_WATER_DENSITY,
    // Deliberately almost nothing: the isotropic terms exist only to bleed off the last of a
    // numerical wobble. The physical damping is the anisotropic set below.
    linearDamping: 0.05,
    angularDamping: 400,
    // Surge is the frontal area of the immersed hull; sway is its whole lateral profile; heave
    // is the waterplane. That 1 : 4.6 : 15 ratio is the entire reason the boat tracks.
    dragArea: new Vector3(4.6, 15, 1),
    dragCoefficient: 0.85,
  };

  return {
    config,
    centreOfGravity,
    metacentricCorrection,
    radiationDamping: new Vector3(
      mass / SWAY_TIME_CONSTANT,
      2 * HEAVE_DAMPING_RATIO * Math.sqrt(stiffness.heave * mass),
      mass / SURGE_TIME_CONSTANT,
    ),
    rotationalRadiationDamping: new Vector3(
      2 * PITCH_DAMPING_RATIO * Math.sqrt(stiffness.pitch * inertia.x),
      inertia.y / YAW_TIME_CONSTANT,
      2 * ROLL_DAMPING_RATIO * Math.sqrt(stiffness.roll * inertia.z),
    ),
  };
}

const inverseOrientation = new Quaternion();
const hullVector = new Vector3();
const worldVector = new Vector3();
const worldPoint = new Vector3();
const torqueVector = new Vector3();
const hullAthwart = new Vector3();
const hullFore = new Vector3();

/**
 * The loads that act on the hull whatever the player is doing: radiation damping and the weight
 * couple. Called once per fixed step, before the control loads and before `solver.step`.
 *
 * Both terms scale with how much hull is in the water, so a boat that launches clear of a crest
 * carries its momentum through the air instead of being braked by nothing — the same rule the
 * solver applies to its own viscous terms.
 */
export function applyHullLoads(solver: BuoyancySolver, physics: HullPhysics): void {
  const wetted = solver.wettedFraction;
  if (wetted > 0) {
    inverseOrientation.copy(solver.orientation).invert();

    hullVector.copy(solver.velocity).applyQuaternion(inverseOrientation);
    const linear = physics.radiationDamping;
    worldVector
      .set(-hullVector.x * linear.x, -hullVector.y * linear.y, -hullVector.z * linear.z)
      .multiplyScalar(wetted)
      .applyQuaternion(solver.orientation);
    solver.addForce(worldVector, null);

    hullVector.copy(solver.angularVelocity).applyQuaternion(inverseOrientation);
    const angular = physics.rotationalRadiationDamping;
    worldVector
      .set(-hullVector.x * angular.x, -hullVector.y * angular.y, -hullVector.z * angular.z)
      .multiplyScalar(wetted)
      .applyQuaternion(solver.orientation);
    solver.addTorque(worldVector);
  }

  // Weight acts at the centre of gravity; the solver applies it at the body origin. The
  // difference is a pure couple, and it is the whole reason the hull floats level.
  worldPoint.copy(physics.centreOfGravity).applyQuaternion(solver.orientation);
  worldVector.set(0, -physics.config.mass * GRAVITY, 0);
  solver.addTorque(torqueVector.copy(worldPoint).cross(worldVector));

  if (wetted <= 0) return;

  // The righting moment the quadrature loses. Both axes fall out of the hull's own basis with
  // no trigonometry: the vertical component of the athwartships axis *is* the sine of the heel,
  // and the vertical component of the fore-and-aft axis is minus the sine of the trim. Using
  // the sine rather than the angle is the standard GZ = GM·sin φ righting arm, and it is what
  // makes capsize an unstable equilibrium instead of a second stable one.
  hullAthwart.set(1, 0, 0).applyQuaternion(solver.orientation);
  hullFore.set(0, 0, 1).applyQuaternion(solver.orientation);
  const correction = physics.metacentricCorrection;
  solver.addTorque(
    torqueVector.copy(hullFore).multiplyScalar(-correction.roll * hullAthwart.y * wetted),
  );
  solver.addTorque(
    torqueVector.copy(hullAthwart).multiplyScalar(correction.pitch * hullFore.y * wetted),
  );
}

const controlForce = new Vector3();
const controlPoint = new Vector3();
const localVelocity = new Vector3();
const localWind = new Vector3();
const forwardAxis = new Vector3();

export class Boat implements System {
  readonly name = 'boat';
  readonly priority = 20;

  readonly parts: BoatParts;
  readonly solver: BuoyancySolver;
  private readonly physics: HullPhysics;
  private readonly water: WaterSurface;
  /** Bound once. The solver calls it ten times per step and must not allocate a closure. */
  private readonly sampleHeight: HeightSampler;

  private throttle = 0;
  private rudder = 0;
  private boost = 0;
  private anchored = false;
  private readonly anchorPoint = new Vector3();
  private lightLevel = 0;
  private flagPhase = 0;

  private constructor(engine: Engine, water: WaterSurface, parts: BoatParts) {
    this.water = water;
    this.parts = parts;
    this.physics = createWorkboatPhysics();
    this.solver = new BuoyancySolver(this.physics.config);
    this.sampleHeight = (x, z) => this.water.heightAt(x, z);

    // Start on the surface rather than dropped from the origin: a two-metre splash on frame one
    // is the first thing a player would see and it would read as a bug.
    this.solver.position.set(0, water.heightAt(0, 0), 0);
    engine.scene.add(parts.group);
  }

  static async create(
    engine: Engine,
    water: WaterSurface,
    materials: MaterialSource,
  ): Promise<Boat> {
    return new Boat(engine, water, await buildBoat(materials));
  }

  /** Hull origin in world space — the design waterline, amidships. */
  get position(): Vector3 {
    return this.solver.position;
  }

  get velocity(): Vector3 {
    return this.solver.velocity;
  }

  /** Hull attitude. The camera reads it for roll and for the first-person eye. */
  get orientation(): Quaternion {
    return this.solver.orientation;
  }

  /** Speed over ground in knots, horizontal only; heave is not progress. */
  get speedKnots(): number {
    return Math.hypot(this.solver.velocity.x, this.solver.velocity.z) * KNOTS_PER_MPS;
  }

  /** Heading in radians from north, eastward — the same convention as `WorldState.windDirection`. */
  get heading(): number {
    forwardAxis.set(0, 0, -1).applyQuaternion(this.solver.orientation);
    return Math.atan2(forwardAxis.x, -forwardAxis.z);
  }

  /** Vertical acceleration of the hull, m/s². The camera's slam detector watches this. */
  get verticalAcceleration(): number {
    return this.solver.verticalAcceleration;
  }

  get isAnchored(): boolean {
    return this.anchored;
  }

  /** Throttle setting after smoothing, −1 (full astern) .. +1. For the HUD. */
  get throttleSetting(): number {
    return this.throttle;
  }

  /**
   * Every material the boat draws with, for the shadow rig to register.
   *
   * Three's cascaded shadow maps put one directional light in the scene per cascade and expect
   * `CSM.setupMaterial` to teach a material to take exactly one of them. Skip it and the hull
   * is lit three times over.
   */
  get materials(): readonly MeshStandardMaterial[] {
    return this.parts.materials;
  }

  /** Tip of the rod seated in the holder, world space. */
  rodTipWorldPosition(out: Vector3): Vector3 {
    return this.solver.localToWorld(this.parts.rodTipOffset, out);
  }

  /** Where a person stands on the deck, world space. */
  deckPoint(out: Vector3): Vector3 {
    return this.solver.localToWorld(this.parts.deckOffset, out);
  }

  fixedUpdate(dt: number, engine: Engine): void {
    const input = engine.input;
    // Held axes are safe to read at 120 Hz; the anchor *edge* is not, because a frame can run
    // six fixed steps and would toggle it six times. That one lives in `update`.
    this.throttle = damp(this.throttle, input.throttleAxis, 1.8, dt);
    this.rudder = damp(this.rudder, input.rudderAxis, 6, dt);
    this.boost = damp(this.boost, input.isHeld('boost') ? 1 : 0, 3.5, dt);

    applyHullLoads(this.solver, this.physics);
    this.applyPropulsion(engine);
    this.applyWindage(engine);
    if (this.anchored) this.applyGroundTackle();

    this.solver.step(dt, this.sampleHeight);
  }

  update(dt: number, engine: Engine): void {
    if (engine.input.wasPressed('anchor')) {
      this.anchored = !this.anchored;
      if (this.anchored) this.anchorPoint.copy(this.solver.position);
    }

    this.parts.group.position.copy(this.solver.position);
    this.parts.group.quaternion.copy(this.solver.orientation);

    this.updateNavigationLights(dt, engine);
    this.updateCanvasAndCordage(dt, engine);
  }

  dispose(): void {
    this.parts.group.removeFromParent();
    this.parts.dispose();
  }

  /**
   * Engine and rudder.
   *
   * Thrust is applied at the propeller — aft of and below the centre of gravity — so opening
   * the throttle squats the stern and lifts the bow, and closing it drops the bow again. The
   * rudder is a side force at the same station, scaled by the square of the water speed past
   * it, which is what makes a boat unsteerable when it is stopped and knife-edged when it is
   * not. Both fade with the wetted fraction: a propeller in the air does nothing.
   */
  private applyPropulsion(engine: Engine): void {
    const solver = this.solver;
    const wetted = solver.wettedFraction;
    if (wetted <= 0) return;

    // A steep sea takes the way off a small boat: the propeller ventilates on every crest and
    // the rudder spends part of its time in aerated water.
    const beaufort = engine.world.beaufort;
    const thrustLoss = clamp(1 - 0.035 * beaufort, 0.55, 1);
    const steeringLoss = clamp(1 - 0.05 * beaufort, 0.4, 1);

    const direction = this.throttle >= 0 ? 1 : REVERSE_FRACTION;
    const thrust =
      MAX_THRUST *
      this.throttle *
      direction *
      (1 + (BOOST_FACTOR - 1) * this.boost) *
      thrustLoss *
      wetted;

    forwardAxis.set(0, 0, -1).applyQuaternion(solver.orientation);
    solver.addForce(
      controlForce.copy(forwardAxis).multiplyScalar(thrust),
      solver.localToWorld(THRUST_POINT, controlPoint),
    );

    inverseOrientation.copy(solver.orientation).invert();
    localVelocity.copy(solver.velocity).applyQuaternion(inverseOrientation);
    const flow = -localVelocity.z + PROP_WASH * this.throttle;
    // Starboard helm pushes the stern to port, which is −X in hull axes; `flow * |flow|`
    // reverses the whole thing when the boat is going astern, exactly as a real rudder does.
    const side = -this.rudder * RUDDER_AUTHORITY * flow * Math.abs(flow) * steeringLoss * wetted;
    controlForce.set(side, 0, 0).applyQuaternion(solver.orientation);
    solver.addForce(controlForce, solver.localToWorld(RUDDER_POINT, controlPoint));
  }

  /**
   * Wind on the topsides.
   *
   * Applied at the centre of the cabin and mast, well above the centre of gravity, so a beam
   * wind heels the boat as well as setting it to leeward. The pressure is against the *relative*
   * wind, so driving into it costs more than driving with it.
   */
  private applyWindage(engine: Engine): void {
    const world = engine.world;
    const relativeX = world.windX - this.solver.velocity.x;
    const relativeZ = world.windZ - this.solver.velocity.z;
    const speed = Math.hypot(relativeX, relativeZ);
    if (speed < 1e-4) return;

    const pressure = 0.5 * AIR_DENSITY * WINDAGE_DRAG * WINDAGE_AREA * speed;
    controlForce.set(relativeX * pressure, 0, relativeZ * pressure);
    this.solver.addForce(controlForce, this.solver.localToWorld(WINDAGE_POINT, controlPoint));
  }

  /**
   * The anchor rode: a stiff spring with a great deal of damping, led through the bow fairlead.
   *
   * Taking it at the bow rather than through the centre of gravity is what makes an anchored
   * boat lie head to wind on its own, with no weathervaning code anywhere. The tension is capped
   * so that a boat caught by a crest snubs hard instead of being flung back to the anchor.
   */
  private applyGroundTackle(): void {
    const solver = this.solver;
    const deltaX = solver.position.x - this.anchorPoint.x;
    const deltaZ = solver.position.z - this.anchorPoint.z;
    controlForce.set(
      -ANCHOR_SPRING * deltaX - ANCHOR_DAMPING * solver.velocity.x,
      0,
      -ANCHOR_SPRING * deltaZ - ANCHOR_DAMPING * solver.velocity.z,
    );
    const tension = controlForce.length();
    if (tension > ANCHOR_MAX_TENSION) controlForce.multiplyScalar(ANCHOR_MAX_TENSION / tension);
    solver.addForce(controlForce, solver.localToWorld(BOW_FAIRLEAD, controlPoint));
  }

  /**
   * Lights on when the sun is down.
   *
   * The *decision* is astronomical and instantaneous — solar altitude below −0.833° — and there
   * is no clock anywhere in it. The ramp is the filament coming up to heat, which is why it is
   * a damp and not a lerp over a fixed duration.
   */
  private updateNavigationLights(dt: number, engine: Engine): void {
    const ephemeris = engine.world.ephemeris;
    const lit = ephemeris !== null && ephemeris.sunAltitudeDeg < SUNSET_ALTITUDE_DEG;
    this.lightLevel = damp(this.lightLevel, lit ? 1 : 0, 3, dt);

    const lights = this.parts.navLights;
    lights.port.material.emissiveIntensity = this.lightLevel * SIDELIGHT_RADIANCE;
    lights.starboard.material.emissiveIntensity = this.lightLevel * SIDELIGHT_RADIANCE;
    lights.stern.material.emissiveIntensity = this.lightLevel * SIDELIGHT_RADIANCE;
    lights.masthead.material.emissiveIntensity = this.lightLevel * MASTHEAD_RADIANCE;
    lights.lantern.material.emissiveIntensity = this.lightLevel * LANTERN_RADIANCE;
  }

  /**
   * Flag and cordage, both driven by the one wind vector in `WorldState`.
   *
   * The ensign points down the *relative* wind and flutters faster the harder it blows, and
   * droops when it does not. Each slack line is swung about its own chord by the crosswind
   * component in its own frame, which moves the belly and leaves both made-off ends exactly
   * where they were — the thing that actually looks wrong when a rope is animated carelessly.
   */
  private updateCanvasAndCordage(dt: number, engine: Engine): void {
    const world = engine.world;
    const relativeX = world.windX - this.solver.velocity.x;
    const relativeZ = world.windZ - this.solver.velocity.z;
    const speed = Math.hypot(relativeX, relativeZ);

    inverseOrientation.copy(this.solver.orientation).invert();
    localWind.set(relativeX, 0, relativeZ).applyQuaternion(inverseOrientation);

    this.flagPhase += dt * (2.4 + speed * 0.85);

    const flag = this.parts.flag;
    if (speed > 1e-3) flag.pivot.rotation.y = Math.atan2(-localWind.z, localWind.x);

    const amplitude = clamp(0.015 + speed * 0.02, 0.015, 0.15);
    const droop = clamp(0.26 - speed * 0.035, 0, 0.26);
    const rest = flag.rest;
    const positions = flag.positions;
    for (let i = 0; i < positions.count; i += 1) {
      const x = rest[i * 3] ?? 0;
      const y = rest[i * 3 + 1] ?? 0;
      const along = x / flag.width;
      // The travelling wave grows down the fly and is sheared across the hoist, which is what
      // gives cloth its diagonal ripple instead of a corrugated-iron ripple.
      const wave = Math.sin(9.5 * x - this.flagPhase * 4.2 + y * 3.1);
      positions.setXYZ(i, x, y - droop * along * along, amplitude * along * along * wave);
    }
    positions.needsUpdate = true;
    flag.mesh.geometry.computeVertexNormals();

    for (let i = 0; i < this.parts.ropes.length; i += 1) {
      const line = this.parts.ropes[i];
      if (line === undefined) continue;
      // The line's own frame is a pure yaw off the hull, so rotating the hull wind back through
      // that yaw gives the crosswind on the rope directly.
      const yaw = line.root.rotation.y;
      const across = localWind.x * Math.sin(yaw) + localWind.z * Math.cos(yaw);
      const flutter = Math.sin(this.flagPhase * 1.7 + i * 2.1) * 0.18 * speed;
      line.pivot.quaternion.setFromAxisAngle(
        line.axis,
        clamp(line.response * (across + flutter), -1.3, 1.3),
      );
    }
  }
}
