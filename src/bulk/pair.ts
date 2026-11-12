// Pair each front to the back that lies where it lay: a pure function of the coins' circles.
// It pairs by position and size alone. It never uses the order the coins were photographed in, a year the reader
// guessed, or any silent correction; a pair it is unsure of is flagged with every reason, and left where it is.
import type { Circle } from './find';

export const SIZE_SMALLER = 'The back is smaller than the front';
export const SIZE_LARGER = 'The back is larger than the front';
export const CLOSE_TO_ANOTHER = 'This front is close to another coin';

/** A back whose radius differs from its front's by more than this share of the front's is flagged. */
const SIZE_GAP = 0.05;
/** A pair is flagged when its next-best back costs less than this many times its own. */
const MARGIN = 2;

export interface PairOptions {
  /** The whole tray was turned like a page, so the backs' x is mirrored about the tray's middle first. Default false. */
  mirrored?: boolean;
}

export interface Pair {
  /** Index into the fronts given. */
  front: number;
  /** Index into the backs given (as given, before any mirroring). */
  back: number;
  /** Every reason this pair is unsure, in a fixed order; empty when it is sure. */
  reasons: string[];
}

export type Paired =
  | { ok: true; /** One pair per front, in the fronts' order. */ pairs: Pair[] }
  | { ok: false; fronts: number; backs: number; message: string };

/** The cost of putting a back with a front: the distance between the centres plus the difference of radii, in the front's radii. */
function cost(front: Circle, back: Circle): number {
  return (Math.hypot(front.x - back.x, front.y - back.y) + Math.abs(front.r - back.r)) / front.r;
}

/** The x of the tray's middle: the line a tray turned like a page was turned about. */
function middleOf(fronts: Circle[], backs: Circle[]): number {
  // If the backs are the fronts' mirror image, the two extents are mirror images of each other about the tray's middle,
  // so the middle of everything seen is the middle of the tray.
  const all = [...fronts, ...backs];
  const left = Math.min(...all.map((c) => c.x - c.r));
  const right = Math.max(...all.map((c) => c.x + c.r));
  return (left + right) / 2;
}

/** The one-to-one assignment of least total cost (the Hungarian method, O(n^3)): row i is given column result[i]. */
function assign(costs: number[][]): number[] {
  const n = costs.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const owner = new Array<number>(n + 1).fill(0); // owner[j]: the row (1-based) holding column j
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    owner[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = owner[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = costs[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[owner[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (owner[j0] !== 0);
    do {
      const j1 = way[j0];
      owner[j0] = owner[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const result = new Array<number>(n).fill(0);
  for (let j = 1; j <= n; j++) result[owner[j] - 1] = j - 1;
  return result;
}

/**
 * Pair fronts to backs. Unequal counts are refused, never paired. Otherwise every front gets exactly one back, the
 * pairing of least total cost, and the pairs come out in the fronts' order. A pair is flagged when the back's size
 * is more than 5% off its front's, and when its front's next-best back costs less than twice its own.
 */
export function pairCoins(fronts: Circle[], backs: Circle[], options: PairOptions = {}): Paired {
  if (fronts.length !== backs.length) {
    return {
      ok: false,
      fronts: fronts.length,
      backs: backs.length,
      message: `${fronts.length} fronts but ${backs.length} backs`,
    };
  }
  const middle = options.mirrored ? middleOf(fronts, backs) : 0;
  const placed = options.mirrored ? backs.map((b) => ({ ...b, x: 2 * middle - b.x })) : backs;
  const costs = fronts.map((f) => placed.map((b) => cost(f, b)));
  const chosen = assign(costs);
  const pairs = fronts.map((front, i): Pair => {
    const back = chosen[i];
    const reasons: string[] = [];
    const gap = (placed[back].r - front.r) / front.r;
    if (Math.abs(gap) > SIZE_GAP) reasons.push(gap < 0 ? SIZE_SMALLER : SIZE_LARGER);
    const others = costs[i].filter((_, j) => j !== back);
    if (others.length > 0 && Math.min(...others) < MARGIN * costs[i][back]) reasons.push(CLOSE_TO_ANOTHER);
    return { front: i, back, reasons };
  });
  return { ok: true, pairs };
}
