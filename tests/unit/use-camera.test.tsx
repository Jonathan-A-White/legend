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
