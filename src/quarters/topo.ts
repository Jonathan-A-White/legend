// src/quarters/topo.ts: turns public/data/us/states.json into SVG path text. The file is TopoJSON already projected (Albers
// USA, with Alaska and Hawaii moved under the map), so there is no projection to do: arcs are delta-encoded integers, scaled and
// shifted by `transform`, stitched into rings. 51 shapes, so plain SVG paths are enough (no canvas).
import type { StatesTopology } from '../data/us';

export interface StatePath {
  code: string;
  name: string;
  d: string;
}

export interface StatesMap {
  /** x y width height, for the svg's viewBox */
  viewBox: string;
  paths: StatePath[];
}

type Point = [number, number];

function decodeArcs(topology: StatesTopology): Point[][] {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty] as Point;
    });
  });
}

/** An arc index is its position, or `~position` (a negative number) when the ring walks it backwards. */
function ringOf(indexes: number[], arcs: Point[][]): Point[] {
  const ring: Point[] = [];
  for (const index of indexes) {
    const arc = index < 0 ? [...arcs[~index]].reverse() : arcs[index];
    ring.push(...(ring.length > 0 ? arc.slice(1) : arc));
  }
  return ring;
}

const pathOf = (rings: Point[][]): string => rings.map((ring) => `M${ring.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`).join('');

export function statesMap(topology: StatesTopology): StatesMap {
  const arcs = decodeArcs(topology);
  const paths = topology.objects.states.geometries.map((g) => {
    const polygons = (g.type === 'Polygon' ? [g.arcs] : g.arcs) as number[][][];
    const rings = polygons.flatMap((polygon) => polygon.map((indexes) => ringOf(indexes, arcs)));
    return { code: g.properties.code, name: g.properties.name, d: pathOf(rings) };
  });
  const [x0, y0, x1, y1] = topology.bbox;
  return { viewBox: `${Math.floor(x0)} ${Math.floor(y0)} ${Math.ceil(x1 - x0)} ${Math.ceil(y1 - y0)}`, paths };
}
