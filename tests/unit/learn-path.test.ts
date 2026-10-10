import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item } from '../../src/data/db';
import type { QuarterDesign } from '../../src/data/us';
import { levelOf, monthsSince, nextStep, skillsOf } from '../../src/learn/path';

const designs = JSON.parse(readFileSync('public/data/us/quarters.json', 'utf8')) as QuarterDesign[];

function item(over: Partial<Item>): Item {
  return {
    id: crypto.randomUUID(), kind: 'coin', country: 'US', currency: 'USD', denomination: 'Quarter dollar', faceValue: 0.25, year: null,
    mintMark: null, series: null, design: null, material: '', inscription: '', funFact: '', gradeGuess: null, gradeNotes: '', notes: '',
    tags: [], status: 'confirmed', confidence: null, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
  };
}

const find = (skills: ReturnType<typeof skillsOf>, id: string) => skills.find((s) => s.id === id)!;

describe('levelOf', () => {
  it('counts the thresholds reached', () => {
    expect(levelOf([0, 5, 20], 0)).toBe(1);
    expect(levelOf([0, 5, 20], 4)).toBe(1);
    expect(levelOf([0, 5, 20], 5)).toBe(2);
    expect(levelOf([0, 5, 20], 20)).toBe(3);
    expect(levelOf([1, 5, 15, 30], 0)).toBe(0);
    expect(levelOf([1, 5, 15, 30], 1)).toBe(1);
    expect(levelOf([1, 5, 15, 30], 99)).toBe(4);
  });
});

describe('skillsOf', () => {
  it('derives each skill from the items, the asks and the quarter designs', () => {
    const items = [
      item({ gradeGuess: 'VF', mintMark: 'D', year: 1999, series: '50 State Quarters', design: 'Delaware' }),
      item({ gradeGuess: 'XF', mintMark: 'P', country: 'CA' }),
      item({ gradeGuess: 'F', mintMark: 'd' }),
      item({ country: 'MX', mintMark: 'M' }),
      item({ country: null, deletedAt: 5 }),
      item({ tags: ['considered'] }),
    ];
    const skills = skillsOf({ items, askCount: 4, designs });
    expect(skills.map((s) => s.id)).toEqual(['grading', 'mints', 'world', 'quarters', 'looking', 'tutor']);
    expect(find(skills, 'grading')).toMatchObject({ count: 3, level: 1, levels: 3 });
    // distinct marks on US coins, upper-cased: one D (the Canadian P and the Mexican M are not US mints)
    expect(find(skills, 'mints')).toMatchObject({ count: 1, level: 1, levels: 3 });
    expect(find(skills, 'world')).toMatchObject({ count: 3, level: 1, levels: 4 });
    expect(find(skills, 'quarters')).toMatchObject({ count: 1 });
    expect(find(skills, 'looking')).toMatchObject({ count: 1, level: 1 });
    expect(find(skills, 'tutor')).toMatchObject({ count: 4, level: 2, levels: 3 });
  });

  it('leaves removed items out and shows level 0 for an empty collection', () => {
    const skills = skillsOf({ items: [item({ gradeGuess: 'VF', deletedAt: 9 })], askCount: 0, designs });
    expect(find(skills, 'grading').count).toBe(0);
    expect(find(skills, 'world').level).toBe(0);
  });
});

describe('nextStep', () => {
  it('says plainly what to do for the next level', () => {
    const skills = skillsOf({ items: [item({ gradeGuess: 'VF' }), item({ gradeGuess: 'F' }), item({ gradeGuess: 'G' })], askCount: 0, designs });
    expect(find(skills, 'grading').next).toBe('Grade two more coins to reach the next level');
    expect(find(skills, 'world').next).toBe('Add coins from four more countries to reach the next level');
    expect(find(skills, 'tutor').next).toBe('Ask the tutor three more questions to reach the next level');
  });

  it('uses the singular for one and names the top', () => {
    expect(nextStep('grading', 4, 5)).toBe('Grade one more coin to reach the next level');
    expect(nextStep('world', 14, 15)).toBe('Add coins from one more country to reach the next level');
    expect(nextStep('mints', 8, null)).toBe('You have reached the top level for Mints');
  });
});

describe('monthsSince', () => {
  it('counts items by month from the first one to the last, with empty months between', () => {
    const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
    const out = monthsSince([item({ createdAt: at(2026, 3, 9) }), item({ createdAt: at(2026, 3, 20) }), item({ createdAt: at(2026, 6, 1) }), item({ createdAt: at(2026, 1, 15), deletedAt: 3 })]);
    expect(out?.startedAt).toBe(at(2026, 3, 9));
    expect(out?.months).toEqual([
      { month: '2026-03', count: 2 },
      { month: '2026-04', count: 0 },
      { month: '2026-05', count: 0 },
      { month: '2026-06', count: 1 },
    ]);
  });

  it('is null with no items', () => {
    expect(monthsSince([])).toBeNull();
  });
});
