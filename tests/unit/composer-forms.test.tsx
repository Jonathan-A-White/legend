// The two forms that take voice-kit's Composer: the tutor box (AskBox) and the Tell the maker sheet. One settings constant says how the
// Composer works in both (hold to talk, the words wait in the box, Send by button, type on, attach and camera off); each form's Send
// hands the words to its own sender, and the tutor's suggestion chips still ask at once.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackSheet } from '../../src/feedback/FeedbackSheet';
import * as outbox from '../../src/feedback/outbox';
import { AskBox } from '../../src/tutor/AskBox';
import { LEGEND_COMPOSER_SETTINGS } from '../../src/ui/legendComposer';
import { clips, installMic } from 'voice-kit/testing/mic';

vi.mock('../../src/feedback/outbox', () => ({
  queueFeedback: vi.fn(async () => ({ id: 'f1' })),
  sendWaiting: vi.fn(async () => undefined),
  isWaiting: vi.fn(async () => false),
}));

const user = userEvent.setup();
let mic: ReturnType<typeof installMic> | null = null;
/** The phone has a microphone and a recogniser: the Composer opens on its hold bar. Without one it opens on the text box. */
const withMic = (): void => {
  mic = installMic(window);
};
afterEach(() => {
  cleanup();
  mic?.uninstall();
  mic = null;
});

describe('the one Composer setting for Legend', () => {
  it('holds to talk, leaves the words for a Send button, allows typing and takes no attachment or camera', () => {
    expect(LEGEND_COMPOSER_SETTINGS).toMatchObject({ talk: 'hold', send: 'button', type: true, attach: false, camera: false });
  });
});

describe('the tutor box', () => {
  const questions = ['Where is the mint mark?', 'Is it rare?'];

  it('shows the hold bar, and Type a question brings out the field; Ask sends what was typed', async () => {
    withMic();
    const onAsk = vi.fn();
    render(<AskBox questions={questions} state={{ phase: 'idle' }} onAsk={onAsk} />);
    expect(screen.getByRole('button', { name: /Hold to ask/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Type a question' }));
    await user.type(screen.getByRole('textbox', { name: 'Your question' }), 'What is it worth?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(onAsk).toHaveBeenCalledExactlyOnceWith('What is it worth?');
  });

  it('opens on the field when the phone cannot listen, and Ask sends what was typed', async () => {
    const onAsk = vi.fn();
    render(<AskBox questions={questions} state={{ phase: 'idle' }} onAsk={onAsk} />);
    expect(screen.queryByRole('button', { name: /Hold to ask/ })).toBeNull();
    await user.type(screen.getByRole('textbox', { name: 'Your question' }), 'Is it silver?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(onAsk).toHaveBeenCalledExactlyOnceWith('Is it silver?');
  });

  it('offers no attach or camera', () => {
    withMic();
    render(<AskBox questions={questions} state={{ phase: 'idle' }} onAsk={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /attach|camera/i })).toBeNull();
  });

  it('asks a suggestion at once when it is tapped', async () => {
    const onAsk = vi.fn();
    render(<AskBox questions={questions} state={{ phase: 'idle' }} onAsk={onAsk} />);
    await user.click(within(screen.getByRole('list', { name: 'Suggested questions' })).getByRole('button', { name: 'Is it rare?' }));
    expect(onAsk).toHaveBeenCalledExactlyOnceWith('Is it rare?');
  });

  it('puts a question that failed back in the field to be sent again', () => {
    render(<AskBox questions={questions} state={{ phase: 'failed', question: 'Is it rare?', failure: 'unreachable', detail: 'No answer.' }} onAsk={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('Is it rare?');
  });
});

describe('the Tell the maker sheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fills its voice slot with the same Composer: a hold bar, and the words typed there go as the feedback', async () => {
    withMic();
    render(<FeedbackSheet screen="Globe" onClose={vi.fn()} />);
    const sheet = screen.getByRole('dialog', { name: 'Tell the maker' });
    expect(within(sheet).getByRole('button', { name: /Hold to talk/ })).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Type it here' }));
    await user.type(within(sheet).getByRole('textbox', { name: 'Words to send' }), 'Brazil does not light up');
    await user.click(within(sheet).getByRole('button', { name: 'Send these words' }));
    await waitFor(() => expect(outbox.queueFeedback).toHaveBeenCalledExactlyOnceWith('other', 'Globe', 'Brazil does not light up', undefined));
    expect(await within(sheet).findByRole('status')).toHaveTextContent('Sent, thank you');
  });

  it("sends the sheet's own box and the Composer's words together, under the kind he picked", async () => {
    withMic();
    render(<FeedbackSheet screen="Quarters" onClose={vi.fn()} />);
    const sheet = screen.getByRole('dialog', { name: 'Tell the maker' });
    await user.click(within(sheet).getByRole('radio', { name: "Something's wrong" }));
    await user.type(within(sheet).getByRole('textbox', { name: 'Your message' }), 'The map is slow.');
    await user.click(within(sheet).getByRole('button', { name: 'Type it here' }));
    await user.type(within(sheet).getByRole('textbox', { name: 'Words to send' }), 'It froze twice.');
    await user.click(within(sheet).getByRole('button', { name: 'Send these words' }));
    await waitFor(() => expect(outbox.queueFeedback).toHaveBeenCalledExactlyOnceWith('wrong', 'Quarters', 'The map is slow.\nIt froze twice.', undefined));
  });

  it("still sends the sheet's own box by the sheet's Send", async () => {
    render(<FeedbackSheet screen="Collection" onClose={vi.fn()} />);
    const sheet = screen.getByRole('dialog', { name: 'Tell the maker' });
    await user.type(within(sheet).getByRole('textbox', { name: 'Your message' }), 'Please add notes');
    await user.click(within(sheet).getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(outbox.queueFeedback).toHaveBeenCalledExactlyOnceWith('other', 'Collection', 'Please add notes', undefined));
  });
});

describe('a hold on the bar', () => {
  it('leaves the words in the tutor box, and Ask sends them', async () => {
    mic = installMic(window, { clip: clips.english });
    const onAsk = vi.fn();
    render(<AskBox questions={[]} state={{ phase: 'idle' }} onAsk={onAsk} />);
    const bar = screen.getByRole('button', { name: 'Hold to ask' });
    fireEvent.pointerDown(bar);
    const releasing = await screen.findByRole('button', { name: 'Release to keep it in the box' }, { timeout: 5000 });
    await waitFor(() => expect(screen.getByTestId('live-transcript').textContent).toMatch(/first chapter/i), { timeout: 10_000 });
    fireEvent.pointerUp(releasing, { clientX: 10, clientY: 10 });
    const box = await screen.findByRole('textbox', { name: 'Your question' });
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toMatch(/read me the first chapter/i));
    expect(onAsk).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(onAsk).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/read me the first chapter/i));
  }, 20_000);
});
