// features/steps/add.steps.tsx: runs features/add.feature against the real App behind an open gate, a fake camera and canvas
// (tests/support/fake-camera.ts), bsv-kit/grist's two calls in a test's hands (tests/support/fake-grist.ts) and a seeded Dexie.
import '@testing-library/react/dont-cleanup-after-each';
import { Blob as NodeBlob } from 'node:buffer';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, expect, vi } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { App } from '../../src/App';
import { db, type Item, type Photo } from '../../src/data/db';
import { addItemWithPhotos } from '../../src/data/repositories';
import { latest, clearBus } from '../../src/events/bus';
import { getDeviceKeyBytes } from '../../src/services/deviceKey';
import { setGristPort } from '../../src/services/nameItem';
import { nameQueue } from '../../src/services/nameQueue';
import { seedCollection, serveReferenceData } from '../../tests/support/collection-fixtures';
import { installFakeCamera, type FakeCamera } from '../../tests/support/fake-camera';
import { answered, deferred, fakeGrist, refused, type FakeGrist } from '../../tests/support/fake-grist';
import { quarterAnswer } from '../../tests/support/coin-answers';
import { openGate } from '../../tests/support/open-gate';

beforeAll(() => {
  serveReferenceData((name, fake) => vi.stubGlobal(name, fake));
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => undefined;
});
afterAll(() => {
  cleanup();
  db.close();
});

const feature = await loadFeature('features/add.feature');

let camera: FakeCamera;
let factory: FakeGrist;
/** what the store held at each moment a grist was sent */
let atSend: { items: Item[]; photos: Photo[] }[];

const allItems = () => db.items.toArray();
const onlyItem = async (): Promise<Item> => {
  const items = await allItems();
  expect(items).toHaveLength(1);
  return items[0];
};
const shutter = () => screen.getByRole('button', { name: 'Take photo' });
const prompt = () => screen.getByTestId('prompt');
const nameIt = () => screen.getByRole('button', { name: 'Name it' });
const sheet = () => screen.getByRole('dialog', { name: 'Confirm' });

const quarter = (year = 1944) => ({ ...quarterAnswer(), year });

async function openAdd(): Promise<void> {
  cleanup();
  window.history.replaceState(null, '', '/#/add');
  render(<App gate={openGate} />);
  await screen.findByTestId('prompt');
  await waitFor(() => expect(shutter()).toBeEnabled());
}

async function takeBoth(): Promise<void> {
  await userEvent.click(shutter());
  await waitFor(() => expect(prompt()).toHaveTextContent('Back'));
  camera.video.height = 600;
  await userEvent.click(shutter());
  await waitFor(() => expect(screen.getAllByRole('button', { name: /^Retake/ })).toHaveLength(2));
}

async function nameOne(): Promise<void> {
  await userEvent.click(nameIt());
  await waitFor(() => expect(prompt()).toHaveTextContent('Front'));
  camera.video.height = 720;
}

const cameraOpen = async () => {
  factory.onSend(async (_params, n) => {
    atSend.push({ items: await db.items.toArray(), photos: await db.photos.toArray() });
    return `direct:tx${n}`;
  });
  await openAdd();
};
const willName = async () => {
  factory.onAnswer(async () => answered(quarter()));
  await cameraOpen();
};
const openToCheck = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Check it/ }));
  await screen.findByRole('dialog', { name: 'Confirm' });
};
const itemWhere = async (check: (item: Item) => boolean): Promise<Item> => {
  let found: Item | undefined;
  await waitFor(async () => {
    found = (await allItems()).find(check);
    expect(found).toBeDefined();
  });
  return found!;
};

/** A coin he is only looking at, already named, with its two photos. */
async function seedConsidering(): Promise<Item> {
  const bytes = (n: number) => new NodeBlob([new Uint8Array(n)], { type: 'image/jpeg' }) as unknown as Blob;
  return addItemWithPhotos(
    { kind: 'coin', status: 'considering', country: 'US', currency: 'USD', denomination: 'Quarter dollar', year: 1964, mintMark: 'D', series: 'Washington quarter', funFact: 'Silver until 1964.' },
    [
      { side: 'obverse', blob: bytes(12), thumb: bytes(4), width: 800, height: 800 },
      { side: 'reverse', blob: bytes(12), thumb: bytes(4), width: 800, height: 800 },
    ],
  );
}

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  BeforeEachScenario(async () => {
    cleanup();
    clearBus();
    vi.useRealTimers();
    await db.open();
    await Promise.all(db.tables.map((t) => t.clear()));
    camera = installFakeCamera();
    factory = fakeGrist();
    atSend = [];
    setGristPort(factory.port);
    nameQueue.stop();
    nameQueue.configure({ backoffBaseMs: 30, backoffMaxMs: 60 });
  });
  AfterEachScenario(() => {
    cleanup();
    nameQueue.stop();
    setGristPort(null);
    camera.restore();
  });

  Scenario('two photos are taken, stored under 1 MB each with a thumbnail, and the item is pending before anything is sent', ({ Given, When, And, Then }) => {
    Given('the camera is open on Add and the factory has not answered', cameraOpen);
    When('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    Then('the item is stored as pending with two photos under 1 MB each and a thumbnail each', async () => {
      await waitFor(() => expect(atSend).toHaveLength(1));
      const [seen] = atSend;
      expect(seen.items).toHaveLength(1);
      expect(seen.items[0]).toMatchObject({ status: 'pending', kind: 'coin', reading: { state: 'waiting', txid: null } });
      expect(seen.photos.map((p) => p.side).sort()).toEqual(['obverse', 'reverse']);
      for (const photo of seen.photos) {
        expect(photo.itemId).toBe(seen.items[0].id);
        expect(photo.blob.size).toBeGreaterThan(0);
        expect(photo.blob.size).toBeLessThan(1_000_000);
        expect(photo.thumb.size).toBeGreaterThan(0);
        expect(photo.thumb.size).toBeLessThan(photo.blob.size);
      }
    });
  });

  Scenario('a gallery photo is accepted and downscaled', ({ Given, When, Then, And }) => {
    Given('the camera is open on Add and the factory has not answered', cameraOpen);
    When('he chooses a 4000 by 3000 photo from his gallery', async () => {
      const file = new File(['x'], 'coin.jpg', { type: 'image/jpeg' });
      await userEvent.upload(screen.getByTestId('gallery-input'), file);
      await waitFor(() => expect(screen.getAllByRole('button', { name: /^Retake/ })).toHaveLength(1));
    });
    Then('the Front photo is kept at 1600 by 1200 under 1 MB with a thumbnail of 320 pixels', () => {
      const main = camera.encodes.find((e) => e.width === 1600 && e.height === 1200 && e.size < 1_000_000);
      expect(main).toBeDefined();
      // the first tries were over 1 MB, so lower qualities were used
      expect(camera.encodes[0].size).toBeGreaterThan(1_000_000);
      expect(camera.encodes[camera.encodes.length - 1]).toMatchObject({ width: 320, height: 240, type: 'image/jpeg' });
    });
    And('the prompt now reads Back', () => {
      expect(prompt()).toHaveTextContent('Back');
    });
  });

  Scenario('the grist is sent with kind coin-from-photos, the device key and the photos in order, and the pending item keeps the txid', ({ Given, When, And, Then }) => {
    Given('the camera is open on Add and the factory has not answered', cameraOpen);
    When('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    Then('the grist is sent as app legend, kind coin-from-photos, with the device key and the two photos in order', async () => {
      await waitFor(() => expect(factory.sent).toHaveLength(1));
      const [sent] = factory.sent;
      expect(sent).toMatchObject({ app: 'legend', kind: 'coin-from-photos', v: '1.0', input: { kind: 'coin', hint: null, sides: ['obverse', 'reverse'] } });
      expect(Array.from(sent.key)).toEqual(Array.from(getDeviceKeyBytes()));
      expect(sent.photos).toHaveLength(2);
      const stored = atSend[0].photos;
      const front = stored.find((p) => p.side === 'obverse')!;
      const back = stored.find((p) => p.side === 'reverse')!;
      expect(front.blob.size).not.toBe(back.blob.size);
      expect(sent.photos!.map((p) => [p.mime, p.bytes.length])).toEqual([['image/jpeg', front.blob.size], ['image/jpeg', back.blob.size]]);
    });
    And('the pending item keeps the txid', async () => {
      await waitFor(async () => expect((await onlyItem()).reading).toMatchObject({ state: 'sent', txid: 'direct:tx1' }));
      expect((await onlyItem()).status).toBe('pending');
    });
  });

  Scenario('an answer names the item and the Confirm sheet shows the fields', ({ Given, When, And, Then }) => {
    Given('the camera is open on Add and the factory will name a 1944 Washington quarter', willName);
    When('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    And('he opens the named coin to check it', openToCheck);
    Then('the Confirm sheet shows the country with its flag, denomination, year, mint mark, series, grade marked as a guess, inscription and fun fact', async () => {
      const s = within(sheet());
      expect(await s.findByText('🇺🇸 United States')).toBeInTheDocument();
      expect(s.getByText('quarter dollar')).toBeInTheDocument();
      expect(s.getByText('1944')).toBeInTheDocument();
      expect(s.getByText('D')).toBeInTheDocument();
      expect(s.getByText('Washington quarter')).toBeInTheDocument();
      expect(s.getByText('AU')).toBeInTheDocument();
      expect(s.getByText('guess')).toBeInTheDocument();
      expect(s.getByText(/LIBERTY IN GOD WE TRUST 1944/)).toBeInTheDocument();
      expect(s.getByText(/Until 1964 this quarter was made of silver/)).toBeInTheDocument();
    });
    And('the item.named event was published', async () => {
      expect(latest('item.named')?.id).toBe((await onlyItem()).id);
    });
  });

  Scenario("That's right confirms; Not quite lets him edit a field and then confirms", ({ Given, When, And, Then }) => {
    Given('the camera is open on Add and the factory will name a 1944 Washington quarter', willName);
    When('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    And('he opens the named coin to check it', openToCheck);
    And("he taps That's right", async () => {
      await userEvent.click(within(sheet()).getByRole('button', { name: "That's right" }));
    });
    Then('the item is confirmed', async () => {
      await waitFor(async () => expect((await onlyItem()).status).toBe('confirmed'));
      expect(screen.queryByRole('dialog', { name: 'Confirm' })).toBeNull();
    });
    When('he photographs a second coin and opens it to check', async () => {
      await takeBoth();
      await nameOne();
      await openToCheck();
    });
    And('he taps Not quite', async () => {
      await userEvent.click(within(sheet()).getByRole('button', { name: 'Not quite' }));
    });
    And('he changes the year to 1945 and saves', async () => {
      const year = within(sheet()).getByLabelText('Year');
      await userEvent.clear(year);
      await userEvent.type(year, '1945');
      await userEvent.click(within(sheet()).getByRole('button', { name: /^Save/ }));
    });
    Then('the second item is confirmed with the year 1945 and the first still says 1944', async () => {
      await waitFor(async () => expect((await allItems()).filter((i) => i.status === 'confirmed')).toHaveLength(2));
      const items = (await allItems()).sort((a, b) => a.createdAt - b.createdAt);
      expect(items.map((i) => [i.status, i.year, i.denomination])).toEqual([
        ['confirmed', 1944, 'quarter dollar'],
        ['confirmed', 1945, 'quarter dollar'],
      ]);
    });
  });

  Scenario('a refusal says why in words and Try again resends', ({ Given, When, And, Then }) => {
    Given('the camera is open on Add and the factory refuses the first photos', async () => {
      factory.onAnswer(async (txid) => (txid === 'direct:tx1' ? refused('photograph the back in daylight', txid) : answered(quarter(), txid)));
      await cameraOpen();
    });
    When('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    Then('the item stays pending and says "The factory could not read this one: photograph the back in daylight"', async () => {
      expect(await screen.findByRole('alert')).toHaveTextContent('The factory could not read this one: photograph the back in daylight');
      const item = await onlyItem();
      expect(item.status).toBe('pending');
      expect(item.reading).toMatchObject({ state: 'failed' });
    });
    When('he taps Try again', async () => {
      await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    });
    Then('the grist is sent a second time and the item is named', async () => {
      await waitFor(() => expect(factory.sent).toHaveLength(2));
      await waitFor(async () => expect(await onlyItem()).toMatchObject({ status: 'named', reading: null }));
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  Scenario('a reopened app resumes waiting on a pending txid', ({ Given, When, Then }) => {
    Given('an item that was sent to the factory before the app was closed', async () => {
      factory.onAnswer(async () => answered(quarter()));
      const bytes = (n: number) => new NodeBlob([new Uint8Array(n)], { type: 'image/jpeg' }) as unknown as Blob;
      await addItemWithPhotos({ kind: 'coin', status: 'pending', reading: { state: 'sent', txid: 'direct:before', sentAt: Date.now() - 1000, sendId: 'old', message: null } }, [
        { side: 'obverse', blob: bytes(9), thumb: bytes(3), width: 800, height: 800 },
      ]);
    });
    When('the app is opened', async () => {
      cleanup();
      window.history.replaceState(null, '', '/#/collection');
      render(<App gate={openGate} />);
      await screen.findByRole('heading', { name: 'Collection' });
    });
    Then('it waits on the same txid without sending again and the item is named', async () => {
      await waitFor(async () => expect(await onlyItem()).toMatchObject({ status: 'named', reading: null, year: 1944 }));
      // the photo reader is not asked again; the value of the named coin is asked on its own grist
      expect(factory.awaited.filter((txid) => txid === 'direct:before')).toEqual(['direct:before']);
      expect(factory.sentOf('coin-from-photos')).toHaveLength(0);
    });
  });

  Scenario('Name it returns to the viewfinder at once and the item waits in the queue', ({ Given, When, And, Then }) => {
    Given('the camera is open on Add and the factory has not answered', cameraOpen);
    When('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    Then('the prompt reads Front again and the shutter is ready', () => {
      expect(prompt()).toHaveTextContent('Front');
      expect(shutter()).toBeEnabled();
      expect(screen.queryAllByRole('button', { name: /^Retake/ })).toHaveLength(0);
    });
    And('the queue says "1 at the factory"', async () => {
      expect(await screen.findByText('1 at the factory')).toBeInTheDocument();
    });
  });

  Scenario('three items queued are sent one after another and each is named', ({ Given, When, Then, And }) => {
    const sends: ReturnType<typeof deferred<string>>[] = [];
    Given('the camera is open on Add and the factory sends one at a time', async () => {
      sends.length = 0;
      factory.onSend((_params, n) => {
        const d = deferred<string>();
        sends[n - 1] = d;
        return d.promise;
      });
      factory.onAnswer(async (txid) => answered(quarter(1940 + Number(txid.slice('direct:tx'.length))), txid));
      await openAdd();
    });
    When('he names three coins in a row', async () => {
      for (let i = 0; i < 3; i++) {
        await takeBoth();
        await nameOne();
      }
    });
    Then('only the first is sent until its send finishes, then the second, then the third', async () => {
      await waitFor(() => expect(factory.sent).toHaveLength(1));
      await new Promise((r) => setTimeout(r, 80));
      expect(factory.sent).toHaveLength(1);
      sends[0].resolve('direct:tx1');
      await waitFor(() => expect(factory.sent).toHaveLength(2));
      await new Promise((r) => setTimeout(r, 80));
      expect(factory.sent).toHaveLength(2);
      sends[1].resolve('direct:tx2');
      await waitFor(() => expect(factory.sent).toHaveLength(3));
      sends[2].resolve('direct:tx3');
    });
    And('all three are named in the order they were queued', async () => {
      await waitFor(async () => expect((await allItems()).filter((i) => i.status === 'named')).toHaveLength(3));
      const items = (await allItems()).sort((a, b) => a.createdAt - b.createdAt);
      expect(items.map((i) => i.year)).toEqual([1941, 1942, 1943]);
    });
  });

  Scenario('a network failure retries and the item stays pending', ({ Given, When, And, Then }) => {
    Given('the camera is open on Add and the first send fails on the network', async () => {
      factory.onSend(async (_params, n) => {
        if (n === 1) throw new TypeError('Failed to fetch');
        return `direct:tx${n}`;
      });
      await openAdd();
    });
    When('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    Then('the item stays pending and the send is tried again after a pause and goes through', async () => {
      await waitFor(() => expect(factory.sent).toHaveLength(1));
      expect(await onlyItem()).toMatchObject({ status: 'pending', reading: { state: 'waiting', txid: null } });
      await waitFor(() => expect(factory.sent).toHaveLength(2));
      await waitFor(async () => expect((await onlyItem()).reading).toMatchObject({ state: 'sent', txid: 'direct:tx2' }));
    });
  });

  Scenario('Just looking names the coin as a considering item that shows under Looking at and not in the counts', ({ Given, And, When, Then }) => {
    Given('a collection of one confirmed coin', async () => {
      const { usQuarter } = await seedCollection();
      await db.items.where('id').notEqual(usQuarter.id).delete();
    });
    And('the camera is open on Add and the factory will name a 1944 Washington quarter', willName);
    When('he chooses Just looking', async () => {
      await userEvent.click(screen.getByRole('radio', { name: 'Just looking' }));
    });
    And('he takes the Front photo and the Back photo', takeBoth);
    And('he taps Name it', nameOne);
    And('he opens the Collection', async () => {
      await itemWhere((i) => i.status === 'considering' && i.reading === null);
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      await screen.findByRole('heading', { name: 'Collection' });
    });
    Then('the quarter shows under Looking at and the count line still reads "1 coin · 1 country"', async () => {
      const looking = await screen.findByRole('region', { name: 'Looking at' });
      expect(within(looking).getByText(/quarter dollar/)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('count-line')).toHaveTextContent('1 coin · 1 country'));
    });
  });

  Scenario('Add it confirms it; Let it go removes it with undo', ({ Given, When, Then }) => {
    let ids: string[] = [];
    const openItem = async (id: string) => {
      cleanup();
      window.history.replaceState(null, '', `/#/item/${id}`);
      render(<App gate={openGate} />);
      await openToCheck();
    };
    Given('two considering coins that the factory has named', async () => {
      ids = [(await seedConsidering()).id, (await seedConsidering()).id];
    });
    When('he opens the first and taps Add it', async () => {
      await openItem(ids[0]);
      await userEvent.click(within(sheet()).getByRole('button', { name: 'Add it' }));
    });
    Then('the first item is confirmed and no longer under Looking at', async () => {
      await waitFor(async () => expect((await db.items.get(ids[0]))?.status).toBe('confirmed'));
      await userEvent.click(within(screen.getByRole('navigation', { name: 'Screens' })).getByRole('link', { name: 'Collection' }));
      await screen.findByRole('heading', { name: 'Collection' });
      await waitFor(() => expect(screen.getByTestId('count-line')).toHaveTextContent('1 coin'));
      // the other one is still being looked at
      expect(within(screen.getByRole('region', { name: 'Looking at' })).getAllByRole('link')).toHaveLength(1);
    });
    When('he opens the second and taps Let it go', async () => {
      // let the Back step of the sheet he closed settle before the address is set by hand
      await new Promise((r) => setTimeout(r, 50));
      await openItem(ids[1]);
      await userEvent.click(within(sheet()).getByRole('button', { name: 'Let it go' }));
    });
    Then('the second item is removed and Undo brings it back', async () => {
      await waitFor(async () => expect((await db.items.get(ids[1]))?.deletedAt).not.toBeNull());
      await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
      await waitFor(async () => expect((await db.items.get(ids[1]))?.deletedAt).toBeNull());
      expect((await db.items.get(ids[1]))?.status).toBe('considering');
    });
  });
});
