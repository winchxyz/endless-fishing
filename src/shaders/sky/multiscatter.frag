// Multiple-scattering LUT.
//
// Single scattering alone leaves the sky far too dark: at 550 nm a photon from a low sun has
// scattered several times before it reaches the eye, and the difference is not subtle — it is
// the entire soft blue fill that lights the shadow side of everything on an overcast day.
//
// Hillaire's trick is to assume that after the first bounce the scattering is isotropic and
// spatially uniform in the neighbourhood of the sample. That turns the infinite series of
// bounces into a geometric one:
//
//     L_total = L_2nd * (1 / (1 - f_ms))
//
// where `f_ms` is the fraction of energy that scatters again. Both quantities are integrals
// over the sphere of directions, so each texel fires a small bundle of rays and averages.
//
// The table is only 32x32 because the result is extremely smooth in both parameters, and it is
// rebuilt only when the sun altitude changes by more than a fraction of a degree.

precision highp float;

#include /lib/atmosphere.glsl

varying vec2 vUv;

uniform sampler2D uTransmittanceLut;

// 8x8 directions over the sphere. Enough for a quantity this smooth, and it keeps the whole
// table under 4k ray-marches.
const int SQRT_SAMPLES = 8;
const int STEPS = 20;

void integrateDirection(
    vec3 origin,
    vec3 direction,
    vec3 sunDirection,
    out vec3 secondOrder,
    out vec3 scatteredFraction) {
  secondOrder = vec3(0.0);
  scatteredFraction = vec3(0.0);

  float distanceToGround = raySphereIntersect(origin, direction, GROUND_RADIUS);
  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  float maxDistance = distanceToGround > 0.0 ? distanceToGround : distanceToTop;
  if (maxDistance <= 0.0) return;

  float stepSize = maxDistance / float(STEPS);
  vec3 throughput = vec3(1.0);

  for (int i = 0; i < STEPS; i++) {
    vec3 position = origin + direction * ((float(i) + 0.5) * stepSize);
    float radius = length(position);
    MediumSample medium = sampleMedium(radius);

    vec3 stepTransmittance = exp(-medium.extinction * stepSize);
    vec3 sunTransmittance =
        sampleTransmittance(uTransmittanceLut, radius, dot(normalize(position), sunDirection));

    // Is the sun below the local horizon at this sample?
    float sunVisibility = intersectsGround(position, sunDirection) ? 0.0 : 1.0;

    // Energy-conserving analytic integration of the segment (Hillaire eq. 6): integrating the
    // scattering across the step rather than point-sampling it removes the banding that a
    // 20-step march would otherwise show at the horizon.
    vec3 integratedScattering =
        (medium.scattering - medium.scattering * stepTransmittance) /
        max(vec3(EPS), medium.extinction);

    // Second-order term: sunlight scattered once here, then treated as isotropic.
    secondOrder += throughput * sunTransmittance * sunVisibility * integratedScattering * INV_FOUR_PI;
    // Fraction that will go on to scatter again.
    scatteredFraction += throughput * integratedScattering;

    throughput *= stepTransmittance;
  }

  // Light bounced off the surface below and back up into the medium.
  if (distanceToGround > 0.0) {
    vec3 groundPoint = origin + direction * distanceToGround;
    vec3 groundNormal = normalize(groundPoint);
    float cosSun = dot(groundNormal, sunDirection);
    if (cosSun > 0.0) {
      vec3 groundTransmittance =
          sampleTransmittance(uTransmittanceLut, GROUND_RADIUS, cosSun);
      secondOrder += throughput * groundTransmittance * cosSun * GROUND_ALBEDO * INV_PI;
    }
  }
}

void main() {
  // u maps to the cosine of the sun zenith angle, v to altitude. Both linear: the result is
  // smooth enough that a warp would buy nothing.
  float cosSunZenith = vUv.x * 2.0 - 1.0;
  float radius = mix(GROUND_RADIUS, ATMOSPHERE_RADIUS, vUv.y);

  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 sunDirection = normalize(
      vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0));

  vec3 secondOrderSum = vec3(0.0);
  vec3 scatteredFractionSum = vec3(0.0);

  for (int y = 0; y < SQRT_SAMPLES; y++) {
    for (int x = 0; x < SQRT_SAMPLES; x++) {
      // Uniform on the sphere: cosine is what must be sampled uniformly, not the angle.
      float u = (float(x) + 0.5) / float(SQRT_SAMPLES);
      float v = (float(y) + 0.5) / float(SQRT_SAMPLES);
      float cosTheta = 1.0 - 2.0 * v;
      float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
      float phi = u * TWO_PI;
      vec3 direction = vec3(sinTheta * cos(phi), cosTheta, sinTheta * sin(phi));

      vec3 secondOrder;
      vec3 scatteredFraction;
      integrateDirection(origin, direction, sunDirection, secondOrder, scatteredFraction);
      secondOrderSum += secondOrder;
      scatteredFractionSum += scatteredFraction;
    }
  }

  float sampleCount = float(SQRT_SAMPLES * SQRT_SAMPLES);
  vec3 secondOrder = secondOrderSum / sampleCount;
  vec3 scatteredFraction = scatteredFractionSum / sampleCount;

  // Sum the geometric series. The fraction is physically below 1, but clamp anyway — a single
  // NaN texel here would propagate into every pixel of the sky.
  vec3 series = 1.0 / max(vec3(EPS), 1.0 - min(scatteredFraction, vec3(0.999)));
  gl_FragColor = vec4(secondOrder * series, 1.0);
}
