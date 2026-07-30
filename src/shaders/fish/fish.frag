// Fish shading.
//
// Four mechanisms, and every one of them is something you can go and look at on a fish market
// slab rather than a stylistic choice:
//
//   Countershading   Dark back, pale belly, graded across the flank. It is camouflage: seen from
//                    above the back matches the deep water below, seen from below the belly
//                    matches the bright surface above. Driven by the world normal's Y, which for
//                    a level fish *is* its own up — and when one rolls to turn, the pale flank
//                    swinging towards the sky is the flash that gives a shoal away at range.
//   Scales           From `createScaleTexture`, parameterised per species by `scaleDensity` and
//                    `iridescence`. Overlapping courses like roof tiles, with a crevice mask that
//                    is used as occlusion and a height field that perturbs the normal.
//   Iridescence      Guanine platelets in the skin are a thin-film stack, so the hue shifts with
//                    view angle. Restrained hard: on a northern species this is a cold silver
//                    with a hint of green-violet in it, not a soap bubble.
//   Wetness          A fish out of the sea has a mucus film on it and is genuinely glossy. Under
//                    the water it is glossier still. A matte fish reads as a rubber toy.
//
// Depth absorption uses Jerlov's coefficients. They are copied from
// `src/shaders/ocean/ocean.frag`, which owns them — the numbers below are that file's, verbatim,
// and if it changes they change. A fish that is a different colour from the water it is swimming
// in gives the whole thing away in one frame.

precision highp float;

#include /lib/worldlight.glsl

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec2 vTrait;
varying vec3 vLocal;
varying float vVariation;
varying float vViewDistance;

uniform sampler2D uScales;
/** Repeats of the scale sheet around the girth and along the body. */
uniform vec2 uScaleRepeat;
uniform vec3 uBackColour;
uniform vec3 uBellyColour;
/** From the species table. 0 on a wolffish, 0.95 on a herring. */
uniform float uIridescence;
/** Mean water level, so a fish knows how deep it is without asking the ocean. */
uniform float uWaterLevel;
/** 0 = clear offshore water, 1 = turbid coastal. Interpolates the Jerlov pair below. */
uniform float uTurbidity;

// --- water optics, owned by shaders/ocean/ocean.frag ------------------------------------------
const vec3 ABSORPTION_OCEANIC = vec3(0.42, 0.072, 0.028);
const vec3 ABSORPTION_COASTAL = vec3(0.56, 0.19, 0.31);
const vec3 SCATTER_OCEANIC = vec3(0.010, 0.038, 0.055);
const vec3 SCATTER_COASTAL = vec3(0.028, 0.062, 0.048);

/**
 * How much of the eye-to-fragment segment is under water.
 *
 * Both ends under, or both above, is the easy case. When the segment crosses the surface the
 * crossing point splits it in the ratio of the two ends' heights, which is exact for a flat
 * interface and close enough for a wave whose slope is a few degrees.
 */
float submergedPath(vec3 fragPosition, vec3 eye, float level) {
  float fragBelow = max(0.0, level - fragPosition.y);
  float eyeBelow = max(0.0, level - eye.y);
  if (fragBelow <= 0.0 && eyeBelow <= 0.0) return 0.0;

  float total = distance(eye, fragPosition);
  if (fragBelow > 0.0 && eyeBelow > 0.0) return total;
  return total * ((fragBelow + eyeBelow) / max(EPS, abs(eye.y - fragPosition.y)));
}

/**
 * Thin-film sheen.
 *
 * A cosine triple offset by a third of a cycle each is the cheapest thing that behaves like a
 * spectrum — it goes round the hues in order and comes back, which is what an interference
 * colour does as the film thickness or the angle changes. Mixed heavily towards white, because
 * the real colour of a herring's flank is silver that *hints* at green and violet, and a
 * saturated rainbow on a North Atlantic fish is instantly wrong.
 */
vec3 thinFilm(float shift) {
  vec3 spectrum = 0.5 + 0.5 * cos(TWO_PI * (shift + vec3(0.0, 0.34, 0.67)));
  return mix(vec3(1.0), spectrum, 0.55);
}

void main() {
  // Fins are membranes a few millimetres thick drawn two-sided; without this their far face
  // lights as though it were facing away from the light, which is a black fin on a lit fish.
  vec3 N = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 viewVector = cameraPosition - vWorldPosition;
  vec3 V = viewVector / max(EPS, vViewDistance);

  vec2 scaleUv = vUv * uScaleRepeat;
  vec4 scales = texture2D(uScales, scaleUv);

  // Relief from the scale height field, by finite difference rather than by a derivative
  // instruction: three ships this program without the derivatives extension enabled, and two
  // extra taps on a texture this small are cheaper than the branch that would be needed to
  // guard one.
  //
  // The perturbation is applied in world XY rather than in a tangent frame, which for a fish
  // swimming level is its own lateral and vertical axes and is therefore very nearly right. It
  // is deliberately not worth a tangent varying: the job of this term is to break the specular
  // up into scales, not to be a normal map anyone will inspect.
  vec2 texel = 1.0 / max(vec2(1.0), uScaleRepeat * 128.0);
  float hx = texture2D(uScales, scaleUv + vec2(texel.x, 0.0)).r - scales.r;
  float hy = texture2D(uScales, scaleUv + vec2(0.0, texel.y)).r - scales.r;
  // Relief fades out with distance; past a few metres a scale is far below a pixel and keeping
  // it only produces the same aliasing shimmer the ocean's detail normals fade out to avoid.
  float relief = (1.0 - smoothstep(3.0, 16.0, vViewDistance)) * 0.7;
  N = normalize(N + vec3(hx, hy, 0.0) * relief * 6.0);

  // ------------------------------------------------------------------------- countershading
  // The gradient is deliberately not linear in N.y: real countershading holds a dark back over
  // most of the upper body and turns over quickly along the lateral line.
  float upness = smoothstep(-0.55, 0.72, N.y);
  vec3 albedo = mix(uBackColour, uBellyColour, upness);

  // The flank — where the section is vertical, uv.x = 0.25 and 0.75 — is where the silver is.
  float flank = pow(abs(sin(vUv.x * TWO_PI)), 2.2);
  // The lateral line: a sensory canal, and a visibly darker seam on every species here. Kept off
  // the head and off the tail, where the canal runs under bone rather than under scale.
  float alongBody = 0.5 - vLocal.z;
  float lineBand = smoothstep(0.94, 1.0, abs(sin(vUv.x * TWO_PI)));
  float lineRun = smoothstep(0.14, 0.24, alongBody) * (1.0 - smoothstep(0.72, 0.86, alongBody));
  albedo *= 1.0 - 0.3 * lineBand * lineRun;

  // Scale crevices are occlusion, not dirt, so they darken the ambient and leave the direct
  // beam alone — see `ef_shadeSurface`.
  float occlusion = mix(1.0, scales.g, 0.75);

  // ---------------------------------------------------------------------------- iridescence
  float nDotV = max(1e-3, dot(N, V));
  float shift = (1.0 - nDotV) * 1.9 + scales.b * 1.1 + vVariation * 0.4;
  vec3 sheen = thinFilm(shift);
  // Strongest on the flank, at a grazing angle, and only as far as the species allows.
  float sheenAmount = uIridescence * flank * pow(1.0 - nDotV, 1.6) * 0.55;
  albedo = mix(albedo, albedo * sheen + sheen * 0.14, sheenAmount);

  // ------------------------------------------------------------------------------ materials
  // A wet flank is close to a mirror at grazing angles; the back, which is thicker-skinned and
  // less scaled, never gets there. The per-scale random breaks the highlight into scales rather
  // than letting it lie across the fish as one smooth band.
  float roughness = mix(0.34, 0.13, flank) * (0.85 + 0.3 * scales.a);
  vec3 f0 = vec3(0.045);

  // Eyes take no countershading and no scales: an eye that grades pale towards the belly comes
  // out half white, and a fish with a half-white eye looks boiled.
  float eye = vTrait.y;
  albedo = mix(albedo, vec3(0.012, 0.013, 0.015), eye);
  roughness = mix(roughness, 0.04, eye);
  occlusion = mix(occlusion, 1.0, eye);
  f0 = mix(f0, vec3(0.08), eye);

  // Fin membranes bleach towards their free edge, where there is skin and ray and nothing else.
  float finEdge = vTrait.x;
  albedo = mix(albedo, mix(albedo, vec3(0.34, 0.35, 0.33), 0.55), finEdge);
  roughness = mix(roughness, 0.42, finEdge * 0.7);

  vec3 colour = ef_shadeSurface(albedo, N, V, roughness, occlusion, f0);

  // A fin held against the light glows: it is one layer of skin over a fan of rays, and the sun
  // goes straight through it. Same term the foliage uses, for the same reason.
  float backlight = pow(max(0.0, dot(V, -uSunDirection)), 3.0);
  colour += uSunColour * uSunIlluminance * backlight * finEdge * 0.35 * albedo;

  // ---------------------------------------------------------------------------------- water
  vec3 absorption = mix(ABSORPTION_OCEANIC, ABSORPTION_COASTAL, uTurbidity);
  vec3 scatterColour = mix(SCATTER_OCEANIC, SCATTER_COASTAL, uTurbidity);

  // Light reaching the fish has already crossed the water above it. Snell's window caps how
  // steeply a refracted ray can travel — 48.6° from vertical, whatever the sun's own altitude —
  // so the shortest possible path down to this depth is depth/cos(48.6°), never less.
  float depthBelow = max(0.0, uWaterLevel - vWorldPosition.y);
  vec3 downwelling = exp(-absorption * (depthBelow / 0.66));
  colour *= downwelling;

  // ...and light leaving it has to cross whatever water lies between it and the eye.
  float path = submergedPath(vWorldPosition, cameraPosition, uWaterLevel);
  vec3 transmittance = exp(-absorption * path);
  // The in-scattered term is the ocean's own upwelling radiance, attenuated down to this depth —
  // the same expression `ocean.frag` uses, so a fish and the water around it agree on what
  // colour the space between them is.
  vec3 skyAbove = textureCubeLodEXT(uEnvironment, vec3(0.0, 1.0, 0.0), 5.0).rgb * uEnvironmentIntensity;
  vec3 sunlight = uSunColour * uSunIlluminance + uMoonColour * uMoonIlluminance;
  vec3 inscatter =
      scatterColour * (skyAbove * 0.55 + sunlight * 0.35 * max(0.0, uSunDirection.y)) * downwelling;
  colour = colour * transmittance + inscatter * (1.0 - transmittance);

  // Only the dry part of the path gets Koschmieder haze. Applying both over the whole distance
  // double-counts the extinction and turns a fish three metres down into fog.
  colour = ef_aerialPerspective(colour, max(0.0, vViewDistance - path), V);

  gl_FragColor = vec4(hdrClamp(colour), 1.0);
}
