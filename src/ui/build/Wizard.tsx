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
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TRAITS,
  TRAIT_LABELS,
  type Ancestry,
  type CharClass,
  type Ref,
  type Trait,
} from '../../../shared/types.ts';
import { deriveStats, newCharacter, syncCounters } from '../../engine/character.ts';
import { useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
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

/** The fixed array the traits step distributes. Placed, never rolled. */
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

  const done = useMemo(() => stepsDone(draft, klass, dataset), [draft, klass, dataset]);
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
        setStep={setStep}
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
        </div>
      </div>

      <nav
        className="stack"
        aria-label="Wizard navigation"
        style={{
          flex: 'none',
          gap: 8,
          padding: phone ? '10px 12px' : '12px 20px',
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
        <div className="row" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
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
                style={{
                  gap: 7,
                  height: 34,
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
  const klass = dataset.classes.find((c) => c.id === draft.classRef);

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
