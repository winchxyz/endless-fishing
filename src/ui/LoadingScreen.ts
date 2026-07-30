/**
 * Boot overlay with a real progress bar.
 *
 * "Real" is the point: the fraction comes from the resource manager's completed/queued
 * counters, not from a timer pretending to load. The fade out is slow (900 ms) and starts
 * only once the first frame has actually been presented, so the player never sees a single
 * black or half-lit frame between the loader and the sea.
 */
export class LoadingScreen {
  private readonly root: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly status: HTMLElement;
  private done = false;

  constructor() {
    const root = document.getElementById('loading');
    const fill = document.getElementById('loading-fill');
    const status = document.getElementById('loading-status');
    if (root === null || fill === null || status === null) {
      throw new Error('Loading screen markup is missing from index.html');
    }
    this.root = root;
    this.fill = fill;
    this.status = status;
  }

  set(fraction: number, message: string): void {
    if (this.done) return;
    const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    this.fill.style.width = `${percent}%`;
    this.root.querySelector('.loading__bar')?.setAttribute('aria-valuenow', String(percent));
    this.status.textContent = message;
  }

  /** Fades out, then removes itself from the DOM so it can never intercept a pointer event. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    this.fill.style.width = '100%';
    this.status.textContent = 'Ready';
    requestAnimationFrame(() => {
      this.root.classList.add('loading--done');
      window.setTimeout(() => this.root.remove(), 1000);
    });
  }
}

/** Replaces everything with a legible explanation. Used only for unrecoverable boot errors. */
export function showFatalError(title: string, detail: string): void {
  const existing = document.querySelector('.fatal:not(noscript .fatal)');
  if (existing !== null) return;

  document.getElementById('loading')?.remove();
  const panel = document.createElement('div');
  panel.className = 'fatal';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const body = document.createElement('p');
  body.textContent = detail;
  panel.append(heading, body);
  document.body.appendChild(panel);
}
