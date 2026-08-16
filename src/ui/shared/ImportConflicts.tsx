/**
 * "That character is already here, and this device's copy is newer."
 *
 * Every import path used to end in an unconditional `put`, so restoring an
 * August backup overwrote the September character in place - no prompt, no
 * undo, nothing on screen. Deleting *one* character in this app requires
 * arm-then-confirm with an inventory of what is lost. Overwriting the whole
 * library took one tap.
 *
 * The store now writes nothing in that case and hands the decision back. This
 * is the decision, on screen.
 *
 * Layout, on a 393px phone. Every surface that shows this - Settings, the
 * recovery screen, the transfer screen - scrolls, so it can be as tall as it
 * needs and nothing is clipped. The two dates and the sentence saying nothing
 * has happened are read; the three buttons are touched; so the reading sits
 * above the touching, in that order, and the buttons land where the thumb
 * already is after tapping Import. Three buttons across 353px of usable width
 * with two 6px gaps is about 113px each at `--control` height, which clears
 * the touch floor in both directions - and they wrap to their own rows rather
 * than shrinking, because a button that shrinks below the floor is worse than
 * one on a second line.
 */
import { useCallback, useState } from 'react';
import type { Character } from '../../../shared/types.ts';
import { useApp, type ImportConflict, type ImportReport } from '../../store/state.ts';
import type { ImportChoice } from '../../store/merge.ts';

const plural = (n: number, one: string, many = `${one}s`): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/**
 * What happened, in one sentence, naming the characters.
 *
 * The old message was `Imported N characters` and was printed whatever
 * happened, including when a newer local copy had just been destroyed. Counts
 * on their own are what let that read as success, so each number that is not
 * zero says which characters it is about.
 */
export function describeImport(report: ImportReport): string {
  const names = (list: { name: string }[]): string =>
    list.map((c) => c.name || 'Unnamed').join(', ');

  const parts: string[] = [];
  if (report.imported.length > 0) {
    parts.push(`Imported ${plural(report.imported.length, 'character')}: ${names(report.imported)}.`);
  }
  if (report.replaced.length > 0) {
    parts.push(`Updated ${plural(report.replaced.length, 'character')}: ${names(report.replaced)}.`);
  }
  if (report.conflicts.length > 0) {
    parts.push(
      `${plural(report.conflicts.length, 'character')} already here with a newer edit — nothing was changed, and there is a choice below.`,
    );
  }
  if (parts.length === 0) parts.push('There was nothing in that to import.');
  return [...parts, ...report.warnings].join(' ');
}

/**
 * The import half of a screen: run it, keep the conflicts, resolve them.
 *
 * Shared because four call sites need exactly this and a fifth will exist the
 * next time somebody adds a way in. Three of the four used to be a bare
 * `for (const c of list) await importCharacter(c)`, which is how the same
 * silent overwrite arrived at three different doors.
 */
export function useImportFlow(): {
  conflicts: ImportConflict[];
  run: (incoming: Character[], warnings?: string[]) => Promise<string>;
  choose: (conflict: ImportConflict, choice: ImportChoice) => Promise<void>;
  clear: () => void;
} {
  const importCharacters = useApp((s) => s.importCharacters);
  const resolveImport = useApp((s) => s.resolveImport);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);

  const run = useCallback(
    async (incoming: Character[], warnings?: string[]) => {
      const report = await importCharacters(incoming, warnings ? { warnings } : {});
      setConflicts(report.conflicts);
      return describeImport(report);
    },
    [importCharacters],
  );

  const choose = useCallback(
    async (conflict: ImportConflict, choice: ImportChoice) => {
      await resolveImport(conflict, choice);
      // Whatever was chosen, this one is answered. Dropping it on `keep-mine`
      // too is the point: the list is the set of open questions, and leaving a
      // resolved row on screen would invite a second, contradictory answer.
      setConflicts((open) => open.filter((c) => c.incoming.id !== conflict.incoming.id));
    },
    [resolveImport],
  );

  const clear = useCallback(() => setConflicts([]), []);

  return { conflicts, run, choose, clear };
}

/** A date a person can compare against the other one, without a year of noise. */
function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'an unreadable date';
  return at.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: at.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CHOICES: Array<{ choice: ImportChoice; label: string; hint: string }> = [
  { choice: 'keep-mine', label: 'KEEP MINE', hint: 'Leave this device alone and discard the arriving copy' },
  { choice: 'take-theirs', label: 'TAKE THEIRS', hint: 'Overwrite this device with the arriving copy' },
  { choice: 'keep-both', label: 'KEEP BOTH', hint: 'Add the arriving copy alongside, under a new name' },
];

export function ImportConflicts({
  conflicts,
  onChoose,
  busy = false,
}: {
  conflicts: ImportConflict[];
  onChoose: (conflict: ImportConflict, choice: ImportChoice) => void;
  busy?: boolean;
}): React.JSX.Element | null {
  if (conflicts.length === 0) return null;

  return (
    <div
      className="stack"
      role="group"
      aria-label="Characters already on this device"
      style={{
        gap: 14,
        padding: 12,
        borderRadius: 'var(--r2)',
        background: 'var(--raised)',
        border: '1px solid var(--stress)',
      }}
    >
      <div className="stack" style={{ gap: 4 }}>
        <span className="t-label" style={{ color: 'var(--text)' }}>
          {conflicts.length === 1
            ? 'ONE CHARACTER IS ALREADY HERE'
            : `${conflicts.length} CHARACTERS ARE ALREADY HERE`}
        </span>
        {/*
          This sentence has to be exactly true, because it is the reason the
          user is allowed to take their time over the buttons below. Nothing
          has been written: the store returned these instead of putting them.
        */}
        <span className="t-dense" style={{ color: 'var(--text-2)' }}>
          This device&rsquo;s copy was edited more recently, so nothing has been changed. Choose
          what to do with each one.
        </span>
      </div>

      {conflicts.map((conflict) => (
        <div key={conflict.incoming.id} className="stack" style={{ gap: 8 }}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="t-vital" style={{ color: 'var(--text)' }}>
              {conflict.local.name || 'Unnamed'}
            </span>
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              On this device: edited {when(conflict.local.updatedAt)} · level{' '}
              {conflict.local.level}
            </span>
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              Arriving: edited {when(conflict.incoming.updatedAt)} · level {conflict.incoming.level}
            </span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {CHOICES.map(({ choice, label, hint }) => (
              <button
                key={choice}
                type="button"
                className="btn"
                disabled={busy}
                title={hint}
                aria-label={`${label} for ${conflict.local.name || 'Unnamed'}: ${hint}`}
                onClick={() => onChoose(conflict, choice)}
                style={{ flex: '1 1 100px', minHeight: 'var(--control)' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
