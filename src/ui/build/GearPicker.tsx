/**
 * Picking gear out of 204 weapons, 34 armors and 120 items.
 *
 * The card browser already answered this question for 189 domain cards, so
 * this is that screen again rather than a second idea of what a filter looks
 * like: a search box, segmented controls, chip rows where empty means "any", a
 * count of what survived, and a CLEAR FILTERS that only exists once something
 * is filtered. Every filter crosses every other.
 *
 * It opens as a dialog because the alternative is a picker nested inside the
 * wizard's own scrolling panel - two scrollbars under one thumb, and filters
 * that scroll away from the list they filter. As a dialog the filters are
 * pinned, the list gets the whole viewport, and the wizard step behind it stays
 * short enough to fit a phone without scrolling at all.
 *
 * What a character cannot use yet is shown, dimmed, with the level it arrives
 * at. Hiding it would answer "what can I use" by pretending the rest of the
 * book does not exist, and a player deciding what to save for needs to see the
 * tier 3 weapon they are saving for.
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  RANGES,
  TRAITS,
  TRAIT_LABELS,
  type Armor,
  type Character,
  type Item,
  type Range,
  type Ref,
  type Tier,
  type Weapon,
  type WeaponTrait,
} from '../../../shared/types.ts';
import { deriveStats, weaponDamage, type DerivedStats } from '../../engine/character.ts';
import { useApp } from '../../store/state.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import {
  armorQuery,
  armorQueryChanged,
  filterArmors,
  filterItems,
  filterWeapons,
  itemQuery,
  itemQueryChanged,
  weaponQuery,
  weaponQueryChanged,
  type ArmorQuery,
  type ItemQuery,
  type WeaponQuery,
} from './gear.ts';

const TIERS: Tier[] = [1, 2, 3, 4];
const BURDENS = [1, 2] as const;
const WEAPON_TRAITS: WeaponTrait[] = [...TRAITS, 'spellcast'];

const toggled = <T,>(set: ReadonlySet<T>, v: T): ReadonlySet<T> => {
  const next = new Set(set);
  if (!next.delete(v)) next.add(v);
  return next;
};

/** A weapon may roll with Spellcast rather than a named trait. */
export const weaponTraitLabel = (t: WeaponTrait): string =>
  t === 'spellcast' ? 'SPELLCAST' : TRAIT_LABELS[t].toUpperCase();

/**
 * A weapon's line of numbers, with the damage the player will actually roll.
 *
 * The book prints `d8+3`; at Proficiency 3 you roll `3d8+3`. Printing the
 * book's version on a sheet that knows the Proficiency would make the player
 * do the app's arithmetic, so the engine is asked and its answer is what shows.
 */
export function weaponSummary(w: Weapon, stats: DerivedStats): string {
  const damage = weaponDamage(w, stats)?.spec ?? w.damage;
  return [
    `${damage} ${w.damageType === 'mag' ? 'MAG' : 'PHY'}`,
    w.range.toUpperCase(),
    weaponTraitLabel(w.trait),
    w.burden === 2 ? 'TWO-HANDED' : 'ONE-HANDED',
  ].join(' · ');
}

export const armorSummary = (a: Armor, thresholds: [number, number], score: number): string =>
  `${thresholds[0]}/${thresholds[1]} THRESHOLDS · SCORE ${score}`;

// ---------------------------------------------------------------------------
// The dialog and its furniture
// ---------------------------------------------------------------------------

function PickerDialog({
  label,
  count,
  head,
  children,
  onClose,
  onClear,
  clearLabel,
}: {
  label: string;
  /** The line under the filters: how many survived, and what the numbers mean. */
  count: React.ReactNode;
  head: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  /** Empties the slot. Absent where there is nothing to empty. */
  onClear?: () => void;
  clearLabel?: string;
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgb(10 11 15 / 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="stack"
        style={{
          width: '100%',
          maxWidth: 660,
          maxHeight: '100%',
          borderRadius: 'var(--r5)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }}
      >
        <div
          className="stack"
          style={{
            flex: 'none',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <div className="spread" style={{ alignItems: 'center' }}>
            <h3 style={{ margin: 0, font: '700 15px/1.2 var(--sans)' }}>{label}</h3>
            <button
              type="button"
              className="t-meta"
              onClick={onClose}
              aria-label="Close the picker"
              style={{ minHeight: 'var(--tap)', minWidth: 'var(--tap)', flex: 'none' }}
            >
              ✕
            </button>
          </div>
          {head}
          {count}
        </div>

        <div
          className="scroll stack"
          style={{ flex: 1, minHeight: 0, gap: 8, padding: '10px 12px 12px' }}
        >
          {children}
        </div>

        <div
          className="row"
          style={{
            flex: 'none',
            gap: 8,
            padding: '9px 12px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          {onClear !== undefined && (
            <button type="button" className="btn btn-ghost" onClick={onClear} style={{ flex: 1 }}>
              {clearLabel ?? 'Leave empty'}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}): React.JSX.Element {
  // Focus on a desktop, never on a phone: the keyboard would take half the
  // list before the player has seen it.
  const phone = useIsPhone();
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      autoFocus={!phone}
      style={{ width: '100%', minHeight: 'var(--tap)' }}
    />
  );
}

function Seg<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
  label: string;
}): React.JSX.Element {
  return (
    <div
      className="row"
      role="group"
      aria-label={label}
      style={{ gap: 2, padding: 2, borderRadius: 'var(--r3)', background: 'var(--app)', flex: 'none' }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className="chip"
          style={{
            minHeight: 'var(--control)',
            padding: '0 10px',
            background: value === v ? 'var(--raised)' : 'transparent',
            color: value === v ? 'var(--text)' : 'var(--muted)',
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * A row of values that filter by OR, and by AND against every other filter.
 *
 * Nothing selected means "any", which is why there is no All chip: an empty
 * selection already says it, and a chip whose only job is to undo other chips
 * is a control you have to learn.
 */
function Chips<T extends string | number>({
  label,
  values,
  text,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly T[];
  text: (v: T) => string;
  selected: ReadonlySet<T>;
  onToggle: (v: T) => void;
}): React.JSX.Element {
  return (
    <>
      <span className="t-meta" style={{ flex: 'none', alignSelf: 'center', color: 'var(--dim)' }}>
        {label}
      </span>
      {values.map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onToggle(v)}
          aria-pressed={selected.has(v)}
          aria-label={`${label} ${text(v)}`}
          className="chip"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            background: selected.has(v) ? 'var(--hope)' : 'var(--raised)',
            color: selected.has(v) ? 'var(--app)' : 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {text(v)}
        </button>
      ))}
    </>
  );
}

const ChipRow = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="row" style={{ gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
    {children}
  </div>
);

function CountRow({
  showing,
  total,
  note,
  filtered,
  onClear,
}: {
  showing: number;
  total: number;
  note?: string;
  filtered: boolean;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="spread" style={{ alignItems: 'center', minHeight: 'var(--control)' }}>
      <span className="t-meta" style={{ color: 'var(--muted)' }}>
        {showing} OF {total}
        {note !== undefined && <span style={{ color: 'var(--dim)' }}> · {note}</span>}
      </span>
      {filtered && (
        <button
          type="button"
          className="chip"
          onClick={onClear}
          style={{ minHeight: 'var(--control)', color: 'var(--text)', flex: 'none' }}
        >
          CLEAR FILTERS
        </button>
      )}
    </div>
  );
}

/** One line of a picker. Out of reach is dimmed and says so, never hidden. */
function PickerRow({
  title,
  badge,
  badgeTone,
  meta,
  body,
  reason,
  selected,
  onClick,
}: {
  title: string;
  badge: string;
  badgeTone?: string;
  meta: string;
  body?: string;
  reason?: string | null;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const why = reason ?? null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="stack"
      style={{
        flex: 'none',
        gap: 6,
        minHeight: 'var(--tap)',
        padding: '10px 11px',
        textAlign: 'left',
        borderRadius: 'var(--r3)',
        background: selected ? 'var(--raised)' : 'var(--app)',
        border: `1px solid ${selected ? 'var(--line)' : 'var(--line-soft)'}`,
        borderLeft: `3px solid ${selected ? 'var(--hope)' : 'transparent'}`,
      }}
    >
      <span className="stack" style={{ gap: 6, width: '100%', opacity: why === null ? 1 : 0.5 }}>
        <span className="spread" style={{ alignItems: 'baseline', gap: 10 }}>
          <span style={{ font: '700 14.5px/1.2 var(--sans)', minWidth: 0 }}>{title}</span>
          <span className="t-meta" style={{ flex: 'none', color: badgeTone ?? 'var(--dim)' }}>
            {badge}
          </span>
        </span>
        <span className="t-num" style={{ color: 'var(--text-2)', lineHeight: 1.4 }}>
          {meta}
        </span>
        {body !== undefined && body !== '' && (
          <span className="t-dense" style={{ whiteSpace: 'pre-line' }}>
            {body}
          </span>
        )}
      </span>
      {why !== null && (
        <span className="t-meta" style={{ color: 'var(--stress)' }}>
          {why.toUpperCase()}
        </span>
      )}
    </button>
  );
}

function Empty({ what }: { what: string }): React.JSX.Element {
  return (
    <span className="t-dense" style={{ color: 'var(--dim)' }}>
      {what}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

export function WeaponPicker({
  slot,
  value,
  sheet,
  stats,
  onPick,
  onClose,
}: {
  slot: Weapon['slot'];
  value: Ref | null;
  sheet: Character;
  stats: DerivedStats;
  onPick: (ref: Ref | null) => void;
  onClose: () => void;
}): React.JSX.Element {
  const weapons = useApp((s) => s.dataset.weapons);
  const base = useMemo(() => weaponQuery(slot), [slot]);
  const [q, setQ] = useState<WeaponQuery>(base);
  const search = useDeferredValue(q.search);

  const patch = (p: Partial<WeaponQuery>): void => setQ((prev) => ({ ...prev, ...p }));
  const rows = useMemo(
    () => filterWeapons(weapons, { ...q, search }, sheet.level),
    [weapons, q, search, sheet.level],
  );

  const label = slot === 'primary' ? 'Primary weapon' : 'Secondary weapon';

  return (
    <PickerDialog
      label={label}
      onClose={onClose}
      onClear={value === null ? undefined : () => onPick(null)}
      clearLabel="Unequip"
      head={
        <>
          <SearchBox
            value={q.search}
            onChange={(v) => patch({ search: v })}
            placeholder={`Search ${weapons.length} weapons and their features`}
            label="Search weapons"
          />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Seg
              label="Reach"
              value={q.reach}
              onChange={(reach) => patch({ reach })}
              options={[
                ['all', 'All'],
                ['usable', 'Can use'],
              ]}
            />
            <Seg
              label="Slot"
              value={q.slot}
              onChange={(v) => patch({ slot: v })}
              options={[
                ['all', 'Any'],
                ['primary', 'Primary'],
                ['secondary', 'Secondary'],
              ]}
            />
            <Seg
              label="Category"
              value={q.category}
              onChange={(category) => patch({ category })}
              options={[
                ['all', 'Any'],
                ['Physical', 'Physical'],
                ['Magic', 'Magic'],
              ]}
            />
          </div>
          <ChipRow>
            <Chips
              label="TIER"
              values={TIERS}
              text={String}
              selected={q.tiers}
              onToggle={(t) => patch({ tiers: toggled(q.tiers, t) })}
            />
            <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} />
            <Chips
              label="HANDS"
              values={BURDENS}
              text={(b) => (b === 2 ? '2H' : '1H')}
              selected={q.burdens}
              onToggle={(b) => patch({ burdens: toggled(q.burdens, b) })}
            />
          </ChipRow>
          <ChipRow>
            <Chips
              label="TRAIT"
              values={WEAPON_TRAITS}
              text={weaponTraitLabel}
              selected={q.traits}
              onToggle={(t) => patch({ traits: toggled(q.traits, t) })}
            />
          </ChipRow>
          <ChipRow>
            <Chips
              label="RANGE"
              values={RANGES}
              text={(r: Range) => r.toUpperCase()}
              selected={q.ranges}
              onToggle={(r) => patch({ ranges: toggled(q.ranges, r) })}
            />
          </ChipRow>
        </>
      }
      count={
        <CountRow
          showing={rows.length}
          total={weapons.length}
          note={`DAMAGE AT PROFICIENCY ${stats.proficiency}`}
          filtered={weaponQueryChanged(q, base)}
          onClear={() => setQ(base)}
        />
      }
    >
      {rows.map(({ item, reason }) => (
        <PickerRow
          key={item.id}
          title={item.name}
          badge={value === item.id ? 'EQUIPPED' : `TIER ${item.tier}`}
          badgeTone={value === item.id ? 'var(--hope)' : undefined}
          meta={weaponSummary(item, stats)}
          body={item.feature}
          reason={reason}
          selected={value === item.id}
          onClick={() => onPick(item.id)}
        />
      ))}
      {rows.length === 0 && (
        <Empty
          what={
            weapons.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No weapons match those filters.'
          }
        />
      )}
    </PickerDialog>
  );
}

// ---------------------------------------------------------------------------
// Armor
// ---------------------------------------------------------------------------

export function ArmorPicker({
  value,
  sheet,
  onPick,
  onClose,
}: {
  value: Ref | null;
  sheet: Character;
  onPick: (ref: Ref | null) => void;
  onClose: () => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const armors = dataset.armors;
  const base = useMemo(() => armorQuery(), []);
  const [q, setQ] = useState<ArmorQuery>(base);
  const search = useDeferredValue(q.search);

  const patch = (p: Partial<ArmorQuery>): void => setQ((prev) => ({ ...prev, ...p }));
  const rows = useMemo(
    () => filterArmors(armors, { ...q, search }, sheet.level),
    [armors, q, search, sheet.level],
  );

  // What each set of armor would actually give *this* character, asked of the
  // engine rather than added up here: thresholds are the armor's base plus the
  // character's level, and that sum belongs in one place. A manual override is
  // set aside for the preview - otherwise every row would print the same
  // overridden pair and the comparison the player came for would be gone.
  const preview = useMemo(() => {
    const clean: Character = { ...sheet, thresholdOverride: null };
    const out = new Map<Ref, DerivedStats>();
    for (const a of armors) {
      out.set(a.id, deriveStats({ ...clean, activeArmor: a.id }, dataset, index));
    }
    return out;
  }, [armors, dataset, index, sheet]);

  return (
    <PickerDialog
      label="Armor"
      onClose={onClose}
      onClear={value === null ? undefined : () => onPick(null)}
      clearLabel="Unarmored"
      head={
        <>
          <SearchBox
            value={q.search}
            onChange={(v) => patch({ search: v })}
            placeholder={`Search ${armors.length} sets of armor and their features`}
            label="Search armor"
          />
          <ChipRow>
            <Seg
              label="Reach"
              value={q.reach}
              onChange={(reach) => patch({ reach })}
              options={[
                ['all', 'All'],
                ['usable', 'Can use'],
              ]}
            />
            <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} />
            <Chips
              label="TIER"
              values={TIERS}
              text={String}
              selected={q.tiers}
              onToggle={(t) => patch({ tiers: toggled(q.tiers, t) })}
            />
          </ChipRow>
        </>
      }
      count={
        <CountRow
          showing={rows.length}
          total={armors.length}
          note={`THRESHOLDS AT LEVEL ${sheet.level}`}
          filtered={armorQueryChanged(q, base)}
          onClear={() => setQ(base)}
        />
      }
    >
      {rows.map(({ item, reason }) => {
        const shown = preview.get(item.id);
        return (
          <PickerRow
            key={item.id}
            title={item.name}
            badge={value === item.id ? 'WORN' : `TIER ${item.tier}`}
            badgeTone={value === item.id ? 'var(--hope)' : undefined}
            meta={
              shown
                ? armorSummary(item, shown.thresholds, shown.armorScore)
                : `${item.baseThresholds[0]}/${item.baseThresholds[1]} BASE · SCORE ${item.baseScore}`
            }
            body={item.feature}
            reason={reason}
            selected={value === item.id}
            onClick={() => onPick(item.id)}
          />
        );
      })}
      {rows.length === 0 && (
        <Empty
          what={
            armors.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No armor matches those filters.'
          }
        />
      )}
    </PickerDialog>
  );
}

// ---------------------------------------------------------------------------
// Loot and consumables
// ---------------------------------------------------------------------------

export function ItemPicker({
  carried,
  onAdd,
  onClose,
}: {
  /** Ref to quantity already in the inventory, so a row can say so. */
  carried: ReadonlyMap<Ref, number>;
  onAdd: (item: Item) => void;
  onClose: () => void;
}): React.JSX.Element {
  const loot = useApp((s) => s.dataset.loot);
  const consumables = useApp((s) => s.dataset.consumables);
  const items = useMemo(() => [...loot, ...consumables], [loot, consumables]);
  const base = useMemo(() => itemQuery(), []);
  const [q, setQ] = useState<ItemQuery>(base);
  const search = useDeferredValue(q.search);

  const rows = useMemo(() => filterItems(items, { ...q, search }), [items, q, search]);

  return (
    <PickerDialog
      label="Loot and consumables"
      onClose={onClose}
      head={
        <>
          <SearchBox
            value={q.search}
            onChange={(v) => setQ((prev) => ({ ...prev, search: v }))}
            placeholder={`Search ${items.length} items and what they do`}
            label="Search items"
          />
          <Seg
            label="Kind"
            value={q.kind}
            onChange={(kind) => setQ((prev) => ({ ...prev, kind }))}
            options={[
              ['all', 'All'],
              ['loot', 'Loot'],
              ['consumable', 'Consumables'],
            ]}
          />
        </>
      }
      count={
        <CountRow
          showing={rows.length}
          total={items.length}
          filtered={itemQueryChanged(q, base)}
          onClear={() => setQ(base)}
        />
      }
    >
      {rows.map((item) => {
        const have = carried.get(item.id) ?? 0;
        return (
          <PickerRow
            key={item.id}
            title={item.name}
            badge={have > 0 ? `CARRIED ×${have}` : 'ADD'}
            badgeTone={have > 0 ? 'var(--hope)' : undefined}
            meta={`${item.kind === 'loot' ? 'LOOT' : 'CONSUMABLE'}${item.roll === undefined ? '' : ` · ROLL ${item.roll}`}`}
            body={item.text}
            selected={have > 0}
            onClick={() => onAdd(item)}
          />
        );
      })}
      {rows.length === 0 && (
        <Empty
          what={
            items.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No items match those filters.'
          }
        />
      )}
    </PickerDialog>
  );
}

// ---------------------------------------------------------------------------
// The slot the picker fills
// ---------------------------------------------------------------------------

/**
 * A filled equipment slot on the form behind the dialog.
 *
 * It carries the numbers rather than only a name, because "Broadsword" alone
 * sends the player back into the picker to remember what it does.
 */
export function GearSlot({
  label,
  title,
  meta,
  note,
  empty,
  disabled = false,
  onOpen,
  onClear,
}: {
  label: string;
  /** The chosen thing, or null for an empty slot. */
  title: string | null;
  meta?: string;
  /** Out of tier, or blocked by something else on the sheet. */
  note?: string | null;
  empty: string;
  disabled?: boolean;
  onOpen: () => void;
  onClear?: () => void;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="t-label">{label}</span>
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          className="row"
          style={{
            flex: 1,
            minWidth: 0,
            gap: 10,
            minHeight: 'var(--tap)',
            padding: '8px 12px',
            textAlign: 'left',
            borderRadius: 'var(--r3)',
            background: title === null ? 'var(--panel)' : 'var(--raised)',
            border: `1px solid ${title === null ? 'var(--line-soft)' : 'var(--line)'}`,
            borderLeft: `3px solid ${title === null ? 'transparent' : 'var(--hope)'}`,
            opacity: disabled ? 0.42 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <span
              style={{
                font: '700 14px/1.2 var(--sans)',
                color: title === null ? 'var(--muted)' : 'var(--text)',
              }}
            >
              {title ?? empty}
            </span>
            {title !== null && meta !== undefined && (
              <span className="t-num" style={{ color: 'var(--text-2)' }}>
                {meta}
              </span>
            )}
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
            {title === null ? 'CHOOSE' : 'CHANGE'}
          </span>
        </button>
        {onClear !== undefined && title !== null && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            style={{ flex: 'none', minWidth: 'var(--tap)', padding: 0 }}
          >
            ✕
          </button>
        )}
      </div>
      {(note ?? '') !== '' && (
        <span className="t-meta" style={{ color: 'var(--stress)' }}>
          {(note ?? '').toUpperCase()}
        </span>
      )}
    </div>
  );
}
