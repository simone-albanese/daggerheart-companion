// @vitest-environment jsdom
/**
 * Does the button that erases everything say what "everything" is?
 *
 * `clearAll` opens one transaction over every object store and clears them,
 * and then About sweeps every `dhc.` key out of localStorage. The two sentences
 * a person reads before that happens named four of the five stores there were
 * then and counted one: the arming hint enumerated "every character, every
 * imported source, all art and every preference" with no campaign in the list,
 * and the armed confirmation counted characters and swept the rest into
 * "everything else this device holds". A campaign holds whole copies of other
 * people's sheets, so it is the one record on the device whose loss the owner
 * cannot repair alone.
 *
 * There are two stores now. Database version 3 deletes `layers`, `content` and
 * `art`, so the hint no longer names an imported source or art - not because
 * the sentence was shortened for room, but because a reset that promised to
 * delete them would be promising something about bytes the upgrade already
 * took. The test that used to hold those two words now holds their absence.
 *
 * Two numbers here are deliberately not the numbers already on the screen, and
 * that is most of what these tests are for:
 *
 *   - campaigns are counted with `countCampaigns` rather than
 *     `readCampaigns().campaigns.length`, because the reader holds a
 *     newer-build record out of that array and `clearAll` deletes it anyway;
 *   - characters are counted as `characters.length + quarantined.length` for
 *     exactly the same reason, in the same sentence.
 *
 * A count that undercounts the destruction is the defect being fixed, wearing
 * the fix's clothes. `tests/store/campaignDb.test.ts` pins the store half.
 *
 * The last describe here is about the other half of the promise: not what the
 * screen says it will erase, but what the handler erases. About sweeps by
 * prefix rather than by the list its docblock writes out, and the whole point
 * of that choice is a key nobody remembered to add - so one case runs the
 * handler with such a key present. It is the one case in this file that needs
 * the platform `localStorage` instead of `MemoryStorage`, for the reason it
 * states.
 *
 * What jsdom cannot see: none of this is a layout claim. The Note's 313px text
 * column and the 17.25px a wrapped line costs are argued in About.tsx's own
 * comment and were measured in Chrome, not here.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCampaign } from '../../shared/campaigns.ts';
import { putCampaign } from '../../src/store/campaigns.ts';
import { clearAll, db } from '../../src/store/db.ts';
import { useApp } from '../../src/store/state.ts';
import { About } from '../../src/ui/settings/About.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

/*
 * The one seam that is mocked, and why it is not the thing under test.
 *
 * About's `.catch` arm exists for a device whose storage refuses to answer -
 * private-mode Safari, a revoked quota - where the honest sentence names the
 * campaigns without counting them. There is no way to make `fake-indexeddb`
 * refuse a `count` on a connection `db.ts` has already cached, so the refusal
 * is injected at About's dependency rather than faked inside About. Every
 * other test in this file runs the real function through the same wrapper.
 */
const storage = vi.hoisted(() => ({ refuses: false }));
vi.mock('../../src/store/campaigns.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/store/campaigns.ts')>();
  return {
    ...actual,
    countCampaigns: async (): Promise<number> => {
      if (storage.refuses) throw new Error('The database would not open.');
      return actual.countCampaigns();
    },
  };
});

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  storage.refuses = false;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    dataset,
    index,
    characters: [],
    quarantined: [],
    activeId: null,
  });
  // The connection is cached in a module variable, so the store is emptied
  // through the app's own wipe rather than by a fresh factory.
  await clearAll();
  // `clearAll` is IndexedDB only - the localStorage sweep lives in About's own
  // handler - and the legacy-GM cases below write `dhc.gm.v1`. A fresh shim per
  // case, so a key set by one decides the sentence in no other, which is
  // exactly the contamination those cases exist to reason about.
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/**
 * The `dhc.` keys, in memory.
 *
 * Not a stand-in for a `localStorage` that is missing: this jsdom build has
 * one, and the last case in the file asserts that in so many words before it
 * uses it. The shim is here for isolation. `hasUncountedLegacyCampaign` reads
 * two keys the `campaigns` object store cannot see, and a fresh `Map` per case
 * is how a key one case writes stops deciding the sentence another case gets -
 * which is exactly the contamination those cases exist to reason about.
 *
 * It is also what keeps this file portable to a build where the platform
 * object really is absent: a Node whose jsdom hides `localStorage` still runs
 * every case here but the last, and that one states its precondition as an
 * assertion, so it fails saying why rather than passing against nothing.
 *
 * The same shim ten other test files install.
 */
class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

const text = (): string => container.textContent ?? '';

const button = (label: string): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (found === undefined) throw new Error(`no button reading "${label}"`);
  return found;
};

/** Let the mount effects' database reads land before anything is asserted. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const seedCampaigns = async (...names: string[]): Promise<void> => {
  let n = 0;
  for (const name of names) {
    n += 1;
    await putCampaign(newCampaign(name, '2026-08-01T12:00:00.000Z', `seed-${String(n)}`));
  }
};

async function renderAbout(): Promise<void> {
  await act(async () => {
    root.render(<About />);
  });
  await settle();
}

async function arm(): Promise<void> {
  await act(async () => {
    button('Reset everything').click();
  });
  await settle();
}

describe('the sentence read before the app is erased', () => {
  it('counts the campaigns it is about to destroy, not only the characters', async () => {
    await seedCampaigns('The Sablewood Winter', 'A one-shot');
    useApp.setState({ characters: [playedCharacter()] });

    await renderAbout();
    await arm();

    expect(
      text(),
      'the confirmation is silent about the campaigns the reset deletes, and a campaign ' +
        'holds copies of sheets that belong to other people',
    ).toContain('This erases 1 character, 2 campaigns and everything else this device holds.');
  });


  it('stops counting when a GM table is sitting outside the store it counts', async () => {
    /*
     * The count and the destruction have to describe the same set.
     *
     * `countCampaigns` reads the `campaigns` object store. `reset()` sweeps
     * every `dhc.` key, and the move of the GM's table out of localStorage runs
     * from `hydrateGm()` at module load of the lazily imported GM chunk - so an
     * upgraded install that has not opened the GM screen since still holds the
     * live fight, the Fear pool, every countdown and whole copies of the other
     * players' sheets in `dhc.gm.v1`, where the count cannot see them.
     *
     * Counted, that install reads "0 campaigns" over an irreversible control.
     * That is the same invention the storage-refused branch already refuses -
     * "inventing a zero here would be the app claiming there is nothing to
     * lose" - arriving by arithmetic instead of by error. So the sentence drops
     * to naming campaigns without counting them, which is true in every state.
     *
     * Not "1 campaign": this code has not parsed that blob, and in the
     * quarantine case it is the blob that is known not to parse.
     */
    localStorage.setItem('dhc.gm.v1', '{"fear":3}');
    useApp.setState({ characters: [playedCharacter()] });

    await renderAbout();
    await arm();

    expect(
      text(),
      'an unmigrated GM table was counted as zero campaigns in front of an irreversible control',
    ).toContain('This erases 1 character, every campaign on this device and everything else it holds.');
    expect(text()).not.toContain('0 campaigns');
  });

  it('says the same about a quarantined table, which the reset also deletes', async () => {
    // `dhc.gm.v1.unreadable` is kept rather than deleted by the migration, on
    // the argument that "nothing has been thrown away". The reset throws it
    // away, so the sentence in front of the reset has to allow for it.
    localStorage.setItem('dhc.gm.v1.unreadable', 'not json at all');
    useApp.setState({ characters: [playedCharacter()] });

    await renderAbout();
    await arm();

    expect(text()).toContain('every campaign on this device and everything else it holds');
    expect(text()).not.toContain('0 campaigns');
  });

  it('still counts normally when there is no legacy table to miss', async () => {
    // The guard must not swallow the count it was added to protect: with no
    // legacy key present this is the ordinary path and the number is the point.
    await seedCampaigns('The Sablewood Winter');
    useApp.setState({ characters: [playedCharacter()] });

    await renderAbout();
    await arm();

    expect(text()).toContain('This erases 1 character, 1 campaign and everything else this device holds.');
  });

  it('keeps the consequence sentence that says a backup is the only way back', async () => {
    // Unchanged, verbatim, and worth pinning: the first sentence was rewritten
    // around it and this is the half that tells a person what to do about it.
    await renderAbout();
    await arm();

    expect(text()).toContain(
      'Export a backup first if there is any doubt — that file is the only thing that can bring it back.',
    );
  });

  it('inflects one character and one campaign as singulars', async () => {
    await seedCampaigns('Only one');
    useApp.setState({ characters: [playedCharacter()] });

    await renderAbout();
    await arm();

    expect(text()).toContain('This erases 1 character, 1 campaign and');
    expect(text(), 'a confirmation that cannot count to one is not one to trust').not.toContain(
      '1 campaigns',
    );
  });

  it('counts a campaign this build refuses to read, because the reset deletes it anyway', async () => {
    /*
     * The quarantine is deliberate: a campaign written by a newer build is
     * held out of `readCampaigns().campaigns` rather than rendered and written
     * over. `clearAll` clears the store wholesale and takes it regardless, so
     * the honest number is the record count and not the readable count.
     *
     * This is the assertion that fails if About is wired to the list the GM
     * screen already has in memory instead of to `countCampaigns`.
     */
    await seedCampaigns('Readable');
    // Past the type system, the way another build would have written it.
    await (
      await db()
    ).put('campaigns', {
      id: 'c-ahead',
      name: 'Written by a newer build',
      schemaVersion: 99,
    } as never);

    await renderAbout();
    await arm();

    expect(text(), 'the confirmation promises to erase fewer campaigns than it erases').toContain(
      '2 campaigns and everything else this device holds',
    );
  });

  it('re-reads the count when the panel is armed, not once when the screen mounted', async () => {
    /*
     * There is no `BroadcastChannel` and no `storage` listener anywhere in
     * `src/`, so nothing tells this screen that a second tab on the GM screen
     * has just made a campaign. A number read at mount and printed minutes
     * later is a number that can be wrong at the only moment it matters, which
     * on this particular sentence is the failure the control exists not to
     * have. Arming re-reads.
     */
    await seedCampaigns('One', 'Two');
    await renderAbout();

    await putCampaign(newCampaign('From another tab', '2026-08-02T12:00:00.000Z', 'late'));

    await arm();

    expect(text(), 'the count was taken at mount and has been stale ever since').toContain(
      '3 campaigns and everything else this device holds',
    );
  });

  it('counts the character records this build cannot read, which the reset also deletes', async () => {
    /*
     * `AppState.characters` is the readable half of the library; `quarantined`
     * is the records a newer build wrote, which this build leaves untouched
     * and `clearAll` destroys. The character number in this sentence had the
     * same undercount the campaign number is being fixed for.
     */
    useApp.setState({
      characters: [playedCharacter()],
      quarantined: [
        {
          id: 'ch-ahead',
          name: 'Written by a newer build',
          schemaVersion: 99,
          reason: 'That character was saved by a newer version of the app.',
        },
      ],
    });

    await renderAbout();
    await arm();

    expect(text(), 'the confirmation promises to erase fewer characters than it erases').toContain(
      'This erases 2 characters,',
    );
  });

  it('names the campaigns without a number when storage will not answer', async () => {
    // Inventing a zero here would be the app saying there is nothing to lose
    // on the one screen where that is the most expensive thing it could say.
    storage.refuses = true;
    useApp.setState({ characters: [playedCharacter()] });

    await renderAbout();
    await arm();

    expect(text()).toContain(
      'This erases 1 character, every campaign on this device and everything else it holds.',
    );
    expect(text(), 'a refused read must not read as an empty device').not.toContain('0 campaigns');
  });
});

describe('the list read before the button is armed', () => {
  it('enumerates the campaigns along with the other four stores', async () => {
    /*
     * This string is a list, and it is the one read first - before anything is
     * armed and while the reset is still an idea. It named four of the five
     * stores `clearAll` empties, so a reader who stopped here was told the
     * wrong thing about what they were about to lose.
     *
     * No number: the hint enumerates categories and the confirmation above
     * counts records, which is already how the two sentences divide the work.
     */
    await renderAbout();

    expect(
      text(),
      'the list of what the reset deletes leaves out the store holding other tables',
    ).toContain(
      'Deletes every character, every campaign and every preference on this device.',
    );
  });

  it('still says there is no undo and no copy anywhere else', async () => {
    // The second half of the hint is unchanged, and it is the half that says
    // the consequence rather than the contents.
    await renderAbout();
    expect(text()).toContain('There is no undo and no copy anywhere else.');
  });
});

describe('the sweep the button actually performs', () => {
  it('takes a `dhc.` key nobody told it about, and leaves the rest of the origin alone', async () => {
    /*
     * `reset()`'s docblock lists the localStorage keys and then says the list is
     * there to be read rather than iterated, because a list written out in code
     * is how the *next* key survives the button that promises to remove
     * everything. `dhc.gm.countdownTemplates.v1` is now that next key: it
     * arrived with the countdown template shelf, it is named nowhere in the
     * handler, and the docblock claims the prefix sweep took it anyway. That is
     * a claim about code that runs, so it is proved by running it.
     *
     * The real `localStorage` rather than `MemoryStorage`, and this is the one
     * case in the file that needs it. The sweep iterates `Object.keys(
     * localStorage)`, which works on the real one because `Storage` exposes its
     * entries as named properties; on the shim - a private `Map` behind four
     * methods - `Object.keys` returns *the methods*, so a sweep run against it
     * would remove nothing and pass anything. A shim standing in for the object
     * under test is how a proof becomes decoration.
     *
     * `location.reload` is the last line of the handler and jsdom refuses to
     * navigate. The refusal lands after the sweep, in the browser's own
     * console, and changes nothing that is asserted here.
     */
    vi.unstubAllGlobals();
    expect(
      typeof globalThis.localStorage,
      'this case needs the platform Storage rather than the Map shim, because the ' +
        'sweep it proves reads `Object.keys(localStorage)`',
    ).toBe('object');
    localStorage.clear();
    localStorage.setItem('dhc.gm.countdownTemplates.v1', '[{"id":"t","name":"The tide turns"}]');
    // The control: a key the docblock does name. If this survived, the sweep
    // did not run at all and the assertion below would be proving nothing.
    localStorage.setItem('dhc.gm.v1', '{"fear":3}');
    // Not ours, and the sweep is a prefix and not a `clear()`: a reset that
    // emptied the whole origin would take another app's key off this device.
    localStorage.setItem('unrelated.v1', 'someone else’s');

    await renderAbout();
    await arm();

    const field = container.querySelector<HTMLInputElement>(
      'input[aria-label="Type ERASE to confirm"]',
    )!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(field, 'ERASE');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      button('Erase everything').click();
    });
    /*
     * `reset()` is a promise chain over IndexedDB and hands back no handle, so
     * the wait is on a signal rather than on a count of turns. A fixed number
     * of turns is what this case had first, and it passed alone and failed in
     * the full suite: `clearAll` takes as many turns of the loop as a loaded
     * machine makes it take.
     *
     * `dhc.gm.v1` is the signal because it is a key the handler *is* told
     * about, so it goes the moment the sweep runs at all, however the sweep is
     * written. Every mutation of the sweep still fails below rather than
     * spinning here: a handler that iterates the written-out list removes this
     * key too, and one that calls `clear()` removes everything.
     */
    for (let turn = 0; turn < 200 && localStorage.getItem('dhc.gm.v1') !== null; turn += 1) {
      await settle();
    }

    expect(
      localStorage.getItem('dhc.gm.countdownTemplates.v1'),
      'the reset kept a key it was never told about, which is the failure the prefix sweep exists to prevent',
    ).toBeNull();
    expect(localStorage.getItem('dhc.gm.v1')).toBeNull();
    expect(
      localStorage.getItem('unrelated.v1'),
      'the reset emptied the whole origin rather than its own prefix',
    ).toBe('someone else’s');

    localStorage.clear();
  });
});
