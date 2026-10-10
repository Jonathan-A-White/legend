// src/share/picture.ts: draws the two pictures he can share onto a canvas that is never on the page, and cuts each to a JPEG.
// The globe picture is 1080 x 1080: the globe as he left it, the caption, the Legend mark and the date. The item card is
// 1080 x 1350: both photos and the facts of cardFacts (text.ts). The drawing goes through PictureContext, the canvas calls used,
// so a test can read every word written on a picture.
import { createRenderer, type DrawContext, type Palette, type Rotation } from '../globe/render';
import type { CountryFeature } from '../globe/geo';
import { globeCaption, type CardFacts } from './text';

export const GLOBE_SIZE = 1080;
export const CARD_SIZE = { width: 1080, height: 1350 } as const;
const QUALITY = 0.92;

/** The canvas calls a picture uses on top of the globe's. */
export interface PictureContext extends DrawContext {
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalCompositeOperation: GlobalCompositeOperation;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): TextMetrics;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  setLineDash(segments: number[]): void;
}

export interface Picture {
  blob: Blob;
  width: number;
  height: number;
}

/** The colours of a shared picture: always the dark ones, so it looks the same whatever theme the phone is in. */
const INK = '#e9efe9';
const MUTED = '#95ab9f';
const GOLD = '#d9b45a';
const GROUND = '#07130f';
const SURFACE = '#0d211a';
const LINE = '#1d3a2e';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function cut(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made.'))), 'image/jpeg', QUALITY);
  });
}

function begin(width: number, height: number): { canvas: HTMLCanvasElement; ctx: PictureContext } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as PictureContext | null;
  if (!ctx) throw new Error('The picture could not be made.');
  return { canvas, ctx };
}

/** Paints the ground behind everything already drawn (the globe's renderer clears first, so the ground comes last). */
function groundBehind(ctx: PictureContext, width: number, height: number): void {
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function text(ctx: PictureContext, value: string, x: number, y: number, size: number, colour: string, opts: { weight?: number; align?: CanvasTextAlign; fit?: number } = {}): void {
  let px = size;
  const weight = opts.weight ?? 400;
  ctx.font = `${weight} ${px}px ${FONT}`;
  // A line that would run off the picture is made smaller, down to two thirds, then left as it is.
  while (opts.fit && px > size * 0.66 && ctx.measureText(value).width > opts.fit) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${FONT}`;
  }
  ctx.fillStyle = colour;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

/** Words broken into lines no wider than `width`, at most `max` lines (the last ends in … when words are left). */
function wrap(ctx: PictureContext, value: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  const words = value.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (line && ctx.measureText(next).width > width) {
      if (lines.length === max - 1) return [...lines, `${line} ${words.slice(i).join(' ')}`.slice(0, 60).trimEnd() + '…'];
      lines.push(line);
      line = words[i];
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const longDate = (d: Date) => `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'long' })} ${d.getFullYear()}`;

/** The Legend mark (a gold coin and the name) at the left and the date at the right of the picture's foot. */
function foot(ctx: PictureContext, width: number, y: number, today: Date): void {
  ctx.beginPath();
  ctx.arc(80, y - 12, 18, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, y - 12, 10, 0, Math.PI * 2);
  ctx.strokeStyle = GROUND;
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, 'Legend', 112, y, 40, GOLD, { weight: 600 });
  text(ctx, longDate(today), width - 60, y, 32, MUTED, { align: 'right' });
}

export interface GlobePictureInput {
  features: readonly CountryFeature[];
  /** alpha-2 -> how many items he has from there */
  lit: ReadonlyMap<string, number>;
  rotation: Rotation;
  /** the owner's name from the setting; empty says My */
  name: string;
  palette: Palette;
  today?: Date;
}

/** The globe as he left it, lit where his items come from, under its caption. */
export async function renderGlobePicture(input: GlobePictureInput): Promise<Picture> {
  const { canvas, ctx } = begin(GLOBE_SIZE, GLOBE_SIZE);
  const globeHeight = 800;
  createRenderer().draw(ctx, { width: GLOBE_SIZE, height: globeHeight, dpr: 1, rotation: input.rotation, features: input.features, lit: input.lit, picked: null, palette: input.palette });
  groundBehind(ctx, GLOBE_SIZE, GLOBE_SIZE);
  text(ctx, globeCaption(input.name, input.lit.size), GLOBE_SIZE / 2, 890, 56, INK, { weight: 600, align: 'center', fit: 960 });
  foot(ctx, GLOBE_SIZE, 1020, input.today ?? new Date());
  return { blob: await cut(canvas), width: GLOBE_SIZE, height: GLOBE_SIZE };
}

/** A photo as something a canvas can draw, upright whatever the camera wrote in its EXIF. */
async function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

const TILE = 470;
const MARGIN = 60;

function tile(ctx: PictureContext, x: number, y: number, side: 'Obverse' | 'Reverse', image: ImageBitmap | null): void {
  ctx.fillStyle = SURFACE;
  ctx.fillRect(x, y, TILE, TILE);
  if (image) {
    const scale = Math.min(TILE / image.width, TILE / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, x + (TILE - w) / 2, y + (TILE - h) / 2, w, h);
  } else {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.strokeRect(x, y, TILE, TILE);
    ctx.setLineDash([]);
    text(ctx, `No ${side.toLowerCase()} photo`, x + TILE / 2, y + TILE / 2, 32, MUTED, { align: 'center' });
  }
  text(ctx, side, x + TILE / 2, y + TILE + 44, 30, MUTED, { align: 'center' });
}

export interface ItemCardInput {
  facts: CardFacts;
  photos: { obverse?: Blob; reverse?: Blob };
  today?: Date;
}

/** One item as a card: its two photos, its country, and the facts of cardFacts. */
export async function renderItemCard(input: ItemCardInput): Promise<Picture> {
  const { width, height } = CARD_SIZE;
  const { canvas, ctx } = begin(width, height);
  const [obverse, reverse] = await Promise.all([input.photos.obverse ? decode(input.photos.obverse) : null, input.photos.reverse ? decode(input.photos.reverse) : null]);
  const { facts } = input;

  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, width, height);
  text(ctx, facts.title, MARGIN, 120, 68, GOLD, { weight: 700, fit: width - MARGIN * 2 });
  if (facts.country) text(ctx, `${facts.country.flag} ${facts.country.name}`, MARGIN, 185, 44, INK, { fit: width - MARGIN * 2 });
  tile(ctx, MARGIN, 240, 'Obverse', obverse);
  tile(ctx, width - MARGIN - TILE, 240, 'Reverse', reverse);
  obverse?.close?.();
  reverse?.close?.();

  let y = 850;
  for (const row of facts.rows.slice(0, 5)) {
    text(ctx, row.label, MARGIN, y, 34, MUTED);
    text(ctx, row.value, 300, y, 40, INK, { fit: width - 300 - MARGIN });
    y += 62;
  }
  if (facts.inscription) {
    ctx.font = `400 36px ${FONT}`;
    y += 20;
    for (const line of wrap(ctx, facts.inscription, width - MARGIN * 2, 2)) {
      text(ctx, line, MARGIN, y, 36, INK, { fit: width - MARGIN * 2 });
      y += 48;
    }
  }
  foot(ctx, width, height - 50, input.today ?? new Date());
  return { blob: await cut(canvas), width, height };
}
