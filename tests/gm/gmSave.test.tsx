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
import { act, createElement } from 'react';
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
import { SaveSheet } from '../../src/ui/gm/SaveSheet.tsx';
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
    expect(text()).toContain('could not be read');
  });
});
