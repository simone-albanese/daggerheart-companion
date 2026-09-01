// @vitest-environment jsdom
/**
 * The either-kind weapon, and the three screens that said it was physical.
 *
 * `DamageKind` was `'phy' | 'mag'` for as long as this app existed, so
 * `x === 'mag' ? 'mag' : 'phy'` was a TOTAL function and reading it as one was
 * correct. It stopped being total when SRD 2.0 forced the union to grow, and
 * the failure is silent in the worst possible place: it was already wrong on
 * the SHIPPED SRD 1.0 dataset. `data/srd-1.0.json` has carried
 * `"damageType": "phy or mag"` on the Ghostblade since the day it was built,
 * beside a feature line that reads *"you can deal physical or magic damage"*,
 * and four places printed PHYSICAL. `tsc` could not see it: `String()` and a
 * ternary accept anything.
 *
 * So these assertions are against the COMMITTED dataset, not a fixture. A
 * fixture would prove the helpers work on values someone chose; this proves the
 * app does not lie about a weapon a player can equip today.
 */
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { FeatureList } from '../../src/ui/gm/StatBlock.tsx';
import {
  damageKindLong,
  damageKindShort,
  dealsMagic,
  dealsPhysical,
  type DamageKind,
  type Feature,
} from '../../shared/types.ts';

const srd = JSON.parse(readFileSync('data/srd-2.0.json', 'utf8')) as {
  weapons: Array<{ id: string; name: string; damageType: DamageKind; feature: string }>;
};

describe('a weapon the book says can be swung either way', () => {
  it('is in the shipped dataset, so this is not hypothetical', () => {
    /*
     * The Ghostblade until the switch, and it is one of the nine weapons SRD
     * 2.0 stopped printing. The shipped book carries four Shadowblades in its
     * place, and it spells the kind `phy/mag` where SRD 1.0 wrote `phy or
     * mag` - both are in the union, and `dealsMagic`/`dealsPhysical` below
     * still answer yes to both, which is the property that matters.
     */
    const either = srd.weapons.filter((w) => w.damageType !== 'phy' && w.damageType !== 'mag');
    expect(either.map((w) => w.id)).toEqual([
      'shadowblade',
      'improved-shadowblade',
      'advanced-shadowblade',
      'legendary-shadowblade',
    ]);
    expect(either[0]!.damageType).toBe('phy/mag');
    // The book's own sentence, which is what the screens were contradicting.
    expect(either[0]!.feature).toContain('physical or magic damage');
  });

  it('is never labelled as one kind only', () => {
    const g = srd.weapons.find((w) => w.id === 'shadowblade')!;
    expect(damageKindShort(g.damageType)).toBe('PHY/MAG');
    expect(damageKindLong(g.damageType)).toBe('Physical or magic');
    // The exact expressions the three screens used to carry.
    expect(g.damageType === 'mag' ? 'MAG' : 'PHY').toBe('PHY');
    expect(damageKindShort(g.damageType)).not.toBe('PHY');
  });

  it('answers yes to both questions, which is the whole point', () => {
    for (const k of ['phy or mag', 'phy/mag'] as const) {
      expect(dealsMagic(k), `${k} deals magic`).toBe(true);
      expect(dealsPhysical(k), `${k} deals physical`).toBe(true);
    }
    expect(dealsMagic('phy')).toBe(false);
    expect(dealsPhysical('mag')).toBe(false);
  });

  it('labels the two plain kinds exactly as before', () => {
    expect([damageKindShort('phy'), damageKindShort('mag')]).toEqual(['PHY', 'MAG']);
    expect([damageKindLong('phy'), damageKindLong('mag')]).toEqual(['Physical', 'Magic']);
  });
});

/*
 * The schema grew room for two things no parser emits yet. That is exactly when
 * a renderer is worth pinning: the day a parser starts emitting them, a missing
 * branch is INVISIBLE output rather than a crash, and nothing goes red.
 */
describe('the room schema 6 made, drawn', () => {
  const feature = (over: Partial<Feature>): Feature => ({ name: 'F', text: 'body', ...over });

  it('draws a sub-feature nested under its parent', () => {
    const html = renderToStaticMarkup(
      createElement(FeatureList, {
        features: [
          feature({
            name: 'Evolved',
            kind: 'Evolution',
            features: [feature({ name: 'Wrathful', text: 'the nested one' })],
          }),
        ],
      }),
    );
    expect(html).toContain('Wrathful');
    expect(html).toContain('the nested one');
  });

  it('gives Evolution a colour, so its chip is not invisible', () => {
    const html = renderToStaticMarkup(
      createElement(FeatureList, { features: [feature({ kind: 'Evolution' })] }),
    );
    expect(html).toContain('EVOLUTION');
    // The chip's colour comes from KIND_COLOR with NO fallback, so a missing
    // row renders `color: undefined` - a chip the same colour as the text.
    expect(html).not.toMatch(/class="chip"[^>]*style="[^"]*color:\s*;/);
    expect(html).toMatch(/class="chip"[^>]*style="[^"]*color:[^;"]+/);
  });

  it('still draws a feature with no nesting and no kind', () => {
    const html = renderToStaticMarkup(createElement(FeatureList, { features: [feature({})] }));
    expect(html).toContain('body');
  });
});
