// The fishing line.
//
// The tube is relaxed and swept on the CPU every frame — see `entities/FishingLine.ts` — and it
// is built directly in **world space**, because its two ends are owned by two different objects
// (the rod tip on a boat that is pitching, and a float that is doing its own buoyancy) and there
// is no single local frame both of them live in. So there is no model transform to apply here;
// applying `modelMatrix` would transform an already-transformed point.

precision highp float;

/** Unit tangent of the curve at this vertex. The whole shading model is built about it. */
attribute vec3 aTangent;
/** 0 at the rod tip, 1 at the float. */
attribute float aAlong;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying float vAlong;
varying float vViewDistance;

void main() {
  vWorldPosition = position;
  vNormal = normalize(normal);
  vTangent = normalize(aTangent);
  vAlong = aAlong;
  vViewDistance = distance(position, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
