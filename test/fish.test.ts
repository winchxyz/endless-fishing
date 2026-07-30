import { describe, expect, it, vi } from 'vitest';

/**
 * The fish and seabed subsystem, tested where it is pure.
 *
 * Four properties, and each one is a bug that has actually shipped in a game somewhere:
 *
 *   1. **A shoal stays a shoal.** Boids with the weights slightly wrong either collapse into a
 *      single point or blow apart over a minute or two of play, and neither is visible in the
 *      ten seconds anyone spends looking at it in a debug scene. Five thousand steps is eighty
 *      seconds of wall clock at sixty frames a second.
 *   2. **The same seed gives the same shoal.** Everything in this world is reproducible from
 *      three integers, and a shoal that quietly reaches for `Math.random` breaks the ability to
 *      reproduce any bug that involves it.
 *   3. **The seabed has no seams.** Chunk boundaries are where every streamed heightfield
 *      cracks, and the crack is only visible from one particular angle in one particular chunk.
 *      Sampling the shared column from both sides and demanding *exact* equality catches it
 *      before anyone has to go looking.
 *   4. **A fish is the shape the species table says it is.** `bodyDepth` and `bodyWidth` are
 *      documented as fractions of total length, and the loft has to honour that literally or the
 *      table stops being the single description of a fish.
 *
 * `Fish.ts` and `Seabed.ts` import their GLSL, and vitest has no shader plugin — the node
 * environment cannot transform a `.vert`. The four stubs below stand in for them; nothing under
 * test reads a shader string, so an empty one is a faithful substitute.
 */
vi.mock('../src/shaders/fish/fish.vert', () => ({ default: '' }));
vi.mock('../src/shaders/fish/fish.frag', () => ({ default: '' }));
vi.mock('../src/shaders/underwater/seabed.vert', () => ({ default: '' }));
vi.mock('../src/shaders/underwater/seabed.frag', () => ({ default: '' }));

import { Vector3 } from 'three';
import { School, shoalFraction, tuningForSpecies } from '../src/entities/Fish.js';
import type { SchoolEnvironment } from '../src/entities/Fish.js';
import { buildFishGeometry, measureFishGeometry } from '../src/entities/FishGeometry.js';
import {
  SEABED_CHUNK_SIZE,
  SEABED_RESOLUTION,
  SeabedField,
  seabedVertexCoordinate,
} from '../src/world/Seabed.js';
import { PRNG } from '../src/math/PRNG.js';
import { SPECIES, speciesById, type Species } from '../src/gameplay/Species.js';

/** Open water, no bait, no boat: the shoal is on its own and only the flocking is under test. */
function quietWater(): SchoolEnvironment {
  return {
    baitX: 0,
    baitY: 0,
    baitZ: 0,
    baitPull: 0,
    hullX: 0,
    hullY: 0,
    hullZ: 0,
    hullRadius: 0,
    surfaceY: 0,
    floorY: -60,
  };
}

function requireSpecies(id: string): Species {
  const species = speciesById(id);
  if (species === undefined) throw new Error(`the species table has lost its ${id}`);
  return species;
}

describe('School flocking', () => {
  it('stays cohesive and finite over five thousand steps', () => {
    const species = requireSpecies('mackerel');
    const school = new School(96);
    school.spawn(species, 64, 0, -12, 0, new PRNG(11));

    const environment = quietWater();
    const tuning = tuningForSpecies(species, (species.minLengthM + species.maxLengthM) * 0.5);

    let worstNeighbour = 0;
    let worstSpread = 0;
    for (let step = 0; step < 5000; step += 1) {
      school.step(1 / 60, environment);
      worstNeighbour = Math.max(worstNeighbour, school.nearestNeighbourMean);
      worstSpread = Math.max(worstSpread, school.spread);
    }

    // Nobody ends up on top of anybody, and nobody ends up on their own. The bounds are in body
    // lengths via the tuning, so they mean the same thing for a herring and for a ling.
    expect(school.nearestNeighbourMean).toBeGreaterThan(tuning.separationRadius * 0.2);
    expect(worstNeighbour).toBeLessThan(tuning.neighbourRadius);
    // The shoal never grows past the tether it is held on.
    expect(worstSpread).toBeLessThan(tuning.homeRadius * 2.2);

    for (let i = 0; i < school.count * 3; i += 1) {
      expect(Number.isFinite(school.positions[i])).toBe(true);
      expect(Number.isFinite(school.velocities[i])).toBe(true);
    }
    // Nothing has escaped: every fish is still inside the home radius plus a wanderer's margin.
    for (let i = 0; i < school.count; i += 1) {
      const away = Math.hypot(school.positions[i * 3] ?? 0, school.positions[i * 3 + 2] ?? 0);
      expect(away).toBeLessThan(tuning.homeRadius * 2.5);
    }
  });

  it('never exceeds its own speed limit', () => {
    const species = requireSpecies('mackerel');
    const tuning = tuningForSpecies(species, (species.minLengthM + species.maxLengthM) * 0.5);
    const school = new School(96);
    school.spawn(species, 48, 0, -10, 0, new PRNG(7));

    // A boat sitting right on top of them and a bait in the water: the two strongest forces in
    // the model, applied together, are where an unclamped integrator would run away.
    const environment = quietWater();
    environment.hullRadius = 12;
    environment.baitPull = 1;
    environment.baitY = -6;

    for (let step = 0; step < 2000; step += 1) {
      school.step(1 / 60, environment);
      for (let i = 0; i < school.count; i += 1) {
        const speed = Math.hypot(
          school.velocities[i * 3] ?? 0,
          school.velocities[i * 3 + 1] ?? 0,
          school.velocities[i * 3 + 2] ?? 0,
        );
        expect(speed).toBeLessThanOrEqual(tuning.maxSpeed + 1e-6);
      }
    }
  });

  it('is reproducible from a seed', () => {
    const species = requireSpecies('mackerel');
    const environment = quietWater();

    const run = (): Float32Array => {
      const school = new School(96);
      school.spawn(species, 40, 5, -18, -3, new PRNG(0xfeed));
      for (let step = 0; step < 600; step += 1) school.step(1 / 60, environment);
      return Float32Array.from(school.positions.subarray(0, school.count * 3));
    };

    const first = run();
    const second = run();
    expect(second).toEqual(first);

    // ...and a different seed is a different shoal, so the determinism above is not the result
    // of the seed being ignored.
    const other = new School(96);
    other.spawn(species, 40, 5, -18, -3, new PRNG(0xfee0));
    for (let step = 0; step < 600; step += 1) other.step(1 / 60, environment);
    expect(Float32Array.from(other.positions.subarray(0, 120))).not.toEqual(first);
  });

  it('shoals small fish tightly and leaves the big ones alone', () => {
    const herring = requireSpecies('herring');
    const halibut = requireSpecies('halibut');
    expect(shoalFraction(herring)).toBeGreaterThan(0.7);
    expect(shoalFraction(halibut)).toBeLessThan(0.15);
    // Every species has to produce usable tuning; a NaN in here would only surface as a shoal
    // that silently refuses to render.
    for (const species of SPECIES) {
      const tuning = tuningForSpecies(species, species.maxLengthM);
      expect(tuning.cruiseSpeed).toBeGreaterThan(0);
      expect(tuning.maxSpeed).toBeGreaterThan(tuning.cruiseSpeed);
      expect(Number.isFinite(tuning.separationRadius)).toBe(true);
    }
  });
});

describe('Seabed heightfield', () => {
  it('agrees exactly across a shared chunk edge', () => {
    const field = new SeabedField(0x5eed_f15e);
    const stride = SEABED_RESOLUTION + 1;
    const left = new Float32Array(stride * stride);
    const right = new Float32Array(stride * stride);
    const below = new Float32Array(stride * stride);

    field.sampleChunk(0, 0, SEABED_RESOLUTION, SEABED_CHUNK_SIZE, left);
    field.sampleChunk(1, 0, SEABED_RESOLUTION, SEABED_CHUNK_SIZE, right);
    field.sampleChunk(0, 1, SEABED_RESOLUTION, SEABED_CHUNK_SIZE, below);

    for (let row = 0; row <= SEABED_RESOLUTION; row += 1) {
      // East edge of (0,0) against the west edge of (1,0). Exact equality, not a tolerance: the
      // two chunks evaluate the same function at the same coordinate, and anything less than
      // exact would mean one of them is not.
      expect(right[row * stride]).toBe(left[row * stride + SEABED_RESOLUTION]);
      // South edge of (0,0) against the north edge of (0,1).
      expect(below[row]).toBe(left[SEABED_RESOLUTION * stride + row]);
    }
  });

  it('puts the shared column at the same world coordinate from both sides', () => {
    for (const chunk of [-3, 0, 7]) {
      const east = seabedVertexCoordinate(chunk, SEABED_RESOLUTION, SEABED_RESOLUTION, SEABED_CHUNK_SIZE);
      const west = seabedVertexCoordinate(chunk + 1, 0, SEABED_RESOLUTION, SEABED_CHUNK_SIZE);
      expect(east).toBe(west);
    }
  });

  it('is deterministic and stays inside a plausible shelf depth', () => {
    const a = new SeabedField(4242);
    const b = new SeabedField(4242);
    const c = new SeabedField(4243);

    let differs = false;
    for (let i = 0; i < 400; i += 1) {
      const x = (i % 20) * 137.3 - 1300;
      const z = Math.floor(i / 20) * 91.7 - 900;
      expect(a.heightAt(x, z)).toBe(b.heightAt(x, z));
      if (a.heightAt(x, z) !== c.heightAt(x, z)) differs = true;

      const depth = -a.heightAt(x, z);
      expect(depth).toBeGreaterThan(5);
      expect(depth).toBeLessThan(120);
    }
    expect(differs).toBe(true);
  });

  it('has a continuous normal across a chunk edge', () => {
    const field = new SeabedField(99);
    const east = new Vector3();
    const west = new Vector3();

    // The shading normal comes from the field rather than from the triangles, so the vertex the
    // two chunks share resolves to one vector and not to two that differ by each chunk's own
    // one-sided slope. That difference is exactly what a lit seam is.
    for (let row = 0; row <= SEABED_RESOLUTION; row += 1) {
      const x = seabedVertexCoordinate(0, SEABED_RESOLUTION, SEABED_RESOLUTION, SEABED_CHUNK_SIZE);
      const mirrored = seabedVertexCoordinate(1, 0, SEABED_RESOLUTION, SEABED_CHUNK_SIZE);
      const z = seabedVertexCoordinate(0, row, SEABED_RESOLUTION, SEABED_CHUNK_SIZE);
      field.normalAt(x, z, east);
      field.normalAt(mirrored, z, west);
      expect(west.x).toBe(east.x);
      expect(west.y).toBe(east.y);
      expect(west.z).toBe(east.z);
      expect(field.slopeAt(x, z)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Fish geometry', () => {
  it('matches the proportions in the species table', () => {
    for (const species of SPECIES) {
      const geometry = buildFishGeometry(species);
      const measured = measureFishGeometry(geometry);

      // Every fish is built exactly one unit long, so the instance scale is the specimen's
      // length in metres and the fractions below can be compared to the table directly.
      expect(measured.totalLength).toBeCloseTo(1, 6);
      expect(measured.bodyDepth).toBeCloseTo(species.bodyDepth, 6);
      expect(measured.bodyWidth).toBeCloseTo(species.bodyWidth, 6);

      // A tail wide enough to see, and a fish made of triangles rather than of nothing.
      expect(measured.tailSpan).toBeGreaterThan(0.05);
      expect(measured.triangleCount).toBeGreaterThan(200);

      const spine = geometry.getAttribute('aSpine');
      let minSpine = Infinity;
      let maxSpine = -Infinity;
      for (let i = 0; i < spine.count; i += 1) {
        minSpine = Math.min(minSpine, spine.getX(i));
        maxSpine = Math.max(maxSpine, spine.getX(i));
      }
      // The bend parameter has to span the whole animal, or the vertex shader has nothing to
      // grow its envelope across.
      expect(minSpine).toBe(0);
      expect(maxSpine).toBeCloseTo(1, 6);

      geometry.dispose();
    }
  });

  it('makes flatfish flat and eels round', () => {
    const plaice = requireSpecies('plaice');
    const conger = requireSpecies('conger');

    const flat = measureFishGeometry(buildFishGeometry(plaice));
    const round = measureFishGeometry(buildFishGeometry(conger));

    // A plaice is a plate: many times deeper than it is thick. A conger is very nearly circular
    // in section. Both fall out of the table without the loft knowing which is which.
    expect(flat.bodyDepth / flat.bodyWidth).toBeGreaterThan(6);
    expect(round.bodyDepth / round.bodyWidth).toBeLessThan(1.5);
  });

  it('gives forked and rounded tails different silhouettes', () => {
    const forked = SPECIES.filter((species) => species.forkedTail);
    const rounded = SPECIES.filter((species) => !species.forkedTail);
    expect(forked.length).toBeGreaterThan(0);
    expect(rounded.length).toBeGreaterThan(0);

    for (const species of forked) {
      const geometry = buildFishGeometry(species);
      const position = geometry.getAttribute('position');
      const spine = geometry.getAttribute('aSpine');
      // On a forked tail the aftmost point is a lobe tip, off the centreline. On a rounded one
      // it is the middle of the trailing edge. Checking the y of the deepest z tells them apart.
      let aftmostZ = Infinity;
      let aftmostY = 0;
      for (let i = 0; i < position.count; i += 1) {
        if (spine.getX(i) <= 0.9) continue;
        if (position.getZ(i) < aftmostZ) {
          aftmostZ = position.getZ(i);
          aftmostY = position.getY(i);
        }
      }
      expect(Math.abs(aftmostY)).toBeGreaterThan(0.02);
      geometry.dispose();
    }
  });
});
