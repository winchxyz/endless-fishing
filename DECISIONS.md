# DECISIONS.md

Every ambiguity in the brief resolved here, with the reasoning. Newest phase last.

---

## Phase 0

### 1. Renderer: **WebGL2 (`THREE.WebGLRenderer`)** — decided, committed, single code path

The brief says "default to WebGPU + TSL if the current Three.js release supports everything
this spec needs". It does not, and the blockers are in the spec itself rather than in
three.js:

1. **`postprocessing` (pmndrs) is WebGL-only.** v6.39.4 builds its `EffectComposer` on
   `WebGLRenderTarget`, `ShaderMaterial` and `renderer.getContext()`. It cannot drive a
   `WebGPURenderer`. The spec names this library explicitly and §10 specifies a precise,
   toggleable chain (bloom → GTAO → DoF → god rays → motion blur → LUT → SMAA → vignette /
   grain / CA) that pmndrs gives us for free and which would otherwise be a from-scratch
   TSL post stack — days of work with no visual upside.
2. **The spec forbids shaders as template strings in TS.** TSL *is* shader code written in
   TypeScript. Going WebGPU means every line of ocean, sky, cloud and water shading moves
   into `.ts` node graphs, and `vite-plugin-glsl` plus the entire `src/shaders/` tree
   disappears. Those two rules are in direct contradiction; the `.glsl` rule is stated as a
   hard rule with a "**never**", so it wins.
3. **Reach.** Ocean glitter and cloud raymarching are heavy, and this must run for anyone
   who opens the link. WebGL2 is ~97% of desktop browsers; WebGPU is still absent from
   Firefox-on-Linux and Safari < 18, and is behind flags in several Chromium builds.
   The brief demands a live public URL that works.

What we give up: a true Tessendorf FFT ocean via compute. Mitigation — the Gerstner bank is
**not** hand-tuned. Amplitudes, wavenumbers and directions are sampled from a real JONSWAP
spectrum parameterised by wind speed and fetch, with a directional spreading function, so the
sea has correct statistics (significant wave height, peak period, spread) even though it is a
finite sum. Non-repetition comes from irrational frequency ratios plus two scrolling detail
normal scales; there is no visible tile period.

A WebGPU capability probe runs at boot and its result is logged to the debug panel, so the
decision can be revisited when pmndrs ships a WebGPU backend.

### 2. `noUncheckedIndexedAccess` on

Costs a few guards, but the star catalogue, wave bank and probe arrays are all index-heavy
and this is exactly where an off-by-one silently produces `NaN` positions that propagate into
the whole scene as a black screen. Worth it.

### 3. Fixed-step simulation at 120 Hz, decoupled from render

Buoyancy with 10 probes and stiff spring-like restoring forces is not stable at a variable
32–144 Hz timestep. Sim runs at a fixed 1/120 s with an accumulator and a max of 6
substeps per frame (spiral-of-death guard); rendering interpolates. This is also what makes
the boat feel heavy rather than floaty.

### 4. Default location 32.08 N / 34.78 E (Tel Aviv), per the brief's fallback chain

Geolocation is requested non-blockingly; the game starts immediately at the timezone-inferred
guess and snaps to the real position when/if permission is granted.

### 5. Assets are fetched, never committed

`assets/` is git-ignored. `npm run assets` is manifest-driven with SHA-256 verification, so a
fresh clone reproduces the exact byte content or fails loudly. Poly Haven and ambientCG both
publish stable CDN URLs and are CC0; NASA/USGS imagery is public domain. No scraping.

### 6. HDRI sun position is *derived*, not hand-entered

The brief asks that each sky's baked sun azimuth be recorded as metadata so the environment
map can be rotated to match the live ephemeris. Typing those numbers in by eye would be the
obvious approach and would be wrong by several degrees.

Instead, `fetch-assets.ts` pulls each panorama's **shooting coordinates and capture timestamp**
from the Poly Haven API, and the runtime feeds those straight into the same NOAA solar solver
that drives the live sun. The baked sun's altitude and azimuth are therefore computed from
first principles, to the same 0.01° accuracy as everything else in the sky. Two skies —
`mud_road_puresky` and `wasteland_clouds_puresky` — were dropped from the manifest for the sole
reason that Poly Haven has no coordinates for them, and a sky whose sun position we cannot
derive is a sky we cannot align.

### 7. Sky resolutions: 2k hero / 1k secondary, not 4k–8k

Eighteen panoramas at 4k is 300 MB+, twice the stated download budget on its own. The tiered
choice lands the whole asset set at **131 MB downloaded, 103 MB on disk** — inside budget with
room for the moon and star data.

This costs nothing visually *in this pipeline* because the HDRI is not the visible sky. The
visible sky is the analytic Rayleigh/Mie model plus the volumetric cloud layer plus the analytic
sun and moon discs, all at full resolution. The panorama supplies image-based lighting, the
horizon gradient and low-frequency cloud colour — and the PMREM probe it feeds never samples
above 256². `npm run assets -- --hq` fetches the 4k/2k set for local hero renders.

### 8. No CC0 cumulonimbus sky exists, so the storm sky is volumetric

Poly Haven has no pure-sky panorama of a towering storm cell (and the closest candidates lack
the shooting metadata above). The storm state therefore uses `kloofendal_overcast_puresky` as its
image-based lighting base — dark, flat, desaturated, which is the *correct lighting* for a storm —
and gets its cloud structure entirely from the volumetric system. This is the better answer
regardless: a baked panorama cannot show a squall line visibly crossing the water towards you,
and that is the shot the storm state is for.

### 9. Milky Way: procedural in galactic coordinates, not the NASA panorama

NASA's *Deep Star Maps 2020* is public domain and would have been the obvious source, but the
smallest published variant is a 36 MB 4k EXR — a quarter of the entire download budget for a
faint, low-frequency band that is only visible on clear moonless nights.

We render it instead as a procedural band placed in **true galactic coordinates**
(`astro/Coordinates.ts` implements the IAU galactic pole transform), driven through the same
equatorial→horizontal conversion as the star catalogue. It therefore sits exactly where the real
one does, tilts correctly through the night, costs nothing to download, and — unlike a baked
panorama — responds properly to the exposure and grading pipeline. The same argument applies to
foam, the two scales of ocean detail normal, fish scales and the caustic pattern: all
procedural, all noted in `assets/CREDITS.md`.

### 10. Textures ship as packed WebP, not KTX2/Basis

The brief asks for KTX2/Basis. Encoding to Basis requires a native toolchain (`toktx` or
`basisu`) that is not installable in this build environment, and the pure-JS encoders are
unaudited and slow. `process-textures.ts` therefore does everything else the brief asks —
power-of-two resize, ORM channel packing (occlusion→R, roughness→G, metalness→B), mipmaps,
device-max anisotropy — and emits WebP.

The cost is GPU memory rather than download size, and at our budget it does not bite: eleven
1K materials at four maps each is roughly 250 MB of VRAM with mipmaps, against a 1 GB ceiling.
The `KTX2Loader` is already wired into `ResourceManager`, so switching over is a one-line change
to the manifest if a toolchain becomes available.

### 11. `@types/three` as a devDependency

three r185 ships no type declarations of its own. `@types/three@0.185.1` is version-matched and
is the only way to keep `strict` meaningful across the renderer layer.

---

## Phase 1

### 12. Rise/set search windows are anchored on local *solar* midnight

The first implementation anchored the 24-hour search window on the browser's calendar day. That
is correct only when the player's timezone matches the longitude they are fishing at — and the
settings panel lets them put the boat anywhere. At Quito with an Israeli system clock the window
straddled the wrong solar day and returned a sunset that preceded its own sunrise.

The window is now `[local solar midnight, +24 h]`, computed from longitude alone, which contains
exactly one solar noon everywhere on Earth and is independent of the machine's clock settings.

### 13. The lunar rise threshold is topocentric, not geocentric

The textbook moonrise threshold `h₀ = 0.7275·π − 34′` folds the parallax correction *in*, because
it is meant to be compared against a **geocentric** altitude. We compute a topocentric altitude
(the Moon is close enough that the observer's offset from Earth's centre matters), so applying
that threshold double-counted the parallax — about 0.9° of altitude, or four minutes of moonrise.

Against a topocentric altitude the threshold is simply "upper limb on the refracted horizon":
`−(semidiameter + 34′)`. This was caught by cross-checking against the US Naval Observatory,
which is exactly why that check is in the repo.

### 14. Refraction: two formulae, used in opposite directions

Bennett converts *apparent* altitude to refraction; Sæmundsson converts *true* altitude to
refraction. They are not interchangeable — at the horizon they differ by 5.5′, which is three
minutes of sunset. Both are implemented, the tests assert they are mutual inverses, and the
call sites are annotated with which question they are asking.

### Phase 1 verification result

Cross-checked against the **US Naval Observatory** `rstt/oneday` tables at two locations chosen
to be awkward in different ways. Every event matched **to the minute**:

| | Tel Aviv 2026-07-30 | | Reykjavík 2026-12-21 (solstice, 64°N) | |
|---|---|---|---|---|
| | ours | USNO | ours | USNO |
| Civil dawn | 05:28 | 05:28 | 10:03 | 10:03 |
| Sunrise | 05:55 | 05:55 | 11:22 | 11:22 |
| Transit | 12:47 | 12:47 | 13:26 | 13:26 |
| Sunset | 19:40 | 19:40 | 15:29 | 15:29 |
| Civil dusk | 20:06 | 20:06 | 16:49 | 16:49 |
| Moonrise | 20:20 | 20:20 | 12:32 | 12:32 |
| Moonset | 06:25 | 06:25 | 08:42 | 08:42 |
| Illuminated | 99.4% | 99% | 90.3% | 90% |

Frozen as a regression test in `test/astronomy.test.ts`. Reproduce with
`npx tsx scripts/almanac-check.ts 2026-07-30 32.08 34.78 3`.

---

## Phase 2 — Sky

### 15. Hillaire's LUT atmosphere, not Preetham or a gradient

Three tables — transmittance (256×64), multiple scattering (32×32), sky view (192×108) — with
ozone absorption and a multiple-scattering term. The first two depend only on the medium and
are built once; only the sky-view table is rebuilt, and only when the solar altitude moves more
than 0.15°, which at real time is about once every forty seconds.

Two things justify the complexity over an analytic Preetham fit. **Ozone** absorbs in the
Chappuis band and sits in a layer around 25 km; at noon it is negligible, but at twilight the
light path runs hundreds of kilometres through it and it is the entire reason the zenith goes
deep blue rather than muddy brown. **Multiple scattering** is what fills the shadows on an
overcast day; single scattering alone leaves a sky that is far too dark near the horizon.

Earth's shadow and the Belt of Venus are not drawn and not special-cased. They emerge from the
integral, because looking east at dusk the lower samples along the view ray have the sun below
their own local horizon and contribute nothing while the higher ones still catch it.

### 16. The HDRI modulates the analytic sky; it never replaces it

Each panorama is divided by its own measured mean luminance, making it a dimensionless field
averaging 1 — cloud shapes with the exposure of the day it was shot stripped out. That field
then *multiplies* the analytic sky. So absolute luminance, twilight colour and the horizon
gradient stay driven by the real solar altitude, while the cloud structure comes from a
photograph of real clouds. It also means a sky shot at noon in South Africa is legitimately
usable at dusk in the North Sea: only its shapes survive.

The baked sun is not masked by position — it is compressed by a soft luminance knee well above
ordinary cloud brightness, so sky and cloud pass through untouched and the solar blob is
crushed to something the analytic disc can be drawn over.

### 17. Lunar libration is implemented

Meeus ch. 53, optical terms. The Moon nods ±7.6° in longitude and ±6.7° in latitude over a
month, which visibly swings features around the limb; over a lunation you see 59% of the
surface. Physical libration (a further 0.02°) is not implemented — at a disc half a degree
across it is a fraction of a pixel and would cost eighteen more coefficients.

The disc is shaded with **Lommel-Seeliger**, not Lambert. Regolith backscatters strongly, which
is why a full moon reads as a flat bright disc; Lambert would put a dark ring around the limb
that appears in no photograph.

### 18. The Milky Way is procedural, in true galactic coordinates

See §9 for why it is not the NASA panorama. The band is placed by the IAU galactic pole
transform, so it sits exactly where the real one does and tilts correctly through the night.
Structure is a disc profile, a Sagittarius bulge, fBm star-cloud clumping, and the Great Rift
subtracted rather than multiplied so the dust lanes cut hard-edged voids.

### 19. Water reflects the raw cubemap, materials read the PMREM

The environment probe exposes both. Water is very nearly a mirror and a roughness-prefiltered
lookup would blur away exactly the horizon detail the reflection is made of, so the ocean picks
its own mip level from its own roughness. PBR materials get the PMREM output as
`scene.environment`.

---

## Phase 3 — Ocean

### 20. Waves are sampled from JONSWAP, never hand-tuned

Amplitudes, wavenumbers and directions are importance-sampled from a JONSWAP spectrum
parameterised by wind speed and fetch, with a cos^2s directional spreading function whose
exponent is tied to the Beaufort force — a young sea under a rising wind is short-crested and
confused, a long-fetch swell is organised. Significant wave height and peak period are *read
off* the resulting bank rather than chosen, so the HUD and the boat's handling model learn the
sea state from the spectrum.

Non-repetition comes from irrational frequency jitter: with commensurate frequencies the
surface returns to its starting configuration on a fixed cycle, and on open water that pulse is
very visible.

### 21. CPU/GPU parity is verified on the GPU, not mocked

`math/Gerstner.ts` and `shaders/lib/gerstner.glsl` are hand-mirrored. A vitest unit test could
only compare the TypeScript against itself, so instead `npm run verify` renders
`gerstnerDisplacement` for 4096 sample points into a float target, reads it back, and compares
against the CPU evaluation. **Measured agreement: 0.0059 mm maximum, 0.0012 mm RMS.** The build
fails above 1 mm.

### 22. One draw call for the whole sea

The clipmap is merged into a single buffer with per-vertex cell size and ring extent, rather
than one mesh per level. Levels snap to their own lattices in the vertex shader (without which
the mesh crawls beneath the wave field as the boat moves) and geomorph towards the next coarser
lattice over their outer quarter, so by the shared boundary the two levels sit on the same
lattice — which closes the T-junction cracks and removes the popping in one mechanism.

---

## Phase 5 — brought forward

### 23. Tone mapping had to move to the composer before anything was viewable

`ShaderMaterial` does not include three's tone-mapping chunk, so a custom shader writing
physical radiance goes straight to the framebuffer and clips. The scene is authored in real
units — the sky is thousands of cd/m² at noon and hundredths at night — so the post chain is
not a polish pass here, it is the only thing that makes the image exist. It was implemented in
phase 3 rather than phase 5 for that reason.

Order is exposure → bloom → ACES → grade → lens artefacts → SMAA. Exposure first so the bloom
threshold can be stated as "brighter than diffuse white" instead of in absolute nits; SMAA last
because antialiasing belongs in display-referred space.

### 24. Physical radiance is clamped to 60000 before it reaches a half-float buffer

The solar disc is genuinely about 1.6×10⁹ cd/m². A half float tops out at 65504, so the true
value stores as `Infinity` — and the bloom pass then averages that infinity down its mip chain
and returns a white frame, every pixel. 60000 is roughly four stops above a correctly exposed
white at any time of day, which is all the headroom ACES and the bloom threshold can use; after
tone mapping nothing downstream can distinguish it from the true value.

---

## Phase 10 — finishing

### 25. The sea is curved, and it reaches past the horizon

A flat sea plane can never reach the horizon. Its far edge sits at a depression of
`atan(eyeHeight / radius)` and the true horizon is at `sqrt(2·eyeHeight / R)`; for any finite
plane the first is the larger, so a wedge of below-horizon sky shows between the water and the
sky, all the way round the compass. That wedge was the orange band that survived two sessions of
diagnosis: about one pixel on the High preset, fourteen on Low, eight from the orbit camera, and
reddened because the light reaching it has come through the whole atmosphere on the slant.

Both halves of the fix are physical. Each ocean vertex is dropped by `d²/2R` in the projected
position only — `vWorldPosition` stays on the plane, because it feeds the crest-height and
view-direction terms and a swell eight kilometres out must not read as five metres below mean
water level. And the clipmap is extended until it covers the horizon of the highest eye the
camera can reach, which with curvature applied is self-limiting: beyond `sqrt(2·h·R)` the surface
folds away and hides itself behind nearer water. The mesh's own silhouette is then the horizon.
It costs about 400k triangles, all of them beyond a kilometre, and no measurable frame time.

### 26. Emissive lamps are metered, not absolute

Everything else in this project is in real units, and the navigation lights are not. A lantern's
lens sits around 6000 cd/m², which at the exposure a moonless sea needs is two million times
white; with no lens model in the chain, bloom turns a centimetre of glass into a white disc a
third of the frame across. Nor does any fixed radiance work, because the exposure between civil
twilight and midnight moves by a factor of a hundred: a constant that reads as a lamp at one is
invisible or overwhelming at the other. A photographer with a light in shot stops down for it;
this frame cannot, because the same image has to keep a sea lit by airglow readable.

So the lamps are given a fixed number of stops over whatever the meter settled on. It is the same
class of decision as the exposure controller itself, and it is the one place in the renderer where
a quantity is display-referred by design rather than by accident. The ratios between masthead,
sidelight and lantern are the real ones.

### 27. README media is committed; captured frames are not

`screenshots/` is git-ignored because captured frames are build output. But a README on GitHub
cannot fetch anything that is not in the repository, and the brief asks for a media matrix, so
`docs/media/` is committed — seven stills at 800 px and one animation at 480 px, about a megabyte
in total. `scripts/media.ts` is the only thing that writes them, so the pictures in the README
cannot drift from what the renderer actually produces: re-run it and the README is current by
construction. The asset pipeline's rule that nothing binary is committed is about *downloaded*
assets, which are still fetched, checksummed and credited rather than vendored.

### 28. Weather that is published has to be drawn

`WorldState` has carried `precipitation` and `visibility` since the weather model was written, and
for just as long neither of them put anything on the screen. Precipitation darkened the underside
of the cloud deck, opened the rain bed in the audio mix and desaturated the grade; visibility went
to `terrain.frag` and the cloud march and nowhere else. So a pinned storm arrived with a Beaufort 9
sea, 1.4 km of visibility, rain on the soundtrack, a clear view of nothing falling, and a horizon
you could have used as a straightedge. The numbers were right and the frame did not show them.

Three things close it, and each is the same principle: the renderer consumes the figure the model
publishes rather than a look tuned to resemble it.

**Rain is a lattice, not a particle system.** A drop reaches terminal velocity within about two
metres of the cloud base and holds it, so every drop in the sky has the same velocity — wind plus
fall — and the field is one rigid lattice translating through the camera. No per-particle state, no
respawn, no sort: one instanced draw call and one uniform a frame. The streak is the shutter, so
its length and its lean are `velocity × 1/48 s` and follow the wind for free. The count is the one
number that is a budget rather than a measurement, and `world/Rain.ts` says so.

**The sea is fogged like everything else.** `ocean.frag` had no aerial perspective, on the argument
that water already shows the sky. It does not: at anything steeper than grazing the sea is far
darker than the sky it reflects, so with no extinction it stays that dark to the horizon. Same
Koschmieder law, same air light, and a sea fog now closes in.

**Far foam converges on the measured coverage, not on zero.** Past a couple of kilometres one
clipmap vertex spans hundreds of metres and the Jacobian it carries is a point sample, so an
individual whitecap drawn from it is a hundred-metre dash. Fading it out took the whitecaps off a
force 9 sea from three kilometres — most of the sea. What a distant sea shows is not the crest but
the fraction of surface that is white, and Monahan and O'Muircheartaigh measured that:
W = 3.84e-6·U10^3.41, one part in six hundred at force 4 and sixteen per cent at force 9. The mask
converges on that. It is also the stable answer, because a constant cannot flash.

### 29. Air light is the sky, and the probe is not only sky

Every fogged surface fades towards `ef_airLight`, and that used to be a mip-4 fetch of the
environment cube along the view ray. The cube is a picture of the whole world, and its lower
hemisphere is water — so fogging a distant object meant fading it towards a colour that was itself
half sea. A 120 m fog still drew a horizon forty code values deep.

The fix is two clamps and they are both geometry, not taste. The elevation is held four degrees
above the horizon, because air light over open water *is* the sky just above the horizon. And the
mip is 1 rather than 4: level 4 averages a sixty-degree cone, which puts the water straight back in
however the direction is clamped, and level 0 is a seven-tenths-of-a-degree texel — about the size
of the sun, which is a delta function the cube cannot represent and whose whole energy one texel
therefore carries. Level 1 spreads that over four times the area and stays clear of the horizon
row. One definition, in `lib/airlight.glsl`, used by the ocean and by `ef_aerialPerspective`.

### 30. The exposure meter reads a ring, not a meridian

The sky-view table is parameterised on azimuth measured **from the sun**, so `u = 0.5` is the
anti-solar point. The meter sampled three texels there. At noon that is harmless; at twilight the
western horizon runs an order of magnitude above the eastern one, so the meter was reading the
darkest line in the sky, opening up for it, and pushing the bright half through white. Civil
twilight came out a flat magenta wash with no gradient in it — the sky metering 1.53 where a
photographer would have put it near 0.7, and ACES turning the clipped warm highlight magenta.

Each sample is now the mean of a whole row: a full turn of azimuth, read with one
`readRenderTargetPixels` into a buffer allocated once. A row read costs the same single pipeline
flush that reading one texel costs, so the exact hemispherical average is cheaper here than four
more point samples would have been.

### 31. A binary shadow test inside a raymarch is a staircase

The sky-view march tested whether each sample could see the sun with `intersectsGround`, at the
segment's midpoint. That makes every segment all-lit or all-shadowed, so at twilight — the only
time the Earth's shadow crosses a view ray — the integral jumps by one whole segment's worth the
moment the boundary passes a midpoint. Tilt the ray a fraction of a degree and it lands on a
different segment. The sky comes out in thirty flat blocks up the dome.

The instructive part is what does *not* fix it. Not a four-times-larger sky-view table, not a
four-times-larger multiple-scattering table, not manual bilinear filtering in the fragment shader,
not a triangular-PDF dither at the output — because none of them changes the fact that the
quantity being interpolated is a staircase. Nor does softening the test with a `smoothstep`: the
march distributes its segments quadratically, so they run from a few hundred metres near the
observer to tens of kilometres at the top, and a single transition width is far too wide for the
near ones and far too narrow for the far ones. That shifts the balance between the reddened low
samples and the blue high ones, and the whole sky goes orange.

What works is to stop sampling the step function and integrate it. The sun's elevation above a
point's own local horizon is very nearly linear across one segment, so the sunlit fraction is
simply where that line crosses zero — the exact integral of the binary test over the segment. No
bias, no width to tune, and it scales with the segment automatically. Two extra `length` calls per
step, in a table that rebuilds when the sun moves 0.15 degrees.

The step count is floored at 32 for the same reason: the table is not a per-frame cost, so tying
its accuracy to a per-frame quality knob buys nothing.

