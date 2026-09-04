/**
 * The backup nag.
 *
 * Safari's ITP can evict IndexedDB after roughly seven days of inactivity, and
 * `navigator.storage.persist()` is granted inconsistently. A group that plays
 * every three weeks would lose a character between sessions. So: a quiet line
 * that becomes loud at five days, and an offer to restore after seven.
 *
 * A character is months of someone's work. Losing it is the one unforgivable
 * bug in an app like this, and a discreet indicator is a cheap insurance
 * premium against it.
 *
 * The box, the message slot, the two controls, the touch floor and the
 * dismissal are `ShellBanner`'s; read the geometry there. What is this file's
 * own is when it appears, what it says, and what its sentences cost.
 *
 * ## The warning used to ellipsise away the reason it exists
 *
 * One span carries both clauses: the state (`No backup yet`, `Last backup: 15
 * days ago`) and, when `navigator.storage.persisted()` has answered false, the
 * eviction warning ` · this browser may clear local data on its own`. It was
 * declared `white-space: nowrap` + `text-overflow: ellipsis` over `overflow:
 * hidden`, and the clause an ellipsis eats is always the last one - so the half
 * that was cut on every phone in the world was the half that says what the risk
 * is. A warning that hides its own reason cannot be acted on: `No backup yet ·
 * this browser may cl…` is a status line, not a warning.
 *
 * Measured in Chrome against the running app (seeded `wizard10`, no
 * `lastBackupAt`, `persisted()` false). The never-backed-up sentence is
 * 299.17px of natural width; the span was given `viewport − 176` (40 of margin,
 * 18 of padding, 2 of border, 12 of gap, 55.89 of BACK UP, 4 of the inner gap -
 * 6 since the two banners became one shape, so it is `viewport − 178` today -
 * and 44 of the dismiss), so what was hidden was **155.1px at 320, 131.1 at
 * 344, 115.1 at 360, 100.1 at 375, 82.1 at 393, 73.1 at 402, 45.1 at 430**, and
 * the sentence was whole only from 476px up. The days-ago variant is 354.83px
 * and was whole only from 531. There was no `title` and no second line, so on a
 * phone the clause was unreadable by any means.
 *
 * ## What the two sentences cost, which is nothing until the third line
 *
 * Measured when the message was `.t-dense`: a line 15.87px, so two 31.74 and
 * inside the 44px the two controls already hold the row open at; three 47.61,
 * pushing the banner from 58 to 61.58. It is `.t-hint` since the readability
 * ramp, 13px/1.4 - 18.2 a line by declaration, two still inside the 44 - and
 * the widths at which each sentence takes its third line are not re-measured.
 * Which happened where, measured with the app running then:
 *
 *   - `No backup yet · …` (299.17px) is two lines from 344 up and three at 320;
 *   - `Last backup: N days ago · …` (354.83px) is two lines from 375 up and
 *     three at 360, 344 and 320. The day count is part of the string, so a
 *     three-digit N moves this threshold by a few pixels.
 *
 * So the Play column pays **66px for this banner at 375, 393, 402 and 430** -
 * exactly what it paid while the sentence was being truncated - and **70 at 360
 * and 344 for the days-ago sentence and at 320 for either**. Measured column
 * heights with the banner up, before this change and after: 487 at 375×667, 672
 * at 393×852, 694 at 402×874, 752 at 430×932, unchanged; 620 → 616 at 360×800
 * and 702 → 698 at 344×882 for the days-ago state; 388 → 384 at 320×568. Four
 * pixels at the three narrowest widths, for a warning that can be read.
 */
import { useEffect, useState } from 'react';
import { NAG_AFTER_DAYS } from '../../store/backup.ts';
import { daysSinceBackup } from '../../store/prefs.ts';
import { useApp } from '../../store/state.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import { ShellBanner } from './ShellBanner.tsx';

export function BackupBanner(): React.JSX.Element | null {
  const prefs = useApp((s) => s.prefs);
  const characters = useApp((s) => s.characters);
  const setScreen = useApp((s) => s.setScreen);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const phone = useIsPhone();

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  if (characters.length === 0) return null;

  const days = daysSinceBackup(prefs);
  const never = days === null;
  const urgent = never || days >= NAG_AFTER_DAYS;
  if (!never && days < 3) return null;
  /*
   * A phone has no vertical room to spare on Play, so the nag waits there
   * until it is genuinely urgent; Settings carries the same state permanently.
   *
   * "Urgent" has to include *never*. This read `days >= 5` with no `never`
   * clause, and `daysSinceBackup` returns null when there is no stamp - so the
   * one user who most needs telling, the one who has never exported anything,
   * was the one user a phone never told. Day 1 or day 90, it showed nothing.
   */
  if (phone && !urgent) return null;

  return (
    <ShellBanner
      urgent={urgent}
      action={{ label: 'BACK UP', onClick: () => setScreen('settings') }}
      dismissLabel="Dismiss the backup reminder"
    >
      {never ? 'No backup yet' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago`}
      {persisted === false && ' · this browser may clear local data on its own'}
    </ShellBanner>
  );
}
