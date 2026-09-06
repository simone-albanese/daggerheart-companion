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
 * the phone entirely, ROLL's own lower edge lands **456px** above the fold at
 * 393x852 and **271px** above it at 375x667 without a pin, so the block was
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
 *   At 1180px and above, the three-column cockpit, laid out for a mouse.
 *   `PlayDesktop`. It used to say here that it "fits without scrolling", and
 *   that was measurably untrue: at 1180x695 - a viewport `Vitals` names as
 *   this app's real constraint - the roll panel holds 277.9px of declared
 *   content in 197, and with `overflow: hidden` on it ROLL was painted 0.0px
 *   with no wheel, drag or tap anywhere on the glass that reached it. Two of
 *   the three columns have always scrolled; the middle one does now too, and
 *   the argument is in the docblock over `DualityRoll`'s desktop branch.
 *
 * The middle band used to run the cockpit at two columns, and that is P2-1:
 * `DualityRoll`'s root was `flex: 1, minHeight: 0, overflow: hidden` inside a
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
  damageKindLong,
} from '../../../shared/types.ts';
import { weaponDamage, type DatasetIndex, type DerivedStats } from '../../engine/character.ts';
import { formatDamage } from '../../engine/dice.ts';
import { characterFeatures, type HeldFeature } from '../../engine/features.ts';
import type { Contribution, Ledger, LedgerStat } from '../../engine/modifiers.ts';
import { formatGold } from '../../engine/gold.ts';
import { cryptoRng } from '../../engine/dice.ts';
import {
  canAddToLoadout,
  missingCardRefs,
  resolveCards,
  vaultCard,
  type SwapCheck,
} from '../../engine/loadout.ts';
import { unresolvedWeapons } from '../../engine/holdings.ts';
import { useActive, useApp } from '../../store/state.ts';
import { Disclosure, usePlaySection } from '../shared/Disclosure.tsx';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { feetRange, rangeDistances } from '../shared/srdReference.ts';
import { useLayout } from '../shared/useLayout.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import {
  DAMAGE_SIDES,
  beastformSource,
  companionSource,
  experiencesFor,
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
import { DicePools, usePoolsFor } from './DicePools.tsx';
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
    // Re-derived from the worn form every render, like the spell's count above:
    // DROP resolves this to null and the damage offer goes with it, rather than
    // leaving a bear's dice armed on a sheet that is a person again.
    if (declared.kind === 'beastform') return beastformSource(stats);
    if (character === null) return null;
    // Re-derived like the two above, and for one reason more: a companion who
    // marks their last Stress walks out of the scene, and `companionSource`
    // answers null for them - so the offer goes at the moment they do.
    if (declared.kind === 'companion') return companionSource(character.companion, stats);
    const held =
      declared.ref === character.activePrimaryWeapon ||
      declared.ref === character.activeSecondaryWeapon;
    if (!held) return null;
    const weapon = index.weapons.get(declared.ref);
    return weapon === undefined ? null : sourceFromWeapon(weapon, stats);
  }, [character, declared, index, spellModifier, stats]);

  /*
   * The chips change owner with the armed attack, so the armed ones are let go.
   *
   * A companion roll spends Hope on *their* Experiences, so `experiencesFor`
   * hands the row a different list the moment one is armed. Ids from the other
   * list simply would not match and would cost nothing - but they would come
   * back the instant the player disarmed, re-arming chips nobody pressed and
   * putting a Hope cost back on the roll bar out of nowhere. One clearing rule,
   * the same as the one below for a change of sheet.
   */
  const companionArmed = source?.kind === 'companion';
  useEffect(() => {
    setArmedExperiences([]);
  }, [companionArmed]);

  /*
   * A Beastform declaration is form-agnostic on purpose, so the trait has to be
   * re-derived the way the pool is.
   *
   * `arm` writes the trait once, at the tap, and stores `{kind:'beastform'}`
   * with no ref in it - which is what lets `source` follow a change of shape
   * without anything re-arming. The trait did not follow: arm a bear under
   * Strength, open the picker, become a raven, and the row read `ARMED ·
   * FINESSE` while the chip and the ROLL bar still said STRENGTH and the
   * modifier was genuinely the wrong one. The picker cannot fix it from its own
   * side - `enterBeastform` knows nothing about what is armed - so it is fixed
   * here, where both halves are in view.
   *
   * The null branch is the half nobody had seen, and it is the one an ordinary
   * table hits. DROP resolves `source` to null and takes the row away, but the
   * declaration behind it survived, so the next transform came back with an
   * attack armed that nobody tapped, under the trait of a shape the character
   * had stopped wearing. That includes this branch's own automatic drop at the
   * last Hit Point, which only nulls `character.beastform`.
   *
   * Keyed on the ref as well as the trait: two forms can arm the same trait,
   * and a swap between them still changes which dice are rolled.
   */
  const wornForm = stats.beastform?.form ?? null;
  const wornFormRef = wornForm?.id ?? null;
  const wornFormTrait = wornForm?.attack.trait ?? null;
  const beastformDeclared = declared?.kind === 'beastform';
  useEffect(() => {
    if (!beastformDeclared) return;
    if (wornFormTrait === null) {
      setDeclared(null);
      return;
    }
    setTrait(wornFormTrait);
  }, [beastformDeclared, wornFormRef, wornFormTrait]);


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
    // A form specifies its trait the way a weapon does, and the sentence is the
    // same one: *"you use the creature's listed range, trait, and damage
    // dice"*. So arming a bear moves the chip to Strength.
    if (declaration.kind === 'beastform') {
      const trait = stats.beastform?.form.attack.trait;
      if (trait !== undefined) setTrait(trait);
      return;
    }
    /*
     * Commanding the companion is a Spellcast Roll, so arming them arms that
     * slot - the same half-sentence a weapon arms its own trait by.
     *
     * *"Make a Spellcast Roll to connect with your companion and command them
     * to take action."* This is the one attack in the app whose roll belongs to
     * one creature and whose damage belongs to another, and the trait chip is
     * where a player would otherwise have to know that.
     */
    if (declaration.kind === 'companion') {
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
 * cockpit has a mouse, so the bullet is not what binds here any more - it is
 * kept because there is one component and the phone's rule is the stricter of
 * the two. ("The cockpit does not scroll" stood in that sentence and was never
 * true of this block: the column `Identity` is drawn in is `.stack scroll`,
 * which is the whole argument `Rest` and the licence notice are placed on.)
 */
/**
 * The Spellcast trait, on the line that says what class you are.
 *
 * It is a property of the subclass - the SRD prints "SPELLCAST TRAIT" wherever
 * a subclass has one - and until now the only place on Play that said so was
 * the hint under the trait grid, which a player reads while choosing a trait
 * rather than while asking what their character is. (It said "on every subclass
 * page", which the next paragraph contradicts and which the book contradicts
 * too: the heading is printed fourteen times against eighteen subclasses, and
 * the four without it run straight from the blurb into FOUNDATION FEATURES.)
 *
 * IT SAYS SO WHEN THERE IS NONE, and that is the half worth having. Four of the
 * eighteen shipped subclasses carry no Spellcast trait at all - both Guardian
 * subclasses and both Warrior ones - and for those characters the whole
 * Spellcast row is simply absent from `Equipped`. An absence explains nothing;
 * a line saying the class has none explains the absence.
 *
 * `deriveStats` takes the first subclass that declares one, so a multiclass
 * shows the trait its rolls will actually use rather than both.
 */
function SpellcastLine({ stats }: { stats: DerivedStats }): React.JSX.Element {
  return (
    <div className="t-meta" style={{ color: 'var(--muted)', letterSpacing: '0.09em' }}>
      {stats.spellcastTrait === null
        ? 'NO SPELLCAST TRAIT'
        : `SPELLCAST · ${TRAIT_LABELS[stats.spellcastTrait].toUpperCase()}`}
    </div>
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
          <span aria-hidden="true" className="t-meta" style={{ color: 'var(--line)' }}>
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
      <SpellcastLine stats={stats} />
      {lineage !== '' && (
        <div className="t-hint" style={{ color: 'var(--muted)' }}>{lineage}</div>
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
          <span aria-hidden="true" className="t-meta" style={{ color: 'var(--line)' }}>
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
      <SpellcastLine stats={stats} />
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
          <span className="t-hint" style={{ color: 'var(--dim)' }}>
            No domains — this sheet has no class the app can read.
          </span>
        )}
      </div>
      <div className="t-hint" style={{ color: 'var(--text-2)' }}>
        {lineage === '' ? 'No ancestry or community on this sheet.' : lineage}
      </div>

      {/*
       * AND WHAT ALL OF THAT ACTUALLY GIVES YOU, which is the half this fold
       * was missing.
       *
       * It named the ancestry, the community, the class and the subclass and
       * then stopped, so the fold answered "who am I" and never "what do I
       * have". The features go here rather than in a seventh fold of their own
       * for a measured reason: `playSheet.test.tsx` holds the whole folded
       * sheet to 532px against 545 of column at 375x667 - THIRTEEN pixels of
       * slack - and one more full-width `Disclosure` is 44 plus this column's
       * 8px gap. A fold that cost 52 to add would have taken the small phone
       * out of the fit that four folds were paired two-up to buy.
       *
       * Inside a fold that is already here it costs the resting column NOTHING,
       * and the pairing is not a compromise: a feature is what an ancestry, a
       * community, a class and a subclass ARE, and this is the fold that names
       * all four. The header says so, so nobody has to guess.
       */}
      <div className="t-label" style={{ marginTop: 4 }}>
        Features
      </div>
      <FeatureList stats={stats} />
    </div>
  );
}

/**
 * What each stat is a sum OF, in the sheet's own words.
 *
 * `STAT_WORD` is the label a contribution is printed under, and it is the only
 * place a `LedgerStat` becomes English. Kept beside `FeatureList` rather than
 * inside it because `Defence` names the same stats in the band above.
 */
const STAT_WORD: Record<LedgerStat, string> = {
  evasion: 'EVASION',
  armorScore: 'ARMOR',
  major: 'MAJOR',
  severe: 'SEVERE',
  maxHp: 'HP',
  maxStress: 'STRESS',
  agility: 'AGILITY',
  strength: 'STRENGTH',
  finesse: 'FINESSE',
  instinct: 'INSTINCT',
  presence: 'PRESENCE',
  knowledge: 'KNOWLEDGE',
};

const LEDGER_STATS = Object.keys(STAT_WORD) as LedgerStat[];

/** `+1 EVASION`, with the minus sign the rest of the app uses. */
function effectChips(ledger: Ledger, ref: Ref, feature: string): string[] {
  const out: string[] = [];
  for (const stat of LEDGER_STATS) {
    for (const row of ledger[stat]) {
      if (row.ref !== ref || row.feature !== feature) continue;
      out.push(`${row.amount >= 0 ? '+' : '−'}${Math.abs(row.amount)} ${STAT_WORD[stat]}`);
    }
  }
  return out;
}

/**
 * One feature, verbatim, with what it does to a number beside it when it does
 * anything to a number.
 *
 * THE CHIP IS THE HALF THAT IS NOT DECORATION. Before this section existed the
 * app added a Simiah's +1 to nothing at all, and the reason nobody caught it
 * for as long as nobody did is that Evasion was a bare integer with no
 * derivation anywhere on the screen. A feature that says «+1 EVASION» beside
 * its own text is a claim a player can check against the number in the band, so
 * the next time the two disagree somebody sees it. It is drawn from the same
 * `stats.modifiers` ledger the number itself was summed from - not a second
 * list - so the two cannot drift.
 *
 * A feature with no chip is not a feature that does nothing: Rogue's Dodge,
 * Faerie's Wings and every other spend are here in full, and they carry no chip
 * because their number is not true of the sheet at rest. `modifiers.ts` carries
 * the admission rule that decides which is which.
 */
function FeatureRow({ feature, chips }: { feature: HeldFeature; chips: string[] }): React.JSX.Element {
  return (
    <div
      className="stack"
      style={{
        flex: 'none',
        gap: 5,
        padding: '9px 10px',
        borderRadius: 'var(--r3)',
        background: 'var(--panel)',
        border: '1px solid var(--line-soft)',
        borderLeft: `3px solid ${chips.length > 0 ? 'var(--hope)' : 'var(--line)'}`,
      }}
    >
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span style={{ font: '700 0.8125rem/1.2 var(--sans)', color: 'var(--text)' }}>
          {feature.name}
        </span>
        {chips.map((c) => (
          <span key={c} className="chip" style={{ color: 'var(--hope)' }}>
            {c}
          </span>
        ))}
      </div>
      <span className="t-meta" style={{ color: 'var(--dim)', letterSpacing: '0.05em' }}>
        {feature.source.toUpperCase()}
      </span>
      <span className="t-read" style={{ whiteSpace: 'pre-line', color: 'var(--text-2)' }}>
        {feature.text}
      </span>
    </div>
  );
}

/**
 * Every feature this character actually has, on the screen that is open while
 * they play.
 *
 * «La pagina di play deve avere tutte le caratteristiche di origine e classe.
 * Abilità, abilità che usano hope ecc.» - and before this component the answer
 * was none of them. Not one word of class, subclass, ancestry or community
 * feature text was reachable from Play: `Identity` and `Lineage` printed NAMES,
 * `Equipped` printed a weapon's dice and deliberately not its `feature`, and
 * the only way a player could reread their own Hope feature after character
 * creation was to print the sheet.
 *
 * THE HOPE FEATURE LEADS, and it is the one thing here that is not in source
 * order. `characterFeatures` hands it over separately because the printed sheet
 * puts it beside the Hope track; a screen has no Hope track next to this list,
 * and the feature that spends the resource the whole game is built on is the
 * one a player looks up most. So it is first, and it says so.
 *
 * The list is the engine's, not this file's. `characterFeatures` is what the
 * printed sheet uses too, so the two surfaces cannot disagree about which of a
 * mixed ancestry's two slots granted what - which matters more than it sounds,
 * because `modifiers.ts` gates Simiah's +1 Evasion on exactly that slot.
 */
function FeatureList({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  if (!character) return null;
  const held = characterFeatures(character, index);
  const all = held.hopeFeature === null ? held.features : [held.hopeFeature, ...held.features];

  if (all.length === 0) {
    return (
      <div className="panel t-hint" style={{ padding: '12px 11px', color: 'var(--dim)' }}>
        No features — this sheet has no class, ancestry or community the app can read.
      </div>
    );
  }

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      {all.map((f) => (
        <FeatureRow
          key={`${f.site}:${f.ref}:${f.name}`}
          feature={f}
          chips={effectChips(stats.modifiers, f.ref, f.name)}
        />
      ))}
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
 * THE CHIP IS TWO LINES, WHICH WAS DECISION 5, AND THE REFLOW GIVES THE 14PX
 * BACK WITHOUT GIVING THE TYPE BACK. It was one line at `.chip`'s 9.5px - the
 * smallest type anywhere on this sheet, for six of the numbers a player reads
 * most often. Decision 5 stacked the abbreviation over the value at 15px and
 * paid 14px of column for it: the chip went to 58 and the verbs control
 * followed, so the row was one height rather than a 44 floating in a 58.
 *
 * Measured, that bought a 58px chip around **34.6px of ink** - two 17.3px lines
 * at 15/1.15, y237.8-272.3 inside a chip spanning y227-285, so 10.8 above and
 * 12.7 below. Nothing in this row needs more than the touch floor, so the chip
 * and the verbs control are both **44** now and the type inside grows instead:
 * the modifier - the number you add to 2d12 - goes **15 -> 17**, and the
 * three-letter abbreviation over it goes **15 -> 13**.
 *
 * THE CUT ON THE ABBREVIATION IS DELIBERATE AND IT IS THE ONLY ONE IN THE PASS.
 * AGI/STR/FIN/INS/PRE/KNO name the number under them and are read once, when a
 * player learns where the six are; the modifier is read on every roll. That is
 * the caption-under-number relation the defence band and the counters already
 * have. It is 13 and not the 10 a flatter ramp would give, because six labels
 * that carry the identity of the number beneath them, cut by a third, is a
 * shrink nobody asked for. Measured in Chrome at 393: line boxes 14.95 and
 * 19.55, **ink 34.48 in 42** of inner - the chip carries a 2px bottom rule -
 * so 3.75px above and 3.77 below. The row gives back 14 and the number a player
 * reads is 13% larger.
 *
 * AND THE BASIS IS 44, WHICH IS A SEPARATE FIX AND IS NOT THE SAME ONE. Flex
 * line-breaking is decided on the declared `flex-basis`, not on what the chip
 * draws, so a taller chip is not a narrower one and decision 5 closes nothing
 * on its own - the audit report says so in as many words. At `1 1 46px` the row
 * declared 6 x 46 + 44 + 6 x 4 = **344**, which is exactly the column at
 * viewport 368 and one pixel more at 367: an exact fit is a coincidence, and
 * every Android at 360 paid 48px for it (two rows, the second holding nothing
 * but the 44x44 chevron - measured: the row is 92 tall at 367 and 44 at 368).
 * At `1 1 44px` with `minWidth: 44` the line declares 6 x 44 + 44 + 24 =
 * **332**, so it is one row from viewport **356** up. Nothing changes at 368 and
 * above: flex-grow redistributes the same free space, so the chips are still
 * 46.0 at 368, 47.17 at 375 and 50.17 at 393, measured before and after.
 *
 * ERGONOMICS. Six targets at ~50.2px wide at 393, 47.2 at 375, 44.67 at 360 and
 * exactly 44.0 at 356, all 44 tall, with 4px between them. That is still the
 * tightest target spacing on this screen and I am not going to pretend it is
 * comfortable; what changed is that the floor is declared rather than true by
 * arithmetic somewhere else, and that the chip is square at it rather than
 * standing 14px above it. Nothing here goes under 44 in either direction, and
 * the width - the axis these six are actually tight on - does not move at all. The horizontal gutter
 * is unchanged, so the near-miss risk sideways is exactly what it was, and three
 * things still make it acceptable: it is the arrangement and the gap the shipped
 * pinned strip already used; a mis-tap arms a neighbouring trait, which is
 * visible instantly - the chip fills with `--hope` - and costs one tap to undo;
 * and it spends nothing. No Hope, no log line, no roll. Every costly mis-tap on
 * this screen (ROLL, RECALL, the damage commit, and CLEAR ALL in the conditions
 * dialog this screen opens) has either a much bigger target or a second tap.
 *
 * USE IS THE ONE THAT HAS NEITHER, AND SAYING SO IS PART OF THE CLAIM. It spends
 * a carried item and writes a log line on one press, and its target is 44x44 -
 * the floor, not "much bigger". It measured 30.8x44 until this commit, which was
 * worse in the exact way that matters here, and the width is now declared; see
 * the note on the button in `Items` below for the 6.27px-a-character arithmetic
 * and what the 13.19px comes out of. It gets no second tap because the spend is
 * recoverable - Build's inventory rows carry a quantity field - so the sentence
 * above is true of every control it names and *nearly* true of this one, which
 * is the honest version.
 *
 * CLEAR ALL is the one that needed both, and it is worth knowing why, because it
 * is the only control reachable from here whose target and whose second tap were
 * decided by something outside this file: it lives in a `position: fixed` panel
 * drawn over the shell, so at 393x852 its footer sits on top of the tab bar and
 * the GM tab's centre lands inside it. A second tap in the same place would have
 * been the same accident twice, so the second tap is somewhere else - see the
 * docblock over `ConditionsDialog` in `Conditions.tsx` for the geometry that
 * decided it.
 *
 * BELOW 356 IT IS TWO ROWS AND THAT IS CORRECT RATHER THAN A DEFECT. Seven 44px
 * targets and six 4px gaps need 332 of column, which needs a 356px viewport;
 * below that no arrangement puts them on one line without taking one under the
 * floor. So the row wraps - 44 + 4 + 44 = **92**, +48 on the column - and the
 * second line carries the chevron alone. It is a reflow on a column that scrolls,
 * and nothing is ever clipped or off the glass.
 *
 * The space after the abbreviation is load-bearing and it is *inside* the first
 * span for that reason: the two lines are two `display: block` spans, so
 * `textContent` concatenates them with nothing between, and
 * `playSheet.test.tsx`'s `traitChip` helper matches `^AGI [+−]` in seven tests.
 * At 13px mono with `.chip`'s 0.06em the widest line a chip draws is still the
 * abbreviation, measured at **26.47px** including that space - 34.47 with the
 * padding, inside the 44px basis - and the modifier at 17px is **22.47**. The
 * chip itself is 50.16 wide at 393, 44.66 at 360 and exactly 44.0 at 356, all
 * measured, all one row. So no chip paints outside its own box, and the raise
 * happened on the axis this row has room on.
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
                // 44 and not 46, and declared twice: the basis is what flex
                // breaks lines on, and the `minWidth` is what makes "every
                // target is at the floor in both directions" true by
                // declaration rather than by arithmetic somewhere else.
                flex: '1 1 44px',
                minWidth: 44,
                // 44 and not the 58 it was. Two lines at 15px are 34.6 of ink
                // in a 58px chip - 10.8 above and 12.7 below - and nothing in
                // this row needs more than the touch floor. The type inside it
                // grows while the box shrinks: see the two spans below.
                minHeight: 44,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                // Overrides `.chip`'s `font: 600 var(--chip-size)/1 var(--mono)` size and
                // leading and keeps its family, its weight and its tracking.
                // 17 is the MODIFIER's size - the number you add to 2d12 - and
                // it is the chip's own, because the number is what the chip is
                // for; the three-letter abbreviation overrides it downwards.
                fontSize: 17,
                lineHeight: 1.15,
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
              {/* Two blocks, and the trailing space in the first one is not a
                  typo: `textContent` joins two block spans with nothing between
                  them, and `traitChip` matches `^AGI [+−]` in seven tests. */}
              {/*
               * 13, DOWN FROM 15, AND IT IS THE ONE CUT IN THIS PASS.
               *
               * AGI/STR/FIN/INS/PRE/KNO name the number under them and are
               * read once, when you learn where the six are; the modifier
               * below is read on every roll. That is the same caption-under-
               * number relation the defence band and the counters already
               * have, and it is what pays for the number going to 17 inside a
               * chip that got 14px shorter. Deliberately 13 and not the 10 a
               * flatter ramp would give: six labels carrying the identity of
               * the number beneath them, cut by a third, is a shrink nobody
               * asked for. (13 as 0.8125rem since the readability ramp, so the
               * OS text size reaches it; the number under it stays px.)
               */}
              <span style={{ display: 'block', fontSize: '0.8125rem' }}>
                {TRAIT_LABELS[t].slice(0, 3).toUpperCase()}{' '}
              </span>
              <span style={{ display: 'block' }}>
                {value >= 0 ? '+' : '−'}
                {Math.abs(value)}
              </span>
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
         * The verbs control. Square at the touch floor now, because the chips
         * came down to 44 and the row is one height either way - it was 58 for
         * exactly as long as they were, so that this was not a 44 floating in a
         * 58 - and `aria-expanded` because that
         * is what it is, but deliberately not a `Disclosure`, which is a
         * full-width header by contract and would cost the row this whole
         * component exists to save.
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
            minHeight: 44,
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
                    font: '500 0.625rem/1.35 var(--mono)',
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
 * gaps are 234.47 at their content width, a fifth of 44 + 6 + `--damage-w` is 94
 * below viewport 390 and 114 from 390 up, and a sixth of 44 plus a fifth gap is
 * 50 - so 398.47 against 369px of column at 393, and 378.47 against 336 at 360.
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
 * two lines. Measured in Chrome with the `wizard10` fixture at `8px 6px`, the
 * four cells at their content width are 61.61 + 52.84 + 54.81 + 41.20 = 210.47
 * with the number at 32px; add four 6px gaps and the fifth cell's own 94 and the
 * band needs 328.47, which fits the 336 a 360px Android has. At `8px 9px` it is
 * 352.47 and does not. `playSheet.test.tsx`'s width budget carries both sums as
 * assertions. Nothing in these four cells is a target - they are four numbers
 * you read - so the twelve pixels are spent on nothing a finger has to find.
 *
 * (The fifth track was `1fr` and therefore `column - 234.47` - 134.53 at 393,
 * 101.53 at 360 - until the row closed its hole. It is `auto` now, so it is
 * exactly the pair: measured 114 at 393 and 94 at 360, at 744 and 1179 as well.
 * `IncomingDamage`'s docblock in `Vitals.tsx` carries what that did to the box's
 * position, which is more than it did to this arithmetic.)
 *
 * THE BAND'S HEIGHT IS THE FOUR NUMBER CELLS, AND ON A PHONE IT IS 56.
 *
 * It was `8 + 10 label + 4 + 32 number + 8 + 2 border = 64px`, and the 32 is
 * decision 4 - the only term of this band that grew, and it grew inside a row
 * whose two targets are 44 and did not move. The vertical padding is 4 on the
 * phone now: **4 + 10 + 4 + 32 + 4 + 2 = 56**, ink 52, so two real pixels of
 * margin above the caption and two below the number. The caption-to-number gap
 * stays 4, because that pairing is the meaning of both of them; what came out
 * is distance from a border that is still drawn.
 *
 * 56 AND NOT 52, WHICH IS WHERE IT STOPS. At `2px 6px` the ink equals the inner
 * box exactly and a 32px number reads as though it is touching the rule. Four
 * pixels is not worth that on the four numbers the whole band exists to be read
 * across a table, and it is the smallest term in the reflow.
 *
 * The door and the field are 44 inside the 56, so both still ride for free -
 * measured, 6px of clearance top and bottom where they had 10 - and the
 * counters are still 50px shorter for them.
 *
 * PHONE ONLY, and that is what `tight` is for. The cockpit's band is in a
 * column with 70px of slack that `Vitals` gave back to `DualityRoll`, it is
 * read with a mouse at a desk rather than across a table, and this pass is not
 * changing it.
 */
function Defenses({
  stats,
  damage = false,
  conditions = false,
  tight = false,
}: {
  stats: DerivedStats;
  /** Draw the incoming-damage box as a fifth cell. Phone only. */
  damage?: boolean;
  /**
   * Take the readout cells' vertical padding from 8 to 4: 64px of band to 56.
   *
   * Phone only, and a prop rather than a layout read for the same reason
   * `conditions` is one: the cockpit is a different budget with 70px of slack
   * in it, and the phone column is the one the owner said was half empty.
   */
  tight?: boolean;
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
        // being squeezed into 80px.
        //
        // WITH THE DAMAGE BOX IN, THE ROW IS
        // `auto repeat(3, minmax(min-content, 1fr)) auto` AND THAT IS THE END
        // OF THE HOLE. It used to be `auto auto auto auto 1fr`:
        // the four readings took their content width - 61.6, 48, 54.8 and 41.2
        // at 393, four different sizes - and the fifth track, being the only
        // flexible one, swallowed all 139.4 of the remainder while holding 94px
        // of controls. The 45.4 left over drew as an empty band at the
        // right-hand end of the row.
        //
        // Now the fifth is `auto`, so it is exactly its door and its field and
        // nothing is left to leave a hole; EVASION keeps `auto` because its
        // label is the longest of the four and equal fifths would clip it -
        // measured, 49.6 of ink against 45.75 of inner - and the other three
        // share what is left, which makes them equal where they used to be
        // arbitrary. Four equal cells plus the box overflow even a 393px phone,
        // which is why this is not `repeat(5, 1fr)`.
        //
        // `minmax(min-content, 1fr)` AND NOT `minmax(0, 1fr)`, WHICH IS ABOUT
        // WHAT HAPPENS BELOW THE SUPPORTED WIDTH. A `1fr` floored at zero is
        // free to squeeze a track under its own content, and at 320 that put
        // 50px of MAJOR into 38.8 of track - text over its neighbour, which is
        // worse than the overflow it replaced. Floored at `min-content` these
        // three behave exactly as the `auto` tracks they replaced did below 360
        // and share the row equally above it, which is the whole change.
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
            ? 'auto repeat(3, minmax(min-content, 1fr)) auto'
            : 'repeat(4, 1fr)',
        gap: 6,
      }}
    >
      <Defence
        label="EVASION"
        value={stats.evasion}
        tight={tight}
        tone={worn ? 'var(--sage)' : undefined}
        under={worn ? String(worn.baseEvasion) : undefined}
        terms={derivationOf(stats.evasion, stats.modifiers.evasion)}
      />
      {unknownThresholds ? (
        <div className="panel stack" style={{ padding: tight ? '4px 6px' : '8px 6px', gap: 3, minWidth: 0 }}>
          <span className="t-meta" style={{ letterSpacing: '0.08em', color: 'var(--damage)' }}>
            ARMOR NOT IN THIS BUILD
          </span>
          <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
            {stats.unresolvedArmor}
          </span>
        </div>
      ) : (
        <>
          <Defence
            label="MAJOR"
            value={stats.thresholds[0]}
            tight={tight}
            tone="var(--stress)"
            terms={derivationOf(stats.thresholds[0], stats.modifiers.major)}
          />
          <Defence
            label="SEVERE"
            value={stats.thresholds[1]}
            tight={tight}
            tone="var(--damage)"
            terms={derivationOf(stats.thresholds[1], stats.modifiers.severe)}
          />
        </>
      )}
      <Defence label="PROF" value={stats.proficiency} tight={tight} />
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
  terms,
  tight = false,
}: {
  label: string;
  value: number;
  /** Colour for the label, when the number means something in particular. */
  tone?: string;
  /** The number this one replaced, struck through. */
  under?: string;
  /**
   * The sum this number is, when it is a sum of more than one thing: `12+1+1`.
   *
   * THE CHEAPEST HONEST FIX FOR THE THING THAT LET THE BUG LIVE. A Simiah in a
   * Gambeson read 12 for as long as they did partly because the arithmetic was
   * missing and partly because a bare integer cannot be checked: there was
   * nowhere on the sheet that said what the 12 was made of, so nobody could see
   * that two terms were absent. `12+1+1` under the number is a claim a player
   * checks by looking, and it is one 10px line - no target, no gesture, and
   * nothing when the sum has one term, which is most sheets.
   *
   * It shares the slot with `under`, which is the Beastform's struck-through
   * previous Evasion, and `under` wins: a worn form REPLACES the number, so
   * "what it used to be" is the more urgent of the two and printing both would
   * put three lines in a 56px cell that holds two.
   *
   * AND IT IS DROPPED ENTIRELY WHEN `tight` IS SET, WHICH MEANS ON THE PHONE.
   * This is a third line, and the phone's band is measured to the pixel: 4 + 10
   * + 4 + 32 + 4 + 2 = 56, and a 10px line with its own 4px gap makes it 70.
   * `playSheet.test.tsx` holds the whole folded sheet to 532 against 545 of
   * column at 375x667 - THIRTEEN pixels - so fourteen more would take the small
   * phone out of a fit that this repo spent a reflow buying, and jsdom measures
   * nothing, so no test here would have said so.
   *
   * The phone does not lose the derivation; it reads it somewhere with room.
   * Every contributing feature carries its own `+1 EVASION` chip in the
   * `Lineage, domains & features` fold, and every piece of gear carries one on
   * its row in `Equipped` - both drawn from the same `stats.modifiers` ledger
   * this line is drawn from. What the phone gives up is seeing the sum and the
   * total at the same instant, which is worth less than the fit.
   *
   * (`under` is NOT gated the same way, and the asymmetry is deliberate: a
   * Beastform is a state a player has just entered on purpose, so the band
   * growing while it is worn is the screen answering an action. A worn form is
   * also the one case where the number in the band is not the number on the
   * sheet, which is worth a line at any price.)
   */
  terms?: string;
  /** 4px of vertical padding instead of 8: the phone's 56px band. */
  tight?: boolean;
}): React.JSX.Element {
  return (
    <div
      className="panel stack"
      // 6px of horizontal padding, not 9: `Defenses`'s own note carries what
      // the twelve pixels buy and why a readout cell is where they come from.
      // The vertical 4 on a phone is that note's other half: 4 + 10 + 4 + 32 +
      // 4 + 2 = 56 against 64, with the caption-to-number gap left alone.
      style={{ padding: tight ? '4px 6px' : '8px 6px', gap: 4, minWidth: 0, borderColor: tone }}
    >
      <span className="t-meta" style={{ letterSpacing: '0.08em', color: tone }}>
        {label}
      </span>
      <span
        style={{
          // 32, not 26. These four are the numbers you read across a table
          // under pressure and they are the only things in the band that are
          // not targets, so the six pixels are pure legibility: the row's
          // height comes from this line, and 4 + 10 + 4 + 32 + 4 + 2 = 56 on a
          // phone (8 either side, 64, in the cockpit) against the 58 a 26px
          // number would have given.
          font: '800 32px/1 var(--sans)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      {under !== undefined ? (
        <s className="t-meta" style={{ color: 'var(--dim)' }}>
          {under}
        </s>
      ) : (
        terms !== undefined &&
        !tight && (
          <span
            className="t-meta"
            style={{
              color: 'var(--dim)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {terms}
          </span>
        )
      )}
    </div>
  );
}

/**
 * `12+1+1`, or nothing at all when the number has one term.
 *
 * The base is what the sheet would read with an empty ledger, so it is derived
 * by subtraction rather than recomputed: whatever `deriveStats` did to reach
 * the total, the terms under it always add back up to it. A cell whose sum is
 * just the base draws no line, because `12` under `12` is noise.
 */
function derivationOf(total: number, rows: readonly Contribution[]): string | undefined {
  if (rows.length === 0) return undefined;
  const base = total - rows.reduce((n, r) => n + r.amount, 0);
  return [String(base), ...rows.map((r) => `${r.amount >= 0 ? '+' : '−'}${Math.abs(r.amount)}`)].join(
    '',
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
 *
 * AND THE REACH SAYS HOW FAR IT REACHES. The meta line has always printed the
 * range as a bare word - CLOSE, FAR, VERY FAR - which is the one thing on this
 * row a player cannot work out from the row. Damage is a formula, the trait is
 * a chip on the same screen, physical-or-magic is two words; a reach is a
 * distance on p.40 and nothing in this app ever put it in front of the person
 * declaring the attack. The GM's `RangeReference` had it all along, which made
 * this the app knowing the answer on the screen that does not need it.
 *
 * IT IS THE BOOK'S FIGURE AND NOT THIS APP'S. `rangeDistances` reads the same
 * bullets `RangeReference` draws, so it is the SRD's own "about 30-100 feet
 * away" with the prose taken off, and a rules layer that redefines Far moves
 * this line and that screen together. Feet rather than metres deliberately: the
 * metric figures on the reference screen are arithmetic this app did, and the
 * rule everywhere in this codebase is that such a figure is drawn under a
 * legend naming the multiplication. There is no room for a legend on a 10px
 * meta line inside a button, so the line carries the unit the book is written
 * in and quotes rather than converts.
 *
 * A RANGE THE BOOK GIVES NO FIGURE FOR GETS NONE HERE. Melee is one - *"close
 * enough to touch, up to a few feet away"* carries no number to lift - and a
 * default would be this app inventing a distance the SRD deliberately left to
 * the fiction. Same rule `rangeEntry` and `RangeReference` already keep.
 *
 * WIDTH. The meta line is `.t-meta` - 10px mono - at `letter-spacing: 0.05em`,
 * so about 6.5px a character, inside a panel that is the column less 22 of
 * padding. Taken over all 204 shipped weapons the longest line this can now
 * produce is `ARMED · STRENGTH · VERY CLOSE 5-10 FT · PHYSICAL` - 48 characters
 * and about 312px, and it is the *shortest* distance that makes it, because
 * VERY CLOSE is the longest range name. The 393px phone has 347 and the cockpit
 * more, so it is one line there; at 320 the column is 296 and the panel 274,
 * and that worst case wraps to a second 10px line. It is allowed to: this block
 * scrolls, the row's floor is `var(--tap)` and a wrapped meta line grows the
 * row rather than clipping it, and the alternative was to keep the number off
 * the screen at every width in order to protect the narrowest one.
 */
/**
 * What a piece of gear is worth to the numbers, taken from the sum itself.
 *
 * It reads `stats.modifiers` - the ledger `deriveStats` built the totals out of
 * - rather than the register directly, so a chip here and the number in the
 * defence band cannot disagree: they are the same rows. A ref with no rows
 * draws nothing at all, which is the honest answer for a Broadsword, whose
 * *Reliable: +1 to attack rolls* is a roll and not a sheet number.
 *
 * `ref_` because `ref` is React's own prop name on a DOM element and shadowing
 * it in a component's props is how somebody later spends an afternoon.
 */
function GearEffects({ stats, ref_ }: { stats: DerivedStats; ref_: Ref }): React.JSX.Element | null {
  const chips: string[] = [];
  for (const stat of LEDGER_STATS) {
    for (const row of stats.modifiers[stat]) {
      if (row.ref !== ref_) continue;
      chips.push(`${row.amount >= 0 ? '+' : '−'}${Math.abs(row.amount)} ${STAT_WORD[stat]}`);
    }
  }
  if (chips.length === 0) return null;
  return (
    <span className="row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      {chips.map((c) => (
        <span key={c} className="chip" style={{ color: 'var(--hope)' }}>
          {c}
        </span>
      ))}
    </span>
  );
}

/**
 * What a Beastform takes away, said on the row it takes it from.
 *
 * *"While transformed, you can't use weapons or cast spells from domain cards,
 * but you can still use other features or abilities you have access to."*
 *
 * MARKED AND NOT REFUSED, which is a decision and not an oversight. The rows
 * stay armable. This app has one house rule about rules it cannot enforce -
 * show what changed, never take the control away - and the Beastform strip is
 * where it is clearest: it prints the Evasion the form replaced, struck
 * through, rather than hiding the number. A greyed-out weapon would be the app
 * refusing a thing a GM may well have allowed, and the same question was
 * already answered this way once, for the companion's level-up boxes.
 *
 * THE SECOND HALF OF THE SENTENCE IS WHY THERE ARE TWO WORDINGS. A weapon is
 * simply out. Spellcast is not: the rule removes spells *from domain cards*,
 * and a Spellcast Roll a subclass feature asks for - Nightwalker's "Dark
 * Cloud", the Beastbound's own command to their companion - is one of the
 * "other features or abilities" the same sentence protects. A single
 * UNAVAILABLE across both would be the app inventing a stricter rule than the
 * book's and printing it in the book's voice.
 *
 * The loadout rows are deliberately not marked. A 46px row on a 393px phone
 * already carries domain, level, type and Recall cost under a name that
 * ellipsises, and the only mark that would fit is a colour - which this
 * codebase does not accept as a sole signal, `shapeCoding` being the standing
 * proof. The rows that declare an attack are marked, and that is where an
 * attack is declared.
 */
function BeastformSeal({ what }: { what: string }): React.JSX.Element {
  return (
    <span
      className="t-meta"
      style={{ display: 'block', marginTop: 5, color: 'var(--sage)', letterSpacing: '0.05em' }}
    >
      {what}
    </span>
  );
}

/**
 * A weapon this build cannot name, drawn where its row would have been.
 *
 * ## What was here before, measured
 *
 * Nothing. `Equipped` resolved both weapon slots with `index.weapons.get`, got
 * `undefined` for a ref the bundle no longer prints, and `[primary, secondary]
 * .filter(Boolean)` then dropped it - so a character holding one had no row, no
 * marker and no warning anywhere on this screen, while the armor one slot over
 * announced itself in the defence band and an unreadable domain card drew
 * `GhostRow`. The weapon slots were the only silent ones, and they are the
 * slots that carry a damage die. See `tests/ui/weapons-vanish.test.tsx`.
 *
 * ## Why this is a `<div>` and not a `<button>` like every row beside it
 *
 * READ, NOT TOUCH, and that is the whole design of this row. Every other row in
 * this section is armable: tapping one declares it, and `DualityRoll` then
 * offers its damage. There is nothing to declare here - no trait, no range, no
 * dice - so a control would be a `var(--tap)` target in the middle of the thumb
 * arc that answers a tap with nothing at all, which teaches the player that the
 * ROW is broken rather than that the WEAPON is missing. It costs no target and
 * it takes no reach: it is a paragraph, in the place where the sentence it
 * corrects would have been.
 *
 * ## Why it is not marked by colour alone
 *
 * `1px dashed` all round, against the solid `panel` border every real row
 * carries, plus a `var(--damage)` spine where an armed row has `var(--hope)`
 * and an idle one has `var(--edge)`. The dash is the signal; the colour agrees
 * with it. `shapeCoding` is the standing proof in this codebase that colour on
 * its own is not accepted, and the domain-card `GhostRow` above is drawn the
 * same way for the same reason.
 *
 * It names the ref, because that is all anybody has to go on - it is what a
 * newer bundle, or the device this sheet came from, would resolve - and it says
 * which of the two slots it was in, because there are two and they fail
 * identically.
 */
function VanishedWeapon({
  slot,
  refId,
}: {
  slot: 'PRIMARY' | 'SECONDARY';
  refId: Ref;
}): React.JSX.Element {
  return (
    <div
      className="stack"
      style={{
        flex: 'none',
        gap: 4,
        borderRadius: 'var(--r3)',
        background: 'var(--app)',
        // Per side, and not the `border` shorthand: a shorthand carrying a
        // `var()` is dropped outright by jsdom's CSS parser, so the dash - the
        // signal that is not a colour - would exist in Chrome and be invisible
        // to every test that looks at the element. Three sides plus the spine
        // survive both.
        borderTop: '1px dashed var(--edge)',
        borderRight: '1px dashed var(--edge)',
        borderBottom: '1px dashed var(--edge)',
        borderLeft: '3px solid var(--damage)',
        padding: '10px 11px',
      }}
    >
      <span className="spread">
        <span className="t-meta" style={{ color: 'var(--damage)', letterSpacing: '0.08em' }}>
          WEAPON NOT IN THIS BUILD
        </span>
        <span
          className="t-meta"
          style={{ flex: 'none', color: 'var(--dim)', letterSpacing: '0.08em' }}
        >
          {slot}
        </span>
      </span>
      <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
        {refId}
      </span>
      <span className="t-hint" style={{ color: 'var(--text-2)' }}>
        No damage this build can roll — choose again in Build.
      </span>
    </div>
  );
}

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
  const rules = useApp((s) => s.dataset.rules);
  const reaches = useMemo(() => rangeDistances(rules), [rules]);
  if (!character) return null;

  /*
   * The reach, and what the book says it is - worded once, because the weapon
   * rows and the Beastform row below both print it and two spellings of one
   * range is two ranges eventually.
   *
   * Null feet is Melee, which the SRD gives no figure for, and every range at
   * all if the dataset carries no range section. In both cases the word stands
   * alone, which is what these rows said before there was anything to add.
   */
  const reachOf = (range: string): string => {
    const feet = reaches.get(range.toLowerCase())?.feet ?? null;
    return feet === null
      ? range.toUpperCase()
      : `${range.toUpperCase()} ${feetRange(feet).toUpperCase()}`;
  };

  const primary = character.activePrimaryWeapon
    ? index.weapons.get(character.activePrimaryWeapon)
    : undefined;
  const secondary = character.activeSecondaryWeapon
    ? index.weapons.get(character.activeSecondaryWeapon)
    : undefined;
  const armor = character.activeArmor ? index.armors.get(character.activeArmor) : undefined;
  /*
   * The two slots that hold a ref this build cannot name, which used to resolve
   * to `undefined` and be filtered away with the empty ones. Read as a pair off
   * `unresolvedWeapons` rather than tested twice here: the whole failure of the
   * thing this replaces was that the two weapon fields were handled apart, and
   * the map below now walks BOTH slots by name so a row can no longer be
   * repaired for one of them alone.
   */
  const missing = unresolvedWeapons(character, index);
  const unarmed = arming.declared?.kind === 'unarmed';
  const worn = stats.beastform;
  const beast = beastformSource(stats);
  const armedBeast = arming.declared?.kind === 'beastform';

  return (
    // flex: none, because this lives inside a scrolling flex column and a flex
    // child shrinks by default - which squashed the whole section to nothing
    // and left its label sitting on top of the next one.
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      {!bare && <div className="t-label">Equipped</div>}
      {/* And the empty-state gate counts the unreadable refs, because a sheet
          holding a weapon this build cannot name is not a sheet with nothing
          equipped - it is the one case this section now has something to say
          about, and printing «Nothing equipped» over it would be the app
          contradicting the row directly underneath. */}
      {primary === undefined &&
        secondary === undefined &&
        armor === undefined &&
        missing.primary === null &&
        missing.secondary === null && (
          <div className="panel t-hint" style={{ padding: '12px 11px', color: 'var(--dim)' }}>
            Nothing equipped — choose gear in Build.
          </div>
        )}
      {/*
       * THE FORM'S OWN ATTACK, WHICH THIS SCREEN COULD NOT ROLL.
       *
       * It sits above the weapons because while it is here the weapons are the
       * two things the rule takes away, and a player reaching for an attack
       * should meet the one they have first. `Beastform.tsx` prints the same
       * dice up in the identity strip, unmultiplied, as part of the form's
       * stat line; this is the same attack as something you can declare, with
       * Proficiency applied - `d12+10` there and `4d12+10` here, which is the
       * difference between reading a stat block and rolling it.
       */}
      {worn !== null && beast !== null && beast.kind === 'beastform' && (
        <button
          type="button"
          aria-pressed={armedBeast}
          onClick={() => arming.arm(armedBeast ? null : { kind: 'beastform' })}
          className="panel"
          style={{
            borderLeft: `3px solid ${armedBeast ? 'var(--hope)' : 'var(--sage)'}`,
            background: armedBeast ? 'var(--hope-wash)' : undefined,
            padding: '10px 11px',
            textAlign: 'left',
            minHeight: 'var(--tap)',
          }}
        >
          <span className="spread">
            <span style={{ font: '700 14px/1.15 var(--sans)' }}>{worn.form.name}</span>
            <span className="t-num" style={{ color: 'var(--hope)' }}>
              {formatDamage(beast.damage)}
            </span>
          </span>
          <span
            className="t-meta"
            style={{ display: 'block', marginTop: 5, letterSpacing: '0.05em' }}
          >
            {armedBeast ? 'ARMED · ' : ''}
            {TRAIT_LABELS[beast.trait].toUpperCase()} · {reachOf(worn.form.attack.range)} ·
            PHYSICAL
          </span>
        </button>
      )}
      {(
        [
          { slot: 'PRIMARY', weapon: primary, gone: missing.primary },
          { slot: 'SECONDARY', weapon: secondary, gone: missing.secondary },
        ] as const
      ).map(({ slot, weapon: w, gone }) => {
        // The unreadable ref FIRST, and in the slot's own place in the order,
        // so the sheet reads primary-then-secondary whichever of the two the
        // build has lost.
        if (gone !== null) return <VanishedWeapon key={slot} slot={slot} refId={gone} />;
        if (!w) return null;
        // weaponDamage, not a regex. The inline `replace(/^(\d*)d/, ...)` that
        // used to live here is exactly what the note in
        // sheetModel.ts::describeWeapon warns against - two routes to one
        // number is two numbers eventually, and this one had no clamp.
        const scaled = weaponDamage(w, stats);
        const dice = scaled?.spec ?? w.damage;
        const isArmed = arming.declared?.kind === 'weapon' && arming.declared.ref === w.id;
        const reach = reachOf(w.range);
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
              {reach} · {damageKindLong(w.damageType).toUpperCase()}
            </span>
            {/*
             * THE WEAPON'S OWN FEATURE, WHICH THIS ROW HAS NEVER DRAWN.
             *
             * A Greatsword said `2d10+3` and nothing else, so *"Massive: -1 to
             * Evasion; on a successful attack, roll an additional damage die and
             * discard the lowest result"* - a sentence that changes both a number
             * in the band above and how every attack is rolled - existed for this
             * player only in the Build screen they last saw at character
             * creation. Half of it is arithmetic the engine now does and half of
             * it is a rule only a person can apply, and neither half was here.
             *
             * A `<span>` and not a `<div>`: this row's root is a `<button>`, and
             * a button may only contain phrasing content. React does not police
             * that one, so the browser is left to guess - the same note stands
             * over `FeatureBlock` in `build/parts.tsx`.
             */}
            {w.feature !== '' && (
              <span className="t-read" style={{ display: 'block', marginTop: 5, color: 'var(--text-2)' }}>
                {w.feature}
              </span>
            )}
            {worn !== null && <BeastformSeal what="UNAVAILABLE WHILE TRANSFORMED" />}
            <GearEffects stats={stats} ref_={w.id} />
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
          {/* And what the armour DOES, which this row printed no word of - so a
              Gambeson's «Flexible: +1 to Evasion» was invisible on the one
              screen where the Evasion it changes is drawn. */}
          {armor.feature !== '' && (
            <div className="t-read" style={{ marginTop: 5, color: 'var(--text-2)' }}>
              {armor.feature}
            </div>
          )}
          <GearEffects stats={stats} ref_={armor.id} />
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
      {stats.beastform !== null && (
        <BeastformSeal what="NO DOMAIN SPELLS WHILE TRANSFORMED · OTHER FEATURES STILL WORK" />
      )}
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
                font: '600 0.8125rem/1 var(--mono)',
              }}
            />
          </label>
        </div>
      ) : (
        <span className="t-hint">
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
        <div className="panel t-hint" style={{ padding: '12px 11px', color: 'var(--dim)' }}>
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
                    /*
                     * The floor is a floor on both axes, and this button
                     * declared only the height.
                     *
                     * Its width came entirely from `.chip`'s own
                     * `padding: 4px 6px` around the label - there is no
                     * horizontal padding declared here, and `base.css:42-50`
                     * zeroes a button's border. `.chip` was IBM Plex Mono at
                     * 9.5px with `letter-spacing: 0.06em` when this was measured
                     * (11px on a phone since the readability ramp), and the shipped
                     * `plexmono-600-latin.woff2` is a flat 600/1000 advance, so
                     * a character is 9.5 x 0.6 + 9.5 x 0.06 = 6.27px and `USE`
                     * is 3 x 6.27 + 12 = **30.81px**. Measured 30.8x44, and it
                     * is width-invariant: the number is the same at 320 as at
                     * 1179, because nothing in it reads the viewport.
                     *
                     * `var(--tap)` and not `var(--control)`, which is the token
                     * the same omission was closed with in `Cards.tsx`,
                     * `GearPicker.tsx` and `Conditions.tsx`: the two resolve
                     * identically everywhere this control exists - `Items` is
                     * only ever mounted from the phone column, which stops at
                     * 1179, and `--control` is `var(--tap)` at 1179 and below -
                     * and this button's own height already says `--tap`. A pair
                     * of floors on one control written in two tokens would be
                     * claiming a difference that is not there.
                     *
                     * It clears WCAG 2.5.8's 24px on both axes. The floor it
                     * breaks is this project's own 44/34, which is the honest
                     * and sufficient charge.
                     *
                     * ERGONOMICS. **Target size:** 30.81 -> 44 is +13.19px, and
                     * it is taken from the name beside it, which is the only
                     * flexible thing in the row. At 393x852 the row's content
                     * box is 345px (369 of column inside `0 12px 8px`, less 2
                     * of `.panel` border, less 22 of its padding), so the name
                     * goes 306.19 -> 293; at 320 it goes 233.19 -> 220. The
                     * longest name in the SRD, `Improved Grindletooth Venom`,
                     * is 194.0px at 600/14 Archivo and still fits both. The one
                     * case that crosses is that name carrying a three-digit
                     * count - 194.0 + 7 of margin + 3 x 6.6 of `.t-meta` mono =
                     * 220.8 against 220 at 320 wide - and it wraps to a second
                     * line rather than clipping, because the name has no
                     * `white-space: nowrap`. A player-typed name longer than
                     * that wraps 13.19px sooner than it used to. That is the
                     * whole cost.
                     * **Thumb arc:** `Carried` is low in the phone column,
                     * under the counters, the traits and the weapons, so on a
                     * 393x852 phone these rows sit in the lower half of the
                     * scroll - the comfortable part of a right thumb's sweep -
                     * and USE is at the right end of the row, which is the near
                     * end of that sweep. That is the correct place for it and
                     * the reason the width mattered: a 44px-tall, 30.81px-wide
                     * target on the outside edge of the arc is the one geometry
                     * where the overshoot axis and the short axis are the same
                     * axis.
                     * **Read versus touch:** the name is read first and is to
                     * the left; the printed text of the item is read second and
                     * only after expanding, below both; the verb is the last
                     * thing on the line and the only thing that spends
                     * anything.
                     *
                     * NO SECOND TAP, DELIBERATELY. A spend here is recoverable:
                     * `parts.tsx:707-710` gives every inventory row a quantity
                     * field in Build, so the number can be typed back. What it
                     * is not is silent - the log line this writes stays written
                     * - so "recoverable but not silent" is the accurate charge,
                     * and it is not enough to justify arming a control a player
                     * presses several times an evening. The floor on both axes
                     * is the whole fix.
                     */
                    minWidth: 'var(--tap)',
                    background: 'var(--raised)',
                    color: 'var(--text)',
                  }}
                >
                  USE
                </button>
              )}
            </div>
            {showing && entry.note !== undefined && (
              <p className="t-read" style={{ margin: '6px 2px 2px', color: 'var(--text-2)' }}>
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
          <div className="panel t-hint" style={{ padding: 14, color: 'var(--dim)' }}>
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
                  font: '600 0.75rem/1 var(--sans)',
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
          <span className="t-hint" style={{ color: 'var(--dim)' }}>
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
        <div className="panel t-hint" style={{ padding: 14, color: 'var(--dim)' }}>
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
        <Identity stats={stats} />
        <TraitGrid stats={stats} trait={trait} onPick={chooseTrait} />
        <Defenses stats={stats} />
        <Equipped stats={stats} arming={arming} />
        {/*
         * The features, in the cockpit's own column and NOT behind a fold.
         *
         * The phone puts them inside the `Lineage, domains & features` fold
         * because its column has thirteen pixels of slack at 375x667 and a
         * seventh full-width fold costs fifty-two. This column has no such
         * budget: it is `.stack scroll`, it already carries `Rest` - a fold
         * this repo measures at about 990px open - and it is the one column on
         * the cockpit with an end a reader is meant to reach. So the list is
         * open, under a heading, where a mouse can wheel to it.
         *
         * Above `Rest` rather than below it: a feature is read mid-scene and a
         * rest is taken between scenes, and `Rest` open is the tallest thing on
         * this screen. Putting the features after it would put them a thousand
         * pixels down whenever a player left the rest fold open.
         */}
        <div className="stack" style={{ flex: 'none', gap: 8 }}>
          <div className="t-label">Features</div>
          <FeatureList stats={stats} />
        </div>
        {/*
         * The dice pools, for the four archetypes that have one.
         *
         * Renders nothing at all for everyone else - a Ranger has no pool and
         * must not be charged a heading for a Seraph's dice. In this column
         * rather than the middle one because it is read and pressed between
         * rolls rather than during one, and because this is the column that
         * scrolls.
         */}
        <DicePools stats={stats} />
        {/* Last, and in this column rather than one of the other two, because
            this column is the one that scrolls: a fold measuring about 990px
            open costs the cockpit nothing here and would cost it everything
            anywhere else. `cryptoRng` is passed rather than defaulted so that
            the one place a rest can roll is visible from this file. */}
        <Rest stats={stats} rng={cryptoRng} />
        {/*
          And the licence notice under it, in this column for the same reason
          `Rest` is in this column: this is the column with an end a player is
          meant to reach.

          THE SENTENCE THAT USED TO BE HERE IS FALSE NOW. It said "the cockpit
          itself is laid out to fit, so there is no 'end of the page' anywhere
          else on this screen - the middle column ends at ROLL and the right one
          at the vault, both of which are meant to be on the glass at all
          times". The middle column does not end at ROLL and is not laid out to
          fit: it ends at the roll log, and the panel holding both scrolls.
          Measured at 1180x695 with five Experiences and the backup banner up,
          313 of panel against 445 of content, with ROLL painted 0 of 54 until
          you scroll. The docblock over `DualityRoll`'s desktop branch carries
          the table; `Play`'s own docblock at the head of this file was
          corrected in the same pass and this line was missed.

          The placement survives the correction, for what was underneath it: the
          middle column's end is a readout you scroll to when you want it and
          the right one's is the vault, so a 342-character paragraph under
          either would be something you hit while looking for something else.
        */}
        <LicenceFooter />
      </div>

      <div className="stack" style={{ gap: 12, minHeight: 'var(--control)', minWidth: 0 }}>
        <Vitals stats={stats} layout="desktop" arming={arming} />
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
              /*
               * THE FOOTER IS THE TARGET, not a word floating in the middle of
               * it.
               *
               * This was a bare `<button className="t-meta">TO VAULT</button>`
               * with no height, no width and no padding, inside a band that
               * `DomainCardView` holds open at `max(34px, var(--control))`
               * precisely so the card's one action can fill it. Measured in
               * Chrome: **56x10** at 1280 and 1440 and **35x20** at 1180, where
               * the cell narrows to 127.3 and the label wraps - five of them,
               * one per loadout card. 10px of a 34px band, and 34 of 44 on any
               * touchscreen, so 24 of the band's pixels activated nothing; a
               * hit test 4px above the band returned the overlay button that
               * opens the reader instead. On the cockpit this is the loadout's
               * only per-card action and the only way to free a slot from the
               * Play screen at all.
               *
               * `alignSelf: 'stretch'` is what does it - the footer is
               * `alignItems: 'center'`, so a child with no declared height is
               * centred at its own line box - and the negative margin against
               * the footer's own `0 11px` padding is the trick `CardReader`'s
               * CLOSE already uses to reach the edges. The result is
               * **103.3x34 at 1180, 136.7x34 at 1280 and 190x34 at 1440**, and
               * x44 wherever `--control` resolves to `--tap`: 3511px² against
               * 560 at the worst width, 6.3 times the target for the same
               * pixels. Two 10px lines and a 3px gap are 23 inside 34, so the
               * two-line 35x20 case at 1180 is gone with it.
               *
               * COST comes inside the target rather than beside it, which is
               * `RecallButton`'s shape eleven rows down: the price is what you
               * read before deciding, and it now rides in the accessible name
               * too. The overlay that opens the card still stops at the band's
               * top edge - it is positioned from the card's body, so it ends
               * where the band begins at any height - so a high miss opens
               * the card and a low one vaults it: no new ambiguity, and the
               * dead strip between them is gone.
               */
              footer={
                <button
                  type="button"
                  className="stack"
                  aria-label={`Move ${card.name} to the vault, recall cost ${String(card.recallCost)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (character) update((c) => vaultCard(c, card.id));
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    alignSelf: 'stretch',
                    /*
                     * -1px at the top, and it is the difference between
                     * clearing the floor and missing it by one. The band's
                     * `minHeight: FOOTER_HEIGHT` is a border-box floor under
                     * this app's global `box-sizing`, and the band's 1px
                     * `borderTop` is inside it, so a stretched child measures
                     * 33 of the 34 - and 43 of the 44 `--control` resolves to
                     * on a touchscreen, which is a pixel under the floor this
                     * project states. The negative margin takes the *target*
                     * over that hairline without painting anything on it. The
                     * overlay that opens the reader ends at the same edge,
                     * and this button is later in the DOM inside a `zIndex:
                     * 2` footer, so the one pixel they share resolves here.
                     */
                    margin: '-1px -11px 0',
                    padding: '0 11px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    letterSpacing: '0.1em',
                  }}
                >
                  <span className="t-meta" style={{ color: 'var(--text)', fontWeight: 700 }}>
                    TO VAULT
                  </span>
                  <span className="t-meta" style={{ color: 'var(--muted)' }}>
                    COST {card.recallCost}
                  </span>
                </button>
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
              {/* This one always declared `minHeight`, which is the same
                  file's own proof that the loadout card's bare button was an
                  oversight and not a policy. `minWidth` joins it so the pair
                  says the whole rule: a ghost slot's ref can be short enough
                  that a `.stack` child stretched to it is under the floor. */}
              <button
                type="button"
                className="t-meta"
                onClick={() => update((c) => vaultCard(c, refId))}
                aria-label={`Move the unreadable card ${refId} to the vault, freeing its slot`}
                style={{
                  minHeight: 'var(--control)',
                  minWidth: 'var(--control)',
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
 * heights at 393x852, every fold shut and nothing armed: the defence band 56 -
 * which carries the incoming-damage field *and* the conditions door as its
 * fifth cell, for nothing, because a 44x44 door and a 64x44 field both fit
 * inside a row the numbers hold open at that same 56, six pixels of clearance
 * either side of each - the four counters **186** as a 2x2 grid of cards,
 * the trait row 44, and the roll row 56, a floor rather than the hard 66 it was,
 * with the ten pixels the first of the reflow's savings. ROLL stands beside a
 * MODS control that costs the column nothing, because it is 44 wide inside a
 * height ROLL was already holding. Plus three of this column's 14px gaps and
 * its own 8px of top padding.
 * **ROLL's lower edge lands at 392 of a usable 730** (852 less the header's
 * 52+1, the tab bar's 60+1 and this root's own 8px foot), which is 338px of
 * slack.
 *
 * THE COUNTERS ARE 186 AND THAT IS THE ONE THING THIS REFLOW BUYS RATHER THAN
 * SELLS. Each track is a card 90px tall: its name and mark, a **38px** number,
 * and the maximum on a line of its own, centred on one axis inside 7px of
 * padding. The maximum moving off the value's line is what let the number grow
 * - beside it, `11 / 11` measured 68.92 of the 74 the target has, so WIDTH and
 * not height was the ceiling, and every size from 28 to 38 was rendered before
 * this one was chosen. Below viewport 390 the card is 56, around a 22px number
 * from 380 up and an **18px** one below that - so a 375px iPhone and a 360px
 * Android both read 118 here, at 18. (`--counter-num` has three steps and only
 * the top two are this reflow's; 22 lives between 380 and 389, which is a band
 * no phone this project measures reports.)
 *
 * AT 375x667 THE SAME STACK IS 324 - no 390 step, so the card is 56 - AND IT
 * CLEARS A 545px COLUMN BY 221px, where before the
 * counters became a grid it cleared it by ten. Not one of the ordinary states
 * this budget cannot see costs the small phone its margin: typed dice, which
 * are the dearest of them at **+68**, a companion (**+50**), a Beastform
 * banner (+52), an armed modifier (+50), and the 34px home-indicator inset. The
 * companion was **58** for two passes and is 50 again, and the difference is
 * the thing the 58 was right to count and the reflow removed. `WhoSwitch`
 * (`Companion.tsx:61-121`) is drawn `compact={!phone}`, so on a phone its
 * buttons are `minHeight: 44`; they used to sit inside `padding: 3` on both
 * edges and a 1px border on both - a **52px** box drawn to hold 44 of target -
 * and it is a child of the `Vitals` panel whose phone `gap` is 6
 * (`Vitals.tsx:71`), which no other child was paying before it appeared. That
 * was 44 + 3 + 3 + 1 + 1 + 6 = **58**. The box is a rule now, drawn as an inset
 * shadow so the hairline costs no height, and it is 44 + 6 = **50**. There used
 * to be a sixth and it used to be the dearest - pips, at +100 - and decision 7
 * deleted `counterStyle`, its switch and every branch on it, so the 194px shape
 * is not reachable from this screen on any layout. The four counters are numbers
 * here and in the cockpit; pips survive on the party board, the live scene and
 * the companion, where you are reading somebody else's state rather than marking
 * your own.
 *
 * AND THE WHOLE FOLDED SHEET FITS, WHICH IT DID NOT UNTIL P5-8 AND NOW FITS
 * TWICE OVER. **600px against 730 at 393x852, with 130 to spare** - every fold
 * shut, the `playedCharacter` fixture, and re-measured in Chrome rather than
 * re-summed: the distance from the top of the defence band to the bottom edge
 * of the last fold header is **592.0** at 393 and **524.0** at 375 and 360, and
 * the column's own 8px of top padding takes those to 600 and 532. That is the
 * condition P5-5's own decision 1 made the unpinning conditional on, unmet
 * through P5-5 (899, over by 169) and P5-6 (749, over by 19), met at P5-8 (697,
 * 33 to spare) and now clear by 130. It fits at 744x1133 with 472 to spare.
 *
 * IT DOES NOT FIT A SAFARI TAB, AND THAT IS A DECISION RATHER THAN A MISS. That
 * column is about 515 and the sheet is 600, so the last two folds and the
 * licence notice are a thumb-flick down. The owner was given the arithmetic and
 * chose the larger numbers over the single screen, in those words: «aria vera,
 * e pazienza se scrolla». Everything a turn touches - thresholds, tracks,
 * traits, ROLL - is above the fold at that height.
 *
 * **AND IT FITS 375x667, WHICH IT NEVER HAS.** 532 against 545, 13 to spare.
 * That sheet was 204px over, then 152, then 49; the pairing took four fold rows
 * down to two and closed it. «Vedere in una volta sola tutta la scheda» is now
 * literally true on both reference phones rather than on the larger one only.
 *
 * **AND IT FITS A 360x800 ANDROID FOR THE FIRST TIME**, which the report
 * predicted it would not: 532 against 678, 146 to spare, measured. The report's
 * own closing table had 360x800 at -2 because it costed decision 5 without the
 * width fix beside it - a taller chip is not a narrower one - and with the
 * trait row's basis at 44 and the damage cell wrapping rather than overflowing,
 * the 62px that ate it is not spent. With two conditions on, the strip is back
 * in its slot and the sheet is 584 against 678, which still fits.
 *
 * 360 is below every one of the reflow's steps - `--counter-cell`,
 * `--counter-num`, the card's own padding and gap, and `--damage-w` - so the
 * narrowest phone this app supports keeps an **18px** number in a 56px card and
 * a 44px damage field. It is below the 380 step as well, which is older than
 * this reflow, so 22 is not what it keeps either. It pays for the card's third
 * line and for nothing else.
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
 * AND THE OTHER BUDGET, WHICH HAD NEVER BEEN WRITTEN AT ALL. Everything above is
 * vertical and is computed for 393x852 and 375x667. There was no horizontal
 * budget, and three separate declared sums each overran the column with nothing
 * in the repo saying so: the trait row wrapped at every viewport <= 367 (+48,
 * and on a 360px Android the second row held nothing but the 44x44 chevron), the
 * incoming-damage cell overflowed its grid track *leftwards* and painted its
 * label and its 58px field over the Proficiency panel below viewport 353, and
 * the 2x2 counter grid was pinned at a viewport-independent 325.37 with the `+`
 * on STRESS and ARMOR cut off the glass by this column's own `overflowX:
 * 'hidden'` - 17.4px of a 44px target at 320, and no gesture of any kind brings
 * a hidden overflow back.
 *
 * **THE SMALLEST WIDTH THIS SHEET IS LAID OUT FOR IS 360**, and that is a
 * decision rather than a discovery: 360 is the commonest Android viewport there
 * has ever been. The three sums are 332, 328.47 and 274, whose floors are 356,
 * 352.47 and 298, and `playSheet.test.tsx`'s «the width this sheet is laid out
 * for» carries them the way «the budget the pin came off for» carries the
 * vertical ones. Everything below 360 reflows and nothing breaks: under 356 the
 * trait row is two 44px lines (+48), under 348 the damage cell is two lines and
 * the band goes 56 -> 94 (+38), a `Disclosure` summary that will not fit ends in
 * an ellipsis, and the counter cells shrink and clip their own labels inside
 * targets that keep their declared size. Verified in Chrome at 297, 298, 310,
 * 320, 344, 347, 348, 360, 375, 380, 384, 390, 393 and 744: nothing painted past
 * the clip edge, no overlap, and no target under 44 in either direction at any
 * of them. (286 and 310 were the counter sum and its floor while the card still
 * had two 4px gutters; 353 and +30 were the band's crossing while its fifth
 * track was the flexible one.)
 *
 * 320 IS NOT SUPPORTED AND IS NOT BROKEN, which is the same distinction 375 has
 * always had here. At 344 and 320 the defence band and the trait row each
 * reflow onto a second line and the folded sheet measures **610**, so 618 of
 * column: at 320x568 that is 172 over a 446px column and it scrolls. 375 no
 * longer does. What scrolling does not do is hide anything or put anything out
 * of reach.
 *
 * WHAT IT STILL DOES NOT DO, SAID PLAINLY. A home-indicator iPhone installed as
 * a PWA pays `env(safe-area-inset-bottom)`, which is 34px and which this repo
 * has always treated as 0. That takes the 393x852 column from 730 to 696, which
 * this sheet now clears by 96 where P5-8's 697 was one pixel over. `BackupBanner`
 * is the other one the budget has never counted: it costs this column **66**
 * from first launch until the first backup is taken, so a new user's column is
 * **664** - and 600 clears that by **64**, where 697 was 33px over it.
 *
 * *(~~58, a 672px column and 54 to spare~~ - superseded, and it is the same
 * mistake as the companion's +50 above: 58 is the banner's border
 * box, and what the screen under it loses is the border box **plus its 8px top
 * margin**. `<main>` is a flex column and a banner is a `flex: none` child, so
 * that margin does not collapse into anything. Measured banner off -> on and
 * identical at all four iPhone widths - 553->487 at 375x667, 738->672 at
 * 393x852, 760->694 at 402x874, 818->752 at 430x932. `ShellBanner.tsx:35-54`
 * holds the measurement and names this file's error outright; the 730 above is
 * already net of the phone root's own 8px foot, which is why 738 of glass minus
 * 66 of banner is 664 of budget and not 672.)*
 *
 * AND THERE ARE TWO BANNERS, WHICH IS THE STATE THIS BUDGET USED TO FAIL. `UpdateBanner`
 * is the other `ShellBanner`, and a new user with a service worker already
 * waiting gets both at once - a first launch on a second visit is not an exotic
 * path. Measured rather than doubled, because two stacked 8px margins are
 * exactly where adding up would be wrong if they collapsed: 738 -> 672 -> **606**
 * of glass at 393x852, so **132** off this column and **598** left of the 730.
 * The folded sheet takes 600 against that 598, so **it is 2px over** and that
 * state scrolls, like the Safari tab and for the same reason. It passed by 12
 * after the reflow's first three savings and by 82 after the pairing; the
 * counter card spent both. Neither banner may be deleted:
 * they are P0-2's remedy, and a banner nobody sees is the defect they fix.
 * `playSheet.test.tsx` does not know either exists; `tests/ui/banners.test.tsx`
 * adds the costs up out of the declarations so 66 and 132 cannot drift.
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
 * above: at least the 126.16px the notice measures on a 369px column at
 * 393x852, taken off a 730px column permanently, on the tightest budget in the
 * app - and a pinned strip painted a panel and its own horizontal padding on
 * top of that. ("111px" stood here; it was the estimate the superseded argument
 * in `LicenceFooter.tsx` makes, and it was short by the border it forgot to
 * add.) That argument was about a *pinned* strip, and there is no longer one. As
 * the last child of the scroll the notice is below the lineage fold, which is
 * where the 600 ends, so it moves no term of `STACK`, no term of `INDEX` and
 * neither total. It is the one thing on this column a player never has to
 * reach, and that is exactly the property that lets it sit past the end.
 */
/**
 * Two fold headers sharing one row of the phone's column, and what happens when
 * one of them opens.
 *
 * THE 104 PIXELS. Six shut folds were six 44px rows around one 10px line each -
 * 264px of column carrying 60 of ink, 77% of it air - while the four blocks
 * above them held 258px of numbers in 282. The owner looked at that on their own
 * phone and said «è tutto attaccato sopra», which is the same observation from
 * the other end. Two pairs turn four of those rows into two: 88px and two of
 * this column's gaps, 104 in total, and it is the largest single saving in the
 * reflow. Some of it is spent on air between the blocks that were crammed; the
 * rest is the margin that puts the folded sheet inside a Safari tab's column.
 *
 * TWO PAIRS AND NOT THREE. `Carried` cannot take a half cell - its worst
 * summary is 257.41px against a 181.5px one - and with `Lineage & domains`
 * staying on this column by the owner's decision, those two are the sheet's
 * last two full-width rows. Pairing is not free to hand out: the member has to
 * have a short name AND a short summary at 360, which is where they are
 * measured.
 *
 * WHAT OPENING DOES, WHICH IS THE PART A GRID GETS WRONG BY DEFAULT. The member
 * you press takes the full width and its partner drops below it - so the header
 * the thumb just hit does not move, and the one it is not on does. `order: -1`
 * on the open member and one column instead of two is the whole mechanism: if
 * the second member is the one that opened, it stays on the row it was on and
 * only grows leftwards, which is the property being bought. Reverting to two
 * stacked rows in DOM order would move the header out from under the finger
 * that just landed on it, half the time.
 *
 * Both members go back to one-line headers while the pair is open, because at
 * full width there is room for one and it is the shape every other fold has.
 *
 * PHONE ONLY. The cockpit and `Rest`'s own surface draw the same `Disclosure`
 * with the same `usePlaySection` key and are untouched: what is paired is not
 * the section, it is this column's row.
 */
function FoldPair({
  openFirst,
  openSecond,
  first,
  second,
}: {
  openFirst: boolean;
  openSecond: boolean;
  first: React.ReactNode;
  /** Null when the second fold is not drawn at all: the first takes the row. */
  second: React.ReactNode | null;
}): React.JSX.Element {
  const anyOpen = openFirst || openSecond;
  // One column when a member has opened, and also when there is only one member
  // to draw: a pair with a hole in it is not a pair, it is a half-width header
  // beside 181.5px of nothing.
  const oneColumn = anyOpen || second === null;
  return (
    <div
      style={{
        display: 'grid',
        flex: 'none',
        gridTemplateColumns: oneColumn ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
        // 6 across a pair and 8 down an open one: the gutter between two halves
        // of one row is tighter than the distance between two sections, because
        // that is the difference it has to say.
        gap: anyOpen ? 8 : 6,
      }}
    >
      {/*
       * `minWidth: 0` on both, and it is load-bearing rather than tidy: a grid
       * item's automatic minimum is its min-content, and a fold header's
       * min-content is its longest unbreakable word plus its summary. Without
       * it the track refuses to be 181.5 wide and the pair overflows the column
       * - which `Play`'s `overflow-x: hidden` would then cut in silence.
       */}
      <div style={{ minWidth: 0, order: openFirst ? -1 : 0 }}>{first}</div>
      <div style={{ minWidth: 0, order: openSecond ? -1 : 0 }}>{second}</div>
    </div>
  );
}

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

  /*
   * Whether each of the four paired folds is open, read HERE and not inside
   * `FoldPair`, for two reasons that both matter.
   *
   * A pair is a layout, and a layout component that reaches into the preference
   * store to find out what shape it is cannot be reasoned about from the call
   * site - and this call site is where the column's whole arithmetic lives.
   * More concretely: the answer is needed twice, by the grid AND by each
   * `Disclosure`'s `stacked`, and a component that computed it privately would
   * have to hand it back out again.
   *
   * Above the `!character` guard because these are hooks. `usePlaySection`
   * takes a null id and answers `false`, which is the right answer for a screen
   * with no character on it.
   */
  const folded = character?.id ?? null;
  const [equippedOpen] = usePlaySection(folded, 'equipped');
  const [experiencesOpen] = usePlaySection(folded, 'experiences');
  const [cardsOpen] = usePlaySection(folded, 'cards');
  const [restOpen] = usePlaySection(folded, 'rest');
  /*
   * Whether this character has a dice pool at all, read here because it is a
   * hook and this is above the `!character` guard. It is the gate on a fold
   * that is drawn for four archetypes and nobody else - see the note beside
   * the fold itself for what it costs the column when it IS drawn.
   */
  const pools = usePoolsFor(stats);

  if (!character) return <div />;

  /*
   * What the shut fold says is in it, counted off what the fold DRAWS.
   *
   * That is why the weapons and the armor are not counted the same way, and the
   * asymmetry is deliberate. A weapon whose ref this build cannot name is now
   * drawn - `VanishedWeapon`, naming the ref - so it counts. An armor in the
   * same state is not drawn in this section at all: it announces itself in the
   * defence band, which is outside this fold and on screen without opening it.
   * A summary that disagreed with its own contents would be worse than either
   * number on its own, which is the same sentence `GhostRow` is written under.
   *
   * The lookups are per-collection (`index.weapons`, `index.armors`) rather
   * than the bare-slug `index.byRef` this line used to ask, so the count agrees
   * with the rows: `Equipped` resolves a weapon out of `index.weapons`, and a
   * slug that some other collection also prints would have been counted as
   * present here while drawing nothing there.
   */
  const equippedCount =
    [character.activePrimaryWeapon, character.activeSecondaryWeapon].filter(
      (r) => r !== null && r !== '',
    ).length +
    (character.activeArmor !== null && index.armors.has(character.activeArmor) ? 1 : 0);
  const carried = character.inventory.length;
  /*
   * How many features are behind the lineage fold, so a shut fold says what is
   * in it. Counted off the engine's own collector rather than added up here:
   * the Hope feature is handed over separately and a count that forgot it would
   * be one short of the list it advertises.
   */
  const featureCount = (() => {
    const held = characterFeatures(character, index);
    return held.features.length + (held.hopeFeature === null ? 0 : 1);
  })();
  // Filtered through the list the armed attack names rather than counted off
  // the armed ids: an Experience deleted in Build must not go on being counted
  // on a header, and neither must one belonging to whichever of the two sheets
  // is not being rolled.
  const rollExperiences = experiencesFor(character, arming.source);
  const armedCount = rollExperiences.filter((e) => armedExperiences.includes(e.id)).length;

  /*
   * Whether each pair is drawing two-line headers, which is true exactly while
   * it is drawing two of them side by side.
   *
   * A stacked header is the answer to half a cell, so the moment a pair is one
   * column wide - because a member opened, or because there is only one member
   * to draw - both go back to the one-line shape every other fold has. Computed
   * once here and handed to both the grid and the headers, so the layout and
   * the thing being laid out cannot disagree about which shape they are in.
   */
  const stackedA = character.experiences.length > 0 && !(equippedOpen || experiencesOpen);
  const stackedB = !(cardsOpen || restOpen);

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
        /*
         * 8px of top padding, where there was none.
         *
         * The sheet used to begin at zero pixels under the header: EVASION's
         * box shared an edge with `Header.tsx`'s bottom border, so the densest
         * block on the screen was glued to the chrome above it. That is the
         * other half of «è tutto attaccato sopra» and it is the cheapest eight
         * pixels in this budget. The 8 at the bottom has always been here and
         * is the same idea at the other end of the scroll.
         */
        padding: '8px 12px 8px',
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

      {/*
       * THE HEAD OF THE COLUMN, AND IT IS SPACED APART FROM ITSELF ON PURPOSE.
       *
       * (Not «the cockpit», which in this repo means the desktop layout and
       * nothing else - see `Vitals`. This is the phone's top four blocks.)
       *
       * These four blocks carry everything the game makes you read or press
       * during a turn - the thresholds, the four tracks, the six traits and
       * ROLL - and between them they were 258px of content in 282px of column,
       * three 8px gaps and nothing else. Below them six shut folds were 264px
       * carrying 60px of ink. The owner looked at that on their own phone and
       * said «è tutto attaccato sopra»: dense where the content is, empty
       * where it is not, and the first four steps of this reflow had made it
       * worse by taking 32px out of these four blocks while leaving the six
       * nearly-empty rows alone.
       *
       * So the gap here is 14 and the gap between the folds below is still 8,
       * and the two numbers say two different things. This is read under
       * pressure, so its parts are held apart; the index below is scanned, so
       * its parts are held together. The 18px this costs comes out of the 104
       * the pairing below gives back.
       *
       * `flex: 'none'` for the reason every child of this column carries it:
       * see the sweep in `playSheet.test.tsx`. A group that could shrink would
       * absorb the whole column's overflow on its own.
       */}
      <div className="stack" style={{ flex: 'none', gap: 14 }}>
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
        <Defenses stats={stats} damage conditions tight />

        {/* The four counters, two across. `bare`, because a box drawn around
            four silhouettes costs 18px and distinguishes nothing. */}
        <Vitals stats={stats} layout="phone" showState={false} bare arming={arming} />

        <TraitRow
          stats={stats}
          trait={trait}
          onPick={chooseTrait}
          characterId={character.id}
        />

        {/*
         * ROLL, in the flow, at the end of everything the rules make you declare
         * before the dice. 317x56 at 393px and 299x56 at 375px.
         *
         * This used to end "the largest target on the screen after a fold
         * header", which stopped being true when the column began pairing four
         * of its six folds two-up: those headers are 181.5x44 at 393, smaller
         * than this on **both** axes. Two headers still outrank it - `Carried`
         * and `Lineage & domains`, which take the column whole at 369x44 - and
         * they outrank it on width alone: 369x44 is 16,236px against this
         * button's 17,752. `Disclosure`'s own docblock is the authority on
         * which fold gets which width; this comment is not a second copy of it.
         *
         * WHERE IT ACTUALLY IS, MEASURED RATHER THAN REMEMBERED. This comment
         * carried `y522-588 … 264 to 330px up from the bottom bezel … 203px clear
         * of the tab bar` for two passes after the 2x2 counter grid took 150px
         * out of the stack above it, and every one of those numbers was 150px
         * stale. Rendered in Chrome, the `playedCharacter` fixture, every fold
         * shut, at the top of the scroll: the ROLL row spans **y389-445** on the
         * glass at 393, and y321-377 at 375 and at 360, where the card is 56 and
         * not 90. At 344 and 320 it is back down at y407-463, because the
         * defence band wraps to 94 there and the trait row to two lines. At 393x852 that is **407 to 463px above the bottom bezel** and
         * **346px clear of the tab bar**; at 375x667 it is **290 to 346px above
         * the bezel** and 229px clear.
         *
         * AND THE CONCLUSION INVERTS WITH THEM, WHICH IS THE PART THAT MATTERS.
         * The old sentence cited a 95th-percentile right-thumb sweep of about
         * 330px from the bottom-right pivot and said ROLL was inside it. On the
         * larger phone it is not, and deleting the 99px identity block is what
         * put it there: the resting sheet puts ROLL some 161px beyond the
         * far edge of that arc where P5-8 put it 77 beyond. On a 375x667 phone
         * it is back INSIDE the arc: 290-346, where the reflow's first four
         * steps had it at 332-388 and outside. That is a real cost of what was
         * asked for rather than a detail, and it is the cost of decision 2
         * specifically: every pixel the sheet gets shorter above ROLL is a pixel
         * further from the thumb at rest.
         *
         * AND THE SPACING GAVE MOST OF IT BACK, WHICH WAS NOT THE PLAN. The
         * head of the column's 14px gaps and its 8px of top padding exist because
         * the owner said «è tutto attaccato sopra», and they push everything
         * below them down: ROLL was 493-559 above the bezel before any of this
         * and is **407-463** now, 86px CLOSER to the thumb than it started, most
         * of that bought by the counter card's own height. The reach cost of the
         * whole reflow is not merely repaid, it is reversed. Worth stating as
         * the side effect it is, because the next edit to those gaps moves ROLL
         * again and should know that it does.
         *
         * WHAT IT BOUGHT, AND WHY THE TRADE IS STILL THE RIGHT ONE. Two things.
         * The whole folded sheet is now readable in one look - 600 of 730 at
         * 393x852 - which is the sentence the owner actually wrote and which a
         * pinned block made arithmetically impossible. And ROLL is 346px clear of
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
      </div>

      {/*
       * THE FIRST PAIR: what you are wearing, and what you are good at.
       *
       * Two folds share this row because both have a short name and a short
       * summary at 360 - `2 WORN` and `2` - which is the test a fold has to
       * pass to be paired at all. `Weapons & armour` leads because Giorgio's
       * message does: "E fare entrare le armi e le experience."
       *
       * If the character has no Experiences the fold is not drawn, the pair has
       * one member, and `FoldPair` gives it the whole row rather than half of
       * it with a hole beside it.
       */}
      <FoldPair
        openFirst={equippedOpen}
        openSecond={experiencesOpen}
        first={
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
            stacked={stackedA}
          >
            <Equipped stats={stats} arming={arming} bare />
          </Disclosure>
        }
        second={
          /*
           * "E fare entrare le armi e le experience." The Experiences come
           * straight after the weapons, which is where Giorgio's message puts
           * them and where the printed sheet has them - and since the reflow
           * that is beside rather than below.
           *
           * They used to be two 44px chips pinned directly above ROLL, which is
           * the best band on the phone and which they held on every frame of
           * every session to offer something a player arms on maybe one roll in
           * ten. Behind a fold they cost 44 instead of 100, and behind half a
           * shared row they cost nothing at all; nothing about arming one
           * changes: the chips are the same control, and whatever is armed is
           * spelled out in full on the ROLL bar itself - so a declaration is
           * never behind a tap even when the fold is.
           *
           * That sentence is the warrant for this fold, so it is load-bearing
           * rather than descriptive, and it shipped false: `DualityRoll` named
           * the armed Experiences only while no verdict was standing, which is
           * every state but the one a player is in from their second roll of the
           * evening onwards. `the Experiences a roll is declared with` asserts
           * it in the state that used to lose it. What is armed *after* a roll
           * is prefixed `NEXT:` there, because the bar is reporting a total at
           * the same time and a +2 printed beside an 18 reads as an 18 that
           * counted it.
           *
           * Drawn only when there are any. Every character starts with two, but
           * a fold that opens onto nothing is a row spent on an empty room.
           */
          character.experiences.length > 0 ? (
            <Disclosure
              id="experiences"
              characterId={character.id}
              label="Experiences"
              summary={
                armedCount === 0
                  ? `${rollExperiences.length}`
                  : `${rollExperiences.length} · ${armedCount} ARMED`
              }
              stacked={stackedA}
            >
              <ExperienceRow
                experiences={rollExperiences}
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
          ) : null
        }
      />

      {/*
       * THE SECOND PAIR: what you can play, and what you do between scenes.
       *
       * `Cards` keeps the place decision 6 gave it - above `Carried`, because
       * it is the fold a player opens most and `Carried` is read when somebody
       * asks what you have on you - and `Rest & downtime` comes up beside it
       * from below `Carried`. That swap is the only reorder in this reflow and
       * it costs the column nothing: both keep their `Disclosure` id, so no
       * player's remembered arrangement moves.
       *
       * A rest is still between-scenes work sitting below everything the game
       * makes you touch during a scene; beside the cards is where it already
       * belonged, because the free swap it offers is the vault's own operation
       * at the other price.
       */}
      <FoldPair
        openFirst={cardsOpen}
        openSecond={restOpen}
        first={
          /*
           * The cards, which are one section and used to be drawn as two.
           *
           * "Ultime le carte." The loadout and the vault are the same subject -
           * what you own and which five of it you are holding - and they were
           * costing two 44px headers to say so. The vault is now a tendina
           * inside this one, keeping its own id so a player who had it open
           * still has it open, and the closed header carries both numbers: a
           * fold that hides how many cards are where has cost a tap rather than
           * saved a scroll.
           *
           * Nested rather than merged, because the argument that separated them
           * still holds: a level 8 character owns about a dozen cards and
           * carries five, and opening the loadout must not hand you twelve rows.
           */
          <Disclosure
            id="cards"
            characterId={character.id}
            label="Cards"
            // The gate counts every ref, readable or not, so this does too: a
            // header saying 3 / 5 over a recall that refuses with "Loadout is
            // full (5)" is the screen contradicting itself.
            summary={`${loadout.length + ghostLoadout.length} / 5 · ${vault.length + ghostVault.length} INACTIVE`}
            stacked={stackedB}
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
        }
        second={<Rest stats={stats} rng={cryptoRng} stacked={stackedB} />}
      />

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
       *
       * FULL WIDTH, AND IT IS THE REASON THERE ARE TWO PAIRS AND NOT THREE.
       * Its worst summary - `4 ITEMS · 1 CHEST · 3 BAGS · 7 HANDFULS` - was
       * 257.41px at the 10px it was measured at, against a 181.5px half cell,
       * and no shared row held it. At the role's 12 it is 300, which a
       * stacked half cell would take as two wrapped lines under the name - a
       * three-line header beside a two-line partner. Full width it sits
       * whole on the line under CARRIED, 300 in the header's 365, which is
       * `Disclosure`'s own measurement.
       */}
      <Disclosure
        id="carried"
        characterId={character.id}
        label="Carried"
        summary={`${carried} ${carried === 1 ? 'ITEM' : 'ITEMS'} · ${formatGold(character.gold).toUpperCase()}`}
        /*
         * No size of its own any more. This was the one fold held under the
         * `.t-meta` role - at 10 and then 11 - so that its line, the longest
         * summary on the sheet, would fit in one; since the readability ramp
         * the summary wraps instead, at the role, and `Disclosure`'s own
         * docblock carries the measurement and the subtraction that went
         * wrong twice while a size was the fix. A measurement copied to a
         * second site is a measurement that will disagree with itself.
         */
      >
        <Items bare />
      </Disclosure>

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
       * column. With nothing on, the folded sheet is 600 of 730 at 393x852.
       *
       * When something *is* on this strip is back, in this slot, naming it -
       * and the control at the top of the sheet is filled and counting it. A
       * condition is a state the GM inflicted, so the one thing this may never
       * do is go quiet about one.
       */}
      <ActiveConditions onlyWhenOn />

      {/*
       * THE DICE POOLS, AND THEY ARE THE SECOND FOLD IN THIS COLUMN THAT IS
       * DRAWN ONLY WHEN THERE IS SOMETHING IN IT.
       *
       * The conditions are the precedent and the arithmetic is theirs: a fold
       * is a 44px header plus this column's 8px gap, so this costs **52px** to
       * the four archetypes that have a pool - a Bard, a Seraph, a Warrior who
       * took Call of the Slayer and a Warlock - and **nothing at all** to
       * everybody else, because `DicePools` returns null and this block is not
       * rendered.
       *
       * THE WARLOCK IS THE FOURTH AND HE MOVED THE COUNT, NOT THE PRICE. The
       * Patron Die is a pool in `engine/dicePools.ts` like the other three -
       * keyed on `Patron's Pact`, not on `Favor`, which is the currency - so
       * `pools.length > 0` is true for him and this same single `Disclosure` is
       * drawn. One fold is one header and one gap whatever is inside it, so the
       * 52 below is the 52 it always was; what changed is that a fourth
       * archetype now pays it. A pool that had arrived as a second fold, or as
       * a strip outside one, would have had to restate the number instead.
       *
       * The 52 matters and is stated rather than absorbed. `playSheet.test.tsx`
       * holds the whole folded sheet to 532px against 545 of column at 375x667,
       * which is thirteen pixels of slack: a Bard on a small phone is 39px over
       * it and scrolls for the last fold. That is a real cost of the feature and
       * it lands on a screen that already scrolls, which is why it is affordable
       * where a 52px charge on EVERY sheet would not have been. The fold index
       * in that file carries the same note.
       */}
      {pools.length > 0 && (
        <Disclosure
          id="pools"
          characterId={character.id}
          label="Dice pools"
          summary={pools.map((p) => `${p.name.toUpperCase()} d${String(p.sides)}`).join(' · ')}
        >
          <DicePools stats={stats} />
        </Disclosure>
      )}

      <Disclosure
        id="lineage"
        characterId={character.id}
        label="Lineage, domains & features"
        summary={`${String(featureCount)} FEATURES`}
      >
        <Lineage stats={stats} />
      </Disclosure>

      {/*
       * The licence notice, below every fold, and it costs this budget nothing.
       *
       * Play had no notice at all until P5-6, and the reason was arithmetic: as
       * a *fixed* strip it was at least the 126.16px the notice measures on a
       * 369px column at 393x852 off the top of a 730px scroll window, forever,
       * on the screen with the tightest budget in the app - and a pinned strip
       * painted a panel and its own horizontal padding on top of that. ("~111px"
       * stood here; it was the estimate, and it was short by the border it
       * forgot to add.)
       * `LicenceFooter`'s own docblock still carries that argument, marked
       * superseded, because the shape it was arguing against no longer exists.
       *
       * Here it is the last child of the scroll, under the last shut fold. The
       * budget in `playSheet.test.tsx` runs from the column's own top padding,
       * above the defence band, to the bottom edge of the lineage header - 600px
       * against 730, measured 592 from the band's top edge at 393x852 - and
       * everything it sums is something a player has to be able to reach. The
       * identity block it used to start at is not on this column at all since
       * decision 2. This notice is not either:
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
