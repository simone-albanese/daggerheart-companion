/**
 * The optional Core Rulebook layer, and the art pack that carries its pictures
 * to a phone.
 *
 * Two things this section has to be honest about. Parsing a 319 MB PDF is a
 * desktop job - attempting it on a phone is an out-of-memory crash, not a slow
 * import - so where `importCapability()` says no, the option is shown disabled
 * with its reason and the way round it. And removing the layer costs nothing:
 * every rule, card and adversary in this app comes from the SRD underneath, and
 * the manual only ever laid art, flavour text and page numbers on top.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Layer } from '../../../shared/types.ts';
import {
  ART_PACK_EXTENSION,
  ART_PACK_MIME,
  ART_PACK_WARNING,
  artPackFilename,
  buildArtPack,
  importCapability,
  importCoreRulebook,
  readArtPack,
  storeArtPackImages,
  type Entry,
  type ImportRun,
  type ReconcileReport,
} from '../../import/index.ts';
import type { ArtPackInput } from '../../import/artPack.ts';
import * as db from '../../store/db.ts';
import { useApp } from '../../store/state.ts';
import { Field, Note, Rows, Section } from './parts.tsx';
import { pickBinaryFile, saveBlobFile } from './binaryFiles.ts';

/** Art that arrived in a pack rather than out of a PDF, so it can leave again. */
const ART_PACK_LAYER = 'art-pack';

/**
 * Every collection the importer can produce, sent whole.
 *
 * Not a display list and not a shortlist: this is what the importer compares
 * the manual against, so a collection missing from it is a collection imported
 * with no check on it at all. `domains` was missing, and `domains` is the one
 * section of the 2025-09-06 printing that currently parses - the manual's
 * shorter domain descriptions went straight over the SRD's. The worker now
 * refuses a collection it was given no base for, so a future omission is
 * reported rather than silently applied, but the list still has to be complete.
 */
const MATCHED = [
  'domains',
  'domainCards',
  'classes',
  'subclasses',
  'ancestries',
  'communities',
  'weapons',
  'armors',
  'loot',
  'consumables',
  'adversaries',
  'environments',
  'beastforms',
] as const;

export function Rulebook({
  phone,
  innerRef,
}: {
  phone: boolean;
  innerRef?: (el: HTMLElement | null) => void;
}): React.JSX.Element {
  const layers = useApp((s) => s.layers);
  const dataset = useApp((s) => s.dataset);
  const reloadDataset = useApp((s) => s.reloadDataset);

  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [artCount, setArtCount] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const run = useRef<ImportRun | null>(null);
  // Mirrored in state because the Stop button is rendered from it, and a ref
  // changing does not re-render: driven off `run.current` alone, the only way
  // to cancel a 397-page import appears when some unrelated progress event
  // happens to repaint, and never at all for a run that emits none.
  const [running, setRunning] = useState(false);

  // The importer's own answer, which is stricter than a width query: a tablet
  // in a keyboard case is a desktop layout and still a phone's memory budget.
  const capability = importCapability();
  const canImport = capability.supported && !phone;
  const optional = layers.filter((l) => l.priority > 0);

  const countArt = useCallback(() => {
    void db
      .artKeys()
      .then((keys) => setArtCount(keys.length))
      .catch(() => setArtCount(null));
  }, []);

  useEffect(countArt, [countArt]);

  // An import that outlives the screen would keep a worker and a 319 MB file
  // handle alive with nowhere to report to.
  useEffect(() => () => run.current?.cancel(), []);

  const remove = useCallback(
    (layer: Layer) => {
      setBusy(true);
      void db
        .removeLayer(layer.id)
        .then(() => reloadDataset())
        .then(() => {
          setReport(null);
          setStatus(`${layer.label} removed. The SRD underneath is untouched.`);
          countArt();
        })
        .catch((cause: unknown) => setStatus(cause instanceof Error ? cause.message : String(cause)))
        .finally(() => setBusy(false));
    },
    [countArt, reloadDataset],
  );

  const importPdf = useCallback(() => {
    setStatus(null);
    setReport(null);
    void (async () => {
      try {
        // Busy only once a file is actually in hand. A picker that is closed
        // without choosing does not always resolve, and a `busy` raised before
        // it would leave every control in this section dead until a reload.
        const file = await pickBinaryFile('application/pdf,.pdf');
        if (file === null) return;
        setBusy(true);

        // Whole entities, not just id and name: the importer compares every
        // field so the manual can only ever add to one, never shorten it.
        const base: Record<string, Entry[]> = {};
        for (const kind of MATCHED) {
          base[kind] = [...(dataset[kind] as ReadonlyArray<Entry>)];
        }

        const started = importCoreRulebook(file, base);
        run.current = started;
        setRunning(true);
        for await (const event of started.events) {
          if (event.type === 'progress') {
            setProgress(
              event.total > 0
                ? `${event.detail} — ${event.done} of ${event.total}`
                : event.detail,
            );
          } else if (event.type === 'refused') {
            setStatus(
              `That does not look like the Daggerheart Core Rulebook (read as: ${event.source.kind}). Nothing was changed.`,
            );
          } else if (event.type === 'failed') {
            setStatus(event.message);
          } else {
            await reloadDataset();
            setReport(event.result.report);
            setStatus(
              `${event.result.layer.label} imported in ${Math.round(event.result.elapsedMs / 1000)} s, with ${event.result.art.stored} illustrations.`,
            );
            countArt();
          }
        }
      } catch (cause) {
        setStatus(cause instanceof Error ? cause.message : String(cause));
      } finally {
        run.current = null;
        setRunning(false);
        setProgress(null);
        setBusy(false);
      }
    })();
  }, [countArt, dataset, reloadDataset]);

  const importPack = useCallback(() => {
    setStatus(null);
    void (async () => {
      try {
        const picked = await pickBinaryFile(`${ART_PACK_EXTENSION},${ART_PACK_MIME}`);
        if (picked === null) return;
        setBusy(true);
        const entries = await readArtPack(picked);
        const written = await storeArtPackImages(entries, ART_PACK_LAYER);
        setStatus(`${written} illustrations imported.`);
        countArt();
      } catch (cause) {
        setStatus(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    })();
  }, [countArt]);

  const makePack = useCallback(() => {
    setBusy(true);
    setStatus(null);
    void (async () => {
      try {
        const keys = await db.artKeys();
        const items: ArtPackInput[] = [];
        for (const key of keys) {
          const record = await db.getArt(key);
          if (record !== undefined) {
            items.push({ slug: key, blob: record.blob, width: record.width, height: record.height });
          }
        }
        const pack = buildArtPack(items, { acknowledged: true });
        setStatus(await saveBlobFile(artPackFilename('all'), pack));
      } catch (cause) {
        setStatus(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  return (
    <Section
      id="rulebook"
      title="Core Rulebook"
      lead="Everything the app needs is already here, from the SRD. Importing the Core Rulebook is optional: it adds the art, the flavour text and the page numbers, and nothing that changes a rule."
      innerRef={innerRef}
    >
      <Rows>
        <Field
          label="Import the Core Rulebook"
          hint={
            canImport
              ? 'A PDF you already own. It is read on this device, never uploaded, and never stored — only what it contributed is kept.'
              : phone && capability.supported
                ? 'Not on a phone: the PDF is about 319 MB and parsing it here runs the browser out of memory. Do it on a computer, make an art pack there, and import that file below — a few megabytes per domain, no parsing.'
                : capability.reason
          }
        >
          <button type="button" className="btn" disabled={!canImport || busy} onClick={importPdf}>
            Choose a PDF
          </button>
          {running && (
            <button type="button" className="btn" onClick={() => run.current?.cancel()}>
              Stop
            </button>
          )}
        </Field>

        {progress !== null && (
          <div style={{ background: 'var(--panel)', padding: '0 14px 13px' }}>
            <Note role="status">{progress}</Note>
          </div>
        )}

        {optional.length === 0 ? (
          <Field
            label="Installed sources"
            // Counted, not quoted: a hardcoded 189 stops being true the first
            // time the dataset is regenerated, and this row is the one place
            // someone checks whether the SRD arrived whole.
            hint={`SRD 1.0 only. That is the full rules set: ${dataset.domainCards.length} domain cards, ${dataset.adversaries.length} adversaries, ${dataset.classes.length} classes.`}
          />
        ) : (
          optional.map((layer) => (
            <Field
              key={layer.id}
              label={layer.label}
              hint={
                <>
                  {layer.importedAt !== undefined &&
                    `Imported ${new Date(layer.importedAt).toLocaleDateString()}. `}
                  Removing it loses nothing: the SRD is always underneath, and every character keeps
                  every reference it had.
                </>
              }
            >
              <button type="button" className="btn" disabled={busy} onClick={() => remove(layer)}>
                Remove
              </button>
            </Field>
          ))
        )}

        <Field
          label="Art on this device"
          hint={
            artCount === null
              ? 'Could not read the art store.'
              : artCount === 0
                ? 'None. Cards show their text-only face, which is the normal state without the manual and is meant to look deliberate.'
                : `${artCount} illustrations, stored as images and never as text.`
          }
        >
          <button type="button" className="btn" disabled={busy} onClick={importPack}>
            Import an art pack
          </button>
          {artCount !== null && artCount > 0 && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => remove({ id: ART_PACK_LAYER, label: 'The imported art', priority: 1 })}
            >
              Remove art
            </button>
          )}
        </Field>

        {!phone && (
          <Field
            label="Make an art pack"
            hint="Writes the illustrations already on this computer into one .dhart file you can open on your phone. No text, no rules, no PDF."
            footer={
              <div className="stack" style={{ gap: 10 }}>
                <Note tone="warn">{ART_PACK_WARNING}</Note>
                <label
                  className="row"
                  style={{ minHeight: 'var(--tap)', gap: 10, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    style={{ width: 20, height: 20, minHeight: 'var(--control)', accentColor: 'var(--hope)' }}
                  />
                  <span className="t-dense" style={{ color: 'var(--text-2)' }}>
                    This is for my own devices and I will not share it.
                  </span>
                </label>
                <button
                  type="button"
                  className="btn"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={!acknowledged || busy || artCount === null || artCount === 0}
                  onClick={makePack}
                >
                  Write the art pack
                </button>
              </div>
            }
          />
        )}
      </Rows>

      {status !== null && <Note role="status">{status}</Note>}
      {report !== null && <ReconciliationReport report={report} onDismiss={() => setReport(null)} />}
    </Section>
  );
}

/**
 * What the import actually did, kind by kind.
 *
 * Shown after every import, including the boring ones. A layer that silently
 * matched 187 of 189 cards and quietly invented two new ones is exactly the
 * failure that is impossible to notice later (Architecture 13).
 */
export function ReconciliationReport({
  report,
  onDismiss,
}: {
  report: ReconcileReport;
  onDismiss: () => void;
}): React.JSX.Element {
  return (
    <div className="panel" style={{ padding: 14 }}>
      <div className="spread" style={{ alignItems: 'center' }}>
        <span className="t-label">Reconciliation</span>
        <button type="button" className="t-meta" onClick={onDismiss} style={{ minHeight: 'var(--control)' }}>
          DISMISS
        </button>
      </div>

      <div className="row" style={{ gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
        <Total label="MATCHED" value={report.totals.matched} />
        <Total label="NEW" value={report.totals.manualOnly} />
        <Total label="SRD ONLY" value={report.totals.srdOnly} />
        <Total label="TO CONFIRM" value={report.totals.suggested} tone="var(--stress)" />
      </div>

      <div className="stack" style={{ gap: 1, marginTop: 12, background: 'var(--line-soft)' }}>
        {report.kinds.map((kind) => (
          <div
            key={kind.kind}
            className="spread"
            style={{ background: 'var(--panel)', padding: '9px 2px', alignItems: 'center' }}
          >
            <span style={{ font: '600 13px/1.2 var(--sans)', textTransform: 'capitalize' }}>
              {kind.kind}
            </span>
            <span className="t-meta" style={{ color: 'var(--muted)', textAlign: 'right' }}>
              {kind.matched.length} MATCHED · {kind.manualOnly.length} NEW · {kind.srdOnly.length}{' '}
              UNTOUCHED
              {kind.suggestions.length > 0 && ` · ${kind.suggestions.length} TO CONFIRM`}
            </span>
          </div>
        ))}
      </div>

      {report.unread.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Note tone="warn">
            {report.unread.length} section{report.unread.length === 1 ? '' : 's'} could not be read
            and {report.unread.length === 1 ? 'was' : 'were'} left out rather than guessed at:{' '}
            {report.unread.map((u) => u.section).join(', ')}.
          </Note>
        </div>
      )}
    </div>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}): React.JSX.Element {
  return (
    <div>
      <div className="t-label">{label}</div>
      <div
        style={{
          marginTop: 5,
          font: '800 22px/1 var(--sans)',
          color: tone ?? 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
