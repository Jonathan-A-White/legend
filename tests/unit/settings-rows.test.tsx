// The rows of Settings (src/settings/rows.ts): the screen draws exactly those rows, each with the control of its kind.
// A Builder adding a setting adds one registry entry and nothing else; this test fails until the screen draws it.
import '@testing-library/react/dont-cleanup-after-each';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/data/db';
import { clearBus } from '../../src/events/bus';
import { writeSetting } from '../../src/settings/registry';
import { ROWS, SECTIONS, visibleRows } from '../../src/settings/rows';
import { SettingsScreen } from '../../src/settings/SettingsScreen';

afterAll(() => {
  cleanup();
  db.close();
});

beforeEach(async () => {
  cleanup();
  clearBus();
  await db.open();
  await db.settings.clear();
});

describe('the rows', () => {
  it('gives every row a distinct key, a name, a one-line hint and a section', () => {
    expect(new Set(ROWS.map((r) => r.key)).size).toBe(ROWS.length);
    const sections = SECTIONS.map((s) => s.id);
    for (const row of ROWS) {
      expect(row.label, row.key).not.toBe('');
      expect(row.hint.length, row.key).toBeGreaterThan(0);
      expect(row.hint.length, `${row.key}'s hint is one line`).toBeLessThanOrEqual(90);
      expect(sections, row.key).toContain(row.section);
    }
    expect(SECTIONS.map((s) => s.title)).toEqual(['Appearance', 'Collection', 'Photos', 'Tutor', 'Privacy', 'About']);
  });
});

describe('the Settings screen', () => {
  it('draws every row that is shown, in its section, and none that is hidden', async () => {
    render(<SettingsScreen />);
    await screen.findByRole('heading', { name: 'Appearance' });
    // wait for the stored values to load: the defaults show the rows whose parents are at their defaults
    await waitFor(() => expect(document.querySelector('[data-setting="theme"]')).not.toBeNull());
    const shown = visibleRows({});
    for (const row of ROWS) {
      const drawn = document.querySelector(`[data-setting="${row.key}"]`);
      if (shown.includes(row)) {
        expect(drawn, `${row.key} is drawn`).not.toBeNull();
        const section = SECTIONS.find((s) => s.id === row.section);
        expect(drawn?.closest('section')?.getAttribute('aria-label'), row.key).toBe(section?.title);
        expect(within(drawn as HTMLElement).getByText(row.hint), row.key).toBeInTheDocument();
      } else {
        expect(drawn, `${row.key} is hidden`).toBeNull();
      }
    }
  });

  it('draws the rows a parent hides once the parent changes', async () => {
    await writeSetting('keepOriginals', true);
    render(<SettingsScreen />);
    await waitFor(() => expect(document.querySelector('[data-setting="keepOriginals"]')).not.toBeNull());
    expect(document.querySelector('[data-setting="sizeCap"]')).toBeNull();
    for (const row of ROWS.filter((r) => r.dependsOn)) {
      await writeSetting(row.dependsOn!.key, row.dependsOn!.equals);
      await waitFor(() => expect(document.querySelector(`[data-setting="${row.key}"]`), row.key).not.toBeNull());
    }
  });

  it('uses a switch for an on/off row, never a raw checkbox', async () => {
    render(<SettingsScreen />);
    await screen.findByRole('switch', { name: 'Show values' });
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });
});
