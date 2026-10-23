// The two confirm commands the sheets' Send and the tutor's door share: tell-the-maker (src/feedback/feedbackForm.ts) and wish-for
// (src/wishlist/wishForm.ts). Each has an args schema built from its form, runs the sheet's own send once, and refuses what the sheet's
// Send would not take.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineRegistry } from 'voice-kit/talks';
import { argsOf } from 'voice-kit/forms';
import { FEEDBACK_FORM, tellTheMaker } from '../../src/feedback/feedbackForm';
import * as outbox from '../../src/feedback/outbox';
import { wishFor } from '../../src/data/repositories';
import { MAX_FEEDBACK_CHARS } from '../../src/services/feedback';
import { WISH_FORM, wishForCommand } from '../../src/wishlist/wishForm';

vi.mock('../../src/feedback/outbox', () => ({
  queueFeedback: vi.fn(async () => ({ id: 'f1' })),
  sendWaiting: vi.fn(async () => undefined),
  isWaiting: vi.fn(async () => false),
}));
vi.mock('../../src/data/repositories', () => ({ wishFor: vi.fn(async () => ({})) }));

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
