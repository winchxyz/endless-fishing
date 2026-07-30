// Sky-view LUT.
//
// The full radiance of the sky, for the current sun altitude, over every view direction — in a
// 192x108 table. Rebuilt every frame the sun moves measurably, which at 1x time scale is
// roughly once a second; at 3600x it is every frame and still costs under 0.1 ms.
//
// Azimuth is stored *relative to the sun*, so the table stays valid as the sun sweeps around
// the compass and only has to be rebuilt when its altitude changes.
//
// Earth's shadow and the Belt of Venus are not special-cased anywhere. They appear because,
// looking east at dusk, the samples along the lower part of the view ray have the sun below
// their own local horizon and contribute nothing, while the samples higher up still catch it —
// so the sky separates into a dark blue-grey band with a pink one above it, at exactly the
// right elevation, on its own.

precision highp float;

#include /lib/atmosphere.glsl

varying vec2 vUv;

uniform sampler2D uTransmittanceLut;
uniform sampler2D uMultiScatterLut;
/** Sun direction in the local frame: +Y is up, and the sun is placed at azimuth 0. */
uniform vec3 uSunDirection;
/** Observer altitude above sea level, kilometres. */
uniform float uAltitudeKm;
uniform int uSteps;

vec3 sampleMultiScatter(float radius, float cosSunZenith) {
  vec2 uv = vec2(
      cosSunZenith * 0.5 + 0.5,
      clamp((radius - GROUND_RADIUS) / (ATMOSPHERE_RADIUS - GROUND_RADIUS), 0.0, 1.0));
  // Explicit level 0: called from inside the march, and the table has no mip chain.
  return texture2DLodEXT(uMultiScatterLut, uv, 0.0).rgb;
}

void main() {
  float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);

  float cosViewZenith;
  float azimuth;
  bool hitsGround;
  skyViewParams(vUv, radius, cosViewZenith, azimuth, hitsGround);

  float sinViewZenith = sqrt(max(0.0, 1.0 - cosViewZenith * cosViewZenith));
  vec3 viewDirection =
      vec3(sinViewZenith * sin(azimuth), cosViewZenith, -sinViewZenith * cos(azimuth));
  vec3 origin = vec3(0.0, radius, 0.0);

  float distanceToGround = raySphereIntersect(origin, viewDirection, GROUND_RADIUS);
  float distanceToTop = raySphereIntersect(origin, viewDirection, ATMOSPHERE_RADIUS);
  float maxDistance = distanceToGround > 0.0 ? distanceToGround : distanceToTop;
  if (maxDistance <= 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float cosSunView = dot(viewDirection, uSunDirection);
  float rayleighWeight = rayleighPhase(cosSunView);
  float mieWeight = miePhase(cosSunView, MIE_ASYMMETRY);

  vec3 luminance = vec3(0.0);
  vec3 throughput = vec3(1.0);

  float steps = float(uSteps);
  for (int i = 0; i < 64; i++) {
    if (i >= uSteps) break;

    // Quadratic step distribution: the first few kilometres hold nearly all the aerosol and
    // most of the Rayleigh density, so linear steps waste samples on empty upper atmosphere.
    float t0 = float(i) / steps;
    float t1 = float(i + 1) / steps;
    t0 *= t0;
    t1 *= t1;
    float segmentStart = t0 * maxDistance;
    float segmentEnd = min(t1 * maxDistance, maxDistance);
    float stepSize = segmentEnd - segmentStart;
    if (stepSize <= 0.0) continue;

    vec3 position = origin + viewDirection * (segmentStart + stepSize * 0.5);
    float sampleRadius = length(position);
    vec3 up = position / sampleRadius;
    float cosSunZenith = dot(up, uSunDirection);

    MediumSample medium = sampleMedium(sampleRadius);
    vec3 stepTransmittance = exp(-medium.extinction * stepSize);
    vec3 sunTransmittance = sampleTransmittance(uTransmittanceLut, sampleRadius, cosSunZenith);
    float sunVisibility = intersectsGround(position, uSunDirection) ? 0.0 : 1.0;

    // Phase-weighted single scattering, plus the isotropic multiple-scattering term.
    vec3 singleScatter =
        (medium.rayleigh * rayleighWeight + vec3(medium.mie * mieWeight)) *
        sunTransmittance * sunVisibility;
    vec3 multiScatter = medium.scattering * sampleMultiScatter(sampleRadius, cosSunZenith);

    vec3 inScatter = singleScatter + multiScatter;
    // Analytic integration across the segment — see the note in multiscatter.frag.
    vec3 integrated =
        (inScatter - inScatter * stepTransmittance) / max(vec3(EPS), medium.extinction);

    luminance += throughput * integrated;
    throughput *= stepTransmittance;
  }

  // Light reflected off the sea and back towards the eye when the ray hits the surface.
  if (distanceToGround > 0.0) {
    vec3 groundPoint = origin + viewDirection * distanceToGround;
    vec3 groundNormal = normalize(groundPoint);
    float cosSun = dot(groundNormal, uSunDirection);
    if (cosSun > 0.0) {
      vec3 groundTransmittance = sampleTransmittance(uTransmittanceLut, GROUND_RADIUS, cosSun);
      luminance += throughput * groundTransmittance * cosSun * GROUND_ALBEDO * INV_PI;
    }
  }

  gl_FragColor = vec4(luminance, 1.0);
}
