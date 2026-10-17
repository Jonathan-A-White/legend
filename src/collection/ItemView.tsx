// src/collection/ItemView.tsx: one item at #/item/<id>: both photographs large (a tap zooms), its facts in a clean two-column sheet,
// the inscription and the fun fact, notes that save as he types, tags, Edit, and Remove as a bar that must be held (an Undo for five
// seconds). Share (src/share/) makes a card of its photos and facts; Ask the tutor opens the tutor's sheet over it (#/item/<id>?ask).
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type ReactNode } from 'react';
import type { Item, Photo } from '../data/db';
import { itemName, kindInfo } from '../data/kinds';
import { getItem, removeItem, restoreItem, usePhotos } from '../data/repositories';
import { ItemReading } from '../capture';
import { askHash, isAsking, itemHash, navigate, useAddress } from '../nav/route';
import { ShareButton, shareItem } from '../share';
import { AskSheet } from '../tutor';
import { HoldBar } from '../ui/HoldBar';
import { RarityLine } from '../rarity';
import { WishedCard } from '../wishlist';
import { WorthLine } from '../worth';
import { EditSheet } from './EditSheet';
import { ItemFolders } from './Folders';
import { NotesField } from './NotesField';
import { PhotoViewer } from './PhotoViewer';
import { useObjectUrl } from '../ui/useObjectUrl';
import { useReference, type Reference } from './useReference';

/** How long Undo is offered after Remove. */
export const UNDO_MS = 5000;
/** How long Remove must be held. */
export const REMOVE_HOLD_MS = 700;

function PhotoCard({ photo, side, title, onZoom }: { photo: Photo | undefined; side: 'Obverse' | 'Reverse'; title: string; onZoom: (url: string, label: string) => void }) {
  const url = useObjectUrl(photo?.blob);
  const label = `${side} of ${title}`;
  return (
    <figure className="min-w-0">
      {photo ? (
        <button type="button" disabled={!url} onClick={() => url && onZoom(url, label)} aria-label={`Zoom the ${side.toLowerCase()} photo`} className="block aspect-square w-full overflow-hidden rounded-2xl border border-line bg-surface">
          {url ? <img src={url} alt={label} draggable={false} className="h-full w-full object-contain" /> : null}
        </button>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-line px-3 text-center text-base text-muted">No {side.toLowerCase()} photo</div>
      )}
      <figcaption className="pt-1 text-center text-base text-muted">{side}</figcaption>
    </figure>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-base text-muted">{label}</dt>
      <dd className="min-w-0 text-lg text-ink">{children}</dd>
    </>
  );
}

function Facts({ item, reference }: { item: Item; reference: Reference }) {
  const city = item.mintMark ? reference.mintCity(item.mintMark, item.country) : null;
  const unknown = <span className="text-muted">Not known yet</span>;
  return (
    <section aria-label="Facts" className="rounded-2xl border border-line bg-surface px-4 py-3">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2">
        <Fact label="Country">
          {item.country ? `${reference.flag(item.country)} ${reference.countryName(item.country)}` : unknown}
        </Fact>
        <Fact label="Kind">{kindInfo(item.kind).label}</Fact>
        {item.kind === 'other' && item.subtype ? <Fact label="Subtype">{item.subtype}</Fact> : null}
        {item.kind !== 'other' || item.denomination ? <Fact label="Denomination">{item.denomination || unknown}</Fact> : null}
        {item.kind !== 'other' || item.year !== null ? <Fact label="Year">{item.year ?? unknown}</Fact> : null}
        {item.mintMark ? <Fact label="Mint">{city ? `${item.mintMark} · ${city}` : item.mintMark}</Fact> : null}
        {item.series ? <Fact label="Series">{item.series}</Fact> : null}
        {item.design ? <Fact label="Design">{item.design}</Fact> : null}
        {item.material ? <Fact label="Material">{item.material}</Fact> : null}
        {item.currency ? <Fact label="Currency">{item.currency}</Fact> : null}
        {item.gradeGuess ? (
          <Fact label="Grade">
            {item.gradeGuess} · <em className="text-muted not-italic">guess</em>
          </Fact>
        ) : null}
        {item.gradeNotes ? <Fact label="Wear">{item.gradeNotes}</Fact> : null}
        {item.confidence && item.status !== 'confirmed' ? <Fact label="Sure?">{item.confidence === 'high' ? 'Quite sure' : item.confidence === 'medium' ? 'Fairly sure' : 'Not very sure'}</Fact> : null}
      </dl>
    </section>
  );
}

const share = 'flex min-h-14 items-center justify-center rounded-2xl border border-accent text-lg font-semibold text-accent active:bg-surface';

export function ItemView({ id }: { id: string }) {
  // null: there is no such item; undefined: still loading
  const item = useLiveQuery(async () => (await getItem(id)) ?? null, [id]);
  const photos = usePhotos(id);
  const reference = useReference();
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [holding, setHolding] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [removed, setRemoved] = useState(false);
  const asking = isAsking(useAddress());

  // Undo is offered for five seconds, then he is taken back to the Collection.
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => {
      setRemoved(false);
      navigate('#/collection', { replace: true });
    }, UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  if (item === undefined) return <main aria-label="Item" className="flex-1" />;
  if (item === null || (item.deletedAt !== null && !removed)) {
    return (
      <main aria-label="Item" className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl font-semibold text-ink">This item is not in your collection</p>
        <a href="#/collection" className="mt-4 flex min-h-12 items-center rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg">
          Back to the Collection
        </a>
      </main>
    );
  }

  if (removed) {
    return (
      <main aria-label="Item" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="status" className="text-2xl font-semibold text-ink">
          {item.status === 'considering' || item.status === 'wished' ? 'Let go' : 'Removed from your collection'}
        </p>
        <button
          type="button"
          onClick={async () => {
            await restoreItem(id);
            setRemoved(false);
          }}
          className="min-h-14 rounded-2xl bg-accent px-10 text-xl font-semibold text-accent-fg"
        >
          Undo
        </button>
        <p className="text-base text-muted">You have five seconds.</p>
      </main>
    );
  }

  const title = item.denomination && item.year !== null ? `${itemName(item)}, ${item.year}` : itemName(item);
  const photo = (side: 'obverse' | 'reverse') => photos?.find((p) => p.side === side);

  return (
    <main aria-label="Item" className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center px-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <a href="#/collection" className="flex min-h-12 items-center gap-1 rounded-xl px-3 text-lg font-medium text-accent">
          <span aria-hidden="true">‹</span> Collection
        </a>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-1 pb-6">
        <header>
          <h1 className="text-3xl font-semibold leading-tight text-accent">{title}</h1>
          {item.country ? (
            <p className="mt-1 text-lg text-muted">
              {reference.flag(item.country)} {reference.countryName(item.country)}
            </p>
          ) : null}
        </header>

        <ItemReading item={item} onLetGo={() => setRemoved(true)} />
        {item.status === 'wished' ? <WishedCard item={item} /> : null}

        <div className="grid grid-cols-2 gap-3">
          <PhotoCard photo={photo('obverse')} side="Obverse" title={title} onZoom={(url, label) => setZoom({ url, label })} />
          <PhotoCard photo={photo('reverse')} side="Reverse" title={title} onZoom={(url, label) => setZoom({ url, label })} />
        </div>

        <Facts item={item} reference={reference} />
        <RarityLine item={item} onEdit={() => setEditing(true)} />
        <WorthLine itemId={item.id} />

        {item.inscription ? (
          <section aria-label="Inscription">
            <h2 className="text-lg font-semibold text-ink">Inscription</h2>
            <p className="mt-1 text-lg tracking-wide text-ink">{item.inscription}</p>
          </section>
        ) : null}
        {item.funFact ? (
          <section aria-label="Fun fact" className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-accent">Fun fact</h2>
            <p className="mt-1 text-lg text-ink">{item.funFact}</p>
          </section>
        ) : null}

        <ItemFolders item={item} />

        <NotesField key={item.id} itemId={item.id} initial={item.notes} />

        {item.tags.length > 0 ? (
          <ul aria-label="Tags" className="flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <li key={t} className="rounded-full border border-line px-4 py-1.5 text-base text-muted">
                {t}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate(askHash(itemHash(id)))} className="flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-fg">
            Ask the tutor
          </button>
          {item.status === 'wished' ? null : <ShareButton which="item" make={() => shareItem(id)} className={share} />}
        </div>
        <button type="button" onClick={() => setEditing(true)} className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-accent text-lg font-semibold text-accent">
          Edit
        </button>

        <div className="pt-4">
          <HoldBar
            name="Remove"
            danger
            holding={holding}
            holdMs={REMOVE_HOLD_MS}
            label={holding ? 'Keep holding…' : 'Hold to remove'}
            hold={{
              onPress: () => setTapped(false),
              onTap: () => setTapped(true),
              onHold: () => {
                setHolding(true);
                void removeItem(id).then(() => {
                  setHolding(false);
                  setRemoved(true);
                });
              },
              onRelease: () => setHolding(false),
              onDrop: () => setHolding(false),
            }}
          />
          {tapped ? (
            <p role="status" className="pt-2 text-center text-base text-muted">
              Press and hold the button to remove this item. A tap does nothing.
            </p>
          ) : null}
        </div>
      </div>

      {zoom ? <PhotoViewer url={zoom.url} label={zoom.label} onClose={() => setZoom(null)} /> : null}
      {editing ? <EditSheet item={item} reference={reference} onClose={() => setEditing(false)} /> : null}
      {asking ? (
        <AskSheet
          about={{ kind: 'item', item, countryName: item.country ? reference.countryName(item.country) : null, mintCity: item.mintMark ? reference.mintCity(item.mintMark, item.country) : null }}
          onClose={() => window.history.back()}
        />
      ) : null}
    </main>
  );
}
