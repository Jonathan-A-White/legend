// src/quarters/UsMap.tsx: the map of the United States, one SVG path per state, lit by how many of its quarters he has
// (solid gold: all; half gold: some; dark: none) and a row of tiles under it for the territories (and DC, too small to hit on
// the map). A state and a tile are buttons: a tap opens that place's sheet.
import type { StatesMap } from './topo';
import { TERRITORIES, type Lit } from './summary';

export interface Place {
  lit: Lit;
  have: number;
  total: number;
}

const FILL: Record<Lit, string> = {
  all: 'fill-accent',
  some: 'fill-accent/45',
  none: 'fill-muted/25',
  off: 'fill-muted/10',
};

const TILE: Record<Lit, string> = {
  all: 'bg-accent text-accent-fg border-accent',
  some: 'bg-accent/45 text-ink border-accent/60',
  none: 'bg-muted/20 text-ink border-line',
  off: 'bg-transparent text-muted border-line opacity-60',
};

const describe = (name: string, p: Place) => (p.total === 0 ? `${name}: no quarters in this programme` : `${name}: you have ${p.have} of ${p.total}`);

export function UsMap({ map, placeOf, onOpen }: { map: StatesMap; placeOf: (code: string) => Place; onOpen: (code: string) => void }) {
  return (
    <>
      <svg viewBox={map.viewBox} role="group" aria-label="Map of the United States" className="mx-auto block h-auto w-full max-w-xl">
        {map.paths.map(({ code, name, d }) => {
          const place = placeOf(code);
          return (
            <path
              key={code}
              d={d}
              data-state={code}
              data-lit={place.lit}
              role="button"
              tabIndex={0}
              aria-label={describe(name, place)}
              className={`${FILL[place.lit]} cursor-pointer stroke-canvas outline-none focus-visible:stroke-ink`}
              strokeWidth={1.5}
              strokeLinejoin="round"
              onClick={() => onOpen(code)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(code);
                }
              }}
            />
          );
        })}
      </svg>
      <div className="mt-3 grid grid-cols-6 gap-2" aria-label="Territories" role="group">
        {TERRITORIES.map(({ code, name }) => {
          const place = placeOf(code);
          return (
            <button
              key={code}
              type="button"
              data-territory={code}
              data-lit={place.lit}
              aria-label={describe(name, place)}
              onClick={() => onOpen(code)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl border ${TILE[place.lit]}`}
            >
              <span className="text-lg font-semibold">{code}</span>
              <span className="text-sm tabular-nums">{place.total === 0 ? '–' : `${place.have}/${place.total}`}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
