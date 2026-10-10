// The tutor's grind (grinds/legend-ask.json) is told about the settings it may suggest from the registry: `npm run grind:build`
// (scripts/grind-build.ts) writes the list into its instructions and the settingsChanges part of its answer schema. This test fails
// when grinds/ is behind the registry, and checks the app reads an answer the way the schema allows.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { SETTINGS } from '../../src/settings/registry';
import { SETTINGS_BEGIN, SETTINGS_END, settingsBlock, withSettingsBlock, withSettingsChanges, formatJson } from '../../src/settings/grindText';
import { isLegendAnswer } from '../../src/services/ask';

const grind = JSON.parse(readFileSync('grinds/legend-ask.json', 'utf8')) as Record<string, unknown>;
const instructions = readFileSync(grind.instructions as string, 'utf8');
const answerText = readFileSync(grind.answerSchema as string, 'utf8');
const answerSchema = JSON.parse(answerText) as Record<string, unknown>;
const listed = instructions.slice(instructions.indexOf(SETTINGS_BEGIN), instructions.indexOf(SETTINGS_END));

describe('the legend-ask grind', () => {
  it('is the tutor: kind legend-ask, version 1.0, sonnet at medium, none to two photos', () => {
    expect(grind).toMatchObject({ app: 'legend', kind: 'legend-ask', versions: ['1.0'], model: 'sonnet', effort: 'medium' });
    expect(grind.attachments).toMatchObject({ min: 0, max: 2 });
  });

  it('lists every talkable setting in its instructions, with its values', () => {
    const talkable = SETTINGS.filter((s) => s.talkable);
    expect(talkable.length).toBeGreaterThan(0);
    for (const s of talkable) {
      expect(listed, s.key).toContain(`\`${s.key}\``);
      expect(listed, s.key).toContain(s.label);
    }
    expect(listed).toContain('"large" (Large)');
  });

  it('never lists a setting only he may change', () => {
    for (const s of SETTINGS.filter((e) => !e.talkable)) expect(listed, s.key).not.toContain(`\`${s.key}\``);
    expect(settingsBlock()).not.toContain('`sharing`');
  });

  it('is not behind the registry (run npm run grind:build)', () => {
    expect(withSettingsBlock(instructions), 'the instructions').toBe(instructions);
    expect(`${formatJson(withSettingsChanges(answerSchema))}\n`, 'the answer schema').toBe(answerText);
  });

  it('allows a settings change only of a talkable setting to a value it allows', () => {
    const validate = new Ajv({ strict: true }).compile(answerSchema);
    const answer = (settingsChanges: unknown[]) => ({ answer: 'Look at the hair.', followUps: [], settingsChanges, teachMore: null });
    expect(validate(answer([{ key: 'textSize', value: 'large', why: 'Easier to read.' }])), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(answer([{ key: 'textSize', value: 'huge', why: 'Easier to read.' }]))).toBe(false);
    expect(validate(answer([{ key: 'sharing', value: false, why: 'Private.' }]))).toBe(false);
    expect(validate(answer([{ key: 'sizeCap', value: 2400, why: 'Sharper dates.' }]))).toBe(true);
  });

  it('is read by the app the way the schema allows', () => {
    const good = { answer: 'Look at **the hair**.', followUps: ['What is a key date?'], settingsChanges: [{ key: 'textSize', value: 'large', why: 'Easier.' }], teachMore: { topic: 'Mint marks', why: 'Yours has one.' } };
    expect(isLegendAnswer(good)).toBe(true);
    expect(isLegendAnswer({ ...good, teachMore: null, settingsChanges: [] })).toBe(true);
    expect(isLegendAnswer({ ...good, followUps: ['a', 'b', 'c', 'd'] })).toBe(false);
    expect(isLegendAnswer({ ...good, answer: '' })).toBe(false);
    expect(isLegendAnswer({ ...good, extra: 1 })).toBe(false);
    expect(isLegendAnswer({ ...good, settingsChanges: [{ key: 'textSize', value: 'large' }] })).toBe(false);
    expect(isLegendAnswer('Look at the hair.')).toBe(false);
  });
});
