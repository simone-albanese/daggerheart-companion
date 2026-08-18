// @vitest-environment jsdom
/**
 * Does every component in the app render at all?
 *
 * Until this file, no test in this repo had ever mounted a screen. Two files
 * used jsdom - `tabBar.test.ts` and `track.test.ts` - and both were written
 * *after* a person found the bug on their own phone. Four more render through
 * `renderToStaticMarkup`, which does not run `useEffect`, and every act of
 * wiring in this app lives in an effect. `App.tsx` appeared in the suite only
 * as a `readFileSync` path, and `Play.tsx` - the screen the README says is used
 * ninety per cent of the time - only inside a comment.
 *
 * That is how four defects reached users. All four were *absence* rather than
 * error: a glyph that computed to `rgba(0,0,0,0)`, two Experiences filtered out
 * one line below the promise to keep them. Nothing throws when a shape ends up
 * the same colour as the panel behind it, and a read-only audit sees an
 * assignment and a filter and both look deliberate.
 *
 * So this asks the smallest questions that would have caught them, of every
 * component at once, with a character built out of the shipped SRD:
 *
 *   - it mounts without throwing, with effects run under `act()`;
 *   - it puts something on the page, or is written down as drawing nothing;
 *   - every control it draws has a name somewhere.
 *
 * The colour half of that story lives in `tabBar.test.ts`, which fails on the
 * `background` + `backgroundColor: undefined` pattern anywhere in the tree
 * rather than on the four glyphs it happened to hit.
 *
 * The list is derived from the tree rather than typed out. A component added
 * next year and forgotten is not silently uncovered: it fails the first test
 * here, which is the whole point - the four defects above were all in code
 * nobody had thought to point a test at.
 */
import 'fake-indexeddb/auto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Adversary, Environment } from '@shared/types.ts';
import type { SessionItem } from '@shared/campaigns.ts';
import { cryptoRng } from '../../src/engine/dice.ts';
import * as db from '../../src/store/db.ts';
import { useApp, type Screen } from '../../src/store/state.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

import { Build } from '../../src/ui/build/Build.tsx';
import { Edit } from '../../src/ui/build/Edit.tsx';
import { ArmorPicker, GearSlot, ItemPicker, WeaponPicker } from '../../src/ui/build/GearPicker.tsx';
import { LevelUp } from '../../src/ui/build/LevelUp.tsx';
import {
  Callout,
  Choice as BuildChoice,
  Columns,
  DatasetEmpty,
  ExperienceEditor,
  FeatureBlock,
  GoldEditor,
  InventoryEditor,
  LabelledInput,
  Mark,
  Section as BuildSection,
  Segmented,
  SlotBoxes,
  Stepper as BuildStepper,
} from '../../src/ui/build/parts.tsx';
import { StepCards, StepExperiences, Wizard } from '../../src/ui/build/Wizard.tsx';
import { emptyDraft } from '../../src/ui/build/creation.ts';
import { AddSheet } from '../../src/ui/gm/AddSheet.tsx';
import { AdversaryRow, FilterBar, NO_FILTER } from '../../src/ui/gm/AdversaryList.tsx';
import { Bestiary } from '../../src/ui/gm/Bestiary.tsx';
import { Countdowns } from '../../src/ui/gm/Countdowns.tsx';
import { Encounter, Stepper as EncounterStepper } from '../../src/ui/gm/Encounter.tsx';
import { FearBar, FearBoard } from '../../src/ui/gm/FearPool.tsx';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { GmBar } from '../../src/ui/gm/GmBar.tsx';
import { GmSheet } from '../../src/ui/gm/GmSheet.tsx';
import { GmTopBar } from '../../src/ui/gm/GmTopBar.tsx';
import { MenuSheet } from '../../src/ui/gm/MenuSheet.tsx';
import { PartyBoard } from '../../src/ui/gm/PartyBoard.tsx';
import { Names } from '../../src/ui/gm/Names.tsx';
import { PartyScanner } from '../../src/ui/gm/PartyScanner.tsx';
import { Reference } from '../../src/ui/gm/Reference.tsx';
import {
  AdversaryExperiences,
  BlockView,
  CountdownChart,
  DifficultyLadder,
  FearGuide,
  GmMoves,
  RangeReference,
  TierBenchmarks,
} from '../../src/ui/gm/ReferenceTables.tsx';
import { SaveSheet } from '../../src/ui/gm/SaveSheet.tsx';
import { Scene } from '../../src/ui/gm/Scene.tsx';
import { SessionBody } from '../../src/ui/gm/SessionBody.tsx';
import { SessionList } from '../../src/ui/gm/SessionList.tsx';
import { SessionRow } from '../../src/ui/gm/SessionRow.tsx';
import { ShowSheet } from '../../src/ui/gm/ShowSheet.tsx';
import {
  AdversaryBlock,
  EnvironmentBand,
  EnvironmentBlock,
  FeatureList,
  Stat,
} from '../../src/ui/gm/StatBlock.tsx';
import { Beastform } from '../../src/ui/player/Beastform.tsx';
import { Cards } from '../../src/ui/player/Cards.tsx';
import { CompanionPanel, WhoSwitch } from '../../src/ui/player/Companion.tsx';
import { ActiveConditions, ConditionsControl } from '../../src/ui/player/Conditions.tsx';
import { DamageRow } from '../../src/ui/player/DamageRoll.tsx';
import { DeathMoveOffer } from '../../src/ui/player/DeathMove.tsx';
import { DualityRoll, ExperienceRow, rollAffordance } from '../../src/ui/player/DualityRoll.tsx';
import { Play } from '../../src/ui/player/Play.tsx';
import { Rest } from '../../src/ui/player/Rest.tsx';
import { IncomingDamage, Vitals } from '../../src/ui/player/Vitals.tsx';
import { CharacterSheet } from '../../src/ui/print/CharacterSheet.tsx';
import { buildSheet } from '../../src/ui/print/sheetModel.ts';
import { CoinRow, PrintDomainMark, TickRow } from '../../src/ui/print/marks.tsx';
import { About } from '../../src/ui/settings/About.tsx';
import { ReconciliationReport, Rulebook } from '../../src/ui/settings/Rulebook.tsx';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { Receiver, Transfer } from '../../src/ui/settings/Transfer.tsx';
import {
  Action,
  Choice as SettingsChoice,
  Field,
  Note,
  Rows,
  Section as SettingsSection,
  Switch,
} from '../../src/ui/settings/parts.tsx';
import { ImportDoors } from '../../src/ui/onboarding/ImportDoors.tsx';
import { Onboarding } from '../../src/ui/onboarding/Onboarding.tsx';
import { AnswerRow } from '../../src/ui/onboarding/parts.tsx';
import { Attribution, CompatibleIcon, CompatibleLockup } from '../../src/ui/shared/CompatibleMark.tsx';
import { CardReader, CardText, DomainCardView } from '../../src/ui/shared/DomainCardView.tsx';
import { AppMark, DomainMark } from '../../src/ui/shared/DomainMark.tsx';
import { ImportConflicts } from '../../src/ui/shared/ImportConflicts.tsx';
import { RenameField } from '../../src/ui/shared/RenameField.tsx';
import { RuleTableView } from '../../src/ui/shared/RuleTableView.tsx';
import { ruleSection, type SectionBlock } from '../../src/ui/shared/srdReference.ts';
import type { RuleTable } from '../../src/ui/shared/ruleText.ts';
import { Counter } from '../../src/ui/shared/Counter.tsx';
import { Disclosure } from '../../src/ui/shared/Disclosure.tsx';
import { Fold } from '../../src/ui/shared/Fold.tsx';
import { Track } from '../../src/ui/shared/Track.tsx';
import { App } from '../../src/ui/shell/App.tsx';
import { AppBoundary } from '../../src/ui/shell/AppBoundary.tsx';
import { BackupBanner } from '../../src/ui/shell/BackupBanner.tsx';
import { CampaignNotSaved } from '../../src/ui/shell/CampaignNotSaved.tsx';
import { Header } from '../../src/ui/shell/Header.tsx';
import { LicenceFooter } from '../../src/ui/shell/LicenceFooter.tsx';
import { Recovery } from '../../src/ui/shell/Recovery.tsx';
import { ScreenBoundary } from '../../src/ui/shell/ScreenBoundary.tsx';
import { ShellBanner } from '../../src/ui/shell/ShellBanner.tsx';
import { TabBar } from '../../src/ui/shell/TabBar.tsx';
import { UpdateBanner } from '../../src/ui/shell/UpdateBanner.tsx';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/** Answer media queries as a viewport of this width would. */
function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const coarse = /any-pointer:\s*coarse/.test(query);
    const matches =
      (max !== null && width <= Number(max[1])) ||
      (min !== null && width >= Number(min[1])) ||
      (coarse && width < 720);
    return {
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

beforeAll(() => {
  // jsdom has no matchMedia at all, and every layout decision in this app goes
  // through it. The default is the tablet band; the tests that care set their
  // own width.
  setViewport(1024);
  // jsdom implements no scrolling either, and the wizard scrolls its panel back
  // to the top on every step. Both of these are gaps in the environment rather
  // than in the app, and both would otherwise read as a crash.
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  // And no media element. `Receiver` releases the camera on unmount by pausing
  // the `<video>` and clearing `srcObject`, which is right in a browser and
  // prints "Not implemented: HTMLMediaElement's pause()" here - a third gap in
  // the environment, and one this file reads as a React complaint because it
  // arrives on `console.error`.
  HTMLMediaElement.prototype.pause = (): void => {};
});

/**
 * A localStorage per test, because whether there is one at all depends on Node.
 *
 * This file used to install none and say so, and that sentence was true of the
 * machine it was written on and false of the machine that ships it. Measured:
 * under jsdom on **Node 24** — `.nvmrc`, and what `deploy.yml` runs —
 * `window.localStorage` is a working Storage; under **Node 26** it is
 * `undefined`, because Node's own experimental `localStorage` getter shadows
 * jsdom's and answers nothing without `--localstorage-file`.
 *
 * So `savePrefs` is a no-op locally and a real write in CI, and every test here
 * that reaches `setPrefs` was leaving a record behind for the next `init()` on
 * one Node and not the other. That is how "routes an empty library to Build,
 * behind the first run" passed for months here and failed the deploy: an
 * earlier case had written `onboarded: true`, `loadPrefs` read it back, and the
 * questions this file asserts were correctly not drawn.
 *
 * A fresh shim per case makes the file say the same thing on both, and it is
 * the same one seven other test files install.
 */
class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  // The store and the database are module state, shared by every test in this
  // file. Without this the fourth test runs against six characters left behind
  // by the first three, and "the library is empty" can never be true.
  await db.clearAll();
  // And the preferences are the same problem through a different door: on the
  // Node this project deploys on they persist, so one case's `setPrefs` decides
  // the next case's first run. See `MemoryStorage` above.
  vi.stubGlobal('localStorage', new MemoryStorage());
  useApp.setState({
    ready: false,
    storageError: null,
    characters: [],
    activeId: null,
    screen: 'play',
    log: [],
    openCard: null,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  // `restoreAllMocks` does not undo `stubGlobal`, and a shim left standing
  // would outlive this file on the Node where localStorage is real.
  vi.unstubAllGlobals();
});

/**
 * Everything React complained about while a mount was running.
 *
 * React reports a duplicate key, a nested `<button>`, an unknown DOM property
 * and a state update outside `act()` by writing to the console and rendering
 * anyway. That is exactly the shape of every defect this app has shipped -
 * nothing throws, the screen just quietly does the wrong thing - so a warning
 * is treated here as a failure rather than as scrollback.
 *
 * It has already earned its place: the first draft of this file built its
 * Experiences without an `id`, and this is what said so.
 */
function captureWarnings(): () => string[] {
  const seen: string[] = [];
  const record = (...args: unknown[]): void => {
    seen.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
  };
  vi.spyOn(console, 'error').mockImplementation(record);
  vi.spyOn(console, 'warn').mockImplementation(record);
  return () => seen;
}

/**
 * Let everything the effects started finish.
 *
 * `act` flushes React. It does not flush a database read or a dynamic import,
 * and this app does both before it has a screen to draw: `init()` awaits
 * IndexedDB, and Build, GM and Settings are `lazy()`. A single microtask is not
 * enough, so this turns the loop until the condition holds rather than guessing
 * a number of ticks.
 */
async function settle(until: () => boolean = () => true, turns = 50): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (until()) return;
  }
  // Deliberately not a throw. Whatever the caller was waiting for, the
  // assertion after this call says what it was in words; "the app never
  // settled" would replace a specific failure with a vague one.
}

async function render(element: ReactElement): Promise<void> {
  await act(async () => {
    root.render(element);
  });
  await settle();
}

/** Seed the store the way a booted app holds it, without booting. */
function seed(): void {
  const character = playedCharacter();
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
}

const stats = (): ReturnType<typeof playedStats> => playedStats(playedCharacter());

/** What the screen itself says, without the header and the tab bar. */
function screenText(): string {
  const main = container.querySelector('main');
  if (main === null) return '';
  const nav = main.querySelector('nav')?.textContent ?? '';
  return (main.textContent ?? '').replace(nav, '').trim();
}

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

describe('the shell, on every screen', () => {
  const screens: Screen[] = ['play', 'cards', 'build', 'gm', 'settings'];

  for (const screen of screens) {
    it(`renders ${screen} with a character on it`, async () => {
      await db.putCharacter(playedCharacter());
      const warnings = captureWarnings();

      await act(async () => {
        root.render(createElement(App));
      });
      await settle(() => useApp.getState().ready);
      expect(useApp.getState().ready, 'init() never answered').toBe(true);

      // Switch the way a person does, through the store, after the app has
      // booted: `init()` sets the screen itself from the saved preference, so
      // setting it beforehand would be overwritten and every case would be
      // testing whichever screen was last used.
      await act(async () => {
        useApp.getState().setScreen(screen);
      });
      await settle(() => screenText().length > 200);

      // `<main>` rather than the whole container: the header and the tab bar
      // put about forty characters on the page on their own, so a screen that
      // rendered nothing at all would still clear a threshold measured against
      // the container. Measured against the real screens, the smallest of the
      // five is an order of magnitude above this.
      expect(screenText().length, `the ${screen} screen drew almost nothing`).toBeGreaterThan(200);
      expect(warnings(), `the ${screen} screen made React complain`).toEqual([]);
    });
  }

  it('renders on a 375px phone, with the tab bar in the thumb arc', async () => {
    setViewport(375);
    try {
      await db.putCharacter(playedCharacter());
      await act(async () => {
        root.render(createElement(App));
      });
      await settle(() => useApp.getState().ready);
      expect(useApp.getState().ready, 'init() never answered').toBe(true);
      await act(async () => {
        useApp.getState().setScreen('play');
      });
      await settle(() => container.querySelector('nav') !== null);

      expect(container.querySelector('nav')).not.toBeNull();
      expect((container.textContent ?? '').trim().length).toBeGreaterThan(20);
    } finally {
      setViewport(1024);
    }
  });

  it('names a character it will not open, rather than quietly showing one fewer', async () => {
    // A record a newer build wrote. `readLibrary` keeps it out of the store so
    // nothing can edit it; without a banner the user would simply find a
    // character missing, which is indistinguishable from having lost it.
    await db.putCharacter(playedCharacter());
    const ahead = { ...playedCharacter(), name: 'Ilya of the Ninth', schemaVersion: 99 };
    const database = await db.db();
    await database.put('characters', ahead as unknown as Parameters<typeof db.putCharacter>[0]);

    await act(async () => {
      root.render(createElement(App));
    });
    await settle(() => useApp.getState().ready);

    expect(useApp.getState().quarantined).toHaveLength(1);
    const alerts = [...container.querySelectorAll('[role="alert"]')]
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(alerts).toContain('Ilya of the Ninth');
    expect(alerts).toMatch(/newer version of the app/);
    expect(alerts).toMatch(/Nothing has been deleted/);
  });

  /*
   * The store value, and no longer what is drawn.
   *
   * This was called "opens on Build when there is nothing to play", and the
   * title stopped being true when the first-run questions went in front of all
   * five screens: `screen` is still `'build'` in exactly this state, and
   * `<Onboarding/>` is what `<main>` holds. The assertion never noticed because
   * it reads the store rather than the tree, so the title drifted with the test
   * green. Both halves are asserted now.
   */
  it('routes an empty library to Build in the store, behind the first run drawn over it', async () => {
    await render(createElement(App));
    await settle(() => useApp.getState().ready);
      expect(useApp.getState().ready, 'init() never answered').toBe(true);
    expect(useApp.getState().screen).toBe('build');
    expect(
      container.textContent ?? '',
      'the questions are not what a brand-new device draws, so the stored screen ' +
        'is also what is on it and this test is measuring one thing twice',
    ).toContain('Who are you at this table?');
  });

  it('says something rather than nothing when the library is empty', async () => {
    await render(createElement(App));
    await settle(() => useApp.getState().ready);
      expect(useApp.getState().ready, 'init() never answered').toBe(true);
    // Past the first run, which is a different empty library from this one.
    // `EmptyState` is what somebody who has answered the questions and then
    // deleted their last character sees; the questions themselves are asserted
    // in `onboarding.test.tsx`. Set after `init`, because `init` reads the
    // preferences off the disk, and this file's localStorage is a fresh shim
    // per case rather than absent - which is what it used to say, on the one
    // Node where it happened to be true.
    await act(async () => {
      useApp.getState().setPrefs({ onboarded: true });
    });
    await act(async () => {
      useApp.getState().setScreen('play');
    });
    await settle();
    // `EmptyState` is what a device that has answered the questions and then
    // emptied its library sees - not the first thing a new user sees, which is
    // the comment this replaces and which the four lines above it already
    // contradict. The licence notice is on all six surfaces since P5-6, so it
    // is not what makes this screen special either.
    expect(container.textContent ?? '').toContain('No character yet');
  });
});

// ---------------------------------------------------------------------------
// Every component
// ---------------------------------------------------------------------------

const noop = (): void => {};
/**
 * A session row, open, of the arm with the fewest moving parts.
 *
 * Open rather than collapsed because a fixture that mounts a shut disclosure
 * proves only that the header renders - and `SessionBody` is the half of a row
 * that resolves refs against the dataset, which is the half that can throw.
 */
const sceneItem = (): SessionItem => ({
  id: 's1',
  kind: 'scene',
  name: 'The Sablewood gate',
  order: 0,
  collapsed: false,
  environmentRef: null,
});
/**
 * A `## ` block of a shipped rules section that carries a pipe table.
 *
 * Out of the dataset rather than invented, because the shape under test is the
 * dataset's own - a hand-built table would have mounted happily while the one a
 * GM actually opens printed raw pipes, which is the defect these two fixtures
 * exist for.
 */
const blockWithTable = (id: string): SectionBlock => {
  const section = ruleSection(dataset.rules, id);
  if (section === null) throw new Error(`the shipped ${id} section is gone`);
  const block = section.blocks.find((b) => b.parts.some((p) => p.kind === 'table'));
  if (block === undefined) throw new Error(`the shipped ${id} section carries no table`);
  return block;
};
/** The Average Costs table, p.69: two columns, twelve rows. */
const costsTable = (): RuleTable => {
  const part = blockWithTable('giving-out-gold-equipment-and-loot').parts.find(
    (p) => p.kind === 'table',
  );
  if (part?.kind !== 'table') throw new Error('the shipped costs section carries no table');
  return part.table;
};
const adversary = (): Adversary => dataset.adversaries[0]!;
const environment = (): Environment => dataset.environments[0]!;
const card = () => dataset.domainCards[0]!;

/**
 * Every exported component, with props good enough to draw it.
 *
 * Keyed by `path::Name` because three names appear twice - `Section`, `Choice`
 * and `Stepper` all exist in two files - and a registry keyed on the bare name
 * would silently cover one and skip the other.
 */
const COMPONENTS: Record<string, () => ReactElement> = {
  'build/Build.tsx::Build': () => <Build />,
  'build/Edit.tsx::Edit': () => <Edit stats={stats()} onLevelUp={noop} />,
  'build/GearPicker.tsx::WeaponPicker': () => (
    <WeaponPicker
      slot="primary"
      value={null}
      sheet={playedCharacter()}
      stats={stats()}
      onPick={noop}
      onClose={noop}
    />
  ),
  'build/GearPicker.tsx::ArmorPicker': () => (
    <ArmorPicker value={null} sheet={playedCharacter()} onPick={noop} onClose={noop} />
  ),
  'build/GearPicker.tsx::ItemPicker': () => (
    <ItemPicker carried={new Map()} onAdd={noop} onClose={noop} />
  ),
  'build/GearPicker.tsx::GearSlot': () => (
    <GearSlot label="PRIMARY" title="A Sword" empty="none" onOpen={noop} />
  ),
  'build/LevelUp.tsx::LevelUp': () => <LevelUp stats={stats()} onDone={noop} />,
  'build/Wizard.tsx::Wizard': () => <Wizard />,
  'build/Wizard.tsx::StepCards': () => (
    <StepCards draft={emptyDraft()} set={noop} klass={dataset.classes[0]} />
  ),
  'build/Wizard.tsx::StepExperiences': () => <StepExperiences draft={emptyDraft()} set={noop} />,
  'build/parts.tsx::Section': () => <BuildSection label="LABEL">body</BuildSection>,
  'build/parts.tsx::Columns': () => <Columns>body</Columns>,
  'build/parts.tsx::Choice': () => <BuildChoice selected onClick={noop} title="A choice" />,
  'build/parts.tsx::Mark': () => <Mark on />,
  'build/parts.tsx::Segmented': () => (
    <Segmented value="a" onChange={noop} options={[['a', 'A'], ['b', 'B']]} label="Pick" />
  ),
  'build/parts.tsx::SlotBoxes': () => <SlotBoxes used={1} slots={2} />,
  'build/parts.tsx::Stepper': () => <BuildStepper value={2} onChange={noop} label="Count" />,
  'build/parts.tsx::Callout': () => <Callout tone="warn" items={['Something to check']} />,
  'build/parts.tsx::FeatureBlock': () => <FeatureBlock name="A Feature" text="It does a thing." />,
  'build/parts.tsx::DatasetEmpty': () => <DatasetEmpty what="weapons" />,
  'build/parts.tsx::LabelledInput': () => (
    <LabelledInput label="Name" value="Fixture" onChange={noop} />
  ),
  'build/parts.tsx::ExperienceEditor': () => (
    <ExperienceEditor value={[{ id: 'e1', name: 'Ran with wolves', bonus: 2 }]} onChange={noop} />
  ),
  'build/parts.tsx::GoldEditor': () => (
    <GoldEditor gold={{ handfuls: 3, bags: 1, chests: 0 }} onChange={noop} />
  ),
  'build/parts.tsx::InventoryEditor': () => (
    <InventoryEditor value={[{ ref: null, name: 'A rope', quantity: 1 }]} onChange={noop} />
  ),

  'gm/AddSheet.tsx::AddSheet': () => <AddSheet onClose={noop} />,
  'gm/AdversaryList.tsx::FilterBar': () => (
    <FilterBar value={NO_FILTER} onChange={noop} shown={3} total={9} />
  ),
  'gm/AdversaryList.tsx::AdversaryRow': () => (
    <AdversaryRow adversary={adversary()} onSelect={noop} />
  ),
  'gm/Bestiary.tsx::Bestiary': () => <Bestiary phone={false} />,
  'gm/Countdowns.tsx::Countdowns': () => <Countdowns phone={false} />,
  'gm/Encounter.tsx::Encounter': () => <Encounter phone={false} />,
  'gm/Encounter.tsx::Stepper': () => <EncounterStepper label="Fear" value={2} onChange={noop} />,
  'gm/FearPool.tsx::FearBar': () => <FearBar />,
  'gm/FearPool.tsx::FearBoard': () => <FearBoard phone={false} />,
  'gm/Gm.tsx::Gm': () => <Gm />,
  'gm/GmBar.tsx::GmBar': () => <GmBar open={null} onOpenSheet={noop} />,
  'gm/GmSheet.tsx::GmSheet': () => (
    <GmSheet label="A tool" onClose={noop}>
      inside the sheet
    </GmSheet>
  ),
  'gm/GmTopBar.tsx::GmTopBar': () => (
    <GmTopBar layout="tablet" onOpenMenu={noop} onOpenTool={noop} />
  ),
  'gm/MenuSheet.tsx::MenuSheet': () => <MenuSheet onClose={noop} onOpenTool={noop} />,
  'gm/Names.tsx::Names': () => <Names phone={false} />,
  'gm/PartyBoard.tsx::PartyBoard': () => <PartyBoard phone={false} />,
  // The board's camera, which is a module of its own so that jsQR stays out of
  // the GM chunk - see `tests/harness/staticImports.test.ts`. Same fixture
  // argument as `Receiver` above it: jsdom has no `navigator.mediaDevices`, so
  // mounting this exercises the scanner failing to start and the refusal
  // reaching the panel rather than leaving a black rectangle.
  'gm/PartyScanner.tsx::PartyScanner': () => <PartyScanner onArrived={noop} />,
  'gm/Reference.tsx::Reference': () => <Reference />,
  'gm/ReferenceTables.tsx::TierBenchmarks': () => <TierBenchmarks />,
  'gm/ReferenceTables.tsx::AdversaryExperiences': () => <AdversaryExperiences />,
  'gm/ReferenceTables.tsx::DifficultyLadder': () => <DifficultyLadder />,
  'gm/ReferenceTables.tsx::FearGuide': () => <FearGuide besidePool={false} />,
  'gm/ReferenceTables.tsx::GmMoves': () => <GmMoves />,
  // Read-only: with no countdown to act on, not one cell is a button.
  'gm/ReferenceTables.tsx::CountdownChart': () => <CountdownChart countdown={null} />,
  // The metric figures are the app's arithmetic and say so; everything else on
  // it is the SRD's own sentence.
  'gm/ReferenceTables.tsx::RangeReference': () => <RangeReference />,
  // The block the GM chapter and the session's LINK → Rule row both draw with:
  // prose, bullets and tables, in the order the book wrote them. The countdown
  // chart's block is three columns wide, which is the stacked-panel half of
  // `RuleTableView`; the grid half is its own fixture below.
  'gm/ReferenceTables.tsx::BlockView': () => <BlockView block={blockWithTable('countdowns')} />,
  'gm/SaveSheet.tsx::SaveSheet': () => <SaveSheet />,
  'gm/Scene.tsx::Scene': () => <Scene phone={false} />,
  'gm/SessionBody.tsx::SessionBody': () => (
    <SessionBody item={sceneItem()} phone={false} onOpenTool={noop} />
  ),
  'gm/SessionList.tsx::SessionList': () => <SessionList phone={false} onOpenTool={noop} />,
  'gm/SessionRow.tsx::SessionRow': () => (
    <SessionRow
      item={sceneItem()}
      position={1}
      total={1}
      phone={false}
      // Built inline rather than imported from a no-op constant in `src`: an
      // export nothing in the app reaches is exactly what the orphan harness
      // reports, and a fixture is not a caller.
      handle={{
        onPointerDown: noop,
        onKeyDown: noop,
        'aria-keyshortcuts': 'ArrowUp ArrowDown Home End',
        style: { touchAction: 'none' },
      }}
      lifted={false}
      onOpenTool={noop}
    />
  ),
  'gm/ShowSheet.tsx::ShowSheet': () => <ShowSheet onOpenTool={noop} />,
  'gm/StatBlock.tsx::Stat': () => <Stat label="HP" value="6" />,
  'gm/StatBlock.tsx::FeatureList': () => (
    <FeatureList features={[{ name: 'A Feature', text: 'It does a thing.' }]} />
  ),
  'gm/StatBlock.tsx::AdversaryBlock': () => <AdversaryBlock adversary={adversary()} />,
  'gm/StatBlock.tsx::EnvironmentBand': () => <EnvironmentBand environment={environment()} />,
  'gm/StatBlock.tsx::EnvironmentBlock': () => (
    <EnvironmentBlock environment={environment()} active onToggle={noop} />
  ),

  'player/Beastform.tsx::Beastform': () => <Beastform stats={stats()} layout="desktop" />,
  'player/Cards.tsx::Cards': () => <Cards stats={stats()} />,
  'player/Companion.tsx::WhoSwitch': () => <WhoSwitch who="you" setWho={noop} compact={false} />,
  'player/Companion.tsx::CompanionPanel': () => (
    <CompanionPanel stats={stats()} layout="desktop" />
  ),
  'player/Conditions.tsx::ActiveConditions': () => <ActiveConditions />,
  'player/Conditions.tsx::ConditionsControl': () => <ConditionsControl />,
  // A real attack rather than null, so the row draws and stays out of
  // DRAWS_NOTHING: null is its "no roll has happened yet" state, which is the
  // one state this file cannot tell apart from a broken render.
  'player/DamageRoll.tsx::DamageRow': () => (
    <DamageRow
      attack={{
        source: { kind: 'unarmed', damage: { count: 2, sides: 4, modifier: 0 } },
        critical: false,
        succeeded: true,
        outcome: 'success-hope',
        reaction: false,
        proficiency: 2,
      }}
      affordance={rollAffordance(true, true)}
      layout="desktop"
    />
  ),
  'player/DeathMove.tsx::DeathMoveOffer': () => <DeathMoveOffer />,
  'player/DualityRoll.tsx::DualityRoll': () => (
    <DualityRoll
      stats={stats()}
      trait="agility"
      onTraitChange={noop}
      source={null}
      layout="desktop"
      armedExperiences={[]}
      onArmedExperiencesChange={noop}
    />
  ),
  // The Experience chips, which `Play` now draws in a fold of their own below
  // ROLL - so they are an export with two call sites rather than a private
  // helper, and this is the fixture that says so.
  'player/DualityRoll.tsx::ExperienceRow': () => (
    <ExperienceRow
      experiences={playedCharacter().experiences}
      armedExperiences={[]}
      hopeAvailable={3}
      toggleExperience={noop}
    />
  ),
  'player/Play.tsx::Play': () => <Play stats={stats()} />,
  // The real dice, as `Play.tsx` passes them: this fixture only draws the
  // closed fold, and a rest that has not been committed never asks for one.
  'player/Rest.tsx::Rest': () => <Rest stats={stats()} rng={cryptoRng} />,
  'player/Vitals.tsx::Vitals': () => <Vitals stats={stats()} layout="desktop" />,
  // The desktop row, because the `band` variant is two children of a grid
  // `Defenses` owns and this sweep mounts every fixture on its own.
  'player/Vitals.tsx::IncomingDamage': () => <IncomingDamage stats={stats()} layout="desktop" />,

  // The first run, mounted on its own question rather than through the shell.
  // It takes no props at all: everything it needs is the store, and everything
  // it decides it holds itself until its last button.
  'onboarding/Onboarding.tsx::Onboarding': () => <Onboarding />,
  // The three doors, mounted with none of them open — which is the state they
  // are in when the screen arrives, and the only one that does not want a
  // camera. Each door opens on its own tap and `onboarding.test.tsx` drives
  // them; this asks the smaller question of whether the closed screen draws.
  'onboarding/ImportDoors.tsx::ImportDoors': () => <ImportDoors />,
  'onboarding/parts.tsx::AnswerRow': () => (
    <AnswerRow glyph="PC" label="A player" sub="NEXT: THE NINE CLASSES" onPick={noop} />
  ),

  'print/CharacterSheet.tsx::CharacterSheet': () => (
    <CharacterSheet sheet={buildSheet(playedCharacter(), dataset, index)} />
  ),
  'print/marks.tsx::PrintDomainMark': () => <PrintDomainMark domain="blade" />,
  'print/marks.tsx::TickRow': () => <TickRow kind="hp" count={6} />,
  'print/marks.tsx::CoinRow': () => <CoinRow count={3} />,

  'settings/About.tsx::About': () => <About />,
  'settings/Rulebook.tsx::Rulebook': () => <Rulebook phone={false} />,
  'settings/Rulebook.tsx::ReconciliationReport': () => (
    <ReconciliationReport
      report={{
        kinds: [],
        totals: { matched: 0, manualOnly: 0, srdOnly: 0, suggested: 0 },
        unread: [],
        empty: true,
      }}
      onDismiss={noop}
    />
  ),
  'settings/Settings.tsx::Settings': () => <Settings />,
  'settings/Transfer.tsx::Transfer': () => <Transfer />,
  // The camera half on its own, which the first run's import door mounts
  // directly. jsdom has no `navigator.mediaDevices`, so this fixture exercises
  // the branch that matters most on a real device too: the scanner refusing to
  // start, and the refusal reaching the screen instead of a blank panel.
  'settings/Transfer.tsx::Receiver': () => <Receiver />,
  'settings/parts.tsx::Section': () => (
    <SettingsSection id="s" title="A Section">
      body
    </SettingsSection>
  ),
  'settings/parts.tsx::Rows': () => <Rows>body</Rows>,
  'settings/parts.tsx::Field': () => <Field label="A field">body</Field>,
  // Deliberately outside a Field: with no provider above it, the context
  // default has to leave `aria-describedby` off rather than point at an
  // element that is not on the page.
  'settings/parts.tsx::Action': () => <Action onClick={noop}>Do the thing</Action>,
  'settings/parts.tsx::Switch': () => <Switch checked onChange={noop} label="A switch" />,
  'settings/parts.tsx::Choice': () => (
    <SettingsChoice value="a" onChange={noop} options={[['a', 'A'], ['b', 'B']]} label="Pick" />
  ),
  'settings/parts.tsx::Note': () => <Note>A note.</Note>,

  'shared/CompatibleMark.tsx::CompatibleLockup': () => <CompatibleLockup />,
  'shared/CompatibleMark.tsx::CompatibleIcon': () => <CompatibleIcon />,
  'shared/CompatibleMark.tsx::Attribution': () => <Attribution />,
  'shared/DomainCardView.tsx::CardText': () => <CardText text="Mark a Stress to do a thing." />,
  'shared/DomainCardView.tsx::DomainCardView': () => <DomainCardView card={card()} />,
  'shared/DomainCardView.tsx::CardReader': () => <CardReader card={card()} onClose={noop} />,
  'shared/DomainMark.tsx::DomainMark': () => <DomainMark domain="blade" />,
  'shared/DomainMark.tsx::AppMark': () => <AppMark />,
  'shared/ImportConflicts.tsx::ImportConflicts': () => (
    <ImportConflicts
      conflicts={[
        {
          incoming: { ...playedCharacter(), name: 'Ilya', updatedAt: '2026-01-02T10:00:00.000Z' },
          local: { ...playedCharacter(), name: 'Ilya', updatedAt: '2026-06-02T10:00:00.000Z' },
        },
      ]}
      onChoose={noop}
    />
  ),
  // No `onDone`, which is Build's shape: a field and a SAVE, no cancel target.
  'shared/RenameField.tsx::RenameField': () => <RenameField />,
  // The Average Costs table: two columns, so the grid half of it.
  'shared/RuleTableView.tsx::RuleTableView': () => <RuleTableView table={costsTable()} />,
  'shared/Track.tsx::Track': () => (
    <Track kind="hp" value={2} max={6} onChange={noop} label="HP" />
  ),
  'shared/Counter.tsx::Counter': () => (
    <Counter kind="stress" value={2} max={6} onChange={noop} label="STRESS" />
  ),
  'shared/Disclosure.tsx::Disclosure': () => (
    <Disclosure id="fixture" characterId="c1" label="Carried" summary="2 ITEMS" defaultOpen>
      <p>Inside the fold.</p>
    </Disclosure>
  ),

  'shared/Fold.tsx::Fold': () => (
    <Fold label="Examples" summary="SRD 1.0" defaultOpen>
      <p>Inside the fold.</p>
    </Fold>
  ),

  'shell/App.tsx::App': () => <App />,
  'shell/AppBoundary.tsx::AppBoundary': () => (
    <AppBoundary>inside the app boundary</AppBoundary>
  ),
  'shell/BackupBanner.tsx::BackupBanner': () => <BackupBanner />,
  // A `'write'` failure, so the retry chip is in the tree and the nameless-
  // control sweep below actually sees it. The message is the store's, quoted
  // rather than paraphrased, which is the rule the component is built on.
  'shell/CampaignNotSaved.tsx::CampaignNotSaved': () => (
    <CampaignNotSaved
      alert={{
        message:
          'This device is out of space. What is on this screen is only in this tab, so closing it now loses it.',
        retry: 'write',
        tryAgain: () => Promise.resolve(false),
      }}
    />
  ),
  'shell/Header.tsx::Header': () => <Header onboarding={false} />,
  'shell/LicenceFooter.tsx::LicenceFooter': () => <LicenceFooter />,
  'shell/Recovery.tsx::Recovery': () => <Recovery />,
  'shell/ScreenBoundary.tsx::ScreenBoundary': () => (
    <ScreenBoundary name="Test">inside the boundary</ScreenBoundary>
  ),
  'shell/ShellBanner.tsx::ShellBanner': () => (
    <ShellBanner urgent action={{ label: 'DO IT', onClick: noop }} dismissLabel="Dismiss this">
      the banner both shell banners are
    </ShellBanner>
  ),
  'shell/TabBar.tsx::TabBar': () => <TabBar />,
  'shell/UpdateBanner.tsx::UpdateBanner': () => <UpdateBanner apply={noop} />,
};

/**
 * Components that draw nothing with this fixture, and why.
 *
 * Rendering `null` is a legitimate answer for a panel that only exists in a
 * state the fixture is not in. It is written down rather than tolerated,
 * because "this drew nothing" and "this is broken" look identical from here,
 * and the four defects that reached users all looked like the first.
 */
const DRAWS_NOTHING: Record<string, string> = {
  'player/Beastform.tsx::Beastform': 'Only a class with a Beastform draws it; the fixture is a Bard.',
  'player/DeathMove.tsx::DeathMoveOffer': 'The fixture has HP left, so no death move is offered.',
};

/** Every PascalCase value export under `src/ui`, derived rather than listed. */
function exportedComponents(): string[] {
  const UI = join(process.cwd(), 'src/ui');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return walk(path);
      return entry.endsWith('.tsx') ? [path] : [];
    });

  const found: string[] = [];
  for (const path of walk(UI)) {
    const rel = relative(UI, path).split(sep).join('/');
    const source = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const match of source.matchAll(/^export (?:function|class) ([A-Z]\w*)/gm)) {
      found.push(`${rel}::${match[1]!}`);
    }
    // Arrow components too: `export const Thing = (…) => …`. SCREAMING_CASE
    // constants are excluded by requiring a lowercase letter in the name.
    for (const match of source.matchAll(/^export const ([A-Z]\w*[a-z]\w*)\s*(?::[^=]+)?=\s*\(/gm)) {
      found.push(`${rel}::${match[1]!}`);
    }
  }
  return [...new Set(found)].sort();
}

describe('every component in src/ui', () => {
  const components = exportedComponents();

  it('finds components to mount', () => {
    expect(components.length).toBeGreaterThan(50);
  });

  it('has a fixture for every one of them', () => {
    const uncovered = components.filter((name) => !(name in COMPONENTS));
    expect(
      uncovered,
      'these components are exported and nothing here ever mounts them:\n' +
        uncovered.map((n) => `  ${n}`).join('\n') +
        '\n\nEvery defect this app has shipped to a user was in a render path no test ' +
        'had ever executed. Add a fixture, even a trivial one.',
    ).toEqual([]);
  });

  it('mounts nothing that no longer exists', () => {
    const known = new Set(components);
    const stale = Object.keys(COMPONENTS).filter((name) => !known.has(name));
    expect(stale, `fixtures for components that are gone: ${stale.join(', ')}`).toEqual([]);
  });

  for (const [name, element] of Object.entries(COMPONENTS)) {
    it(`mounts ${name}`, async () => {
      seed();
      const warnings = captureWarnings();
      await render(element());

      expect(warnings(), `${name} made React complain while it rendered`).toEqual([]);

      const drew = (container.textContent ?? '').trim().length > 0 || container.children.length > 0;
      if (name in DRAWS_NOTHING) {
        expect(drew, `${name} is listed as drawing nothing and drew something`).toBe(false);
      } else {
        expect(drew, `${name} mounted and put nothing on the page`).toBe(true);
      }

      // A control with no name is a control a screen reader announces as
      // "button", and one a person with a touchscreen cannot ask about. Six
      // dialogs in this app already carry `role` and `aria-modal`, so the
      // standard is the project's own rather than an imported one.
      expect(nameless(), `${name} draws a control with no name anywhere`).toEqual([]);
    });
  }
});

/** Buttons and inputs whose name is nowhere: no text, no label, no title. */
function nameless(): string[] {
  const named = (el: Element): boolean =>
    (el.textContent ?? '').trim() !== '' ||
    el.getAttribute('aria-label') !== null ||
    el.getAttribute('aria-labelledby') !== null ||
    el.getAttribute('title') !== null;
  return [...container.querySelectorAll('button, [role="button"]')]
    .filter((el) => !named(el))
    .map((el) => el.outerHTML.slice(0, 140));
}
