// src/tutor/AskBox.tsx: the field and Ask, the three questions suggested for the screen (a tap asks at once), and what the last question
// is doing: 'Sending…', 'Waiting for the tutor…', or a failure in plain words with the question back in the field and Try again.
import { useState } from 'react';
import { FAILURE_TITLES, MAX_QUESTION_CHARS } from '../services/ask';
import type { AskState } from './useAsk';

const chip = 'min-h-12 rounded-full border border-line bg-surface px-4 py-2 text-left text-base text-ink active:bg-line disabled:opacity-50';

export function AskBox({ questions, state, onAsk }: { questions: readonly string[]; state: AskState; onAsk: (question: string) => void }) {
  // null: nothing typed since the last send, so a question that failed shows in the field (to send again) and otherwise it is empty
  const [typed, setTyped] = useState<string | null>(null);
  const busy = state.phase === 'sending' || state.phase === 'waiting';
  const text = typed ?? (state.phase === 'failed' ? state.question : '');
  const send = (question: string): void => {
    if (!question.trim() || busy) return;
    onAsk(question);
    setTyped(null);
  };

  return (
    <section aria-label="Your question" className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="space-y-3"
      >
        <textarea
          aria-label="Your question"
          rows={2}
          maxLength={MAX_QUESTION_CHARS}
          value={text}
          disabled={busy}
          placeholder="Ask about this…"
          onChange={(e) => setTyped(e.target.value)}
          className="block w-full resize-none rounded-2xl border border-line bg-canvas px-4 py-3 text-lg text-ink"
        />
        <button type="submit" disabled={busy || !text.trim()} className="min-h-14 w-full rounded-2xl bg-accent text-xl font-semibold text-accent-fg disabled:opacity-40">
          Ask
        </button>
      </form>

      {busy ? (
        <div className="space-y-1">
          <p className="break-words text-base text-muted">{state.question}</p>
          <p role="status" className="text-lg text-ink">
            {state.phase === 'sending' ? 'Sending…' : 'Waiting for the tutor…'}
          </p>
        </div>
      ) : null}

      {state.phase === 'failed' ? (
        <div role="alert" className="space-y-2 rounded-2xl border border-bad/60 px-4 py-3">
          <p className="text-lg font-semibold text-bad">{FAILURE_TITLES[state.failure]}</p>
          <p className="break-words text-base text-ink">{state.detail}</p>
          {state.failure === 'not-sent' ? null : (
            <button type="button" onClick={() => send(text)} disabled={!text.trim()} className="min-h-12 rounded-xl border border-line px-5 text-lg font-medium text-ink">
              Try again
            </button>
          )}
        </div>
      ) : null}

      <ul aria-label="Suggested questions" className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <li key={q}>
            <button type="button" disabled={busy} onClick={() => send(q)} className={chip}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
