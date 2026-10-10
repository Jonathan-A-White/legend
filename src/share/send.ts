// src/share/send.ts: hands a picture to the phone's share sheet (navigator.share with a file), or, when the phone has none or
// will not take a file, says to offer 'Save picture'. This is the only place a shared picture leaves the page, and it only runs
// from a tap on a Share button.
import { loadMints } from '../data/us';
import { countryName, flagOf, loadCountries } from '../data/world';
import { getItem, listPhotos } from '../data/repositories';
import { readSetting } from '../settings/registry';
import { renderGlobePicture, renderItemCard, type GlobePictureInput, type Picture } from './picture';
import { cardFacts } from './text';

export type Outcome = 'shared' | 'cancelled' | 'save';

export interface Shared {
  outcome: Outcome;
  picture: Picture;
  /** the name to save it under */
  fileName: string;
}

/** Offers the picture to the share sheet. 'save' when the phone has no share sheet for a file or it failed: the picture is still
 * made, and the caller offers it to save. Closing the sheet is 'cancelled', not a failure. */
export async function send(picture: Picture, fileName: string, title: string): Promise<Shared> {
  const result = (outcome: Outcome): Shared => ({ outcome, picture, fileName });
  if (typeof navigator.share !== 'function') return result('save');
  const file = new File([picture.blob], fileName, { type: 'image/jpeg' });
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) return result('save');
  try {
    await navigator.share({ files: [file], title });
    return result('shared');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return result('cancelled');
    return result('save');
  }
}

export type GlobeShareInput = Omit<GlobePictureInput, 'name'>;

/** A picture of the globe as it stands, to the share sheet. */
export async function shareGlobe(input: GlobeShareInput): Promise<Shared> {
  const name = String(await readSetting('ownerName'));
  const picture = await renderGlobePicture({ ...input, name });
  return send(picture, 'legend-globe.jpg', 'My Legend globe');
}

/** The card of one item (its photos and facts, never its notes) to the share sheet. */
export async function shareItem(id: string): Promise<Shared> {
  const item = await getItem(id);
  if (!item) throw new Error('This item is not in your collection.');
  if (item.status === 'wished') throw new Error('A coin on your Wish list stays on this phone.');
  const [countries, mints, photos] = await Promise.all([loadCountries(), loadMints().catch(() => []), listPhotos(id)]);
  const facts = cardFacts(item, {
    countryName: (cc) => countryName(countries, cc),
    flag: flagOf,
    mintCity: (mark, country) => (country === 'US' ? (mints.find((m) => m.mark === mark.toUpperCase())?.city ?? null) : null),
  });
  const side = (s: 'obverse' | 'reverse') => photos.find((p) => p.side === s)?.blob;
  const picture = await renderItemCard({ facts, photos: { obverse: side('obverse'), reverse: side('reverse') } });
  return send(picture, 'legend-card.jpg', facts.title);
}
