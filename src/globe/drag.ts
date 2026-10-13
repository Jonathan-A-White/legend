// src/globe/drag.ts: turning the globe under a finger with a quaternion (a versor), so the place he touched stays under his
// finger at any tilt and the globe never locks up near a pole. After Mike Bostock's versor dragging
// (https://observablehq.com/@d3/versor-dragging, ISC).
import { projectionFor, type Rotation } from './render';

type Vec = [number, number, number];
type Versor = [number, number, number, number];

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function cartesian([lon, lat]: [number, number]): Vec {
  const l = lon * RAD;
  const p = lat * RAD;
  const cp = Math.cos(p);
  return [cp * Math.cos(l), cp * Math.sin(l), Math.sin(p)];
}

function fromRotation([l, p, g]: Rotation): Versor {
  const a = (l / 2) * RAD;
  const b = (p / 2) * RAD;
  const c = (g / 2) * RAD;
  const sl = Math.sin(a), cl = Math.cos(a), sp = Math.sin(b), cp = Math.cos(b), sg = Math.sin(c), cg = Math.cos(c);
  return [cl * cp * cg + sl * sp * sg, sl * cp * cg - cl * sp * sg, cl * sp * cg + sl * cp * sg, cl * cp * sg - sl * sp * cg];
}

function toRotation([a, b, c, d]: Versor): Rotation {
  return [
    Math.atan2(2 * (a * b + c * d), 1 - 2 * (b * b + c * c)) * DEG,
    Math.asin(Math.max(-1, Math.min(1, 2 * (a * c - d * b)))) * DEG,
    Math.atan2(2 * (a * d + b * c), 1 - 2 * (c * c + d * d)) * DEG,
  ];
}

function multiply([a1, b1, c1, d1]: Versor, [a2, b2, c2, d2]: Versor): Versor {
  return [
    a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
    a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2,
    a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2,
    a1 * d2 + b1 * c2 - c1 * b2 + d1 * a2,
  ];
}

/** The rotation that turns the point v0 onto v1. */
function delta(v0: Vec, v1: Vec): Versor {
  const w: Vec = [v0[1] * v1[2] - v0[2] * v1[1], v0[2] * v1[0] - v0[0] * v1[2], v0[0] * v1[1] - v0[1] * v1[0]];
  const l = Math.hypot(...w);
  if (!l) return [1, 0, 0, 0];
  const t = Math.acos(Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]))) / 2;
  const s = Math.sin(t);
  return [Math.cos(t), (w[2] / l) * s, (-w[1] / l) * s, (w[0] / l) * s];
}

/** The rotation that, from `start`, carries the place under screen point `from` to `to`; null when either is off the globe. */
export function dragRotation(start: Rotation, from: [number, number], to: [number, number], width: number, height: number, zoom = 1): Rotation | null {
  const projection = projectionFor(start, width, height, zoom);
  const a = onGlobe(projection, from);
  const b = onGlobe(projection, to);
  if (!a || !b) return null;
  return toRotation(multiply(fromRotation(start), delta(cartesian(a), cartesian(b))));
}

function onGlobe(projection: ReturnType<typeof projectionFor>, [x, y]: [number, number]): [number, number] | null {
  const [cx, cy] = projection.translate();
  if (Math.hypot(x - cx, y - cy) > projection.scale()) return null;
  const place = projection.invert?.([x, y]);
  return place && Number.isFinite(place[0]) && Number.isFinite(place[1]) ? place : null;
}

export { onGlobe };
