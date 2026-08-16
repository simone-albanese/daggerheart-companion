/**
 * Levelling up.
 *
 * Every constraint on this screen comes out of engine/levelUp.ts - the option
 * list, how many slots each has left in each tier, and validatePlan(). Nothing
 * here decides a rule; it only shows what the engine already knows and refuses
 * to apply a plan the engine calls invalid.
 *
 * The one piece of pure typography that matters: Proficiency and Multiclass are
 * printed inside a black box in the book, because each eats both of the level's
 * advancements. That box is reproduced, not paraphrased - a player who has seen
 * the page recognises it instantly, and one who hasn't learns the rule from the
 * shape.
 */
import { useMemo, useState } from 'react';
import {
  TRAITS,
  TRAIT_LABELS,
  type DomainCard,
  type DomainId,
  type Ref,
  type Tier,
  type Trait,
} from '../../../shared/types.ts';
import { MAX_LEVEL, deriveStats, tierOf, type DerivedStats } from '../../engine/character.ts';
import {
  applyLevelUp,
  availableOptions,
  slotUsage,
  slotsPerTaking,
  tierAchievementFor,
  validatePlan,
  type AdvancementOption,
  type LevelUpPlan,
} from '../../engine/levelUp.ts';
import { normalizeActive, useActive, useApp } from '../../store/state.ts';
import { DomainMark } from '../shared/DomainMark.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { Callout, Choice, Columns, LabelledInput, Mark, Section, SlotBoxes } from './parts.tsx';

type Pick = LevelUpPlan['picks'][number];

export function LevelUp({
  stats,
  onDone,
}: {
  stats: DerivedStats;
  onDone: () => void;
}): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const phone = useIsPhone();

  const [picks, setPicks] = useState<Pick[]>([]);
  const [newCardRef, setNewCardRef] = useState<Ref | null>(null);
  const [experienceName, setExperienceName] = useState('');

  if (!character) return null;

  const toLevel = character.level + 1;
  const tier = tierOf(toLevel);
  const achievement = tierAchievementFor(toLevel);

  if (character.level >= MAX_LEVEL) {
    return (
      <div style={{ padding: 20, maxWidth: 640 }}>
        <Callout
          tone="info"
          word="TOP OF THE TRACK"
          items={[`Level ${MAX_LEVEL} is the maximum. There is nothing left to advance.`]}
        />
      </div>
    );
  }

  // The engine reads the tier achievement's Experience off the first pick.
  const plan: LevelUpPlan = {
    fromLevel: character.level,
    toLevel,
    tier,
    achievement,
    picks: picks.map((p, i) =>
      i === 0 && achievement !== null
        ? { ...p, detail: { ...p.detail, achievementExperience: experienceName.trim() } }
        : p,
    ),
    newCardRef,
  };

  const validation = validatePlan(character, plan);

  // Every "after" number on this screen is the engine's answer for the sheet
  // this plan produces, never a delta worked out here. Two of them are not the
  // +1 they look like: an unarmored character's Severe threshold is twice their
  // level, so it climbs by 2, and a Proficiency advancement taken at level 5
  // stacks with the tier achievement that also lands there.
  const after = deriveStats(applyLevelUp(character, plan), dataset, index);

  const options = availableOptions(tier);
  const usage = new Map(slotUsage(character).map((u) => [`${u.optionId}@${u.tier}`, u]));

  // Boxes, not takings, and through the engine's own helper - this used to be
  // its own count of entries, so the button and the validator disagreed about
  // whether a black-boxed option still had room.
  const spentThisPlan = (option: AdvancementOption & { tier: Tier }): number =>
    picks.filter((p) => p.optionId === option.id && p.optionTier === option.tier).length *
    slotsPerTaking(option);

  const picksUsed = picks.reduce(
    (n, p) => n + (options.find((o) => o.id === p.optionId && o.tier === p.optionTier)?.costsBothPicks === true ? 2 : 1),
    0,
  );

  const chosen = (id: string, t: Tier): Pick | undefined =>
    picks.find((p) => p.optionId === id && p.optionTier === t);

  /**
   * Cards already spoken for elsewhere in this plan. Step four and the
   * "additional domain card" advancement are two separate pickers writing into
   * one vault, and without this each is happy to take the card the other took -
   * `applyLevelUp` then pushes the same ref twice and the character owns two
   * copies of it.
   */
  const cardRefsInPlan = (): string[] =>
    picks.map((p) => p.detail['cardRef']).filter((r): r is string => typeof r === 'string');
  const otherCardRefs = (self: Pick): string[] => [
    ...(newCardRef === null ? [] : [newCardRef]),
    ...picks
      .filter((p) => p !== self)
      .map((p) => p.detail['cardRef'])
      .filter((r): r is string => typeof r === 'string'),
  ];

  const toggle = (option: AdvancementOption & { tier: Tier }): void => {
    const already = chosen(option.id, option.tier);
    if (already) {
      setPicks(picks.filter((p) => p !== already));
      return;
    }
    if (option.costsBothPicks) {
      // A black-box option is the whole level; it replaces anything else.
      setPicks([{ optionId: option.id, optionTier: option.tier, detail: {} }]);
      return;
    }
    const withoutBoxed = picks.filter(
      (p) => options.find((o) => o.id === p.optionId && o.tier === p.optionTier)?.costsBothPicks !== true,
    );
    if (withoutBoxed.length >= 2) return;
    setPicks([...withoutBoxed, { optionId: option.id, optionTier: option.tier, detail: {} }]);
  };

  const setDetail = (pick: Pick, detail: Record<string, unknown>): void =>
    setPicks(picks.map((p) => (p === pick ? { ...p, detail: { ...p.detail, ...detail } } : p)));

  const apply = (): void => {
    if (!validation.ok) return;
    update((c) => applyLevelUp(c, plan));
    normalizeActive();
    pushLog({
      kind: 'note',
      label: `Level ${toLevel}`,
      detail: picks
        .map((p) => options.find((o) => o.id === p.optionId && o.tier === p.optionTier)?.label ?? p.optionId)
        .join(' · '),
    });
    onDone();
  };

  const boxed = options.filter((o) => o.costsBothPicks);
  const plain = options.filter((o) => !o.costsBothPicks);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <div
        className="scroll"
        style={{ flex: 1, minHeight: 0, padding: phone ? '14px 12px 20px' : '18px 20px 24px' }}
      >
        <div className="stack" style={{ gap: 20, maxWidth: 900, margin: '0 auto' }}>
          <header className="spread" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="t-label">Level up</div>
              <div className="row" style={{ gap: 10, marginTop: 8, alignItems: 'baseline' }}>
                <span style={{ font: '800 30px/1 var(--sans)', color: 'var(--dim)' }}>
                  {character.level}
                </span>
                <span style={{ color: 'var(--dim)' }}>→</span>
                <span style={{ font: '900 40px/1 var(--sans)', letterSpacing: '-0.03em' }}>
                  {toLevel}
                </span>
              </div>
            </div>
            <span className="chip" style={{ minHeight: 'var(--control)', display: 'inline-flex', alignItems: 'center' }}>
              TIER {tier}
            </span>
          </header>

          {/* Step one. */}
          <Section label="Tier achievement" hint={achievement === null ? 'NONE AT THIS LEVEL' : undefined}>
            {achievement === null ? (
              <p className="t-dense" style={{ margin: 0 }}>
                Tier achievements land at levels 2, 5 and 8. This level brings advancements only.
              </p>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                <div
                  className="stack"
                  style={{
                    gap: 6,
                    padding: '12px 13px',
                    borderRadius: 'var(--r3)',
                    background: 'var(--panel)',
                    border: '1px solid var(--line-soft)',
                    borderLeft: '3px solid var(--hope)',
                  }}
                >
                  <span className="t-body" style={{ margin: 0, color: 'var(--text-2)' }}>
                    {achievement.text}
                  </span>
                  <span className="t-meta" style={{ color: 'var(--dim)' }}>
                    PROFICIENCY {stats.proficiency} → {after.proficiency}
                    {achievement.clearTraitMarks ? ' · TRAIT MARKS CLEAR' : ''}
                  </span>
                </div>
                <LabelledInput
                  label="The new Experience (+2)"
                  value={experienceName}
                  onChange={setExperienceName}
                  placeholder="e.g. Veteran of the Siege"
                  hint="It is added at +2 whether or not you name it now."
                />
              </div>
            )}
          </Section>

          {/* Step three, shown before the choices because it needs no decision. */}
          <Section label="Automatic" hint="NO CHOICE TO MAKE">
            <Columns min={220}>
              <div className="panel stack" style={{ padding: '12px 13px', gap: 7 }}>
                <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                  DAMAGE THRESHOLDS
                </span>
                <span className="row" style={{ gap: 9, alignItems: 'baseline' }}>
                  <span style={{ font: '600 18px/1 var(--sans)', color: 'var(--dim)' }}>
                    {stats.thresholds[0]}/{stats.thresholds[1]}
                  </span>
                  <span style={{ color: 'var(--dim)' }}>→</span>
                  <span style={{ font: '800 26px/1 var(--sans)' }}>
                    {after.thresholds[0]}/{after.thresholds[1]}
                  </span>
                </span>
                <span className="t-meta" style={{ color: 'var(--dim)' }}>
                  THRESHOLDS ARE YOUR ARMOR&rsquo;S BASE PLUS YOUR LEVEL
                </span>
              </div>
            </Columns>
          </Section>

          {/* Step two. */}
          <Section
            label="Two advancements"
            hint={
              <span className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <SlotBoxes used={Math.min(2, picksUsed)} slots={2} size={15} />
                <span>{picksUsed} / 2 SPENT</span>
              </span>
            }
          >
            <p className="t-dense" style={{ margin: 0 }}>
              Choose any two advancements with at least one unmarked slot, from your tier or below.
              Each tier keeps its own slots.
            </p>

            {([2, 3, 4] as Tier[])
              .filter((t) => t <= tier)
              .map((t) => {
                const inTier = plain.filter((o) => o.tier === t);
                if (inTier.length === 0) return null;
                return (
                  <div key={t} className="stack" style={{ gap: 8 }}>
                    <span className="t-meta" style={{ letterSpacing: '0.14em', color: 'var(--dim)' }}>
                      TIER {t} SLOTS
                    </span>
                    {inTier.map((option) => {
                      const key = `${option.id}@${option.tier}`;
                      const used = (usage.get(key)?.used ?? 0) + spentThisPlan(option);
                      const pick = chosen(option.id, option.tier);
                      const full = used >= option.slots && pick === undefined;
                      return (
                        <div key={key} className="stack" style={{ gap: 8 }}>
                          <Choice
                            selected={pick !== undefined}
                            disabled={full}
                            reason={full ? 'Every slot in this tier is marked' : undefined}
                            onClick={() => toggle(option)}
                            title={option.label}
                            meta={
                              <span className="row" style={{ gap: 8 }}>
                                <SlotBoxes used={used} slots={option.slots} />
                                <span>
                                  {Math.max(0, option.slots - used)} OF {option.slots} LEFT
                                </span>
                              </span>
                            }
                            body={option.detail}
                          />
                          {pick && (
                            <PickDetail
                              option={option}
                              pick={pick}
                              stats={after}
                              toLevel={toLevel}
                              alreadyTaken={otherCardRefs(pick)}
                              onChange={(d) => setDetail(pick, d)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

            {boxed.length > 0 && (
              <BlackBox>
                {boxed.map((option) => {
                  const key = `${option.id}@${option.tier}`;
                  const used = (usage.get(key)?.used ?? 0) + spentThisPlan(option);
                  const pick = chosen(option.id, option.tier);
                  const full = used >= option.slots && pick === undefined;
                  return (
                    <div key={key} className="stack" style={{ gap: 10 }}>
                      <BoxedOption
                        option={option}
                        used={used}
                        selected={pick !== undefined}
                        disabled={full}
                        onClick={() => toggle(option)}
                      />
                      {pick && (
                        <PickDetail
                          option={option}
                          pick={pick}
                          stats={after}
                          toLevel={toLevel}
                          alreadyTaken={otherCardRefs(pick)}
                          onChange={(d) => setDetail(pick, d)}
                        />
                      )}
                    </div>
                  );
                })}
              </BlackBox>
            )}
          </Section>

          {/* Step four. */}
          <Section label="A new domain card" hint="NOT AN ADVANCEMENT — IT COMES WITH THE LEVEL">
            <CardPicker
              stats={after}
              value={newCardRef}
              onChange={setNewCardRef}
              exclude={cardRefsInPlan()}
            />
          </Section>

          <Callout tone="error" items={validation.errors} />
          <Callout tone="warn" items={validation.warnings} />
        </div>
      </div>

      <nav
        className="row"
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
          onClick={onDone}
          style={{ flex: phone ? 1 : 'none', minHeight: 48, minWidth: 108 }}
        >
          Cancel
        </button>
        {!phone && (
          <span className="t-meta" style={{ flex: 1, color: 'var(--dim)' }}>
            {validation.ok
              ? `READY — LEVEL ${toLevel}`
              : `${validation.errors.length} PROBLEM${validation.errors.length === 1 ? '' : 'S'} TO FIX`}
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={apply}
          disabled={!validation.ok}
          style={{ flex: phone ? 2 : 'none', minHeight: 48, minWidth: 168 }}
        >
          Apply level {toLevel}
        </button>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The black box
// ---------------------------------------------------------------------------

/**
 * Reproduced from the printed sheet. The fill stays black in both themes,
 * because the black box *is* the affordance - recolouring it would be like
 * translating a road sign's shape. Only the frame and the caption band follow
 * the theme, so the box separates from a dark page as well as a white one.
 */
function BlackBox({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className="stack"
      style={{
        borderRadius: 'var(--r3)',
        overflow: 'hidden',
        background: '#000',
        border: '2px solid var(--text)',
      }}
    >
      <div
        className="row"
        style={{ minHeight: 'var(--control)', padding: '0 10px', background: 'var(--text)', flex: 'none' }}
      >
        <span className="t-label" style={{ color: 'var(--app)', letterSpacing: '0.18em' }}>
          Costs both advancements
        </span>
      </div>
      <div className="stack" style={{ gap: 10, padding: 12 }}>
        {children}
      </div>
    </div>
  );
}

function BoxedOption({
  option,
  used,
  selected,
  disabled,
  onClick,
}: {
  option: AdvancementOption & { tier: Tier };
  used: number;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="stack"
      style={{
        gap: 8,
        width: '100%',
        minHeight: 'var(--tap)',
        padding: '11px 12px',
        textAlign: 'left',
        borderRadius: 'var(--r2)',
        background: selected ? '#1c1e26' : 'transparent',
        border: `1px solid ${selected ? '#f2f0ea' : '#494d59'}`,
        color: '#f2f0ea',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span className="row" style={{ gap: 10, width: '100%', alignItems: 'flex-start' }}>
        <span className="stack" style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <span style={{ font: '700 14px/1.2 var(--sans)' }}>{option.label}</span>
          <span className="row" style={{ gap: 8 }}>
            <span className="row" style={{ gap: 4 }} aria-label={`${used} of ${option.slots} marked`}>
              {Array.from({ length: option.slots }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 2,
                    border: '1.5px solid #7c8090',
                    background: i < used ? '#7c8090' : 'transparent',
                  }}
                />
              ))}
            </span>
            <span className="t-meta" style={{ color: '#9aa0ad' }}>
              TIER {option.tier} · {Math.max(0, option.slots - used)} OF {option.slots} LEFT
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            flex: 'none',
            width: 16,
            height: 16,
            marginTop: 1,
            borderRadius: 3,
            background: selected ? '#f2f0ea' : 'transparent',
            border: `1.5px solid ${selected ? '#f2f0ea' : '#4a4d59'}`,
          }}
        />
      </span>
      <span className="t-dense" style={{ color: '#b4b1ab' }}>
        {option.detail}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// What each advancement still needs from the player
// ---------------------------------------------------------------------------

function DetailShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="stack"
      style={{
        gap: 9,
        margin: '0 0 0 12px',
        padding: '11px 12px',
        borderLeft: '2px solid var(--hope)',
        background: 'var(--app)',
        borderRadius: '0 var(--r3) var(--r3) 0',
      }}
    >
      <span className="t-label">{label}</span>
      {children}
    </div>
  );
}

function PickDetail({
  option,
  pick,
  stats,
  toLevel,
  alreadyTaken,
  onChange,
}: {
  option: AdvancementOption & { tier: Tier };
  pick: Pick;
  /** Stats for the sheet this plan produces, so caps read at the new level. */
  stats: DerivedStats;
  toLevel: number;
  /** Cards another part of this same plan has already claimed. */
  alreadyTaken: string[];
  onChange: (detail: Record<string, unknown>) => void;
}): React.JSX.Element | null {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  if (!character) return null;

  if (option.kind === 'trait') {
    const picked = (pick.detail['traits'] as Trait[] | undefined) ?? [];
    return (
      <DetailShell label="Choose two unmarked traits">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 7 }}>
          {TRAITS.map((t) => {
            const marked = (character.traitMarks[t] ?? 0) > 0;
            const on = picked.includes(t);
            const blocked = marked || (!on && picked.length >= 2);
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  onChange({ traits: on ? picked.filter((x) => x !== t) : [...picked, t] })
                }
                disabled={blocked}
                aria-pressed={on}
                className="row"
                style={{
                  gap: 8,
                  minHeight: 'var(--tap)',
                  padding: '0 10px',
                  borderRadius: 'var(--r2)',
                  border: `1px solid ${on ? 'var(--line)' : 'var(--line-soft)'}`,
                  background: on ? 'var(--raised)' : 'var(--panel)',
                  opacity: blocked ? 0.4 : 1,
                }}
              >
                <Mark on={on} size={14} />
                <span style={{ flex: 1, font: '600 13px/1 var(--sans)', textAlign: 'left' }}>
                  {TRAIT_LABELS[t]}
                </span>
                <span className="t-num" style={{ color: 'var(--muted)' }}>
                  {character.traits[t] >= 0 ? '+' : '−'}
                  {Math.abs(character.traits[t])}
                  {on ? ' → ' : ''}
                  {on ? `${character.traits[t] + 1 >= 0 ? '+' : '−'}${Math.abs(character.traits[t] + 1)}` : ''}
                </span>
                {marked && <span className="t-meta" style={{ color: 'var(--dim)' }}>MARKED</span>}
              </button>
            );
          })}
        </div>
      </DetailShell>
    );
  }

  if (option.kind === 'experience') {
    const picked = (pick.detail['experiences'] as string[] | undefined) ?? [];
    return (
      <DetailShell label="Choose two Experiences">
        {character.experiences.length === 0 ? (
          <span className="t-dense" style={{ color: 'var(--dim)' }}>
            This character has no Experiences to raise yet.
          </span>
        ) : (
          <div className="stack" style={{ gap: 7 }}>
            {character.experiences.map((e) => {
              const on = picked.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() =>
                    onChange({ experiences: on ? picked.filter((x) => x !== e.id) : [...picked, e.id] })
                  }
                  disabled={!on && picked.length >= 2}
                  aria-pressed={on}
                  className="row"
                  style={{
                    gap: 9,
                    minHeight: 'var(--tap)',
                    padding: '0 10px',
                    borderRadius: 'var(--r2)',
                    border: `1px solid ${on ? 'var(--line)' : 'var(--line-soft)'}`,
                    background: on ? 'var(--raised)' : 'var(--panel)',
                    opacity: !on && picked.length >= 2 ? 0.4 : 1,
                  }}
                >
                  <Mark on={on} size={14} />
                  <span style={{ flex: 1, font: '600 13px/1 var(--sans)', textAlign: 'left' }}>
                    {e.name || 'Unnamed Experience'}
                  </span>
                  <span className="t-num" style={{ color: 'var(--hope)' }}>
                    +{e.bonus}
                    {on ? ` → +${e.bonus + 1}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DetailShell>
    );
  }

  if (option.kind === 'domainCard') {
    return (
      <DetailShell label="The extra card">
        <CardPicker
          stats={stats}
          value={(pick.detail['cardRef'] as string | undefined) ?? null}
          onChange={(ref) => onChange({ cardRef: ref })}
          exclude={alreadyTaken}
        />
      </DetailShell>
    );
  }

  if (option.kind === 'subclass') {
    const owned = character.subclassRefs
      .map((r) => dataset.subclasses.find((s) => s.id === r))
      .filter((s): s is NonNullable<typeof s> => s !== undefined);
    const upgrades = character.levelUpHistory.filter((h) => h.kind === 'subclass').length;
    const nextCard = upgrades === 0 ? 'specialization' : 'mastery';
    return (
      <DetailShell label={`Take the ${nextCard} card`}>
        {owned.length === 0 ? (
          <span className="t-dense" style={{ color: 'var(--dim)' }}>
            No subclass on this character yet.
          </span>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {owned.map((s) => {
              const features = nextCard === 'specialization' ? s.specializationFeatures : s.masteryFeatures;
              return (
                <Choice
                  key={s.id}
                  selected={pick.detail['subclassRef'] === s.id}
                  onClick={() => onChange({ subclassRef: s.id, card: nextCard })}
                  title={s.name}
                  meta={nextCard.toUpperCase()}
                  body={features.map((f) => `${f.name}. ${f.text}`).join('\n\n')}
                  clamp={4}
                />
              );
            })}
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              THEN CROSS OUT THE MULTICLASS OPTION FOR THIS TIER
            </span>
          </div>
        )}
      </DetailShell>
    );
  }

  if (option.kind === 'multiclass') {
    const classRef = pick.detail['classRef'] as string | undefined;
    const chosenClass = dataset.classes.find((c) => c.id === classRef);
    const subclasses = dataset.subclasses.filter((s) => s.classRef === classRef);
    return (
      <DetailShell label="Multiclass">
        <div className="stack" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 7 }}>
            <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
              THE ADDITIONAL CLASS
            </span>
            <Columns min={220}>
              {dataset.classes
                .filter((c) => c.id !== character.classRef)
                .map((c) => (
                  <Choice
                    key={c.id}
                    selected={classRef === c.id}
                    onClick={() => onChange({ classRef: c.id, domain: undefined, subclassRef: undefined })}
                    title={c.name}
                    meta={c.domains.join(' + ').toUpperCase()}
                  />
                ))}
            </Columns>
          </div>

          {chosenClass && (
            <div className="stack" style={{ gap: 7 }}>
              <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                ONE OF ITS DOMAINS · CARDS CAP AT HALF YOUR LEVEL, ROUNDED UP
              </span>
              <Columns min={200}>
                {chosenClass.domains.map((d: DomainId) => (
                  <Choice
                    key={d}
                    selected={pick.detail['domain'] === d}
                    onClick={() => onChange({ domain: d })}
                    title={d.charAt(0).toUpperCase() + d.slice(1)}
                    // Asked of the engine for a sheet that has taken this
                    // domain, rather than halving the level here.
                    meta={`CAP LEVEL ${deriveStats(
                      { ...character, level: toLevel, multiclassDomain: d },
                      dataset,
                      index,
                    ).cardLevelCap(d)}`}
                    accent={`var(--${d})`}
                    lead={<DomainMark domain={d} size={14} />}
                  />
                ))}
              </Columns>
            </div>
          )}

          {chosenClass && (
            <div className="stack" style={{ gap: 7 }}>
              <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
                A FOUNDATION CARD FROM ONE OF ITS SUBCLASSES
              </span>
              <Columns min={260}>
                {subclasses.map((s) => (
                  <Choice
                    key={s.id}
                    selected={pick.detail['subclassRef'] === s.id}
                    onClick={() => onChange({ subclassRef: s.id })}
                    title={s.name}
                    meta={
                      s.spellcastTrait === null
                        ? 'NO SPELLCAST TRAIT'
                        : `SPELLCAST · ${TRAIT_LABELS[s.spellcastTrait].toUpperCase()}`
                    }
                    body={s.foundationFeatures.map((f) => `${f.name}. ${f.text}`).join('\n\n')}
                    clamp={4}
                  />
                ))}
              </Columns>
            </div>
          )}

          {chosenClass && (
            <span className="t-dense" style={{ color: 'var(--muted)' }}>
              You also gain {chosenClass.name}&rsquo;s class feature, and cross out an unused
              &ldquo;upgraded subclass&rdquo; option and the other multiclass option.
            </span>
          )}
        </div>
      </DetailShell>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Picking a card
// ---------------------------------------------------------------------------

function CardPicker({
  stats,
  value,
  onChange,
  exclude,
}: {
  /** Stats for the sheet the plan produces: its domains and its level caps. */
  stats: DerivedStats;
  value: Ref | null;
  onChange: (ref: Ref | null) => void;
  exclude: string[];
}): React.JSX.Element {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const phone = useIsPhone();
  const [domain, setDomain] = useState<DomainId | 'all'>('all');

  const owned = useMemo(
    () => new Set([...(character?.loadout ?? []), ...(character?.vault ?? [])]),
    [character],
  );

  const rows = useMemo(
    () =>
      dataset.domainCards
        .filter(
          (c) =>
            stats.domains.includes(c.domain) &&
            c.level <= stats.cardLevelCap(c.domain) &&
            !owned.has(c.id) &&
            !exclude.includes(c.id) &&
            (domain === 'all' || c.domain === domain),
        )
        .sort(
          (a, b) =>
            b.level - a.level || a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name),
        ),
    [dataset.domainCards, domain, exclude, owned, stats],
  );

  if (dataset.domainCards.length === 0) {
    return (
      <Callout
        tone="warn"
        items={['No domain cards in this dataset, so there is nothing to take at step four.']}
      />
    );
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <FilterPill active={domain === 'all'} onClick={() => setDomain('all')}>
          All {stats.domains.length} domains
        </FilterPill>
        {stats.domains.map((d) => (
          <FilterPill key={d} active={domain === d} onClick={() => setDomain(d)}>
            <DomainMark domain={d} size={11} shapes={shapes} />
            <span style={{ textTransform: 'capitalize' }}>{d}</span>
          </FilterPill>
        ))}
      </div>

      {/* On a phone the level-up panel is already the scrolling region; a second
          one inside it just traps the thumb. On desktop the list is capped so
          the Apply bar stays reachable without a long scroll. */}
      <div className={phone ? 'stack' : 'stack scroll'} style={{ gap: 6, maxHeight: phone ? undefined : 420 }}>
        {rows.map((card: DomainCard) => {
          const on = value === card.id;
          return (
            <div key={card.id} className="row" style={{ gap: 6 }}>
              <button
                type="button"
                onClick={() => onChange(on ? null : card.id)}
                aria-pressed={on}
                className="row"
                style={{
                  flex: 1,
                  minWidth: 0,
                  gap: 10,
                  minHeight: 'var(--tap)',
                  padding: '0 11px',
                  borderRadius: 'var(--r3)',
                  background: on ? 'var(--raised)' : 'var(--panel)',
                  border: `1px solid ${on ? 'var(--line)' : 'var(--line-soft)'}`,
                  borderLeft: `3px solid ${on ? `var(--${card.domain})` : 'transparent'}`,
                }}
              >
                <Mark on={on} size={14} />
                <DomainMark domain={card.domain} size={13} shapes={shapes} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    font: '600 13.5px/1.15 var(--sans)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {card.name}
                </span>
                <span className="t-meta" style={{ flex: 'none' }}>
                  LV{card.level} · {card.type.toUpperCase()} · RECALL {card.recallCost}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setOpenCard(card)}
                aria-label={`Read ${card.name}`}
                className="btn btn-ghost"
                style={{ flex: 'none', minWidth: 44, padding: 0 }}
              >
                <span className="t-meta">TEXT</span>
              </button>
            </div>
          );
        })}
        {rows.length === 0 && (
          <span className="t-dense" style={{ color: 'var(--dim)' }}>
            Every card you can reach in that domain is already yours.
          </span>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="row chip"
      style={{
        minHeight: 'var(--tap)',
        flex: 'none',
        gap: 6,
        padding: '0 10px',
        background: active ? 'var(--raised)' : 'transparent',
        border: `1px solid ${active ? 'var(--line)' : 'transparent'}`,
        color: active ? 'var(--text)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  );
}
