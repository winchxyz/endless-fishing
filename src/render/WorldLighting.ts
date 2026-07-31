import { Color, Vector3, type IUniform, type Texture } from 'three';
import type { Engine, System } from '../core/Engine.js';
import { smoothstep } from '../math/Noise.js';

/**
 * The TypeScript half of `shaders/lib/worldlight.glsl`.
 *
 * Islands, props and birds are all drawn by custom `ShaderMaterial`s that shade from the
 * ephemeris directly rather than from three's light chain — the reason is written out at the top
 * of the GLSL, and it comes down to the light rig being a CSM, which is a *stack* of full
 * intensity directional lights that an unpatched material sums. What lives here is the other
 * side of that contract: one place that fills the uniform block, so three systems cannot drift
 * into three slightly different ideas of where the sun is.
 *
 * Nothing here allocates. The uniform values are `Vector3`/`Color` instances created once with
 * the block and written in place every frame.
 */

export type UniformMap = Record<string, IUniform>;

/** Colour temperature of moonlight as the eye reports it. Mirrors `Sky`'s own constant. */
const MOONLIGHT_COLOUR = new Color(0.72, 0.8, 1.0);
const SUNLIGHT_NOON = new Color(1.0, 0.96, 0.92);
const SUNLIGHT_WARM = new Color(1.0, 0.62, 0.36);

/** Scratch for the warmth ramp. Module-level so `update` never news anything. */
const sunTint = new Color();

/**
 * A fresh uniform block matching every `uniform` declared in `worldlight.glsl`.
 *
 * Declaring all of them is not optional even though several are unused by any one shader: an
 * absent uniform is silently `null` in three and shows up as a black surface at a random time
 * of day rather than as an error at startup.
 */
export function worldLightUniforms(): UniformMap {
  return {
    uSunDirection: { value: new Vector3(0, 1, 0) },
    uSunColour: { value: new Color(1, 1, 1) },
    uSunIlluminance: { value: 0 },
    uMoonDirection: { value: new Vector3(0, -1, 0) },
    uMoonColour: { value: MOONLIGHT_COLOUR.clone() },
    uMoonIlluminance: { value: 0 },
    uEnvironment: { value: null },
    uEnvironmentIntensity: { value: 1 },
    uVisibility: { value: 25000 },
  };
}

/**
 * Whatever is holding the environment cubemap this frame. Structurally typed rather than
 * importing `world/Sky`, because `render` sits below `world` and that arrow only points one way.
 */
type ProbeHolder = System & { readonly probe: { readonly cubeTexture: Texture } };

/**
 * The sky probe's raw cubemap, or null until the Sky system exists.
 *
 * Deliberately the unfiltered cube rather than the PMREM texture: `ef_shadeSurface` uses the mip
 * chain as its own crude roughness prefilter, and a PMREM lookup with an explicit LOD indexes a
 * completely different layout.
 */
export function skyEnvironment(engine: Engine): Texture | null {
  const sky = engine.get<ProbeHolder>('sky');
  return sky === undefined ? null : sky.probe.cubeTexture;
}

/**
 * Push this frame's lighting into a uniform block.
 *
 * The illuminances are divided by π on the way in, exactly as the ocean does, because what the
 * shading model wants is the radiance a white lambertian surface would return and what the
 * ephemeris reports is the illuminance falling on it.
 */
export function updateWorldLight(
  uniforms: UniformMap,
  engine: Engine,
  environment: Texture | null,
): void {
  const world = engine.world;

  const environmentUniform = uniforms['uEnvironment'];
  if (environmentUniform !== undefined) environmentUniform.value = environment;
  setNumber(uniforms, 'uVisibility', world.visibility);

  const ephemeris = world.ephemeris;
  if (ephemeris === null) return;

  const sun = uniforms['uSunDirection'];
  if (sun !== undefined) {
    (sun.value as Vector3).set(
      ephemeris.sunDirectionRefracted.x,
      ephemeris.sunDirectionRefracted.y,
      ephemeris.sunDirectionRefracted.z,
    );
  }
  const moon = uniforms['uMoonDirection'];
  if (moon !== undefined) {
    (moon.value as Vector3).set(
      ephemeris.moonDirection.x,
      ephemeris.moonDirection.y,
      ephemeris.moonDirection.z,
    );
  }

  // The same Rayleigh warming the sky applies to its own directional light. Reproduced rather
  // than read off `Sky` because the light rig is that system's private state, and a getter
  // reaching across for it is exactly the coupling the WorldState snapshot exists to prevent.
  const warmth = 1 - smoothstep(0, 18, ephemeris.sunAltitudeDeg);
  sunTint.copy(SUNLIGHT_NOON).lerp(SUNLIGHT_WARM, warmth * warmth);
  const sunColour = uniforms['uSunColour'];
  if (sunColour !== undefined) (sunColour.value as Color).copy(sunTint);

  // Cloud takes the direct beam and hands the energy to the probe, which is already rendering
  // the overcast sky — so the ambient term needs no correction and the direct one does.
  const blocked = 1 - world.cloudiness * 0.9;
  setNumber(uniforms, 'uSunIlluminance', (ephemeris.sunIlluminanceLux / Math.PI) * blocked);
  setNumber(uniforms, 'uMoonIlluminance', (ephemeris.moonIlluminanceLux / Math.PI) * blocked);
  setNumber(uniforms, 'uEnvironmentIntensity', 1);

  // Meteorological visibility, which drives `ef_aerialPerspective` in `worldlight.glsl`.
  //
  // This was declared, defaulted to 25 km, and then never written — so every island, prop, bird,
  // fish and droplet in the game has been sitting in the same fixed haze since the uniform was
  // added, whatever the weather said. It is why a pinned storm with the visibility down to 1.4 km
  // still showed a razor-sharp horizon and an island twelve kilometres away.
  setNumber(uniforms, 'uVisibility', world.visibility);
}

function setNumber(uniforms: UniformMap, name: string, value: number): void {
  const uniform = uniforms[name];
  if (uniform !== undefined) uniform.value = value;
}
