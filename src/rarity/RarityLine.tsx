// src/rarity/RarityLine.tsx: one US coin's rarity as a line in the WorthLine's shape, 'Scarce · 436,800 struck at Denver in 1932 · a key
// date · why'. Why opens what the number does not say, where the year sits among its series (a sentence and a strip of bars), the key
// date's reason and the other varieties of that mint and year. A coin the tables cannot place says why in plain words. Nothing for
// an Other piece, a piece still at the photo reader, or while the tables load. A piece the tables do not cover is TutorRarity's:
// the tutor's estimate on his tap.
import { useState } from 'react';
import type { Item } from '../data/db';
import { loadKeyDates, loadMintages, loadMints, loadQuarters } from '../data/us';
import { needsLook } from '../learn/years';
import { useLoaded } from '../learn/useLoaded';
import { matchDesign } from '../quarters/match';
import { findRow, keyDateFor, noRowReason, placeInSeries, rarityWord, seriesPool, struckSentence, type NoRowReason } from './rarity';
import { Strip } from './Strip';
import { TutorRarity } from './TutorRarity';

const HONESTY =
  "Legend's word is about how many the Mint made, which is reported. How many are left, and in what condition, is not known: coins are spent, lost and melted.";

const NOT_KNOWN: Record<NoRowReason, string> = {
  tables: "Not in Legend's tables yet",
  year: 'Not known: the year is not known',
  mark: 'Not known: the mint mark is not known',
  design: 'Not known: which design it is',
  variety: 'Not known: which variety it is',
};

export function RarityLine({ item, onEdit }: { item: Item; onEdit?: () => void }) {
  const mintages = useLoaded(loadMintages);
  const mints = useLoaded(loadMints);
  const keyDates = useLoaded(loadKeyDates);
  const quarters = useLoaded(loadQuarters);
  const [open, setOpen] = useState(false);
  if (item.kind === 'other' || item.status === 'pending' || item.reading) return null;
  if (!mintages.value || !mints.value || !keyDates.value || !quarters.value) return null;

  const table = mintages.value;
  const found = findRow(table, item, matchDesign(item, quarters.value));
  const text = 'text-lg text-ink';

  if (!found) {
    const reason = noRowReason(table, item);
    // the tables do not cover it: the tutor may be asked, on his tap
    if (reason === 'tables') {
      return (
        <div data-testid="item-rarity-line" className={text}>
          <TutorRarity item={item} />
        </div>
      );
    }
    return (
      <div data-testid="item-rarity-line" className={text}>
        <p>
          {NOT_KNOWN[reason]}
          {onEdit && (reason === 'year' || reason === 'mark' || reason === 'design' || reason === 'variety') ? (
            <>
              {' · '}
              <button type="button" onClick={onEdit} className="min-h-11 px-1 text-lg font-medium text-accent underline">
                Edit
              </button>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  const { row } = found;
  const key = keyDateFor(keyDates.value, item);
  const isKey = key !== null && !needsLook(key);
  const place = placeInSeries(table, found, mints.value);
  const others = (table.series.find((s) => s.series === found.series)?.rows ?? []).filter(
    (r) => r !== row && r.year === row.year && r.mint === row.mint && r.design === row.design,
  );

  return (
    <div data-testid="item-rarity-line" className={text}>
      <p>
        {rarityWord(row.struck)} · <span className="text-muted">{struckSentence(row, mints.value)}</span>
        {isKey ? (
          <>
            {' · '}
            <span className="font-medium">a key date</span>
          </>
        ) : null}
        {' · '}
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="min-h-11 px-1 text-lg font-medium text-accent underline">
          why
        </button>
      </p>
      {open ? (
        <div data-testid="item-rarity-why" className="mt-1 flex flex-col gap-2 text-base text-muted">
          <p>{HONESTY}</p>
          {place ? (
            <>
              <p>This is {place.text}.</p>
              <Strip rows={seriesPool(table, found)} mine={row} label={`This is ${place.text}.`} />
            </>
          ) : null}
          {key ? (
            <p>
              {needsLook(key) ? `Only some coins of this year are the special kind (${key.name}), so look closely. ` : ''}
              {key.why}
            </p>
          ) : null}
          {others.length > 0 ? <p>The same mint and year also made: {others.map((r) => struckSentence(r, mints.value ?? [])).join('; ')}.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
