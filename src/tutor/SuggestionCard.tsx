// src/tutor/SuggestionCard.tsx: a setting the tutor suggested, as a card: 'The tutor suggests: Text size large. Why: …' with Apply and
// Not now. Nothing changes until Apply, which goes through the registry's applyChanges (so the bus hears settings.changed) and offers
// Undo for ten seconds. A suggestion of a setting the tutor may not change, or of a value it does not allow, is never drawn.
import { useEffect, useState } from 'react';
import type { SuggestedSetting } from '../data/db';
import { decideSuggestion } from '../data/repositories';
import { applyChanges, settingOf, undoChange, type AppliedChange } from '../settings/registry';
import { settingWords, valueWords } from './settingWords';

/** How long Undo is offered after Apply. */
export const UNDO_SETTING_MS = 10_000;

const button = 'min-h-12 flex-1 rounded-xl px-4 text-lg font-semibold';

export function SuggestionCard({ askId, index, suggestion }: { askId: string; index: number; suggestion: SuggestedSetting }) {
  const [applied, setApplied] = useState<AppliedChange | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  useEffect(() => {
    if (!applied) return;
    const timer = setTimeout(() => setApplied(null), UNDO_SETTING_MS);
    return () => clearTimeout(timer);
  }, [applied]);

  const words = settingWords(suggestion.key, suggestion.value);
  const label = settingOf(suggestion.key)?.label ?? suggestion.key;

  if (suggestion.decision === 'declined') return null;
  if (suggestion.decision === 'applied') {
    return (
      <div role="group" aria-label="The tutor suggests" className="flex items-center gap-3 rounded-2xl border border-line px-4 py-2">
        <p role="status" className="min-w-0 flex-1 text-base text-ink">
          {label} is now {valueWords(suggestion.key, suggestion.value)}.
        </p>
        {applied ? (
          <button
            type="button"
            onClick={async () => {
              const change = applied;
              setApplied(null);
              await undoChange(change);
              await decideSuggestion(askId, index, null);
            }}
            className="min-h-12 shrink-0 rounded-xl border border-accent px-5 text-lg font-semibold text-accent"
          >
            Undo
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div role="group" aria-label="The tutor suggests" className="space-y-3 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3">
      <p className="text-lg text-ink">
        <span className="font-semibold">The tutor suggests:</span> {words}. <span className="text-muted">Why: {suggestion.why}</span>
      </p>
      {refused ? <p role="alert" className="text-base text-bad">{refused}</p> : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={async () => {
            const result = await applyChanges([{ key: suggestion.key, value: suggestion.value }]);
            const [change] = result.applied;
            if (!change) {
              setRefused(result.refused[0] ?? 'That change could not be made.');
              return;
            }
            setApplied(change);
            await decideSuggestion(askId, index, 'applied', { key: change.key, from: change.from, to: change.to });
          }}
          className={`${button} bg-accent text-accent-fg`}
        >
          Apply
        </button>
        <button type="button" onClick={() => void decideSuggestion(askId, index, 'declined')} className={`${button} border border-line text-muted`}>
          Not now
        </button>
      </div>
    </div>
  );
}
