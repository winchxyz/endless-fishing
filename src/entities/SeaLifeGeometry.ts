import { BufferAttribute, BufferGeometry, ConeGeometry } from 'three';
import { clamp } from '../math/Noise.js';

/**
 * Gulls, cetaceans and the blow, lofted rather than downloaded.
 *
 * Everything here is authored facing **+Z**, with the span along X and up along Y, because that
 * is the frame `birds.vert` flaps in: it rotates about the fore-and-aft axis by an angle that
 * grows as the square of `aWing`, the signed position out along the span. Author a bird along X
 * and the whole flock does the breaststroke.
 *
 * The bodies are bodies of revolution and `uv.y` is taken from the vertical component of the
 * surface normal, which is exactly the countershading mask `birds.frag` wants: dark along the
 * back, pale under the belly, and a soft transition round the flank rather than a painted line.
 * A gull and a minke whale are both countershaded for the same reason, so they get the same
 * treatment and differ only in their colours and their scale.
 */

interface AnimalBuilder {
  readonly position: number[];
  readonly normal: number[];
  readonly uv: number[];
  readonly wing: number[];
  readonly index: number[];
}

function createAnimalBuilder(): AnimalBuilder {
  return { position: [], normal: [], uv: [], wing: [], index: [] };
}

function toAnimalGeometry(builder: AnimalBuilder, flapping: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(builder.position), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(builder.normal), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(builder.uv), 2));
  geometry.setAttribute('aWing', new BufferAttribute(new Float32Array(builder.wing), 1));
  if (!flapping) {
    // Cetaceans do not flap, so their beat parameters are constant per vertex rather than per
    // instance — which is what lets one geometry be shared by the dolphin and the whale meshes.
    const zeros = new Float32Array(builder.wing.length);
    geometry.setAttribute('aPhase', new BufferAttribute(zeros, 1));
    geometry.setAttribute('aRate', new BufferAttribute(zeros, 1));
    geometry.setAttribute('aAmplitude', new BufferAttribute(zeros, 1));
  }
  geometry.setIndex(builder.index);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A body of revolution along +Z, from a radius profile.
 *
 * `uv.y` is taken from the vertical component of the surface normal, which is exactly the
 * countershading mask the fragment shader wants: dark along the back, pale under the belly, and
 * a soft transition along the flank rather than a painted line.
 */
function addBody(
  builder: AnimalBuilder,
  profile: readonly (readonly [number, number])[],
  sides: number,
): void {
  const start = builder.position.length / 3;
  for (const station of profile) {
    const [z, radius] = station;
    for (let i = 0; i <= sides; i += 1) {
      const angle = (i / sides) * Math.PI * 2;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      builder.position.push(nx * radius, ny * radius, z);
      builder.normal.push(nx, ny, 0);
      builder.uv.push(i / sides, ny * 0.5 + 0.5);
      builder.wing.push(0);
    }
  }
  const stride = sides + 1;
  for (let station = 0; station < profile.length - 1; station += 1) {
    for (let i = 0; i < sides; i += 1) {
      const a = start + station * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      builder.index.push(a, c, b, b, c, d);
    }
  }
}

/** A flat card in the XZ plane, used for wings, fins and flukes. */
function addCard(
  builder: AnimalBuilder,
  corners: readonly (readonly [number, number, number])[],
  wings: readonly number[],
  up: readonly [number, number, number],
  v: number,
): void {
  const start = builder.position.length / 3;
  const origin = [0, 0, 0] as const;
  for (let i = 0; i < 4; i += 1) {
    const corner = corners[i] ?? origin;
    builder.position.push(corner[0], corner[1], corner[2]);
    builder.normal.push(up[0], up[1], up[2]);
    builder.uv.push(i < 2 ? 0 : 1, v);
    builder.wing.push(wings[i] ?? 0);
  }
  builder.index.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

/** A herring gull: 0.55 m nose to tail, 1.4 m across. */
export function buildGull(): BufferGeometry {
  const builder = createAnimalBuilder();
  addBody(
    builder,
    [
      [-0.26, 0.012],
      [-0.16, 0.048],
      [-0.02, 0.062],
      [0.12, 0.05],
      [0.22, 0.026],
      [0.29, 0.008],
    ],
    8,
  );

  const half = 0.7;
  for (const side of [-1, 1]) {
    // Swept back and tapering: root chord 0.19 m at the shoulder, 0.07 m at the tip.
    addCard(
      builder,
      [
        [0.03 * side, 0.015, -0.09],
        [0.03 * side, 0.015, 0.1],
        [half * side, 0.015, 0.03],
        [half * side, 0.015, -0.04],
      ],
      [0.04 * side, 0.04 * side, side, side],
      [0, 1, 0],
      0.74,
    );
  }
  // Tail, and a beak stub that reads at fifty metres.
  addCard(
    builder,
    [
      [-0.05, 0.012, 0.2],
      [0.05, 0.012, 0.2],
      [0.07, 0.012, 0.32],
      [-0.07, 0.012, 0.32],
    ],
    [0, 0, 0, 0],
    [0, 1, 0],
    0.7,
  );
  return toAnimalGeometry(builder, true);
}

/** A fusiform cetacean, one unit long, with a dorsal and flukes. Scaled per animal. */
export function buildCetacean(): BufferGeometry {
  const builder = createAnimalBuilder();
  addBody(
    builder,
    [
      [-0.5, 0.01],
      [-0.34, 0.055],
      [-0.1, 0.098],
      [0.14, 0.088],
      [0.34, 0.045],
      [0.5, 0.012],
    ],
    10,
  );
  // Dorsal fin, raked aft, and the flukes, which are horizontal on a cetacean and are the single
  // clearest tell that it is not a fish.
  addCard(
    builder,
    [
      [0, 0.08, -0.12],
      [0, 0.08, 0.02],
      [0, 0.2, -0.02],
      [0, 0.19, -0.11],
    ],
    [0, 0, 0, 0],
    [1, 0, 0],
    0.95,
  );
  addCard(
    builder,
    [
      [-0.22, 0, -0.62],
      [0.22, 0, -0.62],
      [0.05, 0, -0.44],
      [-0.05, 0, -0.44],
    ],
    [0, 0, 0, 0],
    [0, 1, 0],
    0.85,
  );
  return toAnimalGeometry(builder, false);
}

/** The blow: a column of vapour, brightest at the blowhole and dissolving upwards. */
export function buildSpout(): BufferGeometry {
  const cone = new ConeGeometry(0.55, 3.4, 10, 4, true);
  cone.translate(0, 1.7, 0);
  const position = cone.getAttribute('position');
  const colours = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i += 1) {
    const along = clamp(position.getY(i) / 3.4, 0, 1);
    const alpha = (1 - along) ** 1.6 * (0.35 + 0.65 * along);
    colours[i * 4] = 0.92;
    colours[i * 4 + 1] = 0.95;
    colours[i * 4 + 2] = 1;
    colours[i * 4 + 3] = alpha;
  }
  cone.setAttribute('color', new BufferAttribute(colours, 4));
  cone.computeBoundingSphere();
  return cone;
}
