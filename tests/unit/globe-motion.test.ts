// src/globe/motion.ts: a flick keeps the globe turning, slower and slower, until it rests within two seconds.
import { describe, expect, it } from 'vitest';
import { atRest, coast, flingVelocity, type Velocity } from '../../src/globe/motion';
import type { Rotation } from '../../src/globe/render';

describe('inertia', () => {
  it('decays to rest within 2 s from the fastest flick', () => {
    let rotation: Rotation = [0, 0, 0];
    // Far faster than a finger: the fling is capped.
    let velocity: Velocity = flingVelocity([{ t: 0, rotation: [0, 0, 0] }, { t: 10, rotation: [60, 40, 0] }], 10);
    let elapsed = 0;
    let previous = Infinity;
    while (!atRest(velocity)) {
      ({ rotation, velocity } = coast(rotation, velocity, 16));
      elapsed += 16;
      const speed = Math.hypot(...velocity);
      expect(speed).toBeLessThan(previous);
      previous = speed;
      expect(elapsed).toBeLessThanOrEqual(2000);
    }
    expect(elapsed).toBeGreaterThan(200);
    expect(rotation).not.toEqual([0, 0, 0]);
  });

  it('keeps the globe upright: the tilt stops at the poles', () => {
    const { rotation } = coast([0, 80, 0], [0, 1], 100);
    expect(rotation[1]).toBe(90);
  });

  it('a finger that stopped before it lifted throws nothing', () => {
    expect(flingVelocity([{ t: 0, rotation: [0, 0, 0] }, { t: 16, rotation: [2, 0, 0] }], 200)).toEqual([0, 0]);
    expect(atRest(flingVelocity([{ t: 0, rotation: [0, 0, 0] }], 0))).toBe(true);
  });

  it('turns the short way across the date line', () => {
    const [vLon] = flingVelocity([{ t: 0, rotation: [179, 0, 0] }, { t: 16, rotation: [-179, 0, 0] }], 16);
    expect(vLon).toBeCloseTo(2 / 16, 5);
  });
});
