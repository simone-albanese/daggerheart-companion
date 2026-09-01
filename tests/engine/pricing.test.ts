/**
 * The six bonuses whose amount is a WORD, priced - and what each one does to a
 * number a player reads.
 *
 * WHY THIS FILE IS SEPARATE FROM `modifiers.test.ts`. That file audits the
 * REGISTER against the BOOK: it proves every row still matches a sentence and
 * every sentence still has a row or a reason. It never runs `deriveStats`, so a
 * row can be perfectly well-formed there and reach no number at all - which is
 * exactly how Earthkin's Stoneskin shipped, correct in the register and worth
 * nothing on the sheet. This file runs the engine.
 *
 * THE STANDARD EVERY ASSERTION HERE IS HELD TO. These ten shipped unpriced
 * because this repository's accounting is that A WRONG NUMBER ON A PLAYED
 * CHARACTER'S SHEET IS WORSE THAN A MISSING ONE. So for every one of them, three
 * things are shown together: the sentence AS THE DATASET PRINTS IT, read out of
 * `data/srd-2.0.json` rather than quoted from memory; the number the engine
 * derives; and a comparison against a NEIGHBOUR ARMOUR THAT LACKS THE FEATURE.
 *
 * The neighbour is the half that is not decoration, and it is the shape
 * `modifiers.test.ts` uses for Earthkin - measured against Clank rather than
 * against a literal, so the day a class base or an armour's ladder moves, the
 * test still asks the question it means to ask. Here the neighbour does more
 * than hold a base still: `leather-armor` and `advanced-leather-armor` carry NO
 * FEATURE AT ALL (`feature: ""` in the dataset), so when the Spellcast trait or
 * the Presence moves and the neighbour does not move with it, the movement is
 * attributed to the feature and not to anything else on the sheet. A number
 * without that comparison is not priced, it is asserted.
 */
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import {
  MAX_LOADOUT,
  deriveStats,
  indexDataset,
  newCharacter,
} from '../../src/engine/character.ts';
import { REGISTERS, collectModifiers } from '../../src/engine/modifiers.ts';
import { TRAITS } from '../../shared/types.ts';
import type { Character, Trait } from '../../shared/types.ts';

const dataset = baseDataset;
const index = indexDataset(dataset);

/** The armour's `feature` string, straight out of the shipped dataset. */
const armorText = (id: string): string => {
  const armor = dataset.armors.find((a) => a.id === id);
  expect(armor, `no armour called ${id} in this build`).toBeDefined();
  return armor?.feature ?? '';
};

const traitsWith = (over: Partial<Record<Trait, number>>): Record<Trait, number> =>
  Object.fromEntries(TRAITS.map((t) => [t, over[t] ?? 0])) as Record<Trait, number>;

const sheet = (p: Partial<Character> = {}): Character =>
  newCharacter({ classRef: 'wizard', level: 1, ...p }, index);

const statsOf = (p: Partial<Character> = {}): ReturnType<typeof deriveStats> =>
  deriveStats(sheet(p), dataset, index);

/** Every ledger row a given feature put on a given stat, as `+2` / `-1` strings. */
const rowsFor = (
  s: ReturnType<typeof deriveStats>,
  stat: 'major' | 'severe' | 'armorScore' | 'evasion',
  feature: string,
): string[] =>
  s.modifiers[stat]
    .filter((r) => r.feature === feature)
    .map((r) => `${r.source} · ${r.feature} ${r.amount >= 0 ? '+' : ''}${r.amount}`);

// ---------------------------------------------------------------------------
// Enchanted - the one a new character meets first
// ---------------------------------------------------------------------------

describe('Mage Robes · Enchanted, "damage thresholds equal to your Spellcast trait"', () => {
  /*
   * MAGE ROBES IS TIER 1 STARTING ARMOR. Of the ten unpriced amounts this is
   * the one that mattered, because it is not a legendary curiosity a table
   * reaches at level 8: it is what a wizard puts on at character creation, and
   * until now the whole of its feature did nothing.
   */
  const CAST: Trait = 'knowledge';

  it('says exactly that, in this build of the dataset', () => {
    expect(armorText('mage-robes')).toBe(
      'Enchanted: Gain a bonus to your damage thresholds equal to your Spellcast trait.',
    );
    // All four tiers print the same sentence, which is why all four are rows.
    for (const id of ['improved-mage-robes', 'advanced-mage-robes', 'legendary-mage-robes']) {
      expect(armorText(id), id).toBe(armorText('mage-robes'));
    }
    expect(REGISTERS.armor['mage-robes']).toEqual([
      { stat: 'thresholds', amount: 'spellcast', feature: 'Enchanted' },
    ]);
  });

  it('moves both thresholds by the Spellcast trait, where a featureless neighbour does not move', () => {
    /*
     * `leather-armor` is the neighbour and it is a deliberate choice: tier 1,
     * like Mage Robes, and `feature: ""` - the SRD prints no feature on it at
     * all. So its thresholds are a control. Neither armour's ladder is written
     * down here; what is asserted is the RESPONSE of each to the same trait
     * moving.
     */
    const at = (id: string, k: number): [number, number] =>
      statsOf({
        subclassRefs: ['school-of-knowledge'],
        activeArmor: id,
        traits: traitsWith({ [CAST]: k }),
      }).thresholds;

    for (const [from, to] of [
      [-1, 0],
      [0, 2],
      [2, 3],
    ] as const) {
      const robes = [at('mage-robes', from), at('mage-robes', to)];
      const plain = [at('leather-armor', from), at('leather-armor', to)];
      const delta = to - from;
      expect(robes[1]![0] - robes[0]![0], `Major, ${CAST} ${from} -> ${to}`).toBe(delta);
      expect(robes[1]![1] - robes[0]![1], `Severe, ${CAST} ${from} -> ${to}`).toBe(delta);
      expect(plain[1]![0] - plain[0]![0], 'the featureless neighbour moved').toBe(0);
      expect(plain[1]![1] - plain[0]![1], 'the featureless neighbour moved').toBe(0);
    }
  });

  it('applies at all four tiers, and names itself in the ledger', () => {
    for (const id of [
      'mage-robes',
      'improved-mage-robes',
      'advanced-mage-robes',
      'legendary-mage-robes',
    ]) {
      const s = statsOf({
        subclassRefs: ['school-of-knowledge'],
        activeArmor: id,
        traits: traitsWith({ [CAST]: 2 }),
      });
      const name = dataset.armors.find((a) => a.id === id)?.name ?? id;
      expect(rowsFor(s, 'major', 'Enchanted'), id).toEqual([`${name} · Enchanted +2`]);
      expect(rowsFor(s, 'severe', 'Enchanted'), id).toEqual([`${name} · Enchanted +2`]);
    }
  });

  /*
   * THE DECISION THIS LANE HAD TO TAKE IN THE OPEN, AND ITS TWO HALVES.
   *
   * Six of the twenty-six subclasses in SRD 2.0 have no Spellcast trait -
   * juggernaut, martial-artist, stalwart, vengeance, call-of-the-brave,
   * call-of-the-slayer - and a sheet with no subclass chosen has none either.
   * A Guardian in Mage Robes is therefore an ordinary sheet, not a corner case,
   * and "equal to your Spellcast trait" names a quantity they do not have.
   *
   * A `?? 0` would have been one character and a lie of a particular kind: it
   * would print `Enchanted +0` beside the feature on the Play screen, which
   * claims the engine READ a Spellcast trait and found it to be zero. So the
   * amount resolves to `null` and the row is not emitted at all.
   *
   * A trait that EXISTS and is +0 is the opposite fact and DOES get its row.
   * That is the half that makes the decision defensible rather than merely
   * convenient: the wizard is being told, correctly, that their armour gives
   * them nothing today and will give them something the day that trait moves.
   */
  it('gives no row at all to a wearer with no Spellcast trait, and a +0 row to one whose trait is 0', () => {
    const armor = 'mage-robes';
    const traits = traitsWith({ [CAST]: 0 });
    const none = statsOf({ subclassRefs: [], activeArmor: armor, traits });
    const zero = statsOf({ subclassRefs: ['school-of-knowledge'], activeArmor: armor, traits });

    expect(none.spellcastTrait).toBeNull();
    expect(zero.spellcastTrait).toBe(CAST);

    expect(rowsFor(none, 'major', 'Enchanted'), 'a quantity the sheet does not have').toEqual([]);
    expect(rowsFor(zero, 'major', 'Enchanted')).toEqual(['Mage Robes · Enchanted +0']);
    // And the two sheets read the SAME thresholds, which is the point: no
    // Spellcast trait is not a penalty, it is an absence.
    expect(none.thresholds).toEqual(zero.thresholds);
  });

  it('does not read the trait off a sheet that has no Spellcast trait to read it with', () => {
    /*
     * The failure this refutes is the plausible one: resolving `spellcast`
     * against `c.traits[<something>]` regardless. Here `knowledge` is +3 and
     * there is no subclass, so a collector that reached for the trait anyway
     * would hand out +3.
     */
    const traits = traitsWith({ [CAST]: 3 });
    const none = statsOf({ subclassRefs: [], activeArmor: 'mage-robes', traits });
    const flat = statsOf({ subclassRefs: [], activeArmor: 'mage-robes', traits: traitsWith({}) });
    expect(none.thresholds).toEqual(flat.thresholds);
  });

  it('states a negative Spellcast trait as the subtraction it is, rather than clamping it away', () => {
    /*
     * The SRD hands every character a -1 to place and prints a rule about a
     * Spellcast trait that is "+0 or lower", so this is a reachable sheet. The
     * register states what the sentence states; a `Math.max(0, ...)` here would
     * be a floor invented by this app and invisible on the screen. The ledger
     * row is what makes the choice arguable at the table instead of silent.
     */
    const at = (k: number): number =>
      statsOf({
        subclassRefs: ['school-of-knowledge'],
        activeArmor: 'mage-robes',
        traits: traitsWith({ [CAST]: k }),
      }).thresholds[0];
    expect(at(-1)).toBe(at(0) - 1);
    const s = statsOf({
      subclassRefs: ['school-of-knowledge'],
      activeArmor: 'mage-robes',
      traits: traitsWith({ [CAST]: -1 }),
    });
    expect(rowsFor(s, 'major', 'Enchanted')).toEqual(['Mage Robes · Enchanted -1']);
  });
});

// ---------------------------------------------------------------------------
// Magnificent - the one that reads a number this same register moves
// ---------------------------------------------------------------------------

describe('Granminster’s Finery · Magnificent, "Armor Score equal to your Presence"', () => {
  it('says exactly that, in this build of the dataset', () => {
    expect(armorText('granminsters-finery')).toBe(
      'Magnificent: Gain a bonus to your Armor Score equal to your Presence.',
    );
    expect(REGISTERS.armor['granminsters-finery']).toEqual([
      { stat: 'armorScore', amount: 'presence', feature: 'Magnificent' },
    ]);
  });

  it('moves the Armor Score by Presence, where a featureless neighbour does not move', () => {
    // `advanced-leather-armor` is tier 3 like the Finery and carries `feature: ""`.
    const at = (id: string, p: number): number =>
      statsOf({ activeArmor: id, traits: traitsWith({ presence: p }) }).armorScore;
    for (const [from, to] of [
      [-1, 0],
      [0, 2],
    ] as const) {
      expect(at('granminsters-finery', to) - at('granminsters-finery', from)).toBe(to - from);
      expect(
        at('advanced-leather-armor', to) - at('advanced-leather-armor', from),
        'the featureless neighbour moved',
      ).toBe(0);
    }
  });

  /*
   * THE ROW READS THE SHEET'S PRESENCE, NOT THE CHARACTER'S RAW ONE, and this is
   * the assertion that pins the collector's two passes.
   *
   * A Charm Relic is "You gain a +1 bonus to your Presence", already a row in
   * `LOOT_MODS`. So a character with Presence +0 carrying one has Presence +1 on
   * their sheet, and "equal to your Presence" is +1. A one-pass collector that
   * resolved the amount while it walked would read +0 here - and which answer it
   * gave would depend on whether the armour lane happened to run before the
   * carried lane, which is the kind of bug that is right on the developer's
   * machine and wrong on the player's.
   */
  it('counts a Charm Relic’s +1 Presence before it reads Presence', () => {
    const bare = statsOf({
      activeArmor: 'granminsters-finery',
      traits: traitsWith({ presence: 0 }),
    });
    const withRelic = statsOf({
      activeArmor: 'granminsters-finery',
      traits: traitsWith({ presence: 0 }),
      inventory: [{ ref: 'charm-relic', name: 'Charm Relic', quantity: 1 }],
    });
    expect(bare.traits.presence).toBe(0);
    expect(withRelic.traits.presence).toBe(1);
    expect(rowsFor(bare, 'armorScore', 'Magnificent')).toEqual([
      'Granminster’s Finery · Magnificent +0',
    ]);
    expect(rowsFor(withRelic, 'armorScore', 'Magnificent')).toEqual([
      'Granminster’s Finery · Magnificent +1',
    ]);
    expect(withRelic.armorScore).toBe(bare.armorScore + 1);

    // And the neighbour that lacks the feature does not care about the relic.
    const plain = (inv: Character['inventory']): number =>
      statsOf({
        activeArmor: 'advanced-leather-armor',
        traits: traitsWith({ presence: 0 }),
        inventory: inv,
      }).armorScore;
    expect(plain([{ ref: 'charm-relic', name: 'Charm Relic', quantity: 1 }])).toBe(plain([]));
  });
});

// ---------------------------------------------------------------------------
// Attuned - half a sentence priced, and the other half declared
// ---------------------------------------------------------------------------

describe('Rune-Forged Exosuit · Attuned, "damage thresholds equal to your tier"', () => {
  it('says exactly that, in this build of the dataset', () => {
    expect(armorText('rune-forged-exosuit')).toBe(
      'Attuned: The maximum number of domain cards in your loadout is reduced by one, but you ' +
        'gain a bonus to your damage thresholds equal to your tier.',
    );
    expect(REGISTERS.armor['rune-forged-exosuit']).toEqual([
      { stat: 'thresholds', amount: 'tier', feature: 'Attuned' },
    ]);
  });

  it('gains three more thresholds than a featureless neighbour does across tier 1 to tier 4', () => {
    /*
     * Level moves the thresholds on its own - `baseThresholds + level` - so a
     * bare level comparison would prove nothing. `legendary-leather-armor` is
     * tier 4 like the Exosuit and carries `feature: ""`, so it absorbs the level
     * term exactly; what is left over is the tier term, and the tier goes 1 to
     * 4 between level 1 and level 8.
     */
    const span = (id: string): number => {
      const low = statsOf({ level: 1, activeArmor: id });
      const high = statsOf({ level: 8, activeArmor: id });
      expect(low.tier).toBe(1);
      expect(high.tier).toBe(4);
      return high.thresholds[0] - low.thresholds[0];
    };
    expect(span('rune-forged-exosuit') - span('legendary-leather-armor')).toBe(3);
  });

  it('prices the tier at every tier, and names itself in the ledger', () => {
    for (const [level, tier] of [
      [1, 1],
      [2, 2],
      [5, 3],
      [8, 4],
    ] as const) {
      const s = statsOf({ level, activeArmor: 'rune-forged-exosuit' });
      expect(s.tier).toBe(tier);
      expect(rowsFor(s, 'severe', 'Attuned'), `level ${level}`).toEqual([
        `Rune-Forged Exosuit · Attuned +${tier}`,
      ]);
    }
  });

  /*
   * THE OTHER HALF OF THE SENTENCE IS STILL OWED, AND IT IS PINNED HERE SO THAT
   * IT STAYS A DECISION RATHER THAN BECOMING AN OVERSIGHT.
   *
   * "The maximum number of domain cards in your loadout is reduced by one."
   * `deriveStats` reports `loadoutLimit`, but `src/engine/loadout.ts` refuses a
   * card against the flat `MAX_LOADOUT`, and `tools/simulate.ts` asserts
   * `stats.loadoutLimit === MAX_LOADOUT` as an invariant. Moving the reported
   * number on its own would print "5 of 4 active" on the printed sheet of a
   * character the app had just let take a fifth card - the app disagreeing with
   * its own sheet, which is worse than the silence. `UNPRICED_LANE` in
   * `modifiers.test.ts` carries the debt and names the three files.
   */
  it('leaves the loadout half alone, deliberately, and says so', () => {
    expect(statsOf({ level: 8, activeArmor: 'rune-forged-exosuit' }).loadoutLimit).toBe(
      MAX_LOADOUT,
    );
  });
});

// ---------------------------------------------------------------------------
// What is still declared, pinned so that pricing it is a choice and not a slip
// ---------------------------------------------------------------------------

describe('the amounts this lane decided NOT to price', () => {
  /*
   * Coffinwood's *Splintering* is "damage thresholds equal to your unmarked
   * Armor Slots", and the reason it stays declared is measured rather than
   * asserted: `newCharacter` hands back `armorSlots {marked:0, max:0}` while
   * `deriveStats` derives an Armor Score of 3 off the very same sheet, so
   * "unmarked" is 0 or 3 depending on which field is read. Pricing it would
   * print whichever one happened to be stale onto a played character.
   */
  it('shows the two readings of "unmarked Armor Slots" disagreeing on a brand-new sheet', () => {
    const c = newCharacter(
      { classRef: 'guardian', level: 1, activeArmor: 'coffinwood-armor-tier-1' },
      index,
    );
    const s = deriveStats(c, dataset, index);
    expect(c.armorSlots.max, 'the stored maximum').toBe(0);
    expect(s.armorScore, 'the derived Armor Score off the same sheet').toBe(3);
    expect(c.armorSlots.max).not.toBe(s.armorScore);
  });

  it('leaves all four Coffinwood tiers contributing nothing, as declared', () => {
    for (const id of [
      'coffinwood-armor-tier-1',
      'coffinwood-armor-tier-2',
      'coffinwood-armor-tier-3',
      'coffinwood-armor-tier-4',
    ]) {
      const s = statsOf({ activeArmor: id, armorSlots: { marked: 0, max: 4 } });
      expect(rowsFor(s, 'major', 'Splintering'), id).toEqual([]);
      const armor = dataset.armors.find((a) => a.id === id);
      // Base ladder plus level, and nothing else.
      expect(s.thresholds, id).toEqual([
        (armor?.baseThresholds[0] ?? 0) + 1,
        (armor?.baseThresholds[1] ?? 0) + 1,
      ]);
    }
  });

  it('leaves a Beastform’s threshold sentence reaching no number', () => {
    /*
     * Powerful Beast's *Thick Hide* is "You gain a +2 bonus to your damage
     * thresholds". `deriveStats` layers a form's `traitBonus` and
     * `evasionBonus`; a `Beastform` has no threshold field for it to layer, so
     * the sentence reaches the screen as text and reaches no number. Four forms
     * say something of this kind. It is in `UNPRICED_LANE` with the measurement,
     * and it is pinned here so that the day somebody adds the field, this test
     * says so out loud instead of going quietly green.
     */
    const bare = deriveStats(sheet({ classRef: 'druid' }), dataset, index);
    const shifted = deriveStats(
      { ...sheet({ classRef: 'druid' }), beastform: { ref: 'powerful-beast', activatedAt: new Date(0).toISOString() } },
      dataset,
      index,
    );
    expect(shifted.beastform, 'the form did resolve').not.toBeNull();
    expect(shifted.evasion, 'and its Evasion bonus DOES land').toBeGreaterThan(bare.evasion);
    expect(shifted.thresholds, 'while Thick Hide lands nowhere').toEqual(bare.thresholds);
  });
});

// ---------------------------------------------------------------------------
// The mechanism, not the six sentences
// ---------------------------------------------------------------------------

describe('the resolution of a word amount', () => {
  it('prices no dynamic amount against a trait, which is what keeps the two passes acyclic', () => {
    /*
     * `presence` resolves against the Presence ON THE SHEET, so every trait row
     * has to be summed before any dynamic amount is resolved. That is only
     * sound while no trait row is itself dynamic. `Row` forbids it in the type -
     * a `RowOf<Trait, ...>` takes a `number` and nothing else - and this walks
     * the shipped register to say the same thing about the data.
     */
    const traits = new Set<string>(TRAITS);
    const bad: string[] = [];
    for (const [lane, map] of Object.entries(REGISTERS)) {
      for (const [ref, rows] of Object.entries(map)) {
        for (const row of rows) {
          if (typeof row.amount === 'string' && traits.has(String(row.stat))) {
            bad.push(`${lane}|${ref}: "${row.amount}" priced against the trait ${String(row.stat)}`);
          }
        }
      }
    }
    expect(bad, `a cycle: ${bad.join('; ')}`).toEqual([]);
  });

  it('emits nothing for a quantity the caller did not supply', () => {
    /*
     * The fourth argument is optional so that this file's lane could widen
     * `Amount` without reaching into a call site it does not own. The default is
     * chosen the same way the `null` Spellcast trait is: a caller that supplies
     * nothing LOSES a bonus rather than inventing one. `deriveStats` always
     * supplies it - every assertion above is proof of that - and this pins what
     * happens to anyone who does not.
     */
    const c = sheet({
      level: 8,
      subclassRefs: ['school-of-knowledge'],
      activeArmor: 'rune-forged-exosuit',
      traits: traitsWith({ knowledge: 2 }),
    });
    const blind = collectModifiers(c, index, 6);
    const told = collectModifiers(c, index, 6, { tier: 4, spellcastTrait: 'knowledge' });
    expect(blind.major.filter((r) => r.feature === 'Attuned')).toEqual([]);
    expect(told.major.filter((r) => r.feature === 'Attuned').map((r) => r.amount)).toEqual([4]);
  });

  it('keeps the ledger in the sheet’s reading order after the second pass', () => {
    /*
     * The walk buffers and the emit replays, so a dynamic row must still land
     * where its lane says - not at the end. Armor comes before carried, so
     * Magnificent must precede a Protective shield's row... and here, before the
     * relic that its own amount depended on.
     */
    const s = statsOf({
      activeArmor: 'granminsters-finery',
      activeSecondaryWeapon: 'round-shield',
      traits: traitsWith({ presence: 1 }),
      inventory: [{ ref: 'charm-relic', name: 'Charm Relic', quantity: 1 }],
    });
    expect(s.modifiers.armorScore.map((r) => `${r.lane}:${r.feature}`)).toEqual([
      'armor:Magnificent',
      'secondary:Protective',
    ]);
    expect(s.modifiers.presence.map((r) => `${r.lane}:${r.feature}`)).toEqual([
      'carried:Charm Relic',
    ]);
  });
});
