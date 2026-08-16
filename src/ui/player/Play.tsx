/**
 * Play: the screen that is open ninety percent of the time.
 *
 * No scrolling on this screen. The content is bounded and known - six traits,
 * four tracks, five cards - so it is laid out to fit rather than to flow. On a
 * phone the order inverts what you would expect from a document: cards on top
 * because they are *read*, vitals and the roll bar at the bottom because they
 * are *touched*, inside the one-handed thumb arc.
 */
import { useMemo, useState } from 'react';
import { TRAITS, TRAIT_LABELS, type DomainCard, type Trait, type Weapon } from '../../../shared/types.ts';
import { weaponDamage, type DerivedStats } from '../../engine/character.ts';
import { canAddToLoadout, recallCard, resolveCards, vaultCard } from '../../engine/loadout.ts';
import { useActive, useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { useLayout } from '../shared/useLayout.ts';
import { Beastform } from './Beastform.tsx';
import { ActiveConditions } from './Conditions.tsx';
import { DeathMoveOffer } from './DeathMove.tsx';
import { DualityRoll, type RollTrait } from './DualityRoll.tsx';
import { traitVerbs } from './ruleText.ts';
import { Vitals } from './Vitals.tsx';

export function Play({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const layout = useLayout();
  const [trait, setTrait] = useState<RollTrait>('agility');
  const [armedWeapon, setArmedWeapon] = useState<string | null>(null);

  /*
   * Arming a weapon arms its trait, because the weapon is what decides it:
   * "The trait that applies to an attack roll is specified by the weapon or
   * spell being used." A player who taps a sword has declared that roll, and
   * making them then find the matching trait chip would be the app asking for
   * the same decision twice.
   */
  const armWeapon = (weapon: Weapon | null): void => {
    setArmedWeapon(weapon?.id ?? null);
    if (weapon) setTrait(weapon.trait);
  };

  if (!character) return null;
  if (layout === 'phone') {
    return (
      <PlayPhone
        stats={stats}
        trait={trait}
        setTrait={setTrait}
        armedWeapon={armedWeapon}
        armWeapon={armWeapon}
      />
    );
  }
  return (
    <PlayDesktop
      stats={stats}
      trait={trait}
      setTrait={setTrait}
      armedWeapon={armedWeapon}
      armWeapon={armWeapon}
      columns={layout === 'tablet' ? 2 : 3}
    />
  );
}

interface ViewProps {
  stats: DerivedStats;
  trait: RollTrait;
  setTrait: (t: RollTrait) => void;
  /** Ref of the weapon the next attack is declared with, if any. */
  armedWeapon: string | null;
  armWeapon: (weapon: Weapon | null) => void;
}

function useLoadout(): { loadout: DomainCard[]; vault: DomainCard[] } {
  const character = useActive();
  const index = useApp((s) => s.index);
  return useMemo(
    () => ({
      loadout: character ? resolveCards(character.loadout, index) : [],
      vault: character ? resolveCards(character.vault, index) : [],
    }),
    [character, index],
  );
}

function Identity({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  if (!character) return null;
  // A multiclassed character is two classes and two subclasses, and both belong
  // on the line that says who they are.
  const klass = [character.classRef, character.multiclassRef]
    .map((r) => (r === null ? undefined : index.classes.get(r)?.name))
    .filter(Boolean)
    .join(' / ');
  const subclass = character.subclassRefs
    .map((r) => index.subclasses.get(r)?.name)
    .filter(Boolean)
    .join(' · ');
  const lineage = [
    ...character.ancestryRefs.map((r) => (index.byRef.get(r) as { name?: string } | undefined)?.name),
    (index.byRef.get(character.communityRef ?? '') as { name?: string } | undefined)?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <div className="t-vital">{character.name || 'Unnamed'}</div>
      <div className="row" style={{ marginTop: 7, gap: 8 }}>
        {character.pronouns !== '' && <span className="t-meta">{character.pronouns.toUpperCase()}</span>}
        {character.pronouns !== '' && <span style={{ color: 'var(--line)' }}>·</span>}
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          LEVEL {character.level}
        </span>
      </div>
      <div style={{ marginTop: 9, font: '600 14px/1.35 var(--sans)', color: 'var(--text-2)' }}>
        {klass === '' ? 'No class' : klass}
        {subclass !== '' && ` — ${subclass}`}
      </div>
      {lineage !== '' && (
        <div style={{ font: '400 13px/1.35 var(--sans)', color: 'var(--muted)' }}>{lineage}</div>
      )}
    </div>
  );
}

function TraitGrid({
  stats,
  trait,
  setTrait,
}: {
  stats: DerivedStats;
  trait: RollTrait;
  setTrait: (t: RollTrait) => void;
}): React.JSX.Element | null {
  const character = useActive();
  const rules = useApp((s) => s.dataset.rules);
  // Parsed once per dataset, not once per render: the rules body is 4KB of
  // prose and there are six tiles reading the same answer out of it.
  const verbs = useMemo(() => traitVerbs(rules), [rules]);
  if (!character) return null;
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 8 }}>
        Traits
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {TRAITS.map((t: Trait) => {
          // stats.traits, not the character's own: a Beastform raises one of
          // these, and a tile that disagreed with the roll would be a lie.
          const value = stats.traits[t];
          const active = trait === t;
          const marked = (character.traitMarks[t] ?? 0) > 0;
          const raised = stats.beastform?.raised.find((r) => r.trait === t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTrait(t)}
              aria-pressed={active}
              style={{
                position: 'relative',
                background: 'var(--panel)',
                border: '1px solid var(--line-soft)',
                borderRadius: 'var(--r3)',
                padding: '10px 10px 9px',
                overflow: 'hidden',
                minHeight: 64,
                textAlign: 'left',
              }}
              /*
               * The verbs are on the tile *and* in its name.
               *
               * A tile reading "AGILITY +1" is announced as "Agility plus one"
               * and tells a screen-reader user nothing about what Agility is
               * for, which is precisely the gap the printed sheet fills with
               * these three words.
               */
              aria-label={
                verbs[t] === undefined
                  ? undefined
                  : `${TRAIT_LABELS[t]} ${value >= 0 ? '+' : '−'}${String(Math.abs(value))} - use it to ${verbs[t].join(', ')}`
              }
            >
              <span className="t-meta" style={{ letterSpacing: '0.1em', color: 'var(--muted)' }}>
                {TRAIT_LABELS[t].toUpperCase()}
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: 7,
                  font: '800 26px/1 var(--sans)',
                  letterSpacing: '-0.02em',
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value >= 0 ? '+' : '−'}
                {Math.abs(value)}
                {raised && (
                  <s className="t-meta" style={{ marginLeft: 6, color: 'var(--dim)' }}>
                    {raised.from >= 0 ? '+' : '−'}
                    {Math.abs(raised.from)}
                  </s>
                )}
              </span>
              {/*
                * "Use it to Sprint, Leap, Maneuver."
                *
                * Two lines at 9px, which is what the three words need at a
                * tile width of about 97px inside a 393px phone - roughly 158px
                * of text. It costs the tile 30px, so the six-tile grid goes
                * from 136px to 194px, and it buys the one thing a new player
                * cannot get from a number: which of the six to roll. The
                * spellings are the book's, because they are read out of it.
                */}
              {verbs[t] !== undefined && (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    marginTop: 6,
                    font: '500 9px/1.35 var(--mono)',
                    letterSpacing: '0.04em',
                    color: active ? 'var(--text-2)' : 'var(--dim)',
                  }}
                >
                  {verbs[t].join(' · ').toUpperCase()}
                </span>
              )}
              {marked && (
                <span
                  aria-label="marked this tier"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--muted)',
                  }}
                />
              )}
              <span
                style={{
                  position: 'absolute',
                  inset: 'auto 0 0 0',
                  height: 3,
                  background: active
                    ? 'var(--hope)'
                    : raised
                      ? 'var(--sage)'
                      : stats.spellcastTrait === t
                        ? 'color-mix(in srgb, var(--hope) 30%, transparent)'
                        : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="t-meta" style={{ marginTop: 7, color: 'var(--muted)', letterSpacing: '0.04em' }}>
        TAP A TRAIT TO ARM THE ROLL
        {stats.spellcastTrait !== null &&
          ` · ${TRAIT_LABELS[stats.spellcastTrait].toUpperCase()} IS SPELLCAST`}
      </div>
    </div>
  );
}

function Defenses({ stats }: { stats: DerivedStats }): React.JSX.Element {
  // A Beastform replaces Evasion, so the panel says so twice: sage, and the
  // number it replaced printed struck through underneath it.
  const worn = stats.beastform;
  const character = useActive();
  /*
   * Two numbers this panel is not entitled to print.
   *
   * With the armor on the sheet unresolvable, what `deriveStats` hands over is
   * the unarmored ladder - level and twice level - and a level 5 character in
   * improved chainmail would read 5/10 here where their sheet says 16/29.
   * Printing it in the same weight as the real thing is the app claiming
   * something it does not know, so the panel names the armor it cannot find
   * instead. A manual threshold override closes the gap: the sheet then states
   * the numbers outright rather than deriving them, which is the same rule the
   * GM's party board applies in `findGaps`.
   */
  const unknownThresholds =
    stats.unresolvedArmor !== null && character !== null && character.thresholdOverride === null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 8 }}>
      <div
        className="panel"
        style={{ padding: 10, borderColor: worn ? 'var(--sage)' : undefined }}
      >
        <div
          className="t-meta"
          style={{ letterSpacing: '0.1em', color: worn ? 'var(--sage)' : undefined }}
        >
          EVASION
        </div>
        <div style={{ marginTop: 6, font: '800 30px/1 var(--sans)', letterSpacing: '-0.02em' }}>
          {stats.evasion}
        </div>
        {worn && (
          <s className="t-meta" style={{ display: 'block', marginTop: 4, color: 'var(--dim)' }}>
            {worn.baseEvasion}
          </s>
        )}
      </div>
      <div
        className="panel stack"
        style={{
          padding: 10,
          justifyContent: 'space-between',
          borderColor: worn ? 'var(--sage)' : undefined,
        }}
      >
        <div>
          <div className="t-meta" style={{ letterSpacing: '0.1em' }}>
            DAMAGE THRESHOLDS
          </div>
          {unknownThresholds ? (
            <div className="stack" style={{ marginTop: 6, gap: 4 }}>
              <span className="t-meta" style={{ color: 'var(--damage)' }}>
                ARMOR NOT IN THIS BUILD
              </span>
              <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
                {stats.unresolvedArmor}
              </span>
            </div>
          ) : (
            <div className="row" style={{ marginTop: 6, alignItems: 'baseline', gap: 8 }}>
              <span style={{ font: '800 22px/1 var(--sans)' }}>{stats.thresholds[0]}</span>
              <span className="t-meta">MAJOR</span>
              <span style={{ width: 1, height: 14, background: 'var(--line)' }} />
              <span style={{ font: '800 22px/1 var(--sans)' }}>{stats.thresholds[1]}</span>
              <span className="t-meta">SEVERE</span>
            </div>
          )}
        </div>
        <div className="t-meta" style={{ marginTop: 8, letterSpacing: '0.06em' }}>
          PROFICIENCY{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{stats.proficiency}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * What you are holding, and what happens when you tap it.
 *
 * This used to render only inside the desktop cockpit, so on a phone - the way
 * most of this app is used - your weapons were not on the Play screen at all.
 * And on desktop a tap only pushed a note into the log: the button looked like
 * an action and was a label.
 *
 * Now a tap arms the roll with the weapon's own trait and remembers what the
 * attack was made with, so that a successful Duality Roll can offer the damage
 * the SRD says follows it. Tapping the armed weapon again puts it down, because
 * a declaration you cannot withdraw is a trap.
 */
function Equipped({
  stats,
  armed,
  onArm,
}: {
  stats: DerivedStats;
  /** Weapon ref currently armed, if any. */
  armed: string | null;
  onArm: (weapon: Weapon | null) => void;
}): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  if (!character) return null;

  const primary = character.activePrimaryWeapon
    ? index.weapons.get(character.activePrimaryWeapon)
    : undefined;
  const secondary = character.activeSecondaryWeapon
    ? index.weapons.get(character.activeSecondaryWeapon)
    : undefined;
  const armor = character.activeArmor ? index.armors.get(character.activeArmor) : undefined;

  return (
    // flex: none, because this lives inside a scrolling flex column and a flex
    // child shrinks by default - which squashed the whole section to nothing
    // and left its label sitting on top of the next one.
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="t-label">Equipped</div>
      {primary === undefined && secondary === undefined && armor === undefined && (
        <div className="panel t-dense" style={{ padding: '12px 11px', color: 'var(--dim)' }}>
          Nothing equipped — choose gear in Build.
        </div>
      )}
      {[primary, secondary].filter(Boolean).map((w) => {
        if (!w) return null;
        // weaponDamage, not a regex. The inline `replace(/^(\d*)d/, ...)` that
        // used to live here is exactly what the note at sheetModel.ts:249 warns
        // against - two routes to one number is two numbers eventually, and
        // this one had no clamp.
        const scaled = weaponDamage(w, stats);
        const dice = scaled?.spec ?? w.damage;
        const isArmed = armed === w.id;
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={isArmed}
            onClick={() => onArm(isArmed ? null : w)}
            className="panel"
            style={{
              borderLeft: `3px solid ${isArmed ? 'var(--hope)' : 'var(--edge)'}`,
              background: isArmed ? 'var(--hope-wash)' : undefined,
              padding: '10px 11px',
              textAlign: 'left',
              minHeight: 'var(--tap)',
            }}
          >
            <span className="spread">
              <span style={{ font: '700 14px/1.15 var(--sans)' }}>{w.name}</span>
              <span className="t-num" style={{ color: 'var(--hope)' }}>
                {dice}
              </span>
            </span>
            <span
              className="t-meta"
              style={{ display: 'block', marginTop: 5, letterSpacing: '0.05em' }}
            >
              {isArmed ? 'ARMED · ' : ''}
              {(w.trait === 'spellcast' ? 'SPELLCAST' : TRAIT_LABELS[w.trait].toUpperCase())} ·{' '}
              {w.range.toUpperCase()} · {w.damageType === 'mag' ? 'MAGIC' : 'PHYSICAL'}
            </span>
          </button>
        );
      })}
      {armor && (
        <div
          className="panel"
          style={{ borderLeft: '3px solid var(--armor)', padding: '10px 11px' }}
        >
          <div className="spread">
            <span style={{ font: '700 14px/1.15 var(--sans)' }}>{armor.name}</span>
            <span className="t-num" style={{ color: 'var(--text-2)' }}>
              SCORE {armor.baseScore}
            </span>
          </div>
          <div className="t-meta" style={{ marginTop: 5, letterSpacing: '0.05em' }}>
            BASE THRESHOLDS {armor.baseThresholds[0]} / {armor.baseThresholds[1]}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The things you are carrying, and spending one of them.
 *
 * The inventory existed on the sheet and on the printout and nowhere you could
 * reach mid-scene, so a potion bought at creation was invisible for the rest of
 * the campaign. What a consumable does is its own printed text - "Clear 1d4 Hit
 * Points" - and the app does not read that text or apply it: it shows it, and
 * it counts. USE decrements the count and writes a log line, which is the
 * player saying they drank it, not the app deciding what happened.
 *
 * Nothing here is offered for an item with no quantity left; a row that stays
 * pressable after the last one is gone is a row that lies about what you have.
 */
function Items(): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const [open, setOpen] = useState<number | null>(null);
  if (!character) return null;

  const carried = character.inventory;

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="spread" style={{ flex: 'none' }}>
        <span className="t-label">Carried</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {carried.length} {carried.length === 1 ? 'ITEM' : 'ITEMS'}
        </span>
      </div>
      {carried.length === 0 && (
        <div className="panel t-dense" style={{ padding: '12px 11px', color: 'var(--dim)' }}>
          Nothing carried — add items in Build.
        </div>
      )}
      {carried.map((entry, i) => {
        const showing = open === i;
        const spent = entry.quantity <= 0;
        return (
          <div
            key={`${entry.name}-${String(i)}`}
            className="panel"
            style={{ padding: '8px 11px', opacity: spent ? 0.55 : 1 }}
          >
            <div className="spread" style={{ gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(showing ? null : i)}
                aria-expanded={showing}
                disabled={entry.note === undefined}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 'var(--tap)',
                  textAlign: 'left',
                  font: '600 14px/1.2 var(--sans)',
                }}
              >
                {entry.name}
                {entry.quantity > 1 && (
                  <span className="t-meta" style={{ marginLeft: 7, color: 'var(--muted)' }}>
                    ×{entry.quantity}
                  </span>
                )}
              </button>
              {!spent && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    update((c) => ({
                      ...c,
                      inventory: c.inventory.map((e, j) =>
                        j === i ? { ...e, quantity: e.quantity - 1 } : e,
                      ),
                    }));
                    pushLog({
                      kind: 'note',
                      label: `Used ${entry.name}`,
                      detail: entry.note ?? 'One spent.',
                    });
                  }}
                  style={{
                    flex: 'none',
                    minHeight: 'var(--tap)',
                    background: 'var(--raised)',
                    color: 'var(--text)',
                  }}
                >
                  USE
                </button>
              )}
            </div>
            {showing && entry.note !== undefined && (
              <p className="t-dense" style={{ margin: '6px 2px 2px', color: 'var(--text-2)' }}>
                {entry.note}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Vault(): React.JSX.Element | null {
  const character = useActive();
  const { vault } = useLoadout();
  const update = useApp((s) => s.update);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const pushLog = useApp((s) => s.pushLog);
  if (!character) return null;

  return (
    // A shelf, not a grid: the vault is something you reach along, and one
    // scrollable row leaves the loadout the vertical space its cards need.
    <div className="stack" style={{ flex: 'none', gap: 6 }}>
      <div className="spread" style={{ flex: 'none' }}>
        <span className="t-label">Vault</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {vault.length} INACTIVE · SWAP COSTS RECALL IN STRESS
        </span>
      </div>
      <div
        className="row"
        style={{ gap: 8, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2 }}
      >
        {vault.map((card) => {
          const check = canAddToLoadout(character, card);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (!check.allowed) {
                  setOpenCard(card);
                  return;
                }
                const out = recallCard(character, card);
                update(() => out.character);
                pushLog({
                  kind: 'note',
                  label: `Recalled ${card.name}`,
                  detail:
                    check.stressCost === 0
                      ? 'Free during downtime'
                      : `Marked ${out.stressMarked} Stress${out.hpMarked > 0 ? ` and ${out.hpMarked} HP` : ''}`,
                });
              }}
              className="row"
              title={check.reason ?? `Recall for ${check.stressCost} Stress`}
              style={{
                flex: 'none',
                minHeight: 44,
                maxWidth: 190,
                borderRadius: 'var(--r3)',
                background: 'var(--app)',
                border: '1px solid var(--line-soft)',
                gap: 8,
                padding: '0 10px',
                opacity: check.allowed ? 1 : 0.55,
              }}
            >
              <DomainMark domain={card.domain} size={12} shapes={shapes} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  font: '600 12px/1 var(--sans)',
                  color: 'var(--text-2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                }}
              >
                {card.name}
              </span>
              <span className="t-meta">LV{card.level}</span>
            </button>
          );
        })}
        {vault.length === 0 && (
          <span className="t-dense" style={{ color: 'var(--dim)' }}>
            The vault is empty.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The loadout as a list.
 *
 * Used on a phone, and on a tablet where the second column is too narrow for a
 * three-across gallery: at that width a "card" is a header, a title and a
 * footer with the rules text squeezed to nothing, which is a card that has
 * stopped doing a card's job. A row that says name, domain and Recall, with the
 * full text one tap away, is the honest shape for the space.
 */
function LoadoutRows({
  minHeight = 46,
  fill = false,
}: {
  minHeight?: number;
  /** Divide the container between the rows, for the fixed-height desktop box. */
  fill?: boolean;
}): React.JSX.Element {
  const { loadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);

  return (
    <>
      {loadout.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => setOpenCard(card)}
          className="row"
          style={{
            flex: fill ? '1 1 0' : 'none',
            minHeight,
            overflow: 'hidden',
            borderRadius: 'var(--r3)',
            background: 'var(--panel)',
            border: '1px solid var(--line-soft)',
            borderLeft: `4px solid var(--${card.domain})`,
            gap: 11,
            padding: '0 12px',
            textAlign: 'left',
          }}
        >
          <DomainMark domain={card.domain} size={17} shapes={shapes} />
          <span className="stack" style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                font: '700 15px/1.1 var(--sans)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.name}
            </span>
            <span className="t-meta" style={{ marginTop: 3, letterSpacing: '0.09em' }}>
              {card.domain.toUpperCase()} · LV{card.level} · {card.type.toUpperCase()}
            </span>
          </span>
          <span style={{ flex: 'none', textAlign: 'right' }}>
            <span className="t-meta" style={{ display: 'block' }}>
              RECALL
            </span>
            <span style={{ font: '800 15px/1 var(--sans)', marginTop: 3, display: 'block' }}>
              {card.recallCost}
            </span>
          </span>
        </button>
      ))}
      {loadout.length === 0 && (
        <div className="panel t-dense" style={{ padding: 14, color: 'var(--dim)' }}>
          No cards in the loadout yet. Add some in Cards.
        </div>
      )}
    </>
  );
}

function PlayDesktop({
  stats,
  trait,
  setTrait,
  armedWeapon,
  armWeapon,
  columns,
}: ViewProps & { columns: 2 | 3 }): React.JSX.Element {
  const character = useActive();
  const { loadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const update = useApp((s) => s.update);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns:
          columns === 3 ? 'minmax(300px, 336px) minmax(360px, 428px) 1fr' : 'minmax(340px, 5fr) 6fr',
        gap: 18,
        padding: '18px 20px 20px',
      }}
    >
      <div className="stack scroll" style={{ gap: 14, minHeight: 'var(--control)', minWidth: 0 }}>
        <Beastform stats={stats} layout="desktop" />
        <Identity stats={stats} />
        <TraitGrid stats={stats} trait={trait} setTrait={setTrait} />
        <Defenses stats={stats} />
        {columns === 2 && (
          <>
            <Vitals stats={stats} layout="desktop" />
            <DualityRoll stats={stats} trait={trait} onTraitChange={setTrait} layout="desktop" />
          </>
        )}
        <Equipped stats={stats} armed={armedWeapon} onArm={armWeapon} />
      </div>

      {columns === 3 && (
        <div className="stack" style={{ gap: 12, minHeight: 'var(--control)', minWidth: 0 }}>
          <Vitals stats={stats} layout="desktop" />
          <DualityRoll stats={stats} trait={trait} onTraitChange={setTrait} layout="desktop" />
        </div>
      )}

      <div className="stack" style={{ gap: 10, minHeight: 'var(--control)', minWidth: 0 }}>
        <div className="spread" style={{ flex: 'none' }}>
          <span className="t-label">Loadout</span>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {loadout.length} / 5 ACTIVE
          </span>
        </div>
        {/* The grid owns the height, and the cards fill their cell. Fixing a
            card height instead pushes the vault off the bottom of the screen
            on a 900px display, which is the one thing Play must never do. */}
        {columns === 2 ? (
          <div className="stack" style={{ flex: 1, minHeight: 0, gap: 6, overflow: 'hidden' }}>
            <LoadoutRows minHeight={52} fill />
          </div>
        ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridAutoRows: 'minmax(0, 1fr)',
            gap: 12,
          }}
        >
          {loadout.map((card) => (
            <DomainCardView
              key={card.id}
              card={card}
              shapes={shapes}
              onOpen={() => setOpenCard(card)}
              height="100%"
              headHeight={64}
              footer={
                <>
                  <button
                    type="button"
                    className="t-meta"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (character) update((c) => vaultCard(c, card.id));
                    }}
                    style={{ letterSpacing: '0.1em' }}
                  >
                    TO VAULT
                  </button>
                  <span className="row" style={{ gap: 5 }}>
                    <span className="t-meta">RECALL</span>
                    <span style={{ font: '800 13px/1 var(--sans)' }}>{card.recallCost}</span>
                  </span>
                </>
              }
            />
          ))}
          {loadout.length < 5 && (
            <div
              className="stack"
              style={{
                minHeight: 0,
                borderRadius: 'var(--r4)',
                border: '1px dashed var(--line)',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 12,
              }}
            >
              <span
                style={{ width: 26, height: 26, border: '1.5px solid var(--empty)', borderRadius: 4 }}
              />
              <span
                className="t-meta"
                style={{ color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}
              >
                {5 - loadout.length} SLOT{5 - loadout.length === 1 ? '' : 'S'} FREE
                <br />
                RECALL FROM THE VAULT
              </span>
            </div>
          )}
        </div>
        )}
        <Vault />
      </div>
    </div>
  );
}

/**
 * The phone screen.
 *
 * The page scrolls. It used to refuse to, and the refusal cost more than it
 * saved: with every band fixed, one region had to absorb every shortfall, and
 * that region was the loadout - measured at 130px of the 230 it needs on a
 * 393px phone, and at *zero* on a 375px one, where five cards rendered into a
 * box with no height and the ROLL button came out 33px tall and partly under
 * the tab bar. A screen that hides your cards to avoid a scrollbar has its
 * priorities backwards.
 *
 * So everything scrolls except the roll block, and the ergonomics are in the
 * order rather than in the fitting:
 *
 *   - The roll block stays out of the scroll because it is the one thing
 *     touched on every single action. It holds the trait chips, the modifier
 *     row, the Experiences and ROLL - which is also the order the rules ask
 *     for, since all of those are declared *before* the dice. Nothing in it
 *     can scroll out from under a thumb that is already moving.
 *   - Inside the scroll, the order runs from read at the top to touched at the
 *     bottom: identity, then cards, then the weapons and items you reach for
 *     during a turn, then the tracks. So the things touched most are already
 *     in the thumb arc when the screen opens, and everything else is one flick
 *     away rather than absent.
 *   - The tracks sit last, immediately above the roll block, because after a
 *     roll resolves the next thing a hand does is mark something.
 */
function PlayPhone({
  stats,
  trait,
  setTrait,
  armedWeapon,
  armWeapon,
}: ViewProps): React.JSX.Element {
  const character = useActive();
  const { loadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  if (!character) return <div />;

  const modLabel =
    trait === 'spellcast' && stats.spellcastTrait !== null
      ? 'SPELLCAST'
      : TRAIT_LABELS[(trait === 'spellcast' ? 'knowledge' : trait) as Trait].toUpperCase();
  const modValue =
    trait === 'spellcast'
      ? stats.spellcastTrait
        ? stats.traits[stats.spellcastTrait]
        : 0
      : stats.traits[trait as Trait];

  return (
    /*
     * The outer column scrolls only as a last resort.
     *
     * Pinning the tokens and the roll is right until the two of them do not
     * fit, and on a 375x667 phone carrying five Experiences they do not: the
     * fixed block wants 480 of the 553 this screen gets, which left the
     * reference region *three pixels* for 943px of cards, weapons and items.
     * That is P2-1's failure wearing the other hat - one region absorbing
     * every shortfall - and a floor is the fix in both directions.
     *
     * So the scrolling region can never go below two rows, and when the sum
     * overflows, the page itself takes up the slack instead of crushing
     * anything. On any phone with room the outer scroller never engages at all.
     */
    <div
      className="stack"
      style={{ flex: 1, minHeight: 0, padding: '0 12px 8px', gap: 8, overflowY: 'auto' }}
    >
      {/*
       * Everything that is read, or reached for during a turn. It scrolls, and
       * it is ordered so the least-touched thing is furthest from the thumb.
       */}
      <div
        className="stack scroll scroll-fade"
        // The floor. Two rows of something is the least that can be called a
        // region rather than a slot.
        style={{ flex: '1 1 auto', minHeight: 88, gap: 10, overflowX: 'hidden' }}
      >
        {/* A worn Beastform changes what every number under it means, so it
            leads: a state banner nobody scrolls to is a state banner nobody
            reads. It renders nothing when no form is worn. */}
        <Beastform stats={stats} layout="phone" />

        {/*
         * Cards first.
         *
         * They are the answer to "what can I do", which is the question a
         * player asks on every turn of their own, and they were sitting about
         * 350px down a 288px window - present, and in practice missing. What
         * leads the scroll is what is on screen without a gesture, and nothing
         * here earns that more.
         */}
        <div className="stack" style={{ flex: 'none', gap: 4 }}>
          <div className="spread" style={{ flex: 'none' }}>
            <span className="t-label">Loadout</span>
            <span className="t-meta">{loadout.length} / 5</span>
          </div>
          <LoadoutRows />
        </div>

        {/* Then what you attack with. Together these two are the whole of
            "what can I do this turn", so they lead together. */}
        <Equipped stats={stats} armed={armedWeapon} onArm={armWeapon} />

        {/* The damage calculator. It is the one part of the vitals panel that
            is a question rather than a state - "someone hit you for 14, how
            many HP is that" - and it is asked when something hits you rather
            than continuously, so it does not need to be pinned. Its answer
            lands on the Armor and HP tracks, which are. */}
        <Vitals stats={stats} layout="phone" showState={false} part="damage" />

        {/* Conditions are set once a scene rather than once a turn. */}
        <ActiveConditions />

        <Items />

      </div>

      {/*
       * The roll block. Out of the scroll on purpose - it is the one thing
       * touched on every single action, and a control you have to go looking
       * for is a control you stop using. It also holds everything the rules
       * make you declare before the dice, in that order.
       */}
      <div className="stack" style={{ flex: 'none', gap: 6 }}>
        {/* When you have fallen, this is the only thing that matters, so it
            goes above everything else and outside the scroll. It renders
            nothing the rest of the time. */}
        <DeathMoveOffer />

        {/* The tokens, in the foreground - all four of them.
            They are not reference material: they are the state of the
            character, changed several times a turn, and a counter you have to
            go and find is a counter that stops being marked. They sit directly
            above the declaration row, which puts the Hope track against the
            Experience chips that spend it. */}
        <Vitals stats={stats} layout="phone" showState={false} part="tracks" />

        <div
          className="row"
          style={{ gap: 4, overflowX: 'auto', flex: 'none', scrollbarWidth: 'none' }}
        >
          {TRAITS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTrait(t);
                // Picking a trait by hand is declaring a different roll from
                // the one the weapon declared, so the weapon steps back rather
                // than silently offering its damage for a persuasion check.
                if (armedWeapon !== null) armWeapon(null);
              }}
              className="chip"
              aria-pressed={trait === t}
              style={{
                minHeight: 'var(--tap)',
                flex: '1 0 auto',
                background: trait === t ? 'var(--hope)' : 'var(--raised)',
                color: trait === t ? 'var(--app)' : 'var(--muted)',
                borderBottom:
                  stats.beastform?.raised.some((r) => r.trait === t) === true
                    ? '2px solid var(--sage)'
                    : '2px solid transparent',
              }}
            >
              {TRAIT_LABELS[t].slice(0, 3).toUpperCase()} {stats.traits[t] >= 0 ? '+' : '−'}
              {Math.abs(stats.traits[t])}
            </button>
          ))}
        </div>
        <DualityRoll stats={stats} trait={trait} onTraitChange={setTrait} layout="phone" />
      </div>
    </div>
  );
}
