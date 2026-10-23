// src/tutor/FormDoor.tsx: 'Let the tutor do it' on a form (the Governor's rule of 2026-10-23: no form without a tutor to fill it with him). One button
// above a form's Send and, once tapped, a panel where the tutor asks ONE question at a time in plain words (the legend-ask grind with `form` in its
// request, src/tutor/formRequest.ts), his answer by voice or keyboard (voice-kit's Composer, as AskBox uses it), and after each answer the matching
// field of the form filled, which he sees. The tutor never sends: at the end the panel shows the confirm command's offer and a Send that runs the
// very command the form's own Send runs. A form adds the door with one element:
//   <FormDoor form={SPEC} values={{ field: 'what it holds now' }} onFill={(field, value) => ...} registry={registry} command="name" />
import { useEffect, useRef, useState } from 'react';
import { argsOf, FORM_START, requiredFilled, type FormSpec } from 'voice-kit/forms';
import { Composer, type ComposerLabels, type ComposerMessage } from 'voice-kit/composer';
import type { Registry } from 'voice-kit/talks';
import { askTutor, FAILURE_TITLES, MAX_QUESTION_CHARS } from '../services/ask';
import { GristError, type GristFailure } from '../services/grist';
import { LEGEND_COMPOSER_SETTINGS } from '../ui/legendComposer';
import { buildFormRequest, readFormAnswer, type FormTurn } from './formRequest';

export const START_LABEL = 'Let the tutor do it';
/** What he says for the buttons that answer without typing. */
export const NO_PICTURE = 'I have no picture.';
export const ADDED_PICTURE = 'I added a picture.';
export const READY_LINE = 'Everything required is filled in. Read the form, change anything you like, then tap Send yourself.';

const ANSWER_LABELS: Partial<ComposerLabels> = {
  hold: 'Hold to answer',
  typeInstead: 'Type your answer',
  placeholder: 'Your answer…',
  message: 'Your answer',
  send: 'Reply',
  speak: 'Answer by speaking',
};

type Phase =
  | { name: 'idle' }
  | { name: 'sending' }
  | { name: 'failed'; failure: GristFailure; detail: string; message: string }
  /** the confirm command refused or threw: nothing was sent */
  | { name: 'not-sent'; why: string };

export interface FormDoorProps {
  form: FormSpec;
  /** what each field holds now, by field name; a pictures field holds a count such as '1 picture added', or '' */
  values: Readonly<Record<string, string>>;
  /** puts the tutor's value in the field (the form does the setting and shows it) */
  onFill: (field: string, value: string) => void;
  /** the registry holding the form's confirm command, and its name: the form's own Send runs the same one */
  registry: Registry;
  command: string;
  /** opens the form's own picker for a pictures field; called in the tap that asks for it, so the phone allows it */
  onPicker?: (field: string) => void;
  /** while the form itself is busy (it is sending) the door waits */
  disabled?: boolean;
}

export function FormDoor({ form, values, onFill, registry, command, onPicker, disabled = false }: FormDoorProps) {
  const [open, setOpen] = useState(false);
  const [say, setSay] = useState('');
  const [ask, setAsk] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [sendingForm, setSendingForm] = useState(false);
  const turns = useRef<FormTurn[]>([]);
  const latest = useRef({ form, values, onFill, command });
  const live = useRef<AbortController>(new AbortController());
  useEffect(() => {
    latest.current = { form, values, onFill, command };
  });
  useEffect(() => {
    // React strict mode runs the effect twice: the controller made while the door was away is replaced here.
    if (live.current.signal.aborted) live.current = new AbortController();
    const controller = live.current;
    return () => controller.abort();
  }, []);

  async function send(message: string): Promise<void> {
    const signal = live.current.signal;
    setPhase({ name: 'sending' });
    try {
      const { form: spec, values: held, command: name } = latest.current;
      const answer = await askTutor(buildFormRequest(spec, held, message, turns.current, name), { signal });
      if (signal.aborted) return;
      const read = readFormAnswer(spec, answer);
      turns.current = [...turns.current, { question: message, answer: read.said }];
      for (const { field, value } of read.fills) latest.current.onFill(field, value);
      setSay(read.said);
      setAsk(read.ask);
      setPhase({ name: 'idle' });
    } catch (err) {
      if (signal.aborted) return;
      const failure = err instanceof GristError ? err.failure : 'unreachable';
      setPhase({ name: 'failed', failure, detail: err instanceof Error ? err.message : 'Something went wrong.', message });
    }
  }

  // A picture he adds while the tutor is asking for one is told to the tutor at once.
  const pictureField = ask ? form.fields.find((f) => f.name === ask && f.kind === 'pictures') : undefined;
  const pictureHeld = pictureField ? (values[pictureField.name] ?? '') : '';
  const heldBefore = useRef(pictureHeld);
  useEffect(() => {
    if (open && pictureField && phase.name === 'idle' && heldBefore.current === '' && pictureHeld !== '') void send(ADDED_PICTURE);
    heldBefore.current = pictureHeld;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pictureHeld]);

  function start(): void {
    turns.current = [];
    setSay('');
    setAsk(undefined);
    setOpen(true);
    void send(FORM_START);
  }

  function stop(): void {
    live.current.abort();
    live.current = new AbortController();
    setOpen(false);
    setPhase({ name: 'idle' });
  }

  function reply({ text }: ComposerMessage): boolean {
    const words = text.trim();
    if (!words || phase.name === 'sending') return false;
    if (words.length > MAX_QUESTION_CHARS) throw new Error(`${words.length} of ${MAX_QUESTION_CHARS}: the answer is too long to send. Shorten it; nothing has been cut.`);
    void send(words);
    return true;
  }

  async function sendForm(): Promise<void> {
    const signal = live.current.signal;
    setSendingForm(true);
    const ran = await registry.run(command, argsOf(form, values));
    if (signal.aborted) return;
    setSendingForm(false);
    if (!ran.ok) setPhase({ name: 'not-sent', why: ran.why });
  }

  if (!open) {
    return (
      <div className="shrink-0 border-t border-line px-4 py-3">
        <button type="button" disabled={disabled} onClick={start} className="min-h-12 w-full rounded-xl border border-accent px-4 text-lg font-medium text-accent disabled:opacity-50">
          {START_LABEL}
        </button>
      </div>
    );
  }

  const sending = phase.name === 'sending';
  const ready = requiredFilled(form, values) && !ask;
  const args = argsOf(form, values);
  const refused = ready ? registry.refuses(command, args) : undefined;
  const offer = ready && !refused ? registry.command(command)?.offer?.(args) : undefined;
  // a message that failed comes back into the answer box, unsent (the Composer is made again with it in the box)
  const failedMessage = phase.name === 'failed' ? phase.message : '';
  return (
    <section aria-label="The tutor is helping with this form" className="max-h-[45dvh] shrink-0 space-y-3 overflow-y-auto overscroll-contain border-t border-line bg-canvas px-4 py-3">
      {say ? (
        <p aria-live="polite" className="text-lg font-semibold leading-snug">
          {say}
        </p>
      ) : null}
      {sending ? (
        <p role="status" className="text-base text-muted">
          {say ? 'The tutor is thinking…' : 'The tutor is getting ready…'}
        </p>
      ) : null}
      {phase.name === 'failed' ? (
        <div role="alert" className="space-y-1">
          <p className="text-base font-semibold text-bad">{FAILURE_TITLES[phase.failure]}</p>
          <p className="break-words text-sm text-muted">{phase.detail}</p>
          {phase.failure === 'not-sent' ? null : (
            <button type="button" onClick={() => void send(phase.message)} className="min-h-12 rounded-xl border border-line px-4 text-base font-medium">
              Try again
            </button>
          )}
        </div>
      ) : null}
      {phase.name === 'not-sent' ? (
        <div role="alert" className="space-y-1">
          <p className="text-base font-semibold text-bad">Not sent</p>
          <p className="break-words text-sm text-muted">{phase.why}</p>
        </div>
      ) : null}
      {pictureField && !sending ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => onPicker?.(pictureField.name)} className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-base font-medium text-accent-fg">
            Choose a picture
          </button>
          <button type="button" onClick={() => void send(NO_PICTURE)} className="min-h-12 flex-1 rounded-xl border border-line px-4 text-base font-medium">
            No picture
          </button>
        </div>
      ) : null}
      {ready && !sending ? (
        <div className="space-y-2">
          <p role="status" className="text-base font-medium text-good">
            {READY_LINE}
          </p>
          {offer ? <p className="text-base text-ink">{offer}</p> : null}
          {refused ? <p className="text-base text-bad">{refused}</p> : null}
          <button
            type="button"
            aria-label={`Send ${form.name}`}
            disabled={disabled || sendingForm || !!refused}
            onClick={() => void sendForm()}
            className="min-h-14 w-full rounded-2xl bg-accent text-xl font-semibold text-accent-fg disabled:opacity-50"
          >
            {sendingForm ? 'Sending…' : 'Send'}
          </button>
        </div>
      ) : (
        <Composer key={failedMessage} settings={LEGEND_COMPOSER_SETTINGS} labels={ANSWER_LABELS} appName="Legend" initialText={failedMessage} disabled={sending} onSend={reply} />
      )}
      <button type="button" onClick={stop} className="min-h-12 w-full rounded-xl px-4 text-base font-medium text-accent">
        Stop helping
      </button>
    </section>
  );
}
