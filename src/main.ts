import './ui/styles.css';
// After styles.css, so the HUD's rules can build on the shell's custom properties rather than
// redeclaring the palette.
import './ui/hud.css';
import { createEngine, type Engine } from './core/Engine.js';
import { DebugPanel } from './core/DebugPanel.js';
import { installDebugApi } from './core/DebugApi.js';
import { LoadingScreen, showFatalError } from './ui/LoadingScreen.js';
import { Sky } from './world/Sky.js';
import { Ocean } from './world/Ocean.js';
import { Tides } from './world/Tides.js';
import { Weather } from './world/Weather.js';
import { Clouds } from './world/Clouds.js';
import { PostFX } from './render/PostFX.js';
import { MaterialLibrary } from './render/Materials.js';
import { Boat } from './entities/Boat.js';
import { BoatCamera } from './entities/BoatCamera.js';
import { Seabed } from './world/Seabed.js';
import { Underwater } from './world/Underwater.js';
import { Islands } from './world/Islands.js';
import { Props } from './world/Props.js';
import { Fish } from './entities/Fish.js';
import { Birds } from './entities/Birds.js';
import { UiSystem } from './gameplay/UiSystem.js';
import { FishingSystem } from './gameplay/FishingSystem.js';
import { Progression } from './gameplay/Progression.js';
import { locationFromTimezone, requestLocation } from './world/Geolocation.js';

/**
 * Entry point. Boots the engine, wires the loading screen to real resource progress, and
 * hands control to the frame loop.
 *
 * Every failure path here ends in a readable message rather than a blank canvas — an ocean
 * renderer that silently shows nothing is indistinguishable from a broken link.
 */

async function boot(): Promise<void> {
  const loading = new LoadingScreen();
  loading.set(0.02, 'Probing graphics capabilities');

  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas #scene is missing from index.html');
  }

  const engine: Engine = await createEngine(canvas);
  loading.set(0.15, 'Renderer ready');

  const debug = new DebugPanel(engine);
  engine.debug = debug;

  engine.resources.onProgress((completed, total, label) => {
    // Resource loading occupies the 15–95% band; the tail is first-frame compilation.
    const fraction = total === 0 ? 1 : completed / total;
    loading.set(0.15 + fraction * 0.8, `Loading ${label.split('/').pop() ?? label}`);
  });

  // Non-blocking: the game starts at the timezone-inferred position and snaps to the real one
  // if and when the browser grants permission. Nothing waits on a permission dialog.
  const guess = locationFromTimezone();
  engine.settings.setLocationIfUnset(guess.latitudeDeg, guess.longitudeDeg);
  void requestLocation().then((location) => {
    if (location.source === 'geolocation') {
      engine.settings.setLocation(location.latitudeDeg, location.longitudeDeg);
    }
  });

  const sky = await Sky.create(engine);
  engine.add(sky);
  sky.onSettingsChanged(engine);

  // Weather is the sole writer of the wind, cloud and pressure fields, so it goes in before
  // anything that reads them. Clouds resolve Sky lazily, so both must follow it.
  // Start in a workable sea.
  //
  // The synoptic field is deterministic from the seed, and this seed lands it in a Beaufort 9
  // gale — so every fresh session opened on a storm, with the boat thrown around, the propeller
  // ventilating on every crest and the rudder in aerated water. That is a legitimate state for
  // the model to reach and a terrible one to arrive in: the first thing a player should be able
  // to do is steer.
  //
  // Pinning the opening condition, not disabling the system. Clearing the override in the
  // settings panel hands the sea straight back to the pressure field.
  engine.settings.world.weatherOverride = 'light-breeze';
  const weather = new Weather(engine);
  engine.add(weather);
  const clouds = new Clouds(engine);
  engine.add(clouds);

  const ocean = new Ocean(engine);
  ocean.setCloudShadows(clouds);
  engine.add(ocean);

  engine.add(new Tides());

  // The seabed goes in before the fish, which hold station relative to the ground, and before
  // the underwater pass, which needs something to fog.
  const seabed = new Seabed(engine, ocean);
  engine.add(seabed);

  const underwater = new Underwater(engine, ocean);
  engine.add(underwater);
  seabed.setOptics(underwater);

  loading.set(0.45, 'Raising land');
  const materials = new MaterialLibrary(engine.resources);
  const islands = await Islands.create(engine, materials);
  engine.add(islands);

  // Props share the island's heightfield rather than sampling their own: a lighthouse computing
  // its own ground height from the same noise would still land a few millimetres off, and a
  // lighthouse hovering over its rock is the sort of thing you only ever notice once.
  const props = await Props.create(engine, materials, islands.field);
  props.setSwell(ocean);
  engine.add(props);

  loading.set(0.55, 'Building the boat');
  const boat = await Boat.create(engine, ocean, materials);
  engine.add(boat);

  const fish = new Fish(engine, ocean, seabed, boat);
  fish.setOptics(underwater);
  engine.add(fish);

  // Gulls circle whatever the fish are doing; with no locator they fall back to the boat, which
  // is a worse tell but never a wrong one.
  const birds = new Birds(engine);
  birds.setSea(ocean);
  engine.add(birds);

  // Every PBR material has to enrol with the cascaded shadow map. CSM adds one directional
  // light per cascade and patches materials to pick the right one; an unregistered material is
  // lit by all of them and comes out three or four times too bright.
  for (const material of boat.materials) sky.registerShadowMaterial(material);

  // The camera's own priority orders it after the ocean, so the clipmap and the star sphere
  // centre on the previous frame's viewpoint. At a 0.55 m base cell that is a few centimetres
  // of lag on a mesh that is already snapped to a lattice, so it is not visible — but it is
  // the reason the ocean is not simply re-centred here.
  engine.add(new BoatCamera(engine, boat, ocean));

  // Registered last so it sees the finished scene; it takes over rendering from the engine.
  engine.add(new PostFX(engine));

  const progression = new Progression();

  // The fishing system is handed the effects object by reference, not by value: upgrades change
  // it in place and the rod must feel the new reel the moment it is bought.
  const fishing = new FishingSystem(
    engine,
    ocean,
    seabed,
    boat,
    fish,
    progression.effects,
    engine.settings.world.seed ^ 0xf157,
  );
  engine.add(fishing);

  // The rod's parts are MeshStandardMaterial, so unlike the ocean and the terrain they DO need
  // enrolling with the cascaded shadow map. See HANDOFF.md gotcha 6 — the rule cuts both ways
  // and getting it backwards is three or four stops of error in either direction.
  for (const material of fishing.materials) sky.registerShadowMaterial(material);

  const uiRoot = document.getElementById('ui-root');
  if (uiRoot === null) throw new Error('#ui-root is missing from index.html');
  const ui = new UiSystem(uiRoot, engine.settings);
  ui.attach({ boat, weather, fishing });
  engine.add(ui);

  installDebugApi(engine);

  loading.set(0.96, 'Compiling shaders');
  engine.start();

  // Wait for two presented frames before fading: the first compiles, the second is clean.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  loading.finish();

  window.addEventListener('beforeunload', () => {
    debug.dispose();
    engine.dispose();
  });
}

// The error is surfaced in the DOM rather than rethrown: an unhandled rejection would show
// up as console noise, and `npm run verify` treats any console error as a build failure.
// In dev we also print the stack, because there a red console line is the useful signal.
void boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('WebGL2')) {
    showFatalError(
      'WebGL2 required',
      'This browser cannot create a WebGL2 context. Try a recent Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled.',
    );
  } else {
    showFatalError('Failed to start', message);
  }
  if (import.meta.env.DEV) console.error(error);
});
