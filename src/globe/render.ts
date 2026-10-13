// src/globe/render.ts: one frame of the globe, drawn on anything with the canvas's drawing calls (DrawContext), so a test can
// count them with a fake. Pure: it reads only the scene it is given. A renderer remembers the last scene it drew and draws
// nothing when the next one is the same; the loop (controller.ts) can therefore ask on every frame.
import { geoGraticule, geoOrthographic, geoPath, type GeoProjection } from 'd3-geo';
import { DOT_RADIUS, PICKED_DOT_RADIUS } from './dots';
import { mayFace, type CountryFeature } from './geo';

/** d3's [λ, φ, γ]: the globe faces the point (-λ, -φ). */
export type Rotation = readonly [number, number, number];

/** The canvas calls the globe uses: d3's path calls, fill and stroke, and the styles. */
export interface DrawContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  lineJoin: CanvasLineJoin;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
}

export interface Palette {
  oceanInner: string;
  oceanOuter: string;
  graticule: string;
  land: string;
  border: string;
  lit: string;
  outline: string;
  rim: string;
}

export interface Scene {
  /** CSS pixels */
  width: number;
  height: number;
  /** the canvas's pixels per CSS pixel */
  dpr: number;
  rotation: Rotation;
  /** 1 (the default) is the whole globe in the box; more is closer (zoom.ts) */
  zoom?: number;
  features: readonly CountryFeature[];
  /** alpha-2 -> how many items he has from there */
  lit: ReadonlyMap<string, number>;
  picked: string | null;
  palette: Palette;
}

const MARGIN = 10;

/** The globe's projection for a rotation in a box of this size: centred, as large as fits at zoom 1, larger by the zoom. */
export function projectionFor(rotation: Rotation, width: number, height: number, zoom = 1): GeoProjection {
  return geoOrthographic()
    .rotate([rotation[0], rotation[1], rotation[2]])
    .translate([width / 2, height / 2])
    .scale(Math.max(1, Math.min(width, height) / 2 - MARGIN) * zoom)
    .clipAngle(90)
    // No adaptive resampling: the 110m shapes' edges are short already, and resampling cost a quarter of each frame.
    .precision(0);
}

/** How strongly a country is lit: the one he has most from fully, one item still clearly. */
export function intensity(count: number, most: number): number {
  return 0.55 + 0.45 * (Math.log1p(count) / Math.log1p(Math.max(most, 1)));
}

// Every 15 degrees, drawn in 3-degree steps: a third of the points of d3's 10-degree default, as fine at a phone's size.
const graticule = geoGraticule().step([15, 15]).precision(3)();
const sphere = { type: 'Sphere' } as const;

function sameScene(a: Scene | undefined, b: Scene): boolean {
  return (
    !!a &&
    a.width === b.width &&
    a.height === b.height &&
    a.dpr === b.dpr &&
    a.rotation[0] === b.rotation[0] &&
    a.rotation[1] === b.rotation[1] &&
    a.rotation[2] === b.rotation[2] &&
    a.zoom === b.zoom &&
    a.features === b.features &&
    a.lit === b.lit &&
    a.picked === b.picked &&
    a.palette === b.palette
  );
}

export interface Renderer {
  /** Draws the scene; false, and no call on the context, when it is the scene drawn last. */
  draw(ctx: DrawContext, scene: Scene): boolean;
  /** The next draw draws whatever it is given (the canvas was resized or cleared). */
  forget(): void;
}

export function createRenderer(): Renderer {
  let last: Scene | undefined;
  return {
    forget: () => void (last = undefined),
    draw(ctx, scene) {
      if (sameScene(last, scene)) return false;
      last = { ...scene };
      paint(ctx, scene);
      return true;
    },
  };
}

function paint(ctx: DrawContext, scene: Scene): void {
  const { width, height, dpr, palette, lit } = scene;
  const projection = projectionFor(scene.rotation, width, height, scene.zoom);
  const path = geoPath(projection, ctx).pointRadius(DOT_RADIUS);
  const radius = projection.scale();
  const [cx, cy] = projection.translate();
  const facing: [number, number] = [-scene.rotation[0], -scene.rotation[1]];
  const near = scene.features.filter((country) => mayFace(country, facing));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';

  // The sea: lighter up and to the left, as if lit from there.
  const ocean = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.05, cx, cy, radius);
  ocean.addColorStop(0, palette.oceanInner);
  ocean.addColorStop(1, palette.oceanOuter);
  ctx.beginPath();
  path(sphere);
  ctx.fillStyle = ocean;
  ctx.fill();

  ctx.beginPath();
  path(graticule);
  ctx.strokeStyle = palette.graticule;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Every country he has nothing from is one path: one fill and one stroke, however many countries.
  ctx.beginPath();
  for (const country of near) if (!lit.has(country.id)) path(country);
  ctx.fillStyle = palette.land;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  const most = Math.max(0, ...lit.values());
  for (const country of near) {
    const count = lit.get(country.id);
    if (count === undefined) continue;
    ctx.beginPath();
    path(country);
    ctx.globalAlpha = intensity(count, most);
    ctx.fillStyle = palette.lit;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const picked = scene.picked ? near.find((c) => c.id === scene.picked) : undefined;
  if (picked) {
    path.pointRadius(PICKED_DOT_RADIUS);
    ctx.beginPath();
    path(picked);
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  path(sphere);
  ctx.strokeStyle = palette.rim;
  ctx.lineWidth = 1;
  ctx.stroke();
}
