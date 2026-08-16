/**
 * The GM screen.
 *
 * These are personal tools. There is no session, no network, no player sheet on
 * the other side of a wire - a GM opens this the way they open a notebook, and
 * the only thing it owes them is that the notebook is still open where they
 * left it after the browser dies mid-fight.
 *
 * ## What changed, and why
 *
 * It used to be five regions behind a strip of tabs: encounter, scene, party,
 * bestiary, countdowns. Every one of them worked. What none of them was is *the
 * night* - a GM runs scene one, then an encounter, then scene two, in an order
 * they decided beforehand and change on the fly, and the app made them navigate
 * a menu to reach each one.
 *
 * So the session list is the screen, and the five regions are what a row opens.
 * The record has held that list since campaigns were built; nothing had ever
 * drawn it.
 *
 * ## This file is the integrator, and holds two pieces of state
 *
 * `tool` is which of the five is open over the list, or none. Each one is
 * rendered inside a `GmSheet` and **unmounted** when it closes - never hidden.
 * That is not tidiness: `PartyBoard`'s scanner opens the camera in an effect
 * and stops it on unmount, so a sheet kept alive behind `display: none` leaves
 * the camera running on a phone in a dark room. It costs the bestiary its
 * filter and the encounter builder its search on every close, which is exactly
 * what switching region cost before, so it is not a regression.
 *
 * `board.region` is the second, and it is the subtle one. Four call sites
 * outside this file already navigate by writing it - `Encounter` sends a roster
 * to the scene, `Bestiary` drops an adversary into it, `Scene`'s empty state
 * offers the other two - and all four keep working unedited because the effect
 * below follows *changes* to it. What that effect must never do is act on the
 * value it finds at mount: `emptyBoard()` sets `region: 'encounter'` and every
 * campaign record carries one, so an effect that opened whatever it read would
 * put the encounter builder over the session list every single time the GM
 * arrives - the exact five-menus behaviour this change exists to remove. Hence
 * the seeding ref, and hence the wait for `hydrated`: the region that arrives
 * from the disk a beat after mount is just as much a stored value as the one
 * that was there at mount.
 *
 * `sheet` is the third, and it is the shallow one: which of the bar's three
 * verbs is answering. A sheet and a tool are never both open. That is not
 * tidiness either - `useDialog` registers one unconditional window keydown
 * listener per dialog with no topmost check, so two live at once means one
 * Escape closing both and two Tab handlers fighting over the focus. Opening
 * either closes the other, and SHOW's two choices go through `openTool`, which
 * is what makes the sheet hand the screen over rather than stack on it.
 *
 * ## What is not here yet
 *
 * MENU: the way back out to Play, Cards and Build, and the campaign list. The
 * tab bar and the licence notice therefore stay exactly where they are until
 * it lands, because the bar is not a replacement for a door until it has one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLayout } from '../shared/useLayout.ts';
import { AddSheet } from './AddSheet.tsx';
import { Bestiary } from './Bestiary.tsx';
import { Countdowns } from './Countdowns.tsx';
import { Encounter } from './Encounter.tsx';
import { GmBar, type GmSheetId } from './GmBar.tsx';
import { GmSheet } from './GmSheet.tsx';
import { GmTopBar } from './GmTopBar.tsx';
import { useGm, type GmRegion } from './gmStore.ts';
import { PartyBoard } from './PartyBoard.tsx';
import { SaveSheet } from './SaveSheet.tsx';
import { Scene } from './Scene.tsx';
import { SessionList } from './SessionList.tsx';
import { ShowSheet } from './ShowSheet.tsx';

/** The dialog's accessible name, one per tool. */
const TOOL_LABEL: Record<GmRegion, string> = {
  encounter: 'Encounter builder',
  scene: 'The live scene',
  party: 'The party board',
  bestiary: 'Bestiary',
  countdowns: 'Fear and countdowns',
};

/** The same, one per sheet. A dialog with no name is a dialog nobody can find. */
const SHEET_LABEL: Record<GmSheetId, string> = {
  add: 'Add to the night',
  show: 'Bestiary and party board',
  save: 'Where this campaign is kept',
};

export function Gm(): React.JSX.Element {
  const layout = useLayout();
  const phone = layout === 'phone';
  const region = useGm((s) => s.region);
  const setRegion = useGm((s) => s.setRegion);
  const hydrated = useGm((s) => s.hydrated);
  const [tool, setTool] = useState<GmRegion | null>(null);
  const [sheet, setSheet] = useState<GmSheetId | null>(null);

  /*
   * The last value of `board.region` this screen has acted on.
   *
   * Null until the store has answered, and then seeded rather than opened: the
   * stored region says which tool was last open, which is worth keeping and is
   * not an instruction to open it. Only a change *after* that seeding is a
   * navigation, and the only things that make one are the four cross-links
   * inside the tools themselves.
   */
  const followed = useRef<GmRegion | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (followed.current === null || followed.current === region) {
      followed.current = region;
      return;
    }
    followed.current = region;
    setSheet(null);
    setTool(region);
  }, [hydrated, region]);

  const openTool = useCallback(
    (next: GmRegion) => {
      // Seeded before the write, so opening a tool from this screen is not
      // read back by the effect above as a navigation someone else asked for.
      followed.current = next;
      setSheet(null);
      setTool(next);
      setRegion(next);
    },
    [setRegion],
  );

  const openSheet = useCallback((next: GmSheetId) => {
    setTool(null);
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <GmTopBar layout={layout} onOpenTool={openTool} />
      <SessionList phone={phone} onOpenTool={openTool} />
      <GmBar open={sheet} onOpenSheet={openSheet} />

      {tool !== null && (
        <GmSheet label={TOOL_LABEL[tool]} size="full" onClose={() => setTool(null)}>
          {tool === 'encounter' && <Encounter phone={phone} />}
          {tool === 'scene' && <Scene phone={phone} />}
          {tool === 'party' && <PartyBoard phone={phone} />}
          {tool === 'bestiary' && <Bestiary phone={phone} />}
          {tool === 'countdowns' && <Countdowns phone={phone} />}
        </GmSheet>
      )}

      {sheet !== null && (
        <GmSheet label={SHEET_LABEL[sheet]} onClose={closeSheet}>
          {sheet === 'add' && <AddSheet onClose={closeSheet} />}
          {sheet === 'show' && <ShowSheet onOpenTool={openTool} />}
          {sheet === 'save' && <SaveSheet />}
        </GmSheet>
      )}
    </div>
  );
}
