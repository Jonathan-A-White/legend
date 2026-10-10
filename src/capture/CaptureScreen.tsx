// src/capture/CaptureScreen.tsx: Add, at #/add. A viewfinder with a guide, 'Front' then 'Back', a shutter, 'Use a photo' for the
// gallery and 'Name it'. Name it stores the item and its photos and hands the send to the queue (src/services/nameQueue.ts), then the
// viewfinder is ready for the next one at once, so a visit to a coin shop is photograph, photograph, photograph. A switch says
// whether it is for the collection or only Just looking. Everything he needs is in reach of the thumb at the bottom.
import { useRef, useState } from 'react';
import type { ItemKind } from '../data/db';
import { restoreItem, useItems } from '../data/repositories';
import { navigate } from '../nav/route';
import { nameQueue } from '../services/nameQueue';
import { readSetting } from '../settings/registry';
import { captureStill, stillFromFile, MAX_LONG_SIDE, type Still, type StillOptions } from './captureStill';
import { ConfirmSheet } from './ConfirmSheet';
import { Preview } from './Preview';
import { Tray } from './Tray';
import { startItem, type AddMode } from './startItem';
import { useCamera } from './useCamera';
import { useUndoToast } from './useUndoToast';

const SIDES = ['Front', 'Back'] as const;

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; text: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-2xl bg-black/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-xl px-3 text-base font-semibold ${value === o.value ? 'bg-accent text-accent-fg' : 'text-white/85'}`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

async function stillOptions(): Promise<StillOptions> {
  const cap = await readSetting('sizeCap').catch(() => MAX_LONG_SIDE);
  return { maxLongSide: typeof cap === 'number' ? cap : MAX_LONG_SIDE };
}

export function CaptureScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ready, error } = useCamera(videoRef);
  const [kind, setKind] = useState<ItemKind>('coin');
  const [mode, setMode] = useState<AddMode>('collect');
  const [shots, setShots] = useState<Still[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<string[]>([]);
  const [checking, setChecking] = useState<string | null>(null);
  const toast = useUndoToast();
  const items = useItems({ scope: 'all' });

  const mine = (items ?? []).filter((i) => made.includes(i.id)).sort((a, b) => a.createdAt - b.createdAt);
  const sheetItem = checking ? mine.find((i) => i.id === checking) : undefined;
  const both = shots.length >= SIDES.length;
  const prompt = both ? 'Both sides taken' : SIDES[shots.length];

  const keep = async (make: (options: StillOptions) => Promise<Still>) => {
    if (busy || both) return;
    setBusy(true);
    setProblem(null);
    try {
      const still = await make(await stillOptions());
      setShots((s) => (s.length >= SIDES.length ? s : [...s, still]));
      navigator.vibrate?.(15);
    } catch {
      setProblem('Could not keep that photo. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const nameIt = async () => {
    if (busy || shots.length === 0) return;
    setBusy(true);
    try {
      const item = await startItem(kind, mode, shots);
      setMade((m) => [...m, item.id]);
      setShots([]);
      setProblem(null);
    } catch {
      setProblem('Could not save that one. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main aria-label="Add" className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-black text-white">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className={`border-2 border-dashed border-white/70 ${kind === 'coin' ? 'aspect-square w-[72%] rounded-full' : 'aspect-[2/1] w-[88%] rounded-2xl'}`} />
      </div>

      <div className="relative z-10 bg-gradient-to-b from-black/80 to-transparent pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="flex items-start justify-between gap-3 px-4">
          <div>
            <p data-testid="prompt" aria-live="polite" className="text-4xl font-semibold tracking-wide">
              {prompt}
            </p>
            <p className="text-base text-white/80">{both ? 'Tap Name it to send them.' : kind === 'coin' ? 'Fit the coin in the circle.' : 'Fit the bill in the frame.'}</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => navigate('#/collection', { replace: true })} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/60 text-2xl">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {error ? (
          <p role="alert" className="mx-4 mt-2 rounded-xl bg-black/70 p-3 text-base">
            {error}
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="mx-4 mt-2 rounded-xl bg-black/70 p-3 text-base">
            {problem}
          </p>
        ) : null}
        <div className="mt-2">
          <Tray items={mine} onCheck={setChecking} onRetry={(id) => void nameQueue.retry(id)} />
        </div>
        {toast.letGo ? (
          <div role="status" className="mx-4 mt-2 flex items-center justify-between rounded-2xl bg-black/75 p-3 text-base">
            <span>Let go.</span>
            <button type="button" onClick={() => void restoreItem(toast.letGo!).then(toast.clear)} className="min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg">
              Undo
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex-1" />

      <div className="relative z-10 space-y-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {shots.length > 0 ? (
          <ul aria-label="Photos taken" className="flex gap-3">
            {shots.map((shot, i) => (
              <li key={i}>
                <Preview thumb={shot.thumb} side={SIDES[i]} onRetake={() => setShots((s) => s.slice(0, i))} />
              </li>
            ))}
          </ul>
        ) : null}
        <Choice<AddMode>
          label="What to do with it"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'collect', text: 'Add to my collection' },
            { value: 'look', text: 'Just looking' },
          ]}
        />
        <Choice<ItemKind>
          label="What it is"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'coin', text: 'Coin' },
            { value: 'note', text: 'Bill' },
          ]}
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex min-h-14 flex-1 cursor-pointer items-center justify-center rounded-2xl border border-white/50 text-lg font-semibold">
            Use a photo
            <input
              type="file"
              accept="image/*"
              data-testid="gallery-input"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void keep((options) => stillFromFile(file, options));
              }}
            />
          </label>
          <button
            type="button"
            aria-label="Take photo"
            disabled={!ready || busy || both}
            onClick={() => void keep((options) => captureStill(videoRef.current!, options))}
            className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border-4 border-white bg-white/90 disabled:opacity-40"
          />
          <button type="button" disabled={busy || shots.length === 0} onClick={() => void nameIt()} className="min-h-14 flex-1 rounded-2xl bg-accent text-lg font-semibold text-accent-fg disabled:opacity-40">
            Name it
          </button>
        </div>
      </div>

      {sheetItem ? <ConfirmSheet item={sheetItem} onClose={() => setChecking(null)} onLetGo={(id) => {
            setChecking(null);
            toast.show(id);
          }} /> : null}
    </main>
  );
}
