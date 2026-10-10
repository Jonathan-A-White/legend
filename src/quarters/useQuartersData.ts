// src/quarters/useQuartersData.ts: the two files the Quarters screen draws from (the designs, the states map), loaded once when
// the screen opens; both are precached, so this works offline. A failure is shown with a retry, not retried silently.
import { useCallback, useEffect, useState } from 'react';
import { loadQuarters, loadStates, type QuarterDesign } from '../data/us';
import { statesMap, type StatesMap } from './topo';

export type QuartersData = { status: 'loading' } | { status: 'failed'; retry: () => void } | { status: 'ready'; designs: QuarterDesign[]; map: StatesMap };

export function useQuartersData(): QuartersData {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ designs: QuarterDesign[]; map: StatesMap } | 'failed' | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([loadQuarters(), loadStates()]).then(
      ([designs, topology]) => current && setState({ designs, map: statesMap(topology) }),
      () => current && setState('failed'),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState(null);
    setAttempt((n) => n + 1);
  }, []);

  if (state === null) return { status: 'loading' };
  if (state === 'failed') return { status: 'failed', retry };
  return { status: 'ready', ...state };
}
