// The tutor's grind (grinds/legend-ask.json) is told about the settings it may suggest from the registry: `npm run grind:build`
// (scripts/grind-build.ts) writes the list into its instructions and the settingsChanges part of its answer schema. This test fails
// when grinds/ is behind the registry, and checks the app reads an answer the way the schema allows.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { SETTINGS } from '../../src/settings/registry';
import { SETTINGS_BEGIN, SETTINGS_END, settingsBlock, withSettingsBlock, withSettingsChanges, formatJson } from '../../src/settings/grindText';
import { ASK_VERSION, isLegendAnswer } from '../../src/services/ask';

const grind = JSON.parse(readFileSync('grinds/legend-ask.json', 'utf8')) as Record<string, unknown>;
const instructions = readFileSync(grind.instructions as string, 'utf8');
const answerText = readFileSync(grind.answerSchema as string, 'utf8');
const answerSchema = JSON.parse(answerText) as Record<string, unknown>;
const listed = instructions.slice(instructions.indexOf(SETTINGS_BEGIN), instructions.indexOf(SETTINGS_END));

describe('the legend-ask grind', () => {
  it('is the tutor: kind legend-ask, versions 1.0, 1.1 and 1.2, sonnet at medium, none to two photos', () => {
    expect(grind).toMatchObject({ app: 'legend', kind: 'legend-ask', versions: ['1.0', '1.1', '1.2'], model: 'sonnet', effort: 'medium' });
    expect(grind.attachments).toMatchObject({ min: 0, max: 2 });
  });

  it('offers Other among the kinds a new item starts with', () => {
    const entry = SETTINGS.find((s) => s.key === 'defaultKind');
    expect(entry?.kind === 'choice' && entry.options).toEqual([
      { value: 'coin', label: 'Coin' },
      { value: 'note', label: 'Banknote' },
      { value: 'other', label: 'Other' },
    ]);
    expect(listed).toContain('"other" (Other)');
  });

  it('takes an Other with its subtype in the 1.1 input and still the 1.0 input of before', () => {
    const ajv = new Ajv({ strict: true });
    const v11 = JSON.parse(readFileSync('schemas/legend-ask-input-1.1.schema.json', 'utf8')) as Record<string, unknown>;
    const v10 = JSON.parse(readFileSync('schemas/legend-ask-input-1.0.schema.json', 'utf8')) as Record<string, unknown>;
    expect(grind.inputSchema).toBe('schemas/legend-ask-input-1.2.schema.json');
    const facts = { kind: 'other', subtype: 'Subway token', country: 'US', countryName: 'United States', currency: null, denomination: 'Fare token', faceValue: null, year: 1986, mintMark: null, mintCity: null, series: null, design: null, material: 'brass', inscription: '', gradeGuess: null, gradeNotes: '', funFact: '', confirmed: true };
    const request = (item: unknown, summary: unknown) => ({ question: 'What was this used for?', sides: [], context: { screen: 'item', item, country: null, collectionSummary: summary }, settings: {}, history: [] });
    const summary11 = { items: 1, coins: 0, notes: 0, others: 1, countries: [{ code: 'US', coins: 0, notes: 0, others: 1 }] };
    const validate11 = ajv.compile(v11);
    expect(validate11(request(facts, summary11)), JSON.stringify(validate11.errors)).toBe(true);
    expect(validate11(request({ ...facts, subtype: undefined }, summary11))).toBe(false);
    expect(ajv.compile(v10)(request(facts, summary11))).toBe(false);
    const coin: Partial<typeof facts> = { ...facts, kind: 'coin' as never };
    delete coin.subtype;
    const validate10 = ajv.compile(v10);
    expect(validate10(request(coin, { items: 1, coins: 1, notes: 0, countries: [{ code: 'US', coins: 1, notes: 0 }] })), JSON.stringify(validate10.errors)).toBe(true);
  });

  it('takes the rarity line and the number struck in the 1.2 input, and still the 1.1 and 1.0 inputs of before', () => {
    const ajv = new Ajv({ strict: true });
    const schema = (v: string) => JSON.parse(readFileSync(`schemas/legend-ask-input-${v}.schema.json`, 'utf8')) as Record<string, unknown>;
    expect(ASK_VERSION).toBe('1.2');
    const facts = { kind: 'coin', subtype: null, country: 'US', countryName: 'United States', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1932, mintMark: 'D', mintCity: 'Denver', series: 'Washington quarter', design: null, material: '', inscription: '', gradeGuess: null, gradeNotes: '', funFact: '', confirmed: true };
    const rarity = { rarity: 'Scarce · 436,800 struck at Denver in 1932 · a key date', struck: 436800 };
    const summary = { items: 1, coins: 1, notes: 0, others: 0, countries: [{ code: 'US', coins: 1, notes: 0, others: 0 }] };
    const request = (item: unknown, collectionSummary: unknown = summary) => ({ question: 'How rare is it?', sides: [], context: { screen: 'item', item, country: null, collectionSummary }, settings: {}, history: [] });
    const validate12 = ajv.compile(schema('1.2'));
    expect(validate12(request({ ...facts, ...rarity })), JSON.stringify(validate12.errors)).toBe(true);
    expect(validate12(request({ ...facts, rarity: null, struck: null })), JSON.stringify(validate12.errors)).toBe(true);
    expect(validate12(request(facts)), 'both are required').toBe(false);
    expect(validate12(request({ ...facts, rarity: 'x'.repeat(241), struck: null }))).toBe(false);
    expect(validate12(request({ ...facts, rarity: null, struck: 1.5 }))).toBe(false);
    const validate11 = ajv.compile(schema('1.1'));
    expect(validate11(request(facts)), JSON.stringify(validate11.errors)).toBe(true);
    expect(validate11(request({ ...facts, ...rarity })), '1.1 knows no rarity').toBe(false);
    const coin: Partial<typeof facts> = { ...facts };
    delete coin.subtype;
    const validate10 = ajv.compile(schema('1.0'));
    expect(validate10(request(coin, { items: 1, coins: 1, notes: 0, countries: [{ code: 'US', coins: 1, notes: 0 }] })), JSON.stringify(validate10.errors)).toBe(true);
  });

  it('tells the tutor how to speak of an Other', () => {
    expect(instructions).toMatch(/`other`/);
    expect(instructions).toMatch(/subtype/);
    expect(instructions).toMatch(/never as a price|never a price/i);
    expect(instructions).toMatch(/how to tell a real one|tell a real one/i);
  });

  it('tells the tutor to use the rarity it is given, to say how many survive is not known, and never to guess one', () => {
    expect(instructions).toMatch(/`rarity`/);
    expect(instructions).toMatch(/`struck`/);
    expect(instructions).toMatch(/how many survive/i);
    expect(instructions).toMatch(/does not have the figure|do not have the figure/i);
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
