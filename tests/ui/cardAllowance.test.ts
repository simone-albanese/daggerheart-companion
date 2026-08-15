/**
 * How many domain cards creation hands out.
 *
 * Two, for everyone except a Wizard who went to the School of Knowledge: that
 * subclass's foundation feature Prepared says "Take an additional domain card
 * of your level or lower from a domain you have access to", so they take three.
 * The wizard used to hardcode two, mark the step complete, and let that player
 * walk away from character creation holding an illegal sheet - the kind of bug
 * nobody finds until a GM does, weeks in.
 *
 * Two different things are worth pinning here.
 *
 * The first is the count itself, against the real SRD dataset rather than a
 * fixture, because the whole point is what a real player building a real Wizard
 * gets told.
 *
 * The second is the honesty of the table `cardAllowance.ts` reads from. That
 * table is keyed by subclass id on purpose - matching English prose at runtime
 * is how a reworded sentence silently stops granting a card - but a table
 * cannot notice a subclass a future revision adds. So the scan below does:
 * it walks every subclass feature in the dataset looking for the phrase, and
 * fails naming the feature if the table has not already accounted for it. The
 * app never reads the prose; only this test does, once, at the point where a
 * mismatch can still be fixed.
 *
 * The third is that anything calls it. A correct `startingCardAllowance` that
 * nothing asks is exactly as broken as the hardcoded 2 it replaced, and no unit
 * test of the function can see that, because every unit still works - the same
 * failure that shipped a dead service worker past eight passing tests. That
 * block asserts on source text, deliberately and for the reason
 * `tests/pwa/wiring.test.ts` gives, and it scans the whole of `src/ui/build`
 * rather than one named file, because this logic has already moved once, from
 * `Wizard.tsx` into `creation.ts`, and a guard that names a file stops guarding
 * the moment the code leaves it.
 *
 * The last block is the one that would convince a player: the card step,
 * rendered against the real SRD, asked what it says on it and what it will
 * still let you take.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Dataset, Feature, Ref, Subclass } from '@shared/types.ts';
import {
  BASE_STARTING_CARDS,
  DOMAIN_CARD_GRANTS,
  startingCardAllowance,
  startingCardGrants,
  type CardGrant,
  type FeatureTier,
} from '../../src/ui/build/cardAllowance.ts';
import { emptyDraft } from '../../src/ui/build/creation.ts';
import { StepCards } from '../../src/ui/build/Wizard.tsx';

const dataset = srd as unknown as Dataset;

describe('the number of domain cards a character takes at creation', () => {
  it('is two for a Wizard who went to the School of War', () => {
    expect(startingCardAllowance(['school-of-war'], dataset)).toBe(2);
  });

  it('is three for a Wizard who went to the School of Knowledge', () => {
    expect(startingCardAllowance(['school-of-knowledge'], dataset)).toBe(3);
  });

  it('is two for either Druid subclass', () => {
    expect(startingCardAllowance(['warden-of-the-elements'], dataset)).toBe(2);
    expect(startingCardAllowance(['warden-of-renewal'], dataset)).toBe(2);
  });

  it('is two before a subclass has been chosen', () => {
    expect(startingCardAllowance([null], dataset)).toBe(BASE_STARTING_CARDS);
  });

  it('is two for every subclass in the dataset but School of Knowledge', () => {
    const raised = dataset.subclasses
      .filter((s) => startingCardAllowance([s.id], dataset) !== BASE_STARTING_CARDS)
      .map((s) => s.id);
    expect(raised).toEqual(['school-of-knowledge']);
  });

  it('adds a card per granting subclass when a character carries more than one', () => {
    expect(startingCardAllowance(['school-of-knowledge', 'warden-of-renewal'], dataset)).toBe(3);
  });

  it('ignores a subclass ref this dataset does not offer', () => {
    // A ref can outlive the dataset it came from - an imported homebrew set, a
    // backup restored against a different revision. It must not buy a card the
    // player was never shown a screen for.
    const trimmed = { subclasses: dataset.subclasses.filter((s) => s.id !== 'school-of-knowledge') };
    expect(startingCardAllowance(['school-of-knowledge'], trimmed)).toBe(BASE_STARTING_CARDS);
  });

  it('names the feature the extra card came from, so the screen can say why', () => {
    expect(startingCardGrants(['school-of-knowledge'], dataset).map((g) => g.feature)).toEqual([
      'Prepared',
    ]);
  });

  it('leaves the specialization and mastery copies of the grant to level up', () => {
    const knowledge = DOMAIN_CARD_GRANTS.filter((g) => g.subclass === 'school-of-knowledge');
    expect(knowledge.map((g) => g.tier)).toEqual(['foundation', 'specialization', 'mastery']);
    expect(startingCardGrants(['school-of-knowledge'], dataset).map((g) => g.tier)).toEqual([
      'foundation',
    ]);
  });
});

// ---------------------------------------------------------------------------
// The table, checked against the dataset it claims to describe
// ---------------------------------------------------------------------------

/** The sentence the SRD uses for every one of these grants, in all three tiers. */
const GRANT_PHRASE = /additional domain card/i;

const featureLists = (s: Subclass): ReadonlyArray<readonly [FeatureTier, readonly Feature[]]> => [
  ['foundation', s.foundationFeatures],
  ['specialization', s.specializationFeatures],
  ['mastery', s.masteryFeatures],
];

const key = (g: CardGrant): string => `${g.subclass} · ${g.tier} · ${g.feature}`;

/** Every subclass feature in the dataset whose text hands out another card. */
const inDataset: CardGrant[] = dataset.subclasses.flatMap((s) =>
  featureLists(s).flatMap(([tier, features]) =>
    features
      .filter((f) => GRANT_PHRASE.test(f.text))
      .map((f) => ({ subclass: s.id, tier, feature: f.name })),
  ),
);

describe('the grant table in cardAllowance.ts', () => {
  it('accounts for every subclass feature in the dataset that grants an extra domain card', () => {
    const known = new Set(DOMAIN_CARD_GRANTS.map(key));
    const uncovered = inDataset.filter((g) => !known.has(key(g))).map(key);
    expect(
      uncovered,
      'this dataset grants domain cards DOMAIN_CARD_GRANTS has never heard of. ' +
        'Add each one to src/ui/build/cardAllowance.ts, with the tier it is gained at, ' +
        'or creation will quietly hand the player one card too few.',
    ).toEqual([]);
  });

  it('claims no grant the dataset does not actually contain', () => {
    const present = new Set(inDataset.map(key));
    const stale = DOMAIN_CARD_GRANTS.filter((g) => !present.has(key(g))).map(key);
    expect(
      stale,
      'DOMAIN_CARD_GRANTS names features this dataset does not have. ' +
        'Either the SRD renamed them or the entry was a guess.',
    ).toEqual([]);
  });

  it('is not needed for any class feature, which it could not express anyway', () => {
    // The table is keyed by subclass. A grant printed on a class instead would
    // slip past it entirely, so the scan says out loud that none exists.
    const onClasses = dataset.classes.flatMap((c) =>
      [c.hopeFeature, ...c.classFeatures]
        .filter((f) => GRANT_PHRASE.test(f.text))
        .map((f) => `${c.id} · ${f.name}`),
    );
    expect(onClasses, 'a class feature grants domain cards; the table cannot key on that').toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------
// The wizard actually asks
// ---------------------------------------------------------------------------

const BUILD = fileURLToPath(new URL('../../src/ui/build', import.meta.url));

/** A comment that quotes the old code is not the old code. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// The whole directory rather than one named file, because the count keeps
// moving between them - it lived in Wizard.tsx, then in creation.ts - and a
// test that names a file stops guarding the moment the code is lifted out of it.
const buildSources = readdirSync(BUILD)
  .filter((f) => /\.tsx?$/.test(f) && f !== 'cardAllowance.ts')
  .map((f) => ({ file: f, source: stripComments(readFileSync(join(BUILD, f), 'utf8')) }));

const allBuildSource = buildSources.map((s) => s.source).join('\n');

/** The seven shapes the count used to be spelled out in, as a literal two. */
const OLD_SITES: ReadonlyArray<readonly [string, string]> = [
  ['the take-a-card guard', 'cards.length < 2'],
  ['the section heading', 'Two level 1 cards'],
  ['the chosen-so-far hint', '/ 2 CHOSEN'],
  ['the card-is-unavailable flag', 'cards.length >= 2'],
  ['the disabled TAKE bar', 'TWO ALREADY'],
  ['the progress dot for the card step', 'cards.length === 2'],
  ['the blocker on the card step', '2 - draft.cards.length'],
];

describe('the wizard', () => {
  it('imports the allowance rather than keeping its own copy of the number', () => {
    const importers = buildSources
      .filter((s) => /from '\.\/cardAllowance\.ts'/.test(s.source))
      .map((s) => s.file);
    expect(importers.length).toBeGreaterThan(0);
  });

  it('asks for the allowance on the card screen, in the progress dots and in the blockers', () => {
    const calls = allBuildSource.match(/startingCardAllowance\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('asks from the screen and from the model, not from only one of them', () => {
    // A count is a weak guard on its own: three calls in one file would satisfy
    // it while the other file quietly went back to a literal. The screen that
    // offers the cards and the model that gates on them are two readers and
    // have to stay two, whichever files they happen to live in this month.
    const askers = buildSources
      .filter((s) => s.source.includes('startingCardAllowance('))
      .map((s) => s.file);
    expect(askers.length).toBeGreaterThanOrEqual(2);
  });

  it.each(OLD_SITES)('no longer hardcodes two at %s', (_where, fragment) => {
    const offenders = buildSources.filter((s) => s.source.includes(fragment)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('keeps the number in one module instead of declaring a second one', () => {
    // `const CARDS_AT_CREATION = 2` beside a `startingCardAllowance` call is the
    // shape the bug comes back in: a module constant cannot know the subclass,
    // so whichever of the two is read last decides, and one of them is wrong.
    const rival = buildSources.flatMap((s) =>
      (s.source.match(/const\s+[A-Z][A-Z_]*CARDS?[A-Z_]*\s*=\s*\d+/g) ?? []).map(
        (m) => `${s.file}: ${m}`,
      ),
    );
    expect(rival, 'the starting card count belongs to cardAllowance.ts alone').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The screen that hands the cards out
// ---------------------------------------------------------------------------

/*
 * Everything above proves the number is computed and asked for. This proves it
 * is answered, on the screen, in the words the player reads.
 *
 * The card step is rendered against the real SRD: `StepCards` takes the
 * dataset off the store, and a server render is handed the store's initial
 * state, which is the SRD as built. Nothing here is stubbed and no fixture is involved. There
 * is no DOM to tap with, so a draft that has already taken cards is passed in
 * rather than clicked into being - which is the same state, arrived at from the
 * other side. `useMedia` answers false without a browser, so this is the
 * desktop layout of that screen.
 */
const wizardClass = dataset.classes.find((c) => c.id === 'wizard');

/** The level 1 cards a Wizard is offered, in the order the screen shows them. */
const offered = dataset.domainCards
  .filter((c) => c.level === 1 && wizardClass?.domains.includes(c.domain) === true)
  .map((c) => c.id);

const cardStep = (subclassRef: Ref | null, cards: Ref[] = []): string =>
  renderToStaticMarkup(
    createElement(StepCards, {
      draft: { ...emptyDraft(), classRef: 'wizard', subclassRef, cards },
      set: () => undefined,
      klass: wizardClass,
    }),
  );

describe('the card step, as a School of Knowledge wizard meets it', () => {
  it('has a Wizard with two domains and six level 1 cards to offer', () => {
    expect(wizardClass?.domains).toEqual(['codex', 'splendor']);
    expect(offered).toHaveLength(6);
  });

  it('asks for three in the heading, spelled out rather than set as a numeral', () => {
    expect(cardStep('school-of-knowledge')).toContain('>Three level 1 cards<');
  });

  it('counts to three in the hint, and names the feature that paid for the third', () => {
    expect(cardStep('school-of-knowledge')).toContain('0 / 3 CHOSEN — ONE EXTRA FROM PREPARED');
  });

  it('is still offering cards after two have been taken', () => {
    // The bug as the player met it: two cards chosen, every remaining card
    // greyed out, the step marked done, and the character one card short of
    // legal - discovered weeks later by a GM, from a sheet this app built.
    const html = cardStep('school-of-knowledge', offered.slice(0, 2));
    expect(html.match(/>TAKE</g)).toHaveLength(offered.length - 2);
    expect(html).not.toContain('ALREADY');
  });

  it('closes at three, and says three when it refuses a fourth', () => {
    const html = cardStep('school-of-knowledge', offered.slice(0, 3));
    expect(html.match(/>TAKEN</g)).toHaveLength(3);
    expect(html.match(/THREE ALREADY/g)).toHaveLength(offered.length - 3);
  });

  it('stops advising a split that no longer adds up', () => {
    // "One from each, or two from one" describes two cards and only two. An
    // instruction that is wrong about the number is worse than none at all.
    expect(cardStep('school-of-knowledge')).toContain('SPLIT THE THREE BETWEEN THEM');
    expect(cardStep('school-of-knowledge')).not.toContain('OR TWO FROM ONE');
  });
});

describe('the card step, as every other wizard meets it', () => {
  it('asks for two, and closes at two', () => {
    const html = cardStep('school-of-war', offered.slice(0, 2));
    expect(html).toContain('>Two level 1 cards<');
    expect(html).toContain('2 / 2 CHOSEN');
    expect(html).not.toContain('>TAKE<');
    expect(html.match(/TWO ALREADY/g)).toHaveLength(offered.length - 2);
  });

  it('says nothing about an extra card where there is no extra card', () => {
    expect(cardStep('school-of-war')).not.toContain('EXTRA FROM');
    expect(cardStep('school-of-war')).toContain('ONE FROM EACH, OR TWO FROM ONE');
  });

  it('asks for two before a subclass has been chosen at all', () => {
    expect(cardStep(null)).toContain('>Two level 1 cards<');
  });
});
