// src/quarters/Checklist.tsx: every design of the chosen programme in order (programme, then release), a tick on each one he has.
import type { QuarterDesign } from '../data/us';
import { DesignRow } from './DesignRow';
import { designKey } from './match';
import { checklistOrder, type Owned } from './summary';

export function Checklist({ designs, owned, showProgramme }: { designs: QuarterDesign[]; owned: Owned; showProgramme: boolean }) {
  return (
    <ul aria-label="Checklist" className="rounded-2xl border border-line bg-surface">
      {checklistOrder(designs).map((d) => (
        <DesignRow key={designKey(d)} design={d} items={owned.get(designKey(d)) ?? []} showProgramme={showProgramme} />
      ))}
    </ul>
  );
}
