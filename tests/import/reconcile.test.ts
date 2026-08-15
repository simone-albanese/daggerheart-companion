import { describe, expect, it } from 'vitest';
import {
  contributedFields,
  reconcile,
  rekey,
  similarity,
  SUGGEST_MIN,
  uncheckable,
  type Entry,
  type ReconcileInput,
} from '../../src/import/reconcile.ts';

const e = (id: string, name: string): Entry => ({ id, name });

const run = (input: Partial<ReconcileInput> & Pick<ReconcileInput, 'base' | 'imported'>) =>
  reconcile({ ...input });

const kind = (input: Parameters<typeof run>[0], name: string) => {
  const found = run(input).kinds.find((k) => k.kind === name);
  if (!found) throw new Error(`no report for ${name}`);
  return found;
};

describe('similarity', () => {
  it('scores an identical slug at 1', () => {
    expect(similarity(e('rune-ward', 'Rune Ward'), e('rune-ward', 'Rune ward')).score).toBe(1);
  });

  it('sees through the punctuation the two books disagree about', () => {
    const s = similarity(e("monetts-cloak", "Monett's Cloak"), e('monetts-cloak', 'Monetts Cloak'));
    expect(s.score).toBe(1);

    const hyphen = similarity(e('arcana-touched', 'Arcana-Touched'), e('x', 'Arcana Touched'));
    expect(hyphen.score).toBe(1);
  });

  it('ignores leading articles but never a word that carries identity', () => {
    expect(similarity(e('a', 'The Witherwild'), e('b', 'Witherwild')).score).toBeGreaterThan(
      SUGGEST_MIN,
    );
    expect(similarity(e('a', 'Bone'), e('b', 'Blade')).score).toBeLessThan(SUGGEST_MIN);
  });

  it('keeps two different short cards apart', () => {
    // One character between them, and they are not the same card.
    expect(similarity(e('a', 'Boost'), e('b', 'Roost')).score).toBeLessThan(SUGGEST_MIN);
  });
});

describe('reconcile', () => {
  it('matches on slug and leaves both sides alone', () => {
    const report = kind(
      {
        base: { domainCards: [e('rune-ward', 'Rune Ward'), e('whirlwind', 'Whirlwind')] },
        imported: { domainCards: [e('rune-ward', 'Rune ward'), e('whirlwind', 'Whirlwind')] },
      },
      'domainCards',
    );
    expect(report.matched).toHaveLength(2);
    expect(report.matched.every((m) => m.how === 'slug')).toBe(true);
    expect(report.manualOnly).toEqual([]);
    expect(report.srdOnly).toEqual([]);
    expect(report.suggestions).toEqual([]);
  });

  it('separates manual-only, SRD-only and doubtful', () => {
    const report = kind(
      {
        base: {
          domainCards: [
            e('rune-ward', 'Rune Ward'),
            e('monetts-cloak', 'Monetts Cloak'),
            e('deft-maneuvers', 'Deft Maneuvers'),
          ],
        },
        imported: {
          domainCards: [
            e('rune-ward', 'Rune ward'),
            e('monett-s-cloak', "Monett's Cloak"),
            e('brand-new-card', 'Brand New Card'),
          ],
        },
      },
      'domainCards',
    );
    expect(report.matched.map((m) => m.base.id)).toEqual(['rune-ward']);
    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]!.imported.id).toBe('monett-s-cloak');
    expect(report.suggestions[0]!.base.id).toBe('monetts-cloak');
    expect(report.manualOnly.map((x) => x.id)).toEqual(['brand-new-card']);
    expect(report.srdOnly.map((x) => x.id)).toEqual(['deft-maneuvers']);
  });

  it('never proposes the same SRD entry to two imported entries', () => {
    const report = kind(
      {
        base: { domainCards: [e('book-of-ava', 'Book of Ava')] },
        imported: {
          domainCards: [e('book-of-avaa', 'Book of Avaa'), e('book-of-ava-', 'Book of Ava ')],
        },
      },
      'domainCards',
    );
    expect(report.suggestions).toHaveLength(1);
    expect(report.manualOnly).toHaveLength(1);
  });

  it('prefers the strongest pairing even when a weaker one comes first', () => {
    const report = kind(
      {
        base: { domainCards: [e('shield-aura', 'Shield Aura')] },
        imported: {
          // Scored lower, listed first; must not steal the good match.
          domainCards: [e('shield-aurora', 'Shield Aurora'), e('shield-aura-', 'Shield Aura ')],
        },
      },
      'domainCards',
    );
    expect(report.suggestions[0]!.imported.id).toBe('shield-aura-');
  });

  it('honours a confirmed pairing and stops suggesting a rejected one', () => {
    const input = {
      base: { communities: [e('highborne', 'Highborne'), e('slyborne', 'Slyborne')] },
      imported: { communities: [e('high-borne', 'High Borne'), e('wildborne', 'Wildborne')] },
    };

    const confirmed = kind(
      { ...input, pairings: [{ importedId: 'high-borne', baseId: 'highborne' }] },
      'communities',
    );
    expect(confirmed.matched).toHaveLength(1);
    expect(confirmed.matched[0]!.how).toBe('manual');

    const rejected = kind(
      { ...input, pairings: [{ importedId: 'high-borne', baseId: null }] },
      'communities',
    );
    expect(rejected.suggestions).toEqual([]);
    expect(rejected.manualOnly.map((x) => x.id)).toContain('high-borne');
  });

  it('ignores a collection the import never touched', () => {
    const report = run({
      base: { domainCards: [e('rune-ward', 'Rune Ward')], adversaries: [e('acid-burrower', 'Acid Burrower')] },
      imported: { domainCards: [e('rune-ward', 'Rune ward')] },
    });
    expect(report.kinds.map((k) => k.kind)).toEqual(['domainCards']);
    expect(report.totals.srdOnly).toBe(0);
  });

  it('carries unread sections through and calls an empty import empty', () => {
    const report = run({
      base: { domainCards: [e('rune-ward', 'Rune Ward')] },
      imported: {},
      unread: [{ section: 'Chapter 4: Tier 1 Adversaries', kind: 'adversaries', reason: 'no roster' }],
    });
    expect(report.empty).toBe(true);
    expect(report.unread).toHaveLength(1);
    expect(report.totals).toEqual({ matched: 0, manualOnly: 0, srdOnly: 0, suggested: 0 });
  });

  it('totals across collections', () => {
    const report = run({
      base: { domainCards: [e('a', 'A')], communities: [e('b', 'B')] },
      imported: { domainCards: [e('a', 'A'), e('c', 'C')], communities: [e('b', 'B')] },
    });
    expect(report.totals).toEqual({ matched: 2, manualOnly: 1, srdOnly: 0, suggested: 0 });
    expect(report.empty).toBe(false);
  });
});

describe('rekey', () => {
  it('moves matched entries onto the SRD id and leaves the rest alone', () => {
    const report = kind(
      {
        base: { communities: [e('highborne', 'Highborne')] },
        imported: { communities: [e('high-borne', 'High Borne'), e('new-one', 'New One')] },
        pairings: [{ importedId: 'high-borne', baseId: 'highborne' }],
      },
      'communities',
    );
    const entries = [
      { id: 'high-borne', name: 'High Borne', description: 'richer' },
      { id: 'new-one', name: 'New One', description: 'new' },
    ];
    expect(rekey(entries, report)).toEqual([
      { id: 'highborne', name: 'High Borne', description: 'richer' },
      { id: 'new-one', name: 'New One', description: 'new' },
    ]);
  });

  it('does not apply suggestions - they are not decisions yet', () => {
    const report = kind(
      {
        base: { communities: [e('highborne', 'Highborne')] },
        imported: { communities: [e('high-borne', 'High Borne')] },
      },
      'communities',
    );
    expect(report.suggestions).toHaveLength(1);
    expect(rekey([e('high-borne', 'High Borne')], report)[0]!.id).toBe('high-borne');
  });
});

describe('contributedFields', () => {
  const srdDomain = {
    id: 'arcana',
    name: 'Arcana',
    description:
      'Arcana is the domain of innate and instinctual magic. The Arcana domain can be ' +
      'accessed by the Druid and Sorcerer classes.',
    sourcePage: 7,
  };

  it('contributes what the SRD does not have at all', () => {
    const fields = contributedFields(
      { id: 'arcana', name: 'Arcana', flavorText: 'raw and volatile', artKey: 'arcana' },
      srdDomain,
    );
    expect(fields).toEqual({ name: 'Arcana', flavorText: 'raw and volatile', artKey: 'arcana' });
  });

  it('refuses a value shorter than the one the SRD already holds', () => {
    // Exactly the 2025-09-06 printing's behaviour: the manual's domain
    // description parses one sentence short of the SRD's.
    const fields = contributedFields(
      { ...srdDomain, description: 'Arcana is the domain of innate and instinctual magic.' },
      srdDomain,
    );
    expect(fields).not.toHaveProperty('description');
    expect(fields['sourcePage']).toBe(7);
  });

  it('takes a longer value, which is what importing the book is for', () => {
    const richer = `${srdDomain.description} It is volatile, and potent when channeled.`;
    expect(contributedFields({ ...srdDomain, description: richer }, srdDomain)['description']).toBe(
      richer,
    );
  });

  it('applies the same rule to lists', () => {
    const base = { id: 'x', name: 'X', features: [{ name: 'a' }, { name: 'b' }] };
    expect(contributedFields({ ...base, features: [{ name: 'a' }] }, base)).not.toHaveProperty(
      'features',
    );
    const more = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    expect(contributedFields({ ...base, features: more }, base)['features']).toEqual(more);
  });

  it('never contributes the ids the resolver owns, nor empty values', () => {
    const fields = contributedFields(
      { id: 'arcana', provenance: { name: 'srd' }, name: 'Arcana', flavorText: undefined },
      undefined,
    );
    expect(fields).toEqual({ name: 'Arcana' });
  });

  it('drops an empty value even where the SRD has nothing to compare it with', () => {
    // The length tests below only fire when the SRD holds the same field. A
    // field the SRD lacks would otherwise arrive defined-but-blank, which the
    // resolver cannot tell from "the manual says this is blank".
    const fields = contributedFields(
      { id: 'x', name: 'X', flavorText: '   ', features: [], sourcePage: 24 },
      undefined,
    );
    expect(fields).toEqual({ name: 'X', sourcePage: 24 });
  });
});

describe('uncheckable', () => {
  it('names a collection the caller supplied no base for', () => {
    // The live regression: the app sent ten collections and the manual parsed
    // an eleventh, so nothing compared the manual's domains to the SRD's.
    expect(
      uncheckable({ domains: [], domainCards: [] }, { domainCards: [], adversaries: [] }),
    ).toEqual(['domains']);
  });

  it('is happy when every imported collection has a base, empty or not', () => {
    expect(uncheckable({ domains: [] }, { domains: [] })).toEqual([]);
    expect(uncheckable({}, {})).toEqual([]);
  });
});
