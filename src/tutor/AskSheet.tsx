// src/tutor/AskSheet.tsx: the tutor, as a sheet over the screen it was opened from: an item (#/item/<id>?ask) or a country
// (#/country/<cc>?ask). The Ask box on top and the answers under it, newest first, read from the asks store, so they are there again
// when he comes back. Back (the address loses ?ask) or Done closes it, and a question still waiting is let go.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { listAsks, listAsksIn } from '../data/repositories';
import { HintCard, TUTOR_OPENED } from '../tips';
import { AnswerCard } from './AnswerCard';
import { AskBox } from './AskBox';
import { askPlace, type AskAbout } from './request';
import { useAsk, type OnAnswer } from './useAsk';

function titleOf(about: AskAbout): string {
  if (about.kind === 'country') return `About ${about.name}`;
  const { item } = about;
  const name = item.denomination || (item.kind === 'coin' ? 'coin' : 'bill');
  return `About your ${name}${item.year !== null ? `, ${item.year}` : ''}`;
}

export function AskSheet({ about, onClose, onAnswer }: { about: AskAbout; onClose: () => void; onAnswer?: OnAnswer }) {
  const { state, ask } = useAsk(about, onAnswer);
  const { itemId, context } = askPlace(about);
  const kept = useLiveQuery(() => (itemId !== null ? listAsks(itemId) : listAsksIn(context)), [itemId, context]);
  const answered = (kept ?? []).filter((a) => a.answer !== null).reverse();
  const busy = state.phase === 'sending' || state.phase === 'waiting';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask the tutor"
        className="flex max-h-[92%] w-full flex-col rounded-t-3xl border-t border-line bg-canvas"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-accent">Ask the tutor</h2>
            <p className="truncate text-base text-muted">{titleOf(about)}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-12 shrink-0 rounded-xl px-4 text-lg font-medium text-muted">
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pt-1 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <HintCard event={TUTOR_OPENED} />
          <AskBox screen={about.kind} state={state} onAsk={ask} />
          {answered.length > 0 ? (
            <ul aria-label="Answers" className="space-y-3">
              {answered.map((a, i) => (
                <li key={a.id}>
                  <AnswerCard ask={a} newest={i === 0} busy={busy} onAsk={ask} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
