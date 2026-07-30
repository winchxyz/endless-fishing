// Physical atmosphere: participating medium, phase functions and the scattering integral.
//
// This is Hillaire's formulation ("A Scalable and Production Ready Sky and Atmosphere
// Rendering Technique", EGSR 2020), which is Bruneton's precomputed-scattering model
// restructured around three small look-up tables that can all be rebuilt in a fraction of a
// millisecond. Nothing here is a gradient or an artist curve: the colour of the sky at any
// moment falls out of the medium parameters and the real solar altitude.
//
// Two details are what buy the money shots:
//
//   * **Ozone.** It absorbs in the Chappuis band, in the green-orange, and it sits in a layer
//     around 25 km. At noon its contribution is negligible. At twilight, when the light path
//     runs almost horizontally through that layer for hundreds of kilometres, it is what turns
//     the zenith deep blue instead of the muddy brown a Rayleigh-only model produces. Skipping
//     it is the single most common reason a "physical" sky still looks wrong at dusk.
//
//   * **Multiple scattering.** Single scattering alone leaves the sky far too dark near the
//     horizon and kills the soft fill light that makes an overcast afternoon read correctly.
//     The 32x32 multi-scattering LUT is cheap and does most of the work.
//
// Earth's shadow and the Belt of Venus are not drawn — they emerge, because the shadow is
// simply where the transmittance to the sun has gone to zero along the view ray.
//
// All lengths are in kilometres. All scattering coefficients are per kilometre.

#ifndef ENDLESS_FISHING_ATMOSPHERE
#define ENDLESS_FISHING_ATMOSPHERE

#include /lib/constants.glsl

const float GROUND_RADIUS = 6360.0;
const float ATMOSPHERE_RADIUS = 6460.0;

// Rayleigh: Bruneton's fitted values for a standard atmosphere, at 680/550/440 nm.
const vec3 RAYLEIGH_SCATTERING = vec3(5.802, 13.558, 33.100) * 1e-3;
const float RAYLEIGH_SCALE_HEIGHT = 8.0;

// Mie: aerosol haze near the surface. Extinction exceeds scattering because aerosols absorb.
const float MIE_SCATTERING = 3.996e-3;
const float MIE_EXTINCTION = 4.400e-3;
const float MIE_SCALE_HEIGHT = 1.2;
// Forward-scattering asymmetry. 0.8 is the standard continental-aerosol value and is what
// produces the bright aureole around a low sun and the glow of a sun disc seen through fog.
const float MIE_ASYMMETRY = 0.8;

// Ozone: pure absorption, no scattering, distributed as a tent centred at 25 km.
const vec3 OZONE_ABSORPTION = vec3(0.650, 1.881, 0.085) * 1e-3;
const float OZONE_CENTRE = 25.0;
const float OZONE_HALF_WIDTH = 15.0;

// Reflectance of the surface below, feeding the multiple-scattering term. Open water is dark
// — around 0.06 at normal incidence — and that darkness is a big part of why a sea horizon
// looks different from a land one.
const vec3 GROUND_ALBEDO = vec3(0.06, 0.07, 0.08);

struct MediumSample {
  vec3 scattering;   // Rayleigh + Mie, in-scattering coefficient
  vec3 extinction;   // scattering + absorption
  vec3 rayleigh;     // Rayleigh scattering alone, for the phase-weighted split
  float mie;         // Mie scattering alone
};

MediumSample sampleMedium(float radius) {
  float altitude = max(0.0, radius - GROUND_RADIUS);

  float rayleighDensity = exp(-altitude / RAYLEIGH_SCALE_HEIGHT);
  float mieDensity = exp(-altitude / MIE_SCALE_HEIGHT);
  float ozoneDensity = max(0.0, 1.0 - abs(altitude - OZONE_CENTRE) / OZONE_HALF_WIDTH);

  MediumSample medium;
  medium.rayleigh = RAYLEIGH_SCATTERING * rayleighDensity;
  medium.mie = MIE_SCATTERING * mieDensity;
  medium.scattering = medium.rayleigh + vec3(medium.mie);
  medium.extinction =
      medium.rayleigh + vec3(MIE_EXTINCTION * mieDensity) + OZONE_ABSORPTION * ozoneDensity;
  return medium;
}

// Rayleigh phase: symmetric, mildly favouring forward and backward.
float rayleighPhase(float cosTheta) {
  return 3.0 / (16.0 * PI) * (1.0 + cosTheta * cosTheta);
}

// Cornette-Shanks approximation to Mie. Strongly forward-peaked; this is the function that
// makes the sky brighten towards the sun rather than being uniformly blue.
float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float numerator = 3.0 * (1.0 - g2) * (1.0 + cosTheta * cosTheta);
  float denominator = 8.0 * PI * (2.0 + g2) * pow(max(0.0, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
  return numerator / denominator;
}

// Distance from `origin` along `direction` to a sphere of the given radius centred on the
// origin of the planet frame. Returns -1 when there is no forward hit. The quadratic is
// arranged to avoid catastrophic cancellation for the near root, which matters because the
// view ray is grazing the atmosphere shell for most of the visible sky.
float raySphereIntersect(vec3 origin, vec3 direction, float radius) {
  float b = dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  if (c > 0.0 && b > 0.0) return -1.0;
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float sqrtDiscriminant = sqrt(discriminant);
  float near = -b - sqrtDiscriminant;
  float far = -b + sqrtDiscriminant;
  return near < 0.0 ? far : near;
}

// True when the view ray from `origin` hits the planet before leaving the atmosphere.
bool intersectsGround(vec3 origin, vec3 direction) {
  return raySphereIntersect(origin, direction, GROUND_RADIUS) > 0.0;
}

// ---------------------------------------------------------------- transmittance LUT mapping
//
// Parameterised on (cos of the sun zenith angle, altitude), both mapped to [0,1] with a
// square-root warp on altitude so the dense lower atmosphere gets most of the texels.

vec2 transmittanceUv(float radius, float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS));

  float discriminant =
      radius * radius * (cosSunZenith * cosSunZenith - 1.0) +
      ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS;
  float d = max(0.0, -radius * cosSunZenith + sqrt(max(0.0, discriminant)));

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  return vec2((d - dMin) / max(EPS, dMax - dMin), rho / max(EPS, h));
}

void transmittanceParams(vec2 uv, out float radius, out float cosSunZenith) {
  float h = sqrt(max(0.0, ATMOSPHERE_RADIUS * ATMOSPHERE_RADIUS - GROUND_RADIUS * GROUND_RADIUS));
  float rho = h * uv.y;
  radius = sqrt(rho * rho + GROUND_RADIUS * GROUND_RADIUS);

  float dMin = ATMOSPHERE_RADIUS - radius;
  float dMax = rho + h;
  float d = dMin + uv.x * (dMax - dMin);
  cosSunZenith = d == 0.0
      ? 1.0
      : (h * h - rho * rho - d * d) / (2.0 * radius * d);
  cosSunZenith = clamp(cosSunZenith, -1.0, 1.0);
}

/**
 * Explicit LOD rather than a plain fetch.
 *
 * This is called from inside the ray-march loops, and an implicit-derivative fetch in a loop
 * with a varying iteration count makes the compiler warn that the derivatives are undefined —
 * correctly, because neighbouring fragments in a quad may take different numbers of steps.
 * The look-up tables have no mip chain anyway, so level 0 is not a compromise, it is the only
 * meaningful level.
 */
vec3 sampleTransmittance(sampler2D lut, float radius, float cosSunZenith) {
  return texture2DLodEXT(lut, transmittanceUv(radius, cosSunZenith), 0.0).rgb;
}

// Optical depth integrated from a point out to the top of the atmosphere along the sun
// direction. Only used to *build* the transmittance LUT; everything else samples the LUT.
vec3 computeTransmittance(float radius, float cosSunZenith, int steps) {
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = vec3(sqrt(max(0.0, 1.0 - cosSunZenith * cosSunZenith)), cosSunZenith, 0.0);

  float distanceToTop = raySphereIntersect(origin, direction, ATMOSPHERE_RADIUS);
  if (distanceToTop < 0.0) return vec3(1.0);

  float stepSize = distanceToTop / float(steps);
  vec3 opticalDepth = vec3(0.0);
  for (int i = 0; i < steps; i++) {
    // Midpoint rule: markedly more accurate than sampling the segment start for the same cost.
    float t = (float(i) + 0.5) * stepSize;
    MediumSample medium = sampleMedium(length(origin + direction * t));
    opticalDepth += medium.extinction * stepSize;
  }
  return exp(-opticalDepth);
}

// --------------------------------------------------------------- sky-view LUT mapping
//
// u wraps the azimuth around the view. v is warped so half the texels sit within a few degrees
// of the horizon, where the gradient is steepest and where a linear mapping bands visibly over
// open water. The `sqrt(abs())` warp is Hillaire's; the sign split keeps it continuous.

vec2 skyViewUv(float radius, float cosViewZenith, float azimuth, bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));
  float viewZenithAngle = acos(clamp(cosViewZenith, -1.0, 1.0));
  // Angle measured from the horizon, positive upwards.
  float angleFromHorizon = horizonAngle - viewZenithAngle;

  float v;
  if (!hitsGround) {
    float t = sqrt(max(0.0, angleFromHorizon / max(EPS, horizonAngle)));
    v = 0.5 + 0.5 * t;
  } else {
    float t = sqrt(max(0.0, -angleFromHorizon / max(EPS, PI - horizonAngle)));
    v = 0.5 - 0.5 * t;
  }
  return vec2(azimuth / TWO_PI, clamp(v, 0.0, 1.0));
}

void skyViewParams(
    vec2 uv, float radius, out float cosViewZenith, out float azimuth, out bool hitsGround) {
  float horizonCos = sqrt(max(0.0, radius * radius - GROUND_RADIUS * GROUND_RADIUS)) / radius;
  float horizonAngle = acos(clamp(horizonCos, -1.0, 1.0));

  float viewZenithAngle;
  if (uv.y > 0.5) {
    float t = (uv.y - 0.5) * 2.0;
    viewZenithAngle = horizonAngle - t * t * horizonAngle;
    hitsGround = false;
  } else {
    float t = (0.5 - uv.y) * 2.0;
    viewZenithAngle = horizonAngle + t * t * (PI - horizonAngle);
    hitsGround = true;
  }
  cosViewZenith = cos(viewZenithAngle);
  azimuth = uv.x * TWO_PI;
}

#endif
