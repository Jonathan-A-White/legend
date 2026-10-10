// src/feedback/FeedbackButton.tsx: the small '…' on a screen's bar, and the wide 'Tell the maker' button of Settings. Each opens the
// one FeedbackSheet for the screen it sits on (`screen` is the name the grist carries).
import { useState } from 'react';
import { FeedbackSheet } from './FeedbackSheet';

/** The screens that carry the button, named as the grist names them. */
export type FeedbackScreen = 'Collection' | 'Globe' | 'Quarters' | 'Learn' | 'Settings';

export function FeedbackButton({ screen, className }: { screen: FeedbackScreen; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Tell the maker"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none font-semibold text-muted active:bg-line ${className ?? ''}`}
      >
        <span aria-hidden="true">…</span>
      </button>
      {open ? <FeedbackSheet screen={screen} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** Settings' row: the same sheet from a plain button with its words on it. */
export function TellTheMakerButton({ screen }: { screen: FeedbackScreen }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="mt-2 min-h-12 w-full rounded-xl bg-accent px-4 text-lg font-semibold text-accent-fg">
        Tell the maker
      </button>
      {open ? <FeedbackSheet screen={screen} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
