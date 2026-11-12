// Look at a group photo: where the coins are in it, in the photo's own full-size pixels. The photo is read once, copied to a canvas
// about 640 px on the long side (findCoins is made for that size) and the circles are scaled back up; a second, larger copy makes
// the preview he checks the outlines on. Nothing here is stored or sent: the group photo is held in memory only.
import { findCoins, type Circle, type Pixels, type Touching } from './find';
import { medianDiameter } from './cut';

/** The long side of the copy the coins are found in. */
export const ANALYSIS_SIDE = 640;
/** The long side of the copy he looks at while he checks the outlines. */
export const PREVIEW_SIDE = 960;

/** What is in one group photo, in the pixels of the full-size picture. */
export interface Look {
  width: number;
  height: number;
  /** One circle a coin, numbered 1..n in this order: row by row, then left to right. */
  coins: Circle[];
  /** Coins touching each other: never numbered, never cut. */
  touching: Touching[];
  /** The middle coin's width in the full-size picture; 0 when there is no coin. */
  diameter: number;
}

/** The look of a picture whose full size is `width` by `height`, from a smaller copy of it. */
export function lookAtPixels(copy: Pixels, width: number, height: number): Look {
  const found = findCoins(copy);
  const k = width / copy.width;
  const up = <T extends Circle>(c: T): T => ({ ...c, x: c.x * k, y: c.y * k, r: c.r * k });
  const coins = found.coins.map(up);
  return { width, height, coins, touching: found.touching.map(up), diameter: medianDiameter(coins) };
}

/** The bitmap drawn on a canvas whose long side is `side` (never larger than the bitmap itself). */
function drawn(bitmap: ImageBitmap, side: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * k));
  canvas.height = Math.max(1, Math.round(bitmap.height * k));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The photo could not be read');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

/** Reads a group photo (as the camera held the phone, EXIF respected): the coins in it and a preview to draw the outlines on. */
export async function lookAtPhoto(photo: Blob): Promise<{ look: Look; preview: Blob | null }> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' });
  try {
    const small = drawn(bitmap, ANALYSIS_SIDE);
    let look: Look;
    try {
      look = lookAtPixels(small.context.getImageData(0, 0, small.canvas.width, small.canvas.height), bitmap.width, bitmap.height);
    } finally {
      small.canvas.width = 0;
      small.canvas.height = 0;
    }
    const big = drawn(bitmap, PREVIEW_SIDE);
    try {
      const preview = await new Promise<Blob | null>((resolve) => big.canvas.toBlob(resolve, 'image/jpeg', 0.8));
      return { look, preview };
    } finally {
      big.canvas.width = 0;
      big.canvas.height = 0;
    }
  } finally {
    bitmap.close();
  }
}
