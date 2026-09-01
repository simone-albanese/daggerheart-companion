/**
 * Provenance, and a family the typography does not delimit.
 *
 * SRD 2.0 tells two things about its ancestries that SRD 1.0 does not: which
 * are in the Core Set box, and that four of them are printed under a group
 * heading. Both arrive as parse failures rather than as design questions, and
 * both are easy to get subtly wrong in a way no crash reveals - so the
 * assertions here are about the CONTENT of the result, not about it existing.
 *
 * The synthetic half runs in CI. The two book-gated halves cannot: the manuals
 * are the owner's and are not in the repository.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceSection } from '../../shared/parsers/contents.ts';
import { parseAncestries } from '../../shared/parsers/ancestries.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const read = async (i: number) =>
  parseAncestries((await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages);

describe('cutting a section out of an overlapping range', () => {
  /*
   * `sectionRange` overlaps the next section by a page, because a chapter can
   * end on the page the next one starts - SRD 2.0 prints SIMIAH above the
   * COMMUNITIES banner on folio 38. The overlap lands at BOTH ends of a range,
   * and a reader that trimmed only the tail took the previous chapter's last
   * entries as its own first ones: communities read `Simiah` and asked why an
   * ancestry had no COMMUNITY FEATURE.
   */
  const l = (text: string) => ({ text });

  it('drops what precedes the section banner and what follows the next one', () => {
    const lines = [l('SIMIAH'), l('a monkey'), l('COMMUNITIES'), l('HIGHBORNE'), l('CORE MECHANICS'), l('later')];
    expect(sliceSection(lines, 'Communities', 'CORE MECHANICS').map((x) => x.text)).toEqual(['HIGHBORNE']);
  });

  it('keeps everything when the section starts its own page', () => {
    // A missing head is not an error: most chapters do start a page, and
    // requiring the banner would break every one of them.
    const lines = [l('HIGHBORNE'), l('LOREBORNE'), l('CORE MECHANICS')];
    expect(sliceSection(lines, 'Communities', 'CORE MECHANICS').map((x) => x.text)).toEqual([
      'HIGHBORNE',
      'LOREBORNE',
    ]);
  });
});

describe.skipIf(!have(0))('SRD 1.0, which fences nothing', () => {
  it('leaves every ancestry without a set, because the book never says', async () => {
    // Absent is not `core`. SRD 1.0 draws no product distinction anywhere, and
    // recording one it does not make would be inventing provenance.
    const a = await read(0);
    expect(a).toHaveLength(18);
    expect(a.filter((x) => x.set !== undefined)).toEqual([]);
    expect(a.filter((x) => x.family !== undefined)).toEqual([]);
  }, 120_000);
});

describe.skipIf(!have(1))('SRD 2.0, which fences both', () => {
  it('marks exactly the six the Core Set manifest leaves out', async () => {
    /*
     * The book prints two rosters and they disagree: "take the card for one of
     * the following ancestries" offers 24, and "the Daggerheart Core Set
     * includes only the following ancestries" names 18. The six in the gap are
     * the Hope & Fear Expansion Set's, and reading the manifest as if it were
     * the offer would have built an 18-ancestry dataset from a 24-ancestry
     * book, silently.
     */
    const a = await read(1);
    expect(a).toHaveLength(24);
    expect(a.filter((x) => x.set === 'expansion').map((x) => x.name).sort()).toEqual([
      'Aetheris',
      'Earthkin',
      'Emberkin',
      'Gnome',
      'Skykin',
      'Tidekin',
    ]);
    expect(a.filter((x) => x.set === 'core')).toHaveLength(18);
    expect(a.filter((x) => x.set === undefined)).toEqual([]);
  }, 120_000);

  it('gives Elemental Kin exactly its four, and stops where the alphabet resumes', async () => {
    /*
     * There is no typographic signal: ELEMENTAL KIN, EARTHKIN and ELF are all
     * EvelethCleanThin at 12pt at the same column origin. A first version
     * applied the family to everything after the heading and gave
     * `Elemental Kin` to Simiah.
     *
     * The signal is the ORDER - the chapter is alphabetical and the family is
     * the one place it is not. Dwarf, [Earthkin, Emberkin, Skykin, Tidekin],
     * Elf: the run ends when a name sorts below the one before it.
     */
    const a = await read(1);
    const family = a.filter((x) => x.family !== undefined);
    expect(family.map((x) => x.name)).toEqual(['Earthkin', 'Emberkin', 'Skykin', 'Tidekin']);
    expect(new Set(family.map((x) => x.family))).toEqual(new Set(['Elemental Kin']));
    // The one the leaking version got wrong, named so a regression says so.
    expect(a.find((x) => x.name === 'Simiah')?.family).toBeUndefined();
    expect(a.find((x) => x.name === 'Elf')?.family).toBeUndefined();
  }, 120_000);
});
