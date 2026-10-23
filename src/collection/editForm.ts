// src/collection/editForm.ts: Edit as the tutor's door sees it (src/tutor/FormDoor.tsx). The kit takes at most eight fields (MAX_FORM_FIELDS) and
// Edit has twelve: the form is the eight the tutor is most likely asked for (Kind, Country, Denomination, Year, Mint mark, Grade guess,
// Inscription, Tags); Subtype, Series, Design and Material stay his by hand, and edit-coin (src/tutor/formCommands.ts) saves them as the sheet
// holds them. Kind, Country and Grade guess are choices among the sheet's own lists.
import type { FormSpec } from 'voice-kit/forms';
import { choiceField, GRADE_OPTIONS, MINT_MARK_MAX, optionsWith, YEAR_MAX } from '../capture/confirmForm';
import type { CountryOption } from '../capture/useCountries';
import type { Item } from '../data/db';
import { KINDS, KIND_ORDER } from '../data/kinds';
import { countryLabel, EDIT_COMMAND, gradeLabel } from '../tutor/formCommands';

export { EDIT_COMMAND };

export function editForm(countries: readonly CountryOption[], item: Pick<Item, 'country' | 'gradeGuess'>): FormSpec {
  return {
    name: 'Edit',
    fields: [
      { name: 'kind', label: 'Kind', required: true, kind: 'choice', options: KIND_ORDER.map((k) => KINDS[k].label) },
      choiceField({ name: 'country', label: 'Country', required: false }, optionsWith(countries.map((c) => c.name), countryLabel(countries, item.country ?? ''))),
      { name: 'denomination', label: 'Denomination', hint: 'Such as Quarter dollar or Five pounds.', required: false, kind: 'text' },
      { name: 'year', label: 'Year', hint: 'Four digits, such as 1964.', required: false, kind: 'text', maxLength: YEAR_MAX },
      { name: 'mintMark', label: 'Mint mark', hint: 'A letter such as D, S or P, if there is one.', required: false, kind: 'text', maxLength: MINT_MARK_MAX },
      choiceField({ name: 'grade', label: 'Grade guess', required: false }, optionsWith(GRADE_OPTIONS, item.gradeGuess ? gradeLabel(item.gradeGuess) : '')),
      { name: 'inscription', label: 'Inscription', hint: 'The words on the piece.', required: false, kind: 'text' },
      { name: 'tags', label: 'Tags', hint: 'Words separated by commas, such as silver, gift.', required: false, kind: 'text' },
    ],
  };
}
