import { MeshStandardMaterial, type Texture } from 'three';
import type { ResourceManager } from '../core/ResourceManager.js';

/**
 * The PBR material factory. Every textured surface in the game is born here.
 *
 * Three maps per material: albedo, an OpenGL-convention tangent normal, and a packed ORM
 * (occlusion in R, roughness in G, metalness in B — see `scripts/process-textures.ts` for why
 * roughness gets the green plane). The ORM texture is assigned to `aoMap`, `roughnessMap` *and*
 * `metalnessMap` as the same object, which is exactly how three reads a packed ORM: one sampler,
 * three channel reads.
 *
 * `roughness` and `metalness` default to 1 rather than to three's own defaults, because both are
 * *multipliers* on the map. Anything less than 1 darkens the measured value; the options are
 * there to tune a material down, never to replace what was scanned.
 *
 * The one genuinely surprising thing this class does is compensate for stretched sources.
 * `process-textures.ts` resizes every source to a power-of-two square and records the original
 * dimensions, and two of the eleven sets — Rope001 and WoodFloor043 — were published 1024x512.
 * Their content is therefore vertically stretched by 2x in the file. Undoing that with the UV
 * repeat is not cosmetic: a rope tube textured from an uncompensated Rope001 has visibly fat,
 * lazy strands, and a rope is a thing every player has seen in real life.
 */

export interface MaterialOptions {
  /** UV repeats per metre of surface, given that geometry authors UVs in metres. */
  repeat?: number;
  /** Multiplier on the roughness channel. 1 = as measured. */
  roughness?: number;
  /** Multiplier on the metalness channel. 1 = as measured. */
  metalness?: number;
  /** Tint multiplied into the albedo, as a hex literal. */
  color?: number;
  normalScale?: number;
}

interface ManifestMaterial {
  id: string;
  sourceWidth: number;
  sourceHeight: number;
  stretched: boolean;
  maps: { albedo: string; normal: string; orm: string };
}

interface ProcessedManifest {
  materials: ManifestMaterial[];
}

/** Manifest paths are relative to `assets/processed/`, which is served at this prefix. */
const PROCESSED_ROOT = 'processed/';
const MANIFEST_PATH = `${PROCESSED_ROOT}manifest.json`;

export class MaterialLibrary {
  private readonly resources: ResourceManager;
  private readonly variants = new Map<string, Promise<MeshStandardMaterial>>();
  private readonly resolved = new Map<string, MeshStandardMaterial>();
  private readonly materials = new Set<MeshStandardMaterial>();
  /** Per-variant texture clones. They share a `Source`, so this costs no VRAM. */
  private readonly clones = new Set<Texture>();
  private entries: Promise<Map<string, ManifestMaterial>> | null = null;

  constructor(resources: ResourceManager) {
    this.resources = resources;
  }

  /**
   * Load (or return the cached) material for a manifest id.
   *
   * Two calls with different options produce two materials, because the UV repeat lives on the
   * texture rather than on the material and a shared texture cannot carry two scales.
   */
  load(id: string, options: MaterialOptions = {}): Promise<MeshStandardMaterial> {
    const key = variantKey(id, options);
    const cached = this.variants.get(key);
    if (cached !== undefined) return cached;

    const promise = this.build(id, key, options);
    this.variants.set(key, promise);
    return promise;
  }

  /** A material that has already finished loading. The first variant loaded wins for a bare id. */
  get(id: string): MeshStandardMaterial | undefined {
    return this.resolved.get(id);
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    for (const texture of this.clones) texture.dispose();
    this.materials.clear();
    this.clones.clear();
    this.variants.clear();
    this.resolved.clear();
    this.entries = null;
  }

  private manifest(): Promise<Map<string, ManifestMaterial>> {
    const existing = this.entries;
    if (existing !== null) return existing;

    const promise = this.resources.loadBinary(MANIFEST_PATH).then((buffer) => {
      const parsed = JSON.parse(new TextDecoder().decode(buffer)) as ProcessedManifest;
      if (!Array.isArray(parsed.materials) || parsed.materials.length === 0) {
        throw new Error('assets/processed/manifest.json lists no materials — run `npm run textures`');
      }
      const map = new Map<string, ManifestMaterial>();
      for (const entry of parsed.materials) map.set(entry.id, entry);
      return map;
    });

    this.entries = promise;
    return promise;
  }

  private async build(
    id: string,
    key: string,
    options: MaterialOptions,
  ): Promise<MeshStandardMaterial> {
    const entries = await this.manifest();
    const entry = entries.get(id);
    if (entry === undefined) {
      throw new Error(
        `Unknown material "${id}". The processed manifest holds: ${[...entries.keys()].join(', ')}`,
      );
    }

    const repeatX = options.repeat ?? 1;
    // A source published 2:1 and squared up needs twice the repeats down v to look 2:1 again.
    const aspect =
      entry.stretched && entry.sourceHeight > 0 ? entry.sourceWidth / entry.sourceHeight : 1;
    const repeatY = repeatX * aspect;

    const [albedo, normal, orm] = await Promise.all([
      this.resources.loadTexture(PROCESSED_ROOT + entry.maps.albedo, { srgb: true }),
      this.resources.loadTexture(PROCESSED_ROOT + entry.maps.normal, { srgb: false }),
      this.resources.loadTexture(PROCESSED_ROOT + entry.maps.orm, { srgb: false }),
    ]);

    const ormVariant = this.variantTexture(orm, repeatX, repeatY);
    const normalScale = options.normalScale ?? 1;

    const material = new MeshStandardMaterial({
      name: key,
      map: this.variantTexture(albedo, repeatX, repeatY),
      normalMap: this.variantTexture(normal, repeatX, repeatY),
      // One texture, three roles. `aoMap` reads uv1 while the other two read uv, so the
      // geometry must carry a uv1 that matches uv or the occlusion slides off the surface.
      aoMap: ormVariant,
      roughnessMap: ormVariant,
      metalnessMap: ormVariant,
      roughness: options.roughness ?? 1,
      metalness: options.metalness ?? 1,
      envMapIntensity: 1,
    });
    if (options.color !== undefined) material.color.setHex(options.color);
    material.normalScale.set(normalScale, normalScale);

    this.materials.add(material);
    this.resolved.set(key, material);
    if (!this.resolved.has(id)) this.resolved.set(id, material);
    return material;
  }

  /**
   * A per-variant view of a cached texture.
   *
   * The `ResourceManager` hands back one `Texture` per URL, and the UV repeat lives on the
   * texture, so writing it directly would make the last material to load win for every material
   * sharing that map. Clones carry their own repeat and share the underlying `Source`, which
   * three reference-counts — so this is a second sampler description, not a second upload.
   */
  private variantTexture(base: Texture, repeatX: number, repeatY: number): Texture {
    const clone = base.clone();
    clone.repeat.set(repeatX, repeatY);
    clone.needsUpdate = true;
    this.clones.add(clone);
    return clone;
  }
}

function variantKey(id: string, options: MaterialOptions): string {
  return [
    id,
    options.repeat ?? 1,
    options.roughness ?? 1,
    options.metalness ?? 1,
    (options.color ?? 0xffffff).toString(16),
    options.normalScale ?? 1,
  ].join('|');
}
