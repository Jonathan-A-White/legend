// src/tutor/suggestions.ts: the questions the Ask box offers on each screen, three each: a tap asks at once.
import type { AskContext } from '../services/ask';

export const SUGGESTIONS: Record<AskContext['screen'], readonly string[]> = {
  item: ['How do I grade this one?', "What's special about this year?", 'Where is the mint mark?'],
  country: ['What money did they use before?', 'Which of their coins are easy to find?', 'What is on their money today?'],
};
