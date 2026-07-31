import './hud.css';
import type { GraphicsSettings, QualityPreset, Settings } from '../core/Settings.js';

/**
 * The settings drawer.
 *
 * Every knob in `GraphicsSettings` is here, not a curated subset, because the presets are the
 * curated subset and someone who has opened this panel has already decided they want the real
 * controls. The preset buttons and the individual knobs are the same state: picking a preset
 * moves every slider, and moving a slider does not lie about which preset you are on.
 *
 * The world controls are the interesting half. Time scale, a manual date and time, and manual
 * coordinates all go through the settings store, so the ephemeris recomputes and the sky
 * changes on the next frame — put the boat at 64°N in June and the sun stops setting, because
 * that is what actually happens there, not because anything here special-cased it.
 *
 * `src/ui` imports no runtime code from `core`: the store arrives as a constructor argument and
 * its types are erased at compile time.
 */

type NumericKey = {
  [K in keyof GraphicsSettings]: GraphicsSettings[K] extends number ? K : never;
}[keyof GraphicsSettings];

type BooleanKey = {
  [K in keyof GraphicsSettings]: GraphicsSettings[K] extends boolean ? K : never;
}[keyof GraphicsSettings];

interface NumericControl {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

const NUMERIC_CONTROLS: readonly NumericControl[] = [
  { key: 'renderScale', label: 'Render scale', min: 0.5, max: 1.5, step: 0.05, decimals: 2 },
  { key: 'waveCount', label: 'Gerstner waves', min: 4, max: 8, step: 1, decimals: 0 },
  { key: 'oceanGridResolution', label: 'Ocean grid', min: 64, max: 256, step: 16, decimals: 0 },
  { key: 'oceanRings', label: 'Clipmap rings', min: 3, max: 9, step: 1, decimals: 0 },
  { key: 'cloudSteps', label: 'Cloud steps', min: 8, max: 96, step: 2, decimals: 0 },
  { key: 'cloudScale', label: 'Cloud buffer', min: 0.25, max: 1, step: 0.05, decimals: 2 },
  { key: 'refractionScale', label: 'Refraction buffer', min: 0.25, max: 1, step: 0.05, decimals: 2 },
  { key: 'shadowCascades', label: 'Shadow cascades', min: 1, max: 4, step: 1, decimals: 0 },
  { key: 'shadowMapSize', label: 'Shadow map', min: 512, max: 4096, step: 512, decimals: 0 },
  { key: 'drawDistance', label: 'Draw distance (m)', min: 1200, max: 9000, step: 100, decimals: 0 },
  { key: 'instanceDensity', label: 'Instance density', min: 0.1, max: 1, step: 0.05, decimals: 2 },
  { key: 'schoolSize', label: 'School size', min: 8, max: 128, step: 4, decimals: 0 },
  { key: 'probeFacesPerFrame', label: 'Probe faces / frame', min: 1, max: 6, step: 1, decimals: 0 },
  { key: 'probeResolution', label: 'Probe resolution', min: 32, max: 512, step: 32, decimals: 0 },
  { key: 'anisotropy', label: 'Anisotropy', min: 1, max: 16, step: 1, decimals: 0 },
];

const TOGGLE_CONTROLS: readonly { key: BooleanKey; label: string }[] = [
  { key: 'shadowsEnabled', label: 'Shadows' },
  { key: 'ssaoEnabled', label: 'Ambient occlusion' },
  { key: 'bloomEnabled', label: 'Bloom' },
  { key: 'gradeEnabled', label: 'Colour grade' },
  { key: 'dofEnabled', label: 'Depth of field' },
  { key: 'godRaysEnabled', label: 'God rays' },
  { key: 'motionBlurEnabled', label: 'Motion blur' },
  { key: 'chromaticAberrationEnabled', label: 'Chromatic aberration' },
  { key: 'grainEnabled', label: 'Film grain' },
  { key: 'vignetteEnabled', label: 'Vignette' },
];

const PRESETS: readonly QualityPreset[] = ['low', 'medium', 'high', 'ultra'];
const TIME_SCALES: readonly number[] = [1, 60, 600, 3600];

/** Places with a real sea and a genuinely different sky. The point of the list is the spread. */
export interface LocationPreset {
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
}

export const LOCATION_PRESETS: readonly LocationPreset[] = [
  { name: 'Tel Aviv', latitudeDeg: 32.08, longitudeDeg: 34.78 },
  { name: 'Reykjavik', latitudeDeg: 64.15, longitudeDeg: -21.94 },
  { name: 'Bergen', latitudeDeg: 60.39, longitudeDeg: 5.32 },
  { name: 'Aberdeen', latitudeDeg: 57.15, longitudeDeg: -2.09 },
  { name: 'Newfoundland', latitudeDeg: 47.56, longitudeDeg: -52.71 },
  { name: 'Cape Town', latitudeDeg: -33.92, longitudeDeg: 18.42 },
  { name: 'Hobart', latitudeDeg: -42.88, longitudeDeg: 147.33 },
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DDTHH:mm` in the host's own timezone, which is what `datetime-local` expects. */
export function toLocalInputValue(epochMs: number): string {
  const date = new Date(epochMs);
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

export class SettingsPanel {
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly syncs: Array<() => void> = [];
  private readonly unsubscribe: () => void;
  /** Guards the store listener against reacting to this panel's own writes. */
  private applying = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen) this.close();
  };

  private readonly onPointerDown = (event: Event): void => {
    if (event.target === this.root) this.close();
  };

  constructor(
    host: HTMLElement,
    private readonly settings: Settings,
  ) {
    const root = document.createElement('div');
    root.className = 'overlay settings';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Settings');
    root.innerHTML = `
<div class="overlay__sheet settings__sheet">
  <header class="overlay__head">
    <h2 class="overlay__title">Settings</h2>
    <button type="button" class="overlay__close" data-close>Close</button>
  </header>
  <div class="overlay__body" data-body></div>
</div>`;
    host.appendChild(root);
    this.root = root;

    const body = root.querySelector('[data-body]');
    const close = root.querySelector('[data-close]');
    if (!(body instanceof HTMLElement) || close === null) {
      throw new Error('Settings markup is incomplete');
    }
    this.body = body;
    close.addEventListener('click', () => this.close());
    root.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);

    this.buildGraphics();
    this.buildAudio();
    this.buildWorld();
    this.refresh();

    this.unsubscribe = settings.onChange(() => {
      if (!this.applying) this.refresh();
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('is-open');
  }

  open(): void {
    this.root.classList.add('is-open');
    this.refresh();
  }

  close(): void {
    this.root.classList.remove('is-open');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Pull every control back into line with the store. Cheap; called on open and on change. */
  refresh(): void {
    for (const sync of this.syncs) sync();
  }

  dispose(): void {
    this.unsubscribe();
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  // --------------------------------------------------------------------------- sections

  private buildGraphics(): void {
    const group = this.group('Graphics');
    this.choices(
      group,
      PRESETS.map((preset) => ({ id: preset, label: preset })),
      () => this.settings.graphics.preset,
      (id) => {
        const preset = PRESETS.find((candidate) => candidate === id);
        if (preset !== undefined) this.settings.applyPreset(preset);
      },
    );

    for (const control of NUMERIC_CONTROLS) {
      this.slider(
        group,
        control.label,
        control,
        () => this.settings.graphics[control.key],
        (value) => {
          this.settings.graphics[control.key] = value;
          this.settings.emit('graphics');
        },
      );
    }

    this.dropdown(
      group,
      'Antialiasing',
      [
        { id: 'none', label: 'Off' },
        { id: 'smaa', label: 'SMAA' },
      ],
      () => this.settings.graphics.antialias,
      (id) => {
        this.settings.graphics.antialias = id === 'smaa' ? 'smaa' : 'none';
        this.settings.emit('graphics');
      },
    );

    for (const control of TOGGLE_CONTROLS) {
      this.switchRow(
        group,
        control.label,
        () => this.settings.graphics[control.key],
        (value) => {
          this.settings.graphics[control.key] = value;
          this.settings.emit('graphics');
        },
      );
    }
  }

  private buildAudio(): void {
    const group = this.group('Audio');
    const shape = { min: 0, max: 1, step: 0.01, decimals: 2 };
    this.slider(
      group,
      'Master volume',
      shape,
      () => this.settings.audio.masterVolume,
      (value) => {
        this.settings.audio.masterVolume = value;
        this.settings.emit('audio');
      },
    );
    this.slider(
      group,
      'Music volume',
      shape,
      () => this.settings.audio.musicVolume,
      (value) => {
        this.settings.audio.musicVolume = value;
        this.settings.emit('audio');
      },
    );
    this.switchRow(
      group,
      'Mute',
      () => this.settings.audio.muted,
      (value) => {
        this.settings.audio.muted = value;
        this.settings.emit('audio');
      },
    );
  }

  private buildWorld(): void {
    const time = this.group('Time');
    this.choices(
      time,
      TIME_SCALES.map((scale) => ({ id: String(scale), label: `${scale}×` })),
      () => String(this.settings.world.timeScale),
      (id) => {
        const scale = Number(id);
        if (!Number.isFinite(scale)) return;
        this.settings.world.timeScale = scale;
        this.settings.emit('world');
      },
    );
    this.note(time, 'Above 1× the sun and moon move at that multiple of real time.');

    const field = this.field(time, 'Date and time');
    const input = document.createElement('input');
    input.type = 'datetime-local';
    field.appendChild(input);
    input.addEventListener('change', () => {
      const parsed = Date.parse(input.value);
      if (Number.isNaN(parsed)) return;
      this.write(() => {
        this.settings.world.timeOverrideMs = parsed;
        this.settings.emit('world');
      });
    });
    this.syncs.push(() => {
      const override = this.settings.world.timeOverrideMs;
      input.value = toLocalInputValue(override ?? Date.now());
    });

    this.choices(
      time,
      [{ id: 'live', label: 'Back to real time' }],
      () => (this.settings.world.timeOverrideMs === null ? 'live' : ''),
      () => {
        this.settings.world.timeOverrideMs = null;
        this.settings.emit('world');
      },
    );

    const place = this.group('Location');
    this.choices(
      place,
      LOCATION_PRESETS.map((preset) => ({ id: preset.name, label: preset.name })),
      () => this.nearestPreset(),
      (id) => {
        const preset = LOCATION_PRESETS.find((candidate) => candidate.name === id);
        if (preset === undefined) return;
        this.settings.setLocation(preset.latitudeDeg, preset.longitudeDeg);
      },
    );
    this.coordinate(place, 'Latitude', -90, 90, () => this.settings.world.latitudeDeg);
    this.coordinate(place, 'Longitude', -180, 180, () => this.settings.world.longitudeDeg);
    this.note(place, 'Changing position recomputes the ephemeris; the sky follows immediately.');
  }

  // ---------------------------------------------------------------------- control builders

  private group(title: string): HTMLElement {
    const group = document.createElement('section');
    group.className = 'settings__group';
    const heading = document.createElement('div');
    heading.className = 'settings__group-title';
    heading.textContent = title;
    group.appendChild(heading);
    this.body.appendChild(group);
    return group;
  }

  private field(parent: HTMLElement, label: string): HTMLElement {
    const field = document.createElement('label');
    field.className = 'settings__field';
    const caption = document.createElement('span');
    caption.textContent = label;
    field.appendChild(caption);
    parent.appendChild(field);
    return field;
  }

  private note(parent: HTMLElement, text: string): void {
    const note = document.createElement('p');
    note.className = 'settings__note';
    note.textContent = text;
    parent.appendChild(note);
  }

  private slider(
    parent: HTMLElement,
    label: string,
    shape: { min: number; max: number; step: number; decimals: number },
    get: () => number,
    set: (value: number) => void,
  ): void {
    const field = this.field(parent, label);
    const readout = document.createElement('span');
    readout.className = 'settings__field-value';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(shape.min);
    input.max = String(shape.max);
    input.step = String(shape.step);
    field.append(readout, input);

    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      readout.textContent = value.toFixed(shape.decimals);
      this.write(() => set(value));
    });
    this.syncs.push(() => {
      const value = get();
      input.value = String(value);
      readout.textContent = value.toFixed(shape.decimals);
    });
  }

  private switchRow(
    parent: HTMLElement,
    label: string,
    get: () => boolean,
    set: (value: boolean) => void,
  ): void {
    const field = this.field(parent, label);
    const input = document.createElement('input');
    input.type = 'checkbox';
    field.appendChild(input);
    input.addEventListener('change', () => this.write(() => set(input.checked)));
    this.syncs.push(() => {
      input.checked = get();
    });
  }

  private dropdown(
    parent: HTMLElement,
    label: string,
    options: readonly { id: string; label: string }[],
    get: () => string,
    set: (id: string) => void,
  ): void {
    const field = this.field(parent, label);
    const select = document.createElement('select');
    for (const option of options) {
      const node = document.createElement('option');
      node.value = option.id;
      node.textContent = option.label;
      select.appendChild(node);
    }
    field.appendChild(select);
    select.addEventListener('change', () => this.write(() => set(select.value)));
    this.syncs.push(() => {
      select.value = get();
    });
  }

  private choices(
    parent: HTMLElement,
    options: readonly { id: string; label: string }[],
    get: () => string,
    set: (id: string) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'settings__choices';
    const buttons: HTMLButtonElement[] = [];
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings__choice';
      button.textContent = option.label;
      button.addEventListener('click', () => this.write(() => set(option.id)));
      row.appendChild(button);
      buttons.push(button);
    }
    parent.appendChild(row);
    this.syncs.push(() => {
      const active = get();
      for (let i = 0; i < buttons.length; i += 1) {
        buttons[i]?.classList.toggle('is-active', options[i]?.id === active);
      }
    });
  }

  private coordinate(
    parent: HTMLElement,
    label: string,
    min: number,
    max: number,
    get: () => number,
  ): void {
    const field = this.field(parent, `${label} (°)`);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = '0.01';
    field.appendChild(input);
    input.addEventListener('change', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value < min || value > max) {
        input.value = get().toFixed(2);
        return;
      }
      // Both coordinates go through `setLocation` together, so a half-applied position — a new
      // latitude against the old longitude — never reaches the ephemeris even for one frame.
      const latitude = label === 'Latitude' ? value : this.settings.world.latitudeDeg;
      const longitude = label === 'Longitude' ? value : this.settings.world.longitudeDeg;
      this.write(() => this.settings.setLocation(latitude, longitude));
    });
    this.syncs.push(() => {
      input.value = get().toFixed(2);
    });
  }

  /** Nearest preset within a quarter of a degree, so the button row reflects a manual entry. */
  private nearestPreset(): string {
    const { latitudeDeg, longitudeDeg } = this.settings.world;
    for (const preset of LOCATION_PRESETS) {
      if (
        Math.abs(preset.latitudeDeg - latitudeDeg) < 0.25 &&
        Math.abs(preset.longitudeDeg - longitudeDeg) < 0.25
      ) {
        return preset.name;
      }
    }
    return '';
  }

  private write(mutate: () => void): void {
    this.applying = true;
    try {
      mutate();
    } finally {
      this.applying = false;
    }
    this.refresh();
  }
}
