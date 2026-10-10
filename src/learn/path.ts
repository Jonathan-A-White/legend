// src/learn/path.ts: Your path. The skills and their levels are worked out from what is already stored (his items, his questions to
// the tutor, the quarter designs), never from a model of their own. Pure. No badges, no streaks: a level, a count and a plain next step.
import type { Item } from '../data/db';
import type { QuarterDesign } from '../data/us';
import { matchItems } from '../quarters';

export type SkillId = 'grading' | 'mints' | 'world' | 'quarters' | 'looking' | 'tutor';

/** The count each level starts at: level n is reached at thresholds[n - 1]. */
const SKILLS: { id: SkillId; name: string; thresholds: number[] }[] = [
  { id: 'grading', name: 'Grading', thresholds: [0, 5, 20] },
  { id: 'mints', name: 'Mints', thresholds: [0, 3, 8] },
  { id: 'world', name: 'World', thresholds: [1, 5, 15, 30] },
  { id: 'quarters', name: 'Quarters', thresholds: [0, 10, 30, 60] },
  { id: 'looking', name: 'Looking', thresholds: [0, 5, 20] },
  { id: 'tutor', name: 'Tutor', thresholds: [0, 3, 10] },
];

/** The tag a coin carries when it was considered at a store and let go. */
export const CONSIDERED_TAG = 'considered';

export interface Skill {
  id: SkillId;
  name: string;
  count: number;
  level: number;
  levels: number;
  next: string;
}

export interface PathInput {
  items: readonly Item[];
  askCount: number;
  designs: readonly QuarterDesign[];
}

export const levelOf = (thresholds: readonly number[], count: number): number => thresholds.filter((t) => count >= t).length;

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const num = (n: number): string => WORDS[n] ?? String(n);

const NEXT: Record<SkillId, (n: number) => string> = {
  grading: (n) => `Grade ${num(n)} more ${n === 1 ? 'coin' : 'coins'}`,
  mints: (n) => `Find ${num(n)} more mint ${n === 1 ? 'mark' : 'marks'}`,
  world: (n) => `Add coins from ${num(n)} more ${n === 1 ? 'country' : 'countries'}`,
  quarters: (n) => `Find ${num(n)} more quarter ${n === 1 ? 'design' : 'designs'}`,
  looking: (n) => `Look over ${num(n)} more ${n === 1 ? 'coin and let it' : 'coins and let them'} go`,
  tutor: (n) => `Ask the tutor ${num(n)} more ${n === 1 ? 'question' : 'questions'}`,
};

/** The plain next step for a skill with `count` so far, the next level starting at `target` (null at the top). */
export function nextStep(id: SkillId, count: number, target: number | null): string {
  if (target === null) return `You have reached the top level for ${SKILLS.find((s) => s.id === id)!.name}`;
  return `${NEXT[id](Math.max(1, target - count))} to reach the next level`;
}

export function skillsOf({ items, askCount, designs }: PathInput): Skill[] {
  const mine = items.filter((i) => i.deletedAt === null);
  const counts: Record<SkillId, number> = {
    grading: mine.filter((i) => i.gradeGuess).length,
    mints: new Set(mine.filter((i) => i.country === 'US' && i.mintMark?.trim()).map((i) => i.mintMark!.trim().toUpperCase())).size,
    world: new Set(mine.map((i) => i.country).filter(Boolean)).size,
    quarters: matchItems(mine, [...designs]).size,
    looking: mine.filter((i) => i.tags.includes(CONSIDERED_TAG)).length,
    tutor: askCount,
  };
  return SKILLS.map(({ id, name, thresholds }) => {
    const count = counts[id];
    const level = levelOf(thresholds, count);
    return { id, name, count, level, levels: thresholds.length, next: nextStep(id, count, thresholds[level] ?? null) };
  });
}

const monthKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export interface Since {
  /** when the first item was added */
  startedAt: number;
  /** items added in each month from the first item's to the latest, months with none included */
  months: { month: string; count: number }[];
}

/** The date of his first item and the items added per month since. Null with no items. */
export function monthsSince(items: readonly Item[]): Since | null {
  const mine = items.filter((i) => i.deletedAt === null).sort((a, b) => a.createdAt - b.createdAt);
  if (mine.length === 0) return null;
  const counts = new Map<string, number>();
  for (const i of mine) counts.set(monthKey(i.createdAt), (counts.get(monthKey(i.createdAt)) ?? 0) + 1);
  const first = new Date(mine[0].createdAt);
  const last = monthKey(mine[mine.length - 1].createdAt);
  const months: Since['months'] = [];
  for (let y = first.getFullYear(), m = first.getMonth(); ; m++) {
    if (m > 11) {
      m = 0;
      y++;
    }
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    months.push({ month: key, count: counts.get(key) ?? 0 });
    if (key === last) break;
  }
  return { startedAt: mine[0].createdAt, months };
}
