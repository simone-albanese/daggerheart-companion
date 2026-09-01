/**
 * Levelling up.
 *
 * Every constraint on this screen comes out of engine/levelUp.ts - the option
 * list, how many slots each has left in each tier, and validatePlan(). Nothing
 * here decides a rule; it only shows what the engine already knows and refuses
 * to apply a plan the engine calls invalid.
 *
 * With one exception, and it is the same exception character creation makes.
 * A handful of subclass features hand out an extra domain card, and which ones
 * is a fact about the dataset rather than about arithmetic - the engine has no
 * dataset to read. So `cardAllowance.ts` owns that table for both screens, and
 * this one asks it what an advancement just earned. See `levelUpCardGrants`.
 *
 * The one piece of pure typography that matters: Proficiency and Multiclass are
 * printed inside a black box in the book, because each eats both of the level's
 * advancements. That box is reproduced, not paraphrased - a player who has seen
 * the page recognises it instantly, and one who hasn't learns the rule from the
 * shape.
 *
 * ## What this screen is drawn inside
 *
 * One scrolling column and one pinned nav, and the budget the two of them come
 * out of is in `Build.tsx`'s docblock, because Build owns the bands above.
 * The two numbers this file is answerable for: the nav is 69px on a phone and
 * 73 above 720px - 10 or 12 of padding, a 48px Cancel beside a 48px Apply, 10
 * or 12 more and a 1px rule - and the column is everything left over, which on
 * a landscape phone is 192px of a flow 1938px long. Anything added to that nav
 * comes straight off the column, and the column is where two irreversible
 * choices are made.
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
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import {
  grantFeature,
  levelUpCardGrants,
  type CardGrant,
  type SubclassCardTaken,
} from './cardAllowance.ts';
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
  /*
   * The exchange, held as two nullable refs rather than as one nullable pair.
   *
   * A pair cannot express the state a player is actually in halfway through -
   * "I have chosen what to give up and not yet what to take" - and that state
   * has to be visible, because it is the one where a tap on Apply would
   * silently do nothing with a card the screen is showing as chosen.
   */
  const [exchangeFrom, setExchangeFrom] = useState<Ref | null>(null);
  const [exchangeTo, setExchangeTo] = useState<Ref | null>(null);
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

  const options = availableOptions(tier);

  /**
   * What each pick just handed the character, as the grant table keys it.
   *
   * The upgraded-subclass advancement hands over a specialization or a mastery
   * card - the detail records which - and multiclassing hands over a foundation
   * card from the new class's subclass. Everything else hands over nothing.
   */
  const subclassCardTaken = (pick: Pick): SubclassCardTaken | null => {
    const option = options.find((o) => o.id === pick.optionId && o.tier === pick.optionTier);
    const ref = pick.detail['subclassRef'];
    if (option === undefined || typeof ref !== 'string') return null;
    if (option.kind === 'multiclass') return { subclass: ref, tier: 'foundation' };
    if (option.kind !== 'subclass') return null;
    const card = pick.detail['card'];
    return card === 'specialization' || card === 'mastery' ? { subclass: ref, tier: card } : null;
  };

  // Index for index with `picks`, so each picker appears under the advancement
  // that earned it rather than in one anonymous pile at the bottom.
  const grants = levelUpCardGrants(picks.map(subclassCardTaken), dataset);
  const grantFor = (pick: Pick): CardGrant | null => grants[picks.indexOf(pick)] ?? null;

  /**
   * The plan as the engine will read it. Two things are rewritten on the way.
   *
   * The engine reads the tier achievement's Experience off the first pick.
   *
   * And a `grantCardRef` whose grant is no longer live is dropped. The picker
   * is unmounted the moment the choice behind it changes, but the ref it wrote
   * stays in the pick's detail, and `applyLevelUp` banks any it is handed. A
   * player who takes Accomplished's card and then moves the same advancement to
   * their other subclass would have walked away holding a card no feature on
   * the sheet pays for - a plain instance of the app doing something its screen
   * had stopped saying.
   */
  const plan: LevelUpPlan = {
    fromLevel: character.level,
    toLevel,
    tier,
    achievement,
    // Only a whole exchange reaches the engine. Half of one is a warning below,
    // not a plan the validator has to have an opinion about.
    exchange:
      exchangeFrom !== null && exchangeTo !== null
        ? { fromRef: exchangeFrom, toRef: exchangeTo }
        : null,
    picks: picks.map((p, i) => {
      const detail = { ...p.detail };
      if (!grants[i]) delete detail['grantCardRef'];
      if (i === 0 && achievement !== null) detail['achievementExperience'] = experienceName.trim();
      return { ...p, detail };
    }),
    newCardRef,
  };

  // Every "after" number on this screen is the engine's answer for the sheet
  // this plan produces, never a delta worked out here. Two of them are not the
  // +1 they look like: an unarmored character's Severe threshold is twice their
  // level, so it climbs by 2, and a Proficiency advancement taken at level 5
  // stacks with the tier achievement that also lands there.
  const after = deriveStats(applyLevelUp(character, plan), dataset, index);

  /*
   * The two dataset facts the exchange rule needs go in, because a card's LEVEL
   * and the domains a character can reach are facts about a printing and a
   * sheet rather than numbers the rules state. `validatePlan` refuses an
   * exchange it is handed none for rather than waving it through, so passing
   * them here is what makes the rule enforced rather than merely stated.
   *
   * `after.domains` and not `stats.domains`: a multiclass taken in THIS plan
   * opens a domain, and the card taken for the exchange is taken at the new
   * level. It is the same "after" every other number on this screen reads.
   */
  const validation = validatePlan(character, plan, {
    cards: index.cards,
    domains: after.domains,
  });

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
   * Cards already spoken for elsewhere in this plan.
   *
   * Step four, the "additional domain card" advancement and a subclass
   * feature's granted card are separate pickers writing into one vault, and
   * without this each is happy to take the card another took - `applyLevelUp`
   * then pushes the same ref twice and the character owns two copies of it.
   *
   * A picker is passed everything claimed *except its own current value*, which
   * has to stay in its list or the row the player just chose would vanish out
   * from under the tick. Read off `plan`, not off `picks`, so a ref whose grant
   * has gone stops holding a card out of the other pickers as well.
   */
  const claimedRefs = (): string[] =>
    [
      newCardRef,
      // The exchange's right-hand side is a card this level takes, so it holds
      // it out of the other pickers exactly as step four's own card does.
      exchangeTo,
      ...plan.picks.flatMap((p) => [p.detail['cardRef'], p.detail['grantCardRef']]),
    ].filter((r): r is string => typeof r === 'string');
  const claimedApartFrom = (mine: unknown): string[] => claimedRefs().filter((r) => r !== mine);

  /*
   * A card the player is owed and has not taken.
   *
   * A warning rather than an error, and deliberately the same weight the engine
   * gives step four's untaken card: both are cards that come with the level
   * rather than choices the level is invalid without, and a player who wants to
   * pick one at the table later must still be able to apply.
   */
  /*
   * Half an exchange, said out loud.
   *
   * A warning and not an error, for the reason the grant warning above gives:
   * an exchange is an offer the level makes, not a thing the level is invalid
   * without, and a player who wants to decide at the table must still be able
   * to apply. What it must not do is nothing quietly - the screen is showing a
   * card as chosen, and without this sentence Apply would leave it where it
   * was and say so nowhere.
   */
  const exchangeWarnings =
    exchangeFrom !== null && exchangeTo === null
      ? ['You have chosen a card to trade away and nothing to take for it, so nothing will be exchanged.']
      : [];

  const grantWarnings = grants.flatMap((grant, i) =>
    grant === null || typeof picks[i]?.detail['grantCardRef'] === 'string'
      ? []
      : [
          `${grant.feature} gives you an additional domain card on top of the advancement. Take it before you apply, or it is gone.`,
        ],
  );

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
                              grant={grantFor(pick)}
                              claimed={claimedApartFrom}
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
                          grant={grantFor(pick)}
                          claimed={claimedApartFrom}
                          onChange={(d) => setDetail(pick, d)}
                        />
                      )}
                    </div>
                  );
                })}
              </BlackBox>
            )}
          </Section>

          {/* Step four, both of its sentences. */}
          <Section label="A new domain card" hint="NOT AN ADVANCEMENT — IT COMES WITH THE LEVEL">
            <CardPicker
              stats={after}
              value={newCardRef}
              onChange={setNewCardRef}
              exclude={claimedApartFrom(newCardRef)}
            />
            <CardExchangeRow
              stats={after}
              fromRef={exchangeFrom}
              toRef={exchangeTo}
              exclude={claimedApartFrom}
              onFrom={(ref) => {
                setExchangeFrom(ref);
                // The card taken is chosen against the level of the card given
                // up, so changing what is given up cannot leave the other half
                // standing: it would be a choice made under a rule that has
                // moved, and the list it was chosen from no longer exists.
                setExchangeTo(null);
              }}
              onTo={setExchangeTo}
            />
          </Section>

          <Callout tone="error" items={validation.errors} />
          <Callout tone="warn" items={[...exchangeWarnings, ...grantWarnings, ...validation.warnings]} />

          {/*
            The licence notice, last in this scroll like every other screen's.
            `pinnedBelow`, because the Cancel/Confirm row below is what is last
            in the window here and it is the thing that pays the inset.
          */}
          <LicenceFooter pinnedBelow />
        </div>
      </div>

      <nav
        className="row"
        style={{
          flex: 'none',
          gap: 10,
          // Longhands, and the bottom one carries the home-indicator inset
          // above 720px - see the same row in `Wizard.tsx`. It had never paid
          // it because the shell's licence strip used to sit underneath.
          paddingTop: phone ? 10 : 12,
          paddingInline: phone ? 12 : 20,
          paddingBottom: phone ? 10 : 'calc(12px + env(safe-area-inset-bottom))',
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
            {/*
              Clamped for the reader, not for the record. A sheet levelled by a
              build that let a black-boxed option be taken twice in one tier
              carries two of them, so `used` is 4 where the tier prints 2 - and
              a screen reader was told "4 of 2 marked". `slotUsage` keeps the
              true count, because that is what the history says; only the
              sentence about the boxes on screen is bounded by how many there
              are.
            */}
            <span
              className="row"
              style={{ gap: 4 }}
              aria-label={`${Math.min(used, option.slots)} of ${option.slots} marked`}
            >
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
  grant,
  claimed,
  onChange,
}: {
  option: AdvancementOption & { tier: Tier };
  pick: Pick;
  /** Stats for the sheet this plan produces, so caps read at the new level. */
  stats: DerivedStats;
  toLevel: number;
  /** The subclass feature this pick just triggered, if it hands out a card. */
  grant: CardGrant | null;
  /** Cards this plan has claimed, minus whichever ref is passed in. */
  claimed: (mine: unknown) => string[];
  onChange: (detail: Record<string, unknown>) => void;
}): React.JSX.Element | null {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  if (!character) return null;

  const granted = grant === null ? null : (
    <GrantedCard
      grant={grant}
      stats={stats}
      value={(pick.detail['grantCardRef'] as string | undefined) ?? null}
      exclude={claimed(pick.detail['grantCardRef'])}
      onChange={(ref) => onChange({ grantCardRef: ref })}
    />
  );

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
          exclude={claimed(pick.detail['cardRef'])}
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
        {granted}
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

          {/* Multiclassing takes a *foundation* card, so a multiclass into the
              School of Knowledge triggers Prepared here exactly as creation
              does - the same grant, arriving down a road creation never sees. */}
          {granted}
        </div>
      </DetailShell>
    );
  }

  return null;
}

/**
 * The domain card a subclass feature hands over on top of the advancement.
 *
 * It is rendered inside the advancement's own detail block rather than beside
 * step four, and that is the whole ergonomic decision. Step four is one
 * question - "which card comes with the level" - and a second identical list
 * next to it reads as a duplicate of that question, not as a consequence of a
 * choice made two hundred pixels higher up. Here the cause is directly above
 * the effect: pick School of Knowledge's mastery card, and Brilliant's picker
 * unfolds under it, behind the same 12px indent and 2px hope rail every other
 * "this advancement still wants something from you" prompt uses.
 *
 * The feature's own sentence is printed verbatim above the list, because it is
 * the sentence that says the card must be at or below your level - the picker
 * already enforces that, and a rule the app enforces silently is a rule the
 * player cannot check.
 *
 * Sizes are the picker's, unchanged: every row is `--tap` (44px) tall with a
 * 44px TEXT button beside it, and the list drops its own scroll container on a
 * phone so the level-up panel keeps the only scroll and the thumb is not
 * trapped in a 420px window inside a page that also scrolls. Nothing here lands
 * in the bottom thumb arc - that band belongs to the 48px Cancel/Apply bar,
 * which is pinned outside the scrolling region.
 */
function GrantedCard({
  grant,
  stats,
  value,
  exclude,
  onChange,
}: {
  grant: CardGrant;
  stats: DerivedStats;
  value: Ref | null;
  exclude: string[];
  onChange: (ref: Ref | null) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const feature = grantFeature(grant, dataset);
  return (
    <div
      className="stack"
      style={{ gap: 9, marginTop: 2, paddingTop: 11, borderTop: '1px solid var(--line-soft)' }}
    >
      <div className="row" style={{ gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="t-label" style={{ color: 'var(--hope)' }}>
          {grant.feature}
        </span>
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          ONE MORE DOMAIN CARD, NOT AN ADVANCEMENT
        </span>
      </div>
      {feature !== null && (
        <span className="t-dense" style={{ color: 'var(--text-2)' }}>
          {feature.text}
        </span>
      )}
      <CardPicker stats={stats} value={value} onChange={onChange} exclude={exclude} />
    </div>
  );
}

/**
 * Step four's SECOND sentence: one card given up for one card taken.
 *
 * *"You can also exchange one domain card you've previously acquired for a
 * different domain card of the same level or lower."* Folio 53.
 *
 * ## Why it is inside step four's own Section and not beside it
 *
 * Because it is the same step. A `Section` of its own would read as a fifth
 * step of a level-up that has four, and the hint on this one -
 * "NOT AN ADVANCEMENT - IT COMES WITH THE LEVEL" - is as true of the exchange
 * as of the card above it. `GrantedCard` makes the same call one screen region
 * over, for the same reason: the second list belongs under the thing that
 * caused it, not in a pile of identical lists at the bottom.
 *
 * ## Why the second list unfolds rather than sitting there
 *
 * The card taken is bounded by the level of the card given up, so until one is
 * chosen there is no list to draw - only a list drawn against the wrong rule.
 * Unfolding it puts the cause directly above the effect, behind the same 12px
 * indent and 2px hope rail every "this choice still wants something from you"
 * prompt on this screen uses.
 *
 * Choosing a different card to give up clears the other half, because the list
 * it was chosen from no longer exists.
 *
 * ## The measurements
 *
 * Both lists are `CardPicker`, so every row is `--tap` (44px) tall with a 44px
 * TEXT button beside it and a 6px gutter between them - the two touch targets a
 * thumb has to tell apart are the ones this screen already ships, unchanged.
 * The lists drop their own scroll container on a phone so the level-up panel
 * keeps the only scroll and the thumb is not trapped in a 420px window inside a
 * page that also scrolls.
 *
 * Nothing here lands in the bottom thumb arc: that band belongs to the 48px
 * Cancel/Apply bar, which is pinned outside the scrolling region, and this
 * block is the last thing IN that region before the callouts - so it is read
 * material reached by scrolling, not a target competing with the two buttons
 * that end the screen.
 *
 * ## The sentence is printed, not paraphrased
 *
 * `CardPicker`'s `ceiling` already refuses to show a card above the level of
 * the one being traded, and `validatePlan` refuses one anyway. A rule the app
 * enforces silently is a rule the player cannot check - the same argument
 * `GrantedCard` prints its feature text for.
 */
function CardExchangeRow({
  stats,
  fromRef,
  toRef,
  exclude,
  onFrom,
  onTo,
}: {
  /** Stats for the sheet this plan produces, so the lists read at the new level. */
  stats: DerivedStats;
  fromRef: Ref | null;
  toRef: Ref | null;
  exclude: (mine: unknown) => string[];
  onFrom: (ref: Ref | null) => void;
  onTo: (ref: Ref | null) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const given = dataset.domainCards.find((c) => c.id === fromRef) ?? null;

  return (
    <div
      className="stack"
      style={{ gap: 9, marginTop: 2, paddingTop: 11, borderTop: '1px solid var(--line-soft)' }}
    >
      <div className="row" style={{ gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="t-label" style={{ color: 'var(--hope)' }}>
          Trade one in
        </span>
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          OPTIONAL — AND IT IS NOT THE CARD ABOVE
        </span>
      </div>
      <span className="t-dense" style={{ color: 'var(--text-2)' }}>
        You can also exchange one domain card you&rsquo;ve previously acquired for a different
        domain card of the same level or lower.
      </span>
      <CardPicker
        stats={stats}
        mode="owned"
        value={fromRef}
        onChange={onFrom}
        exclude={exclude(fromRef)}
      />
      {given !== null && (
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
          <span className="t-label">
            Take instead of {given.name} — level {given.level} or lower
          </span>
          <CardPicker
            stats={stats}
            ceiling={given.level}
            value={toRef}
            onChange={onTo}
            exclude={exclude(toRef)}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Picking a card
// ---------------------------------------------------------------------------

function CardPicker({
  stats,
  value,
  onChange,
  exclude,
  mode = 'available',
  ceiling,
}: {
  /** Stats for the sheet the plan produces: its domains and its level caps. */
  stats: DerivedStats;
  value: Ref | null;
  onChange: (ref: Ref | null) => void;
  exclude: string[];
  /**
   * Which side of an offer this list is.
   *
   * `available` is step four's question - a card you do not have, in a domain
   * you do, at or under your cap. `owned` is the exchange's left-hand side, and
   * it deliberately does NOT filter by domain or by cap: a card in the vault
   * from a domain the character no longer reaches is still a card they
   * previously acquired, and refusing to let them trade it away would be this
   * screen inventing a rule out of a filter written for the other question.
   */
  mode?: 'available' | 'owned';
  /**
   * A cap on top of the domain caps, for the exchange's right-hand side.
   *
   * Enforced here as well as in `validatePlan`, and that is not a duplicate
   * check doing the same job: the validator is what refuses a bad plan, and
   * this is what stops the screen offering one. A player who can see a level 4
   * card in a list headed "of the same level or lower" than their level 2 card
   * has been told the rule is optional.
   */
  ceiling?: number;
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
        .filter((c) =>
          mode === 'owned'
            ? owned.has(c.id) && !exclude.includes(c.id) && (domain === 'all' || c.domain === domain)
            : stats.domains.includes(c.domain) &&
              c.level <= stats.cardLevelCap(c.domain) &&
              (ceiling === undefined || c.level <= ceiling) &&
              !owned.has(c.id) &&
              !exclude.includes(c.id) &&
              (domain === 'all' || c.domain === domain),
        )
        .sort(
          (a, b) =>
            b.level - a.level || a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name),
        ),
    [ceiling, dataset.domainCards, domain, exclude, mode, owned, stats],
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
            {mode === 'owned'
              ? 'You have no domain cards in that domain to trade away.'
              : ceiling === undefined
                ? 'Every card you can reach in that domain is already yours.'
                : `No card in that domain is level ${ceiling} or lower and still unowned.`}
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
