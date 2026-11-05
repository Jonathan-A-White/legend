// About at a 390x844 phone: Settings' About row opens it, and it shows Newton's line with who said it and every credit of
// ATTRIBUTION.md (the file itself is read here), each credit's links with their addresses. Ends with a shot.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ viewport: { width: 390, height: 844 } });

const file = readFileSync('ATTRIBUTION.md', 'utf-8');
const links = [...file.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)].map((m) => ({ name: m[1], href: m[2] }));
const names = [...file.matchAll(/^- \*\*\[?([^\]*]+)/gm)].map((m) => m[1]);

test("Settings opens About, which shows Newton's line and every credit of ATTRIBUTION.md with its link", async ({ page }) => {
  await openUnlocked(page);
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  const open = page.getByRole('link', { name: 'Credits and sources' });
  await open.scrollIntoViewIfNeeded();
  expect((await open.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await open.click();

  await expect(page.getByRole('heading', { name: 'About Legend', level: 1 })).toBeVisible();
  await expect(page.getByText('standing on the shoulders of Giants')).toBeVisible();
  await expect(page.getByText('Isaac Newton, letter to Robert Hooke, 1675')).toBeVisible();

  const main = page.getByRole('main');
  expect(names.length).toBeGreaterThan(10);
  for (const name of names) await expect(main.getByText(name, { exact: false }).first(), name).toBeAttached();
  expect(links.length).toBeGreaterThan(30);
  for (const { name, href } of links) {
    await expect(main.locator(`a[href="${href}"]`).filter({ hasText: name }).first(), `${name} ${href}`).toBeAttached();
  }

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  await shot(page, 'about');

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
});
