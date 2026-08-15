/**
 * Play: the screen that is open ninety percent of the time.
 *
 * No scrolling on this screen. The content is bounded and known - six traits,
 * four tracks, five cards - so it is laid out to fit rather than to flow. On a
 * phone the order inverts what you would expect from a document: cards on top
 * because they are *read*, vitals and the roll bar at the bottom because they
 * are *touched*, inside the one-handed thumb arc.
 */
import { useMemo, useState } from 'react';
import { TRAITS, TRAIT_LABELS, type DomainCard, type Trait } from '../../../shared/types.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { canAddToLoadout, recallCard, resolveCards, vaultCard } from '../../engine/loadout.ts';
import { useActive, useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { useLayout } from '../shared/useLayout.ts';
import { Beastform } from './Beastform.tsx';
import { DualityRoll, type RollTrait } from './DualityRoll.tsx';
import { Vitals } from './Vitals.tsx';

export function Play({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const layout = useLayout();
  const [trait, setTrait] = useState<RollTrait>('agility');

  if (!character) return null;
  if (layout === 'phone') return <PlayPhone stats={stats} trait={trait} setTrait={setTrait} />;
  return (
    <PlayDesktop
      stats={stats}
      trait={trait}
      setTrait={setTrait}
      columns={layout === 'tablet' ? 2 : 3}
    />
  );
}

interface ViewProps {
  stats: DerivedStats;
  trait: RollTrait;
  setTrait: (t: RollTrait) => void;
}

function useLoadout(): { loadout: DomainCard[]; vault: DomainCard[] } {
  const character = useActive();
  const index = useApp((s) => s.index);
  return useMemo(
    () => ({
      loadout: character ? resolveCards(character.loadout, index) : [],
      vault: character ? resolveCards(character.vault, index) : [],
    }),
    [character, index],
  );
}

function Identity({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  if (!character) return null;
  // A multiclassed character is two classes and two subclasses, and both belong
  // on the line that says who they are.
  const klass = [character.classRef, character.multiclassRef]
    .map((r) => (r === null ? undefined : index.classes.get(r)?.name))
    .filter(Boolean)
    .join(' / ');
  const subclass = character.subclassRefs
    .map((r) => index.subclasses.get(r)?.name)
    .filter(Boolean)
    .join(' · ');
  const lineage = [
    ...character.ancestryRefs.map((r) => (index.byRef.get(r) as { name?: string } | undefined)?.name),
    (index.byRef.get(character.communityRef ?? '') as { name?: string } | undefined)?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <div className="t-vital">{character.name || 'Unnamed'}</div>
      <div className="row" style={{ marginTop: 7, gap: 8 }}>
        {character.pronouns !== '' && <span className="t-meta">{character.pronouns.toUpperCase()}</span>}
        {character.pronouns !== '' && <span style={{ color: 'var(--line)' }}>·</span>}
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          LEVEL {character.level}
        </span>
      </div>
      <div style={{ marginTop: 9, font: '600 14px/1.35 var(--sans)', color: 'var(--text-2)' }}>
        {klass === '' ? 'No class' : klass}
        {subclass !== '' && ` — ${subclass}`}
      </div>
      {lineage !== '' && (
        <div style={{ font: '400 13px/1.35 var(--sans)', color: 'var(--muted)' }}>{lineage}</div>
      )}
    </div>
  );
}

function TraitGrid({
  stats,
  trait,
  setTrait,
}: {
  stats: DerivedStats;
  trait: RollTrait;
  setTrait: (t: RollTrait) => void;
}): React.JSX.Element | null {
  const character = useActive();
  if (!character) return null;
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 8 }}>
        Traits
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {TRAITS.map((t: Trait) => {
          // stats.traits, not the character's own: a Beastform raises one of
          // these, and a tile that disagreed with the roll would be a lie.
          const value = stats.traits[t];
          const active = trait === t;
          const marked = (character.traitMarks[t] ?? 0) > 0;
          const raised = stats.beastform?.raised.find((r) => r.trait === t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTrait(t)}
              aria-pressed={active}
              style={{
                position: 'relative',
                background: 'var(--panel)',
                border: '1px solid var(--line-soft)',
                borderRadius: 'var(--r3)',
                padding: '10px 10px 9px',
                overflow: 'hidden',
                minHeight: 64,
                textAlign: 'left',
              }}
            >
              <span className="t-meta" style={{ letterSpacing: '0.1em', color: 'var(--muted)' }}>
                {TRAIT_LABELS[t].toUpperCase()}
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: 7,
                  font: '800 26px/1 var(--sans)',
                  letterSpacing: '-0.02em',
                  color: active ? 'var(--text)' : 'var(--text-2)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value >= 0 ? '+' : '−'}
                {Math.abs(value)}
                {raised && (
                  <s className="t-meta" style={{ marginLeft: 6, color: 'var(--dim)' }}>
                    {raised.from >= 0 ? '+' : '−'}
                    {Math.abs(raised.from)}
                  </s>
                )}
              </span>
              {marked && (
                <span
                  aria-label="marked this tier"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--muted)',
                  }}
                />
              )}
              <span
                style={{
                  position: 'absolute',
                  inset: 'auto 0 0 0',
                  height: 3,
                  background: active
                    ? 'var(--hope)'
                    : raised
                      ? 'var(--sage)'
                      : stats.spellcastTrait === t
                        ? 'color-mix(in srgb, var(--hope) 30%, transparent)'
                        : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="t-meta" style={{ marginTop: 7, color: 'var(--muted)', letterSpacing: '0.04em' }}>
        TAP A TRAIT TO ARM THE ROLL
        {stats.spellcastTrait !== null &&
          ` · ${TRAIT_LABELS[stats.spellcastTrait].toUpperCase()} IS SPELLCAST`}
      </div>
    </div>
  );
}

function Defenses({ stats }: { stats: DerivedStats }): React.JSX.Element {
  // A Beastform replaces Evasion, so the panel says so twice: sage, and the
  // number it replaced printed struck through underneath it.
  const worn = stats.beastform;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 8 }}>
      <div
        className="panel"
        style={{ padding: 10, borderColor: worn ? 'var(--sage)' : undefined }}
      >
        <div
          className="t-meta"
          style={{ letterSpacing: '0.1em', color: worn ? 'var(--sage)' : undefined }}
        >
          EVASION
        </div>
        <div style={{ marginTop: 6, font: '800 30px/1 var(--sans)', letterSpacing: '-0.02em' }}>
          {stats.evasion}
        </div>
        {worn && (
          <s className="t-meta" style={{ display: 'block', marginTop: 4, color: 'var(--dim)' }}>
            {worn.baseEvasion}
          </s>
        )}
      </div>
      <div
        className="panel stack"
        style={{
          padding: 10,
          justifyContent: 'space-between',
          borderColor: worn ? 'var(--sage)' : undefined,
        }}
      >
        <div>
          <div className="t-meta" style={{ letterSpacing: '0.1em' }}>
            DAMAGE THRESHOLDS
          </div>
          <div className="row" style={{ marginTop: 6, alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: '800 22px/1 var(--sans)' }}>{stats.thresholds[0]}</span>
            <span className="t-meta">MAJOR</span>
            <span style={{ width: 1, height: 14, background: 'var(--line)' }} />
            <span style={{ font: '800 22px/1 var(--sans)' }}>{stats.thresholds[1]}</span>
            <span className="t-meta">SEVERE</span>
          </div>
        </div>
        <div className="t-meta" style={{ marginTop: 8, letterSpacing: '0.06em' }}>
          PROFICIENCY{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{stats.proficiency}</span>
        </div>
      </div>
    </div>
  );
}

function Equipped({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  const pushLog = useApp((s) => s.pushLog);
  if (!character) return null;

  const primary = character.activePrimaryWeapon
    ? index.weapons.get(character.activePrimaryWeapon)
    : undefined;
  const secondary = character.activeSecondaryWeapon
    ? index.weapons.get(character.activeSecondaryWeapon)
    : undefined;
  const armor = character.activeArmor ? index.armors.get(character.activeArmor) : undefined;

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="t-label">Equipped</div>
      {primary === undefined && secondary === undefined && armor === undefined && (
        <div className="panel t-dense" style={{ padding: '12px 11px', color: 'var(--dim)' }}>
          Nothing equipped — choose gear in Build.
        </div>
      )}
      {[primary, secondary].filter(Boolean).map((w) => {
        if (!w) return null;
        const dice = w.damage.replace(/^(\d*)d/, (_m, n: string) =>
          `${(n === '' ? 1 : Number(n)) * stats.proficiency}d`,
        );
        return (
          <button
            key={w.id}
            type="button"
            onClick={() =>
              pushLog({ kind: 'note', label: w.name, detail: `${dice} ${w.damageType} · ${w.range}` })
            }
            className="panel"
            style={{ borderLeft: '3px solid var(--hope)', padding: '10px 11px', textAlign: 'left' }}
          >
            <span className="spread">
              <span style={{ font: '700 14px/1.15 var(--sans)' }}>{w.name}</span>
              <span className="t-num" style={{ color: 'var(--hope)' }}>
                {dice}
              </span>
            </span>
            <span
              className="t-meta"
              style={{ display: 'block', marginTop: 5, letterSpacing: '0.05em' }}
            >
              {(w.trait === 'spellcast' ? 'SPELLCAST' : TRAIT_LABELS[w.trait].toUpperCase())} ·{' '}
              {w.range.toUpperCase()} · {w.damageType === 'mag' ? 'MAGIC' : 'PHYSICAL'}
            </span>
          </button>
        );
      })}
      {armor && (
        <div
          className="panel"
          style={{ borderLeft: '3px solid var(--armor)', padding: '10px 11px' }}
        >
          <div className="spread">
            <span style={{ font: '700 14px/1.15 var(--sans)' }}>{armor.name}</span>
            <span className="t-num" style={{ color: 'var(--text-2)' }}>
              SCORE {armor.baseScore}
            </span>
          </div>
          <div className="t-meta" style={{ marginTop: 5, letterSpacing: '0.05em' }}>
            BASE THRESHOLDS {armor.baseThresholds[0]} / {armor.baseThresholds[1]}
          </div>
        </div>
      )}
    </div>
  );
}

function Vault(): React.JSX.Element | null {
  const character = useActive();
  const { vault } = useLoadout();
  const update = useApp((s) => s.update);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const pushLog = useApp((s) => s.pushLog);
  if (!character) return null;

  return (
    // A shelf, not a grid: the vault is something you reach along, and one
    // scrollable row leaves the loadout the vertical space its cards need.
    <div className="stack" style={{ flex: 'none', gap: 6 }}>
      <div className="spread" style={{ flex: 'none' }}>
        <span className="t-label">Vault</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {vault.length} INACTIVE · SWAP COSTS RECALL IN STRESS
        </span>
      </div>
      <div
        className="row"
        style={{ gap: 8, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2 }}
      >
        {vault.map((card) => {
          const check = canAddToLoadout(character, card);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (!check.allowed) {
                  setOpenCard(card);
                  return;
                }
                const out = recallCard(character, card);
                update(() => out.character);
                pushLog({
                  kind: 'note',
                  label: `Recalled ${card.name}`,
                  detail:
                    check.stressCost === 0
                      ? 'Free during downtime'
                      : `Marked ${out.stressMarked} Stress${out.hpMarked > 0 ? ` and ${out.hpMarked} HP` : ''}`,
                });
              }}
              className="row"
              title={check.reason ?? `Recall for ${check.stressCost} Stress`}
              style={{
                flex: 'none',
                minHeight: 44,
                maxWidth: 190,
                borderRadius: 'var(--r3)',
                background: 'var(--app)',
                border: '1px solid var(--line-soft)',
                gap: 8,
                padding: '0 10px',
                opacity: check.allowed ? 1 : 0.55,
              }}
            >
              <DomainMark domain={card.domain} size={12} shapes={shapes} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  font: '600 12px/1 var(--sans)',
                  color: 'var(--text-2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                }}
              >
                {card.name}
              </span>
              <span className="t-meta">LV{card.level}</span>
            </button>
          );
        })}
        {vault.length === 0 && (
          <span className="t-dense" style={{ color: 'var(--dim)' }}>
            The vault is empty.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The loadout as a list.
 *
 * Used on a phone, and on a tablet where the second column is too narrow for a
 * three-across gallery: at that width a "card" is a header, a title and a
 * footer with the rules text squeezed to nothing, which is a card that has
 * stopped doing a card's job. A row that says name, domain and Recall, with the
 * full text one tap away, is the honest shape for the space.
 */
function LoadoutRows({ minHeight = 46 }: { minHeight?: number }): React.JSX.Element {
  const { loadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);

  return (
    <>
      {loadout.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => setOpenCard(card)}
          className="row"
          style={{
            flex: '1 1 0',
            minHeight,
            overflow: 'hidden',
            borderRadius: 'var(--r3)',
            background: 'var(--panel)',
            border: '1px solid var(--line-soft)',
            borderLeft: `4px solid var(--${card.domain})`,
            gap: 11,
            padding: '0 12px',
            textAlign: 'left',
          }}
        >
          <DomainMark domain={card.domain} size={17} shapes={shapes} />
          <span className="stack" style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                font: '700 15px/1.1 var(--sans)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.name}
            </span>
            <span className="t-meta" style={{ marginTop: 3, letterSpacing: '0.09em' }}>
              {card.domain.toUpperCase()} · LV{card.level} · {card.type.toUpperCase()}
            </span>
          </span>
          <span style={{ flex: 'none', textAlign: 'right' }}>
            <span className="t-meta" style={{ display: 'block' }}>
              RECALL
            </span>
            <span style={{ font: '800 15px/1 var(--sans)', marginTop: 3, display: 'block' }}>
              {card.recallCost}
            </span>
          </span>
        </button>
      ))}
      {loadout.length === 0 && (
        <div className="panel t-dense" style={{ padding: 14, color: 'var(--dim)' }}>
          No cards in the loadout yet. Add some in Cards.
        </div>
      )}
    </>
  );
}

function PlayDesktop({
  stats,
  trait,
  setTrait,
  columns,
}: ViewProps & { columns: 2 | 3 }): React.JSX.Element {
  const character = useActive();
  const { loadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const update = useApp((s) => s.update);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns:
          columns === 3 ? 'minmax(300px, 336px) minmax(360px, 428px) 1fr' : 'minmax(340px, 5fr) 6fr',
        gap: 18,
        padding: '18px 20px 20px',
      }}
    >
      <div className="stack scroll" style={{ gap: 14, minHeight: 'var(--control)', minWidth: 0 }}>
        <Beastform stats={stats} layout="desktop" />
        <Identity stats={stats} />
        <TraitGrid stats={stats} trait={trait} setTrait={setTrait} />
        <Defenses stats={stats} />
        {columns === 2 && (
          <>
            <Vitals stats={stats} layout="desktop" />
            <DualityRoll stats={stats} trait={trait} onTraitChange={setTrait} layout="desktop" />
          </>
        )}
        <Equipped stats={stats} />
      </div>

      {columns === 3 && (
        <div className="stack" style={{ gap: 12, minHeight: 'var(--control)', minWidth: 0 }}>
          <Vitals stats={stats} layout="desktop" />
          <DualityRoll stats={stats} trait={trait} onTraitChange={setTrait} layout="desktop" />
        </div>
      )}

      <div className="stack" style={{ gap: 10, minHeight: 'var(--control)', minWidth: 0 }}>
        <div className="spread" style={{ flex: 'none' }}>
          <span className="t-label">Loadout</span>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {loadout.length} / 5 ACTIVE
          </span>
        </div>
        {/* The grid owns the height, and the cards fill their cell. Fixing a
            card height instead pushes the vault off the bottom of the screen
            on a 900px display, which is the one thing Play must never do. */}
        {columns === 2 ? (
          <div className="stack" style={{ flex: 1, minHeight: 0, gap: 6, overflow: 'hidden' }}>
            <LoadoutRows minHeight={52} />
          </div>
        ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridAutoRows: 'minmax(0, 1fr)',
            gap: 12,
          }}
        >
          {loadout.map((card) => (
            <DomainCardView
              key={card.id}
              card={card}
              shapes={shapes}
              onOpen={() => setOpenCard(card)}
              height="100%"
              headHeight={64}
              footer={
                <>
                  <button
                    type="button"
                    className="t-meta"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (character) update((c) => vaultCard(c, card.id));
                    }}
                    style={{ letterSpacing: '0.1em' }}
                  >
                    TO VAULT
                  </button>
                  <span className="row" style={{ gap: 5 }}>
                    <span className="t-meta">RECALL</span>
                    <span style={{ font: '800 13px/1 var(--sans)' }}>{card.recallCost}</span>
                  </span>
                </>
              }
            />
          ))}
          {loadout.length < 5 && (
            <div
              className="stack"
              style={{
                minHeight: 0,
                borderRadius: 'var(--r4)',
                border: '1px dashed var(--line)',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 12,
              }}
            >
              <span
                style={{ width: 26, height: 26, border: '1.5px solid var(--empty)', borderRadius: 4 }}
              />
              <span
                className="t-meta"
                style={{ color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}
              >
                {5 - loadout.length} SLOT{5 - loadout.length === 1 ? '' : 'S'} FREE
                <br />
                RECALL FROM THE VAULT
              </span>
            </div>
          )}
        </div>
        )}
        <Vault />
      </div>
    </div>
  );
}

function PlayPhone({ stats, trait, setTrait }: ViewProps): React.JSX.Element {
  const character = useActive();
  const { loadout } = useLoadout();
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const index = useApp((s) => s.index);
  if (!character) return <div />;

  const klass = [character.classRef, character.multiclassRef]
    .map((r) => (r === null ? undefined : index.classes.get(r)?.name))
    .filter(Boolean)
    .join(' / ');
  const modLabel =
    trait === 'spellcast' && stats.spellcastTrait !== null
      ? 'SPELLCAST'
      : TRAIT_LABELS[(trait === 'spellcast' ? 'knowledge' : trait) as Trait].toUpperCase();
  const modValue =
    trait === 'spellcast'
      ? stats.spellcastTrait
        ? stats.traits[stats.spellcastTrait]
        : 0
      : stats.traits[trait as Trait];

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, padding: '0 12px 8px', gap: 8 }}>
      <div className="spread" style={{ alignItems: 'flex-end', paddingTop: 4 }}>
        <div>
          <div style={{ font: '800 21px/1 var(--sans)', letterSpacing: '-0.02em' }}>
            {character.name || 'Unnamed'}
          </div>
          {/* Evasion and the thresholds used to sit here too. They are numbers
              the GM reads out when they attack you, not numbers you act on -
              and the damage control prints them again two rows down, where you
              do act on them. On a screen that was 78px short, a duplicate was
              the first thing to go. */}
          <div className="t-meta" style={{ marginTop: 5 }}>
            {(klass === '' ? '—' : klass).toUpperCase()} · LV{character.level}
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div className="t-meta" style={{ letterSpacing: '0.1em' }}>
            {modLabel}
          </div>
          <div style={{ font: '800 22px/1 var(--sans)', color: 'var(--hope)', marginTop: 4 }}>
            {modValue >= 0 ? '+' : '−'}
            {Math.abs(modValue)}
          </div>
        </div>
      </div>

      <Beastform stats={stats} layout="phone" />

      <div
        className="row"
        style={{ gap: 4, overflowX: 'auto', flex: 'none', scrollbarWidth: 'none' }}
      >
        {TRAITS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTrait(t)}
            className="chip"
            aria-pressed={trait === t}
            style={{
              minHeight: 'var(--control)',
              flex: 'none',
              background: trait === t ? 'var(--hope)' : 'var(--raised)',
              color: trait === t ? 'var(--app)' : 'var(--muted)',
              borderBottom:
                stats.beastform?.raised.some((r) => r.trait === t) === true
                  ? '2px solid var(--sage)'
                  : '2px solid transparent',
            }}
          >
            {TRAIT_LABELS[t].slice(0, 3).toUpperCase()} {stats.traits[t] >= 0 ? '+' : '−'}
            {Math.abs(stats.traits[t])}
          </button>
        ))}
      </div>

      {/* The safety valve. This region used to clip: at 852px the fourth row
          lost 28px and the fifth was invisible entirely, and a card you cannot
          see is a card you do not have. The page still never scrolls; a list
          that outgrows its box does. */}
      <div className="stack scroll scroll-fade" style={{ flex: 1, minHeight: 0, gap: 4, overflowX: 'hidden' }}>
        <div className="spread" style={{ flex: 'none' }}>
          <span className="t-label">Loadout</span>
          <span className="t-meta">{loadout.length} / 5</span>
        </div>
        <LoadoutRows />
      </div>

      <Vitals stats={stats} layout="phone" />
      <DualityRoll stats={stats} trait={trait} onTraitChange={setTrait} layout="phone" />
    </div>
  );
}
