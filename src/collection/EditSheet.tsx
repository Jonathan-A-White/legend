// src/collection/EditSheet.tsx: Edit, every field of an item in one sheet. The country is chosen from a list with flags and the year
// from a number pad, so a wrong entry is hard to make. Save writes through the repository; Cancel and Back leave it as it was.
import { useEffect, useState, type ReactNode } from 'react';
import type { Item, ItemKind } from '../data/db';
import { KINDS, KIND_ORDER } from '../data/kinds';
import { updateItem, type ItemChanges } from '../data/repositories';
import { useSheetBack } from '../ui/sheetBack';
import { GRADES, parseTags } from './fields';
import type { Reference } from './useReference';

const field = 'min-h-12 w-full rounded-xl border border-line bg-canvas px-4 text-lg text-ink';

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export function EditSheet({ item, reference, onClose }: { item: Item; reference: Reference; onClose: () => void }) {
  useSheetBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [kind, setKind] = useState<ItemKind>(item.kind);
  const [subtype, setSubtype] = useState(item.subtype ?? '');
  const [country, setCountry] = useState(item.country ?? '');
  const [denomination, setDenomination] = useState(item.denomination);
  const [year, setYear] = useState(item.year === null ? '' : String(item.year));
  const [mintMark, setMintMark] = useState(item.mintMark ?? '');
  const [series, setSeries] = useState(item.series ?? '');
  const [design, setDesign] = useState(item.design ?? '');
  const [material, setMaterial] = useState(item.material);
  const [grade, setGrade] = useState(item.gradeGuess ?? '');
  const [inscription, setInscription] = useState(item.inscription ?? '');
  const [tags, setTags] = useState(item.tags.join(', '));
  const [saving, setSaving] = useState(false);

  const countries = reference.countryList.some((c) => c.code === country) || !country ? reference.countryList : [...reference.countryList, { code: country, name: country, flag: '' }];

  const save = async () => {
    setSaving(true);
    const changes: ItemChanges = {
      kind,
      subtype: kind === 'other' ? subtype.trim() || null : null,
      country: country || null,
      denomination: denomination.trim(),
      year: year === '' ? null : Number(year),
      mintMark: mintMark.trim() || null,
      series: series.trim() || null,
      design: design.trim() || null,
      material: material.trim(),
      gradeGuess: grade || null,
      inscription: inscription.trim(),
      tags: parseTags(tags),
    };
    await updateItem(item.id, changes);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit" className="fixed inset-0 z-20 flex flex-col bg-canvas">
      <div className="flex items-center justify-between border-b border-line px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-2 text-lg font-medium text-muted">
          Cancel
        </button>
        <h2 className="text-xl font-semibold text-accent">Edit</h2>
        <button type="button" disabled={saving} onClick={save} className="min-h-12 rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg disabled:opacity-50">
          Save
        </button>
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div role="radiogroup" aria-label="Kind" className="flex gap-2">
          {KIND_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={`min-h-12 flex-1 rounded-xl border text-lg font-medium ${kind === value ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`}
            >
              {KINDS[value].label}
            </button>
          ))}
        </div>
        {kind === 'other' ? (
          <Field label="Subtype" id="edit-subtype">
            <input id="edit-subtype" value={subtype} onChange={(e) => setSubtype(e.target.value)} placeholder="Subway token, medal…" className={field} />
          </Field>
        ) : null}
        <Field label="Country" id="edit-country">
          <select id="edit-country" value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
            <option value="">Not known</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Denomination" id="edit-denomination">
          <input id="edit-denomination" value={denomination} onChange={(e) => setDenomination(e.target.value)} placeholder="Quarter dollar, Five pounds…" className={field} />
        </Field>
        <Field label="Year" id="edit-year">
          <input
            id="edit-year"
            value={year}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="1964"
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
            className={field}
          />
        </Field>
        <Field label="Mint mark" id="edit-mint">
          <input id="edit-mint" value={mintMark} maxLength={12} autoCapitalize="characters" onChange={(e) => setMintMark(e.target.value)} placeholder="D, S, P…" className={field} />
        </Field>
        <Field label="Series" id="edit-series">
          <input id="edit-series" value={series} onChange={(e) => setSeries(e.target.value)} placeholder="America the Beautiful" className={field} />
        </Field>
        <Field label="Design" id="edit-design">
          <input id="edit-design" value={design} onChange={(e) => setDesign(e.target.value)} placeholder="Yosemite" className={field} />
        </Field>
        <Field label="Material" id="edit-material">
          <input id="edit-material" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Silver, copper-nickel, paper…" className={field} />
        </Field>
        <Field label="Grade guess" id="edit-grade">
          <select id="edit-grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={field}>
            <option value="">No guess</option>
            {GRADES.map(([code, name]) => (
              <option key={code} value={code}>
                {code} · {name}
              </option>
            ))}
            {grade && !GRADES.some(([code]) => code === grade) ? <option value={grade}>{grade}</option> : null}
          </select>
        </Field>
        <Field label="Inscription" id="edit-inscription">
          <input id="edit-inscription" value={inscription} onChange={(e) => setInscription(e.target.value)} placeholder="The words around the edge" className={field} />
        </Field>
        <Field label="Tags" id="edit-tags">
          <input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="silver, gift, from grandpa" className={field} />
        </Field>
      </form>
    </div>
  );
}
