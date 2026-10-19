// tests/e2e/add-folder.spec.ts: Add a coin from a coin folder at a 390x844 phone with a fake camera: the folder's page offers Add a coin,
// the camera takes Front and Back, Name it, Close, and the new piece is in the folder (and the camera from the Collection puts nothing in one).
import { expect, test } from '@playwright/test';
import { fakeCamera } from './camera';
import { shot } from './shot';
import { openUnlocked } from './unlocked';

test.use({ colorScheme: 'dark' });

test('Add a coin on a coin folder takes both sides and the coin is in the folder', async ({ page }) => {
  await openUnlocked(page);
  await fakeCamera(page);
  // the factory never answers: the coin waits in the Collection, which is all this spec needs
  await page.addInitScript(() => {
    (window as unknown as { __legendGrist: unknown }).__legendGrist = { sendGrist: async () => 'direct:e2e', awaitAnswer: () => new Promise(() => undefined) };
  });
  await page.goto('/#/collection');
  await page.getByRole('button', { name: 'New coin folder' }).click();
  await page.getByRole('textbox', { name: 'Coin folder name' }).fill('State quarters');
  await page.getByRole('button', { name: 'Make coin folder' }).click();
  await page.getByRole('link', { name: /State quarters/ }).click();
  await expect(page.getByRole('heading', { name: 'State quarters' })).toBeVisible();
  await expect(page.getByTestId('folder-count')).toHaveText('0 pieces');

  const add = page.getByRole('link', { name: 'Add a coin', exact: true });
  const box = await add.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await shot(page, 'folder-add-a-coin');
  await add.click();

  const prompt = page.getByTestId('prompt');
  const shutter = page.getByRole('button', { name: 'Take photo' });
  await expect(prompt).toHaveText('Front');
  await expect(shutter).toBeEnabled();
  // a coin put in a folder is for his collection: the Just looking switch is not offered
  await expect(page.getByRole('radiogroup', { name: 'What to do with it' })).toHaveCount(0);
  await shutter.click();
  await expect(prompt).toHaveText('Back');
  await shutter.click();
  await expect(page.getByRole('list', { name: 'Photos taken' }).getByRole('button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Name it' }).click();
  await expect(prompt).toHaveText('Front');
  await expect(page.getByText('1 at the factory')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('heading', { name: 'State quarters' })).toBeVisible();
  await expect(page.getByTestId('folder-count')).toHaveText('1 piece');
  await expect(page.getByRole('list', { name: 'Your collection' }).getByRole('listitem')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await shot(page, 'folder-coin-added');

  // the camera from the Collection puts nothing in a folder
  await page.getByRole('link', { name: /Collection/ }).first().click();
  await page.getByRole('link', { name: 'Add a coin or bill' }).click();
  await expect(shutter).toBeEnabled();
  await expect(page.getByRole('radiogroup', { name: 'What to do with it' })).toBeVisible();
  await shutter.click();
  await page.getByRole('button', { name: 'Name it' }).click();
  await expect(page.getByText('1 at the factory')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('link', { name: /State quarters/ }).click();
  await expect(page.getByTestId('folder-count')).toHaveText('1 piece');
});
