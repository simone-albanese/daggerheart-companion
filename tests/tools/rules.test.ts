/**
 * The rules stream, read out of two books whose folios agree about nothing.
 *
 * `npm run build:srd -- --check` already guards SRD 1.0 byte for byte, so the
 * assertions worth writing here are the ones it cannot make: that the same
 * manifest lands on the same 77 sections in SRD 2.0, that the material the
 * second book prints BESIDE the rules stays out, and that a reference table
 * found by its own first row is the table it was meant to be.
 *
 * The book-gated halves cannot run in CI: the manuals are the owner's and are
 * not in the repository.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRules } from '../../shared/parsers/rules.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';
import type { RulesSection } from '../../shared/types.ts';

const path = (i: number): string | undefined => BOOKS[i]!.localPaths.find((p) => existsSync(p));
const read = async (i: number): Promise<RulesSection[]> =>
  parseRules((await loadSrd({ pdfPath: path(i)! })).pages);
const body = (rules: RulesSection[], id: string): string => {
  const hit = rules.find((r) => r.id === id);
  if (hit === undefined) throw new Error(`no section ${id}; have ${rules.map((r) => r.id).join(', ')}`);
  return hit.body;
};

describe.skipIf(path(0) === undefined || path(1) === undefined)('the rules on both books', () => {
  /*
   * The two books share seventy-seven sections in the same order, and SRD 2.0
   * prints FIVE MORE that SRD 1.0 does not have at all - the Martial Stances
   * chapter on folio 13. It is the first place the two books' rules diverge,
   * and the assertion says so in both directions rather than dropping to a
   * subset check: SRD 1.0's list must be exactly SRD 2.0's minus those five,
   * in order, so a section going missing from the older book still fails here.
   *
   * The equipment chapter is NOT such a divergence, and that is worth stating
   * because its folios are eleven pages apart between the books and its
   * consumables head is spelled `Consumables` in one and `CONSUMABLES` in the
   * other. Both print the same eight sections in the same order, so the eight
   * belong to the shared list and not to the exception.
   */
  const STANCE_RULES = [
    'martial-stances',
    'stances',
    'focus',
    'shifting-into-stances',
    'dropping-out-of-stances',
  ];

  it('reads the same seventy-seven out of both, and five more out of SRD 2.0 only', async () => {
    const one = await read(0);
    const two = await read(1);
    expect(one).toHaveLength(77);
    expect(two).toHaveLength(82);
    expect(two.filter((r) => STANCE_RULES.includes(r.id)).map((r) => r.id)).toEqual(STANCE_RULES);
    expect(one.some((r) => STANCE_RULES.includes(r.id))).toBe(false);
    const shared = two.filter((r) => !STANCE_RULES.includes(r.id));
    expect(shared.map((r) => r.id)).toEqual(one.map((r) => r.id));
    expect(shared.map((r) => r.title)).toEqual(one.map((r) => r.title));
  });

  it('puts the five on folio 13, and stops before the stance cards', async () => {
    const two = await read(1);
    for (const id of STANCE_RULES) {
      expect(two.find((r) => r.id === id)?.sourcePage, id).toBe(13);
    }
    // `close: STANCE FEATURES` is what keeps `parseStances`' cards out of the
    // rules. Without it the whole right column arrives here.
    const all = STANCE_RULES.map((id) => body(two, id)).join(' ');
    expect(all).not.toContain('STANCE FEATURES');
    expect(all).not.toContain('Favored');
    // And the sentences the app had a Focus stepper without.
    expect(body(two, 'focus')).toContain('maximum of 6 Focus');
    expect(body(two, 'shifting-into-stances')).toContain('spend a Focus to shift');
  });

  it('finds each island on the folio the second book actually prints it on', async () => {
    const two = await read(1);
    const at = (id: string): number | undefined => two.find((r) => r.id === id)?.sourcePage;
    // Measured on SRD 2.0: the contents page and the banners, not constants.
    expect(at('introduction')).toBe(3);
    expect(at('beastform-options')).toBe(15);
    expect(at('ranger-companion')).toBe(21);
    expect(at('flow-of-the-game')).toBe(46);
    expect(at('equipment')).toBe(55);
    expect(at('gold')).toBe(84);
    expect(at('using-environments')).toBe(158);
    expect(at('additional-gm-guidance')).toBe(183);
  });

  it('keeps the class chapter out of the two pages it shares with the rules', async () => {
    const two = await read(1);
    // SRD 2.0 sets BEASTFORM OPTIONS in the second column of a page whose
    // first column is the Warden of Renewal, and the Companion sheet beside
    // the Wayfinder and above the Rogue.
    //
    // These two assertions name `character-creation`, not `beastform-options`,
    // and that is the whole point of them. They were written against the wrong
    // section and could not fail: the leaked units PRECEDE the banner, so they
    // land in the island before it, not in the one the banner opens. Measured
    // by deleting `open: 'BEASTFORM OPTIONS'` from rules.ts and reading where
    // the text went - `character-creation` 11021 -> 12655 chars, carrying both
    // strings, while `beastform-options` did not move. A guard that is
    // genuinely load-bearing on SRD 2.0 had no check that could go red.
    expect(body(two, 'character-creation')).not.toContain('Warden of Renewal');
    expect(body(two, 'character-creation')).not.toContain('Clarity of Nature');
    expect(body(two, 'ranger-companion')).not.toContain('Ruthless Predator');
    expect(body(two, 'leveling-up-your-companion')).not.toContain('Rogues are scoundrels');
    expect(body(two, 'leveling-up-your-companion')).toContain('Aware: Your companion gains a permanent +2 bonus');
  });

  it('keeps the adversary roster out of the environments preamble', async () => {
    const two = await read(1);
    // Folio 158 carries two zombie stat blocks above the USING ENVIRONMENTS
    // banner, and folio 159 the environment roster below the last table.
    //
    // `ZOMBIE LEGION` and not `Perfected Zombie`: the block that leaks is the
    // one immediately above the banner, and it leaks as its heading. Measured
    // by deleting `'USING ENVIRONMENTS'` from `SPLIT_ABOVE` - the body goes
    // 1363 -> 1418 chars and opens `## ZOMBIE LEGION / ## Tier 4 Horde (3/HP)
    // / ## FEATURES` ahead of "Environments represent everything in a scene".
    // `Perfected Zombie` appears in no section under either the mutant or the
    // real parser, so the assertion it replaces was unfailable.
    expect(body(two, 'using-environments')).not.toContain('ZOMBIE LEGION');
    expect(body(two, 'using-environments').startsWith('Environments represent')).toBe(true);
    expect(body(two, 'adapting-environments')).not.toContain('Abandoned Grove');
  });

  it('reads a line whose two columns are set on grids 6.5pt apart', async () => {
    const two = await read(1);
    /*
     * The word boxes SRD 2.0's extraction reports are 10.87pt tall for the
     * same 9.3pt face SRD 1.0 reports at 8.91pt, which lifts `bands`'s
     * tolerance past the offset between folio 50's two columns. Banded across
     * the page, the line came out as "represent a character's ability to
     * withstand Hit Points (HP) physical injury".
     */
    expect(body(two, 'combat')).toContain(
      'Hit Points (HP) represent a character’s ability to withstand physical injury.',
    );
    expect(body(two, 'maps-range-and-movement')).toContain(
      'If you’re not already making an action roll, or if you want to move farther than your Close range, you need to succeed on an Agility Roll to safely reposition yourself.',
    );
  });

  it('finds every reference table by its own first row', async () => {
    const two = await read(1);
    expect(body(two, 'adversary-stat-block-benchmarks')).toContain(
      '| Damage Thresholds | Major 7/Severe 12 | Major 10/Severe 20 | Major 20/Severe 32 | Major 25/Severe 45 |',
    );
    expect(body(two, 'adapting-environments')).toContain('| Difficulty | 11 | 14 | 17 | 20 |');
    expect(body(two, 'giving-out-gold-equipment-and-loot')).toContain(
      '| Tier 4 equipment (weapons, armor) | 1-2 Chests |',
    );
    expect(body(two, 'countdowns')).toContain('| Critical Success | Tick down 3 | No advancement |');
    expect(body(two, 'engaging-your-players')).toContain('| 12 | Investigate a situation to confirm or deny existing information. |');
    expect(body(two, 'using-fear')).toContain('| Climactic |');
    // The six trait benchmarks, each under the heading its own spec names.
    for (const t of ['Agility', 'Strength', 'Finesse', 'Instinct', 'Presence', 'Knowledge']) {
      expect(body(two, 'difficulty-benchmarks')).toContain(`## ${t}`);
    }
    expect(body(two, 'difficulty-benchmarks')).toContain(
      '| 30 | Recall secret information about an obscure historical group.',
    );
    // The flowed list is read column by column, not row by row.
    expect(body(two, 'using-adversaries')).toContain('- Acrobatics\n- Ambusher\n- Bartering\n- Blademaster');
  });

  it('reads SRD 2.0’s second-level bullet as a bullet', async () => {
    const two = await read(1);
    expect(body(two, 'making-gm-moves')).toContain('- An adversary attacks\n- The PC marks a Stress');
    expect(body(two, 'making-gm-moves')).not.toContain('◦');
  });

  /*
   * The equipment chapter, whose seam with the island after it is the thing
   * this file can check and `--check` cannot. Both islands read the `GOLD`
   * banner - one to start, one to stop one folio earlier - so a page handed to
   * both, or to neither, is exactly what these two assertions are for.
   */
  it('meets the Gold island at the GOLD banner, with no page in both and none in neither', async () => {
    for (const [i, gold] of [[0, 62], [1, 84]] as const) {
      const rules = await read(i);
      const at = (id: string): number | undefined =>
        rules.find((r) => r.id === id)?.sourcePage;
      // The last equipment section starts before the banner; Gold starts on it.
      expect(at('consumables'), `book ${i}`).toBeLessThan(gold);
      expect(at('gold'), `book ${i}`).toBe(gold);
      // And the page is read once: the consumables prose is not in `gold`, and
      // the Gold prose is not in `consumables`.
      expect(body(rules, 'gold')).not.toContain('up to five of each consumable');
      expect(body(rules, 'consumables')).not.toContain('handful');
    }
  });

  it('reads the chapter’s prose and none of its four collections’ tables', async () => {
    for (const i of [0, 1] as const) {
      const rules = await read(i);
      const ids = rules.map((r) => r.id);
      expect(ids, `book ${i}`).toEqual(
        expect.arrayContaining([
          'equipment', 'weapons', 'primary-weapon-tables', 'secondary-weapon-tables',
          'combat-wheelchair', 'armor', 'loot', 'consumables',
        ]),
      );
      // The sentences the dataset had no copy of at all before the island.
      expect(body(rules, 'weapons')).toContain('maximum burden is 2 hands');
      expect(body(rules, 'armor')).toContain('## REDUCING INCOMING DAMAGE');
      expect(body(rules, 'consumables')).toContain('up to five of each consumable at a time');
      // The tables are `equipment.ts`'s and `loot.ts`'s, set at 8pt, and no
      // row of any of them reaches a section. One name per collection, each
      // taken from a table on these very folios.
      const chapter = [
        'equipment', 'weapons', 'primary-weapon-tables', 'secondary-weapon-tables',
        'combat-wheelchair', 'armor', 'loot', 'consumables',
      ].map((id) => body(rules, id)).join('\n');
      for (const row of ['Broadsword', 'Gambeson Armor', 'Minor Health Potion', 'Piercing Arrow']) {
        expect(chapter, `book ${i} :: ${row}`).not.toContain(row);
      }
      // And the furniture the two drops exist to cut.
      expect(chapter).not.toContain('TIER 1 (LEVEL 1)');
      expect(chapter).not.toContain('Physical Weapons');
      expect(chapter).not.toContain('ARMOR TABLES');
      // What the drops deliberately keep: the banner's own sentence.
      expect(body(rules, 'primary-weapon-tables')).toContain(
        'Players can choose one Tier 1 primary weapon during character creation.',
      );
    }
  });

  it('splits the two pages that stack a full-width table under two columns', async () => {
    for (const i of [0, 1] as const) {
      const rules = await read(i);
      /*
       * Without `ARMOR TABLES` in `SPLIT_ABOVE`, `REDUCING INCOMING DAMAGE` is
       * read after the first two tier heads and falls inside the drop that
       * follows - so the section loses it entirely rather than misplacing it.
       */
      const armor = body(rules, 'armor');
      expect(armor.indexOf('## REDUCING INCOMING DAMAGE'), `book ${i}`).toBeGreaterThan(0);
      expect(armor).toContain('While unarmored, your character’s base Armor Score is 0');
      /*
       * And without `Light Frame Models`, the label sorts into the left column
       * and is emitted three headings before the paragraph it labels.
       */
      const chair = body(rules, 'combat-wheelchair');
      expect(chair.indexOf('## Light Frame Models')).toBeGreaterThan(chair.indexOf('## CHOOSING YOUR MODEL'));
      expect(chair).toContain('## Light Frame Models\n\nThough tough, these wheelchairs have light frames');
    }
  });
});
