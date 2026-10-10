// src/globe/render.ts draws one frame of the globe on any context with the canvas's drawing calls: the sphere, the graticule,
// every country's land, the lit ones in the accent and the picked one outlined, and nothing at all when nothing changed.
import { describe, expect, it } from 'vitest';
import { countryFeatures } from '../../src/globe/geo';
import { createRenderer, type Palette, type Scene } from '../../src/globe/render';
import { FakeContext, GRADIENT } from '../support/fake-canvas';
import { globeCountries } from '../support/globe-fixtures';

const palette: Palette = {
  oceanInner: 'ocean-in',
  oceanOuter: 'ocean-out',
  graticule: 'graticule',
  land: 'land',
  border: 'border',
  lit: 'lit',
  outline: 'outline',
  rim: 'rim',
};

// Looking down on the North Pole: all three fixture countries are on the near side.
const scene = (over: Partial<Scene> = {}): Scene => ({
  width: 400,
  height: 400,
  dpr: 2,
  rotation: [0, -90, 0],
  features: countryFeatures(globeCountries),
  lit: new Map([
    ['DE', 2],
    ['US', 1],
  ]),
  picked: null,
  palette,
  ...over,
});

const fills = (ctx: FakeContext, style: unknown) => ctx.paints.filter((p) => p.op === 'fill' && p.style === style);
const strokes = (ctx: FakeContext, style: unknown) => ctx.paints.filter((p) => p.op === 'stroke' && p.style === style);

describe('render', () => {
  it('draws the sphere, the graticule, every land path and the lit set in one frame', () => {
    const ctx = new FakeContext();
    expect(createRenderer().draw(ctx, scene())).toBe(true);

    expect(ctx.clears).toBe(1);
    expect(ctx.paints.filter((p) => p.op === 'fill' && (p.style as typeof GRADIENT).kind === 'gradient')).toHaveLength(1);
    expect(strokes(ctx, 'graticule')).toHaveLength(1);
    expect(strokes(ctx, 'graticule')[0].rings).toBeGreaterThan(10);
    // The unlit land is one path of its rings (Japan's), the lit countries one fill each.
    expect(fills(ctx, 'land')).toEqual([expect.objectContaining({ rings: 1 })]);
    const lit = fills(ctx, 'lit');
    expect(lit).toHaveLength(2);
    expect(lit.every((p) => p.rings === 1)).toBe(true);
    // More items, a stronger light: Germany (2) over the United States (1).
    expect(Math.max(...lit.map((p) => p.alpha))).toBeGreaterThan(Math.min(...lit.map((p) => p.alpha)));
    expect(strokes(ctx, 'rim')).toHaveLength(1);
    expect(strokes(ctx, 'outline')).toHaveLength(0);
  });

  it('outlines the picked country', () => {
    const ctx = new FakeContext();
    createRenderer().draw(ctx, scene({ picked: 'JP' }));
    expect(strokes(ctx, 'outline')).toEqual([expect.objectContaining({ rings: 1 })]);
  });

  it('draws nothing when nothing changed, and draws again when the globe turns', () => {
    const ctx = new FakeContext();
    const renderer = createRenderer();
    const first = scene();
    renderer.draw(ctx, first);
    ctx.reset();

    expect(renderer.draw(ctx, { ...first, rotation: [0, -90, 0] })).toBe(false);
    expect(ctx.paints).toEqual([]);
    expect(ctx.clears).toBe(0);

    expect(renderer.draw(ctx, { ...first, rotation: [5, -90, 0] })).toBe(true);
    expect(ctx.paints.length).toBeGreaterThan(0);
  });

  it('leaves out the countries on the far side', () => {
    const ctx = new FakeContext();
    // Looking up at the South Pole: all three are round the back.
    createRenderer().draw(ctx, scene({ rotation: [0, 90, 0], lit: new Map() }));
    expect(fills(ctx, 'land')).toEqual([expect.objectContaining({ rings: 0 })]);
  });
});
