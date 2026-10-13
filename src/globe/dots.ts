// src/globe/dots.ts: how big a dot is, the mark a country too small for a shape is drawn with (data-build.ts, DOT_BELOW_DEGREES).
/** CSS pixels, at any zoom: a dot does not grow as the globe does. */
export const DOT_RADIUS = 3.5;
/** The ring that outlines a picked dot, a little larger than the dot. */
export const PICKED_DOT_RADIUS = DOT_RADIUS + 3;
