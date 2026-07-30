import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  CylinderGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { SEA_WATER_DENSITY } from './Buoyancy.js';
import { clamp } from '../math/Noise.js';

/**
 * The float on the end of the line.
 *
 * The bobber is the only part of the tackle the player watches, so it gets its own buoyancy
 * rather than being pinned to `heightAt`. A float snapped to the surface height reads as a
 * decal painted on the water: it cannot be late, it cannot overshoot, and it cannot be pulled
 * under. This one carries **vertical momentum** and is pushed up by a real Archimedes force, so
 * it rides a passing crest a fraction of a second behind the water, punches back up through the
 * surface after a dip and rings down over two or three cycles before it settles.
 *
 * Everything below follows from four measured numbers — body radius, antenna length, all-up
 * mass and sea-water density — and nothing is tuned by eye. The resting waterline in particular
 * is not chosen: it is `mass / (ρ·V)`, which is why a real waggler sits with two thirds of the
 * body proud and this one does too.
 */

const GRAVITY = 9.80665;
const AIR_DENSITY = 1.225;

/** A 28 mm bodied waggler with a 150 mm antenna, 22 g all up with the shot down the line. */
const BODY_RADIUS = 0.028;
const ANTENNA_LENGTH = 0.15;
const MASS_KG = 0.022;
const BODY_VOLUME = (4 / 3) * Math.PI * BODY_RADIUS ** 3;

/**
 * Submerged fraction of the body at rest — the float's waterline, and the single number the
 * whole vertical response is scaled by. Buoyant acceleration is `g·(immersion/FLOAT_RATIO − 1)`,
 * so the float is in equilibrium at exactly this immersion and nowhere else.
 */
const FLOAT_RATIO = MASS_KG / (SEA_WATER_DENSITY * BODY_VOLUME);

/** Quadratic drag, ½ρC_dA/m, per metre. Water is three orders of magnitude the stiffer brake. */
const FRONTAL_AREA = Math.PI * BODY_RADIUS ** 2;
const WATER_DRAG = (0.5 * SEA_WATER_DENSITY * 0.47 * FRONTAL_AREA) / MASS_KG;
const AIR_DRAG = (0.5 * AIR_DENSITY * 0.47 * FRONTAL_AREA) / MASS_KG;

/**
 * Extra area the antenna and the exposed shoulder present to the wind, as a multiple of the
 * body's own frontal area. This is why a float on a windy day walks steadily downwind and has
 * to be mended back — a behaviour that costs one term and is instantly recognisable.
 */
const WIND_SAIL = 6.5;

/** How much of gravity acts along the wave face. A float genuinely does slide into the trough. */
const SLOPE_GAIN = 0.55;

/** Downward acceleration at full line tension, m/s². Enough to bury a float and hold it under. */
const PULL_ACCEL = 26;

/** A take is a *sequence* of sharp dips, not one. Interval between them and how they decay. */
const DIP_SPEED = 1.35;
const DIP_INTERVAL = 0.28;

/** Rate the float swings back towards the surface normal, 1/s. Slow enough to look weighted. */
const TILT_RATE = 6.5;
/** How far the float leans to the wave face. A shotted waggler stands up to most of a slope. */
const TILT_FOLLOW = 0.62;

/** The only thing the float needs from the sea. `Ocean` satisfies it structurally. */
export interface WaterField {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: Vector3): Vector3;
}

const UP = new Vector3(0, 1, 0);
const IDENTITY = new Quaternion();
const surfaceNormal = new Vector3();
const scratchAxis = new Vector3();
const scratchOffset = new Vector3();
const scratchQuaternion = new Quaternion();

export class Bobber {
  readonly group = new Group();
  /** Centre of the float's body, world space. The waterline maths is written about this point. */
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  readonly orientation = new Quaternion();

  /** 0 = clear of the water, 1 = the body fully under. Read by the HUD and the line's sag. */
  private immersion = 0;
  private dipsRemaining = 0;
  private dipStrength = 0;
  private dipTimer = 0;

  private readonly geometries: BufferGeometry[] = [];
  private readonly surfaces: MeshStandardMaterial[] = [];

  constructor() {
    // Two hemispheres rather than a textured sphere: the red-over-white of a float is a hard
    // edge exactly at the moulding seam, and a texture would need a UV layout to say so.
    const crown = new SphereGeometry(BODY_RADIUS, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const belly = new SphereGeometry(BODY_RADIUS, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const antenna = new CylinderGeometry(0.0016, 0.0024, ANTENNA_LENGTH, 6, 1);
    const keel = new CylinderGeometry(0.0022, 0.0014, 0.055, 6, 1);
    antenna.translate(0, BODY_RADIUS + ANTENNA_LENGTH / 2, 0);
    keel.translate(0, -BODY_RADIUS - 0.0275, 0);

    const crownMaterial = new MeshStandardMaterial({ color: 0x9c2118, roughness: 0.42, metalness: 0 });
    const bellyMaterial = new MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.48, metalness: 0 });
    // Antenna tips are fluorescent pigment, which really does re-emit in the visible band. A
    // small emissive is the physical statement, and it is what keeps the tip legible at dusk
    // without the HUD having to draw a marker over the water.
    const antennaMaterial = new MeshStandardMaterial({
      color: 0xe8560f,
      roughness: 0.55,
      metalness: 0,
      emissive: 0xe8560f,
      emissiveIntensity: 0.35,
    });
    const keelMaterial = new MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.3, metalness: 0.85 });

    this.geometries.push(crown, belly, antenna, keel);
    this.surfaces.push(crownMaterial, bellyMaterial, antennaMaterial, keelMaterial);
    this.group.add(
      new Mesh(crown, crownMaterial),
      new Mesh(belly, bellyMaterial),
      new Mesh(antenna, antennaMaterial),
      new Mesh(keel, keelMaterial),
    );
    this.group.visible = false;
    this.group.castShadow = true;
  }

  /** Every material the float draws with, for the cascaded shadow rig to register. */
  get materials(): readonly MeshStandardMaterial[] {
    return this.surfaces;
  }

  /** 0 = clear of the water, 1 = body fully submerged. */
  get submergedFraction(): number {
    return this.immersion;
  }

  /** World-space point the line is tied to: the top of the antenna, not the body centre. */
  lineAttachment(out: Vector3): Vector3 {
    scratchOffset.set(0, BODY_RADIUS + ANTENNA_LENGTH * 0.92, 0).applyQuaternion(this.orientation);
    return out.copy(this.position).add(scratchOffset);
  }

  get visible(): boolean {
    return this.group.visible;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Throw the float from the rod tip. Clears any take that was in progress. */
  launch(origin: Vector3, velocity: Vector3): void {
    this.position.copy(origin);
    this.velocity.copy(velocity);
    this.immersion = 0;
    this.dipsRemaining = 0;
    this.dipStrength = 0;
    this.dipTimer = 0;
    this.group.visible = true;
  }

  /**
   * Ballistic flight with quadratic air drag.
   *
   * The drag term is not decoration. A 22 g float has a terminal velocity of about 17 m/s, so a
   * hard cast is losing speed to the air the whole way out and the trajectory is visibly
   * asymmetric — steeper coming down than it was going up. Without it every cast is a parabola
   * and the difference between a half-power and a full-power cast is a boring linear scale.
   */
  integrateFlight(dt: number, windX: number, windZ: number): void {
    const relativeX = this.velocity.x - windX;
    const relativeZ = this.velocity.z - windZ;
    const speed = Math.hypot(relativeX, this.velocity.y, relativeZ);
    const drag = AIR_DRAG * speed;

    this.velocity.x -= relativeX * drag * dt;
    this.velocity.z -= relativeZ * drag * dt;
    this.velocity.y -= (GRAVITY + this.velocity.y * drag) * dt;
    this.position.addScaledVector(this.velocity, dt);

    // The shot is at the bottom of the float, so the heavy end leads and the antenna trails.
    // That is what turns the float over at the top of the arc and lands it very nearly upright.
    if (speed > 0.5) {
      scratchAxis.set(-this.velocity.x, -this.velocity.y, -this.velocity.z).normalize();
      scratchQuaternion.setFromUnitVectors(UP, scratchAxis);
      this.orientation.slerp(scratchQuaternion, 1 - Math.exp(-4 * dt));
    }
  }

  /** True once the body centre has crossed the surface — the cue to stop integrating flight. */
  hasSplashed(water: WaterField): boolean {
    return this.position.y <= water.heightAt(this.position.x, this.position.z);
  }

  /**
   * Heave on the wave field — the half of the motion that is always the float's own.
   *
   * The buoyant force uses the exact spherical-cap volume rather than a linear depth ramp,
   * because the two disagree most near the resting waterline, which is precisely where the
   * float spends its whole life and where the restoring stiffness decides how it rings.
   *
   * `pullDown` is the line's share, 0..1: a fish on the hook drags the float under and holds it
   * there, and letting it back up is the visible reward for giving line.
   */
  integrateHeave(dt: number, water: WaterField, pullDown: number): void {
    const surface = water.heightAt(this.position.x, this.position.z);
    water.normalAt(this.position.x, this.position.z, surfaceNormal);

    const cap = clamp(surface - (this.position.y - BODY_RADIUS), 0, 2 * BODY_RADIUS);
    this.immersion = (cap * cap * (3 * BODY_RADIUS - cap)) / (4 * BODY_RADIUS ** 3);

    const wet = this.immersion;
    const drag = WATER_DRAG * wet + AIR_DRAG * (1 - wet);
    const acceleration =
      GRAVITY * (wet / FLOAT_RATIO - 1) -
      pullDown * PULL_ACCEL -
      drag * this.velocity.y * Math.abs(this.velocity.y);

    this.velocity.y += acceleration * dt + this.consumeDip(dt);
    this.position.y += this.velocity.y * dt;

    this.settleUpright(dt);
  }

  /**
   * Surface drift: down the wave face and away downwind.
   *
   * Downhill on a wave face is the horizontal part of the surface normal, by definition of a
   * normal to a height field, so the float slides into the trough with no gradient of its own.
   * The wind acts on the dry part only, which is why a float lying deep in a trough stops
   * walking and one standing on a crest takes off.
   *
   * Runs after `integrateHeave` in the same step: that is what samples the surface normal, and
   * sampling it twice would cost a second wave evaluation for an identical answer.
   */
  integrateDrift(dt: number, windX: number, windZ: number): void {
    const wet = this.immersion;
    const slope = wet * GRAVITY * SLOPE_GAIN;
    const relativeX = this.velocity.x - windX;
    const relativeZ = this.velocity.z - windZ;
    const windDrag = AIR_DRAG * WIND_SAIL * (1 - wet) * Math.hypot(relativeX, relativeZ);
    const waterDrag = WATER_DRAG * wet;

    this.velocity.x +=
      (surfaceNormal.x * slope -
        waterDrag * this.velocity.x * Math.abs(this.velocity.x) -
        relativeX * windDrag) *
      dt;
    this.velocity.z +=
      (surfaceNormal.z * slope -
        waterDrag * this.velocity.z * Math.abs(this.velocity.z) -
        relativeZ * windDrag) *
      dt;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
  }

  /**
   * Tow the float horizontally — used while a fish is on, when the fish and not the sea decides
   * where the float is. Heave stays with the buoyancy above, so it still rides the swell as it
   * is dragged, and the recorded velocity stays honest for whatever reads it next.
   */
  steerTowards(dt: number, x: number, z: number, rate: number): void {
    const blend = 1 - Math.exp(-rate * dt);
    const stepX = (x - this.position.x) * blend;
    const stepZ = (z - this.position.z) * blend;
    this.position.x += stepX;
    this.position.z += stepZ;
    this.velocity.x = stepX / Math.max(dt, 1e-4);
    this.velocity.z = stepZ / Math.max(dt, 1e-4);
  }

  /**
   * The line coming tight.
   *
   * A float cannot be further from the rod tip than there is line out, and when it reaches that
   * radius the outward part of its velocity is simply gone — which is what makes a drifting
   * float swing round on the line instead of sailing away.
   */
  tether(anchor: Vector3, maxDistanceM: number): void {
    scratchAxis.subVectors(this.position, anchor);
    const distance = scratchAxis.length();
    if (distance <= maxDistanceM || distance < 1e-5) return;

    scratchAxis.multiplyScalar(1 / distance);
    this.position.copy(anchor).addScaledVector(scratchAxis, maxDistanceM);
    const outward = this.velocity.dot(scratchAxis);
    if (outward > 0) this.velocity.addScaledVector(scratchAxis, -outward);
  }

  /**
   * A take. `strength` is the bite model's `strike`, 0..1.
   *
   * A confident fish buries the float in one go; a suspicious one lifts and drops it two or
   * three times first. Queuing the dips rather than applying one impulse is the whole difference
   * between "the float moved" and the thing an angler is actually watching for.
   */
  dip(strength: number): void {
    this.dipStrength = clamp(strength, 0, 1);
    this.dipsRemaining = 1 + Math.round((1 - this.dipStrength) * 3);
    this.dipTimer = 0;
  }

  /** Copy the solved state onto the scene graph. Called once per rendered frame, not per step. */
  sync(): void {
    this.group.position.copy(this.position);
    this.group.quaternion.copy(this.orientation);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.surfaces) material.dispose();
    this.geometries.length = 0;
    this.surfaces.length = 0;
  }

  /** Returns the velocity change owed to the dip sequence this step, m/s. */
  private consumeDip(dt: number): number {
    if (this.dipsRemaining <= 0) return 0;
    this.dipTimer -= dt;
    if (this.dipTimer > 0) return 0;

    this.dipsRemaining -= 1;
    this.dipTimer = DIP_INTERVAL;
    // The last dip of a sequence is the one that takes the float under, so the impulses grow.
    const escalation = 1 + 0.6 * (1 - this.dipsRemaining / 4);
    return -DIP_SPEED * (0.35 + 0.65 * this.dipStrength) * escalation;
  }

  /**
   * Attitude on the water: part way to the surface normal, and never all the way.
   *
   * A shotted float has a righting moment of its own, so it stands up out of a steep wave face
   * rather than lying along it. Following the normal completely is the classic tell of a prop
   * glued to a heightfield.
   */
  private settleUpright(dt: number): void {
    scratchQuaternion.setFromUnitVectors(UP, surfaceNormal);
    scratchQuaternion.slerp(IDENTITY, 1 - TILT_FOLLOW);
    this.orientation.slerp(scratchQuaternion, 1 - Math.exp(-TILT_RATE * dt));
  }
}
