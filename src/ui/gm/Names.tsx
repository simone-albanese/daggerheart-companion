/**
 * A name, now, for the person the players just decided to talk to.
 *
 * The gesture this tool exists for is one tap repeated: draw, glance, draw
 * again, stop when one sounds right. Everything below is arranged around that
 * and around nothing else - there is no form to fill in, no seed to type and
 * no setting to choose, because every one of those costs more seconds than the
 * stall it was meant to cover.
 *
 * ## The words are the app's own, and the screen says so
 *
 * The Core Book prints four name lists. They are not redistributable, they are
 * not in this repo, and - the part no test can prove - they were not cut up to
 * build the tables behind this screen either. `src/engine/names.ts` carries
 * that argument in full under PROVENANCE and COLLISION; what belongs *here* is
 * the one sentence a GM should be able to read without opening a source file,
 * because a tool that hands out names is exactly the tool somebody will ask
 * where the names came from. It is under the draw, in `t-dense`, permanently -
 * not behind a fold, because an answer behind a fold is an answer nobody finds
 * on the day they need it.
 *
 * ## What `taken` is, on this screen
 *
 * The generator refuses to repeat a name the caller says is in play, and this
 * component is what knows which those are: everyone on the live scene, every
 * row of tonight's session, every player sheet on the party board, and every
 * name this tool has already handed over in this sitting. That last one is the
 * reason the sitting's list is state rather than a rolling single value - a
 * generator that forgets what it just said will say it again, and a GM who has
 * to notice that is doing the tool's job.
 *
 * The party board's sheets are in there on purpose. Naming an NPC after
 * somebody's player character is the one collision at the table that actually
 * costs the evening something.
 *
 * ## Ergonomics, 393 x 852
 *
 * `GmSheet size="full"` starts at the top safe area plus 8 and runs to the
 * bottom of the window: 852 - 47 - 8 = 797px of panel, less a 44px title row,
 * so this region gets 753px. It pads `10px
 * 12px 16px` on a phone, so the inner column is 393 - 24 = 369px; at 744 and
 * 1024 it pads `14px 20px 18px` for 704 and 984, and the sheet caps at 1100
 * for a widest column of 1060.
 *
 * **Flagged: everything in that paragraph except the 797 is short by the
 * panel's own frame.** `GmSheet`'s panel is border-box with a 1px border
 * (`GmSheet.tsx`), so its content box at 393 is 391.00 and the inner column
 * is **367.00**, measured in the sibling tool that shares this sheet
 * (`Reference.tsx`). The vertical side was measured in the same run and in the
 * same sheet: the panel is **797.00**, so that figure was right, and the
 * region under the title row is **750.00**, not 753 - the 753 spends neither
 * the panel's own border, top and bottom, nor the title row's rule. 704, 984
 * and 1060 lose 2 apiece by the same border as 369 did; those three are
 * implied by the measured 367.00 rather than measured themselves, and are
 * written here as implied. Each number below that starts from 369 - the
 * `369 x 64` of DRAW, the `(369 - 12) / 3 = 119` of the three kinds -
 * inherits the error. Measure them before anything leans on them.
 *
 * **DRAW is at the bottom and is not in the scroller.** It is the only control
 * on this screen that is pressed more than once, and it is pressed several
 * times in a row, so it holds the band a right thumb covers without the hand
 * moving - the same 560-820 arc `GmBar`'s three verbs hold on the screen
 * underneath. 369 x 64: taller than the 44px floor and taller than the 56px the
 * sheets use for a one-tap answer, because this one is tapped repeatedly and a
 * repeated target is the one place extra height is bought back immediately.
 *
 * **The three kinds are at the top, at the 44px floor.** A GM picks person or
 * place once and then draws six times; a control chosen once per burst does not
 * belong under the thumb, and putting it there would mean the repeated tap and
 * the rare tap share an arc. Three across the 369px column at (369 - 12) / 3 =
 * 119px each, which holds PERSON, PLACE and REGION in `.t-label` - 10px mono at
 * 0.16em, about 7.6px a character, so 53px of word inside 119px of target.
 *
 * **The result is read, not touched.** 30px type, its own line, with nothing
 * pressable inside it: a name is copied by eye onto a GM's own paper far more
 * often than it is copied by clipboard, and a target drawn around it would be a
 * target that does nothing on the tap it invites.
 *
 * **The sitting's list is read too**, and it scrolls, which is why the root is
 * a plain column with one scroller inside it rather than `scroll stack` like
 * its siblings: the sibling tools are all scroll-to-the-bottom screens, and
 * this one has a control that must not leave the bottom when the list grows.
 * CLEAR sits with the list rather than with DRAW, at the 44px floor, because it
 * is the destructive one and the repeated tap must not be able to land on it.
 */
import { useCallback, useMemo, useState } from 'react';
import { cryptoRng, type Rng } from '../../engine/dice.ts';
import { drawName, NAME_KINDS, PRODUCIBLE, type NameKind } from '../../engine/names.ts';
import { useGm } from './gmStore.ts';

/**
 * The chip, and the sentence under the draw.
 *
 * `label` is the accessible name because PERSON on its own does not say what
 * pressing it will do, and `blurb` is what the register actually sounds like -
 * a GM who has never used this needs to know a "region" here is a phrase and a
 * "place" is one word before they can choose between them.
 */
export const NAME_KIND_ITEMS: Record<
  NameKind,
  { short: string; label: string; blurb: string }
> = {
  person: {
    short: 'PERSON',
    label: 'Name a person',
    blurb: 'A given name, and most of the time a surname with it.',
  },
  place: {
    short: 'PLACE',
    label: 'Name a place',
    blurb: 'A settlement, as one word - the kind of name a signpost carries.',
  },
  region: {
    short: 'REGION',
    label: 'Name a region or a landmark',
    blurb: 'A phrase: a stretch of country, or the one building everyone means.',
  },
};

/** The sentence about where these words come from. One literal, drawn once. */
export const NAMES_PROVENANCE =
  'These words are this app’s own, written for it. The Core Book’s name lists are not in this app and were not used to build them.';

/**
 * The size of the whole space, said on the screen rather than only in a test.
 *
 * `'en-GB'` and not the device locale: this is one sentence with one number in
 * it, and a screen that reads "15.325 names" on a German phone would be
 * claiming a different quantity. Nothing else here is localised either.
 */
export const NAMES_COUNT = `${PRODUCIBLE.toLocaleString('en-GB')} names in all, and every one of them is checked against everything this app ships — by listing all of them, not by spot-checking a few.`;

export function Names({
  phone,
  rng = cryptoRng,
}: {
  phone: boolean;
  /**
   * Passed rather than defaulted at the call site for the same reason `Rest`
   * takes one: a screen that reaches for randomness directly cannot be tested
   * without the test reaching for it too.
   */
  rng?: Rng;
}): React.JSX.Element {
  const combatants = useGm((s) => s.combatants);
  const session = useGm((s) => s.session);
  const party = useGm((s) => s.party);

  const [kind, setKind] = useState<NameKind>('person');
  /** Newest first, which is the order the eye wants and the reverse of drawing. */
  const [drawn, setDrawn] = useState<string[]>([]);

  /**
   * Everything already in play, so the generator can refuse to repeat it.
   *
   * Trimmed and emptied-out, because `SessionItemBase.name` is allowed to be
   * empty and an empty string in here would make every draw look free.
   */
  const taken = useMemo(() => {
    const names = [
      ...combatants.map((c) => c.name),
      ...session.map((item) => item.name),
      ...party.map((member) => member.sheet.name),
      ...drawn,
    ];
    return new Set(names.map((name) => name.trim()).filter((name) => name !== ''));
  }, [combatants, session, party, drawn]);

  const draw = useCallback(() => {
    setDrawn((before) => [drawName(kind, rng, taken), ...before]);
  }, [kind, rng, taken]);

  const current = drawn[0] ?? null;
  const pad = phone ? '10px 12px 16px' : '14px 20px 18px';
  const blurb = NAME_KIND_ITEMS[kind].blurb;

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 14, padding: pad }}>
        <div
          role="group"
          aria-label="What to name"
          className="row"
          style={{ flex: 'none', gap: 6 }}
        >
          {NAME_KINDS.map((id) => {
            const entry = NAME_KIND_ITEMS[id];
            const on = id === kind;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                aria-label={entry.label}
                aria-pressed={on}
                className="t-label"
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 44,
                  borderRadius: 'var(--r3)',
                  border: `1px solid ${on ? 'var(--text-3)' : 'var(--line)'}`,
                  color: on ? 'var(--text)' : 'var(--muted)',
                }}
              >
                {entry.short}
              </button>
            );
          })}
        </div>

        {/*
          `aria-live="polite"` and not `assertive`: a GM drawing six names in a
          row would otherwise have a screen reader interrupt itself six times,
          which is the mistake `SessionList` already documents at length.
        */}
        <p
          aria-live="polite"
          style={{
            flex: 'none',
            margin: 0,
            minHeight: 40,
            fontSize: 30,
            lineHeight: 1.15,
            color: current === null ? 'var(--dim)' : 'var(--text)',
          }}
        >
          {current ?? 'Nothing drawn yet.'}
        </p>

        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          {blurb} {NAMES_PROVENANCE} {NAMES_COUNT}
        </p>

        {drawn.length > 1 && (
          <div className="stack" style={{ flex: 'none', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="t-label" style={{ flex: 1, minWidth: 0, color: 'var(--muted)' }}>
                DRAWN THIS SITTING
              </span>
              <button
                type="button"
                onClick={() => setDrawn([])}
                className="t-label"
                style={{ flex: 'none', minHeight: 44, padding: '0 10px', color: 'var(--muted)' }}
              >
                CLEAR
              </button>
            </div>
            {/*
              The head of the list is the big line above, so it is not repeated
              here - a name drawn ten seconds ago printed twice on one screen
              reads as two different NPCs.
            */}
            <ul className="stack" style={{ flex: 'none', gap: 4, margin: 0, padding: 0 }}>
              {drawn.slice(1).map((name, at) => (
                <li
                  key={`${name}-${String(at)}`}
                  className="t-dense"
                  style={{ listStyle: 'none', color: 'var(--text-2)' }}
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={{ flex: 'none', padding: phone ? '0 12px 12px' : '0 20px 16px' }}>
        <button
          type="button"
          onClick={draw}
          className="btn"
          style={{ width: '100%', minHeight: 64, letterSpacing: '0.1em' }}
        >
          {current === null ? 'DRAW A NAME' : 'DRAW ANOTHER'}
        </button>
      </div>
    </div>
  );
}
