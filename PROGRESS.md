# PROGRESS.md

## Measured, on an RTX 4070 Laptop

| | |
|---|---|
| Frame rate | **60 FPS locked**, 1080p, High preset |
| Draw calls | **157** against a budget of 300 |
| Triangles | 896,101 (the ocean now reaches past the horizon; see below) |
| Tests | **199 passing** |
| CPU/GPU wave parity | 0.0059 mm max, 0.0012 mm RMS over 4096 points |
| Sky luminance at solar noon | 2784 cd/m² zenith, 8424 cd/m² horizon |
| Exposure across a day | 4.8e-5 at noon → 341 on a moonless night, metered, never modelled |
| Astronomy | every rise/set/transit matches the **US Naval Observatory to the minute** |
| Asset payload | 131 MB downloaded / 103 MB on disk / 67 MB shipped |

## Complete

**Phase 0 — Scaffold.** Vite 8 + TypeScript strict. Renderer decision made and committed:
WebGL2, because the brief's own hard rules (pmndrs `postprocessing`, shaders in `.glsl` files)
are both WebGL-only. Engine with a fixed 120 Hz sim and a variable render, polled input,
reactive settings whose four presets literally encode the degradation priority, resource
manager with a disposal ledger. Manifest-driven, checksum-locked CC0 asset pipeline.

**Phase 1 — Astronomy.** NOAA solar position, full 60+60-term ELP-2000/82 lunar theory with
topocentric parallax, bright-limb position angle and optical libration. Verified against
published USNO tables at two locations, including 64°N on the winter solstice. That check found
two real bugs.

**Phase 2 — Sky.** Hillaire LUT atmosphere with ozone and multiple scattering. 18 CC0 pure-sky
panoramas whose baked sun positions are *derived* from their shooting coordinates by the same
solver that drives the live sun. Moon disc with real NASA albedo, LOLA relief, libration,
Lommel-Seeliger limb and earthshine. 8404-star field in one draw call. Procedural Milky Way in
true galactic coordinates.

**Phase 3 — Ocean.** One draw call for the whole sea. JONSWAP-sampled Gerstner bank, nothing
hand-tuned. CPU/GPU parity proven on the real driver.

**Phase 4 — Boat.** 27 procedural parts, hull lofted from the same form the solver uses.
Two real defects found and analytically corrected: the probe quadrature was losing two-thirds of
the righting moment, and buoyancy acting at the keel trimmed the hull 7° by the head.

**Phase 5 — Post.** Exposure, bloom, ACES, the per-regime grade, vignette, grain and SMAA, in
that order and in the pass structure the effects actually require.

**Phases 6–9 — The game.** Fishing loop, bite model, fight model, species table, progression,
inventory, journal. Fish, schools, seabed and an underwater pass. Islands, props and vegetation
on a shared heightfield. A genuine synoptic weather model: fBm pressure field, geostrophic wind
with real Coriolis, states as a classification *of* the field, with cloud shadows on the water.

**Phase 10 — Motion, sound and session.** The wake and bow spray, the audio beds, save
persistence, the catch card and the colour grade. See below.

## This pass

Ten open bugs closed, each verified on a rendered frame before it was called done.

1. **The orange horizon band.** Not the clouds, not the panoramas, not chromatic aberration
   alone. A flat sea plane can never reach the horizon: its far edge sits at a depression of
   `atan(eye/radius)` and the true horizon is at `sqrt(2·eye/R)`, and for any finite plane the
   first is larger — so a wedge of below-horizon sky showed between the water and the sky, right
   round the compass. About a pixel on High, fourteen on Low, eight from the orbit camera. Fixed
   by curving the sea (`d²/2R` on the projected vertex only) and extending the clipmap past the
   horizon of the highest eye the camera can reach, so the mesh's own silhouette *is* the
   horizon. The sky dome now also carries its horizon radiance below the horizon, because the
   environment cubemap's lower hemisphere is sampled by the water's grazing reflection through a
   mip chain several degrees wide.
2. **The blown-out night.** The exposure meter reads the sky-view table, which is built for the
   sun alone and is exactly zero after dark — so it never saw the airglow and moonlight the
   fragment shader adds on top, opened up to an exposure of 8149, and rendered midnight as a
   white frame. The floor is now metered. Adaptation also stops at 6e-3 lux, because dark
   adaptation saturates and an eye has a maximum gain. Two further night defects fell out of
   looking at the frame: the **Milky Way was drawn at 1.0 cd/m²**, four thousand times its real
   21.5 mag/arcsec² surface brightness, blowing a third of the sky to flat white; and the
   **star catalogue was in the environment probe**, where one point source occupies a whole
   texel of a 128-pixel cube face and the water reflected it off every wave facet.
3. **The moon's glitter path.** The GGX lobe was narrower than the half-degree disc lighting it,
   which packs the whole of the source's energy into a highlight smaller than the source — a
   factor of sixteen on a near-mirror sea. Karis' sphere-light widening, with the
   `(α/α′)²` renormalisation, fixes it at the source, and the meter's specular allowance came
   down from 5 to 1 because it had been compensating for this.
4. **Motion is invisible.** `Wake` written: a ribbon carrying both Kelvin wave systems, laid on
   the same Gerstner bank the ocean uses, plus a GPU bow-spray system emitting as the cube of
   speed. The boat makes 6.2 knots at full throttle and now looks like it.
5. **No audio.** `AudioBeds` written and instantiated: sea, wind, engine, hull slap, rain,
   distance-delayed thunder, an underwater low-pass and the tackle. Silent until the first
   gesture, because a Web Audio context created outside one logs a warning.
6. **Save did not persist.** Wired, debounced, versioned, and written on `pagehide` as well.
7. **The catch card never appeared.** Wired, with the journal written *after* the personal-best
   flag is read — otherwise every fish is a personal best.
8. **The cloud NaN.** Root cause found, and it was not where the guard had been put.
   `hdrClamp`'s NaN scrub was `mix(colour, 0, vec3(notEqual(...)))`, which selects mix's FLOAT
   overload — `NaN*0.0 + 0.0*1.0` is still NaN. It reads like a select and is not one. The mint
   was a 0/0 in `remap` where `1.0 - cover` rounds to exactly 1.0 for any cover below 2⁻²⁵, and
   the escape hatch was `ef_lightDepth`, the one consumer of `ef_cloudDensity` with no density
   test. All three fixed.
9. **The cloud band at the horizon.** Also not where it looked: `tFar = min(shellExit, 62 km)` is
   a limit on *coverage*, and it culled the whole deck below the elevation at which `tNear`
   passed the limit — 0.597° for a cumulus base, identically at every azimuth. Capping the
   marched **span** instead keeps `tFar > tNear` unconditionally and nothing is ever culled.
10. **Weather opened pinned.** The pressure field now seeds itself under a ridge whatever the
    world seed is, so the override is gone and all eight states are reachable in normal play.
11. **The bright line on the night horizon.** Not the water, which is where four rounds of work
    looked: repainting every ocean fragment black left the line exactly where it was, one row of
    sky above the sea's silhouette. It is the cloud march's aerial perspective. `ef_skyRadiance`
    read the sky-view table with the raw ray direction, and the two horizon tests in that shader
    do not agree to the microradian — `ef_hitsSea` uses the sea sphere through the camera's own
    height, `intersectsGround` uses `GROUND_RADIUS` plus the observer altitude — so a band a
    couple of milliradians deep, three pixels at this field of view, cleared the water and still
    parameterised as below the horizon. There the table folds onto its ground-intersecting branch
    and returns whatever the last write left. Those rays run a hundred and thirty kilometres, so
    the fade replaces essentially all of their colour with that sample, and wherever cloud lay
    along one, a cell-wide segment came back at sixty thousand candelas against a night sky of
    2e-4. Clamping the elevation at the horizon fixes it: peak in the horizon band falls from
    254.6 to 20, and the brightest pixel in the frame is now a first-magnitude star.
12. **The weather was published and not drawn.** `precipitation` darkened the cloud base,
    collapsed the visibility, opened the rain bed in the audio mix and desaturated the grade, and
    nothing put a drop on the screen; the sea had no aerial perspective at all, so a 120 m fog
    drew a horizon you could use as a straightedge; and the foam faded to nothing beyond three
    kilometres, which took the whitecaps off a force 9 sea from three kilometres out. `world/Rain`
    draws the drops, `ef_airLight` fogs the water on the same Koschmieder law as everything else,
    and the far foam converges on Monahan's measured whitecap coverage instead of on zero.
13. **The meter was reading the darkest meridian in the sky.** The sky-view table is
    parameterised on azimuth *from the sun*, and the exposure meter sampled three texels at
    `u = 0.5` — the anti-solar line. At twilight the western horizon runs an order of magnitude
    above the eastern one, so the meter opened up for the dark half and pushed the bright half
    through white: civil twilight rendered as a flat magenta wash with no gradient in it, sky at
    1.53 where a photographer would put it near 0.7. Each sample is now the mean of a whole row,
    which is a full turn of azimuth and the same single pipeline flush.
14. **The twilight sky came out in blocks.** Thirty flat bands up the dome, edges on the
    sky-view table's own texel grid, in every frame between sunset and full dark. It survived a
    four-times-larger table, a four-times-larger multiple-scattering table, manual bilinear
    filtering in the shader and a triangular-PDF output dither — because what was being filtered
    was itself a staircase. `skyview.frag` tested `intersectsGround` at each march segment's
    *midpoint*, so a segment was all-lit or all-shadowed and the integral jumped by one whole
    segment the moment the Earth's shadow crossed a midpoint. The elevation of the sun above a
    sample's own local horizon is very nearly linear across one segment, so the lit fraction is
    just where that line crosses zero: exact, unbiased, and it scales with the segment
    automatically. A fixed-width `smoothstep` does *not* work — the segments are quadratically
    distributed and span hundreds of metres to tens of kilometres, so one width shifts the balance
    between the reddened low samples and the blue high ones and turns the sky orange.

## Known issues

1. **No depth of field, GTAO, god rays or motion blur.** Each is a convolution effect needing a
   full-screen pass of its own; CLAUDE.md's degradation priority lists DoF and motion blur among
   the first things to cut, and a circle of confusion tuned for the boat smears a horizon that has
   no depth discontinuity to key off. The grade — which the priority list *does* protect — went in
   instead.
2. **One driver note in dev builds.** ANGLE's D3D backend emits an X4122 advisory about
   three's own PMREM prefilter shader, and three prints any non-empty program info log as a
   warning. It is absent from production builds, where `checkShaderErrors` is off, and
   `npm run verify` now reports it separately from real console issues rather than failing on it.
   Anything containing `ERROR:` still fails the run.
3. **`Fish`, `Weather`, `BoatGeometry` and several others are over the ~450-line smell
   threshold.** `AudioBeds` has been split into it and `AudioCurves`; the older ones have not.
