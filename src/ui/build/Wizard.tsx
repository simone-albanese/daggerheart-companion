/**
 * Character creation, one decision at a time.
 *
 * A wizard rather than one long sheet because the steps are not independent -
 * the class decides the domains, the domains decide which cards you may take,
 * the armor decides the thresholds - and a form that shows all of it at once
 * asks a new player to hold the dependency graph in their head.
 *
 * This file is the screen only. What a character in progress is, and what is
 * still missing from it, live in creation.ts, which knows nothing about React.
 * The step components below read that model; they never invent a second opinion
 * about whether a choice was required.
 *
 * The header never moves; the step panel scrolls. On a phone the rail collapses
 * to a hairline and Back/Next live in the thumb arc, because creation is the
 * one flow long enough that you will do part of it standing up.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  TRAITS,
  TRAIT_LABELS,
  TRAIT_VERBS,
  type Ancestry,
  type CharClass,
  type Ref,
  type Trait,
} from '../../../shared/types.ts';
import { deriveStats, newCharacter, syncCounters } from '../../engine/character.ts';
import { ignoresBurden } from '../../engine/burden.ts';
import { CHARACTER_NAMES, judgeName } from '../../store/names.ts';
import { cryptoRng } from '../../engine/dice.ts';
import { useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { Fold } from '../shared/Fold.tsx';
import { RuleTableView } from '../shared/RuleTableView.tsx';
import { NameRefusal } from '../shared/NameRefusal.tsx';
import { playerExperiences } from '../shared/srdReference.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import {
  BASE_STARTING_CARDS,
  cardCountWord,
  startingCardAllowance,
  startingCardGrants,
} from './cardAllowance.ts';
import {
  assemble,
  emptyDraft,
  furthestReachable,
  heldAt,
  noteLine,
  POTIONS,
  review,
  STARTER_KIT,
  STEPS,
  stepNumber,
  stepsDone,
  type Blocker,
  type Draft,
  type StepId,
  type Warning,
} from './creation.ts';
import { tierNote, weaponNote } from './gear.ts';
import {
  ArmorPicker,
  armorSummary,
  GearSlot,
  WeaponPicker,
  weaponSummary,
} from './GearPicker.tsx';
import {
  Callout,
  Choice,
  Columns,
  DatasetEmpty,
  ExperienceEditor,
  FeatureBlock,
  GoldEditor,
  InventoryEditor,
  LabelledInput,
  Mark,
  Section,
  Segmented,
} from './parts.tsx';
import { srdStamp } from '../../store/dataset.ts';

/** The fixed array the traits step distributes. Placed, never rolled. */
const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1] as const;
const TRAIT_VALUES = [2, 1, 0, -1] as const;

/** Which equipment slot the picker is open for. */
type Slot = 'primary' | 'secondary' | 'armor';

function poolRemaining(traits: Draft['traits']): Map<number, number> {
  const pool = new Map<number, number>();
  for (const v of TRAIT_ARRAY) pool.set(v, (pool.get(v) ?? 0) + 1);
  for (const t of TRAITS) {
    const v = traits[t];
    if (v !== undefined) pool.set(v, (pool.get(v) ?? 0) - 1);
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Choosing from prose
// ---------------------------------------------------------------------------

/**
 * A `Choice` with the SRD's own description of the thing under it, on request.
 *
 * The class, the ancestry and the community are the three decisions in this
 * wizard whose only evidence is a paragraph. They used to hand that paragraph
 * to `Choice`'s `body` under a `clamp` - three lines for the class, *two* for
 * the other two - which at `.t-dense`'s 11.5px/1.38 is a 15.87px line box, so
 * 48px of window for the class and 32px for the other two. Measured in Chrome
 * at 375x667 before the change: 95-158px hidden on each of the nine class
 * cards, 111-285 on each of the eighteen ancestries, 158-253 on each of the
 * nine communities. The two longer lists were under the tighter clamp.
 *
 * A fourth surface had no words at all. The Mixed Ancestry grids pass no
 * `body`, so switching the Segmented control from "One ancestry" to "Mixed
 * Ancestry" replaced two clipped lines with none - the same person, the same
 * step, one tap apart. Both mixed columns take this reader too, which is why
 * the same lineage's description is reachable from either of them: each card
 * is its own decision and each decision carries its own evidence.
 *
 * The clamp was not sloppy and this is worth saying plainly, because it decides
 * the shape of the fix. `clamp` is an opt-in prop, `-webkit-line-clamp` draws
 * its own ellipsis so the truncation is signposted where it happens, and the
 * facts a class is *compared* on - Evasion, Hit Points, domains - are in `meta`
 * above the clamp and were never inside it. So this is an addition, not a
 * repair: the three lines were the right three lines, and what was missing was
 * any way at all to read the rest without choosing first.
 *
 * The reader is a `Fold` and not a bigger clamp, a `title` or an overlay:
 *
 *   - a bigger clamp is the same defect with a different number, and no number
 *     fits thirty-six descriptions that run 509-1243 characters;
 *   - it cannot go *inside* the `Choice`, whose root is a `<button>`
 *     (parts.tsx) - a button inside a button is invalid HTML and this repo has
 *     already been bitten by it twice, recorded at parts.tsx and
 *     DomainCardView.tsx;
 *   - `Disclosure` is the wrong disclosure: it keys its open state into
 *     `prefs.playSections`, which Fold.tsx's own docblock defines as the Play
 *     screen's per-character folds and then spends eight lines forbidding a
 *     screen with no character from writing `'none:'` keys into it. Creation
 *     has no character. `Fold` was extracted for exactly this.
 *
 * Two targets, and a tap on either is unambiguous. The `Choice` is the
 * decision - `aria-pressed`, a filled `Mark` at its right edge, 369x52.8 on a
 * 393px phone and floored at `var(--tap)` by its own `minHeight`. The `Fold`
 * header is the reading target - `aria-expanded`, a rotated triangle, 369x44
 * exactly, the full width of the column. They are siblings separated by 6px, so
 * neither contains the other and a thumb landing in the gap does nothing rather
 * than doing the wrong one of the two. Reading a class does not select it.
 *
 * The reader is the *last* thing in the closed card, so opening it moves
 * nothing above it and nothing beside it - `Columns` sets `alignItems: 'start'`
 * so on a multi-column layout only that one grid cell grows. StepExperiences
 * wrote the rule this follows: a screen may grow underneath a hand, never
 * beneath it.
 *
 * What the shut card costs, measured at 393x852, one column: 104.8px, against
 * 108.38 for a three-line clamp and 92.52 for a two-line one. So the class step
 * came out 33px SHORTER (1497 -> 1464 of scroll) and the two two-line steps
 * came out longer - ancestry 2179 -> 2401 (+222 over eighteen cards), community
 * 1164 -> 1275 (+111 over nine). The Mixed Ancestry branch pays most, because
 * it had no prose at all to replace: 2603 -> 4403, +1800 over thirty-six cards,
 * against a 596px window. That is the price of the fourth surface not being
 * blank, and it is a scroll rather than a hidden paragraph.
 *
 * `summary` carries the page the words came from when the dataset knows it,
 * which is the stamp `StepExperiences` and the GM reference already use: in an
 * app whose whole discipline is quoting the SRD rather than paraphrasing it,
 * "whose words are these" is part of what the fold promises.
 */
function ChoiceWithReader({
  name,
  description,
  page,
  children,
}: {
  name: string;
  description: string;
  /** `sourcePage` is optional on every SRD record, so the stamp is too. */
  page?: number;
  /** The `Choice` itself. Drawn first; the reader is drawn under it. */
  children: React.ReactNode;
}): React.JSX.Element {
  // An imported dataset may carry a record with no description at all, and an
  // empty reader is a promise of text that is not there. `Choice` guards its
  // own `body` the same way.
  if (description === '') return <>{children}</>;

  return (
    <div className="stack" style={{ gap: 6 }}>
      {children}
      <Fold
        label={`About ${name}`}
        summary={srdStamp(page)}
      >
        <p className="t-read" style={{ margin: 0, padding: '0 2px', whiteSpace: 'pre-line' }}>
          {description}
        </p>
      </Fold>
    </div>
  );
}

export function Wizard({
  onCancel,
  onCreated,
}: {
  onCancel?: () => void;
  onCreated?: () => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const create = useApp((s) => s.create);
  const setScreen = useApp((s) => s.setScreen);
  /** The library this character is about to join, for the name guard. */
  const characters = useApp((s) => s.characters);
  const phone = useIsPhone();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const set = (patch: Partial<Draft>): void => setDraft((d) => ({ ...d, ...patch }));

  /** The write is in the air. Shown on the button; see `finish`. */
  const [creating, setCreating] = useState(false);
  /** What the device said when it refused, in its own words. */
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * The same fact as `creating`, kept where a second tap can see it.
   *
   * `disabled` closes the door on the next render, and two taps inside one
   * React batch are both dispatched before that render happens - which is
   * precisely the double-tap on a slow phone this is here to stop. A ref is
   * set synchronously, inside the first tap, so the second one finds it shut.
   * Both are kept: the ref makes it true, the disabled attribute makes it
   * visible and keeps the button off the tab order while it is true.
   */
  const writing = useRef(false);

  /*
   * Moving between steps takes the failure notice with it.
   *
   * It is a sentence about the button at the foot of the last step. Left
   * standing while the player goes back to change something, it would sit
   * under a step it is not about and compete with that step's own refusal.
   */
  const goTo = (n: number): void => {
    setFailed(null);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  };

  // A new step starts at its own top, never halfway down the last one's list.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [step]);

  const klass = dataset.classes.find((c) => c.id === draft.classRef);

  const done = useMemo(() => stepsDone(draft, klass, dataset), [draft, klass, dataset]);
  const { blockers, warnings } = useMemo(
    () => review(draft, klass, dataset, characters),
    [draft, klass, dataset, characters],
  );

  /*
   * Create the character, or say why there is no character.
   *
   * `create()` writes to IndexedDB *before* it touches the store, so a device
   * that refuses the write leaves nothing behind: no record, no entry in the
   * library, and twelve steps of choices sitting in this component's `useState`
   * and nowhere else. This used to be `void finish()` over an unguarded
   * `await`, so a refusal produced an unhandled rejection - which no error
   * boundary can see, `ScreenBoundary` being a render-phase boundary - and a
   * button that did nothing. Pressing it again did nothing again.
   *
   * The shape is `Edit.tsx`'s delete: settle the promise here, navigate on the
   * fulfilled side only, and put the device's own sentence on screen on the
   * other. Deliberately *not* routed through the store's `writeError`; the
   * commit message says why at length.
   */
  const finish = (): void => {
    if (blockers.length > 0 || !klass || writing.current) return;
    writing.current = true;
    setCreating(true);
    setFailed(null);
    // The starting HP, Stress, Hope and armor slots are not written down here:
    // `newCharacter` seeds the Hit Point track from the class - which is what
    // the index is for - and syncCounters settles every maximum against the
    // engine, the way a level up and an armor change already do.
    const sheet = newCharacter(assemble(draft, klass, dataset.consumables), index);
    void create(syncCounters(sheet, deriveStats(sheet, dataset, index))).then(
      () => {
        // Nothing is re-armed on this side on purpose. Both calls below unmount
        // this screen, and a button that goes live again on the way out is a
        // frame in which one more tap creates a second character.
        onCreated?.();
        setScreen('play');
      },
      (error: unknown) => {
        writing.current = false;
        setCreating(false);
        setFailed(error instanceof Error ? error.message : String(error));
      },
    );
  };

  const last = step === STEPS.length - 1;
  const current = STEPS[step] ?? STEPS[0];

  // What refuses the button under the player's thumb, if anything.
  //
  // Next only owes an answer for the step you are standing on: nobody should be
  // refused on the equipment screen for a community they have not picked four
  // screens back, because the screen they are on is where that gets fixed. The
  // last step's button is different - it creates the character - so it answers
  // for every blocker at once and names the step each one belongs to.
  const held = current === undefined ? null : heldAt(blockers, current.id);
  const stuck = last ? (blockers[0] ?? null) : held;
  const reason =
    stuck === null
      ? null
      : !last
        ? stuck.text
        : blockers.length === 1
          ? noteLine(stuck)
          : `${noteLine(stuck)} And ${blockers.length - 1} more, listed above.`;

  // The rail's gate and the nav's gate are the same gate; only the shape of the
  // refusal differs. The rail stops at a step that is not necessarily the one
  // being stood on - with a class chosen and no subclass yet, Next is free and
  // everything past the subclass is not - so its tooltip has to name that step
  // rather than repeating whatever the nav happens to be saying.
  const furthest = furthestReachable(blockers, step);
  const wall = STEPS[furthest];
  const wallBlocker = wall === undefined ? null : heldAt(blockers, wall.id);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <WizardHeader
        step={step}
        setStep={goTo}
        done={done}
        phone={phone}
        onCancel={onCancel}
        furthest={furthest}
        lockedReason={wallBlocker === null ? null : noteLine(wallBlocker)}
      />

      <div
        ref={panel}
        className="scroll"
        style={{ flex: 1, minHeight: 0, padding: phone ? '14px 12px 20px' : '18px 20px 24px' }}
      >
        <div className="stack" style={{ gap: 18, maxWidth: 980, margin: '0 auto' }}>
          {current !== undefined && (
            <StepBody
              id={current.id}
              draft={draft}
              set={set}
              klass={klass}
              blockers={blockers}
              warnings={warnings}
            />
          )}
          {/*
            The licence notice, and on a device with nothing on it yet this is
            the very first screen anybody sees - `openingScreen` sends an empty
            library to Build, and Build with an empty library is this wizard. It
            used to be a fixed strip under the nav below, which took at least
            the 126.16px the notice measures on a 369px column at 393x852 off
            every step of a flow whose whole job is fitting choices on a phone -
            a pinned strip painted a panel and its own horizontal padding on top
            of that. ("~111px" stood here; it was the estimate, and it was short
            by the border it forgot to add. `LicenceFooter.tsx` carries the
            measurement and how it was taken.)

            `pinnedBelow`: that nav is under this scroll at every width, so it
            is what is last in the window and it pays the home-indicator inset.
          */}
          <LicenceFooter pinnedBelow />
        </div>
      </div>

      <nav
        className="stack"
        aria-label="Wizard navigation"
        style={{
          flex: 'none',
          gap: 8,
          // Three longhands rather than the shorthand plus an override: a
          // `padding` shorthand followed by a `paddingBottom` is the same shape
          // as the `background` + `background*` pattern this repo bans, and it
          // reads correctly only if you know the key order is the cascade.
          paddingTop: phone ? 10 : 12,
          paddingInline: phone ? 12 : 20,
          /*
           * The home-indicator inset, above 720px only.
           *
           * This nav had never paid it and had never needed to: the shell drew
           * the licence strip underneath it, and that strip paid. With the
           * notice moved into the scroll above, this row is the last thing in
           * the window on every tablet and desktop, and an unpaid inset there
           * puts Back and Create under the indicator. On a phone `TabBar` is
           * still below and pays, so paying here as well would be the 34px of
           * empty panel that "exactly once" exists to prevent.
           *
           * `calc(0px + …)` so jsdom keeps the declaration and the sweep in
           * `attribution.test.tsx` can count it - see `TabBar.tsx`.
           */
          paddingBottom: phone ? 10 : 'calc(12px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--line-soft)',
          background: 'var(--panel)',
        }}
      >
        {/* On a phone this line is the only place a refusal can be read. The
            panel scrolls itself back to the top on every step change, so a
            message left at the foot of the step is a message nobody sees, and
            at 390px there is no room beside the buttons for it to sit. It
            appears only when something is actually being withheld: the rest of
            the time that vertical space belongs to the choices. */}
        {phone && reason !== null && (
          <span className="t-dense" role="status" style={{ color: 'var(--stress)' }}>
            {reason}
          </span>
        )}
        {/* A refused write, in the nav rather than at the top of the panel.
            The panel is scrolled back to its own top on every step change, and
            the last step is the longest one in the wizard - a message left up
            there is about two screens above the thumb that pressed the button.
            Above the row, not in it: this is read, and reading belongs outside
            the touch zone. */}
        {failed !== null && (
          <Callout
            tone="error"
            word="NOTHING WAS CREATED"
            items={[
              `This device refused to save the character: ${failed}`,
              'Every choice you have made is still on this screen and nowhere else, so closing this tab loses them. Try Create again, or fix what the message names first.',
            ]}
          />
        )}
        <div className="row" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            style={{ flex: phone ? 1 : 'none', minHeight: 48, minWidth: 108 }}
          >
            Back
          </button>
          {!phone &&
            (reason === null ? (
              <span className="t-meta" style={{ flex: 1, color: 'var(--dim)' }}>
                {last ? 'READY TO CREATE' : `NEXT — ${(STEPS[step + 1]?.title ?? '').toUpperCase()}`}
              </span>
            ) : (
              <span className="t-dense" role="status" style={{ flex: 1, color: 'var(--stress)' }}>
                {reason}
              </span>
            ))}
          {last ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={finish}
              disabled={blockers.length > 0 || creating}
              style={{ flex: phone ? 2 : 'none', minHeight: 48, minWidth: 168 }}
            >
              {creating ? 'Creating…' : 'Create character'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => goTo(step + 1)}
              disabled={held !== null}
              style={{ flex: phone ? 2 : 'none', minHeight: 48, minWidth: 128 }}
            >
              Next
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

/**
 * The step you are on, rendered.
 *
 * A switch on the step's id rather than on its position, so that adding a step
 * to STEPS fails to compile until it has a screen. The old chain of
 * `step === 4 && <StepEquipment/>` type-checked perfectly while pointing at the
 * wrong component, which is the exact mistake renumbering invites.
 */
function StepBody({
  id,
  draft,
  set,
  klass,
  blockers,
  warnings,
}: {
  id: StepId;
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  klass: CharClass | undefined;
  blockers: Blocker[];
  warnings: Warning[];
}): React.JSX.Element {
  switch (id) {
    case 'class':
      return <StepClass draft={draft} set={set} />;
    case 'subclass':
      return <StepSubclass draft={draft} set={set} klass={klass} />;
    case 'ancestry':
      return <StepAncestry draft={draft} set={set} />;
    case 'community':
      return <StepCommunity draft={draft} set={set} />;
    case 'traits':
      return <StepTraits draft={draft} set={set} />;
    case 'record':
      return <StepRecord klass={klass} armorRef={draft.armor} />;
    case 'equipment':
      return <StepEquipment draft={draft} set={set} klass={klass} />;
    case 'background':
      return <StepBackground draft={draft} set={set} klass={klass} />;
    case 'experiences':
      return <StepExperiences draft={draft} set={set} />;
    case 'cards':
      return <StepCards draft={draft} set={set} klass={klass} />;
    case 'connections':
      return <StepConnections draft={draft} set={set} klass={klass} />;
    case 'inventory':
      return (
        <StepGold draft={draft} set={set} klass={klass} blockers={blockers} warnings={warnings} />
      );
    default: {
      const unbuilt: never = id;
      throw new Error(`no screen for step "${String(unbuilt)}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function WizardHeader({
  step,
  setStep,
  done,
  phone,
  onCancel,
  furthest,
  lockedReason,
}: {
  step: number;
  setStep: (n: number) => void;
  done: boolean[];
  phone: boolean;
  onCancel?: () => void;
  /** The last step the rail may jump to. See `furthestReachable`. */
  furthest: number;
  /** Why the rail stops there, for the tooltip on a step it refuses. */
  lockedReason: string | null;
}): React.JSX.Element {
  const title = STEPS[step]?.title ?? '';

  if (phone) {
    return (
      <header
        className="stack"
        style={{ flex: 'none', background: 'var(--panel)', borderBottom: '1px solid var(--line-soft)' }}
      >
        <div className="spread" style={{ alignItems: 'center', padding: '0 12px', minHeight: 46 }}>
          <span className="row" style={{ gap: 9, minWidth: 0 }}>
            <span className="t-num" style={{ color: 'var(--hope)', flex: 'none' }}>
              {step + 1}/{STEPS.length}
            </span>
            <h2
              style={{
                margin: 0,
                font: '700 15px/1 var(--sans)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </h2>
          </span>
          {onCancel !== undefined && (
            <button
              type="button"
              className="t-meta"
              onClick={onCancel}
              style={{ minHeight: 'var(--tap)', minWidth: 'var(--tap)', flex: 'none' }}
            >
              CANCEL
            </button>
          )}
        </div>
        {/* The indicator is two pixels tall on purpose: vertical space on a
            phone belongs to the choices, not to the chrome. */}
        <div style={{ display: 'flex', gap: 2, height: 2, padding: '0 12px 0' }}>
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              style={{
                flex: 1,
                background:
                  i === step ? 'var(--hope)' : done[i] === true ? 'var(--muted)' : 'var(--empty)',
              }}
            />
          ))}
        </div>
      </header>
    );
  }

  return (
    <header
      className="stack"
      style={{
        flex: 'none',
        gap: 12,
        padding: '14px 20px 12px',
        background: 'var(--panel)',
        borderBottom: '1px solid var(--line-soft)',
      }}
    >
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <h2 className="row" style={{ margin: 0, gap: 12 }}>
          <span className="t-num" style={{ color: 'var(--hope)', fontSize: 15 }}>
            STEP {step + 1}
          </span>
          <span style={{ font: '800 20px/1 var(--sans)', letterSpacing: '-0.015em' }}>{title}</span>
        </h2>
        {onCancel !== undefined && (
          <button type="button" className="t-meta" onClick={onCancel} style={{ minHeight: 'var(--control)' }}>
            CANCEL
          </button>
        )}
      </div>
      {/* Backwards is always free: going back to change your class after
          reading its cards is ordinary play, not a mistake to be prevented.
          Forwards runs as far as the first step still holding you and stops
          there, because past it the rail would only be offering screens built
          on a choice that has not been made - a domain card list with no
          domains, thresholds with no armor. The step you are standing on is
          always inside the range, so no sequence of choices can leave you
          somewhere the rail then refuses to bring you back from. */}
      <ol
        className="row"
        style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none', flexWrap: 'wrap' }}
      >
        {STEPS.map((s, i) => {
          const here = i === step;
          const locked = i > furthest;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(i)}
                disabled={locked}
                aria-current={here ? 'step' : undefined}
                title={
                  locked && lockedReason !== null
                    ? `${lockedReason} Then step ${i + 1} opens.`
                    : `${i + 1}. ${s.title}`
                }
                className="row"
                /*
                 * `var(--control)`, not the 34 that used to be written here.
                 *
                 * This rail is only drawn from 720px up - below that the phone
                 * header above returns instead - and `--control` is
                 * `var(--tap)`, 44, on every viewport under 1180 and on every
                 * coarse pointer at any width. So a literal 34 was 10px under
                 * the touch floor across the whole band this rail exists in:
                 * measured at 744x1133, steps 1-9 drew 43.61x34 and steps
                 * 10-12 50.2x34, with computed min-height 0. It passed only at
                 * 1180+ with a mouse, where --control is 34 anyway.
                 *
                 * `minWidth` closes the other 0.39px: 11 + 11 padding + 2
                 * border + 7 gap + a 6px dot + 6.6px per mono digit is 43.61
                 * for a one-digit step, which is under 44 by a rounding error
                 * and under it all the same. Twelve buttons and eleven 4px
                 * gaps then measure ~570px against the 704px of content width
                 * a 744px tablet has, so the row still does not wrap and the
                 * whole cost of this is one band 10px taller.
                 */
                style={{
                  gap: 7,
                  justifyContent: 'center',
                  height: 'var(--control)',
                  minWidth: 'var(--control)',
                  padding: '0 11px',
                  borderRadius: 'var(--r2)',
                  background: here ? 'var(--raised)' : 'transparent',
                  border: `1px solid ${here ? 'var(--line)' : 'transparent'}`,
                  opacity: locked ? 0.38 : 1,
                }}
              >
                <span
                  className="t-num"
                  style={{ fontSize: 11, color: here ? 'var(--text)' : 'var(--dim)' }}
                >
                  {i + 1}
                </span>
                <span
                  aria-label={done[i] === true ? 'complete' : 'incomplete'}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: done[i] === true ? 'var(--ok)' : 'var(--empty)',
                  }}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Name and class
// ---------------------------------------------------------------------------

function StepClass({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const characters = useApp((s) => s.characters);
  const klass = dataset.classes.find((c) => c.id === draft.classRef);
  const refusalId = useId();
  /*
   * The same call `review` makes, on the same library, for the same sentence.
   *
   * Two readers of one function rather than two opinions: `review` owns whether
   * Create is allowed, this owns whether the person typing finds out before
   * they reach step twelve. `except` is deliberately absent - a draft is not in
   * the library yet, so there is nothing for it to be excused from colliding
   * with.
   */
  const { refusal, offer } = judgeName(draft.name, characters, CHARACTER_NAMES);

  return (
    <>
      {/*
        The hint used to read "You can fill these in at any point", which stopped
        being true of half this section the moment Name became a step-1 blocker:
        on a device holding an unnamed character the wizard refuses Next before
        anything is typed, while the words above the field said it could wait.
        Pronouns still can, and the hint now says which is which.
      */}
      <Section label="Identity" hint="Pronouns can wait; the name cannot">
        <Columns min={220}>
          {/*
            No `gap` between the field and its refusal: `NameRefusal` is mounted
            whether or not anything is being refused, and it carries its own
            6px when it has something in it. Same stack as the rename control's,
            for the same reason.
          */}
          <div className="stack">
            <LabelledInput
              label="Name"
              value={draft.name}
              onChange={(name) => set({ name })}
              placeholder="Unnamed"
              invalid={refusal !== null}
              describedBy={refusal === null ? undefined : refusalId}
            />
            <NameRefusal
              id={refusalId}
              refusal={refusal}
              offer={offer}
              onTake={(name) => set({ name })}
            />
          </div>
          <LabelledInput
            label="Pronouns"
            value={draft.pronouns}
            onChange={(pronouns) => set({ pronouns })}
            placeholder="they/them"
          />
        </Columns>
      </Section>

      <Section
        label="Choose a class"
        hint={`${dataset.classes.length} in this dataset`}
      >
        {dataset.classes.length === 0 ? (
          <DatasetEmpty what="classes" />
        ) : (
          <Columns min={280}>
            {dataset.classes.map((c) => (
              <ChoiceWithReader
                key={c.id}
                name={c.name}
                description={c.description}
                page={c.sourcePage}
              >
                <Choice
                  selected={draft.classRef === c.id}
                  onClick={() =>
                    set({
                      classRef: c.id,
                      // Everything downstream of the class stops being valid.
                      subclassRef: null,
                      cards: [],
                      background: [],
                      connections: [],
                      classItem: 0,
                    })
                  }
                  title={c.name}
                  meta={`EVASION ${c.startingEvasion} · ${c.startingHitPoints} HP · ${c.domains.join(' + ').toUpperCase()}`}
                  lead={
                    <span className="row" style={{ gap: 3, flex: 'none', marginTop: 2 }}>
                      <DomainMark domain={c.domains[0]} size={13} shapes={shapes} />
                      <DomainMark domain={c.domains[1]} size={13} shapes={shapes} />
                    </span>
                  }
                />
              </ChoiceWithReader>
            ))}
          </Columns>
        )}
      </Section>

      {klass && (
        <Section label={`${klass.name} features`} hint="Text, not automation">
          <div className="stack" style={{ gap: 8 }}>
            <FeatureBlock name={klass.hopeFeature.name} text={klass.hopeFeature.text} tag="HOPE" />
            {klass.classFeatures.map((f) => (
              <FeatureBlock key={f.name} name={f.name} text={f.text} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Subclass
// ---------------------------------------------------------------------------

/**
 * A screen of its own, because it used to be the bottom half of the class
 * screen: nine class cards and a block of feature text stood between the
 * heading and the second of that screen's two required choices, which on a
 * phone put it about two screens below the words that promised it. A choice
 * nobody scrolls to is a choice nobody makes.
 */
function StepSubclass({
  draft,
  set,
  klass,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  klass: CharClass | undefined;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const subclasses = dataset.subclasses.filter((s) => s.classRef === draft.classRef);

  if (!klass) {
    return (
      <Callout
        tone="warn"
        items={[`Choose a class at step ${stepNumber('class')} to see its subclasses.`]}
      />
    );
  }
  if (subclasses.length === 0) return <DatasetEmpty what={`subclasses for ${klass.name}`} />;

  return (
    <Section label="Choose a subclass" hint={`${klass.name.toUpperCase()} — YOU TAKE ITS FOUNDATION CARD`}>
      <Columns min={300}>
        {subclasses.map((s) => (
          <Choice
            key={s.id}
            selected={draft.subclassRef === s.id}
            onClick={() => set({ subclassRef: s.id })}
            title={s.name}
            meta={
              s.spellcastTrait === null
                ? 'NO SPELLCAST TRAIT'
                : `SPELLCAST · ${TRAIT_LABELS[s.spellcastTrait].toUpperCase()}`
            }
          >
            <span className="stack" style={{ gap: 6, width: '100%' }}>
              {s.foundationFeatures.map((f) => (
                <FeatureBlock key={f.name} name={f.name} text={f.text} tag="FOUNDATION" />
              ))}
            </span>
          </Choice>
        ))}
      </Columns>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Heritage: ancestry, then community
// ---------------------------------------------------------------------------

function AncestryFeature({ ancestry, which }: { ancestry: Ancestry; which: 0 | 1 }): React.JSX.Element {
  const f = ancestry.features[which];
  return <FeatureBlock name={f.name} text={f.text} tag={which === 0 ? 'FIRST' : 'SECOND'} />;
}

/**
 * Ancestry and community are the SRD's one heritage step, and they are two
 * screens here for the same reason the class and its subclass are: eighteen
 * ancestry cards stood between the top of the page and the nine communities,
 * so the second of the step's required choices was a long scroll past the
 * point where the page looked finished.
 */
function StepAncestry({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const top = dataset.ancestries.find((a) => a.id === draft.ancestryTop);
  const bottom = dataset.ancestries.find((a) => a.id === draft.ancestryBottom);

  if (dataset.ancestries.length === 0) return <DatasetEmpty what="ancestries" />;

  return (
    <>
      <Section
        label="Ancestry"
        hint="A Mixed Ancestry takes the first feature from one lineage and the second from another"
      >
        <div style={{ maxWidth: 380 }}>
          <Segmented
            label="Ancestry kind"
            value={draft.mixed ? 'mixed' : 'single'}
            onChange={(v) => set({ mixed: v === 'mixed', ancestryBottom: null })}
            options={[
              ['single', 'One ancestry'],
              ['mixed', 'Mixed Ancestry'],
            ]}
          />
        </div>

        {!draft.mixed ? (
          <Columns min={250}>
            {dataset.ancestries.map((a) => (
              <ChoiceWithReader
                key={a.id}
                name={a.name}
                description={a.description}
                page={a.sourcePage}
              >
                <Choice
                  selected={draft.ancestryTop === a.id}
                  onClick={() => set({ ancestryTop: a.id })}
                  title={a.name}
                  meta={`${a.features[0].name.toUpperCase()} · ${a.features[1].name.toUpperCase()}`}
                />
              </ChoiceWithReader>
            ))}
          </Columns>
        ) : (
          <Columns min={300}>
            <div className="stack" style={{ gap: 8 }}>
              <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                FIRST FEATURE FROM
              </span>
              {dataset.ancestries.map((a) => (
                <ChoiceWithReader
                  key={a.id}
                  name={a.name}
                  description={a.description}
                  page={a.sourcePage}
                >
                  <Choice
                    selected={draft.ancestryTop === a.id}
                    disabled={draft.ancestryBottom === a.id}
                    reason={draft.ancestryBottom === a.id ? 'Already your second lineage' : undefined}
                    onClick={() => set({ ancestryTop: a.id })}
                    title={a.name}
                    meta={a.features[0].name.toUpperCase()}
                  />
                </ChoiceWithReader>
              ))}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                SECOND FEATURE FROM
              </span>
              {dataset.ancestries.map((a) => (
                <ChoiceWithReader
                  key={a.id}
                  name={a.name}
                  description={a.description}
                  page={a.sourcePage}
                >
                  <Choice
                    selected={draft.ancestryBottom === a.id}
                    disabled={draft.ancestryTop === a.id}
                    reason={draft.ancestryTop === a.id ? 'Already your first lineage' : undefined}
                    onClick={() => set({ ancestryBottom: a.id })}
                    title={a.name}
                    meta={a.features[1].name.toUpperCase()}
                  />
                </ChoiceWithReader>
              ))}
            </div>
          </Columns>
        )}

        {(top || bottom) && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="t-label">
              {draft.mixed
                ? `Mixed: ${top?.name ?? '—'} / ${bottom?.name ?? '—'}`
                : (top?.name ?? '')}
            </span>
            {top && <AncestryFeature ancestry={top} which={0} />}
            {draft.mixed
              ? bottom && <AncestryFeature ancestry={bottom} which={1} />
              : top && <AncestryFeature ancestry={top} which={1} />}
          </div>
        )}
      </Section>
    </>
  );
}

function StepCommunity({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const community = dataset.communities.find((c) => c.id === draft.communityRef);

  if (dataset.communities.length === 0) return <DatasetEmpty what="communities" />;

  return (
    <Section label="Community" hint={`${dataset.communities.length} to choose from`}>
      <Columns min={250}>
        {dataset.communities.map((c) => (
          <ChoiceWithReader
            key={c.id}
            name={c.name}
            description={c.description}
            page={c.sourcePage}
          >
            <Choice
              selected={draft.communityRef === c.id}
              onClick={() => set({ communityRef: c.id })}
              title={c.name}
              meta={c.feature.name.toUpperCase()}
            />
          </ChoiceWithReader>
        ))}
      </Columns>
      {community && (
        <div className="stack" style={{ gap: 8 }}>
          <FeatureBlock name={community.feature.name} text={community.feature.text} tag="COMMUNITY" />
          {community.traits.length > 0 && (
            <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
              {community.traits.map((t) => (
                <span key={t} className="chip">
                  {t.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Character traits
// ---------------------------------------------------------------------------

function StepTraits({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}): React.JSX.Element {
  const pool = poolRemaining(draft.traits);
  const left = TRAITS.filter((t) => draft.traits[t] === undefined).length;

  const assign = (trait: Trait, value: number): void => {
    const next = { ...draft.traits };
    if (next[trait] === value) delete next[trait];
    else next[trait] = value;
    set({ traits: next });
  };

  return (
    <>
      <Section
        label="Assign the array"
        hint={left === 0 ? 'ALL SIX ASSIGNED' : `${left} STILL TO PLACE`}
      >
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {TRAIT_VALUES.map((v) => {
            const n = pool.get(v) ?? 0;
            return (
              <span
                key={v}
                className="chip"
                style={{
                  minHeight: 'var(--control)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  background: n > 0 ? 'var(--raised)' : 'transparent',
                  border: `1px solid ${n > 0 ? 'var(--line)' : 'var(--line-soft)'}`,
                  color: n > 0 ? 'var(--text)' : 'var(--dim)',
                }}
              >
                {v >= 0 ? '+' : '−'}
                {Math.abs(v)} × {n}
              </span>
            );
          })}
        </div>
        <p className="t-dense" style={{ margin: 0 }}>
          The SRD gives every character the same six modifiers — +2, +1, +1, +0, +0, −1 — to
          distribute in any order. Tap a value to place it; tap it again to take it back.
        </p>
      </Section>

      <Columns min={330} gap={8}>
        {TRAITS.map((t) => {
          const current = draft.traits[t];
          return (
            <div
              key={t}
              className="panel"
              style={{ padding: '10px 12px', display: 'grid', gap: 10 }}
            >
              <div className="spread" style={{ alignItems: 'baseline' }}>
                <span className="stack" style={{ gap: 4 }}>
                  <span style={{ font: '700 15px/1 var(--sans)' }}>{TRAIT_LABELS[t]}</span>
                  <span className="t-meta" style={{ color: 'var(--dim)' }}>
                    {TRAIT_VERBS[t].join(' · ').toUpperCase()}
                  </span>
                </span>
                <span
                  className="t-num"
                  style={{
                    font: '800 22px/1 var(--sans)',
                    color: current === undefined ? 'var(--empty)' : 'var(--text)',
                  }}
                >
                  {current === undefined
                    ? '—'
                    : `${current >= 0 ? '+' : '−'}${Math.abs(current)}`}
                </span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {TRAIT_VALUES.map((v) => {
                  const active = current === v;
                  const exhausted = (pool.get(v) ?? 0) <= 0 && !active;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => assign(t, v)}
                      disabled={exhausted}
                      aria-pressed={active}
                      aria-label={`${TRAIT_LABELS[t]} ${v >= 0 ? 'plus' : 'minus'} ${Math.abs(v)}`}
                      style={{
                        flex: 1,
                        minHeight: 'var(--tap)',
                        borderRadius: 'var(--r2)',
                        border: `1px solid ${active ? 'var(--text)' : 'var(--line)'}`,
                        background: active ? 'var(--text)' : 'var(--app)',
                        color: active ? 'var(--app)' : 'var(--text-2)',
                        font: '700 15px/1 var(--mono)',
                        opacity: exhausted ? 0.32 : 1,
                      }}
                    >
                      {v >= 0 ? '+' : '−'}
                      {Math.abs(v)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Columns>
    </>
  );
}

// ---------------------------------------------------------------------------
// Level, Evasion & HP — the numbers the class hands you
// ---------------------------------------------------------------------------

function Readout({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}): React.JSX.Element {
  return (
    <div className="panel stack" style={{ padding: '12px 13px', gap: 7 }}>
      <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
        {label}
      </span>
      <span style={{ font: '800 28px/1 var(--sans)', letterSpacing: '-0.02em' }}>{value}</span>
      {note !== undefined && (
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {note}
        </span>
      )}
    </div>
  );
}

function StepRecord({
  klass,
  armorRef,
}: {
  klass: CharClass | undefined;
  armorRef: Ref | null;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);

  if (!klass) {
    return (
      <Callout
        tone="warn"
        items={[`Choose a class at step ${stepNumber('class')} and these numbers fill in.`]}
      />
    );
  }

  // Every number here is the engine's, read off a sheet built from the choices
  // made so far - not the book transcribed a second time. Anything typed in
  // this component would be a number that could disagree with Play.
  const sheet = newCharacter({ classRef: klass.id, activeArmor: armorRef, level: 1 });
  const stats = deriveStats(sheet, dataset, index);
  const armor = armorRef === null ? undefined : index.armors.get(armorRef);

  return (
    <>
      <Section label="Recorded at level 1" hint="Read only — the class decides these">
        <Columns min={150}>
          <Readout label="LEVEL" value={String(sheet.level)} note="EVERY CAMPAIGN STARTS HERE" />
          <Readout label="EVASION" value={String(stats.evasion)} note={`FROM ${klass.name.toUpperCase()}`} />
          <Readout label="HIT POINTS" value={String(stats.maxHp)} note={`FROM ${klass.name.toUpperCase()}`} />
          <Readout label="STRESS" value={String(stats.maxStress)} note="EVERY PC STARTS THE SAME" />
          <Readout
            label="HOPE"
            value={`${sheet.hope.marked} / ${stats.maxHope}`}
            note="TWO MARKED AT CREATION"
          />
          <Readout label="PROFICIENCY" value={String(stats.proficiency)} note="ONE DAMAGE DIE" />
        </Columns>
      </Section>
      <Section label="Damage thresholds">
        {armor ? (
          <Readout
            label={`${armor.name.toUpperCase()} + LEVEL ${sheet.level}`}
            value={`${stats.thresholds[0]} / ${stats.thresholds[1]}`}
            note={`MAJOR / SEVERE · ARMOR SCORE ${stats.armorScore}`}
          />
        ) : (
          <Callout
            tone="info"
            word="THRESHOLDS"
            items={[
              `Your thresholds are your armor’s base thresholds plus your level. Pick armor at step ${stepNumber('equipment')} and they appear here.`,
            ]}
          />
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Starting equipment
// ---------------------------------------------------------------------------

export function StepEquipment({
  draft,
  set,
  klass,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  klass: CharClass | undefined;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const [open, setOpen] = useState<Slot | null>(null);

  // The picker's numbers have to come from somewhere and there is no character
  // yet, so one is assembled from what has been decided so far and handed to
  // the same engine the finished sheet will use. Nothing is transcribed twice.
  const sheet = useMemo(
    () => newCharacter({ classRef: klass?.id ?? '', level: 1, activeArmor: draft.armor }),
    [klass, draft.armor],
  );
  const stats = useMemo(() => deriveStats(sheet, dataset, index), [sheet, dataset, index]);

  const primary = draft.primary === null ? undefined : index.weapons.get(draft.primary);
  const secondary = draft.secondary === null ? undefined : index.weapons.get(draft.secondary);
  const armor = draft.armor === null ? undefined : index.armors.get(draft.armor);
  /*
   * The one question the burden sentence turns on, asked of the same assembled
   * sheet the pickers get their numbers from - so the wizard and `Edit.tsx` are
   * reading one predicate and cannot end up disagreeing about whose hands are
   * being counted. `burden.ts` says why that sheet is the right caller and why
   * there is no class-shaped shortcut past it.
   */
  const ignoring = ignoresBurden(sheet, index);

  if (dataset.weapons.length === 0) return <DatasetEmpty what="weapons or armor" />;

  return (
    <>
      <Section
        label="Starting equipment"
        hint="The SRD starts you at tier 1. Everything else is in the pickers, marked with the level it arrives at."
      >
        <div className="stack" style={{ gap: 16 }}>
          <GearSlot
            label="Primary weapon"
            title={primary?.name ?? null}
            meta={primary && weaponSummary(primary, stats)}
            note={weaponNote({
              slot: 'primary',
              weapon: primary,
              primary,
              level: sheet.level,
              ignoresBurden: ignoring,
            })}
            empty={`Search ${dataset.weapons.length} weapons`}
            onOpen={() => setOpen('primary')}
            /*
             * PUTTING SOMETHING DOWN, WITHOUT OPENING THE DIALOG TO DO IT.
             *
             * The capability was never missing: `WeaponPicker` draws an
             * `Unequip` button and `ArmorPicker` an `Unarmored`, both of which
             * call `onPick(null)`, and this `set` has always taken it. What was
             * missing is that you had to know the way out was inside the room
             * you were trying to leave - and the off-hand slot beside this one,
             * and all three slots on the sheet, have shown a ✕ the whole time.
             * So this is discoverability and parity, not a new power.
             */
            onClear={() => set({ primary: null })}
          />
          <GearSlot
            label="Secondary weapon"
            title={secondary?.name ?? null}
            meta={secondary && weaponSummary(secondary, stats)}
            /*
             * ONLY WHEN THERE IS SOMETHING IN THIS HAND.
             *
             * This fired on `twoHanded && primary`, which never looked at the
             * off-hand at all: an empty optional slot carried "there is no hand
             * left for an off-hand weapon" for as long as the primary was
             * two-handed, which is a warning about a weapon nobody has picked.
             * And it was said to everybody, including the one class the book
             * writes the exception for. `weaponNote` answers null for both.
             */
            note={weaponNote({
              slot: 'secondary',
              weapon: secondary,
              primary,
              level: sheet.level,
              ignoresBurden: ignoring,
            })}
            empty="Optional"
            onOpen={() => setOpen('secondary')}
            onClear={() => set({ secondary: null })}
          />
          <GearSlot
            label="Armor"
            title={armor?.name ?? null}
            meta={armor && armorSummary(armor, stats.thresholds, stats.armorScore)}
            note={armor && tierNote(armor.tier, sheet.level)}
            empty={`Search ${dataset.armors.length} sets of armor`}
            onOpen={() => setOpen('armor')}
            onClear={() => set({ armor: null })}
          />
        </div>
      </Section>

      {open === 'armor' ? (
        <ArmorPicker
          rng={cryptoRng}
          value={draft.armor}
          sheet={sheet}
          onPick={(ref) => {
            set({ armor: ref });
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      ) : (
        open !== null && (
          <WeaponPicker
            rng={cryptoRng}
            slot={open}
            value={open === 'primary' ? draft.primary : draft.secondary}
            sheet={sheet}
            stats={stats}
            onPick={(ref) => {
              /*
               * ONE SLOT PER PICK. The other hand is not touched.
               *
               * This read `secondary: picked?.burden === 2 ? null :
               * draft.secondary`, under a comment saying that a two-handed
               * primary leaves no hand for an off-hand weapon so taking one
               * puts the secondary down. The rule it named is real - folio 55,
               * *"your character's maximum burden is 2 hands"* - and acting on
               * it here was wrong twice over.
               *
               * The book names an exception this code never read: folio 28,
               * Combat Training, *"You ignore burden when equipping weapons."*
               * So a Warrior - the one class the sentence was written for - had
               * a weapon taken off them by a limit they do not have.
               *
               * And for everybody else it deleted a choice already made,
               * silently, as a side effect of filling a different slot. The
               * sheet had already refused exactly this edit, in writing: *"Said,
               * not enforced. A sheet that quietly unequipped the off-hand when
               * a greatsword arrived would be the app making a call the table
               * gets to make."* Two screens, one question, two answers - and the
               * wizard's was the one nobody could undo, because it threw the ref
               * away before the player saw the next screen.
               *
               * What stands in its place is a sentence on the slot itself.
               */
              set(open === 'primary' ? { primary: ref } : { secondary: ref });
              setOpen(null);
            }}
            onClose={() => setOpen(null)}
          />
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Background and connections — the class's written questions
// ---------------------------------------------------------------------------

function QuestionList({
  questions,
  answers,
  onChange,
  emptyNote,
}: {
  questions: string[];
  answers: string[];
  onChange: (next: string[]) => void;
  emptyNote: string;
}): React.JSX.Element {
  if (questions.length === 0) {
    return <Callout tone="warn" items={[emptyNote]} />;
  }
  return (
    <div className="stack" style={{ gap: 14 }}>
      {questions.map((q, i) => (
        <label key={q} className="stack" style={{ gap: 7 }}>
          <span className="t-body" style={{ color: 'var(--text-2)' }}>
            {q}
          </span>
          <textarea
            value={answers[i] ?? ''}
            onChange={(e) => {
              const next = [...answers];
              while (next.length < questions.length) next.push('');
              next[i] = e.target.value;
              onChange(next);
            }}
            rows={2}
            placeholder="Answer, change the question, or leave it for play to discover"
            style={{ minHeight: 72 }}
          />
        </label>
      ))}
    </div>
  );
}

function StepBackground({
  draft,
  set,
  klass,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  klass: CharClass | undefined;
}): React.JSX.Element {
  return (
    <Section
      label="Background questions"
      hint={klass ? klass.name.toUpperCase() : undefined}
    >
      <p className="t-dense" style={{ margin: 0 }}>
        Your background has no mechanical effect, but it shapes the character you play and the prep
        the GM does. Modify or replace any question that does not fit.
      </p>
      <QuestionList
        questions={klass?.backgroundQuestions ?? []}
        answers={draft.background}
        onChange={(background) => set({ background })}
        emptyNote={`Choose a class at step ${stepNumber('class')} to see its background questions.`}
      />
      <p className="t-meta" style={{ margin: 0, color: 'var(--dim)' }}>
        SAVED INTO THE CHARACTER'S NOTES
      </p>
    </Section>
  );
}

function StepConnections({
  draft,
  set,
  klass,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  klass: CharClass | undefined;
}): React.JSX.Element {
  return (
    <Section label="Connection questions" hint={klass ? klass.name.toUpperCase() : undefined}>
      <p className="t-dense" style={{ margin: 0 }}>
        Connections are the relationships between the player characters. Ask another player these at
        the table — and it is fine to leave some blank; a party discovers most of this in play.
      </p>
      <QuestionList
        questions={klass?.connectionQuestions ?? []}
        answers={draft.connections}
        onChange={(connections) => set({ connections })}
        emptyNote={`Choose a class at step ${stepNumber('class')} to see its connection questions.`}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Experiences
// ---------------------------------------------------------------------------

/**
 * Exported, following `StepCards` below and for the same stated reason: a test
 * has to be able to render this screen's own markup, and getting here by
 * tapping means driving seven screens in a runner with no DOM.
 *
 * ## What was wrong with it
 *
 * It printed a paragraph somebody had typed out of the book. Two defects in
 * one: the caution against a too-broad Experience was a paraphrase of a rule -
 * which is how a house rule gets written by accident, and is the thing
 * `shared/ruleText.ts` exists to stop - and the five examples beside it were
 * five names out of about ninety, transcribed into a `.tsx` file. The SRD
 * carries the rule and all ninety, and the app ships the SRD.
 *
 * So the rule is read out of `character-creation` at render time and the
 * examples are behind a fold. Note what does *not* change: this is not a second
 * home for the examples, it is the only home, and it now shows all of them.
 *
 * The two `placeholder` strings in `ExperienceEditor` (`parts.tsx`) are also
 * SRD names and they stay. A placeholder is not content - it is the shape of an
 * answer, drawn in the field it belongs to - and removing them would leave two
 * unlabelled boxes with nothing to say what goes in them.
 *
 * ## Ergonomics, 393x852
 *
 * The fold sits **below** the two fields, not between them and the rule. It is
 * a 44px full-width header either way, but opening it from above would push the
 * two inputs about 420px down the screen while a thumb was resting on them; a
 * screen may grow underneath a hand, never beneath it. Shut, the step is the
 * same height it was, because the paragraph it replaces was four lines and the
 * SRD's rule is four lines and a fold header.
 */
export function StepExperiences({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const srd = useMemo(() => playerExperiences(dataset.rules), [dataset]);
  const stamp = srdStamp(srd.page);

  return (
    <Section label="Two Experiences, each at +2" hint="Spend a Hope to add one to a roll">
      {srd.lead?.parts.map((part, i) => {
        if (part.kind === 'text') {
          return (
            <p key={`t${String(i)}`} className="t-dense" style={{ margin: 0 }}>
              {part.text}
            </p>
          );
        }
        // The lead is prose and bullets in the shipped dataset and carries no
        // table. A rules layer may write one there, and drawing it with the
        // app's one table renderer is cheaper than a screen that quietly drops
        // a paragraph of somebody's homebrew.
        if (part.kind === 'table') {
          return <RuleTableView key={`b${String(i)}`} table={part.table} />;
        }
        return (
          <ul
            key={`l${String(i)}`}
            className="stack"
            style={{ gap: 5, margin: 0, paddingLeft: 18 }}
          >
            {part.items.map((item) => (
              <li key={item} className="t-dense">
                {item}
              </li>
            ))}
          </ul>
        );
      })}
      <ExperienceEditor
        value={draft.experiences}
        onChange={(experiences) => set({ experiences })}
        minRows={2}
        lockBonus
      />
      {srd.groups.length > 0 && (
        <Fold label={srd.title} summary={stamp}>
          {srd.groups.map((group) => (
            <span key={group.label} className="stack" style={{ gap: 3 }}>
              <span className="t-meta">{group.label}</span>
              <span className="t-dense">{group.text}</span>
            </span>
          ))}
        </Fold>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Domain cards
// ---------------------------------------------------------------------------

/**
 * Exported, alone among the step screens, so a test can render it.
 *
 * Two things land here that land nowhere else: how many cards this character
 * takes, which is not always two, and whether a card can be read without being
 * opened. Both were wrong until recently and both were wrong in a way every
 * unit test agreed with, so the evidence that they are right has to be this
 * screen's own markup rather than the functions behind it. Getting here by
 * tapping would mean driving eight screens, including an equipment picker, in a
 * runner with no DOM.
 */
export function StepCards({
  draft,
  set,
  klass,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  klass: CharClass | undefined;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const phone = useIsPhone();

  if (!klass) {
    return (
      <Callout tone="warn" items={[`Choose a class at step ${stepNumber('class')} to see its domains.`]} />
    );
  }

  const cards = dataset.domainCards
    .filter((c) => c.level === 1 && klass.domains.includes(c.domain))
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));

  if (cards.length === 0) return <DatasetEmpty what="domain cards" />;

  // Two, unless the subclass says three. Nothing else on this screen would tell
  // a School of Knowledge wizard that Prepared owes them another card, so the
  // heading carries the number and the hint carries the reason.
  const grants = startingCardGrants([draft.subclassRef], dataset);
  const allowance = startingCardAllowance([draft.subclassRef], dataset);
  const why =
    grants.length === 0
      ? ''
      : ` — ${cardCountWord(allowance - BASE_STARTING_CARDS).toUpperCase()} EXTRA FROM ${grants
          .map((g) => g.feature.toUpperCase())
          .join(' AND ')}`;

  // "One from each, or two from one" stops being true the moment a subclass
  // pays for a third card, and an instruction that is wrong about the number is
  // worse than no instruction at all.
  const split =
    allowance === BASE_STARTING_CARDS
      ? 'ONE FROM EACH, OR TWO FROM ONE — WHICHEVER YOU PREFER'
      : `SPLIT THE ${cardCountWord(allowance).toUpperCase()} BETWEEN THEM HOWEVER YOU LIKE`;

  const toggle = (id: Ref): void => {
    if (draft.cards.includes(id)) set({ cards: draft.cards.filter((r) => r !== id) });
    else if (draft.cards.length < allowance) set({ cards: [...draft.cards, id] });
  };

  return (
    <Section
      label={`${cardCountWord(allowance)} level 1 cards`}
      hint={`${draft.cards.length} / ${allowance} CHOSEN${why}`}
    >
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {klass.domains.map((d) => (
          <span key={d} className="row chip" style={{ gap: 6, minHeight: 'var(--control)', padding: '0 9px' }}>
            <DomainMark domain={d} size={11} shapes={shapes} />
            <span style={{ textTransform: 'uppercase' }}>{d}</span>
          </span>
        ))}
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {split}
        </span>
      </div>

      {/* Wide columns, because this is the one grid in the app whose cards have
          to be read rather than recognised. 280px gives a 390px phone one card
          per row - a 342px text column, which is where every level 1 card in
          the SRD fits whole - and 290px stacks three in the 980px panel at
          295px each, where all but one does. The old 150/200px columns are what
          left a new player comparing six cards by their first three lines. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${phone ? 280 : 290}px, 1fr))`,
          gap: 12,
        }}
      >
        {cards.map((card) => {
          const taken = draft.cards.includes(card.id);
          const full = draft.cards.length >= allowance && !taken;
          return (
            // Two separate targets rather than a control nested inside the
            // card's own button: tapping the card reads it, the bar below
            // commits to it. Taking a card is a decision and earns its own tap.
            <div key={card.id} className="stack" style={{ gap: 6 }}>
              {/* The reading card: no banner, the rules text at reading size,
                  and no clamp. This is the one screen where the question is
                  "what does this do", and a card that answered it with three
                  lines and an ellipsis under a domain wordmark was answering a
                  different one. `height` is a floor here rather than a height -
                  the card grows to fit its text - and 168px is where the fourth
                  line sits, below which a card stops reading as a card. */}
              <DomainCardView
                card={card}
                shapes={shapes}
                onOpen={() => setOpenCard(card)}
                variant="reading"
                height={168}
                dimmed={full}
              />
              <button
                type="button"
                onClick={() => toggle(card.id)}
                disabled={full}
                aria-pressed={taken}
                className="row"
                style={{
                  gap: 8,
                  minHeight: 'var(--tap)',
                  justifyContent: 'center',
                  borderRadius: 'var(--r3)',
                  background: taken ? 'var(--raised)' : 'transparent',
                  border: `1px solid ${taken ? 'var(--line)' : 'var(--line-soft)'}`,
                  opacity: full ? 0.42 : 1,
                }}
              >
                <Mark on={taken} size={14} />
                <span
                  className="t-meta"
                  style={{ letterSpacing: '0.12em', color: taken ? 'var(--text)' : 'var(--muted)' }}
                >
                  {taken ? 'TAKEN' : full ? `${cardCountWord(allowance).toUpperCase()} ALREADY` : 'TAKE'}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Gold and inventory
// ---------------------------------------------------------------------------

function StepGold({
  draft,
  set,
  klass,
  blockers,
  warnings,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  klass: CharClass | undefined;
  blockers: Blocker[];
  warnings: Warning[];
}): React.JSX.Element {
  const kitLines = STARTER_KIT;

  return (
    <>
      <Section label="Starting kit" hint="From the SRD's step 5 inventory list">
        <Columns min={260}>
          {kitLines.map((line) => (
            <Choice
              key={line.key}
              selected={draft.kit[line.key] !== false}
              onClick={() => set({ kit: { ...draft.kit, [line.key]: draft.kit[line.key] === false } })}
              title={line.name}
              meta={line.tag}
            />
          ))}
        </Columns>
      </Section>

      {/* "One of the class-specific items listed on your character guide" - one,
          not both, so these exclude each other rather than being two toggles. */}
      {klass !== undefined && klass.classItems.length > 0 && (
        <Section label="One class item" hint={`${klass.name.toUpperCase()} — PICK ONE`}>
          <Columns min={260}>
            {klass.classItems.map((item, i) => (
              <Choice
                key={item}
                selected={draft.classItem === i}
                onClick={() => set({ classItem: draft.classItem === i ? null : i })}
                title={item}
                meta="CLASS ITEM"
              />
            ))}
          </Columns>
        </Section>
      )}

      <Section label="One potion" hint="Health or stamina — pick one">
        <Columns min={240}>
          {POTIONS.map((p) => (
            <Choice
              key={p.ref}
              selected={draft.potion === p.ref}
              onClick={() => set({ potion: draft.potion === p.ref ? null : p.ref })}
              title={p.name}
              body={p.text}
              accent="var(--ok)"
            />
          ))}
        </Columns>
      </Section>

      <Columns min={280}>
        <Section label="Gold" hint="10 handfuls to a bag · 10 bags to a chest">
          <GoldEditor gold={draft.gold} onChange={(gold) => set({ gold })} />
        </Section>
        <Section label="Anything else you carry">
          <InventoryEditor value={draft.inventory} onChange={(inventory) => set({ inventory })} />
        </Section>
      </Columns>

      {/* The last word before Create. Next now refuses at the step that owns
          each blocker, so on a straight run through nothing survives to be
          listed here - but a player who goes back and un-picks something, or a
          dataset that cannot offer a class at all, still arrives with one. Each
          line names the step it belongs to, because from here that step is a
          jump away rather than the one under your thumb. */}
      <Callout tone="error" items={blockers.map(noteLine)} />
      <Callout tone="warn" items={warnings.map(noteLine)} word="YOU CAN STILL CREATE" />
      {blockers.length === 0 && warnings.length === 0 && (
        <Callout tone="ok" items={['Every step is answered. Create the character.']} />
      )}
    </>
  );
}
