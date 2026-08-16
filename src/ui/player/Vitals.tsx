/**
 * The four tracks plus the incoming-damage calculator.
 *
 * "Someone hit you for 14 - how many HP is that?" is the question the sheet has
 * to answer instantly, because the alternative is three people doing mental
 * arithmetic while the scene waits. Type the number and the app reads the
 * ladder, shows what marking an Armor Slot would save, and applies it on
 * confirm. It proposes; the player commits.
 */
import { useState } from 'react';
import { applyDamage, markDamage, SEVERITY_LABEL } from '../../engine/damage.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { useActive, useApp } from '../../store/state.ts';
import { Track } from '../shared/Track.tsx';
import { CompanionPanel, useHasCompanion, WhoSwitch, type Who } from './Companion.tsx';
import { ActiveConditions } from './Conditions.tsx';
import { DeathMoveOffer } from './DeathMove.tsx';

interface Props {
  stats: DerivedStats;
  layout: 'desktop' | 'phone';
  /**
   * Render the conditions strip and the death-move offer alongside the tracks.
   *
   * The phone says no and places them itself: the tracks belong in the fixed
   * block under the thumb, and the conditions strip does not - it is set once
   * a scene, not once a turn. The death-move offer goes with the tracks
   * regardless, because when it appears it is the most important thing on the
   * screen.
   */
  showState?: boolean;
}

export function Vitals({ stats, layout, showState = true }: Props): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const massiveDamageRule = useApp((s) => s.prefs.massiveDamageRule);
  const hasCompanion = useHasCompanion();
  const [incoming, setIncoming] = useState('');
  const [useArmor, setUseArmor] = useState(0);
  const [who, setWho] = useState<Who>('you');

  if (!character) return null;

  const amount = Number(incoming);
  const available = character.armorSlots.max - character.armorSlots.marked;
  const preview =
    incoming !== '' && Number.isFinite(amount)
      ? applyDamage(amount, stats, available, { armorSlots: useArmor, massiveDamageRule })
      : null;

  const phone = layout === 'phone';
  // 46px on a phone is the thumb target from the design. On desktop the mouse
  // is precise and the vertical budget is not: a 1440x695 laptop viewport is
  // the real constraint, not the 900px mock.
  const rowHeight = phone ? 44 : 32;

  const commit = (): void => {
    if (!preview) return;
    update((c) => markDamage(c, preview));
    pushLog({
      kind: 'incoming',
      label: `${SEVERITY_LABEL[preview.severity]} · ${preview.hp} HP`,
      detail: preview.explanation,
    });
    setIncoming('');
    setUseArmor(0);
  };

  const panel = { flex: 'none' as const, padding: phone ? 8 : 12, gap: phone ? 6 : 10 };

  /**
   * The calculator itself: a number in, a verdict and a commit out.
   *
   * It used to ride inside the HP header to save a row, and that turned out to
   * be a false economy - it took about 110px off the pip row, which pushed HP
   * at max 8 under the target floor and wrapped the track onto a second line,
   * so it cost the row anyway and split the pips in half as well. On the phone
   * it now has its own row beneath the tracks; on desktop it keeps the wider
   * arrangement further down.
   */
  const inlineDamage = (
    <span className="row" style={{ gap: 6, flex: 'none' }}>
      <input
        type="number"
        inputMode="numeric"
        value={incoming}
        placeholder="14"
        aria-label="Incoming damage"
        onChange={(e) => {
          setIncoming(e.target.value);
          setUseArmor(0);
        }}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={{
          width: 58,
          minHeight: 'var(--control)',
          padding: '2px 4px',
          textAlign: 'center',
          font: '600 12px/1 var(--mono)',
        }}
      />
      {preview === null ? (
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {stats.thresholds[0]}/{stats.thresholds[1]}
        </span>
      ) : (
        <>
          {available > 0 && (
            <button
              type="button"
              className="chip"
              onClick={() => setUseArmor((n) => (n + 1 > available || n >= 3 ? 0 : n + 1))}
              style={{
                minHeight: 'var(--control)',
                background: useArmor > 0 ? 'var(--armor)' : 'var(--raised)',
                color: useArmor > 0 ? 'var(--app)' : 'var(--muted)',
              }}
            >
              {useArmor > 0 ? `−${useArmor}` : 'ARM'}
            </button>
          )}
          <button
            type="button"
            className="chip"
            onClick={commit}
            style={{
              minHeight: 'var(--control)',
              background: 'var(--text)',
              color: 'var(--app)',
              fontWeight: 700,
            }}
          >
            {SEVERITY_LABEL[preview.severity].toUpperCase()} · {preview.hp} HP
          </button>
        </>
      )}
    </span>
  );

  // A companion is a second creature, not a second screen: it takes over this
  // panel - same space, same thumb arc - behind one segmented control.
  /*
   * Both rows sit outside the panel because they belong to the character
   * rather than to the tracks: the companion switch swaps what this panel is
   * about, and a player who is Restrained - or whose last Hit Point is marked -
   * must not lose that the moment they look at their wolf.
   */
  const state = showState ? (
    <>
      <ActiveConditions />
      <DeathMoveOffer />
    </>
  ) : null;

  if (hasCompanion && who === 'companion') {
    return (
      <>
        {state}
        <div className="panel stack" style={panel}>
          <WhoSwitch who={who} setWho={setWho} compact={!phone} />
          <CompanionPanel stats={stats} layout={layout} />
        </div>
      </>
    );
  }

  return (
    <>
    {state}
    <div className="panel stack" style={panel}>
      {hasCompanion && <WhoSwitch who={who} setWho={setWho} compact={!phone} />}
      {phone ? (
        /*
         * Four full-width rows, each with its label in a gutter beside the
         * pips, ordered by how often the game makes you touch them - least
         * first, so the most-touched sits nearest the thumb.
         *
         * The order is measured against the shipped SRD rather than taken from
         * the printed sheet. Of 189 domain cards, 84 mention Hope and 80
         * mention Stress, and 158 of them cost Stress to recall; a PC gains
         * Hope on every roll that comes up with Hope, and spends one on every
         * Experience. Hit Points are touched when something hits you - all 129
         * adversaries deal damage, but that is an event rather than a
         * heartbeat - and Armor Slots are a subset of those events, named by
         * 15 cards. The printed sheet's order is HP, Stress, Hope, Armor,
         * which leads with the least frequent of the top three.
         *
         * Hope sits last on purpose: it is immediately above the Experience
         * row, and arming an Experience spends a Hope, so the pending pips
         * showing that debit are directly beside the control that caused it.
         *
         * Full width also fixes the pips. Hope and Armor used to share a row
         * with Armor pinned into a fixed 132px column, which measured 18px per
         * pip at armour score 6 on a real 393px phone - and thirteen of the
         * thirty-four SRD armours score 6 or more, so a third of the gear in
         * the game had targets below WCAG's 24px floor. They are about 45px
         * now. The gutter pays for the extra row: a label beside the pips
         * rather than above them saves 16px a track.
         */
        <>
          <Track
            kind="armor"
            label="ARMOR"
            value={character.armorSlots.marked}
            max={character.armorSlots.max}
            onChange={(v) => update((c) => ({ ...c, armorSlots: { ...c.armorSlots, marked: v } }))}
            readout={`${character.armorSlots.marked}/${character.armorSlots.max}`}
            headerLayout="gutter"
            rowHeight={rowHeight}
          />
          <Track
            kind="hp"
            label="HP"
            value={character.hp.marked}
            max={character.hp.max}
            onChange={(v) => update((c) => ({ ...c, hp: { ...c.hp, marked: v } }))}
            readout={`${character.hp.marked}/${character.hp.max}`}
            headerLayout="gutter"
            rowHeight={rowHeight}
          />
          <Track
            kind="stress"
            label="STRESS"
            value={character.stress.marked}
            max={character.stress.max}
            onChange={(v) => update((c) => ({ ...c, stress: { ...c.stress, marked: v } }))}
            readout={`${character.stress.marked}/${character.stress.max}`}
            headerLayout="gutter"
            rowHeight={rowHeight}
          />
          <Track
            kind="hope"
            label="HOPE"
            labelColor="var(--hope)"
            value={character.hope.marked}
            max={character.hope.max}
            clearTo={character.hope.max}
            onChange={(v) => update((c) => ({ ...c, hope: { ...c.hope, marked: v } }))}
            readout={`${character.hope.marked}/${character.hope.max}`}
            headerLayout="gutter"
            rowHeight={rowHeight}
          />
          {/*
           * The damage calculator gets a row of its own rather than riding in
           * the HP header.
           *
           * Inline it looked like it was free and was not: it took about 110px
           * off the pip row, which pushed HP at max 8 below the target floor,
           * so the track wrapped to a second line - costing the same 44px the
           * row costs here and leaving the pips split across two rows into the
           * bargain. All 129 adversaries in the SRD deal damage, so "someone
           * hit you for 14, how many HP is that" is asked constantly, and it
           * belongs in the fixed block where it can be answered without
           * hunting.
           */}
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="t-label" style={{ flex: 'none', width: 44, letterSpacing: '0.08em' }}>
              TOOK
            </span>
            {inlineDamage}
          </div>
        </>
      ) : (
        <>
          <Track
            kind="hp"
            label="HP"
            value={character.hp.marked}
            max={character.hp.max}
            onChange={(v) => update((c) => ({ ...c, hp: { ...c.hp, marked: v } }))}
            readout={`${character.hp.marked} / ${character.hp.max} MARKED`}
            rowHeight={rowHeight}
            compact
          />
          <Track
            kind="stress"
            label="STRESS"
            value={character.stress.marked}
            max={character.stress.max}
            onChange={(v) => update((c) => ({ ...c, stress: { ...c.stress, marked: v } }))}
            readout={`${character.stress.marked} / ${character.stress.max} MARKED`}
            rowHeight={rowHeight}
            compact
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 148px', gap: 12 }}>
            <Track
              kind="hope"
              label="HOPE"
              labelColor="var(--hope)"
              value={character.hope.marked}
              max={character.hope.max}
              clearTo={character.hope.max}
              onChange={(v) => update((c) => ({ ...c, hope: { ...c.hope, marked: v } }))}
              readout={`${character.hope.marked} / ${character.hope.max} AVAILABLE`}
              rowHeight={rowHeight}
              compact
            />
            <Track
              kind="armor"
              label="ARMOR"
              value={character.armorSlots.marked}
              max={character.armorSlots.max}
              onChange={(v) => update((c) => ({ ...c, armorSlots: { ...c.armorSlots, marked: v } }))}
              readout={`${character.armorSlots.marked} / ${character.armorSlots.max} USED`}
              rowHeight={rowHeight}
              compact
            />
          </div>
        </>
      )}

      <div
        className="row"
        style={{
          gap: 8,
          borderTop: '1px solid var(--line-soft)',
          paddingTop: 10,
          display: phone ? 'none' : 'flex',
        }}
      >
        <span className="t-meta" style={{ flex: 'none' }}>
          TOOK
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={incoming}
          placeholder="damage"
          onChange={(e) => {
            setIncoming(e.target.value);
            setUseArmor(0);
          }}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          style={{ width: 84, minHeight: 'var(--control)', padding: '6px 8px', font: '600 15px/1 var(--mono)' }}
        />
        {preview === null ? (
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            {stats.thresholds[0]} MAJOR · {stats.thresholds[1]} SEVERE
          </span>
        ) : (
          <>
            <span
              className="row"
              style={{ gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-start' }}
            >
              <span
                style={{
                  font: '800 15px/1 var(--sans)',
                  color: preview.hp >= 3 ? 'var(--damage)' : 'var(--text)',
                }}
              >
                {SEVERITY_LABEL[preview.severity]}
              </span>
              <span className="t-meta" style={{ color: 'var(--muted)' }}>
                {preview.hp} HP
              </span>
              {available > 0 && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => setUseArmor((n) => (n + 1 > available || n >= 3 ? 0 : n + 1))}
                  style={{
                    minHeight: 'var(--control)',
                    background: useArmor > 0 ? 'var(--armor)' : 'var(--raised)',
                    color: useArmor > 0 ? 'var(--app)' : 'var(--muted)',
                  }}
                >
                  {useArmor > 0 ? `−${useArmor} ARMOR` : 'USE ARMOR'}
                </button>
              )}
            </span>
            <button type="button" className="btn btn-primary" onClick={commit} style={{ minHeight: 'var(--control)' }}>
              MARK
            </button>
          </>
        )}
      </div>

    </div>
    </>
  );
}
