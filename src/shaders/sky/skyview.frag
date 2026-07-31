// Sky-view LUT.
//
// The full radiance of the sky, for the current sun altitude, over every view direction — in a
// 384x216 table. Rebuilt every frame the sun moves measurably, which at 1x time scale is
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

/**
 * How far the sun stands above this point's own local horizon, as a difference of cosines.
 *
 * Positive means the point is in sunlight. The horizon is depressed below level by the point's
 * altitude, which is why a sample thirty kilometres up is still lit when the ground beneath it
 * is not — and it is that difference, integrated up the view ray, that draws the Earth's shadow.
 */
float sunElevationAbove(vec3 position, vec3 sunDirection) {
  float radius = length(position);
  float horizonCos =
      -sqrt(max(0.0, 1.0 - (GROUND_RADIUS * GROUND_RADIUS) / (radius * radius)));
  return dot(position / radius, sunDirection) - horizonCos;
}

/**
 * The fraction of a march segment that is in sunlight, computed exactly rather than sampled.
 *
 * This is the whole of the twilight banding fix, and it is worth being precise about why the
 * obvious version does not work. Testing `intersectsGround` at the segment's midpoint makes each
 * segment all-lit or all-shadowed, so the integral jumps by one whole segment's contribution the
 * moment the Earth's shadow moves past a midpoint. Tilt the view ray a fraction of a degree and
 * the crossing lands on a different segment: the sky comes out in flat blocks, thirty of them up
 * the dome, with the block edges on the table's own texel grid. It survives a four-times-larger
 * table, a four-times-larger multiple-scattering table, manual bilinear filtering and an output
 * dither, because the quantity being filtered is itself a staircase.
 *
 * Softening the test with a fixed-width `smoothstep` does not work either: the segments are
 * quadratically distributed and span anything from a few hundred metres to tens of kilometres, so
 * one width is far too wide for the near ones and far too narrow for the far ones — which shifts
 * the balance between the reddened low samples and the blue high ones and turns the whole sky
 * orange.
 *
 * The elevation above the local horizon is very nearly linear across one segment, so the lit
 * fraction is just where that line crosses zero. That is the exact integral of the step function
 * over the segment: no bias, no width to tune, and it scales with the segment automatically.
 */
float sunlitFraction(vec3 start, vec3 end, vec3 sunDirection) {
  float a = sunElevationAbove(start, sunDirection);
  float b = sunElevationAbove(end, sunDirection);
  float delta = b - a;
  // Wholly inside or wholly outside the shadow, which is almost every segment.
  if (abs(delta) < 1e-9) return a >= 0.0 ? 1.0 : 0.0;
  float crossing = clamp(-a / delta, 0.0, 1.0);
  return delta > 0.0 ? 1.0 - crossing : crossing;
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
    float sunVisibility = sunlitFraction(
        origin + viewDirection * segmentStart, origin + viewDirection * segmentEnd,
        uSunDirection);
    vec3 up = position / sampleRadius;
    float cosSunZenith = dot(up, uSunDirection);

    MediumSample medium = sampleMedium(sampleRadius);
    vec3 stepTransmittance = exp(-medium.extinction * stepSize);
    vec3 sunTransmittance = sampleTransmittance(uTransmittanceLut, sampleRadius, cosSunZenith);

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
