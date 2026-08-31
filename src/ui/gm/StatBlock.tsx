/**
 * Stat blocks, sized for the distance they are actually read from.
 *
 * A GM reads this mid-scene, across a table, over the top of a screen. So the
 * order is not the order the book prints: the attack line, the thresholds and
 * the feature *names* come first and are large, and the prose sits under them
 * at reading size. Nothing here is interactive - the numbers are facts, and
 * what a feature does is applied by the GM, not by the app.
 */
import { useState } from 'react';
import type { Adversary, Environment, Feature } from '../../../shared/types.ts';

/** `phy`, `direct mag`, `phy/mag` - all of them, without a lookup table. */
export function damageLabel(type: string): string {
  return type.replace(/phy/g, 'physical').replace(/mag/g, 'magic').toUpperCase();
}

export const signed = (n: number): string => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '9px 10px 10px',
        borderRadius: 'var(--r3)',
        background: 'var(--app)',
        border: '1px solid var(--line-soft)',
      }}
    >
      <div className="t-meta" style={{ letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          font: '800 22px/1 var(--sans)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'var(--text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  Action: 'var(--damage)',
  Reaction: 'var(--stress)',
  Passive: 'var(--muted)',
};

export function FeatureList({ features }: { features: Feature[] }): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 12 }}>
      {features.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          style={{
            borderLeft: `3px solid ${KIND_COLOR[f.kind ?? 'Passive'] ?? 'var(--muted)'}`,
            paddingLeft: 11,
          }}
        >
          <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ font: '800 16px/1.15 var(--sans)', letterSpacing: '-0.01em' }}>
              {f.name}
            </span>
            {f.kind !== undefined && (
              <span className="chip" style={{ color: KIND_COLOR[f.kind] }}>
                {f.kind.toUpperCase()}
              </span>
            )}
          </div>
          <p className="t-body" style={{ margin: '5px 0 0', whiteSpace: 'pre-line' }}>
            {f.text}
          </p>
        </div>
      ))}
      {features.length === 0 && (
        <span className="t-dense" style={{ color: 'var(--dim)' }}>
          No features.
        </span>
      )}
    </div>
  );
}

export function AdversaryBlock({
  adversary,
  action,
}: {
  adversary: Adversary;
  /** Whatever the host screen wants to offer, beside the name. */
  action?: React.ReactNode;
}): React.JSX.Element {
  const a = adversary;
  return (
    <article className="stack" style={{ gap: 14 }}>
      <header>
        <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
          <h2 className="t-card" style={{ margin: 0 }}>
            {a.name}
          </h2>
          {action}
        </div>
        <div className="row" style={{ gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
          <span className="chip">TIER {a.tier}</span>
          <span className="chip" style={{ color: 'var(--text-2)' }}>
            {a.role.toUpperCase()}
          </span>
          {a.sourcePage !== undefined && <span className="t-meta">P.{a.sourcePage}</span>}
        </div>
        <p className="t-body" style={{ margin: '9px 0 0' }}>
          {a.description}
        </p>
        {a.motives.length > 0 && (
          <div className="t-meta" style={{ marginTop: 7, lineHeight: 1.5 }}>
            MOTIVES &amp; TACTICS · {a.motives.join(', ').toUpperCase()}
          </div>
        )}
      </header>

      {/* The line the GM needs every single turn. */}
      <div
        className="row"
        style={{
          gap: 12,
          flexWrap: 'wrap',
          padding: '11px 13px',
          borderRadius: 'var(--r3)',
          background: 'var(--app)',
          borderLeft: '3px solid var(--damage)',
        }}
      >
        <span
          style={{
            font: '800 26px/1 var(--sans)',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {signed(a.attackBonus)}
        </span>
        <span className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span style={{ font: '700 15px/1.1 var(--sans)' }}>{a.attack.name}</span>
          <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
            {a.attack.range.toUpperCase()} · {damageLabel(a.attack.damageType)}
          </span>
        </span>
        <span
          className="t-num"
          style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--damage)' }}
        >
          {a.attack.damage}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: 8,
        }}
      >
        <Stat label="DIFFICULTY" value={String(a.difficulty)} />
        <Stat
          label="MAJOR"
          value={a.thresholds ? String(a.thresholds[0]) : '—'}
          color={a.thresholds ? undefined : 'var(--dim)'}
        />
        <Stat
          label="SEVERE"
          value={a.thresholds ? String(a.thresholds[1]) : '—'}
          color={a.thresholds ? undefined : 'var(--dim)'}
        />
        <Stat label="HP" value={String(a.hp)} color="var(--damage)" />
        <Stat label="STRESS" value={String(a.stress)} color="var(--stress)" />
      </div>
      {a.thresholds === null && (
        <span className="t-meta" style={{ color: 'var(--dim)', marginTop: -8 }}>
          NO DAMAGE THRESHOLDS — ANY DAMAGE DEFEATS THIS ADVERSARY
        </span>
      )}

      {a.experiences.length > 0 && (
        <div>
          <div className="t-label" style={{ marginBottom: 6 }}>
            Experience
          </div>
          <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
            {a.experiences.map((x) => (
              <span key={x.name} className="chip" style={{ color: 'var(--text-2)', fontSize: 11 }}>
                {x.name} {signed(x.bonus)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="t-label" style={{ marginBottom: 9 }}>
          Features
        </div>
        <FeatureList features={a.features} />
      </div>
    </article>
  );
}

/**
 * The active environment, alongside the adversaries rather than instead of
 * them.
 *
 * ## What is shut, and what is not
 *
 * The old rule was "collapsed is one line; open is the whole feature list,
 * because 'Barbed Vines' is a thing you read out loud, not a thing you
 * remember." That rule still decides the features, and it decides the two
 * fields this band was missing - it just does not put them on the same side.
 *
 * IMPULSES is the sentence the place is *played* by. `using-environments`
 * (p.102) defines it as "the manner or mode with which the environment pushs
 * and pulls the people within them": nobody reads it out, and it is in force
 * during every sentence that is read out. So it is drawn shut, where a glance
 * reaches it without a tap.
 *
 * POTENTIAL ADVERSARIES is the opposite half of the same rule - a list
 * consulted once, at the moment something new walks in - so it goes behind the
 * fold, above the features.
 *
 * The price is that the shut band is no longer one line. Measured over the
 * shipped book: the label plus the impulses runs 39 characters at its shortest
 * and 131 at its longest, 74 at the median. In the live scene this band's
 * inner column at 393 is 339px, and the arithmetic takes three subtractions
 * rather than the two that were written here:
 *
 * 1. The sheet. `Scene.tsx` draws this band, and `Scene` has one mount point:
 *    `Gm.tsx` renders it inside the `size="full"` `GmSheet`, whose overlay
 *    declares `padding: full || phone ? 0 : 24` - zero horizontally - around a
 *    panel at `width: '100%'` with `border: '1px solid var(--line)'`. Under
 *    `base.css`'s `box-sizing: border-box` the panel's content box at 393 is
 *    391.00, which `GmSheet.tsx` states and `Reference.tsx` measured in Chrome.
 *    (The overlay paid `calc(env(safe-area-inset-top) + 8px) 0 0` when this was
 *    written. It is `position: absolute` inside `Gm.tsx`'s stage now and pays
 *    nothing; the horizontal zero this subtraction reads is unchanged.)
 * 2. The scene region's 24px of padding, which leaves 367.00 - the same column
 *    `Reference.tsx` states for the other `full` tool that pads 12 a side.
 * 3. This band's four pixels of border and the 24 its own rows pad by
 *    (`padding: '0 12px 11px'` under the fold, `'0 12px'` on the button):
 *    339.00.
 *
 * Four pixels of border and not two: `.panel` gives the band `border: 1px
 * solid var(--line-soft)` (`base.css:235`), and the `<section>` this docblock
 * sits over overrides the left one to `3px solid var(--sage)`, so one edge
 * costs three where the other costs one. A sentence naming this band's own
 * earlier columns stood here and got them wrong - it named one of
 * `Scene.tsx`'s instead, and that paragraph is costing a card two pixels wider
 * than this band. It is deleted rather than corrected: a docblock owes the
 * derivation it is standing on, which is the three subtractions above, and not
 * its own changelog.
 *
 * `.t-meta` is 10px IBM Plex Mono at 0.06em - a 0.6 advance plus the tracking,
 * ~6.6px a character, which `GearPicker.tsx:716-720` derives and
 * `ReferenceTables.tsx` uses for this class - so 339 holds 51 characters a
 * line: 51 characters want 336.6px and 52 want 343.2, so the column would have
 * to shed 2.4px or gain 4.2 before that count moved at all. No
 * conclusion moves with the width: 39 is one line, 74 is two and 131 is three.
 * That height
 * comes off the card grid directly, because the band is `flex: 'none'` above
 * it.
 *
 * **None of that has been in a browser, and no open item registers it.** It
 * stood here as `PROGETTO-GM` §7 item 9, and item 9 asks something else:
 * whether "a derived-Difficulty readout fits the environment band's header row
 * at 393px alongside tier, type and the features chip". That is the header row
 * and the derived readout; this paragraph is the impulses row, a different
 * element on a different axis.
 *
 * So 39/74/131 wrapping one, two and three lines in a 339px column, and the
 * height that falls out of it, must not be read as current. They are arithmetic
 * off a character advance, they owe the single Chrome pass this project keeps
 * deferring, and until §7 gains an item of their own - which is not this file's
 * to write - nothing is holding them.
 *
 * ## The header row, which item 9 asked about and this change did join
 *
 * "Nothing joined that row for item 9 to measure" stood here, and it was false
 * in the commit that wrote it. The `≈ DIF` line is indeed drawn outside the
 * button, in the stack beneath it - but the same change put the book's word
 * into the header's own `.t-meta` span, and `DIF SPECIAL` is eleven characters
 * where `DIF 14` is six. Something joined that row, so here is what it does
 * there, off the same declarations the impulses row is costed from.
 *
 * The button is a wrapping flex row - `flexWrap: 'wrap'`, `gap: 9` - over four
 * children: three at `flex: 'none'` and the name at `flex: 1` with `minWidth:
 * 0`. `flex: 1` is a basis of 0%, so the name contributes nothing to where the
 * line breaks and takes whatever is left of it. Shut, over Ambushed and
 * Ambushers, whose header text is identical:
 *
 * - `.t-label` ENVIRONMENT, 11 characters at `10px var(--mono)` plus 0.16em of
 *   tracking - 7.6 each - is 83.60.
 * - `.t-meta` `T1 · EVENT · DIF SPECIAL`, 24 characters at the 6.6 above, is
 *   158.40.
 * - `.chip` `2 FEATURES`, 10 characters of `600 9.5px/1 var(--mono)` at 0.06em
 *   - 6.27 each - plus the `padding: 4px 6px` the class declares, is 74.70.
 * - Three gaps of 9 are 27.
 *
 * 343.70 into a 339 column, so **the chip wraps to a second line**. It does not
 * overflow and it cannot truncate: the row declares the wrap, and the one
 * elastic child declares `minWidth: 0`, so the name gives way rather than
 * pushing anything past the edge.
 *
 * **The wrap costs no height.** Line one is the tallest of a 10px label, a
 * `14px/1.15` name and a 10px meta - 16.10; line two is the chip's 9.5 plus the
 * 8 of vertical padding - 17.50; the row gap is 9. That is 42.60 against the
 * `minHeight: 46` the button declares, so both the one-line and the two-line
 * layouts are 46px tall and nothing below the band moves. It is also why the
 * conclusion does not turn on the 4.7px the sum clears the column by: the row
 * is 46 either way, and only the wrap itself is in doubt.
 *
 * Nor is the wrap new. The same arithmetic over all 19 environments puts the
 * four EXPLORATION bands at 350.30 shut - 25 characters of meta where these two
 * have 24 - so that row already wrapped for four of nineteen before SPECIAL was
 * written into it, and now wraps for six. Open, the chip reads HIDE and every
 * environment fits one line; these two come to 306.08.
 *
 * The name is the one term here that is not a declaration. It takes the free
 * space on line one - 79.00, for these two - and, having no `white-space` rule,
 * wraps inside its own item if its text wants more, which would take line one
 * to 32.20 and the button to 58.70, past the floor. `Ambushed` and `Ambushers`
 * are eight and nine characters of 14px Archivo; whether they fit in 79 is the
 * single thing on this row a browser still has to say, and it is the only way
 * this row costs anything at all.
 *
 * `sceneTruth.test.tsx` holds the four declarations this paragraph rests on -
 * the wrap, the name's `minWidth: 0`, the 9px gap and the 46px floor - because
 * arithmetic over a declaration is only as good as the declaration staying
 * put, and jsdom can read a declaration where it cannot read a layout.
 *
 * 339 is the column in the live scene. `Bestiary.tsx` draws the same band on
 * its own screen and is not costed here.
 *
 * ## The Difficulty this app is allowed to state
 *
 * Two environments print `Difficulty: Special` instead of a number - Ambushed
 * and Ambushers, both p.103 - and `shared/parsers/environments.ts` stores that
 * as 0, because `Environment.difficulty` is a number. Suppressing the readout
 * on 0 was right, since 0 is a lie, but it left the field reading as *absent*,
 * which is worse: a GM could not tell whether the place had no Difficulty or
 * the app had lost it. The header now prints the book's own word, SPECIAL.
 *
 * The substitute splits cleanly into a quote and an app's arithmetic, and the
 * seam is the whole design. Both blocks carry a Passive named Relative
 * Strength reading "The Difficulty of this environment equals that of the
 * adversary with the highest Difficulty" - so *that* a substitute exists is the
 * book's, not this app's, and the feature itself is already printed verbatim
 * behind the fold. What is this app's is the **scope**: `strongestHere` is the
 * highest Difficulty among the cards this band is drawn above, and a GM whose
 * ambush includes something they never added to the scene gets a number that
 * is too low. A chosen set is arithmetic, so the line takes this project's
 * rule for anything computed rather than quoted - `--dim`, prefixed `≈`, with
 * COMPUTED BY THIS APP in the same element as the number.
 *
 * `strongestHere` is optional because two callers draw this band and only one
 * of them has a fight under it. `Scene.tsx` passes it, off the OPEN row's own
 * combatants - the same rule stated one layer up, since the runner reads its
 * fight and its place from one row and could not mix two if it tried.
 * `Bestiary.tsx` is browsing, and
 * a band that borrowed the number from a scene the reader is not looking at
 * would be the same defect one step quieter - so the browsing case has to be
 * the default rather than something a caller remembers to say. Absent, the
 * header still says SPECIAL and no number is claimed. Reading `useGm` in here
 * would have got the arithmetic for free and got exactly that defect with it.
 */
export function EnvironmentBand({
  environment,
  strongestHere,
}: {
  environment: Environment;
  /** The highest Difficulty among the cards below, when there are any. */
  strongestHere?: number;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const e = environment;
  const special = e.difficulty <= 0;
  const derived = special && strongestHere !== undefined ? strongestHere : null;
  return (
    <section
      className="panel stack"
      style={{ flex: 'none', borderLeft: '3px solid var(--sage)', overflow: 'hidden' }}
    >
      <button
        type="button"
        className="row"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ gap: 9, minHeight: 46, padding: '0 12px', textAlign: 'left', flexWrap: 'wrap' }}
      >
        <span className="t-label" style={{ color: 'var(--sage)', flex: 'none' }}>
          Environment
        </span>
        <span style={{ font: '700 14px/1.15 var(--sans)', flex: 1, minWidth: 0 }}>{e.name}</span>
        <span className="t-meta" style={{ flex: 'none' }}>
          T{e.tier} · {e.type.toUpperCase()} · DIF {special ? 'SPECIAL' : e.difficulty}
        </span>
        <span className="chip" style={{ flex: 'none', color: 'var(--text-2)' }}>
          {open ? 'HIDE' : `${e.features.length} FEATURES`}
        </span>
      </button>

      {/*
        Outside the button, not inside it. Both lines are content the GM reads,
        and inside the toggle they would join its accessible name - a rotor
        would announce the whole impulses string as the label of a control that
        opens features.
      */}
      {(e.impulses.length > 0 || derived !== null) && (
        <div className="stack" style={{ gap: 5, padding: '0 12px 11px' }}>
          {e.impulses.length > 0 && (
            <span className="t-meta" style={{ lineHeight: 1.5 }}>
              IMPULSES · {e.impulses.toUpperCase()}
            </span>
          )}
          {derived !== null && (
            <span className="t-meta" style={{ lineHeight: 1.5, color: 'var(--dim)' }}>
              ≈ DIF {derived} · FROM THE STRONGEST ADVERSARY HERE · COMPUTED BY THIS APP
            </span>
          )}
        </div>
      )}

      {/* Open, `gap` is FeatureList's own 12 so the list above it keeps the rhythm. */}
      {open && (
        <div className="stack" style={{ gap: 12, padding: '2px 12px 13px' }}>
          {e.potentialAdversaries.length > 0 && (
            <div>
              <div className="t-label" style={{ marginBottom: 6 }}>
                Potential adversaries
              </div>
              <ul className="t-body" style={{ margin: 0, paddingLeft: 18 }}>
                {e.potentialAdversaries.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <FeatureList features={e.features} />
        </div>
      )}
    </section>
  );
}

export function EnvironmentBlock({
  environment,
  active,
  onToggle,
  disabled = false,
}: {
  environment: Environment;
  active: boolean;
  onToggle: () => void;
  /**
   * SHIPPED WITH NO CALLER, DELIBERATELY, AND THIS SAYS SO RATHER THAN LEAVING
   * IT TO BE DISCOVERED.
   *
   * ## The four sites, so the next reader does not have to grep
   *
   * Every one of them passes nothing, measured at the commit this sentence was
   * written in. Two are the app: `Bestiary`'s environments tab, and `LinkArm`
   * in `SessionBody.tsx`, which is the environment link row. Two are tests:
   * the `COMPONENTS` sweep in `tests/ui/screens.test.tsx`, and the Difficulty
   * assertion in `tests/gm/sceneTruth.test.tsx`. Named rather than numbered -
   * a line number in a file somebody else is editing is a claim that goes
   * stale between commits.
   *
   * They pass nothing because `setEnvironment` means exactly what it meant
   * before the fight left the board: it commits one field, the CAMPAIGN's one
   * workbench place, which is what `SEND` carries into a scene it mints and
   * what `KEEP THE BOARD'S ENVIRONMENT HERE` copies onto a row. Both buttons
   * write that same field for the same campaign, so neither has a state it
   * must refuse in.
   *
   * The seat is here because the two SET ACTIVE buttons are the only pair of
   * identical controls in this app with two different owners, and the day one
   * of them has to be refused, the refusal has to be drawn on the button
   * rather than by the caller hiding it: a control that vanishes teaches the
   * hand nothing, and a control that can be pressed and does nothing is, in
   * `Countdowns.tsx`'s words, the worse of the two lies. `aria-disabled` is
   * not used in its place, for the same reason.
   *
   * ## What would have to become true for it to earn the seat
   *
   * One of two things, and both are already named elsewhere in this tree:
   *
   *  1. **The archive gets a screen.** `Campaign.archive` is read by nothing
   *     today but two counters, so a closed sitting is drawn nowhere. Draw one
   *     and its rows are these rows, an environment link row among them - and
   *     `ArchivedSession`'s whole promise is that a record does not change
   *     under you. A SET ACTIVE inside last week's sitting must be REFUSED,
   *     visibly, on the button; hiding it would make an archived row and a live
   *     row look like different kinds of thing when they are the same row.
   *  2. **A row owns its own place.** If the environment link row is ever
   *     wired to a scene row's `environmentRef` rather than the board's, the
   *     two buttons stop being one control with two doors, and the one with no
   *     row under it is the one that has to say so.
   *
   * Until one of those lands, this is a prop with an argument and no caller.
   * Do not delete it on that ground alone - the merged plan asks for it, and
   * that is the owner's call - but do not go looking for a use for it either.
   */
  disabled?: boolean;
}): React.JSX.Element {
  const e = environment;
  return (
    <article className="stack" style={{ gap: 14 }}>
      <header>
        <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
          <h2 className="t-card" style={{ margin: 0 }}>
            {e.name}
          </h2>
          <button
            type="button"
            className="btn"
            onClick={onToggle}
            aria-pressed={active}
            disabled={disabled}
            // Two link rows in a session list draw two of these, and what tells
            // them apart is the heading beside the button rather than anything
            // in it - which is a distinction a rotor's list of buttons does not
            // carry. The same rule the session row's DELETE follows.
            aria-label={`${active ? 'ACTIVE — CLEAR' : 'SET ACTIVE'} — ${e.name}`}
            style={{
              flex: 'none',
              // Declared rather than inherited from `.btn`. It has always been
              // 44px through the class, but this button is now drawn inside an
              // open session row, and the whole-screen sweep in
              // tests/gm/sessionList.test.tsx reads declared inline heights -
              // which is the only thing that can be checked without a layout
              // engine. A control whose floor is only in a stylesheet is a
              // control the sweep has to be told to ignore.
              minHeight: 'var(--tap)',
              background: active ? 'var(--hope)' : 'var(--raised)',
              color: active ? 'var(--app)' : 'var(--text)',
              borderColor: active ? 'transparent' : 'var(--line)',
              // The only thing `disabled` changes about the geometry: nothing.
              // The 44px floor above it is unconditional, so a refused control
              // stays exactly where the hand left it.
              opacity: disabled ? 0.45 : undefined,
            }}
          >
            {active ? 'ACTIVE — CLEAR' : 'SET ACTIVE'}
          </button>
        </div>
        <div className="row" style={{ gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
          <span className="chip">TIER {e.tier}</span>
          <span className="chip" style={{ color: 'var(--text-2)' }}>
            {e.type.toUpperCase()}
          </span>
        </div>
        <p className="t-body" style={{ margin: '9px 0 0' }}>
          {e.description}
        </p>
        <div className="t-meta" style={{ marginTop: 7, lineHeight: 1.5 }}>
          IMPULSES · {e.impulses.toUpperCase()}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
        {/*
          Not "Event environments print no Difficulty" - four of the six in the
          shipped book print one. The two that do not print `Difficulty:
          Special`, which `shared/parsers/environments.ts` stores as 0, so that
          is the word to draw. A dash said the field was missing.
        */}
        <Stat
          label="DIFFICULTY"
          value={e.difficulty > 0 ? String(e.difficulty) : 'SPECIAL'}
          color={e.difficulty > 0 ? undefined : 'var(--dim)'}
        />
      </div>

      {e.potentialAdversaries.length > 0 && (
        <div>
          <div className="t-label" style={{ marginBottom: 6 }}>
            Potential adversaries
          </div>
          <ul className="t-body" style={{ margin: 0, paddingLeft: 18 }}>
            {e.potentialAdversaries.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="t-label" style={{ marginBottom: 9 }}>
          Features
        </div>
        <FeatureList features={e.features} />
      </div>
    </article>
  );
}
