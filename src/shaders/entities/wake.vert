// The Kelvin wake: a ribbon of water skinned along the boat's own track.
//
// A ship's wake is not one wave system but two, and both of them fall out of one integral that
// Kelvin wrote down in 1887. A hull moving at speed v drags a pressure disturbance with it; every
// free wave that can hold station against that disturbance must have a phase speed whose
// component along the track equals v, which for deep water (c = sqrt(g/k)) fixes its wavenumber
// at k(theta) = (g/v^2)·sec^2(theta) for a crest normal making angle theta with the track. The
// surface astern is the superposition of all of them:
//
//     eta(x, y) = INTEGRAL over theta of  A(theta)·cos( k(theta)·(x·cos(theta) + y·sin(theta)) )
//
// with x measured astern and y across. Two things come out of that integral and both are visible
// from any harbour wall:
//
//   * theta = 0 is the TRANSVERSE system — crests square across the track, wavelength exactly
//     2·pi·v²/g, so a boat at four knots lays them two and a half metres apart and one at eight
//     knots lays them ten metres apart. This is the only part of the pattern that depends on
//     speed.
//   * The stationary phase of the integral is at 19.47° = asin(1/3), and it is there because
//     group velocity in deep water is half the phase velocity — a ratio with no speed in it.
//     That is why every wake on earth, from a duck to a supertanker, opens at the same angle.
//
// The loop below is a five-term quadrature of that integral. The wedge itself is not left to the
// quadrature to reproduce: the ribbon's own geometry IS the wedge, half-width growing at exactly
// tan(19.47°) per metre astern, so the angle on screen is the analytic one however few terms the
// sum is given.

precision highp float;

#include /lib/constants.glsl
#include /lib/gerstner.glsl

/**
 * Track sample this vertex hangs off, duplicated across its row of the ribbon.
 *
 *   aTrackA = (world x, world z, the time it was laid, the boat's odometer when it was laid)
 *   aTrackB = (heading x, heading z, speed over ground at that moment)
 *
 * Ages and distances astern are *derived* from those two stamps against `uTime` and
 * `uTrackLength`, so a sample is written once when it is laid and never touched again. Only the
 * head row, which is pinned to the transom, is rewritten each frame.
 */
attribute vec4 aTrackA;
attribute vec3 aTrackB;

uniform float uWaterLevel;
/** Simulation clock, seconds. The same clock `aTrackA.z` was stamped from and `uWaveTime` uses. */
uniform float uTime;
/** The boat's odometer now, metres. `uTrackLength - aTrackA.w` is the distance astern. */
uniform float uTrackLength;
uniform float uLifetime;
/** Half beam at the transom, metres: the root width of the wedge. */
uniform float uHalfBeam;
/** Crest amplitude of a fully developed wake, metres. */
uniform float uAmplitude;
/** Constant clearance over the water, metres, to keep the ribbon out of the depth buffer's teeth. */
uniform float uLift;
/** Spacing of the track samples and the number of cells across the ribbon: the Nyquist limits. */
uniform float uSampleSpacing;
uniform float uLateralCells;
/** Length of the whole track buffer, metres. Clamps the wedge when the ribbon is reseeded. */
uniform float uMaxBehind;
/**
 * Fraction of the buffer the boat has actually laid, 0..1.
 *
 * Rows beyond it were seeded, carry no speed and an age four lifetimes in the past, and are
 * therefore invisible — but the row before them is at full strength, so the ribbon ends on a
 * straight edge right across the water. That is what the first thirty seconds of every session
 * looked like, and it is the one boundary a wake must not have. Fading the last of the laid rows
 * instead costs one uniform. When the buffer is full this is 1 and the term is exactly the taper
 * the recycled tail needed anyway.
 */
uniform float uValidRows;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUndisplaced;
varying float vFoam;
varying float vFade;

const float GRAVITY = 9.80665;
/** Mean Earth radius, metres. Mirrors `ocean.vert`; see the projection at the end of main. */
const float EARTH_RADIUS_M = 6371000.0;
/** tan(asin(1/3)) = 1/(2·sqrt(2)). The Kelvin half-angle, and it has no speed in it. */
const float KELVIN_TAN = 0.3535533906;
/** Terms in the quadrature, and how far round in theta they reach. 60° is well past the cusp. */
const int WAKE_TERMS = 5;
const float MAX_THETA = 1.047197551;

void main() {
  float lateral = position.x;
  float row = position.z;

  float age = max(0.0, uTime - aTrackA.z);
  float behind = clamp(uTrackLength - aTrackA.w, 0.0, uMaxBehind);
  float speed = aTrackB.z;

  // A wake dissipates by turbulence and by spreading its energy over a widening area. Twenty
  // seconds is about what a small boat's leaves behind it in a light breeze.
  float ageFade = 1.0 - smoothstep(uLifetime * 0.3, uLifetime, age);
  // Taper the end of the ribbon, wherever that end currently is: the oldest rows of a full buffer
  // are about to be recycled, and the rows past `uValidRows` in a buffer the boat has not filled
  // yet were never laid at all. Both must go to nothing before they are reached.
  //
  // The gate is not defensive padding. `uValidRows` is exactly zero for the first 0.7 m after the
  // track is seeded — and the boat starts making a wake at 0.3 m/s, which it reaches in under a
  // tenth of a metre — so during that window the head row, whose `row` is exactly 0.0, evaluates
  // `smoothstep(0.0, 0.0, 0.0)`. That is a literal 0/0. GLSL leaves `clamp` of a NaN
  // implementation-defined, `vFade <= 0.002` does not reject it because every comparison against
  // a NaN is false, and it arrives at a premultiplied blend as an alpha: `dst * (1 - NaN)` erases
  // the frame behind the transom. It is the same mechanism as the cloud speckle, one shader over.
  float validEnd = max(uValidRows, 1e-4);
  float tailFade = step(1e-4, uValidRows) * (1.0 - smoothstep(validEnd * 0.86, validEnd, row));
  // Wave-making rises steeply with speed and there is nothing at all at a drift. The saturating
  // form is the Froude number's own shape: past hull speed the hull cannot make a bigger wave,
  // it can only climb its own bow wave.
  float drive = smoothstep(0.3, 1.5, speed) * ((speed * speed) / (speed * speed + 9.0));
  // The cusp line is the loudest part of a real wake, but the ribbon has to end somewhere, so
  // the last eighth of it is taken down to nothing.
  float edgeFade = 1.0 - smoothstep(0.86, 1.0, abs(lateral));

  float envelope = ageFade * tailFade * edgeFade;

  // ------------------------------------------------------------------ the wedge and its waves
  float halfWidth = uHalfBeam + KELVIN_TAN * behind;
  vec2 along = aTrackB.xy;
  vec2 across = vec2(along.y, -along.x);
  float offset = lateral * halfWidth;
  vec2 undisplaced = aTrackA.xy + across * offset;

  float wavenumber = GRAVITY / max(0.25, speed * speed);
  float acrossStep = max(0.05, (2.0 * halfWidth) / uLateralCells);
  float distanceAcross = abs(offset);

  float elevation = 0.0;
  float slopeAlong = 0.0;
  float slopeAcross = 0.0;
  float weightSum = 0.0;

  for (int term = 0; term < WAKE_TERMS; term++) {
    float theta = (float(term) / float(WAKE_TERMS - 1)) * MAX_THETA;
    float cosTheta = cos(theta);
    float sinTheta = sin(theta);
    float k = wavenumber / (cosTheta * cosTheta);
    float kAlong = k * cosTheta;
    float kAcross = k * sinTheta;

    // A crest whose period is finer than two cells cannot be carried by this mesh, and drawing
    // it anyway does not produce detail, it produces a moiré that crawls as the boat moves. So
    // each term is faded out as its own wavenumber approaches the grid's Nyquist limit — which
    // is also why the divergent system quietly disappears far astern, where the wedge has grown
    // wide enough that the lateral cells are metres across. That happens to be where it has
    // physically decayed anyway.
    float resolvable =
        (1.0 - smoothstep(PI / (2.0 * uSampleSpacing), PI / uSampleSpacing, kAlong)) *
        (1.0 - smoothstep(PI / (2.0 * acrossStep), PI / acrossStep, kAcross));

    float weight = cosTheta * cosTheta;
    float phase = kAlong * behind + kAcross * distanceAcross;
    float carried = weight * resolvable;

    elevation += carried * cos(phase);
    slopeAlong -= carried * kAlong * sin(phase);
    slopeAcross -= carried * kAcross * sin(phase) * sign(offset);
    weightSum += weight;
  }

  float normalise = 1.0 / max(EPS, weightSum);
  // Energy spreads over a wedge whose width grows linearly, so the amplitude falls as one over
  // its square root. The ramp over the first two metres is the hull itself: the water has not
  // closed in behind the transom yet, so there is no wave there to draw.
  float amplitude = uAmplitude * drive * envelope * smoothstep(0.0, 2.0, behind)
      * inversesqrt(1.0 + behind * 0.12) * normalise;

  elevation *= amplitude;
  slopeAlong *= amplitude;
  slopeAcross *= amplitude;

  // ----------------------------------------------------------------------------- the sea below
  //
  // The ribbon is placed by the *same* wave function the ocean's own vertex shader uses, from
  // the same uniforms and the same clock, and its horizontal coordinate is treated as
  // undisplaced exactly as the ocean treats its lattice. That is the only way a strip laid over
  // a moving swell can be guaranteed never to float above it or sink through it.
  vec3 sea = gerstnerDisplacement(undisplaced);
  vec3 seaNormal;
  float jacobian;
  gerstnerSurface(undisplaced, seaNormal, jacobian);

  // The wake's own elevation raises the ribbon and never lowers it.
  //
  // This strip is a decal on a sea that has already been drawn, and a trough that carries the
  // decal below the water it lies on is depth-culled by that water — which puts a hard straight
  // edge across the wake at the first transverse trough. It did exactly that: the first trough of
  // a four-metre-a-second wake is five metres astern, and that is precisely where the edge was.
  // The full signed elevation still feeds the slope below, so both faces of every crest catch the
  // light; only the geometry is one-sided.
  vec3 world = vec3(
      undisplaced.x + sea.x,
      uWaterLevel + sea.y + max(elevation, 0.0) + uLift,
      undisplaced.y + sea.z);

  // Compose the wake's slope onto the swell's normal. Astern is −along and outboard is +across,
  // so the two parametric derivatives resolve into world XZ with one rotation each.
  vec2 gradient = slopeAlong * (-along) + slopeAcross * across;
  vNormal = normalize(vec3(
      seaNormal.x - gradient.x * seaNormal.y,
      seaNormal.y,
      seaNormal.z - gradient.y * seaNormal.y));

  // ------------------------------------------------------------------------------------- foam
  //
  // Two patches of white water, and they are different things. The near field behind the
  // transom is the propeller's race and the air the hull dragged under with it: bright, roughly
  // beam-wide and gone within a couple of boat lengths. The cusp lines are the divergent crests
  // breaking as they overtake one another, which is why they stay visible far longer and far
  // further out than the race does. Both emerge from *under* the transom rather than switching
  // on at it — there is no foam ahead of the water that made it.
  float emerging = smoothstep(0.0, 1.4, behind);
  // The race is roughly the width of the propeller's disc, not of the wedge, and it is spent
  // within a boat length or two. Drawn as wide as the wedge and as long as the whole ribbon it
  // stops being a race at all and becomes a slab of white paint with a V-shaped outline.
  float race = emerging * (1.0 - smoothstep(0.8, 8.0, behind))
      * (1.0 - smoothstep(uHalfBeam * 0.3, uHalfBeam * 1.15, distanceAcross));
  // The cusp lines carry the shape. They are also what a real wake is recognised by, so they are
  // the term to spend coverage on: narrow, bright, and lasting far longer than the race.
  float cusp = emerging * smoothstep(0.62, 0.99, abs(lateral)) * (1.0 - smoothstep(4.0, 55.0, behind));
  vFoam = clamp(race * 0.8 + cusp * 0.85, 0.0, 1.0) * drive * envelope;

  vWorldPosition = world;
  vUndisplaced = undisplaced;
  vFade = envelope * drive;

  // The ocean drops its projected vertices by d²/2R so that the mesh's own silhouette is the
  // horizon. A decal lying on that surface has to be dropped by the same amount or it climbs
  // out of it with range: at half a kilometre the divergence is already comparable to the lift
  // this ribbon rides on. Only the projection moves, exactly as in `ocean.vert` — the world
  // position the fragment shader shades from stays on the plane.
  float horizontal = distance(world.xz, cameraPosition.xz);
  vec3 projected = vec3(world.x, world.y - (horizontal * horizontal) / (2.0 * EARTH_RADIUS_M), world.z);

  gl_Position = projectionMatrix * viewMatrix * vec4(projected, 1.0);
}
