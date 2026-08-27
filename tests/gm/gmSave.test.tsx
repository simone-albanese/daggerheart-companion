// @vitest-environment jsdom
/**
 * SAVE, now that the file it writes can come back in.
 *
 * The sheet used to carry a paragraph saying no build could read a
 * `.dhcampaign`, and that sentence was the honest thing to print while it was
 * true. It is not any more, so the first thing asserted here is its absence -
 * a retracted claim left on a screen is worse than the gap it filled, because
 * a GM who reads it will not look for the button that is right underneath it.
 *
 * The rest is the door itself, mounted in the sheet where a GM meets it: a
 * file goes in, a campaign comes out, and every repair the reader made is on
 * the screen in the reader's own words. `campaignImport.test.ts` decides what
 * *becomes* of the record; this file is about what is said about it.
 */
import 'fake-indexeddb/auto';
import { StrictMode, act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SCHEMA_VERSION,
  newCampaign,
  type Campaign,
  type SessionItem,
} from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import {
  campaignChecksum,
  parseCampaignFile,
  serializeCampaign,
} from '../../src/transfer/campaignFile.ts';
import * as fileIo from '../../src/transfer/fileIo.ts';
import * as campaignImport from '../../src/store/campaignImport.ts';
import { getCampaign } from '../../src/store/campaigns.ts';
import { SaveSheet } from '../../src/ui/gm/SaveSheet.tsx';
import * as gmStore from '../../src/ui/gm/gmStore.ts';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const EXPORTED_AT = new Date('2026-08-16T10:00:00.000Z');
const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

let baseCampaigns: Campaign[] = [];
let baseActiveId: string | null = null;
let container: HTMLDivElement;
let root: Root;

const clock = (id: string, sceneId: string | null, order: number): SessionItem => ({
  id,
  kind: 'countdown',
  name: 'The ice gives way',
  order,
  collapsed: false,
  primary: false,
  sceneId,
  countdown: {
    id,
    name: 'The ice gives way',
    kind: 'standard',
    start: 6,
    value: 4,
    notes: '',
    activation: '',
    advancement: '',
    effect: '',
    owner: '',
    beats: [],
  },
});

const arriving = (id: string, name = 'The Sablewood Winter'): Campaign => ({
  ...newCampaign(name, '2026-02-01T19:30:00.000Z', id),
  updatedAt: THREE_HOURS_AGO,
  fear: 7,
  session: [clock('i1', null, 0)],
});

/** An envelope round a payload no exporter would have written. */
const envelope = (payload: unknown): string =>
  JSON.stringify({
    format: 'dhcampaign',
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    app: '0.6.0',
    exportedAt: EXPORTED_AT.toISOString(),
    checksum: campaignChecksum(payload as Campaign),
    campaign: payload,
  });

const picks = (text: string): ReturnType<typeof vi.spyOn> =>
  vi.spyOn(fileIo, 'pickFile').mockResolvedValue({
    name: 'a-table.dhcampaign',
    text,
    file: new File([text], 'a-table.dhcampaign'),
  }) as ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  await hydrateGm();
  baseCampaigns = useGm.getState().campaigns;
  baseActiveId = useGm.getState().activeCampaignId;
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({ ready: true, prefs: { ...DEFAULT_PREFS } });
  useGm.setState({
    hydrated: true,
    writeError: null,
    writeRetry: null,
    campaigns: baseCampaigns,
    activeCampaignId: baseActiveId,
    notices: [],
    quarantined: [],
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const sheet = (): void => {
  act(() => root.render(createElement(SaveSheet)));
};

const text = (): string => container.textContent ?? '';
const paragraphs = (): string[] =>
  [...container.querySelectorAll('p')].map((p) => (p.textContent ?? '').trim());
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const alert = (): string => {
  const found = container.querySelector('[role="alert"]');
  if (found === null) throw new Error(`nothing is alerting. On screen: ${text()}`);
  return (found.textContent ?? '').trim();
};
/**
 * What the parser says about a file, in the parser's own words.
 *
 * Taken from the throw rather than written out here, so that these tests assert
 * the screen prints what the format refused with - not that it prints whatever
 * this file happened to expect. A refusal reworded on the way to the glass is
 * the defect: one of these sentences carries the only remedy the GM is ever
 * offered, and a softer paraphrase of it would be a dead end.
 */
const said = (file: string): string => {
  try {
    parseCampaignFile(file);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('that file was supposed to be refused, and was not');
};
const named = (label: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim() === label);
  if (found === undefined) {
    throw new Error(
      `no control called "${label}". Here: ${buttons()
        .map((b) => (b.textContent ?? '').trim())
        .join(' | ')}`,
    );
  }
  return found;
};
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

async function settle(turns = 8): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe('the paragraph that is no longer true', () => {
  it('does not say a campaign file cannot be read back in', async () => {
    // The sentence this replaces was asserted, word for word, by a test that
    // was right at the time. Its absence is asserted here because a screen that
    // still said it would be telling a GM not to press the button below it.
    sheet();
    await settle();
    expect(text()).not.toContain('read a campaign file back in');
    expect(text()).not.toContain('that part is not written yet');
  });

  it('offers the door in its place, with what it does above it', async () => {
    sheet();
    await settle();
    expect(named('OPEN A CAMPAIGN FILE')).toBeDefined();
    expect(text()).toContain('never writes over one that is already here');
  });
});

describe('a file that lands', () => {
  it('names the campaign, and the sheet is now about that campaign', async () => {
    const file = arriving('c-landing-1', 'The Sablewood Winter');
    picks(serializeCampaign(file, EXPORTED_AT));
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();
    expect(text()).toContain('Nothing on this device has that campaign');

    click(named('BRING IT IN'));
    await settle();

    expect(text()).toContain('"The Sablewood Winter" is on this device and open.');
    expect(useGm.getState().activeCampaignId).toBe('c-landing-1');
    // The sheet above the door is now about the campaign that just arrived:
    // its file name, and the stamp of the write the file itself carried.
    expect(text()).toContain('the-sablewood-winter.dhcampaign');
    expect(text()).toContain('3 hr ago');
  });

  it('says the copy landed beside what was here, when the id was taken', async () => {
    const mine = useGm.getState().campaigns[0]!;
    const file = { ...arriving(mine.id, 'A table from elsewhere'), createdAt: mine.createdAt };
    picks(serializeCampaign(file, EXPORTED_AT));
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();
    expect(text()).toContain('carry the same id');

    click(named('BRING IT IN'));
    await settle();

    expect(text()).toContain('has been added beside it');
    expect(text()).toContain('REMOVE in MENU takes either one away');
    expect(useGm.getState().activeCampaignId).not.toBe(mine.id);
  });
});

describe('an id this tab still holds that the disk has lost', () => {
  /*
   * The worst thing this door could do, end to end.
   *
   * A second tab's REMOVE - or the storage eviction the backup lane exists for
   * - takes a record off the disk while this tab keeps it in `state.campaigns`
   * and keeps its board open. Nothing tells this tab: `grep` finds no
   * `BroadcastChannel`, no `storage` listener and no re-hydrate on `visible`,
   * and `hydrateGm` is memoized so it never reads twice.
   *
   * Bring that campaign's own backup in there and `addCampaign` says `'added'`,
   * because the key really is free. The restore lands under the id the board is
   * open on, `switchCampaign` early-returns on `id === activeCampaignId` so the
   * board never moves, the sentence says it is open anyway - and the next flush
   * gathers the stale board straight over the record that was just restored.
   *
   * The campaign below is in memory and has never been on the disk, which is
   * that state exactly.
   */
  const ghost = (): Campaign => ({
    ...newCampaign('The Sablewood Winter', '2026-02-01T19:30:00.000Z', 'campaign-from-gm-v1'),
    updatedAt: THREE_HOURS_AGO,
  });

  it('restores it beside the open board instead of under it', async () => {
    const open = ghost();
    useGm.setState({
      campaigns: [open, ...baseCampaigns],
      activeCampaignId: open.id,
      fear: 2,
      session: [],
    });
    const file = { ...arriving(open.id, 'The Sablewood Winter'), session: [clock('i1', null, 0)] };
    picks(serializeCampaign(file, EXPORTED_AT));
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();
    click(named('BRING IT IN'));
    await settle();

    // It came in as a second campaign, under a new id and a minted name.
    const landedId = useGm.getState().activeCampaignId;
    expect(landedId).not.toBe(open.id);
    expect(text()).toContain('has been added beside it');
    expect(
      useGm.getState().campaigns.filter((c) => c.id === open.id),
      'the open board’s row was replaced by the import',
    ).toHaveLength(1);

    // And the board really is the restored one, rather than a green sentence
    // over a board that never moved.
    expect(useGm.getState().fear).toBe(7);
    expect(useGm.getState().session).toHaveLength(1);

    /*
     * The half that destroys the evening: a change on the board after the
     * import, flushed. Under the defect this writes the pre-import board -
     * Fear 2, no plan rows - over the record that has just been restored.
     */
    act(() => {
      useGm.getState().nudgeFear(1);
    });
    await act(async () => {
      await gmStore.flushGm();
    });
    const back = await getCampaign(landedId!);
    expect(back?.fear).toBe(8);
    expect(back?.session, 'the restored plan was written over').toHaveLength(1);
  });

  it('cannot put two rows under one id, whatever the decision upstream says', async () => {
    /*
     * The door's own half of the same guarantee, asserted without the module
     * that makes it true. `applyCampaignImport` refuses to hand back an id that
     * is already in `state.campaigns`, so this outcome is not reachable through
     * the app - and a blind prepend is exactly what turns the day that stops
     * being true into two rows under one key, one of which `switchCampaign`
     * cannot open and `writeActive` writes over.
     */
    const open = baseCampaigns[0]!;
    const file = arriving(open.id, 'A table from elsewhere');
    picks(serializeCampaign(file, EXPORTED_AT));
    vi.spyOn(campaignImport, 'applyCampaignImport').mockResolvedValue({
      kind: 'landed',
      campaign: { ...file, name: 'A table from elsewhere' },
      asCopy: false,
      renamedFrom: null,
      warnings: [],
    });
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();
    click(named('BRING IT IN'));
    await settle();

    expect(useGm.getState().campaigns.filter((c) => c.id === open.id)).toHaveLength(1);
    expect(useGm.getState().campaigns[0]?.name).toBe('A table from elsewhere');
  });
});

describe('the door under StrictMode, which is every dev build', () => {
  it('reaches the preview instead of freezing on READING THE FILE…', async () => {
    /*
     * `main.tsx` is verbatim `createRoot(root).render(<StrictMode><App/></
     * StrictMode>)`, and `SaveSheet` renders `TakeIn` inside it - so this is not
     * a contrived wrapper, it is the only way the door is ever mounted in
     * `npm run dev`.
     *
     * StrictMode mounts, unmounts and remounts on the first render. `alive` is
     * a ref rather than a closure, so it outlives all three: without the re-arm
     * the first cleanup sets it false for the life of the component, `settle`
     * stops doing anything, and `open()` - which sets `reading` directly and
     * leaves it only through `settle` - strands the door on READING THE FILE…,
     * disabled, with nothing able to take it out again.
     *
     * `useRetry.ts` argues no test of this is possible because "jsdom does not
     * reproduce the double mount here". It does; this is the measurement.
     */
    const seen: string[] = [];
    function Probe(): null {
      useEffect(() => {
        seen.push('setup');
        return () => {
          seen.push('cleanup');
        };
      }, []);
      return null;
    }
    act(() => {
      root.render(createElement(StrictMode, null, createElement(Probe)));
    });
    expect(seen, 'this jsdom does not double-mount, so the case below proves nothing').toEqual([
      'setup',
      'cleanup',
      'setup',
    ]);

    picks(serializeCampaign(arriving('c-strict-1'), EXPORTED_AT));
    act(() => {
      root.render(createElement(StrictMode, null, createElement(SaveSheet)));
    });
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();

    expect(text()).toContain('Nothing on this device has that campaign');
    expect(named('BRING IT IN').disabled).toBe(false);
  });
});

describe('an id held by a record this build must not touch', () => {
  it('does not promise a REMOVE that MENU cannot draw for it', async () => {
    /*
     * `addCampaign` answers `'taken'` for a record a newer build wrote - `add`
     * sees raw keys and does not care whether this build could read what is
     * there - so `asCopy` is true here exactly as it is for an ordinary
     * collision. The two are not the same on the screen: MENU's rows come from
     * `useGm.campaigns`, which cannot see a quarantined record, and it draws
     * that record as text in LEFT UNTOUCHED with no REMOVE beside it. Even with
     * a row, `deleteCampaign` throws `StaleBuildError` on it.
     *
     * So the generic sentence pointed at a control that is not on that sheet,
     * over a record the preview had promised two taps earlier not to touch.
     */
    const db = await import('../../src/store/db.ts');
    const ahead = {
      id: 'c-ahead-1',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1,
      name: 'Written by a newer build',
    };
    await (await db.db()).put('campaigns', ahead as unknown as Campaign);
    useGm.setState({
      quarantined: [
        {
          id: ahead.id,
          name: ahead.name,
          schemaVersion: ahead.schemaVersion,
          reason: 'That campaign was written by a newer version of the app.',
        },
      ],
    });

    picks(serializeCampaign(arriving(ahead.id, 'The Sablewood Winter'), EXPORTED_AT));
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();
    expect(text()).toContain('this build must not touch it');

    click(named('BRING IT IN'));
    await settle();

    /*
     * The result sentence and nothing else. RESTING is back on the sheet by
     * now and carries "takes either one away" as generic copy for the ordinary
     * case, which is a different sentence about a different situation - a
     * whole-container match here would be reading it instead.
     */
    const landedSaid = (container.querySelector('[role="status"]')?.textContent ?? '').trim();
    expect(landedSaid).toContain('REMOVE in MENU takes the copy away');
    expect(landedSaid).toContain('is not in the list');
    expect(landedSaid).not.toContain('takes either one away');
    // And it really is the copy path, with the record left exactly as it is.
    expect(useGm.getState().activeCampaignId).not.toBe(ahead.id);
    expect(await (await db.db()).get('campaigns', ahead.id)).toEqual(ahead);
  });
});

describe('a picker the GM closed', () => {
  it('says nothing at all, and changes nothing', async () => {
    /*
     * Cancelling is not an error and not an import - it is nothing having
     * happened, and nothing having happened has no sentence. The failure this
     * kills is a `null` from the picker taking the refused branch, which would
     * put a red alert on the screen for a GM who simply changed their mind.
     */
    const before = useGm.getState().campaigns.length;
    vi.spyOn(fileIo, 'pickFile').mockResolvedValue(null);
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(text()).not.toContain('BRING IT IN');
    expect(named('OPEN A CAMPAIGN FILE').disabled).toBe(false);
    expect(useGm.getState().campaigns).toHaveLength(before);
  });
});

describe('the reader’s repairs, on the screen in the reader’s own words', () => {
  it('prints every one of them on its own line, and never a count of them', async () => {
    /*
     * Kills counting instead of naming. Among these sentences is the one that
     * says a player's sheet will not be on the board and which player it was;
     * "2 warnings" is that fact rendered as a number, which is the failure the
     * campaigns store was written against.
     *
     * The strings are not written out here. They are taken from the parser, so
     * that this asserts the screen shows what the reader said rather than
     * whatever this test happened to expect it to say.
     */
    const damaged = {
      ...arriving('c-warned-1'),
      // A clock scoped to a scene row that is not in the list, and a party row
      // whose sheet the board could not draw. Two different repairs, from two
      // different passes of the reader.
      session: [clock('i1', 's-gone', 0)],
      party: [
        {
          id: 'pc-1',
          sheet: { name: 'Ilya of the Ninth', schemaVersion: CAMPAIGN_SCHEMA_VERSION },
          importedAt: '2026-07-04T18:02:00.000Z',
          source: 'file',
          tracks: { hp: 0, stress: 0, hope: 2, armor: 0 },
          markedAt: null,
        },
      ],
    };
    const said = parseCampaignFile(envelope(damaged)).warnings;
    expect(said.length, 'this file was supposed to need two repairs').toBeGreaterThan(1);

    picks(envelope(damaged));
    sheet();
    await settle();
    click(named('OPEN A CAMPAIGN FILE'));
    await settle();

    const shown = paragraphs().filter((p) => said.includes(p));
    expect(shown).toEqual(said);
    expect(text()).not.toMatch(/\b\d+ (?:warnings?|repairs?|problems?)\b/);
    // One of them names the player whose sheet is not coming, which is the
    // whole reason these are the loudest thing on the screen.
    expect(shown.join(' ')).toContain('Import that character again');

    // And they are repeated under the result, because they have stopped being
    // facts about a file and become facts about a campaign the GM is holding.
    click(named('BRING IT IN'));
    await settle();
    expect(paragraphs().filter((p) => said.includes(p))).toEqual(said);
  });
});

describe('the door while the device has not answered', () => {
  it('is shut, and says which of the two reasons it is', async () => {
    useGm.setState({ hydrated: false });
    sheet();
    await settle();
    expect(named('OPEN A CAMPAIGN FILE').disabled).toBe(true);
    expect(text()).toContain('This device is still being read.');

    act(() => {
      useGm.setState({ hydrated: true, writeRetry: 'read' });
    });
    expect(named('OPEN A CAMPAIGN FILE').disabled).toBe(true);
    // The whole sentence, because the half of it that is worth anything is the
    // half that names the control which reads the device again.
    expect(text()).toContain(
      'This device’s storage could not be read, so nothing can be brought in yet. TRY AGAIN above reads it again.',
    );
  });
});

describe('a file the format will not have', () => {
  it('prints the parser’s own sentence, and adds the other door for a character file', async () => {
    /*
     * A `.dhchar` in this picker is the one wrong file a GM will actually pick,
     * and it is not a mistake about the app - it is a mistake about which door.
     * The parser cannot know there is another one, so this is the single
     * sentence the screen is allowed to add to a refusal, and the test above
     * this one is what keeps "allowed to add one" from becoming "adds one to
     * everything".
     */
    const character = JSON.stringify({ format: 'dhchar', schemaVersion: 1, character: {} });
    picks(character);
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();

    expect(alert()).toBe(`${said(character)} Characters come in through Settings.`);
    expect(alert()).toContain('not a Daggerheart campaign');
    // The door is the retry, so it comes back open rather than spent.
    expect(named('OPEN A CAMPAIGN FILE').disabled).toBe(false);
    expect(useGm.getState().campaigns).toHaveLength(baseCampaigns.length);
  });

  it('adds nothing at all to a campaign file from a newer build', async () => {
    /*
     * The control, and the one that matters most: this refusal carries its own
     * remedy - update the app, then open it again, it has not been changed -
     * and a screen that paraphrased it, softened it or appended to it would be
     * taking the only actionable sentence in the set and making it advice.
     */
    const ahead = JSON.stringify({
      format: 'dhcampaign',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1,
      checksum: 0,
      campaign: {},
    });
    picks(ahead);
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();

    expect(alert()).toBe(said(ahead));
    expect(alert()).toMatch(/newer version of the app.*Update the app/s);
  });

  it('says a damaged file is damaged, in the words that say nothing was imported', async () => {
    const damaged = JSON.stringify({
      ...JSON.parse(serializeCampaign(arriving('c-damaged-1'), EXPORTED_AT)),
      checksum: 1,
    });
    picks(damaged);
    sheet();
    await settle();

    click(named('OPEN A CAMPAIGN FILE'));
    await settle();

    expect(alert()).toBe(said(damaged));
    expect(useGm.getState().campaigns).toHaveLength(baseCampaigns.length);
  });
});

describe('BRING IT IN, when something under it breaks its own promise', () => {
  /*
   * `applyCampaignImport` returns an outcome in every branch, and its own
   * docblock says so - but that is a promise another module can break without
   * this one being edited, and the `await` on it was the only verb in the block
   * with no `catch`. What that costs is measured rather than argued: the door
   * sticks on BRINGING IT IN… with both controls disabled, no `role="alert"` at
   * all, and the rejection becomes nobody's.
   *
   * The same argument the `unreadable` shape makes for `hydrateGm`, one verb
   * along. The nullish rejection that made it reachable is pinned in
   * `campaignImport.test.ts`; this pins the net under it.
   */
  const unhandledFree = async (run: () => Promise<void>): Promise<void> => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      await run();
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  };

  it('says the write failed and gives the controls back, rather than sticking', async () => {
    await unhandledFree(async () => {
      picks(serializeCampaign(arriving('c-rejecting-1'), EXPORTED_AT));
      vi.spyOn(campaignImport, 'applyCampaignImport').mockRejectedValue(
        new Error('the decision threw'),
      );
      sheet();
      await settle();

      click(named('OPEN A CAMPAIGN FILE'));
      await settle();
      click(named('BRING IT IN'));
      await settle();

      expect(alert()).toContain('could not be written');
      expect(alert()).toContain('the decision threw');
      expect(alert()).toContain('OPEN A CAMPAIGN FILE tries again');
      expect(named('OPEN A CAMPAIGN FILE').disabled).toBe(false);
    });
  });

  it('does not print "could not be written" over a campaign that is on the disk', async () => {
    /*
     * The other half, and the reason the catch stops short of the post-landing
     * leg. `applyCampaignImport` has read the record back off the disk by the
     * time `switchCampaign` runs; a failure there is a board that did not move,
     * which is a worse sentence than the campaign not existing would be - but
     * it is not a lost campaign and must not be printed as one.
     */
    await unhandledFree(async () => {
      const file = arriving('c-landed-then-threw-1', 'A table from elsewhere');
      picks(serializeCampaign(file, EXPORTED_AT));
      // Restored by hand: `beforeEach` reseeds the data on this store, not its
      // actions, so a broken one left behind would be a landmine for every
      // test after this in the file.
      const real = useGm.getState().switchCampaign;
      useGm.setState({
        switchCampaign: () => Promise.reject(new Error('the swap threw')),
      });
      try {
        sheet();
        await settle();

        click(named('OPEN A CAMPAIGN FILE'));
        await settle();
        click(named('BRING IT IN'));
        await settle();

        expect(text()).toContain('is on this device and open.');
        expect(container.querySelector('[role="alert"]')).toBeNull();
        expect(await getCampaign(file.id), 'and it really is on the disk').not.toBeNull();
      } finally {
        useGm.setState({ switchCampaign: real });
      }
    });
  });
});

describe('the store refusing to open underneath the press', () => {
  it('says so and leaves the door open, rather than reading the file for ever', async () => {
    /*
     * `hydrateGm` can reject - `migrateLegacyGmState` is awaited outside its own
     * `try`. Without the catch this asserts, the door is left reading READING
     * THE FILE…, disabled, with nothing in the component able to take it out of
     * that state again, and the rejection goes on to be nobody's: a spinner
     * that never stops over an outcome the GM cannot find out.
     */
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      vi.spyOn(gmStore, 'hydrateGm').mockRejectedValue(new Error('the legacy move threw'));
      sheet();
      await settle();

      click(named('OPEN A CAMPAIGN FILE'));
      await settle();

      expect(alert()).toContain('could not be read');
      expect(alert()).toContain('OPEN A CAMPAIGN FILE tries again');
      expect(named('OPEN A CAMPAIGN FILE').disabled).toBe(false);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
