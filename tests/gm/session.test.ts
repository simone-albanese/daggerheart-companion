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
import type { LinkTarget, SessionItem, SessionItemBase } from '../../shared/campaigns.ts';
import {
  COUNTDOWN_KIND_COLOR,
  LINK_KIND_LABEL,
  SESSION_KIND_LABEL,
  describeItem,
  linkName,
  sessionName,
  sessionTitle,
} from '../../src/ui/gm/session.ts';

const dataset = baseDataset;
const index = indexDataset(baseDataset);

const base = (patch: Partial<SessionItemBase> = {}): SessionItemBase => ({
  id: 'i1',
  name: 'A row',
  order: 0,
  collapsed: true,
  ...patch,
});

const describe_ = (item: SessionItem): string => describeItem(item, dataset, index);

const environment = dataset.environments[0]!;
const adversary = dataset.adversaries[0]!;
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
    expect(describe_(item)).toBe('4 PLANNED');
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
    // did not write '' into one of the cells while adding the fifth arm.
    for (const value of [...Object.values(SESSION_KIND_LABEL), ...Object.values(LINK_KIND_LABEL), ...Object.values(COUNTDOWN_KIND_COLOR)]) {
      expect(value).not.toBe('');
    }
    expect(Object.keys(SESSION_KIND_LABEL)).toHaveLength(5);
    expect(Object.keys(LINK_KIND_LABEL)).toHaveLength(5);
  });
});
