/**
 * The nine weapons SRD 2.0 drops, and whether any of them has a successor.
 *
 * `docs/handoff/DECISIONI-SRD-2-2026-08-31.md` §3 leaves the question open and
 * names the road that would close it: *"SRD 2.0 appears to have replaced them
 * with tier-scaled families (Shadowblade, Bloodstaff, Wand of Essek), but the
 * one-to-one correspondence is not verified"*. This file is the verification.
 * It is a census rather than an argument, and it says NO for eight of the nine.
 *
 * ## The measurement that decides it
 *
 * Two of the three candidates that sentence names are already in SRD 1.0.
 * `Bloodstaff` and `Wand of Essek` are tier-4 magic weapons on SRD 1's folio
 * 51, two folios after the nine, and both cross into SRD 2.0 field for field
 * unchanged. A weapon that shared a book with the thing it supposedly replaced
 * did not replace it; it carried the same feature label all along, which is why
 * a label search finds it and why a label search is not enough. `Magus
 * Revolver` and `Advanced Wand` are in SRD 1.0 for the same reason and answer
 * Ilmari's Rifle and Mage Orb the same way. Only `Shadowblade` is genuinely
 * new, and it is one of SIX base families SRD 2 adds, not a substitution.
 *
 * ## The control that gives the negative its force
 *
 * All 195 weapons both books print are identical in every field. SRD 2 rescaled
 * nothing it kept. So "renamed and rescaled" - which is what remapping
 * `Ghostblade` (d10+7) onto `Advanced Shadowblade` (d8+6) would assert the book
 * did - would be the single exception in a collection of 195 non-exceptions.
 * That is the evidence the third road needs and does not have.
 *
 * ## What is pinned here, and why in this shape
 *
 * The half that needs no PDF asserts against `data/srd-1.0.json`: the nine
 * exactly as a player's saved sheet holds them today, and the four candidates
 * standing beside them. Those assertions are what a remap would have to change,
 * so a remap cannot be done quietly while this file is green.
 *
 * The half that needs both PDFs re-derives the census from the books, in the
 * shape `tests/tools/audit-names.test.ts` established: `describe.skipIf` on the
 * manuals, which are the owner's and are not in the repository. The verdicts
 * live in `VERDICTS` below, beside the evidence that produced each one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Weapon } from '../../shared/types.ts';
import { parseWeapons } from '../../shared/parsers/equipment.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

/** The fields a remap would silently rewrite on somebody's character sheet. */
const FIELDS = [
  'tier',
  'slot',
  'category',
  'trait',
  'range',
  'damage',
  'damageType',
  'burden',
  'feature',
] as const;

/** `"Otherworldly: On a successful attack..."` -> `"Otherworldly"`. */
const labelOf = (feature: string): string => feature.split(':')[0]!.trim();

const shippedWeapons = (): Weapon[] =>
  (JSON.parse(readFileSync('data/srd-1.0.json', 'utf8')) as { weapons: Weapon[] }).weapons;

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));

/**
 * The nine, verbatim from the shipped dataset at the time this was written.
 *
 * Written out in full rather than derived, because the point of the table is to
 * be the BEFORE side of any future remap diff. A derived list would agree with
 * whatever the dataset says on the day it runs, which is exactly the property
 * this must not have.
 */
const NINE: ReadonlyArray<Weapon & { id: string }> = [
  {
    id: 'axe-of-fortunis',
    name: 'Axe of Fortunis',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'strength',
    range: 'Melee',
    damage: 'd10+8',
    damageType: 'mag',
    burden: 2,
    sourcePage: 49,
    feature: 'Lucky: On a failed attack, you can mark a Stress to reroll your attack.',
  },
  {
    id: 'blessed-anlace',
    name: 'Blessed Anlace',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'instinct',
    range: 'Melee',
    damage: 'd10+6',
    damageType: 'mag',
    burden: 1,
    sourcePage: 49,
    feature: 'Healing: During downtime, automatically clear a Hit Point.',
  },
  {
    id: 'ghostblade',
    name: 'Ghostblade',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'presence',
    range: 'Melee',
    damage: 'd10+7',
    damageType: 'phy or mag',
    burden: 1,
    sourcePage: 49,
    feature: 'Otherworldly: On a successful attack, you can deal physical or magic damage.',
  },
  {
    id: 'runes-of-ruination',
    name: 'Runes of Ruination',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'knowledge',
    range: 'Very Close',
    damage: 'd20+4',
    damageType: 'mag',
    burden: 1,
    sourcePage: 49,
    feature: 'Painful: Each time you make a successful attack, you must mark a Stress.',
  },
  {
    id: 'widogast-pendant',
    name: 'Widogast Pendant',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'knowledge',
    range: 'Close',
    damage: 'd10+5',
    damageType: 'mag',
    burden: 1,
    sourcePage: 49,
    feature: 'Timebending: You choose the target of your attack after making your attack roll.',
  },
  {
    id: 'gilded-bow',
    name: 'Gilded Bow',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'finesse',
    range: 'Far',
    damage: 'd6+7',
    damageType: 'mag',
    burden: 2,
    sourcePage: 49,
    feature: 'Self-Correcting: When you roll a 1 on a damage die, it deals 6 damage instead.',
  },
  {
    id: 'firestaff',
    name: 'Firestaff',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'instinct',
    range: 'Far',
    damage: 'd6+7',
    damageType: 'mag',
    burden: 2,
    sourcePage: 49,
    feature: 'Burning: When you roll a 6 on a damage die, the target must mark a Stress.',
  },
  {
    id: 'mage-orb',
    name: 'Mage Orb',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'knowledge',
    range: 'Far',
    damage: 'd6+7',
    damageType: 'mag',
    burden: 1,
    sourcePage: 49,
    feature:
      'Powerful: On a successful attack, roll an additional damage die and discard the lowest result.',
  },
  {
    id: 'ilmaris-rifle',
    name: 'Ilmari’s Rifle',
    tier: 3,
    slot: 'primary',
    category: 'Magic',
    trait: 'finesse',
    range: 'Very Far',
    damage: 'd6+6',
    damageType: 'mag',
    burden: 1,
    sourcePage: 49,
    feature:
      'Reloading: After you make an attack, roll a d6. On a result of 1, you must mark a Stress ' +
      'to reload this weapon before you can fire it again.',
  },
];

/**
 * The verdict for each of the nine, with the one fact that decides it.
 *
 * `coexisted` is the load-bearing column. A candidate that is already in
 * SRD 1.0 cannot be a successor to something SRD 1.0 also prints, however well
 * its feature line matches - and four of the six candidates a naive label
 * search returns are exactly that. `candidate: null` means the label left the
 * book entirely: nothing in SRD 2.0 carries the mechanic at all.
 */
const VERDICTS: ReadonlyArray<{
  id: string;
  /** The best SRD 2.0 candidate a feature-label search returns, or `null`. */
  candidate: string | null;
  /** Is that candidate ALSO in SRD 1.0, standing beside the weapon it "replaces"? */
  coexisted: boolean;
  verdict: 'PROVEN' | 'PLAUSIBLE' | 'NO SUCCESSOR';
  why: string;
}> = [
  {
    id: 'axe-of-fortunis',
    candidate: null,
    coexisted: false,
    verdict: 'NO SUCCESSOR',
    why: '`Lucky` was unique to it in SRD 1 and appears nowhere in SRD 2.',
  },
  {
    id: 'blessed-anlace',
    candidate: null,
    coexisted: false,
    verdict: 'NO SUCCESSOR',
    why: '`Healing` was unique to it in SRD 1 and appears nowhere in SRD 2.',
  },
  {
    id: 'ghostblade',
    candidate: 'Advanced Shadowblade',
    coexisted: false,
    verdict: 'PLAUSIBLE',
    why:
      'Every field matches except the damage, d10+7 -> d8+6. `Otherworldly` was unique to ' +
      'Ghostblade in SRD 1 and is unique to the Shadowblade family in SRD 2, and each book has ' +
      'exactly one either-kind weapon line. But Shadowblade runs all four tiers as a BASE ' +
      'family, one of six SRD 2 adds, where Ghostblade was a named tier-3 unique - and no other ' +
      'weapon in either book was rescaled. Suggestive; not proof.',
  },
  {
    id: 'runes-of-ruination',
    candidate: 'Bloodstaff',
    coexisted: true,
    verdict: 'NO SUCCESSOR',
    why: 'Bloodstaff is SRD 1 folio 51, tier 4, and crosses to SRD 2 unchanged. It coexisted.',
  },
  {
    id: 'widogast-pendant',
    candidate: 'Wand of Essek',
    coexisted: true,
    verdict: 'NO SUCCESSOR',
    why:
      'Wand of Essek is SRD 1 folio 51, tier 4, and crosses to SRD 2 unchanged. The two ' +
      'Timebending wordings already differed inside SRD 1, so that difference is not a rename.',
  },
  {
    id: 'gilded-bow',
    candidate: null,
    coexisted: false,
    verdict: 'NO SUCCESSOR',
    why:
      '`Self-Correcting` appears nowhere in SRD 2. `Serrated` - the same sentence with an 8 - is ' +
      'not its rename: Curved Dagger carried it in SRD 1 too, and still does.',
  },
  {
    id: 'firestaff',
    candidate: 'Fury Gem',
    coexisted: false,
    verdict: 'NO SUCCESSOR',
    why:
      'Fury Gem is new, but it is tier 2, Close, d8+3, one-handed against a tier-3 Far d6+7 ' +
      'two-hander. It generalises the trigger from "a 6" to "the maximum result"; it is not ' +
      'the same weapon.',
  },
  {
    id: 'mage-orb',
    candidate: 'Advanced Wand',
    coexisted: true,
    verdict: 'NO SUCCESSOR',
    why:
      'Advanced Wand has Mage Orb’s exact statline and sat five rows above it in the same ' +
      'SRD 1 table. Mage Orb was "Advanced Wand plus Powerful"; the Wand did not replace it.',
  },
  {
    id: 'ilmaris-rifle',
    candidate: 'Magus Revolver',
    coexisted: true,
    verdict: 'NO SUCCESSOR',
    why:
      '`Reloading` was on four other SRD 1 weapons, so it identifies nothing. Magus Revolver ' +
      'matches on trait, range and burden and is SRD 1 folio 51, tier 4, unchanged in SRD 2.',
  },
];

describe('the nine, as the shipped dataset holds them', () => {
  it('are all still in data/srd-1.0.json, field for field', () => {
    const byId = new Map(shippedWeapons().map((w) => [w.id, w]));
    for (const want of NINE) {
      const got = byId.get(want.id);
      expect(got, want.id).toBeDefined();
      for (const f of [...FIELDS, 'name', 'sourcePage'] as const) {
        expect(got![f], `${want.id}.${f}`).toEqual(want[f]);
      }
    }
  });

  it('are a contiguous block: every one tier 3, primary, Magic, folio 49', () => {
    const byId = new Map(shippedWeapons().map((w) => [w.id, w]));
    const block = NINE.map((n) => byId.get(n.id)!);
    expect(new Set(block.map((w) => w.tier))).toEqual(new Set([3]));
    expect(new Set(block.map((w) => w.slot))).toEqual(new Set(['primary']));
    expect(new Set(block.map((w) => w.category))).toEqual(new Set(['Magic']));
    expect(new Set(block.map((w) => w.sourcePage))).toEqual(new Set([49]));
  });

  it(
    'stand beside four of their own supposed successors: Bloodstaff, Wand of Essek, ' +
      'Magus Revolver and Advanced Wand are in SRD 1.0 as well',
    () => {
      const byName = new Map(shippedWeapons().map((w) => [w.name, w]));
      // The two §3 names that turn out to be red herrings, plus the two the
      // statline search adds.
      for (const name of ['Bloodstaff', 'Wand of Essek', 'Magus Revolver', 'Advanced Wand']) {
        expect(byName.has(name), `${name} should already be in SRD 1.0`).toBe(true);
      }
      // Same book, same chapter, two folios later - not a later revision.
      expect(byName.get('Bloodstaff')!.sourcePage).toBe(51);
      expect(byName.get('Wand of Essek')!.sourcePage).toBe(51);
      expect(byName.get('Magus Revolver')!.sourcePage).toBe(51);
      // And this one shared the nine's own printed page.
      expect(byName.get('Advanced Wand')!.sourcePage).toBe(49);
      expect(byName.get('Advanced Wand')!.damage).toBe('d6+7');
      expect(byName.get('Advanced Wand')!.damage).toBe(byName.get('Mage Orb')!.damage);

      // The one candidate that is NOT in SRD 1.0, which is why it is the only
      // one with a case to answer.
      for (const n of [
        'Shadowblade',
        'Improved Shadowblade',
        'Advanced Shadowblade',
        'Legendary Shadowblade',
      ]) {
        expect(byName.has(n), `${n} should be absent from SRD 1.0`).toBe(false);
      }
    },
  );

  it('records one verdict per weapon, and eight of the nine are NO SUCCESSOR', () => {
    expect(VERDICTS.map((v) => v.id)).toEqual(NINE.map((n) => n.id));
    expect(VERDICTS.filter((v) => v.verdict === 'PROVEN')).toEqual([]);
    expect(VERDICTS.filter((v) => v.verdict === 'PLAUSIBLE').map((v) => v.id)).toEqual([
      'ghostblade',
    ]);
    expect(VERDICTS.filter((v) => v.verdict === 'NO SUCCESSOR')).toHaveLength(8);
    // Every candidate that survives the coexistence test is either absent or
    // the Shadowblade, which is the whole finding in one line.
    expect(
      VERDICTS.filter((v) => v.candidate !== null && !v.coexisted).map((v) => v.candidate),
    ).toEqual(['Advanced Shadowblade', 'Fury Gem']);
  });
});

describe.skipIf(!(have(0) && have(1)))('both books, parsed', () => {
  let one: Weapon[] = [];
  let two: Weapon[] = [];

  beforeAll(async () => {
    one = parseWeapons((await loadSrd({ pdfPath: BOOKS[0]!.localPaths.find(existsSync)! })).pages);
    two = parseWeapons((await loadSrd({ pdfPath: BOOKS[1]!.localPaths.find(existsSync)! })).pages);
  }, 180_000);

  it('SRD 2.0 drops exactly these nine ids and nothing else', () => {
    const ids2 = new Set(two.map((w) => w.id));
    expect(one.filter((w) => !ids2.has(w.id)).map((w) => w.id)).toEqual(NINE.map((n) => n.id));
    expect(one).toHaveLength(204);
    expect(two).toHaveLength(391);
  });

  it(
    'CONTROL: every one of the 195 weapons both books print is identical in all nine fields, ' +
      'so SRD 2.0 rescaled nothing it kept',
    () => {
      const byName = new Map(two.map((w) => [`${w.name} ${w.tier} ${w.slot}`, w]));
      const changed: string[] = [];
      let compared = 0;
      for (const a of one) {
        const b = byName.get(`${a.name} ${a.tier} ${a.slot}`);
        if (b === undefined) continue;
        compared += 1;
        for (const f of FIELDS) if (String(a[f]) !== String(b[f])) changed.push(`${a.name}.${f}`);
      }
      expect(compared).toBe(195);
      expect(changed).toEqual([]);
    },
  );

  it('exactly three weapon-feature labels leave the book: Lucky, Healing, Self-Correcting', () => {
    const labels = (ws: Weapon[]): Set<string> =>
      new Set(
        ws
          .map((w) => w.feature)
          .filter((f) => f.length > 0)
          .map(labelOf),
      );
    const l1 = labels(one);
    const l2 = labels(two);
    expect([...l1].filter((l) => !l2.has(l))).toEqual(['Lucky', 'Healing', 'Self-Correcting']);
    // The sizes are asserted too: a label set that collapsed to nothing would
    // pass the difference above by accident.
    expect(l1.size).toBe(50);
    expect(l2.size).toBe(83);
  });

  it(
    'the either-kind damage cell is one weapon in SRD 1 and one family in SRD 2, and each ' +
      'book keeps its own spelling',
    () => {
      const either = (ws: Weapon[]): Weapon[] =>
        ws.filter((w) => w.damageType !== 'phy' && w.damageType !== 'mag');
      expect(either(one).map((w) => `${w.name} ${w.damageType}`)).toEqual(['Ghostblade phy or mag']);
      expect(either(two).map((w) => `${w.name} ${w.damageType}`)).toEqual([
        'Shadowblade phy/mag',
        'Improved Shadowblade phy/mag',
        'Advanced Shadowblade phy/mag',
        'Legendary Shadowblade phy/mag',
      ]);
    },
  );

  it('Ghostblade and Advanced Shadowblade differ in the damage and in nothing else', () => {
    const g = one.find((w) => w.id === 'ghostblade')!;
    const s = two.find((w) => w.name === 'Advanced Shadowblade')!;
    const differ = FIELDS.filter((f) => String(g[f]) !== String(s[f]));
    // `damageType` is on the list only because the two books spell the same
    // thing differently; `dealsPhysical`/`dealsMagic` answer identically for
    // both. `damage` is the one that would change a roll at a table.
    expect(differ).toEqual(['damage', 'damageType']);
    expect([g.damage, s.damage]).toEqual(['d10+7', 'd8+6']);
    expect(g.tier).toBe(s.tier);
  });

  it('Shadowblade is one of six base families SRD 2 adds, not a substitution for one unique', () => {
    const base = (n: string): string => n.replace(/^(Improved|Advanced|Legendary) /, '');
    const core = (w: Weapon): boolean =>
      w.category === 'Magic' &&
      w.slot === 'primary' &&
      w.sourcePage !== undefined &&
      w.sourcePage >= 56 &&
      w.sourcePage <= 69;
    const tiers = new Map<string, Set<number>>();
    for (const w of two.filter(core)) {
      const k = base(w.name);
      const seen = tiers.get(k) ?? new Set<number>();
      seen.add(w.tier);
      tiers.set(k, seen);
    }
    const families = [...tiers].filter(([, t]) => t.size === 4).map(([n]) => n);
    const inOne = new Set(one.map((w) => base(w.name)));
    expect(families.filter((f) => !inOne.has(f)).sort()).toEqual([
      'Arcane Rifle',
      'Brightsword',
      'Casting Dagger',
      'Enchanted Chakram',
      'Runelock Pistol',
      'Shadowblade',
    ]);
    expect(families.filter((f) => inOne.has(f))).toHaveLength(10);
  });

  it('there is no positional mapping: the two tier-3 magic tables do not line up', () => {
    const t3 = (ws: Weapon[], folios: number[]): Weapon[] =>
      ws.filter(
        (w) =>
          w.category === 'Magic' &&
          w.slot === 'primary' &&
          w.tier === 3 &&
          w.sourcePage !== undefined &&
          folios.includes(w.sourcePage),
      );
    const rows1 = t3(one, [49]);
    const rows2 = t3(two, [62, 63]);
    expect(rows1).toHaveLength(19);
    expect(rows2).toHaveLength(22);
    // SRD 1's block of named uniques is rows 11-19, and every one is gone.
    const names2 = new Set(two.map((w) => w.name));
    expect(rows1.slice(10).map((w) => w.name)).toEqual(NINE.map((n) => n.name));
    expect(rows1.slice(10).filter((w) => names2.has(w.name))).toEqual([]);
    // SRD 2's block of named uniques is rows 17-22, and every one is new.
    const names1 = new Set(one.map((w) => w.name));
    expect(rows2.slice(16).map((w) => w.name)).toEqual([
      'Rocket Maul',
      'Crystal Spear',
      'Arc Wand',
      'Rime Scepter',
      'Gunblade',
      'Staff of Augma',
    ]);
    expect(rows2.slice(16).filter((w) => names1.has(w.name))).toEqual([]);
  });

  it('the four coexisting candidates cross both books unchanged', () => {
    for (const name of ['Bloodstaff', 'Wand of Essek', 'Magus Revolver', 'Advanced Wand']) {
      const a = one.find((w) => w.name === name);
      const b = two.find((w) => w.name === name);
      expect(a, `${name} in SRD 1`).toBeDefined();
      expect(b, `${name} in SRD 2`).toBeDefined();
      for (const f of FIELDS) expect(String(b![f]), `${name}.${f}`).toBe(String(a![f]));
    }
  });

  it('and the label each of them carries was NOT unique to the weapon it would replace', () => {
    const carriers = (ws: Weapon[], label: string): string[] =>
      ws.filter((w) => w.feature.length > 0 && labelOf(w.feature) === label).map((w) => w.name);
    expect(carriers(one, 'Painful')).toEqual(['Runes of Ruination', 'Bloodstaff']);
    expect(carriers(one, 'Timebending')).toEqual(['Widogast Pendant', 'Wand of Essek']);
    expect(carriers(one, 'Reloading')).toHaveLength(5);
    expect(carriers(one, 'Powerful')).toHaveLength(10);
    // These four WERE unique in SRD 1, which is what makes their fate legible.
    // `Burning` is on an armor too, and armors are not in this list.
    for (const label of ['Lucky', 'Healing', 'Self-Correcting', 'Otherworldly', 'Burning']) {
      expect(carriers(one, label), label).toHaveLength(1);
    }
  });

  it(
    'nothing in SRD 2 names any of the nine, and the one near-miss is unchanged flavour prose ' +
      'that SRD 1 prints too',
    async () => {
      /*
       * Lines AND runs, the way `tests/tools/audit-names.test.ts` measures.
       *
       * This started as a lines-only count and said each name occurs "exactly
       * once" in SRD 1. That was the harness, not the book: `page.lines` is
       * de-columnised prose, so `Runes of Ruination` never appears whole on any
       * line, while `page.runs` reads the table row straight through. Over both
       * streams every name is found and `Gilded Bow` scores four, which is what
       * exposes the Gorgon.
       */
      const text = async (i: number): Promise<string> => {
        const { pages } = await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! });
        return [
          pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n'),
          pages.flatMap((p) => p.runs.map((r) => r.text)).join(' '),
        ].join('\n');
      };
      const count = (hay: string, needle: string): number => {
        let i = 0;
        let n = 0;
        for (;;) {
          const j = hay.indexOf(needle, i);
          if (j === -1) return n;
          n += 1;
          i = j + 1;
        }
      };
      const one = (await text(0)).toLowerCase();
      const two = (await text(1)).toLowerCase();

      // In SRD 2 every name is gone. `gilded bow` is the exception and it is
      // not the weapon: it is a Gorgon's description, and SRD 1 prints exactly
      // the same sentence, so it never was a reference to the item. Dropping
      // the nine leaves nothing in the book pointing at them.
      for (const w of NINE) {
        const name = w.name.toLowerCase();
        expect(count(two, name), `${w.name} in SRD 2`).toBe(w.id === 'gilded-bow' ? 2 : 0);
        expect(count(one, name), `${w.name} in SRD 1`).toBeGreaterThan(0);
      }
      const gorgon = 'a snake-headed, scaled humanoid with a gilded bow, enraged that';
      expect(count(one, gorgon)).toBe(2);
      expect(count(two, gorgon)).toBe(2);
      // Two streams, one printed line. The weapon's own capitalised name is
      // nowhere in SRD 2, which is what a name census asks.
      expect(await text(1)).not.toContain('Gilded Bow');
    },
    180_000,
  );
});
