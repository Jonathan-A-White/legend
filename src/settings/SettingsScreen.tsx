// src/settings/SettingsScreen.tsx: the Settings screen. It draws the rows src/settings/rows.ts lists, section by section as
// cards, each row by its kind (a switch, a choice, a number, a text, or the About row), with the registry's one-line hint under it and
// its longer help behind a small 'i'. It holds no setting of its own: a tap calls writeSetting, which saves and tells the bus.
// A new setting is one entry in the registry; a new kind of setting is one entry in CONTROLS (the type checker asks for it).
import { useId, useState, type ReactNode } from 'react';
import { TellTheMakerButton } from '../feedback';
import { BuildVersion } from '../ui/BuildVersion';
import { writeSetting, type SettingEntry, type SettingKind, type SettingValue } from './registry';
import { SECTIONS, visibleRows, type InfoRow, type SettingsRow } from './rows';
import { useSettings } from './useSettings';

const save = (key: string, value: SettingValue) => void writeSetting(key, value);

/** The longer help, behind a small 'i' on the name's line; tapping it again hides it. */
function HelpButton({ label, open, onToggle, id }: { label: string; open: boolean; onToggle: () => void; id: string }) {
  return (
    <button
      type="button"
      aria-label={`About ${label}`}
      aria-expanded={open}
      aria-controls={id}
      onClick={onToggle}
      className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center text-muted"
    >
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full border border-line text-sm font-semibold italic">
        i
      </span>
    </button>
  );
}

/** One row: the name (and the control, when it fits beside it), the hint, and the help on request. */
function Row({ row, beside, below }: { row: SettingsRow; beside?: ReactNode; below?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const helpId = useId();
  return (
    <div data-setting={row.key} data-talkable={row.talkable} className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex min-h-11 items-center gap-3">
        <span className="flex-1 text-lg font-medium">{row.label}</span>
        {beside}
        <HelpButton label={row.label} open={open} onToggle={() => setOpen(!open)} id={helpId} />
      </div>
      <p className="text-base text-muted">{row.hint}</p>
      {open ? (
        <p id={helpId} className="mt-2 text-base">
          {row.help}
        </p>
      ) : null}
      {below}
    </div>
  );
}

type Held<E extends SettingEntry> = { row: E; value: SettingValue };

function SwitchControl({ row, value }: Held<Extract<SettingEntry, { kind: 'switch' }>>) {
  const on = value === true;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={row.label}
      onClick={() => save(row.key, !on)}
      className="-my-2 flex h-11 w-16 shrink-0 items-center justify-center"
    >
      <span className={`flex h-8 w-14 items-center rounded-full border px-1 transition-colors ${on ? 'border-accent bg-accent' : 'border-line bg-canvas'}`}>
        <span className={`size-6 rounded-full transition-transform ${on ? 'translate-x-6 bg-accent-fg' : 'translate-x-0 bg-muted'}`} />
      </span>
    </button>
  );
}

function ChoiceControl({ row, value }: Held<Extract<SettingEntry, { kind: 'choice' }>>) {
  return (
    <div role="radiogroup" aria-label={row.label} className="mt-2 flex rounded-xl border border-line p-0.5">
      {row.options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => save(row.key, option.value)}
            className={`min-h-11 flex-1 rounded-lg px-2 text-base font-medium ${on ? 'bg-accent text-accent-fg' : 'text-ink'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function NumberControl({ row, value }: Held<Extract<SettingEntry, { kind: 'number' }>>) {
  // The thumb follows the finger at once; the saved value catches up.
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? Number(value);
  return (
    <div className="mt-2 flex items-center gap-3">
      <input
        type="range"
        aria-label={row.label}
        min={row.min}
        max={row.max}
        step={row.step}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.valueAsNumber);
          save(row.key, e.target.valueAsNumber);
        }}
        onPointerUp={() => setDraft(null)}
        onBlur={() => setDraft(null)}
        className="h-11 min-w-0 flex-1 accent-[var(--lg-accent)]"
      />
      <span className="w-20 shrink-0 text-right text-lg tabular-nums">
        {shown} {row.unit}
      </span>
    </div>
  );
}

function TextControl({ row, value }: Held<Extract<SettingEntry, { kind: 'text' }>>) {
  // What he types stays on screen as he types it; the saved value catches up.
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      type="text"
      aria-label={row.label}
      placeholder={row.placeholder}
      maxLength={row.maxLength}
      autoComplete="off"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        save(row.key, e.target.value);
      }}
      className="mt-2 h-12 w-full rounded-xl border border-line bg-canvas px-4 text-lg text-ink placeholder:text-muted focus:border-accent focus:outline-none"
    />
  );
}

/** How each kind of row is drawn. `Record` over the kinds: a new kind is a compile error until it has a control here. */
const CONTROLS: Record<SettingKind, (props: { row: never; value: SettingValue }) => ReactNode> = {
  switch: SwitchControl as never,
  choice: ChoiceControl as never,
  number: NumberControl as never,
  text: TextControl as never,
};

/** Where the control sits: a switch sits beside the name, the others under the hint. */
function SettingRowView({ row, value }: { row: SettingEntry; value: SettingValue }) {
  const Control = CONTROLS[row.kind];
  const control = <Control row={row as never} value={value} />;
  return row.kind === 'switch' ? <Row row={row} beside={control} /> : <Row row={row} below={control} />;
}

function AboutRow({ row }: { row: InfoRow }) {
  return <Row row={row} below={<BuildVersion className="mt-2 !text-left" />} />;
}

const isInfo = (row: SettingsRow): row is InfoRow => row.kind === 'about' || row.kind === 'tell';

function TellRow({ row }: { row: InfoRow }) {
  return <Row row={row} below={<TellTheMakerButton screen="Settings" />} />;
}

export function SettingsScreen() {
  const values = useSettings();
  // Until the values load nothing is drawn: a row that depends on another could flash in and out.
  const rows = values ? visibleRows(values) : [];
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-6">
      <h1 className="mb-4 text-3xl font-semibold tracking-wide text-accent">Settings</h1>
      {SECTIONS.map((section) => {
        const mine = rows.filter((r) => r.section === section.id);
        if (mine.length === 0) return null;
        return (
          <section key={section.id} aria-label={section.title} className="mb-6">
            <h2 className="mb-2 px-1 text-sm font-semibold tracking-widest text-muted uppercase">{section.title}</h2>
            <div className="rounded-2xl border border-line bg-surface">
              {mine.map((row) => (isInfo(row) ? row.kind === 'about' ? <AboutRow key={row.key} row={row} /> : <TellRow key={row.key} row={row} /> : <SettingRowView key={row.key} row={row} value={values![row.key]} />))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

