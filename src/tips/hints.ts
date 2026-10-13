// src/tips/hints.ts: the one-time tips that sit on a screen where they help, from Lampas's src/tips/hints.ts. The list of tips, "which
// one shows now" and "dismissed for good" are bsv-kit's (bsv-kit/tips); this file is Legend's list and the storage it keeps the
// dismissals in (the phone's localStorage, key 'legend.tipsDismissed'). The tips are written here: no grind is asked for them. A later
// tip is one more entry in HINTS and an event name for the screen that draws it.
import { tips } from 'bsv-kit/tips';

/** The events a tip is tied to: a screen draws `<HintCard event={…} />` when it opens. */
export const CAMERA_OPENED = 'camera-opened';
export const GLOBE_OPENED = 'globe-opened';
export const TUTOR_OPENED = 'tutor-opened';

export const HINTS: readonly tips.Tip[] = [
  { id: 'camera', text: 'Front first, then back, in daylight', event: CAMERA_OPENED },
  { id: 'globe', text: 'Drag to turn, pinch to zoom, tap a lit country', event: GLOBE_OPENED },
  { id: 'tutor', text: 'Ask about the coin in front of you', event: TUTOR_OPENED },
];

/** localStorage, or nothing when the phone refuses it: then the tip shows again, which is harmless. */
const storage: tips.TipStorage = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // not kept
    }
  },
};

export const hints = tips.createTips({ tips: HINTS, storage, key: 'legend.tipsDismissed' });
