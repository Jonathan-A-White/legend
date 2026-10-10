// Tell the maker at phone width: the '…' on the Globe bar opens the sheet, Something's wrong and his words go as one feedback grist
// naming the Globe, and the sheet thanks him. Ends with a shot of the sent sheet. The mill is a fake Postern in this process.
import { expect, test } from '@playwright/test';
import { makeFakePostern } from '../support/fake-postern';
import { routePostern } from '../support/playwright-postern';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ viewport: { width: 390, height: 844 } });

test('Something is wrong from the Globe sends one feedback grist and thanks him', async ({ page }) => {
  const fake = makeFakePostern();
  fake.kindReplies.feedback = { status: 'answered', answer: { status: 'sent' } };
  await routePostern(page, fake);
  await openUnlocked(page);
  await page.goto('/#/globe');
  await expect(page.getByRole('heading', { name: 'Globe', level: 1 })).toBeVisible();

  const open = page.getByRole('button', { name: 'Tell the maker' });
  const bar = await open.boundingBox();
  expect(bar?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(bar?.height ?? 0).toBeGreaterThanOrEqual(44);
  await open.click();

  const sheet = page.getByRole('dialog', { name: 'Tell the maker' });
  await expect(sheet).toBeVisible();
  for (const name of ["Can I add this?", "Something's wrong"]) {
    const entry = await sheet.getByRole('radio', { name }).boundingBox();
    expect(entry?.height ?? 0).toBeGreaterThanOrEqual(56);
    expect((entry?.x ?? 0) + (entry?.width ?? 0)).toBeLessThanOrEqual(390);
  }
  await expect(sheet.getByRole('button', { name: 'Send' })).toBeDisabled();
  await sheet.getByRole('radio', { name: "Something's wrong" }).click();
  await sheet.getByRole('textbox', { name: 'Your message' }).fill('Brazil does not light up');
  await sheet.getByRole('button', { name: 'Send' }).click();

  await expect(sheet.getByRole('status')).toHaveText('Sent, thank you: the factory reads these');
  expect(fake.received.map((g) => g.grist.kind)).toEqual(['feedback']);
  expect(fake.received[0].input).toMatchObject({ kind: 'wrong', screen: 'Globe', text: 'Brazil does not light up' });
  expect(fake.received[0].attachments).toEqual([]);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  await shot(page, 'feedback');
});

test('the globe tip shows once', async ({ page }) => {
  await openUnlocked(page);
  await page.goto('/#/globe');
  const tip = page.getByRole('note');
  await expect(tip).toContainText('Drag to turn, tap a lit country');
  await tip.getByRole('button', { name: 'Got it' }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Globe', level: 1 })).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);
});
