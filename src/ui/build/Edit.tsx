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
import { TIER_LEVELS, tierOf } from '../../engine/character.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { cryptoRng } from '../../engine/dice.ts';
import { ignoresBurden } from '../../engine/burden.ts';
import { unresolvedWeapons } from '../../engine/holdings.ts';
import { normalizeActive, useActive, useApp } from '../../store/state.ts';
import { RenameField } from '../shared/RenameField.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import { slotTierNote, weaponNote } from './gear.ts';
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
  ExperienceEditor,
  FeatureBlock,
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
  /*
   * The refs on this sheet that this build cannot name, read as a pair so the
   * two weapon slots cannot be repaired one at a time - which is exactly how
   * they came to be silent. `unresolvedWeapons` is the same fact `Play` reads
   * to draw its `VanishedWeapon` row, asked once in the engine rather than
   * re-derived here: two routes to one answer is two answers eventually.
   *
   * The armor is worked out on the spot, because there is no shared helper for
   * it: `deriveStats` carries `unresolvedArmor` for its own arithmetic, and
   * `stats` is in hand here - so the third slot tells the truth for free rather
   * than being left as the one that still says «Search 85 sets of armor» over a
   * ref the sheet is still holding.
   */
  const missing = unresolvedWeapons(character, index);
  /*
   * Folio 28, Combat Training: *"You ignore burden when equipping weapons."*
   * The line under the off-hand read `${primary.name} is two-handed — no hand
   * left for this` for anybody at all, which is the general rule stated as if
   * the book had not written an exception to it - and stated hardest at the one
   * class the exception belongs to. Same predicate as the wizard, so the two
   * screens cannot end up saying different things about one character.
   */
  const ignoring = ignoresBurden(character, index);
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
                 * The only door to a rename, since the reflow took the chip off
                 * the Play sheet.
                 *
                 * It was two doors to one capability - this one and a 72x44
                 * RENAME chip on the sheet's class row - and it is one again.
                 * That is a real cost, and it is the paragraph `RenameField`
                 * opens with: this field is in the Identity section of the
                 * Build tab's edit screen, four gestures deep in the tab
                 * visited least, for the first field on the paper sheet. What
                 * it bought is 72px plus an 8px gutter of the sheet's class row
                 * and one fewer permanent target on the screen that is open
                 * ninety per cent of the time. Nothing here changed: it is the
                 * same control, so there is no guard restated here.
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

            <TransformationSection character={character} onPatch={patch} />

            <StancesSection character={character} onPatch={patch} />

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
                  note={weaponNote({
                    slot: 'primary',
                    weapon: primary,
                    primary,
                    level: character.level,
                    ignoresBurden: ignoring,
                  })}
                  empty={`Search ${dataset.weapons.length} weapons`}
                  unresolved={
                    missing.primary === null
                      ? null
                      : { banner: 'WEAPON NOT IN THIS BUILD', ref: missing.primary }
                  }
                  onOpen={() => setPicking('primary')}
                  onClear={() => patch({ activePrimaryWeapon: null })}
                />
                <GearSlot
                  label="Secondary weapon"
                  title={secondary?.name ?? null}
                  meta={secondary && weaponSummary(secondary, stats)}
                  /*
                   * Still said, not enforced - a sheet that quietly unequipped
                   * the off-hand when a greatsword arrived would be the app
                   * making a call the table gets to make. What changed is that
                   * the thing being said is now true: `no hand left for this`
                   * was the general rule with the book's own exception left
                   * out, and it was a refusal in the mouth of a screen that
                   * refuses nothing.
                   */
                  note={weaponNote({
                    slot: 'secondary',
                    weapon: secondary,
                    primary,
                    level: character.level,
                    ignoresBurden: ignoring,
                  })}
                  empty="Optional"
                  unresolved={
                    missing.secondary === null
                      ? null
                      : { banner: 'WEAPON NOT IN THIS BUILD', ref: missing.secondary }
                  }
                  onOpen={() => setPicking('secondary')}
                  onClear={() => patch({ activeSecondaryWeapon: null })}
                />
                <GearSlot
                  label="Armor"
                  title={armor?.name ?? null}
                  meta={armor && armorSummary(armor, stats.thresholds, stats.armorScore)}
                  note={armor && slotTierNote(armor.tier, character.level)}
                  empty={`Search ${dataset.armors.length} sets of armor`}
                  unresolved={
                    stats.unresolvedArmor === null
                      ? null
                      : { banner: 'ARMOR NOT IN THIS BUILD', ref: stats.unresolvedArmor }
                  }
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
          screen at least the 126.16px the notice measures on a 369px column at
          393x852 - a pinned one painted a panel and its own horizontal padding
          on top of that - whether anybody read it or not. ("~111px" stood here;
          it was the estimate, and it was short by the border it forgot to add.
          `LicenceFooter.tsx` carries the measurement and how it was taken.)
        */}
        <LicenceFooter />
      </div>

      {picking === 'armor' ? (
        <ArmorPicker
          rng={cryptoRng}
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
            rng={cryptoRng}
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

/**
 * The transformation a character holds: one card, added here and removed here.
 *
 * ## Why this screen, and why this position on it
 *
 * The owner settled two halves of the placement before it was built - not a
 * step in character creation, and not a fifth nav entry - and both of those are
 * refusals. What is left is where it goes, and the answer is the screen whose
 * mode is literally called `sheet` (`Build.tsx`), in the LEFT column
 * immediately under Identity.
 *
 * **Read-vs-touch.** These are two different lifetimes in one section. The
 * *touch* - choosing a card, or dropping it - happens once or twice in a
 * campaign, when the GM hands it over; folio 42 gives them away, so the player
 * never browses these. The *read* - two features, verbatim - happens whenever
 * someone asks what the card does. So the picker is folded away behind one row
 * and the features are not folded at all: the rare gesture pays a tap, the
 * frequent read pays nothing.
 *
 * **Thumb arc.** Nothing here is placed for the thumb, and that is the
 * decision rather than an oversight. On a 393x852 phone the comfortable arc is
 * roughly the lower half of the glass, and it is spent on this screen's two
 * permanent controls - the mode switch and, at the very bottom, Delete. A
 * once-a-campaign control competing for that band would be taking room from
 * gestures made every session. Under Identity it is reached by a short scroll,
 * which is the right price for a gesture made once.
 *
 * **Target size.** Every control here is `Choice` or a `btn` at `var(--tap)`,
 * which is the 44px floor; nothing is smaller, and the six picker rows are full
 * column width, so the smallest target in the section is 44 x the column.
 *
 * ## Shown, never applied
 *
 * Nothing in this component computes. It writes one `Ref` and it renders the
 * dataset's own strings through `FeatureBlock`, the same component the Wizard
 * draws an ancestry's features with. `deriveStats` does not read
 * `transformationRef`, and `normalizeActive()` is deliberately NOT called after
 * a pick - there is no maximum to re-clamp, because nothing about Evasion,
 * thresholds, Stress or the armor track moved.
 *
 * ## The section that draws itself when there is nothing to pick
 *
 * SRD 1.0 prints no transformations, so on the dataset the app ships today
 * `dataset.transformations` is empty and this whole section is absent - an
 * empty picker over a chapter the book does not have would be furniture.
 *
 * It is absent *unless the character holds one anyway*, which is a real state:
 * a sheet imported by QR or file from a build shipping SRD 2.0 arrives with a
 * `transformationRef` this build cannot name, parked as `?14005`. Hiding the
 * section then would be the exact defect already measured on a dropped weapon -
 * a reference on the sheet with no trace of it anywhere on the glass. So it
 * draws the same ghost the armor path draws, in the same words and the same
 * colour, naming the raw ref and offering the one thing this build can honestly
 * do with it: leave it, or drop it.
 */
function TransformationSection({
  character,
  onPatch,
}: {
  character: Character;
  onPatch: (p: Partial<Character>) => void;
}): React.JSX.Element | null {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reading, setReading] = useState(false);

  const ref = character.transformationRef;
  // `collections.transformations`, never `byRef`: SRD 2.0 prints an adversary
  // VAMPIRE (folio 142) beside the VAMPIRE card (folio 45) and both slugify to
  // `vampire`, so the bare-slug map answers with the stat block.
  const held = ref === null ? undefined : index.collections.transformations.get(ref);
  const cards = dataset.transformations;

  if (cards.length === 0 && ref === null) return null;

  return (
    <Section label="Transformation" hint="GRANTED BY THE GM · SHOWN, NEVER APPLIED">
      {ref !== null && held === undefined && (
        <div
          className="panel stack"
          style={{ gap: 5, padding: '10px 12px', borderLeft: '3px solid var(--damage)' }}
        >
          <span className="t-meta" style={{ letterSpacing: '0.08em', color: 'var(--damage)' }}>
            TRANSFORMATION NOT IN THIS BUILD
          </span>
          <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
            {ref}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', minHeight: 'var(--tap)' }}
            onClick={() => {
              onPatch({ transformationRef: null });
            }}
          >
            Drop it
          </button>
        </div>
      )}

      {held !== undefined && (
        <div className="panel stack" style={{ gap: 10, padding: '12px 13px' }}>
          <span className="spread" style={{ alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: '800 17px/1.15 var(--sans)', letterSpacing: '-0.01em' }}>
              {held.name}
            </span>
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              {held.features.length} FEATURE{held.features.length === 1 ? '' : 'S'}
            </span>
          </span>
          {/*
            The FEATURES first and the card's prose folded under them, which is
            the opposite of the order the book prints and is a decision taken by
            looking at the rendered card rather than at the page.
            
            Measured in Chrome on the real VAMPIRE card (folio 45, 1055
            characters of prose), one DOM node moved and nothing else - same
            CSS, same content, the offset of the `Fangs` heading from the top
            of the section:
            
              393x852    92.05 features first   371.79 the book's order   -279.74
              1280x800   77.05                  293.32                    -216.27
            
            The prose alone measures 269.74px on the phone. Prose is read once,
            when the GM hands the card over; `Fangs` and `Feed` are read every
            time somebody asks what the card does. So the frequent read pays
            nothing and the rare one pays a tap - read-vs-touch cutting the same
            way it does for the picker above. Folded, the whole held card is
            521.59px at 393x852 against 801.33 with the text open.
          */}
          {held.features.map((f) => (
            <FeatureBlock key={f.name} name={f.name} text={f.text} />
          ))}
          {held.description !== '' && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                aria-expanded={reading}
                style={{ alignSelf: 'flex-start', minHeight: 'var(--tap)' }}
                onClick={() => {
                  setReading(!reading);
                }}
              >
                {reading ? 'Hide the card’s text' : 'Read the card’s text'}
              </button>
              {reading && (
                <p className="t-dense" style={{ margin: 0, whiteSpace: 'pre-line' }}>
                  {held.description}
                </p>
              )}
            </>
          )}
          {held.questions.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                aria-expanded={asking}
                style={{ alignSelf: 'flex-start', minHeight: 'var(--tap)' }}
                onClick={() => {
                  setAsking(!asking);
                }}
              >
                {asking ? 'Hide' : 'Show'} {held.questions.length} questions
              </button>
              {asking && (
                <ul className="stack" style={{ gap: 6, margin: 0, paddingLeft: 18 }}>
                  {held.questions.map((q) => (
                    <li key={q} className="t-dense">
                      {q}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {picking ? (
        <div className="stack" style={{ gap: 8 }}>
          {cards.map((t) => (
            <Choice
              key={t.id}
              selected={t.id === ref}
              onClick={() => {
                /*
                 * A second tap on the card already held removes it, which is
                 * the same gesture `aria-pressed` already promises. No
                 * `normalizeActive()` on either branch: nothing derived moved.
                 */
                onPatch({ transformationRef: t.id === ref ? null : t.id });
                setPicking(false);
              }}
              title={t.name}
              meta={`${t.features.map((f) => f.name.toUpperCase()).join(' · ')}`}
              body={t.description}
              clamp={2}
            />
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', minHeight: 'var(--tap)' }}
            onClick={() => {
              setPicking(false);
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        cards.length > 0 && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ minHeight: 'var(--tap)' }}
              onClick={() => {
                setPicking(true);
              }}
            >
              {held === undefined ? `Add a transformation` : 'Change it'}
            </button>
            {held !== undefined && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ minHeight: 'var(--tap)' }}
                onClick={() => {
                  onPatch({ transformationRef: null });
                }}
              >
                Remove
              </button>
            )}
          </div>
        )
      )}
    </Section>
  );
}

/**
 * The martial stances a character knows, and the Focus they are holding.
 *
 * ## Where it is, and the two halves of that answer
 *
 * The screen is the one whose mode is literally called `sheet` (`Build.tsx`),
 * in the LEFT column immediately under `TransformationSection`, which is
 * immediately under Identity. No fifth nav entry: a fifth desktop nav entry
 * overpaints the header by 69px, measured, and this is a section for one
 * subclass out of twenty-six.
 *
 * Under the transformation and not above it because the two are ordered by how
 * many sheets they are on. A transformation is GM-granted and can land on any
 * character; stances belong to the Brawler's Martial Artist and to nobody else.
 * Measured in Chrome at 393x852 on a real sheet, this section is **83.5px** for
 * a character who knows no stance and holds no Focus - one button, and exactly
 * the height the Transformation section is - against **354.47px** for a Martial
 * Artist holding three. The thing that is 83.5px for almost everyone sorts
 * below the thing that is not.
 *
 * ## Read-vs-touch, which cuts three ways here rather than two
 *
 * Three gestures with three different frequencies live in this one section, and
 * they are drawn at three different depths. Measured at 393x852 on a level-5
 * Martial Artist knowing Favored, Reliable and Anchored:
 *
 *   - **Reading a known stance's rule.** Every combat, several times - a
 *     Martial Artist reads what they are shifting into. Not folded, no tap:
 *     three blocks of 58.37, 58.37 and 74.23px, all of them open.
 *   - **Moving Focus.** Once per shift, so several times per combat. One
 *     stepper, two 44x44 buttons, never folded.
 *   - **Choosing or dropping a stance.** Twice at level 1 and once per level
 *     after: eleven times in a whole campaign. Folded behind one 146.11x44
 *     button.
 *
 * What the fold buys, measured rather than assumed: the section is 354.47px
 * closed and **1750.75px** with the picker open, and the scroll area on that
 * phone is 603px. So the sixteen rows are 1396.28px - 2.32 screenfuls - that
 * the frequent reader never scrolls past, in exchange for one tap on the rare
 * gesture.
 *
 * The Focus row is the one that does not sit comfortably here, and the cost is
 * named rather than hidden: it is a per-combat control four gestures deep in
 * the tab visited least. The section it belongs beside is Play's own track
 * strip, and that is this lane's openQuestions entry with the exact edit; what
 * this screen owes it in the meantime is to be the only place it exists rather
 * than the second.
 *
 * ## Thumb arc
 *
 * Measured, and the answer is that this section does not have to choose. At
 * 393x852 the scroll area is 603px tall and starts at y=188, and the fixed
 * furniture is the nav bar at y=791..852 and the mode switch above the scroll;
 * the comfortable arc is the lower half, y>=426. Scrolled so the section sits
 * at the top of the scroll area, the Focus `+` centres at y=249.5 - above the
 * arc - and `Change stances` centres at y=520.47, inside it.
 *
 * That is backwards for the frequencies above, and it does not matter, because
 * the whole section is 354.47px against a 603px scroll area: it fits on the
 * glass entire, so which of its controls is under the thumb is one scroll
 * gesture, not a layout decision. What would have made it a layout decision is
 * a section taller than the scroll area, and the fold is what keeps it from
 * being one.
 *
 * ## Target size
 *
 * Measured on the rendered page rather than read off the CSS. `Stepper`'s two
 * Focus buttons are 44.00 x 44.00; the picker button is 146.11 x 44.00; the
 * sixteen picker rows are 369.00 wide with a minimum height of 62.87. The
 * smallest target in the section is therefore 44x44, which is the floor
 * `var(--tap)` names, and nothing is under it.
 *
 * ## The fourth gesture: putting one down
 *
 * Three of the gestures above are the ones this section was built around. The
 * fourth was missing, and the shape of the gap is the exact reverse of the
 * lesson `GearSlot` already learned: **the stance you could read was less
 * removable than the one you could not.**
 *
 * An unresolved ref got a `Drop it` button on its ghost row. A resolved one got
 * nothing of its own - the only way off the sheet was a second tap inside the
 * picker, and the picker is gated on the Martial Artist subclass. So for the
 * exact character the gate above exists to protect - somebody carrying stances
 * who did not take that subclass - a readable stance was undroppable, while it
 * went on being written to storage. `GearSlot`'s docblock says it in the words
 * this is repairing: *"gating the control on a name the build cannot read meant
 * the only way out of the state was to equip something over the top of it."*
 *
 * It is a ✕ on the row rather than the ghost row's `Drop it`, and that is a
 * decision about pixels. A `Drop it` under each block is a full 44px control
 * plus a gap for every stance known - about 150px on a three-stance sheet
 * against a 603px scroll area, which is a quarter of the screen spent on the
 * rarest gesture in the section. The ✕ takes 44px of WIDTH beside a block that
 * is already taller than 44px, so it adds no row of its own; it is also the
 * shape this app already uses for "empty this", on all three gear slots.
 *
 * WHAT THAT COSTS IS WIDTH, and the honest version is that it has not been
 * re-measured. The ✕ and its gap take 52px off the text column, which can wrap
 * a stance's rule onto one more line. Every figure above - 83.5px, 354.47px,
 * 1750.75px, 58.37/58.37/74.23 - was measured BEFORE this control existed and
 * is left standing as what it was rather than re-derived by guess. The one
 * claim that does not depend on them is the one that matters here: the smallest
 * target is still 44x44.
 *
 * ## Shown, never applied
 *
 * Nothing here computes. It writes a `Ref[]` and a `Counter` and renders the
 * dataset's own strings. `deriveStats` does not read `stanceRefs` and must not:
 * six of the sixteen name a number - Aggressive's `-1` to Evasion, Anchored's
 * `+2` to damage thresholds, Reliable's `+1` to attack rolls - and every one is
 * conditional on being IN the stance, which this app does not track and the
 * book ties to the scene, to Severe damage and to the last Hit Point.
 * `normalizeActive()` is deliberately not called after a pick: no derived
 * maximum moved, because none of them reads this.
 *
 * ## The section that draws itself when there is nothing to pick
 *
 * On the SRD 1.0 dataset `dataset.stances` is empty and this whole section is
 * absent - a picker over a chapter the book does not print is furniture. It is
 * absent *unless the character carries something anyway*, which is a real
 * state: a sheet arriving by QR or file from a build shipping SRD 2.0 brings
 * `?15008` for a stance this build cannot name, or a Focus track this build has
 * no chapter for. Hiding it then is the defect already measured on a dropped
 * weapon - a reference on the sheet with no trace of it on the glass - so it
 * draws the same ghost row the armor and transformation paths draw, naming the
 * raw ref and offering the one honest thing: drop it.
 */
/**
 * The subclass the book ties martial stances to, as an ADDRESS and not a
 * sentence.
 *
 * Folio 13: "When you choose the Martial Artist subclass, take the Martial
 * Stances sheet." So the sheet is that subclass's, and drawing it on a wizard
 * is the app promising something the book does not give them.
 *
 * A slug is written here rather than derived because the two ways of deriving
 * it are both worse. Matching the feature text for "martial stance" is the trap
 * this branch already fell into once - `stance` is a substring of
 * `circumstance` - and adding a flag to `Subclass` would put a fact about ONE
 * subclass into the shape of all twenty-six. `chapters.ts` writes addresses the
 * same way, under the same rule: an address may be written down WHEN IT IS
 * CHECKED AGAINST THE DATASET EVERY RUN, and `stances.test.tsx` does that - if
 * a printing renames the subclass, the test reddens instead of the section
 * quietly never drawing again.
 */
const STANCE_SUBCLASS = 'martial-artist';

function StancesSection({
  character,
  onPatch,
}: {
  character: Character;
  onPatch: (p: Partial<Character>) => void;
}): React.JSX.Element | null {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const [picking, setPicking] = useState(false);

  const all = dataset.stances;
  // `collections.stances`, never `byRef`: the stances are deliberately out of
  // the bare-slug map, so this is the only lookup that can answer.
  const known = character.stanceRefs.map((ref) => ({
    ref,
    record: index.collections.stances.get(ref),
  }));
  const unnamed = known.filter((k) => k.record === undefined);
  const holdsFocus = character.focus.marked > 0;
  const isMartialArtist = character.subclassRefs.includes(STANCE_SUBCLASS);

  /*
   * WHOSE SHEET THIS IS, and why the gate is not simply the subclass.
   *
   * Drawn for a Martial Artist, because it is theirs. Drawn ALSO for any
   * character already carrying a stance or holding Focus, whoever they are -
   * and that half is the one that matters, because a hard gate on the subclass
   * would make those refs invisible AND UNDROPPABLE. A sheet that arrived from
   * another device, or one whose subclass was chosen differently, would keep
   * writing `stanceRefs` to storage with no screen willing to show them. That
   * is the same rule the unresolved-ref rows below are built on: nothing this
   * app cannot use is hidden, because hidden is how a thing becomes impossible
   * to remove.
   *
   * What the subclass DOES gate is the picker - see `Add a stance` at the
   * bottom. Seeing what you carry is not the same permission as taking more.
   *
   * `all.length === 0` stays in the condition and is not redundant: a Martial
   * Artist on SRD 1.0, which prints no stances at all, would otherwise be given
   * an empty section with a button that opens onto nothing.
   */
  if ((all.length === 0 || !isMartialArtist) && known.length === 0 && !holdsFocus) return null;

  const toggle = (id: string): void => {
    const has = character.stanceRefs.includes(id);
    onPatch({
      stanceRefs: has
        ? character.stanceRefs.filter((r) => r !== id)
        : [...character.stanceRefs, id],
    });
  };

  /*
   * The tier this character has reached, from the level alone - the same
   * `tierOf` the gear picker reads, so the two screens cannot disagree about
   * what tier 3 means.
   */
  const characterTier = tierOf(character.level);
  const byTier = [1, 2, 3, 4].map((tier) => ({
    tier,
    rows: all.filter((s) => s.tier === tier),
  }));

  return (
    <Section label="Martial Stances" hint="KNOWN, NOT ACTIVE · SHOWN, NEVER APPLIED">
      {(known.length > 0 || holdsFocus) && (
        <div
          className="spread"
          style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', maxWidth: 330 }}
        >
          <span className="row" style={{ gap: 8 }}>
            <span style={{ font: '600 14px/1 var(--sans)' }}>Focus</span>
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              HELD
            </span>
          </span>
          <Stepper
            label="Focus"
            value={character.focus.marked}
            min={0}
            max={character.focus.max}
            width={34}
            format={(v) => `${v}/${character.focus.max}`}
            onChange={(marked) => {
              onPatch({ focus: { ...character.focus, marked } });
            }}
          />
        </div>
      )}

      {unnamed.map(({ ref }) => (
        <div
          key={ref}
          className="panel stack"
          style={{ gap: 5, padding: '10px 12px', borderLeft: '3px solid var(--damage)' }}
        >
          <span className="t-meta" style={{ letterSpacing: '0.08em', color: 'var(--damage)' }}>
            STANCE NOT IN THIS BUILD
          </span>
          <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
            {ref}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', minHeight: 'var(--tap)' }}
            onClick={() => {
              onPatch({ stanceRefs: character.stanceRefs.filter((r) => r !== ref) });
            }}
          >
            Drop it
          </button>
        </div>
      ))}

      {/*
        The known stances, in the book's own tier order rather than the order
        they were picked in: the rule a player checks is "from your tier or
        lower", so the tier is what the list is read against. Their text is not
        folded - see read-vs-touch above.
      */}
      {known.some((k) => k.record !== undefined) && (
        <div className="stack" style={{ gap: 8 }}>
          {all
            .filter((s) => character.stanceRefs.includes(s.id))
            .map((s) => (
              <div key={s.id} className="row" style={{ gap: 8, alignItems: 'stretch' }}>
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <FeatureBlock name={s.name} text={s.text} tag={`TIER ${s.tier}`} />
                </div>
                {/*
                  The way back out of a stance you can read - see the section
                  docblock. `toggle`, not a second write of `stanceRefs`: the
                  picker's row and this ✕ do the same thing to the same field,
                  and two routes to one write is two behaviours eventually.
                */}
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label={`Drop ${s.name}`}
                  onClick={() => {
                    toggle(s.id);
                  }}
                  style={{
                    flex: 'none',
                    minWidth: 'var(--tap)',
                    minHeight: 'var(--tap)',
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}

      {picking ? (
        <div className="stack" style={{ gap: 8 }}>
          {byTier.map(({ tier, rows }) =>
            rows.length === 0 ? null : (
              <div key={tier} className="stack" style={{ gap: 8 }}>
                <span className="t-label" style={{ color: 'var(--dim)' }}>
                  TIER {tier}
                </span>
                {rows.map((s) => (
                  <Choice
                    key={s.id}
                    selected={character.stanceRefs.includes(s.id)}
                    /*
                     * ABOVE THIS CHARACTER'S TIER: dimmed and explained, never
                     * blocked, and the two halves are a decision each.
                     *
                     * Folio 13: "Mark a new stance from your tier or below each
                     * time you gain a level." So a tier above this one is not
                     * yet the player's to mark, and a picker that said nothing
                     * would be letting them take it without ever printing the
                     * rule they were breaking.
                     *
                     * It is not DISABLED, and `GearPicker` no longer agrees
                     * with that - which is the point rather than a drift. The
                     * Equipment chapter spends a verb on gear: *"You can't
                     * equip weapons or armor with a higher tier than you."*
                     * Folio 13 spends none on stances: *"Mark a new stance
                     * from your tier or below each time you gain a level"* is
                     * a rule for gaining a level, and no sentence anywhere
                     * says what a character who has one anyway may not do. So
                     * the gear picker refuses and this one says; the book is
                     * what splits them, and `gear.ts` carries the same split
                     * between the tier limit and the burden limit.
                     *
                     * Hiding it would be worse than either - `gear.ts` calls
                     * that lying by omission - and the sheet already says
                     * SHOWN, NEVER APPLIED, so nothing here moves a number
                     * either way.
                     */
                    dim={s.tier > characterTier}
                    reason={
                      s.tier > characterTier
                        ? `Tier ${s.tier} — markable from level ${TIER_LEVELS[s.tier][0] ?? 1}`
                        : undefined
                    }
                    /*
                     * A second tap on a stance already known removes it, which
                     * is what `aria-pressed` already promises. The picker stays
                     * OPEN either way - unlike the transformation picker, which
                     * closes on a pick, because that field holds one card and
                     * this one holds two at level 1 and more later. Closing
                     * after the first of two would make the common gesture pay
                     * two extra taps.
                     */
                    onClick={() => {
                      toggle(s.id);
                    }}
                    title={s.name}
                    body={s.text}
                  />
                ))}
              </div>
            ),
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', minHeight: 'var(--tap)' }}
            onClick={() => {
              setPicking(false);
            }}
          >
            Done
          </button>
        </div>
      ) : (
        all.length > 0 &&
        isMartialArtist && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ minHeight: 'var(--tap)' }}
              onClick={() => {
                setPicking(true);
              }}
            >
              {known.length === 0 ? 'Add a stance' : `Change stances (${known.length})`}
            </button>
          </div>
        )
      )}
    </Section>
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
