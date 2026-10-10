// src/feedback/index.ts: Tell the maker. The entry other modules import: the button for a screen's bar, the Settings button and the
// hook the shell uses to send what waits in the outbox.
export { FeedbackButton, TellTheMakerButton } from './FeedbackButton';
export type { FeedbackScreen } from './FeedbackButton';
export { sendWaiting } from './outbox';
export { useSendWaiting } from './useSendWaiting';
