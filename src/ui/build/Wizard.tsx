/**
 * Character creation: the SRD's ten steps, in order.
 *
 * A wizard rather than one long sheet because the ten steps are not
 * independent - the class decides the domains, the domains decide which cards
 * you may take, the armor decides the thresholds - and a form that shows all of
 * it at once asks a new player to hold the dependency graph in their head.
 *
 * The header never moves; the step panel scrolls. On a phone the rail collapses
 * to a hairline and Back/Next live in the thumb arc, because creation is the
 * one flow long enough that you will do part of it standing up.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TRAITS,
  TRAIT_LABELS,
  type Ancestry,
  type CharClass,
  type Character,
  type Dataset,
  type Experience,
  type Gold,
  type InventoryEntry,
  type Ref,
  type Trait,
} from '../../../shared/types.ts';
import { deriveStats, newCharacter, syncCounters, tierOf } from '../../engine/character.ts';
import { useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { tierNote } from './gear.ts';
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

/** The fixed array from step 3. Distributed, never rolled. */
const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1] as const;
const TRAIT_VALUES = [2, 1, 0, -1] as const;

/** Which equipment slot the picker is open for. */
type Slot = 'primary' | 'secondary' | 'armor';

/** The parenthetical verbs the SRD prints beside each trait. */
const TRAIT_VERBS: Record<Trait, string> = {
  agility: 'Sprint · Leap · Maneuver',
  strength: 'Lift · Smash · Grapple',
  finesse: 'Control · Hide · Tinker',
  instinct: 'Perceive · Sense · Navigate',
  presence: 'Charm · Perform · Deceive',
  knowledge: 'Recall · Analyze · Comprehend',
};

const STEPS = [
  'Class & subclass',
  'Heritage',
  'Character traits',
  'Level, Evasion & HP',
  'Starting equipment',
  'Background',
  'Experiences',
  'Domain cards',
  'Connections',
  'Gold & inventory',
] as const;

const POTIONS = [
  { ref: 'minor-health-potion', name: 'Minor Health Potion', text: 'Clear 1d4 Hit Points.' },
  { ref: 'minor-stamina-potion', name: 'Minor Stamina Potion', text: 'Clear 1d4 Stress.' },
] as const;

interface Draft {
  name: string;
  pronouns: string;
  classRef: Ref;
  subclassRef: Ref | null;
  /** Mixed Ancestry takes the first feature from one lineage, the second from another. */
  mixed: boolean;
  ancestryTop: Ref | null;
  ancestryBottom: Ref | null;
  communityRef: Ref | null;
  traits: Partial<Record<Trait, number>>;
  primary: Ref | null;
  secondary: Ref | null;
  armor: Ref | null;
  background: string[];
  experiences: Experience[];
  cards: Ref[];
  connections: string[];
  /** Which of the SRD's starting-kit lines are being carried. */
  kit: Record<string, boolean>;
  /** Index into the class's own items. The SRD gives one of them, not all. */
  classItem: number | null;
  potion: string | null;
  gold: Gold;
  inventory: InventoryEntry[];
}

const emptyDraft = (): Draft => ({
  name: '',
  pronouns: '',
  classRef: '',
  subclassRef: null,
  mixed: false,
  ancestryTop: null,
  ancestryBottom: null,
  communityRef: null,
  traits: {},
  primary: null,
  secondary: null,
  armor: null,
  background: [],
  experiences: [
    { id: crypto.randomUUID(), name: '', bonus: 2 },
    { id: crypto.randomUUID(), name: '', bonus: 2 },
  ],
  cards: [],
  connections: [],
  kit: { torch: true, rope: true, supplies: true },
  classItem: 0,
  potion: POTIONS[0].ref,
  // The SRD hands you one handful of gold at step 5.
  gold: { handfuls: 1, bags: 0, chests: 0 },
  inventory: [],
});

function poolRemaining(traits: Draft['traits']): Map<number, number> {
  const pool = new Map<number, number>();
  for (const v of TRAIT_ARRAY) pool.set(v, (pool.get(v) ?? 0) + 1);
  for (const t of TRAITS) {
    const v = traits[t];
    if (v !== undefined) pool.set(v, (pool.get(v) ?? 0) - 1);
  }
  return pool;
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
  const phone = useIsPhone();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const set = (patch: Partial<Draft>): void => setDraft((d) => ({ ...d, ...patch }));

  // A new step starts at its own top, never halfway down the last one's list.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [step]);

  const klass = dataset.classes.find((c) => c.id === draft.classRef);

  const done = useMemo(() => stepsDone(draft, klass), [draft, klass]);
  const { blockers, warnings } = useMemo(() => review(draft, klass, dataset), [draft, klass, dataset]);

  const finish = async (): Promise<void> => {
    if (blockers.length > 0 || !klass) return;
    // The starting HP, Stress, Hope and armor slots are not written down here:
    // the engine derives every maximum from the class and the armor, and
    // syncCounters is what a level up and an armor change already go through.
    const sheet = newCharacter(assemble(draft, klass, dataset.consumables));
    await create(syncCounters(sheet, deriveStats(sheet, dataset, index)));
    onCreated?.();
    setScreen('play');
  };

  const last = step === STEPS.length - 1;

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <WizardHeader step={step} setStep={setStep} done={done} phone={phone} onCancel={onCancel} />

      <div
        ref={panel}
        className="scroll"
        style={{ flex: 1, minHeight: 0, padding: phone ? '14px 12px 20px' : '18px 20px 24px' }}
      >
        <div className="stack" style={{ gap: 18, maxWidth: 980, margin: '0 auto' }}>
          {step === 0 && <StepClass draft={draft} set={set} />}
          {step === 1 && <StepHeritage draft={draft} set={set} />}
          {step === 2 && <StepTraits draft={draft} set={set} />}
          {step === 3 && <StepRecord klass={klass} armorRef={draft.armor} />}
          {step === 4 && <StepEquipment draft={draft} set={set} klass={klass} />}
          {step === 5 && <StepBackground draft={draft} set={set} klass={klass} />}
          {step === 6 && <StepExperiences draft={draft} set={set} />}
          {step === 7 && <StepCards draft={draft} set={set} klass={klass} />}
          {step === 8 && <StepConnections draft={draft} set={set} klass={klass} />}
          {step === 9 && (
            <StepGold draft={draft} set={set} klass={klass} blockers={blockers} warnings={warnings} />
          )}
        </div>
      </div>

      <nav
        className="row"
        aria-label="Wizard navigation"
        style={{
          flex: 'none',
          gap: 10,
          padding: phone ? '10px 12px' : '12px 20px',
          borderTop: '1px solid var(--line-soft)',
          background: 'var(--panel)',
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{ flex: phone ? 1 : 'none', minHeight: 48, minWidth: 108 }}
        >
          Back
        </button>
        {!phone && (
          <span className="t-meta" style={{ flex: 1, color: 'var(--dim)' }}>
            {last
              ? blockers.length === 0
                ? 'READY TO CREATE'
                : `${blockers.length} THING${blockers.length === 1 ? '' : 'S'} STILL MISSING`
              : `NEXT — ${STEPS[step + 1]?.toUpperCase()}`}
          </span>
        )}
        {last ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void finish()}
            disabled={blockers.length > 0}
            style={{ flex: phone ? 2 : 'none', minHeight: 48, minWidth: 168 }}
          >
            Create character
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            style={{ flex: phone ? 2 : 'none', minHeight: 48, minWidth: 128 }}
          >
            Next
          </button>
        )}
      </nav>
    </div>
  );
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
}: {
  step: number;
  setStep: (n: number) => void;
  done: boolean[];
  phone: boolean;
  onCancel?: () => void;
}): React.JSX.Element {
  const title = STEPS[step] ?? '';

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
              key={s}
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
      <ol
        className="row"
        style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none', flexWrap: 'wrap' }}
      >
        {STEPS.map((s, i) => {
          const current = i === step;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={current ? 'step' : undefined}
                title={`${i + 1}. ${s}`}
                className="row"
                style={{
                  gap: 7,
                  height: 34,
                  padding: '0 11px',
                  borderRadius: 'var(--r2)',
                  background: current ? 'var(--raised)' : 'transparent',
                  border: `1px solid ${current ? 'var(--line)' : 'transparent'}`,
                }}
              >
                <span
                  className="t-num"
                  style={{ fontSize: 11, color: current ? 'var(--text)' : 'var(--dim)' }}
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
// Step 1 — class and subclass
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
  const klass = dataset.classes.find((c) => c.id === draft.classRef);
  const subclasses = dataset.subclasses.filter((s) => s.classRef === draft.classRef);

  return (
    <>
      <Section label="Identity" hint="You can fill these in at any point">
        <Columns min={220}>
          <LabelledInput
            label="Name"
            value={draft.name}
            onChange={(name) => set({ name })}
            placeholder="Unnamed"
          />
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
              <Choice
                key={c.id}
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
                body={c.description}
                clamp={3}
                lead={
                  <span className="row" style={{ gap: 3, flex: 'none', marginTop: 2 }}>
                    <DomainMark domain={c.domains[0]} size={13} shapes={shapes} />
                    <DomainMark domain={c.domains[1]} size={13} shapes={shapes} />
                  </span>
                }
              />
            ))}
          </Columns>
        )}
      </Section>

      {klass && (
        <>
          <Section label={`${klass.name} features`} hint="Text, not automation">
            <div className="stack" style={{ gap: 8 }}>
              <FeatureBlock name={klass.hopeFeature.name} text={klass.hopeFeature.text} tag="HOPE" />
              {klass.classFeatures.map((f) => (
                <FeatureBlock key={f.name} name={f.name} text={f.text} />
              ))}
            </div>
          </Section>

          <Section label="Choose a subclass" hint="You take its Foundation card">
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
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — heritage
// ---------------------------------------------------------------------------

function AncestryFeature({ ancestry, which }: { ancestry: Ancestry; which: 0 | 1 }): React.JSX.Element {
  const f = ancestry.features[which];
  return <FeatureBlock name={f.name} text={f.text} tag={which === 0 ? 'FIRST' : 'SECOND'} />;
}

function StepHeritage({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const top = dataset.ancestries.find((a) => a.id === draft.ancestryTop);
  const bottom = dataset.ancestries.find((a) => a.id === draft.ancestryBottom);
  const community = dataset.communities.find((c) => c.id === draft.communityRef);

  if (dataset.ancestries.length === 0) return <DatasetEmpty what="ancestries or communities" />;

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
              <Choice
                key={a.id}
                selected={draft.ancestryTop === a.id}
                onClick={() => set({ ancestryTop: a.id })}
                title={a.name}
                meta={`${a.features[0].name.toUpperCase()} · ${a.features[1].name.toUpperCase()}`}
                body={a.description}
                clamp={2}
              />
            ))}
          </Columns>
        ) : (
          <Columns min={300}>
            <div className="stack" style={{ gap: 8 }}>
              <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                FIRST FEATURE FROM
              </span>
              {dataset.ancestries.map((a) => (
                <Choice
                  key={a.id}
                  selected={draft.ancestryTop === a.id}
                  disabled={draft.ancestryBottom === a.id}
                  reason={draft.ancestryBottom === a.id ? 'Already your second lineage' : undefined}
                  onClick={() => set({ ancestryTop: a.id })}
                  title={a.name}
                  meta={a.features[0].name.toUpperCase()}
                />
              ))}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                SECOND FEATURE FROM
              </span>
              {dataset.ancestries.map((a) => (
                <Choice
                  key={a.id}
                  selected={draft.ancestryBottom === a.id}
                  disabled={draft.ancestryTop === a.id}
                  reason={draft.ancestryTop === a.id ? 'Already your first lineage' : undefined}
                  onClick={() => set({ ancestryBottom: a.id })}
                  title={a.name}
                  meta={a.features[1].name.toUpperCase()}
                />
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

      <Section label="Community" hint={`${dataset.communities.length} to choose from`}>
        <Columns min={250}>
          {dataset.communities.map((c) => (
            <Choice
              key={c.id}
              selected={draft.communityRef === c.id}
              onClick={() => set({ communityRef: c.id })}
              title={c.name}
              meta={c.feature.name.toUpperCase()}
              body={c.description}
              clamp={2}
            />
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — traits
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
                    {TRAIT_VERBS[t].toUpperCase()}
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
// Step 4 — the numbers the class hands you
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
    return <Callout tone="warn" items={['Choose a class at step 1 and these numbers fill in.']} />;
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
              'Your thresholds are your armor’s base thresholds plus your level. Pick armor at step 5 and they appear here.',
            ]}
          />
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — equipment
// ---------------------------------------------------------------------------

function StepEquipment({
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
  const twoHanded = primary?.burden === 2;

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
            note={primary && tierNote(primary.tier, sheet.level)}
            empty={`Search ${dataset.weapons.length} weapons`}
            onOpen={() => setOpen('primary')}
          />
          <GearSlot
            label="Secondary weapon"
            title={twoHanded ? null : (secondary?.name ?? null)}
            meta={secondary && weaponSummary(secondary, stats)}
            note={
              twoHanded && primary
                ? `${primary.name} is two-handed — there is no hand left for an off-hand weapon`
                : secondary && tierNote(secondary.tier, sheet.level)
            }
            empty={twoHanded ? 'Both hands are on the primary' : 'Optional'}
            disabled={twoHanded}
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
          />
        </div>
      </Section>

      {open === 'armor' ? (
        <ArmorPicker
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
            slot={open}
            value={open === 'primary' ? draft.primary : draft.secondary}
            sheet={sheet}
            stats={stats}
            onPick={(ref) => {
              // A two-handed primary leaves no hand for an off-hand weapon, so
              // taking one puts the secondary down rather than leaving a sheet
              // that says you are holding three things.
              if (open === 'primary') {
                const picked = ref === null ? undefined : index.weapons.get(ref);
                set({ primary: ref, secondary: picked?.burden === 2 ? null : draft.secondary });
              } else {
                set({ secondary: ref });
              }
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
// Steps 6 and 9 — the class's written questions
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
        emptyNote="Choose a class at step 1 to see its background questions."
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
        emptyNote="Choose a class at step 1 to see its connection questions."
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Step 7 — experiences
// ---------------------------------------------------------------------------

function StepExperiences({
  draft,
  set,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
}): React.JSX.Element {
  return (
    <Section label="Two Experiences, each at +2" hint="Spend a Hope to add one to a roll">
      <p className="t-dense" style={{ margin: 0 }}>
        An Experience is a word or phrase for a set of skills, traits or aptitudes your character
        picked up. It cannot be so broad that it applies to every roll — "Lucky" — and it cannot
        grant a mechanical ability of its own. Backgrounds, characteristics, specialties, skills and
        phrases all work: Fallen Monarch, Stubborn to a Fault, Master of Disguise, Deadly Aim, I've
        Got Your Back.
      </p>
      <ExperienceEditor
        value={draft.experiences}
        onChange={(experiences) => set({ experiences })}
        minRows={2}
        lockBonus
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Step 8 — domain cards
// ---------------------------------------------------------------------------

function StepCards({
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

  if (!klass) return <Callout tone="warn" items={['Choose a class at step 1 to see its domains.']} />;

  const cards = dataset.domainCards
    .filter((c) => c.level === 1 && klass.domains.includes(c.domain))
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));

  if (cards.length === 0) return <DatasetEmpty what="domain cards" />;

  const toggle = (id: Ref): void => {
    if (draft.cards.includes(id)) set({ cards: draft.cards.filter((r) => r !== id) });
    else if (draft.cards.length < 2) set({ cards: [...draft.cards, id] });
  };

  return (
    <Section
      label="Two level 1 cards"
      hint={`${draft.cards.length} / 2 CHOSEN`}
    >
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        {klass.domains.map((d) => (
          <span key={d} className="row chip" style={{ gap: 6, minHeight: 'var(--control)', padding: '0 9px' }}>
            <DomainMark domain={d} size={11} shapes={shapes} />
            <span style={{ textTransform: 'uppercase' }}>{d}</span>
          </span>
        ))}
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          ONE FROM EACH, OR TWO FROM ONE — WHICHEVER YOU PREFER
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${phone ? 150 : 200}px, 1fr))`,
          gap: 12,
        }}
      >
        {cards.map((card) => {
          const taken = draft.cards.includes(card.id);
          const full = draft.cards.length >= 2 && !taken;
          return (
            // Two separate targets rather than a control nested inside the
            // card's own button: tapping the card reads it, the bar below
            // commits to it. Taking a card is a decision and earns its own tap.
            <div key={card.id} className="stack" style={{ gap: 6 }}>
              <DomainCardView
                card={card}
                shapes={shapes}
                onOpen={() => setOpenCard(card)}
                height={phone ? 262 : 300}
                headHeight={phone ? 76 : 92}
                clamp={phone ? 3 : 4}
                dimmed={full}
                footer={
                  <>
                    <span className="t-meta" style={{ letterSpacing: '0.09em' }}>
                      TAP FOR FULL TEXT
                    </span>
                    <span className="t-meta" style={{ color: 'var(--dim)' }}>
                      RECALL {card.recallCost}
                    </span>
                  </>
                }
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
                  {taken ? 'TAKEN' : full ? 'TWO ALREADY' : 'TAKE'}
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
// Step 10 — gold and inventory
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
  blockers: string[];
  warnings: string[];
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

      <Callout tone="error" items={blockers} />
      <Callout tone="warn" items={warnings} word="YOU CAN STILL CREATE" />
      {blockers.length === 0 && warnings.length === 0 && (
        <Callout tone="ok" items={['Every step is answered. Create the character.']} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Rules of completion
// ---------------------------------------------------------------------------

interface KitLine {
  key: string;
  name: string;
  tag: string;
}

/** The three lines step 5 gives every character regardless of class. */
const STARTER_KIT: KitLine[] = [
  { key: 'torch', name: 'A torch', tag: 'SRD' },
  { key: 'rope', name: '50 feet of rope', tag: 'SRD' },
  { key: 'supplies', name: 'Basic supplies', tag: 'SRD' },
];

function stepsDone(draft: Draft, klass: CharClass | undefined): boolean[] {
  const heritage =
    draft.ancestryTop !== null &&
    draft.communityRef !== null &&
    (!draft.mixed || draft.ancestryBottom !== null);
  const answered = (a: string[]): boolean => a.some((s) => s.trim() !== '');
  return [
    draft.classRef !== '' && draft.subclassRef !== null,
    heritage,
    TRAITS.every((t) => draft.traits[t] !== undefined),
    klass !== undefined,
    draft.primary !== null && draft.armor !== null,
    answered(draft.background),
    draft.experiences.filter((e) => e.name.trim() !== '').length >= 2,
    draft.cards.length === 2,
    answered(draft.connections),
    klass !== undefined,
  ];
}

/**
 * Blockers stop creation; warnings do not. The split follows the SRD: the
 * mechanical choices are required, the written ones can be discovered in play.
 */
function review(
  draft: Draft,
  klass: CharClass | undefined,
  dataset: Dataset,
): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // A choice is only a blocker when the dataset can actually offer it.
  // Otherwise the wizard demands something nobody can give and the Create
  // button is dead with no way to explain itself.
  if (dataset.classes.length === 0) {
    blockers.push('Step 1: this dataset has no classes, and a character cannot be built without one.');
  } else if (!klass) {
    blockers.push('Step 1: choose a class.');
  } else if (draft.subclassRef === null) {
    if (dataset.subclasses.some((s) => s.classRef === klass.id)) {
      blockers.push('Step 1: choose a subclass.');
    } else {
      warnings.push(`Step 1: this dataset has no subclasses for ${klass.name}.`);
    }
  }

  if (dataset.ancestries.length === 0) {
    warnings.push('Step 2: no ancestries in this dataset.');
  } else {
    if (draft.ancestryTop === null) blockers.push('Step 2: choose an ancestry.');
    if (draft.mixed && draft.ancestryBottom === null) {
      blockers.push('Step 2: a Mixed Ancestry needs a second lineage for its second feature.');
    }
  }
  if (dataset.communities.length === 0) {
    warnings.push('Step 2: no communities in this dataset.');
  } else if (draft.communityRef === null) {
    blockers.push('Step 2: choose a community.');
  }

  const unassigned = TRAITS.filter((t) => draft.traits[t] === undefined).length;
  if (unassigned > 0) {
    blockers.push(
      `Step 3: ${unassigned} trait${unassigned === 1 ? '' : 's'} still have no modifier.`,
    );
  }

  if (dataset.weapons.length > 0 || dataset.armors.length > 0) {
    if (draft.primary === null) blockers.push('Step 5: choose a primary weapon.');
    if (draft.armor === null) blockers.push('Step 5: choose a set of armor.');
    // Above tier 1 is a warning, never a blocker: the SRD starts a character
    // at tier 1, but a table that hands out an heirloom at creation has not
    // done anything this app gets to refuse.
    const gear = [
      draft.primary === null ? undefined : dataset.weapons.find((w) => w.id === draft.primary),
      draft.secondary === null ? undefined : dataset.weapons.find((w) => w.id === draft.secondary),
      draft.armor === null ? undefined : dataset.armors.find((a) => a.id === draft.armor),
    ];
    for (const item of gear) {
      if (item !== undefined && item.tier > tierOf(1)) {
        warnings.push(`Step 5: ${item.name} is tier ${item.tier} — the SRD starts you at tier 1.`);
      }
    }
  } else {
    warnings.push('Step 5: no weapon or armor tables in this dataset, so equipment is empty.');
  }

  if (dataset.domainCards.length > 0) {
    const missing = 2 - draft.cards.length;
    if (missing > 0) {
      blockers.push(`Step 8: take ${missing} more domain card${missing === 1 ? '' : 's'}.`);
    }
  } else {
    warnings.push('Step 8: no domain cards in this dataset.');
  }

  if (draft.name.trim() === '') warnings.push('No name yet — the sheet will read "Unnamed".');
  if (draft.experiences.filter((e) => e.name.trim() !== '').length < 2) {
    warnings.push('Step 7: both Experiences are worth +2 whether or not you have named them.');
  }
  if (!draft.background.some((a) => a.trim() !== '')) {
    warnings.push('Step 6: no background answers — fine, you can discover them in play.');
  }
  if (!draft.connections.some((a) => a.trim() !== '')) {
    warnings.push('Step 9: no connections yet — these are usually written with the other players.');
  }

  return { blockers, warnings };
}

function assemble(
  draft: Draft,
  klass: CharClass,
  consumables: Array<{ id: string; name: string; text: string }>,
): Partial<Character> {
  const traits = {} as Record<Trait, number>;
  for (const t of TRAITS) traits[t] = draft.traits[t] ?? 0;

  const inventory: InventoryEntry[] = STARTER_KIT.filter(
    (line) => draft.kit[line.key] !== false,
  ).map((line) => ({ ref: null, name: line.name, quantity: 1 }));

  const classItem = draft.classItem === null ? undefined : klass.classItems[draft.classItem];
  if (classItem !== undefined) inventory.push({ ref: null, name: classItem, quantity: 1 });

  if (draft.potion !== null) {
    const known = consumables.find((c) => c.id === draft.potion);
    const printed = POTIONS.find((p) => p.ref === draft.potion);
    inventory.push({
      ref: known?.id ?? null,
      name: known?.name ?? printed?.name ?? 'Potion',
      quantity: 1,
      note: known?.text ?? printed?.text,
    });
  }
  inventory.push(...draft.inventory.filter((e) => e.name.trim() !== ''));

  const notes = klass.backgroundQuestions
    .map((q, i) => ({ q, a: (draft.background[i] ?? '').trim() }))
    .filter((row) => row.a !== '')
    .map((row) => `${row.q}\n${row.a}`)
    .join('\n\n');

  const connections = klass.connectionQuestions
    .map((q, i) => ({ q, a: (draft.connections[i] ?? '').trim() }))
    .filter((row) => row.a !== '')
    .map((row) => `${row.q} — ${row.a}`);

  const ancestryRefs = draft.mixed
    ? [draft.ancestryTop, draft.ancestryBottom].filter((r): r is Ref => r !== null)
    : draft.ancestryTop !== null
      ? [draft.ancestryTop]
      : [];

  return {
    name: draft.name.trim(),
    pronouns: draft.pronouns.trim(),
    classRef: klass.id,
    subclassRefs: draft.subclassRef === null ? [] : [draft.subclassRef],
    ancestryRefs,
    communityRef: draft.communityRef,
    level: 1,
    traits,
    // Two cards at level 1 fit inside the five-card loadout, so they start active.
    loadout: draft.cards,
    vault: [],
    activePrimaryWeapon: draft.primary,
    activeSecondaryWeapon: draft.secondary,
    activeArmor: draft.armor,
    inventory,
    experiences: draft.experiences.filter((e) => e.name.trim() !== ''),
    gold: draft.gold,
    connections,
    notes,
  };
}
