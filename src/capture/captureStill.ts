// src/capture/captureStill.ts: a photo from the camera or the gallery as a JPEG that fits what the factory takes: the longest side
// at most 1600 px (or the Photo size limit setting), under 1 MB, upright, with a small thumbnail beside it. Lifted from TradeTracker's
// capture-still.ts: lower quality is tried first, then a smaller scale (PWA best practices, section 13).

/** The longest side of a kept photo, in pixels, at most. */
export const MAX_LONG_SIDE = 1600;
/** A kept photo is under this many bytes. */
export const MAX_STILL_BYTES = 1_000_000;
/** The longest side of a thumbnail. */
export const THUMB_LONG_SIDE = 320;

const QUALITIES = [0.85, 0.7, 0.55, 0.4];
const SCALES = [1, 0.75, 0.5];
const THUMB_QUALITY = 0.6;

/** A photo ready to keep: the picture, its thumbnail and the picture's size in pixels. */
export interface Still {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export interface StillOptions {
  maxLongSide?: number;
  maxBytes?: number;
}

export function fitWithin(width: number, height: number, maxLongSide: number): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= maxLongSide) return { width, height };
  const ratio = maxLongSide / longSide;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Tries ever smaller encodings (lower quality, then smaller scale) until one is under `maxBytes`; gives the smallest if none is. */
export async function shrinkToLimit(encode: (scale: number, quality: number) => Promise<Blob | null>, maxBytes: number = MAX_STILL_BYTES): Promise<Blob> {
  let smallest: Blob | null = null;
  for (const scale of SCALES) {
    for (const quality of QUALITIES) {
      const blob = await encode(scale, quality);
      if (!blob) continue;
      if (blob.size < maxBytes) return blob;
      if (!smallest || blob.size < smallest.size) smallest = blob;
    }
  }
  if (!smallest) throw new Error('The camera gave no picture');
  return smallest;
}

function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Draws `source` at `width` by `height` and encodes it. */
function drawn(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  context.drawImage(source, 0, 0, width, height);
  return jpeg(canvas, quality);
}

async function encode(source: CanvasImageSource, width: number, height: number, options: StillOptions): Promise<Still> {
  const frame = fitWithin(width, height, options.maxLongSide ?? MAX_LONG_SIDE);
  if (frame.width === 0 || frame.height === 0) throw new Error('The picture is empty');
  // each try's size in pixels, so the kept picture says its own
  const sizes = new Map<Blob, { width: number; height: number }>();
  const blob = await shrinkToLimit(async (scale, quality) => {
    const size = { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) };
    const tried = await drawn(source, size.width, size.height, quality);
    if (tried) sizes.set(tried, size);
    return tried;
  }, options.maxBytes);
  const kept = sizes.get(blob) ?? frame;
  const small = fitWithin(width, height, THUMB_LONG_SIDE);
  const thumb = await drawn(source, small.width, small.height, THUMB_QUALITY);
  if (!thumb) throw new Error('The camera gave no picture');
  return { blob, thumb, width: kept.width, height: kept.height };
}

/** Takes a still from a playing video. */
export async function captureStill(video: HTMLVideoElement, options: StillOptions = {}): Promise<Still> {
  if (video.videoWidth === 0 || video.videoHeight === 0) throw new Error('The camera is not ready yet');
  return encode(video, video.videoWidth, video.videoHeight, options);
}

/** Turns a photo chosen from the gallery into a still. The bitmap is read the way the camera held the phone (EXIF orientation), so a
 * portrait photo is not laid on its side. */
export async function stillFromFile(file: Blob, options: StillOptions = {}): Promise<Still> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await encode(bitmap, bitmap.width, bitmap.height, options);
  } finally {
    bitmap.close();
  }
}
