// src/globe/zoom.ts: how far the globe may be zoomed. 1 is the whole globe in its box; 6 puts a country the size of
// Luxembourg a finger wide.
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

export function clampZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) : MIN_ZOOM;
}
