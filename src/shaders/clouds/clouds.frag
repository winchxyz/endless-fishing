// Volumetric cloud layer.
//
// A ray march through a participating medium on a spherical shell above the sea, lit by both the
// sun and the moon with Beer-Lambert extinction along the light ray and a dual-lobe
// Henyey-Greenstein phase along the view ray. Nothing here is a sprite, a billboard or a scrolled
// texture: the silver lining on a backlit edge, the dark underside of a squall and the way a
// tower's shadow falls across its own base all come out of the same integral.
//
// This file compiles into three programs, selected by the defines the material sets:
//
//   CLOUD_MARCH    the march itself. Run twice — once per frame into a low-resolution buffer for
//                  the main camera, and once per cube face at a lower step count for the
//                  environment probe, which is how the clouds end up in the image-based lighting
//                  and therefore in the water's reflection.
//   CLOUD_RESOLVE  reads that buffer back at full resolution. Six lines, but it has to be its own
//                  program: a uniform branch inside the march would cost the branch on every one
//                  of a million fragments to save one small shader.
//   neither        the shared field only. `cloudshadow.frag` includes this file without either
//                  define to get `ef_cloudDensity`, so the shadow falling on the water is cast by
//                  the same cloud that is drawn in the sky rather than by a copy of it that will
//                  eventually drift out of agreement.
//
// Radiance out is linear and physical, in candela per square metre. Tone mapping is the
// composer's job. Everything goes through hdrClamp before it is written, because a sunlit cloud
// edge genuinely exceeds what a half-float buffer can carry.

precision highp float;

#ifndef ENDLESS_FISHING_CLOUDS
#define ENDLESS_FISHING_CLOUDS

#include /lib/constants.glsl

varying vec2 vUv;

// The sea is a sphere and the cloud deck is a shell on it. A flat slab would never end: the ray
// to the horizon would stay inside it forever, and the deck would have to be faded out by hand
// at some arbitrary distance instead of meeting the water where it really does, about a hundred
// and thirty kilometres out for a base at fifteen hundred metres.
const float EARTH_RADIUS_M = 6371000.0;
const float EARTH_RADIUS_SQ_M = 40589641000000.0;

/**
 * How far the regional field moves cover about its mean, at half cover.
 *
 * This is what makes a partly-cloudy day read as weather rather than as a tiling pattern: a break
 * in the overcast drifts over and puts the sun back on the water. Nineteen points is about the
 * spread a real broken sky shows between one twenty-kilometre cell and the next.
 */
const float COVER_SPREAD = 0.19;

// --- the field ------------------------------------------------------------------------------

/** 64³ Perlin-Worley volume, packed as an 8x8 grid of slices. R base, GBA Worley octaves. */
uniform sampler2D uShapeNoise;
uniform vec3 uShapeLayout;
uniform vec2 uShapeTexel;
/** 32³ Worley volume for the erosion pass, packed as an 8x4 grid. */
uniform sampler2D uDetailNoise;
uniform vec3 uDetailLayout;
uniform vec2 uDetailTexel;
/** 64x64 void-and-cluster blue noise. Dithers the march's starting offset. */
uniform sampler2D uBlueNoise;
uniform vec2 uBlueNoiseTexel;

uniform vec3 uCameraPosition;
uniform vec3 uSunDirection;

uniform float uCloudBaseM;
uniform float uCloudTopM;
/** 1 / (top − base). Precomputed because it is wanted once per march step. */
uniform float uInvThickness;
/** 0..1 sky cover. The weather system's cloud fraction, damped. */
uniform float uCoverage;
/** 0 = flat stratus deck, 1 = towering cumulonimbus. Sets the vertical profile. */
uniform float uConvection;
/** 0..1 how much of a spreading anvil the tower has grown. */
uniform float uAnvil;
/** Extinction per metre at unit density. */
uniform float uDensityScale;
/** Metres the deck has drifted, accumulated from the one shared wind vector. */
uniform vec2 uWindOffset;
uniform float uShapeScaleM;
uniform float uDetailScaleM;
uniform float uErosion;

/**
 * Trilinear fetch from a volume packed into a 2D atlas of slices.
 *
 * WebGL2 has 3D textures, but only through GLSL ES 3.00, and this whole shader tree is written
 * against three's ESSL 1.00 path. Two bilinear fetches and a lerp is the same filter for one
 * extra tap, and the inset below is what keeps the two slices from bleeding into each other —
 * without it the seam sweeps through the cloud as a hard edge every time the deck drifts.
 */
vec4 ef_volume(sampler2D tex, vec3 uvw, vec3 atlas, vec2 texel) {
  vec3 w = fract(uvw);
  float slices = atlas.z;
  float z = w.z * slices;
  float z0 = floor(z);
  float f = z - z0;
  float z1 = mod(z0 + 1.0, slices);

  vec2 tiles = atlas.xy;
  vec2 tileSize = 1.0 / tiles;
  vec2 inset = texel * tiles * 0.5;
  vec2 inner = clamp(w.xy, inset, 1.0 - inset);

  vec2 o0 = vec2(mod(z0, tiles.x), floor(z0 / tiles.x));
  vec2 o1 = vec2(mod(z1, tiles.x), floor(z1 / tiles.x));

  vec4 a = texture2DLodEXT(tex, (o0 + inner) * tileSize, 0.0);
  vec4 b = texture2DLodEXT(tex, (o1 + inner) * tileSize, 0.0);
  return mix(a, b, f);
}

/**
 * Transmittance on its way into the buffer, with NaN turned into "no cloud".
 *
 * The cloud buffer is premultiplied and the blend state composites it as
 * `dst = src.rgb + dst * src.a`, so alpha is a *multiplier on the sky behind it*. `hdrClamp`
 * strips NaN from the colour, but nothing guarded the alpha — and `saturate(NaN)` collapses to
 * zero on this driver, which multiplies the destination by zero and punches the sky to black.
 * That is the speckle: not dark cloud, but individual pixels where the march produced a NaN at
 * a grazing angle and the compositor obediently erased everything behind them.
 *
 * NaN resolves to 1.0 — fully transparent. Losing a pixel of cloud is invisible; erasing a
 * pixel of sky is not.
 */
float ef_safeTransmittance(float t) {
  return (t == t) ? clamp(t, 0.0, 1.0) : 1.0;
}

float ef_blueNoise(vec2 fragCoord) {
  return texture2DLodEXT(uBlueNoise, (fragCoord + 0.5) * uBlueNoiseTexel, 0.0).r;
}

/**
 * Height above the sea for a point in the camera's local frame.
 *
 * Written as u / (sqrt(R² + u) + R) rather than as length(p + R) − R. The direct form subtracts
 * two numbers around 6.4e6 whose difference is a few hundred, and a 32-bit float carries seven
 * digits — so the direct form quantises the cloud base into visible steps a hundred metres
 * apart. This form never forms the large difference at all.
 */
float ef_altitude(vec3 p) {
  float u = 2.0 * EARTH_RADIUS_M * p.y + dot(p, p);
  return u / (sqrt(EARTH_RADIUS_SQ_M + u) + EARTH_RADIUS_M);
}

/** |o|² − r² for the shell at `altitude`, with the two enormous terms cancelled algebraically. */
float ef_shellC(vec3 p, float altitude) {
  return dot(p, p) + 2.0 * EARTH_RADIUS_M * (p.y - altitude) - altitude * altitude;
}

/**
 * Distance along `dir` to where the ray leaves the shell at `altitude`, or −1 if it never does.
 * The quadratic is solved through the root that does not cancel, taking the other from the
 * product of the roots — for a grazing ray at the horizon the naive form loses everything.
 */
float ef_shellExit(vec3 p, vec3 dir, float altitude) {
  float b = dot(vec3(p.x, p.y + EARTH_RADIUS_M, p.z), dir);
  float c = ef_shellC(p, altitude);
  float discriminant = b * b - c;
  if (discriminant < 0.0) return -1.0;
  float root = sqrt(discriminant);
  float q = -(b + (b >= 0.0 ? root : -root));
  if (q == 0.0) return -1.0;
  return max(q, c / q);
}

/** True when the ray runs into the sea before it can reach the deck. */
bool ef_hitsSea(vec3 p, vec3 dir) {
  float b = dot(vec3(p.x, p.y + EARTH_RADIUS_M, p.z), dir);
  if (b > 0.0) return false;
  return b * b - ef_shellC(p, 0.0) >= 0.0;
}

/**
 * Vertical profile of the deck, 0..1, at a fractional height through it.
 *
 * A stratus deck is a slab with soft edges. A cumulus has a narrow base, wide shoulders and a
 * rounded top, and getting that profile right is most of the difference between a cloud and a
 * patch of fog at altitude — it is the shape the light has to travel through.
 */
float ef_heightGradient(float h) {
  float stratus = remap(h, 0.0, 0.07, 0.0, 1.0) * remap(h, 0.62, 0.96, 1.0, 0.0);
  float cumulus = remap(h, 0.0, 0.26, 0.0, 1.0) * remap(h, 0.52, 1.0, 1.0, 0.0);
  float profile = mix(stratus, cumulus, uConvection);

  // The anvil. A cumulonimbus stops rising when it reaches air it cannot displace and spreads
  // sideways into a sheet, which is the most recognisable shape in the sky. It is a second
  // plateau in this profile rather than a piece of geometry, so it grows out of the same field
  // and erodes with the same noise as everything else.
  float anvil = smoothstep(0.58, 0.72, h) * (1.0 - smoothstep(0.90, 1.0, h));
  return max(profile, uAnvil * anvil);
}

/**
 * Extinction per metre at a world position.
 *
 * `detailStrength` is the level of detail: 1 for the view ray, 0 for the light march and for the
 * shadow mask, where the high-frequency erosion is invisible and costs two texture fetches a
 * step. Dropping it there is not an approximation anyone can see — it is the difference between
 * a cloud pass that runs and one that does not.
 */
float ef_cloudDensity(vec3 world, float h, float detailStrength) {
  float gradient = ef_heightGradient(h);
  if (gradient <= 0.0) return 0.0;

  // Vertical shear: the top of the deck runs ahead of its base, because the wind does. It costs
  // nothing and it is why a towering cloud leans instead of standing up like a pillar.
  vec2 drift = uWindOffset * (0.55 + 0.85 * h);

  vec3 sp = vec3(
      (world.x + drift.x) / uShapeScaleM,
      world.y / (uShapeScaleM * 0.55),
      (world.z + drift.y) / uShapeScaleM);
  vec4 shape = ef_volume(uShapeNoise, sp, uShapeLayout, uShapeTexel);

  // Cover varies across the sky at a scale far larger than any one cloud. That variation is what
  // makes a partly-cloudy day read as weather rather than as a tiling pattern, and it is why a
  // break in the overcast can drift over and put the sun back on the water.
  vec3 regionalUvw = vec3(
      (world.x + drift.x * 0.3) / (uShapeScaleM * 8.0),
      0.317,
      (world.z + drift.y * 0.3) / (uShapeScaleM * 8.0));
  float regional = ef_volume(uShapeNoise, regionalUvw, uShapeLayout, uShapeTexel).r;

  float cover = uCoverage * (1.0 + uAnvil * smoothstep(0.58, 0.86, h) * 0.5);

  // The regional variation is added, not multiplied, and it closes at both ends of the range.
  //
  // Multiplying by 0.62..1.38 sounds equivalent and is not: it scales the *whole* range, so a sky
  // the weather system says is 98 per cent covered still had patches pulled down to 0.61, the
  // deck never closed, and a pinned storm came out as blue sky with a Beaufort 9 sea under it.
  // Real cover does not behave that way — a broken sky has a lot of spatial variation and a
  // closed deck has almost none, because there is nothing left to vary. So the spread is widest
  // at half cover and goes to zero as the sky clears or closes, which is what
  // `1 - |2c - 1|` is.
  float spread = mix(-COVER_SPREAD, COVER_SPREAD, regional) * (1.0 - abs(2.0 * cover - 1.0));
  cover = saturate(cover + spread);
  // Not `<= 0.0`. The density remap below divides by `1.0 - (1.0 - cover)`, and in float32
  // `1.0 - cover` rounds to exactly 1.0 for every cover under 2⁻²⁵ — a window the coverage walks
  // through every time the weather damps the sky clear. Below a hundred-thousandth of a sky
  // there is no cloud to draw, so leaving early is both the fix and the right answer.
  if (cover < 1e-5) return 0.0;

  float worley = shape.g * 0.625 + shape.b * 0.25 + shape.a * 0.125;
  float base = remap(shape.r, worley - 1.0, 1.0, 0.0, 1.0);

  // Fade the shape noise towards solid as the deck closes.
  //
  // `remap(base * gradient, 1 - cover, 1, 0, 1)` is the standard construction and it has one
  // failure at the top of its range: at cover = 1 it reduces to the raw noise, so wherever the
  // shape field happens to be low there is a hole, and the sky never closes however overcast the
  // weather says it is. A third of the sky stayed blue under a pinned storm because of it.
  //
  // The fix is not a floor on the density, it is the observation that the noise should not be
  // there at all by then: a broken sky is all contrast, and an overcast one is featureless
  // because there is nothing left to break it up. The erosion below still works the surface, so
  // a closed deck keeps its texture without keeping its holes.
  float shapeContrast = 1.0 - smoothstep(0.6, 0.98, cover);
  float solid = mix(1.0, base, shapeContrast);
  float density = remap(solid * gradient, 1.0 - cover, 1.0, 0.0, 1.0) * cover;
  if (density <= 0.0) return 0.0;

  if (detailStrength > 0.0) {
    vec3 dp = vec3(
        (world.x + drift.x * 1.4) / uDetailScaleM,
        world.y / (uDetailScaleM * 0.7),
        (world.z + drift.y * 1.4) / uDetailScaleM);
    vec3 detail = ef_volume(uDetailNoise, dp, uDetailLayout, uDetailTexel).rgb;
    float fine = detail.r * 0.625 + detail.g * 0.25 + detail.b * 0.125;
    // Billows at the base, wisps at the top. Inverting the erosion with height is what stops a
    // cumulus looking like a ball of noise and makes it look like something that is rising.
    float modifier = mix(1.0 - fine, fine, saturate(h * 3.0));
    density = remap(density, modifier * uErosion * detailStrength, 1.0, 0.0, 1.0);
  }

  return density * uDensityScale;
}

#endif

// ============================================================================== the view march
#ifdef CLOUD_MARCH

#include /lib/atmosphere.glsl

varying vec3 vViewRay;

uniform vec3 uSunColour;
/** Direct-beam illuminance in lux — not divided by π; the phase function does that job. */
uniform float uSunIrradiance;
uniform vec3 uMoonDirection;
uniform vec3 uMoonColour;
uniform float uMoonIrradiance;
/**
 * The atmosphere's sky-view table, and the scale that turns it into cd/m².
 *
 * The ambient a cloud sits in is read from here rather than from the environment probe, for two
 * reasons. The probe is being *written* while this shader runs for the probe's own cube faces,
 * and sampling a texture that is currently attached to the framebuffer is a feedback loop the
 * driver will warn about and then resolve however it likes. And the table is the more direct
 * answer anyway: it is the physical sky radiance in the direction asked for, with no round trip
 * through a cubemap that was rendered from this same table one frame ago.
 */
uniform sampler2D uSkyViewLut;
uniform float uSkyIntensity;
uniform float uAltitudeKm;
uniform float uVisibility;
uniform float uPhaseG;
uniform float uPowder;
uniform float uPrecipitation;
uniform float uLightningFlash;
uniform vec3 uLightningPosition;

/**
 * Longest interval the march will cover, metres — a limit on the SPAN, not on the distance.
 *
 * The budget has to be capped somewhere: a ray a degree above the horizon runs a hundred and
 * thirty kilometres before it even reaches the cloud base, and there is no sense spending steps
 * on the empty air in front of it.
 *
 * Capping the far distance instead, which is what this used to do, is a limit on *coverage*: it
 * culls the entire deck below the elevation at which the near edge passes the limit. For a
 * cumulus base at 950 m and an eye at 2 m that elevation is 0.597 degrees, and because the march
 * origin sits on the vertical axis it is the same elevation at every azimuth — a horizontal edge
 * right round the compass, with no cloud below it and, one pixel higher, a deck already thick
 * enough to be opaque. It also slid up and down as the profile damped between archetypes, which
 * is why it read as something moving rather than as a constant.
 *
 * Capping the span keeps `tFar > tNear` unconditionally, so nothing is ever culled and the deck
 * simply recedes into its own aerial perspective. It is cheaper at the horizon too: the existing
 * transmittance break ends those rays after a step or two.
 */
const float CLOUD_MAX_SPAN_M = 30000.0;
/** Peak in-cloud radiance from a stroke, cd/m². Enough to read as daylight for one frame. */
const vec3 LIGHTNING_RADIANCE = vec3(0.86, 0.90, 1.0) * 120000.0;

/**
 * Physical sky radiance in a direction, cd/m². Azimuth is measured from the sun's own azimuth,
 * because that is the axis the table is parameterised on.
 *
 * The elevation is clamped at the horizon, and that clamp is the whole reason a row of blown
 * white segments used to sit on the night sea.
 *
 * The sky-view table is only meaningful above the horizon. Below it the parameterisation folds
 * onto the ground-intersecting branch, where the table holds whatever the last write left and
 * `uSkyIntensity` scales it like radiance regardless. A cloud ray is supposed to have been sent
 * home before it can ask: `ef_hitsSea` returns "no cloud" for anything aimed at the water. But
 * the two tests do not agree to the last microradian — `ef_hitsSea` uses the sea sphere through
 * the camera's own height and this uses `GROUND_RADIUS` plus `uAltitudeKm` — and between them
 * lies a band a couple of milliradians deep, three pixels at this field of view, of rays that
 * clear the sea and still read as below the horizon here. Those rays run a hundred and thirty
 * kilometres to the deck, so aerial perspective replaces essentially all of their colour with
 * this sample; wherever cloud happened to lie along one, a cell-wide segment of the horizon
 * came back at sixty thousand candelas against a night sky of two ten-thousandths.
 *
 * Clamping costs nothing where it does not apply and is what the geometry says everywhere else:
 * the last thing a grazing ray sees before the sea cuts it off is the horizon.
 */
vec3 ef_skyRadiance(vec3 rawDirection) {
  float radius = GROUND_RADIUS + max(0.0, uAltitudeKm);
  vec3 origin = vec3(0.0, radius, 0.0);
  vec3 direction = normalize(vec3(rawDirection.x, max(rawDirection.y, 0.0), rawDirection.z) +
                             vec3(EPS, 0.0, 0.0));

  vec2 viewFlat = normalize(vec2(direction.x, direction.z) + vec2(EPS));
  vec2 sunFlat = normalize(vec2(uSunDirection.x, uSunDirection.z) + vec2(EPS));
  float azimuth = atan(
      viewFlat.x * sunFlat.y - viewFlat.y * sunFlat.x,
      viewFlat.x * sunFlat.x + viewFlat.y * sunFlat.y);
  if (azimuth < 0.0) azimuth += TWO_PI;

  vec2 uv = skyViewUv(radius, direction.y, azimuth, intersectsGround(origin, direction));
  return texture2DLodEXT(uSkyViewLut, uv, 0.0).rgb * uSkyIntensity;
}

float ef_hg(float cosTheta, float g) {
  float g2 = g * g;
  return INV_FOUR_PI * (1.0 - g2) / pow(max(1e-4, 1.0 + g2 - 2.0 * g * cosTheta), 1.5);
}

/**
 * Two lobes, because droplets have two.
 *
 * Cloud droplets scatter overwhelmingly forwards — that is the silver lining, and it is why a
 * cloud between you and the sun is brighter at its edge than a cloud beside the sun ever gets.
 * They also have a weak backscatter peak, which is the glow around your own shadow on the deck
 * when the sun is behind you. One lobe gives you the first and quietly loses the second.
 */
float ef_phase(float cosTheta, float g) {
  return mix(ef_hg(cosTheta, g), ef_hg(cosTheta, -0.28), 0.24);
}

/** Optical depth from a point towards a light, through the deck. */
float ef_lightDepth(vec3 world, vec3 L) {
  float stepSize = (uCloudTopM - uCloudBaseM) / float(CLOUD_LIGHT_STEPS) * 0.7;
  float tau = 0.0;
  float t = stepSize * 0.5;
  for (int i = 0; i < CLOUD_LIGHT_STEPS; i++) {
    vec3 q = world + L * t;
    float h = (q.y - uCloudBaseM) * uInvThickness;
    // The density is tested, not only the height. This is the one consumer of
    // `ef_cloudDensity` in the file that did not, and it is therefore the one route by which a
    // bad sample reaches the optical depth — and from there the phase integral, the accumulated
    // colour, and a premultiplied buffer that erases the sky behind whatever pixel it lands on.
    // The view march has always had the equivalent test; this restores the invariant that `tau`
    // is a sum of finite non-negative terms.
    if (h > 0.0 && h < 1.0) {
      // Not named `sample`: that is a reserved word in GLSL ES and the error it produces points
      // at the line after the declaration.
      float stepDensity = ef_cloudDensity(q, h, 0.0);
      if (stepDensity > 0.0) tau += stepDensity * stepSize;
    }
    t += stepSize;
    // The cone widens as it goes. Further along the light ray one sample stands for more volume,
    // and stepping uniformly out there spends the budget where nothing can be seen.
    stepSize *= 1.55;
  }
  return tau;
}

/**
 * How much of the light reaching a point comes back along the view ray.
 *
 * Beer-Lambert alone leaves a cloud flat and dead, because it only ever accounts for light that
 * has not been scattered yet. The octave sum is Wrenninge's approximation to the rest: each pass
 * sees a thinner cloud, contributes less, and scatters more nearly isotropically, which is what
 * a photon that has already bounced several times actually does.
 */
float ef_scatterEnergy(float tau, float cosTheta) {
  float energy = 0.0;
  float attenuation = 1.0;
  float contribution = 1.0;
  float eccentricity = 1.0;
  for (int o = 0; o < CLOUD_SCATTER_OCTAVES; o++) {
    energy += contribution * exp(-tau * attenuation) * ef_phase(cosTheta, uPhaseG * eccentricity);
    attenuation *= 0.45;
    contribution *= 0.68;
    eccentricity *= 0.5;
  }
  // Powder. Near a boundary there is not enough material around a point to supply the multiple
  // scattering that lights a cloud's interior, so edges facing the light come out darker rather
  // than brighter. Leave it out and every cumulus reads as a lit balloon.
  float powder = 1.0 - exp(-tau * 2.2);
  return energy * mix(1.0, powder, uPowder);
}

void main() {
  vec3 dir = normalize(vViewRay);
  vec3 origin = vec3(0.0, uCameraPosition.y, 0.0);

  if (ef_hitsSea(origin, dir)) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float tNear = max(0.0, ef_shellExit(origin, dir, uCloudBaseM));
  float tFar = min(ef_shellExit(origin, dir, uCloudTopM), tNear + CLOUD_MAX_SPAN_M);
  if (tFar <= tNear) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // What is over the deck.
  //
  // For a broken sky that is the sky: blue, and the table has it. For a closed one it is not —
  // it is the tops of the cloud, in full sun, and a stratus sheet returns about seventy per cent
  // of what falls on it. Reading the clear-sky table for both left an overcast deck lit by blue
  // zenith light and, being lit by blue, coming out blue: a pinned storm rendered as a fine day
  // with a Beaufort 9 sea under it, which was not the deck failing to draw — it drew, opaquely,
  // in exactly the colour of the sky it was covering. Blending on coverage is the whole fix.
  const float DECK_ALBEDO = 0.7;
  vec3 clearAbove = ef_skyRadiance(vec3(0.0, 1.0, 0.0));
  vec3 sunlitTops =
      uSunColour * uSunIrradiance * INV_PI * DECK_ALBEDO * max(0.0, uSunDirection.y) +
      uMoonColour * uMoonIrradiance * INV_PI * DECK_ALBEDO * max(0.0, uMoonDirection.y);
  vec3 ambientAbove = mix(clearAbove, max(sunlitTops, clearAbove), uCoverage * uCoverage);

  // Below the deck there is the lower atmosphere and the sea, and open water returns about seven
  // per cent of what falls on it. Under a raining base almost none of that gets back up, which
  // is what takes a squall line to the near-black that makes it read as a squall line rather
  // than as grey cotton wool.
  vec3 ambientBelow =
      (ef_skyRadiance(vec3(0.0, -1.0, 0.0)) + ambientAbove * 0.07) *
      mix(0.85, 0.12, uPrecipitation);

  float cosSun = dot(dir, uSunDirection);
  float cosMoon = dot(dir, uMoonDirection);
  // Both bodies fade out across the horizon rather than switching off at it, for the same reason
  // the world lighting does: refraction keeps handing us a sun a fraction of a degree below the
  // horizon whose disc is still visible, and a hard cut there puts a line across the whole sky.
  float sunUp = smoothstep(-0.09, 0.02, uSunDirection.y);
  float moonUp = smoothstep(-0.09, 0.02, uMoonDirection.y);
  bool sunLit = uSunIrradiance > 1e-3 && sunUp > 0.0;
  bool moonLit = uMoonIrradiance > 1e-4 && moonUp > 0.0;

  float stepSize = (tFar - tNear) / float(CLOUD_STEPS);
  // Blue noise rather than a hash: the error it leaves is high-frequency, which the bilinear
  // upsample from the low-resolution buffer removes almost completely, whereas a white-noise
  // dither leaves low-frequency blotches that survive every filter downstream.
  float t = tNear + stepSize * ef_blueNoise(gl_FragCoord.xy);

  vec3 scatter = vec3(0.0);
  float transmittance = 1.0;
  float depthSum = 0.0;
  float depthWeight = 0.0;

  for (int i = 0; i < CLOUD_STEPS; i++) {
    if (transmittance < 0.012) break;

    vec3 local = vec3(dir.x * t, origin.y + dir.y * t, dir.z * t);
    float altitude = ef_altitude(local);
    float h = (altitude - uCloudBaseM) * uInvThickness;
    if (h > 0.0 && h < 1.0) {
      vec3 world = vec3(uCameraPosition.x + dir.x * t, altitude, uCameraPosition.z + dir.z * t);
      float density = ef_cloudDensity(world, h, 1.0);
      if (density > 0.0) {
        vec3 light = mix(ambientBelow, ambientAbove, h) * (0.22 + 0.78 * h);
        if (sunLit) {
          float tau = ef_lightDepth(world, uSunDirection);
          light += uSunColour * uSunIrradiance * sunUp * ef_scatterEnergy(tau, cosSun);
        }
        if (moonLit) {
          float tau = ef_lightDepth(world, uMoonDirection);
          light += uMoonColour * uMoonIrradiance * moonUp * ef_scatterEnergy(tau, cosMoon);
        }
        if (uLightningFlash > 0.0) {
          light += LIGHTNING_RADIANCE * uLightningFlash *
                   exp(-distance(world, uLightningPosition) / 2600.0);
        }

        // Energy-conserving integration over the segment: the fraction of this step's light that
        // survives to the eye is exactly what the step's own transmittance did not absorb.
        float segment = exp(-density * stepSize);
        float absorbed = 1.0 - segment;
        scatter += transmittance * absorbed * light;
        depthSum += t * transmittance * absorbed;
        depthWeight += transmittance * absorbed;
        transmittance *= segment;
      }
    }
    t += stepSize;
  }

  // Aerial perspective. Koschmieder again, on the same visibility the weather system publishes,
  // so a cloud twenty kilometres out fades into the same haze the islands do — which is what
  // gives the deck its depth. Without it every cloud sits at the same distance.
  //
  // The airlight is the light the haze in between is *sitting in*, and under a closed deck that
  // is not the blue sky — it is the underside of the cloud. Using the clear-sky table for it
  // regardless of cover was the last reason a pinned storm rendered as a fine day: the deck was
  // opaque, it composited correctly, and then this line replaced fifty-seven per cent of it with
  // the colour of the sky it was covering. A frame with the resolve forced to paint red showed
  // the whole sky red, which is what proved the cloud was there and being coloured away.
  //
  // The floor on visibility is 200 m rather than 3 km for the same reason `ef_aerialPerspective`
  // uses 200: a storm publishes 1.4 km and a sea fog 120 m, and clamping those up to three
  // kilometres throws away exactly the weather the player is supposed to notice.
  if (depthWeight > 1e-4) {
    float meanDistance = depthSum / depthWeight;
    float fade = 1.0 - exp(-3.912 / max(200.0, uVisibility) * meanDistance);
    vec3 airLight = mix(ef_skyRadiance(dir), ambientBelow, uCoverage * uCoverage);
    scatter = mix(scatter, airLight * (1.0 - transmittance), fade);
  }

  gl_FragColor = vec4(hdrClamp(scatter), ef_safeTransmittance(transmittance));
}

#endif

// ============================================================================== the resolve
#ifdef CLOUD_RESOLVE

uniform sampler2D uCloudBuffer;

void main() {
  // Premultiplied scattering in rgb, transmittance in alpha, straight back out. The blend state
  // does the compositing: dst = src.rgb + dst * src.a.
  // Guarded again on the way out: the half-float buffer can carry a NaN written before this
  // frame's march, and bilinear filtering spreads one bad texel across four output pixels.
  vec4 cloud = texture2DLodEXT(uCloudBuffer, vUv, 0.0);
  gl_FragColor = vec4(hdrClamp(cloud.rgb), ef_safeTransmittance(cloud.a));
}

#endif
