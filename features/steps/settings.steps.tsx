// features/steps/settings.steps.tsx: runs features/settings.feature: the Settings screen draws the registry, a tap writes
// and announces, and the tutor's door takes only the settings marked for it.
import '@testing-library/react/dont-cleanup-after-each';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { db } from '../../src/data/db';
import { clearBus, subscribe } from '../../src/events/bus';
import { applyChanges, currentSettings } from '../../src/settings/registry';
import { ROWS, SECTIONS, visibleRows } from '../../src/settings/rows';
import { SettingsScreen } from '../../src/settings/SettingsScreen';

afterAll(() => {
  cleanup();
  db.close();
});

const feature = await loadFeature('features/settings.feature');

describeFeature(
  feature,
  ({ Scenario, BeforeEachScenario }) => {
    let heard = vi.fn();
    let result: Awaited<ReturnType<typeof applyChanges>>;

    BeforeEachScenario(async () => {
      cleanup();
      clearBus();
      heard = vi.fn();
      await db.open();
      await db.settings.clear();
    });

    const open = async () => {
      render(<SettingsScreen />);
      await waitFor(() => expect(document.querySelector('[data-setting="theme"]')).not.toBeNull());
    };

    Scenario('Every registered row is drawn in its section', ({ Given, Then }) => {
      Given('the Settings screen is open', open);

      Then('every registered row is drawn in its section', () => {
        const shown = visibleRows({});
        expect(shown.length).toBeGreaterThan(5);
        for (const row of shown) {
          const section = screen.getByRole('region', { name: SECTIONS.find((s) => s.id === row.section)?.title });
          expect(section.querySelector(`[data-setting="${row.key}"]`), row.key).not.toBeNull();
        }
        expect(ROWS.length).toBeGreaterThanOrEqual(shown.length);
      });
    });

    Scenario('Changing a row writes the setting and the change is announced on the bus', ({ Given, And, When, Then }) => {
      Given('the Settings screen is open', open);

      And('something is listening to settings changes on the bus', () => {
        subscribe('settings.changed', heard);
      });

      When('they choose Dark for Theme', async () => {
        const theme = document.querySelector('[data-setting="theme"]') as HTMLElement;
        await userEvent.click(within(theme).getByRole('radio', { name: 'Dark' }));
      });

      Then('the theme setting is saved as dark', async () => {
        await waitFor(async () => expect((await db.settings.get('theme'))?.value).toBe('dark'));
      });

      And('the bus was told that theme changed from system to dark', () => {
        expect(heard).toHaveBeenCalledExactlyOnceWith({ kind: 'settings.changed', key: 'theme', value: 'dark', previous: 'system' });
      });
    });

    Scenario('A talkable setting is marked so the tutor may change it', ({ Given, And, When, Then }) => {
      Given('the Settings screen is open', open);

      Then('the Theme row is marked as one the tutor may change', () => {
        expect(document.querySelector('[data-setting="theme"]')).toHaveAttribute('data-talkable', 'true');
      });

      And('the Sharing row is not', () => {
        expect(document.querySelector('[data-setting="sharing"]')).toHaveAttribute('data-talkable', 'false');
      });

      When('the tutor asks to change both', async () => {
        result = await applyChanges([
          { key: 'theme', value: 'light' },
          { key: 'sharing', value: true },
        ]);
      });

      Then('only the theme is changed', async () => {
        expect(result.applied.map((c) => c.key)).toEqual(['theme']);
        expect(result.refused).toHaveLength(1);
        const now = await currentSettings();
        expect(now.theme).toBe('light');
        expect(now.sharing).toBe(true);
      });
    });
  },
);
