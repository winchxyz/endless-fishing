/**
 * Fixed-step simulation loop with a variable-rate render.
 *
 * Buoyancy with ten probes and stiff restoring forces is not stable across a 30–144 Hz
 * variable timestep, so the simulation always advances in equal 1/120 s slices and the
 * renderer interpolates between them. `MAX_SUBSTEPS` is the spiral-of-death guard: if a tab
 * is backgrounded for ten seconds we drop the missed time rather than trying to catch up.
 */

export const FIXED_TIMESTEP = 1 / 120;
const MAX_SUBSTEPS = 6;
/** Anything longer than this is a stall, not a frame. Clamp so physics never explodes. */
const MAX_FRAME_DELTA = 0.25;

export type FixedUpdate = (dt: number, simTimeSeconds: number) => void;
export type RenderUpdate = (dt: number, alpha: number) => void;

export class Loop {
  /** Seconds of simulated time since start, advancing only in FIXED_TIMESTEP slices. */
  simTime = 0;
  /** Wall-clock seconds since start, unclamped. */
  elapsed = 0;
  /** Smoothed frames per second, for the HUD and the adaptive quality governor. */
  fps = 60;
  /** Milliseconds spent in the last frame's render callback. */
  frameMs = 0;

  private accumulator = 0;
  private lastTime = 0;
  private rafHandle = 0;
  private running = false;
  private fpsAccumulator = 0;
  private fpsFrames = 0;

  constructor(
    private readonly fixedUpdate: FixedUpdate,
    private readonly render: RenderUpdate,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== 0) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    this.rafHandle = requestAnimationFrame(this.tick);

    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const delta = Math.min(rawDelta, MAX_FRAME_DELTA);
    this.elapsed += delta;

    this.fpsAccumulator += delta;
    this.fpsFrames += 1;
    if (this.fpsAccumulator >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAccumulator;
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }

    this.accumulator += delta;
    let steps = 0;
    while (this.accumulator >= FIXED_TIMESTEP && steps < MAX_SUBSTEPS) {
      this.fixedUpdate(FIXED_TIMESTEP, this.simTime);
      this.simTime += FIXED_TIMESTEP;
      this.accumulator -= FIXED_TIMESTEP;
      steps += 1;
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0;

    const renderStart = performance.now();
    this.render(delta, this.accumulator / FIXED_TIMESTEP);
    this.frameMs = performance.now() - renderStart;
  };
}
