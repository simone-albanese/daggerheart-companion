// @vitest-environment jsdom
/**
 * Does the button that erases everything say what "everything" is?
 *
 * `clearAll` opens one transaction over all five object stores and clears them
 * - characters, campaigns, layers, content, art - and then About sweeps every
 * `dhc.` key out of localStorage. The two sentences a person reads before that
 * happens named four of the five and counted one: the arming hint enumerated
 * "every character, every imported source, all art and every preference" with
 * no campaign in the list, and the armed confirmation counted characters and
 * swept the rest into "everything else this device holds". A campaign holds
 * whole copies of other people's sheets, so it is the one record on the device
 * whose loss the owner cannot repair alone.
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

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
