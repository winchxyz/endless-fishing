import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { WorldState } from '../core/WorldState.js';
import { clamp } from '../math/Noise.js';
import lineVert from '../shaders/line/line.vert';
import lineFrag from '../shaders/line/line.frag';

/**
 * The line from the rod tip to the float.
 *
 * This is *solved*, not drawn. A line rendered as a straight segment between two points is the
 * single most common giveaway in a fishing game, because real line only goes straight when it is
 * loaded — the rest of the time it hangs, and the shape it hangs in is the one thing that tells
 * the player at a glance whether they have contact with the fish or not. So the shape is the
 * mechanic, and it has to come out of the physics rather than out of a hand-drawn curve.
 *
 * A short chain of control points is integrated under gravity by Verlet, then relaxed against an
 * **inextensible** length constraint with a few Gauss-Seidel passes. Inextensible and not a
 * spring: line resists being stretched and does not resist being compressed, so the constraint
 * is one-sided. That one asymmetry is what produces a genuine catenary when there is more line
 * out than there is distance to cover, and a dead straight line the instant there is not — with
 * no branch anywhere deciding which of the two to draw.
 *
 * The tube itself is rebuilt in world space every frame through a Catmull-Rom pass over the
 * relaxed points, with a rotation-minimising frame so the surface does not spin about its own
 * axis when the line swings through vertical.
 */

/** Control points are `SEGMENTS + 1`. Enough to carry a catenary; few enough to relax cheaply. */
const SEGMENTS = 18;
/**
 * Relaxation passes per frame. Gauss-Seidel converges from the ends inwards, so four passes
 * propagate a constraint about four points along — which at 120 Hz is a taut line within two
 * frames of the fish moving, and slack that settles over a tenth of a second. Both are right.
 */
const RELAX_PASSES = 5;

/** Stations sampled along the Catmull-Rom curve, and vertices around the tube at each. */
const STATIONS = 44;
const RADIAL = 6;

/**
 * Drawn radius, metres. Real 0.28 mm monofilament is far under a pixel at any range you would
 * watch a float from, so it would alias into a dashed grey stipple. This is the standard and
 * unavoidable exaggeration; the shader then treats it as a filament rather than as a rod, which
 * is what keeps it reading as line and not as wire.
 */
const BASE_RADIUS = 0.0045;

const GRAVITY = 9.80665;
/**
 * Verlet velocity retention per step. Line is a damped thing — it is thin, it is in air, and it
 * is anchored at both ends — and an undamped chain rings for seconds after every twitch.
 */
const DAMPING = 0.86;

const scratchA = new Vector3();
const scratchB = new Vector3();
const tangent = new Vector3();
const frameNormal = new Vector3();
const frameBinormal = new Vector3();
const samplePoint = new Vector3();

export class FishingLine {
  readonly mesh: Mesh;

  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;

  /** Relaxed control points and their previous positions, both flat xyz triples. */
  private readonly points = new Float32Array((SEGMENTS + 1) * 3);
  private readonly previous = new Float32Array((SEGMENTS + 1) * 3);
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly tangents: Float32Array;

  private readonly positionAttribute: BufferAttribute;
  private readonly normalAttribute: BufferAttribute;
  private readonly tangentAttribute: BufferAttribute;

  /** False until the chain has been laid out once, so the first frame does not fling it. */
  private seeded = false;

  constructor() {
    this.positions = new Float32Array(STATIONS * RADIAL * 3);
    this.normals = new Float32Array(STATIONS * RADIAL * 3);
    this.tangents = new Float32Array(STATIONS * RADIAL * 3);
    const along = new Float32Array(STATIONS * RADIAL);
    for (let s = 0; s < STATIONS; s += 1) {
      const t = s / (STATIONS - 1);
      for (let r = 0; r < RADIAL; r += 1) along[s * RADIAL + r] = t;
    }

    const indices = new Uint16Array((STATIONS - 1) * RADIAL * 6);
    let cursor = 0;
    for (let s = 0; s < STATIONS - 1; s += 1) {
      for (let r = 0; r < RADIAL; r += 1) {
        const a = s * RADIAL + r;
        const b = s * RADIAL + ((r + 1) % RADIAL);
        const c = a + RADIAL;
        const d = b + RADIAL;
        indices[cursor] = a;
        indices[cursor + 1] = c;
        indices[cursor + 2] = b;
        indices[cursor + 3] = b;
        indices[cursor + 4] = c;
        indices[cursor + 5] = d;
        cursor += 6;
      }
    }

    this.positionAttribute = new BufferAttribute(this.positions, 3);
    this.normalAttribute = new BufferAttribute(this.normals, 3);
    this.tangentAttribute = new BufferAttribute(this.tangents, 3);
    // Rewritten every frame, so the driver is told once rather than being made to guess.
    this.positionAttribute.setUsage(DynamicDrawUsage);
    this.normalAttribute.setUsage(DynamicDrawUsage);
    this.tangentAttribute.setUsage(DynamicDrawUsage);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('normal', this.normalAttribute);
    this.geometry.setAttribute('aTangent', this.tangentAttribute);
    this.geometry.setAttribute('aAlong', new BufferAttribute(along, 1));
    this.geometry.setIndex(new BufferAttribute(indices, 1));
    // The tube is built in world space, so a bounding volume would have to be recomputed every
    // frame to be useful. The line is a handful of metres long and always in front of the
    // player; culling it is not a saving worth paying for.
    this.geometry.boundingSphere = null;

    this.material = new ShaderMaterial({
      vertexShader: lineVert,
      fragmentShader: lineFrag,
      uniforms: {
        uSunDirection: { value: new Vector3(0, 1, 0) },
        uSunColour: { value: new Color(1, 0.98, 0.94) },
        uSunIlluminance: { value: 0 },
        uMoonDirection: { value: new Vector3(0, -1, 0) },
        uMoonColour: { value: new Color(0.72, 0.8, 1) },
        uMoonIlluminance: { value: 0 },
        uSkyRadiance: { value: new Color(0, 0, 0) },
        uVisibility: { value: 25000 },
        uLineColour: { value: new Color(0.55, 0.58, 0.6) },
        uTension: { value: 0 },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  /** Drop the solved chain, so the next `resolve` lays it out fresh instead of whipping it. */
  reset(): void {
    this.seeded = false;
  }

  /**
   * Sun, moon and haze, straight off the frame's shared snapshot.
   *
   * Monofilament has no colour of its own worth speaking of — what you see is the sky it is
   * reflecting and the glint where it is edge-on to the sun — so it is lit from the same
   * ephemeris as everything else rather than from a fixed key light.
   */
  updateLighting(world: WorldState): void {
    const uniforms = this.material.uniforms;
    const ephemeris = world.ephemeris;
    if (ephemeris !== null) {
      const sun = uniforms['uSunDirection'];
      if (sun !== undefined) {
        const direction = ephemeris.sunDirectionRefracted;
        (sun.value as Vector3).set(direction.x, direction.y, direction.z);
      }
      const moon = uniforms['uMoonDirection'];
      if (moon !== undefined) {
        (moon.value as Vector3).set(
          ephemeris.moonDirection.x,
          ephemeris.moonDirection.y,
          ephemeris.moonDirection.z,
        );
      }
      // Divided by π for the same reason the ocean does it: what a shading term wants is the
      // radiance a lambertian surface returns, not the illuminance falling on it. Cloud takes
      // the direct beam down; the sky term below picks that energy back up as diffuse.
      setNumber(uniforms, 'uSunIlluminance', (ephemeris.sunIlluminanceLux / Math.PI) * (1 - world.cloudiness * 0.9));
      setNumber(uniforms, 'uMoonIlluminance', ephemeris.moonIlluminanceLux / Math.PI);
    }

    const sky = uniforms['uSkyRadiance'];
    if (sky !== undefined) {
      const ambient = world.sceneIlluminanceLux / Math.PI;
      (sky.value as Color).setRGB(ambient * 0.82, ambient * 0.9, ambient);
    }
    setNumber(uniforms, 'uVisibility', world.visibility);
  }

  /**
   * Relax the chain and rebuild the tube.
   *
   * `deployedLengthM` is how much line is off the reel. When it exceeds the straight distance
   * the surplus has to go somewhere and gravity decides where; when it is shorter, the constraint
   * is violated everywhere at once and five passes pull the whole chain onto the straight line
   * between the ends.
   */
  resolve(
    dt: number,
    rodTip: Vector3,
    endPoint: Vector3,
    deployedLengthM: number,
    tension: number,
  ): void {
    if (!this.seeded) {
      this.seed(rodTip, endPoint);
      this.seeded = true;
    }

    this.integrate(dt);

    // Pin the ends. Everything else in the solve is a suggestion; these two are facts.
    write(this.points, 0, rodTip.x, rodTip.y, rodTip.z);
    write(this.points, SEGMENTS, endPoint.x, endPoint.y, endPoint.z);

    const rest = Math.max(1e-4, deployedLengthM / SEGMENTS);
    for (let pass = 0; pass < RELAX_PASSES; pass += 1) this.relax(rest);

    this.buildTube(tension);
    setNumber(this.material.uniforms, 'uTension', clamp(tension, 0, 1));
  }

  /** Fade the line out — used as a cast winds down rather than popping it off screen. */
  setOpacity(opacity: number): void {
    setNumber(this.material.uniforms, 'uOpacity', clamp(opacity, 0, 1));
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private seed(rodTip: Vector3, endPoint: Vector3): void {
    for (let i = 0; i <= SEGMENTS; i += 1) {
      const t = i / SEGMENTS;
      const x = rodTip.x + (endPoint.x - rodTip.x) * t;
      const y = rodTip.y + (endPoint.y - rodTip.y) * t;
      const z = rodTip.z + (endPoint.z - rodTip.z) * t;
      write(this.points, i, x, y, z);
      write(this.previous, i, x, y, z);
    }
  }

  /**
   * Verlet, with the step clamped.
   *
   * Position Verlet is unconditionally stable under the constraint solve below but its implied
   * velocity is `(p − p_prev)/dt`, so a frame spike would inject one. Clamping the step keeps a
   * hitch from turning into a line that snaps taut across the screen.
   */
  private integrate(dt: number): void {
    const step = Math.min(dt, 1 / 60);
    const fall = GRAVITY * step * step;
    for (let i = 1; i < SEGMENTS; i += 1) {
      const o = i * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        const current = this.points[o + axis] ?? 0;
        const previous = this.previous[o + axis] ?? 0;
        const next = current + (current - previous) * DAMPING + (axis === 1 ? -fall : 0);
        this.previous[o + axis] = current;
        this.points[o + axis] = next;
      }
    }
  }

  /**
   * One Gauss-Seidel pass of the length constraint.
   *
   * One-sided: a segment longer than its rest length is pulled in, a shorter one is left alone.
   * Interior points share the correction equally; a point next to a pinned end takes all of it,
   * which is what makes the chain hang from the rod tip rather than dragging the rod tip down.
   */
  private relax(rest: number): void {
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = i * 3;
      const b = a + 3;
      const dx = (this.points[b] ?? 0) - (this.points[a] ?? 0);
      const dy = (this.points[b + 1] ?? 0) - (this.points[a + 1] ?? 0);
      const dz = (this.points[b + 2] ?? 0) - (this.points[a + 2] ?? 0);
      const distance = Math.hypot(dx, dy, dz);
      if (distance <= rest || distance < 1e-6) continue;

      const excess = (distance - rest) / distance;
      const headPinned = i === 0;
      const tailPinned = i + 1 === SEGMENTS;
      if (headPinned && tailPinned) continue;

      const headShare = headPinned ? 0 : tailPinned ? 1 : 0.5;
      const tailShare = 1 - headShare;
      this.points[a] = (this.points[a] ?? 0) + dx * excess * headShare;
      this.points[a + 1] = (this.points[a + 1] ?? 0) + dy * excess * headShare;
      this.points[a + 2] = (this.points[a + 2] ?? 0) + dz * excess * headShare;
      this.points[b] = (this.points[b] ?? 0) - dx * excess * tailShare;
      this.points[b + 1] = (this.points[b + 1] ?? 0) - dy * excess * tailShare;
      this.points[b + 2] = (this.points[b + 2] ?? 0) - dz * excess * tailShare;
    }
  }

  /**
   * Sweep a ring along the Catmull-Rom curve through the control points.
   *
   * The frame is rotation-minimising — each station's normal is the previous one projected back
   * onto the new perpendicular plane — rather than the usual `cross(tangent, up)`. With `up` the
   * frame flips over when the line passes through vertical, and a fish sounding directly under
   * the boat does exactly that.
   */
  private buildTube(tension: number): void {
    const radius = BASE_RADIUS * (1 - 0.22 * clamp(tension, 0, 1));

    for (let station = 0; station < STATIONS; station += 1) {
      const u = (station / (STATIONS - 1)) * SEGMENTS;
      this.sample(u, samplePoint, tangent);

      if (station === 0) {
        // Any perpendicular will do for the first ring; pick the axis the tangent leans on least
        // so the cross product is well conditioned.
        scratchA.set(
          Math.abs(tangent.x) < 0.9 ? 1 : 0,
          Math.abs(tangent.x) < 0.9 ? 0 : 1,
          0,
        );
        frameNormal.copy(scratchA).addScaledVector(tangent, -scratchA.dot(tangent)).normalize();
      } else {
        frameNormal.addScaledVector(tangent, -frameNormal.dot(tangent));
        if (frameNormal.lengthSq() < 1e-10) frameNormal.set(tangent.y, -tangent.x, 0);
        frameNormal.normalize();
      }
      frameBinormal.crossVectors(tangent, frameNormal);

      for (let r = 0; r < RADIAL; r += 1) {
        const angle = (r / RADIAL) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = frameNormal.x * cos + frameBinormal.x * sin;
        const ny = frameNormal.y * cos + frameBinormal.y * sin;
        const nz = frameNormal.z * cos + frameBinormal.z * sin;
        const o = (station * RADIAL + r) * 3;
        this.positions[o] = samplePoint.x + nx * radius;
        this.positions[o + 1] = samplePoint.y + ny * radius;
        this.positions[o + 2] = samplePoint.z + nz * radius;
        this.normals[o] = nx;
        this.normals[o + 1] = ny;
        this.normals[o + 2] = nz;
        this.tangents[o] = tangent.x;
        this.tangents[o + 1] = tangent.y;
        this.tangents[o + 2] = tangent.z;
      }
    }

    this.positionAttribute.needsUpdate = true;
    this.normalAttribute.needsUpdate = true;
    this.tangentAttribute.needsUpdate = true;
  }

  /** Uniform Catmull-Rom position and unit tangent at curve parameter `u` in [0, SEGMENTS]. */
  private sample(u: number, outPoint: Vector3, outTangent: Vector3): void {
    const index = Math.min(SEGMENTS - 1, Math.floor(u));
    const t = u - index;
    read(this.points, Math.max(0, index - 1), scratchA);
    read(this.points, index, outPoint);
    read(this.points, index + 1, scratchB);
    read(this.points, Math.min(SEGMENTS, index + 2), outTangent);

    const p0 = scratchA;
    const p1x = outPoint.x;
    const p1y = outPoint.y;
    const p1z = outPoint.z;
    const p2 = scratchB;
    const p3 = outTangent;

    const t2 = t * t;
    const t3 = t2 * t;
    const a = -0.5 * t3 + t2 - 0.5 * t;
    const b = 1.5 * t3 - 2.5 * t2 + 1;
    const c = -1.5 * t3 + 2 * t2 + 0.5 * t;
    const d = 0.5 * t3 - 0.5 * t2;
    // Derivative of the same basis: the tangent has to come from the curve, not from a finite
    // difference of neighbouring samples, or the frame jitters wherever the curve bends hardest.
    const da = -1.5 * t2 + 2 * t - 0.5;
    const db = 4.5 * t2 - 5 * t;
    const dc = -4.5 * t2 + 4 * t + 0.5;
    const dd = 1.5 * t2 - t;

    const tx = p0.x * da + p1x * db + p2.x * dc + p3.x * dd;
    const ty = p0.y * da + p1y * db + p2.y * dc + p3.y * dd;
    const tz = p0.z * da + p1z * db + p2.z * dc + p3.z * dd;

    outPoint.set(
      p0.x * a + p1x * b + p2.x * c + p3.x * d,
      p0.y * a + p1y * b + p2.y * c + p3.y * d,
      p0.z * a + p1z * b + p2.z * c + p3.z * d,
    );
    const length = Math.hypot(tx, ty, tz);
    if (length < 1e-8) outTangent.set(0, 1, 0);
    else outTangent.set(tx / length, ty / length, tz / length);
  }
}

function write(buffer: Float32Array, index: number, x: number, y: number, z: number): void {
  const o = index * 3;
  buffer[o] = x;
  buffer[o + 1] = y;
  buffer[o + 2] = z;
}

function read(buffer: Float32Array, index: number, out: Vector3): void {
  const o = index * 3;
  out.set(buffer[o] ?? 0, buffer[o + 1] ?? 0, buffer[o + 2] ?? 0);
}

function setNumber(
  uniforms: Record<string, { value: unknown } | undefined>,
  name: string,
  value: number,
): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}
