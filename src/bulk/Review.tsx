// src/bulk/Review.tsx: the last step of Add many at once. Nothing is stored yet. The top line says how many coins will be saved (and how many
// to check); under it, inside its own box, every pair large: the front and the back side by side, its number, a rough size and its state.
// A pair the app is unsure of has an amber frame and the words why, sorts to the top and blocks Save until he taps Looks right or
// swaps it. Swap (then the other pair's back), Leave out and Looks right are one tap each, and Undo takes the last one back. The pair
// never changes without his tap. Save stores each kept pair as the item Add makes (saveBatch.ts); Close asks first.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Still } from '../capture/captureStill';
import { stillOptions } from '../capture/startItem';
import { useAlive } from '../ui/useAlive';
import { useObjectUrl } from '../ui/useObjectUrl';
import type { Group } from './BulkScreen';
import { cutCoins } from './cut';
import { Header } from './Header';
import { pairCoins } from './pair';
import { kept, leaveOut, listed, looksRight, needsLook, rowsOf, sizeWords, swapBacks, type Row } from './reviewState';
import { saveBatch } from './saveBatch';

export const LEAVE_WORDS = 'Leave without saving? Nothing from this batch is saved yet.';

/** The cut-outs of one batch: a front and a back for every coin found, in the numbers' order. */
interface Cuts {
  fronts: Still[];
  backs: Still[];
}

const coins = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`;

function Circle({ still, label, onTap }: { still: Still | undefined; label: string; onTap?: () => void }) {
  const url = useObjectUrl(still?.thumb);
  const face = url ? <img src={url} alt={label} draggable={false} className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-white/10" />;
  const frame = 'h-20 w-20 shrink-0 overflow-hidden rounded-full';
  return onTap ? (
    <button type="button" aria-label={label} onClick={onTap} className={`${frame} ring-4 ring-accent`}>
      {face}
    </button>
  ) : (
    <div className={frame}>{face}</div>
  );
}

interface CardProps {
  row: Row;
  reasons: string[];
  size: string;
  cuts: Cuts | null;
  swapping: number | null;
  index: number;
  onSwap: () => void;
  onTradeWith: () => void;
  onLeaveOut: () => void;
  onLooksRight: () => void;
}

function Card({ row, reasons, size, cuts, swapping, index, onSwap, onTradeWith, onLeaveOut, onLooksRight }: CardProps) {
  const number = row.front + 1;
  const amber = needsLook(row);
  const trading = swapping !== null && swapping !== index;
  const buttons = 'min-h-12 flex-1 rounded-xl border border-white/40 px-2 text-base font-semibold';
  return (
    <li
      role="group"
      aria-label={`Coin ${number}`}
      data-testid="pair"
      data-amber={amber ? 'true' : 'false'}
      className={`rounded-2xl p-3 ${amber ? 'border-4 border-amber-400 bg-amber-400/10' : 'border border-white/25 bg-white/5'}`}
    >
      <div className="flex items-center gap-3">
        <p className="w-8 shrink-0 text-center text-2xl font-semibold">{number}</p>
        <Circle still={cuts?.fronts[row.front]} label={`Front of coin ${number}`} />
        <Circle still={cuts?.backs[row.back]} label={trading ? `Trade backs with coin ${number}` : `Back of coin ${number}`} onTap={trading ? onTradeWith : undefined} />
        <div className="min-w-0 flex-1">
          <p data-testid="pair-size" className="text-lg leading-tight font-semibold">
            {size}
          </p>
          {amber ? null : <p className="text-base text-white/70">{row.looked ? 'Checked' : 'Looks sure'}</p>}
        </div>
      </div>
      {amber ? (
        <div data-testid="pair-why" className="mt-2 text-base text-amber-300">
          {reasons.map((r) => (
            <p key={r}>{r}. Check it.</p>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSwap} aria-pressed={swapping === index} className={buttons}>
          {swapping === index ? 'Cancel swap' : 'Swap'}
        </button>
        <button type="button" onClick={onLeaveOut} className={buttons}>
          Leave out
        </button>
        {amber ? (
          <button type="button" onClick={onLooksRight} className="min-h-12 flex-1 rounded-xl bg-amber-400 px-2 text-base font-semibold text-black">
            Looks right
          </button>
        ) : null}
      </div>
    </li>
  );
}

interface ReviewProps {
  fronts: Group;
  backs: Group;
  /** the coin folder the batch was opened from, if any: every coin saved joins it */
  folderId?: string;
  onRetakeBacks: () => void;
  onStartOver: () => void;
  onClose: () => void;
  onSaved: (saved: number) => void;
}

export function Review({ fronts, backs, folderId, onRetakeBacks, onStartOver, onClose, onSaved }: ReviewProps) {
  const stillHere = useAlive();
  const frontCircles = fronts.look.coins;
  const backCircles = backs.look.coins;
  const paired = useMemo(() => pairCoins(frontCircles, backCircles), [frontCircles, backCircles]);
  const [rows, setRows] = useState<Row[]>(() => (paired.ok ? rowsOf(paired.pairs) : []));
  const [history, setHistory] = useState<Row[][]>([]);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [cuts, setCuts] = useState<Cuts | null>(null);
  const [cutFailed, setCutFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const savingNow = useRef(false);

  // the coins are cut out once, as he arrives; nothing is stored or sent
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const options = await stillOptions();
        const f = await cutCoins(fronts.photo, frontCircles, options);
        const b = await cutCoins(backs.photo, backCircles, options);
        if (live) setCuts({ fronts: f, backs: b });
      } catch {
        if (live) setCutFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [fronts.photo, backs.photo, frontCircles, backCircles]);

  const change = (next: Row[]) => {
    setHistory((h) => [...h, rows]);
    setRows(next);
    setSwapping(null);
  };

  const keptRows = kept(rows);
  const toCheck = keptRows.filter(needsLook).length;
  const leftOut = rows.length - keptRows.length;
  const canSave = !!cuts && toCheck === 0 && keptRows.length > 0 && !saving;

  const save = async () => {
    if (!cuts || savingNow.current || toCheck > 0) return;
    savingNow.current = true;
    setSaving(true);
    setProblem(null);
    const batch = [...keptRows].sort((a, b) => a.front - b.front).map((r) => ({ front: cuts.fronts[r.front], back: cuts.backs[r.back] }));
    const result = await saveBatch(batch, folderId);
    if (!stillHere()) return;
    if (result.ok) return onSaved(result.items.length);
    savingNow.current = false;
    setSaving(false);
    setProblem(result.message);
  };

  const saveWords = !cuts ? (cutFailed ? 'Could not cut out the coins' : 'Cutting out the coins…') : toCheck > 0 ? `Check ${toCheck} first` : keptRows.length === 0 ? 'Nothing to save' : `Save ${coins(keptRows.length)}`;
  const link = 'min-h-12 flex-1 rounded-xl border border-white/40 px-2 text-base font-semibold';

  return (
    <>
      <Header step="review" caption="" onClose={() => setLeaving(true)} />
      <div className="relative z-10 px-4 pb-2">
        <p data-testid="review-count" className="text-3xl font-semibold">
          {coins(keptRows.length)} to save
        </p>
        {toCheck > 0 ? (
          <p data-testid="review-check" className="text-xl font-semibold text-amber-300">
            {toCheck} to check
          </p>
        ) : null}
        {leftOut > 0 ? (
          <p data-testid="review-out" className="text-base text-white/70">
            {leftOut} left out. Retake {leftOut === 1 ? 'it' : 'them'} on their own with Add.
          </p>
        ) : null}
        {swapping !== null ? (
          <p role="status" data-testid="review-swapping" className="text-lg font-semibold">
            Now tap the back to trade with coin {rows[swapping].front + 1}'s.
          </p>
        ) : null}
        {cutFailed ? (
          <p role="alert" className="text-lg text-amber-300">
            Could not cut the coins out of the photos. Retake the backs or start over.
          </p>
        ) : null}
      </div>

      <ul data-testid="review-list" aria-label="Pairs" className="relative z-10 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-3">
        {listed(rows).map((row) => {
          const index = rows.indexOf(row);
          return (
            <Card
              key={row.front}
              row={row}
              reasons={row.reasons}
              size={sizeWords(frontCircles[row.front], backCircles[row.back])}
              cuts={cuts}
              swapping={swapping}
              index={index}
              onSwap={() => setSwapping(swapping === index ? null : index)}
              onTradeWith={() => swapping !== null && change(swapBacks(rows, swapping, index, frontCircles, backCircles))}
              onLeaveOut={() => change(leaveOut(rows, index))}
              onLooksRight={() => change(looksRight(rows, index))}
            />
          );
        })}
      </ul>

      <div className="relative z-10 space-y-3 border-t border-white/15 bg-black px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {problem ? (
          <p role="alert" className="text-base text-amber-300">
            {problem}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button type="button" onClick={onRetakeBacks} className={link}>
            Retake the backs
          </button>
          <button type="button" onClick={onStartOver} className={link}>
            Start over
          </button>
          {history.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setRows(history[history.length - 1]);
                setHistory(history.slice(0, -1));
                setSwapping(null);
              }}
              className={link}
            >
              Undo
            </button>
          ) : null}
        </div>
        <button type="button" disabled={!canSave} onClick={() => void save()} className="min-h-16 w-full rounded-2xl bg-accent text-2xl font-semibold text-accent-fg disabled:opacity-40">
          {saveWords}
        </button>
      </div>

      {leaving ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6">
          <div role="alertdialog" aria-label="Leave without saving?" className="w-full space-y-4 rounded-2xl bg-neutral-900 p-5">
            <p className="text-2xl font-semibold">{LEAVE_WORDS}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setLeaving(false)} className="min-h-14 flex-1 rounded-2xl bg-accent text-lg font-semibold text-accent-fg">
                Stay
              </button>
              <button type="button" onClick={onClose} className="min-h-14 flex-1 rounded-2xl border border-white/50 text-lg font-semibold">
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
