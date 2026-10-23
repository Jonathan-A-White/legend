// src/ui/useAlive.ts: whether the component is still on screen, for an answer that arrives late (a send that finishes after the sheet closed
// must not set its state). The function it returns is the same every render.
import { useCallback, useEffect, useRef } from 'react';

export function useAlive(): () => boolean {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return useCallback(() => alive.current, []);
}
