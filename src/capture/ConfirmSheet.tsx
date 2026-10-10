// src/capture/ConfirmSheet.tsx: the photo reader's answer for him to check, in large type: country with its flag, denomination, year,
// mint mark, series and design, the grade (marked as a guess), the inscription and the fun fact. "That's right" confirms it; "Not
// quite" opens every field to change and then confirms. An item he is only looking at offers "Add it", "Wish for it" (the asking price, src/wishlist/) and "Let it go" instead.
import { useEffect, useState, type ReactNode } from 'react';
import type { Item } from '../data/db';
import { GRADES } from '../data/grades';
import { removeItem, updateItem, usePhotos, type ItemChanges } from '../data/repositories';
import { useSheetBack } from '../ui/sheetBack';
import { WorthLine } from '../worth';
import { WishSheet } from '../wishlist';
import { useObjectUrl } from '../ui/useObjectUrl';
import { useCountries } from './useCountries';

const field = 'min-h-12 w-full rounded-xl border border-line bg-canvas px-4 text-lg text-ink';
const big = 'flex min-h-14 w-full items-center justify-center rounded-2xl text-lg font-semibold disabled:opacity-50';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-base text-muted">{label}</dt>
      <dd className="min-w-0 text-2xl leading-snug text-ink">{children}</dd>
    </div>
  );
}

function Input({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function Side({ blob, label }: { blob: Blob | undefined; label: string }) {
  const url = useObjectUrl(blob);
  return (
    <figure className="w-24 shrink-0">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-line bg-surface">{url ? <img src={url} alt={`${label} of the coin`} draggable={false} className="h-full w-full object-cover" /> : null}</div>
      <figcaption className="pt-1 text-center text-sm text-muted">{label}</figcaption>
    </figure>
  );
}

export function ConfirmSheet({ item, onClose, onLetGo }: { item: Item; onClose: () => void; onLetGo: (id: string) => void }) {
  useSheetBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const countries = useCountries();
  const photos = usePhotos(item.id);
  const looking = item.status === 'considering';
  const [editing, setEditing] = useState(false);
  const [wishing, setWishing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState(item.country ?? '');
  const [denomination, setDenomination] = useState(item.denomination);
  const [year, setYear] = useState(item.year === null ? '' : String(item.year));
  const [mintMark, setMintMark] = useState(item.mintMark ?? '');
  const [series, setSeries] = useState(item.series ?? '');
  const [design, setDesign] = useState(item.design ?? '');
  const [grade, setGrade] = useState(item.gradeGuess ?? '');
  const [inscription, setInscription] = useState(item.inscription);

  const flagOf = (code: string) => countries.find((c) => c.code === code)?.flag ?? '';
  const nameOf = (code: string) => countries.find((c) => c.code === code)?.name ?? code;
  const options = !country || countries.some((c) => c.code === country) ? countries : [...countries, { code: country, name: country, flag: '' }];
  const unknown = <span className="text-muted">Not known</span>;

  const confirm = async (changes: ItemChanges = {}) => {
    setBusy(true);
    await updateItem(item.id, { ...changes, status: 'confirmed' });
    onClose();
  };
  const save = () =>
    confirm({
      country: country || null,
      denomination: denomination.trim(),
      year: year === '' ? null : Number(year),
      mintMark: mintMark.trim() || null,
      series: series.trim() || null,
      design: design.trim() || null,
      gradeGuess: grade || null,
      inscription: inscription.trim(),
    });
  const letGo = async () => {
    setBusy(true);
    // the host shows Undo at once, so the screen never flashes 'not in your collection' between the removal and the Undo
    onLetGo(item.id);
    await removeItem(item.id);
  };

  if (wishing) return <WishSheet item={item} onBack={() => setWishing(false)} onClose={onClose} />;

  return (
    <div role="dialog" aria-modal="true" aria-label="Confirm" className="fixed inset-0 z-40 flex flex-col bg-canvas">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <h2 className="text-2xl font-semibold text-accent">{editing ? 'Change what is wrong' : looking ? 'Do you want it?' : 'Is this right?'}</h2>
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-2 text-lg font-medium text-muted">
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex gap-3">
          <Side blob={photos?.find((p) => p.side === 'obverse')?.blob} label="Front" />
          <Side blob={photos?.find((p) => p.side === 'reverse')?.blob} label="Back" />
        </div>

        {!editing && looking ? (
          <section aria-label="Is it a good one?" className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <h3 className="text-xl font-semibold text-accent">Is it a good one?</h3>
            <p className="mt-1 text-2xl text-ink">
              {item.gradeGuess ? (
                <>
                  <span>{item.gradeGuess}</span> · <em className="text-muted not-italic">guess</em>
                </>
              ) : (
                <span className="text-muted">No grade guess</span>
              )}
            </p>
            {item.gradeNotes ? <p className="mt-1 text-lg text-ink">{item.gradeNotes}</p> : null}
            <WorthLine itemId={item.id} className="mt-2" />
          </section>
        ) : null}
        {editing ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input label="Country" id="confirm-country">
              <select id="confirm-country" value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
                <option value="">Not known</option>
                {options.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Input>
            <Input label="Denomination" id="confirm-denomination">
              <input id="confirm-denomination" value={denomination} onChange={(e) => setDenomination(e.target.value)} className={field} />
            </Input>
            <Input label="Year" id="confirm-year">
              <input id="confirm-year" value={year} inputMode="numeric" pattern="[0-9]*" maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} className={field} />
            </Input>
            <Input label="Mint mark" id="confirm-mint">
              <input id="confirm-mint" value={mintMark} maxLength={12} autoCapitalize="characters" onChange={(e) => setMintMark(e.target.value)} className={field} />
            </Input>
            <Input label="Series" id="confirm-series">
              <input id="confirm-series" value={series} onChange={(e) => setSeries(e.target.value)} className={field} />
            </Input>
            <Input label="Design" id="confirm-design">
              <input id="confirm-design" value={design} onChange={(e) => setDesign(e.target.value)} className={field} />
            </Input>
            <Input label="Grade guess" id="confirm-grade">
              <select id="confirm-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={field}>
                <option value="">No guess</option>
                {GRADES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} · {name}
                  </option>
                ))}
              </select>
            </Input>
            <Input label="Inscription" id="confirm-inscription">
              <input id="confirm-inscription" value={inscription} onChange={(e) => setInscription(e.target.value)} className={field} />
            </Input>
          </form>
        ) : (
          <dl className="space-y-4">
            <Row label="Country">{item.country ? `${flagOf(item.country)} ${nameOf(item.country)}`.trim() : unknown}</Row>
            <Row label="Denomination">{item.denomination || unknown}</Row>
            <Row label="Year">{item.year ?? unknown}</Row>
            {item.mintMark ? <Row label="Mint mark">{item.mintMark}</Row> : null}
            {item.series ? <Row label="Series">{item.series}</Row> : null}
            {item.design ? <Row label="Design">{item.design}</Row> : null}
            {item.gradeGuess && !looking ? (
              <Row label="Grade">
                <span>{item.gradeGuess}</span> · <em className="text-muted not-italic">guess</em>
              </Row>
            ) : null}
            {item.inscription ? <Row label="Inscription">{item.inscription}</Row> : null}
            {item.funFact ? <Row label="Fun fact">{item.funFact}</Row> : null}
          </dl>
        )}

        {!editing && !looking ? <WorthLine itemId={item.id} /> : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-line px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {editing ? (
          <>
            <button type="button" disabled={busy} onClick={save} className={`${big} bg-accent text-accent-fg`}>
              {looking ? 'Save and add it' : 'Save and confirm'}
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className={`${big} border border-line text-muted`}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => confirm()} className={`${big} bg-accent text-accent-fg`}>
              {looking ? 'Add it' : "That's right"}
            </button>
            {looking ? (
              <button type="button" disabled={busy} onClick={() => setWishing(true)} className={`${big} border border-accent text-accent`}>
                Wish for it
              </button>
            ) : null}
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => setEditing(true)} className={`${big} border border-accent text-accent`}>
                Not quite
              </button>
              {looking ? (
                <button type="button" disabled={busy} onClick={letGo} className={`${big} border-2 border-bad text-bad`}>
                  Let it go
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
