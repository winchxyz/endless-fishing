// Cloud shadows on the water.
//
// The single highest-value thing the cloud layer does. A sea under broken cloud is not evenly
// lit: it is a moving map of bright and dark, and the moment a patch of sun slides across the
// swell towards the boat is the moment the ocean stops looking like a shader and starts looking
// like a photograph. Nothing else in the render buys as much for as little.
//
// The mask is a top-down transmittance map, indexed by world X and Z rather than projected from
// the sun. That choice is deliberate: a sun-aligned projection shears without bound as the sun
// drops, so at the exact times of day this matters most — the long light of morning and evening
// — its texel density collapses along one axis and the shadows smear. Indexing by ground
// position keeps every texel the same size at every solar altitude, and costs only the ray march
// from each ground point up towards the sun, which is what this shader is.
//
// `#include`ing clouds.frag without either of its program defines pulls in the field and nothing
// else — no lighting, no view ray, no main. So the shadow on the water is cast by exactly the
// cloud that is drawn in the sky, from one definition of the density, rather than by a second
// copy that would agree today and drift apart at the first change to either.

precision highp float;

#include /clouds/clouds.frag

/** World XZ at the centre of the mask, snapped to a texel so the shadows do not crawl. */
uniform vec2 uShadowCentre;
/** Half the width of the covered square, metres. */
uniform float uShadowExtent;
/** Faded to zero when the sun is too low for a cloud shadow to mean anything. */
uniform float uShadowStrength;

void main() {
  vec3 L = uSunDirection;
  // Below a couple of degrees the shadow of a cloud two kilometres up lands sixty kilometres
  // away, well outside the mask and well past the point where the sun is lighting anything.
  if (L.y < 0.04 || uShadowStrength <= 0.0) {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    return;
  }

  vec2 ground = uShadowCentre + (vUv * 2.0 - 1.0) * uShadowExtent;

  float entry = uCloudBaseM / L.y;
  float exit = uCloudTopM / L.y;
  float dt = (exit - entry) / float(CLOUD_SHADOW_STEPS);
  // Dithering the start with blue noise costs nothing and turns the banding that a fixed offset
  // leaves — visible on the water as concentric rings — into noise the bilinear filter removes.
  float t = entry + dt * ef_blueNoise(gl_FragCoord.xy);

  float tau = 0.0;
  for (int i = 0; i < CLOUD_SHADOW_STEPS; i++) {
    vec3 q = vec3(ground.x + L.x * t, L.y * t, ground.y + L.z * t);
    // Coverage only, no erosion. A shadow four kilometres wide sampled at a few metres a texel
    // cannot resolve the high-frequency detail, and marching it there would alias badly while
    // doubling the cost of the pass.
    tau += ef_cloudDensity(q, (q.y - uCloudBaseM) * uInvThickness, 0.0) * dt;
    t += dt;
  }

  // Single channel: the ocean multiplies its direct sun term by this and nothing else.
  gl_FragColor = vec4(mix(1.0, exp(-tau), uShadowStrength), 0.0, 0.0, 1.0);
}
