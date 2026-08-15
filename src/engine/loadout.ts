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
  reason: string | null;
}

export function canAddToLoadout(
  c: Character,
  card: DomainCard,
  options: { downtime?: boolean } = {},
): SwapCheck {
  if (c.loadout.includes(card.id)) {
    return { allowed: false, stressCost: 0, affordable: true, reason: 'Already in the loadout' };
  }
  // Recall moves a card you already own out of the vault. Acquiring a card you
  // have never taken is a different act with different rules (level-up, a
  // domain-card advancement), and letting a recall do it quietly would let a
  // player pick up any card in the book for a Stress.
  if (!c.vault.includes(card.id)) {
    return { allowed: false, stressCost: 0, affordable: true, reason: 'Not in your vault' };
  }
  if (c.loadout.length >= MAX_LOADOUT) {
    return {
      allowed: false,
      stressCost: 0,
      affordable: true,
      reason: `Loadout is full (${MAX_LOADOUT}) - move a card to the vault first`,
    };
  }
  const stressCost = options.downtime === true ? 0 : card.recallCost;
  const free = c.stress.max - c.stress.marked;
  return {
    allowed: true,
    stressCost,
    affordable: stressCost <= free,
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
