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
 * Nothing on it is pinned, either, and that reversal is younger still. The
 * trait chips and ROLL sat in a fixed block at the bottom until the order
 * changed underneath them: with the counters and the thresholds moved to the
 * top where Giorgio's message puts them, the Experiences and the modifier row
 * moved out from above ROLL, and - since the reflow - the identity block off
 * the phone entirely, ROLL's own lower edge lands **444px** above the fold at
 * 393x852 and **259px** above it at 375x667 without a pin, so the block was
 * buying a reach the order already provides and charging 266px for it. This
 * paragraph carried "195px and 10px" for two passes against assertions of 345
 * and 160, which is exactly the habit `playSheet.test.tsx` exists to break:
 * `PlayPhone`'s docblock carries the arithmetic and that file carries every
 * number of it as an assertion, and these two are derived from the same table.
 *
 * Two layouts, at one breakpoint rather than two.
 *
 *   Below 1180px - every phone and every tablet - the sheet is one scrolling
 *   column in Giorgio's order, with nothing outside the scroll. `PlayPhone`.
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
import { Disclosure, usePlaySection } from '../shared/Disclosure.tsx';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { useLayout } from '../shared/useLayout.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
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
import { ActiveConditions, ConditionsControl } from './Conditions.tsx';
import { DeathMoveOffer } from './DeathMove.tsx';
import { DualityRoll, ExperienceRow, type RollTrait } from './DualityRoll.tsx';
import { shortReason, useRecall } from './recall.ts';
import { Rest } from './Rest.tsx';
import { spellcastZeroNote, traitVerbs } from '../shared/ruleText.ts';
import { IncomingDamage, Vitals } from './Vitals.tsx';

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
   * The Experiences declared for the next roll.
   *
   * Here rather than inside `DualityRoll`, where they used to live, because
   * the fold that holds the chips on a phone is below ROLL and is drawn by
   * `PlayPhone` - so the component that owns the state and the component that
   * draws the control are no longer the same one. It also puts the third
   * declaration beside the other two, under one clearing rule instead of two.
   */
  const [armedExperiences, setArmedExperiences] = useState<string[]>([]);

  /*
   * A declaration belongs to the sheet that made it.
   *
   * `App` renders `<Play />` unkeyed, so the header's character picker swaps
   * the character underneath a component that keeps every piece of its own
   * state - and the armed attack was one of them. Switch sheets mid-turn and
   * the arriving character was already holding somebody else's axe, with a
   * trait chip somebody else had picked, ready to roll damage nobody had
   * declared. `DualityRoll`'s own `[characterId]` effect clears the resolved
   * result and the armed attack on this same key; neither could help on its
   * own, because the declaration behind them was still live here and the very
   * next roll re-armed from it.
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
    // An Experience left armed across a switch costs the arriving player a
    // Hope and inflates their first roll by two, with nothing on the screen
    // saying where the number came from.
    setArmedExperiences([]);
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
   * Three surfaces set the trait when this route was written - a strip of chips
   * in the block that was pinned then, the trait grid inside the scroll, and the
   * SPELLCAST chip in the modifier row - and only the chips put the armed weapon
   * down. The other two left it standing, so tapping KNOWLEDGE on a tile kept a
   * sword declared for a Knowledge check with nothing on screen disagreeing with
   * anything else.
   *
   * A phone has two of those surfaces now rather than three: the chips and the
   * grid were the same six traits drawn twice, and `TraitRow` is the one row
   * that replaced them both. This route is unchanged by that, because the rule
   * it enforces is about the tap and not about which surface took it.
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
  const view = {
    stats,
    trait,
    chooseTrait,
    arming,
    armedExperiences,
    setArmedExperiences,
  };
  if (layout !== 'desktop') return <PlayPhone {...view} />;
  return <PlayDesktop {...view} />;
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
  /** The Experiences declared for the next roll, and the one way to set them. */
  armedExperiences: string[];
  setArmedExperiences: (ids: string[]) => void;
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
 * Who this is - and since the reflow, the desktop cockpit only.
 *
 * The `stats` prop this used to take was never read - `--noUnusedLocals` does
 * not see an unused destructured prop, so it sat there through every edit
 * looking load-bearing. `showLineage` went the same way in this commit rather
 * than surviving as a `false` nobody passes.
 *
 * THE PHONE DOES NOT DRAW THIS AT ALL, WHICH IS DECISION 2 OF THE REFLOW. 99px
 * of a 730px column - 21 for the name, 7 + 10 for the pronouns and level, 9 + 44
 * for the class row, and the column's own 8px gap - spent on four facts, three
 * of which `Header.tsx` already prints on *every* screen: the name (or the
 * character `<select>` when there are two), and `CLASS / MULTICLASS · LVn`. The
 * sheet was saying them a second time, 53px below the first.
 *
 * THE TWO IT DOES NOT DUPLICATE ARE THE PRONOUNS AND THE SUBCLASS, AND THEY ARE
 * NOT DELETED. `Header.tsx` joins `classRef` and `multiclassRef` and deliberately
 * not `subclassRefs`, and the pronouns exist nowhere in the chrome. Both moved
 * into the `Lineage & domains` fold, which is shut in the budget and therefore
 * costs the column nothing - see `Lineage` below, which now opens on the same
 * two lines this block drew. That is the whole of decision 2's honesty: nothing
 * left the sheet, one thing left the *resting* sheet and is one tap away.
 *
 * THE RENAME IS NOT HERE EITHER, AND THAT WAS DECISION 1. A 72x44 RENAME chip
 * used to sit at the right end of the class row, and the whole of P5-1(b)'s
 * argument was about where to put a target beside a name without making the name
 * one. There is no target here at all now on the desktop: the one door to a
 * rename is `Edit.tsx`'s `<RenameField commitOnBlur />` in Build's Identity
 * section, and `RenameField`'s own docblock says what that costs. The class row
 * has no 44px child in the cockpit, so it collapses to the 18.9px class line -
 * 25px back to a column whose roll panel this repo has measured crushed to 45px
 * at 744x1133.
 *
 * The name line stays a `<div>`. P5-1(b)'s first bullet forbids "a name at the
 * top of a scrolling screen that opens a keyboard when a thumb brushes it": the
 * failure it describes requires the name itself to be the target, so the name
 * carries no `role`, no `tabIndex`, no handler and no wrapping `<button>`. The
 * cockpit does not scroll and has a mouse, so the bullet is not what binds here
 * any more - it is kept because there is one component and the phone's rule is
 * the stricter of the two.
 */
function Identity(): React.JSX.Element | null {
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
        {/*
         * `.t-meta`, and that is a 9px fix rather than a tidy-up. Bare, this
         * span had no type class and `base.css` sets no `font-size` on `body`,
         * so a middle dot between two 10px mono labels rendered at the user
         * agent's own 16px - and because `.row` is `align-items: center`, the
         * *row* was as tall as the dot: 19px where the labels beside it are 10.
         * Identity's own docblock has been costing this band at 10 since it was
         * written.
         */}
        {character.pronouns !== '' && (
          <span className="t-meta" style={{ color: 'var(--line)' }}>
            ·
          </span>
        )}
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          LEVEL {character.level}
        </span>
      </div>
      {/*
       * The class row. `marginTop: 9` is the row's own margin, and it is the
       * one thing left of the wrapper that used to swap the class line for a
       * rename editor: with the editor gone there is one content, so the
       * wrapper and the row are one element again. It is `.row` and not a bare
       * div because the conditions door stood in it until decision 3 moved the
       * door into the defence band, and the class line keeps its `flex: 1,
       * minWidth: 0` so a two-class string still truncates rather than pushing
       * the cockpit's first column wide.
       */}
      <div className="row" style={{ marginTop: 9, gap: 8 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            font: '600 14px/1.35 var(--sans)',
            color: 'var(--text-2)',
          }}
        >
          {klass === '' ? 'No class' : klass}
          {subclass !== '' && ` — ${subclass}`}
        </div>
      </div>
      {lineage !== '' && (
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
 *
 * "Domini, ancestry, community. In ordine inverso forse. XD" - and the reason
 * is in the joke. A character sheet leads with ancestry because that is the
 * order you build a character in. By the time you are playing, the ancestry is
 * the thing you already know and the domain is the thing you look up: it says
 * which cards you may take and to what level, and `cardLevelCap` is the one
 * number in this fold that answers a question asked mid-scene. So the domains
 * lead and the ancestry and community follow them.
 *
 * THE PRONOUNS AND THE SUBCLASS ARE HERE BECAUSE DECISION 2 TOOK THE IDENTITY
 * BLOCK OFF THE PHONE, AND THEY HAD NOWHERE ELSE. `Header.tsx` prints the name
 * and `CLASS / MULTICLASS · LVn` on every screen, so those three survive the
 * deletion in the chrome - but it joins `classRef` and `multiclassRef` and
 * deliberately not `subclassRefs`, and it has never carried pronouns. Without
 * this line both would be on the Play screen nowhere at all, which is a
 * deletion nobody decided. They lead this fold rather than trailing it because
 * they are the "who" and the rest of the fold is the "where from"; the class
 * and level are repeated with them so the two lines read as a sentence rather
 * than as an orphaned subclass. Zero pixels of the budget: this fold is shut in
 * it, and a shut `Disclosure` renders no children at all.
 */
function Lineage({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  if (!character) return null;
  const lineage = lineageOf(character, index);
  // The same two joins the identity block made, and for the same reason: a
  // multiclassed character is two classes and two subclasses, and the line that
  // says who they are should say so.
  const klass = [character.classRef, character.multiclassRef]
    .map((r) => (r === null ? undefined : index.classes.get(r)?.name))
    .filter(Boolean)
    .join(' / ');
  const subclass = character.subclassRefs
    .map((r) => index.subclasses.get(r)?.name)
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="row" style={{ gap: 8 }}>
        {character.pronouns !== '' && (
          <span className="t-meta">{character.pronouns.toUpperCase()}</span>
        )}
        {character.pronouns !== '' && (
          <span className="t-meta" style={{ color: 'var(--line)' }}>
            ·
          </span>
        )}
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          LEVEL {character.level}
        </span>
      </div>
      <div style={{ font: '600 14px/1.35 var(--sans)', color: 'var(--text-2)' }}>
        {klass === '' ? 'No class' : klass}
        {subclass !== '' && ` — ${subclass}`}
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
      <div style={{ font: '400 13px/1.35 var(--sans)', color: 'var(--text-2)' }}>
        {lineage === '' ? 'No ancestry or community on this sheet.' : lineage}
      </div>
    </div>
  );
}

/**
 * The six traits as one row, with the verbs one tap behind it.
 *
 * This replaces two surfaces with one. The phone drew a 3x2 grid of tiles in
 * the scroll *and* a strip of six chips in the pinned block, both of which
 * armed the roll, and a player could see one of them saying AGI while the other
 * one was off screen. The tiles cost about 210px - a quarter of the glass on a
 * 393x852 phone - because each carried its three SRD verbs under the number.
 * Six chips cost 44.
 *
 * THE VERBS ARE NOT DELETED, AND THEY ARE NOT EVEN HIDDEN FROM EVERYONE. They
 * move behind a 44x44 control at the end of the same row, which costs no height
 * because the row is already 44 tall, and which remembers per character. And
 * they stay in every chip's accessible name WITH THAT CONTROL SHUT - "Agility
 * +1 - use it to Sprint, Leap, Maneuver" - so a screen-reader user loses
 * nothing at all and gains the 150px a sighted user gains.
 *
 * ERGONOMICS. Six chips at `flex: '1 1 46px'` with 4px between them is the
 * tightest target spacing on this screen, and I am not going to pretend it is
 * comfortable. Three things make it acceptable: it is exactly the arrangement
 * and exactly the gap the shipped pinned strip already used, so it is not a new
 * risk; a mis-tap arms a neighbouring trait, which is visible instantly - the
 * chip fills with `--hope` - and costs one tap to undo; and it spends nothing.
 * No Hope, no log line, no roll. Every costly mis-tap on this screen (ROLL,
 * RECALL, USE, the damage commit) has either a much bigger target or a second
 * tap. Content is about 341.6px against a 369px column at 393px and 351px at
 * 375px - "AGI +1" is 45.6px at `.chip`'s 9.5px mono with its tracking and 4px
 * of padding either side, six of those plus the 44px control plus six 4px gaps
 * - and the row carries `flexWrap: 'wrap'`, so an unforeseen width degrades to
 * a second 44px row rather than to clipped text.
 *
 * The space in "AGI +1" is load-bearing: `playSheet.test.tsx`'s `traitChip`
 * helper matches `^AGI [+−]`, and seven tests would change to save five pixels.
 */
function TraitRow({
  stats,
  trait,
  onPick,
  characterId,
}: {
  stats: DerivedStats;
  trait: RollTrait;
  /** Named for what it is, not for what it sets: the route, not the setter. */
  onPick: (t: RollTrait) => void;
  /** Whose arrangement the verbs control is remembered against. */
  characterId: string | null;
}): React.JSX.Element | null {
  const character = useActive();
  const rules = useApp((s) => s.dataset.rules);
  // Parsed once per dataset, not once per render: the rules body is 4KB of
  // prose and there are six chips reading the same answer out of it.
  const verbs = useMemo(() => traitVerbs(rules), [rules]);
  const [showVerbs, toggleVerbs] = usePlaySection(characterId, 'traitverbs');
  if (!character) return null;

  return (
    <div className="stack" style={{ flex: 'none', gap: 6 }}>
      <div className="row" style={{ flex: 'none', gap: 4, flexWrap: 'wrap' }}>
        {TRAITS.map((t: Trait) => {
          // stats.traits, not the character's own: a Beastform raises one of
          // these, and a chip that disagreed with the roll would be a lie.
          const value = stats.traits[t];
          const active = trait === t;
          const marked = (character.traitMarks[t] ?? 0) > 0;
          const raised = stats.beastform?.raised.some((r) => r.trait === t) === true;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onPick(t)}
              aria-pressed={active}
              /*
               * The verbs are in the name whether or not they are on the glass.
               * A chip reading "AGI +1" is announced as "A G I plus one", which
               * tells a listening user nothing about what Agility is for - and
               * that is precisely the gap the printed sheet fills with these
               * three words.
               */
              aria-label={
                verbs[t] === undefined
                  ? undefined
                  : `${TRAIT_LABELS[t]} ${value >= 0 ? '+' : '−'}${String(Math.abs(value))} - use it to ${verbs[t].join(', ')}`
              }
              className="chip"
              style={{
                position: 'relative',
                flex: '1 1 46px',
                minHeight: 'var(--tap)',
                justifyContent: 'center',
                padding: '0 4px',
                background: active ? 'var(--hope)' : 'var(--raised)',
                color: active ? 'var(--app)' : 'var(--muted)',
                // Carried over from the tile: sage for a trait a Beastform
                // raised, a washed --hope for the Spellcast trait, which is not
                // one of the six and has nowhere else to be named.
                borderBottom: `2px solid ${
                  raised
                    ? 'var(--sage)'
                    : stats.spellcastTrait === t
                      ? 'color-mix(in srgb, var(--hope) 30%, transparent)'
                      : 'transparent'
                }`,
              }}
            >
              {TRAIT_LABELS[t].slice(0, 3).toUpperCase()} {value >= 0 ? '+' : '−'}
              {Math.abs(value)}
              {marked && (
                <span
                  aria-label="marked this tier"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: active ? 'var(--app)' : 'var(--muted)',
                  }}
                />
              )}
            </button>
          );
        })}
        {/*
         * The verbs control. Square at the touch floor in both directions, and
         * `aria-expanded` because that is what it is - but deliberately not a
         * `Disclosure`, which is a full-width header by contract and would cost
         * the 44px row this whole component exists to save.
         */}
        <button
          type="button"
          aria-expanded={showVerbs}
          aria-label="What each trait is for"
          onClick={toggleVerbs}
          className="row"
          style={{
            flex: 'none',
            width: 44,
            minWidth: 44,
            minHeight: 'var(--tap)',
            justifyContent: 'center',
            borderRadius: 'var(--r3)',
            background: 'var(--raised)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              background: 'var(--muted)',
              clipPath: showVerbs
                ? 'polygon(0 25%,100% 25%,50% 100%)'
                : 'polygon(25% 0,100% 50%,25% 100%)',
            }}
          />
        </button>
      </div>
      {showVerbs && (
        <div className="stack" style={{ flex: 'none', gap: 5, padding: '2px 2px 0' }}>
          {TRAITS.map((t: Trait) =>
            verbs[t] === undefined ? null : (
              <div key={t} className="row" style={{ gap: 8 }}>
                <span className="t-meta" style={{ flex: 'none', width: 74, color: 'var(--text-2)' }}>
                  {TRAIT_LABELS[t].toUpperCase()}
                </span>
                <span className="t-meta" style={{ flex: 1, minWidth: 0, color: 'var(--dim)' }}>
                  {verbs[t].join(' · ').toUpperCase()}
                </span>
              </div>
            ),
          )}
          <div className="t-meta" style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>
            TAP A TRAIT TO ARM THE ROLL
            {stats.spellcastTrait !== null &&
              ` · ${TRAIT_LABELS[stats.spellcastTrait].toUpperCase()} IS SPELLCAST`}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The traits as six tiles, which is now the cockpit's shape and only its shape.
 *
 * The phone runs `TraitRow` instead: at 1180px and up the first column has
 * 300-336px and no tab bar under it, so 210px of tiles with their verbs printed
 * is a fair price for a surface a mouse hits accurately. At 393px it was a
 * quarter of the glass.
 */
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
 * The four numbers you are told under pressure, and - on a phone - the box you
 * are told a number into.
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
 *
 * `damage` adds the incoming-damage box as a fifth cell, phone only, and the
 * argument for it is that it was already reading these numbers - the box printed
 * `8/16` in 10px beside itself because it needed the ladder and could not see
 * it. Now the number you were told and the ladder you read it against are one
 * glance.
 *
 * `conditions` puts the phone's permanent conditions door at the head of that
 * same fifth cell, in place of the `TOOK` caption. That is decision 3 of the
 * reflow, and it is *inside* the fifth cell rather than beside it as a sixth
 * because a sixth does not fit at any phone width: the four cells and their four
 * gaps are 234.47, a fifth of 44 + 6 + 44 is 94, and a sixth of 44 plus a fifth
 * gap is 50 - 378.47 against 369px of column at 393.
 *
 * THE COLUMNS STOPPED BEING EQUAL, AND THAT IS THE FIRST COST. Four equal cells
 * plus the box do not fit: `EVASION` at `.t-meta` with this tracking measures
 * 47.61px, so at 9px of padding either side its cell wanted 67.61 with the
 * border, and four of those plus the box plus four 6px gaps overflowed even a
 * 393px phone. Sized to their contents instead, the four take their labels and
 * the box takes the remainder.
 *
 * THE PADDING IS 6 AND NOT 9, WHICH IS THE SECOND COST AND IS BOUGHT
 * DELIBERATELY. Three pixels a side off four readout cells is 24px of column,
 * and it is what stands the door and the field side by side at 360 - the
 * commonest Android width there has ever been - instead of wrapping them onto
 * two lines. Measured in Chrome with the `wizard10` fixture at `8px 6px`: the
 * four cells are 61.61 + 52.84 + 54.81 + 41.20 = 210.47 with the number at 32px,
 * so the fifth track is `column - 234.47` and the 94 it has to hold has 134.53
 * at 393, 116.53 at 375, 101.53 at 360 and 97.53 at 356. At `8px 9px` the same
 * pair had 93.53 at 360 and wrapped. Nothing in these four cells is a target -
 * they are four numbers you read - so the twelve pixels are spent on nothing a
 * finger has to find.
 *
 * The band's height is the four number cells: 8 + 10 label + 4 + 26 number + 8 +
 * 2 border = 58px. The door and the field are 44 inside that, so both ride for
 * free and the counters are 50px shorter for them.
 */
function Defenses({
  stats,
  damage = false,
  conditions = false,
}: {
  stats: DerivedStats;
  /** Draw the incoming-damage box as a fifth cell. Phone only. */
  damage?: boolean;
  /**
   * Put `ConditionsControl` at the head of that fifth cell. Phone only.
   *
   * A prop rather than a layout read, because this is not a layout question:
   * the cockpit draws a permanent conditions strip with its own door inside
   * `Vitals`, and a second door here would be two ways into one dialog on one
   * screen. The phone has no permanent strip - it is drawn only while something
   * is on - so this is the only way in that is always there.
   */
  conditions?: boolean;
}): React.JSX.Element {
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
        // being squeezed into 80px. With the damage box in, the four size to
        // their labels and the box takes the remainder - four equal cells plus
        // the box overflow even a 393px phone.
        //
        // The unreadable-armor shape grows a fourth track when the door is
        // here, because the door is the phone's only way into the conditions
        // and a sheet the app cannot read a ladder for is not a sheet that
        // stops being able to be Restrained. `auto` and not `1fr`: it holds one
        // 44px control and nothing else, and the sentence beside it is what
        // should have the room.
        gridTemplateColumns: unknownThresholds
          ? conditions
            ? '1fr 2fr 1fr auto'
            : '1fr 2fr 1fr'
          : damage
            ? 'auto auto auto auto 1fr'
            : 'repeat(4, 1fr)',
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
        <div className="panel stack" style={{ padding: '8px 6px', gap: 3, minWidth: 0 }}>
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
      {/* One gate, and it is not here: with the ladder unreadable this draws
          the door and no field on its own, and the template above has already
          given the band the shape that says why. Two components asking the same
          question is how they eventually answer it differently. */}
      {damage && (
        <IncomingDamage
          stats={stats}
          layout="band"
          door={conditions ? <ConditionsControl /> : undefined}
        />
      )}
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
      // 6px of horizontal padding, not 9: `Defenses`'s own note carries what
      // the twelve pixels buy and why a readout cell is where they come from.
      style={{ padding: '8px 6px', gap: 4, minWidth: 0, borderColor: tone }}
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
        // used to live here is exactly what the note in
        // sheetModel.ts::describeWeapon warns against - two routes to one
        // number is two numbers eventually, and this one had no clamp.
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
function PlayDesktop({
  stats,
  trait,
  chooseTrait,
  arming,
  armedExperiences,
  setArmedExperiences,
}: ViewProps): React.JSX.Element {
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
        {/*
          And the licence notice under it, in this column for the same reason
          `Rest` is in this column: it is the only one of the three that
          scrolls. The cockpit itself is laid out to fit, so there is no "end of
          the page" anywhere else on this screen - the middle column ends at
          ROLL and the right one at the vault, both of which are meant to be on
          the glass at all times. A 342-character paragraph under either of
          those would be a pinned strip by another name.
        */}
        <LicenceFooter />
      </div>

      <div className="stack" style={{ gap: 12, minHeight: 'var(--control)', minWidth: 0 }}>
        <Vitals stats={stats} layout="desktop" />
        <DualityRoll
          stats={stats}
          trait={trait}
          onTraitChange={chooseTrait}
          source={arming.source}
          layout="desktop"
          armedExperiences={armedExperiences}
          onArmedExperiencesChange={setArmedExperiences}
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
 * The phone screen: the whole character sheet, in one column, in Giorgio's
 * order, with nothing pinned.
 *
 * THE ORDER, AND WHOSE IT IS. "Metterei le stat in alto, i counter Hope,
 * armour (e threshold bene in vista) stress e hp, sotto armi e armature e
 * ultime le carte." The four defence numbers, the four counters, the traits,
 * ROLL, and then the folds: weapons and armour, the Experiences, what you are
 * carrying, the cards with the vault inside them, the rest, and last the
 * lineage with its domains first. Measured on the owner's phone at 393x852 the
 * shipped build put the identity block, RENAME, the defence band, six trait
 * tiles with their verbs and the pinned roll block above the fold - and HP,
 * Stress, Hope and Armor, the four counters the message puts second, were not
 * on the screen at all. The order that was asked for was never delivered on a
 * phone.
 *
 * THE IDENTITY BLOCK IS NOT THE FIRST THING HERE ANY MORE, AND THAT IS DECISION
 * 2. 99px - 21 for the name, 7 + 10 for the pronouns and level, 9 + 44 for the
 * class row, and this column's own 8px gap - spent on four facts, three of which
 * `Header.tsx` prints 53px higher up on *every* screen: the name (or the
 * character `<select>`), and `CLASS / MULTICLASS · LVn`. The two it does not
 * duplicate are the pronouns and the subclass, and they are not deleted: both
 * moved into the shut `Lineage & domains` fold, where they cost this budget
 * nothing. So the band leads the column, which is also where "threshold bene in
 * vista" wanted it.
 *
 * NOTHING IS PINNED, AND THE ARITHMETIC IS THE WHOLE WARRANT FOR THAT. P5-1
 * decided the block stays because "a control you have to scroll to find is a
 * control that stops being used", and that reasoning is sound and its
 * conclusion is now reversed, because its premise moved. Against declared
 * heights at 393x852, every fold shut and nothing armed: the defence band 58 -
 * which carries the incoming-damage field *and* the conditions door as its
 * fifth cell, for nothing, because two 44px controls fit inside a row the
 * numbers already hold open at 58 - the four counters 94 as a 2x2 grid, the
 * trait row 44, and the roll row 66, ROLL beside a MODS control that costs the
 * column nothing because it is 44 wide inside a height ROLL was already
 * holding, plus three of this column's 8px gaps. **ROLL's lower edge lands at
 * 286 of a usable 730** (852 less the header's 52+1, the tab bar's 60+1 and
 * this root's own 8px foot), which is 444px of slack.
 *
 * AT 375x667 THE SAME 286 CLEARS A 545px COLUMN BY 259px, where before the
 * counters became a grid it cleared it by ten. Not one of the ordinary states
 * this budget cannot see costs the small phone its margin: typed dice, which
 * are the dearest of them at **+68**, a companion (+50), a Beastform banner
 * (+52), an armed modifier (+50), and the 34px home-indicator inset. There used
 * to be a sixth and it used to be the dearest - pips, at +100 - and decision 7
 * deleted `counterStyle`, its switch and every branch on it, so the 194px shape
 * is not reachable from this screen on any layout. The four counters are numbers
 * here and in the cockpit; pips survive on the party board, the live scene and
 * the companion, where you are reading somebody else's state rather than marking
 * your own.
 *
 * AND THE WHOLE FOLDED SHEET FITS, WHICH IT DID NOT UNTIL P5-8 AND NOW FITS
 * TWICE OVER. **598px against 730 at 393x852, with 132 to spare** - every fold
 * shut, the `playedCharacter` fixture. That is the condition P5-5's own decision
 * 1 made the unpinning conditional on, unmet through P5-5 (899, over by 169) and
 * P5-6 (749, over by 19), met at P5-8 (697, 33 to spare) and now clear by 132.
 * It fits at 744x1133 with 474 to spare, and it is **53px over at 375x667** -
 * which is one fold header and a gap, where it was three.
 *
 * P5-8's last 52 came from the conditions and from nowhere else, and the shape
 * of that saving survives this reflow with a different door. Nothing is drawn
 * while nothing is on; the permanent way in is a 44x44 `ConditionsControl`,
 * which sat at the end of the identity's class row and is at the head of the
 * defence band's fifth cell now that the class row has gone. Both homes cost the
 * same thing, which is nothing, for the same reason: a 44px control inside a
 * band that is taller than it for another reason. Nothing here is bought by
 * shaving a gap, because a fit bought that way is one the next honest edit
 * un-buys. `playSheet.test.tsx` carries every one of these numbers as an
 * assertion rather than as prose, so none of them can quietly stop being true.
 *
 * WHAT IT STILL DOES NOT DO, SAID PLAINLY. A home-indicator iPhone installed as
 * a PWA pays `env(safe-area-inset-bottom)`, which is 34px and which this repo
 * has always treated as 0. That takes the 393x852 column from 730 to 696, which
 * this sheet now clears by 98 where P5-8's 697 was one pixel over. `BackupBanner`
 * is the other one the budget has never counted: it is 58px above this scroll
 * from first launch until the first backup is taken, so a new user's column is
 * 672 - and 598 clears that by 74, where 697 was 25px over it.
 *
 * TWO THINGS ARE NOT IN GIORGIO'S ORDER, AND BOTH ARE ERGONOMIC RATHER THAN
 * EDITORIAL. The death move leads the column, because when you have fallen it
 * is the only thing that matters; it draws nothing the rest of the time. That
 * is the right place and it is not the same thing as being visible: in the
 * pinned block it could not be off screen and here it can, on exactly one path
 * - a recall confirmed from the vault fold, some 700px down, which can mark the
 * last Hit Point. Written down in `BACKLOG.md` under P5-5 rather than papered
 * over, because the fix is a choice between two shapes and not a placement. A
 * worn Beastform follows it, because it changes what every number under it
 * means - and a class with the Beastform feature draws a 44px HUMAN FORM chip
 * there even untransformed, which is 52px of this budget that every Druid
 * pays and nobody else does.
 *
 * The conditions stay low, where they already were - set once a scene rather
 * than once a turn, so they do not belong above ROLL - and they are drawn only
 * while one is on. The fold P5-6 put them behind was a better 44px than the
 * strip and not a cheaper one; this is the cheaper one, and it is paid for by
 * the 44x44 `ConditionsControl` at the head of the defence band's fifth cell,
 * in a row the four number cells already hold open. See `ActiveConditions` and
 * `ConditionsControl`.
 *
 * EVERY FOLD DEFAULTS SHUT, `equipped` and the cards included. The budget above
 * is computed with every fold shut, and a default that contradicted it would
 * make the arithmetic a fiction; the folds remember per character, so a player
 * who wants their weapons open opens them once.
 *
 * AND THE LICENCE NOTICE IS BELOW ALL OF IT, WHICH IS WHY IT COSTS NOTHING.
 * This screen had no notice at all until P5-6 - the only one of the five that
 * did not - and the argument for the exemption was every one of the numbers
 * above: 111px of a 730px column, permanently, on the tightest budget in the
 * app. That argument was about a *pinned* strip, and there is no longer one. As
 * the last child of the scroll the notice is below the lineage fold, which is
 * where the 598 ends, so it moves no term of `STACK`, no term of `INDEX` and
 * neither total. It is the one thing on this column a player never has to
 * reach, and that is exactly the property that lets it sit past the end.
 */
function PlayPhone({
  stats,
  trait,
  chooseTrait,
  arming,
  armedExperiences,
  setArmedExperiences,
}: ViewProps): React.JSX.Element {
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
  // Filtered through the character rather than counted off the armed list: an
  // Experience deleted in Build must not go on being counted on a header.
  const armedCount = character.experiences.filter((e) =>
    armedExperiences.includes(e.id),
  ).length;

  return (
    /*
     * One column, and it is the only thing on this screen that scrolls.
     *
     * There is no outer scroller and no inner one any more, because there is
     * nothing pinned for them to be arranged around - and with them went the
     * 88px floor that existed only to stop a fixed block starving the scroll.
     * `overflowY` is declared inline as well as by `.scroll`, because that is
     * the one property a test can read back: jsdom applies no stylesheet.
     *
     * ## No paint effect may ever be declared on this element or above it
     *
     * This column is the mount point for four `position: fixed; inset: 0`
     * dialogs - `DeathMoveOffer` below, `Beastform` below, `ConditionsControl`
     * through `Identity`, and `CompanionSheet` through `Vitals`. It carried
     * `.scroll-fade` until this commit, and that one class made every one of
     * them unusable on every phone: a mask is an effect node applied to the
     * element's whole *painted subtree*, fixed descendants included, and its
     * painting area is confined by the initial `mask-clip: border-box`. So the
     * dialogs resolved `inset: 0` against the viewport correctly and measured
     * their full 852 at 393x852 - and then had everything outside this
     * column's border box, y 53-791, given mask alpha 0. Not painted and not
     * hit-tested. CLOSE showed 9-10px of its 44 and its centre at y=804 landed
     * in the tab bar's band, so tapping it went to PLAY; CLEAR ALL went to GM;
     * the 10px `.t-label` titles of Conditions and Beastform were painted 0 of
     * 10. It was dormant, never absent, at 744x1133, where no tab bar is drawn
     * and the panel happens to fit inside the clip.
     *
     * The property was `mask-image`, but the rule is the class of property:
     * mask, filter, backdrop-filter, transform, perspective, will-change and
     * contain all create either an effect node or a containing block, and any
     * of them here breaks the same four dialogs the same way.
     */
    <div
      className="stack scroll"
      style={{
        flex: 1,
        minHeight: 0,
        padding: '0 12px 8px',
        gap: 8,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* When you have fallen this is the only thing that matters, so it leads
          the column. It renders nothing the rest of the time. */}
      <DeathMoveOffer />

      {/* A worn Beastform changes what every number under it means, so it
          comes before them. It renders nothing for a class without one. */}
      <Beastform stats={stats} layout="phone" />

      {/* Read under pressure, so it is four numbers and not a footnote - and
          FIRST, since decision 2 took the identity block off this column:
          "threshold bene in vista" is the one instruction in Giorgio's message
          with a reason attached to it, and the name, class and level it used to
          sit under are on `Header.tsx` on every screen anyway. `damage` puts
          the box you type a hit into beside the two thresholds it is read
          against, which is where it was already looking: it used to print
          `8/16` in 10px next to itself from inside the counters. `conditions`
          puts the phone's permanent door into `ConditionsDialog` at the head of
          that same fifth cell - it was on the identity's class row, and that
          row has gone. */}
      <Defenses stats={stats} damage conditions />

      {/* The four counters, two across. `bare`, because a box drawn around
          four silhouettes costs 18px and distinguishes nothing. */}
      <Vitals stats={stats} layout="phone" showState={false} bare />

      <TraitRow
        stats={stats}
        trait={trait}
        onPick={chooseTrait}
        characterId={character.id}
      />

      {/*
       * ROLL, in the flow, at the end of everything the rules make you declare
       * before the dice. 317x66 at 393px and 299x66 at 375px, the largest
       * target on the screen after a fold header.
       *
       * WHERE IT ACTUALLY IS, MEASURED RATHER THAN REMEMBERED. This comment
       * carried `y522-588 … 264 to 330px up from the bottom bezel … 203px clear
       * of the tab bar` for two passes after the 2x2 counter grid took 150px
       * out of the stack above it, and every one of those numbers was 150px
       * stale. Rendered in Chrome, the `playedCharacter` fixture, every fold
       * shut, at the top of the scroll: the ROLL row spans **y273-339** on the
       * glass at both reference widths, because everything above it is the same
       * height at both. At 393x852 that is **513 to 579px above the bottom
       * bezel** and **452px clear of the tab bar**; at 375x667 it is **328 to
       * 394px above the bezel** and 267px clear.
       *
       * AND THE CONCLUSION INVERTS WITH THEM, WHICH IS THE PART THAT MATTERS.
       * The old sentence cited a 95th-percentile right-thumb sweep of about
       * 330px from the bottom-right pivot and said ROLL was inside it. It is
       * not, at either width, and the reflow made that worse rather than
       * better: deleting the 99px identity block lifted everything below it, so
       * on a 393x852 phone the resting sheet now puts ROLL some 183px beyond the
       * far edge of that arc where P5-8 put it 84 beyond, and on a 375x667 phone
       * ROLL has left the arc altogether - it was 229-295 and comfortably inside
       * it, and it is 328-394 and outside it by 2. That is a real cost of what
       * was asked for rather than a detail, and it is the cost of decision 2
       * specifically: every pixel the sheet gets shorter above ROLL is a pixel
       * further from the thumb at rest.
       *
       * WHAT IT BOUGHT, AND WHY THE TRADE IS STILL THE RIGHT ONE. Two things.
       * The whole folded sheet is now readable in one look - 598 of 730 at
       * 393x852 - which is the sentence the owner actually wrote and which a
       * pinned block made arithmetically impossible. And ROLL is 452px clear of
       * the tab bar, where pinned it sat 8px above a 98x60 control that
       * navigates away: a thumb aiming for ROLL and missing low used to leave
       * the screen mid-turn.
       *
       * The deciding asymmetry is that one of those costs is recoverable and
       * the other is not. This column scrolls, so a player about to roll can
       * bring ROLL under their thumb with the gesture that got them there, and
       * at the moment of rolling its position is theirs to choose; a pinned
       * block's position is nobody's to choose, and 88px of pinned chrome could
       * not be scrolled back into the sheet. The cost is paid at rest, where
       * nobody is reaching for ROLL, and the benefit is paid while reading,
       * which is what the resting sheet is for. I would not put the pin back.
       *
       * What would change that answer is a measurement nobody has taken: a real
       * thumb, at a table, on a 393x852 phone, being asked whether the reach at
       * the top of the scroll is a shrug or a fumble. `BACKLOG.md` keeps that in
       * the list of things that need a human rather than an argument.
       * `playSheet.test.tsx`, «says where on the glass ROLL is drawn», derives
       * every number above from the budget table and the shell's own three
       * constants, so none of them can go 150px stale again.
       */}
      <DualityRoll
        stats={stats}
        trait={trait}
        onTraitChange={chooseTrait}
        source={arming.source}
        layout="phone"
        armedExperiences={armedExperiences}
        onArmedExperiencesChange={setArmedExperiences}
      />

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
      >
        <Equipped stats={stats} arming={arming} bare />
      </Disclosure>

      {/*
       * "E fare entrare le armi e le experience." The Experiences come
       * straight after the weapons, which is where Giorgio's message puts
       * them and where the printed sheet has them.
       *
       * They used to be two 44px chips pinned directly above ROLL, which is
       * the best band on the phone and which they held on every frame of
       * every session to offer something a player arms on maybe one roll in
       * ten. Behind a fold they cost 44 instead of 100, and nothing about
       * arming one changes: the chips are the same control, and whatever is
       * armed is spelled out in full on the ROLL bar itself - so a
       * declaration is never behind a tap even when the fold is.
       *
       * That sentence is the warrant for this fold, so it is load-bearing
       * rather than descriptive, and it shipped false: `DualityRoll` named the
       * armed Experiences only while no verdict was standing, which is every
       * state but the one a player is in from their second roll of the evening
       * onwards. `the Experiences a roll is declared with` asserts it in the
       * state that used to lose it. What is armed *after* a roll is prefixed
       * `NEXT:` there, because the bar is reporting a total at the same time
       * and a +2 printed beside an 18 reads as an 18 that counted it.
       *
       * Drawn only when there are any. Every character starts with two, but a
       * fold that opens onto nothing is 44px spent on an empty room.
       */}
      {character.experiences.length > 0 && (
        <Disclosure
          id="experiences"
          characterId={character.id}
          label="Experiences"
          summary={
            armedCount === 0
              ? `${character.experiences.length}`
              : `${character.experiences.length} · ${armedCount} ARMED`
          }
        >
          <ExperienceRow
            experiences={character.experiences}
            armedExperiences={armedExperiences}
            hopeAvailable={character.hope.marked}
            toggleExperience={(id) =>
              setArmedExperiences(
                armedExperiences.includes(id)
                  ? armedExperiences.filter((x) => x !== id)
                  : [...armedExperiences, id],
              )
            }
          />
        </Disclosure>
      )}

      {/*
       * "Sotto armi e armature e ultime le carte": the inventory comes
       * between the weapons and the cards, which is also the printed sheet's
       * order - and it carries the gold, because gold is a carried thing.
       *
       * The gold used to be a 30px row of its own whose entire content was
       * the word "Gold" and a formatted total. `Disclosure` draws `summary`
       * open and closed alike, so putting the total here spends no row at all
       * and still has it on the glass with every fold shut. An empty purse
       * reads `0 ITEMS · NO GOLD`, which is `formatGold`'s own sentence for
       * nothing and is chosen rather than discovered.
       */}
      <Disclosure
        id="carried"
        characterId={character.id}
        label="Carried"
        summary={`${carried} ${carried === 1 ? 'ITEM' : 'ITEMS'} · ${formatGold(character.gold).toUpperCase()}`}
      >
        <Items bare />
      </Disclosure>

      {/*
       * The cards, which are one section and used to be drawn as two.
       *
       * "Ultime le carte." The loadout and the vault are the same subject -
       * what you own and which five of it you are holding - and they were
       * costing two 44px headers to say so. The vault is now a tendina inside
       * this one, keeping its own id so a player who had it open still has it
       * open, and the closed header carries both numbers: a fold that hides
       * how many cards are where has cost a tap rather than saved a scroll.
       *
       * Nested rather than merged, because the argument that separated them
       * still holds: a level 8 character owns about a dozen cards and carries
       * five, and opening the loadout must not hand you twelve rows.
       */}
      <Disclosure
        id="cards"
        characterId={character.id}
        label="Cards"
        // The gate counts every ref, readable or not, so this does too: a
        // header saying 3 / 5 over a recall that refuses with "Loadout is
        // full (5)" is the screen contradicting itself.
        summary={`${loadout.length + ghostLoadout.length} / 5 · ${vault.length + ghostVault.length} INACTIVE`}
      >
        <div className="stack" style={{ flex: 'none', gap: 4 }}>
          <LoadoutRows />
        </div>
        <Disclosure
          id="vault"
          characterId={character.id}
          label="Vault"
          summary={`${vault.length + ghostVault.length} INACTIVE`}
        >
          <Vault layout="rows" />
        </Disclosure>
      </Disclosure>

      {/*
       * A rest is between-scenes work, so it sits below everything the game
       * makes you touch during a scene and above the section read once a
       * session. Directly under the cards, because the free swap it offers is
       * the vault's own operation at the other price.
       */}
      <Rest stats={stats} rng={cryptoRng} />

      {/*
       * Conditions are set once a scene rather than once a turn, so they are
       * low in the column - and they are drawn only while one is actually on.
       *
       * This is decision 6's shape on a second surface: nothing is drawn to
       * say nothing. The fold P5-6 put here saved not one pixel - a shut
       * `Disclosure` is 44 plus this column's 8px gap, which is exactly what
       * the permanent strip was - and the only arrangement that removes the 52
       * is this one, paid for by a door that costs no height, which is the
       * 44x44 control in the defence band's fifth cell at the top of this
       * column. With nothing on, the folded sheet is 598 of 730 at 393x852.
       *
       * When something *is* on this strip is back, in this slot, naming it -
       * and the control at the top of the sheet is filled and counting it. A
       * condition is a state the GM inflicted, so the one thing this may never
       * do is go quiet about one.
       */}
      <ActiveConditions onlyWhenOn />

      <Disclosure id="lineage" characterId={character.id} label="Lineage & domains">
        <Lineage stats={stats} />
      </Disclosure>

      {/*
       * The licence notice, below every fold, and it costs this budget nothing.
       *
       * Play had no notice at all until P5-6, and the reason was arithmetic: as
       * a *fixed* strip it was ~111px off the top of a 730px scroll window on a
       * 393px phone, forever, on the screen with the tightest budget in the
       * app. `LicenceFooter`'s own docblock still carries that argument, marked
       * superseded, because the shape it was arguing against no longer exists.
       *
       * Here it is the last child of the scroll, under the last shut fold. The
       * budget in `playSheet.test.tsx` runs from the top of Identity to the
       * bottom edge of the lineage header - 598px against 730 - and everything
       * it sums is something a player has to be able to reach. This is not:
       * it is read once, by somebody who is not at a table, and there is no
       * state of this sheet in which it needs to be on the glass. So it is
       * outside `STACK` and outside `INDEX` on purpose, and the test says that
       * in the one place it could otherwise be mistaken for an omission - the
       * child count, which goes from ten to eleven.
       *
       * No `pinnedBelow`: nothing on Play is pinned. On a phone `TabBar` is
       * below the whole screen and pays the home-indicator inset; from 720px up
       * there is no tab bar and this notice is the last thing in the window, so
       * it pays.
       */}
      <LicenceFooter />
    </div>
  );
}
