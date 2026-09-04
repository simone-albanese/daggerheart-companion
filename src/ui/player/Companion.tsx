/**
 * The companion, inside the vitals panel.
 *
 * A Beastbound Ranger operates two creatures, but only one pair of thumbs. So
 * the companion does not get a screen of its own: it takes over the panel the
 * player's own Stress already lives in, in the same thumb arc, behind one
 * segmented control. Nothing moves, nothing new has to be learned, and the
 * things you touch mid-combat - their Stress, their attack - are exactly where
 * yours were.
 *
 * The live panel holds what a fight needs. The rest of the sheet - Experiences,
 * the eight level-up options, the numbers you set once - opens in a sheet over
 * the top, because a fight never needs them.
 */
import { useMemo, useState } from 'react';
import { RANGES, type Range } from '../../../shared/types.ts';
import type { DerivedStats } from '../../engine/character.ts';
import {
  COMPANION_START,
  companionDamage,
  companionIsAway,
  companionUpgradeAllowance,
  hasCompanionFeature,
  newCompanion,
  withCompanion,
} from '../../engine/companion.ts';
import { useActive, useApp } from '../../store/state.ts';
import type { Arming } from './attack.ts';
import { companionUpgrades, type CompanionUpgrade } from '../shared/srdReference.ts';
import { NameRefusal } from '../shared/NameRefusal.tsx';
import { Track } from '../shared/Track.tsx';
import { useDialog } from '../shared/useDialog.ts';

export type Who = 'you' | 'companion';

/**
 * The eight boxes, out of whatever dataset this device is running.
 *
 * Read here rather than passed down because both the panel and the sheet want
 * the count, and a prop threaded through one of them is the pair drifting.
 */
function useCompanionUpgrades(): CompanionUpgrade[] {
  const rules = useApp((s) => s.dataset.rules);
  return useMemo(() => companionUpgrades(rules), [rules]);
}

/** True when this character is owed a companion sheet, or already has one. */
export function useHasCompanion(): boolean {
  const character = useActive();
  const index = useApp((s) => s.index);
  if (!character) return false;
  return character.companion !== null || hasCompanionFeature(character, index);
}

/**
 * "YOU | COMPANION" - the same physical space, one tap apart.
 *
 * A RULE AND NOT A BOX, WHICH IS EIGHT PIXELS AND THE BINDING CASE. This was a
 * bordered box: `padding: 3` on all four edges and a 1px border on all four,
 * around two 44px segments, so it drew 52px to hold 44 of target. Every one of
 * those eight pixels was spent on the phone's tightest state - a companion open
 * in a Safari tab - where the sheet is measured against a 515px column, and
 * they bought nothing a hairline does not: the two segments already have their
 * own radius, their own fill and a 3px gutter between them, so what the box was
 * adding was a second statement of a grouping the segments make themselves.
 *
 * The boundary is now one rule under the strip, drawn as an inset shadow rather
 * than a `borderBottom`, because a border on a box whose height comes from its
 * child's `minHeight` ADDS that pixel to the column - which is the whole thing
 * this change exists to stop. The horizontal 3px stays: that one keeps the
 * segments off the edge and costs the column nothing.
 *
 * So a companion costs 44 plus `Vitals`'s own 6px phone gap - **50**, where it
 * was 58 - and `PlayPhone`'s budget says so in those terms.
 */
export function WhoSwitch({
  who,
  setWho,
  compact,
}: {
  who: Who;
  setWho: (w: Who) => void;
  compact: boolean;
}): React.JSX.Element {
  const character = useActive();
  const name = character?.companion?.name ?? '';
  return (
    <div
      className="row"
      style={{
        gap: 3,
        // Horizontal only. The vertical 3 was 6px of column on the state this
        // sheet has least room for; the horizontal 3 is the gutter that keeps
        // a 44px target off the panel's edge and is free.
        padding: '0 3px',
        flex: 'none',
        borderRadius: 'var(--r3)',
        background: 'var(--app)',
        // The boundary, as a rule under the strip. `inset` and not
        // `borderBottom` on purpose: this box takes its height from the
        // segments' `minHeight`, so a real border would add its pixel to the
        // column, and the pixel is the point.
        boxShadow: 'inset 0 -1px 0 var(--line-soft)',
      }}
    >
      {(
        [
          ['you', 'YOU'],
          ['companion', name === '' ? 'COMPANION' : name.toUpperCase()],
        ] as Array<[Who, string]>
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={who === id}
          onClick={() => setWho(id)}
          className="t-label"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: compact ? 34 : 44,
            borderRadius: 'var(--r2)',
            background: who === id ? 'var(--raised)' : 'transparent',
            color: who === id ? 'var(--text)' : 'var(--dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 8px',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A stepper for a number the player owns and the app must not guess. */
function Stepper({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}): React.JSX.Element {
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="t-meta" style={{ flex: 'none' }}>
        {label}
      </span>
      <button
        type="button"
        aria-label={`Lower ${label.toLowerCase()}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="chip"
        style={{ minWidth: 44, minHeight: 44, fontSize: 15 }}
      >
        −
      </button>
      <span
        style={{
          font: '800 19px/1 var(--sans)',
          minWidth: 'var(--control)',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Raise ${label.toLowerCase()}`}
        onClick={() => onChange(value + 1)}
        className="chip"
        style={{ minWidth: 44, minHeight: 44, fontSize: 15 }}
      >
        +
      </button>
    </div>
  );
}

interface PanelProps {
  stats: DerivedStats;
  layout: 'desktop' | 'phone';
  /**
   * Optional only because tests mount the panel on its own.
   *
   * There is no surface in `src/` that draws this without a roll behind it:
   * `Vitals` is the only mount and it always forwards one, and the party board
   * and the printed sheet draw their own companion lines from
   * `companionDamage` rather than from this component. The sentence that used
   * to stand here named surfaces the body docblock ninety lines below already
   * said do not exist - the audit that rewrote that one landed a docblock
   * short of this one.
   */
  arming?: Arming;
}

export function CompanionPanel({ stats, layout, arming }: PanelProps): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const upgrades = useCompanionUpgrades();
  const [sheet, setSheet] = useState(false);
  if (!character) return null;

  const companion = character.companion;
  const phone = layout === 'phone';

  if (companion === null) return <CreateForm />;

  const attack = companionDamage(companion, stats.proficiency);
  const named = companion.experiences.filter((e) => e.name !== '');
  const away = companionIsAway(companion);

  return (
    <div className="stack" style={{ gap: phone ? 8 : 12, minHeight: 0 }}>
      <div className="spread" style={{ alignItems: 'center' }}>
        <span className="stack" style={{ minWidth: 0 }}>
          <span
            style={{
              font: '800 17px/1 var(--sans)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {companion.name === '' ? 'Unnamed companion' : companion.name}
          </span>
          {companion.description !== '' && (
            <span className="t-meta" style={{ marginTop: 5, color: 'var(--muted)' }}>
              {companion.description.toUpperCase()}
            </span>
          )}
        </span>
        <span className="row" style={{ gap: 8, flex: 'none' }}>
          <span className="t-meta">EVASION</span>
          <span style={{ font: '800 24px/1 var(--sans)', letterSpacing: '-0.02em' }}>
            {companion.evasion}
          </span>
        </span>
      </div>

      <Track
        kind="stress"
        label="STRESS"
        value={companion.stress.marked}
        max={companion.stress.max}
        onChange={(v) =>
          update((c) => withCompanion(c, { stress: { ...companion.stress, marked: v } }))
        }
        readout={`${companion.stress.marked} / ${companion.stress.max} MARKED`}
        compact={!phone}
      />

      {/*
       * Out of the scene, which the track alone does not say.
       *
       * A full Stress track on the player's own sheet means Vulnerable; on this
       * one it means the animal has gone - *"they drop out of the scene (by
       * hiding, fleeing, or a similar action)"* - and the two are different
       * enough that leaving a player to infer it from a row of filled pips
       * would be the app knowing something and not saying it. It also says when
       * they are back, because that is the half a player has to plan around.
       */}
      {away && (
        <div
          className="t-meta"
          style={{
            padding: '9px 11px',
            borderRadius: 'var(--r3)',
            background: 'var(--app)',
            border: '1px solid var(--damage)',
            color: 'var(--damage)',
            lineHeight: 1.5,
          }}
        >
          OUT OF THE SCENE · BACK AT YOUR NEXT LONG REST, WITH 1 STRESS CLEARED
        </div>
      )}

      {/*
       * The attack, and - when there is a roll behind this panel - the control
       * that declares it.
       *
       * *"Make a Spellcast Roll to connect with your companion and command them
       * to take action... On a success, their damage roll uses your Proficiency
       * and their damage die."* This box printed the second half and could not
       * do the first, which is the shape `BACKLOG.md` P1-1 left open.
       *
       * It stays a `<div>` where no roll is mounted rather than becoming a
       * disabled button, because a dead control is worse than none. In `src/`
       * that case does not arise today - `Vitals` is the only thing that draws
       * this and it always has a roll behind it - so what the branch is really
       * for is the tests that mount this panel alone. Said plainly rather than
       * dressed up: an earlier version of this note named the GM's board and
       * the print preview, and neither of them mounts this component.
       *
       * The damage die is free text, so it can be something no one can roll.
       * When it is, the panel says so rather than printing the unmultiplied
       * string under a label promising it had Proficiency applied - and it does
       * not offer to arm a pool it has just refused.
       */}
      {(() => {
        const armed = arming?.source?.kind === 'companion';
        const armable = arming !== undefined && attack !== null && !away;
        const body = (
          <>
            <span className="stack">
              <span className="t-meta" style={{ letterSpacing: '0.1em' }}>
                ATTACK
              </span>
              <span className="t-meta" style={{ marginTop: 5, color: 'var(--muted)' }}>
                {armed ? 'ARMED · ' : ''}
                {companion.range.toUpperCase()} ·{' '}
                {companion.damageType === 'mag' ? 'MAGIC' : 'PHYSICAL'} ·{' '}
                {attack === null
                  ? 'SET A DAMAGE DIE IN THE SHEET'
                  : away
                    ? 'NOT WHILE THEY ARE OUT OF THE SCENE'
                    : `${companion.damage} × PROF ${stats.proficiency}`}
              </span>
            </span>
            <span
              className="t-num"
              style={{ color: attack === null ? 'var(--damage)' : 'var(--hope)', fontSize: 17 }}
            >
              {attack === null ? 'NO DIE' : attack.spec}
            </span>
          </>
        );
        const box = {
          alignItems: 'center' as const,
          padding: '9px 11px',
          minHeight: 'var(--tap)',
          textAlign: 'left' as const,
          width: '100%',
          borderRadius: 'var(--r3)',
          background: armed ? 'var(--hope-wash)' : 'var(--app)',
          border: '1px solid var(--line-soft)',
          borderLeft: `3px solid ${attack === null ? 'var(--damage)' : 'var(--hope)'}`,
        };
        return armable ? (
          <button
            type="button"
            className="spread"
            aria-pressed={armed}
            aria-label={`${armed ? 'Stop commanding' : 'Command'} ${
              companion.name === '' ? 'your companion' : companion.name
            } to attack — a Spellcast Roll, ${attack.spec} damage`}
            onClick={() => arming.arm(armed ? null : { kind: 'companion' })}
            style={box}
          >
            {body}
          </button>
        ) : (
          <div className="spread" style={box}>
            {body}
          </div>
        );
      })()}

      <div className="spread" style={{ alignItems: 'center' }}>
        <span
          className="t-meta"
          style={{
            color: 'var(--muted)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {named.length === 0
            ? 'NO EXPERIENCES YET'
            : named.map((e) => `${e.name.toUpperCase()} +${e.bonus}`).join(' · ')}
        </span>
        <button
          type="button"
          className="chip"
          onClick={() => setSheet(true)}
          style={{ minHeight: 44, padding: '0 12px', flex: 'none' }}
        >
          SHEET · {companion.upgrades.length}/{upgrades.length}
        </button>
      </div>

      {sheet && <CompanionSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

/** Steps 1-4 of the companion sheet, minus the ones the SRD fixes for you. */
function CreateForm(): React.JSX.Element {
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Labels sit beside their fields rather than above them: this form stands in
  // the vitals panel's place, and every stacked label it costs is a loadout row
  // clipped in half further up the phone.
  const field = { flex: 1, minWidth: 'var(--control)', minHeight: 44 };
  const legend = { flex: 'none' as const, width: 58 };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="t-read" style={{ margin: 0, color: 'var(--muted)' }}>
        Work with the GM to decide what kind of animal you have. They start with Evasion{' '}
        {COMPANION_START.evasion}, a {COMPANION_START.damage} damage die at{' '}
        {COMPANION_START.range} range and {COMPANION_START.experiences} Experiences at +
        {COMPANION_START.experienceBonus}.
      </p>
      <label className="row" style={{ gap: 8 }}>
        <span className="t-meta" style={legend}>
          NAME
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ashfoot"
          style={field}
        />
      </label>
      <label className="row" style={{ gap: 8 }}>
        <span className="t-meta" style={legend}>
          THEY ARE
        </span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A one-eyed hunting hawk"
          style={field}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={name.trim() === ''}
        onClick={() => {
          update((c) => ({ ...c, companion: newCompanion(name.trim(), description.trim()) }));
          pushLog({ kind: 'note', label: `${name.trim()} joins you`, detail: 'Companion created' });
        }}
      >
        TAKE THE COMPANION SHEET
      </button>
    </div>
  );
}

/** The whole sheet: the numbers you set once, and the eight level-up options. */
function CompanionSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  const character = useActive();
  const index = useApp((s) => s.index);
  const update = useApp((s) => s.update);
  const upgrades = useCompanionUpgrades();

  const companion = character?.companion ?? null;
  const dialog = useDialog(
    companion === null ? 'Companion sheet' : `${companion.name} — companion sheet`,
    onClose,
  );
  if (companion === null || character === null) return <div />;

  // After the guard, and not a hook: the allowance needs a character, and
  // faking one to keep the call above the early return would be inventing a
  // level and a subclass to count.
  const allowance = companionUpgradeAllowance(character, index);

  const set = (patch: Parameters<typeof withCompanion>[1]): void => {
    update((c) => withCompanion(c, patch));
  };

  const toggleUpgrade = (id: string): void => {
    set({
      upgrades: companion.upgrades.includes(id)
        ? companion.upgrades.filter((u) => u !== id)
        : [...companion.upgrades, id],
    });
  };

  const rangeStep = (delta: number): void => {
    const at = RANGES.indexOf(companion.range);
    const next = RANGES[Math.min(RANGES.length - 1, Math.max(0, at + delta))];
    if (next) set({ range: next as Range });
  };

  return (
    <div
      {...dialog}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgb(10 11 15 / 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="stack"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '100%',
          borderRadius: 'var(--r5)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderTop: '4px solid var(--hope)',
          overflow: 'hidden',
        }}
      >
        <div className="spread" style={{ padding: '14px 16px 10px', flex: 'none' }}>
          <span className="t-label">Companion sheet</span>
          {/*
           * Marked, and earned. The second number is a readout and not a gate -
           * every box below stays toggleable - which is the decision this sheet
           * has always made; what changes is that the app stops being silent
           * about a number it can work out. See `companionUpgradeAllowance`.
           */}
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {companion.upgrades.length} OF {upgrades.length} MARKED · {allowance} EARNED
          </span>
        </div>

        <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 14, padding: '0 16px' }}>
          {/*
           * The name, and the one thing this sheet used to let you take back.
           *
           * Creation refuses an empty name - the SRD asks for one, "give them a
           * name and add a picture of them" - and then this field let you clear
           * it again, after which the panel read "Unnamed companion" and the
           * YOU|COMPANION switch went back to saying COMPANION. Nobody was told
           * that would happen.
           *
           * Said, not refused. Every other field on this sheet commits as you
           * type, and a draft-and-SAVE control here for one field would be a
           * second interaction model on one dialog. So the field keeps writing
           * and the region below says what the sheet will read as - which is
           * `NameRefusal`'s whole job, and the reason it is a component rather
           * than a fourth hand-rolled sentence.
           *
           * No offer, because there is no rule here to offer around: a
           * companion's name collides with nothing. `judgeName` guards
           * characters, whose names have to tell two rows of a `<select>`
           * apart; two Rangers may both call their wolf Ash.
           */}
          <label className="stack" style={{ gap: 5, flex: 'none' }}>
            <span className="t-label">Name</span>
            <input
              value={companion.name}
              aria-describedby="companion-name-note"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <NameRefusal
            id="companion-name-note"
            refusal={
              companion.name.trim() === ''
                ? 'With no name they read as “Unnamed companion”, and the switch above goes back to saying COMPANION.'
                : null
            }
            offer={null}
            onTake={() => {
              // Unreachable: the button only exists beside an offer, and this
              // door never has one.
            }}
          />
          <label className="stack" style={{ gap: 5, flex: 'none' }}>
            <span className="t-label">What they are</span>
            <input
              value={companion.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>

          <div className="row" style={{ gap: 16, flexWrap: 'wrap', flex: 'none' }}>
            <Stepper
              label="EVASION"
              value={companion.evasion}
              onChange={(n) => set({ evasion: n })}
            />
            <Stepper
              label="STRESS SLOTS"
              value={companion.stress.max}
              min={1}
              onChange={(n) =>
                set({ stress: { marked: Math.min(companion.stress.marked, n), max: n } })
              }
            />
          </div>

          <div className="row" style={{ gap: 16, flexWrap: 'wrap', flex: 'none' }}>
            <label className="row" style={{ gap: 6 }}>
              <span className="t-meta">DAMAGE DIE</span>
              <input
                value={companion.damage}
                onChange={(e) => set({ damage: e.target.value })}
                placeholder="d6"
                style={{ width: 84, textAlign: 'center', font: '600 14px/1 var(--mono)' }}
              />
            </label>
            {/*
             * Step 4's other half: *"Choose whether they deal physical or magic
             * damage."* The app answered `phy` for every companion until the
             * sheet had somewhere to put the answer, which was wrong for a
             * raven at every table that ever used it - the wrong resistances
             * at the GM's end and PHY in the log.
             */}
            <div className="row" style={{ gap: 6 }}>
              <span className="t-meta">TYPE</span>
              {(
                [
                  ['phy', 'PHY'],
                  ['mag', 'MAG'],
                ] as Array<['phy' | 'mag', string]>
              ).map(([id, text]) => (
                <button
                  key={id}
                  type="button"
                  className="chip"
                  aria-pressed={companion.damageType === id}
                  aria-label={id === 'phy' ? 'Physical damage' : 'Magic damage'}
                  onClick={() => set({ damageType: id })}
                  style={{
                    minWidth: 52,
                    minHeight: 44,
                    fontSize: '0.8125rem',
                    background: companion.damageType === id ? 'var(--hope)' : 'var(--raised)',
                    color: companion.damageType === id ? 'var(--app)' : 'var(--muted)',
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="t-meta">RANGE</span>
              <button
                type="button"
                aria-label="Shorter range"
                className="chip"
                onClick={() => rangeStep(-1)}
                style={{ minWidth: 44, minHeight: 44, fontSize: 15 }}
              >
                −
              </button>
              <span style={{ font: '700 0.8125rem/1 var(--sans)', minWidth: 74, textAlign: 'center' }}>
                {companion.range}
              </span>
              <button
                type="button"
                aria-label="Longer range"
                className="chip"
                onClick={() => rangeStep(1)}
                style={{ minWidth: 44, minHeight: 44, fontSize: 15 }}
              >
                +
              </button>
            </div>
          </div>

          <div className="stack" style={{ gap: 6, flex: 'none' }}>
            <div className="spread">
              <span className="t-label">Experiences</span>
              <button
                type="button"
                className="t-meta"
                style={{ minHeight: 44, minWidth: 44, padding: '0 8px', letterSpacing: '0.1em' }}
                onClick={() =>
                  set({
                    experiences: [
                      ...companion.experiences,
                      {
                        id: crypto.randomUUID(),
                        name: '',
                        bonus: COMPANION_START.experienceBonus,
                      },
                    ],
                  })
                }
              >
                + ADD
              </button>
            </div>
            {companion.experiences.map((exp) => (
              <div key={exp.id} className="row" style={{ gap: 6 }}>
                <input
                  value={exp.name}
                  placeholder="Expert Climber"
                  aria-label="Experience name"
                  onChange={(e) =>
                    set({
                      experiences: companion.experiences.map((x) =>
                        x.id === exp.id ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  type="button"
                  className="chip"
                  aria-label={`Bonus for ${exp.name || 'this Experience'}`}
                  onClick={() =>
                    set({
                      experiences: companion.experiences.map((x) =>
                        x.id === exp.id ? { ...x, bonus: x.bonus >= 6 ? 1 : x.bonus + 1 } : x,
                      ),
                    })
                  }
                  style={{ minWidth: 52, minHeight: 44, fontSize: '0.8125rem' }}
                >
                  +{exp.bonus}
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-label={`Remove ${exp.name || 'this Experience'}`}
                  onClick={() =>
                    set({ experiences: companion.experiences.filter((x) => x.id !== exp.id) })
                  }
                  style={{ minWidth: 44, minHeight: 44, fontSize: 15 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="stack" style={{ gap: 6, flex: 'none', paddingBottom: 4 }}>
            <div className="spread">
              <span className="t-label">Level-up options</span>
              <span className="t-meta" style={{ color: 'var(--dim)' }}>
                ONE PER LEVEL-UP · TRAINING GRANTS MORE
              </span>
            </div>
            {/* A dataset with no such section draws nothing here, and nothing
                is indistinguishable from eight boxes none of which are marked.
                So it says which of the two it is - the same refusal the
                Beastform picker makes when its list comes back empty. */}
            {upgrades.length === 0 && (
              <span className="t-hint" style={{ color: 'var(--dim)' }}>
                This dataset carries no companion level-up options.
                {companion.upgrades.length > 0
                  ? ` ${String(companion.upgrades.length)} already marked on this sheet cannot be shown.`
                  : ''}
              </span>
            )}
            {upgrades.map((up) => {
              const on = companion.upgrades.includes(up.id);
              return (
                <button
                  key={up.id}
                  type="button"
                  onClick={() => toggleUpgrade(up.id)}
                  aria-pressed={on}
                  className="row"
                  style={{
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 11px',
                    minHeight: 44,
                    textAlign: 'left',
                    borderRadius: 'var(--r3)',
                    background: on ? 'color-mix(in srgb, var(--hope) 10%, transparent)' : 'var(--app)',
                    border: `1px solid ${on ? 'var(--hope)' : 'var(--line-soft)'}`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 16,
                      height: 16,
                      marginTop: 2,
                      borderRadius: 'var(--r1)',
                      background: on ? 'var(--hope)' : 'transparent',
                      border: `1.5px solid ${on ? 'var(--hope)' : 'var(--empty)'}`,
                    }}
                  />
                  <span className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ font: '700 0.8125rem/1.15 var(--sans)' }}>{up.name}</span>
                    <span className="t-read" style={{ marginTop: 4 }}>
                      {up.text}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="spread"
          style={{
            flex: 'none',
            alignItems: 'center',
            padding: '10px 16px 14px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <button
            type="button"
            className="t-meta"
            onClick={onClose}
            style={{ minHeight: 44, minWidth: 44, padding: '0 12px', marginLeft: -12 }}
          >
            CLOSE
          </button>
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            THEIR DAMAGE USES YOUR PROFICIENCY
          </span>
        </div>
      </div>
    </div>
  );
}
