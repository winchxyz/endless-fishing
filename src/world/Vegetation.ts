import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { PRNG } from '../math/PRNG.js';

/**
 * Trees and grass, lofted rather than downloaded.
 *
 * Geometry is never an asset in this project, so a tree here is what a tree is: a tapered trunk
 * that divides, and divides again, with leaves on the ends of the last division. The recursion is
 * a dozen lines long and everything that makes one species look unlike another — how far a child
 * leaves its parent, how much shorter it is, how much the whole thing has been bent by thirty
 * years of the same wind — is a number in the table below.
 *
 * Two decisions are worth stating because the alternatives are the obvious ones:
 *
 *   * **Children are spaced by the golden angle around the parent.** Real branches are, roughly,
 *     and the reason matters: any rational fraction of a turn stacks branches directly above one
 *     another after a few divisions, and the tree comes out visibly ribbed.
 *   * **Wind phase is baked per *vertex*, not per instance.** A card's phase is constant across
 *     its four corners and different from its neighbour's, so one canopy shimmers rather than
 *     pulsing as a block. The instanced attribute slot is left free deliberately: the travelling
 *     gust in `foliage.vert` keys off the instance origin, so a wood still ripples as a wood.
 *
 * Everything here runs once, at load. Local vectors rather than module scratch, because the
 * builder recurses and shared scratch across a recursion is a bug waiting for a deeper tree.
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const UNIT_Y = new Vector3(0, 1, 0);
const UNIT_X = new Vector3(1, 0, 0);

export interface SpeciesProfile {
  /** Trunk length, metres. */
  readonly height: number;
  /** Butt radius, metres. */
  readonly radius: number;
  /** Divisions below the trunk. Two is thirteen branches; three is forty and costs four times. */
  readonly divisions: number;
  readonly children: number;
  /** Angle a child leaves its parent by, radians. */
  readonly spread: number;
  /** Child length as a fraction of its parent's. */
  readonly taper: number;
  /** Sideways drift of a branch over one segment, as a fraction of that segment. */
  readonly sweep: number;
  readonly cardsPerTip: number;
  readonly cardSize: number;
  readonly trunkSides: number;
}

/**
 * The two things that grow on a northern skerry.
 *
 * A Scots pine that has been leaned on by the same westerly since before anyone alive, and the
 * low tangled birch-and-willow scrub that fills in below it. Nothing tropical, nothing with a
 * straight leader, and nothing that would look out of place in a photograph of Harris.
 */
export const SPECIES: readonly SpeciesProfile[] = [
  {
    height: 7.4,
    radius: 0.19,
    divisions: 2,
    children: 3,
    spread: 0.7,
    taper: 0.62,
    sweep: 0.16,
    cardsPerTip: 3,
    cardSize: 0.8,
    trunkSides: 6,
  },
  {
    height: 3.1,
    radius: 0.12,
    divisions: 2,
    children: 3,
    spread: 1.0,
    taper: 0.68,
    sweep: 0.3,
    cardsPerTip: 4,
    cardSize: 0.58,
    trunkSides: 5,
  },
];

export interface TreeGeometry {
  /** Bark. Drawn with the prop program, instanced per tree. */
  readonly trunk: BufferGeometry;
  /** Leaf cards. Drawn with the foliage program, instanced per tree. */
  readonly canopy: BufferGeometry;
}

/**
 * Weathered bark, as a multiplier on the scanned Bark014 albedo.
 *
 * The tint is per *vertex* rather than per instance for a structural reason: `prop.vert` takes
 * `aTint` as an attribute and an `InstancedMesh` shares its geometry with every other chunk, so a
 * per-instance tint would need a geometry clone per chunk. Grading it up the trunk instead costs
 * nothing, and salt-bleached tips over a dark wet butt is what the reference photographs show
 * anyway.
 */
const BARK_BASE = 0.66;
const BARK_BLEACH = 0.42;

interface Builder {
  readonly position: number[];
  readonly normal: number[];
  readonly uv: number[];
  readonly index: number[];
  readonly phase: number[];
  readonly stiffness: number[];
  readonly tint: number[];
}

function createBuilder(): Builder {
  return { position: [], normal: [], uv: [], index: [], phase: [], stiffness: [], tint: [] };
}

function toGeometry(builder: Builder, foliage: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(builder.position), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(builder.normal), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(builder.uv), 2));
  if (foliage) {
    geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(builder.phase), 1));
    geometry.setAttribute('aStiffness', new BufferAttribute(new Float32Array(builder.stiffness), 1));
  } else {
    geometry.setAttribute('aTint', new BufferAttribute(new Float32Array(builder.tint), 3));
  }
  geometry.setIndex(builder.index);
  geometry.computeBoundingSphere();
  return geometry;
}

/** A right-handed pair spanning the plane perpendicular to `direction`: outA × outB = direction. */
function perpendicular(direction: Vector3, outA: Vector3, outB: Vector3): void {
  const reference = Math.abs(direction.y) > 0.95 ? UNIT_X : UNIT_Y;
  outA.copy(reference).cross(direction).normalize();
  outB.copy(direction).cross(outA).normalize();
}

/**
 * One tapered tube segment.
 *
 * The ring is emitted twice rather than shared with the previous segment, which costs vertices
 * and buys the only thing that matters here: a branch that changes direction gets a crease at the
 * joint instead of a smeared normal, and bark is not a smooth surface. `v` is in metres so the
 * bark map runs up the trunk at a fixed scale whatever the branch length is.
 */
function addFrustum(
  builder: Builder,
  base: Vector3,
  top: Vector3,
  baseRadius: number,
  topRadius: number,
  sides: number,
  v0: number,
  v1: number,
  exposure: number,
): void {
  const axis = new Vector3().copy(top).sub(base).normalize();
  const u = new Vector3();
  const w = new Vector3();
  perpendicular(axis, u, w);

  const start = builder.position.length / 3;
  for (let ring = 0; ring < 2; ring += 1) {
    const centre = ring === 0 ? base : top;
    const radius = ring === 0 ? baseRadius : topRadius;
    const v = ring === 0 ? v0 : v1;
    const shade = BARK_BASE + BARK_BLEACH * exposure;
    for (let i = 0; i <= sides; i += 1) {
      const angle = (i / sides) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const nx = u.x * c + w.x * s;
      const ny = u.y * c + w.y * s;
      const nz = u.z * c + w.z * s;
      builder.position.push(centre.x + nx * radius, centre.y + ny * radius, centre.z + nz * radius);
      builder.normal.push(nx, ny, nz);
      builder.uv.push(i / sides, v);
      // Slightly cooler as it bleaches: salt spray greys timber, it does not yellow it.
      builder.tint.push(shade, shade * 0.99, shade * 0.94);
    }
  }

  const stride = sides + 1;
  for (let i = 0; i < sides; i += 1) {
    const a = start + i;
    const b = a + 1;
    const c = a + stride;
    const d = c + 1;
    builder.index.push(a, b, c, b, d, c);
  }
}

/**
 * One leaf card: a quad standing off the end of a twig.
 *
 * `uv.y` runs 0 at the attachment to 1 at the free edge, which is the convention `foliage.vert`
 * bends on — the deflection goes as uv.y², so a card hinged at the wrong end swings from its tip
 * and reads as a flag rather than as foliage.
 */
function addLeafCard(
  builder: Builder,
  anchor: Vector3,
  direction: Vector3,
  size: number,
  roll: number,
  phase: number,
  stiffness: number,
): void {
  const right = new Vector3();
  const up = new Vector3();
  perpendicular(direction, right, up);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const across = new Vector3()
    .copy(right)
    .multiplyScalar(c)
    .addScaledVector(up, s);
  const normal = new Vector3().copy(up).multiplyScalar(c).addScaledVector(right, -s).normalize();

  const half = size * 0.5;
  const start = builder.position.length / 3;
  for (let corner = 0; corner < 4; corner += 1) {
    const along = corner < 2 ? 0 : 1;
    const side = corner === 0 || corner === 3 ? -1 : 1;
    builder.position.push(
      anchor.x + direction.x * size * along + across.x * half * side,
      anchor.y + direction.y * size * along + across.y * half * side,
      anchor.z + direction.z * size * along + across.z * half * side,
    );
    builder.normal.push(normal.x, normal.y, normal.z);
    builder.uv.push(side * 0.5 + 0.5, along);
    builder.phase.push(phase);
    builder.stiffness.push(stiffness);
  }
  builder.index.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

/** One branch, and everything that grows out of it. */
function growBranch(
  trunk: Builder,
  canopy: Builder,
  rng: PRNG,
  profile: SpeciesProfile,
  origin: Vector3,
  direction: Vector3,
  length: number,
  radius: number,
  remaining: number,
  vStart: number,
): void {
  const sides = remaining === profile.divisions ? profile.trunkSides : 4;
  const segments = 3;
  const step = length / segments;

  // The branch is walked segment by segment, drifting sideways a little each time. A straight
  // tube reads as scaffolding; the drift is what makes a trunk look grown rather than extruded.
  const drift = new Vector3();
  const spare = new Vector3();
  perpendicular(direction, drift, spare);
  drift.multiplyScalar(profile.sweep * step * rng.range(-1, 1));

  const base = origin.clone();
  const head = new Vector3();
  const walk = direction.clone();
  let v = vStart;

  // How exposed this branch is: the butt of the trunk is sheltered and dark, the outer twigs
  // have taken the weather for decades.
  const exposure = 1 - remaining / (profile.divisions + 1);

  for (let segment = 0; segment < segments; segment += 1) {
    const r0 = radius * (1 - 0.78 * (segment / segments));
    const r1 = radius * (1 - 0.78 * ((segment + 1) / segments));
    head.copy(base).addScaledVector(walk, step).add(drift);
    addFrustum(
      trunk,
      base,
      head,
      Math.max(r0, 0.008),
      Math.max(r1, 0.006),
      sides,
      v,
      v + step,
      exposure,
    );
    v += step;
    base.copy(head);
    walk.add(drift).normalize();
  }

  if (remaining <= 0) {
    for (let card = 0; card < profile.cardsPerTip; card += 1) {
      addLeafCard(
        canopy,
        base,
        walk,
        profile.cardSize * rng.range(0.75, 1.25),
        card * GOLDEN_ANGLE + rng.range(-0.3, 0.3),
        rng.range(0, Math.PI * 2),
        rng.range(0.22, 0.45),
      );
    }
    return;
  }

  const around0 = new Vector3();
  const around1 = new Vector3();
  perpendicular(walk, around0, around1);
  for (let child = 0; child < profile.children; child += 1) {
    const roll = child * GOLDEN_ANGLE + rng.range(-0.2, 0.2);
    const lean = profile.spread * rng.range(0.75, 1.25);
    const childDirection = new Vector3()
      .copy(walk)
      .multiplyScalar(Math.cos(lean))
      .addScaledVector(around0, Math.sin(lean) * Math.cos(roll))
      .addScaledVector(around1, Math.sin(lean) * Math.sin(roll))
      .normalize();
    growBranch(
      trunk,
      canopy,
      rng,
      profile,
      base,
      childDirection,
      length * profile.taper * rng.range(0.85, 1.15),
      radius * 0.55,
      remaining - 1,
      v,
    );
  }
}

/**
 * Build one species.
 *
 * The whole tree is authored around the origin with +Y up, so an instance matrix is a yaw, a
 * uniform scale and a translation — which is exactly what an `InstancedMesh` can carry.
 */
export function buildTree(species: number, seed: number): TreeGeometry {
  const profile = SPECIES[species] ?? SPECIES[0];
  if (profile === undefined) throw new Error('Vegetation: no species profiles are defined');

  const rng = new PRNG(seed);
  const trunk = createBuilder();
  const canopy = createBuilder();

  // A permanent lean into the prevailing wind. Baked rather than animated because it is thirty
  // years of growth and not a gust, and a tree that stands up again when the wind drops is the
  // single most common way procedural woodland gives itself away.
  const lean = rng.range(0.06, 0.2);
  const bearing = rng.range(0, Math.PI * 2);
  const start = new Vector3(
    Math.sin(bearing) * Math.sin(lean),
    Math.cos(lean),
    Math.cos(bearing) * Math.sin(lean),
  ).normalize();

  growBranch(
    trunk,
    canopy,
    rng,
    profile,
    new Vector3(0, 0, 0),
    start,
    profile.height,
    profile.radius,
    profile.divisions,
    0,
  );

  return { trunk: toGeometry(trunk, false), canopy: toGeometry(canopy, true) };
}

/**
 * A tuft of coarse maritime grass.
 *
 * Blades rather than a textured card, because marram against a bright sea is all silhouette and
 * an alpha-tested card is exactly where mip bleeding turns a sward into grey felt. Each blade is
 * a three-segment tapered strip that curls over, which is what a blade heavy enough to bend under
 * its own weight does — and it also gives the shading normal something to work with.
 */
export function buildGrassTuft(seed: number, blades = 5): BufferGeometry {
  const rng = new PRNG(seed);
  const builder = createBuilder();
  const segments = 3;

  for (let blade = 0; blade < blades; blade += 1) {
    const bearing = blade * GOLDEN_ANGLE + rng.range(-0.4, 0.4);
    const height = rng.range(0.26, 0.52);
    const width = rng.range(0.014, 0.026);
    const curl = rng.range(0.18, 0.5);
    const outX = Math.cos(bearing);
    const outZ = Math.sin(bearing);
    const rootReach = rng.range(0, 0.09);
    const phase = rng.range(0, Math.PI * 2);
    const stiffness = rng.range(0.8, 1.25);

    const start = builder.position.length / 3;
    for (let i = 0; i <= segments; i += 1) {
      const along = i / segments;
      // Height goes as a quarter sine so the blade leaves the ground vertically and lies over
      // at the tip, which is where the weight is.
      const y = height * Math.sin(along * Math.PI * 0.5);
      const reach = rootReach + curl * height * along * along;
      const halfWidth = (width * (1 - along * 0.92)) / 2;
      for (let side = 0; side < 2; side += 1) {
        const edge = side === 0 ? -1 : 1;
        builder.position.push(
          outX * reach - outZ * halfWidth * edge,
          y,
          outZ * reach + outX * halfWidth * edge,
        );
        // The blade shades as part of the sward, not as a ribbon: an upward normal is what the
        // foliage program blends from, and a true surface normal on something this narrow puts a
        // hard terminator across every blade the moment the sun is low.
        builder.normal.push(outX * 0.35, 0.94, outZ * 0.35);
        builder.uv.push(side, along);
        builder.phase.push(phase);
        builder.stiffness.push(stiffness);
      }
    }

    for (let i = 0; i < segments; i += 1) {
      const a = start + i * 2;
      builder.index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  return toGeometry(builder, true);
}
