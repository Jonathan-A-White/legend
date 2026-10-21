// src/learn/GradeWalk.tsx: "Grade one of yours". He picks a coin, answers three plain questions, and gets a band with a reminder that
// it is a guess. The guess is written to the coin only when he taps Keep.
import { useState } from 'react';
import { useAlive } from 'pwa-kit/alive';
import type { Item } from '../data/db';
import type { Grade } from '../data/us';
import { updateItem } from '../data/repositories';
import { bandsOf, walkBand, WALK_QUESTIONS, type Answers } from './grading';
import { titleOf } from './titleOf';

type Partial3 = Partial<Record<keyof Answers, string>>;

export function GradeWalk({ coins, grades }: { coins: readonly Item[]; grades: readonly Grade[] }) {
  const alive = useAlive();
  const [coinId, setCoinId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Partial3>({});
  const [kept, setKept] = useState<string | null>(null);
  const coin = coins.find((c) => c.id === coinId);

  const reset = () => {
    setCoinId(null);
    setAnswers({});
    setKept(null);
  };
  const done = WALK_QUESTIONS.every((q) => answers[q.id]);
  const band = done ? walkBand(answers as unknown as Answers) : null;
  const name = band ? (bandsOf(grades).find((b) => b.band === band)?.name ?? band) : '';

  return (
    <section aria-label="Grade one of yours" className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xl font-semibold">Grade one of yours</h2>
      {!coin ? (
        coins.length === 0 ? (
          <p className="mt-2 text-lg text-muted">Add a coin to your collection first, then come back to grade it.</p>
        ) : (
          <>
            <p className="mt-1 text-lg text-muted">Pick a coin, then look at it in good light.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {coins.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-label={`Grade ${titleOf(c)}`}
                    onClick={() => setCoinId(c.id)}
                    className="flex min-h-14 w-full items-center justify-between rounded-xl border border-line px-4 text-left text-lg"
                  >
                    <span>{titleOf(c)}</span>
                    {c.gradeGuess ? <span className="text-base text-muted">{c.gradeGuess}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          <p className="text-lg font-medium">{titleOf(coin)}</p>
          {WALK_QUESTIONS.map((q) => (
            <div key={q.id} role="radiogroup" aria-label={q.text} className="flex flex-col gap-2">
              <p className="text-lg">{q.text}</p>
              <div className="flex gap-2">
                {q.options.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={answers[q.id] === value}
                    onClick={() => {
                      setKept(null);
                      setAnswers({ ...answers, [q.id]: value });
                    }}
                    className={`min-h-11 flex-1 rounded-full border px-4 text-base font-medium ${answers[q.id] === value ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-canvas text-ink'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {band ? (
            <div data-testid="walk-result" className="rounded-xl border border-accent/40 bg-accent/10 p-3">
              <p className="text-xl font-semibold text-accent">
                {band} <span className="text-lg font-medium text-ink">{name}</span>
              </p>
              <p className="mt-1 text-base text-muted">That's a guess; the tutor or a dealer can say more</p>
              {coin.gradeGuess && coin.gradeGuess !== band ? <p className="mt-1 text-base text-muted">Now it says {coin.gradeGuess}. Keep replaces it.</p> : null}
            </div>
          ) : null}
          {kept ? (
            <p role="status" className="text-lg font-medium text-accent">
              Kept: {titleOf(coin)} is now {kept}.
            </p>
          ) : null}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!band || kept === band}
              onClick={() => {
                if (!band) return;
                void updateItem(coin.id, { gradeGuess: band }).then(() => {
                  if (alive()) setKept(band);
                });
              }}
              className="min-h-14 flex-1 rounded-2xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-40"
            >
              Keep
            </button>
            <button type="button" onClick={reset} className="min-h-14 flex-1 rounded-2xl border border-line text-lg font-medium">
              Start again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
