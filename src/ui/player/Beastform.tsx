/**
 * Beastform, at the top of the identity area.
 *
 * A Druid in a Beastform is not a Druid with a modifier: their Evasion, one of
 * their traits and the attack they can make all belong to the animal for as
 * long as they wear it. So the control is not a toggle tucked in a menu - it
 * sits where the character's name is, it is sage the whole time it is active,
 * and every number it replaced is printed struck through beside its new value.
 * Forgetting you are transformed should be impossible; dropping out is one tap.
 *
 * Nothing here is written into the character's traits. The override is computed
 * by `deriveStats`, so leaving the form restores the sheet exactly.
 */
import { useMemo, useState } from 'react';
import type { Beastform as Form } from '../../../shared/types.ts';
import { TRAIT_LABELS } from '../../../shared/types.ts';
import type { BeastformInPlay, DerivedStats } from '../../engine/character.ts';
import {
  BEASTFORM_STRESS_COST,
  EVOLUTION_HOPE_COST,
  beastformOptions,
  enterBeastform,
  evolutionFeature,
  hasBeastform,
  leaveBeastform,
} from '../../engine/beastform.ts';
import { useActive, useApp } from '../../store/state.ts';
import { useDialog } from '../shared/useDialog.ts';

/** Sage carries "transformed" everywhere, but never on its own. */
const SAGE = 'var(--sage)';
const WASH = 'color-mix(in srgb, var(--sage) 11%, transparent)';

const signed = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

interface Props {
  stats: DerivedStats;
  layout: 'desktop' | 'phone';
}

export function Beastform({ stats, layout }: Props): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  const [picking, setPicking] = useState(false);

  if (!character || !hasBeastform(character, index)) return null;

  const worn = stats.beastform;
  // The character says they are transformed but this device cannot resolve the
  // form - an import from someone with a layer we do not have. Saying "human
  // form" here would quietly disagree with the sheet, so it says what happened
  // and leaves DROP within reach.
  const unresolved = worn === null && character.beastform !== null;
  const label = worn !== null
    ? `BEASTFORM: ${worn.form.name}`
    : unresolved
      ? 'UNKNOWN BEASTFORM'
      : 'HUMAN FORM';

  return (
    <>
      {layout === 'phone' ? (
        <PhoneChip
          worn={worn}
          unresolved={unresolved}
          evasion={stats.evasion}
          label={label}
          onOpen={() => setPicking(true)}
        />
      ) : (
        <DesktopStrip
          worn={worn}
          unresolved={unresolved}
          evasion={stats.evasion}
          label={label}
          onOpen={() => setPicking(true)}
        />
      )}
      {picking && <Picker stats={stats} onClose={() => setPicking(false)} />}
    </>
  );
}

/**
 * Dropping out. `desktop` is the only place it shrinks, because that is the one
 * layout a finger never reaches; on a phone and inside the picker it stays a
 * full tap target, since this is the control you hit while being shot at.
 */
function DropButton({ desktop = false }: { desktop?: boolean }): React.JSX.Element {
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  return (
    <button
      type="button"
      className="chip"
      onClick={(e) => {
        e.stopPropagation();
        update(leaveBeastform);
        pushLog({ kind: 'note', label: 'Dropped out of Beastform', detail: 'Back to human form' });
      }}
      style={{
        minHeight: desktop ? 34 : 44,
        minWidth: desktop ? undefined : 44,
        padding: '0 12px',
        flex: 'none',
        background: 'var(--raised)',
        color: 'var(--text-2)',
        border: `1px solid ${SAGE}`,
      }}
    >
      DROP
    </button>
  );
}

function Struck({ from, to }: { from: number; to: number }): React.JSX.Element {
  return (
    <span className="row" style={{ gap: 5 }}>
      <span style={{ font: '800 17px/1 var(--sans)', color: SAGE }}>{to}</span>
      <s className="t-meta" style={{ color: 'var(--dim)' }}>
        {from}
      </s>
    </span>
  );
}

function DesktopStrip({
  worn,
  unresolved,
  evasion,
  label,
  onOpen,
}: {
  worn: BeastformInPlay | null;
  unresolved: boolean;
  /** Evasion in play, from `deriveStats`. Never re-added here. */
  evasion: number;
  label: string;
  onOpen: () => void;
}): React.JSX.Element {
  if (worn === null) {
    return (
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          onClick={onOpen}
          className="spread"
          aria-label={
            unresolved
              ? 'This character is in a Beastform this dataset does not have — choose another'
              : 'Human form — choose a Beastform'
          }
          style={{
            flex: 1,
            minWidth: 'var(--control)',
            minHeight: 44,
            alignItems: 'center',
            padding: '0 12px',
            borderRadius: 'var(--r3)',
            border: `1px dashed ${unresolved ? 'var(--damage)' : 'var(--line)'}`,
            background: 'transparent',
          }}
        >
          <span className="t-label" style={unresolved ? { color: 'var(--damage)' } : undefined}>
            {label}
          </span>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {unresolved ? 'PICK ANOTHER' : 'TRANSFORM'}
          </span>
        </button>
        {unresolved && <DropButton desktop />}
      </div>
    );
  }

  const { form } = worn;
  return (
    <section
      aria-label={label}
      style={{
        borderRadius: 'var(--r3)',
        border: `1px solid ${SAGE}`,
        borderLeftWidth: 3,
        background: WASH,
        padding: '10px 12px',
      }}
    >
      <div className="spread" style={{ alignItems: 'center' }}>
        <span className="t-label" style={{ color: SAGE }}>
          Beastform · Tier {form.tier}
        </span>
        <DropButton desktop />
      </div>

      <button
        type="button"
        onClick={onOpen}
        style={{
          display: 'block',
          textAlign: 'left',
          marginTop: 7,
          font: '800 20px/1 var(--sans)',
          letterSpacing: '-0.02em',
        }}
      >
        {form.name}
      </button>

      <div className="row" style={{ marginTop: 9, gap: 14, flexWrap: 'wrap' }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="t-meta" style={{ color: SAGE }}>
            EVASION
          </span>
          <Struck from={worn.baseEvasion} to={evasion} />
        </span>
        {worn.raised.map((r) => (
          <span key={r.trait} className="row" style={{ gap: 6 }}>
            <span className="t-meta" style={{ color: SAGE }}>
              {TRAIT_LABELS[r.trait].toUpperCase()}
            </span>
            <span className="row" style={{ gap: 5 }}>
              <span style={{ font: '800 17px/1 var(--sans)', color: SAGE }}>{signed(r.to)}</span>
              <s className="t-meta" style={{ color: 'var(--dim)' }}>
                {signed(r.from)}
              </s>
            </span>
          </span>
        ))}
      </div>

      {/* The die spec keeps its lowercase `d`: `D12+10` is not how a die is written. */}
      <div className="t-meta" style={{ marginTop: 9, letterSpacing: '0.05em' }}>
        ATTACK {form.attack.damage} · {form.attack.range.toUpperCase()} ·{' '}
        {TRAIT_LABELS[form.attack.trait].toUpperCase()}
      </div>

      <FormText form={form} />
    </section>
  );
}

function PhoneChip({
  worn,
  unresolved,
  evasion,
  label,
  onOpen,
}: {
  worn: BeastformInPlay | null;
  unresolved: boolean;
  /** Evasion in play, from `deriveStats`. Never re-added here. */
  evasion: number;
  label: string;
  onOpen: () => void;
}): React.JSX.Element {
  const active = worn !== null;
  const edge = active ? SAGE : unresolved ? 'var(--damage)' : 'var(--line)';
  return (
    <div className="row" style={{ gap: 6, flex: 'none' }}>
      <button
        type="button"
        onClick={onOpen}
        className="row"
        aria-label={
          active
            ? `${label} — tap to change form`
            : unresolved
              ? 'This character is in a Beastform this dataset does not have — tap to pick another'
              : 'Human form — tap to transform'
        }
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          gap: 8,
          padding: '0 11px',
          borderRadius: 'var(--r3)',
          border: `1px ${active ? 'solid' : 'dashed'} ${edge}`,
          borderLeftWidth: active ? 4 : 1,
          background: active ? WASH : 'transparent',
        }}
      >
        <span
          className="t-label"
          style={{
            color: active ? SAGE : unresolved ? 'var(--damage)' : 'var(--dim)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
          }}
        >
          {label}
        </span>
        {worn !== null && (
          <span className="row" style={{ gap: 8, flex: 'none' }}>
            <span className="t-meta" style={{ color: SAGE }}>
              EVA
            </span>
            <Struck from={worn.baseEvasion} to={evasion} />
          </span>
        )}
        {worn === null && (
          <span className="t-meta" style={{ color: 'var(--muted)', flex: 'none' }}>
            {unresolved ? 'PICK ANOTHER' : 'TRANSFORM'}
          </span>
        )}
      </button>
      {(active || unresolved) && <DropButton />}
    </div>
  );
}

/**
 * The form's own rules text, which the app shows and never runs. Spans rather
 * than paragraphs because this also renders inside the picker's row buttons.
 */
function FormText({ form }: { form: Form }): React.JSX.Element {
  return (
    <>
      {form.advantageOn.length > 0 && (
        <span className="t-dense" style={{ display: 'block', marginTop: 9 }}>
          <span className="t-meta" style={{ color: SAGE }}>
            ADVANTAGE ON{' '}
          </span>
          {form.advantageOn.join(', ')}
        </span>
      )}
      {form.features.map((f) => (
        <span key={f.name} className="t-dense" style={{ display: 'block', marginTop: 7 }}>
          <span style={{ font: '700 11.5px/1.38 var(--sans)', color: 'var(--text-2)' }}>
            {f.name}:{' '}
          </span>
          {f.text}
        </span>
      ))}
    </>
  );
}

type Cost = 'stress' | 'evolution';

/** The list of forms this level allows, each showing what it would replace. */
function Picker({ stats, onClose }: { stats: DerivedStats; onClose: () => void }): React.JSX.Element {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const [cost, setCost] = useState<Cost>('stress');

  const forms = useMemo(
    () => (character ? beastformOptions(character.level, dataset) : []),
    [character, dataset],
  );

  const dialog = useDialog('Choose a Beastform', onClose);

  if (!character) return <div />;

  // The Hope price belongs to a class Hope Feature this character may simply not
  // have - multiclassing grants a class feature, not a Hope Feature - so the
  // option only exists when the dataset says they own it.
  const evolution = evolutionFeature(character, index);
  const canEvolve = evolution !== null && character.hope.marked >= EVOLUTION_HOPE_COST;
  const paying: Cost = cost === 'evolution' && !canEvolve ? 'stress' : cost;
  const worn = stats.beastform;

  const take = (form: Form): void => {
    const out = enterBeastform(character, form.id, paying);
    update(() => out.character);
    pushLog({
      kind: 'note',
      label: `Beastform: ${form.name}`,
      detail:
        paying === 'evolution'
          ? `Spent ${out.hopeSpent} Hope · ${evolution?.name ?? 'Hope Feature'}`
          : `Marked ${out.stressMarked} Stress${out.hpMarked > 0 ? ` and ${out.hpMarked} HP` : ''}`,
    });
    onClose();
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
          borderTop: `4px solid ${SAGE}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px 12px', flex: 'none' }}>
          <div className="spread" style={{ alignItems: 'center' }}>
            <span className="t-label" style={{ color: SAGE }}>
              Beastform
            </span>
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              TIER {stats.tier} AND BELOW · {forms.length} FORMS
            </span>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
            <span className="t-meta" style={{ flex: 'none' }}>
              COST
            </span>
            {(
              [
                ['stress', `MARK ${BEASTFORM_STRESS_COST} STRESS`, true],
                ...(evolution === null
                  ? []
                  : [
                      [
                        'evolution',
                        `${evolution.name.toUpperCase()} · ${EVOLUTION_HOPE_COST} HOPE`,
                        canEvolve,
                      ] as [Cost, string, boolean],
                    ]),
              ] as Array<[Cost, string, boolean]>
            ).map(([id, text, enabled]) => (
              <button
                key={id}
                type="button"
                className="chip"
                aria-pressed={paying === id}
                disabled={!enabled}
                title={enabled ? undefined : `Not enough Hope: you have ${character.hope.marked}`}
                onClick={() => setCost(id)}
                style={{
                  minHeight: 44,
                  padding: '0 12px',
                  opacity: enabled ? 1 : 0.45,
                  background: paying === id ? SAGE : 'var(--raised)',
                  color: paying === id ? 'var(--app)' : 'var(--muted)',
                }}
              >
                {text}
              </button>
            ))}
          </div>
          {/* The Hope Feature's own words, not a paraphrase: it asks the player
              to raise a trait, and the app cannot do that for them. */}
          <p
            className={paying === 'evolution' ? 't-dense' : 't-meta'}
            style={{ margin: '9px 0 0', color: 'var(--dim)', lineHeight: 1.6 }}
          >
            {paying === 'evolution' && evolution !== null
              ? evolution.text
              : 'WEAPONS AND DOMAIN SPELLS ARE UNAVAILABLE WHILE TRANSFORMED'}
          </p>
        </div>

        <div
          className="scroll stack"
          style={{ flex: 1, minHeight: 0, gap: 8, padding: '0 16px 12px' }}
        >
          {forms.map((form) => {
            const active = worn?.form.id === form.id;
            return (
              <button
                key={form.id}
                type="button"
                onClick={() => take(form)}
                aria-label={`${form.name}, tier ${form.tier}, Evasion ${signed(form.evasionBonus)}, ${form.attack.damage} ${form.attack.range}`}
                className="stack"
                style={{
                  flex: 'none',
                  textAlign: 'left',
                  padding: '10px 11px',
                  borderRadius: 'var(--r3)',
                  background: active ? WASH : 'var(--app)',
                  border: `1px solid ${active ? SAGE : 'var(--line-soft)'}`,
                }}
              >
                <span className="spread" style={{ alignItems: 'baseline' }}>
                  <span style={{ font: '700 15px/1.1 var(--sans)' }}>{form.name}</span>
                  <span className="t-meta" style={{ color: active ? SAGE : 'var(--dim)' }}>
                    {active ? 'WORN' : `TIER ${form.tier}`}
                  </span>
                </span>

                <span className="row" style={{ marginTop: 7, gap: 10, flexWrap: 'wrap' }}>
                  <span className="t-num" style={{ color: SAGE }}>
                    EVA {signed(form.evasionBonus)}
                  </span>
                  {Object.entries(form.traitBonus).map(([trait, bonus]) => (
                    <span key={trait} className="t-num" style={{ color: SAGE }}>
                      {TRAIT_LABELS[trait as keyof typeof TRAIT_LABELS].slice(0, 3).toUpperCase()}{' '}
                      {signed(bonus)}
                    </span>
                  ))}
                  <span className="t-num" style={{ color: 'var(--text-2)' }}>
                    {form.attack.damage}
                  </span>
                  <span className="t-meta">
                    {form.attack.range.toUpperCase()} ·{' '}
                    {TRAIT_LABELS[form.attack.trait].toUpperCase()}
                  </span>
                </span>

                {form.examples.length > 0 && (
                  <span className="t-meta" style={{ marginTop: 6, color: 'var(--muted)' }}>
                    {form.examples.join(' · ').toUpperCase()}
                  </span>
                )}

                <span style={{ display: 'block' }}>
                  <FormText form={form} />
                </span>
              </button>
            );
          })}
          {forms.length === 0 && (
            <span className="t-dense" style={{ color: 'var(--dim)' }}>
              No Beastform options in this dataset.
            </span>
          )}
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
          {worn !== null && <DropButton />}
        </div>
      </div>
    </div>
  );
}
