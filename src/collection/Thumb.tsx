// src/collection/Thumb.tsx: the obverse thumbnail of an item: a round crop for a coin, the whole note for a bill, a quiet
// placeholder while there is no photo. A pending item says 'At the factory' across its foot (a `small` one leaves that to the words beside it).
import type { Item } from '../data/db';
import { kindInfo } from '../data/kinds';
import { useObjectUrl } from '../ui/useObjectUrl';
import { thumbCaption } from './thumbs';

export function Thumb({ item, blob, className = '', small = false }: { item: Item; blob: Blob | undefined; className?: string; small?: boolean }) {
  const url = useObjectUrl(blob);
  const coin = item.kind === 'coin';
  const glyph = kindInfo(item.kind).glyph;
  const caption = small ? null : thumbCaption(item);
  return (
    <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      {url ? (
        <img src={url} alt="" draggable={false} className={coin ? 'h-[86%] w-[86%] rounded-full object-cover shadow-lg' : 'h-full w-full object-contain p-1'} />
      ) : glyph ? (
        <span aria-hidden="true" className={`${small ? 'text-2xl' : 'text-5xl'} text-muted`}>
          {glyph}
        </span>
      ) : (
        <span aria-hidden="true" className="h-[60%] w-[60%] rounded-full border-2 border-dashed border-line" />
      )}
      {caption ? <span className="absolute inset-x-0 bottom-0 bg-accent px-2 py-1 text-center text-sm font-semibold text-accent-fg">{caption}</span> : null}
    </div>
  );
}
