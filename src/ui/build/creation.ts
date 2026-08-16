/**
 * What a character in progress is, and what is still missing from it.
 *
 * This is the wizard's model, kept apart from the wizard's screen, for the same
 * reason src/engine is kept apart from everything: "is this character legal
 * yet" is a rules question, and a rules question belongs in a plain function a
 * test can call. Nothing here imports React or the store.
 *
 * The answer is now read in three places at once - the progress dots in the
 * header, the Next button that refuses to advance, and the final review before
 * Create - and three readers of one definition is fine where three definitions
 * would drift. The one that drifted would be the one that let an illegal
 * character through.
 *
 * Order is declared once, in STEPS. The number the player sees, which screen a
 * missing thing belongs to, and which step the rail may jump to are all derived
 * from that array, so moving a step is moving one entry. Note that these are
 * not the SRD's step numbers: the SRD has nine steps, this wizard has twelve,
 * because two of the SRD's steps hide a second mandatory choice a long scroll
 * below the first and one of them is split across the start and the end of the
 * flow. Any copy that means the SRD's numbering has to say so out loud.
 */
import {
  TRAITS,
  type CharClass,
  type Character,
  type Dataset,
  type Experience,
  type Gold,
  type InventoryEntry,
  type Ref,
  type Trait,
} from '../../../shared/types.ts';
import { tierOf } from '../../engine/character.ts';
import { startingCardAllowance } from './cardAllowance.ts';

export const POTIONS = [
  { ref: 'minor-health-potion', name: 'Minor Health Potion', text: 'Clear 1d4 Hit Points.' },
  { ref: 'minor-stamina-potion', name: 'Minor Stamina Potion', text: 'Clear 1d4 Stress.' },
] as const;

interface KitLine {
  key: string;
  name: string;
  tag: string;
}

/** The three lines the SRD's step 5 gives every character regardless of class. */
export const STARTER_KIT: KitLine[] = [
  { key: 'torch', name: 'A torch', tag: 'SRD' },
  { key: 'rope', name: '50 feet of rope', tag: 'SRD' },
  { key: 'supplies', name: 'Basic supplies', tag: 'SRD' },
];

export interface Draft {
  name: string;
  pronouns: string;
  classRef: Ref;
  subclassRef: Ref | null;
  /** Mixed Ancestry takes the first feature from one lineage, the second from another. */
  mixed: boolean;
  ancestryTop: Ref | null;
  ancestryBottom: Ref | null;
  communityRef: Ref | null;
  traits: Partial<Record<Trait, number>>;
  primary: Ref | null;
  secondary: Ref | null;
  armor: Ref | null;
  background: string[];
  experiences: Experience[];
  cards: Ref[];
  connections: string[];
  /** Which of the SRD's starting-kit lines are being carried. */
  kit: Record<string, boolean>;
  /** Index into the class's own items. The SRD gives one of them, not all. */
  classItem: number | null;
  potion: string | null;
  gold: Gold;
  inventory: InventoryEntry[];
}

export const emptyDraft = (): Draft => ({
  name: '',
  pronouns: '',
  classRef: '',
  subclassRef: null,
  mixed: false,
  ancestryTop: null,
  ancestryBottom: null,
  communityRef: null,
  traits: {},
  primary: null,
  secondary: null,
  armor: null,
  background: [],
  experiences: [
    { id: crypto.randomUUID(), name: '', bonus: 2 },
    { id: crypto.randomUUID(), name: '', bonus: 2 },
  ],
  cards: [],
  connections: [],
  kit: { torch: true, rope: true, supplies: true },
  classItem: 0,
  potion: POTIONS[0].ref,
  // The SRD hands you one handful of gold with the rest of the starting kit.
  gold: { handfuls: 1, bags: 0, chests: 0 },
  inventory: [],
});

// ---------------------------------------------------------------------------
// The steps
// ---------------------------------------------------------------------------

export type StepId =
  | 'class'
  | 'subclass'
  | 'ancestry'
  | 'community'
  | 'traits'
  | 'record'
  | 'equipment'
  | 'background'
  | 'experiences'
  | 'cards'
  | 'connections'
  | 'inventory';

export interface Step {
  /** Identity that survives reordering. Everything else keys off this, never off position. */
  id: StepId;
  title: string;
  /**
   * The progress dot, and only the progress dot: has this step been engaged
   * with at all. It is deliberately not the gate. Three of these steps ask for
   * prose the SRD says you may leave for play to discover, so a Next wired to
   * this predicate would trap a player who took the SRD's advice on a screen
   * with nothing mandatory on it. What blocks is `review`.
   */
  engaged: (draft: Draft, klass: CharClass | undefined, dataset: Dataset) => boolean;
}

const answered = (a: string[]): boolean => a.some((s) => s.trim() !== '');
const named = (e: Experience[]): number => e.filter((x) => x.name.trim() !== '').length;

/**
 * The order of creation, and the only declaration of it.
 *
 * Two of these are splits. The class and its subclass were one screen, which
 * put the second of the step's two mandatory choices below nine class cards
 * and a block of feature text - on a phone, roughly two screens under the
 * heading that promised it. Ancestry and community were likewise one screen,
 * with the community's nine cards under eighteen ancestries. Both splits give a
 * mandatory choice the top of a screen. Nothing else is split: the six trait
 * panels and the six domain cards also run past the fold, but each is one
 * decision with a live counter, and cutting one decision across two screens
 * would make the wizard longer for nothing.
 */
export const STEPS: readonly Step[] = [
  { id: 'class', title: 'Name & class', engaged: (d) => d.classRef !== '' },
  { id: 'subclass', title: 'Subclass', engaged: (d) => d.subclassRef !== null },
  {
    id: 'ancestry',
    title: 'Ancestry',
    engaged: (d) => d.ancestryTop !== null && (!d.mixed || d.ancestryBottom !== null),
  },
  { id: 'community', title: 'Community', engaged: (d) => d.communityRef !== null },
  {
    id: 'traits',
    title: 'Character traits',
    engaged: (d) => TRAITS.every((t) => d.traits[t] !== undefined),
  },
  // Read-only: the engine fills every number in as soon as there is a class.
  { id: 'record', title: 'Level, Evasion & HP', engaged: (_d, klass) => klass !== undefined },
  {
    id: 'equipment',
    title: 'Starting equipment',
    engaged: (d) => d.primary !== null && d.armor !== null,
  },
  { id: 'background', title: 'Background', engaged: (d) => answered(d.background) },
  { id: 'experiences', title: 'Experiences', engaged: (d) => named(d.experiences) >= 2 },
  {
    id: 'cards',
    title: 'Domain cards',
    // The dot has to agree with the blocker, and both of them move when a
    // subclass grants an extra card.
    engaged: (d, _klass, dataset) =>
      d.cards.length === startingCardAllowance([d.subclassRef], dataset),
  },
  { id: 'connections', title: 'Connections', engaged: (d) => answered(d.connections) },
  {
    id: 'inventory',
    title: 'Gold & inventory',
    // The SRD's kit, one class item and one potion arrive pre-selected, so this
    // dot is filled from the outset and only empties if you put everything
    // down. That is the honest reading of "answered" for a step whose answers
    // are already written in.
    engaged: (d) =>
      d.potion !== null ||
      d.classItem !== null ||
      d.inventory.length > 0 ||
      STARTER_KIT.some((line) => d.kit[line.key] !== false),
  },
];

const POSITION = new Map<StepId, number>(STEPS.map((s, i) => [s.id, i]));

/** Where a step sits, counted from zero. */
export function stepIndex(id: StepId): number {
  const at = POSITION.get(id);
  if (at === undefined) throw new Error(`no step called "${id}"`);
  return at;
}

/** The number the player sees. Copy that names a step reads it from here. */
export const stepNumber = (id: StepId): number => stepIndex(id) + 1;

/** The dots in the header, one per step, in order. */
export function stepsDone(
  draft: Draft,
  klass: CharClass | undefined,
  dataset: Dataset,
): boolean[] {
  return STEPS.map((s) => s.engaged(draft, klass, dataset));
}

// ---------------------------------------------------------------------------
// What is still missing
// ---------------------------------------------------------------------------

/** Something the character cannot be created without. */
export interface Blocker {
  /** The screen that can supply it. */
  step: StepId;
  /** A whole sentence, printed as it stands beside the button that refused. */
  text: string;
  /**
   * True when a tap on that step's own screen can satisfy it.
   *
   * False is for the things no player can fix - a dataset imported without any
   * classes in it. Those still stop Create, because a character without a class
   * is not a character, but they must never hold Next: on a first run Build
   * passes no Cancel, so a dead Next beside a dead Back on the opening step is
   * a wizard with no way out at all.
   */
  clearable: boolean;
}

/** Something worth saying that stops nothing. */
export interface Warning {
  /** The screen it belongs to, or null when it belongs to no single one. */
  step: StepId | null;
  text: string;
}

/**
 * Blockers stop creation; warnings do not. The split follows the SRD: the
 * mechanical choices are required, the written ones can be discovered in play.
 *
 * Every blocker is guarded by "can this dataset actually offer it". A wizard
 * that demands something nobody can give is a wizard that degrades into a dead
 * button with no explanation, and now that Next reads this list too, into a
 * flow that cannot be walked at all.
 */
export function review(
  draft: Draft,
  klass: CharClass | undefined,
  dataset: Dataset,
): { blockers: Blocker[]; warnings: Warning[] } {
  const blockers: Blocker[] = [];
  const warnings: Warning[] = [];
  const block = (step: StepId, text: string, clearable = true): void => {
    blockers.push({ step, text, clearable });
  };
  const warn = (step: StepId | null, text: string): void => {
    warnings.push({ step, text });
  };

  if (dataset.classes.length === 0) {
    block('class', 'This dataset has no classes, and a character cannot be built without one.', false);
  } else if (!klass) {
    block('class', 'Choose a class.');
  } else if (draft.subclassRef === null) {
    if (dataset.subclasses.some((s) => s.classRef === klass.id)) {
      block('subclass', 'Choose a subclass.');
    } else {
      warn('subclass', `This dataset has no subclasses for ${klass.name}.`);
    }
  }

  if (dataset.ancestries.length === 0) {
    warn('ancestry', 'No ancestries in this dataset.');
  } else {
    if (draft.ancestryTop === null) block('ancestry', 'Choose an ancestry.');
    if (draft.mixed && draft.ancestryBottom === null) {
      block('ancestry', 'A Mixed Ancestry needs a second lineage for its second feature.');
    }
  }
  if (dataset.communities.length === 0) {
    warn('community', 'No communities in this dataset.');
  } else if (draft.communityRef === null) {
    block('community', 'Choose a community.');
  }

  const unassigned = TRAITS.filter((t) => draft.traits[t] === undefined).length;
  if (unassigned > 0) {
    const subject = unassigned === 1 ? '1 trait still has' : `${unassigned} traits still have`;
    block('traits', `${subject} no modifier.`);
  }

  // Weapons and armor are two tables and are checked as two, so a dataset with
  // one of them and not the other loses the choice it cannot offer rather than
  // holding the step on a slot that can never be filled.
  if (dataset.weapons.length === 0) {
    warn('equipment', 'No weapon table in this dataset, so there is nothing to arm with.');
  } else if (draft.primary === null) {
    block('equipment', 'Choose a primary weapon.');
  }
  if (dataset.armors.length === 0) {
    warn('equipment', 'No armor table in this dataset, so thresholds stay at their base.');
  } else if (draft.armor === null) {
    block('equipment', 'Choose a set of armor.');
  }
  // Above tier 1 is a warning, never a blocker: the SRD starts a character at
  // tier 1, but a table that hands out an heirloom at creation has not done
  // anything this app gets to refuse.
  const gear = [
    draft.primary === null ? undefined : dataset.weapons.find((w) => w.id === draft.primary),
    draft.secondary === null ? undefined : dataset.weapons.find((w) => w.id === draft.secondary),
    draft.armor === null ? undefined : dataset.armors.find((a) => a.id === draft.armor),
  ];
  for (const item of gear) {
    if (item !== undefined && item.tier > tierOf(1)) {
      warn('equipment', `${item.name} is tier ${item.tier} — the SRD starts you at tier 1.`);
    }
  }

  // Only the cards this class could actually take count. Asking for two when
  // the dataset holds one is a blocker no tap on that screen can clear.
  if (klass !== undefined) {
    const allowance = startingCardAllowance([draft.subclassRef], dataset);
    const offered = dataset.domainCards.filter(
      (c) => c.level === 1 && klass.domains.includes(c.domain),
    ).length;
    const wanted = Math.min(allowance, offered);
    if (offered === 0) {
      warn('cards', `This dataset has no level 1 cards for ${klass.domains.join(' or ')}.`);
    } else if (draft.cards.length < wanted) {
      const missing = wanted - draft.cards.length;
      block('cards', `Take ${missing} more domain card${missing === 1 ? '' : 's'}.`);
    } else if (draft.cards.length > allowance) {
      // Going back and swapping subclass can leave you over the line: School of
      // Knowledge pays for a third card and School of War does not, and the
      // card step does not take the third one away behind your back.
      const over = draft.cards.length - allowance;
      block(
        'cards',
        `Put ${over} domain card${over === 1 ? '' : 's'} back — this character takes ${allowance}.`,
      );
    }
  }

  if (draft.name.trim() === '') warn(null, 'No name yet — the sheet will read "Unnamed".');
  if (named(draft.experiences) < 2) {
    warn('experiences', 'Both Experiences are worth +2 whether or not you have named them.');
  }
  if (!answered(draft.background)) {
    warn('background', 'No background answers — fine, you can discover them in play.');
  }
  if (!answered(draft.connections)) {
    warn('connections', 'No connections yet — these are usually written with the other players.');
  }

  return { blockers, warnings };
}

/** A missing thing as one line of a list, with the step it belongs to named. */
export function noteLine(note: { step: StepId | null; text: string }): string {
  return note.step === null ? note.text : `Step ${stepNumber(note.step)} — ${note.text}`;
}

/**
 * What is holding Next on this step, or null when nothing is.
 *
 * Only the step you are standing on. A player is not refused on the equipment
 * screen because they have not chosen a community two screens back; that is
 * what the step they are on is for.
 */
export function heldAt(blockers: readonly Blocker[], id: StepId): Blocker | null {
  return blockers.find((b) => b.step === id && b.clearable) ?? null;
}

/**
 * The last step the rail may jump to from here.
 *
 * Backwards is always free: changing your class after seeing its cards is
 * ordinary play, not a mistake to be prevented. Forwards runs as far as the
 * first step still holding you, so reading ahead stays possible right up to the
 * thing you have not decided, and stops there rather than showing screens built
 * on a choice that does not exist yet. The step you are standing on is always
 * included, so no sequence of choices can strand you somewhere the rail refuses
 * to go back to.
 */
export function furthestReachable(blockers: readonly Blocker[], step: number): number {
  const held = blockers.filter((b) => b.clearable).map((b) => stepIndex(b.step));
  const first = held.length === 0 ? STEPS.length - 1 : Math.min(...held);
  return Math.max(step, first);
}

// ---------------------------------------------------------------------------
// Turning a finished draft into a character
// ---------------------------------------------------------------------------

export function assemble(
  draft: Draft,
  klass: CharClass,
  consumables: Array<{ id: string; name: string; text: string }>,
): Partial<Character> {
  const traits = {} as Record<Trait, number>;
  for (const t of TRAITS) traits[t] = draft.traits[t] ?? 0;

  const inventory: InventoryEntry[] = STARTER_KIT.filter(
    (line) => draft.kit[line.key] !== false,
  ).map((line) => ({ ref: null, name: line.name, quantity: 1 }));

  const classItem = draft.classItem === null ? undefined : klass.classItems[draft.classItem];
  if (classItem !== undefined) inventory.push({ ref: null, name: classItem, quantity: 1 });

  if (draft.potion !== null) {
    const known = consumables.find((c) => c.id === draft.potion);
    const printed = POTIONS.find((p) => p.ref === draft.potion);
    inventory.push({
      ref: known?.id ?? null,
      name: known?.name ?? printed?.name ?? 'Potion',
      quantity: 1,
      note: known?.text ?? printed?.text,
    });
  }
  inventory.push(...draft.inventory.filter((e) => e.name.trim() !== ''));

  const notes = klass.backgroundQuestions
    .map((q, i) => ({ q, a: (draft.background[i] ?? '').trim() }))
    .filter((row) => row.a !== '')
    .map((row) => `${row.q}\n${row.a}`)
    .join('\n\n');

  const connections = klass.connectionQuestions
    .map((q, i) => ({ q, a: (draft.connections[i] ?? '').trim() }))
    .filter((row) => row.a !== '')
    .map((row) => `${row.q} — ${row.a}`);

  const ancestryRefs = draft.mixed
    ? [draft.ancestryTop, draft.ancestryBottom].filter((r): r is Ref => r !== null)
    : draft.ancestryTop !== null
      ? [draft.ancestryTop]
      : [];

  return {
    name: draft.name.trim(),
    pronouns: draft.pronouns.trim(),
    classRef: klass.id,
    subclassRefs: draft.subclassRef === null ? [] : [draft.subclassRef],
    ancestryRefs,
    communityRef: draft.communityRef,
    level: 1,
    traits,
    // Two cards at level 1 fit inside the five-card loadout, so they start active.
    loadout: draft.cards,
    vault: [],
    activePrimaryWeapon: draft.primary,
    activeSecondaryWeapon: draft.secondary,
    activeArmor: draft.armor,
    inventory,
    /*
     * Every Experience the draft holds, named or not.
     *
     * This used to filter the unnamed ones out, two lines after the review
     * screen promised the opposite: "Both Experiences are worth +2 whether or
     * not you have named them." The screen said you still had them and the
     * character was created without them - so a player who left the naming for
     * later reached the Play screen with no Experiences at all, no chips to
     * arm, and nothing saying where they went.
     *
     * The rules are not ambiguous about this. A character has two Experiences
     * at +2 from creation; the name is a label the player attaches to
     * something they already own, and the SRD's own advice is that some of a
     * character is discovered in play. So the two are created, an unnamed one
     * reads as UNNAMED until it is given a name, and Build's editor is where
     * that happens.
     */
    experiences: draft.experiences,
    gold: draft.gold,
    connections,
    notes,
  };
}
