/**
 * The printed character sheet.
 *
 * Two things are worth testing here and neither needs a browser. The first is
 * that every number on the page came out of the engine - a printout is the one
 * artefact nobody can tap to check, so a wrong Proficiency on paper survives a
 * whole campaign. The second is the print stylesheet itself, which is the only
 * code in the app that can blank the running screen: if its guard rule ever
 * stops being scoped to a print the user asked for, Cmd+P anywhere in the app
 * starts printing a blank page and nothing else fails.
 *
 * `renderToStaticMarkup` gives the real component, in Node, with no DOM.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Ancestry, Beastform, CompanionState, Community } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import { newCompanion } from '@engine/companion.ts';
import { baseDataset } from '../../src/store/dataset.ts';
import { CharacterSheet } from '../../src/ui/print/CharacterSheet.tsx';
import { buildSheet } from '../../src/ui/print/sheetModel.ts';
import {
  advancement,
  makeArmor,
  makeCard,
  makeCharacter,
  makeClass,
  makeDataset,
  makeSubclass,
  makeWeapon,
} from '../fixtures/factories.ts';

const CSS_PATH = 'src/ui/print/sheet.css';

const ancestry = (id: string): Ancestry => ({
  id,
  name: id,
  description: '',
  features: [
    { name: `${id} top`, text: 'The first feature.' },
    { name: `${id} bottom`, text: 'The second feature.' },
  ],
});

const community: Community = {
  id: 'test-community',
  name: 'Testborne',
  description: '',
  traits: [],
  feature: { name: 'Privilege', text: 'A community feature.' },
};

const bear: Beastform = {
  id: 'bear',
  name: 'Bear',
  tier: 1,
  category: 'Beast',
  examples: [],
  traitBonus: { strength: 2 },
  evasionBonus: 3,
  attack: { name: 'Claws', range: 'Melee', damage: 'd6', trait: 'strength' },
  advantageOn: [],
  features: [],
};

/** A level 5 character with gear, cards and a heritage: the ordinary case. */
function scene() {
  const dataset = makeDataset({
    ancestries: [ancestry('alpha'), ancestry('beta')],
    communities: [community],
    beastforms: [bear],
    armors: [makeArmor({ baseThresholds: [5, 11], baseScore: 4 })],
    weapons: [makeWeapon({ damage: 'd8+3' })],
    domainCards: [makeCard({ text: 'Spend a Hope to do the thing described here.' })],
  });
  const character = makeCharacter({
    name: 'Kaelith',
    pronouns: 'she/her',
    level: 5,
    subclassRefs: ['test-subclass'],
    ancestryRefs: ['alpha'],
    communityRef: 'test-community',
    activePrimaryWeapon: 'test-weapon',
    activeArmor: 'test-armor',
    loadout: ['blade-test-card'],
    experiences: [{ id: 'e1', name: 'Court Gossip', bonus: 2 }],
    inventory: [{ ref: null, name: 'Rope', quantity: 1 }],
    gold: { handfuls: 7, bags: 3, chests: 0 },
  });
  return { dataset, index: indexDataset(dataset), character };
}

describe('the print model', () => {
  it('prints weapon damage with Proficiency already multiplied in', () => {
    const { character, dataset, index } = scene();
    const sheet = buildSheet(character, dataset, index);
    // Level 5 is Proficiency 3, and only the die count is multiplied.
    expect(sheet.proficiency).toBe(3);
    expect(sheet.weapons[0]?.damage).toBe('3d8+3');
  });

  it('prints the derived thresholds, not the armor’s printed ones', () => {
    const { character, dataset, index } = scene();
    const sheet = buildSheet(character, dataset, index);
    expect(sheet.thresholds).toEqual([10, 16]);
    expect(sheet.armor?.baseThresholds).toEqual([5, 11]);
  });

  it('gives every track as many boxes as the character has slots', () => {
    const { character, dataset, index } = scene();
    const sheet = buildSheet(character, dataset, index);
    expect(sheet.tracks.map((t) => [t.kind, t.boxes])).toEqual([
      ['hp', 6],
      ['stress', 6],
      ['hope', 6],
      ['armor', 4],
    ]);
  });

  it('carries the SRD’s three verbs beside every trait', () => {
    const { character, dataset, index } = scene();
    const verbs = Object.fromEntries(
      buildSheet(character, dataset, index).traits.map((t) => [t.trait, t.verbs]),
    );
    // The shipped SRD's spellings, not the printed book's British ones.
    expect(verbs).toEqual({
      agility: 'Sprint · Leap · Maneuver',
      strength: 'Lift · Smash · Grapple',
      finesse: 'Control · Hide · Tinker',
      instinct: 'Perceive · Sense · Navigate',
      presence: 'Charm · Perform · Deceive',
      knowledge: 'Recall · Analyze · Comprehend',
    });
  });

  it('counts the room HP and Stress can still grow into, and only those two', () => {
    // The idea worth stealing off the paper sheet: both tracks run to twelve
    // whatever your maximum is. Hope's ceiling is six and can only fall; Armor
    // Score belongs to the armor, not to the level, so neither has growth.
    const { character, dataset, index } = scene();
    const sheet = buildSheet(character, dataset, index);
    expect(sheet.tracks.map((t) => [t.kind, t.growth])).toEqual([
      ['hp', 6],
      ['stress', 6],
      ['hope', 0],
      ['armor', 0],
    ]);
  });

  it('stops dashing once a track has reached the maximum the rules allow', () => {
    const { character, dataset, index } = scene();
    const maxed = {
      ...character,
      levelUpHistory: Array.from({ length: 6 }, () => advancement('hitPoint', 'hitPoint', 3, 5)),
    };
    const hp = buildSheet(maxed, dataset, index).tracks.find((t) => t.kind === 'hp');
    expect(hp).toMatchObject({ boxes: 12, growth: 0 });
  });

  it('crosses out a Hope slot per scar and still prints all six', () => {
    // "Permanently cross out a Hope slot" is what the SRD's death moves say, so
    // four diamonds would lose the fact that this character used to have six.
    const { character, dataset, index } = scene();
    const scarred = { ...character, scars: ['A burned hand', 'A missing eye'] };
    const hope = buildSheet(scarred, dataset, index).tracks.find((t) => t.kind === 'hope');
    expect(hope).toMatchObject({ boxes: 4, crossed: 2, growth: 0 });
    expect(hope!.boxes + hope!.crossed).toBe(6);
  });

  it('says where Evasion and the thresholds came from', () => {
    const { character, dataset, index } = scene();
    const sheet = buildSheet(character, dataset, index);
    expect(sheet.evasionNote).toBe('Test Class starts at 10');
    expect(sheet.thresholdNote).toBe('Level 5 is already added to both');
  });

  it('never claims a derivation for a number somebody typed in by hand', () => {
    // The founding rule, in its smallest form. "Level 5 is already added to
    // both" over a pair of overridden numbers is a sentence about this sheet
    // that is not true of the character behind it.
    const { character, dataset, index } = scene();
    const overridden = {
      ...character,
      evasionOverride: 14,
      thresholdOverride: [9, 20] as [number, number],
    };
    const sheet = buildSheet(overridden, dataset, index);
    expect(sheet.evasionNote).toBe('Set by hand on this sheet');
    expect(sheet.thresholdNote).toBe('Set by hand on this sheet');
    expect(sheet.thresholds).toEqual([9, 20]);
  });

  it('hands the Hope feature out on its own, and does not file it twice', () => {
    const dataset = makeDataset({
      classes: [makeClass({ classFeatures: [{ name: 'Class Feature', text: 'c' }] })],
    });
    const index = indexDataset(dataset);
    const sheet = buildSheet(makeCharacter({ level: 1 }), dataset, index);
    expect(sheet.hopeFeature).toEqual({
      source: 'Test Class',
      name: 'Hope Feature',
      text: 'Hope Feature does a thing.',
    });
    expect(sheet.features.map((f) => f.name)).toEqual(['Class Feature']);
  });

  it('rules one Experience line for every one a whole campaign can grant', () => {
    // Two at creation plus the tier achievements at 2, 5 and 8: five, derived
    // from levelUp.ts rather than counted off the printed sheet.
    const { character, dataset, index } = scene();
    expect(buildSheet(character, dataset, index).experienceLines).toBe(5);

    const many = {
      ...character,
      experiences: Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, name: `E${i}`, bonus: 1 })),
    };
    expect(buildSheet(many, dataset, index).experienceLines).toBe(7);
  });

  it('names the damage bands and what each one costs', () => {
    const { character, dataset, index } = scene();
    expect(buildSheet(character, dataset, index).ladder).toEqual([
      { label: 'Minor', from: 'below 10', hp: 1 },
      { label: 'Major', from: '10+', hp: 2 },
      { label: 'Severe', from: '16+', hp: 3 },
    ]);
  });

  it('adds the Massive band only when the table has turned the rule on', () => {
    const { character, dataset, index } = scene();
    const on = buildSheet(character, dataset, index, { massiveDamageRule: true });
    expect(on.ladder.at(-1)).toEqual({ label: 'Massive', from: '32+', hp: 4 });
  });

  it('prints the character, not the shape they happen to be wearing', () => {
    // A Beastform is a state that ends. A page is not, and a Druid coming back
    // to this sheet in a month must not find a bear's Evasion on it.
    const { character, dataset, index } = scene();
    const transformed = { ...character, beastform: { ref: 'bear', activatedAt: '2026-01-01' } };
    const sheet = buildSheet(transformed, dataset, index);
    expect(sheet.evasion).toBe(10);
    expect(sheet.traits.find((t) => t.trait === 'strength')?.value).toBe(0);
  });

  it('takes the first ancestry’s first feature and the second’s second', () => {
    const { character, dataset, index } = scene();
    const mixed = { ...character, ancestryRefs: ['alpha', 'beta'] };
    const names = buildSheet(mixed, dataset, index).features.map((f) => f.name);
    expect(names).toContain('alpha top');
    expect(names).toContain('beta bottom');
    expect(names).not.toContain('alpha bottom');
    expect(names).not.toContain('beta top');
  });

  it('prints a subclass card only once it has actually been taken', () => {
    const dataset = makeDataset({
      classes: [makeClass()],
      subclasses: [
        makeSubclass({
          foundationFeatures: [{ name: 'Foundation', text: 'f' }],
          specializationFeatures: [{ name: 'Specialization', text: 's' }],
          masteryFeatures: [{ name: 'Mastery', text: 'm' }],
        }),
      ],
    });
    const index = indexDataset(dataset);
    const base = makeCharacter({ level: 5, subclassRefs: ['test-subclass'] });
    expect(buildSheet(base, dataset, index).features.map((f) => f.name)).toContain('Foundation');
    expect(buildSheet(base, dataset, index).features.map((f) => f.name)).not.toContain(
      'Specialization',
    );

    const upgraded = {
      ...base,
      levelUpHistory: [
        advancement('subclass', 'subclass', 3, 6, {
          subclassRef: 'test-subclass',
          card: 'specialization',
        }),
      ],
    };
    const names = buildSheet(upgraded, dataset, index).features.map((f) => f.name);
    expect(names).toContain('Specialization');
    expect(names).not.toContain('Mastery');
  });

  it('carries the purse’s shape from the gold engine, not from a literal', () => {
    const { character, dataset, index } = scene();
    const { gold } = buildSheet(character, dataset, index);
    expect(gold.perStep).toBe(10);
    expect(gold.maxChests).toBe(1);
    expect(gold.summary).toBe('3 bags · 7 handfuls');
  });
});

describe('the printed page', () => {
  const { character, dataset, index } = scene();
  const html = renderToStaticMarkup(
    createElement(CharacterSheet, {
      sheet: buildSheet(character, dataset, index),
      printedAt: '15/08/2026',
    }),
  );

  it('is one element, so the print stylesheet can hide everything else', () => {
    expect(html.startsWith('<div class="dhc-sheet">')).toBe(true);
    expect(html.endsWith('</div>')).toBe(true);
  });

  it('says who this is', () => {
    expect(html).toContain('Kaelith');
    expect(html).toContain('she/her');
    expect(html).toContain('Test Class — Test Subclass');
    expect(html).toContain('alpha · Testborne');
  });

  it('names the heritage field rather than leaving it a subtitle', () => {
    expect(html).toContain('Heritage');
  });

  it('draws one empty box per slot, and no filled ones', () => {
    // 12 HP + 12 Stress + 6 Hope + 4 Armor. HP and Stress run to twelve however
    // many the character has earned; every box is a stroked outline, because a
    // printed track is somewhere to make a mark, not a picture of one.
    expect(html.match(/<g transform=/g)).toHaveLength(34);
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toContain('fill="black"');
  });

  it('breaks the outline of every slot the character has not earned yet', () => {
    // Six on HP and six on Stress, and nothing dashed anywhere else: a broken
    // box says "you could have this", which is false of a Hope slot and false
    // of an Armor slot.
    expect(html.match(/stroke-dasharray/g)).toHaveLength(12);
  });

  it('says in words what the broken boxes mean', () => {
    expect(html).toContain('12 Hit Points and 12 Stress at most');
  });

  it('reads the damage ladder as a ladder, with what each band costs', () => {
    for (const band of ['Minor', 'Major', 'Severe']) expect(html).toContain(band);
    expect(html).toContain('Mark 1 HP');
    expect(html).toContain('Mark 2 HP');
    expect(html).toContain('Mark 3 HP');
  });

  it('prints the trait verbs the SRD gives, in the SRD’s spelling', () => {
    expect(html).toContain('Sprint · Leap · Maneuver');
    expect(html).toContain('Recall · Analyze · Comprehend');
    expect(html).not.toContain('Manoeuvre');
  });

  it('puts the Hope feature under the Hope track it is about', () => {
    const hope = html.indexOf('>Hope</h2>');
    const feature = html.indexOf('Hope Feature does a thing.');
    const nextSection = html.indexOf('Active weapons');
    expect(hope).toBeGreaterThan(-1);
    expect(feature).toBeGreaterThan(hope);
    expect(feature).toBeLessThan(nextSection);
  });

  it('says where Evasion came from and how the thresholds were reached', () => {
    expect(html).toContain('Test Class starts at 10');
    expect(html).toContain('Level 5 is already added to both');
  });

  it('rules a blank Experience line, with its bonus box, for each one untaken', () => {
    // Kaelith has one of the five a campaign can grant.
    expect(html.match(/class="dhc-box"/g)).toHaveLength(4);
  });

  it('offers somewhere to write a stowed weapon without claiming to know of any', () => {
    // The model has two weapon slots and no pack, so these rows are pencil
    // room. Three of them, each with a Primary and a Secondary box.
    expect(html).toContain('Inventory weapons');
    expect(html.match(/Primary/g)).toHaveLength(4); // three rows, one active weapon
    expect(html.match(/Secondary/g)).toHaveLength(3);
  });

  it('draws the purse as ten, ten and one', () => {
    expect(html.match(/<circle/g)).toHaveLength(21);
  });

  it('prints each card in full, with its domain, level and recall cost', () => {
    expect(html).toContain('Test Card');
    expect(html).toContain('Blade · level 1 · Ability');
    expect(html).toContain('Recall 1');
    expect(html).toContain('Spend a Hope to do the thing described here.');
  });

  it('carries the attribution the licence requires', () => {
    expect(html).toContain('Daggerheart System Reference Document 1.0');
  });
});

describe('a scarred sheet', () => {
  const { character, dataset, index } = scene();
  const html = renderToStaticMarkup(
    createElement(CharacterSheet, {
      sheet: buildSheet({ ...character, scars: ['A burned hand'] }, dataset, index),
    }),
  );

  it('strikes the lost Hope slot through instead of dropping it', () => {
    // Six diamonds still, one of them crossed. The count is the whole point:
    // "you have five" and "you had six and lost one" are different facts.
    // Inset to 3.2 so the strike stays inside the diamond's edges rather than
    // reading as a second diamond laid over the first.
    expect(html.match(/M3\.2 3\.2 L6\.8 6\.8 M6\.8 3\.2 L3\.2 6\.8/g)).toHaveLength(1);
    expect(html).toContain('1 scar: a crossed-out slot is gone for good.');
  });

  it('leaves an unscarred sheet with no crosses on it at all', () => {
    const clean = renderToStaticMarkup(
      createElement(CharacterSheet, { sheet: buildSheet(character, dataset, index) }),
    );
    expect(clean).not.toContain('M3.2 3.2');
    expect(clean).toContain('Spend a Hope to Help an Ally or Utilize an Experience.');
  });
});

describe('the print stylesheet', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('has balanced braces', () => {
    let depth = 0;
    let stray = 0;
    for (const ch of bare) {
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth < 0) {
          stray += 1;
          depth = 0;
        }
      }
    }
    expect(stray).toBe(0);
    expect(depth).toBe(0);
  });

  it('keeps the sheet out of the way until a print asks for it', () => {
    expect(bare).toMatch(/\.dhc-sheet\s*\{[^}]*display:\s*none/);
  });

  it('only blanks the app while a print the user asked for is in flight', () => {
    const hides = [...bare.matchAll(/([^{}]+)\{[^{}]*display:\s*none\s*!important[^{}]*\}/g)];
    expect(hides.length).toBeGreaterThan(0);
    for (const [, selector] of hides) expect(selector).toContain('.dhc-printing');
  });

  it('lets the paper in the tray decide the page size', () => {
    // Naming A4 makes a Letter printer scale the sheet down, and the reverse.
    expect(bare).toMatch(/@page\s*\{/);
    expect(bare).not.toMatch(/@page[^}]*size\s*:/);
  });

  it('invents no breakpoint of its own', () => {
    // Width bands live in useLayout, and a stylesheet that guesses one is how
    // they drifted apart before.
    expect(bare).not.toMatch(/@media[^{]*(min-width|max-width)/);
  });

  it('puts no dark ink on the page', () => {
    // Every background is white or nothing: a filled panel that looks right on
    // a screen costs a cartridge and hides pencil.
    for (const match of bare.matchAll(/background(?:-color)?:\s*([^;]+);/g)) {
      expect((match[1] ?? '').trim()).toMatch(/^(#fff|#ffffff|white|none|transparent)$/i);
    }
  });
});

/**
 * The companion, on paper.
 *
 * `src/ui/print/` did not mention a companion anywhere, so a Beastbound Ranger
 * printed a sheet with a whole creature missing from it - and a printout is the
 * one artefact nobody can tap to check.
 *
 * It is NOT dropped the way a Beastform is, and the difference is the reason
 * `buildSheet` drops one. A Beastform is a state: a Druid would come back to a
 * page claiming their Evasion is 14 because they were a bear on Tuesday. A
 * companion is not a state; it is the other half of the sheet, and it is as
 * true in a folder a month from now as it was mid-scene.
 */
describe('the companion page', () => {
  const shipped = indexDataset(baseDataset);

  const ranger = (over: Partial<CompanionState> = {}) =>
    makeCharacter({
      name: 'Wren',
      level: 5,
      companion: {
        ...newCompanion('Ashfoot', 'A grey wolf'),
        damage: 'd6+2',
        range: 'Close',
        experiences: [{ id: 'ce-1', name: 'Nobody left behind', bonus: 2 }],
        upgrades: ['vicious'],
        ...over,
      },
    });

  const printed = (c = ranger()) => buildSheet(c, baseDataset, shipped);

  it('is absent for a character who has no companion', () => {
    expect(buildSheet(makeCharacter(), baseDataset, shipped).companion).toBeNull();
  });

  it('prints their damage with Proficiency in it, because that is what is rolled', () => {
    const sheet = printed();
    // "On a success, their damage roll uses your Proficiency and their damage
    // die." A page printing `d6+2` would be a page printing the wrong number.
    expect(sheet.companion?.damage).toBe(`${String(sheet.proficiency)}d6+2`);
    expect(sheet.proficiency).toBeGreaterThan(1);
  });

  it('prints the die as typed when it will not parse, rather than a blank', () => {
    expect(printed(ranger({ damage: 'a bite' })).companion?.damage).toBe('a bite');
  });

  it('carries their numbers, their Experiences and which boxes are marked', () => {
    const companion = printed().companion!;
    expect(companion.name).toBe('Ashfoot');
    expect(companion.evasion).toBe(10);
    expect(companion.stressSlots).toBe(3);
    expect(companion.experiences.map((e) => e.name)).toEqual(['Nobody left behind']);
    expect(companion.upgrades).toHaveLength(8);
    expect(companion.upgrades.filter((u) => u.marked).map((u) => u.id)).toEqual(['vicious']);
    expect(companion.allowance).toBe(4);
  });

  it('reaches the page, with the marked box ticked and the others not', () => {
    const html = renderToStaticMarkup(
      createElement(CharacterSheet, { sheet: printed() }),
    );
    expect(html).toContain('Ashfoot');
    expect(html).toContain('A grey wolf');
    expect(html).toContain('Nobody left behind');
    expect(html).toContain('☑ Vicious');
    expect(html).toContain('☐ Bonded');
  });

  it('is on the page even for a Druid mid-transformation, unlike the Beastform', () => {
    // The two rules side by side: the form is dropped from the printout and the
    // animal is not.
    const c = { ...ranger(), beastform: { ref: 'agile-scout', activatedAt: '2026-08-23T00:00:00.000Z' } };
    const sheet = buildSheet(c, baseDataset, shipped);
    expect(sheet.companion?.name).toBe('Ashfoot');
    expect(sheet.evasion).toBe(buildSheet(ranger(), baseDataset, shipped).evasion);
  });
});
