// src/capture/useCamera.ts: the phone's back camera on a <video>. It opens when the screen does, lets go of the camera when the
// page is hidden (and takes it back when it is shown again) and when the screen closes, so the camera light is never left on.
import { useEffect, useState, type RefObject } from 'react';

export const NO_CAMERA = 'The camera would not open. You can use a photo from your gallery instead.';

export function useCamera(videoRef: RefObject<HTMLVideoElement | null>): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | null = null;
    let opening = false;
    const release = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };
    const open = async () => {
      if (stream || opening) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(NO_CAMERA);
        return;
      }
      opening = true;
      try {
        const opened = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const video = videoRef.current;
        if (!alive || document.visibilityState === 'hidden' || !video) {
          opened.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = opened;
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
  }, [videoRef]);

  return { ready, error };
}
