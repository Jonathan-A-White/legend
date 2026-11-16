// tests/unit/bar-floor.test.ts: when the bottom bar keeps its 48 px floor (src/nav/barFloor.ts, mw-6ww.148.51).
import { describe, expect, it } from 'vitest';
import { barOverlapsPage, readBarFloor, type BarReading } from '../../src/nav/barFloor';

const installed: BarReading = { displayMode: 'standalone', inset: 0, gap: 0 };

describe('barOverlapsPage', () => {
  it('is true for the installed app whose window is the whole screen and which reports no inset (three-button navigation)', () => {
    expect(barOverlapsPage(installed)).toBe(true);
    expect(barOverlapsPage({ ...installed, displayMode: 'minimal-ui' })).toBe(true);
  });

  it('is false in a browser tab, where the browser keeps its own bars outside the page', () => {
    expect(barOverlapsPage({ ...installed, displayMode: 'browser' })).toBe(false);
  });

  it('is false in fullscreen, where the system bars are hidden', () => {
    expect(barOverlapsPage({ ...installed, displayMode: 'fullscreen' })).toBe(false);
  });

  it('is false when the phone reports an inset: its own word is used as it is', () => {
    expect(barOverlapsPage({ ...installed, inset: 24 })).toBe(false);
  });

  it('is false when the window is shorter than the screen, the bar being outside it', () => {
    expect(barOverlapsPage({ ...installed, gap: 48 })).toBe(false);
    expect(barOverlapsPage({ ...installed, gap: 1 })).toBe(true); // rounding
  });
});

describe('readBarFloor', () => {
  it('sets data-bar-overlap on <html> only when a bar can cover the page', () => {
    const win = (standalone: boolean, screenHeight: number) =>
      ({
        document,
        screen: { height: screenHeight },
        innerHeight: 800,
        matchMedia: (q: string) => ({ matches: q === `(display-mode: ${standalone ? 'standalone' : 'browser'})` }),
      }) as unknown as Window;
    document.documentElement.removeAttribute('data-bar-checked');
    readBarFloor(win(true, 800));
    expect(document.documentElement.hasAttribute('data-bar-overlap')).toBe(true);
    readBarFloor(win(true, 848));
    expect(document.documentElement.hasAttribute('data-bar-overlap')).toBe(false);
    readBarFloor(win(false, 800));
    expect(document.documentElement.hasAttribute('data-bar-overlap')).toBe(false);
  });
});
