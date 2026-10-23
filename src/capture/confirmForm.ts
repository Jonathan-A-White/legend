// src/capture/confirmForm.ts: Change what is wrong (the Confirm sheet's Not quite) as the tutor's door sees it (src/tutor/FormDoor.tsx): its
// eight fields. Country and Grade guess are choices among the sheet's own lists; confirm-coin (src/tutor/formCommands.ts) is the confirm
// command that the sheet's Save and the tutor's Send both run.
import type { FormField, FormSpec } from 'voice-kit/forms';
import type { Item } from '../data/db';
import { GRADES } from '../data/grades';
import { CONFIRM_COMMAND, countryLabel, gradeLabel } from '../tutor/formCommands';
import type { CountryOption } from './useCountries';

export { CONFIRM_COMMAND };
export const YEAR_MAX = 4;
export const MINT_MARK_MAX = 12;

/** The options of a choice: the sheet's list, and the value the coin holds now when the list does not have it, so the sheet's own Save is never refused. */
export function optionsWith(list: readonly string[], now: string): string[] {
  return now && !list.includes(now) ? [...list, now] : [...list];
}

/** A choice among `options`; with none to choose from (the countries are still loading) it is text. */
export function choiceField(base: Omit<FormField, 'kind' | 'options'>, options: readonly string[]): FormField {
  return options.length > 0 ? { ...base, kind: 'choice', options } : { ...base, kind: 'text' };
}

export const GRADE_OPTIONS: readonly string[] = GRADES.map(([code]) => gradeLabel(code));

export function confirmForm(countries: readonly CountryOption[], item: Pick<Item, 'country' | 'gradeGuess'>): FormSpec {
  return {
    name: 'Change what is wrong',
    fields: [
      choiceField({ name: 'country', label: 'Country', required: false }, optionsWith(countries.map((c) => c.name), countryLabel(countries, item.country ?? ''))),
      { name: 'denomination', label: 'Denomination', hint: 'Such as Quarter dollar or Five pounds.', required: false, kind: 'text' },
      { name: 'year', label: 'Year', hint: 'Four digits, such as 1964.', required: false, kind: 'text', maxLength: YEAR_MAX },
      { name: 'mintMark', label: 'Mint mark', hint: 'A letter such as D, S or P, if the coin has one.', required: false, kind: 'text', maxLength: MINT_MARK_MAX },
      { name: 'series', label: 'Series', required: false, kind: 'text' },
      { name: 'design', label: 'Design', required: false, kind: 'text' },
      choiceField({ name: 'grade', label: 'Grade guess', required: false }, optionsWith(GRADE_OPTIONS, item.gradeGuess ? gradeLabel(item.gradeGuess) : '')),
      { name: 'inscription', label: 'Inscription', hint: 'The words on the coin.', required: false, kind: 'text' },
    ],
  };
}
