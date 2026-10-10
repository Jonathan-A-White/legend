// src/share/ShareButton.tsx: the Share button of the globe and of an item. It draws nothing while Sharing is off in Settings
// (the default is on). A tap makes the picture and offers it to the share sheet; a phone without one gets a 'Save picture' link
// instead. Under it, until he has used it once, one line says what leaves the phone.
import { useEffect, useRef, useState } from 'react';
import { putMeta, useMetaFlag } from '../data/repositories';
import { useSettings } from '../settings/useSettings';
import type { Shared } from './send';

export const SHARE_NOTE = 'Only this picture leaves the phone.';

interface Props {
  /** which button: the line is shown once for each */
  which: 'globe' | 'item';
  /** makes the picture and offers it to the share sheet */
  make(): Promise<Shared>;
  className: string;
}

export function ShareButton({ which, make, className }: Props) {
  const settings = useSettings();
  const seen = useMetaFlag(`share-note-${which}`);
  const [busy, setBusy] = useState(false);
  const [save, setSave] = useState<{ url: string; fileName: string } | null>(null);
  const [failed, setFailed] = useState(false);
  // The picture's address lives while its Save picture link does; the next tap and leaving the screen let it go.
  const url = useRef<string | null>(null);
  const forget = () => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  };
  useEffect(() => forget, []);

  if (settings?.sharing !== true) return null;

  const tap = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setSave(null);
    forget();
    try {
      const shared = await make();
      if (shared.outcome === 'save') {
        url.current = URL.createObjectURL(shared.picture.blob);
        setSave({ url: url.current, fileName: shared.fileName });
      }
      await putMeta(`share-note-${which}`, true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0 flex-1">
      <button type="button" onClick={() => void tap()} aria-busy={busy} className={`${className} w-full`}>
        {busy ? 'Making…' : 'Share'}
      </button>
      {seen === false ? <p className="px-1 pt-1 text-center text-sm text-muted">{SHARE_NOTE}</p> : null}
      {save ? (
        <a href={save.url} download={save.fileName} className="mt-2 flex min-h-12 items-center justify-center rounded-2xl bg-accent px-4 text-lg font-semibold text-accent-fg">
          Save picture
        </a>
      ) : null}
      {failed ? (
        <p role="alert" className="px-1 pt-1 text-center text-base text-bad">
          The picture could not be made. Try again.
        </p>
      ) : null}
    </div>
  );
}
