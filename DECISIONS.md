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
