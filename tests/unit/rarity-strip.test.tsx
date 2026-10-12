import '@testing-library/react/dont-cleanup-after-each';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/db';
import type { Mint, Mintages } from '../../src/data/us';
import { Strip, findRow, placeInSeries, seriesPool } from '../../src/rarity';

const table = JSON.parse(readFileSync('public/data/us/mintages.json', 'utf8')) as Mintages;
const mints = (JSON.parse(readFileSync('public/data/us/mints.json', 'utf8')) as { mints: Mint[] }).mints;
const denver1932 = { country: 'US', kind: 'coin', denomination: 'Quarter dollar', series: 'Washington quarter', year: 1932, mintMark: 'D' } as Item;

afterEach(cleanup);

describe('Strip', () => {
  const found = findRow(table, denver1932, null)!;
  const rows = seriesPool(table, found);
  const place = placeInSeries(table, found, mints)!;

  it('draws one bar per row of the series and mint, the coin\'s own marked', () => {
    render(<Strip rows={rows} mine={found.row} label={place.text} />);
    const svg = screen.getByRole('img');
    expect(svg.querySelectorAll('rect')).toHaveLength(rows.length);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.every((r) => r.mint === 'D')).toBe(true);
    const mine = svg.querySelectorAll('[data-mine]');
    expect(mine).toHaveLength(1);
    expect(mine[0].getAttribute('data-year')).toBe('1932');
  });

  it('carries the place sentence as its aria-label', () => {
    render(<Strip rows={rows} mine={found.row} label={place.text} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', place.text);
    expect(place.text).toMatch(/^the fewest of the \d+ years Denver struck Washington quarters$/);
  });

  it('makes the fewest struck the shortest bar and a bigger run taller', () => {
    render(<Strip rows={rows} mine={found.row} label={place.text} />);
    const heights = [...screen.getByRole('img').querySelectorAll('rect')].map((r) => Number(r.getAttribute('height')));
    const mineHeight = Number(screen.getByRole('img').querySelector('[data-mine]')!.getAttribute('height'));
    expect(mineHeight).toBe(Math.min(...heights));
    expect(Math.max(...heights)).toBeGreaterThan(mineHeight);
  });
});
