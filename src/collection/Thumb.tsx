// src/collection/Thumb.tsx: the obverse thumbnail of an item: a round crop for a coin, the whole note for a bill, a quiet
// placeholder while there is no photo. A pending item says 'At the factory' across its foot.
import type { Item } from '../data/db';
import { useObjectUrl } from '../ui/useObjectUrl';

export function Thumb({ item, blob, className = '' }: { item: Item; blob: Blob | undefined; className?: string }) {
  const url = useObjectUrl(blob);
  const coin = item.kind === 'coin';
  const caption = item.reading?.state === 'failed' ? 'Try again' : item.reading || item.status === 'pending' ? 'At the factory' : null;
  return (
    <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      {url ? (
        <img src={url} alt="" draggable={false} className={coin ? 'h-[86%] w-[86%] rounded-full object-cover shadow-lg' : 'h-full w-full object-contain p-1'} />
      ) : (
        <span aria-hidden="true" className="h-[60%] w-[60%] rounded-full border-2 border-dashed border-line" />
      )}
      {caption ? <span className="absolute inset-x-0 bottom-0 bg-accent px-2 py-1 text-center text-sm font-semibold text-accent-fg">{caption}</span> : null}
    </div>
  );
}
