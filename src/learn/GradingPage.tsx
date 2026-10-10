// src/learn/GradingPage.tsx: #/learn/grading. The Sheldon ladder from MS-70 at the top to PO-1 at the foot, a plain description for each
// step, and his coins at the step (or the band) his gradeGuess names. Above it, the walk that grades one of them.
import { useMemo } from 'react';
import { loadGrades } from '../data/us';
import { useItems, useThumbs } from '../data/repositories';
import { GradeWalk } from './GradeWalk';
import { bandsOf, placeGuess } from './grading';
import { CoinLinks, Failed, Page } from './Page';
import { useLoaded } from './useLoaded';

export function GradingPage() {
  const grades = useLoaded(loadGrades);
  const items = useItems();
  const thumbs = useThumbs();
  const coins = useMemo(() => (items ?? []).filter((i) => i.kind === 'coin'), [items]);
  const bands = useMemo(() => (grades.value ? bandsOf(grades.value) : []), [grades.value]);
  const placed = useMemo(
    () => (grades.value ? coins.map((c) => ({ coin: c, at: placeGuess(grades.value!, c.gradeGuess) })) : []),
    [coins, grades.value],
  );

  return (
    <Page
      title="Grading"
      intro="Grade says how worn a coin is, from Poor to a perfect 70. Your coins sit where you guessed they belong."
      prefill="How do I tell what grade a coin of mine is?"
    >
      {grades.failed ? <Failed what="The grades" retry={grades.retry} /> : null}
      {grades.value ? <GradeWalk coins={coins} grades={grades.value} /> : !grades.failed ? <p className="text-lg text-muted">Loading the grades…</p> : null}
      {grades.value ? (
        <ol aria-label="The Sheldon ladder" className="flex flex-col gap-4">
          {bands.map((b) => (
            <li key={b.band} data-band={b.band} className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="text-xl font-semibold">
                <span className="text-accent">{b.band}</span> · {b.name}
              </h2>
              <CoinLinks items={placed.filter((p) => p.at?.band === b.band && p.at.code === null).map((p) => p.coin)} thumbs={thumbs} />
              <ol className="mt-3 flex flex-col gap-3 border-l-2 border-accent/40 pl-4">
                {b.steps.map((g) => (
                  <li key={g.code} data-step={g.code} className="flex flex-col gap-1">
                    <p className="text-lg font-semibold tabular-nums">
                      {g.code} <span className="text-base font-normal text-muted">{g.name}</span>
                    </p>
                    <p className="text-base text-ink">{g.summary}</p>
                    <details className="text-base text-muted">
                      <summary className="min-h-11 cursor-pointer py-2">What it looks like</summary>
                      <p>
                        <span className="font-medium text-ink">A cent: </span>
                        {g.cent}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-ink">A quarter: </span>
                        {g.quarter}
                      </p>
                    </details>
                    <CoinLinks items={placed.filter((p) => p.at?.code === g.code).map((p) => p.coin)} thumbs={thumbs} />
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      ) : null}
    </Page>
  );
}
