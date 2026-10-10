// src/tutor/useAsk.ts: one screen's questions to the tutor, from Lampas's useAsks.ts. A question is kept in the asks store as it goes,
// its answer (with the follow-ups, suggestions and teach-more) when it comes; one that fails is let go and comes back to the field. The
// wait stops when the box closes. `onAnswer` is the seam the tutor's voice (a later story) hangs from: it hears each new answer.
import { useCallback, useEffect, useRef, useState } from 'react';
import { addAsk, answerAsk, listAsks, listAsksIn, removeAsk, type Ask } from '../data/repositories';
import { askTutor, type LegendAnswer } from '../services/ask';
import { GristError, type GristFailure } from '../services/grist';
import { askPlace, buildAsk, type AskAbout } from './request';

/** What the last question is doing. */
export type AskState =
  | { phase: 'idle' }
  | { phase: 'sending' | 'waiting'; question: string }
  | { phase: 'failed'; question: string; failure: GristFailure; detail: string };

export type OnAnswer = (answer: LegendAnswer, ask: Ask) => void;

export function useAsk(about: AskAbout, onAnswer?: OnAnswer): { state: AskState; ask: (question: string) => void } {
  const [state, setState] = useState<AskState>({ phase: 'idle' });
  const live = useRef<AbortController>(new AbortController());
  const hear = useRef(onAnswer);
  useEffect(() => {
    hear.current = onAnswer;
  });
  useEffect(() => {
    // React strict mode runs the effect twice: the controller made while the box was away is replaced here.
    if (live.current.signal.aborted) live.current = new AbortController();
    const controller = live.current;
    return () => controller.abort();
  }, []);

  const { itemId, context } = askPlace(about);
  const aboutRef = useRef(about);
  useEffect(() => {
    aboutRef.current = about;
  });

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) return;
      const signal = live.current.signal;
      const set = (next: AskState): void => {
        if (!signal.aborted) setState(next);
      };
      set({ phase: 'sending', question: text });
      void (async () => {
        let kept: Ask | null = null;
        try {
          const before = itemId !== null ? await listAsks(itemId) : await listAsksIn(context);
          const { request, files } = await buildAsk(aboutRef.current, text, before);
          kept = await addAsk({ itemId, context, question: text });
          const answer = await askTutor(request, { files, signal, onSent: () => set({ phase: 'waiting', question: text }) });
          const suggestions = answer.settingsChanges.map((c) => ({ ...c, decision: null }));
          const done = await answerAsk(kept.id, answer.answer, [], { followUps: answer.followUps, suggestions, teachMore: answer.teachMore });
          set({ phase: 'idle' });
          if (!signal.aborted) hear.current?.(answer, done);
        } catch (err) {
          if (kept) await removeAsk(kept.id).catch(() => undefined);
          if (signal.aborted) return;
          const failure = err instanceof GristError ? err.failure : 'unreachable';
          set({ phase: 'failed', question: text, failure, detail: err instanceof Error ? err.message : 'Something went wrong.' });
        }
      })();
    },
    [itemId, context],
  );

  return { state, ask };
}
