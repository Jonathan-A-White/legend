// A screen that is gone changes nothing when what it was waiting for answers late: ShareButton, NotesField and GradeWalk (pwa-kit/alive),
// and what the shared photo address timer does once its screen has gone. Each test holds the awaited call, unmounts, lets it answer with
// `window` taken away as the end of a test file does (pwa-kit/test-preset), and expects nothing raised and nothing done.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { settleAfterTeardown } from 'pwa-kit/test-preset';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Thumb } from '../../src/collection/Thumb';
import { NotesField } from '../../src/collection/NotesField';
import { db, type Item } from '../../src/data/db';
import { addItem } from '../../src/data/repositories';
import * as repositories from '../../src/data/repositories';
import type { Grade } from '../../src/data/us';
import { GradeWalk } from '../../src/learn/GradeWalk';
import { ShareButton } from '../../src/share/ShareButton';
import type { Shared } from '../../src/share/send';

// updateItem answers when the test says so (the real write is made first, so the store is honest).
let release: (() => void) | undefined;
let heldUpdate: Promise<unknown> | undefined;
vi.mock('../../src/data/repositories', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/data/repositories')>();
  return {
    ...real,
    updateItem: vi.fn((...args: Parameters<typeof real.updateItem>) => {
      const done = real.updateItem(...args);
      heldUpdate = new Promise<void>((resolve) => {
        release = resolve;
      }).then(() => done);
      return heldUpdate;
    }),
  };
});

const grades: Grade[] = [];

beforeEach(async () => {
  cleanup();
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
  release = undefined;
  heldUpdate = undefined;
  vi.mocked(repositories.updateItem).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterAll(() => {
  cleanup();
  db.close();
});

/** Lets the held call answer while `window` is gone; returns what that raised. */
const answerAfterTeardown = async (): Promise<unknown[]> => {
  const raised = await settleAfterTeardown(() => release?.());
  await heldUpdate;
  return raised;
};

describe('ShareButton', () => {
  it('makes no picture address and sets nothing when the picture is made after the screen has gone', async () => {
    let finish: (s: Shared) => void = () => undefined;
    const make = () => new Promise<Shared>((resolve) => (finish = resolve));
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:late/1');

    const view = render(<ShareButton which="item" make={make} className="x" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    await screen.findByRole('button', { name: 'Making…' });
    view.unmount();

    const raised = await settleAfterTeardown(() =>
      finish({ outcome: 'save', fileName: 'a.png', picture: { blob: new Blob(['x']), width: 1, height: 1 } }),
    );
    expect(raised).toEqual([]);
    // the address would never be let go: its screen had already gone
    expect(create).not.toHaveBeenCalled();
  });

  it('sets nothing when the picture fails after the screen has gone', async () => {
    let fail: (e: Error) => void = () => undefined;
    const make = () => new Promise<Shared>((_, reject) => (fail = reject));
    const view = render(<ShareButton which="globe" make={make} className="x" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    view.unmount();
    expect(await settleAfterTeardown(() => fail(new Error('no canvas')))).toEqual([]);
  });
});

describe('NotesField', () => {
  it('sets nothing when the save that leaving the screen started answers after it has gone', async () => {
    const item = await addItem({ kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1964 });
    const view = render(<NotesField itemId={item.id} initial="" />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'from grandpa' } });
    view.unmount(); // the unmount flush writes it
    await waitFor(() => expect(repositories.updateItem).toHaveBeenCalledTimes(1));
    expect(await answerAfterTeardown()).toEqual([]);
  });
});

describe('GradeWalk', () => {
  it('sets nothing when Keep answers after the screen has gone', async () => {
    const item = await addItem({ kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1964 });
    const coin = (await repositories.getItem(item.id))!;
    const view = render(<GradeWalk coins={[coin]} grades={grades} />);
    await userEvent.click(screen.getByRole('button', { name: /Grade Quarter dollar/ }));
    // the first answer of each of the three questions
    for (const group of screen.getAllByRole('radiogroup')) await userEvent.click(group.querySelector('[role="radio"]') as HTMLElement);
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(repositories.updateItem).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(await answerAfterTeardown()).toEqual([]);
  });
});

describe('the shared photo address timer (useObjectUrl)', () => {
  it('makes a photo address with no stub, and its 3 s timer lets it go once, harmlessly, even after the screen has gone', async () => {
    // Nothing is stubbed: jsdom under vitest keeps Node's own URL.createObjectURL and revokeObjectURL, so a screen test that ends
    // within 3 s leaves a timer that is dropped with the environment, and one that outlasts it revokes a real address. The spies call through.
    // Only the 3 s timer is faked (settleAfterTeardown waits on setImmediate).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const item = { id: 'i', kind: 'coin', status: 'confirmed', year: 1964 } as unknown as Item;

    const view = render(<Thumb item={item} blob={new Blob(['p'])} />);
    expect(create).toHaveBeenCalledTimes(1);
    const address = create.mock.results[0].value as string;
    view.unmount();
    // the test could end here: the address is let go only when the timer fires
    expect(revoke).not.toHaveBeenCalled();
    const raised = await settleAfterTeardown(() => vi.advanceTimersByTime(3000));
    expect(raised).toEqual([]);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith(address);
  });
});
