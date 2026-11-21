// src/capture/useCamera.ts: the phone's back camera on a <video>. It opens when the screen does, lets go of the camera when the
// page is hidden (and takes it back when it is shown again) and when the screen closes, so the camera light is never left on.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export const NO_CAMERA = 'The camera would not open. You can use a photo from your gallery instead.';

/** What the camera is asked for. The default is whatever the phone picks, as Add always asked; 'sensor' asks for the camera's full size
 * (a group photo of twelve coins needs it) and, where the browser has ImageCapture, `takePhoto` gives the sensor's own picture. */
export type CameraResolution = 'default' | 'sensor';

/** The size asked of the camera for a group photo: the phone gives what it can. */
export const SENSOR_SIZE = { width: 4096, height: 3072 } as const;

export const constraintsFor = (resolution: CameraResolution): MediaStreamConstraints => ({
  video:
    resolution === 'sensor'
      ? { facingMode: 'environment', width: { ideal: SENSOR_SIZE.width }, height: { ideal: SENSOR_SIZE.height } }
      : { facingMode: 'environment' },
  audio: false,
});

/** A group photo of small coins must be sharp: where the phone offers continuous focus, ask for it. Any refusal is ignored. */
async function keepFocus(live: MediaStreamTrack | null): Promise<void> {
  try {
    const modes = (live?.getCapabilities?.() as { focusMode?: string[] } | undefined)?.focusMode;
    if (!modes?.includes('continuous')) return;
    await live?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
  } catch {
    // the phone keeps the focus it has
  }
}

interface ImageCaptureLike {
  takePhoto(settings?: { imageWidth: number; imageHeight: number }): Promise<Blob>;
  getPhotoCapabilities?(): Promise<{ imageWidth?: { max: number }; imageHeight?: { max: number } }>;
}
type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike;

export function useCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  resolution: CameraResolution = 'default',
): { ready: boolean; error: string | null; takePhoto: () => Promise<Blob | null> } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const track = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | null = null;
    let opening = false;
    const release = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      track.current = null;
    };
    const open = async () => {
      if (stream || opening) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(NO_CAMERA);
        return;
      }
      opening = true;
      try {
        const opened = await navigator.mediaDevices.getUserMedia(constraintsFor(resolution));
        const video = videoRef.current;
        if (!alive || document.visibilityState === 'hidden' || !video) {
          opened.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = opened;
        track.current = opened.getVideoTracks?.()[0] ?? null;
        if (resolution === 'sensor') void keepFocus(track.current);
        video.srcObject = opened;
        await video.play();
        setError(null);
        setReady(true);
      } catch {
        if (alive) setError(NO_CAMERA);
      } finally {
        opening = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        release();
        setReady(false);
      } else void open();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void open();
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [videoRef, resolution]);

  /** The sensor's own picture, or null where the browser has no ImageCapture (or it fails): the caller then copies a frame of the video. */
  const takePhoto = useCallback(async (): Promise<Blob | null> => {
    const ImageCapture = (window as unknown as { ImageCapture?: ImageCaptureConstructor }).ImageCapture;
    const live = track.current;
    if (resolution !== 'sensor' || !ImageCapture || !live) return null;
    try {
      const capture = new ImageCapture(live);
      // the sensor's biggest picture where the phone says what that is: the phone's own default is often smaller
      const caps = await capture.getPhotoCapabilities?.().catch(() => undefined);
      const imageWidth = caps?.imageWidth?.max;
      const imageHeight = caps?.imageHeight?.max;
      if (imageWidth && imageHeight) {
        try {
          return await capture.takePhoto({ imageWidth, imageHeight });
        } catch {
          // a size the phone would not take: whatever it gives by default
        }
      }
      return await capture.takePhoto();
    } catch {
      return null;
    }
  }, [resolution]);

  return { ready, error, takePhoto };
}
