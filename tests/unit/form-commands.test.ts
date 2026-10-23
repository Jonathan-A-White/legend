// The two confirm commands the sheets' Send and the tutor's door share: tell-the-maker (src/feedback/feedbackForm.ts) and wish-for
// (src/wishlist/wishForm.ts). Each has an args schema built from its form, runs the sheet's own send once, and refuses what the sheet's
// Send would not take.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineRegistry } from 'voice-kit/talks';
import { argsOf } from 'voice-kit/forms';
import { FEEDBACK_FORM, tellTheMaker } from '../../src/feedback/feedbackForm';
import * as outbox from '../../src/feedback/outbox';
import { updateItem, wishFor } from '../../src/data/repositories';
import { CONFIRM_COMMAND, confirmForm } from '../../src/capture/confirmForm';
import { EDIT_COMMAND, editForm } from '../../src/collection/editForm';
import { GRADES } from '../../src/data/grades';
import { confirmCoinCommand, editCoinCommand } from '../../src/tutor/formCommands';
import { MAX_FORM_FIELDS } from 'voice-kit/forms';
import { MAX_FEEDBACK_CHARS } from '../../src/services/feedback';
import { WISH_FORM, wishForCommand } from '../../src/wishlist/wishForm';

vi.mock('../../src/feedback/outbox', () => ({
  queueFeedback: vi.fn(async () => ({ id: 'f1' })),
  sendWaiting: vi.fn(async () => undefined),
  isWaiting: vi.fn(async () => false),
}));
vi.mock('../../src/data/repositories', () => ({ wishFor: vi.fn(async () => ({})), updateItem: vi.fn(async () => ({})) }));

beforeEach(() => vi.clearAllMocks());

describe('tell-the-maker', () => {
  const make = (picture?: File) => {
    const seen: string[] = [];
    const command = tellTheMaker({ screen: 'Collection', picture: () => picture, onSending: () => seen.push('sending'), onOutcome: (o) => seen.push(o) });
    return { command, seen, registry: defineRegistry({ commands: [command] }) };
  };

  it('is a confirm command whose schema requires message, bounds it and offers the kinds as an enum', () => {
    const { command } = make();
    expect(command.name).toBe('tell-the-maker');
    expect(command.kind).toBe('confirm');
    expect(command.args).toMatchObject({
      type: 'object',
      required: ['message'],
      additionalProperties: false,
      properties: { message: { type: 'string', maxLength: MAX_FEEDBACK_CHARS }, kind: { enum: ['Can I add this?', "Something's wrong"] } },
    });
    expect(command.args?.properties).not.toHaveProperty('screenshot');
  });

  it('refuses a missing message, a message past the limit and a kind that is not offered', () => {
    const { registry } = make();
    expect(registry.refuses('tell-the-maker', {})).toMatch(/message/);
    expect(registry.refuses('tell-the-maker', { message: 'x'.repeat(MAX_FEEDBACK_CHARS + 1) })).toMatch(/message/);
    expect(registry.refuses('tell-the-maker', { message: 'Hello', kind: 'Praise' })).toMatch(/kind/);
    expect(registry.refuses('tell-the-maker', { message: 'Hello', kind: "Something's wrong" })).toBeUndefined();
  });

  it('queues one feedback as the sheet does: kind, screen, words, then sends what waits', async () => {
    const { registry, seen } = make();
    const ran = await registry.run('tell-the-maker', argsOf(FEEDBACK_FORM, { kind: 'Can I add this?', message: ' A place for notes ' }));
    expect(ran.ok).toBe(true);
    expect(outbox.queueFeedback).toHaveBeenCalledExactlyOnceWith('add', 'Collection', 'A place for notes', undefined);
    expect(outbox.sendWaiting).toHaveBeenCalledOnce();
    expect(seen).toEqual(['sending', 'sent']);
  });

  it('files a message with no kind as other, with the screenshot the sheet holds, and says saved when it waits', async () => {
    const picture = new File(['x'], 'shot.png', { type: 'image/png' });
    vi.mocked(outbox.isWaiting).mockResolvedValueOnce(true);
    const { registry, seen } = make(picture);
    await registry.run('tell-the-maker', { message: 'The map is slow' });
    expect(outbox.queueFeedback).toHaveBeenCalledExactlyOnceWith('other', 'Collection', 'The map is slow', picture);
    expect(seen).toEqual(['sending', 'saved']);
  });

  it('queues nothing for a refused call', async () => {
    const { registry } = make();
    const ran = await registry.run('tell-the-maker', { kind: 'Can I add this?' });
    expect(ran.ok).toBe(false);
    expect(outbox.queueFeedback).not.toHaveBeenCalled();
  });

  it('offers a question that names the kind and the words', () => {
    const { command } = make();
    expect(command.offer?.({ kind: "Something's wrong", message: 'Brazil does not light up' })).toBe("Send to the maker (Something's wrong): Brazil does not light up?");
  });
});

describe('wish-for', () => {
  const make = () => {
    const seen: string[] = [];
    const command = wishForCommand({ itemId: 'item-1', onWishing: () => seen.push('wishing'), onDone: () => seen.push('done') });
    return { command, seen, registry: defineRegistry({ commands: [command] }) };
  };

  it('is a confirm command whose schema requires asking and bounds store at 60', () => {
    const { command } = make();
    expect(command.name).toBe('wish-for');
    expect(command.kind).toBe('confirm');
    expect(command.args).toMatchObject({
      type: 'object',
      required: ['asking'],
      additionalProperties: false,
      properties: { asking: { type: 'string' }, store: { type: 'string', maxLength: 60 } },
    });
  });

  it('refuses a missing asking price, a store past 60 and a price that is not money', async () => {
    const { registry } = make();
    expect(registry.refuses('wish-for', {})).toMatch(/asking/);
    expect(registry.refuses('wish-for', { asking: '4.50', store: 'x'.repeat(61) })).toMatch(/store/);
    const ran = await registry.run('wish-for', { asking: 'cheap' });
    expect(ran).toMatchObject({ ok: false });
    expect(wishFor).not.toHaveBeenCalled();
  });

  it('calls wishFor once with the price as a number and the store, then reports done', async () => {
    const { registry, seen } = make();
    const ran = await registry.run('wish-for', argsOf(WISH_FORM, { asking: '$4.50', store: ' Coin Corner ' }));
    expect(ran.ok).toBe(true);
    expect(wishFor).toHaveBeenCalledExactlyOnceWith('item-1', 4.5, 'Coin Corner');
    expect(seen).toEqual(['wishing', 'done']);
  });

  it('keeps the store empty when none was given', async () => {
    const { registry } = make();
    await registry.run('wish-for', { asking: '12' });
    expect(wishFor).toHaveBeenCalledExactlyOnceWith('item-1', 12, '');
  });

  it('offers a question that names the price and the store', () => {
    const { command } = make();
    expect(command.offer?.({ asking: '4.50', store: 'Coin Corner' })).toBe('Add to the Wish list at $4.50 from Coin Corner?');
    expect(command.offer?.({ asking: '4.50' })).toBe('Add to the Wish list at $4.50?');
  });
});

const COUNTRIES = [
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
];
const GRADE_LABELS = GRADES.map(([code, name]) => `${code} · ${name}`);
const piece = { country: 'US', gradeGuess: null as string | null };

describe('confirm-coin', () => {
  const make = () => {
    const seen: string[] = [];
    const form = confirmForm(COUNTRIES, piece);
    const command = confirmCoinCommand(form, { itemId: 'item-1', countries: COUNTRIES, onSaving: () => seen.push('saving'), onDone: () => seen.push('done') });
    return { form, command, seen, registry: defineRegistry({ commands: [command] }) };
  };

  it('has the eight fields of Change what is wrong, Country and Grade guess as choices of the sheet\'s own lists', () => {
    const { form } = make();
    expect(form.name).toBe('Change what is wrong');
    expect(form.fields.map((f) => f.label)).toEqual(['Country', 'Denomination', 'Year', 'Mint mark', 'Series', 'Design', 'Grade guess', 'Inscription']);
    expect(form.fields.length).toBeLessThanOrEqual(MAX_FORM_FIELDS);
    expect(form.fields.find((f) => f.label === 'Country')).toMatchObject({ kind: 'choice', options: ['Canada', 'United States'] });
    expect(form.fields.find((f) => f.label === 'Grade guess')).toMatchObject({ kind: 'choice', options: GRADE_LABELS });
    expect(form.fields.find((f) => f.label === 'Year')).toMatchObject({ kind: 'text', maxLength: 4 });
  });

  it('is a confirm command that takes nothing else and refuses a year of five characters or a country that is not offered', () => {
    const { command, registry } = make();
    expect(command.name).toBe(CONFIRM_COMMAND);
    expect(command.kind).toBe('confirm');
    expect(command.args).toMatchObject({ type: 'object', additionalProperties: false });
    expect(registry.refuses(CONFIRM_COMMAND, { year: '19320' })).toMatch(/year/);
    expect(registry.refuses(CONFIRM_COMMAND, { country: 'Atlantis' })).toMatch(/country/);
    expect(registry.refuses(CONFIRM_COMMAND, { country: 'Canada', year: '1932', grade: GRADE_LABELS[6] })).toBeUndefined();
  });

  it('calls updateItem once with the changes the sheet saved and status confirmed', async () => {
    const { registry, seen } = make();
    const values = { country: 'Canada', denomination: ' Dime ', year: '1955', mintMark: ' ', series: 'Bluenose', design: 'Schooner', grade: GRADE_LABELS[6], inscription: ' ELIZABETH II ' };
    const ran = await registry.run(CONFIRM_COMMAND, argsOf(confirmForm(COUNTRIES, piece), values));
    expect(ran.ok).toBe(true);
    expect(updateItem).toHaveBeenCalledExactlyOnceWith('item-1', {
      country: 'CA',
      denomination: 'Dime',
      year: 1955,
      mintMark: null,
      series: 'Bluenose',
      design: 'Schooner',
      gradeGuess: 'VF',
      inscription: 'ELIZABETH II',
      status: 'confirmed',
    });
    expect(seen).toEqual(['saving', 'done']);
  });

  it('clears what the form leaves empty, and keeps a country or grade the item already had that the lists do not know', async () => {
    const form = confirmForm(COUNTRIES, { country: 'XX', gradeGuess: 'PR-65' });
    expect(form.fields.find((f) => f.label === 'Country')?.options).toContain('XX');
    expect(form.fields.find((f) => f.label === 'Grade guess')?.options).toContain('PR-65');
    const registry = defineRegistry({ commands: [confirmCoinCommand(form, { itemId: 'item-1', countries: COUNTRIES, onSaving: vi.fn(), onDone: vi.fn() })] });
    await registry.run(CONFIRM_COMMAND, { country: 'XX', grade: 'PR-65' });
    expect(updateItem).toHaveBeenCalledExactlyOnceWith('item-1', {
      country: 'XX', denomination: '', year: null, mintMark: null, series: null, design: null, gradeGuess: 'PR-65', inscription: '', status: 'confirmed',
    });
  });

  it('saves nothing for a refused call and lets the sheet edit again when the save fails', async () => {
    const { registry } = make();
    expect((await registry.run(CONFIRM_COMMAND, { year: '19320' })).ok).toBe(false);
    expect(updateItem).not.toHaveBeenCalled();
    const failed = vi.fn();
    vi.mocked(updateItem).mockRejectedValueOnce(new Error('disk full'));
    const again = defineRegistry({ commands: [confirmCoinCommand(confirmForm(COUNTRIES, piece), { itemId: 'item-1', countries: COUNTRIES, onSaving: vi.fn(), onDone: vi.fn(), onFailed: failed })] });
    expect((await again.run(CONFIRM_COMMAND, { year: '1932' })).ok).toBe(false);
    expect(failed).toHaveBeenCalledOnce();
  });

  it('offers a question that names the coin', () => {
    const { command } = make();
    expect(command.offer?.({ country: 'Canada', denomination: 'Dime', year: '1955' })).toBe('Save these changes and confirm: Dime, 1955, Canada?');
    expect(command.offer?.({})).toBe('Save these changes and confirm it?');
  });
});

describe('edit-coin', () => {
  const rest = { subtype: 'Subway token', series: 'Bluenose', design: 'Schooner', material: 'Silver' };
  const make = () => {
    const seen: string[] = [];
    const form = editForm(COUNTRIES, piece);
    const command = editCoinCommand(form, { itemId: 'item-1', countries: COUNTRIES, rest: () => rest, onSaving: () => seen.push('saving'), onDone: () => seen.push('done') });
    return { form, command, seen, registry: defineRegistry({ commands: [command] }) };
  };

  it('has at most eight fields, the ones the tutor is most asked for, with Kind, Country and Grade guess as choices', () => {
    const { form } = make();
    expect(form.name).toBe('Edit');
    expect(form.fields.map((f) => f.label)).toEqual(['Kind', 'Country', 'Denomination', 'Year', 'Mint mark', 'Grade guess', 'Inscription', 'Tags']);
    expect(form.fields.length).toBeLessThanOrEqual(MAX_FORM_FIELDS);
    expect(form.fields.find((f) => f.label === 'Kind')).toMatchObject({ kind: 'choice', required: true, options: ['Coin', 'Banknote', 'Other'] });
    expect(form.fields.find((f) => f.label === 'Country')).toMatchObject({ kind: 'choice', options: ['Canada', 'United States'] });
    expect(form.fields.find((f) => f.label === 'Grade guess')).toMatchObject({ kind: 'choice', options: GRADE_LABELS });
    expect(form.fields.find((f) => f.label === 'Year')).toMatchObject({ kind: 'text', maxLength: 4 });
  });

  it('refuses a year of five characters, a kind that is not offered and a missing kind', () => {
    const { registry } = make();
    expect(registry.refuses(EDIT_COMMAND, { kind: 'Coin', year: '19320' })).toMatch(/year/);
    expect(registry.refuses(EDIT_COMMAND, { kind: 'Medal' })).toMatch(/kind/);
    expect(registry.refuses(EDIT_COMMAND, {})).toMatch(/kind/);
  });

  it('calls updateItem once with the changes the sheet saved, the fields the form lacks as the sheet holds them', async () => {
    const { registry, seen } = make();
    const values = { kind: 'Other', country: 'United States', denomination: 'Token', year: '1970', mintMark: 'D', grade: GRADE_LABELS[0], inscription: 'GOOD FOR ONE FARE', tags: 'subway, new york, subway' };
    const ran = await registry.run(EDIT_COMMAND, argsOf(editForm(COUNTRIES, piece), values));
    expect(ran.ok).toBe(true);
    expect(updateItem).toHaveBeenCalledExactlyOnceWith('item-1', {
      kind: 'other',
      subtype: 'Subway token',
      country: 'US',
      denomination: 'Token',
      year: 1970,
      mintMark: 'D',
      series: 'Bluenose',
      design: 'Schooner',
      material: 'Silver',
      gradeGuess: 'P',
      inscription: 'GOOD FOR ONE FARE',
      tags: ['subway', 'new york'],
    });
    expect(seen).toEqual(['saving', 'done']);
  });

  it('drops the subtype of a coin, as the sheet does', async () => {
    const { registry } = make();
    await registry.run(EDIT_COMMAND, { kind: 'Coin' });
    expect(vi.mocked(updateItem).mock.calls[0]?.[1]).toMatchObject({ kind: 'coin', subtype: null, country: null, year: null, gradeGuess: null, tags: [] });
  });
});
