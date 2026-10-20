// src/feedback/FeedbackSheet.tsx: Tell the maker, one sheet from every screen's '…' and from Settings. Two big entries, 'Can I add this?'
// and 'Something's wrong', a box for their words, an optional screenshot and Send. Send queues the feedback in the outbox and sends it
// when the phone is online; the sheet then says Sent, or that it is saved and will go when they are. Nothing is sent without the tap.
// Under the box sits voice-kit's Composer (Hold to talk, or Type it here): what it sends is the box's words and its own, as the feedback.
import { useEffect, useId, useRef, useState } from 'react';
import { Composer, type ComposerLabels, type ComposerMessage } from 'voice-kit/composer';
import { MAX_FEEDBACK_CHARS, MAX_SCREENSHOT_BYTES, SCREENSHOT_MIMES, type FeedbackKind } from '../services/feedback';
import { LEGEND_COMPOSER_SETTINGS } from '../ui/legendComposer';
import { useSheetBack } from '../ui/sheetBack';
import { isWaiting, queueFeedback, sendWaiting } from './outbox';

export const SENT_LINE = 'Sent, thank you: the factory reads these';
export const SAVED_LINE = 'Saved on this phone. It goes when you are online.';
/** The live 'N of 1200' shows from here on, so a long paste or dictation is never cut without a word. */
const COUNT_FROM = Math.floor(MAX_FEEDBACK_CHARS * 0.8);
const PICTURE_LINE = 'Pick a JPEG, PNG or WebP picture under 8 MB.';

const CHOICES: readonly { kind: Exclude<FeedbackKind, 'other'>; label: string; hint: string }[] = [
  { kind: 'add', label: 'Can I add this?', hint: 'Something you wish the app did' },
  { kind: 'wrong', label: "Something's wrong", hint: 'Something that broke or looks off' },
];

const VOICE_LABELS: Partial<ComposerLabels> = {
  hold: 'Hold to talk',
  typeInstead: 'Type it here',
  placeholder: 'Your words, then Send',
  message: 'Words to send',
  send: 'Send these words',
  speak: 'Say it instead',
};

type Phase = 'editing' | 'sending' | 'sent' | 'saved';

export function FeedbackSheet({ screen, onClose }: { screen: string; onClose: () => void }) {
  useSheetBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [kind, setKind] = useState<Exclude<FeedbackKind, 'other'> | null>(null);
  const [text, setText] = useState('');
  const [picture, setPicture] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('editing');
  const textId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const length = text.trim().length;
  const over = length > MAX_FEEDBACK_CHARS;
  const nearing = length >= COUNT_FROM;
  const ready = length > 0 && !over && phase === 'editing';

  function choose(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    if (!(SCREENSHOT_MIMES as readonly string[]).includes(file.type) || file.size > MAX_SCREENSHOT_BYTES) {
      setNotice(PICTURE_LINE);
      return;
    }
    setNotice(null);
    setPicture(file);
  }

  /** Queues the box's words with `spoken` (the Composer's) after them, and sends. */
  async function send(spoken = ''): Promise<void> {
    const words = [text.trim(), spoken.trim()].filter(Boolean).join('\n');
    if (!words || phase !== 'editing') return;
    if (words.length > MAX_FEEDBACK_CHARS) throw new Error(`${words.length} of ${MAX_FEEDBACK_CHARS}: the message is too long to send. Shorten it; nothing has been cut.`);
    setPhase('sending');
    const record = await queueFeedback(kind ?? 'other', screen, words, picture ?? undefined);
    await sendWaiting();
    const waiting = await isWaiting(record.id);
    if (alive.current) setPhase(waiting ? 'saved' : 'sent');
  }

  const done = phase === 'sent' || phase === 'saved';
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div role="dialog" aria-modal="true" aria-label="Tell the maker" className="relative flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-line bg-surface">
        <div className="flex min-h-14 shrink-0 items-center gap-2 px-4 pt-2">
          <h2 className="min-w-0 flex-1 text-xl font-semibold text-accent">Tell the maker</h2>
          <button type="button" onClick={onClose} className="min-h-12 min-w-12 shrink-0 rounded-lg px-3 text-lg font-medium text-accent">
            {done ? 'Done' : 'Cancel'}
          </button>
        </div>
        {done ? (
          <div className="border-t border-line px-4 py-6">
            <p role="status" className="text-xl font-semibold">
              {phase === 'sent' ? SENT_LINE : SAVED_LINE}
            </p>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain border-t border-line px-4 py-4">
              <div role="radiogroup" aria-label="What is it?" className="grid gap-3">
                {CHOICES.map((choice) => {
                  const on = kind === choice.kind;
                  return (
                    <button
                      key={choice.kind}
                      type="button"
                      role="radio"
                      aria-label={choice.label}
                      aria-checked={on}
                      disabled={phase !== 'editing'}
                      onClick={() => setKind(on ? null : choice.kind)}
                      className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border px-4 py-2 text-left ${on ? 'border-accent bg-accent/15' : 'border-line'}`}
                    >
                      <span className={`text-xl font-semibold ${on ? 'text-accent' : 'text-ink'}`}>{choice.label}</span>
                      <span className="text-base text-muted">{choice.hint}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                <label htmlFor={textId} className="block pb-1 text-base font-medium">
                  Your message
                </label>
                <textarea
                  id={textId}
                  rows={5}
                  aria-invalid={over}
                  value={text}
                  disabled={phase !== 'editing'}
                  onChange={(e) => setText(e.target.value)}
                  className={`block w-full resize-none rounded-xl border bg-canvas px-3 py-2 text-lg text-ink disabled:opacity-60 ${over ? 'border-bad' : 'border-line'}`}
                />
                {nearing ? (
                  <p role={over ? 'alert' : undefined} className={`pt-1 text-base ${over ? 'text-bad' : 'text-muted'}`}>
                    {over ? `${length} of ${MAX_FEEDBACK_CHARS}: too long to send. Shorten it; nothing has been cut.` : `${length} of ${MAX_FEEDBACK_CHARS}`}
                  </p>
                ) : null}
                <Composer
                  settings={LEGEND_COMPOSER_SETTINGS}
                  labels={VOICE_LABELS}
                  appName="Legend"
                  disabled={phase !== 'editing'}
                  onSend={({ text: spoken }: ComposerMessage) => send(spoken).then(() => true)}
                />
              </div>
              <div>
                <input ref={picker} type="file" accept={SCREENSHOT_MIMES.join(',')} aria-label="Attach a screenshot" className="sr-only" tabIndex={-1} onChange={(e) => choose(e.target.files)} />
                {picture ? (
                  <div className="flex min-h-12 items-center gap-3">
                    <p className="min-w-0 flex-1 truncate text-base">Screenshot: {picture.name}</p>
                    <button type="button" onClick={() => setPicture(null)} className="min-h-12 shrink-0 rounded-lg px-3 text-base font-medium text-accent">
                      Remove
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => picker.current?.click()} className="min-h-12 w-full rounded-xl border border-line px-4 text-base font-medium">
                    Attach a screenshot
                  </button>
                )}
                {notice ? (
                  <p role="alert" className="pt-2 text-base text-bad">
                    {notice}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 border-t border-line px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
              <button type="button" disabled={!ready} onClick={() => void send()} className="min-h-14 w-full rounded-2xl bg-accent text-xl font-semibold text-accent-fg disabled:opacity-50">
                {phase === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
