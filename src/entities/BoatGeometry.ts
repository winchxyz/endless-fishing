import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Curve,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORKBOAT_FORM } from './Buoyancy.js';
import { clamp, smoothstep } from '../math/Noise.js';
import type { MaterialOptions } from '../render/Materials.js';

/**
 * The boat, built out of nothing but arithmetic.
 *
 * Geometry is never downloaded in this project, so every plank, rail and cleat below is lofted
 * from the *same* `WORKBOAT_FORM` the buoyancy solver places its probes on. That is the whole
 * point of the file: there is one hull, and the thing you see is the thing that floats. A
 * separately modelled hull is how a boat ends up visibly riding half a metre above its own
 * waterline while the physics insists it is correct.
 *
 * Two details are worth knowing before reading the loft:
 *
 *   1. **The stem and transom rake is a shear along z, not a re-shaping.** Frames keep their
 *      station spacing and their section area; only the plating is swept forward at the deck
 *      edge and aft at the keel. A shear preserves volume, so the raked hull displaces exactly
 *      what `hullProbes` assumes it does, and the probes stay honest.
 *   2. **The chine is a hard edge because the panels are separate lofts.** Bottom and topside
 *      share the chine *position* and not the chine *vertices*, so `computeVertexNormals` has
 *      nothing to average across and the knuckle stays crisp. A single smooth loft turns a
 *      working hull into a bar of soap.
 *
 * Everything that shares a material is merged into one buffer, so the whole boat is about
 * eighteen draw calls rather than forty.
 */

const FORM = WORKBOAT_FORM;
const HALF_LENGTH = FORM.length / 2;

/** Lengthwise loft resolution. 32 frames resolve the sheer sweep without visible faceting. */
const HULL_STATIONS = 32;
/** Columns of a hull section, keel (0) outboard and up to the sheer (4). */
const SECTION_COLUMNS = 5;
/** Chine height as a fraction of the keel-to-sheer depth, and its width as a fraction of beam. */
const CHINE_HEIGHT = 0.42;
const CHINE_WIDTH = 0.94;
/** How far the deck edge overhangs the keel forward, and the keel overhangs the deck aft. */
const STEM_RAKE = 0.3;
const TRANSOM_RAKE = 0.22;
/** Deck sole below the sheer, and its crown at the centreline — water has to run off. */
const DECK_DROP = 0.17;
const DECK_CAMBER = 0.05;

/** Panels of the hull loft, by section column. The shared column 2 is the chine. */
const HULL_PANELS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [2, 3, 4],
];

/** Nominal length of the rod seated in the holder, metres. The rod itself is `FishingRod`'s. */
const ROD_LENGTH = 3.2;

const scratchSection = new Vector2();
const ZERO2 = new Vector2();
const ORIGIN = new Vector3();

/**
 * A hull section point, in the frame plane: x outboard, y above the design waterline.
 *
 * Five columns rather than a fitted spline because a hard-chine workboat *is* five straight
 * runs — a flat garboard, a bottom panel, the chine knuckle, a flared topside and the sheer.
 * Fitting a curve through them and re-sampling would only round off the one edge that matters.
 */
function sectionPoint(t: number, column: number, out: Vector2): Vector2 {
  const halfBeam = (FORM.beam / 2) * FORM.halfBeamAt(t);
  const keel = FORM.keelAt(t);
  const sheer = FORM.sheerAt(t);
  const chineY = keel + CHINE_HEIGHT * (sheer - keel);
  const chineX = halfBeam * CHINE_WIDTH;
  switch (column) {
    case 0:
      return out.set(0, keel);
    case 1:
      return out.set(chineX * 0.55, keel + 0.12 * (chineY - keel));
    case 2:
      return out.set(chineX, chineY);
    case 3:
      return out.set(halfBeam * 0.99, chineY + 0.5 * (sheer - chineY));
    default:
      return out.set(halfBeam, sheer);
  }
}

/** Girth from the keel to `column`, metres. Used directly as u, so the planking runs true. */
function sectionGirth(t: number, column: number): number {
  let girth = 0;
  let previousX = 0;
  let previousY = FORM.keelAt(t);
  for (let c = 1; c <= column; c += 1) {
    sectionPoint(t, c, scratchSection);
    girth += Math.hypot(scratchSection.x - previousX, scratchSection.y - previousY);
    previousX = scratchSection.x;
    previousY = scratchSection.y;
  }
  return girth;
}

/** Half-beam of the section at an arbitrary height, by walking the columns. For the boot top. */
function sectionHalfBeamAt(t: number, y: number): number {
  let previousX = 0;
  let previousY = FORM.keelAt(t);
  for (let c = 1; c < SECTION_COLUMNS; c += 1) {
    sectionPoint(t, c, scratchSection);
    if (y <= scratchSection.y) {
      const span = scratchSection.y - previousY;
      const f = span <= 1e-6 ? 0 : clamp((y - previousY) / span, 0, 1);
      return previousX + (scratchSection.x - previousX) * f;
    }
    previousX = scratchSection.x;
    previousY = scratchSection.y;
  }
  return previousX;
}

/**
 * Longitudinal position of a plating point.
 *
 * The rake is measured *down from the sheer*, so the deck edge always lands on the station
 * spacing and the length overall stays exactly `FORM.length`. Raking the stem the other way —
 * pushing the head forward — is the usual mistake and quietly makes the boat a metre longer
 * than the hull form says it is.
 */
function stationZ(t: number, y: number): number {
  const belowSheer = FORM.sheerAt(t) - y;
  const stem = 1 - smoothstep(0, 0.24, t);
  const transom = smoothstep(0.86, 1, t);
  return (
    -HALF_LENGTH +
    t * FORM.length +
    STEM_RAKE * stem * belowSheer -
    TRANSOM_RAKE * transom * belowSheer
  );
}

function deckHeightAt(t: number): number {
  return FORM.sheerAt(t) - DECK_DROP;
}

// --- geometry plumbing -------------------------------------------------------------------

/**
 * Finish a part: normals if it has none, and the second UV set `aoMap` reads.
 *
 * `Materials.ts` binds one packed ORM texture to `aoMap`, `roughnessMap` and `metalnessMap`,
 * and three samples `aoMap` through uv1 while the other two use uv. A genuine copy rather than
 * an alias, so a later lightmap pass can re-lay uv1 without silently moving the albedo with it.
 */
function finish(geometry: BufferGeometry): BufferGeometry {
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  if (geometry.hasAttribute('uv') && !geometry.hasAttribute('uv1')) {
    const uv = geometry.getAttribute('uv');
    geometry.setAttribute('uv1', new BufferAttribute(new Float32Array(uv.array), 2));
  }
  return geometry;
}

function assemble(positions: number[], uvs: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Rescale a generated UV set into metres, so one `repeat` setting means the same everywhere. */
function scaleUv(geometry: BufferGeometry, u: number, v: number): BufferGeometry {
  if (!geometry.hasAttribute('uv')) return geometry;
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  uv.needsUpdate = true;
  return geometry;
}

/**
 * A box whose UVs are in metres.
 *
 * One scale cannot be right for all six faces of a box — three pairs carry three different
 * pairs of dimensions — so this takes the two largest and accepts a few per cent of stretch on
 * the ends, which on a cabin the size of a wardrobe nobody will ever resolve.
 */
function meterBox(width: number, height: number, depth: number): BufferGeometry {
  return scaleUv(new BoxGeometry(width, height, depth), Math.max(width, depth), height);
}

/**
 * Sweep a closed profile along a path, with a world-up reference frame.
 *
 * Frenet frames would twist a rail that passes through an inflection; every path here is a
 * rail, a strake or a stanchion top, all of which want to stay level with the deck. The seam
 * vertex is duplicated so the texture does not reverse across the last quad.
 */
function sweep(path: readonly Vector3[], profile: readonly Vector2[]): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const ring = profile.length + 1;

  const girths: number[] = [0];
  for (let j = 1; j < ring; j += 1) {
    const a = profile[j - 1] ?? ZERO2;
    const b = profile[j % profile.length] ?? ZERO2;
    girths.push((girths[j - 1] ?? 0) + a.distanceTo(b));
  }

  const tangent = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const worldUp = new Vector3(0, 1, 0);
  let travelled = 0;

  for (let i = 0; i < path.length; i += 1) {
    const here = path[i] ?? ORIGIN;
    const before = path[Math.max(0, i - 1)] ?? ORIGIN;
    const after = path[Math.min(path.length - 1, i + 1)] ?? ORIGIN;

    tangent.copy(after).sub(before);
    if (tangent.lengthSq() < 1e-12) tangent.set(0, 0, 1);
    tangent.normalize();
    right.copy(worldUp).cross(tangent);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    up.copy(tangent).cross(right);
    if (i > 0) travelled += here.distanceTo(before);

    for (let j = 0; j < ring; j += 1) {
      const p = profile[j % profile.length] ?? ZERO2;
      positions.push(
        here.x + right.x * p.x + up.x * p.y,
        here.y + right.y * p.x + up.y * p.y,
        here.z + right.z * p.x + up.z * p.y,
      );
      uvs.push(girths[j] ?? 0, travelled);
    }
  }

  for (let i = 0; i + 1 < path.length; i += 1) {
    for (let j = 0; j + 1 < ring; j += 1) {
      const a = i * ring + j;
      const b = a + 1;
      const c = a + ring;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return assemble(positions, uvs, indices);
}

function circleProfile(radius: number, segments: number): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return points;
}

function boxProfile(halfWidth: number, halfHeight: number): Vector2[] {
  return [
    new Vector2(halfWidth, -halfHeight),
    new Vector2(halfWidth, halfHeight),
    new Vector2(-halfWidth, halfHeight),
    new Vector2(-halfWidth, -halfHeight),
  ];
}

// --- the catenary ------------------------------------------------------------------------

/**
 * A hanging rope, `y = a·cosh(x/a)`.
 *
 * A parabola is the shape of a *uniformly loaded* cable — a suspension bridge deck — not of a
 * rope hanging under its own weight, and the two differ most exactly where the eye looks: near
 * the ends, where the real curve rises steeply and the parabola lazes. Given the two ends and
 * the length of rope between them, `a` follows from `√(L² − v²) = 2a·sinh(h/2a)`, which has no
 * closed form and is bisected below. The curve is then parameterised by x rather than by arc
 * length; for a tube whose segments are visually indistinguishable that is a fair trade, and
 * it keeps the sampler branch-free.
 */
class Catenary extends Curve<Vector3> {
  private readonly span: number;
  private readonly a: number;
  private readonly x0: number;
  private readonly c: number;

  constructor(span: number, rise: number, length: number) {
    super();
    this.span = span;

    const chord = Math.hypot(span, rise);
    const slackLength = Math.max(length, chord * 1.002);
    const target = Math.sqrt(Math.max(1e-9, slackLength * slackLength - rise * rise));

    // f(a) = 2a·sinh(h/2a) falls monotonically from +∞ to h, so a plain bisection cannot miss.
    let low = 1e-3;
    let high = 1e5;
    for (let i = 0; i < 90; i += 1) {
      const mid = (low + high) * 0.5;
      if (2 * mid * Math.sinh(span / (2 * mid)) > target) low = mid;
      else high = mid;
    }
    this.a = (low + high) * 0.5;
    this.x0 = span / 2 - this.a * Math.atanh(clamp(rise / slackLength, -0.999999, 0.999999));
    this.c = -this.a * Math.cosh(this.x0 / this.a);
  }

  /** Sag at the lowest point, metres. The boat uses it to scale how far wind blows a line out. */
  get sag(): number {
    return Math.abs(this.c + this.a);
  }

  override getPoint(t: number, optionalTarget: Vector3 = new Vector3()): Vector3 {
    const x = t * this.span;
    return optionalTarget.set(x, this.a * Math.cosh((x - this.x0) / this.a) + this.c, 0);
  }
}

/** A slack line, hung between two hull-space points and free to swing about its own chord. */
export interface RopeSway {
  /** The fixed end. Parented to the hull; never moved after the build. */
  readonly root: Object3D;
  /** Rotate this about `axis` to blow the belly of the line downwind. */
  readonly pivot: Object3D;
  /** The chord, in the pivot's own frame. */
  readonly axis: Vector3;
  /** Radians of swing per metre-per-second of crosswind. Slacker lines blow out further. */
  readonly response: number;
  readonly mesh: Mesh;
}

/**
 * Build one hanging line.
 *
 * The rope lives in a frame whose +X runs along the *horizontal* separation of the two ends and
 * whose +Y is up, because a rope sags towards gravity and not perpendicular to its chord. Wind
 * is then applied as a rotation about the chord, which swings the belly sideways while leaving
 * both ends exactly where they were bolted.
 */
function buildRope(
  from: Vector3,
  to: Vector3,
  slack: number,
  radius: number,
  material: MeshStandardMaterial,
): RopeSway {
  const span = Math.hypot(to.x - from.x, to.z - from.z);
  const rise = to.y - from.y;
  const chord = Math.hypot(span, rise);
  const curve = new Catenary(span, rise, chord * (1 + slack));

  const geometry = finish(
    scaleUv(
      new TubeGeometry(curve, 40, radius, 7, false),
      chord * (1 + slack),
      Math.PI * 2 * radius,
    ),
  );

  const root = new Object3D();
  root.position.copy(from);
  // Yaw only, so the rope's local +Y stays vertical and the sag hangs the way gravity does.
  root.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);

  const pivot = new Object3D();
  root.add(pivot);

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  pivot.add(mesh);

  return {
    root,
    pivot,
    axis: new Vector3(span, rise, 0).normalize(),
    // A line with a metre of belly swings much further than a taut one for the same pressure.
    response: clamp(curve.sag * 0.06, 0.004, 0.05),
    mesh,
  };
}

// --- assembled parts ---------------------------------------------------------------------

function buildHullPlating(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const point = new Vector2();

  for (const side of [1, -1]) {
    for (const panel of HULL_PANELS) {
      const columns = panel.length;
      const base = positions.length / 3;

      for (let s = 0; s <= HULL_STATIONS; s += 1) {
        const t = s / HULL_STATIONS;
        for (let c = 0; c < columns; c += 1) {
          const column = panel[c] ?? 0;
          sectionPoint(t, column, point);
          positions.push(side * point.x, point.y, stationZ(t, point.y));
          uvs.push(side * sectionGirth(t, column), t * FORM.length);
        }
      }

      for (let s = 0; s < HULL_STATIONS; s += 1) {
        for (let c = 0; c + 1 < columns; c += 1) {
          const a = base + s * columns + c;
          const b = a + 1;
          const d = a + columns;
          const e = d + 1;
          // The mirrored half is wound the other way round or its normals face into the hull.
          if (side > 0) indices.push(a, b, d, b, e, d);
          else indices.push(a, d, b, b, d, e);
        }
      }
    }
  }
  return assemble(positions, uvs, indices);
}

/** The transom plate: a fan over the aftmost section, raked with it so it is a ruled surface. */
function buildTransom(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const point = new Vector2();

  const keel = FORM.keelAt(1);
  const sheer = FORM.sheerAt(1);
  const centreY = (keel + sheer) * 0.5;
  positions.push(0, centreY, stationZ(1, centreY) + 0.01);
  uvs.push(0, centreY);

  // Wound keel → starboard sheer → port sheer → keel, which is what puts the normal astern.
  const ring: Array<[number, number]> = [];
  for (let c = 0; c < SECTION_COLUMNS; c += 1) {
    sectionPoint(1, c, point);
    ring.push([point.x, point.y]);
  }
  for (let c = SECTION_COLUMNS - 1; c >= 1; c -= 1) {
    const p = ring[c];
    if (p !== undefined) ring.push([-p[0], p[1]]);
  }

  for (const [x, y] of ring) {
    positions.push(x, y, stationZ(1, y) + 0.01);
    uvs.push(x, y);
  }
  for (let i = 1; i < ring.length; i += 1) indices.push(0, i, i + 1);
  // The polygon is open along the top; this closes it back to the keel.
  indices.push(0, ring.length, 1);

  return assemble(positions, uvs, indices);
}

function buildDeck(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stations = 24;
  const across = 10;

  // The sole has to run right into the stem and right up to the transom. Stopping it short
  // leaves a slot you can see straight through, because the plating is single-sided.
  for (let s = 0; s <= stations; s += 1) {
    const t = 0.02 + (s / stations) * 0.978;
    const halfBeam = (FORM.beam / 2) * FORM.halfBeamAt(t) * 0.985;
    const deck = deckHeightAt(t);
    for (let i = 0; i <= across; i += 1) {
      const f = (i / across) * 2 - 1;
      const x = f * halfBeam;
      const y = deck + DECK_CAMBER * (1 - f * f);
      positions.push(x, y, stationZ(t, y));
      uvs.push(x, t * FORM.length);
    }
  }
  for (let s = 0; s < stations; s += 1) {
    for (let i = 0; i < across; i += 1) {
      const a = s * (across + 1) + i;
      indices.push(a, a + across + 1, a + 1, a + 1, a + across + 1, a + across + 2);
    }
  }
  return assemble(positions, uvs, indices);
}

/** The boot top: the painted band that marks the design waterline, proud of the plating. */
function buildWaterlineBand(): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stations = HULL_STATIONS;
  const lower = -0.07;
  const upper = 0.11;

  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let s = 0; s <= stations; s += 1) {
      const t = s / stations;
      for (const y of [lower, upper]) {
        const x = sectionHalfBeamAt(t, y) + 0.012;
        positions.push(side * x, y, stationZ(t, y));
        uvs.push(side * (y - lower), t * FORM.length);
      }
    }
    for (let s = 0; s < stations; s += 1) {
      const a = base + s * 2;
      if (side > 0) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  return assemble(positions, uvs, indices);
}

function sheerPath(from: number, to: number, steps: number, lift: number, side: number): Vector3[] {
  const path: Vector3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = from + ((to - from) * i) / steps;
    const y = FORM.sheerAt(t);
    const halfBeam = (FORM.beam / 2) * FORM.halfBeamAt(t);
    path.push(new Vector3(side * halfBeam, y + lift, stationZ(t, y)));
  }
  return path;
}

function chinePath(from: number, to: number, steps: number, side: number): Vector3[] {
  const path: Vector3[] = [];
  const point = new Vector2();
  for (let i = 0; i <= steps; i += 1) {
    const t = from + ((to - from) * i) / steps;
    sectionPoint(t, 2, point);
    path.push(new Vector3(side * point.x, point.y, stationZ(t, point.y)));
  }
  return path;
}

function keelPath(): Vector3[] {
  const path: Vector3[] = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = 0.04 + (i / 24) * 0.94;
    const y = FORM.keelAt(t);
    path.push(new Vector3(0, y - 0.035, stationZ(t, y)));
  }
  return path;
}

/** The stem post — the vertical leading edge, from the forefoot up to the stem head. */
function stemPath(): Vector3[] {
  const path: Vector3[] = [];
  const keel = FORM.keelAt(0);
  const sheer = FORM.sheerAt(0);
  for (let i = 0; i <= 12; i += 1) {
    const y = keel + ((sheer - keel) * i) / 12;
    path.push(new Vector3(0, y, stationZ(0, y) - 0.03));
  }
  return path;
}

function cleat(x: number, y: number, z: number): BufferGeometry {
  const bar = new CylinderGeometry(0.028, 0.028, 0.26, 10).rotateZ(Math.PI / 2);
  bar.translate(0, 0.11, 0);
  const parts = [bar];
  for (const dx of [-0.07, 0.07]) {
    const post = new CylinderGeometry(0.026, 0.032, 0.12, 8);
    post.translate(dx, 0.05, 0);
    parts.push(post);
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  scaleUv(merged, 0.3, 0.3);
  return merged.translate(x, y, z);
}

// --- the build ---------------------------------------------------------------------------

/** The slice of `MaterialLibrary` the boat needs, structurally, so this file stays testable. */
export interface MaterialSource {
  load(id: string, options?: MaterialOptions): Promise<MeshStandardMaterial>;
}

export interface NavLight {
  readonly mesh: Mesh;
  readonly material: MeshStandardMaterial;
}

/**
 * The lights that come on after sunset.
 *
 * Port red, starboard green and a white stern light are the sectors COLREGs Rule 21 defines;
 * `masthead` is the all-round white a power-driven vessel under 12 m may show in place of the
 * separate masthead and stern pair. `lantern` is not a navigation light at all — it is the
 * deck lamp over the working cockpit, and it is here because it switches on the same way.
 */
export interface NavLightSet {
  readonly port: NavLight;
  readonly starboard: NavLight;
  readonly stern: NavLight;
  readonly masthead: NavLight;
  readonly lantern: NavLight;
}

export interface BoatFlag {
  /** Yaw this to point the fly downwind. */
  readonly pivot: Object3D;
  readonly mesh: Mesh;
  readonly positions: BufferAttribute;
  /** The undeformed cloth, so each frame is displaced from rest instead of from itself. */
  readonly rest: Float32Array;
  readonly width: number;
}

export interface BoatParts {
  readonly group: Group;
  /** Empty at the truck of the mast: masthead light, wind instruments, camera anchor. */
  readonly mastTop: Object3D;
  /** Empty at the mouth of the rod holder, its +Y axis running out along the rod. */
  readonly rodHolder: Object3D;
  readonly navLights: NavLightSet;
  readonly flag: BoatFlag;
  /** The boot top. The wake and spray systems align themselves to it. */
  readonly waterlineBand: Mesh;
  readonly ropes: readonly RopeSway[];
  /** Tip of a seated rod, in hull coordinates. */
  readonly rodTipOffset: Vector3;
  /** Where a person stands on the deck, in hull coordinates. */
  readonly deckOffset: Vector3;
  /**
   * Every material the boat draws with.
   *
   * Exposed because three's `CSM` splits the sun into one directional light per cascade and
   * relies on `setupMaterial` to make a material pick exactly one of them. A material that
   * never goes through it is lit by all of them at once and comes out three times too bright,
   * which on a white hull is impossible to miss.
   */
  readonly materials: readonly MeshStandardMaterial[];
  dispose(): void;
}

/** UV repeats per metre, per material. Wood is milled fine; rope and canvas are coarse. */
const MATERIAL_OPTIONS: Readonly<Record<string, MaterialOptions>> = {
  Planks023A: { repeat: 0.55, color: 0x99a5ab, roughness: 0.95 },
  WoodFloor043: { repeat: 1.1, roughness: 1 },
  Wood066: { repeat: 0.85, color: 0xc7b299 },
  Metal063: { repeat: 1.4, roughness: 1 },
  Metal032: { repeat: 2.2, roughness: 0.9 },
  PaintedMetal006: { repeat: 1.8, color: 0x1b232c },
  Rope001: { repeat: 2.6 },
  Fabric030: { repeat: 1.6 },
};

function navLightMaterial(colour: number, emissive: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: colour,
    emissive,
    // Off until the sun is genuinely down; `Boat` drives this from the ephemeris.
    emissiveIntensity: 0,
    roughness: 0.22,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
  });
}

/**
 * Build the whole boat.
 *
 * Async because the PBR sets are streamed; the geometry itself is synchronous and cheap
 * (about 12 ms) and is generated once at boot, never per frame.
 */
export async function buildBoat(materials: MaterialSource): Promise<BoatParts> {
  const [planks, deckWood, joinery, ironwork, fittings, paint, rope, canvas, ensignCloth] =
    await Promise.all([
      materials.load('Planks023A', MATERIAL_OPTIONS['Planks023A']),
      materials.load('WoodFloor043', MATERIAL_OPTIONS['WoodFloor043']),
      materials.load('Wood066', MATERIAL_OPTIONS['Wood066']),
      materials.load('Metal063', MATERIAL_OPTIONS['Metal063']),
      materials.load('Metal032', MATERIAL_OPTIONS['Metal032']),
      materials.load('PaintedMetal006', MATERIAL_OPTIONS['PaintedMetal006']),
      materials.load('Rope001', MATERIAL_OPTIONS['Rope001']),
      materials.load('Fabric030', MATERIAL_OPTIONS['Fabric030']),
      // A second Fabric030 variant purely to get a material we may set two-sided: the library
      // keys its cache on the options, and a flag lit from one side only reads as cardboard.
      materials.load('Fabric030', { repeat: 2.4 }),
    ]);
  ensignCloth.side = DoubleSide;

  const group = new Group();
  group.name = 'boat';
  const owned: BufferGeometry[] = [];
  const ownedMaterials: MeshStandardMaterial[] = [];

  const bins = new Map<MeshStandardMaterial, BufferGeometry[]>();
  const put = (material: MeshStandardMaterial, geometry: BufferGeometry): void => {
    const list = bins.get(material);
    if (list === undefined) bins.set(material, [finish(geometry)]);
    else list.push(finish(geometry));
  };

  // 1–3. Hull plating, transom plate, stem post.
  put(planks, buildHullPlating());
  put(planks, buildTransom());
  put(ironwork, sweep(stemPath(), circleProfile(0.05, 8)));

  // 4–6. Keel bar, skeg, spray rails on the chine.
  put(ironwork, sweep(keelPath(), boxProfile(0.03, 0.05)));
  const skegY = FORM.keelAt(0.92);
  put(ironwork, new BoxGeometry(0.07, 0.3, 1.2).translate(0, skegY - 0.14, 2.85));
  for (const side of [1, -1]) put(ironwork, sweep(chinePath(0.12, 0.99, 20, side), circleProfile(0.035, 6)));

  // 7–8. Deck sole and the gunwale capping rail.
  put(deckWood, buildDeck());
  for (const side of [1, -1]) {
    put(joinery, sweep(sheerPath(0.03, 0.995, 26, 0.03, side), boxProfile(0.055, 0.032)));
  }

  // 9–11. Cabin, its roof, and the glass.
  const cabinFloor = deckHeightAt(0.62);
  const cabinZ = 0.85;
  put(joinery, meterBox(1.62, 1.2, 1.7).translate(0, cabinFloor + 0.6, cabinZ));
  put(joinery, meterBox(1.82, 0.08, 1.9).translate(0, cabinFloor + 1.24, cabinZ));

  const glassParts = [
    new BoxGeometry(1.24, 0.5, 0.04).translate(0, cabinFloor + 0.82, cabinZ - 0.86),
    new BoxGeometry(0.04, 0.42, 0.8).translate(0.82, cabinFloor + 0.8, cabinZ),
    new BoxGeometry(0.04, 0.42, 0.8).translate(-0.82, cabinFloor + 0.8, cabinZ),
  ];
  const glassGeometry = finish(mergeGeometries(glassParts, false));
  for (const part of glassParts) part.dispose();
  const glassMaterial = new MeshStandardMaterial({
    color: 0x9fb6c4,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
  });
  ownedMaterials.push(glassMaterial);
  owned.push(glassGeometry);
  const glass = new Mesh(glassGeometry, glassMaterial);
  glass.receiveShadow = true;
  group.add(glass);

  // 12–13. Mast and boom.
  const mastZ = -0.6;
  const mastFoot = deckHeightAt((mastZ + HALF_LENGTH) / FORM.length);
  const mastHeight = 3.4;
  put(joinery, new CylinderGeometry(0.055, 0.085, mastHeight, 10).translate(0, mastFoot + mastHeight / 2, mastZ));
  const boomY = mastFoot + 1.55;
  put(joinery, new CylinderGeometry(0.045, 0.05, 2.1, 8).rotateX(Math.PI / 2).translate(0, boomY, mastZ + 1.05));

  const mastTop = new Object3D();
  mastTop.position.set(0, mastFoot + mastHeight, mastZ);
  group.add(mastTop);

  // 14–15. Bow rail and its stanchions.
  for (const side of [1, -1]) {
    put(fittings, sweep(sheerPath(0.09, 0.42, 14, 0.52, side), circleProfile(0.022, 7)));
    for (let i = 0; i <= 3; i += 1) {
      const t = 0.09 + (i / 3) * 0.33;
      const y = FORM.sheerAt(t);
      const halfBeam = (FORM.beam / 2) * FORM.halfBeamAt(t);
      put(
        fittings,
        new CylinderGeometry(0.019, 0.023, 0.52, 7).translate(side * halfBeam, y + 0.26, stationZ(t, y)),
      );
    }
  }

  // 16. Cleats: a stemhead bollard where the two gunwales converge, and four on the capping
  // rail. All of them sit *on* the rail rather than inboard of it, because a cleat set inboard
  // of a boat with no side decks hangs in mid-air.
  const stemheadY = FORM.sheerAt(0.055);
  put(fittings, cleat(0, stemheadY + 0.06, stationZ(0.055, stemheadY)));
  for (const side of [1, -1]) {
    for (const t of [0.4, 0.86]) {
      const y = FORM.sheerAt(t);
      put(fittings, cleat(side * (FORM.beam / 2) * FORM.halfBeamAt(t), y + 0.06, stationZ(t, y)));
    }
  }

  // 17. Rod holder, raked outboard and aft the way a boat working a trolled bait sets one, so
  // the tip carries the line clear of the transom and clear of the wake.
  const rodHolder = new Object3D();
  rodHolder.position.set(0.86, deckHeightAt(0.86) + 0.24, 2.35);
  rodHolder.rotation.set(0.42, 0, -0.38);
  rodHolder.updateMatrix();
  group.add(rodHolder);
  // The tube is baked through the holder's own matrix rather than parented to it, so it can be
  // merged into the ironwork; the empty stays as the single authority on where the rod points.
  const holderTube = new CylinderGeometry(0.05, 0.05, 0.44, 10).translate(0, 0.06, 0);
  holderTube.applyMatrix4(rodHolder.matrix);
  put(fittings, scaleUv(holderTube, 0.3, 0.3));

  // 18. The lantern over the cockpit, hanging off the boom end.
  const lanternY = boomY - 0.36;
  const lanternZ = mastZ + 1.95;
  put(fittings, new CylinderGeometry(0.075, 0.09, 0.1, 8).translate(0, lanternY + 0.16, lanternZ));
  put(fittings, new CylinderGeometry(0.012, 0.012, 0.3, 6).translate(0, lanternY + 0.32, lanternZ));

  // 19–20. Life ring on the cabin side, and the tackle box on the sole.
  const ring = new TorusGeometry(0.3, 0.07, 8, 22);
  put(canvas, scaleUv(ring, 2, 0.5).rotateY(Math.PI / 2).translate(0.87, cabinFloor + 0.72, cabinZ + 0.2));
  put(joinery, meterBox(0.52, 0.26, 0.34).translate(-0.6, deckHeightAt(0.78) + 0.13, 1.95));
  put(joinery, meterBox(0.55, 0.05, 0.37).translate(-0.6, deckHeightAt(0.78) + 0.28, 1.95));

  // 21. The boot top, kept as its own mesh so the wake system can find it.
  const bandGeometry = finish(buildWaterlineBand());
  owned.push(bandGeometry);
  const waterlineBand = new Mesh(bandGeometry, paint);
  waterlineBand.name = 'waterlineBand';
  waterlineBand.castShadow = true;
  waterlineBand.receiveShadow = true;
  group.add(waterlineBand);

  // 22–26. Navigation lights. Port is to −X because the hull runs bow-forward down −Z.
  const sideLightT = 0.3;
  const sideLightY = FORM.sheerAt(sideLightT) + 0.09;
  const sideLightZ = stationZ(sideLightT, sideLightY);
  const sideLightX = (FORM.beam / 2) * FORM.halfBeamAt(sideLightT);
  const lightBulb = (): BufferGeometry => new CylinderGeometry(0.05, 0.05, 0.11, 10);

  const makeLight = (
    x: number,
    y: number,
    z: number,
    colour: number,
    emissive: number,
    housing: boolean,
  ): NavLight => {
    const material = navLightMaterial(colour, emissive);
    ownedMaterials.push(material);
    const geometry = finish(lightBulb().translate(x, y, z));
    owned.push(geometry);
    const mesh = new Mesh(geometry, material);
    group.add(mesh);
    if (housing) {
      put(fittings, new CylinderGeometry(0.062, 0.07, 0.06, 10).translate(x, y - 0.085, z));
    }
    return { mesh, material };
  };

  const navLights: NavLightSet = {
    port: makeLight(-sideLightX, sideLightY, sideLightZ, 0x3a0806, 0xff1408, true),
    starboard: makeLight(sideLightX, sideLightY, sideLightZ, 0x032c10, 0x12ff46, true),
    stern: makeLight(0, FORM.sheerAt(0.99) + 0.3, stationZ(0.99, FORM.sheerAt(0.99)), 0x2a2a26, 0xfff0d2, true),
    masthead: makeLight(0, mastFoot + mastHeight - 0.14, mastZ, 0x2a2a26, 0xfff2dc, false),
    lantern: makeLight(0, lanternY, lanternZ, 0x2b241a, 0xffbe6e, false),
  };

  // 27. The ensign, socketed into the transom top and offset to starboard so the staff does
  // not stand in front of the stern light.
  const staffT = 0.99;
  const staffBase = FORM.sheerAt(staffT);
  const staffX = 0.45;
  const staffZ = stationZ(staffT, staffBase);
  put(
    fittings,
    new CylinderGeometry(0.016, 0.02, 0.95, 6).translate(staffX, staffBase + 0.44, staffZ),
  );

  const flagWidth = 0.62;
  const flagHeight = 0.4;
  const flagGeometry = new PlaneGeometry(flagWidth, flagHeight, 14, 7);
  flagGeometry.translate(flagWidth / 2, 0, 0);
  scaleUv(flagGeometry, flagWidth, flagHeight);
  finish(flagGeometry);
  owned.push(flagGeometry);
  const flagPositions = flagGeometry.getAttribute('position');
  if (!(flagPositions instanceof BufferAttribute)) {
    throw new Error('PlaneGeometry produced an interleaved position attribute');
  }
  const flagMesh = new Mesh(flagGeometry, ensignCloth);
  flagMesh.castShadow = true;
  // The cloth is displaced well outside the bounding sphere `PlaneGeometry` computed for it,
  // and recomputing that sphere every frame costs more than never culling one small quad.
  flagMesh.frustumCulled = false;
  const flagPivot = new Object3D();
  flagPivot.position.set(staffX, staffBase + 0.66, staffZ);
  flagPivot.add(flagMesh);
  group.add(flagPivot);

  const flag: BoatFlag = {
    pivot: flagPivot,
    mesh: flagMesh,
    positions: flagPositions,
    rest: new Float32Array(flagPositions.array),
    width: flagWidth,
  };

  // 28. Four slack lines. Every one of them is a true catenary; see `Catenary`.
  const quarterY = FORM.sheerAt(0.78) + 0.06;
  const quarterX = (FORM.beam / 2) * FORM.halfBeamAt(0.78) * 0.9;
  const quarterZ = stationZ(0.78, quarterY);
  const bowY = FORM.sheerAt(0.06) + 0.1;
  const ropes: readonly RopeSway[] = [
    // A lifting strop from the masthead down to the port quarter.
    buildRope(
      new Vector3(0, mastFoot + mastHeight - 0.3, mastZ),
      new Vector3(-quarterX, quarterY, quarterZ),
      0.14,
      0.022,
      rope,
    ),
    // A net line strung across the cockpit.
    buildRope(
      new Vector3(-quarterX, quarterY, 2.5),
      new Vector3(quarterX, quarterY, 2.5),
      0.24,
      0.018,
      rope,
    ),
    // The boom's aft downhaul, made off to the cabin top and left hanging.
    buildRope(
      new Vector3(0, boomY - 0.05, mastZ + 1.95),
      new Vector3(0.55, cabinFloor + 1.3, cabinZ),
      0.3,
      0.02,
      rope,
    ),
    // The bow mooring line, over the stem head and trailing outboard into the water.
    buildRope(
      new Vector3(0, bowY, stationZ(0.06, bowY)),
      new Vector3(0.42, -0.15, -2.2),
      0.35,
      0.026,
      rope,
    ),
  ];
  for (const line of ropes) {
    owned.push(line.mesh.geometry);
    group.add(line.root);
  }

  // Merge every bin down to one mesh, which is what keeps the whole boat inside the draw budget.
  for (const [material, geometries] of bins) {
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    owned.push(merged);
    const mesh = new Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Rod tip: the holder's own transform carried out along the rod, so the number the fishing
  // code casts from is the number the visible tube points at.
  rodHolder.updateMatrix();
  const rodTipOffset = new Vector3(0, ROD_LENGTH, 0).applyMatrix4(rodHolder.matrix);

  return {
    group,
    mastTop,
    rodHolder,
    navLights,
    flag,
    waterlineBand,
    ropes,
    rodTipOffset,
    deckOffset: new Vector3(0, deckHeightAt(0.72) + 0.06, 1.7),
    materials: [
      planks,
      deckWood,
      joinery,
      ironwork,
      fittings,
      paint,
      rope,
      canvas,
      ensignCloth,
      ...ownedMaterials,
    ],
    dispose(): void {
      for (const geometry of owned) geometry.dispose();
      for (const material of ownedMaterials) material.dispose();
      owned.length = 0;
      ownedMaterials.length = 0;
      // Library materials belong to the library and are disposed with it.
      group.clear();
    },
  };
}
