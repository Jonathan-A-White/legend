// src/feedback/feedbackForm.ts: Tell the maker as the tutor's door sees it (src/tutor/FormDoor.tsx): the form (What is it?, Your message, a
// screenshot) and tell-the-maker, the confirm command that the sheet's Send and the tutor's Send both run, so one path queues the feedback.
import { formCommand, type FormSpec } from 'voice-kit/forms';
import type { Command } from 'voice-kit/talks';
import { MAX_FEEDBACK_CHARS, type FeedbackKind } from '../services/feedback';
import { isWaiting, queueFeedback, sendWaiting } from './outbox';

export const SENT_LINE = 'Sent, thank you: the factory reads these';
export const SAVED_LINE = 'Saved on this phone. It goes when you are online.';

export const FEEDBACK_COMMAND = 'tell-the-maker';

/** The two entries of What is it?: the label the sheet draws and the tutor answers with, the kind it files, the line under it. */
export const FEEDBACK_CHOICES: readonly { kind: Exclude<FeedbackKind, 'other'>; label: string; hint: string }[] = [
  { kind: 'add', label: 'Can I add this?', hint: 'Something you wish the app did' },
  { kind: 'wrong', label: "Something's wrong", hint: 'Something that broke or looks off' },
];

export const FEEDBACK_FORM: FormSpec = {
  name: 'Tell the maker',
  fields: [
    { name: 'kind', label: 'What is it?', required: false, kind: 'choice', options: FEEDBACK_CHOICES.map((c) => c.label) },
    { name: 'message', label: 'Your message', required: true, kind: 'text', maxLength: MAX_FEEDBACK_CHARS },
    { name: 'screenshot', label: 'Attach a screenshot', required: false, kind: 'pictures' },
  ],
};

/** The kind a label files; a note with no kind (or one this build does not offer) is other. */
export const kindOfLabel = (label: string | undefined): FeedbackKind => FEEDBACK_CHOICES.find((c) => c.label === label)?.kind ?? 'other';
export const labelOfKind = (kind: FeedbackKind | null): string => FEEDBACK_CHOICES.find((c) => c.kind === kind)?.label ?? '';

/** Queues the feedback in the outbox and sends what waits; 'sent' when the mill has it, 'saved' when it waits for the phone to be online. */
export async function sendFeedback(kind: FeedbackKind, screen: string, words: string, picture?: Blob): Promise<'sent' | 'saved'> {
  const record = await queueFeedback(kind, screen, words, picture);
  await sendWaiting();
  return (await isWaiting(record.id)) ? 'saved' : 'sent';
}

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

export interface FeedbackDeps {
  /** the screen he opened the sheet from */
  screen: string;
  /** the screenshot the sheet holds now, if any */
  picture(): Blob | undefined;
  onSending(): void;
  onOutcome(outcome: 'sent' | 'saved'): void;
  /** the send threw: the sheet lets him edit again */
  onFailed?(): void;
}

export function tellTheMaker(deps: FeedbackDeps): Command {
  return formCommand(FEEDBACK_FORM, {
    name: FEEDBACK_COMMAND,
    tell: 'Sends the Tell the maker form: his message to the maker of the app, with what kind of message it is',
    offer: ({ kind, message }) => `Send to the maker${kind ? ` (${kind})` : ''}: ${clip(message ?? '', 120)}?`,
    async send(values) {
      deps.onSending();
      try {
        const outcome = await sendFeedback(kindOfLabel(values.kind), deps.screen, values.message ?? '', deps.picture());
        deps.onOutcome(outcome);
        return { said: outcome === 'sent' ? SENT_LINE : SAVED_LINE };
      } catch (error) {
        deps.onFailed?.();
        throw error;
      }
    },
  });
}
