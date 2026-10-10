// src/globe/view.ts: how the globe was left (its rotation, the country picked), kept for this page's life so the globe is as
// he left it when he comes back from a country.
import type { Rotation } from './render';

export const view: { rotation: Rotation | null; picked: string | null } = { rotation: null, picked: null };

/** For tests: the next globe opens fresh. */
export function forgetGlobeView(): void {
  view.rotation = null;
  view.picked = null;
}
