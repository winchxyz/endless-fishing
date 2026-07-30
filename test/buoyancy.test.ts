import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  BuoyancySolver,
  SEA_WATER_DENSITY,
  WORKBOAT_FORM,
  displacementMass,
  hullProbes,
  type HeightSampler,
} from '../src/entities/Buoyancy.js';
import { applyHullLoads, createWorkboatPhysics, type HullPhysics } from '../src/entities/Boat.js';

/**
 * Buoyancy validation.
 *
 * The failure modes of a hand-written floating-body solver are all silent. A boat that sinks a
 * centimetre a minute looks fine for the first thirty seconds. A boat that gains a little energy
 * every wave looks *lively* right up until it launches itself into the sky on frame nine
 * thousand. A hull with no righting moment lies over in a beam sea and never comes back, and
 * from the deck that reads as "the physics is broken" rather than as a probe-placement bug.
 * None of those show up in a screenshot, and all four of them show up here.
 *
 * The solver takes the sea as a callback, so every one of these runs against an analytic
 * surface with no GPU, no renderer and no engine anywhere near it — which is why they can
 * afford to run twenty thousand steps.
 */

const FIXED_STEP = 1 / 120;
const GRAVITY = 9.80665;

/** Dead flat water at datum. The reference the equilibrium tests are measured against. */
const STILL: HeightSampler = () => 0;

function newSolver(physics: HullPhysics): BuoyancySolver {
  return new BuoyancySolver(physics.config);
}

/** One fixed step of the full boat model: standing loads, then the solver. */
function step(solver: BuoyancySolver, physics: HullPhysics, sea: HeightSampler): void {
  applyHullLoads(solver, physics);
  solver.step(FIXED_STEP, sea);
}

function run(
  solver: BuoyancySolver,
  physics: HullPhysics,
  sea: HeightSampler,
  steps: number,
): void {
  for (let i = 0; i < steps; i += 1) step(solver, physics, sea);
}

/** Angle between the hull's masthead and true vertical, radians. */
function heelFromUpright(solver: BuoyancySolver): number {
  const up = new Vector3(0, 1, 0).applyQuaternion(solver.orientation);
  return Math.acos(Math.min(1, Math.max(-1, up.y)));
}

describe('workboat hull form', () => {
  it('derives its mass from its own probe set, so the design draught is an identity', () => {
    const probes = hullProbes(WORKBOAT_FORM);
    const physics = createWorkboatPhysics();
    expect(physics.config.mass).toBeCloseTo(displacementMass(probes), 6);
    // Sanity: a 7.2 m open workboat, not a dinghy and not a trawler.
    expect(physics.config.mass).toBeGreaterThan(2000);
    expect(physics.config.mass).toBeLessThan(12000);
  });

  it('places the centre of gravity abaft midships, where the engine is', () => {
    const physics = createWorkboatPhysics();
    // The hull carries its beam aft; weight has to follow it or the boat trims by the head.
    expect(physics.centreOfGravity.z).toBeGreaterThan(0.3);
    expect(physics.centreOfGravity.z).toBeLessThan(WORKBOAT_FORM.length / 4);
    expect(physics.centreOfGravity.y).toBeLessThan(0);
  });
});

describe('equilibrium on flat water', () => {
  it('settles to one draught and then stays at it', () => {
    const physics = createWorkboatPhysics();
    const solver = newSolver(physics);
    // Released 35 cm above her marks, well clear of equilibrium.
    solver.position.set(0, 0.35, 0);

    run(solver, physics, STILL, 6000);
    const settled = solver.position.y;

    // Settled means settled: another fifty seconds must not move her a millimetre.
    run(solver, physics, STILL, 6000);
    expect(solver.position.y).toBeCloseTo(settled, 3);
    expect(Math.abs(solver.velocity.y)).toBeLessThan(1e-3);
    expect(Math.abs(solver.angularVelocity.length())).toBeLessThan(1e-3);

    // And that draught is the design draught: the hull origin is the design waterline, so the
    // equilibrium the solver finds should be the one `WORKBOAT_FORM` declares.
    expect(Math.abs(settled)).toBeLessThan(0.05);
    // Level, not down by the head — this is what the weight couple in `applyHullLoads` buys.
    expect(heelFromUpright(solver)).toBeLessThan(0.035);
  });

  it('displaces its own weight of water to within 1%', () => {
    const physics = createWorkboatPhysics();
    const solver = newSolver(physics);
    run(solver, physics, STILL, 12000);

    const buoyancy = solver.submergedVolume * SEA_WATER_DENSITY * GRAVITY;
    const weight = physics.config.mass * GRAVITY;
    expect(Math.abs(buoyancy - weight) / weight).toBeLessThan(0.01);
  });

  it('recovers from being dropped clear of the water without diverging', () => {
    const physics = createWorkboatPhysics();
    const solver = newSolver(physics);
    // Keel a metre in the air, falling. The worst impulse the integrator ever sees.
    solver.position.set(0, 1.6, 0);

    run(solver, physics, STILL, 8000);
    expect(Number.isFinite(solver.position.y)).toBe(true);
    expect(Math.abs(solver.position.y)).toBeLessThan(0.05);
    expect(solver.velocity.length()).toBeLessThan(0.01);
  });
});

describe('stability', () => {
  it('returns to level after a released heel', () => {
    const physics = createWorkboatPhysics();
    const solver = newSolver(physics);
    run(solver, physics, STILL, 4000);

    // Heel 25° to starboard and let go. Roll is a rotation about the hull's fore-and-aft axis.
    solver.orientation.setFromAxisAngle(new Vector3(0, 0, 1), (25 * Math.PI) / 180);
    expect(heelFromUpright(solver)).toBeGreaterThan(0.4);

    // She must come back, and come back damped rather than ringing: half a minute is many
    // times the ~3 s roll period this hull's stiffness and inertia imply.
    run(solver, physics, STILL, 4000);
    expect(heelFromUpright(solver)).toBeLessThan(0.03);
    expect(solver.angularVelocity.length()).toBeLessThan(0.02);
  });

  it('rights itself from a heel to port as readily as one to starboard', () => {
    const physics = createWorkboatPhysics();
    const solver = newSolver(physics);
    run(solver, physics, STILL, 4000);

    solver.orientation.setFromAxisAngle(new Vector3(0, 0, 1), (-25 * Math.PI) / 180);
    run(solver, physics, STILL, 4000);
    expect(heelFromUpright(solver)).toBeLessThan(0.03);
  });
});

describe('a rough synthetic sea', () => {
  /**
   * Four incommensurate long-crested components, peak amplitude about 1.6 m — a short, confused
   * force 5–6. Height only, which is all `HeightSampler` promises; the horizontal orbital
   * motion of a real Gerstner wave adds nothing a stability test can check.
   */
  function makeSea(): { sea: HeightSampler; advance(dt: number): void } {
    let time = 0;
    return {
      sea: (x, z) =>
        0.85 * Math.sin(0.11 * x + 0.07 * z - 0.62 * time) +
        0.45 * Math.sin(0.29 * x - 0.19 * z - 1.13 * time + 1.7) +
        0.22 * Math.sin(-0.53 * x + 0.61 * z - 1.94 * time + 4.1) +
        0.1 * Math.sin(1.21 * x + 0.87 * z - 2.9 * time + 2.2),
      advance(dt: number): void {
        time += dt;
      },
    };
  }

  it('does not diverge over 10000 steps', () => {
    const physics = createWorkboatPhysics();
    const solver = newSolver(physics);
    const { sea, advance } = makeSea();

    let lateExcursion = 0;
    let maxSpeed = 0;
    for (let i = 0; i < 10000; i += 1) {
      advance(FIXED_STEP);
      step(solver, physics, sea);

      const speed = solver.velocity.length();
      maxSpeed = Math.max(maxSpeed, speed);
      // Only the second half counts towards the excursion: the first is the transient from
      // being dropped into a sea already in motion, and a settling transient is not divergence.
      if (i > 5000) {
        const surface = sea(solver.position.x, solver.position.z);
        lateExcursion = Math.max(lateExcursion, Math.abs(solver.position.y - surface));
      }
    }

    expect(Number.isFinite(solver.position.x)).toBe(true);
    expect(Number.isFinite(solver.position.y)).toBe(true);
    expect(Number.isFinite(solver.position.z)).toBe(true);
    expect(Number.isFinite(solver.velocity.length())).toBe(true);
    expect(Number.isFinite(solver.angularVelocity.length())).toBe(true);

    // The hull tracks the surface instead of drifting off it, and never reaches the solver's
    // own emergency clamps — if it ever did, those clamps would be hiding a real instability.
    expect(lateExcursion).toBeLessThan(2.5);
    expect(maxSpeed).toBeLessThan(20);
    expect(solver.angularVelocity.length()).toBeLessThan(3);

    // First-order quaternion integration at 120 Hz drifts off the unit sphere unless it is
    // renormalised every step; if that ever regresses the whole boat visibly shears.
    expect(solver.orientation.length()).toBeCloseTo(1, 9);
  });

  it('stays upright in a seaway', () => {
    const physics = createWorkboatPhysics();
    const solver = newSolver(physics);
    const { sea, advance } = makeSea();

    let worstHeel = 0;
    for (let i = 0; i < 10000; i += 1) {
      advance(FIXED_STEP);
      step(solver, physics, sea);
      if (i > 2000) worstHeel = Math.max(worstHeel, heelFromUpright(solver));
    }
    // Rolling is expected; lying down and staying there is not. 40° is a hard limit for a sea
    // this size, and a hull that exceeds it has lost its righting moment somewhere.
    expect(worstHeel).toBeLessThan(0.7);
  });
});
