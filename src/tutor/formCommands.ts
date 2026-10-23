// src/tutor/formCommands.ts: confirm-coin and edit-coin, the confirm commands that Change what is wrong's and Edit's own Save and the tutor's
// Send both run (src/tutor/FormDoor.tsx), so one path writes the coin. Each turns what the form holds (a country by its name, a grade by its
// label, the year as text) into the changes updateItem takes. The choice lists are the sheets' own: the countries they draw and GRADES.
import { formCommand, type FormArgs, type FormSpec } from 'voice-kit/forms';
import type { Command } from 'voice-kit/talks';
import type { CountryOption } from '../capture/useCountries';
import { parseTags } from '../collection/fields';
import type { ItemKind } from '../data/db';
import { GRADES } from '../data/grades';
import { KINDS, KIND_ORDER } from '../data/kinds';
import { updateItem, type ItemChanges } from '../data/repositories';

export const CONFIRM_COMMAND = 'confirm-coin';
export const EDIT_COMMAND = 'edit-coin';

/** How a grade reads in the sheets' lists and in the choice the tutor answers from: 'VF · Very Fine'. */
export const gradeLabel = (code: string): string => {
  const known = GRADES.find(([c]) => c === code);
  return known ? `${known[0]} · ${known[1]}` : code;
};
/** The grade code a label stands for (a code the lists do not know stands for itself); '' for no guess. */
export const gradeOfLabel = (label: string | undefined): string => (label ? (GRADES.find(([c]) => gradeLabel(c) === label)?.[0] ?? label) : '');

/** How a country reads as a choice: its name, or its code when the list does not have it. */
export const countryLabel = (countries: readonly CountryOption[], code: string): string => (code ? (countries.find((c) => c.code === code)?.name ?? code) : '');
/** The country code a label stands for: by name, else by code; '' for none. */
export const countryOfLabel = (countries: readonly CountryOption[], label: string | undefined): string => {
  if (!label) return '';
  const wanted = label.trim().toLowerCase();
  return countries.find((c) => c.name.toLowerCase() === wanted)?.code ?? countries.find((c) => c.code.toLowerCase() === wanted)?.code ?? label.trim();
};

export const kindLabel = (kind: ItemKind): string => KINDS[kind].label;
export const kindOfLabel = (label: string | undefined): ItemKind => KIND_ORDER.find((k) => KINDS[k].label === label) ?? 'coin';

/** The year the form holds: a whole number of at most four digits, or none. */
export function yearOfText(text: string | undefined): number | null {
  const year = (text ?? '').trim();
  if (year === '') return null;
  if (!/^\d{1,4}$/.test(year)) throw new Error(`"${year}" is not a year: use up to four digits, such as 1932`);
  return Number(year);
}

const orNull = (text: string | undefined): string | null => text?.trim() || null;

export interface SheetCoinDeps {
  itemId: string;
  /** the countries the sheet draws, to turn a name back into its code */
  countries: readonly CountryOption[];
  onSaving(): void;
  onDone(): void;
  /** the save threw: the sheet lets him edit again */
  onFailed?(): void;
}

/** Runs the write: tells the sheet it is saving, saves once, tells it when done, and on a failure lets it edit again. */
async function save(deps: SheetCoinDeps, changes: ItemChanges): Promise<void> {
  deps.onSaving();
  try {
    await updateItem(deps.itemId, changes);
  } catch (error) {
    deps.onFailed?.();
    throw error;
  }
  deps.onDone();
}

const nameOf = (values: FormArgs): string => [values.denomination?.trim(), values.year, values.country].filter(Boolean).join(', ');

/** Change what is wrong (the Confirm sheet's Not quite): saves what is on the form and confirms the coin. */
export function confirmCoinCommand(form: FormSpec, deps: SheetCoinDeps): Command {
  return formCommand(form, {
    name: CONFIRM_COMMAND,
    tell: 'Saves the changes to the coin the photo reader got wrong (country, denomination, year, mint mark, series, design, grade guess, inscription) and confirms the coin',
    offer: (values) => `Save these changes and confirm${nameOf(values) ? `: ${nameOf(values)}` : ' it'}?`,
    async send(values) {
      await save(deps, {
        country: countryOfLabel(deps.countries, values.country) || null,
        denomination: (values.denomination ?? '').trim(),
        year: yearOfText(values.year),
        mintMark: orNull(values.mintMark),
        series: orNull(values.series),
        design: orNull(values.design),
        gradeGuess: gradeOfLabel(values.grade) || null,
        inscription: (values.inscription ?? '').trim(),
        status: 'confirmed',
      });
      return { said: 'Saved, and confirmed.' };
    },
  });
}

/** What Edit holds that its form (at most eight fields) does not carry: the sheet gives these as they are now. */
export interface EditRest {
  subtype: string;
  series: string;
  design: string;
  material: string;
}

export interface EditCoinDeps extends SheetCoinDeps {
  rest(): EditRest;
}

/** Edit: saves the form's fields and the ones the tutor does not ask about, as the sheet holds them. */
export function editCoinCommand(form: FormSpec, deps: EditCoinDeps): Command {
  return formCommand(form, {
    name: EDIT_COMMAND,
    tell: 'Saves the changes to the coin on Edit (kind, country, denomination, year, mint mark, grade guess, inscription, tags); the other fields stay as they are',
    offer: (values) => `Save these changes${nameOf(values) ? ` to ${nameOf(values)}` : ''}?`,
    async send(values) {
      const kind = kindOfLabel(values.kind);
      const rest = deps.rest();
      await save(deps, {
        kind,
        subtype: kind === 'other' ? orNull(rest.subtype) : null,
        country: countryOfLabel(deps.countries, values.country) || null,
        denomination: (values.denomination ?? '').trim(),
        year: yearOfText(values.year),
        mintMark: orNull(values.mintMark),
        series: orNull(rest.series),
        design: orNull(rest.design),
        material: rest.material.trim(),
        gradeGuess: gradeOfLabel(values.grade) || null,
        inscription: (values.inscription ?? '').trim(),
        tags: parseTags(values.tags ?? ''),
      });
      return { said: 'Saved.' };
    },
  });
}
