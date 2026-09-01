/**
 * Loadout and vault.
 *
 * Five cards active. Moving a card in from the vault during a scene costs its
 * Recall Cost in Stress; during downtime it is free. The app proposes the
 * Stress cost and lets the player confirm - it never spends a resource on its
 * own.
 */
import type { Character, DomainCard, Ref } from '../../shared/types.ts';
import { MAX_LOADOUT, type DatasetIndex, type DerivedStats } from './character.ts';
import { markStress } from './damage.ts';

export interface SwapCheck {
  allowed: boolean;
  /** Stress that will be marked. 0 during downtime. */
  stressCost: number;
  /** True when the player has the Stress to pay - they may still choose to. */
  affordable: boolean;
  /**
   * Hit Points this recall would mark, because the Stress track is full.
   *
   * `markStress` spends Stress until the track is full and then spends Hit
   * Points, which is the SRD's rule for marking Stress you cannot pay - and it
   * is the half of the cost `affordable` only hints at. No UI read `affordable`
   * for the first year of this file's life, so a recall at 6/6 Stress marked
   * HP without asking; at 5/6 HP that is the sixth Hit Point, `hasFallen`, and
   * a death move offered for tapping a card. 158 of the 189 SRD cards have a
   * recall cost of 1 or more, so this is not a corner.
   *
   * Zero whenever `affordable` is true, and zero whenever the recall is not
   * allowed at all.
   */
  hpCost: number;
  reason: string | null;
}

/** A refusal: nothing is spent, so nothing is costed. */
const refuse = (reason: string): SwapCheck => ({
  allowed: false,
  stressCost: 0,
  affordable: true,
  hpCost: 0,
  reason,
});

export function canAddToLoadout(
  c: Character,
  card: DomainCard,
  options: { downtime?: boolean } = {},
): SwapCheck {
  if (c.loadout.includes(card.id)) return refuse('Already in the loadout');
  // Recall moves a card you already own out of the vault. Acquiring a card you
  // have never taken is a different act with different rules (level-up, a
  // domain-card advancement), and letting a recall do it quietly would let a
  // player pick up any card in the book for a Stress.
  if (!c.vault.includes(card.id)) return refuse('Not in your vault');
  if (c.loadout.length >= MAX_LOADOUT) {
    return refuse(`Loadout is full (${MAX_LOADOUT}) - move a card to the vault first`);
  }
  const stressCost = options.downtime === true ? 0 : card.recallCost;
  const free = Math.max(0, c.stress.max - c.stress.marked);
  /*
   * Costed the way `markStress` actually spends, rather than by a second rule
   * that agrees with it today. Stress first, then Hit Points, and the Hit
   * Points stop at the end of the track: a character with nothing left to mark
   * pays nothing more, which is `markStress`'s own behaviour and not a
   * rounding of it.
   */
  const overflow = Math.max(0, stressCost - free);
  return {
    allowed: true,
    stressCost,
    affordable: overflow === 0,
    hpCost: Math.min(overflow, Math.max(0, c.hp.max - c.hp.marked)),
    reason: null,
  };
}

/** Move a card from the vault into the loadout, paying Recall Cost in Stress. */
export function recallCard(
  c: Character,
  card: DomainCard,
  options: { downtime?: boolean } = {},
): { character: Character; stressMarked: number; hpMarked: number } {
  const check = canAddToLoadout(c, card, options);
  if (!check.allowed) return { character: c, stressMarked: 0, hpMarked: 0 };

  const moved: Character = {
    ...c,
    loadout: [...c.loadout, card.id],
    vault: c.vault.filter((r) => r !== card.id),
  };
  if (check.stressCost === 0) {
    return { character: { ...moved, updatedAt: new Date().toISOString() }, stressMarked: 0, hpMarked: 0 };
  }
  return markStress(moved, check.stressCost);
}

/** Moving a card out of the loadout is always free. */
export function vaultCard(c: Character, ref: Ref): Character {
  if (!c.loadout.includes(ref)) return c;
  return {
    ...c,
    loadout: c.loadout.filter((r) => r !== ref),
    vault: c.vault.includes(ref) ? c.vault : [...c.vault, ref],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Give a card back: off the loadout and out of the vault, in one move.
 *
 * ## What this is, and the thing it is deliberately NOT
 *
 * `vaultCard` moves a card you own from one of your lists to the other, and
 * `recallCard` moves it back for Stress. Neither reduces what you own, and
 * until this function nothing did: `Cards.tsx`'s three branches are
 * loadout -> vault, vault -> loadout and unowned -> vault, and its four footer
 * words are MARK n HP? / IN LOADOUT / RECALL / TAKE. A card taken by a
 * mis-tap stayed taken.
 *
 * So this is **recovery from a touch**, not a rule. The mechanic that gives a
 * card up in exchange for another is step four's second sentence, and it lives
 * in `applyLevelUp` with the constraint the book puts on it - same level or
 * lower, a domain you can reach, recorded in `levelUpHistory`. This writes no
 * record, because nothing happened: the sheet is being put back the way it was
 * before a finger landed in the wrong place.
 *
 * The two must not be confused in the code or on the screen, and the reason is
 * concrete rather than tidy. `levelUpHistory` is the record of what each level
 * did; `deriveStats` reads it, the codec carries it, and a table can look at
 * it. If an undo wrote an exchange there, the record would say a player traded
 * a card away at a level where they had simply mis-tapped - and the exchange's
 * own constraint would then be enforced against, or waived for, a thing that
 * was never a choice.
 *
 * Nor is it a way around that constraint, though it might look like one. Taking
 * a card in the browser has never been gated by the exchange rule and is not
 * gated by it now: `cardAvailability` allows a domain you have and a level at
 * or under your cap, which is what step four's FIRST sentence allows, and this
 * screen has always been the table's own bookkeeping rather than the
 * level-up's. What the ✕ adds is the ability to put something back, which is
 * the direction that was missing.
 *
 * Both lists, unconditionally. A ref in both is not a state this app writes,
 * and removing it from only the one it was found in would leave a sheet still
 * owning the card it just gave back.
 */
export function releaseCard(c: Character, ref: Ref): Character {
  if (!c.loadout.includes(ref) && !c.vault.includes(ref)) return c;
  return {
    ...c,
    loadout: c.loadout.filter((r) => r !== ref),
    vault: c.vault.filter((r) => r !== ref),
    updatedAt: new Date().toISOString(),
  };
}

export function reorderLoadout(c: Character, from: number, to: number): Character {
  const next = [...c.loadout];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return c;
  next.splice(to, 0, moved);
  return { ...c, loadout: next, updatedAt: new Date().toISOString() };
}

export interface CardAvailability {
  card: DomainCard;
  /** Owned means it is in the loadout or the vault. */
  owned: boolean;
  inLoadout: boolean;
  /** Selectable at the character's current level and domains. */
  eligible: boolean;
  reason: string | null;
}

/**
 * Which cards this character could acquire, and why the rest are out of reach.
 * The domain and level rules are unambiguous, so they are enforced; nothing
 * else is.
 */
export function cardAvailability(
  c: Character,
  stats: DerivedStats,
  cards: DomainCard[],
): CardAvailability[] {
  const owned = new Set([...c.loadout, ...c.vault]);
  return cards.map((card) => {
    const inDomain = stats.domains.includes(card.domain);
    const cap = stats.cardLevelCap(card.domain);
    const reason = !inDomain
      ? 'Not one of your domains'
      : card.level > cap
        ? `Level ${card.level} - your cap in ${card.domain} is ${cap}`
        : null;
    return {
      card,
      owned: owned.has(card.id),
      inLoadout: c.loadout.includes(card.id),
      eligible: reason === null,
      reason,
    };
  });
}

export function resolveCards(refs: Ref[], index: DatasetIndex): DomainCard[] {
  return refs
    .map((r) => index.cards.get(r))
    .filter((card): card is DomainCard => card !== undefined);
}

/** Refs the current dataset cannot resolve. Shown, never dropped. */
export function missingCardRefs(c: Character, index: DatasetIndex): Ref[] {
  return [...c.loadout, ...c.vault].filter((r) => !index.cards.has(r));
}
