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
 * Node, not jsdom: nothing here renders anything or reads a store. The one
 * import that reaches a component file is `ADD_FORMS`, and it is reached for
 * its keys - the ADD menu is exactly the kinds that table has a row for, which
 * is a fact about two lists and needs no screen to ask about.
 */
import { describe, expect, it } from 'vitest';
import { indexDataset } from '../../src/engine/character.ts';
import { baseDataset } from '../../src/store/dataset.ts';
import { SESSION_ITEM_KINDS } from '../../shared/campaigns.ts';
import type { LinkTarget, SessionItem, SessionItemBase } from '../../shared/campaigns.ts';
import type { EncounterAdjustments } from '../../shared/types.ts';
import { ADD_FORMS } from '../../src/ui/gm/AddSheet.tsx';
import {
  COUNTDOWN_KIND_COLOR,
  LINK_KIND_LABEL,
  SESSION_KIND_COLOR,
  SESSION_KIND_LABEL,
  describeItem,
  linkName,
  newLink,
  newScene,
  sessionName,
  sessionTitle,
} from '../../src/ui/gm/session.ts';
import { NO_FIGHT, NO_CLOCK_PROSE } from '../fixtures/factories.ts';

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
    const item: SessionItem = { ...base({ name: 'The Sablewood Gate' }), kind: 'scene', environmentRef: null, ...NO_FIGHT };
    expect(sessionTitle(item)).toEqual({ text: 'The Sablewood Gate', invented: false });
  });

  it('stands the kind word in for an empty name, and says that it did', () => {
    // The flag is the whole point: `SessionItemBase.name` promises an empty
    // name stays empty, so the row has to be able to draw the substitute as a
    // substitute rather than write it back onto the record.
    const item: SessionItem = { ...base({ name: '   ' }), kind: 'scene', environmentRef: null, ...NO_FIGHT };
    expect(sessionTitle(item)).toEqual({ text: 'Scene', invented: true });
  });

  it('never hands a control an empty accessible name, on any arm', () => {
    const items: SessionItem[] = [
      { ...base({ name: '' }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ name: '' }), kind: 'encounter', roster: [], adjustments: { easier: false, harder: false, damageBump: false }, combatants: [] },
      { ...base({ name: '' }), kind: 'link', target: { kind: 'rule', ref: 'x' } },
      { ...base({ name: '' }), kind: 'countdown', primary: false, sceneId: null, countdown: { id: 'c', name: '', kind: 'standard', start: 4, value: 4, notes: '', ...NO_CLOCK_PROSE } },
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
    const item: SessionItem = { ...base(), kind: 'scene', environmentRef: environment.id, ...NO_FIGHT };
    expect(describe_(item)).toBe(environment.name.toUpperCase());
  });

  it('tells a scene with no environment apart from one this dataset cannot resolve', () => {
    const none: SessionItem = { ...base(), kind: 'scene', environmentRef: null, ...NO_FIGHT };
    const gone: SessionItem = { ...base(), kind: 'scene', environmentRef: 'a-layer-not-loaded', ...NO_FIGHT };
    expect(describe_(none)).toBe('NO ENVIRONMENT');
    // The two are different facts and the difference is the point: one is a
    // scene not yet placed, the other is a scene whose place this device has
    // not loaded. Collapsing them loses the second one entirely.
    expect(describe_(gone)).toBe('NOT IN THIS DATASET');
  });

  /*
   * The third term, decision 18. A scene row can hold a fight that has been
   * FOUGHT - parked out of the runner with every mark on it - and a shut plan
   * that did not say so would let a GM delete it without ever being told what
   * was inside.
   */
  it('counts a parked fight beside what the row plans, because they are two facts', () => {
    const fighter = {
      id: `${adversary.id}-0`,
      adversaryRef: adversary.id,
      name: adversary.name,
      hp: { max: 6, marked: 3 },
      stress: { max: 3, marked: 0 },
      thresholds: [4, 8] as [number, number],
      difficulty: 12,
      spotlighted: false,
      notes: '',
    };
    const item: SessionItem = {
      ...base(),
      kind: 'scene',
      environmentRef: environment.id,
      roster: [{ ref: adversary.id, count: 2 }],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [fighter, { ...fighter, id: `${adversary.id}-1` }],
    };
    expect(describe_(item)).toBe(`${environment.name.toUpperCase()} · 2 PLANNED · 2 PARKED`);
  });

  it('says PARKED on its own when the row plans nothing and has no place', () => {
    // Never "NO ENVIRONMENT · 1 PARKED": the row is not saying nothing, so the
    // clause that exists to fill an empty line does not fire.
    const item: SessionItem = {
      ...base(),
      kind: 'scene',
      environmentRef: null,
      roster: [],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [
        {
          id: `${adversary.id}-0`,
          adversaryRef: adversary.id,
          name: adversary.name,
          hp: { max: 6, marked: 0 },
          stress: { max: 3, marked: 0 },
          thresholds: [4, 8] as [number, number],
          difficulty: 12,
          spotlighted: false,
          notes: '',
        },
      ],
    };
    expect(describe_(item)).toBe('1 PARKED');
  });

  it('says nothing about a fight for the row that is being played', () => {
    // Resume EMPTIES the row it took the fight from, so a running scene reads
    // zero here and the plan never shows a stale number.
    const item: SessionItem = { ...base(), kind: 'scene', environmentRef: environment.id, ...NO_FIGHT };
    expect(describe_(item)).toBe(environment.name.toUpperCase());
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
      sceneId: null,
      countdown: { id: 'c', name: 'The ritual completes', kind: 'dynamic', start: 6, value, notes: '', ...NO_CLOCK_PROSE },
    });
    expect(describe_(at(4))).toBe('4/6');
    // Not "0/6". A spent countdown is the thing happening, and the board this
    // row mirrors already says so in that word.
    expect(describe_(at(0))).toBe('SPENT');
  });

  /*
   * The fifth parameter. It was the whole `session` array, and `describeItem`
   * did the lookup itself; it is the resolved name now, so that `SessionRow`
   * can select one string out of the store instead of subscribing to the list
   * - see the parameter's own docblock, which overturns the argument that put
   * the array there.
   *
   * These ask the function directly rather than through a mounted row, which
   * is what the whole of this file is for: the sentence is this module's, and
   * the lookup that feeds it is `sessionList.test.tsx`'s.
   */
  const scoped = (value: number, ownerName: string | null): string =>
    describeItem(
      {
        ...base(),
        kind: 'countdown',
        primary: false,
        sceneId: 's1',
        countdown: { id: 'c', name: 'The ritual', kind: 'standard', start: 6, value, notes: '', ...NO_CLOCK_PROSE },
      },
      dataset,
      index,
      PARTY,
      ownerName,
    );

  it('names the scene a scoped countdown belongs to, after the clock', () => {
    // A shut plan that did not say so would let a GM look at a clock they
    // cannot find on the glass with nothing anywhere to explain why.
    expect(scoped(4, 'The dungeon')).toBe('4/6 · THE DUNGEON');
    // And the word for zero does not stop being the word because of a scope.
    expect(scoped(0, 'The dungeon')).toBe('SPENT · THE DUNGEON');
  });

  it('says the clock and nothing else when there is no scene to name', () => {
    /*
     * Null arrives from two places and they share this branch on purpose: a
     * clock the campaign owns, and a scope pointing at a row that is gone. The
     * row says the same thing about both, because a placeholder for a scene
     * that is not there would be a second thing to keep in step.
     */
    expect(scoped(4, null)).toBe('4/6');
    expect(scoped(0, null)).toBe('SPENT');
  });

  it('prints the name it was handed rather than looking one up', () => {
    /*
     * The point of the parameter change, said as behaviour. The name is not
     * required to be a row's, is not checked against the dataset, and is not
     * re-derived here - so a caller that resolves `Scene` for a scene with no
     * name gets `SCENE`, which is the word that scene's own header draws.
     */
    expect(scoped(4, 'Scene')).toBe('4/6 · SCENE');
    expect(scoped(4, 'a room in no dataset')).toBe('4/6 · A ROOM IN NO DATASET');
  });

  it('is read by the countdown arm and by no other', () => {
    /*
     * Every other arm, not a sample of them. The title claims a property over
     * the whole switch, and it used to ask two of the six - so appending the
     * countdown arm's ` · ${ownerName}` to `note`, or to `url`, or to the arm
     * this app keeps precisely because it cannot read it, was a change no test
     * in this repo objected to.
     *
     * `SessionRow`'s selector returns `null` for everything that is not a
     * countdown, so nothing here is a shipped risk today. It is the sentence
     * that is at risk: the day a second arm is given a name to say, this is
     * where the decision has to be made deliberately instead of arriving.
     */
    const others: SessionItem[] = [
      { ...base(), kind: 'scene', environmentRef: environment.id, ...NO_FIGHT },
      { ...base(), kind: 'encounter', roster: [{ ref: adversary.id, count: 2 }], adjustments: ADJUSTMENTS, combatants: [] },
      { ...base(), kind: 'link', target: { kind: 'rule', ref: rule.id } },
      { ...base(), kind: 'url', href: 'https://a.example/' },
      { ...base(), kind: 'note', note: [{ type: 'paragraph', align: 'start', spans: [{ text: 'Rhys wants the cargo', bold: false, italic: false }] }] },
      { ...base(), kind: 'unreadable', why: 'this version of the app has no "photo" item', raw: '{"kind":"photo"}' },
    ];

    /*
     * The set is asserted rather than trusted. `SESSION_KIND_LABEL` is typed
     * `Record<SessionItem['kind'], string>`, so its keys are the whole union -
     * an eighth kind arriving fails here rather than leaving the title one arm
     * short in silence. `SESSION_ITEM_KINDS` would not do: it is what ADD
     * offers, which is five of the seven.
     */
    expect([...others.map((i) => i.kind), 'countdown'].sort()).toEqual(
      Object.keys(SESSION_KIND_LABEL).sort(),
    );

    for (const item of others) {
      expect(
        describeItem(item, dataset, index, PARTY, 'The dungeon'),
        `the ${item.kind} arm read a name that is not its own`,
      ).toBe(describeItem(item, dataset, index, PARTY));
    }
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

  it('offers exactly the kinds it has a form for, and never `unreadable`', () => {
    /*
     * The gap between `SESSION_ITEM_KINDS` and `SessionItem['kind']`, asserted
     * as a gap rather than as a list of names.
     *
     * What the menu is, exactly, is the kinds `ADD_FORMS` has a row for.
     * `AddSheet.tsx` types that record as `Record<SessionItemKind, …>`, so the
     * compiler already refuses a button with no form and a form with no button;
     * this is the same property at runtime and in the menu's own order, which
     * is what a cast or a record assembled by hand would get past.
     *
     * The old version spelled the four names out, and that is the defect it is
     * worth writing down. Two lanes are about to close half the gap each -
     * item 12's web link form and item 14's note editor - and whichever of them
     * merged second would have inherited a suite that was green and asserting a
     * list that was no longer true. This one follows a widening with no second
     * edit, because it never held the list in the first place.
     *
     * `unreadable` is the half of the gap that never closes: it is this build's
     * reading of bytes it could not parse, not a thing a GM adds, so a row for
     * it in `ADD_FORMS` would be a button offering to mint an unreadable item.
     * That is the one name still written here, and it is written as a name
     * because it is a permanent decision rather than a stage.
     */
    expect(Object.keys(ADD_FORMS)).toEqual([...SESSION_ITEM_KINDS]);

    // `SESSION_KIND_LABEL` is `Record<SessionItem['kind'], string>`, so its
    // keys are the union - the test above pins that it has all seven of them.
    const noForm = Object.keys(SESSION_KIND_LABEL).filter(
      (kind) => !(SESSION_ITEM_KINDS as readonly string[]).includes(kind),
    );
    expect(noForm).toContain('unreadable');

    for (const kind of SESSION_ITEM_KINDS) {
      expect(SESSION_KIND_LABEL[kind]).not.toBe('');
      // A row whose sentence is '' typechecks, and draws a choice with a label
      // and a blank line under it where the reason to press it should be.
      expect(ADD_FORMS[kind].what).not.toBe('');
    }
  });
});

describe('the rows ADD mints through a factory', () => {
  it('leaves the order to the store, which is the only thing that knows it', () => {
    // `addSessionItem` stamps `session.length`. A factory that also guessed
    // would be a second opinion about a number, and two rows at position 4.
    expect(newScene('The gate', null, { id: 's1' }).order).toBe(0);
    expect(newLink('A card', { kind: 'domainCard', ref: card.id }, 'l1').order).toBe(0);
  });

  it('mints every one of them closed', () => {
    // Open, the new row pushes the rest of the night off a 393px phone at the
    // moment it is added - and the GM has just typed everything it would show.
    expect(newScene('The gate', null, { id: 's1' }).collapsed).toBe(true);
    expect(newLink('A card', { kind: 'domainCard', ref: card.id }, 'l1').collapsed).toBe(true);
  });

  it('takes the id it is given, so a test never has to guess one', () => {
    expect(newScene('The gate', environment.id, { id: 's1' }).id).toBe('s1');
    expect(newScene('The gate', environment.id).id).not.toBe('');
  });

  it('keeps a name that is only spaces out of the record', () => {
    // `SessionItemBase.name` promises a name is never generated and an empty
    // one stays empty; `sessionTitle` is the other half, drawing the kind word
    // dimmed. Trimming is not generating, and '   ' left in would be a title
    // that renders as blank rather than as the word "Scene".
    const item = newScene('   ', null, { id: 's1' });
    expect(item.name).toBe('');
    expect(sessionTitle(item)).toEqual({ text: 'Scene', invented: true });
  });

  /*
   * These three moved from `newEncounter` to `newScene` at campaign schema 3
   * rather than being deleted with it. The properties are the factory's, not
   * the kind's: decision 1 moved the three fight fields onto the scene row, so
   * whatever used to be true of minting a fight has to stay true of minting a
   * scene that has one.
   */
  it('gives a new scene no fight in progress, because nothing could ever change one', () => {
    const item = newScene('The ambush', null, {
      roster: [{ ref: adversary.id, count: 3 }],
      adjustments: ADJUSTMENTS,
      id: 's1',
    });
    expect(item.kind === 'scene' && item.combatants).toEqual([]);
    expect(describe_(item)).toBe('3 PLANNED');
  });

  it('copies the roster it is handed rather than pointing at the board’s', () => {
    const roster = [{ ref: adversary.id, count: 2 }];
    const item = newScene('The ambush', null, { roster, adjustments: ADJUSTMENTS, id: 's1' });
    roster[0]!.count = 9;
    expect(item.kind === 'scene' && item.roster).toEqual([{ ref: adversary.id, count: 2 }]);
  });

  it('mints a scene with no fight at all when it is not given one', () => {
    // The common case: most rows of a night are a place somebody talks in.
    const item = newScene('The gate', null, { id: 's1' });
    expect(item.kind === 'scene' && item.roster).toEqual([]);
    expect(item.kind === 'scene' && item.combatants).toEqual([]);
  });
});
