/**
 * The card browser: 189 cards, and the only screen where scrolling is the
 * point. Filters sit above the grid and never move; the grid scrolls under
 * them.
 *
 * Cards you cannot take are shown, not hidden, with the reason attached. A
 * player planning three levels ahead needs to see the level 7 card that is
 * out of reach, and "why can't I take this" is a question the sheet should
 * answer without anyone opening the book.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import { DOMAINS, type DomainCardType, type DomainId } from '../../../shared/types.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { canAddToLoadout, cardAvailability, vaultCard } from '../../engine/loadout.ts';
import { useActive, useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { useRecall } from './recall.ts';

type Owned = 'all' | 'owned' | 'available';

export function Cards({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const update = useApp((s) => s.update);
  const recall = useRecall();
  const phone = useIsPhone();

  const [domain, setDomain] = useState<DomainId | 'mine' | 'all'>('mine');
  const [type, setType] = useState<DomainCardType | 'all'>('all');
  const [owned, setOwned] = useState<Owned>('all');
  // Multi-select, and empty means "any" - so a search for "everything I could
  // recall for one Stress at level 3 or below" is three taps, not a mode.
  const [levels, setLevels] = useState<ReadonlySet<number>>(new Set());
  const [recalls, setRecalls] = useState<ReadonlySet<number>>(new Set());
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query).trim().toLowerCase();
  /*
   * The card whose recall is waiting for a second tap, because it would be
   * paid in Hit Points rather than in Stress. One at a time: two primed
   * controls in a grid of 189 is worse than none.
   */
  const [armed, setArmed] = useState<string | null>(null);

  const toggle = (set: ReadonlySet<number>, n: number): ReadonlySet<number> => {
    const next = new Set(set);
    if (!next.delete(n)) next.add(n);
    return next;
  };

  // Whatever the dataset actually holds, not 1-10 and 0-5 by assumption.
  const { allLevels, allRecalls } = useMemo(() => {
    const l = new Set<number>();
    const r = new Set<number>();
    for (const c of dataset.domainCards) {
      l.add(c.level);
      r.add(c.recallCost);
    }
    return {
      allLevels: [...l].sort((a, b) => a - b),
      allRecalls: [...r].sort((a, b) => a - b),
    };
  }, [dataset.domainCards]);

  const filtered =
    domain !== 'mine' || type !== 'all' || owned !== 'all' || levels.size > 0 || recalls.size > 0 || search !== '';
  const clearAll = (): void => {
    setDomain('mine');
    setType('all');
    setOwned('all');
    setLevels(new Set());
    setRecalls(new Set());
    setQuery('');
  };

  const rows = useMemo(() => {
    if (!character) return [];
    return cardAvailability(character, stats, dataset.domainCards)
      .filter((row) => {
        if (domain === 'mine') {
          if (!stats.domains.includes(row.card.domain)) return false;
        } else if (domain !== 'all' && row.card.domain !== domain) return false;
        if (type !== 'all' && row.card.type !== type) return false;
        if (levels.size > 0 && !levels.has(row.card.level)) return false;
        if (recalls.size > 0 && !recalls.has(row.card.recallCost)) return false;
        if (owned === 'owned' && !row.owned) return false;
        if (owned === 'available' && (row.owned || !row.eligible)) return false;
        if (search !== '') {
          const hay = `${row.card.name} ${row.card.text} ${row.card.domain}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.card.level - b.card.level ||
          a.card.domain.localeCompare(b.card.domain) ||
          a.card.name.localeCompare(b.card.name),
      );
  }, [character, dataset.domainCards, domain, levels, owned, recalls, search, stats, type]);

  if (!character) return null;

  const acquire = (cardId: string): void => {
    const card = dataset.domainCards.find((c) => c.id === cardId);
    if (!card) return;
    if (character.loadout.includes(cardId)) {
      update((c) => vaultCard(c, cardId));
      return;
    }
    if (character.vault.includes(cardId)) {
      const check = canAddToLoadout(character, card);
      if (!check.allowed) return;
      /*
       * P1-2. `canAddToLoadout` has always answered `affordable`, and until now
       * nothing read it: with the Stress track full, `markStress` marks Hit
       * Points instead, so a tap on RECALL at 6/6 Stress and 5/6 HP took the
       * sixth Hit Point and offered a death move. It is still allowed - whether
       * a recall is a "move" under the Stress rule is a table ruling, and the
       * Recall Cost text is not in the shipped rules layer, so the app cannot
       * cite the rule it would be enforcing - but it costs a second, informed
       * tap, and the button says the number of Hit Points before the first one.
       */
      if (!check.affordable && armed !== cardId) {
        setArmed(cardId);
        return;
      }
      setArmed(null);
      /*
       * Through the same function the vault's own control goes through.
       *
       * These lines used to be written out here as well, and the copy had
       * drifted: it said "Free during downtime" for any recall that cost
       * nothing, which for the 31 SRD cards whose Recall Cost is 0 meant the
       * log claiming a downtime in the middle of a scene. Two surfaces
       * disagreeing about what a tap costs is the thing this file's own header
       * is about, and the log line is part of the cost.
       */
      recall(card);
      return;
    }
    // Acquiring a card the character does not own yet goes to the vault:
    // getting it into the loadout is a separate, costed decision.
    update((c) => ({ ...c, vault: [...c.vault, cardId] }));
  };

  /*
   * `overflow: hidden` is the one declaration this box has never carried, and
   * without it the browser painted over the tab bar.
   *
   * Measured at 640x360. `.app` is `100svh` with `grid-template-rows: auto 1fr`
   * and `overflow: hidden`, so the header takes 53 and `<main>` 307; the tab
   * bar is `flex: none`, 60px of button plus a 1px top border, laid y299..360.
   * That leaves this root 246px at y53..299 and a content box of 230 at
   * y61..291. The filter block below it is `flex: none` and 226px tall at this
   * width, so the grid is offered 4px of free space - and under the global
   * `box-sizing: border-box` (base.css:10-14) a `flex: 1; min-height: 0` box
   * cannot floor below its own `padding-bottom`, so the grid was laid at
   * y299..311: clientHeight 12, content box **0px**, and every one of those 12
   * pixels inside the nav. `DomainCardView`'s root is `position: relative` and
   * the nav declares no `position`, so the tiles painted in the positioned
   * layer above a static bar and took the hit-testing with them:
   * `document.elementFromPoint(111, 303)` returned a card's overlay button
   * rather than PLAY, and the same for CARDS, BUILD and GM.
   *
   * The clip costs the grid nothing it had - it had a 0px content box - and
   * gives four 160x61 targets back their top 12px, at the bottom edge of a
   * two-handed landscape grip, on the only route off this screen. It does not
   * give the grid a box of its own; that is the next commit's job, and this
   * one deliberately leaves the landscape grid invisible rather than
   * mis-tappable, because a card you cannot see is recoverable by rotating and
   * a tab bar you cannot tap is not.
   */
  const rootStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    padding: phone ? '8px 12px' : '14px 20px 20px',
    gap: 12,
    overflow: 'hidden',
  };

  return (
    <div className="stack" style={rootStyle}>
      <div className="stack" style={{ gap: 8, flex: 'none' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 189 cards"
            aria-label="Search cards"
            style={{ flex: '1 1 200px', minHeight: 'var(--control)', maxWidth: 320 }}
          />
          <Segmented
            value={owned}
            onChange={setOwned}
            options={[
              ['all', 'All'],
              ['owned', 'Owned'],
              ['available', 'Can take'],
            ]}
          />
          <Segmented
            value={type}
            onChange={setType}
            options={[
              ['all', 'Any'],
              ['Ability', 'Ability'],
              ['Spell', 'Spell'],
              ['Grimoire', 'Grimoire'],
            ]}
          />
        </div>
        <div className="row" style={{ gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <FilterChip active={domain === 'mine'} onClick={() => setDomain('mine')}>
            My domains
          </FilterChip>
          <FilterChip active={domain === 'all'} onClick={() => setDomain('all')}>
            All
          </FilterChip>
          {DOMAINS.map((d) => (
            <FilterChip key={d} active={domain === d} onClick={() => setDomain(d)}>
              <DomainMark domain={d} size={11} shapes={shapes} />
              <span style={{ textTransform: 'capitalize' }}>{d}</span>
            </FilterChip>
          ))}
        </div>

        <div className="row" style={{ gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <NumberFilter label="LV" values={allLevels} selected={levels} onToggle={(n) => setLevels(toggle(levels, n))} />
          <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} />
          <NumberFilter
            label="RECALL"
            values={allRecalls}
            selected={recalls}
            onToggle={(n) => setRecalls(toggle(recalls, n))}
          />
        </div>

        <div className="spread" style={{ alignItems: 'center' }}>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {rows.length} OF {dataset.domainCards.length}
          </span>
          {filtered && (
            <button
              type="button"
              className="chip"
              onClick={clearAll}
              style={{ minHeight: 'var(--control)', color: 'var(--text)' }}
            >
              CLEAR FILTERS
            </button>
          )}
        </div>
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${phone ? 150 : 210}px, 1fr))`,
          gap: 12,
          alignContent: 'start',
          paddingBottom: 12,
        }}
      >
        {rows.map((row) => {
          // The Hit Points a recall would cost, if it would cost any. Only a
          // card in the vault can be recalled, so only that one is costed.
          const swap =
            row.owned && !row.inLoadout ? canAddToLoadout(character, row.card) : null;
          const needsHp = swap !== null && swap.allowed && !swap.affordable;
          const primed = armed === row.card.id;
          return (
            <DomainCardView
              key={row.card.id}
              card={row.card}
              shapes={shapes}
              onOpen={() => setOpenCard(row.card)}
              height={phone ? 268 : 310}
              headHeight={phone ? 78 : 96}
              dimmed={!row.eligible && !row.owned}
              footer={
                /*
                 * P3-11. There is no action here, so there is no control: the
                 * footer is the reason, full width. It used to be a disabled
                 * button reading '—' with the reason in the other corner - a
                 * control that looks live, does nothing, and says nothing,
                 * beside the sentence that was the answer all along.
                 */
                !row.eligible && !row.owned ? (
                  <span
                    className="t-meta"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      color: 'var(--dim)',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                    }}
                  >
                    {row.reason}
                  </span>
                ) : (
                  <>
                    <CardAction
                      tone={primed ? 'warn' : row.inLoadout ? 'held' : 'go'}
                      onClick={() => acquire(row.card.id)}
                      label={
                        primed
                          ? `Confirm: recall ${row.card.name} and mark ${String(swap?.hpCost ?? 0)} HP`
                          : needsHp
                            ? `Recall ${row.card.name} - no Stress left, so it would mark ${String(swap?.hpCost ?? 0)} HP`
                            : row.inLoadout
                              ? `Move ${row.card.name} to the vault`
                              : row.owned
                                ? `Recall ${row.card.name} for ${row.card.recallCost} Stress`
                                : `Take ${row.card.name} into the vault`
                      }
                    >
                      {primed
                        ? `MARK ${String(swap?.hpCost ?? 0)} HP?`
                        : row.inLoadout
                          ? 'IN LOADOUT'
                          : row.owned
                            ? 'RECALL'
                            : 'TAKE'}
                    </CardAction>
                    <span
                      className="t-meta"
                      style={{
                        flex: 'none',
                        color: needsHp ? 'var(--damage)' : 'var(--dim)',
                        textAlign: 'right',
                      }}
                    >
                      {needsHp
                        ? `${String(swap?.hpCost ?? 0)} HP — NO STRESS`
                        : `COST ${row.card.recallCost}`}
                    </span>
                  </>
                )
              }
            />
          );
        })}
        {rows.length === 0 && (
          <p className="t-body" style={{ gridColumn: '1 / -1', color: 'var(--dim)' }}>
            {dataset.domainCards.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No cards match those filters.'}
          </p>
        )}
        {/*
          The notice, at the end of the browser rather than pinned above the tab
          bar - which is where it was, and where it cost this screen ~111px of a
          393px phone whether or not anybody was reading it. Here it is 189 cards
          down, or one filter away.

          `gridColumn: '1 / -1'` because this scroll region is the card grid
          itself: without it the footer takes one 150px cell and sets the
          342-character notice in a column narrower than a card. The empty state
          above it spans the row for the same reason.
        */}
        <div style={{ gridColumn: '1 / -1' }}>
          <LicenceFooter />
        </div>
      </div>
    </div>
  );
}


/**
 * The card's one action, shaped like a control.
 *
 * P3-11. It used to be `className="t-meta"` with no background, no border and
 * `var(--muted)` - beside a readout at the other end of the same row that was
 * also `t-meta`, in `var(--dim)`. Two small grey capitals eleven characters
 * apart read as a matched pair of labels, not as a button and a number, and
 * the pair was RECALL and RECALL 2: the same word for the action and for its
 * price. The number now says COST; this says what it does and looks like
 * something that does it.
 *
 * `stopPropagation`, because the card behind it opens the reader on a tap and
 * a footer press must not do both.
 */
function CardAction({
  tone,
  label,
  onClick,
  children,
}: {
  /** `go` takes or recalls, `held` is already in the loadout, `warn` costs HP. */
  tone: 'go' | 'held' | 'warn';
  /** The accessible name, which says which card as well as which verb. */
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const ink =
    tone === 'warn' ? 'var(--damage)' : tone === 'held' ? 'var(--hope)' : 'var(--text)';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="chip"
      style={{
        flex: 'none',
        minHeight: 'var(--control)',
        padding: '0 10px',
        background: tone === 'warn' ? 'var(--fear-wash)' : 'var(--raised)',
        border: `1px solid ${tone === 'go' ? 'var(--line)' : ink}`,
        color: ink,
        fontWeight: 700,
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </button>
  );
}

/**
 * A row of numbers that filter by OR, and by AND against every other filter.
 *
 * Nothing selected means "any", which is why there is no explicit All chip:
 * an empty selection already says it, and a chip that only ever undoes other
 * chips is a control you have to learn.
 */
function NumberFilter({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly number[];
  selected: ReadonlySet<number>;
  onToggle: (n: number) => void;
}): React.JSX.Element {
  return (
    <>
      <span className="t-meta" style={{ flex: 'none', alignSelf: 'center', color: 'var(--dim)' }}>
        {label}
      </span>
      {values.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onToggle(n)}
          aria-pressed={selected.has(n)}
          aria-label={`${label} ${n}`}
          className="chip"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            background: selected.has(n) ? 'var(--hope)' : 'var(--raised)',
            color: selected.has(n) ? 'var(--app)' : 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {n}
        </button>
      ))}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="row chip"
      style={{
        minHeight: 'var(--control)',
        flex: 'none',
        gap: 6,
        padding: '0 10px',
        background: active ? 'var(--raised)' : 'transparent',
        border: `1px solid ${active ? 'var(--line)' : 'transparent'}`,
        color: active ? 'var(--text)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}): React.JSX.Element {
  return (
    <div
      className="row"
      style={{ gap: 2, padding: 2, borderRadius: 'var(--r3)', background: 'var(--panel)' }}
    >
      {options.map(([v, label]) => (
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
          {label}
        </button>
      ))}
    </div>
  );
}
