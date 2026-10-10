// tests/e2e/gate.spec.ts: the Unlock screen at a 390x844 phone: a seeded key shows its public key, with Copy and Check
// again in reach, and the page does not scroll. The chain is refused, so the gate answers "Can't reach the chain".
import { expect, test } from '@playwright/test';
import { refuseChain, SEED_PUBLIC_KEY, seedDeviceKey } from './unlocked';
import { shot } from './shot';

test('a seeded key shows its public key on Unlock', async ({ page }) => {
  await refuseChain(page);
  await seedDeviceKey(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Unlock' })).toBeVisible();
  await expect(page.getByTestId('device-key')).toHaveText(SEED_PUBLIC_KEY);
  await expect(page.getByText('Can’t reach the chain')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Screens' })).toHaveCount(0);

  for (const name of ['Copy', 'Check again']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
  }
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(scrolls).toBe(false);
  await shot(page, 'unlock');
});
