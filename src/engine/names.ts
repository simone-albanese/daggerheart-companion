/**
 * Names for the people and the places a GM has to invent mid-sentence.
 *
 * A GM improvising needs a name in the two seconds before the table notices
 * they are stalling. The Core Book answers that with four printed lists; this
 * app cannot carry those lists, and the whole design of this module is the
 * consequence of that one fact rather than of anything about generators.
 *
 * ## PROVENANCE
 *
 * The Core Book's four name lists - first names, family names, region names,
 * place names, 128 entries between them - are **not** the source of anything
 * in this file. Not their words. Not their fragments. Not their pattern of
 * fragments. No entry of theirs was cut into syllables, no syllable of theirs
 * was recombined, and no table below was seeded by looking at what shapes
 * their entries take and copying the shapes. The vocabulary here was written
 * for this file, out of English plant, landscape and trade words, to match the
 * register the owner approved: short and botanical over real-world surnames.
 *
 * **This rule cannot be verified from the output, and no test below claims to
 * verify it.** Two people can invent `Ashdale` independently, and a table
 * built the forbidden way and a table built honestly can produce the same
 * string; an absence of collisions proves the tables are *different*, never
 * that they are *independent*. Provenance is a fact about how the words got
 * here, and the only record of it is this paragraph. That is exactly why it is
 * written down instead of tested: a promise a test could keep does not need to
 * be made, and this one cannot be kept by a test at all.
 *
 * The Core Book is not redistributable (README "Legal"; Architecture §12); the
 * SRD 1.0 is, which is why `data/srd-1.0.json` is committed and no PDF ever
 * will be. Nothing here reads either at runtime.
 *
 * ## COLLISION
 *
 * Nothing this module can emit may already exist in the shipped dataset. That
 * is a different promise from PROVENANCE, and unlike PROVENANCE it **is**
 * verifiable, exhaustively - `tests/engine/names.test.ts` enumerates the
 * entire producible string space, all {@link PRODUCIBLE} of it, and asserts the
 * intersection with every `name` field in `data/srd-1.0.json` is empty.
 *
 * That test is not a formality, and sampling is not a substitute for it. An
 * earlier attempt at these tables enumerated to 268,871 strings and emitted
 * ten it had no business emitting - five Core Book entries verbatim and five
 * words the SRD already ships - while a thirty-draw random sample of it came
 * back looking perfectly clean. One bad string in 190,000 is invisible to
 * sampling and obvious to enumeration, so the space is deliberately kept small
 * enough to enumerate on every run.
 *
 * ## Why the generators take `taken`
 *
 * A {@link NameGenerator} is `(rng, taken) => string`, never `(rng) => string`.
 * COLLISION is a promise about the *dataset*, kept by construction and proved
 * by the test. `taken` is the other collision, the one construction cannot
 * reach: the names already in play at this table - the NPCs on the board, the
 * rows in tonight's session, the sheets the players sent, and whatever this
 * tool has already handed the GM in this sitting. A generator that cannot be
 * told those will sooner or later name the second guard after the first one,
 * and it is a 336-string place space, so "sooner" is the honest word.
 *
 * Avoidance is exact rather than best-effort: the draw retries, and if the rng
 * keeps landing on taken strings it falls back to filtering the kind's whole
 * enumerated space. The one case it cannot honour is a `taken` that covers the
 * entire space of a kind, and there it repeats rather than refuses - a GM who
 * asks for a name gets a name. See {@link drawFrom}.
 *
 * ## What the words are for
 *
 * Three kinds, because a GM asks for three different things. A person, in the
 * register above; a settlement, which reads as one compound word; and a region
 * or landmark, which reads as a phrase. The Core Book splits its own four
 * lists differently - first / family / region / place - and this split is not
 * that one, on purpose.
 */
import type { Rng } from './dice.ts';

/** What the GM asked for. */
export type NameKind = 'person' | 'place' | 'region';

/**
 * The shape every generator has, and the reason the second argument exists is
 * the docblock above: without it the tool cannot avoid the name it handed out
 * ninety seconds ago.
 */
export type NameGenerator = (rng: Rng, taken: ReadonlySet<string>) => string;

// ---------------------------------------------------------------------------
// The vocabulary
//
// Every list below was written for this file. See PROVENANCE above; the rule
// that matters about these words is not in the code, and cannot be.
// ---------------------------------------------------------------------------

/** Given names: plants, mostly, and a few short blunt ones for contrast. */
const GIVEN = [
  'Alder',
  'Amaranth',
  'Aster',
  'Bracken',
  'Bramble',
  'Briar',
  'Campion',
  'Cedar',
  'Cress',
  'Dittany',
  'Fennel',
  'Fen',
  'Foxglove',
  'Gorse',
  'Hazel',
  'Heather',
  'Hemlock',
  'Juniper',
  'Larkspur',
  'Linden',
  'Lupin',
  'Madder',
  'Mallow',
  'Marigold',
  'Mullein',
  'Nettle',
  'Oleander',
  'Pell',
  'Pennyroyal',
  'Quince',
  'Rix',
  'Rowan',
  'Rue',
  'Sedge',
  'Sorrel',
  'Tansy',
  'Teasel',
  'Thistle',
  'Vervain',
  'Yarrow',
  'Zinnia',
] as const;

/**
 * The first half of a made surname. These are never emitted on their own -
 * only ever glued to a {@link SURNAME_TAIL} - which is why a stem may be a
 * word that would collide as a name and the pair it makes does not.
 */
const SURNAME_STEM = [
  'Ash',
  'Brack',
  'Bram',
  'Corn',
  'Elm',
  'Fern',
  'Glen',
  'Hart',
  'Heath',
  'Larch',
  'Marsh',
  'Mere',
  'Oak',
  'Reed',
  'Rye',
  'Sedge',
  'Sloe',
  'Thorn',
  'Vine',
  'Wynd',
  'Yew',
] as const;

/** The second half. Landscape endings, the way English place-surnames end. */
const SURNAME_TAIL = [
  'brook',
  'combe',
  'dale',
  'field',
  'ford',
  'holm',
  'mead',
  'shaw',
  'stone',
  'thorpe',
  'wick',
  'worth',
] as const;

/**
 * Surnames that are one word rather than two halves, because a table of pure
 * compounds reads as a table within three draws.
 */
const SURNAME_WHOLE = [
  'Carrow',
  'Denby',
  'Elverson',
  'Fairbairn',
  'Garrow',
  'Hollis',
  'Marlowe',
  'Nyland',
  'Ostrander',
  'Pemberly',
  'Ransome',
  'Salter',
  'Sowerby',
  'Thackery',
  'Wexley',
  'Yardley',
] as const;

/** A settlement's first half. */
const PLACE_STEM = [
  'Aster',
  'Barrow',
  'Bracken',
  'Briar',
  'Cinder',
  'Dapple',
  'Ember',
  'Fallow',
  'Garn',
  'Harrow',
  'Larch',
  'Lorn',
  'Marram',
  'Nettle',
  'Osier',
  'Pell',
  'Rill',
  'Sable',
  'Sedge',
  'Tarn',
  'Umber',
  'Vesper',
  'Wold',
  'Yarrow',
] as const;

/** Its second half. Water, edge and weather, so the word sounds inhabited. */
const PLACE_TAIL = [
  'crest',
  'fell',
  'gate',
  'hallow',
  'haven',
  'march',
  'mire',
  'moor',
  'mouth',
  'reach',
  'run',
  'spire',
  'tide',
  'weald',
] as const;

/** The landform a region is named after: "<Valley> of Quiet Trade". */
const REGION_FORM = [
  'Basin',
  'Coast',
  'Downs',
  'Hollows',
  'Marches',
  'Reach',
  'Straits',
  'Valley',
  'Verge',
  'Weald',
] as const;

/** The adjective both region phrasings turn on. */
const REGION_ADJECTIVE = [
  'Amber',
  'Borrowed',
  'Brackish',
  'Frostbound',
  'Gilded',
  'Hungry',
  'Kindly',
  'Middling',
  'Patient',
  'Quiet',
  'Second',
  'Sundered',
  'Sunken',
  'Tenth',
  'Uncounted',
  'Waking',
  'Wandering',
  'Weeping',
] as const;

/** What was done there, or what stands there. */
const REGION_NOUN = [
  'Almshouse',
  'Aviary',
  'Bargain',
  'Bell',
  'Chapel',
  'Cistern',
  'Crossing',
  'Ferry',
  'Granary',
  'Harvest',
  'Kiln',
  'Lantern',
  'Millrace',
  'Orchard',
  'Rookery',
  'Sundial',
  'Toll',
  'Trade',
  'Vintner',
  'Wharf',
] as const;

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** `Rng` is 1-based, every table here is 0-based, and this is the only place that knows. */
const pick = <T,>(table: readonly T[], rng: Rng): T => table[rng(table.length) - 1] as T;

/**
 * Draw one string of a kind, avoiding `taken`.
 *
 * Rejection first, because it is O(1) in the overwhelmingly normal case where a
 * table has named four NPCs all evening. The bounded loop then hands over to
 * the enumerated space rather than looping harder: with `taken` covering most
 * of a kind, rejection degenerates, and the space is small enough that
 * filtering it is cheaper than the retries would have been.
 *
 * A `taken` that covers the kind entirely is the one request this cannot
 * honour, and it repeats instead of throwing or returning an empty string.
 * Refusing to answer would put the failure on the screen of a GM who is
 * mid-sentence; handing back a name they have already used is a thing they can
 * see and reject in the same glance.
 */
function drawFrom(
  kind: NameKind,
  compose: (rng: Rng) => string,
  rng: Rng,
  taken: ReadonlySet<string>,
): string {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = compose(rng);
    if (!taken.has(candidate)) return candidate;
  }
  const all = space(kind);
  const free = all.filter((name) => !taken.has(name));
  return pick(free.length === 0 ? all : free, rng);
}

/**
 * A person: a given name, and three times in four a surname as well.
 *
 * The bare given name is not a shortcut. Most of the people a GM names in
 * passing are named once and by one word - the innkeeper, the guard on the
 * gate - and a generator that always hands back two makes the GM do the
 * discarding.
 */
const composePerson = (rng: Rng): string => {
  const given = pick(GIVEN, rng);
  if (rng(4) === 1) return given;
  return `${given} ${composeSurname(rng)}`;
};

const composeSurname = (rng: Rng): string =>
  rng(SURNAME_STEM.length * SURNAME_TAIL.length + SURNAME_WHOLE.length) <= SURNAME_WHOLE.length
    ? pick(SURNAME_WHOLE, rng)
    : `${pick(SURNAME_STEM, rng)}${pick(SURNAME_TAIL, rng)}`;

const composePlace = (rng: Rng): string => `${pick(PLACE_STEM, rng)}${pick(PLACE_TAIL, rng)}`;

/**
 * A region or a landmark, in the two phrasings the register uses: "Valley of
 * Quiet Trade" and "The Gilded Chapel". The second is a tenth of the space and
 * is drawn a quarter of the time, because a run of the first alone stops
 * sounding like a map.
 */
const composeRegion = (rng: Rng): string => {
  const adjective = pick(REGION_ADJECTIVE, rng);
  const noun = pick(REGION_NOUN, rng);
  if (rng(4) === 1) return `The ${adjective} ${noun}`;
  return `${pick(REGION_FORM, rng)} of ${adjective} ${noun}`;
};

// ---------------------------------------------------------------------------
// The producible space
// ---------------------------------------------------------------------------

/**
 * Every string a kind can produce, in a fixed order.
 *
 * Exported because the COLLISION test's whole argument is that it enumerates
 * the *entire* space rather than sampling it, and a test that rebuilt the
 * enumeration from the tables would be checking its own copy of the generator
 * instead of this one. `drawFrom` uses the same function for its fallback, so
 * the list the test checks is the list the app can reach.
 */
export function enumerateNames(kind: NameKind): string[] {
  if (kind === 'person') {
    const surnames = [
      ...SURNAME_WHOLE,
      ...SURNAME_STEM.flatMap((stem) => SURNAME_TAIL.map((tail) => `${stem}${tail}`)),
    ];
    return GIVEN.flatMap((given) => [given, ...surnames.map((s) => `${given} ${s}`)]);
  }
  if (kind === 'place') {
    return PLACE_STEM.flatMap((stem) => PLACE_TAIL.map((tail) => `${stem}${tail}`));
  }
  return REGION_ADJECTIVE.flatMap((adjective) =>
    REGION_NOUN.flatMap((noun) => [
      `The ${adjective} ${noun}`,
      ...REGION_FORM.map((form) => `${form} of ${adjective} ${noun}`),
    ]),
  );
}

/** The three, in the order the tool offers them. */
export const NAME_KINDS: readonly NameKind[] = ['person', 'place', 'region'];

/**
 * How many distinct strings this module can ever emit: 15,325.
 *
 * 11,029 people (41 given names, each alone and each against 268 surnames -
 * 16 whole ones and 21 stems by 12 endings), 336 settlements (24 by 14), and
 * 3,960 regions (18 adjectives by 20 nouns, each in "The ..." and in ten
 * landforms).
 *
 * Pinned as a number so that widening a table has to come here and say the new
 * one out loud, and so the enumeration test fails rather than quietly checking
 * a space that grew. It is deliberately small - a space that cannot be
 * enumerated in a test cannot keep the COLLISION promise, and a promise that is
 * only sampled is the one that shipped `Hollow Keep`.
 */
export const PRODUCIBLE = 15_325;

/**
 * `enumerateNames`, memoised, and built on first use rather than at import.
 *
 * Only `drawFrom`'s fallback needs it, and that runs when the rng has landed on
 * 24 taken strings in a row - which on a table that has named four NPCs all
 * evening is never. Building all three spaces eagerly would put 15,325 strings
 * in memory on every phone that opens the GM screen, for a path most sessions
 * never take. Once built it is kept: a GM in the state that needs it is about
 * to be in it again on the next tap.
 */
const memo = new Map<NameKind, string[]>();
function space(kind: NameKind): string[] {
  const had = memo.get(kind);
  if (had !== undefined) return had;
  const built = enumerateNames(kind);
  memo.set(kind, built);
  return built;
}

/** The generator for each kind. `(rng, taken) => string`, all three. */
export const NAME_GENERATORS: Record<NameKind, NameGenerator> = {
  person: (rng, taken) => drawFrom('person', composePerson, rng, taken),
  place: (rng, taken) => drawFrom('place', composePlace, rng, taken),
  region: (rng, taken) => drawFrom('region', composeRegion, rng, taken),
};

/** The one call the screen makes. */
export const drawName = (kind: NameKind, rng: Rng, taken: ReadonlySet<string>): string =>
  NAME_GENERATORS[kind](rng, taken);
