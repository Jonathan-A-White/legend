// tests/e2e/settings.spec.ts: the shell and Settings at a 390x844 phone: the bottom bar is in reach with large targets, the
// page does not scroll, a choice taps through, and the screen survives a reload on the same place.
import { expect, test } from '@playwright/test';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test('Settings sits above a bottom bar of five large targets, and a choice sticks', async ({ page }) => {
  await openUnlocked(page);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  const bar = page.getByRole('navigation', { name: 'Screens' });
  const links = bar.getByRole('link');
  await expect(links).toHaveCount(5);
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(56);
    expect(box?.width).toBeGreaterThanOrEqual(60);
  }
  await expect(bar.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' }).click();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

  const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(pageScrolls).toBe(false);
  await shot(page, 'settings');
});

test('a bare open reopens the screen they left', async ({ page }) => {
  await openUnlocked(page);
  await page.goto('/#/globe');
  await expect(page.getByRole('heading', { name: 'Globe' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Globe' })).toBeVisible();
});
