// The bulk finder on drawn pictures (every pixel is known) and on the example photos in grinds/examples.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import jpeg from 'jpeg-js';
import { findCoins, type Circle, type Pixels } from '../../src/bulk';

type Shape = (x: number, y: number) => boolean;
const disc =
  (cx: number, cy: number, r: number): Shape =>
  (x, y) =>
    Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
const box =
  (x0: number, y0: number, x1: number, y1: number): Shape =>
  (x, y) =>
    x >= x0 && x < x1 && y >= y0 && y < y1;

const COIN: [number, number, number] = [190, 150, 70];

/** A picture of shapes on a background (a colour, or a function of the column), with a little steady noise. */
function draw(
  shapes: Shape[],
  bg: [number, number, number] | ((x: number) => [number, number, number]),
  width = 640,
  height = 480,
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 7;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return ((seed >> 16) % 7) - 3;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const base = shapes.some((s) => s(x, y)) ? COIN : typeof bg === 'function' ? bg(x) : bg;
      const o = (y * width + x) * 4;
      data[o] = base[0] + noise();
      data[o + 1] = base[1] + noise();
      data[o + 2] = base[2] + noise();
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Twelve discs, four across and three down. */
const grid = (radius: (i: number) => number = () => 40) => {
  const circles: Circle[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      circles.push({ x: 110 + col * 140, y: 90 + row * 150, r: radius(row * 4 + col) });
    }
  }
  return circles;
};
const discs = (circles: Circle[]) => circles.map((c) => disc(c.x, c.y, c.r));

function expectCircles(found: Circle[], truth: Circle[]) {
  expect(found).toHaveLength(truth.length);
  truth.forEach((t, i) => {
    expect(Math.abs(found[i].x - t.x)).toBeLessThanOrEqual(0.02 * t.r);
    expect(Math.abs(found[i].y - t.y)).toBeLessThanOrEqual(0.02 * t.r);
    expect(Math.abs(found[i].r - t.r)).toBeLessThanOrEqual(0.02 * t.r);
  });
}

describe('findCoins on drawn pictures', () => {
  it('finds a 4x3 grid of one radius, row by row, within 2% of the truth', () => {
    const truth = grid();
    const found = findCoins(draw(discs(truth), [240, 240, 235]));
    expectCircles(found.coins, truth);
    expect(found.touching).toEqual([]);
  });

  it('does the same on a dark background and on a mid-grey one', () => {
    const truth = grid();
    expectCircles(findCoins(draw(discs(truth), [18, 20, 24])).coins, truth);
    expectCircles(findCoins(draw(discs(truth), [128, 128, 128])).coins, truth);
  });

  it('orders row by row even when a row is not level', () => {
    const truth = grid().map((c, i) => ({ ...c, y: c.y + (i % 4) * 9 - 14 }));
    expectCircles(findCoins(draw(discs(truth), [240, 240, 235])).coins, truth);
  });

  it('finds discs of two radii', () => {
    const truth = grid((i) => (i % 2 ? 36 : 44));
    expectCircles(findCoins(draw(discs(truth), [240, 240, 235])).coins, truth);
  });

  it('still gives twelve on a sheet lighter on the left', () => {
    const truth = grid();
    const sheet = (x: number): [number, number, number] => {
      const v = 245 - Math.round((x / 640) * 70);
      return [v, v, v - 5];
    };
    expectCircles(findCoins(draw(discs(truth), sheet)).coins, truth);
  });

  it('names two touching discs as one touching result and cuts no circle', () => {
    const found = findCoins(draw([disc(270, 240, 50), disc(369, 240, 50)], [240, 240, 235]));
    expect(found.coins).toEqual([]);
    expect(found.touching).toHaveLength(1);
    expect(found.touching[0].coins).toBe(2);
    expect(Math.abs(found.touching[0].x - 319.5)).toBeLessThan(3);
  });

  it('names a touching pair among single coins, and keeps the single coins', () => {
    const singles = grid().filter((_, i) => i !== 5 && i !== 6);
    const pair = [disc(250, 240, 40), disc(329, 240, 40)];
    const found = findCoins(draw([...discs(singles), ...pair], [240, 240, 235]));
    expect(found.coins).toHaveLength(10);
    expect(found.touching).toHaveLength(1);
    expect(found.touching[0].coins).toBe(2);
  });

  it('gives no circle for a hand-sized blob', () => {
    const hand = [disc(320, 300, 100), ...[0, 1, 2, 3].map((f) => box(235 + f * 45, 80, 265 + f * 45, 250))];
    const found = findCoins(draw(hand, [240, 240, 235]));
    expect(found.coins).toEqual([]);
    expect(found.touching).toEqual([]);
  });

  it('throws away a ruler lying among coins, and keeps the coins', () => {
    const coins = grid().filter((_, i) => i < 4 || i > 7);
    const ruler = box(200, 225, 500, 255);
    const found = findCoins(draw([...discs(coins), ruler], [240, 240, 235]));
    expect(found.coins).toHaveLength(8);
    expect(found.touching).toEqual([]);
  });

  it('gives no circle for a speck, nor for a picture with no coin in it', () => {
    expect(findCoins(draw([disc(300, 200, 6)], [240, 240, 235])).coins).toEqual([]);
    const empty = findCoins(draw([], [128, 128, 128]));
    expect(empty).toEqual({ coins: [], touching: [] });
  });
});

function photo(name: string): Pixels {
  const jpg = jpeg.decode(readFileSync(`grinds/examples/coin-from-photos/${name}`), { useTArray: true });
  return { width: jpg.width, height: jpg.height, data: new Uint8ClampedArray(jpg.data) };
}

describe('findCoins on the example photos', () => {
  it.each([
    ['the quarter, front', 'washington-quarter-1944s-obverse.jpg'],
    ['the quarter, back', 'washington-quarter-1944s-reverse.jpg'],
    ['the cent, front', 'lincoln-1909s-obverse.jpg'],
    ['the cent, back', 'lincoln-1909s-reverse.jpg'],
  ])('finds exactly one circle in %s', (_name, file) => {
    const img = photo(file);
    const found = findCoins(img);
    expect(found.touching).toEqual([]);
    expect(found.coins).toHaveLength(1);
    const c = found.coins[0];
    // The coin fills the frame: its centre is near the middle and its diameter near the frame's.
    expect(Math.abs(c.x - img.width / 2)).toBeLessThan(0.05 * img.width);
    expect(Math.abs(c.y - img.height / 2)).toBeLessThan(0.05 * img.height);
    expect(c.r).toBeGreaterThan(0.45 * Math.min(img.width, img.height));
  });

  it('finds the dime photo\'s two sides, left then right (it is one photo of both sides)', () => {
    const img = photo('canada-dime-1955.jpg');
    const found = findCoins(img);
    expect(found.touching).toEqual([]);
    expect(found.coins).toHaveLength(2);
    expect(found.coins[0].x).toBeLessThan(img.width / 2);
    expect(found.coins[1].x).toBeGreaterThan(img.width / 2);
  });
});
