import {
  DataTexture,
  LinearMipmapLinearFilter,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type WebGLRenderer,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/**
 * Loading, caching and disposal of every GPU resource in the game.
 *
 * Two jobs. First, one cache per URL so the same texture is never uploaded twice. Second, a
 * disposal ledger: anything that allocates VRAM registers here, and `dispose()` tears the
 * whole scene down cleanly — which matters because the environment probe and the weather
 * system both rebuild render targets when settings change.
 *
 * All paths are resolved against `import.meta.env.BASE_URL` so the same build works from a
 * domain root and from a GitHub Pages subpath.
 */

export interface Disposable {
  dispose(): void;
}

export type ProgressListener = (loaded: number, total: number, label: string) => void;

/** Textures whose meaning is colour, not data. Everything else stays linear. */
const COLOR_SUFFIXES = ['_albedo', '_diffuse', '_color', '_basecolor'];

export class ResourceManager {
  private readonly textures = new Map<string, Promise<Texture>>();
  private readonly hdris = new Map<string, Promise<DataTexture>>();
  private readonly tracked = new Set<Disposable>();
  private readonly listeners = new Set<ProgressListener>();

  private readonly textureLoader = new TextureLoader();
  // HDRLoader is the current name for what used to be RGBELoader; the old class still works
  // but logs a deprecation warning, and this build tolerates zero console warnings.
  private readonly hdrLoader = new HDRLoader();
  private readonly ktx2Loader: KTX2Loader;

  private queued = 0;
  private completed = 0;
  private anisotropy = 1;

  constructor(renderer: WebGLRenderer) {
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.ktx2Loader = new KTX2Loader()
      .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
      .detectSupport(renderer);
  }

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Register something that owns VRAM so it is torn down with the engine. */
  track<T extends Disposable>(resource: T): T {
    this.tracked.add(resource);
    return resource;
  }

  untrack(resource: Disposable): void {
    this.tracked.delete(resource);
  }

  resolve(path: string): string {
    if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
    return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
  }

  /**
   * Load a PBR map. KTX2 when the processed pipeline has run, PNG/JPG otherwise — the
   * caller passes the base path without an extension and we take whichever exists.
   */
  loadTexture(path: string, options: { srgb?: boolean; repeat?: boolean } = {}): Promise<Texture> {
    const cached = this.textures.get(path);
    if (cached !== undefined) return cached;

    const url = this.resolve(path);
    const isKtx2 = url.endsWith('.ktx2');
    this.begin(path);

    const promise = (
      isKtx2 ? this.ktx2Loader.loadAsync(url) : this.textureLoader.loadAsync(url)
    ).then((texture) => {
      const srgb = options.srgb ?? COLOR_SUFFIXES.some((s) => path.toLowerCase().includes(s));
      if (srgb) texture.colorSpace = SRGBColorSpace;
      if (options.repeat !== false) {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
      }
      texture.anisotropy = this.anisotropy;
      if (!isKtx2) {
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
      }
      texture.needsUpdate = true;
      this.tracked.add(texture);
      this.end(path);
      return texture;
    });

    this.textures.set(path, promise);
    return promise;
  }

  /** Equirectangular HDR. Mapping is left to the caller — the sky wants it as an equirect. */
  loadHDRI(path: string): Promise<DataTexture> {
    const cached = this.hdris.get(path);
    if (cached !== undefined) return cached;

    this.begin(path);
    const promise = this.hdrLoader.loadAsync(this.resolve(path)).then((texture) => {
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      this.tracked.add(texture);
      this.end(path);
      return texture;
    });

    this.hdris.set(path, promise);
    return promise;
  }

  /** JSON or binary side data (star catalogue, manifests). Counted in loading progress. */
  async loadBinary(path: string): Promise<ArrayBuffer> {
    this.begin(path);
    const response = await fetch(this.resolve(path));
    if (!response.ok) {
      this.end(path);
      throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    this.end(path);
    return buffer;
  }

  get progress(): number {
    return this.queued === 0 ? 1 : this.completed / this.queued;
  }

  dispose(): void {
    for (const resource of this.tracked) resource.dispose();
    this.tracked.clear();
    this.textures.clear();
    this.hdris.clear();
    this.ktx2Loader.dispose();
    this.listeners.clear();
  }

  private begin(label: string): void {
    this.queued += 1;
    this.emit(label);
  }

  private end(label: string): void {
    this.completed += 1;
    this.emit(label);
  }

  private emit(label: string): void {
    for (const listener of this.listeners) listener(this.completed, this.queued, label);
  }
}
