// src/tutor/AnswerCard.tsx: one kept question and the tutor's answer (Markdown), its teach-more line, the settings it suggested (each a
// card with Apply and Not now) and, on the newest answer, its follow-ups as buttons that ask at once.
import type { Ask } from '../data/repositories';
import { Markdown } from './Markdown';
import { drawable } from './settingWords';
import { SuggestionCard } from './SuggestionCard';

export function AnswerCard({ ask, newest, busy, onAsk }: { ask: Ask; newest: boolean; busy: boolean; onAsk: (question: string) => void }) {
  const followUps = newest ? (ask.followUps ?? []) : [];
  return (
    <article aria-label={ask.question} className="space-y-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="break-words text-base font-medium text-muted">{ask.question}</p>
      <div className="break-words text-lg leading-snug text-ink">
        <Markdown text={ask.answer ?? ''} />
      </div>
      {ask.teachMore ? (
        <p className="text-base text-muted">
          <span className="font-semibold text-accent">Worth learning next: {ask.teachMore.topic}.</span> {ask.teachMore.why}
        </p>
      ) : null}
      {(ask.suggestions ?? []).map((s, i) => (drawable(s) ? <SuggestionCard key={i} askId={ask.id} index={i} suggestion={s} /> : null))}
      {followUps.length > 0 ? (
        <ul aria-label="Ask next" className="flex flex-col gap-2">
          {followUps.map((q) => (
            <li key={q}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAsk(q)}
                className="min-h-12 w-full rounded-full border border-accent/60 px-4 py-2 text-left text-base text-accent active:bg-accent/10 disabled:opacity-50"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
