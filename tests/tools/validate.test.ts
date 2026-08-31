/**
 * The gate, once it stopped being nine SRD 1.0 numbers.
 *
 * `tools/validate.ts` used to assert `domains: 9`, `classes: 9`,
 * `ancestries: 18` and six more as fatal errors. Every one of them is a fact
 * about ONE book, so SRD 2.0 was rejected on arrival with nine failures even
 * where the parsers had read it perfectly.
 *
 * The load-bearing test is the first one, and it is the reason to trust any of
 * this: the numbers this recovers from SRD 1.0's own prose REPRODUCE the
 * constants that were deleted. A method that cannot recover the answer already
 * known is not one to point at the book nobody has parsed yet.
 *
 * The second is the reason to believe it is a widening: the same reader, given
 * SRD 2.0's sentences verbatim off folios 4 and 6, produces SRD 2.0's numbers -
 * and the two books word every single one of those sentences differently.
 *
 * The rest exist because "derived from the book" would be worthless if it were
 * also softer. Each one breaks the dataset in a way the old constants would
 * have caught and shows this catches it too.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Dataset, RulesSection } from '../../shared/types.ts';
import {
  REVISION_COUNTS,
  readBookClaims,
  validate,
  type Issue,
} from '../../tools/validate.ts';

const COMMITTED = fileURLToPath(new URL('../../data/srd-1.0.json', import.meta.url));

/** The committed SRD 1.0 dataset. Hermetic: no PDF, no poppler. */
const srd1 = (): Dataset => JSON.parse(readFileSync(COMMITTED, 'utf8')) as Dataset;

const errors = (issues: Issue[]): Issue[] => issues.filter((i) => i.severity === 'error');
const at = (issues: Issue[], where: string): Issue[] =>
  errors(issues).filter((i) => i.where === where);
const said = (issues: Issue[]): string => errors(issues).map((i) => `${i.where}: ${i.message}`).join('\n');

/**
 * SRD 2.0's five self-descriptions, transcribed off the pages.
 *
 * Folio 4 for the first four and folio 6 for the last, read out of the loaded
 * book this session. They are here rather than behind a PDF load because SRD
 * 2.0's rules parser does not run yet - it throws on a three-column table on
 * folio 66 - and the wording is the thing under test, not the extraction.
 *
 * Every one of them differs from SRD 1.0's: a numeral where SRD 1.0 spells the
 * word, a serial `and` SRD 1.0 does not set, a lowercase `domains` with the
 * trailing "included in the core set" dropped.
 */
const SRD2_CHARACTER_CREATION = [
  'Classes are role-based archetypes that determine which class features and domain cards a PC gains access to throughout the campaign. There are 13 classes in this SRD: Assassin, Bard, Brawler, Druid, Guardian, Ranger, Rogue, Seraph, Sorcerer, Warlock, Warrior, Witch, and Wizard.',
  'Subclasses further refine a class archetype and reinforce its expression by granting access to unique subclass features. Each class comprises two subclasses. Select one of your class’s subclasses and take its Foundation card.',
  'A character’s ancestry reflects their lineage, impacting their physicality and granting them two unique ancestry features. Take the card for one of the following ancestries, then write its name in the Heritage field of your character sheet: Aetheris, Clank, Drakona, Dwarf, Earthkin, Elf, Emberkin, Faerie, Faun, Firbolg, Fungril, Galapa, Giant, Gnome, Goblin, Halfling, Human, Infernis, Katari, Orc, Ribbet, Simiah, Skykin, Tidekin. To create a Mixed Ancestry, take the top (first-listed) ancestry feature from one ancestry and the bottom (second-listed) ancestry feature from another.',
  'Your character’s community represents their culture or environment of origin and grants them a community feature. Take the card for one of the following communities, then write its name in the Heritage field of your character sheet: Duneborne, Freeborne, Frostborne, Hearthborne, Highborne, Loreborne, Orderborne, Reborne, Ridgeborne, Seaborne, Slyborne, Underborne, Warborne, Wanderborne, Wildborne.',
  'Your class has access to two of the ten domains. Choose two level one cards from your class’s domains, which are listed in the upper left of your character sheet.',
].join('\n\n');

const rules = (body: string): RulesSection[] => [
  { id: 'character-creation', title: 'Character Creation', body },
];

describe('the counts come out of the book', () => {
  it("recovers SRD 1.0's nine deleted constants from SRD 1.0's own prose", () => {
    const ds = srd1();
    const issues: Issue[] = [];
    const claims = readBookClaims(ds.rules, issues);
    expect(errors(issues)).toEqual([]);

    // The five the book states outright.
    expect(claims.domains).toBe(9);
    expect(claims.classes?.count).toBe(9);
    expect(claims.classes?.names).toEqual([
      'Bard', 'Druid', 'Guardian', 'Ranger', 'Rogue', 'Seraph', 'Sorcerer', 'Warrior', 'Wizard',
    ]);
    expect(claims.subclassesPerClass).toBe(2);
    expect(claims.ancestries).toHaveLength(18);
    expect(claims.ancestries?.[0]).toBe('Clank');
    expect(claims.ancestries?.at(-1)).toBe('Simiah');
    expect(claims.communities).toEqual([
      'Highborne', 'Loreborne', 'Orderborne', 'Ridgeborne', 'Seaborne', 'Slyborne', 'Underborne',
      'Wanderborne', 'Wildborne',
    ]);

    // The two that were arithmetic on top of them all along.
    expect((claims.subclassesPerClass ?? 0) * ds.classes.length).toBe(18);
    const perDomain = REVISION_COUNTS[ds.revision]?.domainCardsPerDomain;
    expect(perDomain).toBe(21);
    expect((perDomain ?? 0) * (claims.domains ?? 0)).toBe(189);
  });

  it("reads SRD 2.0's wordings, which differ in every one of them", () => {
    const issues: Issue[] = [];
    const claims = readBookClaims(rules(SRD2_CHARACTER_CREATION), issues);
    expect(errors(issues)).toEqual([]);

    expect(claims.domains).toBe(10); // "ten", where SRD 1.0 says "nine Domains included in the core set"
    expect(claims.classes?.count).toBe(13); // a NUMERAL, where SRD 1.0 spells "nine"
    expect(claims.classes?.names).toEqual([
      'Assassin', 'Bard', 'Brawler', 'Druid', 'Guardian', 'Ranger', 'Rogue', 'Seraph',
      'Sorcerer', 'Warlock', 'Warrior', 'Witch', 'Wizard', // serial "and Wizard", stripped
    ]);
    expect(claims.subclassesPerClass).toBe(2);
    expect(claims.ancestries).toHaveLength(24);
    expect(claims.ancestries).toContain('Aetheris');
    expect(claims.ancestries).toContain('Tidekin');
    // Elemental Kin is a FAMILY heading in SRD 2.0's ancestry chapter and is not
    // an ancestry; the roster the book prints here does not name it.
    expect(claims.ancestries).not.toContain('Elemental Kin');
    expect(claims.communities).toHaveLength(15);
    expect(claims.communities).toContain('Duneborne');
  });

  it('passes the committed dataset with no errors at all', () => {
    expect(said(validate(srd1()))).toBe('');
  });
});

describe('the gate did not get looser', () => {
  it('catches a dropped ancestry, by name', () => {
    const ds = srd1();
    const gone = ds.ancestries.splice(4, 1)[0]!;
    const issues = at(validate(ds), 'ancestries');
    expect(issues.map((i) => i.message).join('\n')).toContain(gone.name);
    expect(issues.some((i) => i.message.includes('expected 18'))).toBe(true);
  });

  it('catches an ancestry the book does not name, which a count alone would not', () => {
    const ds = srd1();
    // The real failure this replays: a family heading read as a nineteenth
    // ancestry. Swapped in for a real one, so the COUNT stays 18.
    ds.ancestries[0] = { ...ds.ancestries[0]!, id: 'elemental-kin', name: 'Elemental Kin' };
    const issues = at(validate(ds), 'ancestries');
    expect(issues.map((i) => i.message).join('\n')).toContain('Elemental Kin');
  });

  it('catches a dropped class', () => {
    const ds = srd1();
    const gone = ds.classes.splice(2, 1)[0]!;
    const issues = at(validate(ds), 'classes');
    expect(issues.map((i) => i.message).join('\n')).toContain(gone.name);
  });

  it('still counts subclasses when the class that owned them went with them', () => {
    const ds = srd1();
    // The shape that used to go quiet: drop a class AND its two subclasses, so
    // `2 x ds.classes.length` moves with the dataset and agrees with itself.
    const gone = ds.classes.splice(2, 1)[0]!;
    ds.subclasses = ds.subclasses.filter((s) => s.classRef !== gone.id);
    expect(ds.subclasses).toHaveLength(16);
    expect(at(validate(ds), 'classes').length).toBeGreaterThan(0);
    expect(at(validate(ds), 'subclasses').map((i) => i.message).join('\n')).toContain('expected 18');
  });

  it('catches a card filed under a domain this printing does not open', () => {
    const ds = srd1();
    // `dread` is in the DOMAINS constant - it has been since before this repo
    // read a book that prints it - so the constant would wave this through.
    ds.domainCards[0] = { ...ds.domainCards[0]!, domain: 'dread' };
    const issues = errors(validate(ds));
    expect(issues.some((i) => i.where === 'domainCards/dread' && i.message.includes('does not open'))).toBe(true);
  });

  it('catches a dropped community', () => {
    const ds = srd1();
    const gone = ds.communities.splice(0, 1)[0]!;
    expect(at(validate(ds), 'communities').map((i) => i.message).join('\n')).toContain(gone.name);
  });

  it('catches a dropped domain, through the card count the book implies', () => {
    const ds = srd1();
    ds.domains.splice(8, 1);
    const issues = errors(validate(ds));
    expect(issues.some((i) => i.where === 'domains')).toBe(true);
    expect(issues.some((i) => i.where === 'domainCards')).toBe(true);
  });

  it('catches a dropped domain card', () => {
    const ds = srd1();
    const gone = ds.domainCards.findIndex((c) => c.domain === 'valor');
    ds.domainCards.splice(gone, 1);
    const issues = errors(validate(ds));
    expect(issues.some((i) => i.where === 'domainCards/valor')).toBe(true);
  });

  it("catches a card that moved level, which the per-domain count cannot see", () => {
    const ds = srd1();
    const card = ds.domainCards.find((c) => c.domain === 'valor' && c.level === 4)!;
    card.level = 3;
    const issues = errors(validate(ds));
    // Still 21 valor cards, so the count is happy and the ladder is not.
    expect(issues.some((i) => i.where === 'domainCards/valor' && i.message.includes('ladder'))).toBe(
      true,
    );
  });

  it('catches a missing subclass', () => {
    const ds = srd1();
    ds.subclasses.pop();
    expect(at(validate(ds), 'subclasses').map((i) => i.message).join('\n')).toContain('expected 18');
  });

  it('catches an adversary count outside the measured range', () => {
    const ds = srd1();
    ds.adversaries.splice(20);
    expect(at(validate(ds), 'adversaries').map((i) => i.message).join('\n')).toContain('120-140');
  });
});

describe('a revision nobody has measured fails loudly', () => {
  it('names the table, the file and the key for an unknown revision', () => {
    const ds = srd1();
    ds.revision = 'srd-3.0-2027-01-01';
    const issue = at(validate(ds), 'revision')[0];
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('srd-3.0-2027-01-01');
    expect(issue!.message).toContain('REVISION_COUNTS');
    expect(issue!.message).toContain('tools/validate.ts');
    // It must also say which counts do NOT need an entry, or the next person
    // adds five numbers the book already states.
    expect(issue!.message).toContain('Character Creation');
  });

  it('treats a count left null as a hole, not as a pass', () => {
    const ds = srd1();
    /*
     * A SYNTHETIC revision, not SRD 2.0.
     *
     * This test used to point at `srd-2.0-2026-08-25`, whose beastforms,
     * environments and adversaries were genuinely null when it was written.
     * They have since been counted - 22, 47 and 264 - so pointing at the real
     * revision made the test fail for the best possible reason and took the
     * PROPERTY down with it. The property is "a null is a hole in the gate",
     * and it must outlive every revision anyone gets round to measuring, so it
     * is now pinned against a row that exists only here and is null by
     * construction.
     */
    REVISION_COUNTS['srd-test-null-row'] = {
      domainCardsPerDomain: 21,
      beastforms: null,
      environments: null,
      adversariesMin: null,
      adversariesMax: null,
    };
    ds.revision = 'srd-test-null-row';
    const issues = errors(validate(ds));
    for (const where of ['beastforms', 'environments', 'adversaries']) {
      const hit = issues.find((i) => i.where === where);
      expect(hit, `expected an error at ${where}`).toBeDefined();
      expect(hit!.message).toContain('is null in tools/validate.ts');
      expect(hit!.message).toContain('not a pass');
    }
    // ...and the one that IS measured stays quiet.
    expect(issues.some((i) => i.where === 'domainCards')).toBe(false);
  });

  it('does not let an unknown revision skip the counts the book states', () => {
    const ds = srd1();
    ds.revision = 'srd-3.0-2027-01-01';
    ds.ancestries.pop();
    expect(at(validate(ds), 'ancestries').length).toBeGreaterThan(0);
  });
});

describe('a printing that does not say what it contains', () => {
  it('is an error per claim, each naming where to look and refusing a constant', () => {
    const ds = srd1();
    ds.rules = [];
    const issues = errors(validate(ds));
    for (const field of ['domains', 'classes', 'subclassesPerClass', 'ancestries', 'communities']) {
      const hit = issues.find((i) => i.where === `counts/${field}`);
      expect(hit, `expected an error at counts/${field}`).toBeDefined();
      expect(hit!.message).toContain('folio');
      expect(hit!.message).toContain('do not replace the reading with a constant');
    }
  });

  it('refuses two statements that disagree rather than taking the first', () => {
    const ds = srd1();
    const cc = ds.rules.find((r) => r.id === 'character-creation')!;
    ds.rules = [
      cc,
      { id: 'a-second-copy', title: 'Second Copy', body: 'Your class has access to two of the ten domains.' },
    ];
    const issue = at(validate(ds), 'counts/domains')[0];
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('disagree');
  });

  it('refuses a roster whose stated count and printed names disagree', () => {
    const issues: Issue[] = [];
    readBookClaims(
      rules('There are nine classes in this SRD: Bard, Druid, Guardian, Ranger, Rogue.'),
      issues,
    );
    const hit = at(issues, 'counts/classes')[0];
    expect(hit).toBeDefined();
    expect(hit!.message).toContain('says 9 classes and then lists 5');
  });
});
