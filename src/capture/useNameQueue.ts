// src/capture/useNameQueue.ts: runs the queue of grists (src/services/nameQueue.ts) while the shell is mounted, which is only
// once the licence gate is open. It tells the queue when the phone goes offline or the page is hidden, so a wait for an answer
// happens only while he is online and looking (PWA best practices, section 11).
import { useEffect } from 'react';
import { nameQueue } from '../services/nameQueue';

export function useNameQueue(): void {
  useEffect(() => {
    const online = () => nameQueue.setOnline(navigator.onLine);
    const visible = () => nameQueue.setVisible(document.visibilityState !== 'hidden');
    online();
    visible();
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    document.addEventListener('visibilitychange', visible);
    nameQueue.start();
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      document.removeEventListener('visibilitychange', visible);
      nameQueue.stop();
    };
  }, []);
}
