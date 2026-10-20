// src/ui/legendComposer.ts: how voice-kit's Composer works wherever Legend draws one (the tutor box, the Tell the maker sheet): hold the bar to
// talk, letting go leaves the words in the box to be fixed and Send sends them, typing is offered, and there is no attach or camera (neither
// form takes a file through it). One constant, so the two forms cannot drift apart.
import type { ComposerSettings } from 'voice-kit/composer';

export const LEGEND_COMPOSER_SETTINGS: Partial<ComposerSettings> = {
  talk: 'hold',
  send: 'button',
  type: true,
  attach: false,
  camera: false,
};
