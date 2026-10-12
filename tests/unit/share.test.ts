// What Share puts in a picture and what it never does (src/share/): the words of the caption, the facts of an item card, and the
// size of each picture. The pictures are drawn on a fake context, so the test reads exactly what would have been written on them.
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '../../src/data/db';
import { cardFacts, cardText, globeCaption, looksLikeSerial } from '../../src/share/text';
import { CARD_SIZE, GLOBE_SIZE, renderGlobePicture, renderItemCard } from '../../src/share/picture';
import { countryFeatures } from '../../src/globe/geo';
import { DEFAULT_PALETTE } from '../../src/globe/palette';
import { globeCountries } from '../support/globe-fixtures';
import { FakePictureContext, installPictureCanvas } from '../support/fake-picture';

const look = { countryName: () => 'United States', flag: () => '🇺🇸', mintCity: () => 'Denver' };

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1', kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: 1964, mintMark: 'D',
  series: 'Washington quarter', design: 'Eagle', material: 'Silver', inscription: 'IN GOD WE TRUST · LIBERTY', funFact: 'Struck in 90% silver.',
  gradeGuess: 'VF', gradeNotes: 'Worn high points', notes: 'Grandpa gave me this one, worth about $40', tags: ['grandpa-silver'], status: 'confirmed',
  confidence: 'high', createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
});

describe('the caption', () => {
  it('names the owner with an apostrophe s, and says My when no name is set', () => {
    expect(globeCaption('Paul', 12)).toBe("Paul's coins come from 12 countries");
    expect(globeCaption('', 12)).toBe('My coins come from 12 countries');
    expect(globeCaption('  ', 3)).toBe('My coins come from 3 countries');
    expect(globeCaption('My', 3)).toBe('My coins come from 3 countries');
  });
  it('says country for one, and has something to say with none', () => {
    expect(globeCaption('Paul', 1)).toBe("Paul's coins come from 1 country");
    expect(globeCaption('Paul', 0)).toBe("Paul's collection is just beginning");
  });
});

describe('the item card text', () => {
  it('holds the photos’ facts: denomination, year, country, mint, series, design, the grade marked guess and the inscription', () => {
    const text = cardText(cardFacts(item(), look));
    for (const part of ['Quarter dollar', '1964', 'United States', 'D · Denver', 'Washington quarter', 'Eagle', 'VF · guess', 'IN GOD WE TRUST']) {
      expect(text, part).toContain(part);
    }
  });

  it('never holds a note, a tag, a value or a wear note', () => {
    const text = cardText(cardFacts(item(), look));
    expect(text).not.toContain('Grandpa');
    expect(text).not.toContain('grandpa');
    expect(text).not.toContain('$40');
    expect(text).not.toContain('Worn high points');
    expect(text).not.toContain('Struck in 90%');
    expect(text).not.toContain('0.25');
  });

  it('holds no run of 8 or more digits, even where a serial number was typed into a field the card does use', () => {
    const facts = cardFacts(item({ series: 'Series 12345678', design: 'B 2345 6789 A', inscription: 'No. 98765432', denomination: 'One dollar 87654321' }), look);
    const text = cardText(facts);
    expect(text).not.toMatch(/\d{8,}/);
    expect(text.replace(/[\s-]/g, '')).not.toMatch(/\d{8,}/);
    expect(text).toContain('1964');
  });

  describe('an Other piece', () => {
    const token = (over: Partial<Item> = {}) =>
      item({
        kind: 'other', subtype: 'Subway token', country: 'US', currency: null, denomination: '', faceValue: null, year: null, mintMark: null, series: null,
        design: null, inscription: undefined, funFact: 'Good for one fare in 1953.', gradeGuess: null, gradeNotes: '', notes: 'Paul found it in a drawer, worth $5',
        tags: ['subway-trip'], ...over,
      });

    it('is titled by its subtype when it has no denomination, with the year when it has one, a Type row and no Mint row', () => {
      const plain = cardFacts(token(), look);
      expect(plain.title).toBe('Subway token');
      expect(plain.rows).toEqual([{ label: 'Type', value: 'Subway token' }]);
      expect(plain.country).toEqual({ flag: '🇺🇸', name: 'United States' });
      expect(cardFacts(token({ year: 1953 }), look).title).toBe('Subway token, 1953');
    });

    it('is titled by its denomination when it has one, and still names its Type', () => {
      const facts = cardFacts(token({ denomination: 'Ten cent fare', year: 1953 }), look);
      expect(facts.title).toBe('Ten cent fare, 1953');
      expect(facts.rows).toContainEqual({ label: 'Type', value: 'Subway token' });
    });

    it('never holds a note, a tag, the fun fact or any worth', () => {
      const text = cardText(cardFacts(token({ year: 1953 }), look));
      for (const banned of ['drawer', 'worth', '$5', 'subway-trip', 'Good for one fare']) expect(text, banned).not.toContain(banned);
      expect(text).not.toMatch(/Mint/);
    });

    it('with no subtype and no denomination is still titled, and a coin is not given a Type row', () => {
      expect(cardFacts(token({ subtype: null }), look).title).toBe('Piece');
      expect(cardFacts(token({ subtype: null }), look).rows).toEqual([]);
      expect(cardFacts(item(), look).rows.map((r) => r.label)).not.toContain('Type');
    });
  });

  it('knows what a serial number looks like and what a year is', () => {
    expect(looksLikeSerial('12345678')).toBe(true);
    expect(looksLikeSerial('A12345678B')).toBe(true);
    expect(looksLikeSerial('B 2345 6789 A')).toBe(true);
    expect(looksLikeSerial('1964')).toBe(false);
    expect(looksLikeSerial('IN GOD WE TRUST 1964')).toBe(false);
  });
});

describe('the pictures', () => {
  const ctx = new FakePictureContext();
  let canvas: ReturnType<typeof installPictureCanvas>;
  beforeEach(() => {
    ctx.reset();
    canvas = installPictureCanvas(ctx);
  });
  afterEach(() => {
    canvas.restore();
    vi.unstubAllGlobals();
  });

  it('the globe picture is 1080 by 1080 and a JPEG, with the caption, the mark and the date on it', async () => {
    const picture = await renderGlobePicture({
      features: countryFeatures(globeCountries),
      lit: new Map([['DE', 2], ['US', 1]]),
      rotation: [-10, -50, 0],
      name: 'Paul',
      palette: DEFAULT_PALETTE,
      today: new Date('2026-10-10T12:00:00Z'),
    });
    expect([picture.width, picture.height]).toEqual([1080, 1080]);
    expect([GLOBE_SIZE, canvas.cuts[0].width, canvas.cuts[0].height, canvas.cuts[0].type]).toEqual([1080, 1080, 1080, 'image/jpeg']);
    expect(picture.blob.type).toBe('image/jpeg');
    expect(ctx.texts).toContain("Paul's coins come from 2 countries");
    expect(ctx.texts).toContain('Legend');
    expect(ctx.texts.some((t) => /10 October 2026/.test(t))).toBe(true);
  });

  it('the item card is 1080 by 1350, with both photos and the facts, and none of the notes', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 800, height: 600, close: () => undefined }));
    const blob = new NodeBlob(['x']) as unknown as Blob;
    const picture = await renderItemCard({
      facts: cardFacts(item(), look),
      photos: { obverse: blob, reverse: blob },
      today: new Date('2026-10-10T12:00:00Z'),
    });
    expect([picture.width, picture.height]).toEqual([1080, 1350]);
    expect([CARD_SIZE.width, canvas.cuts[0].width, canvas.cuts[0].height]).toEqual([1080, 1080, 1350]);
    expect(ctx.images).toBe(2);
    const written = ctx.texts.join('\n');
    expect(written).toContain('Quarter dollar, 1964');
    expect(written).toContain('VF · guess');
    expect(written).not.toMatch(/Grandpa|grandpa|\$40|\d{8,}/);
  });

  it('a missing photo leaves a placeholder and the card is still made', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 800, height: 600, close: () => undefined }));
    const blob = new NodeBlob(['x']) as unknown as Blob;
    await renderItemCard({ facts: cardFacts(item(), look), photos: { obverse: blob }, today: new Date('2026-10-10T12:00:00Z') });
    expect(ctx.images).toBe(1);
    expect(ctx.texts).toContain('No reverse photo');
  });
});
