// The Review's rows and what each tap does to them. Pure: rows in, rows out, so every rule is tested without a screen.
// A row is one coin: its front is fixed (the row's number is the front's number, 1..n) and its back can be traded. A pair the
// pairing was unsure of (or a swap left with a back of another size) is amber until he says it looks right; he can swap or leave
// out as well. Nothing here reorders a pair on its own: every change is a tap of his.
import type { Circle } from './find';
import { sizeReason, type Pair } from './pair';

export interface Row {
  /** index of the front in the Fronts photo, which is also the coin's number less one */
  front: number;
  /** index of the back in the Backs photo it is paired with now */
  back: number;
  /** why the app is unsure of this pair; empty when it is sure */
  reasons: string[];
  /** he said "Looks right" for this pair as it stands */
  looked: boolean;
  /** he left this coin out of the batch */
  out: boolean;
}

export const rowsOf = (pairs: Pair[]): Row[] => pairs.map((p) => ({ front: p.front, back: p.back, reasons: p.reasons, looked: false, out: false }));

/** An amber pair he has not looked at: it blocks Save. */
export const needsLook = (row: Row): boolean => !row.out && row.reasons.length > 0 && !row.looked;

export const kept = (rows: Row[]): Row[] => rows.filter((r) => !r.out);

/** The rows as listed: the pairs he must check first, the rest after, each group in the coins' order. */
export const listed = (rows: Row[]): Row[] => [...rows.filter((r) => !r.out && needsLook(r)), ...rows.filter((r) => !r.out && !needsLook(r))];

/** Trades the backs of rows `a` and `b` (indexes into the rows). Both pairs are marked again, by size alone: positions are what he said now. */
export function swapBacks(rows: Row[], a: number, b: number, fronts: Circle[], backs: Circle[]): Row[] {
  if (a === b || !rows[a] || !rows[b]) return rows;
  const remark = (row: Row, back: number): Row => {
    const size = sizeReason(fronts[row.front], backs[back]);
    return { ...row, back, reasons: size ? [size] : [], looked: false };
  };
  return rows.map((row, i) => (i === a ? remark(row, rows[b].back) : i === b ? remark(row, rows[a].back) : row));
}

export const leaveOut = (rows: Row[], i: number): Row[] => rows.map((r, j) => (j === i ? { ...r, out: true } : r));

export const looksRight = (rows: Row[], i: number): Row[] => rows.map((r, j) => (j === i ? { ...r, looked: true } : r));

/** How a back's size stands against its front's, in a few words. */
export function sizeWords(front: Circle, back: Circle): string {
  const reason = sizeReason(front, back);
  return reason === null ? 'Same size' : back.r < front.r ? 'Back smaller' : 'Back larger';
}
