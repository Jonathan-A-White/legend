// src/learn/grading.ts: the Sheldon ladder as bands, where a stored guess sits on it, and the three-question walk. Pure.
import type { Grade } from '../data/us';

export interface Band {
  /** 'VF' */
  band: string;
  /** 'Very Fine' */
  name: string;
  /** the band's steps, best first */
  steps: Grade[];
}

const ALIASES: Record<string, string> = { P: 'PO', EF: 'XF' };

/** 'VF-20' -> 'VF' */
export const bandOfCode = (code: string): string => code.split('-')[0];

/** The ladder as bands from the top (MS) to the foot (PO), each band's steps best first. */
export function bandsOf(grades: readonly Grade[]): Band[] {
  const out: Band[] = [];
  for (const g of [...grades].sort((a, b) => b.from - a.from)) {
    const band = bandOfCode(g.code);
    const last = out[out.length - 1];
    if (last && last.band === band) last.steps.push(g);
    else out.push({ band, name: g.name, steps: [g] });
  }
  return out;
}

export interface Placed {
  band: string;
  /** the exact step, when the guess names one; null for a guess like 'VF' */
  code: string | null;
}

/** Where a gradeGuess ('VF', 'vf-30', 'MS65', 'EF') sits on the ladder, or null when it names nothing on it. */
export function placeGuess(grades: readonly Grade[], guess: string | null | undefined): Placed | null {
  const match = /^([A-Za-z]+)[\s-]?(\d{1,2})?$/.exec((guess ?? '').trim());
  if (!match) return null;
  const letters = match[1].toUpperCase();
  const band = ALIASES[letters] ?? letters;
  if (!grades.some((g) => bandOfCode(g.code) === band)) return null;
  if (match[2] === undefined) return { band, code: null };
  const n = Number(match[2]);
  const step = grades.find((g) => g.from <= n && n <= g.to && bandOfCode(g.code) === band);
  return step ? { band, code: step.code } : null;
}

export type Yes = 'yes' | 'no';
export type Points = 'yes' | 'little' | 'no';
export interface Answers {
  date: Yes;
  points: Points;
  shine: Yes;
}

export const WALK_QUESTIONS = [
  { id: 'date', text: 'Can you read the date?', options: [['yes', 'Yes'], ['no', 'No']] },
  { id: 'points', text: 'Are the high points flat?', options: [['yes', 'Yes'], ['little', 'A little'], ['no', 'No']] },
  { id: 'shine', text: 'Is there shine in the fields?', options: [['yes', 'Yes'], ['no', 'No']] },
] as const;

/** The band three plain answers point to: a rough guide, never a grade. */
export function walkBand({ date, points, shine }: Answers): string {
  if (date === 'no') return 'AG';
  if (points === 'yes') return shine === 'yes' ? 'F' : 'VG';
  if (points === 'little') return shine === 'yes' ? 'XF' : 'VF';
  return shine === 'yes' ? 'MS' : 'AU';
}
