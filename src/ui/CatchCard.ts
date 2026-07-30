import './hud.css';

/**
 * The card that comes up when something is landed.
 *
 * The design constraint is that this is the *only* moment the interface is allowed to
 * interrupt, so it earns that by being short and by carrying information rather than applause:
 * the animal's name, its Latin binomial, what it weighed and measured, and the money. No
 * confetti, no rarity explosion — the rarity is a two-pixel rule down the left edge, which is
 * enough to tell a mackerel from a halibut at a glance and not enough to shout.
 *
 * It dismisses itself, but a click or Escape gets rid of it immediately, because a card that
 * insists on its full four seconds while a second fish is taking the bait is a bug.
 */

export type CatchRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CatchCardData {
  species: string;
  latin: string;
  rarity: CatchRarity;
  massKg: number;
  lengthM: number;
  /** True for the albino variant — worth six times as much and worth saying so. */
  albino: boolean;
  personalBest: boolean;
  /** True the first time this species is ever landed. */
  firstCatch: boolean;
  /** Money credited for this specimen. */
  value: number;
}

/** How long the card stays up on its own. Long enough to read twice, short enough to forgive. */
const DWELL_MS = 6500;

const MARKUP = `
<h3 class="catch-card__name" data-name></h3>
<p class="catch-card__latin" data-latin></p>
<div class="hud-rule"></div>
<div class="hud-row"><span class="hud-label">Weight</span><span class="hud-row__value" data-mass></span></div>
<div class="hud-row"><span class="hud-label">Length</span><span class="hud-row__value" data-length></span></div>
<div class="hud-row"><span class="hud-label">Earned</span><span class="catch-card__earned" data-value></span></div>
<div class="catch-card__flags" data-flags></div>
<div class="catch-card__hint">Click to dismiss</div>`;

/** Grams below a kilogram, kilograms above it — the way a scale on a boat actually reads. */
export function formatMass(massKg: number): string {
  if (massKg < 1) return `${Math.round(massKg * 1000)} g`;
  if (massKg < 10) return `${massKg.toFixed(2)} kg`;
  return `${massKg.toFixed(1)} kg`;
}

export function formatLength(lengthM: number): string {
  return lengthM < 1 ? `${Math.round(lengthM * 100)} cm` : `${lengthM.toFixed(2)} m`;
}

/** Thin-space grouping. Narrower than a comma and it does not read as a decimal point. */
export function formatMoney(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export class CatchCard {
  private readonly root: HTMLElement;
  private readonly name: HTMLElement;
  private readonly latin: HTMLElement;
  private readonly mass: HTMLElement;
  private readonly length: HTMLElement;
  private readonly value: HTMLElement;
  private readonly flags: HTMLElement;
  private rarity: CatchRarity = 'common';
  private dwellTimer = 0;

  private readonly onClick = (): void => {
    this.dismiss();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isVisible) this.dismiss();
  };

  constructor(host: HTMLElement) {
    const root = document.createElement('aside');
    root.className = 'hud-panel catch-card';
    root.setAttribute('role', 'status');
    root.innerHTML = MARKUP;
    host.appendChild(root);
    this.root = root;

    const pick = (selector: string): HTMLElement => {
      const node = root.querySelector(selector);
      if (!(node instanceof HTMLElement)) throw new Error(`Catch card is missing ${selector}`);
      return node;
    };
    this.name = pick('[data-name]');
    this.latin = pick('[data-latin]');
    this.mass = pick('[data-mass]');
    this.length = pick('[data-length]');
    this.value = pick('[data-value]');
    this.flags = pick('[data-flags]');

    root.addEventListener('click', this.onClick);
    window.addEventListener('keydown', this.onKeyDown);
  }

  show(data: CatchCardData): void {
    window.clearTimeout(this.dwellTimer);

    this.name.textContent = data.species;
    this.latin.textContent = data.latin;
    this.mass.textContent = formatMass(data.massKg);
    this.length.textContent = formatLength(data.lengthM);
    this.value.textContent = `+${formatMoney(data.value)}`;

    this.root.classList.remove(`catch-card--${this.rarity}`);
    this.rarity = data.rarity;
    this.root.classList.add(`catch-card--${this.rarity}`);

    this.flags.replaceChildren();
    this.addFlag(data.rarity, false);
    if (data.firstCatch) this.addFlag('first catch', true);
    if (data.personalBest) this.addFlag('personal best', true);
    if (data.albino) this.addFlag('albino', true);

    // Force a reflow between the reset and the class that animates, or replacing a card that is
    // already up simply swaps its text with no movement at all.
    this.root.classList.remove('is-live');
    void this.root.offsetWidth;
    this.root.classList.add('is-live');

    this.dwellTimer = window.setTimeout(() => this.dismiss(), DWELL_MS);
  }

  dismiss(): void {
    window.clearTimeout(this.dwellTimer);
    this.root.classList.remove('is-live');
  }

  get isVisible(): boolean {
    return this.root.classList.contains('is-live');
  }

  dispose(): void {
    window.clearTimeout(this.dwellTimer);
    this.root.removeEventListener('click', this.onClick);
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private addFlag(label: string, highlight: boolean): void {
    const node = document.createElement('span');
    node.className = highlight ? 'catch-card__flag catch-card__flag--best' : 'catch-card__flag';
    node.textContent = label;
    this.flags.appendChild(node);
  }
}
