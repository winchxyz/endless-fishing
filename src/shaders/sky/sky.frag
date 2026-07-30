// Sky dome fragment shader.
//
// Composites, in this order:
//   1. the analytic sky-view LUT (physical scattering, real solar altitude);
//   2. the selected HDRI panorama, rotated so its baked sun sits on the real solar azimuth,
//      with its baked sun blob suppressed and its exposure matched to the analytic sky;
//   3. the solar disc, limb-darkened and flattened by differential refraction;
//   4. the lunar disc, shaded by the true sub-solar direction over a real NASA albedo map,
//      with libration, Lommel-Seeliger limb behaviour and earthshine.
//
// The HDRI never supplies the sun. Its bright spot is compressed away and the disc is drawn
// analytically on top, so the highlight, the specular path on the water and the shadow
// direction all come from the same ephemeris. That alignment is the whole point of the
// exercise; a two-degree mismatch between them is instantly visible and instantly cheap-looking.

precision highp float;

#include /lib/constants.glsl
#include /lib/atmosphere.glsl

varying vec3 vViewRay;

uniform sampler2D uSkyViewLut;
uniform sampler2D uTransmittanceLut;

// --- HDRI ---------------------------------------------------------------------------------
//
// The panorama contributes *structure*, never absolute level.
//
// Each one is divided by its own mean luminance, which makes it a dimensionless field with an
// average of 1 — cloud shapes, breaks and banding, with the exposure of the day it happened to
// be shot on removed. That field then multiplies the analytic sky. So the absolute luminance,
// the twilight colour and the horizon gradient all stay physically driven by the real solar
// altitude, exactly as they should, while the clouds come from a photograph of real clouds.
//
// It also means a sky shot at noon in South Africa can legitimately be used at dusk in the
// North Sea: only its shapes survive the normalisation.
uniform sampler2D uHdriA;
uniform sampler2D uHdriB;
/** Cross-fade between the two altitude-bracketing skies. */
uniform float uHdriBlend;
/** Radians to rotate each panorama so its baked sun lands on the real solar azimuth. */
uniform float uHdriRotationA;
uniform float uHdriRotationB;
/** Reciprocal of each panorama's mean luminance, measured at load. */
uniform float uHdriInvMeanA;
uniform float uHdriInvMeanB;
/** How much structure the panorama contributes. Low on a clear day, high under stratus. */
uniform float uHdriWeight;
/**
 * How much to flatten the analytic sky's sun-facing gradient towards its zenith value.
 * A real stratus deck scatters the directional cue away almost completely; a clear sky keeps
 * all of it. Driven by the weather system's cloud fraction.
 */
uniform float uCloudiness;

// --- celestial ----------------------------------------------------------------------------
uniform vec3 uSunDirection;
uniform vec3 uMoonDirection;
uniform float uSunAngularRadius;
uniform float uMoonAngularRadius;
/** Vertical squash of the solar disc from differential refraction. 1 = round. */
uniform float uSunFlattening;
uniform vec3 uSunRadiance;
uniform vec3 uMoonRadiance;

uniform sampler2D uMoonAlbedo;
uniform sampler2D uMoonNormal;
/** Sub-solar direction in the moon's apparent-disc frame: +X right, +Y up, +Z toward viewer. */
uniform vec3 uMoonSunDirection;
/** Screen-space tilt of lunar north, radians, clockwise from screen up. */
uniform float uMoonNorthAngle;
/** Optical libration in longitude and latitude, radians. */
uniform vec2 uMoonLibration;
/** Earthshine strength, already scaled by how lit the Earth is as seen from the Moon. */
uniform float uEarthshine;

uniform float uAltitudeKm;
/** Global luminance scale so the sky sits in the same units as the light rig. */
uniform float uSkyIntensity;

/**
 * Night-sky radiance floor, cd/m².
 *
 * The scattering LUTs are built for one light source, the sun, so with the sun down they
 * return zero and the sky is mathematically black — which makes a full-moon night render as an
 * empty frame, when in reality you can read a newspaper by it.
 *
 * This is the moonlight the atmosphere scatters, plus airglow. It is a single-scattering,
 * altitude-independent approximation rather than a second pass through the full model: the
 * moon is roughly 400 000 times fainter than the sun, so the *shape* of its scattering matters
 * far less than its presence, and getting the magnitude right (a full moon gives about
 * 0.001 cd/m² of sky, airglow about 0.0002) is what actually decides whether the horizon is
 * visible. The Rayleigh phase term still puts the glow around the moon where it belongs.
 */
uniform vec3 uMoonSkyRadiance;
uniform vec3 uAirglowRadiance;

// -------------------------------------------------------------------------------------------

vec3 sampleSkyView(vec3 direction) {
  float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);
  vec3 origin = vec3(0.0, radius, 0.0);

  float cosViewZenith = direction.y;
  // Azimuth measured from the sun's own azimuth, which is what the LUT is parameterised on.
  vec2 viewFlat = normalize(vec2(direction.x, direction.z) + vec2(EPS));
  vec2 sunFlat = normalize(vec2(uSunDirection.x, uSunDirection.z) + vec2(EPS));
  float azimuth = atan(
      viewFlat.x * sunFlat.y - viewFlat.y * sunFlat.x,
      viewFlat.x * sunFlat.x + viewFlat.y * sunFlat.y);
  if (azimuth < 0.0) azimuth += TWO_PI;

  bool hitsGround = intersectsGround(origin, direction);
  vec2 uv = skyViewUv(radius, cosViewZenith, azimuth, hitsGround);
  return texture2D(uSkyViewLut, uv).rgb;
}

/**
 * Rotate about the vertical axis. With azimuth measured from north (-Z) eastward (+X), a
 * positive angle here *decreases* the azimuth of the direction — which is why the rotation
 * passed in is (real solar azimuth − baked solar azimuth) and not its negation.
 */
vec3 rotateY(vec3 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * v.x + s * v.z, v.y, c * v.z - s * v.x);
}

vec2 equirectUv(vec3 direction) {
  float u = atan(direction.z, direction.x) * (0.5 / PI) + 0.5;
  float v = acos(clamp(direction.y, -1.0, 1.0)) * INV_PI;
  return vec2(fract(u), clamp(v, 0.001, 0.999));
}

/**
 * Compress the panorama's highlights.
 *
 * Every outdoor HDRI has the sun burned into it, often at tens of thousands of times the sky
 * luminance and always in the wrong place for us. Rather than trying to find and mask it, this
 * applies a soft knee well above ordinary cloud brightness: sky and cloud pass through
 * untouched, the solar blob and its aureole are crushed to something the analytic disc can be
 * drawn over convincingly.
 */
vec3 suppressBakedSun(vec3 colour) {
  const float KNEE = 6.0;
  const float CEILING = 14.0;
  float l = max(ef_luminance(colour), EPS);
  if (l <= KNEE) return colour;
  float compressed = KNEE + (CEILING - KNEE) * (1.0 - exp(-(l - KNEE) / (CEILING - KNEE)));
  return colour * (compressed / l);
}

/** Dimensionless structure field, mean 1, with the baked sun crushed out of it. */
vec3 sampleHdriDetail(vec3 direction) {
  vec3 a =
      suppressBakedSun(texture2D(uHdriA, equirectUv(rotateY(direction, uHdriRotationA))).rgb) *
      uHdriInvMeanA;
  vec3 b =
      suppressBakedSun(texture2D(uHdriB, equirectUv(rotateY(direction, uHdriRotationB))).rgb) *
      uHdriInvMeanB;
  // Clamped so a blown-out patch of a panorama can never drive the analytic sky to an
  // unphysical luminance; 3x the mean is already a very bright cloud edge.
  return clamp(mix(a, b, uHdriBlend), vec3(0.05), vec3(3.0));
}

/**
 * Solar limb darkening. The disc is measurably dimmer at its edge than at its centre because
 * a grazing line of sight only reaches the cooler upper photosphere. The 0.6 coefficient is
 * the standard broadband value.
 */
float solarLimbDarkening(float normalisedRadius) {
  float mu = sqrt(max(0.0, 1.0 - normalisedRadius * normalisedRadius));
  return 1.0 - 0.6 * (1.0 - mu);
}

/** Position of a direction within a disc, in units of the disc's angular radius. */
vec2 discCoordinates(vec3 direction, vec3 centre, float angularRadius, float flattening) {
  // Screen-aligned basis at the disc: right is horizontal, up completes it.
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), centre) + vec3(EPS, 0.0, 0.0));
  vec3 up = cross(centre, right);
  vec3 offset = direction - centre * dot(direction, centre);
  float x = dot(offset, right) / angularRadius;
  float y = dot(offset, up) / max(EPS, angularRadius * flattening);
  return vec2(x, y);
}

vec3 renderMoon(vec3 direction, out float coverage) {
  coverage = 0.0;
  float cosAngle = dot(direction, uMoonDirection);
  if (cosAngle < cos(uMoonAngularRadius * 2.0)) return vec3(0.0);

  vec2 disc = discCoordinates(direction, uMoonDirection, uMoonAngularRadius, 1.0);
  float r2 = dot(disc, disc);
  if (r2 > 1.0) return vec3(0.0);

  // Soft edge across roughly one pixel of a 0.5-degree disc, so the limb is not aliased.
  coverage = smoothstep(1.0, 1.0 - 0.02, r2);

  // Screen frame -> lunar frame: undo the tilt of lunar north.
  float c = cos(-uMoonNorthAngle);
  float s = sin(-uMoonNorthAngle);
  vec2 lunar = vec2(disc.x * c - disc.y * s, disc.x * s + disc.y * c);
  float z = sqrt(max(0.0, 1.0 - dot(lunar, lunar)));
  vec3 surface = vec3(lunar.x, lunar.y, z);

  // Libration: the sub-Earth point wanders by up to 8 degrees over a month, which slowly
  // swings features around the limb. Build the Earth-facing basis in body coordinates.
  float lonLib = uMoonLibration.x;
  float latLib = uMoonLibration.y;
  vec3 toEarth = vec3(cos(latLib) * sin(lonLib), sin(latLib), cos(latLib) * cos(lonLib));
  vec3 northPole = vec3(0.0, 1.0, 0.0);
  vec3 bodyRight = normalize(cross(northPole, toEarth));
  vec3 bodyUp = cross(toEarth, bodyRight);
  vec3 body = bodyRight * surface.x + bodyUp * surface.y + toEarth * surface.z;

  float longitude = atan(body.x, body.z);
  float latitude = asin(clamp(body.y, -1.0, 1.0));
  vec2 uv = vec2(0.5 + longitude * (0.5 / PI), 0.5 - latitude * INV_PI);

  vec3 albedo = texture2D(uMoonAlbedo, uv).rgb;
  vec3 detail = texture2D(uMoonNormal, uv).rgb * 2.0 - 1.0;
  // Perturb the sphere normal by the LOLA-derived relief so craters catch the terminator.
  vec3 normal = normalize(surface + vec3(detail.x, detail.y, 0.0) * 0.55);

  float nDotL = dot(normal, uMoonSunDirection);
  float nDotV = normal.z;

  // Lommel-Seeliger rather than Lambert. Regolith backscatters strongly, which is why a full
  // moon reads as a flat bright disc instead of a shaded ball — Lambert would put an obvious
  // dark ring around the limb that is simply not there in any photograph.
  float mu0 = max(0.0, nDotL);
  float mu = max(EPS, nDotV);
  float lit = mu0 / (mu0 + mu);

  // Terminator softening: the real one is sharp, but at this angular size it must not alias.
  lit *= smoothstep(-0.06, 0.06, nDotL);

  // Earthshine on the unlit side. A thin crescent means a nearly full Earth in the lunar sky,
  // so this is brightest exactly when the sunlit sliver is thinnest — as it is in reality.
  float dark = 1.0 - smoothstep(-0.06, 0.12, nDotL);
  vec3 earthshine = albedo * uEarthshine * dark * mu * vec3(0.72, 0.82, 1.0);

  return albedo * uMoonRadiance * lit + earthshine;
}

void main() {
  vec3 direction = normalize(vViewRay);

  vec3 atmosphere = sampleSkyView(direction);

  // Flatten the directional gradient under cloud. The zenith sample is a good stand-in for the
  // hemispheric average — it is the one direction whose radiance barely depends on where the
  // sun is — and lerping towards it is what turns a clear-sky model into an overcast one.
  vec3 zenith = texture2D(uSkyViewLut, vec2(0.5, 1.0)).rgb;
  atmosphere = mix(atmosphere, zenith * 0.88, uCloudiness);

  // Night floor. Both terms thin out towards the horizon the way the real ones do, because
  // there is more air in the way and less of it above the observer.
  float upness = smoothstep(-0.08, 0.35, direction.y);
  float moonPhaseTerm = 4.0 * PI * rayleighPhase(dot(direction, uMoonDirection));
  atmosphere +=
      (uMoonSkyRadiance * mix(0.45, 1.0, upness) * (0.55 + 0.45 * moonPhaseTerm) +
       uAirglowRadiance * mix(0.6, 1.0, upness)) /
      uSkyIntensity;

  // Only the upper hemisphere gets panorama detail; below the horizon the analytic model and
  // the ocean shader own the frame, and an HDRI's baked ground would show through as a seam.
  float aboveHorizon = smoothstep(-0.02, 0.06, direction.y);
  vec3 detail = sampleHdriDetail(direction);
  vec3 sky = atmosphere * mix(vec3(1.0), detail, uHdriWeight * aboveHorizon);

  // --- solar disc ---------------------------------------------------------------------------
  vec2 sunDisc = discCoordinates(direction, uSunDirection, uSunAngularRadius, uSunFlattening);
  float sunR2 = dot(sunDisc, sunDisc);
  if (sunR2 < 1.0) {
    // Extinction along the view ray to the sun, so the disc reddens and dims into the horizon
    // haze exactly as the surrounding sky does.
    float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);
    vec3 extinction = sampleTransmittance(uTransmittanceLut, radius, uSunDirection.y);
    float edge = 1.0 - smoothstep(0.94, 1.0, sunR2);
    sky += uSunRadiance * extinction * solarLimbDarkening(sqrt(sunR2)) * edge;
  }

  // --- lunar disc ---------------------------------------------------------------------------
  float moonCoverage;
  vec3 moon = renderMoon(direction, moonCoverage);
  if (moonCoverage > 0.0) {
    float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);
    vec3 extinction = sampleTransmittance(uTransmittanceLut, radius, max(0.0, uMoonDirection.y));
    // The moon is occluded by the daytime sky rather than added to it: at noon the disc is
    // still there, just lost in a sky that is thousands of times brighter, which is exactly
    // what happens when you look for a daytime moon.
    sky = mix(sky, moon * extinction, moonCoverage);
  }

  gl_FragColor = vec4(hdrClamp(sky * uSkyIntensity), 1.0);
}
