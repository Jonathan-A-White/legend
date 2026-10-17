// src/collection/Choose.tsx: Select on the Collection, to remove pieces from the list itself. Select (or a long press on a piece)
// turns the tiles into toggles; the Remove bar must be held, like the one on a piece's page, and Undo is offered for five seconds.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Item } from '../data/db';
import { removeItem, restoreItem } from '../data/repositories';
import { itemHash } from '../nav/route';
import { HoldBar } from '../ui/HoldBar';
import { useHoldPress } from '../ui/holdPress';
import type { Choosing } from './choosing';
import { REMOVE_HOLD_MS, UNDO_MS } from './ItemView';
import { pieces } from './view';

function LinkTile({ item, choosing, className, children }: { item: Item; choosing: Choosing | null; className: string; children: ReactNode }) {
  const press = useHoldPress({
    onHold: () => choosing?.held(item.id),
    onRelease: () => undefined,
    onDrop: () => undefined,
  });
  const long = choosing ? { ...press, className: `${className} select-none [-webkit-touch-callout:none]` } : { className };
  return (
    <a
      href={itemHash(item.id)}
      {...long}
      onClick={(e) => {
        if (!choosing) return;
        if (choosing.endsHold()) e.preventDefault();
        press.onClick();
      }}
    >
      {children}
    </a>
  );
}

/** A piece on the Collection: a link to its page, or while choosing a toggle with a tick. `choosing` null: no Select here (a folder). */
export function ChooseTile({ item, choosing, className, children }: { item: Item; choosing: Choosing | null; className: string; children: ReactNode }) {
  if (!choosing?.on) {
    return (
      <LinkTile item={item} choosing={choosing} className={className}>
        {children}
      </LinkTile>
    );
  }
  const chosen = choosing.chosen.has(item.id);
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onPointerDown={choosing.pressed}
      onClick={() => {
        if (!choosing.endsHold()) choosing.toggle(item.id);
      }}
      className={`${className} relative w-full text-left select-none ${chosen ? 'ring-2 ring-accent' : ''}`}
    >
      {children}
      <span
        aria-hidden="true"
        className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 text-lg font-bold ${chosen ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface/80'}`}
      >
        {chosen ? '✓' : ''}
      </span>
    </button>
  );
}

/** While choosing: how many are chosen, and Done. */
export function ChooseBar({ count, onDone }: { count: number; onDone: () => void }) {
  return (
    <div className="mt-2 flex min-h-11 items-center justify-between gap-2">
      {count > 0 ? (
        <p data-testid="chosen-line" className="text-lg font-medium text-ink">
          {count} chosen
        </p>
      ) : (
        <p className="text-lg text-muted">Tap pieces to choose them</p>
      )}
      <button type="button" onClick={onDone} className="min-h-11 rounded-full border border-accent px-5 text-base font-semibold text-accent">
        Done
      </button>
    </div>
  );
}

/** The Remove bar under the chosen pieces: held, never tapped. */
export function RemoveChosen({ ids, onRemoved }: { ids: readonly string[]; onRemoved: (ids: readonly string[]) => void }) {
  const [holding, setHolding] = useState(false);
  const [tapped, setTapped] = useState(false);
  const n = ids.length;
  return (
    <div className="shrink-0 pt-2 pb-3">
      <HoldBar
        name="Remove"
        danger
        disabled={n === 0}
        holding={holding}
        holdMs={REMOVE_HOLD_MS}
        label={n === 0 ? 'Choose pieces to remove' : holding ? 'Keep holding…' : `Hold to remove ${pieces(n)}`}
        hold={{
          onPress: () => setTapped(false),
          onTap: () => setTapped(true),
          onHold: () => {
            setHolding(true);
            void Promise.all(ids.map((id) => removeItem(id))).then(() => {
              setHolding(false);
              onRemoved(ids);
            });
          },
          onRelease: () => setHolding(false),
          onDrop: () => setHolding(false),
        }}
      />
      {tapped ? (
        <p role="status" className="pt-2 text-center text-base text-muted">
          Press and hold the button to remove them. A tap does nothing.
        </p>
      ) : null}
    </div>
  );
}

/** After Remove: Undo, for five seconds. */
export function RemovedToast({ ids, onDone }: { ids: readonly string[]; onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const timer = setTimeout(() => done.current(), UNDO_MS);
    return () => clearTimeout(timer);
  }, [ids]);
  return (
    <div role="status" className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-2 text-lg text-ink">
      <span>Removed {pieces(ids.length)} from your collection</span>
      <button
        type="button"
        onClick={async () => {
          await Promise.all(ids.map((id) => restoreItem(id)));
          onDone();
        }}
        className="min-h-12 shrink-0 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg"
      >
        Undo
      </button>
    </div>
  );
}
