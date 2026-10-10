// The capture module's picture rules (src/capture/captureStill.ts): the long side, the size limit, the thumbnail and the photo's own orientation.
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_LONG_SIDE, MAX_STILL_BYTES, THUMB_LONG_SIDE, captureStill, fitWithin, grabFrame, shrinkToLimit, stillFromFile, stillFromFrame } from '../../src/capture/captureStill';
import { installFakeCamera, type FakeCamera } from '../support/fake-camera';

let camera: FakeCamera;
beforeEach(() => {
  camera = installFakeCamera();
});
afterEach(() => camera.restore());

const video = () => document.createElement('video');

describe('fitWithin', () => {
  it('shrinks the longest side to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it('never makes a small picture bigger', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe('shrinkToLimit', () => {
  it('tries lower quality, then a smaller scale, until one is under the limit', async () => {
    const tried: [number, number][] = [];
    const blob = await shrinkToLimit(async (scale, quality) => {
      tried.push([scale, quality]);
      return new NodeBlob([new Uint8Array(scale === 1 ? 2_000_000 : 900_000)]) as unknown as Blob;
    });
    expect(tried).toEqual([[1, 0.85], [1, 0.7], [1, 0.55], [1, 0.4], [0.75, 0.85]]);
    expect(blob.size).toBeLessThan(MAX_STILL_BYTES);
  });
  it('gives the smallest it managed when nothing fits', async () => {
    let n = 0;
    const blob = await shrinkToLimit(async () => new NodeBlob([new Uint8Array(3_000_000 - 1000 * n++)]) as unknown as Blob);
    expect(blob.size).toBe(3_000_000 - 1000 * 11);
  });
  it('says so when the camera gave nothing', async () => {
    await expect(shrinkToLimit(async () => null)).rejects.toThrow('The camera gave no picture');
  });
});

describe('captureStill', () => {
  it('keeps a camera frame as a JPEG under 1 MB and gives it a 320 px thumbnail', async () => {
    const still = await captureStill(video());
    expect(still.blob.type).toBe('image/jpeg');
    expect(still.blob.size).toBeLessThan(MAX_STILL_BYTES);
    expect({ width: still.width, height: still.height }).toEqual({ width: 1280, height: 720 });
    const thumb = camera.encodes[camera.encodes.length - 1];
    expect(thumb).toMatchObject({ width: THUMB_LONG_SIDE, height: 180, type: 'image/jpeg' });
    expect(still.thumb.size).toBe(thumb.size);
    expect(still.thumb.size).toBeLessThan(still.blob.size);
  });

  it('grabs the frame at the tap without encoding it, and keeps that frame however the camera moves on', async () => {
    const frame = grabFrame(video());
    expect(camera.encodes).toHaveLength(0);
    camera.video.width = 640;
    camera.video.height = 480;
    const still = await stillFromFrame(frame);
    expect({ width: still.width, height: still.height }).toEqual({ width: 1280, height: 720 });
    // the frame's pixels are let go once it is kept
    expect({ width: frame.width, height: frame.height }).toEqual({ width: 0, height: 0 });
  });

  it('refuses a camera that has not started', async () => {
    camera.restore();
    camera = installFakeCamera({ width: 0, height: 0 });
    await expect(captureStill(video())).rejects.toThrow('The camera is not ready yet');
    expect(() => grabFrame(video())).toThrow('The camera is not ready yet');
  });
});

describe('stillFromFile', () => {
  it('downscales a big gallery photo to 1600 px on its long side and under 1 MB', async () => {
    const still = await stillFromFile(new NodeBlob(['x'], { type: 'image/jpeg' }) as unknown as Blob);
    expect(Math.max(still.width, still.height)).toBe(MAX_LONG_SIDE);
    expect({ width: still.width, height: still.height }).toEqual({ width: 1600, height: 1200 });
    expect(still.blob.size).toBeLessThan(MAX_STILL_BYTES);
    // 1.3 MB at the first quality, so it took lower ones
    expect(camera.encodes[0].size).toBeGreaterThan(MAX_STILL_BYTES);
    expect(still.thumb.size).toBeLessThan(40_000);
  });

  it('asks for the photo the way the camera held it (EXIF orientation respected)', async () => {
    const spy = vi.fn(async () => ({ width: 3000, height: 4000, close: () => undefined }));
    globalThis.createImageBitmap = spy as unknown as typeof createImageBitmap;
    const still = await stillFromFile(new NodeBlob(['x']) as unknown as Blob);
    expect(spy).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' });
    expect({ width: still.width, height: still.height }).toEqual({ width: 1200, height: 1600 });
  });

  it('honours a smaller long side (the Photo size limit setting)', async () => {
    const still = await stillFromFile(new NodeBlob(['x']) as unknown as Blob, { maxLongSide: 800 });
    expect(Math.max(still.width, still.height)).toBe(800);
  });
});
