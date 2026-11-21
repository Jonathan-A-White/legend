// src/capture/useCamera.ts: the default asks for what Add always asked, 'sensor' asks for the camera's full size, and the camera is
// let go when the screen closes.
import { cleanup, render, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SENSOR_SIZE, useCamera, type CameraResolution } from '../../src/capture/useCamera';
import { installFakeCamera, type FakeCamera } from '../support/fake-camera';

let camera: FakeCamera;
const hook: { takePhoto: (() => Promise<Blob | null>) | null } = { takePhoto: null };
beforeEach(() => {
  camera = installFakeCamera();
  hook.takePhoto = null;
});
afterEach(() => {
  cleanup();
  camera.restore();
  delete (window as unknown as { ImageCapture?: unknown }).ImageCapture;
});

function Probe({ resolution }: { resolution?: CameraResolution }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { ready, takePhoto } = useCamera(ref, resolution);
  useEffect(() => {
    hook.takePhoto = takePhoto;
  }, [takePhoto]);
  return (
    <div>
      <video ref={ref} />
      <p>{ready ? 'ready' : 'opening'}</p>
    </div>
  );
}

const open = async (resolution?: CameraResolution) => {
  const view = render(<Probe resolution={resolution} />);
  await waitFor(() => expect(view.getByText('ready')).toBeTruthy());
  return view;
};

describe('useCamera', () => {
  it('asks for the back camera and nothing more by default', async () => {
    await open();
    expect(camera.asked).toEqual([{ video: { facingMode: 'environment' }, audio: false }]);
  });

  it("asks for the camera's full size when it is told to", async () => {
    await open('sensor');
    expect(camera.asked).toEqual([
      { video: { facingMode: 'environment', width: { ideal: SENSOR_SIZE.width }, height: { ideal: SENSOR_SIZE.height } }, audio: false },
    ]);
    expect(SENSOR_SIZE).toEqual({ width: 4096, height: 3072 });
  });

  it('gives the sensor picture through ImageCapture where the browser has it, and null where it has not', async () => {
    await open('sensor');
    expect(await hook.takePhoto!()).toBeNull();
    cleanup();
    const sensor = new Blob(['sensor'], { type: 'image/jpeg' });
    (window as unknown as { ImageCapture: unknown }).ImageCapture = class {
      takePhoto = async () => sensor;
    };
    await open('sensor');
    expect(await hook.takePhoto!()).toBe(sensor);
  });

  it("asks the sensor's biggest picture of ImageCapture, and any picture it can give when the phone will not say", async () => {
    const asked: unknown[] = [];
    const big = new Blob(['big'], { type: 'image/jpeg' });
    (window as unknown as { ImageCapture: unknown }).ImageCapture = class {
      getPhotoCapabilities = async () => ({ imageWidth: { min: 80, max: 4000, step: 1 }, imageHeight: { min: 60, max: 3000, step: 1 } });
      takePhoto = async (settings?: unknown) => {
        asked.push(settings);
        return big;
      };
    };
    await open('sensor');
    expect(await hook.takePhoto!()).toBe(big);
    expect(asked).toEqual([{ imageWidth: 4000, imageHeight: 3000 }]);
    cleanup();
    asked.length = 0;
    (window as unknown as { ImageCapture: unknown }).ImageCapture = class {
      getPhotoCapabilities = async () => {
        throw new Error('no');
      };
      takePhoto = async (settings?: unknown) => {
        asked.push(settings);
        return big;
      };
    };
    await open('sensor');
    expect(await hook.takePhoto!()).toBe(big);
    expect(asked).toEqual([undefined]);
  });

  it('asks the group camera to keep focus where the phone can, and goes on where it cannot', async () => {
    const applied: unknown[] = [];
    camera.track.getCapabilities = () => ({ focusMode: ['manual', 'continuous'] });
    camera.track.applyConstraints = async (c) => void applied.push(c);
    await open('sensor');
    expect(applied).toEqual([{ advanced: [{ focusMode: 'continuous' }] }]);
    cleanup();
    applied.length = 0;
    camera.track.getCapabilities = () => ({ focusMode: ['manual'] });
    await open('sensor');
    expect(applied).toEqual([]);
    cleanup();
    camera.track.getCapabilities = () => ({ focusMode: ['continuous'] });
    camera.track.applyConstraints = async () => {
      throw new Error('refused');
    };
    await open('sensor');
  });

  it('leaves the focus alone on the default camera', async () => {
    const applied: unknown[] = [];
    camera.track.getCapabilities = () => ({ focusMode: ['continuous'] });
    camera.track.applyConstraints = async (c) => void applied.push(c);
    await open();
    expect(applied).toEqual([]);
  });

  it('gives no sensor picture on the default camera, whatever the browser has', async () => {
    (window as unknown as { ImageCapture: unknown }).ImageCapture = class {
      takePhoto = async () => new Blob(['sensor']);
    };
    await open();
    expect(await hook.takePhoto!()).toBeNull();
  });

  it('lets go of the camera when the screen closes', async () => {
    const view = await open('sensor');
    expect(camera.stops()).toBe(0);
    view.unmount();
    expect(camera.stops()).toBe(1);
  });
});
