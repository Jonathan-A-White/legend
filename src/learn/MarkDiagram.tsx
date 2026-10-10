// src/learn/MarkDiagram.tsx: a simple drawing of one face of a coin with a ring where the mint mark sits. No photos: a disc, a rim, a
// head or an emblem in the middle, the date, and the mark. The spots follow the placement text in mints.json (series and era).

type Spot = { side: 'front' | 'back'; date: [number, number]; mark: [number, number] };

/** Where the mark sits on each series, one spot per era of `placement` in mints.json, in order. Drawn in a 100 x 100 box. */
const SPOTS: Record<string, Spot[]> = {
  'Lincoln cent': [{ side: 'front', date: [62, 72], mark: [62, 84] }],
  'Jefferson nickel': [
    { side: 'back', date: [50, 90], mark: [80, 68] },
    { side: 'front', date: [58, 84], mark: [78, 74] },
  ],
  'Roosevelt dime': [
    { side: 'back', date: [50, 90], mark: [36, 80] },
    { side: 'front', date: [56, 88], mark: [56, 76] },
  ],
  'Washington quarter': [
    { side: 'back', date: [50, 93], mark: [50, 84] },
    { side: 'front', date: [50, 92], mark: [78, 62] },
  ],
};

export function MarkDiagram({ series, era, label }: { series: string; era: number; label: string }) {
  const spot = SPOTS[series]?.[era];
  if (!spot) return null;
  const front = spot.side === 'front';
  return (
    <figure className="flex w-32 shrink-0 flex-col items-center gap-1">
      <svg viewBox="0 0 100 100" role="img" aria-label={label} className="h-28 w-28">
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-line" />
        {front ? (
          <>
            <circle cx="42" cy="38" r="13" fill="currentColor" className="text-line" />
            <path d="M18 72c4-14 14-18 24-18s20 4 24 18Z" fill="currentColor" className="text-line" />
          </>
        ) : (
          <rect x="26" y="30" width="48" height="30" rx="4" fill="currentColor" className="text-line" />
        )}
        <text x={spot.date[0]} y={spot.date[1]} fontSize="8" textAnchor="middle" fill="currentColor" className="text-muted">
          DATE
        </text>
        <circle cx={spot.mark[0]} cy={spot.mark[1]} r="6.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
        <text x={spot.mark[0]} y={spot.mark[1] + 3} fontSize="9" fontWeight="700" textAnchor="middle" fill="currentColor" className="text-accent">
          D
        </text>
      </svg>
      <figcaption className="text-center text-sm text-muted">{front ? 'Front' : 'Back'}</figcaption>
    </figure>
  );
}
