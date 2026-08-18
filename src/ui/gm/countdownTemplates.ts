/**
 * A countdown template: the clock the GM sets up once, and drops all evening.
 *
 * ## The distinction this file exists for
 *
 * A template is a *template of a countdown, not a countdown with state*. It
 * carries a name, a kind and a starting number, and it carries no `value` — so
 * there is nothing on it that can be wrong, nothing to reset, and nothing to
 * advance. An instance is the opposite: it is a live clock with a number that
 * moves, and it is a row of the session list, which is where the wireframe
 * draws countdowns and where `shared/campaigns.ts` says they live.
 *
 * The GM writes "Reinforcements arrive — dynamic, from 6" once. Tonight that
 * gets dropped on the bandit ambush; three scenes later it gets dropped again
 * on the second wave. Two clocks, two numbers, one template, and advancing
 * either does nothing to the other or to the template.
 *
 * ## Where a template lives, and why it is not in the campaign record
 *
 * Not in `Campaign`. That record carries nine fields — `id`, `schemaVersion`,
 * `name`, `createdAt`, `updatedAt`, `fear`, `session`, `party` and `board` —
 * and a template is none of them. It is not a `session` row, because a row is
 * an instance: it has a `value`, it can be primary, and it is drawn on the GM's
 * spine for the night. Adding a tenth field to those nine would mean a
 * `CAMPAIGN_SCHEMA_VERSION` bump under Architecture §6.1, and it would put the
 * GM's own vocabulary of clocks *inside one campaign* — so a GM who starts a
 * second campaign would arrive at an empty shelf and retype every one of them.
 *
 * That is the argument, and it points the same way twice: a template belongs to
 * the person running the game, not to the game being run. So it is stored on
 * the device, in its own localStorage key, beside `dhc.prefs.v1` rather than
 * inside it.
 *
 * localStorage rather than IndexedDB, and `prefs.ts` states the test this
 * passes: "Preferences live in localStorage: they are small, synchronous, and
 * losing them costs nothing. Everything that would hurt to lose is in
 * IndexedDB." A template is a name, one of four kinds, and a small integer.
 * Losing one costs the eleven seconds it took to type, it is nobody else's
 * material, it is not a character, and no campaign record points at it — so a
 * device that is evicted loses a convenience and not a night's work. That is
 * the localStorage tier exactly.
 *
 * Its own key rather than a field on `Prefs`, for one reason worth stating:
 * `savePrefs` serialises the whole preferences record on every fold a player
 * opens on the Play screen, and a growing array of templates does not belong in
 * the payload of a chevron.
 *
 * ## What happens to the templates a GM already has
 *
 * There are none. This is the first build that has ever had the idea, no build
 * has ever written `dhc.gm.countdownTemplates.v1`, and `loadTemplates` returns `[]` for
 * a key that is not there. There is therefore no converter here and nothing for
 * one to do — which is worth saying out loud, because the next reader will look
 * for the migration and it is not an omission that it is missing.
 *
 * ## What dropping a template produces
 *
 * An instance, through `useGm.addCountdown(name, kind, start)` — the same
 * action ADD has always used, because a countdown made from a template must be
 * indistinguishable from one typed by hand the moment it exists.
 *
 * Its `name`, `kind` and `start` come from the template. Its `value` starts at
 * `start`, because a clock is born full. Its identity does not come from the
 * template: `addCountdown` mints a fresh `crypto.randomUUID()` for the row and
 * the countdown to share, so two drops of one template are two independent
 * clocks with two different ids, and neither id is the template's. Deleting the
 * template afterwards leaves both of them running.
 *
 * `Countdown.notes` is not on a template and is not set by one; `addCountdown`
 * seeds it `''` exactly as it always has. See its docblock in `shared/types.ts`
 * for why that field is persisted and drawn by nobody on purpose.
 */
import { create } from 'zustand';
import type { CountdownKind } from '../../engine/encounter.ts';

/**
 * Where the shelf is stored.
 *
 * `v1` for the same reason every other key in this app carries one: the day the
 * shape changes, a build that cannot read the old one reads nothing rather than
 * reading it wrong.
 */
export const COUNTDOWN_TEMPLATES_KEY = 'dhc.gm.countdownTemplates.v1';

/**
 * Three fields, and the absence of a fourth is the design.
 *
 * There is no `value`, no `primary`, no `order` and no `notes`. Every one of
 * those is a fact about a clock that is running, and a template is not running.
 */
export interface CountdownTemplate {
  id: string;
  name: string;
  kind: CountdownKind;
  start: number;
}

/**
 * The four kinds, as a value, because `kind` arrives off a disk.
 *
 * `shared/campaigns.ts` has the same list in `COUNTDOWN_KINDS` and does not
 * export it, and this file may not edit that one. So this is a second copy —
 * and the `satisfies` is what stops it becoming a *drifting* second copy rather
 * than a duplicated one. A fifth `CountdownKind` makes this object miss a key
 * and the file stops compiling; a key here that is not a `CountdownKind` is an
 * excess property and the file stops compiling. Neither can be discovered at
 * runtime by a GM whose stored template quietly turned into a standard one.
 */
const KIND_IS_REAL = {
  standard: true,
  dynamic: true,
  loop: true,
  'long-term': true,
} satisfies Record<CountdownKind, true>;

const isKind = (v: unknown): v is CountdownKind =>
  typeof v === 'string' && Object.hasOwn(KIND_IS_REAL, v);

/**
 * Read a shelf nobody in this build wrote.
 *
 * Deliberately the same shape of caution as `readCountdown` in
 * `shared/campaigns.ts`, and clamped the same way: `start` is rounded and held
 * at 1 or above, because a countdown that starts at zero has already happened
 * and one that starts at 2.5 cannot be drawn as pips. An unrecognised `kind`
 * falls back to `'standard'` rather than dropping the row, for the reason that
 * file gives at length — a row the build cannot fully read is still a row the
 * GM put there.
 *
 * One thing it *does* drop, and this is the difference from a session row: an
 * entry with no usable name. A template is identified to the GM by its name and
 * by nothing else — the shelf draws one button per template with the name on it
 * — so a nameless entry is a button that cannot say what it does. Nothing in
 * the app points at a template by id, so dropping one cannot orphan anything,
 * which is exactly the property a session row does not have.
 *
 * An entry with no usable id gets one minted here rather than being dropped,
 * and that is safe for the same reason: the id is a React key and the argument
 * to `forget`, and nothing outside this module has ever stored one. Two reads
 * of the same idless entry therefore produce two different ids, which is a
 * fact and not a hazard — the shelf is read once at module load, and the first
 * `keep` or `forget` after it writes the minted id back.
 */
export function readTemplates(raw: unknown): CountdownTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): CountdownTemplate[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const r = entry as Record<string, unknown>;
    const rawName = r['name'];
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (name === '') return [];
    const rawStart = r['start'];
    const start =
      typeof rawStart === 'number' && Number.isFinite(rawStart)
        ? Math.max(1, Math.round(rawStart))
        : 1;
    const id = r['id'];
    return [
      {
        id: typeof id === 'string' && id !== '' ? id : crypto.randomUUID(),
        name,
        kind: isKind(r['kind']) ? r['kind'] : 'standard',
        start,
      },
    ];
  });
}

/** The stored shelf, or an empty one. Never throws, never explains. */
export function loadTemplates(): CountdownTemplate[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COUNTDOWN_TEMPLATES_KEY);
    if (raw === null) return [];
    return readTemplates(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveTemplates(list: readonly CountdownTemplate[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COUNTDOWN_TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    // Private mode, quota, or a browser that refuses. Same as `savePrefs`.
  }
}

export interface CountdownTemplateShelf {
  templates: CountdownTemplate[];
  /**
   * Put this name/kind/number on the shelf, and hand back the id it was given.
   *
   * Null when the name is blank, because a shelf row with no label is not worth
   * making — the same refusal `NewCountdown`'s submit already makes.
   *
   * Keeping a triple that is already on the shelf returns the id of the one
   * that is there instead of adding a second identical row: two rows the GM
   * cannot tell apart is a choice with no answer, and the shelf is drawn under
   * a thumb between scenes. The screen does not lean on this being silent —
   * KEEP reads KEPT AS A TEMPLATE and goes inert once the triple is on the
   * shelf — but it is the store's job to be right whoever calls it.
   */
  keep: (name: string, kind: CountdownKind, start: number) => string | null;
  /** Take a template off the shelf. Clocks already dropped from it stay. */
  forget: (id: string) => void;
}

/**
 * Its own store rather than a slice of `gmStore`.
 *
 * `GmLive` in `gmStore.ts` is documented as "the part of the state that belongs
 * to the active campaign… replaced wholesale when the GM switches campaign",
 * and a shelf that emptied itself on a campaign switch would be the exact thing
 * this file's header argues against. Writing it here also keeps it out of the
 * 400 ms campaign debounce, which is a write to IndexedDB that this record has
 * no business triggering.
 */
export const useCountdownTemplates = create<CountdownTemplateShelf>((set, get) => ({
  templates: loadTemplates(),

  keep(name, kind, start) {
    const trimmed = name.trim();
    if (trimmed === '') return null;
    const rounded = Math.max(1, Math.round(start));
    const already = get().templates.find(
      (t) => t.name === trimmed && t.kind === kind && t.start === rounded,
    );
    if (already !== undefined) return already.id;
    const made: CountdownTemplate = { id: crypto.randomUUID(), name: trimmed, kind, start: rounded };
    const templates = [...get().templates, made];
    set({ templates });
    saveTemplates(templates);
    return made.id;
  },

  forget(id) {
    const templates = get().templates.filter((t) => t.id !== id);
    set({ templates });
    saveTemplates(templates);
  },
}));
