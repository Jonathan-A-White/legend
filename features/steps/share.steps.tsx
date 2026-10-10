// features/steps/share.steps.tsx: runs features/share.feature against the real App. The pictures are drawn on a fake context
// (tests/support/fake-picture.ts), so a step reads exactly what was written on them; the share sheet is a spy on navigator.share.
import '@testing-library/react/dont-cleanup-after-each';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Blob as NodeBlob } from 'node:buffer';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { openGate } from '../../tests/support/open-gate';
import { db } from '../../src/data/db';
import { addItem, addPhoto } from '../../src/data/repositories';
import { forgetWorldData } from '../../src/data/world';
import { clearBus } from '../../src/events/bus';
import { DEFAULT_PALETTE } from '../../src/globe/palette';
import { forgetGlobeView } from '../../src/globe/view';
import { writeSetting } from '../../src/settings/registry';
import { serveReferenceData } from '../../tests/support/collection-fixtures';
import { FakePictureContext, installPictureCanvas } from '../../tests/support/fake-picture';
import { ManualClock } from '../../tests/support/manual-clock';

const SIZE = { width: 390, height: 600 };
const clock = new ManualClock();
const ctx = new FakePictureContext();
const share = vi.fn<(data: ShareData) => Promise<void>>();
let canvas: ReturnType<typeof installPictureCanvas>;
let itemId = '';
const original = { rect: HTMLCanvasElement.prototype.getBoundingClientRect };

beforeAll(() => {
  canvas = installPictureCanvas(ctx);
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: SIZE.width, bottom: SIZE.height, ...SIZE, toJSON: () => ({}) }) as DOMRect;
  serveReferenceData((name, fake) => vi.stubGlobal(name, fake));
  vi.stubGlobal('createImageBitmap', async () => ({ width: 800, height: 600, close: () => undefined }));
  let n = 0;
  URL.createObjectURL = () => `blob:share/${++n}`;
  URL.revokeObjectURL = () => undefined;
  clock.install();
});
afterAll(() => {
  cleanup();
  clock.restore();
  canvas.restore();
  HTMLCanvasElement.prototype.getBoundingClientRect = original.rect;
  vi.unstubAllGlobals();
  db.close();
});

const bytes = () => new NodeBlob(['jpeg'], { type: 'image/jpeg' }) as unknown as Blob;

async function startOver(): Promise<void> {
  cleanup();
  clearBus();
  forgetWorldData();
  forgetGlobeView();
  ctx.reset();
  canvas.cuts.length = 0;
  share.mockReset();
  share.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  await db.open();
  await Promise.all(db.tables.map((t) => t.clear()));
}

async function open(hash: string): Promise<void> {
  cleanup();
  window.history.replaceState(null, '', `/${hash}`);
  render(<App gate={openGate} />);
  await screen.findByRole('main');
  await waitFor(() => {
    act(() => clock.advance(16));
    expect(screen.queryByText(/Loading/)).toBeNull();
  });
}

const sentFile = (): File => {
  expect(share).toHaveBeenCalledTimes(1);
  const data = share.mock.calls[0][0];
  expect(data.files).toHaveLength(1);
  return data.files![0];
};

/** Lets the settings load (they arrive after the first paint), so that finding no button means it was held back. */
const settled = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 100))));

const feature = await loadFeature('features/share.feature');

describeFeature(feature, ({ Scenario }) => {
  const twoCountries = async () => {
    await startOver();
    await addItem({ kind: 'coin', country: 'DE', denomination: '2 euro', year: 2002, status: 'confirmed' });
    await addItem({ kind: 'coin', country: 'DE', denomination: '1 Deutsche Mark', year: 1990, status: 'confirmed' });
    await addItem({ kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1999, status: 'confirmed' });
  };
  const aQuarter = async () => {
    await startOver();
    const item = await addItem({
      kind: 'coin', country: 'US', denomination: 'Quarter dollar', year: 1964, mintMark: 'D', series: 'Washington quarter 12345678', design: 'Eagle',
      inscription: 'IN GOD WE TRUST', gradeGuess: 'VF', notes: 'Grandpa gave me this one', tags: ['grandpa-silver'], status: 'confirmed',
    });
    itemId = item.id;
    for (const side of ['obverse', 'reverse'] as const) await addPhoto({ itemId, side, blob: bytes(), thumb: bytes(), width: 800, height: 600 });
  };
  const globeOpen = () => open('#/globe');
  const tapShare = async () => {
    ctx.reset();
    await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
    await waitFor(() => expect(share.mock.calls.length + screen.queryAllByRole('link', { name: 'Save picture' }).length).toBeGreaterThan(0));
  };

  Scenario('Share on the globe makes a picture with the lit countries and the caption and offers the share sheet', ({ Given, And, When, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', twoCountries);
    And('his name is Paul', () => writeSetting('ownerName', 'Paul'));
    And('the globe is open', globeOpen);
    When('he taps Share on the globe', tapShare);
    Then('the share sheet is offered one JPEG picture of 1080 by 1080', () => {
      const file = sentFile();
      expect(file.type).toBe('image/jpeg');
      expect(file.name).toMatch(/\.jpg$/);
      expect(canvas.cuts.at(-1)).toEqual({ width: 1080, height: 1080, type: 'image/jpeg' });
    });
    And("the picture shows the lit countries and says Paul's coins come from 2 countries", () => {
      expect(ctx.paints.filter((p) => p.op === 'fill' && p.style === DEFAULT_PALETTE.lit).length).toBeGreaterThanOrEqual(2);
      expect(ctx.texts).toContain("Paul's coins come from 2 countries");
    });
  });

  Scenario('Share on an item makes a card with both photos and the facts and no notes', ({ Given, And, When, Then }) => {
    Given('he has a quarter with both photos, a note, a tag and a serial number in its series', aQuarter);
    And('that item is open', () => open(`#/item/${itemId}`));
    When('he taps Share on the item', tapShare);
    Then('the share sheet is offered one JPEG picture of 1080 by 1350', () => {
      expect(sentFile().type).toBe('image/jpeg');
      expect(canvas.cuts.at(-1)).toEqual({ width: 1080, height: 1350, type: 'image/jpeg' });
    });
    And('the card shows both photos and the denomination, year, country, mint, series, design, grade guess and inscription', () => {
      expect(ctx.images).toBe(2);
      const written = ctx.texts.join('\n');
      for (const part of ['Quarter dollar, 1964', 'United States', 'D · Denver', 'Eagle', 'VF · guess', 'IN GOD WE TRUST']) expect(written).toContain(part);
    });
    And('the card shows no note, no tag and no run of eight digits', () => {
      const written = ctx.texts.join('\n');
      expect(written).not.toMatch(/Grandpa|grandpa/);
      expect(written).not.toMatch(/\d{8,}/);
    });
  });

  Scenario('without navigator.share a Save picture link appears', ({ Given, And, When, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', twoCountries);
    And('the phone has no share sheet', () => void Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }));
    And('the globe is open', globeOpen);
    When('he taps Share on the globe', tapShare);
    Then('a Save picture link appears for the picture', () => {
      const link = screen.getByRole('link', { name: 'Save picture' });
      expect(link).toHaveAttribute('href', expect.stringMatching(/^blob:/));
      expect(link).toHaveAttribute('download', expect.stringMatching(/\.jpg$/));
      expect(share).not.toHaveBeenCalled();
    });
  });

  Scenario('Sharing off hides both buttons', ({ Given, And, When, Then }) => {
    Given('he has a quarter with both photos, a note, a tag and a serial number in its series', aQuarter);
    And('Sharing is turned off in Settings', () => writeSetting('sharing', false));
    When('the globe is open', globeOpen);
    Then('there is no Share button on the globe', async () => {
      await screen.findByRole('button', { name: /^Not yet/ });
      await settled();
      expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    });
    When('that item is open', () => open(`#/item/${itemId}`));
    Then('there is no Share button on the item', async () => {
      await screen.findByRole('button', { name: 'Edit' });
      await settled();
      expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    });
  });

  Scenario('The first time, a short line says what leaves the phone', ({ Given, And, When, Then }) => {
    Given('he has 2 coins from Germany and 1 from the United States', twoCountries);
    And('the globe is open', globeOpen);
    Then('under Share it says Only this picture leaves the phone.', async () => {
      expect(await screen.findByText('Only this picture leaves the phone.')).toBeInTheDocument();
    });
    When('he taps Share on the globe', tapShare);
    Then('the line is gone', async () => {
      await waitFor(() => expect(screen.queryByText('Only this picture leaves the phone.')).toBeNull());
    });
  });
});
