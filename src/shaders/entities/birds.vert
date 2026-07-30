// Instanced seabirds and cetaceans.
//
// The flock's *positions* are a boids solve on the CPU — that has to be, because the birds
// react to the wind vector and to where the fish are, and neither is something the GPU knows.
// What lives here is the wingbeat, because that is per-vertex work on identical geometry and
// pushing sixty flapping gulls through a CPU skinning path to save one shader would be the
// wrong trade in every direction.
//
// The wing rotates about the bird's fore-and-aft axis, by an angle that grows as the square of
// the distance out along the span. A wing that rotates rigidly looks like a paper aeroplane;
// the real thing bends, most at the tip, and the square is close enough to the truth that the
// difference is invisible at any range you see a gull from a boat.

precision highp float;

#include /lib/constants.glsl

/** Signed position along the span: −1 left tip, 0 at the spine, +1 right tip. */
attribute float aWing;
/** Per-instance wingbeat phase, radians. */
attribute float aPhase;
/** Per-instance beat rate in radians per second, and stroke amplitude in radians. */
attribute float aRate;
attribute float aAmplitude;

uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vSpan;
varying float vViewDistance;

void main() {
  float span = abs(aWing);
  float stroke = aAmplitude * sin(uTime * aRate + aPhase) * span * span;
  float angle = aWing >= 0.0 ? stroke : -stroke;

  float s = sin(angle);
  float c = cos(angle);
  vec3 local = vec3(position.x * c - position.y * s, position.x * s + position.y * c, position.z);
  vec3 localNormal = vec3(normal.x * c - normal.y * s, normal.x * s + normal.y * c, normal.z);

  #ifdef USE_INSTANCING
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * mat3(instanceMatrix) * localNormal;
  #else
    vec4 world = modelMatrix * vec4(local, 1.0);
    vec3 worldNormal = mat3(modelMatrix) * localNormal;
  #endif

  vWorldPosition = world.xyz;
  vNormal = normalize(worldNormal);
  vUv = uv;
  vSpan = span;
  vViewDistance = distance(world.xyz, cameraPosition);

  gl_Position = projectionMatrix * viewMatrix * world;
}
