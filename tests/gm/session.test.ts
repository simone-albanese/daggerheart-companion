/**
 * The vocabulary of a session row, arm by arm.
 *
 * These are the sentences a shut row shows, and they are checked here rather
 * than through a mounted screen because the interesting cases are the two arms
 * a screen test would have to work to produce: an item this build cannot read,
 * and a link whose target this dataset does not carry. `shared/campaigns.ts`
 * goes to real trouble to keep both - `readSessionItem` wraps an unknown kind
 * instead of dropping it, `readLinkTarget` keeps the original kind string - and
 * all of that is undone one level up by a summary that renders them as an empty
 * string. So each arm is asked directly.
 *
 * Node, not jsdom: nothing here touches the DOM or the store.
 */
import { describe, expect, it } from 'vitest';
import { indexDataset } from '../../src/engine/character.ts';
import { baseDataset } from '../../src/store/dataset.ts';
import { SESSION_ITEM_KINDS } from '../../shared/campaigns.ts';
import type { LinkTarget, SessionItem, SessionItemBase } from '../../shared/campaigns.ts';
import type { EncounterAdjustments } from '../../shared/types.ts';
import {
  COUNTDOWN_KIND_COLOR,
  LINK_KIND_LABEL,
  SESSION_KIND_COLOR,
  SESSION_KIND_LABEL,
  describeItem,
  linkName,
  newEncounter,
  newLink,
  newScene,
  sessionName,
  sessionTitle,
} from '../../src/ui/gm/session.ts';

const dataset = baseDataset;
const index = indexDataset(baseDataset);
const ADJUSTMENTS: EncounterAdjustments = { easier: false, harder: false, damageBump: false };

const base = (patch: Partial<SessionItemBase> = {}): SessionItemBase => ({
  id: 'i1',
  name: 'A row',
  order: 0,
  collapsed: true,
  ...patch,
});

/**
 * Four at the table unless a test says otherwise, which is the number that
 * makes a Minion group four adversaries rather than a synonym for one.
 */
const PARTY = 4;

const describe_ = (item: SessionItem, partySize = PARTY): string =>
  describeItem(item, dataset, index, partySize);

const environment = dataset.environments[0]!;
const adversary = dataset.adversaries[0]!;
const minion = dataset.adversaries.find((a) => a.role === 'Minion')!;
const card = dataset.domainCards[0]!;
const rule = dataset.rules[0]!;

describe('the name a row draws', () => {
  it('uses the name the GM gave it', () => {
    const item: SessionItem = { ...base({ name: 'The Sablewood Gate' }), kind: 'scene', environmentRef: null };
    expect(sessionTitle(item)).toEqual({ text: 'The Sablewood Gate', invented: false });
  });

  it('stands the kind word in for an empty name, and says that it did', () => {
    // The flag is the whole point: `SessionItemBase.name` promises an empty
    // name stays empty, so the row has to be able to draw the substitute as a
    // substitute rather than write it back onto the record.
    const item: SessionItem = { ...base({ name: '   ' }), kind: 'scene', environmentRef: null };
    expect(sessionTitle(item)).toEqual({ text: 'Scene', invented: true });
  });

  it('never hands a control an empty accessible name, on any arm', () => {
    const items: SessionItem[] = [
      { ...base({ name: '' }), kind: 'scene', environmentRef: null },
      { ...base({ name: '' }), kind: 'encounter', roster: [], adjustments: { easier: false, harder: false, damageBump: false }, combatants: [] },
      { ...base({ name: '' }), kind: 'link', target: { kind: 'rule', ref: 'x' } },
      { ...base({ name: '' }), kind: 'countdown', primary: false, countdown: { id: 'c', name: '', kind: 'standard', start: 4, value: 4, notes: '' } },
      { ...base({ name: '' }), kind: 'url', href: 'https://a.example/' },
      { ...base({ name: '' }), kind: 'note', note: [] },
      { ...base({ name: '' }), kind: 'unreadable', why: 'why', raw: '{}' },
    ];
    for (const item of items) {
      expect(sessionName(item), `${item.kind} has no name to announce`).not.toBe('');
      expect(sessionName(item)).toBe(SESSION_KIND_LABEL[item.kind]);
    }
  });
});

describe('what a shut row says about itself', () => {
  it('names the scene’s environment rather than counting it', () => {
    const item: SessionItem = { ...base(), kind: 'scene', environmentRef: environment.id };
    expect(describe_(item)).toBe(environment.name.toUpperCase());
  });

  it('tells a scene with no environment apart from one this dataset cannot resolve', () => {
    const none: SessionItem = { ...base(), kind: 'scene', environmentRef: null };
    const gone: SessionItem = { ...base(), kind: 'scene', environmentRef: 'a-layer-not-loaded' };
    expect(describe_(none)).toBe('NO ENVIRONMENT');
    // The two are different facts and the difference is the point: one is a
    // scene not yet placed, the other is a scene whose place this device has
    // not loaded. Collapsing them loses the second one entirely.
    expect(describe_(gone)).toBe('NOT IN THIS DATASET');
  });

  it('counts the bodies in an encounter, not the lines in its roster', () => {
    // Neither adversary here is a Minion - `adversary` is the Acid Burrower, a
    // Solo, and the second ref resolves to nothing at all - so this is the arm
    // where one count is one adversary and 3 + 1 is the whole answer.
    const item: SessionItem = {
      ...base(),
      kind: 'encounter',
      roster: [
        { ref: adversary.id, count: 3 },
        { ref: 'somebody-else', count: 1 },
      ],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [],
    };
    expect(adversary.role, 'the first adversary in the dataset became a Minion').not.toBe('Minion');
    expect(describe_(item)).toBe('4 PLANNED');
  });

  it('reads a Minion entry as groups the size of the party, not as three rats', () => {
    /*
     * The defect this arm had. `EncounterEntry.count` is *groups* for a Minion,
     * each the size of the party, and `ROLE_COST` charges 1 point per group -
     * so a row that added the counts up said "3 PLANNED" about a fight the GM
     * had spent three points and twelve bodies on. The builder's roster panel
     * has said "3 GROUPS OF 4" since the first commit, `8c83f78`, and `ecf8017`
     * brought the open encounter row into line with it; this is the shut row
     * catching up with them both.
     */
    const item: SessionItem = {
      ...base(),
      kind: 'encounter',
      roster: [{ ref: minion.id, count: 3 }],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [],
    };
    expect(minion.role).toBe('Minion');
    expect(describe_(item, 4)).toBe('12 PLANNED');
    // The party size is the multiplier and not a constant folded into it: the
    // same plan read at a table of six is eighteen.
    expect(describe_(item, 6)).toBe('18 PLANNED');
    expect(describe_(item, 1)).toBe('3 PLANNED');
  });

  it('adds a Minion’s groups to everyone else’s heads in one number', () => {
    const item: SessionItem = {
      ...base(),
      kind: 'encounter',
      roster: [
        { ref: minion.id, count: 2 },
        { ref: adversary.id, count: 1 },
      ],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [],
    };
    expect(describe_(item, 4)).toBe('9 PLANNED');
  });

  it('counts a ref this dataset cannot resolve as one, rather than guessing a group', () => {
    // `minionRecord` answers `false` for a ref with no record behind it. The
    // alternative - assuming the missing one was a Minion - would multiply a
    // number nothing on this device can check.
    const item: SessionItem = {
      ...base(),
      kind: 'encounter',
      roster: [{ ref: 'a-layer-not-loaded', count: 2 }],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [],
    };
    expect(index.byRef.has('a-layer-not-loaded')).toBe(false);
    expect(describe_(item, 8)).toBe('2 PLANNED');
  });

  it('says an empty encounter is empty', () => {
    const item: SessionItem = {
      ...base(),
      kind: 'encounter',
      roster: [],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [],
    };
    expect(describe_(item)).toBe('NOTHING PLANNED');
  });

  it('names what each kind of link points at', () => {
    const cases: Array<[LinkTarget, string]> = [
      [{ kind: 'adversary', ref: adversary.id }, `ADVERSARY · ${adversary.name.toUpperCase()}`],
      [{ kind: 'environment', ref: environment.id }, `ENVIRONMENT · ${environment.name.toUpperCase()}`],
      [{ kind: 'domainCard', ref: card.id }, `CARD · ${card.name.toUpperCase()}`],
      [{ kind: 'rule', ref: rule.id }, `RULE · ${rule.title.toUpperCase()}`],
    ];
    for (const [target, expected] of cases) {
      expect(describe_({ ...base(), kind: 'link', target })).toBe(expected);
    }
  });

  it('keeps the kind of a link it cannot resolve, instead of going quiet', () => {
    const item: SessionItem = { ...base(), kind: 'link', target: { kind: 'adversary', ref: 'the-gnawing' } };
    expect(describe_(item)).toBe('ADVERSARY · NOT IN THIS DATASET');
  });

  it('draws a link kind this build has never heard of, and says what it was called', () => {
    // The arm `readLinkTarget` invented rather than throw. If this row went
    // blank, keeping the original `kind` string in `named` would have bought
    // nothing at all.
    const named: SessionItem = { ...base(), kind: 'link', target: { kind: 'unknown', named: 'photo', ref: 'p1' } };
    const nameless: SessionItem = { ...base(), kind: 'link', target: { kind: 'unknown', named: '', ref: 'p1' } };
    expect(describe_(named)).toBe('PHOTO · NOT A KIND THIS BUILD KNOWS');
    expect(describe_(nameless)).toBe('NOT A KIND THIS BUILD KNOWS');
  });

  it('reads a countdown as its value over its start, and as a word at zero', () => {
    const at = (value: number): SessionItem => ({
      ...base(),
      kind: 'countdown',
      primary: false,
      countdown: { id: 'c', name: 'The ritual completes', kind: 'dynamic', start: 6, value, notes: '' },
    });
    expect(describe_(at(4))).toBe('4/6');
    // Not "0/6". A spent countdown is the thing happening, and the board this
    // row mirrors already says so in that word.
    expect(describe_(at(0))).toBe('SPENT');
  });

  it('says an unreadable row is kept, and puts none of its bytes in the summary', () => {
    const raw = '{"kind":"photo","blob":"AAAA"}';
    const item: SessionItem = { ...base(), kind: 'unreadable', why: 'this version of the app has no "photo" item', raw };
    expect(describe_(item)).toBe('KEPT, NOT READ');
    expect(describe_(item)).not.toContain('photo');
  });

  it('shows a web link’s host, in the punycode the parser produced', () => {
    /*
     * Mitigation 5 reaching the shut row.
     *
     * `https://аpple.com/` here has a Cyrillic а in it - measured in this
     * Node's URL parser, which turns that host into `xn--pple-43d.com`. The row
     * has to print what the parser produced, because the whole mitigation for a
     * homograph is to stop hiding it, and a summary that decoded it back would
     * be the one place in the app that helpfully lied about a destination.
     */
    const item: SessionItem = { ...base(), kind: 'url', href: 'https://xn--pple-43d.com/latest' };
    expect(describe_(item)).toBe('XN--PPLE-43D.COM/LATEST');
    expect(describe_(item)).not.toContain('APPLE.COM');
  });

  it('tells a web link with no address apart from one that has one', () => {
    // Two different facts. A row the GM has just added and not typed into has
    // no address; so does a row whose address arrived hostile and was refused.
    // The row is kept either way, which is why the summary has to say so.
    expect(describe_({ ...base(), kind: 'url', href: '' })).toBe('NO ADDRESS');
    expect(describe_({ ...base(), kind: 'url', href: 'https://a.example/' })).toBe('A.EXAMPLE');
  });

  it('previews a note’s own words rather than counting its characters', () => {
    const item: SessionItem = {
      ...base(),
      kind: 'note',
      note: [
        { type: 'heading', align: 'center', spans: [{ text: 'Terms', bold: true, italic: false }] },
        {
          type: 'paragraph',
          align: 'start',
          spans: [{ text: 'Rhys wants the cargo', bold: false, italic: false }],
        },
      ],
    };
    // The newline `plainTextOf` puts between blocks is collapsed: a shut row is
    // one line, and a preview that carried a line break would push the row's
    // own height around depending on what the GM typed.
    expect(describe_(item)).toBe('TERMS RHYS WANTS THE CARGO');
  });

  it('says an empty note is empty', () => {
    expect(describe_({ ...base(), kind: 'note', note: [] })).toBe('EMPTY NOTE');
  });
});

describe('resolving a link against the dataset', () => {
  it('finds a rule, which is the one kind the index does not carry', () => {
    // The property, stated so a future `indexDataset` that does put rules in
    // `byRef` does not leave this branch scanning a list for no reason.
    expect(index.byRef.has(rule.id), 'rules are in byRef now; linkName can stop scanning').toBe(false);
    expect(linkName({ kind: 'rule', ref: rule.id }, dataset, index)).toBe(rule.title);
  });

  it('answers null rather than a name for a target it cannot follow', () => {
    expect(linkName({ kind: 'unknown', named: 'photo', ref: 'p1' }, dataset, index)).toBeNull();
    expect(linkName({ kind: 'adversary', ref: 'the-gnawing' }, dataset, index)).toBeNull();
    expect(linkName({ kind: 'rule', ref: 'no-such-rule' }, dataset, index)).toBeNull();
  });

  it('has a label and a colour for every arm of both unions', () => {
    // A `Record<K, string>` typechecks; what it cannot promise is that somebody
    // did not write '' into one of the cells while adding an arm.
    for (const value of [...Object.values(SESSION_KIND_LABEL), ...Object.values(LINK_KIND_LABEL), ...Object.values(COUNTDOWN_KIND_COLOR)]) {
      expect(value).not.toBe('');
    }
    expect(Object.keys(SESSION_KIND_LABEL)).toHaveLength(7);
    expect(Object.keys(LINK_KIND_LABEL)).toHaveLength(5);
  });

  it('gives no two kinds of row the same stripe', () => {
    // The stripe's only job is telling one row from another down a scrolling
    // list, so a shared token is not a smaller version of the feature - it is
    // the feature switched off for that pair. `url` shipped beside `link` and
    // the obvious thing to do was give it `--codex` too.
    const colours = Object.values(SESSION_KIND_COLOR);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it('does not offer ADD a kind it has no factory for', () => {
    /*
     * `SESSION_ITEM_KINDS` is what the ADD sheet builds its buttons from, and
     * it has never been `SessionItem['kind']`: `unreadable` is a reading rather
     * than a thing a GM adds, and `url` and `note` are readable and exportable
     * from campaign schema 2 but get their screens in two later lanes. A button
     * that minted nothing would be worse than no button.
     */
    expect([...SESSION_ITEM_KINDS]).toEqual(['scene', 'encounter', 'link', 'countdown']);
    for (const kind of SESSION_ITEM_KINDS) {
      expect(SESSION_KIND_LABEL[kind]).not.toBe('');
    }
  });
});

describe('the three rows ADD mints', () => {
  it('leaves the order to the store, which is the only thing that knows it', () => {
    // `addSessionItem` stamps `session.length`. A factory that also guessed
    // would be a second opinion about a number, and two rows at position 4.
    expect(newScene('The gate', null, 's1').order).toBe(0);
    expect(newLink('A card', { kind: 'domainCard', ref: card.id }, 'l1').order).toBe(0);
    expect(newEncounter('The ambush', [], ADJUSTMENTS, 'e1').order).toBe(0);
  });

  it('mints every one of them closed', () => {
    // Open, the new row pushes the rest of the night off a 393px phone at the
    // moment it is added - and the GM has just typed everything it would show.
    expect(newScene('The gate', null, 's1').collapsed).toBe(true);
    expect(newLink('A card', { kind: 'domainCard', ref: card.id }, 'l1').collapsed).toBe(true);
    expect(newEncounter('The ambush', [], ADJUSTMENTS, 'e1').collapsed).toBe(true);
  });

  it('takes the id it is given, so a test never has to guess one', () => {
    expect(newScene('The gate', environment.id, 's1').id).toBe('s1');
    expect(newScene('The gate', environment.id).id).not.toBe('');
  });

  it('keeps a name that is only spaces out of the record', () => {
    // `SessionItemBase.name` promises a name is never generated and an empty
    // one stays empty; `sessionTitle` is the other half, drawing the kind word
    // dimmed. Trimming is not generating, and '   ' left in would be a title
    // that renders as blank rather than as the word "Scene".
    const item = newScene('   ', null, 's1');
    expect(item.name).toBe('');
    expect(sessionTitle(item)).toEqual({ text: 'Scene', invented: true });
  });

  it('gives a new encounter no fight, because nothing could ever change one', () => {
    const item = newEncounter('The ambush', [{ ref: adversary.id, count: 3 }], ADJUSTMENTS, 'e1');
    expect(item.kind === 'encounter' && item.combatants).toEqual([]);
    expect(describe_(item)).toBe('3 PLANNED');
  });

  it('copies the roster it is handed rather than pointing at the board’s', () => {
    const roster = [{ ref: adversary.id, count: 2 }];
    const item = newEncounter('The ambush', roster, ADJUSTMENTS, 'e1');
    roster[0]!.count = 9;
    expect(item.kind === 'encounter' && item.roster).toEqual([{ ref: adversary.id, count: 2 }]);
  });
});
