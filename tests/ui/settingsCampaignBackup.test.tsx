// @vitest-environment jsdom
/**
 * A GM who runs the table and plays nobody, on the settings screen.
 *
 * Settings' backup panel learned about campaigns in this lane - the button
 * stopped being greyed out for a device with campaigns and no characters, and
 * the sentence beside it started counting them - and neither line had a test.
 * Reverting both was clean under `tsc` (there is no `noUnusedLocals` and no
 * lint step) and passed the whole suite: two other Settings suites already
 * render this screen with `characters: []`, but neither seeds a campaign and
 * neither looks at the button, so both branches agree there.
 *
 * The campaigns are published through `publishCampaignSource`, which is the
 * same seam the screen reads and the same one `runBackup` writes from - not
 * `countCampaigns`, which also counts records a newer build wrote and which
 * this backup cannot take.
 *
 * The middle case is the one that stops this file passing a "gate deleted
 * entirely" mutant: a device holding nothing at all still has the button off.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCampaign } from '../../shared/campaigns.ts';
import { chooseBackupFolder, forgetBackupFolder } from '../../src/store/backup.ts';
import { appBackupDeps } from '../../src/store/backupDeps.ts';
import { publishCampaignSource } from '../../src/store/campaignSource.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { dataset, index } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

function fakeFolder(): void {
  const handle = {
    name: 'Daggerheart',
    getFileHandle: () =>
      Promise.resolve({
        createWritable: () =>
          Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }),
        getFile: () => Promise.resolve({ text: () => Promise.resolve('') }),
      }),
  };
  vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  Element.prototype.scrollIntoView = (): void => {};
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    // The whole point: this device holds no characters at all.
    characters: [],
    activeId: null,
    screen: 'settings',
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await forgetBackupFolder(appBackupDeps);
  publishCampaignSource(null);
  vi.unstubAllGlobals();
  useApp.setState({ prefs: { ...DEFAULT_PREFS } });
});

async function mount(): Promise<void> {
  await act(async () => {
    root.render(<Settings />);
  });
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (el) => (el.textContent ?? '').trim() === label,
  );
  if (found === undefined) {
    throw new Error(`no button called "${label}"`);
  }
  return found;
}

const tables = (...names: string[]) =>
  names.map((name, i) => newCampaign(name, '2026-08-10T18:00:00.000Z', `t-${String(i)}`));

describe('a GM who runs the table and plays nobody', () => {
  it('can still press the button, with three campaigns and no characters', async () => {
    publishCampaignSource(() => ({ campaigns: tables('Winter', 'Ash', 'Bell'), quarantined: [] }));
    await mount();

    expect(
      button('Back up everything').disabled,
      'the only manual backup on this screen is greyed out for a device that has three campaigns to lose',
    ).toBe(false);
  });

  it('still greys the button out on a device that holds nothing at all', async () => {
    publishCampaignSource(() => ({ campaigns: [], quarantined: [] }));
    await mount();

    expect(button('Back up everything').disabled).toBe(true);
  });

  it('counts the campaigns in the sentence beside the button', async () => {
    fakeFolder();
    await chooseBackupFolder(appBackupDeps);
    act(() => {
      useApp.setState({
        prefs: { ...DEFAULT_PREFS, lastBackupAt: new Date().toISOString(), backupTarget: 'Daggerheart' },
      });
    });
    publishCampaignSource(() => ({ campaigns: tables('Winter', 'Ash', 'Bell'), quarantined: [] }));
    await mount();

    const why = [...container.querySelectorAll('p')]
      .map((el) => el.textContent ?? '')
      .find((t) => t.includes('One file with every character in it'));
    expect(why, 'the panel never rendered its own sentence').toBeDefined();
    expect(
      why,
      'the sentence promises one file of characters and never mentions the campaigns that are also going out',
    ).toContain('3 campaigns');
  });
});
