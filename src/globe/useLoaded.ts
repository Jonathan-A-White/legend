// src/globe/useLoaded.ts: a world file for a screen: undefined until it loads, `failed` when it could not, `retry` to try again.
import { useEffect, useState } from 'react';

export interface Loaded<T> {
  value?: T;
  failed: boolean;
  retry(): void;
}

export function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ value?: T; failed: boolean }>({ failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    load().then(
      (value) => live && setState({ value, failed: false }),
      () => live && setState({ failed: true }),
    );
    return () => {
      live = false;
    };
  }, [load, attempt]);
  return {
    ...state,
    retry: () => {
      setState({ failed: false });
      setAttempt((a) => a + 1);
    },
  };
}
