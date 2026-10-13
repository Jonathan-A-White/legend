// src/globe/GlobeScreen.tsx: the Globe, at #/globe. A globe he turns with one finger, lit where his items come from; a tap on
// a country opens it (#/country/<cc>), and so does a tap within a finger's width of a small one; a tap among several tiny ones
// offers a short list of them; two fingers zoom. A search at the thumb turns the globe to a country; 'Not yet' lists the countries he
// has nothing from. The drawing and the finger live in controller.ts; this file wires them to the page.
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type RefObject } from 'react';
import { useItems } from '../data/repositories';
import { loadCountries, type Countries } from '../data/world';
import { FeedbackButton } from '../feedback';
import { countryHash, navigate, useAddress } from '../nav/route';
import { ShareButton, shareGlobe } from '../share';
import { GLOBE_OPENED, HintCard } from '../tips';
import { clock } from './clock';
import { GlobeController } from './controller';
import { centreOf, countryFeatures } from './geo';
import { NotYet } from './NotYet';
import { DEFAULT_PALETTE, readPalette } from './palette';
import type { Rotation } from './render';
import { useLoaded } from './useLoaded';
import { view } from './view';

const NOT_YET = '#/globe?not-yet';
/** A click on the list of near countries sooner than this after it appears is the tap that opened it, sent on. */
const NEAR_SETTLE_MS = 350;
/** With nothing collected the globe opens on the Atlantic, the Americas to one side and Europe and Africa to the other. */
const FIRST_VIEW: Rotation = [40, -20, 0];

function litCounts(items: readonly { country: string | null }[]): Map<string, number> {
  const lit = new Map<string, number>();
  for (const item of items) if (item.country) lit.set(item.country, (lit.get(item.country) ?? 0) + 1);
  return lit;
}

function globeLabel(countries: Countries, lit: ReadonlyMap<string, number>): string {
  if (!lit.size) return 'The globe. Nothing is lit yet: a coin or a note with its country lights that country up.';
  const names = [...lit]
    .map(([cc, n]) => ({ name: countries.names[cc]?.name ?? cc, n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .map(({ name, n }) => `${name} (${n})`);
  return `The globe. Lit: ${names.join(', ')}.`;
}

export function GlobeScreen() {
  const countries = useLoaded(loadCountries);
  const items = useItems();
  const lit = useMemo(() => litCounts(items ?? []), [items]);
  const controllerRef = useRef<GlobeController | null>(null);
  const notYetOpen = useAddress() === NOT_YET;
  /** The countries near a tap that had none under the finger, for him to choose from. */
  const [near, setNear] = useState<string[] | null>(null);

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-wide text-accent">Globe</h1>
          <FeedbackButton screen="Globe" className="-mr-2" />
        </div>
        <p className="mt-1 text-base text-muted">Where your coins and notes come from. Turn it with a finger, pinch to zoom; tap a country.</p>
      </header>
      <HintCard event={GLOBE_OPENED} className="mx-5 mt-2 shrink-0" />
      {countries.value && items ? (
        <>
          <GlobeCanvas countries={countries.value} lit={lit} covered={notYetOpen} controllerRef={controllerRef} near={near} setNear={setNear} />
          <Controls countries={countries.value} lit={lit} controllerRef={controllerRef} onSearch={() => setNear(null)} />
          {notYetOpen && <NotYet countries={countries.value} lit={lit} onClose={() => window.history.back()} />}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-lg text-muted">
          {countries.failed ? (
            <>
              <p>The globe could not load.</p>
              <button type="button" onClick={countries.retry} className="min-h-12 rounded-full border border-line px-6 text-ink">
                Try again
              </button>
            </>
          ) : (
            <p>Loading the globe…</p>
          )}
        </div>
      )}
    </main>
  );
}

interface CanvasProps {
  countries: Countries;
  lit: ReadonlyMap<string, number>;
  covered: boolean;
  controllerRef: RefObject<GlobeController | null>;
  near: string[] | null;
  setNear(codes: string[] | null): void;
}

function GlobeCanvas({ countries, lit, covered, controllerRef, near, setNear }: CanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // The controller is made once per loaded world; `lit` reaches it through the effect below.
  const firstLit = useRef(lit);

  useEffect(() => {
    const el = canvas.current!;
    const features = countryFeatures(countries);
    const most = [...firstLit.current].sort((a, b) => b[1] - a[1])[0]?.[0];
    const facing = most ? features.find((f) => f.id === most) : undefined;
    const start: Rotation = view.rotation ?? (facing ? [-centreOf(facing)[0], -centreOf(facing)[1], 0] : FIRST_VIEW);
    const globe = new GlobeController(el, {
      features,
      lit: firstLit.current,
      palette: readPalette(),
      rotation: start,
      zoom: view.zoom,
      picked: view.picked,
      idleSpin: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      onPick: (code) => navigate(countryHash(code)),
      onChoose: setNear,
      onRest: (rotation, picked, zoom) => {
        view.rotation = rotation;
        view.zoom = zoom;
        view.picked = picked;
      },
    });
    controllerRef.current = globe;

    const onVisibility = () => globe.setHidden(document.visibilityState === 'hidden');
    const onHide = () => globe.setHidden(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onVisibility);
    const resize = () => globe.resize();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    observer?.observe(el);
    window.addEventListener('resize', resize);
    // The Theme setting changes data-theme on <html>; 'system' follows the phone.
    const repaint = () => globe.setPalette(readPalette());
    const themes = new MutationObserver(repaint);
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const scheme = window.matchMedia?.('(prefers-color-scheme: light)');
    scheme?.addEventListener?.('change', repaint);

    return () => {
      globe.stop();
      controllerRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onVisibility);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      themes.disconnect();
      scheme?.removeEventListener?.('change', repaint);
    };
  }, [countries, controllerRef, setNear]);

  useEffect(() => controllerRef.current?.setLit(lit), [lit, controllerRef]);
  useEffect(() => controllerRef.current?.setCovered(covered), [covered, controllerRef]);

  const at = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const box = e.currentTarget.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  };

  return (
    <div className="relative min-h-0 flex-1">
      <canvas
        ref={canvas}
        role="img"
        aria-label={globeLabel(countries, lit)}
        className="absolute inset-0 h-full w-full touch-none select-none"
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // No capture (jsdom, an old browser): the drag still follows while the finger stays on the canvas.
          }
          setNear(null);
          controllerRef.current?.pointerDown(e.pointerId, at(e));
        }}
        onPointerMove={(e) => controllerRef.current?.pointerMove(e.pointerId, at(e))}
        onPointerUp={(e) => controllerRef.current?.pointerUp(e.pointerId, at(e))}
        onPointerCancel={(e) => controllerRef.current?.pointerCancel(e.pointerId)}
        onContextMenu={(e) => e.preventDefault()}
      />
      {near && <NearTap countries={countries} codes={near} onClose={() => setNear(null)} />}
    </div>
  );
}

/** A tap among tiny countries: their names, nearest first, each a tap away from its sheet. */
function NearTap({ countries, codes, onClose }: { countries: Countries; codes: string[]; onClose(): void }) {
  // The list appears under the finger that asked for it, and the phone may send that same tap on as a click to whatever is
  // there now: a click this soon is not his.
  const shownAt = useRef(clock.now());
  const his = (act: () => void) => () => {
    if (clock.now() - shownAt.current >= NEAR_SETTLE_MS) act();
  };
  return (
    <div className="absolute inset-x-4 bottom-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
      <div className="flex items-center justify-between pl-4 pr-2">
        <h2 className="text-base text-muted">Which one?</h2>
        <button type="button" onClick={his(onClose)} className="min-h-11 px-3 text-base text-muted active:text-ink">
          Close
        </button>
      </div>
      <ul aria-label="Countries near your tap">
        {codes.map((cc) => (
          <li key={cc}>
            <button type="button" onClick={his(() => navigate(countryHash(cc)))} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-lg text-ink active:bg-canvas">
              <span aria-hidden="true" className="text-2xl">
                {countries.names[cc]?.flag}
              </span>
              {countries.names[cc]?.name ?? cc}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The search, then the Not yet and Share buttons, at the foot under the thumb. */
function Controls({ countries, lit, controllerRef, onSearch }: { countries: Countries; lit: ReadonlyMap<string, number>; controllerRef: RefObject<GlobeController | null>; onSearch(): void }) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => findCountries(countries, query), [countries, query]);
  const lacking = Object.keys(countries.names).filter((cc) => !lit.has(cc)).length;

  const pick = (code: string) => {
    setQuery('');
    onSearch();
    input.current?.blur();
    controllerRef.current?.turnTo(code);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (matches[0]) pick(matches[0][0]);
  };

  return (
    <div className="relative shrink-0 border-t border-line bg-canvas px-4 pt-3 pb-3">
      {matches.length > 0 && (
        <ul aria-label="Countries found" className="absolute inset-x-4 bottom-full mb-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          {matches.map(([cc, info]) => (
            <li key={cc}>
              <button type="button" onClick={() => pick(cc)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-lg text-ink active:bg-canvas">
                <span aria-hidden="true" className="text-2xl">
                  {info.flag}
                </span>
                {info.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form role="search" onSubmit={submit}>
        <input
          ref={input}
          type="search"
          aria-label="Find a country"
          placeholder="Find a country"
          enterKeyHint="go"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch();
          }}
          className="h-12 w-full rounded-full border border-line bg-surface px-5 text-lg text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </form>
      <div className="mt-2 flex items-start gap-3">
        <button
          type="button"
          aria-label={`Not yet: ${lacking} countries`}
          onClick={() => navigate(NOT_YET)}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-line px-4 text-lg text-ink active:bg-surface"
        >
          Not yet <span className="text-base text-muted">{lacking}</span>
        </button>
        <ShareButton
          which="globe"
          make={() => {
            const globe = controllerRef.current;
            return shareGlobe({ features: countryFeatures(countries), lit, rotation: globe?.currentRotation() ?? view.rotation ?? FIRST_VIEW, palette: DEFAULT_PALETTE });
          }}
          className="h-12 rounded-full border border-accent px-4 text-lg font-semibold text-accent active:bg-surface"
        />
      </div>
    </div>
  );
}

/** Up to five countries for what he typed: names that start with it first, then names with a word that does. */
function findCountries(countries: Countries, query: string): [string, Countries['names'][string]][] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = Object.entries(countries.names);
  const starts = all.filter(([cc, info]) => info.name.toLowerCase().startsWith(q) || cc.toLowerCase() === q);
  const words = all.filter(([, info]) => !starts.some(([, s]) => s === info) && info.name.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(q)));
  return [...starts, ...words].sort(([, a], [, b]) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name)).slice(0, 5);
}
