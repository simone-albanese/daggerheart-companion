// @vitest-environment jsdom
/**
 * The campaign leg of the integrity alert, driven through the real shell.
 *
 * A device that lost only its campaigns: the characters came back, the
 * campaign store opened, and one campaign the last session left behind is not
 * on the disk now. `backup.test.ts` pins the report object for that case;
 * nothing pins what the shell draws from it.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetBackupFolder } from '../../src/store/backup.ts';
import { appBackupDeps } from '../../src/store/backupDeps.ts';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { App } from '../../src/ui/shell/App.tsx';
import { playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

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
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  await db.clearAll();
  vi.stubGlobal('localStorage', new MemoryStorage());
  useApp.setState({
    ready: false,
    storageError: null,
    writeError: null,
    quarantined: [],
    characters: [],
    activeId: null,
    screen: 'play',
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
  await forgetBackupFolder(appBackupDeps);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function settle(until: () => boolean = () => true, turns = 80): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (until()) return;
  }
}

async function mount(): Promise<void> {
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
  expect(useApp.getState().ready, 'init() never answered').toBe(true);
}

const text = (): string => container.textContent ?? '';

const buttonNames = (): string[] =>
  [...container.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());

async function press(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  expect(button, `no button says "${label}" - found: ${buttonNames().join(' | ')}`).toBeDefined();
  await act(async () => {
    button!.click();
  });
  await settle(() => true, 5);
}

/** The device: characters intact, one campaign gone. */
async function onlyTheCampaignsWentMissing(): Promise<void> {
  const here = playedCharacter();
  await db.putCharacter(here);
  localStorage.setItem(
    'dhc.backup.v1',
    JSON.stringify({
      lastSeenAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
      knownCharacterIds: [here.id],
      knownCampaignIds: ['winter-1'],
    }),
  );
}

describe('a device that lost only its campaigns', () => {
  it('is not told the library did not open', async () => {
    await onlyTheCampaignsWentMissing();
    await mount();
    await settle(() => /SOMETHING IS MISSING|THE LIBRARY DID NOT OPEN/.test(text()), 80);

    expect(
      text(),
      'the campaign the last session left behind is gone and the alert said nothing',
    ).toMatch(/1 campaign that was here at the end of the last session is not on this device now/);
    expect(
      text(),
      'a device whose campaign store opened fine, and whose characters are all here, ' +
        'is headed "THE LIBRARY DID NOT OPEN" - which names the wrong problem and points ' +
        'at the wrong store',
    ).not.toContain('THE LIBRARY DID NOT OPEN');
    expect(text()).toContain('SOMETHING IS MISSING');
  });

  it('offers the screen that owns campaign restore, and lands on it', async () => {
    await onlyTheCampaignsWentMissing();
    await mount();
    await settle(() => /SOMETHING IS MISSING|THE LIBRARY DID NOT OPEN/.test(text()), 80);

    expect(
      buttonNames().join(' | '),
      'the only door offered lands on Settings, whose import takes .dhchar and .dhbackup ' +
        'and cannot open a .dhcampaign',
    ).toMatch(/OPEN THE GM TOOLS/);

    await press('OPEN THE GM TOOLS');
    expect(useApp.getState().screen).toBe('gm');
  });

  /**
   * The GM who switched the section off still has the campaigns.
   *
   * Settings' own hint promises "every campaign stays on this device and comes
   * back the moment this goes back on", so a campaign loss on that device is an
   * ordinary campaign loss - and hiding the door behind the same preference
   * left RESTORE FROM A BACKUP as the only chip on the alert, which lands on
   * Settings, whose import takes `.dhchar` and `.dhbackup` and throws a
   * `.dhcampaign` straight back. The route is legalised instead of avoided, and
   * the label says what the tap will do before it does it.
   */
  it('offers the door with the section switched off, and says it will switch it on', async () => {
    await onlyTheCampaignsWentMissing();
    useApp.getState().setPrefs({ gmSection: false });
    await mount();
    await settle(() => /SOMETHING IS MISSING|THE LIBRARY DID NOT OPEN/.test(text()), 80);

    const names = buttonNames().join(' | ');
    expect(
      names,
      'a campaign loss with the GM section off has no door to the screen that owns campaigns',
    ).toMatch(/TURN THE GM TOOLS BACK ON/);
    // Not the other label: a chip that quietly changed a setting would be its
    // own small lie, on the one alert whose whole job is telling the truth.
    expect(names).not.toMatch(/\bOPEN THE GM TOOLS\b/);

    await press('TURN THE GM TOOLS BACK ON');
    expect(useApp.getState().prefs.gmSection).toBe(true);
    // `allowedScreen` is applied at render from the same store, so the pref has
    // to land first or the tap bounces to Play.
    expect(useApp.getState().screen).toBe('gm');
  });
});

/**
 * The other half of the same heading, and the one the lane left behind.
 *
 * When the campaign store will not open, `integrityCheck` forces
 * `missingCampaignIds` to `[]` on purpose - "an unanswered question is not a
 * loss" - and `missingIds` is empty because the characters are all there. Both
 * counts zero, `healthy` false: the alert fell to the else arm and was headed
 * THE LIBRARY DID NOT OPEN over a library that had opened, with the character
 * rows drawn underneath it.
 */
describe('a device whose campaign store will not open', () => {
  /** Only the campaigns store refuses. The characters read normally. */
  function shutTheCampaignStore(): void {
    const real = IDBObjectStore.prototype.getAll;
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (
      this: IDBObjectStore,
      ...args: unknown[]
    ) {
      if (this.name === 'campaigns') throw new DOMException('InvalidStateError');
      return (real as (...a: unknown[]) => IDBRequest).apply(this, args);
    } as typeof IDBObjectStore.prototype.getAll);
  }

  it('names the store that failed instead of the one that answered', async () => {
    const here = playedCharacter();
    await db.putCharacter(here);
    localStorage.setItem(
      'dhc.backup.v1',
      JSON.stringify({
        lastSeenAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
        knownCharacterIds: [here.id],
        knownCampaignIds: ['winter-1'],
      }),
    );
    shutTheCampaignStore();

    await mount();
    await settle(() => /DID NOT OPEN|SOMETHING IS MISSING/.test(text()), 80);

    expect(text()).toMatch(/campaign store could not be opened on this device/);
    expect(
      text(),
      'the character library opened, its rows are on screen, and the alert over them ' +
        'says it did not open',
    ).not.toContain('THE LIBRARY DID NOT OPEN');
    expect(text()).toContain('THE CAMPAIGNS DID NOT OPEN');
  });
});
