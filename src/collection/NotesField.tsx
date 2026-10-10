// src/collection/NotesField.tsx: an item's notes. There is no Save button to forget: what he types is kept a moment after he stops,
// when he leaves the box, and when he leaves the screen; 'Saved' says so (PWA best practices, section 16).
import { useEffect, useRef, useState } from 'react';
import { updateItem } from '../data/repositories';

export const NOTES_SAVE_MS = 600;

export function NotesField({ itemId, initial }: { itemId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = () => {
    clearTimeout(timer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    void updateItem(itemId, { notes: value }).then(() => setState('saved'));
  };
  // leaving the screen keeps what was typed
  const flushOnLeave = useRef(flush);
  useEffect(() => {
    flushOnLeave.current = flush;
  });
  useEffect(() => () => flushOnLeave.current(), []);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor="item-notes" className="text-lg font-semibold text-ink">
          Notes
        </label>
        <span aria-live="polite" className="text-base text-muted">
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}
        </span>
      </div>
      <textarea
        id="item-notes"
        value={text}
        rows={4}
        placeholder="Where it came from, who gave it to you, what you noticed…"
        onChange={(e) => {
          setText(e.target.value);
          pending.current = e.target.value;
          setState('saving');
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, NOTES_SAVE_MS);
        }}
        onBlur={flush}
        className="mt-1 w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-lg text-ink placeholder:text-muted"
      />
    </div>
  );
}
