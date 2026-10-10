// src/tutor/index.ts: the tutor. A screen opens the Ask sheet over itself when its address carries ?ask (askHash in src/nav/route.ts);
// the question goes as a legend-ask grist (src/services/ask.ts) with what the screen knows (request.ts).
export { AskSheet } from './AskSheet';
export type { AskAbout } from './request';
export type { OnAnswer } from './useAsk';
export { SUGGESTIONS } from './suggestions';
