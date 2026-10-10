// src/ui/holdPress.ts — a button that is tapped, or held. A press that lasts holdMs (500 ms) is a hold: `onHold` at once,
// `onRelease` when the finger lifts, `onDrop` when it slides `slidePx` away or the browser cancels the press (a scroll).
// A press that ends sooner is the button's own tap (`onTap`, from the click). While a hold goes on the page does not
// scroll under the finger (a non-passive touchmove listener, put on while the finger is down), the pointer stays with the button (pointer capture), the phone's
// callout menu stays down, and the click that ends a hold is dropped. With holdMs 0 the press is a hold from the first touch.
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export const holdTimings = {
  /** how long a press must last to be a hold */
  holdMs: 500,
  /** how far a finger may wander before the hold has begun, and still count as a hold in the making */
  slopPx: 10,
  /** how far from where the hold began the finger slides to drop it */
  slidePx: 60,
};

export interface HoldHandlers {
  /** the finger is down (a tap, a hold or a scroll), before anything is known */
  onPress?: () => void;
  onTap?: () => void;
  onHold: () => void;
  onRelease: () => void;
  onDrop: () => void;
}

/** `holdMs` overrides the standard half second. Spread the result on the element: `<button {...useHoldPress(...)}>`. */
export function useHoldPress(handlers: HoldHandlers, holdMs?: number) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const from = useRef({ x: 0, y: 0 });
  const noClick = useRef(false);
  // React's touchmove is passive: the page is kept from scrolling under a hold by a listener of our own, on while he presses.
  const guard = useRef<{ el: HTMLElement; off: () => void } | null>(null);
  const unguard = () => {
    guard.current?.off();
    guard.current = null;
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      guard.current?.off();
      guard.current = null;
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || held.current) return;
    const el = event.currentTarget;
    try {
      el.setPointerCapture?.(event.pointerId);
    } catch {
      // a pointer that is already gone: the press still counts
    }
    noClick.current = false;
    from.current = { x: event.clientX, y: event.clientY };
    clearTimeout(timer.current);
    unguard();
    const keepStill = (e: TouchEvent) => {
      if (held.current && e.cancelable) e.preventDefault();
    };
    el.addEventListener('touchmove', keepStill, { passive: false });
    guard.current = { el, off: () => el.removeEventListener('touchmove', keepStill) };
    latest.current.onPress?.();
    const begin = () => {
      held.current = true;
      noClick.current = true;
      latest.current.onHold();
    };
    const wait = holdMs ?? holdTimings.holdMs;
    if (wait <= 0) begin();
    else timer.current = setTimeout(begin, wait);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const away = Math.hypot(event.clientX - from.current.x, event.clientY - from.current.y);
    if (held.current) {
      if (away < holdTimings.slidePx) return;
      held.current = false;
      unguard();
      latest.current.onDrop();
    } else if (away > holdTimings.slopPx) {
      clearTimeout(timer.current);
      unguard();
    }
  };
  const onPointerUp = () => {
    clearTimeout(timer.current);
    unguard();
    if (!held.current) return;
    held.current = false;
    latest.current.onRelease();
  };
  const onPointerCancel = () => {
    clearTimeout(timer.current);
    unguard();
    if (!held.current) return;
    held.current = false;
    latest.current.onDrop();
  };
  const onClick = () => {
    if (noClick.current) noClick.current = false;
    else latest.current.onTap?.();
  };
  const onContextMenu = (event: { preventDefault(): void }) => event.preventDefault();
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick, onContextMenu };
}
