// src/feedback/useSendWaiting.ts: the shell's hook that sends waiting feedback at start and whenever the phone comes online.
import { useEffect } from 'react';
import { sendWaiting } from './outbox';

export function useSendWaiting(): void {
  useEffect(() => {
    const go = () => void sendWaiting();
    go();
    window.addEventListener('online', go);
    return () => window.removeEventListener('online', go);
  }, []);
}
