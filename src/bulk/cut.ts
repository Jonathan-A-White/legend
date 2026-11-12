// Cut one coin out of a full-size group photo: the square of 2.08 r round the circle, everything outside the circle painted a neutral
// dark grey (so a neighbour's rim never peeks into a corner and the picture looks like just one front, one back), then shrunk the way
// every kept photo is (captureStill.ts: the long side at most the Photo size limit, under 1 MB, plus the 320 px thumbnail).
// The size rule for the coins of a whole photo (the median diameter, good, small or refused) is here too, as pure functions.
import { MAX_LONG_SIDE, THUMB_LONG_SIDE, fitWithin, shrinkToLimit, type Still, type StillOptions } from '../capture/captureStill';
import type { Circle } from './find';

/** The side of the square cut out, in coin radii: the coin's diameter and a 4% margin each side. */
export const CUT_MARGIN = 2.08;
/** What is painted outside the circle: a neutral dark grey. */
export const CUT_GREY = '#333333';

const THUMB_QUALITY = 0.6;

/** A coin photo whose median coin is at least this many pixels across (in the full-size picture) is good. */
export const COIN_GOOD_PX = 700;
/** Under this the coins are too small to read a date, and the photo is refused. */
export const COIN_REFUSE_PX = 500;
export const COIN_SMALL_MESSAGE = 'Coins look small. Move closer or use fewer coins';
export const COIN_TOO_SMALL_MESSAGE = 'Too small to read a date';

export type CoinSize = { verdict: 'good'; message: null } | { verdict: 'small'; message: string } | { verdict: 'refuse'; message: string };

/** The middle diameter of the circles, in their own pixels; 0 when there are none. */
export function medianDiameter(circles: Circle[]): number {
  if (circles.length === 0) return 0;
  const sorted = circles.map((c) => c.r * 2).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** What to do with a photo whose median coin is `diameter` pixels across: go on, go on with a word of warning, or stop. */
export function coinSize(diameter: number): CoinSize {
  if (diameter >= COIN_GOOD_PX) return { verdict: 'good', message: null };
  if (diameter >= COIN_REFUSE_PX) return { verdict: 'small', message: COIN_SMALL_MESSAGE };
  return { verdict: 'refuse', message: COIN_TOO_SMALL_MESSAGE };
}

/** Draws the cut square at `size` by `size` and encodes it; the canvas is let go at once, whatever happens. */
async function painted(source: ImageBitmap, circle: Circle, size: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  try {
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const side = CUT_MARGIN * circle.r;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, circle.x - side / 2, circle.y - side / 2, side, side, 0, 0, size, size);
    // grey over everything but the circle: the whole square with the circle taken out
    const middle = size / 2;
    const radius = size / CUT_MARGIN;
    context.beginPath();
    context.rect(0, 0, size, size);
    context.moveTo(middle + radius, middle);
    context.arc(middle, middle, radius, 0, Math.PI * 2);
    context.closePath();
    context.fillStyle = CUT_GREY;
    context.fill('evenodd');
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Cuts the coin at `circle` (in the bitmap's own pixels) out of an already decoded picture. */
export async function cutCoin(source: ImageBitmap, circle: Circle, options: StillOptions = {}): Promise<Still> {
  if (!(circle.r > 0)) throw new Error('The coin has no size');
  const side = Math.round(CUT_MARGIN * circle.r);
  const frame = fitWithin(side, side, options.maxLongSide ?? MAX_LONG_SIDE);
  // each try's size in pixels, so the kept picture says its own
  const sizes = new Map<Blob, number>();
  const blob = await shrinkToLimit(async (scale, quality) => {
    const size = Math.max(1, Math.round(frame.width * scale));
    const tried = await painted(source, circle, size, quality);
    if (tried) sizes.set(tried, size);
    return tried;
  }, options.maxBytes);
  const kept = sizes.get(blob) ?? frame.width;
  const thumb = await painted(source, circle, Math.min(side, THUMB_LONG_SIDE), THUMB_QUALITY);
  if (!thumb) throw new Error('The camera gave no picture');
  return { blob, thumb, width: kept, height: kept };
}

/** Cuts every circle out of one group photo, in the order given. The photo is decoded once (as the camera held the phone, EXIF
 * respected) and let go at the end; each coin's canvases are let go before the next coin is cut. */
export async function cutCoins(file: Blob, circles: Circle[], options: StillOptions = {}): Promise<Still[]> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const stills: Still[] = [];
    for (const circle of circles) stills.push(await cutCoin(bitmap, circle, options));
    return stills;
  } finally {
    bitmap.close();
  }
}
