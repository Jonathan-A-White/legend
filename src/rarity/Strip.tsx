// src/rarity/Strip.tsx: a series from one mint as a strip of bars, one per year or design, the height how many were struck (on a
// log scale: the early years were struck in the hundred-thousands, the later ones in the hundred-millions) and this coin's bar in
// the accent colour. No axis and no numbers: the place sentence is its aria-label. Pure from the rows.
import type { MintageRow } from '../data/us';

const BAR = 3;
const GAP = 1;
const HEIGHT = 56;
const FLOOR = 6;

const sameRow = (a: MintageRow, b: MintageRow): boolean => a.year === b.year && a.mint === b.mint && a.design === b.design && a.variety === b.variety;

export function Strip({ rows, mine, label }: { rows: readonly MintageRow[]; mine: MintageRow; label: string }) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const logs = sorted.map((r) => Math.log10(Math.max(r.struck, 1)));
  const low = Math.min(...logs);
  const span = Math.max(Math.max(...logs) - low, 1e-9);
  const width = sorted.length * (BAR + GAP) - GAP;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${HEIGHT}`} preserveAspectRatio="none" className="h-14 w-full">
      {sorted.map((row, i) => {
        const height = FLOOR + ((logs[i] - low) / span) * (HEIGHT - FLOOR);
        const isMine = sameRow(row, mine);
        return (
          <rect
            key={`${row.year}-${row.design ?? ''}-${row.variety ?? ''}`}
            x={i * (BAR + GAP)}
            y={HEIGHT - height}
            width={BAR}
            height={Math.round(height * 100) / 100}
            data-year={row.year}
            {...(isMine ? { 'data-mine': 'true' } : {})}
            className={isMine ? 'fill-accent' : 'fill-muted/40'}
          />
        );
      })}
    </svg>
  );
}
