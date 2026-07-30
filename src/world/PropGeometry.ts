import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The furniture of a working coast, lofted from primitives.
 *
 * Nothing here is modelled for its own sake. A lighthouse is a tapered tower because a tapered
 * tower is what survives a winter gale on a rock; a bell buoy has a lattice cage because that is
 * where the bell hangs and how it is serviced; a jetty's pilings are longer than they look
 * because they have to reach the bottom at low water. The proportions come from photographs of
 * Northern Lighthouse Board and Trinity House stations, and everything is authored in metres at
 * true scale so the tide band on `prop.frag` lands where it should without a fudge factor.
 *
 * Every builder returns geometry authored around its own working origin: **y = 0 is mean water**
 * for anything that stands in the sea, and the object faces **+Z**, which is the direction the
 * placement yaw rotates towards. Getting those two conventions wrong is how a jetty ends up
 * pointing inland and a wreck ends up flying.
 */

/** Height of the lantern's focal plane above mean water, metres. The beam pivots here. */
export const LIGHTHOUSE_LENS_HEIGHT_M = 21.2;
/** Length of the visible beam shaft, metres. Beyond this the haze has eaten it anyway. */
export const BEAM_LENGTH_M = 420;
/** Half-angle of the beam, radians. A real first-order lens is a narrow, hard-edged fan. */
export const BEAM_HALF_ANGLE = 0.055;

interface Placement {
  x?: number;
  y?: number;
  z?: number;
  /** Rotations are applied X, then Y, then Z, before the translation. */
  rx?: number;
  ry?: number;
  rz?: number;
}

/** Move a primitive into place. Baking the transform is what lets the parts merge. */
function at(geometry: BufferGeometry, place: Placement): BufferGeometry {
  if (place.rx !== undefined) geometry.rotateX(place.rx);
  if (place.ry !== undefined) geometry.rotateY(place.ry);
  if (place.rz !== undefined) geometry.rotateZ(place.rz);
  geometry.translate(place.x ?? 0, place.y ?? 0, place.z ?? 0);
  return geometry;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (merged === null) throw new Error('PropGeometry: parts could not be merged');
  merged.computeBoundingSphere();
  return merged;
}

/**
 * The tower: plinth, shaft and gallery floor. Whitewashed masonry, no ironwork.
 *
 * Split from the lantern because `prop.frag` takes one tint per instance, and a painted tower
 * and a black-leaded lantern are not one material by any reading. Two instanced meshes sharing
 * one set of instance matrices costs a draw call and is the honest way to do it.
 */
export function buildLighthouseTower(): BufferGeometry {
  return merge([
    at(new CylinderGeometry(4.3, 5.2, 3.2, 20), { y: 1.6 }),
    at(new CylinderGeometry(2.15, 3.7, 16.6, 20), { y: 11.5 }),
    at(new CylinderGeometry(3.2, 3.2, 0.55, 20), { y: 20.05 }),
    // The doorway surround, which is the one thing that gives the tower a scale to read against.
    at(new BoxGeometry(1.5, 2.4, 0.5), { y: 4.4, z: 3.35 }),
  ]);
}

/** Gallery rail, lantern frame and roof — everything black and made of iron. */
export function buildLighthouseLantern(): BufferGeometry {
  const parts: BufferGeometry[] = [
    at(new TorusGeometry(3.1, 0.07, 6, 24), { rx: Math.PI / 2, y: 21.4 }),
    at(new CylinderGeometry(1.95, 1.95, 0.18, 16), { y: 20.4 }),
    at(new ConeGeometry(2.3, 1.9, 16), { y: 23.6 }),
    // The ventilator ball on the apex. Every one of these towers has one.
    at(new SphereGeometry(0.34, 10, 8), { y: 24.8 }),
  ];
  // Astragals: the vertical glazing bars of the lantern room.
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    parts.push(
      at(new BoxGeometry(0.11, 3.0, 0.11), {
        x: Math.cos(angle) * 1.9,
        y: LIGHTHOUSE_LENS_HEIGHT_M + 0.9,
        z: Math.sin(angle) * 1.9,
        ry: -angle,
      }),
    );
  }
  return merge(parts);
}

/**
 * A bell buoy: a float, a counterweighted skirt, a lattice cage and the bell in it.
 *
 * The skirt below the waterline is not decoration — it is the ballast that gives the buoy a
 * righting moment and a roll period of a few seconds, which is the period the bell rings at.
 */
export function buildBellBuoy(): BufferGeometry {
  const parts: BufferGeometry[] = [
    at(new CylinderGeometry(1.05, 1.15, 1.8, 14), { y: 0.25 }),
    at(new ConeGeometry(1.15, 2.2, 14), { rz: Math.PI, y: -1.75 }),
    at(new TorusGeometry(0.78, 0.06, 5, 14), { rx: Math.PI / 2, y: 3.15 }),
    // The bell, mouth down, hung in the cage. A cone is already apex-up, which is the way a
    // bell hangs, so it needs no flip — and getting that backwards is easy to miss on a
    // silhouette this small.
    at(new ConeGeometry(0.44, 0.66, 12, 1, true), { y: 2.05 }),
    at(new SphereGeometry(0.11, 8, 6), { y: 1.66 }),
  ];
  for (let i = 0; i < 4; i += 1) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(
      at(new BoxGeometry(0.1, 2.4, 0.1), {
        x: Math.cos(angle) * 0.78,
        y: 2.0,
        z: Math.sin(angle) * 0.78,
      }),
    );
  }
  return merge(parts);
}

/**
 * A jetty running seaward along +Z.
 *
 * The pilings are seven metres long and stand on the bottom, which is why the deck stays put
 * while the tide runs up and down it. `prop.frag`'s splash line does the rest: the collar of weed
 * on each pile is under water at half flood and dripping at low water.
 */
export function buildJetty(): BufferGeometry {
  const parts: BufferGeometry[] = [at(new BoxGeometry(2.8, 0.28, 23), { y: 1.55, z: 11 })];
  for (let bay = 0; bay < 5; bay += 1) {
    const z = 1.6 + bay * 5;
    for (const side of [-1, 1]) {
      parts.push(at(new CylinderGeometry(0.17, 0.2, 7.4, 8), { x: side * 1.2, y: -2.3, z }));
      parts.push(at(new BoxGeometry(0.12, 1.0, 0.12), { x: side * 1.28, y: 2.2, z }));
    }
    parts.push(at(new BoxGeometry(2.9, 0.22, 0.22), { y: 2.62, z }));
  }
  return merge(parts);
}

/**
 * A hull that did not make it, lying over on a shoal.
 *
 * Broken open at the deck so the frames show — a wreck read from outside is a boat-shaped rock,
 * and the ribs are the whole reason it reads as a wreck instead.
 */
export function buildWreck(): BufferGeometry {
  const parts: BufferGeometry[] = [
    // Half a cylinder is a surprisingly good garboard once it is heeled over.
    at(new CylinderGeometry(2.4, 1.5, 13, 10, 1, true, 0, Math.PI), { rx: Math.PI / 2, y: 0.4 }),
    at(new BoxGeometry(3.6, 2.4, 0.3), { y: 0.5, z: -6.4, rx: 0.2 }),
    at(new CylinderGeometry(0.13, 0.19, 6.5, 6), { rx: 0.35, y: 2.6, z: 1.2 }),
  ];
  for (let rib = 0; rib < 6; rib += 1) {
    const z = -4.4 + rib * 1.9;
    const reach = 2.3 - Math.abs(z) * 0.09;
    parts.push(at(new TorusGeometry(reach, 0.09, 5, 10, Math.PI), { z, y: 0.3 }));
  }
  // Heeled and down by the head, which is how a hull ends up when it drives onto a shoal.
  const merged = merge(parts);
  merged.rotateZ(0.42);
  merged.rotateX(-0.12);
  merged.computeBoundingSphere();
  return merged;
}

/** A sea arch: a stack the sea has bored straight through. */
export function buildSeaArch(): BufferGeometry {
  return merge([
    at(new TorusGeometry(9, 2.7, 7, 16, Math.PI), { y: 0.5 }),
    at(new CylinderGeometry(3.3, 4.4, 6, 9), { x: -9, y: -2.4 }),
    at(new CylinderGeometry(3.3, 4.4, 6, 9), { x: 9, y: -2.4 }),
    at(new SphereGeometry(2.2, 8, 6), { x: -2.4, y: 10.6, z: 0.6 }),
  ]);
}

/** A crate that went over the side of something. Floats about a third out of the water. */
export function buildCrate(): BufferGeometry {
  const parts: BufferGeometry[] = [at(new BoxGeometry(0.92, 0.72, 0.92), { y: 0.12 })];
  for (const y of [-0.14, 0.38]) {
    parts.push(at(new BoxGeometry(0.98, 0.08, 0.98), { y }));
  }
  return merge(parts);
}

/** A bottle, corked, riding almost awash. */
export function buildBottle(): BufferGeometry {
  return merge([
    at(new CylinderGeometry(0.055, 0.062, 0.24, 10), { rx: Math.PI / 2, y: 0.02 }),
    at(new CylinderGeometry(0.022, 0.038, 0.11, 8), { rx: Math.PI / 2, y: 0.02, z: 0.17 }),
    at(new SphereGeometry(0.024, 6, 5), { y: 0.02, z: 0.225 }),
  ]);
}

/**
 * The visible shaft of the beam: a narrow cone with the apex at the lens, running along +Z.
 *
 * A real beam is only visible because there is something in the air for it to scatter off, so
 * this is drawn additively and faded along its length, and the system scales its brightness with
 * the haze. On a clear night it is almost nothing and on a wet one it is a solid bar of light,
 * which is exactly the behaviour that makes it read as light rather than as a cone.
 *
 * Alpha lives in a four-component colour attribute; three switches on `USE_COLOR_ALPHA` for that
 * and a `MeshBasicMaterial` then carries the fade with no shader of its own.
 */
export function buildBeamShaft(): BufferGeometry {
  const radius = Math.tan(BEAM_HALF_ANGLE) * BEAM_LENGTH_M;
  const cone = new ConeGeometry(radius, BEAM_LENGTH_M, 18, 6, true);
  cone.translate(0, -BEAM_LENGTH_M / 2, 0);
  cone.rotateX(-Math.PI / 2);

  const position = cone.getAttribute('position');
  const colours = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i += 1) {
    const along = Math.min(1, Math.max(0, position.getZ(i) / BEAM_LENGTH_M));
    // Inverse-square along the shaft, plus a soft nose so the far end dissolves rather than
    // ending in a visible disc of light hanging in mid-air.
    const falloff = (1 - along) ** 2 * (1 - along * along * along);
    colours[i * 4] = 1;
    colours[i * 4 + 1] = 0.94;
    colours[i * 4 + 2] = 0.82;
    colours[i * 4 + 3] = falloff;
  }
  cone.setAttribute('color', new BufferAttribute(colours, 4));
  cone.computeBoundingSphere();
  return cone;
}
