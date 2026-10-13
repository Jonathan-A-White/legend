// src/rarity/TutorRarity.tsx: the rarity line for a coin or note the tables do not cover. On his tap ('How rare is it?') the tutor
// estimates it (src/services/rarity.ts); the line then says so, 'Common · about 12,000,000 struck, the tutor's estimate · why', or
// 'Not known for sure · <reason>' when the tutor is not sure. The estimate is kept on the item with the year and mint mark it was
// asked for, so an Edit of either brings the tap back. One grist per tap, never automatic.
import { useEffect, useRef, useState } from 'react';
import type { Item, ItemRarity } from '../data/db';
import { askRarity, hasRarity, wordText } from '../services/rarity';
import { estimateStruck } from './words';

const TAP = 'min-h-11 px-1 text-lg font-medium text-accent underline disabled:text-muted disabled:no-underline';

/** What the why says about the tutor's number, and that it is not a count. */
function honesty(rarity: ItemRarity): string {
  const origin =
    rarity.struckIs === 'reported'
      ? "The tutor says this is the figure the maker of the piece reported, but Legend has not checked it. This is the tutor's estimate, not a count from a table."
      : "This is the tutor's estimate, not a count from a table.";
  return `${origin} How many are left, and in what condition, is not known: pieces are spent, lost and melted.`;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function Estimate({ rarity }: { rarity: ItemRarity }) {
  const [open, setOpen] = useState(false);
  if (rarity.confidence === 'low' || rarity.word === 'unknown') {
    return <p>Not known for sure · {rarity.reason}</p>;
  }
  const struck = estimateStruck(rarity);
  return (
    <>
      <p>
        {wordText(rarity.word)} · <span className="text-muted">{struck}</span>
        {' · '}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 px-1 text-lg font-medium text-accent underline">
          why
        </button>
      </p>
      {open ? (
        <div data-testid="item-rarity-why" className="mt-1 flex flex-col gap-2 text-base text-muted">
          <p>{rarity.reason}</p>
          <p>{honesty(rarity)}</p>
        </div>
      ) : null}
    </>
  );
}

export function TutorRarity({ item }: { item: Item }) {
  const online = useOnline();
  const [state, setState] = useState<'idle' | 'asking' | 'failed'>('idle');
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);

  if (hasRarity(item)) return <Estimate rarity={item.rarity} />;

  const ask = async () => {
    setState('asking');
    try {
      await askRarity(item);
      if (here.current) setState('idle');
    } catch {
      if (here.current) setState('failed');
    }
  };

  if (state === 'asking') return <p role="status">Asking…</p>;
  return (
    <p>
      Not in Legend's tables yet
      {state === 'failed' ? ' · Could not ask just now' : null}
      {' · '}
      <button type="button" disabled={!online} aria-describedby={online ? undefined : 'rarity-offline'} onClick={ask} className={TAP}>
        How rare is it?
      </button>
      {online ? null : (
        <span id="rarity-offline" className="text-muted">
          {' '}
          when online
        </span>
      )}
    </p>
  );
}
