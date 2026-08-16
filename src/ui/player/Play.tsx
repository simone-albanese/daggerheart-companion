/**
 * Play: the screen that is open ninety percent of the time.
 *
 * The screen scrolls. It used to say here that it did not - "No scrolling on
 * this screen. The content is bounded and known" - and that stopped being true
 * at 91097eb, when refusing to scroll turned out to cost more than it saved:
 * with every band fixed, one region had to absorb every shortfall, and that
 * region was the loadout, measured at 130px of the 230 it needs on a 393px
 * phone and at *zero* on a 375px one.
 *
 * Two layouts, at one breakpoint rather than two.
 *
 *   Below 1180px - every phone and every tablet - the sheet is one column in
 *   the printed sheet's order, scrolling, with the trait chips and ROLL pinned
 *   to the bottom. `PlayPhone`.
 *
 *   At 1180px and above, the three-column cockpit, which fits without
 *   scrolling and is laid out for a mouse. `PlayDesktop`.
 *
 * The middle band used to run the cockpit at two columns, and that is P2-1:
 * `DualityRoll`'s root is `flex: 1, minHeight: 0, overflow: hidden` inside a
 * scrolling column, so on an iPad it was crushed - 45px at 744x1133, 26px at
 * 1024x768 - while its children laid out to their natural height, putting ROLL
 * about 228px past the clip. In the DOM, invisible, and still reachable by
 * keyboard focus. On every iPad, and every phone in landscape, you could not
 * roll.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  TRAITS,
  TRAIT_LABELS,
  type Character,
  type DomainCard,
  type Ref,
  type Trait,
} from '../../../shared/types.ts';
import { weaponDamage, type DatasetIndex, type DerivedStats } from '../../engine/character.ts';
import { formatDamage } from '../../engine/dice.ts';
import { formatGold } from '../../engine/gold.ts';
import { cryptoRng } from '../../engine/dice.ts';
import {
  canAddToLoadout,
  missingCardRefs,
  resolveCards,
  vaultCard,
  type SwapCheck,
} from '../../engine/loadout.ts';
import { useActive, useApp } from '../../store/state.ts';
import { Disclosure } from '../shared/Disclosure.tsx';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { useLayout } from '../shared/useLayout.ts';
import {
  DAMAGE_SIDES,
  sourceFromWeapon,
  sourceName,
  spellcastDamage,
  spellcastSource,
  unarmedSource,
  type Arming,
  type AttackSource,
  type Declaration,
} from './attack.ts';
import { Beastform } from './Beastform.tsx';
import { ActiveConditions } from './Conditions.tsx';
import { DeathMoveOffer } from './DeathMove.tsx';
import { DualityRoll, type RollTrait } from './DualityRoll.tsx';
import { shortReason, useRecall } from './recall.ts';
import { Rest } from './Rest.tsx';
import { spellcastZeroNote, traitVerbs } from './ruleText.ts';
import { Vitals } from './Vitals.tsx';

export function Play({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const layout = useLayout();
  const index = useApp((s) => s.index);
  const [trait, setTrait] = useState<RollTrait>('agility');
  const [declared, setDeclared] = useState<Declaration | null>(null);
  /*
   * The `+3` in "d8+3 using your Spellcast trait", kept beside the declaration
   * rather than inside it.
   *
   * A card prints one formula, so changing the die must not clear the modifier
   * that came with it - and re-typing it after every chip tap would be the app
   * forgetting a thing it was told two seconds ago.
   */
  const [spellModifier, setSpellModifier] = useState(0);

  /*
   * A declaration belongs to the sheet that made it.
   *
   * `App` renders `<Play />` unkeyed, so the header's character picker swaps
   * the character underneath a component that keeps every piece of its own
   * state - and the armed attack was one of them. Switch sheets mid-turn and
   * the arriving character was already holding somebody else's axe, with a
   * trait chip somebody else had picked, ready to roll damage nobody had
   * declared. `DualityRoll` already clears the resolved *result* on this same
   * key (DualityRoll.tsx:291); it could not help, because the declaration
   * behind it was still live and the very next roll re-armed from it.
   *
   * Resolving against the character's own kit is not enough on its own: hand
   * the axe to a second character who also carries one and the ref matches, so
   * the declaration survives and is simply wrong about who made it. The
   * modifier goes with it - it is the `+3` off a card in the previous player's
   * hand, and leaving it typed into the arriving sheet is the app showing a
   * number nobody entered.
   */
  const characterId = character?.id ?? null;
  useEffect(() => {
    setDeclared(null);
    setSpellModifier(0);
  }, [characterId]);

  /*
   * The pool the declaration resolves to, re-derived on every render.
   *
   * What is remembered is a ref; what is rolled is worked out from it here and
   * nowhere else. That is what makes a level-up, a Beastform or a weapon
   * unequipped in Build move the dice - or take the offer away altogether -
   * instead of leaving a `2d10+3` armed that nothing will ever refresh. And it
   * goes through `sourceFromWeapon` rather than a regex, because `weaponDamage`
   * keeps the modifier on a weapon spelled `d10 + 2` and two routes to one
   * number is two numbers eventually.
   *
   * The weapon is looked for in the character's own two hands and not in
   * `index.weapons`, and that is the difference between the sentence above
   * being true and it being a wish. `index.weapons` is the whole shipped
   * catalogue - 204 weapons - so asking it about a ref answers "does this
   * weapon exist", when the question here is "is this character holding it".
   * It answered yes for a Battleaxe taken off in Build and yes for a Battleaxe
   * belonging to a different sheet, and the offer stood at 2d10+3 either way.
   */
  const source = useMemo<AttackSource | null>(() => {
    if (declared === null) return null;
    if (declared.kind === 'unarmed') return unarmedSource(stats);
    // A spell's count comes off the trait every render for the same reason: a
    // Beastform or a level-up that moves the Spellcast trait moves the number
    // of dice, and at +0 `spellcastSource` returns null and the offer goes.
    if (declared.kind === 'spellcast') {
      return spellcastSource(stats, declared.sides, spellModifier);
    }
    if (character === null) return null;
    const held =
      declared.ref === character.activePrimaryWeapon ||
      declared.ref === character.activeSecondaryWeapon;
    if (!held) return null;
    const weapon = index.weapons.get(declared.ref);
    return weapon === undefined ? null : sourceFromWeapon(weapon, stats);
  }, [character, declared, index, spellModifier, stats]);

  /*
   * Arming a weapon arms its trait, because the weapon is what decides it:
   * "The trait that applies to an attack roll is specified by the weapon or
   * spell being used." A player who taps a sword has declared that roll, and
   * making them then find the matching trait chip would be the app asking for
   * the same decision twice.
   *
   * An unarmed declaration deliberately does not, and it is the same rule that
   * says so: *"Unarmed attack rolls use either Strength or Finesse (GM's
   * choice)."* Picking one of the two here would be the app making the GM's
   * ruling for them, quietly, in the chip row.
   *
   * Withdrawing does not touch the trait either. Putting a sword down says
   * nothing about what you mean to roll instead, and moving the chip back to
   * whatever was there before would be the app answering a question nobody
   * asked.
   */
  const arm = (declaration: Declaration | null): void => {
    setDeclared(declaration);
    if (declaration === null || declaration.kind === 'unarmed') return;
    // Not through `chooseTrait`: that one is the route for picking a trait *by
    // hand*, and it withdraws the declaration that specified one. A spell sent
    // through it would be put down by the same tap that armed it.
    if (declaration.kind === 'spellcast') {
      setTrait('spellcast');
      return;
    }
    const weapon = index.weapons.get(declaration.ref);
    if (weapon !== undefined) setTrait(weapon.trait);
  };

  /*
   * Picking a trait by hand, wherever the tap came from.
   *
   * Three surfaces set the trait - the pinned chips, the trait grid inside the
   * scroll, and the SPELLCAST chip in the modifier row - and only the pinned
   * chips put the armed weapon down. The other two left it standing, so tapping
   * KNOWLEDGE on a tile kept a sword declared for a Knowledge check with
   * nothing on screen disagreeing with anything else.
   *
   * It is one rule, so it lives in one place: *"The trait that applies to an
   * attack roll is specified by the weapon or spell being used."* Choosing the
   * trait yourself is therefore declaring a roll the weapon did not, and the
   * weapon steps back rather than silently offering its damage for it.
   */
  const chooseTrait = (t: RollTrait): void => {
    setTrait(t);
    /*
     * An unarmed declaration stands under the two traits the rule names, for
     * the reason `arm` does not set a trait for it: *"Unarmed attack rolls use
     * either Strength or Finesse (GM's choice)"*, so picking one of those two
     * is how you complete that declaration rather than how you replace it.
     *
     * Two, and not any. The carve-out used to be `kind === 'unarmed'` flat,
     * which kept the fists declared under Knowledge, under Instinct and - the
     * one that shows - under Spellcast: arm a d8 spell, tap Unarmed, and the
     * roll bar read SPELLCAST over a damage offer of 2d4 PHY. That is the same
     * wrong declaration this whole route exists to stop, quoting a sentence
     * that does not cover it.
     */
    setDeclared((d) =>
      d?.kind === 'unarmed' && (t === 'strength' || t === 'finesse') ? d : null,
    );
  };

  const arming: Arming = { declared, source, arm, spellModifier, setSpellModifier };

  if (!character) return null;
  if (layout !== 'desktop') {
    return <PlayPhone stats={stats} trait={trait} chooseTrait={chooseTrait} arming={arming} />;
  }
  return <PlayDesktop stats={stats} trait={trait} chooseTrait={chooseTrait} arming={arming} />;
}

interface ViewProps {
  stats: DerivedStats;
  trait: RollTrait;
  /**
   * The one route to picking a trait. There is no raw setter on these props on
   * purpose: a call site that could reach it would be a fourth surface with its
   * own opinion about whether the weapon stays armed.
   */
  chooseTrait: (t: RollTrait) => void;
  arming: Arming;
}

interface Held {
  loadout: DomainCard[];
  vault: DomainCard[];
  /** Loadout refs this build cannot name. They still fill a slot. */
  ghostLoadout: Ref[];
  ghostVault: Ref[];
}

/**
 * What the character is holding, including what this build cannot read.
 *
 * P1-6. `resolveCards` is a `.filter()`, so an unresolvable ref - a card from a
 * newer bundle, a homebrew layer that is not on this device - simply
 * disappeared from every display path, while `canAddToLoadout` went on gating
 * against the raw array. A character holding five cards of which two were
 * unreadable rendered "3 / 5 ACTIVE", offered "2 SLOTS FREE", and then refused
 * every recall with "Loadout is full (5)". The screen contradicted itself, and
 * the player could not move the two ghosts out of the way because nothing drew
 * them.
 *
 * `missingCardRefs` has existed the whole time, documented "Shown, never
 * dropped", with five tests and no caller. This is the caller.
 */
function useLoadout(): Held {
  const character = useActive();
  const index = useApp((s) => s.index);
  return useMemo(() => {
    if (!character) return { loadout: [], vault: [], ghostLoadout: [], ghostVault: [] };
    const missing = new Set(missingCardRefs(character, index));
    return {
      loadout: resolveCards(character.loadout, index),
      vault: resolveCards(character.vault, index),
      ghostLoadout: character.loadout.filter((r) => missing.has(r)),
      ghostVault: character.vault.filter((r) => missing.has(r)),
    };
  }, [character, index]);
}

/**
 * A card this build cannot read, drawn rather than dropped.
 *
 * It names the ref, because that is the only thing anybody has to go on: it is
 * what a newer build, or the device the sheet came from, would resolve. It
 * counts against the five, because the gate counts it and a readout that
 * disagrees with the gate is worse than either number on its own. And it can
 * be moved to the vault by hand, because otherwise a sheet carrying two of
 * these can never recall anything again.
 *
 * It is never dropped automatically. A ref this build does not know today is
 * very often a ref it will know after the next update, and deleting somebody's
 * card because this bundle is behind is the worst version of the failure this
 * whole item is about.
 */
function GhostRow({ refId, onVault }: { refId: Ref; onVault?: () => void }): React.JSX.Element {
  return (
    <div className="row" style={{ flex: 'none', gap: 6 }}>
      <div
        className="stack"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 52,
          justifyContent: 'center',
          gap: 3,
          borderRadius: 'var(--r3)',
          background: 'var(--app)',
          border: '1px dashed var(--edge)',
          padding: '6px 11px',
        }}
      >
        <span className="t-meta" style={{ color: 'var(--damage)', letterSpacing: '0.08em' }}>
          CARD NOT IN THIS BUILD
        </span>
        <span
          className="t-meta"
          style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}
        >
          {refId}
        </span>
      </div>
      {onVault !== undefined && (
        <button
          type="button"
          onClick={onVault}
          aria-label={`Move the unreadable card ${refId} to the vault, freeing its slot`}
          className="stack"
          style={{
            flex: 'none',
            minWidth: 72,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--r3)',
            background: 'var(--raised)',
            border: '1px solid var(--line)',
            padding: '0 8px',
          }}
        >
          <span className="t-meta" style={{ color: 'var(--text)', fontWeight: 700 }}>
            TO VAULT
          </span>
        </button>
      )}
    </div>
  );
}

/** Ancestry and community, as the dataset names them. */
function lineageOf(character: Character, index: DatasetIndex): string {
  return [
    ...character.ancestryRefs.map((r) => (index.byRef.get(r) as { name?: string } | undefined)?.name),
    (index.byRef.get(character.communityRef ?? '') as { name?: string } | undefined)?.name,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Who this is.
 *
 * The `stats` prop this used to take was never read - `--noUnusedLocals` does
 * not see an unused destructured prop, so it sat there through every edit
 * looking load-bearing.
 */
function Identity({ showLineage = true }: { showLineage?: boolean }): React.JSX.Element | null {
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
  const lineage = lineageOf(character, index);

  return (
    <div style={{ flex: 'none' }}>
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
      {showLineage && lineage !== '' && (
        <div style={{ font: '400 13px/1.35 var(--sans)', color: 'var(--muted)' }}>{lineage}</div>
      )}
    </div>
  );
}

/**
 * Where you are from, and what you can draw cards from.
 *
 * Both are read once a session at most - the ancestry decides nothing at the
 * table that the features have not already been written onto the sheet, and
 * the domains only matter when you are choosing a card - so on a phone this is
 * the section behind a fold rather than the four lines of prose under the
 * name. The card level cap is the one number here that answers a question
 * asked mid-scene: "can I take that".
 */
function Lineage({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  if (!character) return null;
  const lineage = lineageOf(character, index);

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <div style={{ font: '400 13px/1.35 var(--sans)', color: 'var(--text-2)' }}>
        {lineage === '' ? 'No ancestry or community on this sheet.' : lineage}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {stats.domains.map((domain) => (
          <span
            key={domain}
            className="row"
            style={{
              gap: 6,
              minHeight: 28,
              padding: '0 9px',
              borderRadius: 'var(--r3)',
              background: 'var(--panel)',
              border: '1px solid var(--line-soft)',
            }}
          >
            <DomainMark domain={domain} size={12} shapes={shapes} />
            <span className="t-meta" style={{ color: 'var(--text-2)' }}>
              {domain.toUpperCase()}
            </span>
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              TO LV{stats.cardLevelCap(domain)}
            </span>
          </span>
        ))}
        {stats.domains.length === 0 && (
          <span className="t-dense" style={{ color: 'var(--dim)' }}>
            No domains — this sheet has no class the app can read.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * What the sheet is carrying in gold.
 *
 * A readout and not an editor: the coins are changed in Build, where the
 * denominations can be stepped without spending a band of the Play screen on
 * three steppers that are touched once a session. It is here because it was
 * nowhere on a phone at all - the printout had it and the screen the game is
 * played on did not.
 */
function GoldRow(): React.JSX.Element | null {
  const character = useActive();
  if (!character) return null;
  return (
    <div className="row" style={{ flex: 'none', gap: 8, minHeight: 30, padding: '0 2px' }}>
      <span className="t-label" style={{ flex: 'none', color: 'var(--text-2)' }}>
        Gold
      </span>
      <span style={{ flexGrow: 1, flexBasis: 0, minWidth: 8 }} />
      <span className="t-meta" style={{ flex: 'none', color: 'var(--splendor)' }}>
        {formatGold(character.gold).toUpperCase()}
      </span>
    </div>
  );
}

function TraitGrid({
  stats,
  trait,
  onPick,
}: {
  stats: DerivedStats;
  trait: RollTrait;
  /** Named for what it is, not for what it sets: the route, not the setter. */
  onPick: (t: RollTrait) => void;
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
              onClick={() => onPick(t)}
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

/**
 * The four numbers you are told under pressure.
 *
 * Evasion, the two thresholds and Proficiency. Somebody says "eighteen" and
 * the answer is read off this band in the second before the table moves on -
 * so it is four cells of one big number each, and not, as the thresholds were
 * on a phone until now, 10px of `--dim` text beside a damage input.
 *
 * The order is the sheet's, and it is also the order the numbers are needed
 * in: Evasion decides whether you were hit at all, the thresholds decide how
 * badly, Proficiency is the one you reach for when it is your turn instead of
 * theirs.
 */
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
    <div
      style={{
        flex: 'none',
        display: 'grid',
        // Four across while the thresholds are numbers; when they are not, the
        // sentence that replaces them takes both of their cells rather than
        // being squeezed into 80px.
        gridTemplateColumns: unknownThresholds ? '1fr 2fr 1fr' : 'repeat(4, 1fr)',
        gap: 6,
      }}
    >
      <Defence
        label="EVASION"
        value={stats.evasion}
        tone={worn ? 'var(--sage)' : undefined}
        under={worn ? String(worn.baseEvasion) : undefined}
      />
      {unknownThresholds ? (
        <div className="panel stack" style={{ padding: '8px 9px', gap: 3, minWidth: 0 }}>
          <span className="t-meta" style={{ letterSpacing: '0.08em', color: 'var(--damage)' }}>
            ARMOR NOT IN THIS BUILD
          </span>
          <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
            {stats.unresolvedArmor}
          </span>
        </div>
      ) : (
        <>
          <Defence label="MAJOR" value={stats.thresholds[0]} tone="var(--stress)" />
          <Defence label="SEVERE" value={stats.thresholds[1]} tone="var(--damage)" />
        </>
      )}
      <Defence label="PROF" value={stats.proficiency} />
    </div>
  );
}

/** One cell of the defence band: a label, a number, and sometimes a was-. */
function Defence({
  label,
  value,
  tone,
  under,
}: {
  label: string;
  value: number;
  /** Colour for the label, when the number means something in particular. */
  tone?: string;
  /** The number this one replaced, struck through. */
  under?: string;
}): React.JSX.Element {
  return (
    <div
      className="panel stack"
      style={{ padding: '8px 9px', gap: 4, minWidth: 0, borderColor: tone }}
    >
      <span className="t-meta" style={{ letterSpacing: '0.08em', color: tone }}>
        {label}
      </span>
      <span
        style={{
          font: '800 26px/1 var(--sans)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      {under !== undefined && (
        <s className="t-meta" style={{ color: 'var(--dim)' }}>
          {under}
        </s>
      )}
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
  arming,
  bare = false,
}: {
  stats: DerivedStats;
  arming: Arming;
  /** Drop the section's own heading: a disclosure is already carrying it. */
  bare?: boolean;
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
  const unarmed = arming.declared?.kind === 'unarmed';

  return (
    // flex: none, because this lives inside a scrolling flex column and a flex
    // child shrinks by default - which squashed the whole section to nothing
    // and left its label sitting on top of the next one.
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      {!bare && <div className="t-label">Equipped</div>}
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
        const isArmed = arming.declared?.kind === 'weapon' && arming.declared.ref === w.id;
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={isArmed}
            onClick={() => arming.arm(isArmed ? null : { kind: 'weapon', ref: w.id })}
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
      {/*
       * Empty-handed, as a row you can declare.
       *
       * *"Successful unarmed attacks inflict [Proficiency]d4 damage."* The word
       * "unarmed" appeared nowhere in `src/` at all, so a character who had
       * thrown their sword down a well had no attack on this screen. It is
       * drawn even when nothing is equipped, because having no gear is not the
       * same as having no attack - it is the state the rule is written for.
       *
       * The meta line says who chooses the trait, and it is not this app:
       * *"Unarmed attack rolls use either Strength or Finesse (GM's choice)."*
       * So arming this row moves no chip, and the line says why rather than
       * leaving the player to notice that nothing happened.
       */}
      <button
        type="button"
        aria-pressed={unarmed}
        onClick={() => arming.arm(unarmed ? null : { kind: 'unarmed' })}
        className="panel"
        style={{
          borderLeft: `3px solid ${unarmed ? 'var(--hope)' : 'var(--edge)'}`,
          background: unarmed ? 'var(--hope-wash)' : undefined,
          padding: '10px 11px',
          textAlign: 'left',
          minHeight: 'var(--tap)',
        }}
      >
        <span className="spread">
          <span style={{ font: '700 14px/1.15 var(--sans)' }}>Unarmed</span>
          <span className="t-num" style={{ color: 'var(--hope)' }}>
            {formatDamage(unarmedSource(stats).damage)}
          </span>
        </span>
        <span className="t-meta" style={{ display: 'block', marginTop: 5, letterSpacing: '0.05em' }}>
          {unarmed ? 'ARMED · ' : ''}STRENGTH OR FINESSE · GM’S CHOICE · PHYSICAL
        </span>
      </button>
      <SpellcastPanel stats={stats} arming={arming} />
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
 * Spellcast damage, which is the one attack the sheet cannot work out alone.
 *
 * *"Any time an effect says to deal damage using your Spellcast trait, you roll
 * a number of dice equal to your Spellcast trait."* 77 of the 189 shipped
 * domain cards mention Spellcast and 43 carry a dice formula, and not one of
 * them was rollable in this app.
 *
 * WHO SUPPLIES WHAT, which is the whole design of this panel. A `DomainCard`
 * carries free prose and nothing else - only three cards in the SRD say the
 * exact phrase "using your Spellcast trait", and only one of those pairs it
 * with a formula - so parsing a pool out of card text would mean the app
 * silently rewriting a card that prints its own `2d8+4`. Nothing is parsed. The
 * app supplies the one number that is genuinely on the sheet, the die count,
 * and the player taps the die and types the modifier that are in their hand.
 * There is deliberately no COUNT field: a count you could type is a count the
 * app would let you contradict.
 *
 * AND WHEN IT REFUSES IT QUOTES. At +0 or lower there are no chips, no input
 * and no disabled control - a greyed button still saying ROLL DAMAGE is the app
 * announcing something it will not do. What stands in their place is the SRD's
 * own sentence, in quotation marks, because on this row what is quoted is the
 * book's and what is not is the app's own words for a rules layer that does not
 * carry the sentence.
 */
function SpellcastPanel({
  stats,
  arming,
}: {
  stats: DerivedStats;
  arming: Arming;
}): React.JSX.Element | null {
  const rules = useApp((s) => s.dataset.rules);
  const zeroNote = useMemo(() => spellcastZeroNote(rules), [rules]);
  const spell = spellcastDamage(stats);
  // No Spellcast trait at all - most Warriors, Rogues and Guardians. A panel
  // saying "you cannot cast" would be four lines about something the character
  // sheet never claimed in the first place.
  if (spell === null) return null;

  /*
   * What is armed is what the declaration *resolves to*, not the declaration.
   *
   * The two differ in exactly one place, and it is the place this panel is
   * about: a spell declared while the Spellcast trait was +3 is still declared
   * when something takes that trait to +0, and `spellcastSource` then resolves
   * it to nothing. Read off the declaration, this row would draw ARMED and a
   * hope-washed border around the words NO DICE - the sheet saying a spell is
   * ready to cast in the same breath as the rule that says it is not.
   */
  const armed = arming.source?.kind === 'spellcast' ? arming.source.damage.sides : null;
  const modifier = arming.spellModifier;
  const modText = modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : `${modifier}`;
  const value = spell.rollable ? spell.count : spell.value;
  const spec = !spell.rollable
    ? 'NO DICE'
    : armed === null
      ? /*
         * The count is settled and the die is not, and it says exactly that
         * rather than picking a d6 on the player's behalf.
         *
         * The modifier is held off the placeholder by a space. Run together,
         * a card printing d?-3 came out as `3d—-3`: an em-dash standing in for
         * the die immediately against the sign of the modifier, which is two
         * dashes in a row and a formula the player has to decode before they
         * can read their own damage off it.
         */
        `${spell.count}d—${modText === '' ? '' : ` ${modText}`}`
      : formatDamage({ count: spell.count, sides: armed, modifier });

  return (
    <div
      className="stack panel"
      style={{
        flex: 'none',
        gap: 8,
        borderLeft: `3px solid ${armed === null ? 'var(--edge)' : 'var(--hope)'}`,
        background: armed === null ? undefined : 'var(--hope-wash)',
        padding: '10px 11px',
      }}
    >
      <span className="spread">
        <span style={{ font: '700 14px/1.15 var(--sans)' }}>Spellcast</span>
        <span className="t-num" style={{ color: spell.rollable ? 'var(--hope)' : 'var(--damage)' }}>
          {spec}
        </span>
      </span>
      {/* The trait by name and by number, not just the count. A Beastform can
          move this and the player has no other way to connect "3 dice" to the
          reason it is three. */}
      <span className="t-meta" style={{ display: 'block', letterSpacing: '0.05em' }}>
        {armed === null ? '' : 'ARMED · '}
        {TRAIT_LABELS[spell.trait].toUpperCase()} {value >= 0 ? '+' : '−'}
        {Math.abs(value)} · {spell.rollable ? `${spell.count} ${spell.count === 1 ? 'DIE' : 'DICE'} · ` : ''}
        MAGIC
      </span>
      {spell.rollable ? (
        <div className="row" style={{ gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {DAMAGE_SIDES.map((sides) => {
            const on = armed === sides;
            return (
              <button
                key={sides}
                type="button"
                aria-pressed={on}
                aria-label={`Cast with a d${sides}: ${formatDamage({ count: spell.count, sides, modifier })} magic damage`}
                onClick={() => arming.arm(on ? null : { kind: 'spellcast', sides })}
                className="chip"
                style={{
                  flex: 'none',
                  minHeight: 'var(--control)',
                  minWidth: 'var(--control)',
                  background: on ? 'var(--hope)' : 'var(--raised)',
                  color: on ? 'var(--app)' : 'var(--muted)',
                }}
              >
                d{sides}
              </button>
            );
          })}
          {/* The DIFF input's shape exactly: 58px and the control height. It is
              a modifier a player reads off a card, so it wants the same target
              and the same numeric keyboard as the other number on this screen
              that is copied from somewhere else. */}
          <label className="row" style={{ flex: 'none', gap: 4, alignItems: 'center' }}>
            <span className="t-meta">MOD</span>
            <input
              type="number"
              inputMode="numeric"
              value={modifier === 0 ? '' : modifier}
              placeholder="—"
              onChange={(e) =>
                arming.setSpellModifier(e.target.value === '' ? 0 : Number(e.target.value))
              }
              style={{
                width: 58,
                minHeight: 'var(--control)',
                padding: '4px 6px',
                textAlign: 'center',
                font: '600 13px/1 var(--mono)',
              }}
            />
          </label>
        </div>
      ) : (
        <span className="t-dense">
          {zeroNote === null
            ? 'A Spellcast trait of +0 or lower rolls no damage dice.'
            : `“${zeroNote}”`}
        </span>
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
function Items({ bare = false }: { bare?: boolean } = {}): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const [open, setOpen] = useState<number | null>(null);
  if (!character) return null;

  const carried = character.inventory;

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      {!bare && (
        <div className="spread" style={{ flex: 'none' }}>
          <span className="t-label">Carried</span>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {carried.length} {carried.length === 1 ? 'ITEM' : 'ITEMS'}
          </span>
        </div>
      )}
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
              {/*
               * P3-9(b). This used to be a button always, `disabled` when the
               * item had no note - so for a rope with no printed text the only
               * thing on the row carrying its name was a control a screen
               * reader skips, and the row announced as one button called
               * "USE". A name is not a control. When there is something to
               * expand it is a button; when there is not it is text.
               */}
              {entry.note === undefined ? (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    font: '600 14px/1.2 var(--sans)',
                  }}
                >
                  {entry.name}
                  {entry.quantity > 1 && (
                    <span className="t-meta" style={{ marginLeft: 7, color: 'var(--muted)' }}>
                      ×{entry.quantity}
                    </span>
                  )}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(showing ? null : i)}
                  aria-expanded={showing}
                  aria-label={`${entry.name} — ${showing ? 'hide' : 'show'} what it does`}
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
              )}
              {!spent && (
                <button
                  type="button"
                  className="chip"
                  // Five carried items used to announce as five buttons called
                  // "USE". The name is what tells them apart, and it is the
                  // only thing a person listening has.
                  aria-label={`Use one ${entry.name}${entry.quantity > 1 ? `, ${String(entry.quantity)} left` : ', the last one'}`}
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

/**
 * The vault.
 *
 * Two shapes. On a desktop it is a shelf - one scrollable row, because the
 * vault is something you reach along and the loadout beside it needs the
 * vertical space its cards want. On a phone a shelf is the wrong object
 * entirely: a level 8 character owns a dozen cards, a horizontal scroller
 * inside a vertical one is a gesture nobody wins, and the vault had never been
 * on a phone at all - it was defined here and called only from `PlayDesktop`.
 * So the phone gets rows, in a fold, with the recall as its own control.
 *
 * P3-9(a) is fixed in both. A card that cannot be recalled used to say why in
 * a `title` attribute and fade to 55% opacity, and a touchscreen has no hover:
 * the player saw a dimmed card, tapped it, and got the card reader instead of
 * a recall with no explanation of either. Now the reason is printed where the
 * cost would be, which is the same trade `ExperienceChip` already makes one
 * file over - NO HOPE in place of the bonus rather than a chip greyed to
 * 1.72:1 and left to be guessed at.
 */
function Vault({ layout = 'shelf' }: { layout?: 'shelf' | 'rows' }): React.JSX.Element | null {
  const character = useActive();
  const { vault, ghostVault } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const recall = useRecall();
  /*
   * The one card waiting for its second tap, if any. One at a time: arming a
   * second card must put the first one down, or the vault ends up with two
   * primed controls and no way to tell which one a thumb is over.
   */
  const [armed, setArmed] = useState<string | null>(null);
  if (!character) return null;

  if (layout === 'rows') {
    return (
      <div className="stack" style={{ flex: 'none', gap: 4 }}>
        {vault.map((card) => {
          const check = canAddToLoadout(character, card);
          return (
            <div key={card.id} className="row" style={{ flex: 'none', gap: 6 }}>
              <button
                type="button"
                onClick={() => setOpenCard(card)}
                className="row"
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 52,
                  overflow: 'hidden',
                  borderRadius: 'var(--r3)',
                  background: 'var(--app)',
                  border: '1px solid var(--line-soft)',
                  borderLeft: `4px solid var(--${card.domain})`,
                  gap: 10,
                  padding: '0 11px',
                  textAlign: 'left',
                }}
              >
                <DomainMark domain={card.domain} size={15} shapes={shapes} />
                <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      font: '600 14px/1.1 var(--sans)',
                      color: 'var(--text-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.name}
                  </span>
                  <span className="t-meta" style={{ marginTop: 3, letterSpacing: '0.09em' }}>
                    {card.domain.toUpperCase()} · LV{card.level}
                  </span>
                </span>
              </button>
              <RecallButton
                card={card}
                check={check}
                armed={armed === card.id}
                onArm={() => setArmed(card.id)}
                onRecall={() => {
                  setArmed(null);
                  recall(card);
                }}
              />
            </div>
          );
        })}
        {/* A vault ghost has nowhere to be moved to, so it is a readout: it is
            here so the count above the fold and the rows under it agree. */}
        {ghostVault.map((refId) => (
          <GhostRow key={refId} refId={refId} />
        ))}
        {vault.length === 0 && ghostVault.length === 0 && (
          <div className="panel t-dense" style={{ padding: 14, color: 'var(--dim)' }}>
            The vault is empty. Cards you own but are not carrying live here.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ flex: 'none', gap: 6 }}>
      <div className="spread" style={{ flex: 'none' }}>
        <span className="t-label">Vault</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {vault.length + ghostVault.length} INACTIVE · SWAP COSTS RECALL IN STRESS
        </span>
      </div>
      <div
        className="row"
        style={{ gap: 8, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2 }}
      >
        {ghostVault.map((refId) => (
          <span
            key={refId}
            className="row"
            style={{
              flex: 'none',
              minHeight: 44,
              maxWidth: 190,
              borderRadius: 'var(--r3)',
              border: '1px dashed var(--edge)',
              gap: 8,
              padding: '0 10px',
            }}
          >
            <span className="t-meta" style={{ color: 'var(--damage)' }}>
              NOT IN BUILD
            </span>
            <span
              className="t-meta"
              style={{
                color: 'var(--dim)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {refId}
            </span>
          </span>
        ))}
        {vault.map((card) => {
          const check = canAddToLoadout(character, card);
          const needsHp = check.allowed && !check.affordable;
          const primed = armed === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (!check.allowed) {
                  setOpenCard(card);
                  return;
                }
                if (needsHp && !primed) {
                  setArmed(card.id);
                  return;
                }
                setArmed(null);
                recall(card);
              }}
              className="row"
              aria-label={
                !check.allowed
                  ? `${card.name} - ${check.reason ?? 'cannot be recalled'}`
                  : primed
                    ? `Confirm: recall ${card.name} and mark ${String(check.hpCost)} HP`
                    : needsHp
                      ? `Recall ${card.name} - no Stress left, so it would mark ${String(check.hpCost)} HP`
                      : `Recall ${card.name} for ${String(check.stressCost)} Stress`
              }
              style={{
                flex: 'none',
                minHeight: 44,
                maxWidth: 190,
                borderRadius: 'var(--r3)',
                background: primed ? 'var(--fear-wash)' : 'var(--app)',
                border: `1px solid ${primed ? 'var(--damage)' : 'var(--line-soft)'}`,
                gap: 8,
                padding: '0 10px',
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
              {/* The reason, in place of the level. Not a title attribute and
                  not 55% opacity: both of those are the app knowing something
                  the player cannot read. The same slot carries the Hit Points
                  a recall with no Stress left would cost. */}
              <span
                className="t-meta"
                style={{
                  flex: 'none',
                  color: check.allowed && !needsHp ? undefined : 'var(--damage)',
                }}
              >
                {!check.allowed
                  ? shortReason(check.reason)
                  : primed
                    ? `MARK ${check.hpCost} HP?`
                    : needsHp
                      ? `${check.hpCost} HP`
                      : `LV${card.level}`}
              </span>
            </button>
          );
        })}
        {vault.length === 0 && ghostVault.length === 0 && (
          <span className="t-dense" style={{ color: 'var(--dim)' }}>
            The vault is empty.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * RECALL, as a control shaped like one.
 *
 * It carries the cost, and when the cost cannot be paid it carries the reason
 * instead of the cost - the same substitution `ExperienceChip` makes for NO
 * HOPE. A disabled button with the word RECALL still on it says the app could
 * do this and will not, rather than that something is in the way.
 *
 * P1-2 is the second face. When the Stress track is full the recall is still
 * offered - whether a recall is a "move" under the Stress rule is a table
 * ruling, and the Recall Cost text is not in the shipped rules layer, so the
 * app cannot cite a rule it would be enforcing - but it is not taken on one
 * tap. The first tap arms it and the button says what it is about to spend,
 * in Hit Points, in `--damage`; the second takes it.
 */
function RecallButton({
  card,
  check,
  armed,
  onArm,
  onRecall,
}: {
  card: DomainCard;
  check: SwapCheck;
  /** This card is the one waiting for its second tap. */
  armed: boolean;
  onArm: () => void;
  onRecall: () => void;
}): React.JSX.Element {
  const needsHp = check.allowed && !check.affordable;
  const hp = `${String(check.hpCost)} HP`;

  const label = !check.allowed
    ? `${card.name} cannot be recalled: ${check.reason ?? 'unavailable'}`
    : armed
      ? `Confirm: recall ${card.name} and mark ${hp}`
      : needsHp
        ? `Recall ${card.name} - no Stress left, so it would mark ${hp}`
        : `Recall ${card.name} for ${String(check.stressCost)} Stress`;

  return (
    <button
      type="button"
      onClick={() => (needsHp && !armed ? onArm() : onRecall())}
      disabled={!check.allowed}
      aria-label={label}
      className="stack"
      style={{
        flex: 'none',
        // Wider once it is armed: "MARK 2 HP" and "TAP AGAIN" both have to be
        // readable in one line each, and a target that grows under the thumb
        // grows away from its neighbour rather than over it.
        minWidth: armed ? 104 : 72,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        borderRadius: 'var(--r3)',
        background: armed ? 'var(--fear-wash)' : check.allowed ? 'var(--raised)' : 'transparent',
        border: `1px solid ${armed ? 'var(--damage)' : check.allowed ? 'var(--line)' : 'var(--line-soft)'}`,
        padding: '0 8px',
      }}
    >
      {!check.allowed ? (
        <span className="t-meta" style={{ color: 'var(--damage)', textAlign: 'center' }}>
          {shortReason(check.reason)}
        </span>
      ) : armed ? (
        <>
          <span className="t-meta" style={{ color: 'var(--damage)', fontWeight: 700 }}>
            MARK {hp}
          </span>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            TAP AGAIN
          </span>
        </>
      ) : (
        <>
          <span className="t-meta" style={{ color: 'var(--text)', fontWeight: 700 }}>
            RECALL
          </span>
          <span
            className="t-meta"
            style={{ color: needsHp ? 'var(--damage)' : 'var(--stress)' }}
          >
            {needsHp ? hp : `COST ${check.stressCost}`}
          </span>
        </>
      )}
    </button>
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
function LoadoutRows(): React.JSX.Element {
  const { loadout, ghostLoadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const update = useApp((s) => s.update);

  return (
    <>
      {loadout.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => setOpenCard(card)}
          className="row"
          style={{
            flex: 'none',
            minHeight: 46,
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
          {/* COST, not RECALL: this row has no recall on it - the card is
              already in the loadout - and the number is what putting it back
              would cost. The word RECALL belongs to the control in the vault
              that does the thing. */}
          <span style={{ flex: 'none', textAlign: 'right' }}>
            <span className="t-meta" style={{ display: 'block' }}>
              COST
            </span>
            <span style={{ font: '800 15px/1 var(--sans)', marginTop: 3, display: 'block' }}>
              {card.recallCost}
            </span>
          </span>
        </button>
      ))}
      {ghostLoadout.map((refId) => (
        <GhostRow
          key={refId}
          refId={refId}
          onVault={() => update((c) => vaultCard(c, refId))}
        />
      ))}
      {loadout.length === 0 && ghostLoadout.length === 0 && (
        <div className="panel t-dense" style={{ padding: 14, color: 'var(--dim)' }}>
          No cards in the loadout yet. Add some in Cards.
        </div>
      )}
    </>
  );
}

/**
 * The three-column cockpit, at 1180px and up.
 *
 * It used to take a `columns` prop and draw a two-column variant for the
 * 720-1179px band. That variant is gone with the band: everything under
 * 1180px now runs the one-column sheet, which is both what the tablet
 * measurements asked for and the end of a layout nobody could roll in.
 */
function PlayDesktop({ stats, trait, chooseTrait, arming }: ViewProps): React.JSX.Element {
  const character = useActive();
  const { loadout, ghostLoadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const update = useApp((s) => s.update);
  // The number the gate uses, not the number that happened to resolve.
  const held = loadout.length + ghostLoadout.length;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 336px) minmax(360px, 428px) 1fr',
        gap: 18,
        padding: '18px 20px 20px',
      }}
    >
      <div className="stack scroll" style={{ gap: 14, minHeight: 'var(--control)', minWidth: 0 }}>
        <Beastform stats={stats} layout="desktop" />
        <Identity />
        <TraitGrid stats={stats} trait={trait} onPick={chooseTrait} />
        <Defenses stats={stats} />
        <Equipped stats={stats} arming={arming} />
        {/* Last, and in this column rather than one of the other two, because
            this column is the one that scrolls: a fold measuring about 990px
            open costs the cockpit nothing here and would cost it everything
            anywhere else. `cryptoRng` is passed rather than defaulted so that
            the one place a rest can roll is visible from this file. */}
        <Rest stats={stats} rng={cryptoRng} />
      </div>

      <div className="stack" style={{ gap: 12, minHeight: 'var(--control)', minWidth: 0 }}>
        <Vitals stats={stats} layout="desktop" />
        <DualityRoll
          stats={stats}
          trait={trait}
          onTraitChange={chooseTrait}
          source={arming.source}
          layout="desktop"
        />
      </div>

      <div className="stack" style={{ gap: 10, minHeight: 'var(--control)', minWidth: 0 }}>
        <div className="spread" style={{ flex: 'none' }}>
          <span className="t-label">Loadout</span>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {held} / 5 ACTIVE
          </span>
        </div>
        {/* The grid owns the height, and the cards fill their cell. Fixing a
            card height instead pushes the vault off the bottom of the screen
            on a 900px display, which is the one thing Play must never do. */}
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
                    <span className="t-meta">COST</span>
                    <span style={{ font: '800 13px/1 var(--sans)' }}>{card.recallCost}</span>
                  </span>
                </>
              }
            />
          ))}
          {/* A slot filled by a card this build cannot read. It gets a cell
              rather than nothing, because the gate is already counting it. */}
          {ghostLoadout.map((refId) => (
            <div
              key={refId}
              className="stack"
              style={{
                minHeight: 0,
                justifyContent: 'center',
                gap: 8,
                borderRadius: 'var(--r4)',
                border: '1px dashed var(--edge)',
                padding: 12,
              }}
            >
              <span className="t-meta" style={{ color: 'var(--damage)' }}>
                CARD NOT IN THIS BUILD
              </span>
              <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
                {refId}
              </span>
              <button
                type="button"
                className="t-meta"
                onClick={() => update((c) => vaultCard(c, refId))}
                aria-label={`Move the unreadable card ${refId} to the vault, freeing its slot`}
                style={{
                  minHeight: 'var(--control)',
                  letterSpacing: '0.1em',
                  color: 'var(--text)',
                  textAlign: 'left',
                }}
              >
                TO VAULT
              </button>
            </div>
          ))}
          {held < 5 && (
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
                {5 - held} SLOT{5 - held === 1 ? '' : 'S'} FREE
                <br />
                RECALL FROM THE VAULT
              </span>
            </div>
          )}
        </div>
        <Vault />
      </div>
    </div>
  );
}

/**
 * The phone screen: the whole character sheet, in the sheet's own order.
 *
 * It used to render nine things and leave four out. Identity, the trait grid,
 * the defences and the vault were defined in this file and called only from
 * `PlayDesktop`, so on the width the README says is used ninety per cent of the
 * time the app did not show Evasion, the damage thresholds - except as 10px
 * `--dim` text beside a damage input - Proficiency, the class, the subclass,
 * the ancestry, the community, the vault, or the gold. Nothing was broken.
 * Four sections of the character sheet were simply absent.
 *
 * The order below is the printed sheet's, reflowed to one column: identity,
 * the defence band, the traits with their verbs, the counters, weapons and
 * armour, the cards, what you are carrying, gold, conditions, lineage. Read
 * top to bottom it is the same document the player has in front of them on
 * paper, which is the only ordering nobody has to learn.
 *
 * Two things are not in that order, and both are ergonomic rather than
 * editorial.
 *
 *   - A worn Beastform leads. It changes what every number under it means, and
 *     a state banner nobody scrolls to is a state banner nobody reads. It
 *     draws nothing the rest of the time.
 *   - The roll block is pinned to the bottom, outside the scroll: the trait
 *     chips and ROLL, plus the death move when it is offered. Those are
 *     touched on every single action, and a control you have to go looking for
 *     is a control that stops being used.
 *
 * Everything else scrolls, and five sections fold. A closed section costs one
 * 44px row, which is what makes "the whole sheet at once" fit at all: the
 * stack measures about 1290px fully open on a 393px phone against a scroll
 * window of 457, and about 900 with the vault, the carried items and the
 * lineage folded away.
 *
 * The fifth fold is the rest surface, added after those numbers were taken. It
 * costs 54px closed - a 44px header plus this column's 10px gap - and nothing
 * at all from the pinned block, which is still 266px with two Experiences and
 * 316 with five, so the folded stack goes to about 954 and the scroll window
 * stays 457. Opened onto a long rest it adds about 1,240 more, taking the
 * fully open stack to roughly 2,530. The scroll got longer; nothing else
 * moved, which is the whole reason it is here and not in the block under the
 * thumb.
 */
function PlayPhone({ stats, trait, chooseTrait, arming }: ViewProps): React.JSX.Element {
  const character = useActive();
  const { loadout, vault, ghostLoadout, ghostVault } = useLoadout();
  const index = useApp((s) => s.index);
  if (!character) return <div />;

  const equippedCount = [
    character.activePrimaryWeapon,
    character.activeSecondaryWeapon,
    character.activeArmor,
  ].filter((r) => r !== null && index.byRef.has(r)).length;
  const carried = character.inventory.length;

  return (
    /*
     * The outer column scrolls only as a last resort.
     *
     * Pinning the roll block is right until it does not fit, and a floor stops
     * the scrolling region absorbing every shortfall the way the loadout used
     * to. Two rows of something is the least that can be called a region
     * rather than a slot; below that the page itself takes up the slack. On
     * both reference phones the outer scroller never engages: the roll block
     * is 266px with two Experiences and 316px with five, against 731px at
     * 393x852 and 546px at 375x667.
     */
    <div
      className="stack"
      style={{ flex: 1, minHeight: 0, padding: '0 12px 8px', gap: 8, overflowY: 'auto' }}
    >
      <div
        className="stack scroll scroll-fade"
        style={{ flex: '1 1 auto', minHeight: 88, gap: 10, overflowX: 'hidden' }}
      >
        {/* A worn Beastform changes what every number under it means, so it
            leads: a state banner nobody scrolls to is a state banner nobody
            reads. It renders nothing when no form is worn. */}
        <Beastform stats={stats} layout="phone" />

        <Identity showLineage={false} />

        {/* Read under pressure, so it is four numbers and not a footnote. */}
        <Defenses stats={stats} />

        <TraitGrid stats={stats} trait={trait} onPick={chooseTrait} />

        {/* The four counters, and under them the incoming-damage calculator -
            which is a question rather than a state ("someone hit you for 14,
            how many HP is that") and whose answer lands on the two tracks
            directly above it. */}
        <Vitals stats={stats} layout="phone" showState={false} />

        <Disclosure
          id="equipped"
          characterId={character.id}
          label="Weapons & armour"
          /*
           * What is armed rides on the closed header, the way the modifier
           * row's does. A declaration you cannot see is not a declaration, and
           * this fold can be shut with a sword armed - after which the only
           * thing on screen saying which weapon the damage offer belongs to
           * would be behind a tap.
           */
          summary={
            arming.source !== null
              ? `ARMED · ${sourceName(arming.source).toUpperCase()}`
              : equippedCount === 0
                ? 'NOTHING'
                : `${equippedCount} WORN`
          }
          defaultOpen
        >
          <Equipped stats={stats} arming={arming} bare />
        </Disclosure>

        {/*
         * The cards.
         *
         * They are the answer to "what can I do", which is the question a
         * player asks on every turn of their own, so the loadout opens by
         * default.
         */}
        <Disclosure
          id="loadout"
          characterId={character.id}
          label="Loadout"
          // The gate counts every ref, readable or not, so this does too: a
          // header saying 3 / 5 over a recall that refuses with "Loadout is
          // full (5)" is the screen contradicting itself.
          summary={`${loadout.length + ghostLoadout.length} / 5`}
          defaultOpen
        >
          <div className="stack" style={{ flex: 'none', gap: 4 }}>
            <LoadoutRows />
          </div>
        </Disclosure>

        {/*
         * The vault is a second fold rather than part of the first.
         *
         * A level 8 character owns about a dozen cards and carries five, so
         * folding the two together would mean opening twelve rows to look at
         * the five you are holding - which is the opposite of what the fold is
         * for. Closed by default for the same reason: recalling is a downtime
         * decision most of the time, and the loadout is a turn-by-turn one.
         */}
        <Disclosure
          id="vault"
          characterId={character.id}
          label="Vault"
          summary={`${vault.length + ghostVault.length} INACTIVE`}
        >
          <Vault layout="rows" />
        </Disclosure>

        {/*
         * A rest is between-scenes work, so it sits below everything the game
         * makes you touch during a scene - the counters, the weapons, the
         * cards - and above the two sections read once a session. Directly
         * under the vault, because the free swap it offers is the vault's own
         * operation at the other price.
         */}
        <Rest stats={stats} rng={cryptoRng} />

        <Disclosure
          id="carried"
          characterId={character.id}
          label="Carried"
          summary={`${carried} ${carried === 1 ? 'ITEM' : 'ITEMS'}`}
        >
          <Items bare />
        </Disclosure>

        <GoldRow />

        {/* Conditions are set once a scene rather than once a turn. */}
        <ActiveConditions />

        <Disclosure id="lineage" characterId={character.id} label="Lineage & domains">
          <Lineage stats={stats} />
        </Disclosure>
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

        <div
          className="row"
          style={{ gap: 4, overflowX: 'auto', flex: 'none', scrollbarWidth: 'none' }}
        >
          {TRAITS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => chooseTrait(t)}
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
        <DualityRoll
          stats={stats}
          trait={trait}
          onTraitChange={chooseTrait}
          source={arming.source}
          layout="phone"
        />
      </div>
    </div>
  );
}
