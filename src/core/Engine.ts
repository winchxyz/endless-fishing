import { Color, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { Input } from './Input.js';
import { Loop } from './Loop.js';
import { ResourceManager } from './ResourceManager.js';
import { Settings } from './Settings.js';
import { Time } from './Time.js';
import {
  WebGL2UnsupportedError,
  createRenderer,
  probeCapabilities,
  type Capabilities,
} from './RendererFactory.js';
import { createWorldState, type WorldState } from './WorldState.js';

/**
 * A system is a self-contained slice of the game — the ocean, the weather, the boat.
 *
 * `fixedUpdate` runs at a constant 120 Hz and is where anything integrated over time lives.
 * `update` runs once per rendered frame and is where anything visual lives. Systems never
 * call each other; they read `Engine` for shared state and are ordered by `priority`.
 */
export interface System {
  readonly name: string;
  /** Lower runs first. Weather (0) before ocean (10) before entities (20) before render (90). */
  readonly priority: number;
  fixedUpdate?(dt: number, engine: Engine): void;
  update?(dt: number, engine: Engine): void;
  /**
   * Runs after every `update` and before the main render. For passes that need to draw the
   * scene into their own target first — the ocean's refraction buffer, the cloud-shadow mask —
   * where doing it inside `update` would capture a half-updated scene.
   */
  beforeRender?(engine: Engine): void;
  /** Called after a settings change that this system cares about. */
  onSettingsChanged?(engine: Engine): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}

export class Engine {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGLRenderer;
  readonly capabilities: Capabilities;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly settings: Settings;
  readonly time: Time;
  readonly input: Input;
  readonly resources: ResourceManager;
  readonly loop: Loop;
  /** Shared per-frame snapshot. Written by Sky and Weather; read by everyone else. */
  readonly world: WorldState = createWorldState();

  /** Viewport in CSS pixels. */
  width = 1;
  height = 1;
  /** Effective device pixel ratio after the render-scale setting and the 2.0 cap. */
  pixelRatio = 1;

  private readonly systems: System[] = [];
  private readonly resizeObserver: ResizeObserver;
  private disposed = false;
  /**
   * Set by PostFX in phase 5. Until then the engine draws directly. Keeping the hook here
   * rather than importing PostFX avoids a core -> render dependency.
   */
  renderOverride: ((dt: number) => void) | null = null;
  /**
   * Developer overlay, attached by `main`. Structurally typed so `core` does not depend on
   * the panel — the panel depends on `core`, and that arrow only points one way.
   */
  debug: { beginFrame(): void; endFrame(dt: number): void } | null = null;

  constructor(canvas: HTMLCanvasElement, webgpuAvailable: boolean) {
    this.canvas = canvas;

    const { renderer, capabilities } = createRenderer(canvas);
    this.renderer = renderer;
    this.capabilities = { ...capabilities, webgl2: true, webgpu: webgpuAvailable };

    this.settings = new Settings(capabilities.maxAnisotropy);
    this.time = new Time(this.settings);
    this.input = new Input(canvas);
    this.resources = new ResourceManager(renderer);

    this.scene = new Scene();
    // Placeholder until the Sky system takes ownership in phase 2: a cold overcast grey so
    // an unlit frame reads as "sea haze", never as a debug magenta or a pure black void.
    this.scene.background = new Color(0x2c3338);

    this.camera = new PerspectiveCamera(52, 1, 0.1, 20000);
    this.camera.position.set(0, 6, 14);
    this.camera.lookAt(0, 1.5, 0);

    this.loop = new Loop(this.fixedUpdate, this.render);

    this.settings.onChange((_all, changed) => {
      if (changed === 'graphics') {
        this.applyRenderScale();
        for (const system of this.systems) system.onSettingsChanged?.(this);
      }
    });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas.parentElement ?? document.body);
    this.handleResize();
  }

  add(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    system.resize?.(this.width, this.height);
  }

  get<T extends System>(name: string): T | undefined {
    return this.systems.find((s) => s.name === name) as T | undefined;
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.resizeObserver.disconnect();
    for (const system of this.systems) system.dispose?.();
    this.systems.length = 0;
    this.input.dispose();
    this.resources.dispose();
    this.renderer.dispose();
  }

  private readonly fixedUpdate = (dt: number): void => {
    for (const system of this.systems) system.fixedUpdate?.(dt, this);
  };

  private readonly render = (dt: number): void => {
    this.debug?.beginFrame();
    this.time.advance(dt);
    for (const system of this.systems) system.update?.(dt, this);
    for (const system of this.systems) system.beforeRender?.(this);

    this.renderer.info.reset();
    if (this.renderOverride !== null) {
      this.renderOverride(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.input.endFrame();
    this.debug?.endFrame(dt);
  };

  private handleResize(): void {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, Math.floor(parent?.clientWidth ?? window.innerWidth));
    const height = Math.max(1, Math.floor(parent?.clientHeight ?? window.innerHeight));
    if (width === this.width && height === this.height) return;

    this.width = width;
    this.height = height;
    this.applyRenderScale();

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    for (const system of this.systems) system.resize?.(width, height);
  }

  private applyRenderScale(): void {
    // Cap at 2.0: beyond that the fill cost of the ocean and cloud passes buys nothing a
    // viewer can see, and 3x-DPR phones would grind.
    this.pixelRatio = Math.min(window.devicePixelRatio, 2) * this.settings.graphics.renderScale;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
  }
}

/** Boots the engine, or throws with a message worth showing the user. */
export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  const probe = await probeCapabilities();
  if (!probe.webgl2) throw new WebGL2UnsupportedError();
  return new Engine(canvas, probe.webgpu);
}
