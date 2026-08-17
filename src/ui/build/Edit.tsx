/**
 * Editing a character that already exists.
 *
 * Creation is a wizard because its steps depend on each other. Editing is not:
 * you came here to change one thing, so everything is on one scrolling sheet
 * with no order imposed and no step to advance through.
 *
 * The identity block is deliberately read-only. Swapping class or heritage
 * after play has started is not an edit, it is a new character, and quietly
 * rewriting the domains under someone's loadout would be the app applying a
 * rule it has no business applying.
 */
import { useState } from 'react';
import { TRAITS, TRAIT_LABELS, type Character, type Trait } from '../../../shared/types.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { normalizeActive, useActive, useApp } from '../../store/state.ts';
import { RenameField } from '../shared/RenameField.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
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
  Columns,
  ExperienceEditor,
  GoldEditor,
  InventoryEditor,
  LabelledInput,
  Section,
  Stepper,
} from './parts.tsx';

export function Edit({
  stats,
  onLevelUp,
}: {
  stats: DerivedStats;
  onLevelUp: () => void;
}): React.JSX.Element | null {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const update = useApp((s) => s.update);
  const phone = useIsPhone();
  const [picking, setPicking] = useState<'primary' | 'secondary' | 'armor' | null>(null);

  if (!character) return null;

  const klass = index.classes.get(character.classRef);
  const primary =
    character.activePrimaryWeapon === null
      ? undefined
      : index.weapons.get(character.activePrimaryWeapon);
  const secondary =
    character.activeSecondaryWeapon === null
      ? undefined
      : index.weapons.get(character.activeSecondaryWeapon);
  const armor = character.activeArmor === null ? undefined : index.armors.get(character.activeArmor);
  const lineage = [
    ...character.ancestryRefs.map((r) => (index.byRef.get(r) as { name?: string } | undefined)?.name),
    (index.byRef.get(character.communityRef ?? '') as { name?: string } | undefined)?.name,
  ]
    .filter(Boolean)
    .join(' · ');
  const subclasses = character.subclassRefs
    .map((r) => index.subclasses.get(r)?.name)
    .filter(Boolean)
    .join(' · ');

  const patch = (p: Partial<Character>): void => update((c) => ({ ...c, ...p }));

  return (
    <div
      className="scroll"
      style={{ flex: 1, minHeight: 0, padding: phone ? '14px 12px 24px' : '18px 20px 28px' }}
    >
      <div className="stack" style={{ gap: 22, maxWidth: 980, margin: '0 auto' }}>
        <header className="spread" style={{ alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="t-label">Editing</span>
            <span style={{ font: '800 24px/1 var(--sans)', letterSpacing: '-0.02em' }}>
              {character.name || 'Unnamed'}
            </span>
            <span className="t-meta">
              {(klass?.name ?? 'NO CLASS').toUpperCase()}
              {subclasses !== '' && ` · ${subclasses.toUpperCase()}`} · LEVEL {character.level}
              {lineage !== '' && ` · ${lineage.toUpperCase()}`}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onLevelUp} style={{ minHeight: 46 }}>
            Level up to {character.level + 1}
          </button>
        </header>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Derived label="EVASION" value={stats.evasion} />
          <Derived label="THRESHOLDS" value={`${stats.thresholds[0]}/${stats.thresholds[1]}`} />
          <Derived label="PROFICIENCY" value={stats.proficiency} />
          <Derived label="ARMOR SCORE" value={stats.armorScore} />
          <Derived label="HP" value={`${character.hp.marked}/${stats.maxHp}`} />
          <Derived label="STRESS" value={`${character.stress.marked}/${stats.maxStress}`} />
        </div>

        <Columns min={320} gap={22}>
          <div className="stack" style={{ gap: 22 }}>
            <Section label="Identity">
              <Columns min={200}>
                {/*
                 * Two doors to one capability, not two implementations.
                 *
                 * The rename that matters is on the Play sheet now, where the
                 * name is. This one stays because a form that lists everything
                 * about a character and omits its name is a worse form - but
                 * it is the same control, so there is no guard restated here
                 * and nothing here to keep in step with the other one.
                 *
                 * `commitOnBlur` because this door has no cancel target and no
                 * other way to not lose the typing: every neighbouring field
                 * on this screen writes on the keystroke, so a Name that
                 * needed SAVE and nothing else would lose a half-typed name to
                 * a tab tap without saying so. `key` because the header's
                 * character picker is on this screen too, and a field seeded
                 * from a character that is no longer active is one SAVE away
                 * from renaming the wrong sheet.
                 */}
                <RenameField key={character.id} label="Name" commitOnBlur />
                <LabelledInput
                  label="Pronouns"
                  value={character.pronouns}
                  onChange={(pronouns) => patch({ pronouns })}
                  placeholder="they/them"
                />
              </Columns>
              <p className="t-meta" style={{ margin: 0, color: 'var(--dim)' }}>
                CLASS, SUBCLASS AND HERITAGE ARE FIXED AT CREATION
              </p>
            </Section>

            <Section label="Traits" hint="A DOT MEANS MARKED THIS TIER">
              <div className="stack" style={{ gap: 7 }}>
                {TRAITS.map((t: Trait) => (
                  <div key={t} className="spread" style={{ alignItems: 'center', maxWidth: 330 }}>
                    <span className="row" style={{ gap: 8 }}>
                      <span style={{ font: '600 14px/1 var(--sans)' }}>{TRAIT_LABELS[t]}</span>
                      {(character.traitMarks[t] ?? 0) > 0 && (
                        <span
                          aria-label="marked this tier"
                          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)' }}
                        />
                      )}
                    </span>
                    <Stepper
                      label={TRAIT_LABELS[t]}
                      value={character.traits[t]}
                      min={-3}
                      max={12}
                      width={34}
                      format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v)}`}
                      onChange={(v) => patch({ traits: { ...character.traits, [t]: v } })}
                    />
                  </div>
                ))}
              </div>
            </Section>

            <Section label="Experiences" hint="SPEND A HOPE TO ADD ONE TO A ROLL">
              <ExperienceEditor
                value={character.experiences}
                onChange={(experiences) => patch({ experiences })}
              />
            </Section>

            <Section label="Gold" hint="10 HANDFULS TO A BAG · 10 BAGS TO A CHEST">
              <GoldEditor gold={character.gold} onChange={(gold) => patch({ gold })} />
            </Section>
          </div>

          <div className="stack" style={{ gap: 22 }}>
            <Section label="Equipment" hint="EVERY TIER — WHAT YOU HAVE NOT REACHED IS MARKED">
              <div className="stack" style={{ gap: 16 }}>
                <GearSlot
                  label="Primary weapon"
                  title={primary?.name ?? null}
                  meta={primary && weaponSummary(primary, stats)}
                  note={primary && tierNote(primary.tier, character.level)}
                  empty={`Search ${dataset.weapons.length} weapons`}
                  onOpen={() => setPicking('primary')}
                  onClear={() => patch({ activePrimaryWeapon: null })}
                />
                <GearSlot
                  label="Secondary weapon"
                  title={secondary?.name ?? null}
                  meta={secondary && weaponSummary(secondary, stats)}
                  note={
                    // Said, not enforced. A sheet that quietly unequipped the
                    // off-hand when a greatsword arrived would be the app
                    // making a call the table gets to make.
                    secondary && primary?.burden === 2
                      ? `${primary.name} is two-handed — no hand left for this`
                      : secondary && tierNote(secondary.tier, character.level)
                  }
                  empty="Optional"
                  onOpen={() => setPicking('secondary')}
                  onClear={() => patch({ activeSecondaryWeapon: null })}
                />
                <GearSlot
                  label="Armor"
                  title={armor?.name ?? null}
                  meta={armor && armorSummary(armor, stats.thresholds, stats.armorScore)}
                  note={armor && tierNote(armor.tier, character.level)}
                  empty={`Search ${dataset.armors.length} sets of armor`}
                  onOpen={() => setPicking('armor')}
                  onClear={() => {
                    patch({ activeArmor: null });
                    normalizeActive();
                  }}
                />
              </div>
              {dataset.weapons.length === 0 && (
                <Callout
                  tone="warn"
                  items={['No weapon or armor tables in this dataset — run `npm run build:srd`.']}
                />
              )}
            </Section>

            <Section label="Inventory">
              <InventoryEditor
                value={character.inventory}
                onChange={(inventory) => patch({ inventory })}
              />
            </Section>

            <Section label="Connections" hint="ONE PER RELATIONSHIP">
              <TextRows
                value={character.connections}
                onChange={(connections) => patch({ connections })}
                placeholder="Why do you grab my hand at night?"
                addLabel="Add a connection"
              />
            </Section>

            <Section label="Notes" hint="BACKGROUND, SCARS, ANYTHING ELSE">
              <textarea
                value={character.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={8}
                aria-label="Character notes"
                placeholder="Background answers, table rulings, things you want to remember."
                style={{ minHeight: 160, width: '100%' }}
              />
            </Section>
          </div>
        </Columns>

        <DeleteCharacter character={character} klassName={klass?.name} />

        {/*
          The licence notice, last, inside the reading column rather than bled
          to the window edges - this sheet is capped at 980px and centred, and a
          342-character paragraph running the full width of a desktop monitor
          under a column that does not is the one place a footer looks like a
          mistake. It used to be a fixed strip above the tab bar, costing this
          screen ~111px of a 393px phone whether anybody read it or not.
        */}
        <LicenceFooter />
      </div>

      {picking === 'armor' ? (
        <ArmorPicker
          value={character.activeArmor}
          sheet={character}
          onPick={(ref) => {
            patch({ activeArmor: ref });
            // The armor slot track has a new maximum.
            normalizeActive();
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : (
        picking !== null && (
          <WeaponPicker
            slot={picking}
            value={
              picking === 'primary' ? character.activePrimaryWeapon : character.activeSecondaryWeapon
            }
            sheet={character}
            stats={stats}
            onPick={(ref) => {
              patch(
                picking === 'primary'
                  ? { activePrimaryWeapon: ref }
                  : { activeSecondaryWeapon: ref },
              );
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        )
      )}
    </div>
  );
}

function Derived({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <span
      className="row"
      style={{
        gap: 8,
        minHeight: 'var(--control)',
        padding: '0 11px',
        borderRadius: 'var(--r2)',
        background: 'var(--panel)',
        border: '1px solid var(--line-soft)',
      }}
    >
      <span className="t-meta" style={{ color: 'var(--dim)' }}>
        {label}
      </span>
      <span className="t-num" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </span>
  );
}

function TextRows({
  value,
  onChange,
  placeholder,
  addLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.map((row, i) => (
        <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
          <textarea
            value={row}
            onChange={(e) => onChange(value.map((r, j) => (i === j ? e.target.value : r)))}
            rows={2}
            placeholder={placeholder}
            aria-label={`Connection ${i + 1}`}
            style={{ flex: 1, minWidth: 0, minHeight: 64 }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label={`Remove connection ${i + 1}`}
            style={{ flex: 'none', minWidth: 44, padding: 0 }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange([...value, ''])}
      >
        {addLabel}
      </button>
    </div>
  );
}

/**
 * Deleting is local and permanent - there is no server holding a copy, so the
 * confirmation states exactly what disappears rather than asking "are you
 * sure" about an unnamed thing.
 */
function DeleteCharacter({
  character,
  klassName,
}: {
  character: Character;
  klassName: string | undefined;
}): React.JSX.Element {
  const remove = useApp((s) => s.remove);
  const setScreen = useApp((s) => s.setScreen);
  const characters = useApp((s) => s.characters);
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const cards = character.loadout.length + character.vault.length;
  const created = new Date(character.createdAt).toLocaleDateString();

  return (
    <section
      className="stack"
      style={{
        gap: 12,
        padding: 16,
        borderRadius: 'var(--r4)',
        background: 'var(--panel)',
        border: '1px solid var(--line-soft)',
        borderLeft: '3px solid var(--damage)',
      }}
    >
      <h3 className="t-label" style={{ margin: 0, color: 'var(--damage)' }}>
        Delete this character
      </h3>
      {!armed ? (
        <div className="spread" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p className="t-dense" style={{ margin: 0 }}>
            Characters live only on this device. Nothing is synced, so a deletion cannot be undone
            from anywhere else.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => setArmed(true)}
            style={{ flex: 'none' }}
          >
            Delete…
          </button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 5 }}>
            <span style={{ font: '700 15px/1.2 var(--sans)' }}>
              Delete {character.name || 'this unnamed character'}?
            </span>
            <span className="t-dense">
              Level {character.level} {klassName ?? 'character'} · {cards} domain card
              {cards === 1 ? '' : 's'} · {character.experiences.length} Experience
              {character.experiences.length === 1 ? '' : 's'} · created {created}. This is permanent.
            </span>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setArmed(false)} style={{ minWidth: 120 }}>
              Keep it
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                // A rejected delete means the character is still on the device.
                // Saying nothing would leave the sheet on screen looking like a
                // stale render rather than a failure.
                void remove(character.id).then(
                  () => {
                    setArmed(false);
                    if (characters.length <= 1) setScreen('build');
                  },
                  (error: unknown) => {
                    setFailed(error instanceof Error ? error.message : String(error));
                  },
                );
              }}
              style={{
                minWidth: 170,
                background: 'var(--damage)',
                borderColor: 'transparent',
                // Ink on the red, not white: white on this hue is unreadable.
                color: 'var(--app)',
                fontWeight: 800,
              }}
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}
      {failed !== null && (
        <Callout
          tone="error"
          word="STILL HERE"
          items={[`The device refused to delete this character: ${failed}`]}
        />
      )}
    </section>
  );
}
