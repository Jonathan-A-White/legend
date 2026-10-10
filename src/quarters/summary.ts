// src/quarters/summary.ts: counting, pure. How much of a programme or a place he has, from the designs and the matches
// (src/quarters/match.ts), and the order the Checklist lists them in.
import type { Item } from '../data/db';
import type { QuarterDesign, QuarterProgram } from '../data/us';
import { designKey } from './match';

export type ProgrammeId = 'all' | QuarterProgram;

/** The picker's choices, in the order it shows them; the programmes' own order is the Checklist's order too. */
export const PROGRAMMES: { id: ProgrammeId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'state', label: '50 States' },
  { id: 'dc-territories', label: 'Territories' },
  { id: 'america-the-beautiful', label: 'America the Beautiful' },
  { id: 'washington-crossing', label: 'Crossing the Delaware' },
  { id: 'american-women', label: 'American Women' },
  { id: 'semiquincentennial', label: '2026' },
];

export const programmeLabel = (id: ProgrammeId): string => PROGRAMMES.find((p) => p.id === id)?.label ?? id;

/** The territories shown as tiles under the map (DC is on the map too: it is too small to tap there). */
export const TERRITORIES: { code: string; name: string }[] = [
  { code: 'DC', name: 'District of Columbia' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'GU', name: 'Guam' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'MP', name: 'Northern Mariana Islands' },
];

export type Owned = Map<string, Item[]>;

export interface Count {
  have: number;
  total: number;
}

/** 'all' when every design is his, 'some' when part, 'none' when none, 'off' when there are no designs to have. */
export type Lit = 'all' | 'some' | 'none' | 'off';

export const inProgramme = (designs: QuarterDesign[], id: ProgrammeId): QuarterDesign[] => (id === 'all' ? designs : designs.filter((d) => d.program === id));

/** Programme by programme in the picker's order, release order inside each. */
export function checklistOrder(designs: QuarterDesign[]): QuarterDesign[] {
  const rank = (d: QuarterDesign) => PROGRAMMES.findIndex((p) => p.id === d.program);
  return [...designs].sort((a, b) => rank(a) - rank(b) || a.order - b.order);
}

export const countOf = (designs: QuarterDesign[], owned: Owned): Count => ({ have: designs.filter((d) => owned.has(designKey(d))).length, total: designs.length });

export const litOf = ({ have, total }: Count): Lit => (total === 0 ? 'off' : have === 0 ? 'none' : have === total ? 'all' : 'some');

/** The designs of a state or territory (by alpha code), in programme and release order. */
export const designsOf = (designs: QuarterDesign[], code: string): QuarterDesign[] => checklistOrder(designs.filter((d) => d.jurisdiction === code));
