// src/collection/thumbs.ts: which stored thumbnail draws an item, and the words across it while the factory names it.
import type { Item, PhotoSide } from '../data/db';

export interface ThumbPhoto {
  itemId: string;
  side: PhotoSide;
  thumb: Blob;
}

/** The photo to draw for an item: its obverse, else any. */
export function pickThumb(thumbs: readonly ThumbPhoto[] | undefined, itemId: string): Blob | undefined {
  const mine = thumbs?.filter((t) => t.itemId === itemId) ?? [];
  return (mine.find((t) => t.side === 'obverse') ?? mine[0])?.thumb;
}

/** 'Try again' or 'At the factory' while the factory is naming it, else nothing. */
export const thumbCaption = (item: Item): string | null =>
  item.reading?.state === 'failed' ? 'Try again' : item.reading || item.status === 'pending' ? 'At the factory' : null;
