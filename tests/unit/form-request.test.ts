// The tutor's form panel asks the legend-ask grind with `form` in the request (src/tutor/formRequest.ts) and reads form_values and form_ask
// from the answer. The request fits the grind's input schema; an answer fills only the fields the form has.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { FEEDBACK_FORM } from '../../src/feedback/feedbackForm';
import { isLegendAnswer } from '../../src/services/ask';
import { buildFormRequest, readFormAnswer } from '../../src/tutor/formRequest';
import { WISH_FORM } from '../../src/wishlist/wishForm';
import { FORM_START } from 'voice-kit/forms';

const grind = JSON.parse(readFileSync('grinds/legend-ask.json', 'utf8')) as Record<string, string>;
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
const ajv = new Ajv({ strict: true });
const fitsInput = ajv.compile(readJson(grind.inputSchema));
const fitsAnswer = ajv.compile(readJson(grind.answerSchema));

describe('the form request', () => {
  it('carries form with the fields in screen order and fits the grind input schema', () => {
    const request = buildFormRequest(FEEDBACK_FORM, { message: 'Please add notes' }, FORM_START, [], 'tell-the-maker');
    expect(request.form.name).toBe('Tell the maker');
    expect(request.form.fields.map((f) => f.name)).toEqual(['kind', 'message', 'screenshot']);
    expect(request.form.fields.map((f) => f.label)).toEqual(['What is it?', 'Your message', 'Attach a screenshot']);
    expect(request.form.fields.find((f) => f.name === 'message')?.value).toBe('Please add notes');
    expect(request.form.fields.find((f) => f.name === 'kind')?.options).toEqual(['Can I add this?', "Something's wrong"]);
    expect(request.form.command).toBe('tell-the-maker');
    expect(request.question).toBe(FORM_START);
    expect(fitsInput(request), JSON.stringify(fitsInput.errors)).toBe(true);
  });

  it('names the asking price and where, in screen order, and fits the schema', () => {
    const request = buildFormRequest(WISH_FORM, {}, FORM_START, [], 'wish-for');
    expect(request.form.fields.map((f) => [f.name, f.required])).toEqual([
      ['asking', true],
      ['store', false],
    ]);
    expect(fitsInput(request), JSON.stringify(fitsInput.errors)).toBe(true);
  });

  it('sends the last three turns as history, newest last, and none of his collection', () => {
    const turns = [1, 2, 3, 4].map((n) => ({ question: `q${n}`, answer: `a${n}?` }));
    const request = buildFormRequest(WISH_FORM, {}, 'about $4', turns, 'wish-for');
    expect(request.history.map((h) => h.question)).toEqual(['q2', 'q3', 'q4']);
    expect(request.sides).toEqual([]);
    expect(request).not.toHaveProperty('context');
    expect(fitsInput(request), JSON.stringify(fitsInput.errors)).toBe(true);
  });

  it('cuts a long reply to the question limit, so the request still fits', () => {
    const request = buildFormRequest(WISH_FORM, {}, 'x'.repeat(900), [], 'wish-for');
    expect(request.question.length).toBe(400);
    expect(fitsInput(request), JSON.stringify(fitsInput.errors)).toBe(true);
  });
});

describe('the form answer', () => {
  const reply = (more: Record<string, unknown>) => ({ answer: 'Where did you see it?', followUps: [], settingsChanges: [], teachMore: null, ...more });

  it('is an answer the app and the schema both read, with form_values and form_ask', () => {
    const answer = reply({ form_values: [{ field: 'asking', value: '4.50' }], form_ask: 'store' });
    expect(isLegendAnswer(answer)).toBe(true);
    expect(fitsAnswer(answer), JSON.stringify(fitsAnswer.errors)).toBe(true);
    expect(isLegendAnswer(reply({ form_ask: 7 }))).toBe(false);
    expect(isLegendAnswer(reply({ form_values: [{ field: 'asking' }] }))).toBe(false);
    expect(fitsAnswer(reply({ form_values: [{ field: 'asking' }] }))).toBe(false);
  });

  it('still reads the answer to an ordinary question, which has neither', () => {
    expect(isLegendAnswer(reply({}))).toBe(true);
    expect(fitsAnswer(reply({}))).toBe(true);
  });

  it('fills only fields the form has, and no pictures field, and a choice only with one of its options', () => {
    const read = readFormAnswer(
      FEEDBACK_FORM,
      reply({
        answer: 'What do you want to tell the maker? And anything more.',
        form_values: [
          { field: 'message', value: '  Please add notes  ' },
          { field: 'kind', value: 'Can I add this?' },
          { field: 'colour', value: 'red' },
          { field: 'screenshot', value: '1 picture added' },
        ],
        form_ask: 'message',
      }) as never,
    );
    expect(read.fills).toEqual([
      { field: 'message', value: 'Please add notes' },
      { field: 'kind', value: 'Can I add this?' },
    ]);
    expect(read.said).toBe('What do you want to tell the maker?');
    expect(read.ask).toBe('message');
    const wrongKind = readFormAnswer(FEEDBACK_FORM, reply({ form_values: [{ field: 'kind', value: 'Something else' }] }) as never);
    expect(wrongKind.fills).toEqual([]);
  });

  it('asks about a field only when the form has it', () => {
    expect(readFormAnswer(WISH_FORM, reply({ form_ask: 'store' }) as never).ask).toBe('store');
    expect(readFormAnswer(WISH_FORM, reply({ form_ask: 'colour' }) as never).ask).toBeUndefined();
    expect(readFormAnswer(WISH_FORM, reply({}) as never).ask).toBeUndefined();
  });
});
