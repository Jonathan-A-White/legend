import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/db';
import type { QuarterDesign } from '../../src/data/us';
import { matchDesign, matchItems, normalise } from '../../src/quarters/match';

const designs = JSON.parse(readFileSync('public/data/us/quarters.json', 'utf8')) as QuarterDesign[];

function item(over: Partial<Item>): Item {
  return {
    id: 'i1',
    kind: 'coin',
    country: 'US',
    currency: 'USD',
    denomination: 'Quarter dollar',
    faceValue: 0.25,
    year: null,
    mintMark: null,
    series: null,
    design: null,
    material: '',
    inscription: '',
    funFact: '',
    gradeGuess: null,
    gradeNotes: '',
    notes: '',
    tags: [],
    status: 'confirmed',
    confidence: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...over,
  };
}

const found = (over: Partial<Item>) => {
  const d = matchDesign(item(over), designs);
  return d ? `${d.program}:${d.year}:${d.name}:${d.jurisdiction}` : null;
};

describe('normalise', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalise("Perry's  VICTORY, (Fort) Hawaiʻi!")).toBe('perrys victory fort hawaii');
  });
});

describe('matchDesign', () => {
  it("matches a 2010 America the Beautiful 'Yosemite' quarter to California's 2010 design", () => {
    expect(found({ year: 2010, series: 'America the Beautiful', design: 'Yosemite' })).toBe('america-the-beautiful:2010:Yosemite National Park:CA');
  });

  it('matches the grind\'s own wording: the programme and the design in the series', () => {
    expect(found({ year: 2010, series: 'America the Beautiful quarters, Yosemite', design: 'El Capitan rising above the valley' })).toBe(
      'america-the-beautiful:2010:Yosemite National Park:CA',
    );
    expect(found({ year: 2004, series: '50 State Quarters, Delaware', design: 'Caesar Rodney on horseback' })).toBeNull();
    expect(found({ year: 1999, series: '50 State Quarters, Delaware', design: 'Caesar Rodney on horseback' })).toBe('state:1999:Delaware:DE');
  });

  it("matches a 2005 'Kansas' state quarter to Kansas", () => {
    expect(found({ year: 2005, series: 'State quarters', design: 'Kansas' })).toBe('state:2005:Kansas:KS');
    expect(found({ year: 2005, series: 'Kansas', design: null })).toBe('state:2005:Kansas:KS');
  });

  it('matches nothing for a 1998 quarter', () => {
    expect(found({ year: 1998, series: 'Washington quarter', design: 'Eagle' })).toBeNull();
    expect(found({ year: 1998, series: null, design: 'Kansas' })).toBeNull();
  });

  it("matches a 'Grand Canyon' with no series to Arizona 2010 by design text", () => {
    expect(found({ year: 2010, series: null, design: 'Grand Canyon' })).toBe('america-the-beautiful:2010:Grand Canyon National Park:AZ');
  });

  it('ignores case and punctuation', () => {
    expect(found({ year: 2010, series: 'AMERICA THE BEAUTIFUL!', design: 'yosemite' })).toBe('america-the-beautiful:2010:Yosemite National Park:CA');
    expect(found({ year: 2013, series: null, design: "perry's victory and international peace memorial" })).toBe(
      "america-the-beautiful:2013:Perry's Victory and International Peace Memorial:OH",
    );
  });

  it('is not fooled by one name inside another: Washington Crossing the Delaware is not Delaware or Washington', () => {
    expect(found({ year: 2021, series: 'Washington Crossing the Delaware quarter', design: null })).toBe('washington-crossing:2021:Washington Crossing the Delaware:null');
    expect(found({ year: 2021, series: null, design: 'Washington Crossing the Delaware' })).toBe('washington-crossing:2021:Washington Crossing the Delaware:null');
    expect(found({ year: 2007, series: 'Washington quarter', design: 'Idaho' })).toBe('state:2007:Idaho:ID');
  });

  it('matches the people of American Women', () => {
    expect(found({ year: 2022, series: 'American Women quarters', design: 'Maya Angelou' })).toBe('american-women:2022:Maya Angelou:null');
  });

  it("lets the hand override win: a design that is exactly a design's name", () => {
    expect(found({ year: 2010, series: 'America the Beautiful quarters, Yellowstone', design: 'Yosemite National Park' })).toBe(
      'america-the-beautiful:2010:Yosemite National Park:CA',
    );
  });

  it('matches nothing when the piece is not a US quarter', () => {
    expect(found({ year: 2010, design: 'Yosemite', country: 'CA' })).toBeNull();
    expect(found({ year: 2010, design: 'Yosemite', denomination: 'Dime' })).toBeNull();
  });

  it('takes a design that is exactly a name even with no year and no series, and otherwise wants a year or a programme', () => {
    expect(found({ year: null, series: null, design: 'Hawaii' })).toBe('state:2008:Hawaii:HI');
    expect(found({ year: null, series: null, design: 'A hawk over the Hawaii shore' })).toBeNull();
  });

  it('needs something to go on: no year, no series, no name', () => {
    expect(found({})).toBeNull();
    expect(found({ year: 2010 })).toBeNull();
  });
});

describe('matchItems', () => {
  it('groups the items by the design they match and leaves out removed items', () => {
    const owned = matchItems(
      [
        item({ id: 'a', year: 2010, design: 'Yosemite' }),
        item({ id: 'b', year: 2010, design: 'Yosemite', deletedAt: 5 }),
        item({ id: 'c', year: 1998, design: 'Eagle' }),
      ],
      designs,
    );
    expect([...owned.values()].map((l) => l.map((i) => i.id))).toEqual([['a']]);
  });
});
