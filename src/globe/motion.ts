// src/globe/motion.ts: what keeps the globe moving with no finger on it. A flick carries on and slows to rest (inertia); the
// globe turns to a searched country; untouched, it turns slowly on its own. Speeds are degrees per millisecond.
import type { Rotation } from './render';

/** [longitude, latitude] degrees per ms */
export type Velocity = readonly [number, number];

/** A flick never throws the globe faster than this (about a quarter turn in a fifth of a second). */
const MAX_SPEED = 1.2;
/** The speed falls by e every this many ms. */
const DECAY_MS = 260;
/** Slower than this is at rest: under a twentieth of a degree a frame. */
const REST_SPEED = 0.003;
/** A finger that lay still this long before lifting throws nothing. */
const STILL_MS = 80;
/** The idle spin: a full turn a minute. */
export const SPIN_SPEED = 0.006;

export interface Sample {
  t: number;
  rotation: Rotation;
}

/** The longitude change from a to b the short way round. */
const wrap = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/** The velocity of the last two samples of a drag, as the finger lifts at `now`. */
export function flingVelocity(samples: readonly Sample[], now: number): Velocity {
  if (samples.length < 2) return [0, 0];
  const a = samples[samples.length - 2];
  const b = samples[samples.length - 1];
  const dt = b.t - a.t;
  if (dt <= 0 || now - b.t > STILL_MS) return [0, 0];
  const v: [number, number] = [wrap(b.rotation[0] - a.rotation[0]) / dt, (b.rotation[1] - a.rotation[1]) / dt];
  const speed = Math.hypot(...v);
  return speed > MAX_SPEED ? [(v[0] * MAX_SPEED) / speed, (v[1] * MAX_SPEED) / speed] : v;
}

export const atRest = (v: Velocity): boolean => Math.hypot(v[0], v[1]) < REST_SPEED;

/** `dt` ms of coasting: the globe moves on at the velocity, which decays. The tilt stops at the poles. */
export function coast(rotation: Rotation, velocity: Velocity, dt: number): { rotation: Rotation; velocity: Velocity } {
  const k = Math.exp(-dt / DECAY_MS);
  // The distance covered is the integral of the decaying speed over the step.
  const travel = DECAY_MS * (1 - k);
  const lat = Math.max(-90, Math.min(90, rotation[1] + velocity[1] * travel));
  return {
    rotation: [wrap(rotation[0] + velocity[0] * travel), lat, rotation[2]],
    velocity: [velocity[0] * k, Math.abs(lat) === 90 ? 0 : velocity[1] * k],
  };
}

/** A turn from one rotation to another, eased in and out; `at` runs 0 to 1. */
export function turnBetween(from: Rotation, to: Rotation, at: number): Rotation {
  const e = at < 0.5 ? 4 * at * at * at : 1 - Math.pow(-2 * at + 2, 3) / 2;
  return [wrap(from[0] + wrap(to[0] - from[0]) * e), from[1] + (to[1] - from[1]) * e, from[2] + wrap(to[2] - from[2]) * e];
}

/** The idle spin for `dt` ms. */
export const spin = (rotation: Rotation, dt: number): Rotation => [wrap(rotation[0] + SPIN_SPEED * dt), rotation[1], rotation[2]];
