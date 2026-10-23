// src/wishlist/wishForm.ts: What is the asking price? as the tutor's door sees it (src/tutor/FormDoor.tsx): the form (Asking price, Where?) and
// wish-for, the confirm command that Add to Wish list and the tutor's Send both run, so one path keeps the coin as wished.
import { formCommand, type FormSpec } from 'voice-kit/forms';
import type { Command } from 'voice-kit/talks';
import { wishFor } from '../data/repositories';
import { moneyText, parseMoney } from './tally';

export const WISH_COMMAND = 'wish-for';
/** The longest store name the sheet takes. */
export const STORE_MAX = 60;
export const ASKING_LABEL = 'Asking price (US dollars)';
export const STORE_LABEL = 'Where? (the store’s name, if you like)';

export const WISH_FORM: FormSpec = {
  name: 'What is the asking price?',
  fields: [
    { name: 'asking', label: ASKING_LABEL, hint: 'Required: dollars, such as 4.50.', required: true, kind: 'text', maxLength: 20 },
    { name: 'store', label: STORE_LABEL, required: false, kind: 'text', maxLength: STORE_MAX },
  ],
};

export interface WishDeps {
  itemId: string;
  onWishing(): void;
  onDone(): void;
  /** the call threw or the price was not money: the sheet lets him edit again */
  onFailed?(): void;
}

export function wishForCommand(deps: WishDeps): Command {
  return formCommand(WISH_FORM, {
    name: WISH_COMMAND,
    tell: 'Keeps the coin on his Wish list with the asking price in US dollars and, if he gave one, the store where he saw it',
    offer: ({ asking, store }) => {
      const price = parseMoney(asking ?? '');
      return `Add to the Wish list at ${price === null ? asking : moneyText(price)}${store ? ` from ${store}` : ''}?`;
    },
    async send(values) {
      const price = parseMoney(values.asking ?? '');
      if (price === null) throw new Error(`"${values.asking ?? ''}" is not a price in dollars`);
      deps.onWishing();
      try {
        await wishFor(deps.itemId, price, values.store ?? '');
      } catch (error) {
        deps.onFailed?.();
        throw error;
      }
      deps.onDone();
      return { said: 'Added to your Wish list.' };
    },
  });
}
