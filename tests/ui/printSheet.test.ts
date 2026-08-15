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
import type { Ancestry, Beastform, Community } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
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

  it('draws one empty box per slot, and no filled ones', () => {
    // 6 HP + 6 Stress + 6 Hope + 4 Armor. Every box is a stroked outline: a
    // printed track is somewhere to make a mark, not a picture of one.
    expect(html.match(/<g transform=/g)).toHaveLength(22);
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toContain('fill="black"');
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
