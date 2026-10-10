// src/gate/Unlock.tsx: the screen the licence gate shows until the phone's key holds a licence: the answer so far,
// what a licence is in plain words, the phone's key as hex with a Copy (to issue the licence from Postern's Key screen),
// and Check again.
import { useState } from 'react';
import { UpdateBanner } from '../UpdateBanner';
import { BuildVersion } from '../ui/BuildVersion';

export type Locked =
  | { kind: 'checking' }
  | { kind: 'none' }
  | { kind: 'revoked' }
  /** `setup` is set when the app itself cannot check (no issuer): words to show instead of the connection ones. */
  | { kind: 'error'; setup?: string };

interface Props {
  locked: Locked;
  publicKeyHex: string;
  onCheckAgain: () => void;
}

const WORDS: Record<Locked['kind'], { title: string; hint: string }> = {
  checking: { title: 'Checking…', hint: 'Looking for this phone’s licence on the chain.' },
  none: { title: 'No licence yet', hint: 'Send this phone’s key to Dad, then tap Check again once he has issued the licence.' },
  revoked: { title: 'Licence revoked', hint: 'The licence for this key was taken back. Ask Dad to issue a new one, then tap Check again.' },
  error: { title: 'Can’t reach the chain', hint: 'Check the connection, then tap Check again.' },
};

export function Unlock({ locked, publicKeyHex, onCheckAgain }: Props) {
  const [copied, setCopied] = useState(false);
  const words = locked.kind === 'error' && locked.setup ? { title: locked.setup, hint: '' } : WORDS[locked.kind];

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(publicKeyHex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (an insecure page): the key text below is select-all, so they can still copy it by hand.
    }
  }

  return (
    // data-shell: the scroll guard (src/ui/scrollGuard.ts) keeps this box at scrollTop 0, as it does the shell
    <div data-gate data-shell className="flex h-full min-w-0 flex-col overflow-clip bg-canvas text-ink">
      <UpdateBanner />
      <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center">
        <img src="/icon.svg" alt="" aria-hidden="true" width={72} height={72} className="mt-auto rounded-2xl border border-line" />
        <h1 className="text-3xl font-semibold tracking-wide text-accent">Unlock</h1>
        <div role="status" className="flex flex-col gap-1">
          <p className="text-xl font-medium">{words.title}</p>
          {words.hint ? <p className="text-base text-muted">{words.hint}</p> : null}
        </div>
        <section aria-label="What a licence is" className="max-w-sm text-base text-muted">
          <p>
            A licence is a pass that lets this phone open Legend. It is kept on a public ledger called the chain, and only
            Dad can give one out, from his Postern app. Each phone has its own key, shown below: send it to him and he does the rest.
          </p>
        </section>
        <section aria-label="This phone’s key" className="flex w-full max-w-sm flex-col gap-2">
          <p className="text-sm text-muted">This phone’s key</p>
          <p data-testid="device-key" className="select-all break-all rounded-xl border border-line bg-surface p-3 font-mono text-base">
            {publicKeyHex}
          </p>
          <button
            type="button"
            onClick={() => void copy()}
            className="min-h-12 rounded-xl bg-accent px-6 text-lg font-medium text-accent-fg"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </section>
        <button
          type="button"
          onClick={onCheckAgain}
          disabled={locked.kind === 'checking'}
          className="min-h-12 rounded-xl border border-line px-6 text-lg font-medium disabled:opacity-60"
        >
          Check again
        </button>
        <BuildVersion className="mb-auto" />
      </main>
    </div>
  );
}
