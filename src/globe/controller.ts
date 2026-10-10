// src/globe/controller.ts: the globe's one requestAnimationFrame loop and its finger. A frame is asked for only while something
// moves (a drag, a flick coasting, a turn to a searched country, the idle spin) or after something changed; the renderer
// (render.ts) then draws only if the scene differs. Untouched for 10 s the globe spins slowly; a touch or the page hiding
// stops it, and while the page is hidden no frame and no timer runs (PWA best practices, section 11).
//
// The canvas carries what tests read: data-state (rest, drag, coast, turn, spin), and on coming to rest data-rotation and the
// average time the frames since the last rest took to draw (data-frame-ms over data-frames).
import { clock } from './clock';
import { dragRotation } from './drag';
import { centreOf, type CountryFeature } from './geo';
import { atRest, coast, flingVelocity, spin, turnBetween, type Sample, type Velocity } from './motion';
import { pickCountry } from './pick';
import { createRenderer, type DrawContext, type Palette, type Rotation, type Scene } from './render';

export type GlobeState = 'rest' | 'drag' | 'coast' | 'turn' | 'spin';

export const IDLE_MS = 10_000;
const TURN_MS = 1000;
/** A press that moves less than this and lifts within TAP_MS is a tap. */
const TAP_SLOP = 8;
const TAP_MS = 500;
/** The canvas is drawn at no more than twice its CSS size: a phone at 3x would fill 2.25 times the pixels for no visible gain. */
const MAX_DPR = 2;

export interface GlobeOptions {
  features: readonly CountryFeature[];
  lit: ReadonlyMap<string, number>;
  palette: Palette;
  rotation: Rotation;
  picked: string | null;
  /** Spin when left alone (off when the phone asks for reduced motion). */
  idleSpin: boolean;
  onPick(code: string): void;
  /** Told whenever the globe stops, with where it stopped. */
  onRest?(rotation: Rotation, picked: string | null): void;
}

interface Press {
  id: number;
  at: [number, number];
  t: number;
  rotation: Rotation;
  moved: boolean;
  samples: Sample[];
}

export class GlobeController {
  private readonly ctx: DrawContext | null;
  private readonly renderer = createRenderer();
  private scene: Omit<Scene, 'rotation' | 'picked'>;
  private rotation: Rotation;
  private picked: string | null;
  private state: GlobeState = 'rest';
  private velocity: Velocity = [0, 0];
  private turn: { from: Rotation; to: Rotation; start: number } | null = null;
  private press: Press | null = null;
  private frameId: number | null = null;
  private idleId: number | null = null;
  private lastTime = 0;
  private hidden = false;
  private pageHidden = false;
  private covered = false;
  private stopped = false;
  private stats = { ms: 0, frames: 0 };
  private readonly options: GlobeOptions;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, options: GlobeOptions) {
    this.canvas = canvas;
    this.options = options;
    this.ctx = canvas.getContext('2d', { alpha: true }) as DrawContext | null;
    this.rotation = options.rotation;
    this.picked = options.picked;
    this.scene = { width: 0, height: 0, dpr: 1, features: options.features, lit: options.lit, palette: options.palette };
    this.pageHidden = this.hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    this.resize();
    this.enter('rest');
  }

  /** Reads the canvas's size again (on mount and when its box changes). */
  resize(): void {
    const box = this.canvas.getBoundingClientRect();
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (width === this.scene.width && height === this.scene.height && dpr === this.scene.dpr) return;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.scene = { ...this.scene, width, height, dpr };
    // Setting a canvas's size clears it: the next frame must draw.
    this.renderer.forget();
    this.ask();
  }

  setLit(lit: ReadonlyMap<string, number>): void {
    this.scene = { ...this.scene, lit };
    this.ask();
  }

  setPalette(palette: Palette): void {
    if (palette === this.scene.palette) return;
    this.scene = { ...this.scene, palette };
    this.ask();
  }

  /** Turns the globe to face a country and outlines it. */
  turnTo(code: string): void {
    const country = this.scene.features.find((c) => c.id === code);
    if (!country || this.stopped) return;
    const [lon, lat] = centreOf(country);
    this.press = null;
    this.picked = code;
    this.turn = { from: this.rotation, to: [-lon, -lat, 0], start: clock.now() };
    this.enter('turn');
  }

  pointerDown(id: number, at: [number, number]): void {
    if (this.press || this.stopped) return;
    this.press = { id, at, t: clock.now(), rotation: this.rotation, moved: false, samples: [{ t: clock.now(), rotation: this.rotation }] };
    this.turn = null;
    this.velocity = [0, 0];
    this.enter('drag');
  }

  pointerMove(id: number, at: [number, number]): void {
    const press = this.press;
    if (!press || press.id !== id) return;
    if (!press.moved && Math.hypot(at[0] - press.at[0], at[1] - press.at[1]) < TAP_SLOP) return;
    press.moved = true;
    const rotation = dragRotation(press.rotation, press.at, at, this.scene.width, this.scene.height);
    if (!rotation) return;
    this.rotation = rotation;
    press.samples.push({ t: clock.now(), rotation });
    if (press.samples.length > 4) press.samples.shift();
    this.ask();
  }

  pointerUp(id: number, at: [number, number]): void {
    const press = this.press;
    if (!press || press.id !== id) return;
    this.press = null;
    const now = clock.now();
    if (!press.moved && now - press.t < TAP_MS) {
      const code = pickCountry(this.scene.features, this.rotation, this.scene.width, this.scene.height, at);
      if (code) this.picked = code;
      this.enter('rest');
      if (code) this.options.onPick(code);
      return;
    }
    this.velocity = flingVelocity(press.samples, now);
    this.enter(atRest(this.velocity) ? 'rest' : 'coast');
  }

  pointerCancel(id: number): void {
    if (this.press?.id !== id) return;
    this.press = null;
    this.enter('rest');
  }

  /** The page hid or showed (visibilitychange, pagehide, pageshow). */
  setHidden(hidden: boolean): void {
    this.pageHidden = hidden;
    this.applyHidden();
  }

  /** Something covers the whole globe (the Not yet list): it rests as if the page were hidden. */
  setCovered(covered: boolean): void {
    this.covered = covered;
    this.applyHidden();
  }

  private applyHidden(): void {
    const hidden = this.pageHidden || this.covered;
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden) {
      this.press = null;
      this.turn = null;
      this.velocity = [0, 0];
      this.cancelFrame();
      this.enter('rest');
    } else {
      // The phone may have thrown the canvas's pixels away while it was hidden: draw once.
      this.renderer.forget();
      this.ask();
      this.waitForIdle();
    }
  }

  /** The screen is closing: keep where the globe is, then nothing more runs. */
  stop(): void {
    this.options.onRest?.(this.rotation, this.picked);
    this.stopped = true;
    this.cancelFrame();
    this.cancelIdle();
  }

  private enter(state: GlobeState): void {
    this.state = state;
    this.canvas.dataset.state = state;
    this.lastTime = clock.now();
    if (state === 'rest') {
      this.canvas.dataset.rotation = this.rotation.map((n) => n.toFixed(1)).join(',');
      if (this.stats.frames) {
        this.canvas.dataset.frameMs = (this.stats.ms / this.stats.frames).toFixed(2);
        this.canvas.dataset.frames = String(this.stats.frames);
      }
      this.stats = { ms: 0, frames: 0 };
      this.options.onRest?.(this.rotation, this.picked);
      this.waitForIdle();
    } else {
      this.cancelIdle();
    }
    this.ask();
  }

  private waitForIdle(): void {
    this.cancelIdle();
    if (!this.options.idleSpin || this.hidden || this.stopped || this.state !== 'rest') return;
    this.idleId = clock.later(() => {
      this.idleId = null;
      if (this.state === 'rest' && !this.hidden) this.enter('spin');
    }, IDLE_MS);
  }

  private cancelIdle(): void {
    if (this.idleId !== null) clock.cancelLater(this.idleId);
    this.idleId = null;
  }

  /** Asks for a frame, unless one is coming or the page is hidden. */
  private ask(): void {
    if (this.frameId !== null || this.hidden || this.stopped) return;
    this.frameId = clock.frame((time) => this.tick(time));
  }

  private cancelFrame(): void {
    if (this.frameId !== null) clock.cancelFrame(this.frameId);
    this.frameId = null;
  }

  private tick(time: number): void {
    this.frameId = null;
    const started = clock.now();
    const dt = Math.max(0, Math.min(64, time - this.lastTime));
    this.lastTime = time;
    let moving = true;
    if (this.state === 'coast') {
      ({ rotation: this.rotation, velocity: this.velocity } = coast(this.rotation, this.velocity, dt));
      moving = !atRest(this.velocity);
    } else if (this.state === 'turn' && this.turn) {
      const at = Math.min(1, (time - this.turn.start) / TURN_MS);
      this.rotation = turnBetween(this.turn.from, this.turn.to, at);
      moving = at < 1;
    } else if (this.state === 'spin') {
      this.rotation = spin(this.rotation, dt);
    } else {
      moving = false;
    }
    if (this.ctx && this.renderer.draw(this.ctx, { ...this.scene, rotation: this.rotation, picked: this.picked })) {
      this.stats.ms += clock.now() - started;
      this.stats.frames += 1;
    }
    if (moving) this.ask();
    else if (this.state !== 'rest' && this.state !== 'drag') {
      this.turn = null;
      this.enter('rest');
    }
  }
}
