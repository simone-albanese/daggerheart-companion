/**
 * The part of the app that has to be true.
 *
 * The attribution is verbatim and always visible - not behind a disclosure, not
 * summarised. The boundary underneath it is the other half of the same honesty:
 * this app does arithmetic and shows text, and every table that has ever been
 * disappointed by a digital character sheet was disappointed because nobody
 * said which one it was.
 */
import { useEffect, useState } from 'react';
import { APP_VERSION, BUILD_ID, shortBuildId } from '../../buildInfo.ts';
import { forgetBackupFolder } from '../../store/backup.ts';
import { appBackupDeps } from '../../store/backupDeps.ts';
import { countCampaigns } from '../../store/campaigns.ts';
import { hasUncountedLegacyCampaign } from '../../store/campaignMigration.ts';
import { clearAll, type StorageHealth } from '../../store/db.ts';
import { DEFAULT_PREFS, savePrefs } from '../../store/prefs.ts';
import { useApp } from '../../store/state.ts';
import { ATTRIBUTION } from '../shared/CompatibleMark.tsx';
import { Field, Note, Rows, Section } from './parts.tsx';

/**
 * Sizes a person can read.
 *
 * Rounded whole megabytes call a 400 KB store "0 MB", which is the one thing
 * this must not print on a screen whose job is to tell someone how much of
 * their device their characters are using.
 *
 * It lived in `settings/binaryFiles.ts` until the Core Rulebook importer was
 * removed. That file's other two functions - a picker that took a 319 MB PDF
 * without reading it, and a saver that handed back a 20 MB art pack - existed
 * for the importer alone and went with it. This is not about binary files at
 * all; it is about the storage estimate a few lines below, which is its only
 * caller, so it lives here now rather than in a module named for an argument
 * that no longer applies to it.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}
/*
 * The two licence texts, compiled into this chunk rather than fetched.
 *
 * `rg darringtonpress src/ public/ index.html` used to return nothing: a user
 * of an offline-first app could not read the terms the content they were
 * looking at was published under, and the deployed bundle carried no MIT notice
 * either. Both are here now, and `?raw` is what makes them survive a basement:
 * About lives behind the lazy Settings chunk, and the service worker precaches
 * every chunk the document reaches, so these bytes are in Cache Storage with
 * the rest of the app. A file dropped in `public/` would land in `dist/` and be
 * cached by nothing - the worker infers its precache from what the build emits,
 * and nothing emitted would name it.
 *
 * The MIT text is imported from the repository root rather than copied, so the
 * licence this project ships and the licence this project has are the same
 * bytes by construction.
 */
import MIT_LICENCE from '../../../LICENSE?raw';
import DPCGL from '../../legal/dpcgl-2026-08-26.txt?raw';

const DOES = [
  'Damage thresholds, and how many HP an incoming hit marks',
  'Proficiency, damage dice and the effect of an armor slot',
  'Duality Roll outcomes: Hope, Fear, criticals',
  'Loadout limits and what a recall costs in Stress',
  'Gold conversion, level-up eligibility, GM battle points',
];

const DOES_NOT = [
  'Execute a class, ancestry or domain card feature',
  'Decide when a countdown advances',
  'Track conditions, or apply them for you',
  'Enforce a house rule, or argue with one',
];

export function About({
  innerRef,
}: {
  innerRef?: (el: HTMLElement | null) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const characters = useApp((s) => s.characters);
  const quarantined = useApp((s) => s.quarantined);
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [campaignCount, setCampaignCount] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  /*
   * The character records the reset destroys, which is more than the library.
   *
   * `characters` is the readable half; `quarantined` is the records a newer
   * build wrote that this one refuses to render (state.ts, db.ts::readLibrary),
   * and `clearAll` deletes those too. The "On this device" hint above counts
   * only `characters` on purpose - it is describing the library a person can
   * open - but a destruction confirmation counts what goes, not what shows.
   */
  const characterCount = characters.length + quarantined.length;

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((est) =>
        setHealth({ persisted: false, usage: est.usage ?? null, quota: est.quota ?? null }),
      )
      .catch(() => setHealth(null));
  }, []);

  /*
   * Re-read the campaign count on arming, not once on mount.
   *
   * `clearAll` empties the `campaigns` store along with the other four, so the
   * confirmation has to say how many campaigns that is - and the number has to
   * be true at the moment it is read, which is when the panel opens rather than
   * when the screen mounted. There is no cross-tab invalidation anywhere in
   * this app: a second tab sitting on the GM screen can create or delete a
   * campaign with nothing here to hear about it, and a stale number on this
   * particular sentence is the exact failure this control exists not to have.
   *
   * One `count` request, on the connection `readLibrary` has already opened.
   * The count and not `readCampaigns` - see `countCampaigns`'s own docblock:
   * quarantined campaigns are held out of that array and deleted anyway.
   */
  useEffect(() => {
    let live = true;
    void countCampaigns().then(
      (n) => {
        // A campaign the store cannot see is still a campaign this button
        // destroys: `reset()` sweeps every `dhc.` key, and an install that has
        // not opened the GM screen since upgrading still holds its whole table
        // in `dhc.gm.v1`. Counting only the store would print "0 campaigns"
        // over a GM's fight, Fear pool, countdowns and copies of the other
        // players' sheets - which is the same invention as the zero the catch
        // below refuses, arriving by arithmetic instead of by error.
        if (live) setCampaignCount(hasUncountedLegacyCampaign() ? null : n);
      },
      () => {
        // Storage refused. The sentence below drops to naming the campaigns
        // without counting them, which is still true; inventing a zero here
        // would be the app claiming there is nothing to lose.
        if (live) setCampaignCount(null);
      },
    );
    // Not decoration: About unmounts on every tab change (App.tsx renders it
    // conditionally), and `confirming` can toggle twice before a read lands.
    return () => {
      live = false;
    };
  }, [confirming]);

  const counts: Array<[string, number]> = [
    ['Domain cards', dataset.domainCards.length],
    ['Adversaries', dataset.adversaries.length],
    ['Environments', dataset.environments.length],
    ['Classes', dataset.classes.length],
    ['Subclasses', dataset.subclasses.length],
    ['Ancestries', dataset.ancestries.length],
    ['Communities', dataset.communities.length],
    ['Weapons', dataset.weapons.length],
    ['Armors', dataset.armors.length],
    ['Beastforms', dataset.beastforms.length],
  ];

  /**
   * Erase everything, and mean everything.
   *
   * `clearAll` empties IndexedDB and nothing else, so the seven localStorage
   * keys have to go by hand: `dhc.prefs.v1` (store/prefs.ts),
   * `dhc.conditions.v1` (ui/player/conditionsStore.ts), `dhc.dice.v1`
   * (ui/player/heldDice.ts), `dhc.backup.v1` (store/backup.ts),
   * `dhc.gm.countdownTemplates.v1` (ui/gm/countdownTemplates.ts), and
   * `dhc.gm.v1` with `dhc.gm.v1.unreadable` (store/campaignMigration.ts).
   *
   * Swept by prefix rather than by that list, and the list is here to be read
   * rather than to be iterated: a list written out in code is how the *next*
   * key survives the button that promises to remove everything - the same
   * argument `db.ts::clearAll` makes for iterating `STORES`. That stopped being
   * hypothetical the day the countdown template shelf arrived. This paragraph
   * said "six" and "the seventh key" until then; the seventh key exists now,
   * this handler has never been told about it, and the only thing that had to
   * change was the sentence.
   *
   * Proved rather than reasoned: `tests/ui/eraseConfirmation.test.tsx` runs
   * this handler against the real `localStorage` with the new key on it, and
   * checks that the key is gone and that a key belonging to nobody here is
   * not - the sweep is a prefix, not a `clear()`.
   *
   * `dhc.backup.v1` is the one that matters: it holds the ids the last session
   * saw, and left behind it makes the next startup's integrity check announce
   * that the characters the user just deleted have been evicted by the browser
   * - a false alarm about the one failure this app exists to prevent.
   * `dhc.gm.v1` would likewise leave a stale encounter standing in a library
   * that no longer has anyone in it.
   */
  const reset = (): void => {
    setStatus(null);
    void clearAll()
      .then(() => forgetBackupFolder(appBackupDeps))
      .then(() => {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('dhc.')) localStorage.removeItem(key);
        }
        savePrefs(DEFAULT_PREFS);
        location.reload();
      })
      .catch((cause: unknown) => {
        // A refused wipe that says nothing is the worst outcome here: the user
        // walks away believing the device is clean.
        setStatus(
          `Nothing was erased: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      });
  };

  return (
    <Section id="about" title="About" innerRef={innerRef}>
      <div
        className="panel"
        style={{ padding: 14, borderLeft: '3px solid var(--hope)' }}
      >
        <p className="t-hint" style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {/*
            One paragraph, from the one array. This used to be a second literal
            declared in this file, and About.tsx is on the P4 work list - so the
            next refactor of this screen could have dropped the notice with CI
            green and nothing but a diff to notice it.
          */}
          {ATTRIBUTION.join(' ')}
        </p>
      </div>

      <Rows>
        {/*
          The line a bug report is copied out of.

          A user on a stale cached build could not say which one and we could
          not ask - and this app installs a service worker, holds a bundle in
          Cache Storage until an update is accepted, and can sit on a home
          screen for months without touching the network, so "which build" is
          not a rhetorical question here. Version, commit and SRD revision on
          one line, because someone reading it out over a table will read one
          line and not three.

          Selectable rather than a copy button: this is `<code>` in a settings
          screen, a long-press selects it on a phone, and a control whose whole
          job is `navigator.clipboard` is a control that fails silently on the
          browsers that do not have it.
        */}
        <Field
          label="This build"
          hint="Quote this if something is wrong. The commit is the one thing that says exactly which bytes you are looking at — the app can keep serving an old bundle from its cache long after a new one has been published."
          footer={
            <code
              className="t-hint"
              title={`build ${BUILD_ID}`}
              style={{
                display: 'block',
                fontFamily: 'var(--mono)',
                color: 'var(--text-2)',
                overflowWrap: 'anywhere',
                userSelect: 'text',
              }}
            >
              v{APP_VERSION} · build {shortBuildId()} · SRD {dataset.revision} · schema{' '}
              {dataset.schemaVersion}
            </code>
          }
        />

        <Field
          label="What this app does"
          hint={`Unambiguous arithmetic, and the text of everything else. That is the whole boundary, and it is deliberate: modelling ${dataset.domainCards.length} cards with their exceptions is a bigger project than the rest of the app combined, and every table with a variant would end up fighting it.`}
          footer={
            <div
              style={{
                display: 'grid',
                gap: 14,
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              }}
            >
              <Boundary title="It calculates" items={DOES} tint="var(--ok)" />
              <Boundary title="It does not" items={DOES_NOT} tint="var(--dim)" />
            </div>
          }
        />

        <Field
          label="The book"
          hint="The SRD is the whole rules engine and it is free, which is why this app ships with it and needs nothing else. If you want the setting, the adventures and the art, the Core Rulebook is worth buying — but nothing here is waiting behind it."
        >
          <a
            className="btn"
            href="https://daggerheart.com/buy"
            target="_blank"
            rel="noreferrer noopener"
            style={{ textDecoration: 'none', color: 'var(--text)' }}
          >
            daggerheart.com
          </a>
        </Field>

        <Field
          label="Dataset"
          hint={`${dataset.revision} · built ${dataset.generatedAt.slice(0, 10)} · schema ${dataset.schemaVersion}`}
          footer={
            <div
              style={{
                display: 'grid',
                gap: '12px 16px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
              }}
            >
              {counts.map(([label, n]) => (
                <div key={label}>
                  <div
                    style={{
                      font: '800 20px/1 var(--sans)',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {n}
                  </div>
                  <div className="t-label" style={{ marginTop: 5 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          }
        />

        {/*
          The terms, in full, on the device.

          Both texts were reachable only as a URL before this - and this is an
          app whose entire premise is working with the radio off, so "the
          licence is a link away" meant "not while you are using it". The MIT
          notice was not in the deployed bundle at all.

          Ergonomics. Behind a toggle rather than open: this is 27 KB of legal
          text in the middle of a settings screen, and a panel that pushes
          everything below it three thousand pixels down is a panel that hides
          the reset control the same screen carries. The *notice* is not behind
          a disclosure - it is at the top of this screen and in the shell's
          footer, unconditionally - and only the licence text is. The buttons
          are `.btn`, 44px by `--tap` and 12px apart. The text itself is
          `white-space: pre` in its own scroller because the extraction
          preserves the PDF's indentation, and re-wrapping a licence to fit a
          phone would silently change what the columns in Section 4 mean; a
          horizontal scrollbar is the honest cost of that.
        */}
        <Field
          label="The licences, in full"
          hint={LICENCE_PROVENANCE}
          footer={<LicenceTexts />}
        />

        <Field
          label="On this device"
          hint={
            <>
              {characters.length} character{characters.length === 1 ? '' : 's'}
              {health?.usage != null && ` · ${formatBytes(health.usage)} used`}
              {health?.quota != null && ` of about ${formatBytes(health.quota)} available`}. No
              account, no telemetry, no analytics, and nothing on this screen sends anything
              anywhere.
            </>
          }
        />
      </Rows>

      <Rows style={{ borderColor: 'var(--damage)' }}>
        {/*
          The list that is read first, and it was missing a store.

          This sentence is an enumeration, not a summary, and it named four of
          the five stores `clearAll` empties - characters, content, art and (as
          "every preference") the localStorage sweep - with no campaign in the
          list. It is also the string read *before* anything is armed, while the
          reset is still an idea, so a reader who stopped here was told the
          wrong thing about what they were about to lose.

          No number here. The hint enumerates categories and the confirmation
          below counts records; that division is already how the two sentences
          differ, and a count in both would mean two places to keep true.

          Ergonomics, measured in Chrome, and the surprise is which phone pays.
          The row is a flex line with a `flex: 1 1 180px` text block and the
          44px button:

          - 393x852: the button (130.8x44, `min-height: var(--tap)`) fits
            *beside* the hint, which leaves the hint a 194px column. 137 -> 152
            characters takes it from four lines to five, so the row goes 112.6
            -> 128.5px: **+15.87px, one `.t-hint` line at 11.5px/1.38**. The
            button keeps its 44px and moves 7.9px down inside its own row.
          - 375x667: the button has *already* wrapped below the hint - 130.8 +
            14 + 180 = 324.8 does not fit in a 321px row - so the hint has the
            full 321px and stays at three lines and 47.6px. Row 154.8px before
            and after: **+0**. The narrower phone is the one that pays nothing.
            (**321, not the 349 that stood here.** 349 is the `Rows` content box
            one container out - 375 less the 12px either side of the settings
            scroller's phone `padding: '12px 12px 28px'` in `Settings.tsx`,
            less the 1px either side of `Rows`' own
            `border: '1px solid var(--line-soft)'` - and this flex line lives
            one container in, inside the 14px either side of `Field`'s
            `padding: '13px 14px'`, so it is 321. The old premise reversed the
            conclusion beside it: 324.8 fits in 349 and does not fit in 321, and
            it is the wrap that was measured. Each term is named by the
            declaration that makes it rather than by a line in `parts.tsx`,
            which is a file this docblock cannot keep in step with;
            `gmGeometryProse.test.ts` holds the 321 against those declarations.)
          - 744x1133: 341px column, three lines, **+0**.

          The 15.87px is a scroll position on a 6188px scroll and not a reach:
          nothing here is pinned, no target shrank, and the only 44px control on
          the row is the one the sentence explains. Headroom before a sixth line
          on the 194px column: 28 characters.

          EVERY FIGURE ABOVE WAS MEASURED AGAINST THE LONGER SENTENCE, the one
          that also enumerated "every imported source, all art". Database
          version 3 deletes those three stores, so `clearAll` reaches two stores
          and naming five would be a promise about bytes that are not there. The
          sentence lost 32 characters - 152 to 120. Not 30: what came out is
          ", every imported source, all art", and the joining comma and space
          went with the phrase. It gained nothing, so every conclusion here is
          now an upper bound that still holds - fewer lines, never more, and a
          wrap that fitted cannot stop fitting. The figures are NOT
          re-derived, because none of them was re-measured: they are marked as
          belonging to the sentence they were taken from. Anyone who lengthens
          this hint again measures it again from scratch.
        */}
        <Field
          label="Reset everything"
          hint="Deletes every character, every campaign and every preference on this device. There is no undo and no copy anywhere else."
        >
          {!confirming && (
            <button
              type="button"
              className="btn"
              onClick={() => setConfirming(true)}
              style={{ borderColor: 'var(--damage)', color: 'var(--damage)' }}
            >
              Reset everything
            </button>
          )}
        </Field>

        {confirming && (
          <div style={{ background: 'var(--panel)', padding: 14 }}>
            {/*
              The sentence has to count the campaigns, because the button
              deletes them. `clearAll` clears all five stores, `campaigns`
              included; this Note counted one of them.

              Ergonomics, measured in Chrome and not predicted. The text column
              here is 313px at 393x852 and 295px at 375x667 - the viewport less
              24 (scroller padding, Settings.tsx `12px 12px 28px`), less 2 (Rows
              border), less 28 (this div's `padding: 14`), less 24 and 2 (Note's
              `10px 12px` and its 1px border). Type is `.t-hint` 11.5px with
              Note overriding line-height to 1.5, so 17.25px a line.

              The sentence goes 160 -> 173 characters and the Note stays three
              lines and 73.8px at both phone widths, two lines and 55px at
              744x1133: **this costs zero pixels**. Every rect below it is
              unmoved to the pixel - the ERASE input at 220x44, "Erase
              everything" at 139.9x44, "Keep my data" at 110.3x44, all three at
              the `var(--tap)` 44px floor with an 8px gap, and `LicenceFooter`
              still the last child of this screen's scroll. Read-vs-touch order
              is read, type, then touch, and the added clause is on the read
              side above all three targets, so no target moved and none left the
              thumb's arc.

              Headroom before a fourth line, because a later edit will not
              re-measure: 24 characters at 393 and **12 at 375**, which is the
              binding one. Past that the Note grows 17.25px and nothing shrinks
              to pay for it - it would push the three targets down a scroll the
              thumb is already positioning, which costs a scroll position rather
              than a reach, but it is no longer free.
            */}
            <Note tone="danger">
              This erases {characterCount} character{characterCount === 1 ? '' : 's'},{' '}
              {campaignCount === null
                ? 'every campaign on this device and everything else it holds'
                : `${String(campaignCount)} campaign${campaignCount === 1 ? '' : 's'} and everything else this device holds`}
              . Export a backup first if there is any doubt — that file is the only thing that can
              bring it back.
            </Note>
            <label className="stack" style={{ gap: 8, marginTop: 12 }}>
              <span className="t-label">Type ERASE to confirm</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Type ERASE to confirm"
                style={{ maxWidth: 220 }}
              />
            </label>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                disabled={typed.trim().toUpperCase() !== 'ERASE'}
                onClick={reset}
                style={{
                  borderColor: 'var(--damage)',
                  color: 'var(--damage)',
                  fontWeight: 800,
                }}
              >
                Erase everything
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setConfirming(false);
                  setTyped('');
                }}
              >
                Keep my data
              </button>
            </div>
            {status !== null && (
              <div style={{ marginTop: 12 }}>
                <Note tone="danger" role="alert">
                  {status}
                </Note>
              </div>
            )}
          </div>
        )}
      </Rows>
    </Section>
  );
}

/**
 * Where the DPCGL text in this bundle came from, said precisely enough to be
 * checkable.
 *
 * `LICENSE` used to cite the licence by bare URL with no version and no
 * retrieval date, which is not a citation of a document that its own Section 11
 * says DRP may amend at any time without notice. The licence is published as a
 * PDF; what is bundled here is its text, extracted mechanically, and saying so
 * is the difference between shipping a copy and claiming to be the authority.
 * The hash is of the PDF, so anyone can check that this text came from that
 * file. The same three facts are in `LICENSE`.
 */
const LICENCE_PROVENANCE =
  'The MIT licence covers this app’s code. The Darrington Press Community Gaming License ' +
  'covers the SRD content it ships. The DPCGL text below is extracted from the official PDF ' +
  '(DPCGL 2.0, published 26 August 2026, retrieved 1 September 2026 from ' +
  'darringtonpress.com/wp-content/uploads/2026/08/DPCGL_2.0_AUG_26_2026.pdf, SHA-256 ' +
  'f7f62d77…88be6eca); that PDF is the authority, and DRP may amend it. Both texts are on ' +
  'this device — no network needed to read them.';

function LicenceTexts(): React.JSX.Element {
  const [open, setOpen] = useState<'mit' | 'dpcgl' | null>(null);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          aria-expanded={open === 'mit'}
          onClick={() => setOpen(open === 'mit' ? null : 'mit')}
        >
          {open === 'mit' ? 'Hide the MIT licence' : 'Read the MIT licence'}
        </button>
        <button
          type="button"
          className="btn"
          aria-expanded={open === 'dpcgl'}
          onClick={() => setOpen(open === 'dpcgl' ? null : 'dpcgl')}
        >
          {open === 'dpcgl' ? 'Hide the DPCGL' : 'Read the DPCGL'}
        </button>
      </div>
      {open !== null && (
        <pre
          style={{
            margin: 0,
            maxHeight: 360,
            overflow: 'auto',
            padding: 12,
            borderRadius: 'var(--r2)',
            background: 'var(--panel)',
            border: '1px solid var(--line-soft)',
            color: 'var(--text-2)',
            font: '400 0.8125rem/1.5 var(--mono)',
            whiteSpace: 'pre',
            tabSize: 4,
          }}
        >
          {open === 'mit' ? MIT_LICENCE : DPCGL}
        </pre>
      )}
    </div>
  );
}

function Boundary({
  title,
  items,
  tint,
}: {
  title: string;
  items: string[];
  tint: string;
}): React.JSX.Element {
  return (
    <div>
      <div className="t-label" style={{ color: tint }}>
        {title}
      </div>
      <ul className="t-hint" style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
        {items.map((item) => (
          <li key={item} className="row" style={{ alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
            <span
              aria-hidden="true"
              style={{
                flex: 'none',
                width: 5,
                height: 5,
                marginTop: 6,
                borderRadius: '50%',
                background: tint,
              }}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
