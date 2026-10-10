// tests/support/playwright-postern.ts — answers the browser's calls to Postern from a FakePostern in the test's
// own process, so an e2e spec runs the app's real signing and sealing against a mill that opens and answers the grist.
import type { Page } from '@playwright/test';
import { POSTERN_ORIGIN, type FakePostern } from './fake-postern';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

export async function routePostern(page: Page, fake: FakePostern): Promise<void> {
  await page.route(`${POSTERN_ORIGIN}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const reply = await fake.fetch(request.url(), { method: request.method(), headers: request.headers(), body: (request.postDataBuffer() ?? undefined) as BodyInit | undefined });
    return route.fulfill({ status: reply.status, headers: { ...CORS, 'content-type': 'application/json' }, body: await reply.text() });
  });
}
