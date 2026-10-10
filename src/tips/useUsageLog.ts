// src/tips/useUsageLog.ts: the shell's hook that keeps the usage log running while the app is open.
import { useEffect } from 'react';
import { startUsageLog } from './usageLog';

export function useUsageLog(): void {
  useEffect(() => {
    const stop = startUsageLog();
    return () => void stop();
  }, []);
}
