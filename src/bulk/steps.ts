// The steps of Add many at once and what each photo of coins may say. Pure: a Look in, a line to show out.
import { COIN_SMALL_MESSAGE, COIN_TOO_SMALL_MESSAGE, coinSize } from './cut';
import type { Look } from './look';

/** Fronts, then Flip (a card, no camera), then Backs, then Review (the next story builds it; for now a stub that stores nothing). */
export type Step = 'fronts' | 'flip' | 'backs' | 'review';

export const STEP_NAME: Record<Step, string> = { fronts: 'Fronts', flip: 'Flip', backs: 'Backs', review: 'Review' };

/** The most coins in one batch: four across, three down. More is a second batch. */
export const MOST_COINS = 12;

export const FRONTS_CAPTION = "Lay the coins out with a thumb's width between them, fronts up, on a plain surface.";
export const BACKS_CAPTION = 'Hold the phone where it was. Each coin goes in its ring.';
export const FLIP_TEXT = 'Turn each coin over where it lies. Do not move it.';
export const TOUCHING = 'Two coins touch: move them apart';
export const NO_COINS = 'No coins found. Lay them on a plain surface and retake.';

/** What a photo of coins says, and whether he may go on with it. `note` is a word of warning that does not stop him. */
export interface Verdict {
  line: string;
  note: string | null;
  canGo: boolean;
}

const coins = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`;

/** The check after a photo. `fronts` is how many coins the Fronts photo had, or null while it is the Fronts photo itself.
 * Only a photo that is whole is gone on with: touching coins are never cut, so a photo with two touching is retaken. */
export function judge(look: Look, fronts: number | null): Verdict {
  if (look.touching.length > 0) return { line: TOUCHING, note: null, canGo: false };
  if (look.coins.length === 0) return { line: NO_COINS, note: null, canGo: false };
  const size = coinSize(look.diameter);
  if (size.verdict === 'refuse') return { line: COIN_TOO_SMALL_MESSAGE, note: null, canGo: false };
  const n = look.coins.length;
  if (fronts === null && n > MOST_COINS) return { line: `${coins(n)} found. ${MOST_COINS} is the most at once: use fewer.`, note: null, canGo: false };
  if (fronts !== null && n !== fronts) {
    return { line: `${fronts} ${fronts === 1 ? 'front' : 'fronts'} but ${n} ${n === 1 ? 'back' : 'backs'}`, note: null, canGo: false };
  }
  return { line: `${coins(n)} found`, note: size.verdict === 'small' ? COIN_SMALL_MESSAGE : null, canGo: true };
}
