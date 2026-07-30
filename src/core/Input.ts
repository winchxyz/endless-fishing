/**
 * Keyboard / mouse state, polled rather than event-driven.
 *
 * Systems ask "is throttle held this frame", they do not subscribe to keydown. Edge events
 * (a key that went down *this* frame) are exposed separately and cleared at the end of the
 * frame by `endFrame()`, which the engine calls after every system has run.
 */

export type ActionName =
  | 'throttleUp'
  | 'throttleDown'
  | 'rudderLeft'
  | 'rudderRight'
  | 'boost'
  | 'anchor'
  | 'cameraMode'
  | 'journal'
  | 'settings'
  | 'debug'
  | 'reel';

const BINDINGS: Readonly<Record<string, ActionName>> = {
  KeyW: 'throttleUp',
  ArrowUp: 'throttleUp',
  KeyS: 'throttleDown',
  ArrowDown: 'throttleDown',
  KeyA: 'rudderLeft',
  ArrowLeft: 'rudderLeft',
  KeyD: 'rudderRight',
  ArrowRight: 'rudderRight',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
  Space: 'anchor',
  KeyC: 'cameraMode',
  KeyJ: 'journal',
  Escape: 'settings',
  Backquote: 'debug',
  KeyR: 'reel',
};

export class Input {
  /** Held-down state, one entry per action. */
  private readonly held = new Set<ActionName>();
  /** Actions that transitioned to held during the current frame. */
  private readonly pressed = new Set<ActionName>();
  private readonly released = new Set<ActionName>();

  /** Normalised device coordinates of the pointer, -1..1. */
  pointerX = 0;
  pointerY = 0;
  /** Pointer movement since the last frame, in pixels. */
  pointerDeltaX = 0;
  pointerDeltaY = 0;
  primaryDown = false;
  primaryPressed = false;
  primaryReleased = false;
  secondaryDown = false;
  /** Accumulated wheel delta this frame; positive is scroll-down / zoom-out. */
  wheel = 0;
  /** True while the pointer is locked to the canvas (free-look camera). */
  pointerLocked = false;

  private readonly element: HTMLElement;
  private readonly disposers: Array<() => void> = [];

  constructor(element: HTMLElement) {
    this.element = element;
    this.bind(window, 'keydown', this.onKeyDown as EventListener);
    this.bind(window, 'keyup', this.onKeyUp as EventListener);
    this.bind(window, 'blur', this.onBlur);
    this.bind(element, 'pointerdown', this.onPointerDown as EventListener);
    this.bind(window, 'pointerup', this.onPointerUp as EventListener);
    this.bind(window, 'pointermove', this.onPointerMove as EventListener);
    this.bind(element, 'wheel', this.onWheel as EventListener, { passive: true });
    this.bind(element, 'contextmenu', this.onContextMenu as EventListener);
    this.bind(document, 'pointerlockchange', this.onPointerLockChange);
  }

  isHeld(action: ActionName): boolean {
    return this.held.has(action);
  }

  wasPressed(action: ActionName): boolean {
    return this.pressed.has(action);
  }

  wasReleased(action: ActionName): boolean {
    return this.released.has(action);
  }

  /** -1 (full reverse) .. +1 (full ahead), from the throttle keys. */
  get throttleAxis(): number {
    return (this.isHeld('throttleUp') ? 1 : 0) - (this.isHeld('throttleDown') ? 1 : 0);
  }

  /** -1 (port) .. +1 (starboard). */
  get rudderAxis(): number {
    return (this.isHeld('rudderRight') ? 1 : 0) - (this.isHeld('rudderLeft') ? 1 : 0);
  }

  requestPointerLock(): void {
    if (!this.pointerLocked) void this.element.requestPointerLock();
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.primaryPressed = false;
    this.primaryReleased = false;
    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;
    this.wheel = 0;
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  private bind(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.disposers.push(() => target.removeEventListener(type, handler, options));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Let the browser have its shortcuts, and let text inputs in the settings panel type.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;

    const action = BINDINGS[event.code];
    if (action === undefined) return;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.repeat) return;
    this.held.add(action);
    this.pressed.add(action);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = BINDINGS[event.code];
    if (action === undefined) return;
    this.held.delete(action);
    this.released.add(action);
  };

  private readonly onBlur = (): void => {
    // Never leave a key stuck on after an alt-tab.
    for (const action of this.held) this.released.add(action);
    this.held.clear();
    this.primaryDown = false;
    this.secondaryDown = false;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.primaryDown = true;
      this.primaryPressed = true;
    } else if (event.button === 2) {
      this.secondaryDown = true;
    }
    this.updatePointer(event);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) {
      this.primaryDown = false;
      this.primaryReleased = true;
    } else if (event.button === 2) {
      this.secondaryDown = false;
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.updatePointer(event);
  };

  private readonly onWheel = (event: WheelEvent): void => {
    this.wheel += event.deltaY;
  };

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.element;
  };

  private updatePointer(event: PointerEvent): void {
    if (this.pointerLocked) {
      this.pointerDeltaX += event.movementX;
      this.pointerDeltaY += event.movementY;
    } else {
      const rect = this.element.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      this.pointerDeltaX += (nx - this.pointerX) * rect.width * 0.5;
      this.pointerDeltaY += (this.pointerY - ny) * rect.height * 0.5;
      this.pointerX = nx;
      this.pointerY = ny;
    }
  }
}
