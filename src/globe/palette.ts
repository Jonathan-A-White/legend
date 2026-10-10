// src/globe/palette.ts: the globe's colours, from the app's design tokens (src/index.css) so it follows the Theme setting: a
// soft sea, land in a muted tone, the countries he has items from in the coin-gold accent.
import type { Palette } from './render';

export const DEFAULT_PALETTE: Palette = {
  oceanInner: '#1d4a55',
  oceanOuter: '#0a1f24',
  graticule: 'rgba(149, 171, 159, 0.16)',
  land: '#3f564c',
  border: '#07130f',
  lit: '#d9b45a',
  outline: '#e9efe9',
  rim: '#1d3a2e',
};

const LIGHT: Omit<Palette, 'lit' | 'outline' | 'rim' | 'border'> = {
  oceanInner: '#dcebec',
  oceanOuter: '#a9c9cc',
  graticule: 'rgba(91, 106, 97, 0.18)',
  land: '#b9b39f',
};

let cached: { key: string; palette: Palette } | undefined;

/** The palette for the theme in use now; the same object while the theme stays the same. */
export function readPalette(root: HTMLElement = document.documentElement): Palette {
  const style = getComputedStyle(root);
  const accent = style.getPropertyValue('--lg-accent').trim();
  if (!accent) return DEFAULT_PALETTE;
  const light = style.colorScheme === 'light' || style.getPropertyValue('color-scheme').trim() === 'light';
  const ink = style.getPropertyValue('--lg-ink').trim();
  const canvas = style.getPropertyValue('--lg-canvas').trim();
  const line = style.getPropertyValue('--lg-line').trim();
  const key = [light, accent, ink, canvas, line].join('|');
  if (cached?.key !== key) {
    cached = { key, palette: { ...DEFAULT_PALETTE, ...(light ? LIGHT : {}), lit: accent, outline: ink, border: canvas, rim: line } };
  }
  return cached.palette;
}
