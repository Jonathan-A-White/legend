// Find the coins in a photo: a pure function over RGBA pixels, so a test needs no canvas.
// The caller scales the photo to about 640 px on the long side and scales the circles back up.

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, four bytes a pixel, as ImageData gives. */
  data: Uint8ClampedArray;
}

/** A circle in the pixels of the image given; a pixel's centre is at (column + 0.5, row + 0.5), as on a canvas. */
export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Two or more coins touching: the circle round the lot, and how many coins it looks like. Never cut. */
export interface Touching extends Circle {
  coins: number;
}

export interface Found {
  /** One circle a coin, row by row, then left to right. */
  coins: Circle[];
  /** Blobs of coins touching each other, in the same order. */
  touching: Touching[];
}

const SPECK = 0.004; // of the image's area
const ROUND = 0.8; // blob area against its enclosing circle
const TOO_BIG = 1.6; // blob area against the median coin's
const FLOOR = 40; // colour distance (RGB) below which nothing counts as a coin, however Otsu splits noise
const BORDER_INLIER = 40;

type Rgb = [number, number, number];

/** The border ring's pixels as indexes into the image, a ring of about 1% of the short side. */
function borderIndexes({ width, height }: Pixels): number[] {
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.01));
  const out: number[] = [];
  for (let y = 0; y < height; y++) {
    const edgeRow = y < ring || y >= height - ring;
    for (let x = 0; x < width; x++) {
      if (edgeRow || x < ring || x >= width - ring) out.push(y * width + x);
    }
  }
  return out;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Solve the 3x3 system a·x = b by Cramer's rule; null when it is singular. */
function solve3(a: number[][], b: number[]): number[] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(a);
  if (Math.abs(d) < 1e-9) return null;
  return [0, 1, 2].map((col) => det(a.map((row, i) => row.map((v, j) => (j === col ? b[i] : v)))) / d);
}

/**
 * The background as a plane per channel, v = c0 + cx·u + cy·v with u, v in -0.5..0.5 across the image. It starts as the
 * commonest colour on the border (a coin cut off by the edge cannot outvote the corners), then follows the border's
 * pixels that agree with it, so a sheet lit from one side is still one background.
 */
function backgroundModel(img: Pixels): (x: number, y: number) => Rgb {
  const { width, height, data } = img;
  const border = borderIndexes(img);
  const bins = new Map<number, number[]>();
  for (const i of border) {
    const key = (data[i * 4] >> 4) * 256 + (data[i * 4 + 1] >> 4) * 16 + (data[i * 4 + 2] >> 4);
    const list = bins.get(key);
    if (list) list.push(i);
    else bins.set(key, [i]);
  }
  let best: number[] = [];
  for (const list of bins.values()) if (list.length > best.length) best = list;
  const base: Rgb = [0, 0, 0];
  for (let c = 0; c < 3; c++) base[c] = median(best.map((i) => data[i * 4 + c]));
  let planes: number[][] | null = null; // per channel [c0, cx, cy]
  const predict = (x: number, y: number): Rgb => {
    if (!planes) return base;
    const u = x / width - 0.5;
    const v = y / height - 0.5;
    return [0, 1, 2].map((c) => planes![c][0] + planes![c][1] * u + planes![c][2] * v) as Rgb;
  };
  for (let round = 0; round < 5; round++) {
    const inliers = border.filter((i) => {
      const p = predict(i % width, Math.floor(i / width));
      const dr = data[i * 4] - p[0];
      const dg = data[i * 4 + 1] - p[1];
      const db = data[i * 4 + 2] - p[2];
      return Math.hypot(dr, dg, db) <= BORDER_INLIER;
    });
    if (inliers.length < 12) break;
    const a = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const rhs = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const i of inliers) {
      const u = (i % width) / width - 0.5;
      const v = Math.floor(i / width) / height - 0.5;
      const row = [1, u, v];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) a[r][c] += row[r] * row[c];
        for (let ch = 0; ch < 3; ch++) rhs[ch][r] += row[r] * data[i * 4 + ch];
      }
    }
    const next = [0, 1, 2].map((ch) => solve3(a, rhs[ch]));
    if (next.some((p) => p === null)) break;
    planes = next as number[][];
  }
  if (!planes) return () => base;
  return predict;
}

/** The threshold that best splits a histogram in two (Otsu), as a bin index. */
function otsu(hist: Uint32Array): number {
  let total = 0;
  let sumAll = 0;
  for (let i = 0; i < hist.length; i++) {
    total += hist[i];
    sumAll += i * hist[i];
  }
  let w0 = 0;
  let sum0 = 0;
  let bestVar = -1;
  let best = 0;
  for (let i = 0; i < hist.length - 1; i++) {
    w0 += hist[i];
    sum0 += i * hist[i];
    const w1 = total - w0;
    if (w0 === 0 || w1 === 0) continue;
    const m0 = sum0 / w0;
    const m1 = (sumAll - sum0) / w1;
    const between = w0 * w1 * (m0 - m1) * (m0 - m1);
    if (between > bestVar) {
      bestVar = between;
      best = i;
    }
  }
  return best;
}

/** Mark the pixels that are not background: further from the background than Otsu's threshold, holes filled. */
function foreground(img: Pixels): Uint8Array {
  const { width, height, data } = img;
  const bg = backgroundModel(img);
  const dist = new Float32Array(width * height);
  const hist = new Uint32Array(256);
  const SCALE = 255 / Math.hypot(255, 255, 255);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = bg(x, y);
      const d = Math.hypot(data[i * 4] - p[0], data[i * 4 + 1] - p[1], data[i * 4 + 2] - p[2]);
      dist[i] = d;
      hist[Math.min(255, Math.round(d * SCALE))]++;
    }
  }
  const t = Math.max(FLOOR, (otsu(hist) + 0.5) / SCALE);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = dist[i] > t ? 1 : 0;
  return fillHoles(mask, width, height);
}

/** A silver coin on white has a face as pale as the sheet: everything the outside cannot reach is part of the blob. */
function fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < width * (height - 1)) push(i + width);
  }
  for (let i = 0; i < mask.length; i++) if (!outside[i]) mask[i] = 1;
  return mask;
}

interface Blob {
  area: number;
  x: number;
  y: number;
  /** Radius of the circle that holds every pixel, centred on the centroid. */
  hold: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  pixels: number[];
}

function labelBlobs(mask: Uint8Array, width: number, height: number): Blob[] {
  const seen = new Uint8Array(mask.length);
  const blobs: Blob[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const pixels: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      pixels.push(i);
      const x = i % width;
      const visit = (j: number) => {
        if (mask[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      };
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (i >= width) visit(i - width);
      if (i < width * (height - 1)) visit(i + width);
    }
    let sx = 0;
    let sy = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    for (const i of pixels) {
      const x = i % width;
      const y = (i - x) / width;
      sx += x + 0.5;
      sy += y + 0.5;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const cx = sx / pixels.length;
    const cy = sy / pixels.length;
    let far = 0;
    for (const i of pixels) {
      const x = i % width;
      const y = (i - x) / width;
      far = Math.max(far, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5);
    }
    blobs.push({ area: pixels.length, x: cx, y: cy, hold: far, minX, maxX, minY, maxY, pixels });
  }
  return blobs;
}

const roundness = (b: Blob) => b.area / (Math.PI * b.hold * b.hold);

/**
 * How many coins a blob is, when it is coins touching: the distance from each pixel to the blob's edge (3-4 chamfer),
 * its peaks as coin centres (the roomiest first, no two inside each other's disc), a neck between every two near
 * peaks (a ruler or a hand has none), and the discs covering most of the blob. 0 when it is not coins.
 */
function coinsTouching(b: Blob, width: number): number {
  const w = b.maxX - b.minX + 3;
  const h = b.maxY - b.minY + 3;
  const d = new Int32Array(w * h);
  for (const i of b.pixels) {
    const x = (i % width) - b.minX + 1;
    const y = Math.floor(i / width) - b.minY + 1;
    d[y * w + x] = 1 << 20;
  }
  const relax = (i: number, j: number, cost: number) => {
    if (d[i] > d[j] + cost) d[i] = d[j] + cost;
  };
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      relax(i, i - 1, 3);
      relax(i, i - w, 3);
      relax(i, i - w - 1, 4);
      relax(i, i - w + 1, 4);
    }
  }
  for (let y = h - 2; y >= 1; y--) {
    for (let x = w - 2; x >= 1; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      relax(i, i + 1, 3);
      relax(i, i + w, 3);
      relax(i, i + w + 1, 4);
      relax(i, i + w - 1, 4);
    }
  }
  let max = 0;
  for (const v of d) if (v > max) max = v;
  const R = max / 3;
  if (R < 2) return 0;
  const candidates: { x: number; y: number; r: number }[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const r = d[y * w + x] / 3;
      if (r >= 0.75 * R) candidates.push({ x, y, r });
    }
  }
  candidates.sort((p, q) => q.r - p.r);
  const peaks: { x: number; y: number; r: number }[] = [];
  for (const c of candidates) {
    if (peaks.every((p) => Math.hypot(c.x - p.x, c.y - p.y) >= 0.9 * (c.r + p.r))) peaks.push(c);
  }
  if (peaks.length < 2 || peaks.length > 12) return 0;
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const p = peaks[i];
      const q = peaks[j];
      const gap = Math.hypot(q.x - p.x, q.y - p.y);
      if (gap > 1.2 * (p.r + q.r)) continue;
      let narrowest = Infinity;
      const steps = Math.ceil(gap);
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(p.x + ((q.x - p.x) * s) / steps);
        const y = Math.round(p.y + ((q.y - p.y) * s) / steps);
        narrowest = Math.min(narrowest, d[y * w + x] / 3);
      }
      if (narrowest >= 0.85 * Math.min(p.r, q.r)) return 0;
    }
  }
  let covered = 0;
  for (const i of b.pixels) {
    const x = (i % width) - b.minX + 1;
    const y = Math.floor(i / width) - b.minY + 1;
    if (peaks.some((p) => Math.hypot(x - p.x, y - p.y) <= p.r * 1.1 + 1)) covered++;
  }
  return covered / b.area >= 0.85 ? peaks.length : 0;
}

/** Row by row, then left to right: rows are clustered by y within half a median diameter. */
function inReadingOrder<T extends Circle>(items: T[], diameter: number): T[] {
  const byY = [...items].sort((a, b) => a.y - b.y);
  const rows: T[][] = [];
  let rowY = 0;
  for (const item of byY) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(item.y - rowY) <= diameter / 2) {
      row.push(item);
      rowY = row.reduce((s, c) => s + c.y, 0) / row.length;
    } else {
      rows.push([item]);
      rowY = item.y;
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}

export function findCoins(img: Pixels): Found {
  const { width, height } = img;
  if (width < 8 || height < 8) return { coins: [], touching: [] };
  const blobs = labelBlobs(foreground(img), width, height).filter((b) => b.area >= SPECK * width * height);

  const round = blobs.filter((b) => roundness(b) >= ROUND);
  const typical = round.length ? median(round.map((b) => b.area)) : 0;
  const coins: Circle[] = [];
  const touching: Touching[] = [];
  for (const b of blobs) {
    const isRound = roundness(b) >= ROUND;
    const big = typical === 0 || b.area > TOO_BIG * typical;
    // A round blob is a coin, unless it is plainly two or more discs; the rest must be discs touching, or go.
    const count = !isRound || big ? coinsTouching(b, width) : 0;
    if (count >= 2 && (typical === 0 || b.area > TOO_BIG * typical)) {
      touching.push({ x: b.x, y: b.y, r: b.hold, coins: count });
    } else if (isRound) {
      coins.push({ x: b.x, y: b.y, r: Math.sqrt(b.area / Math.PI) });
    }
  }
  const diameter = coins.length ? 2 * median(coins.map((c) => c.r)) : 2 * Math.sqrt(typical / Math.PI);
  return {
    coins: inReadingOrder(coins, diameter),
    touching: inReadingOrder(touching, diameter || 2 * median(touching.map((t) => t.r))),
  };
}
