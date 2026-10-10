// src/ui/HoldBar.tsx: a big bar that acts only when it is held (Lampas's HoldBar, h-24, rounded-3xl). A tap does nothing but
// `onTap`, so a destructive act (Remove) cannot happen by accident. What the press does is the caller's: `hold` is useHoldPress's
// handlers, `holdMs` its delay. `danger` draws it as an outline in the alert colour that fills while it is held.
import type { ReactNode } from 'react';
import { type HoldHandlers, useHoldPress } from './holdPress';

export function HoldBar({ hold, holdMs, name, label, icon, testId, holding = false, danger = false, disabled = false }: {
  hold: HoldHandlers;
  holdMs?: number;
  /** the accessible name, which stays the same while the label changes */
  name: string;
  /** what the bar says now */
  label: string;
  icon?: ReactNode;
  testId?: string;
  /** a hold is going on */
  holding?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const press = useHoldPress(hold, holdMs);
  const idle = danger ? 'border-2 border-bad text-bad' : 'bg-accent text-accent-fg';
  const active = danger ? 'border-2 border-bad bg-bad text-bad-fg' : 'bg-accent text-accent-fg';
  return (
    <button
      type="button"
      data-hold-bar=""
      data-testid={testId}
      aria-label={name}
      aria-pressed={holding}
      disabled={disabled}
      {...press}
      className={`mx-auto flex h-24 w-full max-w-xl touch-none select-none flex-col items-center justify-center gap-1 rounded-3xl text-[16px] font-semibold transition-colors [-webkit-touch-callout:none] disabled:cursor-not-allowed disabled:opacity-45 ${holding ? active : idle}`}
    >
      {icon}
      <span aria-hidden="true">{label}</span>
    </button>
  );
}
