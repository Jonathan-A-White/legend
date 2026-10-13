// The three hints: their words, their events, and that a dismissal is kept per tip in the phone's localStorage.
import { beforeEach, describe, expect, it } from 'vitest';
import { CAMERA_OPENED, GLOBE_OPENED, HINTS, TUTOR_OPENED, hints } from '../../src/tips';

beforeEach(() => window.localStorage.clear());

describe('hints', () => {
  it('has the camera, globe and tutor tips, each tied to its own event', () => {
    expect(HINTS.map((h) => [h.id, h.event, h.text])).toEqual([
      ['camera', CAMERA_OPENED, 'Front first, then back, in daylight'],
      ['globe', GLOBE_OPENED, 'Drag to turn, pinch to zoom, tap a lit country'],
      ['tutor', TUTOR_OPENED, 'Ask about the coin in front of you'],
    ]);
  });

  it('shows a tip until it is dismissed, and only that tip is gone', async () => {
    expect((await hints.nextTip(CAMERA_OPENED))?.id).toBe('camera');
    await hints.dismiss('camera');
    expect(await hints.nextTip(CAMERA_OPENED)).toBeNull();
    expect((await hints.nextTip(GLOBE_OPENED))?.id).toBe('globe');
    expect(window.localStorage.getItem('legend.tipsDismissed')).toContain('camera');
  });
});
