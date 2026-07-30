import './hud.css';
import { formatMass, formatLength, type CatchRarity } from './CatchCard.js';

/**
 * The species log.
 *
 * A collection screen lives or dies on what an *empty* row looks like, so the silhouette is
 * built from the same body proportions the fish geometry is lofted from rather than being a
 * generic fish shape: a plaice is a disc, a conger is a ribbon, a mackerel is a spindle. An
 * unseen species therefore already tells you the shape of the animal you are looking for and
 * nothing else, which is exactly the amount of information a silhouette should carry.
 *
 * Rebuilt only when the host hands it new records — this is a screen, not a readout, and it is
 * not in the frame loop.
 */

export interface JournalSpecies {
  id: string;
  name: string;
  latin: string;
  rarity: CatchRarity;
  /** Body depth as a fraction of total length, from the species table. */
  bodyDepth: number;
  forkedTail: boolean;
}

export interface JournalRecord {
  speciesId: string;
  count: number;
  bestMassKg: number;
  bestLengthM: number;
  /** UTC epoch ms, or 0 when the date was never recorded (a migrated save). */
  firstCaughtMs: number;
}

const MARKUP = `
<div class="overlay__sheet journal__sheet">
  <header class="overlay__head">
    <h2 class="overlay__title">Journal</h2>
    <span class="hud-row__value" data-tally></span>
    <button type="button" class="overlay__close" data-close>Close</button>
  </header>
  <div class="overlay__body"><div class="journal__grid" data-grid></div></div>
</div>`;

/**
 * A fish outline in a 100 × 40 box, from the two proportions that decide what a fish looks
 * like in profile: how deep the body is relative to its length, and whether the tail forks.
 */
export function silhouettePath(bodyDepth: number, forkedTail: boolean): string {
  const half = Math.min(17.5, 4 + Math.max(0, bodyDepth) * 26);
  const wrist = half * 0.26;
  const tail = forkedTail
    ? `L95 ${(20 - half * 0.72).toFixed(2)} L83 20 L95 ${(20 + half * 0.72).toFixed(2)} `
    : `L93 ${(20 - half * 0.4).toFixed(2)} L93 ${(20 + half * 0.4).toFixed(2)} `;
  return (
    `M5 20 C20 ${(20 - half).toFixed(2)} 50 ${(20 - half).toFixed(2)} 74 ${(20 - wrist).toFixed(2)} ` +
    tail +
    `L74 ${(20 + wrist).toFixed(2)} C50 ${(20 + half).toFixed(2)} 20 ${(20 + half).toFixed(2)} 5 20 Z`
  );
}

function formatDay(epochMs: number): string {
  if (epochMs <= 0) return 'not recorded';
  const date = new Date(epochMs);
  return date.toISOString().slice(0, 10);
}

export class Journal {
  private readonly root: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly tally: HTMLElement;
  private species: readonly JournalSpecies[] = [];
  private records = new Map<string, JournalRecord>();

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen) this.close();
  };

  private readonly onPointerDown = (event: Event): void => {
    // Clicking the scrim, but not the sheet, closes. `contains` rather than target identity so
    // a click that lands on a word inside the sheet is not treated as a click on the backdrop.
    if (event.target === this.root) this.close();
  };

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'overlay journal';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Species journal');
    root.innerHTML = MARKUP;
    host.appendChild(root);
    this.root = root;

    const grid = root.querySelector('[data-grid]');
    const tally = root.querySelector('[data-tally]');
    const close = root.querySelector('[data-close]');
    if (!(grid instanceof HTMLElement) || !(tally instanceof HTMLElement) || close === null) {
      throw new Error('Journal markup is incomplete');
    }
    this.grid = grid;
    this.tally = tally;

    close.addEventListener('click', () => this.close());
    root.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
  }

  /** The full species table, in the order it should be shown. Set once at boot. */
  setSpecies(species: readonly JournalSpecies[]): void {
    this.species = species;
    this.render();
  }

  /** What has actually been caught. Set whenever the inventory changes. */
  setRecords(records: readonly JournalRecord[]): void {
    this.records = new Map(records.map((record) => [record.speciesId, record]));
    this.render();
  }

  get isOpen(): boolean {
    return this.root.classList.contains('is-open');
  }

  open(): void {
    this.root.classList.add('is-open');
  }

  close(): void {
    this.root.classList.remove('is-open');
  }

  toggle(): void {
    this.root.classList.toggle('is-open');
  }

  dispose(): void {
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private render(): void {
    const fragment = document.createDocumentFragment();
    let caught = 0;
    for (const species of this.species) {
      const record = this.records.get(species.id);
      if (record !== undefined) caught += 1;
      fragment.appendChild(this.renderEntry(species, record));
    }
    this.grid.replaceChildren(fragment);
    this.tally.textContent =
      this.species.length === 0 ? '' : `${caught} / ${this.species.length} species`;
  }

  private renderEntry(species: JournalSpecies, record: JournalRecord | undefined): HTMLElement {
    const entry = document.createElement('article');
    entry.className =
      record === undefined ? 'journal__entry journal__entry--uncaught' : 'journal__entry';

    const known = record !== undefined;
    entry.innerHTML =
      `<svg class="journal__silhouette" viewBox="0 0 100 40" aria-hidden="true">` +
      `<path class="journal__shape" d="${silhouettePath(species.bodyDepth, species.forkedTail)}"/>` +
      `</svg>`;

    const name = document.createElement('div');
    name.className = 'journal__name';
    name.textContent = known ? species.name : 'Unrecorded';
    const latin = document.createElement('div');
    latin.className = 'journal__latin';
    latin.textContent = known ? species.latin : species.rarity;
    entry.append(name, latin);

    if (record === undefined) {
      const hint = document.createElement('div');
      hint.className = 'hud-label';
      hint.textContent = 'never landed';
      entry.appendChild(hint);
      return entry;
    }

    const summary = document.createElement('div');
    summary.className = 'journal__summary';
    summary.append(
      cell(`×${record.count}`),
      cell(formatMass(record.bestMassKg)),
      cell(formatLength(record.bestLengthM)),
    );
    const first = document.createElement('div');
    first.className = 'hud-label';
    first.textContent = `first ${formatDay(record.firstCaughtMs)}`;
    entry.append(summary, first);
    return entry;
  }
}

function cell(text: string): HTMLElement {
  const node = document.createElement('span');
  node.textContent = text;
  return node;
}
