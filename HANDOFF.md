# HANDOFF.md

**For a fresh session. Read this file first, then `CLAUDE.md`, then `DECISIONS.md`.**

The ten bugs the previous handoff listed are closed. What follows is what you need to know to
work on this repository, not a to-do list — for what is still open, see the end of
`PROGRESS.md`.

---

## Live site

**https://winchxyz.github.io/endless-fishing/** — GitHub repo `winchxyz/endless-fishing`.

Deployed by building and force-pushing `dist` to the `gh-pages` branch:

```bash
VITE_BASE=/endless-fishing/ npm run build
cd dist && git init -b gh-pages && git add -A && git commit -m "Deploy"
git push -f https://github.com/winchxyz/endless-fishing.git HEAD:gh-pages
```

`.github/workflows/deploy.yml` exists on disk but **is not in the repo** — the token has `repo`
scope but not `workflow`, so GitHub rejects any push containing it. To enable proper CI:
`gh auth refresh -s workflow`, then commit the file and switch Pages source to Actions.

## Build

```bash
npm install && npm run assets && npm run textures
npm run test:run     # 199 tests
npm run build        # zero errors, zero warnings
npm run dev
```

**`npm run verify` previews `dist/`; it does not build.** It starts `vite preview`, so it checks
whatever was last built rather than what is on disk — run `npm run build` first or you will spend
three minutes verifying an old bundle. It also therefore runs a PRODUCTION build, where
`renderer.debug.checkShaderErrors` is off, which is why the driver's PMREM note appears in `dev`
and not there.

## Looking at frames

**Verify every visual change on a rendered frame before you call it done.** `scripts/probe.ts` is
the tool; it is worth reading its flags before you start.

```bash
npx tsx scripts/probe.ts --times=2026-06-21T16:10:00Z,2026-06-21T21:30:00Z --tag=look
npx tsx scripts/probe.ts --hold=w --settle=40000 --tag=wake        # under way
npx tsx scripts/probe.ts --graphics='{"bloomEnabled":false}'       # one effect at a time
npx tsx scripts/probe.ts --weather=storm --at=64.15,-21.94         # somewhere else, in weather
```

It boots the dev server once, captures every moment you list inside a single browser session, and
writes for each one the frame, a **4× zoom of the horizon**, and a JSON line carrying the
photometry, the helm and the frame stats. A one-pixel artefact on a 1080-line frame is invisible
in a thumbnail and obvious in that crop, and that is exactly how the horizon band survived two
sessions.

Three things that will cost you time if you do not know them:

1. **Do not edit source while a probe is running.** Vite pushes a full reload, the page loses the
   time override and every held key, and you get a frame of a stationary boat at the wrong hour
   with no indication anything went wrong. Two rounds of analysis were spent on frames ruined
   this way.
2. **The probe claims port 5199 with `--strictPort`.** Vite silently walks to the next free port
   when its default is taken, and a probe that connects to whatever else is on 5173 will happily
   photograph a completely different working tree. That happened.
3. **Read the pixels, do not eyeball them.**
   `npx tsx scripts/inspect.ts rows <png> <y0> <y1> <x0> <x1>` prints the mean RGB of each row
   over a column range, and `... crop <png> <x> <y> <w> <h> <scale> <out>` magnifies a region
   with a nearest-neighbour filter. The horizon band was finally identified from a table of twenty
   numbers, after two sessions of looking at pictures had failed.

## What is solid — do not re-derive it

- **Astronomy.** Verified against the US Naval Observatory: every rise, set, transit and twilight
  event matches **to the minute** at Tel Aviv and at Reykjavík on the winter solstice. 52 tests.
  Reproduce: `npx tsx scripts/almanac-check.ts 2026-07-30 32.08 34.78 3`.
- **Ocean.** CPU/GPU wave agreement **0.0059 mm** over 4096 points, measured on the real driver.
- **Sky photometry.** 2784 cd/m² zenith, 8424 horizon at solar noon. Real values.
- **Buoyancy.** Two real defects found and corrected analytically.
- **Exposure.** Metered from the sky that was actually rendered, plus the night floor the shader
  adds on top of it, with a hard stop at 6e-3 lux because dark adaptation saturates. Do not
  replace any of it with a curve; an analytic fit was two stops out at civil dawn.
- **Performance.** 60 FPS, 157 draw calls against a 300 budget, on an RTX 4070.

## Gotchas that cost hours. Read these.

1. three injects `float luminance(const in vec3)` into every `ShaderMaterial` program. Never
   define your own — use `ef_luminance` from `lib/constants.glsl`.
2. three defines `saturate` as a **macro**. A same-named function is a syntax error pointing at
   your definition rather than at the collision.
3. `sample` is a **reserved word** in GLSL ES, and the error it produces points at the line
   *after* the declaration.
4. Physical radiance must pass through `hdrClamp()`. The sun disc is 1.6×10⁹ cd/m²; half-float
   tops out at 65504 and stores `Infinity`, which bloom then averages across the whole frame.
5. **`mix(x, y, a)` with a float weight is arithmetic, not a select.** `mix(NaN, 0.0, 1.0)`
   evaluates `NaN*0.0` and is still NaN. The bvec overload that really is a select only exists
   from GLSL ES 3.00, and these programs compile as 1.00. This cost a whole session: the NaN
   guard that was added for the cloud speckle was on the wrong channel *and* would not have
   worked on the right one.
6. **A convolution effect reads the pass input buffer, not the accumulated colour.** Bloom after
   exposure *in the same pass* still sees raw radiance. Exposure needs its own pass, and two
   convolution effects cannot share a pass — pmndrs throws inside the constructor, killing boot
   with no obvious link to the cause.
7. `ShaderMaterial` does not apply three's tone mapping. The composer owns it.
8. **CSM registration cuts both ways.** `MeshStandardMaterial` (boat, fishing rod) **must** call
   `sky.registerShadowMaterial()` or it is lit by every cascade at once. Custom `ShaderMaterial`s
   shading from the ephemeris via `worldlight.glsl` (ocean, fish, seabed, islands, props, birds,
   wake, spray) **must not**. 3–4 stops of error in either direction.
9. Texture fetches inside loops need `texture2DLodEXT(tex, uv, 0.0)`.
10. Eye adaptation resets on a clock jump; a time override is a cut, not a sunset.
11. **vitest has no `vite-plugin-glsl`.** A test cannot transitively import anything that imports
    a `.vert`. That is why `WorldField.ts` is separate from `Islands.ts`, `AudioCurves.ts` from
    `AudioBeds.ts`, and `ColourGrade.ts` from `PostFX.ts`.
12. **Draw order matters and is easy to get wrong.** The underwater murk shell at `renderOrder
    -500` sits over the sky (−1000) and stars (−900). Anything full-screen needs its visibility
    condition checked against a real frame.
13. **A point source does not belong in the environment probe.** One star occupies a whole texel
    of a 128-pixel cube face — five orders of magnitude of over-representation — and the water
    reflects it off every wave facet whose normal happens to point at it.

## Repository map

```
src/astro/     pure — the ephemeris. 52 tests. No three, no DOM.
src/math/      pure — Gerstner (mirrored by shaders/lib/gerstner.glsl), Noise, PRNG
src/core/      Engine, Loop, Input, Time, Settings, WorldState, ResourceManager, Audio, DebugApi
src/world/     Sky, Atmosphere, SkyLibrary, StarField, Ocean, Weather, Clouds, Tides, Chunks,
               Islands, WorldField, Vegetation, TerrainMesh, Props, PropGeometry, Seabed,
               Underwater, AudioBeds, AudioCurves
src/entities/  Boat, BoatGeometry, BoatCamera, Buoyancy, Wake, Bobber, FishingLine, Fish,
               FishGeometry, Birds, SeaLifeGeometry
src/gameplay/  Species, BiteModel, FishingSystem, FightModel, Progression, Inventory, Save,
               UiSystem
src/render/    PostFX, ColourGrade, Materials, EnvironmentProbe, ProceduralTextures,
               WorldLighting, GerstnerParity, FullScreenPass
src/ui/        HUD, CatchCard, Journal, SettingsPanel, LoadingScreen — never imports three
src/shaders/   sky/ ocean/ clouds/ fish/ underwater/ terrain/ world/ entities/ line/ post/ lib/
scripts/       fetch-assets, process-textures, verify, probe, almanac-check
```
