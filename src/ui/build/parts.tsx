/**
 * The parts Build is assembled from.
 *
 * Build is the one screen where the app is a form, and a form used at a table
 * in bad light needs the cockpit's discipline: one tap target per decision,
 * nothing under 44px, and a selected state that survives being read by someone
 * who cannot tell the accent colour from the border. Every choice here carries
 * a filled indicator box as well as a tint.
 *
 * "One tap target per decision" is about the *decision* and not about the card,
 * and the difference matters on the three steps where the only evidence for a
 * choice is a paragraph of SRD prose. There the card carries a second target,
 * to read rather than to decide, and it is a sibling of the `Choice` rather
 * than something inside it - `Choice`'s root is a `<button>`, and a button
 * inside a button is invalid HTML that this repo has already shipped twice (see
 * the note further down this file, and DomainCardView.tsx). `Wizard.tsx`'s
 * `ChoiceWithReader` is where that pairing lives and where its geometry is
 * argued. `Choice`'s own `clamp` stays for the surfaces that still want a
 * fixed teaser rather than a reader: `LevelUp.tsx` passes it twice.
 */
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Experience, Gold, InventoryEntry, Item } from '../../../shared/types.ts';
import { formatGold, gain, inHandfuls, spend } from '../../engine/gold.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import { ItemPicker } from './GearPicker.tsx';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Section({
  label,
  hint,
  children,
  gap = 10,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  gap?: number;
}): React.JSX.Element {
  // On a phone the hint drops under the label; sharing a line at 390px turns a
  // sentence of guidance into two columns of collided type.
  const phone = useIsPhone();
  return (
    <section className="stack" style={{ gap }}>
      <div className={phone ? 'stack' : 'spread'} style={phone ? { gap: 5 } : undefined}>
        <h3 className="t-label" style={{ margin: 0 }}>
          {label}
        </h3>
        {hint !== undefined && (
          <span
            className="t-meta"
            style={{ color: 'var(--dim)', textAlign: phone ? 'left' : 'right', lineHeight: 1.45 }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** A responsive column set that collapses to one column on a phone. */
export function Columns({
  min = 260,
  gap = 12,
  children,
}: {
  min?: number;
  gap?: number;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
        gap,
        alignItems: 'start',
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

interface ChoiceProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  meta?: ReactNode;
  body?: string;
  /** Colour of the selected rail. Reinforcement only - the box carries it. */
  accent?: string;
  disabled?: boolean;
  /**
   * Out of reach but still choosable: dimmed and explained, never blocked.
   *
   * Separate from `disabled` because it is the OPPOSITE promise. `disabled`
   * says the app refuses; this says the book has not opened it yet and the app
   * is not going to argue with a GM who hands it over anyway. It is the shape
   * `GearPicker`'s `PickerRow` already draws for out-of-level gear - 0.5 on the
   * content, the button live - and the honesty rule `gear.ts` states: hiding
   * out-of-reach content tells a player it does not exist.
   */
  dim?: boolean;
  reason?: string;
  clamp?: number;
  lead?: ReactNode;
  children?: ReactNode;
}

export function Choice({
  selected,
  onClick,
  title,
  meta,
  body,
  accent = 'var(--hope)',
  disabled = false,
  dim = false,
  reason,
  clamp,
  lead,
  children,
}: ChoiceProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={reason}
      className="stack"
      style={{
        minHeight: 'var(--tap)',
        width: '100%',
        gap: 6,
        padding: '11px 12px',
        textAlign: 'left',
        borderRadius: 'var(--r3)',
        background: selected ? 'var(--raised)' : 'var(--panel)',
        border: `1px solid ${selected ? 'var(--line)' : 'var(--line-soft)'}`,
        borderLeft: `3px solid ${selected ? accent : 'transparent'}`,
        opacity: disabled ? 0.42 : dim ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span className="row" style={{ gap: 10, width: '100%', alignItems: 'flex-start' }}>
        {lead}
        <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <span style={{ font: '700 14px/1.2 var(--sans)' }}>{title}</span>
          {meta !== undefined && (
            <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
              {meta}
            </span>
          )}
        </span>
        <Mark on={selected} />
      </span>
      {body !== undefined && body !== '' && (
        <span
          className="t-read"
          style={
            clamp === undefined
              ? { whiteSpace: 'pre-line' }
              : {
                  display: '-webkit-box',
                  WebkitLineClamp: clamp,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'pre-line',
                }
          }
        >
          {body}
        </span>
      )}
      {reason !== undefined && (
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {reason.toUpperCase()}
        </span>
      )}
      {children}
    </button>
  );
}

/** Selected/unselected as a shape, so the state is never only a colour. */
export function Mark({ on, size = 16 }: { on: boolean; size?: number }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: 'none',
        width: size,
        height: size,
        marginTop: 1,
        borderRadius: 3,
        background: on ? 'var(--text)' : 'transparent',
        border: `1.5px solid ${on ? 'var(--text)' : 'var(--empty)'}`,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {on && (
        <span
          style={{
            width: size * 0.5,
            height: size * 0.26,
            borderLeft: '2px solid var(--app)',
            borderBottom: '2px solid var(--app)',
            transform: 'rotate(-45deg) translate(1px, -1px)',
          }}
        />
      )}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
  label?: string;
}): React.JSX.Element {
  return (
    <div
      className="row"
      role="group"
      aria-label={label}
      style={{
        gap: 2,
        padding: 2,
        borderRadius: 'var(--r3)',
        background: 'var(--panel)',
        border: '1px solid var(--line-soft)',
      }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className="chip"
          style={{
            minHeight: 'var(--tap)',
            flex: 1,
            padding: '0 12px',
            background: value === v ? 'var(--raised)' : 'transparent',
            border: `1px solid ${value === v ? 'var(--line)' : 'transparent'}`,
            color: value === v ? 'var(--text)' : 'var(--muted)',
            fontWeight: value === v ? 700 : 600,
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** The printed sheet's checkboxes: how many of an option's slots are spent. */
export function SlotBoxes({
  used,
  slots,
  size = 13,
}: {
  used: number;
  slots: number;
  size?: number;
}): React.JSX.Element {
  // The name is clamped: a sheet from a build that over-granted a black-boxed
  // advancement reports more marked than the tier prints, and "4 of 2 slots
  // marked" is not a sentence. The pips below are drawn from `slots`, so they
  // were already bounded; only the words a screen reader gets were not.
  const inked = Math.min(used, slots);
  return (
    <span
      className="row"
      style={{ gap: 4, flex: 'none' }}
      role="img"
      aria-label={`${inked} of ${slots} slots marked`}
    >
      {Array.from({ length: slots }, (_, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: 2,
            border: `1.5px solid ${i < used ? 'var(--muted)' : 'var(--empty)'}`,
            background: i < used ? 'var(--muted)' : 'transparent',
          }}
        />
      ))}
    </span>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  format,
  width = 44,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  format?: (v: number) => string;
  width?: number;
}): React.JSX.Element {
  const btn: CSSProperties = {
    width: 'var(--tap)',
    minHeight: 'var(--tap)',
    flex: 'none',
    borderRadius: 'var(--r2)',
    border: '1px solid var(--line)',
    background: 'var(--raised)',
    font: '700 17px/1 var(--sans)',
  };
  return (
    <span className="row" style={{ gap: 6 }}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
        style={{ ...btn, opacity: value <= min ? 0.4 : 1 }}
      >
        −
      </button>
      <span
        className="t-num"
        aria-live="polite"
        style={{ minWidth: width, textAlign: 'center', font: '700 16px/1 var(--mono)' }}
      >
        {format ? format(value) : value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
        style={{ ...btn, opacity: value >= max ? 0.4 : 1 }}
      >
        +
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Telling the player something
// ---------------------------------------------------------------------------

const TONES = {
  error: { color: 'var(--damage)', word: 'CANNOT APPLY' },
  warn: { color: 'var(--stress)', word: 'CHECK' },
  ok: { color: 'var(--ok)', word: 'READY' },
  info: { color: 'var(--muted)', word: 'NOTE' },
} as const;

export function Callout({
  tone,
  items,
  word,
}: {
  tone: keyof typeof TONES;
  items: string[];
  word?: string;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  const t = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="stack"
      style={{
        gap: 6,
        padding: '10px 12px',
        borderRadius: 'var(--r3)',
        background: 'var(--panel)',
        border: '1px solid var(--line-soft)',
        borderLeft: `3px solid ${t.color}`,
      }}
    >
      <span className="t-label" style={{ color: t.color }}>
        {word ?? t.word}
      </span>
      {items.map((item) => (
        <span key={item} className="t-read" style={{ color: 'var(--text-2)' }}>
          {item}
        </span>
      ))}
    </div>
  );
}

/** A rules feature, shown verbatim. The app never runs one of these. */
export function FeatureBlock({
  name,
  text,
  tag,
}: {
  name: string;
  text: string;
  tag?: string;
}): React.JSX.Element {
  // A span, not a div: subclass and ancestry features are rendered *inside* a
  // Choice, whose root is a <button>, and a button may only contain phrasing
  // content. React does not police this one, so the browser is left to guess.
  return (
    <span
      className="stack"
      style={{ gap: 5, padding: '10px 12px', borderRadius: 'var(--r3)', background: 'var(--app)' }}
    >
      <span className="row" style={{ gap: 8 }}>
        <span style={{ font: '700 12.5px/1.2 var(--sans)', color: 'var(--text-2)' }}>{name}</span>
        {tag !== undefined && <span className="chip chip-name">{tag}</span>}
      </span>
      <span className="t-read" style={{ whiteSpace: 'pre-line' }}>
        {text}
      </span>
    </span>
  );
}

/** Shown when data/srd-2.0.json has not been built. Honest, not a crash. */
export function DatasetEmpty({ what }: { what: string }): React.JSX.Element {
  return (
    <div
      className="panel stack"
      style={{ gap: 8, padding: 16, borderLeft: '3px solid var(--stress)' }}
    >
      <span className="t-label" style={{ color: 'var(--stress)' }}>
        No {what} in this build
      </span>
      <p className="t-body" style={{ margin: 0 }}>
        The SRD dataset has not been generated on this device, so there is nothing to choose from.
        Run <code style={{ font: '500 13px/1 var(--mono)', color: 'var(--text)' }}>npm run
        build:srd</code> to produce <code style={{ font: '500 13px/1 var(--mono)' }}>data/srd-2.0.json</code>,
        then reload. Everything you have already typed is kept.
      </p>
    </div>
  );
}

/**
 * A caption and a field.
 *
 * `invalid` and `describedBy` exist for the one field on these forms that can
 * be *refused* - the wizard's Name, against the unique-name rule in
 * `store/names.ts`. They are on the single-line input only, because that is
 * the only shape anything refuses today, and they are two props rather than a
 * bundled "error" prop because this component does not draw the sentence: the
 * sentence lives in `NameRefusal`, in one live region shared with the rename
 * control, and this end of it is only the field pointing at it.
 */
export function LabelledInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline = false,
  rows,
  invalid = false,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  /** The value in this field is being refused. */
  invalid?: boolean;
  /** The id of the region carrying the reason it is being refused. */
  describedBy?: string;
}): React.JSX.Element {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span className="t-label">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows ?? 3}
          style={{ minHeight: 76, width: '100%' }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          style={{ width: '100%' }}
        />
      )}
      {hint !== undefined && (
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Editors shared by the wizard and the sheet
// ---------------------------------------------------------------------------

export function ExperienceEditor({
  value,
  onChange,
  minRows = 0,
  lockBonus = false,
}: {
  value: Experience[];
  onChange: (next: Experience[]) => void;
  /** Rows that cannot be removed - creation always has exactly two. */
  minRows?: number;
  lockBonus?: boolean;
}): React.JSX.Element {
  const patch = (i: number, next: Partial<Experience>): void =>
    onChange(value.map((e, j) => (i === j ? { ...e, ...next } : e)));

  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.map((exp, i) => (
        <div key={exp.id} className="row" style={{ gap: 8 }}>
          <input
            type="text"
            value={exp.name}
            onChange={(e) => patch(i, { name: e.target.value })}
            placeholder={i === 0 ? 'e.g. Fallen Monarch' : 'e.g. Never Again'}
            aria-label={`Experience ${i + 1}`}
            style={{ flex: 1, minWidth: 0 }}
          />
          {lockBonus ? (
            <span
              className="t-num"
              style={{ flex: 'none', width: 46, textAlign: 'center', color: 'var(--hope)' }}
            >
              +{exp.bonus}
            </span>
          ) : (
            <Stepper
              label={`bonus for ${exp.name || `experience ${i + 1}`}`}
              value={exp.bonus}
              onChange={(v) => patch(i, { bonus: v })}
              min={0}
              max={9}
              width={32}
              format={(v) => `+${v}`}
            />
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            disabled={value.length <= minRows}
            aria-label={`Remove experience ${i + 1}`}
            style={{ flex: 'none', minWidth: 44, padding: 0 }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ alignSelf: 'flex-start' }}
        onClick={() =>
          /*
           * A new Experience is worth +2, whoever is adding it.
           *
           * The SRD grants one at creation and again at levels 2, 5 and 8, and
           * every one of them arrives at +2; the +1 is the separate advancement
           * that raises two Experiences you already have. Defaulting to +1 here
           * made the editor disagree with the wizard about the same rule, and
           * it is the screen a player reaches for when they are putting an
           * Experience back - the stepper still moves for house rules and for
           * the ones that have been raised.
           */
          onChange([...value, { id: crypto.randomUUID(), name: '', bonus: 2 }])
        }
      >
        Add an Experience
      </button>
    </div>
  );
}

export function GoldEditor({
  gold,
  onChange,
}: {
  gold: Gold;
  onChange: (g: Gold) => void;
}): React.JSX.Element {
  const bump = (key: keyof Gold, dir: 1 | -1): void =>
    onChange((dir === 1 ? gain(gold, { [key]: 1 }) : spend(gold, { [key]: 1 })).gold);

  const rows: Array<[keyof Gold, string]> = [
    ['handfuls', 'Handfuls'],
    ['bags', 'Bags'],
    ['chests', 'Chests'],
  ];

  // The purse is not base 10 on the way up either: the tenth handful *is* a bag
  // and erases the handfuls. Clamping the steppers at 0-9 per digit would look
  // right and quietly make the carry - the part of engine/gold.ts that is
  // actually hard - unreachable, so each end is asked of the engine instead.
  const full = gain(gold, { handfuls: 1 }).overflowed;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
        {rows.map(([key, label]) => {
          const canGain = !gain(gold, { [key]: 1 }).overflowed;
          const canSpend = !spend(gold, { [key]: 1 }).insufficient;
          return (
            <div key={key} className="spread" style={{ alignItems: 'center' }}>
              <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                {label.toUpperCase()}
              </span>
              <Stepper
                label={label}
                value={gold[key]}
                onChange={(v) => bump(key, v > gold[key] ? 1 : -1)}
                min={canSpend ? gold[key] - 1 : gold[key]}
                max={canGain ? gold[key] + 1 : gold[key]}
                width={30}
              />
            </div>
          );
        })}
      </div>
      <div className="spread" style={{ alignItems: 'baseline', maxWidth: 320 }}>
        <span className="t-hint" style={{ color: 'var(--text-2)' }}>
          {formatGold(gold)}
        </span>
        <span className="t-meta">
          {inHandfuls(gold)} HANDFUL{inHandfuls(gold) === 1 ? '' : 'S'} IN ALL
        </span>
      </div>
      {full && (
        <Callout
          tone="info"
          word="PURSE"
          items={['The purse is full — one chest is the carry limit.']}
        />
      )}
    </div>
  );
}

export function InventoryEditor({
  value,
  onChange,
}: {
  value: InventoryEntry[];
  onChange: (next: InventoryEntry[]) => void;
}): React.JSX.Element {
  const [browsing, setBrowsing] = useState(false);

  const patch = (i: number, next: Partial<InventoryEntry>): void =>
    onChange(value.map((e, j) => (i === j ? { ...e, ...next } : e)));

  // What is already carried, so the picker can say so and a second tap on the
  // same row raises the count rather than growing a second identical line.
  const carried = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of value) {
      if (entry.ref !== null) counts.set(entry.ref, (counts.get(entry.ref) ?? 0) + entry.quantity);
    }
    return counts;
  }, [value]);

  const add = (item: Item): void => {
    const at = value.findIndex((e) => e.ref === item.id);
    if (at >= 0) {
      onChange(value.map((e, j) => (j === at ? { ...e, quantity: e.quantity + 1 } : e)));
    } else {
      onChange([...value, { ref: item.id, name: item.name, quantity: 1, note: item.text }]);
    }
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.map((entry, i) => (
        <div
          key={`${entry.ref ?? 'free'}-${i}`}
          className="stack"
          style={{
            gap: 7,
            padding: '9px 10px',
            borderRadius: 'var(--r3)',
            background: 'var(--panel)',
            border: '1px solid var(--line-soft)',
            borderLeft: `3px solid ${entry.ref === null ? 'var(--line)' : 'var(--armor)'}`,
          }}
        >
          <div className="row" style={{ gap: 8 }}>
            <input
              type="text"
              value={entry.name}
              onChange={(e) => patch(i, { name: e.target.value, ref: null })}
              placeholder="Item"
              aria-label={`Item ${i + 1} name`}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Stepper
              label={`quantity of ${entry.name || 'item'}`}
              value={entry.quantity}
              onChange={(v) => patch(i, { quantity: v })}
              min={1}
              max={99}
              width={28}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Remove ${entry.name || `item ${i + 1}`}`}
              style={{ flex: 'none', minWidth: 44, padding: 0 }}
            >
              ✕
            </button>
          </div>
          {entry.note !== undefined && entry.note !== '' && (
            <span className="t-read" style={{ color: 'var(--muted)' }}>
              {entry.note}
            </span>
          )}
        </div>
      ))}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          onClick={() => setBrowsing(true)}
          style={{ flex: '1 1 200px', minWidth: 0 }}
        >
          Search the loot and consumable tables
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange([...value, { ref: null, name: '', quantity: 1 }])}
        >
          Add free text
        </button>
      </div>
      {value.length === 0 && (
        <span className="t-hint" style={{ color: 'var(--dim)' }}>
          Nothing carried yet.
        </span>
      )}
      {browsing && (
        <ItemPicker carried={carried} onAdd={add} onClose={() => setBrowsing(false)} />
      )}
    </div>
  );
}
