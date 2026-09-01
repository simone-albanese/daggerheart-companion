/**
 * Step four's second sentence, which the app has never had.
 *
 * *"Acquire a new domain card at your level or lower... You can also exchange
 * one domain card you've previously acquired for a different domain card of the
 * same level or lower."* Folio 53, and `applyLevelUp` did only the first half.
 *
 * Three things are being asserted here and they pull in different directions:
 *
 *   1. the rule is IMPOSED. "Of the same level or lower" is a rule of character
 *      construction, not a ruling a table makes, so a plan that breaks it is
 *      refused rather than warned about;
 *   2. the record TRAVELS. The exchange is a `levelUpHistory` entry, which is
 *      persisted, serialized and put on the QR wire - which is why it landed in
 *      the same lane as the header widening rather than after it;
 *   3. it is not an ADVANCEMENT. No slot is spent, no tier box is marked, and
 *      `slotUsage` must not start counting one.
 */
import { describe, expect, it } from 'vitest';
import type { Character, DomainCard, DomainId, Ref } from '../shared/types.ts';
import { deriveStats, indexDataset } from '../src/engine/character.ts';
import {
  CARD_EXCHANGE_OPTION,
  applyLevelUp,
  slotUsage,
  tierFor,
  tierAchievementFor,
  validatePlan,
  type LevelUpPlan,
  type PlanContext,
} from '../src/engine/levelUp.ts';
import { characterRefs } from '../src/engine/holdings.ts';
import {
  decodeCharacter,
  encodeCharacter,
  missingSlugs,
  resolvePlaceholders,
} from '../src/transfer/codec.ts';
import { makeCard, makeCharacter, makeClass, makeDataset, makeSubclass } from './fixtures/factories.ts';
import { normalizeHandles, registryWithout, testRegistry, wizard } from './transfer/fixtures.ts';

// ---------------------------------------------------------------------------
// A dataset with cards at three levels, in and out of the character's domain
// ---------------------------------------------------------------------------

const card = (id: string, level: number, domain: DomainId = 'blade'): DomainCard =>
  makeCard({ id, name: id, level, domain });

const ds = makeDataset({
  classes: [makeClass({ id: 'test-class', domains: ['blade', 'bone'] })],
  subclasses: [makeSubclass({ classRef: 'test-class' })],
  domainCards: [
    card('held-lv1', 1),
    card('held-lv3', 3),
    card('vaulted-lv2', 2),
    card('open-lv1', 1),
    card('open-lv2', 2),
    card('open-lv3', 3),
    card('open-lv4', 4),
    card('other-domain-lv1', 1, 'valor'),
  ],
});
const ix = indexDataset(ds);

/**
 * The context `validatePlan` asks for, built the way the screen builds it: the
 * index's cards, and the domains `deriveStats` answers for this sheet. Derived
 * rather than written out, so a test cannot grant a domain the app would not.
 */
const context = (c: Character): PlanContext => ({
  cards: ix.cards,
  domains: deriveStats(c, ds, ix).domains,
});

const sheet = (patch: Partial<Character> = {}): Character =>
  makeCharacter({
    classRef: 'test-class',
    subclassRefs: ['test-subclass'],
    level: 3,
    loadout: ['held-lv1', 'held-lv3'],
    vault: ['vaulted-lv2'],
    ...patch,
  });

const plan = (p: Partial<LevelUpPlan> = {}): LevelUpPlan => ({
  fromLevel: 3,
  toLevel: 4,
  tier: tierFor(4),
  achievement: tierAchievementFor(4),
  picks: [
    { optionId: 'hit-point', optionTier: 2, detail: { optionId: 'hit-point', optionTier: 2 } },
    { optionId: 'stress', optionTier: 2, detail: { optionId: 'stress', optionTier: 2 } },
  ],
  newCardRef: null,
  exchange: null,
  ...p,
});

const errorsFor = (c: Character, p: LevelUpPlan, ctx?: PlanContext): string[] =>
  validatePlan(c, p, ctx).errors;

// ---------------------------------------------------------------------------
// 1. The rule
// ---------------------------------------------------------------------------

describe('the rule the sentence carries', () => {
  it('takes a card of the same level, and one of a lower level', () => {
    for (const toRef of ['open-lv3', 'open-lv2', 'open-lv1']) {
      const v = validatePlan(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef } }), context(sheet()));
      expect(v.ok, toRef).toBe(true);
      expect(v.errors, toRef).toEqual([]);
    }
  });

  it('refuses a card one level higher, and says both levels', () => {
    const errors = errorsFor(sheet(), plan({ exchange: { fromRef: 'vaulted-lv2', toRef: 'open-lv3' } }), context(sheet()));
    expect(errors).toEqual([
      'open-lv3 is level 3, and an exchange takes a card of the same level or lower - vaulted-lv2 is level 2.',
    ]);
    // Teeth for the boundary: one level down off the same card is fine, so what
    // is refused is the level and not the exchange.
    expect(errorsFor(sheet(), plan({ exchange: { fromRef: 'vaulted-lv2', toRef: 'open-lv2' } }), context(sheet()))).toEqual([]);
  });

  it('refuses a card the character never acquired', () => {
    expect(
      errorsFor(sheet(), plan({ exchange: { fromRef: 'open-lv1', toRef: 'open-lv2' } }), context(sheet())),
    ).toContain('You can only exchange a domain card you have already acquired, and open-lv1 is not one of yours.');
  });

  it('refuses an exchange for the same card, and for one already owned', () => {
    expect(
      errorsFor(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef: 'held-lv3' } }), context(sheet())),
    ).toContain('An exchange takes a different card than the one it gives up.');
    expect(
      errorsFor(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef: 'vaulted-lv2' } }), context(sheet())),
    ).toContain('vaulted-lv2 is already in your loadout or vault.');
  });

  it('refuses a card this level is already handing over some other way', () => {
    // The vault is a list. Pushing one ref twice is how a character comes to
    // own two copies of a card, and step four's own card is the other door it
    // can arrive through.
    expect(
      errorsFor(
        sheet(),
        plan({ newCardRef: 'open-lv1', exchange: { fromRef: 'held-lv3', toRef: 'open-lv1' } }),
        context(sheet()),
      ),
    ).toContain('open-lv1 is already being taken elsewhere in this level.');
  });

  it('refuses a card out of a domain this character has no access to', () => {
    /*
     * The clause the sentence does NOT repeat. Step four's first half says
     * "from one of your class's domains"; the exchange sentence says only "a
     * different domain card of the same level or lower", and reading that
     * silence as permission would let this character trade into Valor. It is
     * the second sentence of one step, not a second step.
     */
    expect(
      errorsFor(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef: 'other-domain-lv1' } }), context(sheet())),
    ).toContain('other-domain-lv1 is not in a domain you have access to.');
  });

  it('refuses an exchange it cannot check rather than waving it through', () => {
    // No index: the levels cannot be compared, and "cannot check" must not read
    // the same as "is fine". This is the shape the two dataset-less callers -
    // the simulator and the sample builder - would otherwise walk into.
    expect(errorsFor(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef: 'open-lv1' } }))).toEqual([
      'This build cannot check the level of an exchanged card, so the exchange is refused.',
    ]);
    // And a card this build cannot name, which is the same hole one door over.
    const thin = indexDataset(makeDataset({ ...ds, domainCards: [card('held-lv3', 3)] }));
    expect(
      errorsFor(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef: 'open-lv1' } }), {
        cards: thin.cards,
        domains: deriveStats(sheet(), ds, ix).domains,
      }),
    ).toContain('This build cannot name open-lv1, so it cannot check its level.');
  });

  it('says nothing at all when there is no exchange, which is the common case', () => {
    expect(validatePlan(sheet(), plan(), context(sheet())).errors).toEqual([]);
    expect(validatePlan(sheet(), plan()).errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. What it does to the sheet
// ---------------------------------------------------------------------------

describe('applying it', () => {
  it('puts the new card where the old one was, so the loadout does not shrink', () => {
    const before = sheet();
    const after = applyLevelUp(before, plan({ exchange: { fromRef: 'held-lv3', toRef: 'open-lv2' } }));
    expect(after.loadout).toEqual(['held-lv1', 'open-lv2']);
    expect(after.vault).toEqual(['vaulted-lv2']);
    // The count is invariant, which is what makes an overflow impossible rather
    // than handled: `MAX_LOADOUT` is five and this swap is one out, one in.
    expect(after.loadout.length).toBe(before.loadout.length);
  });

  it('keeps a vault trade in the vault', () => {
    const after = applyLevelUp(sheet(), plan({ exchange: { fromRef: 'vaulted-lv2', toRef: 'open-lv1' } }));
    expect(after.vault).toEqual(['open-lv1']);
    expect(after.loadout).toEqual(['held-lv1', 'held-lv3']);
  });

  it('never leaves the card that was given up anywhere on the sheet', () => {
    const after = applyLevelUp(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef: 'open-lv2' } }));
    expect([...after.loadout, ...after.vault]).not.toContain('held-lv3');
    expect([...after.loadout, ...after.vault].filter((r) => r === 'open-lv2')).toHaveLength(1);
  });

  it('records it in the history, and records it as not an advancement', () => {
    const after = applyLevelUp(sheet(), plan({ exchange: { fromRef: 'held-lv3', toRef: 'open-lv2' } }));
    const entry = after.levelUpHistory.at(-1)!;
    expect(entry).toEqual({
      level: 4,
      slot: 0,
      kind: 'cardExchange',
      detail: { optionId: CARD_EXCHANGE_OPTION, fromRef: 'held-lv3', toRef: 'open-lv2' },
    });
    // No box is marked. `slotUsage` keys on `optionId`, and no
    // `AdvancementOption` has this one - so an exchange cannot eat a slot the
    // player still has, however many levels they trade at.
    const spent = slotUsage(after).filter((u) => u.used > 0);
    expect(spent.map((u) => u.optionId)).not.toContain(CARD_EXCHANGE_OPTION);
    expect(slotUsage(after).some((u) => u.optionId === CARD_EXCHANGE_OPTION)).toBe(false);
  });

  it('leaves the card the level itself grants alone', () => {
    // The two halves of step four are separate offers, and one is not the other.
    const after = applyLevelUp(
      sheet(),
      plan({ newCardRef: 'open-lv1', exchange: { fromRef: 'held-lv3', toRef: 'open-lv2' } }),
    );
    expect(after.vault).toContain('open-lv1');
    expect(after.loadout).toContain('open-lv2');
  });

  it('reads "previously acquired" off the sheet as it was, not as this level leaves it', () => {
    // The card taken at step four of THIS level-up is not previously acquired,
    // and the validator is what says so - it reads the character it was handed.
    expect(
      errorsFor(sheet(), plan({ newCardRef: 'open-lv1', exchange: { fromRef: 'open-lv1', toRef: 'open-lv2' } }), context(sheet())),
    ).toContain('You can only exchange a domain card you have already acquired, and open-lv1 is not one of yours.');
  });
});

// ---------------------------------------------------------------------------
// 3. It travels
// ---------------------------------------------------------------------------

const exchangeEntry = (fromRef: Ref, toRef: Ref): Character['levelUpHistory'][number] => ({
  level: 4,
  slot: 0,
  kind: 'cardExchange',
  detail: { optionId: CARD_EXCHANGE_OPTION, fromRef, toRef },
});

describe('the wire', () => {
  /*
   * A sheet AFTER an exchange, which is the only shape that has teeth.
   *
   * The card given up is on no list any more - that is what giving it up
   * means - so `banish` appears exactly once on this character, inside the
   * history entry. A fixture that left it in the vault would let every
   * assertion below pass through the vault's own walk while the history's was
   * missing entirely, which is how the first version of this file's
   * `characterRefs` test survived having the walk deleted.
   */
  const traded = (): Character =>
    wizard({
      vault: wizard().vault.filter((r) => r !== 'banish'),
      levelUpHistory: [...wizard().levelUpHistory, exchangeEntry('banish', 'teleport')],
    });

  it('carries the record, both refs, and back', async () => {
    const before = traded();
    const { character, warnings } = await decodeCharacter(
      await encodeCharacter(before, testRegistry),
      testRegistry,
    );
    expect(warnings).toEqual([]);
    expect(normalizeHandles(character)).toEqual(normalizeHandles(before));
    expect(character.levelUpHistory.at(-1)).toEqual(exchangeEntry('banish', 'teleport'));
  });

  it('rides in the compact form rather than escaping to JSON', async () => {
    /*
     * The escape hatch exists and would have made the test above pass while the
     * kind was unknown to the format - `writeChoice` would have written the
     * whole record as a JSON string. Measured by bytes: a sheet with the
     * exchange costs a handful more than the same sheet without, not the
     * eighty-odd a JSON escape of this detail runs to.
     */
    const withSwap = (await encodeCharacter(traded(), testRegistry)).length;
    const without = (await encodeCharacter(wizard(), testRegistry)).length;
    expect(withSwap - without).toBeLessThan(20);
    expect(withSwap).toBeGreaterThan(without);
  });

  it('is seen by the pre-flight, so a QR is never offered for a sheet it would throw on', async () => {
    /*
     * `characterRefs` is what `missingSlugs` walks. A ref it misses is a ref
     * the pre-flight says nothing about, and `encodeCharacter` then throws
     * `UnknownSlugError` on a sheet the screen called sendable.
     *
     * Asked of the card that is ONLY in the history - the one given up - so
     * deleting the history walk turns this red. Asking it of `teleport` proves
     * nothing: that card is in the vault, and the vault has always been walked.
     */
    const c = traded();
    expect([...c.loadout, ...c.vault], 'the given-up card must be off the lists').not.toContain('banish');
    expect(characterRefs(c)).toContain('banish');
    const thin = registryWithout('banish');
    expect(missingSlugs(c, thin)).toContain('banish');
    await expect(encodeCharacter(c, thin)).rejects.toThrow(/banish/);
    // Control: with a whole registry the same sheet is sendable, so what the
    // pre-flight refused is the missing slug and not the exchange.
    expect(missingSlugs(c, testRegistry)).toEqual([]);
  });

  it('parks a ref the receiving device cannot name, and forwards it untouched', async () => {
    const payload = await encodeCharacter(traded(), testRegistry);
    const thin = registryWithout('teleport');
    const { character, unresolved } = await decodeCharacter(payload, thin);
    const parked = character.levelUpHistory.at(-1)!.detail['toRef'];
    expect(typeof parked).toBe('string');
    expect(parked).toMatch(/^\?\d+$/);
    expect(unresolved).toHaveLength(1);
    // Nothing is dropped: the other half of the record is intact, and the id
    // comes back to life on a device that has the card.
    expect(character.levelUpHistory.at(-1)!.detail['fromRef']).toBe('banish');
    const healed = resolvePlaceholders(character, testRegistry);
    expect(healed.character.levelUpHistory.at(-1)!.detail['toRef']).toBe('teleport');
    expect(healed.resolved).toEqual(unresolved);
  });
});
