// tests/e2e/gate.spec.ts: the Unlock screen at a 390x844 phone: a seeded key shows its public key as a QR code and as text, with Copy and Check
// again in reach, and the page does not scroll. The chain is refused, so the gate answers "Can't reach the chain".
import { expect, test } from '@playwright/test';
import { refuseChain, SEED_PUBLIC_KEY, seedDeviceKey } from './unlocked';
import { shot } from './shot';

test.use({ viewport: { width: 390, height: 844 } });

test('a seeded key shows its public key on Unlock', async ({ page }) => {
  await refuseChain(page);
  await seedDeviceKey(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Unlock' })).toBeVisible();
  await expect(page.getByTestId('device-key')).toHaveText(SEED_PUBLIC_KEY);
  await expect(page.getByText('Can’t reach the chain')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Screens' })).toHaveCount(0);

  // the QR, the key text and Copy are all inside the phone's screen at once, and the QR is big enough to scan
  const qr = await page.getByRole('img', { name: 'This phone’s key as a QR code' }).boundingBox();
  const text = await page.getByTestId('device-key').boundingBox();
  const copy = await page.getByRole('button', { name: 'Copy' }).boundingBox();
  expect(qr?.width).toBeGreaterThanOrEqual(192);
  expect(qr?.height).toBeGreaterThanOrEqual(192);
  for (const box of [qr, text, copy]) {
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
  }
  expect((qr?.y ?? 0) + (qr?.height ?? 0)).toBeLessThanOrEqual(text?.y ?? 0);

  for (const name of ['Copy', 'Check again']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
  }
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  expect(scrolls).toBe(false);
  await shot(page, 'unlock');
});
