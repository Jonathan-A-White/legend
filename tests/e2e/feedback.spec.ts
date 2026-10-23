// Tell the maker at phone width: the '…' on the Globe bar opens the sheet, Something's wrong and his words go as one feedback grist
// naming the Globe, and the sheet thanks him. Shots of the sheet being written (its Composer under the box) and of the sent sheet. The mill is a fake Postern in this process.
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
  // the Composer in the voice slot: a hold bar and Type it here, both thumb-sized, and nothing past the sheet's edge
  const hold = await sheet.getByRole('button', { name: 'Hold to talk' }).boundingBox();
  expect(hold?.height ?? 0).toBeGreaterThanOrEqual(56);
  expect((hold?.x ?? 0) + (hold?.width ?? 0)).toBeLessThanOrEqual(390);
  expect((await sheet.getByRole('button', { name: 'Type it here' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shot(page, 'feedback-edit');
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
  await expect(tip).toContainText('Drag to turn, pinch to zoom, tap a lit country');
  await tip.getByRole('button', { name: 'Got it' }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Globe', level: 1 })).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);
});

test('Let the tutor do it opens a panel under the fields, fills the message, and leaves both Sends on the screen', async ({ page }) => {
  const fake = makeFakePostern();
  fake.kindReplies.feedback = { status: 'answered', answer: { status: 'sent' } };
  fake.kindReplies['legend-ask'] = {
    status: 'answered',
    answer: {
      answer: 'Everything is filled in.',
      followUps: [],
      settingsChanges: [],
      teachMore: null,
      form_values: [{ field: 'message', value: 'A place for notes about where I found a coin' }],
    },
  };
  await routePostern(page, fake);
  await openUnlocked(page);
  await page.goto('/#/globe');
  await page.getByRole('button', { name: 'Tell the maker' }).click();
  const sheet = page.getByRole('dialog', { name: 'Tell the maker' });
  const door = sheet.getByRole('button', { name: 'Let the tutor do it' });
  expect((await door.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shot(page, 'feedback-door');
  await door.click();

  const panel = sheet.getByRole('region', { name: 'The tutor is helping with this form' });
  await expect(panel.getByText('Everything is filled in.')).toBeVisible();
  await expect(sheet.getByRole('textbox', { name: 'Your message' })).toHaveValue('A place for notes about where I found a coin');
  const send = await panel.getByRole('button', { name: 'Send Tell the maker' }).boundingBox();
  expect(send?.height ?? 0).toBeGreaterThanOrEqual(56);
  expect((send?.y ?? 0) + (send?.height ?? 0)).toBeLessThanOrEqual(844);
  const own = await sheet.getByRole('button', { name: 'Send', exact: true }).boundingBox();
  expect((own?.y ?? 0) + (own?.height ?? 0)).toBeLessThanOrEqual(844);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  await shot(page, 'feedback-door-open');
  expect(fake.received.map((g) => g.grist.kind)).toEqual(['legend-ask']);

  await panel.getByRole('button', { name: 'Send Tell the maker' }).click();
  await expect(sheet.getByText('Sent, thank you: the factory reads these')).toBeVisible();
  expect(fake.received.map((g) => g.grist.kind)).toEqual(['legend-ask', 'feedback']);
});
