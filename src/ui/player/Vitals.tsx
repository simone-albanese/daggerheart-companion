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
}

export function Vitals({ stats, layout }: Props): React.JSX.Element | null {
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
   * On a phone the calculator rides *inside* the HP header row instead of
   * taking one of its own. The vertical budget at 852px is genuinely tight,
   * and this row is the difference between five loadout rows and three.
   */
  const inlineDamage = (
    <span className="row" style={{ gap: 6, flex: 'none' }}>
      <input
        type="number"
        inputMode="numeric"
        value={incoming}
        placeholder="took"
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
  const state = (
    <>
      <ActiveConditions />
      <DeathMoveOffer />
    </>
  );

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
      <Track
        kind="hp"
        label="HP"
        value={character.hp.marked}
        max={character.hp.max}
        onChange={(v) => update((c) => ({ ...c, hp: { ...c.hp, marked: v } }))}
        readout={phone ? `${character.hp.marked}/${character.hp.max}` : `${character.hp.marked} / ${character.hp.max} MARKED`}
        headerExtra={phone ? inlineDamage : undefined}
        rowHeight={rowHeight}
        compact={!phone}
      />
      <Track
        kind="stress"
        label="STRESS"
        value={character.stress.marked}
        max={character.stress.max}
        onChange={(v) => update((c) => ({ ...c, stress: { ...c.stress, marked: v } }))}
        readout={phone ? `${character.stress.marked}/${character.stress.max}` : `${character.stress.marked} / ${character.stress.max} MARKED`}
        rowHeight={rowHeight}
        compact={!phone}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: phone ? '1fr 132px' : '1fr 148px',
          gap: phone ? 8 : 12,
        }}
      >
        <Track
          kind="hope"
          label="HOPE"
          labelColor="var(--hope)"
          value={character.hope.marked}
          max={character.hope.max}
          clearTo={character.hope.max}
          onChange={(v) => update((c) => ({ ...c, hope: { ...c.hope, marked: v } }))}
          readout={phone ? `${character.hope.marked}/${character.hope.max}` : `${character.hope.marked} / ${character.hope.max} AVAILABLE`}
          rowHeight={rowHeight}
          compact={!phone}
        />
        <Track
          kind="armor"
          label="ARMOR"
          value={character.armorSlots.marked}
          max={character.armorSlots.max}
          onChange={(v) => update((c) => ({ ...c, armorSlots: { ...c.armorSlots, marked: v } }))}
          readout={phone ? `${character.armorSlots.marked}/${character.armorSlots.max}` : `${character.armorSlots.marked} / ${character.armorSlots.max} USED`}
          rowHeight={rowHeight}
          compact={!phone}
        />
      </div>

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
