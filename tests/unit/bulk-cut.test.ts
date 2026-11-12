// The bulk cutter (src/bulk/cut.ts) on a fake canvas that records its calls: the square it takes from the full-size picture, the grey
// outside the circle, the size limits, the thumbnail, a canvas let go before the next coin, and the coin-size rule.
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_STILL_BYTES, THUMB_LONG_SIDE } from '../../src/capture/captureStill';
import {
  COIN_GOOD_PX,
  COIN_REFUSE_PX,
  COIN_SMALL_MESSAGE,
  COIN_TOO_SMALL_MESSAGE,
  CUT_GREY,
  CUT_MARGIN,
  coinSize,
  cutCoin,
  cutCoins,
  medianDiameter,
} from '../../src/bulk/cut';

interface Call {
  canvas: number;
  op: string;
  args: unknown[];
  /** how many canvases still held pixels (width above 0) when this was called */
  live: number;
  style?: unknown;
}

const BYTES_PER_PIXEL = 0.8;
let canvases: HTMLCanvasElement[] = [];
let calls: Call[] = [];
let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
let decode: ReturnType<typeof vi.fn>;
const saved = {
  getContext: HTMLCanvasElement.prototype.getContext,
  toBlob: HTMLCanvasElement.prototype.toBlob,
  createImageBitmap: globalThis.createImageBitmap,
};

function recordingContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const id = canvases.indexOf(canvas);
  const log = (op: string, args: unknown[], style?: unknown) =>
    calls.push({ canvas: id, op, args, live: canvases.filter((c) => c.width > 0).length, style });
  const ctx: Record<string, unknown> = { fillStyle: '' };
  for (const op of ['save', 'restore', 'beginPath', 'rect', 'moveTo', 'arc', 'closePath', 'fillRect', 'drawImage']) {
    ctx[op] = (...args: unknown[]) => log(op, args);
  }
  ctx.fill = (...args: unknown[]) => log('fill', args, ctx.fillStyle);
  return ctx as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  canvases = [];
  calls = [];
  bitmap = { width: 4000, height: 3000, close: vi.fn() };
  decode = vi.fn(async () => bitmap);
  globalThis.createImageBitmap = decode as unknown as typeof createImageBitmap;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    if (!canvases.includes(this)) canvases.push(this);
    return recordingContext(this);
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
    const size = Math.round(this.width * this.height * (quality ?? 0.92) * BYTES_PER_PIXEL);
    calls.push({ canvas: canvases.indexOf(this), op: 'toBlob', args: [this.width, this.height, quality], live: canvases.filter((c) => c.width > 0).length });
    callback(new NodeBlob([new Uint8Array(size)], { type: type ?? 'image/png' }) as unknown as Blob);
  };
});
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = saved.getContext;
  HTMLCanvasElement.prototype.toBlob = saved.toBlob;
  globalThis.createImageBitmap = saved.createImageBitmap;
});

const photo = () => new NodeBlob(['x'], { type: 'image/jpeg' }) as unknown as Blob;
const drawsOf = (canvas: number) => calls.filter((c) => c.canvas === canvas && c.op === 'drawImage');

describe('cutting one coin out of the full-size picture', () => {
  it('takes the square of 2.08 r centred on the circle, from the full-size picture', async () => {
    await cutCoin(bitmap as unknown as ImageBitmap, { x: 1500, y: 1000, r: 400 });
    const [draw] = drawsOf(0);
    const [source, sx, sy, sw, sh] = draw.args as [unknown, number, number, number, number];
    expect(source).toBe(bitmap);
    expect(CUT_MARGIN).toBe(2.08);
    expect(sw).toBeCloseTo(2.08 * 400);
    expect(sh).toBeCloseTo(2.08 * 400);
    expect(sx + sw / 2).toBeCloseTo(1500);
    expect(sy + sh / 2).toBeCloseTo(1000);
  });

  it('paints everything outside the circle a neutral dark grey, after the picture, so no neighbour peeks into a corner', async () => {
    await cutCoin(bitmap as unknown as ImageBitmap, { x: 2000, y: 1500, r: 400 });
    const [draw] = drawsOf(0);
    const [, , , , , , , dw] = draw.args as number[];
    const fill = calls.find((c) => c.canvas === 0 && c.op === 'fill');
    expect(fill).toBeDefined();
    expect(fill?.style).toBe(CUT_GREY);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(CUT_GREY.slice(i, i + 2), 16));
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeLessThan(0x60);
    expect(fill?.args).toEqual(['evenodd']);
    // the path: the whole canvas, then the circle that is left clear, both centred
    const path = calls.filter((c) => c.canvas === 0 && ['rect', 'arc'].includes(c.op));
    const rect = path.find((c) => c.op === 'rect')?.args as number[];
    const arc = path.find((c) => c.op === 'arc')?.args as number[];
    expect(rect).toEqual([0, 0, dw, dw]);
    expect(arc[0]).toBeCloseTo(dw / 2);
    expect(arc[1]).toBeCloseTo(dw / 2);
    expect(arc[2]).toBeCloseTo(dw / CUT_MARGIN);
    expect(calls.indexOf(fill!)).toBeGreaterThan(calls.indexOf(calls.find((c) => c.op === 'drawImage')!));
  });

  it('keeps a coin that touches the picture’s edge: the square may reach past it and the grey is still painted', async () => {
    const still = await cutCoin(bitmap as unknown as ImageBitmap, { x: 100, y: 100, r: 400 });
    expect(still.width).toBeGreaterThan(0);
    expect(calls.some((c) => c.op === 'fill' && c.style === CUT_GREY)).toBe(true);
  });

  it('shrinks to the Photo size limit and under 1 MB, with a 320 px thumbnail', async () => {
    const big = await cutCoin(bitmap as unknown as ImageBitmap, { x: 2000, y: 1500, r: 1000 });
    expect(Math.max(big.width, big.height)).toBeLessThanOrEqual(1600);
    expect(big.width).toBe(big.height);
    expect(big.blob.size).toBeLessThan(MAX_STILL_BYTES);
    expect(big.blob.type).toBe('image/jpeg');
    const thumbEncode = [...calls].reverse().find((c) => c.op === 'toBlob')!;
    expect(thumbEncode.args.slice(0, 2)).toEqual([THUMB_LONG_SIDE, THUMB_LONG_SIDE]);
    expect(big.thumb.size).toBeLessThan(big.blob.size);

    calls = [];
    const capped = await cutCoin(bitmap as unknown as ImageBitmap, { x: 2000, y: 1500, r: 1000 }, { maxLongSide: 800 });
    expect(Math.max(capped.width, capped.height)).toBeLessThanOrEqual(800);
    expect(capped.blob.size).toBeLessThan(MAX_STILL_BYTES);
  });

  it('does not make a small coin bigger than it is', async () => {
    const still = await cutCoin(bitmap as unknown as ImageBitmap, { x: 2000, y: 1500, r: 300 });
    expect(still.width).toBe(Math.round(2.08 * 300));
    expect(still.height).toBe(still.width);
  });

  it('refuses a circle with no size', async () => {
    await expect(cutCoin(bitmap as unknown as ImageBitmap, { x: 10, y: 10, r: 0 })).rejects.toThrow('The coin has no size');
  });
});

describe('cutting every coin of a group photo', () => {
  const circles = Array.from({ length: 12 }, (_, i) => ({ x: 500 + (i % 4) * 1000, y: 500 + Math.floor(i / 4) * 1000, r: 400 }));

  it('decodes the picture once, as the camera held the phone, and lets it go', async () => {
    const stills = await cutCoins(photo(), circles);
    expect(stills).toHaveLength(12);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' });
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('holds one canvas at a time and lets every one go before the next is made', async () => {
    await cutCoins(photo(), circles);
    expect(Math.max(...calls.map((c) => c.live))).toBe(1);
    expect(canvases.length).toBeGreaterThanOrEqual(24); // at least a picture and a thumbnail for each coin
    expect(canvases.every((c) => c.width === 0 && c.height === 0)).toBe(true);
  });

  it('lets the picture go when a coin fails', async () => {
    await expect(cutCoins(photo(), [circles[0], { x: 1, y: 1, r: 0 }])).rejects.toThrow('The coin has no size');
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(canvases.every((c) => c.width === 0)).toBe(true);
  });

  it('keeps each coin in the order the circles came', async () => {
    const stills = await cutCoins(photo(), [circles[0], { ...circles[1], r: 250 }]);
    expect(stills[0].width).toBeGreaterThan(stills[1].width);
  });
});

describe('the coin size rule', () => {
  it('is good at 700 px or more, small from 500 to under 700, and refused under 500', () => {
    expect([COIN_GOOD_PX, COIN_REFUSE_PX]).toEqual([700, 500]);
    expect(coinSize(1200).verdict).toBe('good');
    expect(coinSize(700).verdict).toBe('good');
    expect(coinSize(699.9).verdict).toBe('small');
    expect(coinSize(500).verdict).toBe('small');
    expect(coinSize(499.9).verdict).toBe('refuse');
    expect(coinSize(0).verdict).toBe('refuse');
  });
  it('says the words the screen will show', () => {
    expect(coinSize(800).message).toBeNull();
    expect(coinSize(600).message).toBe('Coins look small. Move closer or use fewer coins');
    expect(coinSize(400).message).toBe('Too small to read a date');
    expect(COIN_SMALL_MESSAGE).toBe(coinSize(600).message);
    expect(COIN_TOO_SMALL_MESSAGE).toBe(coinSize(400).message);
  });
});

describe('the median diameter', () => {
  it('is the middle diameter, whatever order the circles come in', () => {
    const at = (r: number) => ({ x: 0, y: 0, r });
    expect(medianDiameter([at(400), at(300), at(350)])).toBe(700);
    expect(medianDiameter([at(300), at(400)])).toBe(700);
  });
  it('is one coin’s own diameter, and 0 for none', () => {
    expect(medianDiameter([{ x: 5, y: 5, r: 360 }])).toBe(720);
    expect(medianDiameter([])).toBe(0);
  });
  it('is not pulled by one odd coin', () => {
    const at = (r: number) => ({ x: 0, y: 0, r });
    expect(medianDiameter([at(400), at(400), at(400), at(100)])).toBe(800);
  });
});
