// tests/support/fake-camera.ts: a camera and a canvas for jsdom, which has neither. getUserMedia gives a stream that only counts
// its stops, a video reports a size, and a canvas "encodes" a JPEG whose byte size follows its pixels and quality, so the size
// limits are really exercised. Every encode is remembered (width, height, quality) for a test to read.
import { Blob as NodeBlob } from 'node:buffer';

export interface Encode {
  width: number;
  height: number;
  type: string;
  quality: number | undefined;
  size: number;
}

export interface FakeCamera {
  encodes: Encode[];
  /** how many tracks have been stopped */
  stops: () => number;
  /** the size the video reports; change it to make the next frame a different one */
  video: { width: number; height: number };
  /** the size createImageBitmap reports for a gallery photo */
  gallery: { width: number; height: number };
  restore: () => void;
}

/** Bytes per pixel at quality 1: 1600 x 1200 at 0.85 comes out at about 1.3 MB, so the first try is too big and the limit bites. */
const BYTES_PER_PIXEL = 0.8;

export function installFakeCamera(size = { width: 1280, height: 720 }): FakeCamera {
  const video = { ...size };
  const encodes: Encode[] = [];
  let stopped = 0;
  const gallery = { width: 4000, height: 3000 };
  const track = { stop: () => void stopped++ };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;

  const saved = {
    mediaDevices: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
    play: HTMLMediaElement.prototype.play,
    getContext: HTMLCanvasElement.prototype.getContext,
    toBlob: HTMLCanvasElement.prototype.toBlob,
    createImageBitmap: globalThis.createImageBitmap,
  };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => stream } });
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => video.width });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => video.height });
  HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: () => undefined })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: number) {
    const size = Math.round(this.width * this.height * (quality ?? 0.92) * BYTES_PER_PIXEL);
    encodes.push({ width: this.width, height: this.height, type: type ?? 'image/png', quality, size });
    callback(new NodeBlob([new Uint8Array(size)], { type: type ?? 'image/png' }) as unknown as Blob);
  };
  globalThis.createImageBitmap = (async () => ({ width: gallery.width, height: gallery.height, close: () => undefined })) as unknown as typeof createImageBitmap;

  return {
    encodes,
    stops: () => stopped,
    video,
    gallery,
    restore: () => {
      if (saved.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', saved.mediaDevices);
      else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
      HTMLMediaElement.prototype.play = saved.play;
      HTMLCanvasElement.prototype.getContext = saved.getContext;
      HTMLCanvasElement.prototype.toBlob = saved.toBlob;
      globalThis.createImageBitmap = saved.createImageBitmap;
    },
  };
}
