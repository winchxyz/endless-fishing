import GUI from 'lil-gui';
import Stats from 'stats.js';
import type { Engine } from './Engine.js';
import type { QualityPreset } from './Settings.js';

/**
 * Developer overlay behind the `~` key: lil-gui for every live knob, stats.js for frame
 * timing, and a read-out of `renderer.info` so the 300-draw-call budget is always visible
 * rather than something we discover at the end.
 *
 * Hidden on boot. Folders are registered by the systems that own them, so this file does not
 * grow a dependency on every system in the game.
 */

interface DrawStats {
  fps: string;
  frameMs: string;
  drawCalls: number;
  triangles: string;
  programs: number;
  geometries: number;
  textures: number;
  gpu: string;
  webgpuAvailable: string;
}

export class DebugPanel {
  readonly gui: GUI;
  private readonly stats: Stats;
  private readonly engine: Engine;
  private readonly drawStats: DrawStats;
  private readonly container: HTMLDivElement;
  private visible = false;
  private accumulator = 0;

  constructor(engine: Engine) {
    this.engine = engine;

    this.container = document.createElement('div');
    this.container.className = 'debug-overlay';
    this.container.hidden = true;
    document.body.appendChild(this.container);

    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.classList.add('debug-stats');
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.left = '0';
    this.stats.dom.style.top = '0';
    this.container.appendChild(this.stats.dom);

    this.gui = new GUI({ title: 'Endless Fishing — debug', width: 320, container: this.container });
    this.gui.domElement.style.position = 'absolute';
    this.gui.domElement.style.right = '0';
    this.gui.domElement.style.top = '0';

    this.drawStats = {
      fps: '60.0',
      frameMs: '0.00',
      drawCalls: 0,
      triangles: '0',
      programs: 0,
      geometries: 0,
      textures: 0,
      gpu: engine.capabilities.rendererName,
      webgpuAvailable: engine.capabilities.webgpu ? 'yes (unused — see DECISIONS.md)' : 'no',
    };

    const perf = this.gui.addFolder('Performance');
    perf.add(this.drawStats, 'fps').name('FPS').listen().disable();
    perf.add(this.drawStats, 'frameMs').name('frame (ms)').listen().disable();
    perf.add(this.drawStats, 'drawCalls').name('draw calls').listen().disable();
    perf.add(this.drawStats, 'triangles').name('triangles').listen().disable();
    perf.add(this.drawStats, 'programs').name('programs').listen().disable();
    perf.add(this.drawStats, 'geometries').name('geometries').listen().disable();
    perf.add(this.drawStats, 'textures').name('textures').listen().disable();
    perf.add(this.drawStats, 'gpu').name('GPU').listen().disable();
    perf.add(this.drawStats, 'webgpuAvailable').name('WebGPU').listen().disable();

    const graphics = this.gui.addFolder('Graphics');
    const presetProxy = { preset: engine.settings.graphics.preset };
    graphics
      .add(presetProxy, 'preset', ['low', 'medium', 'high', 'ultra'])
      .name('preset')
      .onChange((value: QualityPreset) => engine.settings.applyPreset(value));
    graphics
      .add(engine.settings.graphics, 'renderScale', 0.5, 1.5, 0.05)
      .name('render scale')
      .onChange(() => engine.settings.emit('graphics'));

    window.addEventListener('keydown', this.onKeyDown);
  }

  /** Called by systems so their knobs appear without this file importing them. */
  folder(name: string): GUI {
    return this.gui.addFolder(name);
  }

  beginFrame(): void {
    if (this.visible) this.stats.begin();
  }

  endFrame(dt: number): void {
    if (!this.visible) return;
    this.stats.end();

    // renderer.info is cheap but the GUI relayout is not; refresh five times a second.
    this.accumulator += dt;
    if (this.accumulator < 0.2) return;
    this.accumulator = 0;

    const info = this.engine.renderer.info;
    this.drawStats.fps = this.engine.loop.fps.toFixed(1);
    this.drawStats.frameMs = this.engine.loop.frameMs.toFixed(2);
    this.drawStats.drawCalls = info.render.calls;
    this.drawStats.triangles = info.render.triangles.toLocaleString('en-GB');
    this.drawStats.programs = info.programs?.length ?? 0;
    this.drawStats.geometries = info.memory.geometries;
    this.drawStats.textures = info.memory.textures;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.hidden = !this.visible;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.gui.destroy();
    this.container.remove();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Backquote' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
    event.preventDefault();
    this.toggle();
  };
}
