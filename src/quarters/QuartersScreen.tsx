// src/quarters/QuartersScreen.tsx: the Quarters screen at #/quarters. A programme picker with "You have N of M", then either the
// map (a state is lit when he has all its quarters, half-lit when some, dark when none) or the Checklist. A tap on a state or a
// territory tile opens its sheet (#/quarters?state=OH). Items are matched to designs in src/quarters/match.ts.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useItems } from '../data/repositories';
import { FeedbackButton } from '../feedback';
import { navigate, useAddress } from '../nav/route';
import { Checklist } from './Checklist';
import { StateSheet } from './StateSheet';
import { UsMap, type Place } from './UsMap';
import { matchItems } from './match';
import { PROGRAMMES, TERRITORIES, countOf, designsOf, inProgramme, litOf, type ProgrammeId } from './summary';
import { useQuartersData } from './useQuartersData';

const QUARTERS = '#/quarters';
const sheetAddress = (code: string) => `${QUARTERS}?state=${code}`;
const sheetOf = (hash: string): string | null => new URLSearchParams(hash.split('?')[1] ?? '').get('state');

function Choice<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: { id: T; label: string }[]; onPick: (id: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          onClick={() => onPick(o.id)}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-base font-medium whitespace-nowrap ${o.id === value ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const VIEWS = [
  { id: 'map', label: 'Map' },
  { id: 'list', label: 'Checklist' },
] as const;

export function Quarters() {
  const data = useQuartersData();
  const items = useItems({ country: 'US' });
  const hash = useAddress();
  const [programme, setProgramme] = useState<ProgrammeId>('all');
  const [view, setView] = useState<'map' | 'list'>('map');
  const openedHere = useRef(false);

  const designs = data.status === 'ready' ? data.designs : null;
  const owned = useMemo(() => (designs ? matchItems(items ?? [], designs) : new Map()), [items, designs]);

  const open = useCallback((code: string) => {
    openedHere.current = true;
    navigate(sheetAddress(code));
  }, []);
  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
    } else navigate(QUARTERS, { replace: true });
  }, []);

  const shown = designs ? inProgramme(designs, programme) : [];
  const count = countOf(shown, owned);
  const placeOf = (code: string): Place => {
    const mine = designsOf(shown, code);
    const c = countOf(mine, owned);
    return { ...c, lit: litOf(c) };
  };

  const code = sheetOf(hash);
  const sheetName = code && data.status === 'ready' ? (data.map.paths.find((p) => p.code === code)?.name ?? TERRITORIES.find((t) => t.code === code)?.name) : undefined;

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-wide text-accent">Quarters</h1>
        <div className="flex items-center gap-1">
          <p data-testid="programme-count" className="text-lg font-medium tabular-nums">
            You have {count.have} of {count.total}
          </p>
          <FeedbackButton screen="Quarters" className="-mr-2" />
        </div>
      </div>
      <Choice label="Programme" value={programme} options={PROGRAMMES} onPick={setProgramme} />
      <Choice label="View" value={view} options={[...VIEWS]} onPick={setView} />
      {data.status === 'loading' ? <p className="text-lg text-muted">Loading the quarters…</p> : null}
      {data.status === 'failed' ? (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-lg">The quarters could not be loaded. Check the connection and try again.</p>
          <button type="button" onClick={data.retry} className="mt-3 min-h-11 rounded-xl bg-accent px-5 text-lg font-medium text-accent-fg">
            Try again
          </button>
        </div>
      ) : null}
      {data.status === 'ready' && view === 'map' ? <UsMap map={data.map} placeOf={placeOf} onOpen={open} /> : null}
      {data.status === 'ready' && view === 'list' ? <Checklist designs={shown} owned={owned} showProgramme={programme === 'all'} /> : null}
      {data.status === 'ready' && code && sheetName ? <StateSheet name={sheetName} designs={designsOf(data.designs, code)} owned={owned} onClose={close} /> : null}
    </main>
  );
}
