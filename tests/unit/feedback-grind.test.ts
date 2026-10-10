// The feedback grind (grinds/feedback.json) is read by the mill, not by this app: a forwarding grind ("forward": "mayor": no model
// session; the mill mails the grist to the Mayor and answers {"status":"sent"}) that takes at most one screenshot. Its input schema
// agrees with buildFeedbackRequest, the code the phone runs, and isFeedbackAnswer reads the mill's own answer.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { MAX_FEEDBACK_CHARS, MAX_SCREEN_NAME, buildFeedbackRequest, isFeedbackAnswer } from '../../src/services/feedback';

const readJson = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(rel, 'utf8')) as Record<string, unknown>;
const grind = readJson('grinds/feedback.json');
const schema = readJson('schemas/feedback-input-1.0.schema.json');
const validate = new Ajv({ strict: true }).compile(schema);

describe('grinds/feedback.json', () => {
  it('forwards to the Mayor: no model, effort, instructions or answer schema', () => {
    expect(grind).toEqual({
      grind: 1,
      app: 'legend',
      kind: 'feedback',
      versions: ['1.0'],
      forward: 'mayor',
      inputSchema: 'schemas/feedback-input-1.0.schema.json',
      attachments: { min: 0, max: 1, mime: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 8388608 },
    });
    for (const key of ['model', 'effort', 'instructions', 'answerSchema']) expect(grind).not.toHaveProperty(key);
  });
});

describe('the input schema and buildFeedbackRequest', () => {
  it.each(['add', 'wrong', 'other'] as const)('builds a %s request the schema accepts', (kind) => {
    const request = buildFeedbackRequest(kind, 'Globe', '  Brazil does not light up  ');
    expect(request).toEqual({ kind, screen: 'Globe', text: 'Brazil does not light up', app_version: __APP_VERSION__ });
    expect(validate(request), JSON.stringify(validate.errors)).toBe(true);
  });

  it('refuses a kind it does not know, an empty text, a long text, and a field it does not list', () => {
    const good = buildFeedbackRequest('add', 'Learn', 'More please');
    expect(validate({ ...good, kind: 'praise' })).toBe(false);
    expect(validate({ ...good, text: '' })).toBe(false);
    expect(validate({ ...good, text: 'x'.repeat(MAX_FEEDBACK_CHARS + 1) })).toBe(false);
    expect(validate({ ...good, screen: 'x'.repeat(MAX_SCREEN_NAME + 1) })).toBe(false);
    expect(validate({ ...good, item: 'abc' })).toBe(false);
  });

  it('a request with the longest text fits a grist record', () => {
    const request = buildFeedbackRequest('wrong', 'Quarters', 'é'.repeat(MAX_FEEDBACK_CHARS));
    expect(new TextEncoder().encode(JSON.stringify(request)).length).toBeLessThan(6500);
  });
});

describe('the mill answer', () => {
  it('is exactly {"status":"sent"}', () => {
    expect(isFeedbackAnswer({ status: 'sent' })).toBe(true);
    for (const wrong of [null, 'sent', {}, { status: 'queued' }, { status: 'sent', extra: 1 }]) expect(isFeedbackAnswer(wrong)).toBe(false);
  });
});
