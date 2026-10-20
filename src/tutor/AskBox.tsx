// src/tutor/AskBox.tsx: voice-kit's Composer (Hold to ask, or Type a question and Ask), the three questions suggested for the screen (a tap
// asks at once), and what the last question is doing: 'Sending…', 'Waiting for the tutor…', or a failure in plain words with the question
// back in the field and Try again.
import { Composer, type ComposerLabels, type ComposerMessage } from 'voice-kit/composer';
import { FAILURE_TITLES, MAX_QUESTION_CHARS } from '../services/ask';
import { LEGEND_COMPOSER_SETTINGS } from '../ui/legendComposer';
import type { AskState } from './useAsk';

const ASK_LABELS: Partial<ComposerLabels> = {
  hold: 'Hold to ask',
  typeInstead: 'Type a question',
  placeholder: 'Ask about this…',
  message: 'Your question',
  send: 'Ask',
  speak: 'Ask by speaking',
};

const chip = 'min-h-12 rounded-full border border-line bg-surface px-4 py-2 text-left text-base text-ink active:bg-line disabled:opacity-50';

export function AskBox({ questions, state, onAsk }: { questions: readonly string[]; state: AskState; onAsk: (question: string) => void }) {
  const busy = state.phase === 'sending' || state.phase === 'waiting';
  // a question that failed comes back into the field, unsent, to be sent again (the Composer is made again with it in the box)
  const failed = state.phase === 'failed' ? state.question : '';
  const send = (question: string): boolean => {
    if (!question.trim() || busy) return false;
    onAsk(question);
    return true;
  };
  const sendWords = ({ text }: ComposerMessage): boolean => {
    if (text.length > MAX_QUESTION_CHARS) throw new Error(`${text.length} of ${MAX_QUESTION_CHARS}: the question is too long to send. Shorten it; nothing has been cut.`);
    return send(text);
  };

  return (
    <section aria-label="Your question" className="space-y-3">
      <Composer
        key={failed}
        settings={LEGEND_COMPOSER_SETTINGS}
        labels={ASK_LABELS}
        appName="Legend"
        initialText={failed}
        disabled={busy}
        onSend={sendWords}
      />

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
            <button type="button" onClick={() => send(state.question)} className="min-h-12 rounded-xl border border-line px-5 text-lg font-medium text-ink">
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
