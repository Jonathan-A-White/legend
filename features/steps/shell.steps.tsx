// features/steps/shell.steps.tsx: runs features/shell.feature: the bottom bar of the real App, driven by the address hash.
import '@testing-library/react/dont-cleanup-after-each';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, expect } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { openGate } from '../../tests/support/open-gate';

afterAll(cleanup);

const SCREENS = ['Collection', 'Globe', 'Quarters', 'Learn', 'Settings'];
const bar = () => screen.getByRole('navigation', { name: 'Screens' });

const feature = await loadFeature('features/shell.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('The bottom bar shows Collection, Globe, Quarters, Learn and Settings and the tapped one is active', ({ Given, Then, And, When }) => {
    Given('Legend is open on the Collection', async () => {
      cleanup();
      window.history.replaceState(null, '', '/#/collection');
      render(<App gate={openGate} />);
      await screen.findByRole('navigation', { name: 'Screens' });
    });

    Then('the bottom bar shows Collection, Globe, Quarters, Learn and Settings', () => {
      expect(within(bar()).getAllByRole('link').map((a) => a.textContent)).toEqual(SCREENS);
    });

    And('Collection is the active one', () => {
      expect(within(bar()).getByRole('link', { name: 'Collection' })).toHaveAttribute('aria-current', 'page');
      expect(bar().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    });

    When('they tap Globe', async () => {
      await userEvent.click(within(bar()).getByRole('link', { name: 'Globe' }));
    });

    Then('Globe is the active one', () => {
      expect(within(bar()).getByRole('link', { name: 'Globe' })).toHaveAttribute('aria-current', 'page');
      expect(within(bar()).getByRole('link', { name: 'Collection' })).not.toHaveAttribute('aria-current');
      expect(window.location.hash).toBe('#/globe');
    });

    And('the Globe screen says what it shows', () => {
      expect(screen.getByRole('heading', { name: 'Globe' })).toBeInTheDocument();
      expect(screen.getByText(/where your coins and notes come from/i)).toBeInTheDocument();
    });
  });
});
