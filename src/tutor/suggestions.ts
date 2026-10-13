// src/tutor/suggestions.ts: the questions the Ask box offers on each screen, three each: a tap asks at once. An Other piece (a token, a
// medal) has no grade or mint mark to ask about, so its three are about the piece: what it was used for, whether it is rare, how to tell
// a real one.
import type { ItemKind } from '../data/db';
import type { AskContext } from '../services/ask';

export const SUGGESTIONS: Record<AskContext['screen'], readonly string[]> = {
  item: ['How do I grade this one?', 'How rare is it?', 'Where is the mint mark?'],
  country: ['What money did they use before?', 'Which of their coins are easy to find?', 'What is on their money today?'],
};

/** What the Ask box is about, as far as its questions go. */
export interface SuggestionTopic {
  screen: AskContext['screen'];
  kind: ItemKind | null;
  subtype: string | null;
}

/** 'Subway token' reads 'subway token' in a sentence; 'NYC token' keeps its capitals. */
const inSentence = (subtype: string): string => (/^[A-Z][a-z]/.test(subtype) ? subtype[0].toLowerCase() + subtype.slice(1) : subtype);

export function suggestionsFor({ screen, kind, subtype }: SuggestionTopic): readonly string[] {
  if (screen !== 'item' || kind !== 'other') return SUGGESTIONS[screen];
  const name = subtype?.trim() ? inSentence(subtype.trim()) : 'piece';
  return [`What was this ${name} used for?`, 'Is it rare?', 'How can I tell a real one?'];
}
