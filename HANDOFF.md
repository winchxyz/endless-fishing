# HANDOFF.md

Written to be picked up cold by a fresh session. Read `CLAUDE.md` first (conventions and the
single-sources-of-truth), then `DECISIONS.md` (recorded decisions with reasoning), then
`PROGRESS.md` (measured numbers). This file is the "what to do next" layer on top of those.

Current as of commit `a832cf1`. **All subsystem agents have finished.** `npx tsc --noEmit` is
clean across the whole tree and `npx vitest run` passes **112/112**.

---

## Start here

```bash
npm install
npm run assets      # 131 MB of CC0 assets, checksum-locked, idempotent
npm run textures    # ORM packing, lunar normal map, star catalogue -> binary
npm run test:run    # 112 tests
npm run dev
```

`npx tsx scripts/probe.ts "2026-06-21T16:10:00Z"` boots headless, prints photometry, frame stats
and console problems, and writes `screenshots/probe.png`. **This is the trustworthy visual
check.** `npm run verify` is not — see open issue 5.

---

## The one-paragraph state

Everything is built except the fishing state machine, and nothing after the boat is wired into
`main.ts`. Astronomy is verified against the US Naval Observatory to the minute. The ocean has
CPU/GPU wave agreement at 0.0059 mm on a real driver. The boat floats on a corrected buoyancy
solver. Weather is a genuine synoptic model with cloud shadows on the water. Fish, seabed,
underwater, islands, props, birds, UI, progression, save and audio all exist, compile and are
unit-tested — but **none of them has ever been run by a GPU**, because `main.ts` does not
register them yet. There is no live URL.

---

## Next actions, in strict priority order

### 1. Wire the landed subsystems into `src/main.ts`

Nothing below the boat is registered. This is the single biggest blocker: eight subsystems have
never had a shader compiled by a driver. Expect real bugs on first run — that is the point.

Current order in `main.ts`: Sky → Weather → Clouds → Ocean (with `ocean.setCloudShadows(clouds)`)
→ Tides → Boat → BoatCamera → PostFX.

Add, in this order:

```ts
const islands = await Islands.create(engine, materials);            // priority 15
engine.add(islands);
const props = await Props.create(engine, materials, islands.field); // priority 16
engine.add(props);
props.setSwell(ocean);
props.setBellAudio(audio);          // optional

const seabed = new Seabed(engine, ocean);                           // priority 12
engine.add(seabed);
const underwater = new Underwater(engine, ocean);                   // priority 35
engine.add(underwater);
seabed.setOptics(underwater);

const fish = new Fish(engine, ocean, seabed, boat);                 // priority 30
fish.setOptics(underwater);
engine.add(fish);

const birds = new Birds(engine);                                    // priority 22
birds.setSea(ocean);
birds.setSchoolLocator((out) => fish.nearestSchool(...));
engine.add(birds);
```

Then the UI (`HUD`, `CatchCard`, `Journal`, `SettingsPanel`), `Progression`/`Inventory`/`Save`,
and the audio engine. The UI needs a plain per-frame snapshot object built in `main.ts`;
`src/core/DebugApi.ts` shows the shape of the data available.

### 2. Write `src/gameplay/FishingSystem.ts`

The only missing file. Without it there is no game loop. Everything it needs exists:

| Dependency | Where | Gives you |
|---|---|---|
| `evaluateBite`, `rollBite`, `BiteConditions` | `gameplay/BiteModel.ts` | bite rate from named factors |
| `selectSpecies`, `rollSpecimen`, `CaughtFish` | `gameplay/Species.ts` | 12 species, two-stage rarity, log-normal mass |
| `Bobber` | `entities/Bobber.ts` | buoyancy with real vertical momentum |
| `FishingLine` | `entities/FishingLine.ts` | Gauss-Seidel line with sag and tension |
| `boat.rodTipWorldPosition(out)` | `entities/Boat.ts` | where the rod is |
| `fish.schoolBoost(pos)`, `fish.nearestSchool(pos, out)` | `entities/Fish.ts` | 0..1, decays on the same 9 m scale as `BiteModel.structureFactor` |

`System`, `name: 'fishing'`, `priority: 40`. **Explicit** state machine —
`idle → charging → casting → sinking → waiting → bite → fighting → landed | escaped → idle` —
no booleans standing in for states. The fight needs feel: per-species rhythm from
`pull`/`runRate`/`stamina`, a snap threshold, a slack-loses-the-fish rule, tension made volatile
by `world.significantWaveHeight`.

Also missing: `test/fishing.test.ts`, `test/progression.test.ts`.

### 3. Hoist the Jerlov constants — a fifth source of truth CLAUDE.md doesn't name

The water absorption/scattering coefficients are now duplicated **four times**: verbatim in
`ocean.frag`, `fish.frag` and `seabed.frag`, plus a TypeScript mirror in `Underwater.ts` (the
background colour is computed CPU-side). They are currently byte-identical; they will not stay
that way. Hoist into `src/shaders/lib/water.glsl` plus one TS export, and add the row to
CLAUDE.md's source-of-truth table.

### 4. Small correctness fixes already identified

- **`Ocean`'s `uSeabedDepth` is a fixed 55 m** and never consults `Seabed.floorHeightAt`, so
  over a 16 m bank the surface absorbs as though it were deep water. Wire it.
- **Stars show faintly through the murk underwater.** `StarField` uses `transparent: true,
  depthTest: false` so it draws after the depth-writing background shell. Hide it when
  `underwater.isSubmerged`.

### 5. Fix the two visible rendering defects

- **Cloud banding at the horizon** — a hard strip in every daytime frame. Start in
  `src/shaders/clouds/clouds.frag`, likely the shell intersection or the march's near/far clamp
  at grazing angles.
- **The boat reads flat** — probably its materials are not receiving `scene.environment`, or
  `envMapIntensity` is unset. Check the PMREM output is assigned before its materials compile.

### 6. Verify the night sky

Moonlight scattering and airglow are in `sky.frag` at measured magnitudes (full moon
≈ 0.001 cd/m² of sky, airglow ≈ 0.0002) but were **never visually confirmed**. Run
`npx tsx scripts/probe.ts "2026-07-29T21:30:00Z"` — a real full moon — and look.

### 7. Fix `npm run verify`

Its logs claimed "Report written" while screenshot timestamps showed files from an earlier run.
Probable cause: the spawned `npm run dev` tree is not killed reliably on Windows, so a stale
server serves a stale page while a new one binds another port. `scripts/probe.ts` does the same
job for one frame and is reliable; the difference between them is where to look. **Fix this
before trusting any more screenshots** — a harness you cannot trust is worse than none.

### 8. Then Phases 11 and 12

Polish and LOD tuning; the per-regime LUT colour grade (§10 of the brief — **not implemented**;
`PostFX` has exposure, bloom, ACES, vignette, grain, CA and SMAA, but no grade, and no GTAO, DoF,
god rays or motion blur). Then the production build, GitHub Actions deployment to Pages, and a
README with screenshots and a storm GIF.

---

## Gotchas that cost hours

1. **three injects `float luminance(const in vec3)` into every `ShaderMaterial` program.**
   Defining your own kills the program. Use `ef_luminance` from `lib/constants.glsl`.
2. **three defines `saturate` as a macro.** A same-named function becomes a syntax error whose
   message points at your definition rather than at the collision.
3. **Physical radiance must go through `hdrClamp()`.** The sun disc is 1.6×10⁹ cd/m²; half-float
   tops out at 65504, so the true value stores as `Infinity` and bloom averages it across the
   whole frame. White screen, no error.
4. **A convolution effect reads the pass input buffer, not the accumulated colour.** Bloom after
   exposure *in the same pass* still sees raw radiance. Exposure needs its own pass, and two
   convolution effects cannot share a pass at all — pmndrs throws inside the constructor, which
   takes down boot with no obvious link to the cause.
5. **`ShaderMaterial` does not apply three's tone mapping.** The composer owns it.
6. **CSM registration cuts both ways.** `MeshStandardMaterial` (the boat) **must** call
   `sky.registerShadowMaterial()` or it is lit by every cascade at once — 3–4× too bright.
   Custom `ShaderMaterial`s that shade from the ephemeris via `worldlight.glsl` (ocean, fish,
   seabed, islands, props, birds) **must not** — patching them is 3–4× too bright the other way.
7. **Texture fetches inside loops need `texture2DLodEXT(tex, uv, 0.0)`.**
8. **The exposure meter reads back from the sky-view LUT.** Measured, not modelled — an analytic
   fit was two stops out at civil dawn. Do not replace it with a curve.
9. **Adaptation resets on a clock jump.** A time override is a cut, not a sunset.
10. **vitest has no `vite-plugin-glsl`.** A test cannot transitively import anything that imports
    a `.vert`. That is why `WorldField.ts` exists separately from `Islands.ts`, and why
    `test/fish.test.ts` uses `vi.mock` on the shader modules. Keep pure logic importable.

---

## Agent workflow notes

About a dozen subagents were dispatched. Six were killed by API errors (`403 Request not
allowed`, connections dropped mid-response). **They write files as they go, so their work
usually survives** — after any agent failure, check `git status` before assuming it is lost.
That recovered six substantial modules including the entire UI layer.

Batches of two to four fared better than seven. Give each a disjoint file list, forbid
`src/main.ts`, and integrate by hand.

---

## Repository map

```
src/astro/     pure, no three, no DOM — the ephemeris. 52 tests live here.
src/math/      pure — Gerstner (mirrored by shaders/lib/gerstner.glsl), Noise, PRNG
src/core/      Engine, Loop, Input, Time, Settings, WorldState, ResourceManager, Audio, DebugApi
src/world/     Sky, Atmosphere, SkyLibrary, StarField, Ocean, Weather, Clouds, Tides, Chunks,
               Islands, WorldField, Vegetation, TerrainMesh, Props, PropGeometry,
               Seabed, Underwater
src/entities/  Boat, BoatGeometry, BoatCamera, Buoyancy, Bobber, FishingLine,
               Fish, FishGeometry, Birds, SeaLifeGeometry
src/gameplay/  Species, BiteModel, Progression, Inventory, Save     (FishingSystem MISSING)
src/render/    PostFX, Materials, EnvironmentProbe, ProceduralTextures, WorldLighting,
               GerstnerParity, FullScreenPass
src/ui/        HUD, CatchCard, Journal, SettingsPanel, LoadingScreen — never imports three
src/shaders/   sky/ ocean/ clouds/ fish/ underwater/ terrain/ world/ entities/ line/ post/ lib/
scripts/       fetch-assets, process-textures, verify, probe, almanac-check
```
