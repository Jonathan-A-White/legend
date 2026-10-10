// src/collection/PhotoViewer.tsx: one photo large, on black. Pinch with two fingers to zoom and drag to move (the rest of the app
// never zooms, so this is the one place it is allowed), double-tap to zoom in and out, Close or Back to leave (src/ui/sheetBack.ts).
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useSheetBack } from '../ui/sheetBack';

interface View {
  scale: number;
  x: number;
  y: number;
}
const FIT: View = { scale: 1, x: 0, y: 0 };
const MAX_SCALE = 6;
const DOUBLE_TAP_MS = 300;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

export function PhotoViewer({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  useSheetBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [view, setView] = useState<View>(FIT);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const lastTap = useRef(0);

  const distance = () => {
    const [a, b] = [...fingers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 2) pinch.current = { distance: distance(), scale: view.scale };
    else if (e.pointerType === 'touch' || e.pointerType === 'mouse') {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) setView((v) => (v.scale > 1 ? FIT : { scale: 2.5, x: 0, y: 0 }));
      lastTap.current = now;
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const was = fingers.current.get(e.pointerId);
    if (!was) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size >= 2 && pinch.current) {
      const scale = clamp(pinch.current.scale * (distance() / pinch.current.distance), 1, MAX_SCALE);
      setView((v) => (scale === 1 ? FIT : { ...v, scale }));
    } else if (view.scale > 1) {
      const dx = e.clientX - was.x;
      const dy = e.clientY - was.y;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    fingers.current.delete(e.pointerId);
    pinch.current = null;
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-30 flex flex-col bg-black">
      <div className="flex justify-end p-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-5 text-lg font-semibold text-white">
          Close
        </button>
      </div>
      <div
        data-testid="photo-viewer"
        className="flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => setView((v) => ({ ...v, scale: clamp(v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, MAX_SCALE) }))}
      >
        <img
          src={url}
          alt={label}
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>
      <p className="px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-center text-base text-white/70">Pinch to zoom, double-tap to zoom in and out</p>
    </div>
  );
}
