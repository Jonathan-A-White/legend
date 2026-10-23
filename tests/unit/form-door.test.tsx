// The tutor's door on the two small forms (src/tutor/FormDoor.tsx): 'Let the tutor do it' opens a panel where the tutor asks one question at a
// time on the legend-ask grind, each answer fills a field the sheet shows, and the Send at the end runs the same confirm command the sheet's own
// Send runs. The grind is faked at bsv-kit/grist's two calls; the hand path of each sheet is checked by its own feature and unit tests.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmSheet } from '../../src/capture/ConfirmSheet';
import { EditSheet } from '../../src/collection/EditSheet';
import type { Reference } from '../../src/collection/useReference';
import { serveReferenceData } from '../support/collection-fixtures';
import { FeedbackSheet, SENT_LINE } from '../../src/feedback/FeedbackSheet';
import * as outbox from '../../src/feedback/outbox';
import { setGristPort, gristTimings } from '../../src/services/grist';
import { WishSheet } from '../../src/wishlist/WishSheet';
import { updateItem, wishFor } from '../../src/data/repositories';
import type { Item } from '../../src/data/db';
import { answered, fakeGrist, type FakeGrist } from '../support/fake-grist';

vi.mock('../../src/feedback/outbox', () => ({
  queueFeedback: vi.fn(async () => ({ id: 'f1' })),
  sendWaiting: vi.fn(async () => undefined),
  isWaiting: vi.fn(async () => false),
}));
vi.mock('../../src/data/repositories', async (original) => ({
  ...(await original<typeof import('../../src/data/repositories')>()),
  usePhotos: () => undefined,
  wishFor: vi.fn(async () => ({})),
  updateItem: vi.fn(async () => ({})),
}));

const user = userEvent.setup();
let grist: FakeGrist;
/** The answers the faked grind gives, one per question the panel asks, in order. */
let replies: Record<string, unknown>[];

const reply = (said: string, more: Record<string, unknown> = {}): Record<string, unknown> => ({ answer: said, followUps: [], settingsChanges: [], teachMore: null, ...more });

beforeEach(() => {
  vi.clearAllMocks();
  gristTimings.pollMs = 5;
  grist = fakeGrist();
  grist.onAnswer(async (txid) => answered(replies.shift() ?? reply('Nothing more.'), txid, 'legend-ask'));
  setGristPort(grist.port);
});
afterEach(() => {
  cleanup();
  setGristPort(null);
});

const panel = () => screen.getByRole('region', { name: 'The tutor is helping with this form' });
const asked = (n: number) => (grist.sent[n]?.input as { question: string; form: { name: string; command: string; fields: { name: string; value: string }[] } });

describe('Let the tutor do it on Tell the maker', () => {
  it('asks one question at a time, fills the sheet as he answers, and Send runs the command the sheet sends with', async () => {
    replies = [
      reply('Is it something you wish the app did, or something wrong?', { form_ask: 'kind' }),
      reply('What would you like to tell the maker?', { form_values: [{ field: 'kind', value: 'Can I add this?' }], form_ask: 'message' }),
      reply('Do you have a screenshot to add?', { form_values: [{ field: 'message', value: 'A place for notes about where I found a coin' }], form_ask: 'screenshot' }),
      reply('Everything is filled in.'),
    ];
    render(<FeedbackSheet screen="Collection" onClose={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'The tutor is helping with this form' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Let the tutor do it' }));
    await within(panel()).findByText('Is it something you wish the app did, or something wrong?');
    expect(asked(0).question).toBe('Help me fill this in.');
    expect(asked(0).form.name).toBe('Tell the maker');
    expect(asked(0).form.command).toBe('tell-the-maker');
    expect(asked(0).form.fields.map((f) => f.name)).toEqual(['kind', 'message', 'screenshot']);

    await user.type(within(panel()).getByRole('textbox', { name: 'Your answer' }), 'I wish it did something');
    await user.click(within(panel()).getByRole('button', { name: 'Reply' }));
    await within(panel()).findByText('What would you like to tell the maker?');
    expect(asked(1).question).toBe('I wish it did something');
    expect(screen.getByRole('radio', { name: 'Can I add this?' })).toBeChecked();
    expect(within(panel()).queryByRole('button', { name: /^Send/ })).toBeNull();

    await user.type(within(panel()).getByRole('textbox', { name: 'Your answer' }), 'notes on where I found it');
    await user.click(within(panel()).getByRole('button', { name: 'Reply' }));
    await within(panel()).findByText('Do you have a screenshot to add?');
    expect(screen.getByRole('textbox', { name: 'Your message' })).toHaveValue('A place for notes about where I found a coin');
    expect(asked(2).form.fields.find((f) => f.name === 'kind')?.value).toBe('Can I add this?');

    await user.click(within(panel()).getByRole('button', { name: 'No picture' }));
    await within(panel()).findByText('Everything is filled in.');
    expect(asked(3).question).toBe('I have no picture.');
    // nothing is sent until he taps Send himself
    expect(outbox.queueFeedback).not.toHaveBeenCalled();
    expect(within(panel()).getByText(/Send to the maker \(Can I add this\?\): A place for notes about where I found a coin\?/)).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Send Tell the maker' }));
    await screen.findByText(SENT_LINE);
    expect(outbox.queueFeedback).toHaveBeenCalledExactlyOnceWith('add', 'Collection', 'A place for notes about where I found a coin', undefined);
    expect(outbox.sendWaiting).toHaveBeenCalledOnce();
  });

  it('a field he types by hand is told to the tutor, and Stop helping closes the panel but keeps what is filled', async () => {
    replies = [reply('What would you like to tell the maker?', { form_values: [{ field: 'message', value: 'Dark mode' }], form_ask: 'message' })];
    render(<FeedbackSheet screen="Globe" onClose={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: 'Your message' }), 'By hand: ');
    await user.click(screen.getByRole('button', { name: 'Let the tutor do it' }));
    await within(panel()).findByText('What would you like to tell the maker?');
    expect(asked(0).form.fields.find((f) => f.name === 'message')?.value).toBe('By hand: ');
    await user.click(within(panel()).getByRole('button', { name: 'Stop helping' }));
    expect(screen.queryByRole('region', { name: 'The tutor is helping with this form' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Your message' })).toHaveValue('Dark mode');
    expect(outbox.queueFeedback).not.toHaveBeenCalled();
  });

  it('says plainly when the tutor cannot be reached, and Retry asks again', async () => {
    grist.onAnswer(async (txid) => ({ re: txid, status: 'refused', reason: 'down', grind: { app: 'legend', kind: 'legend-ask', v: '1.2' } }));
    render(<FeedbackSheet screen="Globe" onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Let the tutor do it' }));
    await within(panel()).findByRole('alert');
    grist.onAnswer(async (txid) => answered(reply('What would you like to tell the maker?', { form_ask: 'message' }), txid, 'legend-ask'));
    await user.click(within(panel()).getByRole('button', { name: 'Try again' }));
    await within(panel()).findByText('What would you like to tell the maker?');
    expect(grist.sent).toHaveLength(2);
  });

  it('draws no door once the sheet has sent', async () => {
    render(<FeedbackSheet screen="Globe" onClose={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: 'Your message' }), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText(SENT_LINE);
    expect(screen.queryByRole('button', { name: 'Let the tutor do it' })).toBeNull();
  });
});

describe('Let the tutor do it on What is the asking price?', () => {
  const item = { id: 'item-1', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1932, mintMark: 'D', series: null, design: null, material: '', inscription: '', funFact: '', gradeGuess: null, gradeNotes: '', notes: '', tags: [], status: 'pending', confidence: null, createdAt: 1, updatedAt: 1 } as unknown as Item;

  it('fills the price and where, and Send runs wish-for once and closes the sheet as Add to Wish list does', async () => {
    replies = [
      reply('What is the asking price?', { form_ask: 'asking' }),
      reply('Where did you see it?', { form_values: [{ field: 'asking', value: '$4.50' }], form_ask: 'store' }),
      reply('Everything is filled in.', { form_values: [{ field: 'store', value: 'Coin Corner' }] }),
    ];
    const onClose = vi.fn();
    render(<WishSheet item={item} onBack={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Let the tutor do it' }));
    await within(panel()).findByText('What is the asking price?');
    expect(asked(0).form.name).toBe('What is the asking price?');
    expect(asked(0).form.command).toBe('wish-for');
    expect(asked(0).form.fields.map((f) => f.name)).toEqual(['asking', 'store']);

    await user.type(within(panel()).getByRole('textbox', { name: 'Your answer' }), 'four fifty');
    await user.click(within(panel()).getByRole('button', { name: 'Reply' }));
    await within(panel()).findByText('Where did you see it?');
    expect(screen.getByLabelText(/Asking price/)).toHaveValue('$4.50');

    await user.type(within(panel()).getByRole('textbox', { name: 'Your answer' }), 'Coin Corner');
    await user.click(within(panel()).getByRole('button', { name: 'Reply' }));
    await within(panel()).findByText('Everything is filled in.');
    expect(screen.getByLabelText(/Where\?/)).toHaveValue('Coin Corner');
    expect(wishFor).not.toHaveBeenCalled();
    expect(within(panel()).getByText('Add to the Wish list at $4.50 from Coin Corner?')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Send What is the asking price?' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(wishFor).toHaveBeenCalledExactlyOnceWith('item-1', 4.5, 'Coin Corner');
  });

  it('shows no Send until the required price holds something, and ignores a store the tutor was not asked about', async () => {
    replies = [reply('What is the asking price?', { form_values: [{ field: 'colour', value: 'red' }], form_ask: 'asking' })];
    render(<WishSheet item={item} onBack={vi.fn()} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Let the tutor do it' }));
    await within(panel()).findByText('What is the asking price?');
    expect(within(panel()).queryByRole('button', { name: /^Send/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add to Wish list' })).toBeDisabled();
  });
});

describe('Let the tutor do it on Change what is wrong and on Edit', () => {
  const coin = { id: 'item-2', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Dime', faceValue: 0.1, year: 1955, mintMark: null, series: null, design: null, material: 'Silver', inscription: 'LIBERTY', funFact: '', gradeGuess: 'VF', gradeNotes: '', notes: '', tags: ['silver'], status: 'named', confidence: null, createdAt: 1, updatedAt: 1 } as unknown as Item;
  const reference = {
    countryName: (cc: string) => cc,
    mintCity: () => null,
    flag: () => '',
    countryList: [
      { code: 'CA', name: 'Canada', flag: '🇨🇦' },
      { code: 'US', name: 'United States', flag: '🇺🇸' },
    ],
  } as unknown as Reference;

  beforeAll(() => serveReferenceData((name, fake) => vi.stubGlobal(name, fake)));

  it('Not quite: the tutor fills Country from a spoken country name and Send saves and confirms as Save and confirm does', async () => {
    replies = [reply('Which country is the coin from?', { form_ask: 'country' }), reply('Everything is filled in.', { form_values: [{ field: 'country', value: 'Canada' }] })];
    const onClose = vi.fn();
    render(<ConfirmSheet item={coin} onClose={onClose} onLetGo={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Not quite' }));
    await screen.findByRole('option', { name: /Canada/ });
    await user.click(screen.getByRole('button', { name: 'Let the tutor do it' }));
    await within(panel()).findByText('Which country is the coin from?');
    expect(asked(0).form.name).toBe('Change what is wrong');
    expect(asked(0).form.command).toBe('confirm-coin');
    expect(asked(0).form.fields.map((f) => f.name)).toEqual(['country', 'denomination', 'year', 'mintMark', 'series', 'design', 'grade', 'inscription']);
    expect(asked(0).form.fields.find((f) => f.name === 'denomination')?.value).toBe('Dime');

    await user.type(within(panel()).getByRole('textbox', { name: 'Your answer' }), 'it is from Canada');
    await user.click(within(panel()).getByRole('button', { name: 'Reply' }));
    await within(panel()).findByText('Everything is filled in.');
    expect(screen.getByLabelText('Country')).toHaveValue('CA');
    expect(updateItem).not.toHaveBeenCalled();
    expect(within(panel()).getByText('Save these changes and confirm: Dime, 1955, Canada?')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Send Change what is wrong' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(updateItem).toHaveBeenCalledExactlyOnceWith('item-2', {
      country: 'CA', denomination: 'Dime', year: 1955, mintMark: null, series: null, design: null, gradeGuess: 'VF', inscription: 'LIBERTY', status: 'confirmed',
    });
  });

  it('Not quite: the sheet\'s own Save and confirm still saves through the same command, and a year of five digits cannot be typed', async () => {
    const onClose = vi.fn();
    render(<ConfirmSheet item={coin} onClose={onClose} onLetGo={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Not quite' }));
    expect(screen.getByLabelText('Year')).toHaveAttribute('maxlength', '4');
    await user.click(screen.getByRole('button', { name: 'Save and confirm' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(updateItem).toHaveBeenCalledExactlyOnceWith('item-2', expect.objectContaining({ country: 'US', year: 1955, status: 'confirmed' }));
  });

  it('draws no door until Not quite is tapped', () => {
    render(<ConfirmSheet item={coin} onClose={vi.fn()} onLetGo={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Let the tutor do it' })).toBeNull();
  });

  it('Edit: the tutor fills the kind, the country and the grade from what he says, and Send saves the fields the form lacks as they are', async () => {
    replies = [
      reply('What kind of piece is it?', { form_ask: 'kind' }),
      reply('Everything is filled in.', {
        form_values: [
          { field: 'kind', value: 'Banknote' },
          { field: 'country', value: 'Canada' },
          { field: 'grade', value: 'XF · Extremely Fine' },
        ],
      }),
    ];
    const onClose = vi.fn();
    render(<EditSheet item={coin} reference={reference} onClose={onClose} />);
    await user.type(screen.getByLabelText('Design'), 'Schooner');
    await user.click(screen.getByRole('button', { name: 'Let the tutor do it' }));
    await within(panel()).findByText('What kind of piece is it?');
    expect(asked(0).form.name).toBe('Edit');
    expect(asked(0).form.command).toBe('edit-coin');
    expect(asked(0).form.fields.map((f) => f.name)).toEqual(['kind', 'country', 'denomination', 'year', 'mintMark', 'grade', 'inscription', 'tags']);
    expect(asked(0).form.fields.find((f) => f.name === 'tags')?.value).toBe('silver');

    await user.type(within(panel()).getByRole('textbox', { name: 'Your answer' }), 'a bill from Canada, extremely fine');
    await user.click(within(panel()).getByRole('button', { name: 'Reply' }));
    await within(panel()).findByText('Everything is filled in.');
    expect(screen.getByRole('radio', { name: 'Banknote' })).toBeChecked();
    expect(screen.getByLabelText('Country')).toHaveValue('CA');
    expect(screen.getByLabelText('Grade guess')).toHaveValue('XF');
    expect(updateItem).not.toHaveBeenCalled();

    await user.click(within(panel()).getByRole('button', { name: 'Send Edit' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(updateItem).toHaveBeenCalledExactlyOnceWith('item-2', {
      kind: 'note', subtype: null, country: 'CA', denomination: 'Dime', year: 1955, mintMark: null, series: null, design: 'Schooner', material: 'Silver', gradeGuess: 'XF', inscription: 'LIBERTY', tags: ['silver'],
    });
  });

  it('Edit: the sheet\'s own Save saves through the same command', async () => {
    const onClose = vi.fn();
    render(<EditSheet item={coin} reference={reference} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(updateItem).toHaveBeenCalledExactlyOnceWith('item-2', expect.objectContaining({ kind: 'coin', country: 'US', year: 1955, gradeGuess: 'VF', tags: ['silver'] }));
  });
});
