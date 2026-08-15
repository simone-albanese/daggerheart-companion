/**
 * The folio windows in `sections.ts` are copies of numbers that live in
 * `shared/parsers/`, and a copy drifts. Three of them had: beastforms claimed
 * folios 20-23 for a parser that reads 12-15, which handed it a window with
 * none of the section in it, and loot and environments named a last folio that
 * was not the parser's, so the truncation warning was untrue in both
 * directions.
 *
 * The parsers keep those numbers as module-private constants - correctly, since
 * nothing at runtime should be able to move a parser's window - so the check
 * reads them out of the source. A comparison against the real thing is worth
 * more here than a tidy import of a number this file would then be copying too.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLANS, renumber } from '../../src/import/sections.ts';
import type { BookPage } from '../../shared/textLayout.ts';

const source = (file: string): string =>
  readFileSync(fileURLToPath(new URL(`../../shared/parsers/${file}`, import.meta.url)), 'utf8');

/** `const FROM = 27;` -> 27. */
function constant(file: string, name: string): number {
  const m = new RegExp(`^const ${name} = (\\d+);`, 'm').exec(source(file));
  if (!m) throw new Error(`${file} no longer declares ${name}`);
  return Number(m[1]);
}

/** `const ARMOR_FOLIOS = [56, 57] as const;` -> [56, 57]. */
function folios(file: string, name: string): [number, number] {
  const m = new RegExp(`^const ${name} = \\[(\\d+), (\\d+)\\]`, 'm').exec(source(file));
  if (!m) throw new Error(`${file} no longer declares ${name}`);
  return [Number(m[1]), Number(m[2])];
}

/** The window each plan's parser actually filters on, read from the parser. */
const WINDOWS: Record<string, [number, number]> = {
  domains: [constant('domainCards.ts', 'DOMAINS_FOLIO'), constant('domainCards.ts', 'DOMAINS_FOLIO')],
  domainCards: [constant('domainCards.ts', 'APPENDIX_FROM'), constant('domainCards.ts', 'APPENDIX_TO')],
  classes: [constant('classes.ts', 'FROM_FOLIO'), constant('classes.ts', 'TO_FOLIO')],
  ancestries: [constant('ancestries.ts', 'FROM'), constant('ancestries.ts', 'TO')],
  communities: [constant('communities.ts', 'FROM'), constant('communities.ts', 'TO')],
  beastforms: [constant('beastforms.ts', 'FOLIO_FROM'), constant('beastforms.ts', 'FOLIO_TO')],
  // The equipment parser keeps a folio pair per table; the plan spans them all.
  weapons: [folios('equipment.ts', 'PRIMARY_FOLIOS')[0], folios('equipment.ts', 'WHEELCHAIR_FOLIOS')[1]],
  armors: folios('equipment.ts', 'ARMOR_FOLIOS'),
  loot: [constant('loot.ts', 'FROM_FOLIO'), constant('loot.ts', 'TO_FOLIO')],
  adversaries: [constant('adversaries.ts', 'FROM'), constant('adversaries.ts', 'TO')],
  environments: [constant('environments.ts', 'FROM'), constant('environments.ts', 'TO')],
};

const planFor = (kind: string) => {
  const plan = PLANS.find((p) => p.kinds.includes(kind));
  if (!plan) throw new Error(`no section plan contributes ${kind}`);
  return plan;
};

describe('section plans against the parsers they drive', () => {
  for (const [kind, [from, to]] of Object.entries(WINDOWS)) {
    it(`${kind} names the folios its parser reads`, () => {
      const plan = planFor(kind);
      expect([plan.srdFrom, plan.srdTo]).toEqual([from, to]);
    });
  }

  it('anchors every plan on or before the window its parser reads', () => {
    for (const plan of PLANS) {
      const anchor = plan.srdAnchor ?? plan.srdFrom;
      // An anchor past `srdFrom` renumbers the section's first page beyond the
      // parser's own window start, so no page can ever land in it.
      expect(anchor).toBeLessThanOrEqual(plan.srdFrom);
      expect(plan.srdFrom).toBeLessThanOrEqual(plan.srdTo);
    }
  });

  it('puts the beastform tables inside the beastform window, not past it', () => {
    // The class chapter opens on folio 8 in the SRD and the beastform tables
    // are four folios in. Anchoring beastforms on their own `srdFrom` was the
    // bug: the chapter opener landed on 12 and the tables on 16, one past the
    // last folio the parser will look at.
    const plan = planFor('beastforms');
    const anchor = plan.srdAnchor ?? plan.srdFrom;
    const classes = planFor('classes');
    expect(anchor).toBe(classes.srdFrom);

    // A manual class chapter at folios 27-51, beastforms four folios in.
    const pages = Array.from({ length: 25 }, (_, i) => ({ folio: 27 + i }) as BookPage);
    const shown = renumber(pages, 27, 51, anchor);
    const inWindow = shown.filter((p) => p.folio! >= plan.srdFrom && p.folio! <= plan.srdTo);
    expect(inWindow).toHaveLength(plan.srdTo - plan.srdFrom + 1);
    // Folio 12 of what the parser sees is folio 31 of the manual.
    expect(shown[4]!.folio).toBe(plan.srdFrom);
  });
});
