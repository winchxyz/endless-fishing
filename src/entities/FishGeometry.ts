import { BufferAttribute, BufferGeometry } from 'three';
import type { Species } from '../gameplay/Species.js';

/**
 * Fish, lofted from the numbers already in `gameplay/Species.ts`.
 *
 * Geometry is never downloaded in this project, and here that is a feature rather than a
 * constraint: the species table already states `bodyDepth` and `bodyWidth` as fractions of total
 * length, so a loft driven by those fields cannot disagree with the table the journal, the bite
 * model and the catch screen read. A plaice comes out as a plate and a conger as a rope because
 * the data says so, not because someone modelled twelve fish and hoped.
 *
 * Three decisions are load-bearing:
 *
 *   1. **Every fish is built exactly one metre from snout to tail tip.** The instance matrix's
 *      scale is then literally the specimen's length in metres, which is the number
 *      `rollSpecimen` produces, so nothing anywhere has to convert between "model units" and the
 *      world. It also means the proportions test can assert equality against the table rather
 *      than equality-times-a-fudge-factor.
 *   2. **The section is renormalised after the belly is deepened.** Fish are not elliptical in
 *      section — the belly runs further from the spine than the back does — but if that bulge is
 *      simply added, the finished body is 7% deeper than `bodyDepth` says. So the asymmetry is
 *      applied and then rescaled to span exactly `bodyDepth`. The shape is a fish's; the number
 *      is the table's.
 *   3. **Every vertex carries its spine parameter**, 0 at the snout and 1 at the tail tip. That
 *      single float is what lets `fish.vert` run a travelling bend down the body — the fins move
 *      with the station they are rooted at, and the caudal, whose parameter runs on past the
 *      body, whips. Without it a school is a formation of arrows.
 *
 * Nothing here runs per frame. A species' geometry is built once at boot and instanced.
 */

/** Stations along the body loft. 16 resolves the taper without faceting at arm's length. */
const SPINE_STATIONS = 16;
/**
 * Vertices around a body section, plus one duplicated seam vertex for the UV wrap.
 *
 * A multiple of four, and that is a requirement rather than a preference: the extremes of the
 * section lie at θ = 0, 90°, 180° and 270°, so anything else samples *past* the widest and
 * deepest points and quietly delivers a fish a few per cent thinner than the table asked for.
 */
const SECTION_SIDES = 12;

/**
 * Spine parameter where the body loft stops and the caudal fin starts — the wrist of the tail.
 * Aft of this there is no body, only membrane, which is why the tail can be so much thinner than
 * anything the section profile could produce.
 */
const PEDUNCLE = 0.86;
/** Spine parameter of the deepest section. Fish carry their girth well forward of centre. */
const SHOULDER = 0.3;
/** How much further the belly runs from the spine than the back does, before renormalising. */
const BELLY_FULLNESS = 0.14;
/** Girth left at the wrist, as a fraction of the girth at the shoulder. */
const PEDUNCLE_GIRTH = 0.14;

/** Membrane half-thickness at a fin's root, as a fraction of body length. */
const FIN_THICKNESS = 0.004;
/** How far under the skin a fin's root line is buried, so no gap opens as the body bends. */
const FIN_SINK = 0.14;

/** Nose-to-tail-tip length of the geometry this file produces. */
export const FISH_UNIT_LENGTH = 1;

export interface FishMeasurements {
  /** Full z extent — snout to tail tip. Always `FISH_UNIT_LENGTH` for a geometry from here. */
  totalLength: number;
  /** Greatest depth of the *body*, fins and eyes excluded. Compare against `species.bodyDepth`. */
  bodyDepth: number;
  /** Greatest width of the body, fins and eyes excluded. Compare against `species.bodyWidth`. */
  bodyWidth: number;
  /** Tip-to-tip spread of the caudal fin. */
  tailSpan: number;
  vertexCount: number;
  triangleCount: number;
}

/** Silhouette of the body, 0 at the snout, 1 at the shoulder, `PEDUNCLE_GIRTH` at the wrist. */
function bodyProfile(s: number): number {
  if (s <= 0) return 0;
  if (s >= PEDUNCLE) return PEDUNCLE_GIRTH;
  // Forward of the shoulder: a quarter ellipse, which gives a snout that comes to a point
  // without the cone that a linear taper produces.
  const rise = s < SHOULDER ? Math.sqrt(Math.max(0, 1 - (1 - s / SHOULDER) ** 2)) : 1;
  const aft = s < SHOULDER ? 0 : (s - SHOULDER) / (PEDUNCLE - SHOULDER);
  return rise * (1 - (1 - PEDUNCLE_GIRTH) * aft ** 1.45);
}

/** World z of a spine parameter. The snout is at +z, so a fish swims towards its own +Z. */
function spineZ(s: number): number {
  return 0.5 - s;
}

/** Of `SPINE_STATIONS`, how many lie forward of the shoulder. */
const SHOULDER_STATION = 6;

/**
 * Spine parameter of a loft station.
 *
 * Piecewise, so that one station lands *exactly* on the shoulder. The shoulder is the deepest
 * and widest section and therefore the one that decides whether the finished fish is the depth
 * the species table says it is; straddling it instead of hitting it leaves every fish about half
 * a percent thin, which is invisible and also simply wrong. The split also puts more of the
 * stations in the head, which is where all the curvature is.
 */
function stationParameter(station: number): number {
  if (station <= SHOULDER_STATION) return (station / SHOULDER_STATION) * SHOULDER;
  const aft = (station - SHOULDER_STATION) / (SPINE_STATIONS - SHOULDER_STATION);
  return SHOULDER + aft * (PEDUNCLE - SHOULDER);
}

/**
 * Height of a section point, given cos θ and the section's half-depth.
 *
 * The belly is deepened by `BELLY_FULLNESS` and the whole section is then shifted and rescaled
 * so it still spans exactly `±halfDepth`. See the file header: the shape has to be a fish's and
 * the number has to be the table's, and only one of those survives if the bulge is left in.
 */
function sectionY(cosTheta: number, halfDepth: number): number {
  const raw = cosTheta >= 0 ? cosTheta : cosTheta * (1 + BELLY_FULLNESS);
  return halfDepth * (raw + BELLY_FULLNESS * 0.5) * (2 / (2 + BELLY_FULLNESS));
}

/**
 * Accumulator for the loft.
 *
 * Plain arrays because this runs once per species at boot and never again; the frame loop only
 * ever sees the finished `BufferGeometry`.
 */
class Loft {
  readonly positions: number[] = [];
  readonly uvs: number[] = [];
  readonly spine: number[] = [];
  readonly traits: number[] = [];
  readonly indices: number[] = [];

  get count(): number {
    return this.positions.length / 3;
  }

  vertex(
    x: number,
    y: number,
    z: number,
    u: number,
    v: number,
    s: number,
    fin: number,
    eye: number,
  ): number {
    const index = this.count;
    this.positions.push(x, y, z);
    this.uvs.push(u, v);
    this.spine.push(s);
    this.traits.push(fin, eye);
    return index;
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  /** `a` and `b` are adjacent on one row, `c` and `d` the pair below them. */
  quad(a: number, b: number, c: number, d: number, flip = false): void {
    if (flip) this.indices.push(a, c, b, b, c, d);
    else this.indices.push(a, b, c, b, d, c);
  }
}

/**
 * A point in fish space.
 *
 * A named struct rather than a three-element array: `noUncheckedIndexedAccess` types every array
 * read as possibly undefined, and thirty `?? 0`s through a loft would bury the geometry under
 * noise for a case that a fixed-length triple cannot produce.
 */
interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** A point on the body's skin, in fish space. */
function bodyPoint(
  s: number,
  theta: number,
  bodyDepth: number,
  bodyWidth: number,
  out: Point3,
): void {
  const profile = bodyProfile(s);
  out.x = 0.5 * bodyWidth * profile * Math.sin(theta);
  out.y = sectionY(Math.cos(theta), 0.5 * bodyDepth * profile);
  out.z = spineZ(s);
}

/**
 * Single-lobe fin silhouette: zero area at both ends of the root line, deepest a little forward
 * of the middle. A fin that keeps its height right to the end of its base reads as a sail.
 */
function finLobe(u: number): number {
  return Math.sin(Math.PI * u ** 0.72);
}

/**
 * A fin as a ruled surface between a root line buried in the flank and a free edge.
 *
 * Emitted as two faces whose thickness tapers to nothing at the edge, so the membrane has a real
 * silhouette and a knife edge instead of a visible slab. Both faces get a `fin` trait running 0
 * at the root to 1 at the edge, which the vertex shader uses for flutter and the fragment shader
 * for translucency — a fin held against the light is nearly transparent at its margin, and that
 * is most of what distinguishes a fin from a fin-shaped piece of the fish.
 *
 * The spine parameter is the *root's* for every vertex of the fin, because a fin is stiff
 * relative to the station it grows from and should swing with it rather than lag behind it. The
 * caudal is the exception and is built separately.
 */
function addRuledFin(
  loft: Loft,
  bodyDepth: number,
  bodyWidth: number,
  sFrom: number,
  sTo: number,
  theta: number,
  spanX: number,
  spanY: number,
  spanZ: number,
  segmentsU: number,
  segmentsV: number,
): void {
  const root: Point3 = { x: 0, y: 0, z: 0 };
  const chord: Point3 = { x: 0, y: 0, z: 0 };

  bodyPoint(sFrom, theta, bodyDepth, bodyWidth, root);
  bodyPoint(sTo, theta, bodyDepth, bodyWidth, chord);
  chord.x -= root.x;
  chord.y -= root.y;
  chord.z -= root.z;

  // The membrane's faces look along the normal of the plane its root line and its span define.
  let nx = chord.y * spanZ - chord.z * spanY;
  let ny = chord.z * spanX - chord.x * spanZ;
  let nz = chord.x * spanY - chord.y * spanX;
  const length = Math.hypot(nx, ny, nz);
  if (length < 1e-9) {
    // Degenerate only if the fin lies along its own root line, which no placement below does;
    // falling back to the lateral axis keeps a bad edit from producing NaN geometry.
    nx = 1;
    ny = 0;
    nz = 0;
  } else {
    nx /= length;
    ny /= length;
    nz /= length;
  }

  const point: Point3 = { x: 0, y: 0, z: 0 };
  for (const side of [1, -1]) {
    const base = loft.count;
    for (let iv = 0; iv <= segmentsV; iv += 1) {
      const v = iv / segmentsV;
      const thickness = FIN_THICKNESS * (1 - v) * side;
      for (let iu = 0; iu <= segmentsU; iu += 1) {
        const u = iu / segmentsU;
        const s = sFrom + (sTo - sFrom) * u;
        bodyPoint(s, theta, bodyDepth, bodyWidth, point);
        const reach = finLobe(u) * v;
        loft.vertex(
          point.x * (1 - FIN_SINK) + spanX * reach + nx * thickness,
          point.y * (1 - FIN_SINK) + spanY * reach + ny * thickness,
          point.z + spanZ * reach + nz * thickness,
          u,
          v,
          s,
          v,
          0,
        );
      }
    }

    const stride = segmentsU + 1;
    for (let iv = 0; iv < segmentsV; iv += 1) {
      for (let iu = 0; iu < segmentsU; iu += 1) {
        const a = base + iv * stride + iu;
        loft.quad(a, a + 1, a + stride, a + stride + 1, side < 0);
      }
    }
  }
}

/**
 * The caudal fin — the one that does the work.
 *
 * Its spine parameter runs on past the body from `PEDUNCLE` to 1, so the vertex shader's bend
 * envelope keeps growing across it and the tail whips a beat behind the body. That lag is the
 * whole difference between a fish swimming and a fish being dragged.
 *
 * Forked and rounded tails differ only in where the trailing edge sits: on a forked tail the
 * lobe tips are the aftmost points and the middle is cut away; on a rounded one the middle is
 * aftmost. Either way the aftmost point lands at z = −0.5, so the fish is one unit long.
 */
function addCaudalFin(loft: Loft, species: Species, tailSpan: number): void {
  const SEGMENTS_ACROSS = 12;
  const SEGMENTS_ALONG = 4;

  const rootZ = spineZ(PEDUNCLE);
  const rootHalfDepth = 0.5 * species.bodyDepth * bodyProfile(PEDUNCLE);
  const tailLength = rootZ - spineZ(1);
  const forkDepth = species.forkedTail ? tailLength * 0.5 : 0;
  const roundBack = species.forkedTail ? 0 : tailLength * 0.25;

  for (const side of [1, -1]) {
    const base = loft.count;
    for (let iv = 0; iv <= SEGMENTS_ALONG; iv += 1) {
      const v = iv / SEGMENTS_ALONG;
      const thickness = FIN_THICKNESS * (1 - v) * side;
      for (let iu = 0; iu <= SEGMENTS_ACROSS; iu += 1) {
        const u = iu / SEGMENTS_ACROSS;
        const across = u * 2 - 1;
        const rootY = rootHalfDepth * across;
        const edgeY = tailSpan * (species.forkedTail ? across : across * 0.8);
        const edgeZ = species.forkedTail
          ? spineZ(1) + forkDepth * (1 - Math.abs(across) ** 1.5)
          : spineZ(1) + roundBack * across * across;
        loft.vertex(
          thickness,
          rootY + (edgeY - rootY) * v,
          rootZ + (edgeZ - rootZ) * v,
          u,
          v,
          PEDUNCLE + (1 - PEDUNCLE) * v,
          v,
          0,
        );
      }
    }

    const stride = SEGMENTS_ACROSS + 1;
    for (let iv = 0; iv < SEGMENTS_ALONG; iv += 1) {
      for (let iu = 0; iu < SEGMENTS_ACROSS; iu += 1) {
        const a = base + iv * stride + iu;
        loft.quad(a, a + 1, a + stride, a + stride + 1, side < 0);
      }
    }
  }
}

/**
 * An eye, as a small sphere set into the head.
 *
 * Marked with the eye trait so the fragment shader can leave it out of the countershading — an
 * eye that takes the dark-back, pale-belly gradient like the rest of the skin comes out half
 * white, and a fish with a half-white eye looks dead from twenty metres.
 */
function addEye(loft: Loft, species: Species, side: number): void {
  const RINGS = 5;
  const SEGMENTS = 8;
  const s = 0.1;
  const theta = side * Math.PI * 0.42;

  const centre: Point3 = { x: 0, y: 0, z: 0 };
  bodyPoint(s, theta, species.bodyDepth, species.bodyWidth, centre);
  const radius = 0.5 * species.bodyWidth * bodyProfile(s) * 0.5;
  // Seated proud of the skin by a third of its radius: a sphere flush with the surface reads as
  // a painted dot, and one standing clear of it reads as a bead glued on.
  const outX = centre.x * (1 + (radius / Math.max(1e-4, Math.abs(centre.x))) * 0.33);

  const base = loft.count;
  for (let ring = 0; ring <= RINGS; ring += 1) {
    const phi = (ring / RINGS) * Math.PI;
    const y = Math.cos(phi);
    const r = Math.sin(phi);
    for (let seg = 0; seg <= SEGMENTS; seg += 1) {
      const angle = (seg / SEGMENTS) * Math.PI * 2;
      loft.vertex(
        outX + side * radius * y * 0.5,
        centre.y + radius * r * Math.cos(angle),
        centre.z + radius * r * Math.sin(angle),
        seg / SEGMENTS,
        ring / RINGS,
        s,
        0,
        1,
      );
    }
  }

  const stride = SEGMENTS + 1;
  for (let ring = 0; ring < RINGS; ring += 1) {
    for (let seg = 0; seg < SEGMENTS; seg += 1) {
      const a = base + ring * stride + seg;
      loft.quad(a, a + 1, a + stride, a + stride + 1, side < 0);
    }
  }
}

/** Tip-to-tip spread of the caudal fin, as a fraction of length. Deep bodies carry broad tails. */
function tailSpanOf(species: Species): number {
  return species.forkedTail ? 0.09 + 0.2 * species.bodyDepth : 0.06 + 0.3 * species.bodyDepth;
}

/**
 * Build one species' fish.
 *
 * The result is a single indexed `BufferGeometry` carrying `position`, `normal`, `uv`, the
 * `aSpine` parameter and an `aTrait` pair (fin-edge fraction, eye mask). One geometry, one
 * material, one draw call per species however many fish are in the water.
 */
export function buildFishGeometry(species: Species): BufferGeometry {
  const loft = new Loft();
  const point: Point3 = { x: 0, y: 0, z: 0 };
  const depth = species.bodyDepth;
  const width = species.bodyWidth;

  // --- body ---------------------------------------------------------------------------------
  // Stations run from the first ring aft of the snout to the wrist. The snout itself is a single
  // apex vertex so the fan closes on a point instead of on a ring of coincident vertices, which
  // would leave `computeVertexNormals` averaging zero-area triangles.
  const snout = loft.vertex(0, 0, spineZ(0), 0.5, 0, 0, 0, 0);
  const bodyBase = loft.count;
  const bodyStride = SECTION_SIDES + 1;

  for (let station = 1; station <= SPINE_STATIONS; station += 1) {
    const s = stationParameter(station);
    for (let side = 0; side <= SECTION_SIDES; side += 1) {
      const theta = (side / SECTION_SIDES) * Math.PI * 2;
      bodyPoint(s, theta, depth, width, point);
      loft.vertex(point.x, point.y, point.z, side / SECTION_SIDES, s, s, 0, 0);
    }
  }

  for (let side = 0; side < SECTION_SIDES; side += 1) {
    loft.triangle(snout, bodyBase + side + 1, bodyBase + side);
  }
  for (let station = 0; station + 1 < SPINE_STATIONS; station += 1) {
    for (let side = 0; side < SECTION_SIDES; side += 1) {
      const a = bodyBase + station * bodyStride + side;
      loft.quad(a, a + 1, a + bodyStride, a + bodyStride + 1);
    }
  }

  // Cap the wrist. The caudal covers it, but an open tube shows its inside the moment the body
  // bends far enough for the tail to swing clear.
  const wristRing = bodyBase + (SPINE_STATIONS - 1) * bodyStride;
  const wrist = loft.vertex(0, 0, spineZ(PEDUNCLE) - 0.006, 0.5, PEDUNCLE, PEDUNCLE, 0, 0);
  for (let side = 0; side < SECTION_SIDES; side += 1) {
    loft.triangle(wrist, wristRing + side, wristRing + side + 1);
  }

  // --- fins ---------------------------------------------------------------------------------
  // Heights are fractions of body depth rather than of length, so a deep-bodied fish gets the
  // tall dorsal it should have and a conger gets the low ridge it should have, from one number.
  const dorsal = depth * 0.52;
  addRuledFin(loft, depth, width, 0.32, 0.62, 0, 0, dorsal, -dorsal * 0.3, 7, 3);

  const anal = depth * 0.34;
  addRuledFin(loft, depth, width, 0.62, 0.79, Math.PI, 0, -anal, -anal * 0.28, 5, 3);

  for (const side of [1, -1]) {
    // Pectorals sweep out, back and down from just behind the gill cover — the fin a fish holds
    // out to brake and to hold station, and the one whose absence is most obvious.
    addRuledFin(
      loft,
      depth,
      width,
      0.22,
      0.3,
      side * Math.PI * 0.6,
      side * 0.085,
      -0.04,
      -0.115,
      5,
      3,
    );
    addRuledFin(
      loft,
      depth,
      width,
      0.4,
      0.47,
      side * Math.PI * 0.87,
      side * 0.03,
      -0.05,
      -0.055,
      4,
      2,
    );
  }

  const tailSpan = tailSpanOf(species);
  addCaudalFin(loft, species, tailSpan);

  addEye(loft, species, 1);
  addEye(loft, species, -1);

  // --- assembly -----------------------------------------------------------------------------
  const geometry = new BufferGeometry();
  geometry.name = `fish:${species.id}`;
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(loft.positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(loft.uvs), 2));
  geometry.setAttribute('aSpine', new BufferAttribute(new Float32Array(loft.spine), 1));
  geometry.setAttribute('aTrait', new BufferAttribute(new Float32Array(loft.traits), 2));
  geometry.setIndex(loft.indices);
  geometry.computeVertexNormals();

  // The seam column exists only so u can reach 1 for the texture wrap; geometrically it is the
  // same place as column 0. `computeVertexNormals` cannot know that and averages half as many
  // faces into it, which leaves a faint crease running the length of the fish. Copying the
  // normals across costs sixteen assignments and removes it entirely.
  const normals = geometry.getAttribute('normal');
  for (let station = 0; station < SPINE_STATIONS; station += 1) {
    const first = bodyBase + station * bodyStride;
    const seam = first + SECTION_SIDES;
    normals.setXYZ(seam, normals.getX(first), normals.getY(first), normals.getZ(first));
  }
  normals.needsUpdate = true;

  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Measure a built fish.
 *
 * Body extents deliberately exclude fins and eyes: the species table's `bodyDepth` and
 * `bodyWidth` describe the body, and a pectoral fin held out to the side is wider than the fish
 * without making the fish wider. Fin roots carry a fin fraction of exactly 0 and so count as
 * body, which is correct — they are buried under the skin and cannot exceed its extent.
 */
export function measureFishGeometry(geometry: BufferGeometry): FishMeasurements {
  const position = geometry.getAttribute('position');
  const spine = geometry.getAttribute('aSpine');
  const trait = geometry.getAttribute('aTrait');

  let minZ = Infinity;
  let maxZ = -Infinity;
  let bodyMinY = Infinity;
  let bodyMaxY = -Infinity;
  let bodyMinX = Infinity;
  let bodyMaxX = -Infinity;
  let tailMinY = Infinity;
  let tailMaxY = -Infinity;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;

    const isFin = trait.getX(i) > 0;
    const isEye = trait.getY(i) > 0;
    if (!isFin && !isEye) {
      if (y < bodyMinY) bodyMinY = y;
      if (y > bodyMaxY) bodyMaxY = y;
      if (x < bodyMinX) bodyMinX = x;
      if (x > bodyMaxX) bodyMaxX = x;
    }
    if (spine.getX(i) > PEDUNCLE + 1e-4) {
      if (y < tailMinY) tailMinY = y;
      if (y > tailMaxY) tailMaxY = y;
    }
  }

  const index = geometry.getIndex();
  return {
    totalLength: maxZ - minZ,
    bodyDepth: bodyMaxY - bodyMinY,
    bodyWidth: bodyMaxX - bodyMinX,
    tailSpan: tailMaxY - tailMinY,
    vertexCount: position.count,
    triangleCount: index === null ? position.count / 3 : index.count / 3,
  };
}
