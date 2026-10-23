// src/tutor/index.ts: the tutor. A screen opens the Ask sheet over itself when its address carries ?ask (askHash in src/nav/route.ts);
// the question goes as a legend-ask grist (src/services/ask.ts) with what the screen knows (request.ts). FormDoor is 'Let the tutor do it' on a
// form (formRequest.ts): the same grind with `form` in the request.
export { AskSheet } from './AskSheet';
export { FormDoor } from './FormDoor';
export type { AskAbout } from './request';
export type { OnAnswer } from './useAsk';
export { SUGGESTIONS } from './suggestions';
