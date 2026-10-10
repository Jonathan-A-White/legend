// The small pure parts of the Collection (thumbnail choice, tags) and Edit, driven through the real item view.
import '@testing-library/react/dont-cleanup-after-each';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemView } from '../../src/collection';
import { parseTags } from '../../src/collection/fields';
import { pickThumb, type ThumbPhoto } from '../../src/collection/thumbs';
import { db } from '../../src/data/db';
import { getItem } from '../../src/data/repositories';
import { seedCollection, serveReferenceData } from '../support/collection-fixtures';

afterAll(() => {
  cleanup();
  db.close();
});

describe('pickThumb', () => {
  const blob = (n: string) => n as unknown as Blob;
  const thumbs: ThumbPhoto[] = [
    { itemId: 'a', side: 'reverse', thumb: blob('a-rev') },
    { itemId: 'a', side: 'obverse', thumb: blob('a-obv') },
    { itemId: 'b', side: 'reverse', thumb: blob('b-rev') },
  ];
  it('draws the obverse when there is one, else any photo of the item, else none', () => {
    expect(pickThumb(thumbs, 'a')).toBe('a-obv');
    expect(pickThumb(thumbs, 'b')).toBe('b-rev');
    expect(pickThumb(thumbs, 'c')).toBeUndefined();
    expect(pickThumb(undefined, 'a')).toBeUndefined();
  });
});

describe('parseTags', () => {
  it('splits on commas, trims and drops blanks and repeats', () => {
    expect(parseTags(' silver, gift ,, silver,from grandpa ')).toEqual(['silver', 'gift', 'from grandpa']);
    expect(parseTags('')).toEqual([]);
  });
});

describe('Edit', () => {
  beforeAll(() => {
    serveReferenceData((name, fake) => vi.stubGlobal(name, fake));
    URL.createObjectURL = () => 'blob:test/1';
    URL.revokeObjectURL = () => undefined;
  });
  beforeEach(async () => {
    cleanup();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('changes every kind of field and keeps only a number in the year', async () => {
    const { usQuarter } = await seedCollection();
    window.history.replaceState(null, '', '/#/item/' + usQuarter.id);
    render(<ItemView id={usQuarter.id} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit' });
    await waitFor(() => expect(within(sheet).getByRole('option', { name: /Canada/ })).toBeInTheDocument());

    const year = within(sheet).getByLabelText('Year');
    expect(year).toHaveAttribute('inputmode', 'numeric');
    await userEvent.clear(year);
    await userEvent.type(year, '19x6-5');
    expect(year).toHaveValue('1965');

    await userEvent.selectOptions(within(sheet).getByLabelText('Country'), 'CA');
    await userEvent.clear(within(sheet).getByLabelText('Denomination'));
    await userEvent.type(within(sheet).getByLabelText('Denomination'), 'Quarter');
    await userEvent.selectOptions(within(sheet).getByLabelText('Grade guess'), 'XF');
    await userEvent.clear(within(sheet).getByLabelText('Tags'));
    await userEvent.type(within(sheet).getByLabelText('Tags'), 'silver, gift');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Banknote' }));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await getItem(usQuarter.id)).toMatchObject({ year: 1965, country: 'CA', denomination: 'Quarter', gradeGuess: 'XF', tags: ['silver', 'gift'], kind: 'note' }));
    expect(screen.queryByRole('dialog', { name: 'Edit' })).toBeNull();
  });

  it('leaves the item as it was on Cancel', async () => {
    const { usQuarter } = await seedCollection();
    window.history.replaceState(null, '', '/#/item/' + usQuarter.id);
    render(<ItemView id={usQuarter.id} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit' });
    await userEvent.type(within(sheet).getByLabelText('Design'), ' changed');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Edit' })).toBeNull();
    expect((await getItem(usQuarter.id))?.design).toBe('Eagle');
  });
});
