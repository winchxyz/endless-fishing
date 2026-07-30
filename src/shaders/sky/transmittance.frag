// Transmittance LUT.
//
// For every (altitude, sun zenith angle) pair, the fraction of light that survives the trip
// from that point to the top of the atmosphere. This table depends only on the medium, never
// on the sun, so it is built once at startup and never touched again.
//
// 40 steps is generous; it is paid once.

precision highp float;

#include /lib/atmosphere.glsl

varying vec2 vUv;

const int STEPS = 40;

void main() {
  float radius;
  float cosSunZenith;
  transmittanceParams(vUv, radius, cosSunZenith);
  gl_FragColor = vec4(computeTransmittance(radius, cosSunZenith, STEPS), 1.0);
}
