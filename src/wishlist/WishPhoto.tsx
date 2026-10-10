// src/wishlist/WishPhoto.tsx: the obverse thumbnail of a wished coin, round like the Collection's.
import { useObjectUrl } from '../ui/useObjectUrl';

export function WishPhoto({ blob, label, className = '' }: { blob: Blob | undefined; label: string; className?: string }) {
  const url = useObjectUrl(blob);
  return (
    <div className={`flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      {url ? (
        <img src={url} alt={label} draggable={false} className="h-[86%] w-[86%] rounded-full object-cover shadow-lg" />
      ) : (
        <span aria-hidden="true" className="h-[60%] w-[60%] rounded-full border-2 border-dashed border-line" />
      )}
    </div>
  );
}
