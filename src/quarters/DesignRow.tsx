// src/quarters/DesignRow.tsx: one quarter design as a row: a tick when he has it, the year, the name and what is on it. A design
// he has is a link to the first item that matches it ("x2" when more); one he lacks is plain text. The Checklist and the State
// sheet both draw this.
import type { Item } from '../data/db';
import type { QuarterDesign } from '../data/us';
import { itemHash } from '../nav/route';
import { programmeLabel } from './summary';

function Tick({ have }: { have: boolean }) {
  return have ? (
    <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
    </span>
  ) : (
    <span aria-hidden="true" className="size-7 shrink-0 rounded-full border-2 border-line" />
  );
}

export function DesignRow({ design, items, showProgramme = false }: { design: QuarterDesign; items: Item[]; showProgramme?: boolean }) {
  const have = items.length > 0;
  const body = (
    <>
      <Tick have={have} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-base text-muted tabular-nums">{design.year}</span>
          <span className="text-lg font-medium">{design.name}</span>
        </span>
        <span className="block text-base text-muted">{showProgramme ? `${programmeLabel(design.program)}: ${design.design}` : design.design}</span>
      </span>
      {items.length > 1 ? <span className="shrink-0 text-base text-muted">×{items.length}</span> : null}
      <span className="sr-only">{have ? 'You have this one.' : 'Missing.'}</span>
    </>
  );
  const rowClass = `flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 ${have ? '' : 'opacity-80'}`;
  return (
    <li data-design={`${design.program}#${design.order}`} data-program={design.program} data-year={design.year} data-have={have}>
      {have ? (
        <a href={itemHash(items[0].id)} className={rowClass}>
          {body}
        </a>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}
