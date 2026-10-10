// src/wishlist/MoneySheet.tsx: a small sheet that asks for one amount of money with a number pad: Add savings, and what he paid on Got it!.
// The button stays off until the amount reads as dollars, so a slip of the thumb cannot be kept.
import { useEffect, useState, type ReactNode } from 'react';
import { useSheetBack } from '../ui/sheetBack';
import { parseMoney } from './tally';

export function MoneySheet({ title, label, initial = '', extra, keepLabel, onKeep, onClose }: {
  title: string;
  /** the amount field's label */
  label: string;
  initial?: string;
  /** more fields under the amount, with the amount once it reads as money */
  extra?: ReactNode;
  keepLabel: string;
  onKeep: (amount: number) => Promise<void>;
  onClose: () => void;
}) {
  useSheetBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const amount = parseMoney(text);

  const keep = async () => {
    if (amount === null || busy) return;
    setBusy(true);
    await onKeep(amount);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50">
      <form
        className="space-y-4 rounded-t-3xl bg-canvas px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        onSubmit={(e) => {
          e.preventDefault();
          void keep();
        }}
      >
        <h2 className="text-2xl font-semibold text-accent">{title}</h2>
        <div>
          <label htmlFor="money-amount" className="mb-1 block text-base font-medium text-muted">
            {label}
          </label>
          <input
            id="money-amount"
            value={text}
            inputMode="decimal"
            autoFocus
            autoComplete="off"
            placeholder="0.00"
            onChange={(e) => setText(e.target.value)}
            className="min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-2xl text-ink"
          />
        </div>
        {extra}
        <div className="flex gap-2">
          <button type="submit" disabled={amount === null || busy} className="flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-50">
            {keepLabel}
          </button>
          <button type="button" onClick={onClose} className="flex min-h-14 items-center justify-center rounded-2xl border border-line px-6 text-lg font-medium text-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
