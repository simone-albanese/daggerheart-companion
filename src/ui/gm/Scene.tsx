/**
 * The live scene.
 *
 * Same Track component as the player sheet, on purpose: a GM who plays this
 * game has already learned that a tap marks and a hold clears, and there is no
 * reason for their side of the screen to work differently. Thresholds sit under
 * the tracks permanently rather than behind a tap, because they are the number
 * you are asked for out loud, several times a round.
 */
import { useEffect, useState } from 'react';
import type { Adversary } from '../../../shared/types.ts';
import type { SceneCombatant } from '../../engine/encounter.ts';
import { useApp } from '../../store/state.ts';
import { Track } from '../shared/Track.tsx';
import { Stepper } from './Encounter.tsx';
import { damageLabel, EnvironmentBand, FeatureList, signed } from './StatBlock.tsx';
import { useGm } from './gmStore.ts';

export function Scene({ phone }: { phone: boolean }): React.JSX.Element {
  const combatants = useGm((s) => s.combatants);
  const environmentRef = useGm((s) => s.environmentRef);
  const setRegion = useGm((s) => s.setRegion);
  const clearScene = useGm((s) => s.clearScene);
  // `index.byRef` holds every kind of record under one key space, so reading an
  // adversary out of it is an unchecked assertion. The adversary list is the
  // only lookup that can actually promise the type.
  const adversaries = useApp((s) => s.dataset.adversaries);
  const environments = useApp((s) => s.dataset.environments);
  const bestiary = useApp((s) => s.prefs.gmBestiary);

  const byRef = new Map(adversaries.map((a) => [a.id, a]));
  const environment = environments.find((e) => e.id === environmentRef);
  const spotlit = combatants.filter((c) => c.spotlighted).length;

  // Ending a scene throws away every HP and Stress mark in it, and this module
  // exists to keep those. One tap arms it; the next one does it.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: phone ? '10px 12px 0' : '14px 20px 0' }}>
      {environment !== undefined && <EnvironmentBand environment={environment} />}

      <div className="spread" style={{ flex: 'none' }}>
        <span className="t-label">
          Scene — {combatants.length} adversar{combatants.length === 1 ? 'y' : 'ies'}
        </span>
        <span className="row" style={{ gap: 14, flex: 'none' }}>
          <span className="t-meta" style={{ color: spotlit > 0 ? 'var(--hope)' : 'var(--dim)' }}>
            {spotlit} SPOTLIT
          </span>
          {combatants.length > 0 && (
            <button
              type="button"
              className="t-meta"
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                clearScene();
                setArmed(false);
              }}
              style={{
                letterSpacing: '0.1em',
                minHeight: 44,
                padding: '0 var(--s3)',
                marginRight: -8,
                color: armed ? 'var(--damage)' : undefined,
                fontWeight: armed ? 600 : undefined,
              }}
            >
              {armed ? 'TAP AGAIN TO END' : 'END SCENE'}
            </button>
          )}
        </span>
      </div>

      {combatants.length === 0 ? (
        <div className="panel stack" style={{ flex: 'none', padding: 18, gap: 12, alignItems: 'flex-start' }}>
          <div className="t-vital">Nothing in the scene</div>
          {/*
            The sentence names the bestiary only while the bestiary is there.
            It is switchable in Settings, and this empty state is the one place
            in the app outside SHOW that offers it - a button here with the
            preference off would be a door to a room the screen will not open,
            and a sentence naming a tool that is gone is the same defect one
            step quieter. The encounter builder is not switchable, which is what
            keeps this state from ever being buttonless.
          */}
          <p className="t-body" style={{ margin: 0, maxWidth: 460 }}>
            Build an encounter and send the roster here
            {bestiary ? ', or open the bestiary and drop a single adversary straight in' : ''}.
            Whatever you add keeps its HP, Stress and spotlight through a reload — this screen
            survives the browser closing mid-fight.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => setRegion('encounter')}>
              Build an encounter
            </button>
            {bestiary && (
              <button type="button" className="btn" onClick={() => setRegion('bestiary')}>
                Open the bestiary
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="scroll"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: 10,
            // Rows must be sized by their cards, not by the scroll viewport:
            // a Solo with seven features cannot be squeezed to the height of
            // the Minion group beside it.
            gridAutoRows: 'max-content',
            alignItems: 'start',
            alignContent: 'start',
            paddingBottom: 14,
          }}
        >
          {combatants.map((c) => (
            <CombatantCard key={c.id} combatant={c} adversary={byRef.get(c.adversaryRef)} phone={phone} />
          ))}
        </div>
      )}
    </div>
  );
}

function CombatantCard({
  combatant,
  adversary,
  phone,
}: {
  combatant: SceneCombatant;
  adversary: Adversary | undefined;
  phone: boolean;
}): React.JSX.Element {
  const patch = useGm((s) => s.patchCombatant);
  const remove = useGm((s) => s.removeCombatant);
  const [openFeatures, setOpenFeatures] = useState(false);
  const c = combatant;
  const down = c.hp.marked >= c.hp.max;

  return (
    <article
      className="panel stack"
      style={{
        gap: 10,
        padding: 11,
        borderLeft: `3px solid ${c.spotlighted ? 'var(--hope)' : down ? 'var(--damage)' : 'transparent'}`,
        opacity: down ? 0.72 : 1,
      }}
    >
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <span className="stack" style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <span
            style={{
              font: '700 15px/1.15 var(--sans)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {c.name}
          </span>
          <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
            {adversary === undefined
              ? 'NOT IN THIS DATASET'
              : `T${adversary.tier} · ${adversary.role.toUpperCase()}`}
            {down ? ' · DEFEATED' : ''}
          </span>
        </span>
        <button
          type="button"
          className="chip"
          aria-pressed={c.spotlighted}
          onClick={() => patch(c.id, { spotlighted: !c.spotlighted })}
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            padding: '0 10px',
            background: c.spotlighted ? 'var(--hope)' : 'var(--raised)',
            color: c.spotlighted ? 'var(--app)' : 'var(--muted)',
            fontWeight: c.spotlighted ? 700 : 600,
          }}
        >
          {c.spotlighted ? 'SPOTLIT' : 'SPOTLIGHT'}
        </button>
        <button
          type="button"
          onClick={() => remove(c.id)}
          aria-label={`Remove ${c.name} from the scene`}
          className="t-meta"
          style={{ flex: 'none', width: 34, minHeight: 'var(--control)', color: 'var(--dim)' }}
        >
          ✕
        </button>
      </div>

      <Track
        kind="hp"
        label="HP"
        value={c.hp.marked}
        max={c.hp.max}
        onChange={(v) => patch(c.id, { hp: { ...c.hp, marked: v } })}
        readout={`${c.hp.marked} / ${c.hp.max} MARKED`}
        rowHeight={phone ? 44 : 38}
        compact
      />
      <Track
        kind="stress"
        label="STRESS"
        value={c.stress.marked}
        max={c.stress.max}
        onChange={(v) => patch(c.id, { stress: { ...c.stress, marked: v } })}
        readout={`${c.stress.marked} / ${c.stress.max} MARKED`}
        rowHeight={phone ? 44 : 38}
        compact
      />

      <div
        className="row"
        style={{
          gap: 10,
          flexWrap: 'wrap',
          padding: '8px 10px',
          borderRadius: 'var(--r2)',
          background: 'var(--app)',
        }}
      >
        <span className="t-meta">DIF</span>
        <span className="t-num" style={{ fontSize: 15 }}>
          {c.difficulty}
        </span>
        <span style={{ width: 1, height: 13, background: 'var(--line)' }} />
        {c.thresholds === null ? (
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            NO THRESHOLDS · ANY DAMAGE DEFEATS
          </span>
        ) : (
          <>
            <span className="t-meta">MAJOR</span>
            <span className="t-num" style={{ fontSize: 15 }}>
              {c.thresholds[0]}
            </span>
            <span className="t-meta">SEVERE</span>
            <span className="t-num" style={{ fontSize: 15 }}>
              {c.thresholds[1]}
            </span>
          </>
        )}
      </div>

      {c.minionsRemaining !== undefined && (
        <div className="row" style={{ gap: 10 }}>
          <Stepper
            label="Minions standing"
            value={c.minionsRemaining}
            onChange={(n) => patch(c.id, { minionsRemaining: n })}
          />
          <span className="t-dense" style={{ color: 'var(--muted)', flex: 1, minWidth: 0 }}>
            One group. Each defeated Minion is one fewer body in the same space.
          </span>
        </div>
      )}

      {adversary !== undefined && (
        <div
          className="row"
          style={{ gap: 9, flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 9 }}
        >
          <span style={{ font: '800 17px/1 var(--sans)', fontVariantNumeric: 'tabular-nums' }}>
            {signed(adversary.attackBonus)}
          </span>
          <span style={{ font: '600 13px/1.15 var(--sans)', color: 'var(--text-2)' }}>
            {adversary.attack.name}
          </span>
          <span className="t-num" style={{ marginLeft: 'auto', color: 'var(--damage)' }}>
            {adversary.attack.damage}
          </span>
          <span className="t-meta" style={{ width: '100%', letterSpacing: '0.07em' }}>
            {adversary.attack.range.toUpperCase()} · {damageLabel(adversary.attack.damageType)}
          </span>
        </div>
      )}

      {adversary !== undefined && adversary.features.length > 0 && (
        <>
          <button
            type="button"
            className="row"
            aria-expanded={openFeatures}
            onClick={() => setOpenFeatures((o) => !o)}
            style={{ gap: 8, minHeight: 44, justifyContent: 'space-between' }}
          >
            <span className="t-label">Features</span>
            <span className="chip" style={{ color: 'var(--text-2)' }}>
              {openFeatures ? 'HIDE' : `SHOW ${adversary.features.length}`}
            </span>
          </button>
          {openFeatures ? (
            <FeatureList features={adversary.features} />
          ) : (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: -4 }}>
              {adversary.features.map((f, i) => (
                <span key={`${f.name}-${i}`} className="chip" style={{ color: 'var(--text-3)' }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}
