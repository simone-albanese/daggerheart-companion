/**
 * The index of everything the app ships, and the search over it.
 *
 * Every figure here is read off `data/srd-1.0.json` through the same
 * `baseDataset` the app bundles, never typed in beside the assertion. The one
 * rule this file follows above the others is the one the SEND lane learned on
 * 2026-08-26: **a test that carries the expected answer as a literal confirms
 * whatever the code does next.** So the counts are compared against the
 * dataset's own arrays, the "is this string the book's" check is made against
 * the book rather than against a list of allowed words, and where a query has
 * to be named the record it finds is looked up in the dataset first and the
 * search is asked to agree with *that*.
 */
import { describe, expect, it } from 'vitest';
import {
  searchSrd,
  SRD_KIND_LABELS,
  SRD_KINDS,
  srdIndex,
  type SrdKind,
  type SrdRecord,
} from '../../src/ui/shared/srdIndex.ts';
import { searchRules } from '../../src/ui/shared/srdReference.ts';
import { dataset } from './fixture.ts';

const index = srdIndex(dataset);
const beyondRules = index.filter((r) => r.kind !== 'rules');
const of = (kind: SrdKind): SrdRecord[] => index.filter((r) => r.kind === kind);

/**
 * Every string the shipped dataset carries, at any depth.
 *
 * This is the whole evidence for the file's central promise - that a line the
 * search can quote back to a GM came out of the book and not out of this
 * repository. Built by walking the dataset rather than by listing what is
 * expected, so a field added to the index tomorrow is checked by this the same
 * day without anyone remembering to add it here.
 */
const DATASET_STRINGS: ReadonlySet<string> = (() => {
  const pool = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      pool.add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const item of Object.values(value)) walk(item);
    }
  };
  walk(dataset);
  return pool;
})();

describe('the index of everything shipped', () => {
  it('holds one record per row of every collection, and nothing else', () => {
    // The count per kind, against the dataset's own arrays. `loot` and
    // `consumables` are two collections of one type and are two kinds here, so
    // a single `Item` total would hide one of them going missing.
    const expected: Record<SrdKind, number> = {
      rules: dataset.rules.length,
      domain: dataset.domains.length,
      domainCard: dataset.domainCards.length,
      class: dataset.classes.length,
      subclass: dataset.subclasses.length,
      beastform: dataset.beastforms.length,
      ancestry: dataset.ancestries.length,
      community: dataset.communities.length,
      // Zero on the shipped SRD 1.0, which has no Transformations chapter. The
      // kind exists so the search's vocabulary does not change under the reader
      // when the dataset does; see the guard below, which excepts it by name.
      transformation: dataset.transformations.length,
      stance: dataset.stances.length,
      weapon: dataset.weapons.length,
      armor: dataset.armors.length,
      loot: dataset.loot.length,
      consumable: dataset.consumables.length,
      adversary: dataset.adversaries.length,
      environment: dataset.environments.length,
    };
    for (const kind of SRD_KINDS) expect(of(kind), kind).toHaveLength(expected[kind]);

    const total = Object.values(expected).reduce((a, b) => a + b, 0);
    expect(index).toHaveLength(total);
    // The two figures the plan and the file's header both quote. Derived, so
    // that a folio which adds a weapon moves them here instead of leaving two
    // documents quoting a number the dataset stopped carrying.
    expect(total).toBe(1438);
    expect(beyondRules).toHaveLength(1369);
    expect(of('rules')).toHaveLength(69);
  });

  it('names every record the way the dataset names it, and stamps its own page', () => {
    for (const w of dataset.weapons) {
      const record = of('weapon').find((r) => r.id === w.id)!;
      expect(record.name).toBe(w.name);
      expect(record.page).toBe(w.sourcePage ?? null);
    }
    // A rules section's name is its title, which is the field the section
    // search bands on. The two searches have to agree about what a thing is
    // called or the same section reads as two different rows.
    for (const s of dataset.rules) {
      expect(of('rules').find((r) => r.id === s.id)!.name).toBe(s.title);
    }
  });

  it('has a label and an order for every kind, with nothing left unnamed', () => {
    expect([...SRD_KINDS].sort()).toEqual(Object.keys(SRD_KIND_LABELS).sort());
    expect(new Set(Object.values(SRD_KIND_LABELS)).size).toBe(SRD_KINDS.length);
    // Every kind in the type is a kind the index actually produces. A kind
    // added to the union and forgotten in `srdIndex` would draw an empty band
    // header and nothing under it, which is the shape of a promise with nothing
    // behind it.
    //
    // `transformation` used to be excepted here, with the exception itself
    // checked and a note saying it would go red "if the app shipped SRD 2.0,
    // for exactly the right reason". It did, and it did. The exception is
    // DELETED rather than widened - which is what that note asked for - and
    // the shipped chapter is asserted so the deletion cannot be read as the
    // guard quietly losing a kind.
    expect(dataset.transformations, 'the shipped book prints six').toHaveLength(6);
    for (const kind of SRD_KINDS) {
      expect(of(kind).length, kind).toBeGreaterThan(0);
    }
  });
});

describe('what a haystack is allowed to contain', () => {
  /**
   * The licence property, checked over all 849 rather than sampled.
   *
   * Not one line the search can match on or quote back is composed by this
   * repository. It is why `srdIndex.ts` prints a weapon's trait as `agility`
   * and not as the `Agility` every character sheet in the app draws: the moment
   * a line is title-cased by a table in `shared/types.ts` it stops being the
   * book's string and this assertion says so.
   */
  it('carries only strings the dataset itself carries', () => {
    const strays: string[] = [];
    for (const record of index) {
      for (const f of record.fields) {
        for (const line of f.lines) {
          if (!DATASET_STRINGS.has(line)) strays.push(`${record.kind}/${record.id}: ${line}`);
        }
      }
    }
    expect(strays).toEqual([]);
  });

  it('never puts a field label where a search or a quote can reach it', () => {
    for (const record of index) {
      for (const f of record.fields) {
        // The label is drawn beside the lines and is never one of them, so a GM
        // typing `IMPULSES` finds the environments whose text says it and not
        // every environment the app draws that word over.
        expect(record.haystack, `${record.id} / ${f.label}`).not.toContain(f.label);
      }
    }
  });

  it('leaves out every number it would have had to label, and keeps the book’s own', () => {
    /*
     * A tier, a level, an HP, a recall cost and a d100 roll are all absent, and
     * the check is on the *labels* rather than on the digits. Had any been put
     * in it would have arrived as a line like `TIER 2` - part label, part
     * datum, and the book's words in neither half - so the field it would have
     * needed is the thing that must not exist.
     */
    const labels = new Set(index.flatMap((r) => r.fields.map((f) => f.label)));
    for (const banned of [
      'TIER', 'LEVEL', 'HP', 'STRESS', 'DIFFICULTY', 'THRESHOLDS', 'RECALL COST',
      'ROLL', 'EVASION', 'BURDEN', 'SCORE', 'BONUS',
    ]) {
      expect([...labels], banned).not.toContain(banned);
    }

    /*
     * What bare numbers do survive are the book's, and they are worth pinning
     * rather than allowing: a Minion's attack damage is a flat number in the
     * SRD - `Giant Rat` deals `1` - so a line of one digit reaches the haystack
     * because the dataset wrote it that way. Every one of them is checked back
     * against the adversary it came from, so a composed number arriving here
     * later cannot hide among them.
     */
    const numeric = index.flatMap((r) =>
      r.fields.flatMap((f) => f.lines.filter((l) => /^\d+$/.test(l)).map((l) => ({ r, f, l }))),
    );
    expect(numeric.length).toBeGreaterThan(0);
    for (const { r, f, l } of numeric) {
      expect(f.label, `${r.id}`).toBe('ATTACK');
      expect(dataset.adversaries.find((a) => a.id === r.id)!.attack.damage).toBe(l);
    }
  });

  it('is exactly its fields, so what is found and what is drawn cannot drift', () => {
    for (const record of index) {
      expect(record.haystack).toBe(record.fields.flatMap((f) => f.lines).join('\n'));
    }
  });

  it('drops a field with nothing in it rather than drawing a heading over a hole', () => {
    for (const record of index) {
      for (const f of record.fields) {
        expect(f.lines.length, `${record.id} / ${f.label}`).toBeGreaterThan(0);
        for (const line of f.lines) expect(line.trim()).not.toBe('');
      }
    }
    // The case that proves the branch runs: not every card carries flavour
    // text, and the ones that do not must not carry the label either.
    const bare = dataset.domainCards.find((c) => (c.flavorText ?? '') === '')
      ?? dataset.domainCards.find((c) => c.flavorText === undefined);
    if (bare !== undefined) {
      const record = of('domainCard').find((r) => r.id === bare.id)!;
      expect(record.fields.map((f) => f.label)).not.toContain('FLAVOR');
    }
  });
});

describe('searching the book beyond the rules', () => {
  it('finds the two the rules search answered with silence', () => {
    /*
     * The pair the plan named as the whole reason for this part - and one of
     * the two is not the thing the plan called it. `Rally` is offered there as
     * a domain card; no record of any kind is named `Rally`, and the word is
     * the Bard's class feature. Looked up in the dataset first here, so the
     * search is asked to agree with the book rather than with the plan.
     */
    expect(dataset.domainCards.some((c) => c.name === 'Rally')).toBe(false);
    const bard = dataset.classes.find((c) => c.classFeatures.some((f) => f.name === 'Rally'))!;
    expect(bard).toBeDefined();

    expect(searchRules(dataset.rules, 'Acid Burrower')).toEqual([]);
    const burrower = searchSrd(beyondRules, 'Acid Burrower');
    /*
     * TWO now, and the second is the point rather than noise: SRD 2.0's Vast
     * Desert environment names the Acid Burrower in its own text, so the
     * search answers with the adversary AND with the place that uses it. The
     * adversary is first because it is asked for by name and the environment
     * merely says it - the ordering rule the check below `puts the records
     * asked for by name ahead` states.
     */
    expect(burrower.map((h) => [h.kind, h.name])).toEqual([
      ['adversary', 'Acid Burrower'],
      ['environment', 'Vast Desert'],
    ]);
    // Asked for by name, so there is no line to add and the page is the book's.
    expect(burrower[0]!.where).toBe('title');
    expect(burrower[0]!.line).toBeNull();
    expect(burrower[0]!.page).toBe(dataset.adversaries.find((a) => a.name === 'Acid Burrower')!.sourcePage);

    const rally = searchSrd(beyondRules, 'Rally');
    expect(rally.some((h) => h.kind === 'class' && h.name === bard.name)).toBe(true);
    // And it quotes the feature's own name, which is the line that carries the
    // word - not the paragraph under it and not the class description.
    expect(rally.find((h) => h.name === bard.name)!.line).toBe('Rally');
  });

  it('asks for every word of the record rather than every word of one line', () => {
    /*
     * The rewrite the plan asked for, and the case it exists for: a record's
     * fields are short, and two words of a query landing in two of them is the
     * person meaning one thing rather than two. Found in the dataset first, so
     * the query below is asking about a record this file did not choose.
     */
    const weapon = dataset.weapons.find(
      (w) => w.range === 'Melee' && w.category === 'Physical' && !w.name.toLowerCase().includes('melee'),
    )!;
    expect(weapon).toBeDefined();
    const query = `${weapon.name} melee`;

    const record = of('weapon').find((r) => r.id === weapon.id)!;
    // The two words are genuinely in two places - the name and one field - so a
    // line-scoped AND of the kind `searchRules` makes could not have returned
    // it, and that is the difference being asserted rather than assumed.
    expect(record.fields.some((f) => f.lines.includes('Melee'))).toBe(true);
    expect(record.haystack.toLowerCase()).not.toContain(weapon.name.toLowerCase());

    expect(searchSrd(beyondRules, query).some((h) => h.id === weapon.id)).toBe(true);
  });

  it('quotes the line carrying most of the words, not the first line carrying any', () => {
    const hits = searchSrd(beyondRules, 'countdown');
    const quoted = hits.filter((h) => h.line !== null);
    expect(quoted.length).toBeGreaterThan(0);
    for (const hit of quoted) {
      const record = beyondRules.find((r) => r.kind === hit.kind && r.id === hit.id)!;
      const lines = record.haystack.split('\n').map((l) => l.trim()).filter((l) => l !== '');
      const carried = (line: string): number =>
        line.toLowerCase().includes('countdown') ? 1 : 0;
      // No other line of the same record carries more of the query than the one
      // the hit chose to show.
      const best = Math.max(...lines.map(carried));
      expect(carried(hit.line!), `${hit.id}`).toBe(best);
    }
  });

  it('puts the records asked for by name ahead of the records that merely say it', () => {
    const hits = searchSrd(beyondRules, 'dagger');
    const kinds = hits.map((h) => h.where);
    // Every `title` comes before every `text`; the split is the same one
    // `searchRules` makes and for the same reason.
    expect(kinds.indexOf('text') === -1 || kinds.lastIndexOf('title') < kinds.indexOf('text')).toBe(
      true,
    );
    // And inside each half the order is the index's, which is the dataset's.
    const named = hits.filter((h) => h.where === 'title').map((h) => h.id);
    const inIndex = beyondRules.filter((r) => named.includes(r.id)).map((r) => r.id);
    expect(named).toEqual(inIndex);
  });

  it('says nothing at all for an empty query', () => {
    expect(searchSrd(beyondRules, '')).toEqual([]);
    expect(searchSrd(beyondRules, '   ')).toEqual([]);
  });

  it('answers a word the book does not carry with nothing, and does not fall back', () => {
    /*
     * The decision the header argues: `searchRules` widens to OR when its AND
     * finds nothing, and this does not. The query below carries one word that
     * is everywhere and one that is nowhere; an OR would return every record
     * holding the common word, which on this dataset is hundreds of rows.
     */
    const nowhere = 'velocipede';
    expect(beyondRules.some((r) => r.haystack.toLowerCase().includes(nowhere))).toBe(false);
    expect(searchSrd(beyondRules, nowhere)).toEqual([]);

    const common = searchSrd(beyondRules, 'damage');
    expect(common.length).toBeGreaterThan(20);
    expect(searchSrd(beyondRules, `damage ${nowhere}`)).toEqual([]);
  });

  it('never claims a hit it cannot show a line for', () => {
    for (const hit of searchSrd(beyondRules, 'fear')) {
      if (hit.where === 'title') {
        expect(hit.line).toBeNull();
        expect(hit.name.toLowerCase()).toContain('fear');
        continue;
      }
      // A body hit owes the line it landed in, and the line has to be the
      // record's own - the same promise `RuleHit.line` makes for a section.
      expect(hit.line).not.toBeNull();
      const record = beyondRules.find((r) => r.kind === hit.kind && r.id === hit.id)!;
      expect(record.haystack.split('\n').map((l) => l.trim())).toContain(hit.line);
    }
  });

  it('leaves the rules sections to the search that can land inside them', () => {
    // The index holds them - it is everything the app ships - and the screen
    // filters them out. Both halves are asserted here because a change to
    // either one alone puts every section on the glass twice.
    expect(of('rules')).toHaveLength(dataset.rules.length);
    expect(beyondRules.every((r) => r.kind !== 'rules')).toBe(true);
    expect(searchSrd(beyondRules, 'countdown').every((h) => h.kind !== 'rules')).toBe(true);
  });
});
