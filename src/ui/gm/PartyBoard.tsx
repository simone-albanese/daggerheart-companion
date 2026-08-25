/**
 * The party board.
 *
 * The question this answers is always the same one, and it is always asked in
 * the middle of something: the dice are on the table, the attack landed, and
 * the GM needs one number. So Evasion and the two thresholds are the largest
 * thing on a row and sit at its left edge, where the eye starts. The name is
 * how you find the row; the numbers are why you looked.
 *
 * Everything here is a *sighting*. A sheet arrives once, by file or by code,
 * and nothing after that moment can reach the player's device - there is no
 * sync and there will not be one. So the board dates every row, and the tracks
 * a GM ticks themselves say so in as many words. The one thing this screen must
 * never do is print a number in a way that implies it came from the phone in
 * the player's hand.
 *
 * And a row is not a reading of a character - it is the character, whole, on
 * somebody else's device. That is the one fact on this screen which is not
 * about numbers, so it is said at the head of the board rather than left to be
 * inferred from the drawer, and it is said in the same words at every width.
 *
 * The camera is a `lazy()` chunk. See `PartyScanner.tsx` for the measurement.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import type { Character } from '../../../shared/types.ts';
import { deriveStats, type DerivedStats } from '../../engine/character.ts';
import { companionDamage, companionIsAway } from '../../engine/companion.ts';
import { useApp } from '../../store/state.ts';
import { parseTransferFile, pickFile } from '../../transfer/fileIo.ts';
import { Track } from '../shared/Track.tsx';
import { useGm, type PartyImportSummary } from './gmStore.ts';
import { signed } from './StatBlock.tsx';
import { describeAge, findGaps, type PartyMember } from './party.ts';

/*
 * The QR decoder is 71.5 KB gzip and it is behind a tap.
 *
 * This module used to `import { createQrScanner } from '../../transfer/qr.ts'`
 * outright, which made the whole decoder a static dependency of the GM chunk:
 * every GM who opened the screen downloaded jsQR whether or not they ever
 * scanned anything. The built bundle happened to give `qr` a chunk of its own
 * anyway - it is shared with Settings - but a chunk boundary the source does
 * not declare is the bundler's opinion, not a property, and nobody reading
 * `PartyBoard.tsx` could tell which they were looking at.
 *
 * `tests/harness/staticImports.test.ts` derives the GM screen's static import
 * graph and fails if `transfer/qr.ts` is back inside it.
 */
const Scanner = lazy(async () => ({
  default: (await import('./PartyScanner.tsx')).PartyScanner,
}));

type Message = { tone: 'ok' | 'warn'; text: string } | null;

export function PartyBoard({ phone }: { phone: boolean }): React.JSX.Element {
  const party = useGm((s) => s.party);
  const importParty = useGm((s) => s.importParty);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  // Every row's caption is an age, and an age that never moves is a stopped
  // clock. A minute is finer than any of the labels this feeds.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const handle = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(handle);
  }, []);

  const land = (sheets: Character[], source: 'file' | 'code', warnings: string[]): void => {
    if (sheets.length === 0) {
      setMessage({ tone: 'warn', text: 'That held no characters, so nothing changed.' });
      return;
    }
    const text = [describeImport(importParty(sheets, source)), ...warnings].join(' ');
    setMessage({ tone: warnings.length > 0 ? 'warn' : 'ok', text });
  };

  const openFile = (): void => {
    void (async () => {
      try {
        const picked = await pickFile();
        if (picked === null) return;
        // parseTransferFile, not parseCharacterFile: a GM handed a whole-library
        // backup should get the whole table, not an error about the wrong noun.
        const file = parseTransferFile(picked.text);
        land(file.characters, 'file', file.warnings);
      } catch (cause) {
        setMessage({ tone: 'warn', text: cause instanceof Error ? cause.message : String(cause) });
      }
    })();
  };

  const pad = phone ? '10px 12px 0' : '14px 20px 0';

  return (
    // Capped, unlike the card grids in the other regions. A row is read left to
    // right in one sweep, and on a 27-inch screen an uncapped row puts Evasion
    // and the HP tally two feet apart.
    <div
      className="stack"
      style={{ flex: 1, minHeight: 0, gap: 10, padding: pad, width: '100%', maxWidth: 1120 }}
    >
      <div className="spread" style={{ flex: 'none' }}>
        <span className="t-label">
          {phone
            ? `Party · ${party.length}`
            : `Party — ${party.length} character${party.length === 1 ? '' : 's'}`}
        </span>
        {/* An empty board states its own two offers at reading size; repeating
            them up here would be the same choice twice on one small screen. */}
        {(party.length > 0 || scanning) && (
          <span className="row" style={{ gap: 8, flex: 'none' }}>
            <button
              type="button"
              className="btn"
              onClick={openFile}
              style={{ minHeight: 'var(--control)', padding: '0 12px' }}
            >
              IMPORT A FILE
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={scanning}
              onClick={() => {
                setScanning((s) => !s);
                setMessage(null);
              }}
              style={{ minHeight: 'var(--control)', padding: '0 12px' }}
            >
              {scanning ? 'CLOSE CAMERA' : 'SCAN A CODE'}
            </button>
          </span>
        )}
      </div>

      {scanning && (
        // A sentence rather than a spinner, for the reason `Onboarding.tsx`
        // gives at its own boundary: what is loading is a camera, and a
        // rotating disc under CLOSE CAMERA reads as the camera failing.
        <Suspense
          fallback={
            <p className="t-dense" style={{ flex: 'none', margin: 0 }}>
              Opening the camera…
            </p>
          }
        >
          <Scanner
            onArrived={(sheet, warnings) => {
              land([sheet], 'code', warnings);
              setScanning(false);
            }}
          />
        </Suspense>
      )}

      {message !== null && (
        <div
          className="row"
          style={{
            flex: 'none',
            gap: 8,
            padding: '4px 4px 4px 11px',
            borderRadius: 'var(--r3)',
            background: 'var(--panel)',
            borderLeft: `3px solid ${message.tone === 'warn' ? 'var(--stress)' : 'var(--ok)'}`,
          }}
        >
          <p
            role="status"
            className="t-dense"
            style={{ flex: 1, minWidth: 0, margin: 0, color: 'var(--text-2)' }}
          >
            {message.text}
          </p>
          <button
            type="button"
            aria-label="Dismiss this message"
            onClick={() => setMessage(null)}
            className="t-meta"
            style={{
              flex: 'none',
              minWidth: 'var(--control)',
              minHeight: 'var(--control)',
              color: 'var(--dim)',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {party.length === 0 ? (
        <Empty onFile={openFile} onScan={() => setScanning(true)} />
      ) : (
        <>
          {/*
           * What the board is holding, said once, at the top, in the same
           * words at every width.
           *
           * These rows are not a summary of somebody's character. They are the
           * character - name, Experiences, gold, notes, scars - copied whole
           * onto this device because a player handed it over once, and nothing
           * in this app can ever take it back off again. The only person who
           * can is the one reading this, and REMOVE FROM THE BOARD in the row's
           * own drawer is where they do it. So the sentence names the control
           * rather than gesturing at "settings somewhere" - which exists, at
           * "Erase everything" in Settings, and takes every campaign with it.
           * That is why the sentence names this control instead of denying the
           * other one: a GM who wants one sheet gone should not be sent to a
           * button that empties the device.
           *
           * It used to read "NOTHING HERE SYNCS · EVERY NUMBER IS AS IMPORTED"
           * on a phone, and the drawer below it disproves the second half: mark
           * one Stress and `markedAt` is stamped, the row restamps itself YOUR
           * COUNT, and the line above is still telling the GM that every number
           * came off the file. Per row is where that fact is true and per row
           * is where it is already said, twice - in `stamp` and in the drawer's
           * "The four tracks below are yours to keep" - so the board-wide claim
           * is not reworded, it is gone.
           *
           * The two widths used to disagree about the whole subject: the phone
           * talked about imports, the desktop about Evasion, and neither said
           * whose sheets these are. One sentence now, at both widths.
           *
           * It costs a phone a second line. 107 characters of 10px mono with
           * 0.07em tracking is wider than the 367.00px a 393px phone leaves
           * inside this padding - "369" stood here, which is 393 - 24 with the
           * sheet's own border spent nowhere: this board draws inside
           * `GmSheet size="full"` - `Gm.tsx` mounts it there and `GmSheet`'s
           * own docblock names it in the `full` list - whose panel is border-box
           * with a 1px border (`GmSheet.tsx`), so the content box is 391.00
           * and this region's 12px either side leaves 367.00, measured in Chrome
           * in the sibling tool that shares the sheet at the same padding
           * (`Reference.tsx`). Two pixels narrower only makes the wrap surer, so
           * the conclusion below is unchanged. `line-height: 1` would set the
           * two lines solid, so the strip declares 1.45 and is about 29px on a phone instead of
           * 10. That is the price of not having a phone and a laptop describe
           * the same board differently, and it is paid out of the list rather
           * than out of a row.
           */}
          <span
            className="t-meta"
            style={{
              flex: 'none',
              color: 'var(--dim)',
              letterSpacing: '0.07em',
              lineHeight: 1.45,
              marginTop: -2,
            }}
          >
            WHOLE COPIES OF OTHER PEOPLE’S SHEETS · NOTHING HERE SYNCS · THEY STAY ON THIS DEVICE
            UNTIL YOU REMOVE THEM
          </span>
          {/* The rules gloss keeps its own line, and keeps being desktop-only:
              on a phone it is the least of the four bands a row already costs.
              It is a fact about the number, not about the board, and running
              the two together in one strip is what let the board-wide sentence
              be missing for as long as it was. */}
          {!phone && (
            <span
              className="t-meta"
              style={{ flex: 'none', color: 'var(--dim)', letterSpacing: '0.07em' }}
            >
              EVASION IS THE DIFFICULTY OF ANY ROLL AGAINST THAT PC
            </span>
          )}
          <div
            className="scroll"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingBottom: 14,
            }}
          >
            {party.map((member) => (
              <Row key={member.id} member={member} phone={phone} now={now} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** "Kaelith and Brann are on the board." - and the truth about the second one. */
function describeImport(summary: PartyImportSummary): string {
  const list = (names: string[]): string =>
    names.length <= 1
      ? (names[0] ?? '')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;

  const lines: string[] = [];
  if (summary.added.length > 0) {
    lines.push(`${list(summary.added)} ${summary.added.length === 1 ? 'is' : 'are'} on the board.`);
  }
  if (summary.updated.length > 0) {
    lines.push(
      `${list(summary.updated)} ${summary.updated.length === 1 ? 'was' : 'were'} already here, so that row now shows the sheet that just arrived — HP, Stress, Hope and Armor included.`,
    );
  }
  return lines.join(' ');
}

function Empty({ onFile, onScan }: { onFile: () => void; onScan: () => void }): React.JSX.Element {
  return (
    <div
      className="panel stack"
      style={{ flex: 'none', padding: 18, gap: 12, alignItems: 'flex-start' }}
    >
      <div className="t-vital">Nobody on the board</div>
      <p className="t-body" style={{ margin: 0, maxWidth: 520 }}>
        Ask each player once — at session zero is the usual moment — for their character file, or
        have them show you the animated code from their Transfer screen. Their Evasion, damage
        thresholds, Experiences and Proficiency then sit here all campaign, in one place you can
        read across the table.
      </p>
      <p className="t-body" style={{ margin: 0, maxWidth: 520, color: 'var(--muted)' }}>
        Nothing syncs afterwards, and nothing ever will: this app has no network. What the board
        shows is what arrived, dated, plus whatever you mark on it yourself. Ask for the file again
        whenever the numbers matter.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={onFile}>
          Import a file
        </button>
        <button type="button" className="btn" onClick={onScan}>
          Scan a code
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One character
// ---------------------------------------------------------------------------

function Row({
  member,
  phone,
  now,
}: {
  member: PartyMember;
  phone: boolean;
  now: Date;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const [open, setOpen] = useState(false);

  const sheet = member.sheet;
  // Every number below is the engine's. A board that did its own arithmetic
  // would be a second opinion about the rules, which is exactly what a GM
  // reading a threshold out loud cannot afford.
  const stats = deriveStats(sheet, dataset, index);
  const gaps = findGaps(sheet, index);
  const klass = [sheet.classRef, sheet.multiclassRef]
    .map((r) => (r === null || r === '' ? undefined : index.classes.get(r)?.name))
    .filter(Boolean)
    .join(' / ');

  // The whole honesty of this screen is in one caption: these numbers are
  // either the ones that arrived, dated, or they are the GM's own.
  const stamp = (
    member.markedAt === null
      ? `AS IMPORTED · ${describeAge(member.importedAt, now)}`
      : `YOUR COUNT · ${phone ? '' : 'MARKED '}${describeAge(member.markedAt, now)}`
  ).toUpperCase();

  // Spans, not divs: the whole header is one button, and a button may only
  // hold phrasing content.
  const numbers = (
    <span
      className="row"
      style={{
        flex: 'none',
        gap: 1,
        borderRadius: 'var(--r3)',
        overflow: 'hidden',
        background: 'var(--line-soft)',
        border: '1px solid var(--line-soft)',
      }}
    >
      <Figure label="EVASION" value={stats.evasion} size={phone ? 30 : 32} warn={gaps.evasion} />
      <Figure label="MAJOR" value={stats.thresholds[0]} size={phone ? 26 : 28} warn={gaps.thresholds} />
      <Figure label="SEVERE" value={stats.thresholds[1]} size={phone ? 26 : 28} warn={gaps.thresholds} />
    </span>
  );

  const identity = (
    <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4, textAlign: 'left' }}>
      <span
        style={{
          font: '700 17px/1.1 var(--sans)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {sheet.name || 'Unnamed'}
      </span>
      <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
        {(klass === '' ? 'NO CLASS' : klass.toUpperCase())} · LV{sheet.level} · PROF{' '}
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{stats.proficiency}</span>
      </span>
      <Experiences sheet={sheet} />
      <CompanionLine sheet={sheet} proficiency={stats.proficiency} />
    </span>
  );

  const pills = (
    <span className="row" style={{ gap: 10, flex: 'none' }}>
      <Pill label="HP" tone="var(--damage)" value={member.tracks.hp} max={stats.maxHp} />
      <Pill label="STRESS" tone="var(--stress)" value={member.tracks.stress} max={stats.maxStress} />
      <Pill label="HOPE" tone="var(--hope)" value={member.tracks.hope} max={stats.maxHope} />
      <Pill label="ARMOR" tone="var(--armor)" value={member.tracks.armor} max={stats.armorScore} />
    </span>
  );
  const dateline = (
    <span className="t-meta" style={{ color: 'var(--dim)', letterSpacing: '0.07em' }}>
      {stamp}
    </span>
  );
  // On a phone the caption rides beside the pills rather than under them: the
  // row is already four stacked bands tall and this is the cheapest of them.
  const vitals = phone ? (
    <span className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
      {dateline}
      {pills}
    </span>
  ) : (
    <span className="stack" style={{ flex: 'none', gap: 5, alignItems: 'flex-end' }}>
      {pills}
      {dateline}
    </span>
  );

  return (
    <article
      className="panel stack"
      style={{ flex: 'none', borderLeft: `3px solid ${open ? 'var(--hope)' : 'transparent'}` }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={phone ? 'stack' : 'row'}
        style={{
          gap: phone ? 9 : 14,
          padding: phone ? '10px 11px' : '10px 12px',
          alignItems: phone ? 'stretch' : 'center',
        }}
      >
        {phone ? (
          <>
            {identity}
            {numbers}
            {vitals}
          </>
        ) : (
          <>
            {numbers}
            {identity}
            {vitals}
            <span
              aria-hidden="true"
              className="t-meta"
              style={{ flex: 'none', width: 14, color: 'var(--dim)' }}
            >
              {open ? '▲' : '▼'}
            </span>
          </>
        )}
      </button>

      {open && <Drawer member={member} stats={stats} gaps={gaps} now={now} phone={phone} />}
    </article>
  );
}

/** One of the three numbers the row exists for. */
/**
 * The second creature, which this board could not see.
 *
 * A Beastbound Ranger is two things to target and the board drew one of them.
 * The data was already here - `party.ts` keeps the sheet whole, so
 * `sheet.companion` arrived with everything else and was simply never drawn -
 * which is why this is a few lines rather than a transfer change.
 *
 * READ-ONLY, and that is the board's own rule rather than a shortcut. A PC here
 * is a sighting: every number is derived from the sheet as it arrived and dated
 * by when it did. The four tracks above are editable because a GM marks damage
 * they are dealing; a companion's Stress is marked by the player operating the
 * companion, and a second set of numbers the GM could edit would be a second
 * answer to what the animal has taken.
 *
 * Evasion leads because it is what the GM needs: it is the number an attack is
 * rolled against, and it is not the Ranger's.
 *
 * NOTHING HERE SHOULD HAVE ASSUMED A FIELD WAS PRESENT, AND THAT WAS NOT
 * DEFENSIVENESS - IT WAS WHERE THESE SHEETS CAME FROM. A campaign record holds
 * whole copies of the players' sheets, and `readPartyMember` in
 * `shared/campaigns.ts` used to cast the stored object straight to `Character`.
 * So a board saved before a schema bump handed this component a sheet from the
 * *previous* schema, with whatever that schema did not have missing.
 * `damageType` arrived in schema 5 and `companion.damageType.toUpperCase()`
 * threw on every such row - taking the whole board down on first render, which
 * is the one failure `readPartyMember`'s own docblock exists to prevent.
 *
 * AND THIS FUNCTION DOES NOT YET OBEY IT. The paragraph above used to end "so
 * this reads by comparison and never by method call, the way `CompanionPanel`
 * already does", and both halves of that sentence were false when they were
 * written. Measured by rendering a row with each field deleted in turn:
 *
 *   - `companion.name.toUpperCase()` throws on a missing name, and the `=== ''`
 *     beside it covers neither an absent one nor a numeric one;
 *   - `companion.stress.marked` / `.max` throw on a missing track;
 *   - `companionDamage` hands `companion.damage` to `parseDamage`, which is
 *     total for a junk string - `parseDamage('nonsense')` is null and the board
 *     prints NO DIE - and fatal for an absent one, because its only guard is
 *     one line too late;
 *   - `CompanionPanel` calls `.toUpperCase()` on the name, the description and
 *     the range, so it is not the example to follow.
 *
 * Two lines here are genuinely total and are not on that list: `:545` wraps the
 * range in `String()`, and the `damageType` comparison is the schema-5 fix.
 * `String()` is not free either - it turns a crash into the literal word
 * UNDEFINED printed to a GM - but a board you can read and disbelieve beats a
 * board that is gone.
 *
 * AND THE DECISION THAT WAS SCHEDULED HAS BEEN MADE: `readPartyMember`
 * QUARANTINES. Its `boardShortfall` checks every field any `src/ui/gm/`
 * consumer reads - the union of what `deriveStats`, `collectModifiers` and
 * `findGaps` name, plus what this file reads itself, `companion` included, whole
 * animal or none - and a sheet missing one of them loses its row and says so in
 * a sentence naming the character. So the shapes this docblock catalogues can
 * no longer arrive from a stored campaign.
 *
 * WHICH IS WHY THE METHOD CALLS BELOW STAY, AND ARE NOT WRAPPED A SECOND TIME.
 * Two guards over one shape are two opinions about it, and they drift; the one
 * that would drift is this one, because it is the one with no test naming the
 * fields. Worse, a guard here can only degrade a value - `String()` on the range
 * a few lines down turns a crash into the literal word UNDEFINED printed to a
 * GM - while the reader's refusal produces the only outcome that helps: the row
 * is gone, and the GM is told which player to ask for a file. A board with a
 * silently wrong row on it is not the safer half of that trade.
 *
 * The price is stated where it is paid. `tests/gm/partyBoard.test.tsx` mounts
 * this component on nothing but what the reader will emit, deleting each
 * checked field in turn, and that is what makes "unreachable" a measurement
 * rather than a wish. `importParty` is a different door - a GM taking a file
 * from a player goes through `readCharacterRecord`, whose `checkShapes` refuses
 * half an animal - and the total reads that are already here are what carries a
 * sheet that got in before either door existed.
 *
 * THAT SENTENCE WAS TAKEN ON TRUST AND WAS HALF FALSE, WHICH IS WHY IT NOW
 * NAMES WHAT THE CHECK COVERS. `checkShapes` does refuse half an animal. It
 * asked a `levelUpHistory` entry for a `level` and a `kind` and never for a
 * `detail`, so a file holding an advancement without one came through this door
 * in silence and took the board down in `collectModifiers` - the same crash a
 * stored campaign caused, arriving by the route this docblock offered as the
 * reason not to worry about it. `readCharacterRecord` now fills that `detail`
 * and says it did, and `tests/transfer/fileIo.test.ts` holds both halves.
 *
 * The reader's own guard is measured the same way now: `boardShortfall` checks
 * a list element as deep as some consumer here dereferences it, and
 * `tests/store/campaignPartySheet.test.ts` writes the fatal shapes out by hand
 * and proves each one fatal against the consumer that dies on it.
 */
function CompanionLine({
  sheet,
  proficiency,
}: {
  sheet: Character;
  proficiency: number;
}): React.JSX.Element | null {
  const companion = sheet.companion;
  if (companion === null) return null;
  const attack = companionDamage(companion, proficiency);
  const away = companionIsAway(companion);
  return (
    <span
      className="t-meta"
      style={{
        letterSpacing: '0.07em',
        color: away ? 'var(--stress)' : 'var(--muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {(companion.name === '' ? 'COMPANION' : companion.name.toUpperCase())} · EVASION{' '}
      <span style={{ color: away ? 'var(--stress)' : 'var(--text-2)', fontWeight: 600 }}>
        {companion.evasion}
      </span>{' '}
      · {attack === null ? 'NO DIE' : attack.spec} {String(companion.range).toUpperCase()}{' '}
      {companion.damageType === 'mag' ? 'MAG' : 'PHY'} · STRESS {companion.stress.marked}/
      {companion.stress.max}
      {away && ' · OUT OF THE SCENE'}
    </span>
  );
}

function Figure({
  label,
  value,
  size,
  warn,
}: {
  label: string;
  value: number;
  size: number;
  warn: boolean;
}): React.JSX.Element {
  return (
    <span
      className="stack"
      style={{ flex: 1, gap: 4, padding: '7px 11px 8px', background: 'var(--app)' }}
    >
      <span className="t-meta" style={{ letterSpacing: '0.1em', color: warn ? 'var(--stress)' : undefined }}>
        {label}
      </span>
      <span
        style={{
          font: `800 ${size}px/1 var(--sans)`,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: warn ? 'var(--stress)' : 'var(--text)',
        }}
      >
        {value}
        {/* Never a bare number this screen cannot stand behind. */}
        {warn && <span style={{ font: '700 15px/1 var(--sans)' }}>?</span>}
      </span>
    </span>
  );
}

/** The tracks as the GM last left them. The label carries the meaning, not the hue. */
function Pill({
  label,
  tone,
  value,
  max,
}: {
  label: string;
  tone: string;
  value: number;
  max: number;
}): React.JSX.Element {
  const shown = Math.min(value, max);
  return (
    <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
      <span className="t-meta" style={{ color: tone, letterSpacing: '0.1em' }}>
        {label}
      </span>
      <span
        style={{
          font: '700 16px/1 var(--mono)',
          fontVariantNumeric: 'tabular-nums',
          color: shown >= max && max > 0 ? tone : 'var(--text-2)',
        }}
      >
        {shown}/{max}
      </span>
    </span>
  );
}

function Experiences({ sheet }: { sheet: Character }): React.JSX.Element {
  if (sheet.experiences.length === 0) {
    return (
      <span className="t-meta" style={{ color: 'var(--dim)' }}>
        NO EXPERIENCES ON THIS SHEET
      </span>
    );
  }
  return (
    <span className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
      {sheet.experiences.map((e) => (
        <span key={e.id} className="chip" style={{ color: 'var(--text-3)', fontSize: 10.5 }}>
          {e.name || 'Unnamed'} <span style={{ color: 'var(--hope)' }}>{signed(e.bonus)}</span>
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The drawer: where the GM keeps their own tally
// ---------------------------------------------------------------------------

function Drawer({
  member,
  stats,
  gaps,
  now,
  phone,
}: {
  member: PartyMember;
  stats: DerivedStats;
  gaps: ReturnType<typeof findGaps>;
  now: Date;
  phone: boolean;
}): React.JSX.Element {
  const mark = useGm((s) => s.markPartyTracks);
  const reset = useGm((s) => s.resetPartyTracks);
  const remove = useGm((s) => s.removePartyMember);
  const index = useApp((s) => s.index);
  const sheet = member.sheet;
  const clamp = (n: number, max: number): number => Math.min(n, max);

  const lineage = [
    ...sheet.subclassRefs.map((r) => index.subclasses.get(r)?.name),
    ...sheet.ancestryRefs.map((r) => (index.byRef.get(r) as { name?: string } | undefined)?.name),
    (index.byRef.get(sheet.communityRef ?? '') as { name?: string } | undefined)?.name,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="stack"
      style={{
        gap: 11,
        padding: phone ? '11px 11px 12px' : '11px 12px 13px',
        borderTop: '1px solid var(--line-soft)',
      }}
    >
      <p className="t-dense" style={{ margin: 0, maxWidth: '68ch' }}>
        Imported from {member.source === 'file' ? 'a file' : 'a code'}{' '}
        {describeAge(member.importedAt, now)}
        {lineage === '' ? '.' : ` · ${lineage}.`} Nothing has arrived since. The four tracks below
        are yours to keep — marking them changes this board and nothing else.
      </p>

      {(gaps.evasion || gaps.thresholds) && (
        <p
          className="t-dense"
          style={{ margin: 0, color: 'var(--stress)', maxWidth: '68ch' }}
        >
          {gaps.evasion &&
            'This sheet names a class this dataset does not have, so its Evasion and HP maximum are the fallbacks. '}
          {gaps.thresholds &&
            'This sheet names armor this dataset does not have, so its thresholds and Armor Slots are the unarmored ones. '}
          Ask the player for the numbers.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: phone ? '1fr' : '1fr 1fr',
          gap: phone ? 10 : 14,
          // A pip a hundred pixels wide is not easier to hit, just stranger.
          maxWidth: 760,
        }}
      >
        <Track
          kind="hp"
          label="HP"
          value={clamp(member.tracks.hp, stats.maxHp)}
          max={stats.maxHp}
          onChange={(v) => mark(member.id, { hp: v })}
          readout={`${clamp(member.tracks.hp, stats.maxHp)} / ${stats.maxHp} MARKED`}
          compact={!phone}
        />
        <Track
          kind="stress"
          label="STRESS"
          value={clamp(member.tracks.stress, stats.maxStress)}
          max={stats.maxStress}
          onChange={(v) => mark(member.id, { stress: v })}
          readout={`${clamp(member.tracks.stress, stats.maxStress)} / ${stats.maxStress} MARKED`}
          compact={!phone}
        />
        <Track
          kind="hope"
          label="HOPE"
          labelColor="var(--hope)"
          value={clamp(member.tracks.hope, stats.maxHope)}
          max={stats.maxHope}
          clearTo={stats.maxHope}
          onChange={(v) => mark(member.id, { hope: v })}
          readout={`${clamp(member.tracks.hope, stats.maxHope)} / ${stats.maxHope} AVAILABLE`}
          compact={!phone}
        />
        <Track
          kind="armor"
          label="ARMOR"
          value={clamp(member.tracks.armor, stats.armorScore)}
          max={stats.armorScore}
          onChange={(v) => mark(member.id, { armor: v })}
          readout={`${clamp(member.tracks.armor, stats.armorScore)} / ${stats.armorScore} USED`}
          compact={!phone}
        />
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          disabled={member.markedAt === null}
          onClick={() => reset(member.id)}
          style={{ minHeight: 'var(--control)', padding: '0 12px' }}
        >
          BACK TO WHAT ARRIVED
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => remove(member.id)}
          style={{ minHeight: 'var(--control)', padding: '0 12px', color: 'var(--muted)' }}
        >
          REMOVE FROM THE BOARD
        </button>
      </div>
    </div>
  );
}
