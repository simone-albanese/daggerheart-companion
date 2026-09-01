/**
 * Every character the game can make, and the engine's arithmetic over all of them.
 *
 * The other files in this directory prove one rule each on a fixture built to
 * show it. This one proves them on 3240 sheets: all eighteen subclasses crossed
 * with all eighteen ancestries at all ten levels, and every single one of them
 * started blank at level 1 and walked up through `validatePlan` and then
 * `applyLevelUp`, one level at a time, the way somebody actually plays. Nothing
 * here is written out by hand. A sheet you cannot reach by playing is not a
 * sheet anybody has, so proving the engine on one would prove nothing.
 *
 * The stakes are the stakes a character sheet always has. The numbers on it are
 * the numbers somebody reads out loud at a table while their character is being
 * shot at, and nobody at that table is checking them. A Severe threshold that
 * is right for a Guardian in chainmail and wrong for a Wizard who never picked
 * up armor is wrong for exactly one person, in the one moment they are counting
 * HP, and they will believe it. So will their GM.
 *
 * What is proved for each of the 3240: the Proficiency the level and the
 * advancements actually taken add up to; the damage thresholds, from the armor
 * that is really equipped; that no maximum in the game is exceeded; that Hope
 * is six minus the scars; that there is not one NaN, Infinity, undefined or
 * unexpected null anywhere in the character or in its derived stats, found by
 * walking the whole object graph rather than by spot-checking fields; that
 * every reference on the sheet names something the dataset really holds; and
 * that every card held, in the loadout and in the vault, is one this character
 * is allowed to hold.
 *
 * Coverage is measured and printed, never assumed. The matrix names three of
 * its axes (subclass, ancestry, level) and rotates the rest - community,
 * weapons, armor, domain cards, scars, advancement route - by index, either the
 * row's or that of the block of ten rows one character's climb occupies, so the
 * assignment is reproducible and a failing row can be rebuilt by name tomorrow.
 * The counts of what that actually reached are printed below; so are the
 * collections the matrix does not rotate at all, with what they happened to
 * reach, rather than rounding the whole thing up to "we covered everything".
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset, DomainId, Ref } from '../../shared/types.ts';
import {
  BASE_HOPE,
  MAX_ARMOR_SCORE,
  MAX_HP,
  MAX_LOADOUT,
  MAX_STRESS,
  deriveStats,
  indexDataset,
  syncCounters,
  type DatasetIndex,
  type DerivedStats,
} from '../../src/engine/character.ts';
import { availableOptions } from '../../src/engine/levelUp.ts';
import { addScar } from '../../src/engine/death.ts';
import { sumOf } from '../../src/engine/modifiers.ts';
import { characterRefs } from '../../src/transfer/codec.ts';
import {
  FULL_MATRIX_SIZE,
  fullMatrix,
  hasDataset,
  loadDataset,
  type FullMatrixRow,
} from '../../tools/sampleCharacters.ts';

/** A row of the matrix with the engine's answer for it, derived exactly once. */
interface Row extends FullMatrixRow {
  stats: DerivedStats;
}

let dataset: Dataset;
let index: DatasetIndex;
let rows: Row[] = [];
let buildMs = 0;
let deriveMs = 0;

// ---------------------------------------------------------------------------
// Reporting
//
// Every assertion below runs over all 3240 rows and collects what went wrong
// rather than throwing on the first one, because "one row is broken" and "every
// row at level 8 is broken" are different bugs and the difference is the count.
// ---------------------------------------------------------------------------

/**
 * Fail with the first ten offenders in the diff, and say out loud how many
 * there were in total, so a run that breaks a thousand rows cannot read as ten.
 */
function nothingWrong(failures: readonly string[]): void {
  if (failures.length > 10) {
    console.log(`  ${failures.length} failures in all; the diff shows the first 10`);
  }
  expect(failures.slice(0, 10)).toEqual([]);
  expect(failures.length).toBe(0);
}

const countBy = <T>(items: readonly T[], of: (item: T) => number | string): Map<string, number> => {
  const out = new Map<string, number>();
  for (const item of items) {
    const key = String(of(item));
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
};

const histogram = (counts: Map<string, number>): string =>
  [...counts]
    .sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${k}: ${n}`)
    .join('  ');

/**
 * What the matrix reached, out of what the dataset holds. Counted as the
 * intersection rather than as the size of `touched`, because one set of refs
 * often spans two collections - loot and consumables both live in the
 * inventory - and counting the whole set against each would report 120 of 60.
 */
function coverage(
  label: string,
  touched: ReadonlySet<string>,
  all: ReadonlyArray<{ id: string; name?: string }>,
): { found: number; missed: Array<{ id: string; name?: string }>; line: string } {
  const missed = all.filter((item) => !touched.has(item.id));
  const found = all.length - missed.length;
  const line = `    ${label.padEnd(14)} ${String(found).padStart(4)} of ${String(all.length).padEnd(4)}`;
  return { found, missed, line };
}

// ---------------------------------------------------------------------------
// The object-graph walk
// ---------------------------------------------------------------------------

interface Hole {
  path: string;
  what: string;
}

/**
 * The fields the types really do allow to be null. A null anywhere else is a
 * hole in the sheet, and the whole point of walking the graph rather than
 * spot-checking is that a hole in `companion.stress.max` is exactly as bad as
 * one in `hp.max` and nobody would have thought to check it.
 */
const NULLABLE_ON_A_CHARACTER: ReadonlySet<string> = new Set([
  'communityRef',
  // Null on all 3240, and it has to be: a transformation is granted by the GM
  // from the sheet, not taken by any advancement the matrix walks, and SRD 1.0
  // prints none to take.
  'transformationRef',
  'multiclassRef',
  'multiclassDomain',
  'evasionOverride',
  'thresholdOverride',
  'activePrimaryWeapon',
  'activeSecondaryWeapon',
  'activeArmor',
  'companion',
  'beastform',
  'inventory[].ref',
]);

/**
 * `unresolvedArmor` is null on all 3240 of these and has to be: every row wears
 * armor this dataset holds, so a ref parked here would mean the matrix built a
 * sheet pointing at armor that does not exist. Null is the answer that says the
 * thresholds beside it are the real ones.
 */
const NULLABLE_ON_DERIVED_STATS: ReadonlySet<string> = new Set([
  'beastform',
  'spellcastTrait',
  'unresolvedArmor',
]);

/** `cardLevelCap` is a closure by design; every other function is a mistake. */
const CALLABLE_ON_DERIVED_STATS: ReadonlySet<string> = new Set(['cardLevelCap']);

/**
 * Walk the whole graph and report every path holding a value that is not a
 * value: undefined, an unexpected null, NaN, or an infinity.
 */
function holesIn(
  root: unknown,
  nullable: ReadonlySet<string>,
  callable: ReadonlySet<string> = new Set(),
): Hole[] {
  const holes: Hole[] = [];
  const trail: string[] = [];
  const at = (): string => trail.join('').replace(/^\./, '');
  // The allow-lists are written per shape, so `inventory[7].ref` is checked as
  // `inventory[].ref` while the report still names the entry that was wrong.
  const shape = (): string => at().replace(/\[\d+\]/g, '[]');

  const visit = (value: unknown, depth: number): void => {
    if (depth > 24) {
      holes.push({ path: at(), what: 'nested more than 24 deep - a cycle?' });
      return;
    }
    if (value === undefined) {
      holes.push({ path: at(), what: 'undefined' });
      return;
    }
    if (value === null) {
      if (!nullable.has(shape())) holes.push({ path: at(), what: 'null' });
      return;
    }
    if (typeof value === 'number') {
      if (Number.isNaN(value)) holes.push({ path: at(), what: 'NaN' });
      else if (!Number.isFinite(value)) holes.push({ path: at(), what: String(value) });
      return;
    }
    if (typeof value === 'function') {
      if (!callable.has(shape())) holes.push({ path: at(), what: 'a function' });
      return;
    }
    if (typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        trail.push(`[${i}]`);
        visit(value[i], depth + 1);
        trail.pop();
      }
      return;
    }
    for (const key of Object.keys(value as Record<string, unknown>)) {
      trail.push(`.${key}`);
      visit((value as Record<string, unknown>)[key], depth + 1);
      trail.pop();
    }
  };

  visit(root, 0);
  return holes;
}

/** Every field `Character` requires. A key that is simply absent reads as
 *  undefined but leaves no trace for the walk above to trip over. */
const CHARACTER_FIELDS = [
  'id',
  'schemaVersion',
  'name',
  'pronouns',
  'classRef',
  'subclassRefs',
  'ancestryRefs',
  'communityRef',
  'multiclassRef',
  'multiclassDomain',
  'level',
  'traits',
  'traitMarks',
  'hp',
  'stress',
  'hope',
  'armorSlots',
  'evasionOverride',
  'thresholdOverride',
  'loadout',
  'vault',
  'activePrimaryWeapon',
  'activeSecondaryWeapon',
  'activeArmor',
  'inventory',
  'experiences',
  'gold',
  'connections',
  'notes',
  'levelUpHistory',
  'companion',
  'beastform',
  'scars',
  'consecutiveShortRests',
  'createdAt',
  'updatedAt',
] as const;

const DERIVED_FIELDS = [
  'tier',
  'proficiency',
  'evasion',
  'traits',
  'beastform',
  'thresholds',
  'massiveThreshold',
  'armorScore',
  'unresolvedArmor',
  'maxHp',
  'maxStress',
  'maxHope',
  'spellcastTrait',
  'domains',
  'cardLevelCap',
  'loadoutLimit',
] as const;

// ---------------------------------------------------------------------------
// References
// ---------------------------------------------------------------------------

/**
 * Every slug the sheet points at, with the field it came from so a dangling one
 * can be named. Kept independent of `characterRefs` in the transfer layer, and
 * then checked against it, so neither can go quietly incomplete alone.
 */
function refsOf(c: Row['character']): Array<{ where: string; ref: Ref }> {
  const out: Array<{ where: string; ref: Ref }> = [];
  const add = (where: string, ref: Ref | null | undefined): void => {
    if (typeof ref === 'string' && ref !== '') out.push({ where, ref });
  };
  add('classRef', c.classRef);
  c.subclassRefs.forEach((r, i) => add(`subclassRefs[${i}]`, r));
  c.ancestryRefs.forEach((r, i) => add(`ancestryRefs[${i}]`, r));
  add('communityRef', c.communityRef);
  add('multiclassRef', c.multiclassRef);
  c.loadout.forEach((r, i) => add(`loadout[${i}]`, r));
  c.vault.forEach((r, i) => add(`vault[${i}]`, r));
  add('activePrimaryWeapon', c.activePrimaryWeapon);
  add('activeSecondaryWeapon', c.activeSecondaryWeapon);
  add('activeArmor', c.activeArmor);
  c.inventory.forEach((e, i) => add(`inventory[${i}].ref`, e.ref));
  if (c.beastform !== null) add('beastform.ref', c.beastform.ref);
  c.levelUpHistory.forEach((choice, i) => {
    for (const key of ['cardRef', 'subclassRef', 'classRef'] as const) {
      const value = choice.detail[key];
      if (typeof value === 'string') add(`levelUpHistory[${i}].detail.${key}`, value);
    }
  });
  return out;
}

// ---------------------------------------------------------------------------

describe.skipIf(!hasDataset())('every character the game can make', () => {
  beforeAll(() => {
    dataset = loadDataset();
    index = indexDataset(dataset);
    const builtAt = Date.now();
    const built = fullMatrix(dataset);
    buildMs = Date.now() - builtAt;
    const derivedAt = Date.now();
    // Derived once here and read by every assertion below: 3240 full climbs is
    // the cost of this file, and paying it per test would be paying it nine times.
    rows = built.map((row) => ({ ...row, stats: deriveStats(row.character, dataset, index) }));
    deriveMs = Date.now() - derivedAt;
  }, 300_000);

  // -------------------------------------------------------------------------

  describe('the matrix itself', () => {
    it('is every subclass at every ancestry at every level, each cell exactly once', () => {
      expect(rows.length).toBe(FULL_MATRIX_SIZE);
      expect(new Set(rows.map((r) => r.subclassRef)).size).toBe(dataset.subclasses.length);
      expect(new Set(rows.map((r) => r.ancestryRef)).size).toBe(dataset.ancestries.length);
      expect(new Set(rows.map((r) => r.classRef)).size).toBe(dataset.classes.length);
      expect([...new Set(rows.map((r) => r.level))].sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);

      const cells = new Set(rows.map((r) => `${r.subclassRef}|${r.ancestryRef}|${r.level}`));
      expect(cells.size).toBe(FULL_MATRIX_SIZE);
      expect(new Set(rows.map((r) => r.character.id)).size).toBe(FULL_MATRIX_SIZE);
      // A character id that is also somebody's Experience id is a collision
      // waiting for the first thing that keys a map by id.
      const experienceIds = new Set(
        rows.flatMap((r) => r.character.experiences.map((e) => e.id)),
      );
      const characterIds = new Set(rows.map((r) => r.character.id));
      expect([...experienceIds].filter((id) => characterIds.has(id))).toEqual([]);

      const perLevel = countBy(rows, (r) => r.level);
      expect([...new Set(perLevel.values())]).toEqual([FULL_MATRIX_SIZE / 10]);

      console.log(
        `\n  ${rows.length} sheets: ${dataset.subclasses.length} subclasses ` +
          `x ${dataset.ancestries.length} ancestries x 10 levels` +
          `\n    across ${new Set(rows.map((r) => r.classRef)).size} classes, ` +
          `${FULL_MATRIX_SIZE / 10} sheets at each level` +
          `\n    built in ${buildMs} ms, derived in ${deriveMs} ms`,
      );
    });

    it('was climbed, level by level, and never written out by hand', () => {
      // `buildCharacter` only ever reaches `applyLevelUp` through a plan that
      // `validatePlan` accepted, and throws rather than inventing a sheet when
      // no plan validates - so a build that finished is a climb that happened.
      // What is left to prove is the shape of the record it left behind.
      const bothPicks = new Set(
        availableOptions(4)
          .filter((o) => o.costsBothPicks)
          .map((o) => `${o.id}@${o.tier}`),
      );
      expect(bothPicks.size).toBeGreaterThan(0);

      const wrong: string[] = [];
      let levelsClimbed = 0;
      for (const row of rows) {
        const byLevel = new Map<number, Array<Record<string, unknown>>>();
        for (const choice of row.character.levelUpHistory) {
          const list = byLevel.get(choice.level) ?? [];
          list.push(choice.detail);
          byLevel.set(choice.level, list);
        }
        const climbed = [...byLevel.keys()].sort((a, b) => a - b);
        const expected = Array.from({ length: row.level - 1 }, (_u, i) => i + 2);
        if (climbed.join(',') !== expected.join(',')) {
          wrong.push(`${row.label}: climbed levels ${climbed.join(',')}, expected ${expected.join(',')}`);
          continue;
        }
        levelsClimbed += climbed.length;
        for (const [level, details] of byLevel) {
          const keys = details.map((d) => `${String(d['optionId'])}@${String(d['optionTier'])}`);
          const spent = keys.reduce((n, key) => n + (bothPicks.has(key) ? 2 : 1), 0);
          if (spent !== 2) {
            wrong.push(`${row.label}: level ${level} spent ${spent} picks on ${keys.join(' + ')}`);
          }
        }
      }
      nothingWrong(wrong);
      // 324 sheets at each level, each climbing (level - 1) times.
      expect(levelsClimbed).toBe((FULL_MATRIX_SIZE / 10) * 45);
    });

    it('is reproducible: two builds differ only in the ids the engine mints', () => {
      const again = fullMatrix(dataset);
      expect(again.length).toBe(rows.length);
      // `applyLevelUp` mints a `crypto.randomUUID()` for each tier achievement's
      // Experience and `newCompanion` mints one per companion Experience, so raw
      // JSON equality is not the promise. Every *choice* is.
      const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
      const scrub = (row: FullMatrixRow): string =>
        JSON.stringify(row.character).replace(uuid, '<minted>');

      const drifted: string[] = [];
      let identical = 0;
      for (let i = 0; i < rows.length; i += 1) {
        if (scrub(rows[i]!) !== scrub(again[i]!)) drifted.push(rows[i]!.label);
        if (JSON.stringify(rows[i]!.character) === JSON.stringify(again[i]!.character)) {
          identical += 1;
        }
        expect(again[i]!.label).toBe(rows[i]!.label);
      }
      nothingWrong(drifted);
      console.log(
        `\n  rebuilt all ${rows.length}: every choice identical; ` +
          `${identical} rows are identical down to the byte, and the other ` +
          `${rows.length - identical} differ only in engine-minted uuids`,
      );
    });
  });

  // -------------------------------------------------------------------------

  describe('coverage, measured rather than assumed', () => {
    it('touches every community, weapon, armor and domain card in the dataset', () => {
      const communities = new Set<string>();
      const weapons = new Set<string>();
      const armors = new Set<string>();
      const cards = new Set<string>();
      for (const row of rows) {
        const c = row.character;
        if (c.communityRef !== null) communities.add(c.communityRef);
        if (c.activePrimaryWeapon !== null) weapons.add(c.activePrimaryWeapon);
        if (c.activeSecondaryWeapon !== null) weapons.add(c.activeSecondaryWeapon);
        if (c.activeArmor !== null) armors.add(c.activeArmor);
        for (const ref of c.loadout) cards.add(ref);
        for (const ref of c.vault) cards.add(ref);
      }

      const reports = [
        coverage('communities', communities, dataset.communities),
        coverage('weapons', weapons, dataset.weapons),
        coverage('armors', armors, dataset.armors),
        coverage('domain cards', cards, dataset.domainCards),
        coverage('subclasses', new Set(rows.map((r) => r.subclassRef)), dataset.subclasses),
        coverage(
          'ancestries',
          new Set(rows.flatMap((r) => r.character.ancestryRefs)),
          dataset.ancestries,
        ),
        coverage('classes', new Set(rows.map((r) => r.classRef)), dataset.classes),
      ];

      console.log('\n  what the matrix touched, of what the dataset holds');
      for (const r of reports) console.log(r.line);
      const untouched = reports.flatMap((r) => r.missed);
      console.log(
        untouched.length === 0
          ? '    nothing in any of them went untouched'
          : `    ${untouched.length} never touched, listed below`,
      );

      expect(communities.size).toBe(dataset.communities.length);
      expect(weapons.size).toBe(dataset.weapons.length);
      expect(armors.size).toBe(dataset.armors.length);
      expect(cards.size).toBe(dataset.domainCards.length);
      nothingWrong(
        untouched.map(
          (item) => `${item.id}${item.name === undefined ? '' : ` (${item.name})`} was never touched`,
        ),
      );
    });

    it('reaches every item and every Beastform too, and would name anything it did not', () => {
      // Loot, consumables and Beastforms are not axes of this matrix. They ride
      // along on the starting inventory and on the Druids, on strides of their
      // own, and a stride that comes to share a factor with a list length is
      // exactly how a collection quietly goes a third covered - so they are
      // counted here and the shortfall would be named rather than rounded off.
      const carried = new Set(
        rows.flatMap((r) => r.character.inventory.map((e) => e.ref).filter((ref) => ref !== null)),
      );
      const worn = new Set(
        rows.map((r) => r.character.beastform?.ref).filter((ref): ref is string => ref !== undefined),
      );
      const druids = rows.filter((r) => r.character.beastform !== null).length;

      const reports = [
        coverage('loot', carried, dataset.loot),
        coverage('consumables', carried, dataset.consumables),
        coverage('beastforms', worn, dataset.beastforms),
      ];
      console.log('\n  incidental, not an axis of the matrix');
      for (const r of reports) console.log(r.line);
      for (const r of reports) {
        for (const item of r.missed.slice(0, 25)) {
          console.log(`      never reached: ${item.id}${item.name === undefined ? '' : ` (${item.name})`}`);
        }
        if (r.missed.length > 25) console.log(`      ...and ${r.missed.length - 25} more`);
      }
      console.log(
        `    ${druids} sheets are transformed; a Beastform needs the Druid class feature,` +
          `\n    so at most the ${rows.filter((r) => r.classRef === 'druid').length} Druid sheets can ever wear one`,
      );

      nothingWrong(
        reports.flatMap((r) =>
          r.missed.map(
            (item) => `${item.id}${item.name === undefined ? '' : ` (${item.name})`} was never touched`,
          ),
        ),
      );
      expect(reports.map((r) => r.found)).toEqual([
        dataset.loot.length,
        dataset.consumables.length,
        dataset.beastforms.length,
      ]);
      expect(druids).toBeGreaterThan(0);
    });

    it('carries the shapes a fixture forgets, in numbers worth trusting', () => {
      const has = (of: (row: Row) => boolean): number => rows.filter(of).length;
      const shapes = {
        unarmored: has((r) => r.character.activeArmor === null),
        'no off-hand weapon': has((r) => r.character.activeSecondaryWeapon === null),
        'threshold override': has((r) => r.character.thresholdOverride !== null),
        'evasion override': has((r) => r.character.evasionOverride !== null),
        'mixed ancestry': has((r) => r.character.ancestryRefs.length > 1),
        companion: has((r) => r.character.companion !== null),
        beastform: has((r) => r.character.beastform !== null),
        multiclassed: has((r) => r.character.multiclassRef !== null),
        scarred: has((r) => r.character.scars.length > 0),
        'trait marks': has((r) => Object.keys(r.character.traitMarks).length > 0),
        'full loadout': has((r) => r.character.loadout.length === MAX_LOADOUT),
      };
      console.log('\n  shapes in the matrix');
      for (const [name, n] of Object.entries(shapes)) {
        console.log(`    ${name.padEnd(20)} ${String(n).padStart(5)}`);
      }
      console.log(
        `\n  scars per sheet   ${histogram(countBy(rows, (r) => r.character.scars.length))}` +
          `\n  advancement kinds ${histogram(
            countBy(
              rows.flatMap((r) => r.character.levelUpHistory),
              (h) => h.kind,
            ),
          )}`,
      );

      // Each shape is here because an engine rule only shows itself on sheets
      // that have it; a zero would mean that rule went unproven above.
      nothingWrong(
        Object.entries(shapes)
          .filter(([, n]) => n === 0)
          .map(([name]) => `no sheet in the matrix is ${name} - the rule it carries went unproven`),
      );
      expect(shapes.unarmored).toBeGreaterThan(200);
      /*
       * Every Beastbound sheet and no other, asked of the rows.
       *
       * This read `dataset.ancestries.length * 10`, which encoded "one
       * subclass x every ancestry x every level" and happened to be right
       * while the matrix was 18 x 18 x 10. It is not the same arithmetic on
       * SRD 2.0 - the generator also hands a Beastbound subclass to
       * multiclassed rows - so the count is 528 against the 240 that formula
       * gives. What the check is FOR is the biconditional, so that is what it
       * asks now: a companion on exactly the sheets that carry the subclass
       * granting one.
       */
      expect(shapes.companion).toBe(
        rows.filter((r) => r.character.subclassRefs.includes('beastbound')).length,
      );
      expect(shapes.companion).toBeGreaterThan(0);
      const kinds = new Set(rows.flatMap((r) => r.character.levelUpHistory.map((h) => h.kind)));
      expect([...kinds].sort()).toEqual([
        'domainCard',
        'evasion',
        'experience',
        'hitPoint',
        'multiclass',
        'proficiency',
        'stress',
        'subclass',
        'trait',
      ]);
    });
  });

  // -------------------------------------------------------------------------

  describe('the numbers on the sheet', () => {
    it('gives each of them the Proficiency their levels and their advancements earned', () => {
      // Counted off the record the climb left behind, not recomputed with the
      // same `baseProficiency` the engine used: the tier achievement at levels
      // 2, 5 and 8 raises it once each, and every 'proficiency' advancement
      // taken raises it once more.
      const wrong: string[] = [];
      for (const row of rows) {
        const reached = new Set(row.character.levelUpHistory.map((h) => h.level));
        const fromAchievements = [2, 5, 8].filter((l) => reached.has(l)).length;
        const fromAdvancements = row.character.levelUpHistory.filter(
          (h) => h.kind === 'proficiency',
        ).length;
        const earned = 1 + fromAchievements + fromAdvancements;
        if (row.stats.proficiency !== earned) {
          wrong.push(
            `${row.label}: proficiency ${row.stats.proficiency}, but earned ` +
              `1 + ${fromAchievements} achievements + ${fromAdvancements} advancements = ${earned}`,
          );
        }
      }
      nothingWrong(wrong);
      console.log(
        `\n  proficiency over the matrix  ${histogram(countBy(rows, (r) => r.stats.proficiency))}`,
      );
      // A run where every sheet came out at 1 would pass an equality check and
      // prove nothing, so say what the spread has to be.
      expect(new Set(rows.map((r) => r.stats.proficiency)).size).toBeGreaterThanOrEqual(4);
      expect(Math.min(...rows.map((r) => r.stats.proficiency))).toBe(1);
    });

    it('sets damage thresholds from the armor they are wearing, plus their level', () => {
      const wrong: string[] = [];
      let armored = 0;
      let unarmored = 0;
      let overridden = 0;
      for (const row of rows) {
        const c = row.character;
        const armor = c.activeArmor === null ? undefined : index.armors.get(c.activeArmor);
        if (c.activeArmor !== null && armor === undefined) {
          wrong.push(`${row.label}: armor ${c.activeArmor} is not in the dataset`);
          continue;
        }
        // And the stats have to agree that they were able to read the armor:
        // a parked ref here would mean the thresholds below are the unarmored
        // ladder wearing the armored one's clothes.
        if (row.stats.unresolvedArmor !== null) {
          wrong.push(`${row.label}: stats report armor ${row.stats.unresolvedArmor} as unresolvable`);
        }
        /*
         * The rule, spelled out rather than borrowed: an armored character's
         * thresholds are the armor's own plus their level; an unarmored one's
         * are their level and twice their level, because the base is [0, level]
         * and level is added to both halves. A manual override replaces both.
         *
         * AND THE LEDGER IS THE THIRD TERM, which is what this `it` was missing
         * until Simiah's Evasion got fixed and every other static bonus came
         * with it. Four things in the shipped dataset move a threshold and this
         * matrix reaches all four: Galapa's `Shell` (+Proficiency to both),
         * Stalwart's `Unwavering`, `Unrelenting` and `Undaunted` (+1, +2 and +3
         * to both, and they STACK), Winged Sentinel's `Ascendant` (+4 to Severe
         * alone) and a Bravesword's `Brave` (+3 to Severe alone). It is summed off
         * `row.stats.modifiers` rather than recomputed here on purpose: this
         * test is about the ARITHMETIC deriveStats does with the terms, and a
         * second hand-rolled register in a test file is the second answer this
         * repo keeps warning about. What it does check independently is that
         * the ledger's terms are the only difference - a bonus that appeared
         * from nowhere would still fail here.
         */
        const base: [number, number] =
          armor === undefined ? [0, c.level] : [armor.baseThresholds[0], armor.baseThresholds[1]];
        const expected: [number, number] = c.thresholdOverride ?? [
          base[0] + c.level + sumOf(row.stats.modifiers, 'major'),
          base[1] + c.level + sumOf(row.stats.modifiers, 'severe'),
        ];
        if (c.thresholdOverride !== null) overridden += 1;
        else if (armor === undefined) unarmored += 1;
        else armored += 1;

        const got = row.stats.thresholds;
        if (got[0] !== expected[0] || got[1] !== expected[1]) {
          wrong.push(
            `${row.label}: thresholds [${got.join(', ')}], expected [${expected.join(', ')}] ` +
              `(${armor === undefined ? 'unarmored' : armor.id} at level ${c.level})`,
          );
        }
        if (row.stats.massiveThreshold !== got[1] * 2) {
          wrong.push(
            `${row.label}: massive ${row.stats.massiveThreshold}, expected ${got[1] * 2}`,
          );
        }
      }
      nothingWrong(wrong);
      console.log(
        `\n  thresholds proved on ${armored} armored sheets and ${unarmored} unarmored ones;` +
          `\n    ${overridden} more carry a manual threshold override, which replaces both` +
          `\n    halves outright and is therefore the only rule those rows prove`,
      );
      expect(armored + unarmored + overridden).toBe(rows.length);
      expect(unarmored).toBeGreaterThan(0);
      expect(armored).toBeGreaterThan(0);
      expect(overridden).toBeGreaterThan(0);

      /*
       * And, said once more in the shape the rule is usually quoted in - with
       * the one qualifier the quote leaves out.
       *
       * "Unarmored is level and twice level" was written as a bare equality and
       * it stopped being true the day the ledger started reaching the
       * thresholds. 28 of the 3240 rows break it and every one of them is
       * right to: a Galapa's `Shell` adds their Proficiency to both halves
       * whether or not they are wearing anything, a Stalwart's three features
       * stack to +6, a Winged Sentinel's `Ascendant` puts +4 on Severe, and a
       * Bravesword adds +3 to Severe from the primary weapon slot - none of
       * which is armour, and none of which the old sentence had a term for.
       *
       * So the quoted rule is what a sheet with an EMPTY LEDGER reads, and that
       * is what is asserted. Splitting the population this way is worth more
       * than widening the sum would be: `bareLedger` proves the unarmored base
       * is untouched, and the rows with terms in them were already proved
       * against those terms above.
       */
      const bare = rows.filter(
        (r) => r.character.activeArmor === null && r.character.thresholdOverride === null,
      );
      const bareLedger = bare.filter(
        (r) => sumOf(r.stats.modifiers, 'major') === 0 && sumOf(r.stats.modifiers, 'severe') === 0,
      );
      const bareWrong = bareLedger.filter(
        (r) => r.stats.thresholds[0] !== r.level || r.stats.thresholds[1] !== r.level * 2,
      );
      nothingWrong(bareWrong.map((r) => `${r.label}: [${r.stats.thresholds.join(', ')}]`));
      expect(bare.length).toBe(unarmored);
      // The split has to be a split and not a way of asserting nothing: both
      // sides must be populated, or this `it` quietly stops proving the rule.
      expect(bareLedger.length).toBeGreaterThan(0);
      expect(bare.length - bareLedger.length).toBeGreaterThan(0);
    });

    it('never lets a maximum in the game be exceeded', () => {
      const wrong: string[] = [];
      const over = (row: Row, what: string, got: number, cap: number): void => {
        if (got > cap) wrong.push(`${row.label}: ${what} is ${got}, over the maximum of ${cap}`);
      };
      for (const row of rows) {
        const c = row.character;
        over(row, 'derived maxHp', row.stats.maxHp, MAX_HP);
        over(row, 'hp.max', c.hp.max, MAX_HP);
        over(row, 'hp.marked', c.hp.marked, c.hp.max);
        over(row, 'derived maxStress', row.stats.maxStress, MAX_STRESS);
        over(row, 'stress.max', c.stress.max, MAX_STRESS);
        over(row, 'stress.marked', c.stress.marked, c.stress.max);
        over(row, 'armorScore', row.stats.armorScore, MAX_ARMOR_SCORE);
        over(row, 'armorSlots.max', c.armorSlots.max, MAX_ARMOR_SCORE);
        over(row, 'armorSlots.marked', c.armorSlots.marked, c.armorSlots.max);
        over(row, 'loadout', c.loadout.length, MAX_LOADOUT);
        over(row, 'loadout', c.loadout.length, row.stats.loadoutLimit);
        // The stored maxima and the derived ones drift the moment one is set by
        // hand, and the sheet shows the stored one.
        if (c.hp.max !== row.stats.maxHp) {
          wrong.push(`${row.label}: hp.max ${c.hp.max} but derived maxHp ${row.stats.maxHp}`);
        }
        if (c.stress.max !== row.stats.maxStress) {
          wrong.push(
            `${row.label}: stress.max ${c.stress.max} but derived maxStress ${row.stats.maxStress}`,
          );
        }
        if (c.armorSlots.max !== row.stats.armorScore) {
          wrong.push(
            `${row.label}: armorSlots.max ${c.armorSlots.max} but armorScore ${row.stats.armorScore}`,
          );
        }
      }
      nothingWrong(wrong);
      console.log(
        `\n  hp.max      ${histogram(countBy(rows, (r) => r.stats.maxHp))}` +
          `\n  stress.max  ${histogram(countBy(rows, (r) => r.stats.maxStress))}` +
          `\n  armor score ${histogram(countBy(rows, (r) => r.stats.armorScore))}` +
          `\n  loadout     ${histogram(countBy(rows, (r) => r.character.loadout.length))}`,
      );
      expect(Math.max(...rows.map((r) => r.stats.maxHp))).toBeLessThanOrEqual(MAX_HP);
      expect(Math.max(...rows.map((r) => r.character.loadout.length))).toBe(MAX_LOADOUT);
    });

    it('crosses out one Hope slot per scar, on every one of them', () => {
      const wrong: string[] = [];
      for (const row of rows) {
        const c = row.character;
        const expected = Math.max(0, BASE_HOPE - c.scars.length);
        if (row.stats.maxHope !== expected) {
          wrong.push(
            `${row.label}: maxHope ${row.stats.maxHope} with ${c.scars.length} scars, expected ${expected}`,
          );
        }
        if (c.hope.max !== row.stats.maxHope) {
          wrong.push(`${row.label}: hope.max ${c.hope.max} but derived maxHope ${row.stats.maxHope}`);
        }
        // Hope is stored as what is *available*, the opposite of every other
        // track, so "more than the maximum" is the failure, not "more marked".
        if (c.hope.marked > c.hope.max) {
          wrong.push(`${row.label}: ${c.hope.marked} Hope in hand, of a maximum of ${c.hope.max}`);
        }
      }
      nothingWrong(wrong);
      const scars = countBy(rows, (r) => r.character.scars.length);
      console.log(
        `\n  scars       ${histogram(scars)}` +
          `\n  max Hope    ${histogram(countBy(rows, (r) => r.stats.maxHope))}`,
      );
      // The matrix's scars stop at five, because a sixth takes the last Hope
      // slot and ends the journey; the floor itself is proved just below.
      expect([...scars.keys()].map(Number).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(Math.min(...rows.map((r) => r.stats.maxHope))).toBe(1);
      expect(Math.max(...rows.map((r) => r.stats.maxHope))).toBe(BASE_HOPE);
    });

    it('takes the last Hope slot at the sixth scar and never goes below zero', () => {
      const unscarred = rows.filter((r) => r.level === 10 && r.character.scars.length === 0);
      expect(unscarred.length).toBeGreaterThan(0);
      const row = unscarred[0]!;
      let c = row.character;
      const hope: number[] = [];
      for (let i = 0; i <= 7; i += 1) {
        const stats = deriveStats(c, dataset, index);
        hope.push(stats.maxHope);
        c = syncCounters(c, stats);
        expect(c.hope.max).toBe(stats.maxHope);
        expect(c.hope.marked).toBeLessThanOrEqual(stats.maxHope);
        c = addScar(c, `scar ${i + 1}`);
      }
      expect(hope).toEqual([6, 5, 4, 3, 2, 1, 0, 0]);
      console.log(`\n  ${row.label}, scarred eight times: max Hope ${hope.join(" -> ")}`);
    });
  });

  // -------------------------------------------------------------------------

  describe('nothing missing and nothing dangling', () => {
    it('holds no NaN, no Infinity, no undefined and no unexpected null, anywhere', () => {
      const wrong: string[] = [];
      let fieldsWalked = 0;
      for (const row of rows) {
        for (const field of CHARACTER_FIELDS) {
          if (!Object.hasOwn(row.character, field)) {
            wrong.push(`${row.label}: character has no ${field} at all`);
          }
        }
        for (const field of DERIVED_FIELDS) {
          if (!Object.hasOwn(row.stats, field)) {
            wrong.push(`${row.label}: derived stats have no ${field} at all`);
          }
        }
        for (const hole of holesIn(row.character, NULLABLE_ON_A_CHARACTER)) {
          wrong.push(`${row.label}: character.${hole.path} is ${hole.what}`);
        }
        for (const hole of holesIn(
          row.stats,
          NULLABLE_ON_DERIVED_STATS,
          CALLABLE_ON_DERIVED_STATS,
        )) {
          wrong.push(`${row.label}: stats.${hole.path} is ${hole.what}`);
        }
        fieldsWalked += CHARACTER_FIELDS.length + DERIVED_FIELDS.length;
      }
      nothingWrong(wrong);
      expect(fieldsWalked).toBe(rows.length * (CHARACTER_FIELDS.length + DERIVED_FIELDS.length));

      // The walk is only worth anything if it really descends, so prove it
      // catches a hole planted at the depth the real ones hide at.
      const planted = structuredClone(
        rows.find((r) => r.character.companion !== null)!.character,
      );
      (planted.companion as { stress: { max: number } }).stress.max = Number.NaN;
      planted.inventory[0]!.quantity = Number.POSITIVE_INFINITY;
      expect(holesIn(planted, NULLABLE_ON_A_CHARACTER)).toEqual([
        { path: 'inventory[0].quantity', what: 'Infinity' },
        { path: 'companion.stress.max', what: 'NaN' },
      ]);
    });

    it('points at nothing the dataset does not hold', () => {
      const domains = new Set<string>(dataset.domains.map((d) => d.id));
      const wrong: string[] = [];
      let checked = 0;
      for (const row of rows) {
        for (const { where, ref } of refsOf(row.character)) {
          checked += 1;
          if (!index.byRef.has(ref)) wrong.push(`${row.label}: ${where} = "${ref}" is not in the dataset`);
        }
        const domain: DomainId | null = row.character.multiclassDomain;
        if (domain !== null && !domains.has(domain)) {
          wrong.push(`${row.label}: multiclassDomain "${domain}" is not a domain`);
        }
        for (const d of row.stats.domains) {
          if (!domains.has(d)) wrong.push(`${row.label}: derived domain "${d}" is not a domain`);
        }
        // And the enumeration above is itself checked against the one the
        // transfer layer uses, so neither can quietly go incomplete alone.
        const mine = refsOf(row.character)
          .map((r) => r.ref)
          .sort()
          .join('|');
        const theirs = [...characterRefs(row.character)].sort().join('|');
        if (mine !== theirs) wrong.push(`${row.label}: ref enumeration disagrees with characterRefs`);
      }
      nothingWrong(wrong);
      console.log(`\n  ${checked} references across ${rows.length} sheets, all resolved`);
      expect(checked).toBeGreaterThan(rows.length * 10);
    });

    it('keeps only cards this character is allowed to hold, in the loadout and the vault', () => {
      const wrong: string[] = [];
      let inLoadout = 0;
      let inVault = 0;
      let fromMulticlass = 0;
      for (const row of rows) {
        // The vault is checked alongside the loadout because `applyLevelUp`
        // writes acquired cards straight into it with no legality check of its
        // own, and because a loadout is only ever the first five cards a sheet
        // acquired - a multiclass domain's cards are all in the vault, so the
        // half-level cap would go entirely unproven if only loadouts were read.
        const held: Array<[string, Ref]> = [
          ...row.character.loadout.map((ref, i): [string, Ref] => [`loadout[${i}]`, ref]),
          ...row.character.vault.map((ref, i): [string, Ref] => [`vault[${i}]`, ref]),
        ];
        inLoadout += row.character.loadout.length;
        inVault += row.character.vault.length;
        for (const [where, ref] of held) {
          const card = index.cards.get(ref);
          if (card === undefined) {
            wrong.push(`${row.label}: ${where} = "${ref}" is not a domain card`);
            continue;
          }
          if (!row.stats.domains.includes(card.domain)) {
            wrong.push(
              `${row.label}: ${where} ${card.id} is a ${card.domain} card, and this ` +
                `character has ${row.stats.domains.join(' and ')}`,
            );
          }
          if (card.level > row.character.level) {
            wrong.push(
              `${row.label}: ${where} ${card.id} is level ${card.level}, above their level`,
            );
          }
          // The stricter rule the engine actually applies: a multiclass domain
          // only opens cards up to half the character's level, rounded up.
          const cap = row.stats.cardLevelCap(card.domain);
          if (card.level > cap) {
            wrong.push(
              `${row.label}: ${where} ${card.id} is level ${card.level}, above the ` +
                `cap of ${cap} in ${card.domain}`,
            );
          }
          if (card.domain === row.character.multiclassDomain) fromMulticlass += 1;
        }
      }
      nothingWrong(wrong);
      console.log(
        `\n  ${inLoadout} cards in loadouts and ${inVault} in vaults across ${rows.length} sheets,` +
          `\n    all of them in a domain the character has and under their cap in it;` +
          `\n    ${fromMulticlass} came from a multiclass domain, where that cap is half` +
          `\n    the character's level rounded up rather than their level`,
      );
      expect(inLoadout).toBeGreaterThan(rows.length * 2);
      expect(inVault).toBeGreaterThan(rows.length);
      expect(fromMulticlass).toBeGreaterThan(0);
    });

    it('owns no card twice and no subclass twice', () => {
      // `applyLevelUp` appends a card to the vault and a subclass to the list
      // with no check that it is not already there - the level-up screen keeps
      // its two card pickers from choosing the same card, and nothing else
      // does. Two copies of one card is a card the player cannot vault, and a
      // duplicate subclass is a feature list printed twice.
      const wrong: string[] = [];
      for (const row of rows) {
        const owned = [...row.character.loadout, ...row.character.vault];
        const seen = new Map<Ref, number>();
        for (const ref of owned) seen.set(ref, (seen.get(ref) ?? 0) + 1);
        for (const [ref, n] of seen) {
          if (n > 1) wrong.push(`${row.label}: owns ${ref} ${n} times`);
        }
        const subs = new Set(row.character.subclassRefs);
        if (subs.size !== row.character.subclassRefs.length) {
          wrong.push(`${row.label}: subclassRefs are ${row.character.subclassRefs.join(', ')}`);
        }
        const ancestries = new Set(row.character.ancestryRefs);
        if (ancestries.size !== row.character.ancestryRefs.length) {
          wrong.push(`${row.label}: ancestryRefs are ${row.character.ancestryRefs.join(', ')}`);
        }
      }
      nothingWrong(wrong);
      const multiclassed = rows.filter((r) => r.character.subclassRefs.length > 1);
      console.log(
        `\n  ${multiclassed.length} sheets carry a second subclass from multiclassing, ` +
          `and none carries it twice`,
      );
      expect(multiclassed.length).toBeGreaterThan(0);
    });
  });
});
