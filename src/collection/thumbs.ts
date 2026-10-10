// src/collection/thumbs.ts: which stored thumbnail draws an item.
import type { PhotoSide } from '../data/db';

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
