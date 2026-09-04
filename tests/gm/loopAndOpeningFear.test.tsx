// @vitest-environment jsdom
/**
 * Two small GM rules from p87 and p91, both CONFIRMED by the audit of
 * 2026-09-04.
 *
 * S8c-1: a loop countdown "reset[s] to their starting value after their
 * countdown effect is triggered" - after. The board used to wrap it on the
 * same tap that reached 0, so the SPENT line a standard clock gets never
 * appeared for a loop and the readout jumped 1 -> start.
 *
 * S8c-3: "You start a campaign with 1 Fear per PC in the party." Every
 * campaign the app minted opened at 0.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-2.0.json' with { type: 'json' };
import type { Dataset } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import { MAX_FEAR } from '../../shared/types.ts';
import { newCampaign } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Countdowns } from '../../src/ui/gm/Countdowns.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const dataset = srd as unknown as Dataset;
const index = indexDataset(dataset);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    prefs: { ...DEFAULT_PREFS },
    openCard: null,
  });
  useGm.setState({ hydrated: true, session: [], region: 'countdowns', fear: 0 });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';
const press = (label: string): void => {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (button === null) throw new Error(`no control called "${label}"`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('a loop countdown on the board (S8c-1, p91)', () => {
  it('reaches 0, says SPENT, and only the next advance returns it to its start', () => {
    const id = useGm.getState().addCountdown('The tide', 'loop', 2);
    act(() => root.render(createElement(Countdowns, { phone: true })));
    const value = (): number =>
      useGm
        .getState()
        .session.flatMap((i) => (i.kind === 'countdown' && i.countdown.id === id ? [i.countdown.value] : []))[0]!;

    expect(text()).not.toContain('SPENT');
    press('Advance The tide by one');
    expect(value()).toBe(1);
    press('Advance The tide by one');
    expect(value(), 'the tap that reaches 0 must leave the clock AT 0, not at its start').toBe(0);
    expect(text(), 'a spent loop clock draws the same line a spent standard clock does').toContain(
      'SPENT — IT HAPPENS NOW',
    );
    press('Advance The tide by one');
    expect(value(), 'the advance after the trigger is the reset').toBe(2);
    expect(text()).not.toContain('SPENT');
  });
});

describe('the Fear a campaign opens with (S8c-3, p87)', () => {
  it('is 1 per PC when minted, clamped to the pool', () => {
    expect(newCampaign('a', '2026-09-04T00:00:00.000Z', 'a').fear).toBe(0);
    expect(newCampaign('b', '2026-09-04T00:00:00.000Z', 'b', 5).fear).toBe(5);
    expect(newCampaign('c', '2026-09-04T00:00:00.000Z', 'c', 99).fear).toBe(MAX_FEAR);
    expect(newCampaign('d', '2026-09-04T00:00:00.000Z', 'd', -3).fear).toBe(0);
  });

  it('is read off the party-size preference when the GM makes one from the menu', async () => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartySize: 5 } });
    const made = await useGm.getState().createCampaign('Fivefold');
    expect(made.fear).toBe(5);
    expect(useGm.getState().fear).toBe(5);
  });

  it('says so on the board, where the pool is set', () => {
    act(() => root.render(createElement(Countdowns, { phone: true })));
    expect(text()).toContain('OPENS AT 1 FEAR PER PC');
  });
});
