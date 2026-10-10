// tests/e2e/home.spec.ts: the home screen at a 390x844 phone: the name, the build stamp, no page scroll, and the shot.
import { expect, test } from '@playwright/test';
import { shot } from './shot';

test('the home screen names the app and the build, and the page does not scroll', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Legend' })).toBeVisible();
  await expect(page.getByTestId('build-version')).toHaveText(/^v0\.\d+\.\d+ · \d{4}-\d{2}-\d{2} \d{2}:\d{2}Z · \S+$/);
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(scrolls).toBe(false);
  await shot(page, 'home');
});
