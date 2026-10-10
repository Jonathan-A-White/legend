// src/capture/Preview.tsx: a taken photo's thumbnail in the strip over the viewfinder; tapping it takes that photo (and any after
// it) away so it can be taken again.
import { useObjectUrl } from '../ui/useObjectUrl';

export function Preview({ thumb, side, onRetake }: { thumb: Blob; side: 'Front' | 'Back'; onRetake: () => void }) {
  const url = useObjectUrl(thumb);
  return (
    <button type="button" aria-label={`Retake ${side}`} onClick={onRetake} className="relative h-16 w-16 overflow-hidden rounded-xl border-2 border-white/70 bg-black/40">
      {url ? <img src={url} alt="" draggable={false} className="h-full w-full object-cover" /> : null}
      <span className="absolute inset-x-0 bottom-0 bg-black/70 text-xs font-semibold text-white">{side}</span>
    </button>
  );
}
