// src/learn/PathPage.tsx: #/learn/path, Your path. Where he is: a level for each skill with its plain next step, and what he has added
// month by month since the first item. All of it is worked out from his items and questions (src/learn/path.ts): no badges, no streaks.
import { useMemo } from 'react';
import { loadQuarters } from '../data/us';
import { useAskCount, useItems } from '../data/repositories';
import { Page } from './Page';
import { monthsSince, skillsOf } from './path';
import { useLoaded } from './useLoaded';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SHOWN_MONTHS = 12;

export function PathPage() {
  const designs = useLoaded(loadQuarters);
  const items = useItems();
  const askCount = useAskCount();
  const skills = useMemo(() => skillsOf({ items: items ?? [], askCount: askCount ?? 0, designs: designs.value ?? [] }), [items, askCount, designs.value]);
  const since = useMemo(() => monthsSince(items ?? []), [items]);
  const months = since?.months.slice(-SHOWN_MONTHS) ?? [];
  const tallest = Math.max(1, ...months.map((m) => m.count));

  return (
    <Page
      title="Your path"
      intro="Where you are and what to try next. It comes from the coins you have added and the questions you have asked."
      prefill="What should I do next to learn more about coins?"
    >
      <ul aria-label="Skills" className="flex flex-col gap-3">
        {skills.map((s) => (
          <li key={s.id} data-skill={s.id} data-count={s.count} data-level={s.level} data-levels={s.levels} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold">{s.name}</h2>
              <p className="text-lg font-medium tabular-nums text-accent">
                Level {s.level} of {s.levels}
              </p>
            </div>
            <div aria-hidden="true" className="mt-2 flex gap-1.5">
              {Array.from({ length: s.levels }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < s.level ? 'bg-accent' : 'bg-line'}`} />
              ))}
            </div>
            <p className="mt-2 text-base text-muted">{s.next}</p>
          </li>
        ))}
      </ul>
      <section aria-label="Since you started" className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xl font-semibold">Since you started</h2>
        {since ? (
          <>
            <p className="mt-1 text-base text-muted">
              Your first item was added on {new Date(since.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
            <ul className="mt-3 flex h-32 items-end gap-1.5">
              {months.map((m) => (
                <li key={m.month} data-testid={`month-${m.month}`} data-count={m.count} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-sm tabular-nums">{m.count}</span>
                  <span className="w-full rounded-t bg-accent" style={{ height: `${Math.round((m.count / tallest) * 70)}%`, minHeight: m.count > 0 ? 4 : 1 }} />
                  <span className="text-xs text-muted">{MONTH_NAMES[Number(m.month.slice(5)) - 1]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-base text-muted">Add your first coin and it will start here.</p>
        )}
      </section>
    </Page>
  );
}
