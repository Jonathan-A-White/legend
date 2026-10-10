// tests/e2e/unlocked.ts: gets a page past the licence gate without the network: the device key is the test seam
// (docs/testing.md), the held memory is the offline grace's own record, and every chain lookup is refused, so the gate
// falls back to that memory. The gate itself is unchanged. Every spec except gate.spec.ts starts with openUnlocked(page).
import type { Page } from '@playwright/test';

/** The private key 1 and its public key: the well-known generator point. */
export const SEED_PRIVATE_KEY = '0'.repeat(63) + '1';
export const SEED_PUBLIC_KEY = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

export async function refuseChain(page: Page): Promise<void> {
  await page.route(/whatsonchain\.com/, (route) => route.abort());
}

export async function seedDeviceKey(page: Page, privateKeyHex: string = SEED_PRIVATE_KEY): Promise<void> {
  await page.addInitScript((hex) => window.localStorage.setItem('legend.deviceKey', hex), privateKeyHex);
}

/** Past the gate: the seeded key, remembered as holding a licence a minute ago, the chain unreachable. */
export async function openUnlocked(page: Page): Promise<void> {
  await refuseChain(page);
  await seedDeviceKey(page);
  await page.addInitScript(
    ([publicKeyHex, at]) => window.localStorage.setItem('legend.licenceHeld', JSON.stringify({ publicKeyHex, at })),
    [SEED_PUBLIC_KEY, Date.now() - 60_000] as const,
  );
}
