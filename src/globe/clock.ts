// src/globe/clock.ts: the globe's one seam on time: frames, timers and the time now. The app uses the browser's; a test puts
// its own hand-turned clock in place (tests/support/manual-clock.ts) by assigning to these members.
export interface Clock {
  now(): number;
  frame(callback: (time: number) => void): number;
  cancelFrame(id: number): void;
  later(callback: () => void, ms: number): number;
  cancelLater(id: number): void;
}

export const clock: Clock = {
  now: () => performance.now(),
  frame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  later: (callback, ms) => window.setTimeout(callback, ms),
  cancelLater: (id) => window.clearTimeout(id),
};
