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
import { forgetBackupFolder } from '../../store/backup.ts';
import { clearAll, type StorageHealth } from '../../store/db.ts';
import { DEFAULT_PREFS, savePrefs } from '../../store/prefs.ts';
import { useApp } from '../../store/state.ts';
import { formatBytes } from './binaryFiles.ts';
import { Field, Note, Rows, Section } from './parts.tsx';

export const ATTRIBUTION =
  'This product includes materials from the Daggerheart System Reference Document 1.0, ' +
  '© Critical Role, LLC, under the terms of the Darrington Press Community Gaming License. ' +
  'More information at www.daggerheart.com. Daggerheart Compatible. Independent community ' +
  'content, not affiliated with or endorsed by Critical Role, LLC or Darrington Press.';

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
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((est) =>
        setHealth({ persisted: false, usage: est.usage ?? null, quota: est.quota ?? null }),
      )
      .catch(() => setHealth(null));
  }, []);

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
   * `clearAll` empties IndexedDB and nothing else, so the three localStorage
   * keys have to go by hand. `dhc.backup.v1` is the one that matters: it holds
   * the ids the last session saw, and left behind it makes the next startup's
   * integrity check announce that the characters the user just deleted have
   * been evicted by the browser - a false alarm about the one failure this app
   * exists to prevent. `dhc.gm.v1` would likewise leave a stale encounter
   * standing in a library that no longer has anyone in it.
   */
  const reset = (): void => {
    setStatus(null);
    void clearAll()
      .then(() => forgetBackupFolder())
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
        <p className="t-dense" style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {ATTRIBUTION}
        </p>
      </div>

      <Rows>
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
        <Field
          label="Reset everything"
          hint="Deletes every character, every imported source, all art and every preference on this device. There is no undo and no copy anywhere else."
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
            <Note tone="danger">
              This erases {characters.length} character{characters.length === 1 ? '' : 's'} and
              everything else this device holds. Export a backup first if there is any doubt — that
              file is the only thing that can bring it back.
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
      <ul className="t-dense" style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
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
