/**
 * `indexDataset`'s bare-slug map, when two collections print the same slug.
 *
 * SRD 2.0 made a `Ref` ambiguous for the first time. It prints an Event
 * environment called *Hold the Line* (folio 164) beside the Valor domain card
 * of the same name (folio 223), and `slugify` reduces both to
 * `hold-the-line`. Measured over the parsed book, that is the ONLY collision
 * among the twelve collections `indexDataset` carries - `byRef` holds 1336
 * entries against 1337 records, exactly one key short - and
 * `data/srd-1.0.json` has none at all, so nothing here changes what the app
 * ships today. It changes what the app does the moment it ships SRD 2.0.
 * `npm run build:srd -- --check --pdf Manuali/DH_SRD_2_2026_08_25.pdf` names
 * the pairs.
 *
 * Before this lane, `byRef` was filled as each typed map was built, so the
 * LAST collection written won: environments came after domain cards, and
 * `indexDataset(srd2).byRef.get('hold-the-line')` returned the ENVIRONMENT -
 * measured on the real book, not reasoned. The domain card, the one a loadout
 * can actually hold, was the record that disappeared.
 *
 * Two claims are made here and each has its own arm below:
 *
 * 1. A bare-slug lookup resolves by `INDEXED_COLLECTIONS`, which is
 *    `BANDED_COLLECTIONS` order, so `byRef` and `data/registry.json` cannot
 *    disagree about which record a bare name means.
 * 2. A caller that knows its collection never has to accept that answer.
 *    `index.collections` is the runtime `idIn`, and the three GM lookups that
 *    knew their kind and asked the whole key space anyway now use it.
 *
 * The second is the one with teeth. Both colliding records are called "Hold
 * the Line", so a scene set in the environment would have drawn
 * `HOLD THE LINE` off a domain card and looked entirely correct. The fixtures
 * below give the two records different names for exactly that reason: a test
 * that used the book's own names could not tell which record it was holding.
 */
import { describe, expect, it } from 'vitest';
import { indexDataset, INDEXED_COLLECTIONS } from '@engine/character.ts';
import { characterFeatures } from '@engine/features.ts';
import { collectModifiers } from '@engine/modifiers.ts';
import { BANDED_COLLECTIONS } from '../../src/transfer/registry.ts';
import { describeItem, linkName, plannedAdversaries } from '../../src/ui/gm/session.ts';
import {
  feature,
  makeAdversary,
  makeCard,
  makeCharacter,
  makeClass,
  makeDataset,
  makeItem,
} from '../fixtures/factories.ts';
import type { Ancestry, Dataset, Environment } from '../../shared/types.ts';
import type { SessionItem } from '../../shared/campaigns.ts';

const SLUG = 'hold-the-line';

const environment = (p: Partial<Environment> = {}): Environment => ({
  id: SLUG,
  name: 'The Environment',
  tier: 2,
  type: 'Event',
  description: '',
  impulses: '',
  difficulty: 15,
  potentialAdversaries: [],
  features: [feature('An Environment Feature')],
  ...p,
});

const card = makeCard({ id: SLUG, name: 'The Domain Card', domain: 'valor' });

/** The book's own collision: one slug, a domain card and an environment. */
const collided: Dataset = makeDataset({ domainCards: [card], environments: [environment()] });

describe('byRef precedence when one slug names two records', () => {
  it('resolves the bare slug to the domain card, not the environment', () => {
    const ix = indexDataset(collided);
    expect(ix.byRef.get(SLUG)).toBe(card);
    expect(ix.byRef.get(SLUG)).not.toBe(collided.environments[0]);
  });

  it('does not lose the environment - it is in its own map', () => {
    const ix = indexDataset(collided);
    expect(ix.collections.environments.get(SLUG)).toBe(collided.environments[0]);
    expect(ix.collections.domainCards.get(SLUG)).toBe(card);
  });

  it('mirrors BANDED_COLLECTIONS rather than holding a second opinion', () => {
    // `transformations` and `stances` are the banded collections `byRef` has
    // never carried - each reachable only through `collections`, each for a
    // reason in its own docblock. Everything else must be in the same order, so
    // the registry's bare-name winner and `byRef`'s are the same record.
    const EXACT_ONLY = ['transformations', 'stances'];
    expect([...INDEXED_COLLECTIONS]).toEqual(
      BANDED_COLLECTIONS.filter((c) => !EXACT_ONLY.includes(c)),
    );
  });

  it('keeps every record reachable, and byRef holds one entry per distinct slug', () => {
    const ix = indexDataset(collided);
    const slugs = new Set<string>();
    for (const name of INDEXED_COLLECTIONS) {
      for (const [ref, record] of ix.collections[name]) {
        slugs.add(ref);
        // Reachable through its OWN collection, always - that is the promise
        // `byRef` cannot make and this pair of maps exists to keep.
        expect(ix.collections[name].get(ref)).toBe(record);
      }
    }
    expect(ix.byRef.size).toBe(slugs.size);
    expect(slugs.has(SLUG)).toBe(true);
  });
});

describe('a caller that knows its kind gets that kind', () => {
  const ix = indexDataset(collided);
  const dataset = collided;

  it('names the environment for an environment link and the card for a card link', () => {
    expect(linkName({ kind: 'environment', ref: SLUG }, dataset, ix)).toBe('The Environment');
    expect(linkName({ kind: 'domainCard', ref: SLUG }, dataset, ix)).toBe('The Domain Card');
  });

  it('refuses a link whose kind names a collection this slug is not in', () => {
    // The slug resolves - twice - but not as an adversary, and answering with
    // one of the two records it DOES name is the whole defect.
    expect(linkName({ kind: 'adversary', ref: SLUG }, dataset, ix)).toBeNull();
  });

  it("names a scene's environment off the environment, not off the card", () => {
    const scene = {
      id: 's1',
      kind: 'scene',
      name: '',
      createdAt: '2024-01-01T00:00:00.000Z',
      environmentRef: SLUG,
      combatants: [],
      roster: [],
      adjustments: {},
    } as unknown as SessionItem;
    expect(describeItem(scene, dataset, ix, 4, null)).toContain('THE ENVIRONMENT');
    expect(describeItem(scene, dataset, ix, 4, null)).not.toContain('THE DOMAIN CARD');
  });
});

/*
 * The arms below use collisions the book does not print. They are here because
 * the DEFECT is a property of the lookup and not of one pair of folios: the
 * moment a slug is ambiguous, every caller that asked the whole key space was
 * answering from whichever collection happened to be written last. SRD 2.0
 * already prints two such pairs across its fifteen collections, so "no book
 * has ever collided here" is a fact with a date on it.
 *
 * Which collection a fixture collides WITH is chosen, not arbitrary, and the
 * first draft of this block got it wrong. An ancestry colliding with an
 * environment does not test the exact lookup at all: `ancestries` outranks
 * `environments` in `INDEXED_COLLECTIONS`, so `byRef` answers correctly too,
 * and reverting `features.ts` to `byRef.get(r) as Ancestry` left this file
 * green. Measured, by running that mutant. The pair below is `classes`
 * instead, which is one of exactly two collections that outrank `ancestries` -
 * so it is the only shape that can tell the two lookups apart.
 */
describe('the exact lookup, where precedence alone is not enough', () => {
  it('counts a Minion roster entry off the adversary, not off a consumable', () => {
    /*
     * `consumables` outranks `adversaries`, so `byRef.get('swarm')` is the
     * Item - which has no `role`, so the entry reads as a Standard and three
     * GROUPS of Minions land on the table as three bodies instead of twelve.
     * The pairing is deliberate: colliding with an ENVIRONMENT proves nothing
     * here, because `adversaries` outranks `environments` and `byRef` would
     * answer correctly by luck. Measured - that version of this test stayed
     * green under the mutant.
     */
    const minion = makeAdversary({ id: 'swarm', name: 'Swarm', role: 'Minion' });
    const ds = makeDataset({
      adversaries: [minion],
      consumables: [makeItem({ id: 'swarm', name: 'Swarm Vial', kind: 'consumable' })],
    });
    const ix = indexDataset(ds);
    expect(ix.byRef.get('swarm')).toBe(ds.consumables[0]);
    expect(plannedAdversaries([{ ref: 'swarm', count: 3 }], ix, 4)).toBe(12);
  });

  it('takes ancestry features off the ancestry, not off a class of the same slug', () => {
    /*
     * `classes` comes first in `INDEXED_COLLECTIONS`, so on this dataset
     * `byRef.get('giant')` is the CLASS and precedence is no help - only
     * `index.collections.ancestries` can answer this. It is also the arm that
     * shows why the whole key space was the wrong question: a `CharClass` has
     * `classFeatures` and no `features`, so the old `as Ancestry` cast handed
     * `characterFeatures` a record whose feature list is `undefined`.
     */
    const ancestry: Ancestry = {
      id: 'giant',
      name: 'Giant',
      description: '',
      features: [feature('Ancestry One'), feature('Ancestry Two')],
    };
    const ds = makeDataset({
      classes: [makeClass(), makeClass({ id: 'giant', name: 'Giant The Class' })],
      ancestries: [ancestry],
    });
    const ix = indexDataset(ds);
    expect(ix.byRef.get('giant')).toBe(ds.classes[1]);

    const held = characterFeatures(makeCharacter({ ancestryRefs: ['giant'] }), ix);
    const fromAncestry = held.features.filter((f) => f.site === 'ancestry');
    expect(fromAncestry.map((f) => f.name)).toEqual(['Ancestry One', 'Ancestry Two']);
    expect(fromAncestry.every((f) => f.source === 'Giant')).toBe(true);
  });

  it('names an ancestry bonus after the ancestry, not after a class of the same slug', () => {
    // `giant` is a real `ANCESTRY_MODS` key: Endurance, +1 Hit Point, slot 0.
    // The bonus keys off the ref and lands either way; what the wrong record
    // corrupts is the SOURCE the sheet prints beside the number.
    const ancestry: Ancestry = {
      id: 'giant',
      name: 'Giant',
      description: '',
      features: [feature('Endurance'), feature('Ancestry Two')],
    };
    const ds = makeDataset({
      classes: [makeClass(), makeClass({ id: 'giant', name: 'Giant The Class' })],
      ancestries: [ancestry],
    });
    const ix = indexDataset(ds);
    const ledger = collectModifiers(makeCharacter({ ancestryRefs: ['giant'] }), ix, 1);
    const hp = ledger.maxHp.filter((e) => e.lane === 'ancestry');
    expect(hp.map((e) => e.source)).toEqual(['Giant']);
    expect(hp.map((e) => e.amount)).toEqual([1]);
  });
});
