// tests/support/collection-fixtures.ts: a small seeded collection for the Collection's feature and its screenshot, and a fetch that
// serves the real world and US files from public/data (never the network).
import { Blob as NodeBlob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { addItem, addPhoto, type Item } from '../../src/data/repositories';

// Node's own Blob: fake-indexeddb cannot round-trip jsdom's.
const bytes = (n: number) => new NodeBlob([new Uint8Array(n)], { type: 'image/jpeg' }) as unknown as Blob;

export async function seedPhotos(item: Item, sides: ('obverse' | 'reverse')[] = ['obverse', 'reverse']): Promise<void> {
  for (const side of sides) await addPhoto({ itemId: item.id, side, blob: bytes(12), thumb: bytes(4), width: 800, height: 800 });
}

export interface Seeded {
  usQuarter: Item;
  caDime: Item;
  deMark: Item;
  usBill: Item;
}

/** Three coins and one bill from three countries, newest added last. */
export async function seedCollection(): Promise<Seeded> {
  const usQuarter = await addItem({
    kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D',
    series: 'Washington quarter', design: 'Eagle', material: 'Silver', gradeGuess: 'VF', gradeNotes: 'Worn high points',
    inscription: 'IN GOD WE TRUST · LIBERTY', funFact: 'The last year quarters were struck in 90% silver.',
    tags: ['silver'], status: 'confirmed', confidence: 'high',
  });
  await seedPhotos(usQuarter);
  const caDime = await addItem({
    kind: 'coin', country: 'CA', currency: 'CAD', denomination: 'Dime', faceValue: 0.1, year: 1955, series: 'Bluenose', design: 'Schooner',
    status: 'confirmed', confidence: 'medium',
  });
  await seedPhotos(caDime, ['obverse']);
  const deMark = await addItem({ kind: 'coin', country: 'DE', currency: 'DEM', denomination: 'Two marks', faceValue: 2, year: 1958, mintMark: 'F', status: 'named' });
  await seedPhotos(deMark);
  const usBill = await addItem({ kind: 'note', country: 'US', currency: 'USD', denomination: 'One dollar', faceValue: 1, year: 1935, series: 'Silver certificate', status: 'confirmed' });
  await seedPhotos(usBill);
  return { usQuarter, caDime, deMark, usBill };
}

/** Makes `fetch` answer /data/world/* and /data/us/* from the files in public/data. */
export function serveReferenceData(stub: (name: 'fetch', fake: typeof fetch) => void): void {
  stub('fetch', (async (url: string) => {
    const path = new URL(url, 'http://localhost').pathname;
    if (!path.startsWith('/data/')) return new Response('', { status: 404 });
    try {
      return new Response(readFileSync(`public${path}`, 'utf8'));
    } catch {
      return new Response('', { status: 404 });
    }
  }) as typeof fetch);
}
