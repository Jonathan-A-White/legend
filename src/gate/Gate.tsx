// src/gate/Gate.tsx — wraps the app: it opens on Unlock until this phone's key holds a legend licence on chain.
// A 'held' answer opens the app and is remembered for a grace (24 h), so an offline open, or a flaky
// lookup, does not lock them out; none and revoked lock at once. Checks on open, on coming back into view,
// and on Check again; 'indexing' (a mint still being indexed) shows Checking… and retries.
import { useEffect, useState, type ReactNode } from 'react';
import { ISSUER } from '../config';
import { getOrCreateDeviceKey } from '../services/deviceKey';
import { forgetHeld, heldWithinGrace, rememberHeld } from '../services/licenceCache';
import { LicenceConfigError, fetchLicenceStatus, type LicenceStatus } from '../services/licenceCheck';
import { Unlock, type Locked } from './Unlock';

export interface GateProps {
  children: ReactNode;
  /** Defaults to the configured issuer (src/config.ts). */
  issuer?: string;
  /** Asks the chain about a public key; defaults to the real lookup. Tests pass a stub. */
  check?: (publicKeyHex: string) => Promise<LicenceStatus>;
  now?: () => number;
  /** The wait before asking again while a licence is still being indexed. */
  retryMs?: number;
}

type State = { kind: 'open' } | Locked;

export function Gate({ children, issuer = ISSUER, check, now = Date.now, retryMs = 15_000 }: GateProps) {
  const [{ publicKeyHex }] = useState(() => getOrCreateDeviceKey());
  // A held answer still inside the grace opens at once; the check below then confirms or locks it.
  const [state, setState] = useState<State>(() => (heldWithinGrace(publicKeyHex, now()) ? { kind: 'open' } : { kind: 'checking' }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    let seq = 0;
    let timer: number | undefined;

    async function run(): Promise<void> {
      const mine = ++seq;
      window.clearTimeout(timer);
      let status: LicenceStatus;
      try {
        status = await (check ? check(publicKeyHex) : fetchLicenceStatus(publicKeyHex, { issuer }));
      } catch (error) {
        if (!live || mine !== seq) return;
        if (heldWithinGrace(publicKeyHex, now())) setState({ kind: 'open' });
        else setState({ kind: 'error', setup: error instanceof LicenceConfigError ? error.message : undefined });
        return;
      }
      if (!live || mine !== seq) return;
      if (status.state === 'held') {
        rememberHeld(publicKeyHex, now());
        setState({ kind: 'open' });
      } else if (status.state === 'indexing') {
        setState({ kind: 'checking' });
        timer = window.setTimeout(() => void run(), retryMs);
      } else {
        forgetHeld();
        setState({ kind: status.state });
      }
    }

    const onVisible = () => {
      if (document.visibilityState !== 'hidden') void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    void run();
    return () => {
      live = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [publicKeyHex, issuer, check, now, retryMs, attempt]);

  if (state.kind === 'open') return children;
  return (
    <Unlock
      locked={state}
      publicKeyHex={publicKeyHex}
      onCheckAgain={() => {
        setState({ kind: 'checking' });
        setAttempt((n) => n + 1);
      }}
    />
  );
}
