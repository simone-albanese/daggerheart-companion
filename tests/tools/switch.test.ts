/**
 * The switch: SRD 2.0 is the dataset this app ships.
 *
 * Everything here is about the DECISION rather than about any one screen -
 * which file the bundle imports, which book the build writes, which ids
 * survived, and what happens to a character that was built before the switch
 * and is opened after it. The screens have their own files; this is the one
 * that fails if somebody points the app back at the wrong book, or forward at
 * a book with no committed dataset.
 *
 * ## The three literals, and why they are checked here rather than removed
 *
 * `src/store/dataset.ts` imports the dataset with a STATIC import, which
 * cannot be built from a variable. `tools/simulate.ts`,
 * `tools/sampleCharacters.ts` and `tools/buildRegistry.ts` each build a path
 * from `import.meta.url` and could import `SRD.datasetPath` instead - and
 * deliberately do not, because doing so would put `tools/loadSrd.ts`'s whole
 * poppler import chain behind three files that only want a filename. So four
 * files carry the same string, and the coupling is CHECKED instead of hidden:
 * the first `it` below reads each file and asserts the literal agrees with the
 * shipped book. That is the "decision with a diff" `tools/build-srd.ts`'s
 * refusal message names, made into something that can go red.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Character, Dataset, Ref } from '../../shared/types.ts';
import { indexDataset, type CollectionIndex } from '../../src/engine/character.ts';
import { baseDataset } from '../../src/store/dataset.ts';
import { BOOKS, SRD } from '../../tools/loadSrd.ts';
import { validate } from '../../tools/validate.ts';
import { fullMatrix, sampleMatrix } from '../../tools/sampleCharacters.ts';

const REPO = new URL('../../', import.meta.url);
const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, REPO)), 'utf8');
const load = (rel: string): Dataset => JSON.parse(read(rel)) as Dataset;

const one = load('data/srd-1.0.json');
const two = load('data/srd-2.0.json');

/** The nine SRD 1.0 weapons SRD 2.0 does not print. */
const DROPPED = [
  'axe-of-fortunis',
  'blessed-anlace',
  'firestaff',
  'ghostblade',
  'gilded-bow',
  'ilmaris-rifle',
  'mage-orb',
  'runes-of-ruination',
  'widogast-pendant',
] as const;

describe('which book this app ships', () => {
  it('names the same file in the bundle, in the three tools, and in the book', () => {
    expect(SRD.datasetPath).toBe('data/srd-2.0.json');
    // The static import the whole app hangs off.
    expect(read('src/store/dataset.ts')).toContain(`from '../../${SRD.datasetPath}'`);
    // The three that build a path from `import.meta.url`.
    for (const file of [
      'tools/simulate.ts',
      'tools/sampleCharacters.ts',
      'tools/buildRegistry.ts',
    ]) {
      expect(read(file), file).toContain(`../${SRD.datasetPath}`);
    }
    // And no consumer still reaching for the old one. `tests/` is excluded on
    // purpose: several files there read SRD 1.0 deliberately, and say so.
    for (const file of [
      'src/store/dataset.ts',
      'tools/simulate.ts',
      'tools/sampleCharacters.ts',
      'tools/buildRegistry.ts',
    ]) {
      expect(read(file).includes("'../../data/srd-1.0.json'"), file).toBe(false);
      expect(read(file).includes("'../data/srd-1.0.json'"), file).toBe(false);
    }
  });

  it('draws the book it says it draws, on every screen that stamps a page', () => {
    /*
     * `SRD_LABEL` is read off `layers[0]`, which the build writes from the
     * BOOK's own label. Nineteen render sites carried the literal `'SRD 1.0'`
     * beside a folio read from the dataset, so this is the assertion that
     * stops that coming back: no file under `src/` may print the name of a
     * revision, because the revision is a property of the bundle.
     */
    expect(baseDataset.layers[0]?.label).toBe('SRD 2.0');
    expect(baseDataset.revision).toBe('srd-2.0-2026-08-25');
    const printed = read('src/store/dataset.ts');
    expect(printed).toContain('SRD_LABEL');
  });

  it('keeps SRD 1.0 committed, buildable and unshipped', () => {
    const book = BOOKS.find((b) => b.revision === 'srd-1.0-2025-09-09')!;
    expect(book.shipped).toBe(false);
    // A `datasetPath` and not `null`: without it `npm run build:srd -- --check
    // --pdf <SRD 1>` prints "there is nothing to compare against" and exits 0
    // without reading a byte of the file, and the only evidence the 1.0 parse
    // still works stops being evidence.
    expect(book.datasetPath).toBe('data/srd-1.0.json');
    expect(one.revision).toBe('srd-1.0-2025-09-09');
    expect(one.weapons).toHaveLength(204);
  });

  it('ships a dataset that passes the build gate, asked here and not only by the CLI', () => {
    // `npm run build:srd -- --check` runs `validate` too, and it needs the PDF
    // and poppler. This is the same gate on the committed bytes, hermetically,
    // so a stock CI runner still finds out.
    const issues = validate(two);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(issues.filter((i) => i.severity === 'warning').map((i) => i.where).sort()).toEqual([
      'adversaries/vampire',
      'environments/hold-the-line',
    ]);
  });

  it('is the file the bundle actually holds, byte for byte', () => {
    // Not a re-parse and not a shape check: the JSON the app imports and the
    // JSON on disk are the same object.
    expect(JSON.stringify(baseDataset)).toBe(JSON.stringify(two));
  });
});

// ---------------------------------------------------------------------------
// What happens to a character that already exists
// ---------------------------------------------------------------------------

const COLS = [
  'classes',
  'subclasses',
  'ancestries',
  'communities',
  'domainCards',
  'beastforms',
  'weapons',
  'armors',
  'loot',
  'consumables',
  'adversaries',
  'environments',
] as const;
type Col = (typeof COLS)[number];

const mapOf = (ds: Dataset, c: Col): Map<Ref, Record<string, unknown>> =>
  indexDataset(ds).collections[c as keyof CollectionIndex] as unknown as Map<
    Ref,
    Record<string, unknown>
  >;

/** Fields that differ, ignoring the folio, which is a page and not a statistic. */
const fieldsThatMoved = (a: Record<string, unknown>, b: Record<string, unknown>): string[] => {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => k !== 'sourcePage');
  return keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
};

describe('a character built before the switch, resolved after it', () => {
  it('loses exactly the nine weapons, in exactly one collection', () => {
    /*
     * THE HEADLINE, and it is measured here rather than inherited from the
     * name census that produced it. The census compared NAMES; a character
     * holds `slugify(name)`, so a name that changed by one hyphen keeps its
     * name in a census and changes its id. This walks the ids.
     */
    const gone: string[] = [];
    for (const c of COLS) {
      const after = mapOf(two, c);
      for (const id of mapOf(one, c).keys()) if (!after.has(id)) gone.push(`${c}/${id}`);
    }
    expect(gone.sort()).toEqual(DROPPED.map((id) => `weapons/${id}`).sort());
  });

  it('resolves every one of its other 762 refs to a record with the same statistics', () => {
    /*
     * The dangerous class: a ref that still resolves but to a rescaled record.
     * Every field of every retained record, both books, sourcePage aside.
     *
     * Three groups come back changed and none of them is a statistic:
     *   - 18 ancestries, 60 loot and 60 consumables gain `set: "core"`, which
     *     is provenance the gear lane put on the row and no number reads;
     *   - 11 domain cards change one character of their NAME, an ASCII hyphen
     *     to U+2011 (`Arcana-Touched` -> `Arcana‑Touched`), plus
     *     `forest-sprites`, whose name the BOOK prints as `--FOREST SPRITES`;
     *   - 5 domain cards change `text`.
     * The five are named below, because a card's text is the rule a player
     * plays. Nothing else in either book moves a field at all.
     */
    const changed: Record<string, Array<{ id: string; fields: string[] }>> = {};
    let identical = 0;
    for (const c of COLS) {
      const after = mapOf(two, c);
      changed[c] = [];
      for (const [id, rec] of mapOf(one, c)) {
        const other = after.get(id);
        if (other === undefined) continue;
        const fields = fieldsThatMoved(rec, other);
        if (fields.length === 0) identical += 1;
        else changed[c]!.push({ id, fields });
      }
    }
    // 771 SRD 1.0 records, minus the nine that left.
    expect(identical + changed['ancestries']!.length + changed['domainCards']!.length +
      changed['loot']!.length + changed['consumables']!.length).toBe(762);

    // The collections a played number comes out of, untouched.
    for (const c of ['classes', 'subclasses', 'communities', 'beastforms', 'weapons', 'armors',
      'adversaries', 'environments'] as const) {
      expect(changed[c], `${c} moved a field`).toEqual([]);
    }
    // 195 of 195 retained weapons, field for field. The count is the load-
    // bearing half: `toEqual([])` alone would pass over an empty collection.
    expect(mapOf(two, 'weapons').size).toBe(391);
    expect([...mapOf(one, 'weapons').keys()].filter((id) => mapOf(two, 'weapons').has(id)))
      .toHaveLength(195);

    // Provenance, on three collections, and on no field a number reads.
    for (const c of ['ancestries', 'loot', 'consumables'] as const) {
      expect(changed[c]!.every((e) => e.fields.length === 1 && e.fields[0] === 'set'), c).toBe(true);
    }
    expect(changed['ancestries']).toHaveLength(18);
    expect(changed['loot']).toHaveLength(60);
    expect(changed['consumables']).toHaveLength(60);
    // `core` on every one of the eighteen SRD 1.0 kept; the six SRD 2.0 adds
    // carry `expansion`, which is exactly what the field is for.
    expect(
      new Set(two.ancestries.filter((a) => one.ancestries.some((b) => b.id === a.id)).map((a) => a.set)),
    ).toEqual(new Set(['core']));
    expect(new Set(two.ancestries.map((a) => a.set))).toEqual(new Set(['core', 'expansion']));

    // The cards, split by which field moved.
    const cards = changed['domainCards']!;
    expect(cards).toHaveLength(16);
    expect(cards.filter((e) => e.fields.join() === 'name').map((e) => e.id).sort()).toEqual([
      'arcana-touched',
      'battle-hardened',
      'blade-touched',
      'bone-touched',
      'codex-touched',
      'forest-sprites',
      'grace-touched',
      'midnight-touched',
      'sage-touched',
      'splendor-touched',
      'valor-touched',
    ]);
    expect(cards.filter((e) => e.fields.join() === 'text').map((e) => e.id).sort()).toEqual([
      'midnight-spirit',
      'notorious',
      'specter-of-the-dark',
      'tempest',
      'voice-of-reason',
    ]);
  });

  it('changes eleven card names by one codepoint, and one by a typo the book prints', () => {
    const nameOf = (ds: Dataset, id: string): string =>
      ds.domainCards.find((c) => c.id === id)!.name;
    // The hyphen fold: U+002D in SRD 1.0, U+2011 (non-breaking) in SRD 2.0.
    // The id does not move, because `slugify` folds both to `-`.
    expect(nameOf(one, 'arcana-touched')).toBe('Arcana-Touched');
    expect(nameOf(two, 'arcana-touched')).toBe('Arcana‑Touched');
    expect(nameOf(two, 'arcana-touched').replace(/‑/g, '-')).toBe(nameOf(one, 'arcana-touched'));
    /*
     * And the one that is not a hyphen. Folio 220 of the SRD 2.0 PDF prints
     * the heading as `--FOREST SPRITES`, verbatim - checked on the page, not
     * inferred from the parse - so the app draws a card called
     * `--Forest Sprites`. It is the book's typo and this build carries it
     * faithfully; whether to carry it is the owner's call, and it is pinned
     * here so the answer is a deliberate edit rather than a surprise.
     */
    expect(nameOf(one, 'forest-sprites')).toBe('Forest Sprites');
    expect(nameOf(two, 'forest-sprites')).toBe('--Forest Sprites');
  });

  it('rewrites one card rule, and it is a sentence the book deleted', () => {
    const textOf = (ds: Dataset, id: string): string =>
      ds.domainCards.find((c) => c.id === id)!.text;
    /*
     * The only one of the five whose MEANING changed. SRD 1.0's Notorious
     * ended "This card doesn't count against your loadout's domain card
     * maximum of 5 and can't be placed in your vault"; folio 216 of SRD 2.0
     * ends at "(to a minimum of one handful)." and the next line is the next
     * card's heading. Checked on the page.
     *
     * It costs a player nothing in this app's arithmetic, and that is measured
     * rather than assumed: no file under `src/` or `shared/` mentions the card
     * at all, so the loadout maximum never made an exception for it. What
     * changes is the text on the card, which is what a table reads.
     */
    expect(textOf(one, 'notorious')).toContain("doesn’t count against your loadout");
    expect(textOf(two, 'notorious')).not.toContain('loadout');
    expect(textOf(two, 'notorious')).toContain('(to a minimum of one handful).');

    // The other four are a hyphen or a paragraph break, not a rule.
    for (const id of ['midnight-spirit', 'voice-of-reason'] as const) {
      expect(textOf(two, id).replace(/‑/g, '-')).toBe(textOf(one, id));
    }
    for (const id of ['specter-of-the-dark', 'tempest'] as const) {
      expect(textOf(two, id).replace(/\n\n/g, ' ').replace(/\s+/g, ' ')).toBe(
        textOf(one, id).replace(/\n\n/g, ' ').replace(/\s+/g, ' '),
      );
    }
  });

  it('carries one paragraph break that cuts a sentence in half, and it is new', () => {
    /*
     * A DEFECT IN THE SHIPPED DATASET, pinned so it cannot be lost.
     *
     * Censused over every string in both files: a `\n\n` whose left side ends
     * in a lowercase word and whose right side starts with one is a sentence
     * split in two. SRD 1.0 has none. SRD 2.0 has exactly one, in Tempest.
     * Folio 220 sets the Sandstorm bullet at 9.3pt and its continuation at
     * 8.7pt, and the baseline delta at that seam is 14.14pt against
     * `PARAGRAPH_GAP`'s 11.5 - the identical Hurricane seam four lines above
     * measures 12.14 and does NOT break, so it is the gap arm of
     * `cardText`'s test in `shared/parsers/domainCards.ts` or its `block` arm.
     * Repairing it is a parser change and a dataset rebuild, which is not this
     * lane's; this is the tripwire that says it is still there.
     */
    const cuts = (ds: Dataset): string[] => {
      const out: string[] = [];
      const walk = (node: unknown, path: string): void => {
        if (typeof node === 'string') {
          const parts = node.split('\n\n');
          for (let i = 0; i < parts.length - 1; i += 1) {
            const left = parts[i]!.trimEnd();
            const right = parts[i + 1]!.trimStart();
            if (/[a-z]$/.test(left) && /^[a-z]/.test(right)) out.push(path);
          }
          return;
        }
        if (Array.isArray(node)) {
          node.forEach((v, i) => { walk(v, `${path}[${String(i)}]`); });
          return;
        }
        if (node !== null && typeof node === 'object') {
          for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
        }
      };
      walk(ds, '');
      return out;
    };
    expect(cuts(one)).toEqual([]);
    expect(cuts(two)).toHaveLength(1);
    const tempest = two.domainCards.find((c) => c.id === 'tempest')!;
    expect(tempest.text).toContain('Attacks made\n\nfrom beyond Melee range');
  });
});

// ---------------------------------------------------------------------------
// Every sheet the old book could make
// ---------------------------------------------------------------------------

describe('every character SRD 1.0 could make, opened on SRD 2.0', () => {
  /*
   * Built against SRD 1.0 with the generator the repo already has, then
   * resolved against the shipped index. 3333 sheets: `fullMatrix` walks 18
   * subclasses x 18 ancestries x 10 levels, and `sampleMatrix` adds the 93
   * hand-shaped ones (a blank sheet, a journal, a sheet from a newer device).
   */
  const rows = [...fullMatrix(one), ...sampleMatrix(one)];
  const ix = indexDataset(two);

  const refsOf = (c: Character): Array<[Col | 'items', Ref]> => {
    const out: Array<[Col | 'items', Ref]> = [];
    const add = (col: Col | 'items', r: Ref | null | undefined): void => {
      if (typeof r === 'string' && r !== '') out.push([col, r]);
    };
    add('classes', c.classRef);
    add('classes', c.multiclassRef);
    for (const r of c.subclassRefs) add('subclasses', r);
    for (const r of c.ancestryRefs) add('ancestries', r);
    add('communities', c.communityRef);
    for (const r of [...c.loadout, ...c.vault]) add('domainCards', r);
    add('weapons', c.activePrimaryWeapon);
    add('weapons', c.activeSecondaryWeapon);
    add('armors', c.activeArmor);
    for (const e of c.inventory) add('items', e.ref);
    if (c.beastform !== null) add('beastforms', c.beastform.ref);
    for (const ch of c.levelUpHistory) {
      const d = ch.detail as Record<string, unknown>;
      if (typeof d['cardRef'] === 'string') add('domainCards', d['cardRef']);
      if (typeof d['subclassRef'] === 'string') add('subclasses', d['subclassRef']);
      if (typeof d['classRef'] === 'string') add('classes', d['classRef']);
    }
    return out;
  };

  const resolves = (col: Col | 'items', r: Ref): boolean =>
    col === 'items'
      ? ix.collections.loot.has(r) || ix.collections.consumables.has(r)
      : (ix.collections[col as keyof CollectionIndex] as Map<Ref, unknown>).has(r);

  it('is a matrix worth the name, and it is built from the OLD book', () => {
    // Not vacuous: 18 x 18 x 10 is SRD 1.0's shape, and the shipped book's is
    // 26 x 24 x 10. A matrix built from the wrong dataset would prove nothing.
    expect(rows.length).toBe(3333);
    // Nine classes and one empty string: `sampleMatrix` includes a blank
    // sheet, which is a real shape the store can hold and carries no class.
    const classes = new Set(rows.map((r) => r.character.classRef));
    expect([...classes].filter((r) => r !== '').sort()).toHaveLength(9);
    expect(classes.has('')).toBe(true);
  });

  it('breaks exactly on the nine weapons and on nothing else', () => {
    const broken = new Map<string, number>();
    let walked = 0;
    let sheets = 0;
    for (const row of rows) {
      const refs = refsOf(row.character);
      walked += refs.length;
      let bad = 0;
      for (const [col, r] of refs) {
        if (resolves(col, r)) continue;
        // `?60007` and friends are parked ids from a sheet that arrived from a
        // newer device - unresolvable by design, and not a switch casualty.
        if (r.startsWith('?')) continue;
        bad += 1;
        broken.set(`${col}/${r}`, (broken.get(`${col}/${r}`) ?? 0) + 1);
      }
      if (bad > 0) sheets += 1;
    }
    expect(walked).toBeGreaterThan(59_000);
    expect([...broken.keys()].sort()).toEqual(DROPPED.map((id) => `weapons/${id}`).sort());
    // 186 of 3333 sheets, roughly one in eighteen, and every one of them for
    // the same reason: the generator hands out a tier-3 primary Magic weapon,
    // and all nine of the dropped weapons are tier 3, primary and Magic.
    expect(sheets).toBe(186);
  });
});
