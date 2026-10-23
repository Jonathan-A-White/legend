// src/tutor/formRequest.ts: what the tutor's form panel (FormDoor.tsx) sends the legend-ask grind and reads back. The request is the grind's
// input with `form` (voice-kit/forms' requestFields: the fields in screen order with what each holds) and no `context`: the grind is then
// told it is helping with a form (grinds/legend-ask.md, 'Helping him fill in a form'). The answer's form_values fill only fields the form has.
import { applyValues, FORM_NAME_MAX, oneQuestion, requestFields, type FormSpec, type FormValue } from 'voice-kit/forms';
import { MAX_HISTORY, MAX_QUESTION_CHARS, type LegendAnswer, type LegendFormRequest } from '../services/ask';

/** One turn of the talk so far: what he said and the question the tutor asked back. */
export interface FormTurn {
  question: string;
  answer: string;
}

const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The request for what he just said while the tutor helps with `form`, which holds `values` now (by field name). `command` names the confirm
 * command that sends the form, so the tutor can tell him a Send button waits once the required fields are filled. */
export function buildFormRequest(form: FormSpec, values: Readonly<Record<string, string>>, message: string, turns: readonly FormTurn[], command?: string): LegendFormRequest {
  return {
    question: clip(message.trim(), MAX_QUESTION_CHARS),
    sides: [],
    settings: {},
    history: turns.slice(-MAX_HISTORY).map((t) => ({ question: clip(t.question, MAX_QUESTION_CHARS), answer: clip(t.answer, 2400) })),
    form: { name: clip(form.name, FORM_NAME_MAX), fields: requestFields(form, values), ...(command ? { command } : {}) },
  };
}

/** What an answer says to the panel: the tutor's one question, the values the form may take, and the field the question is about (if the form has it). */
export interface FormReading {
  said: string;
  fills: FormValue[];
  ask: string | undefined;
}

export function readFormAnswer(form: FormSpec, answer: LegendAnswer): FormReading {
  const ask = form.fields.some((f) => f.name === answer.form_ask) ? answer.form_ask : undefined;
  return { said: oneQuestion(answer.answer), fills: applyValues(form, answer.form_values), ask };
}
