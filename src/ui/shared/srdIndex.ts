/**
 * Everything the app ships, flattened into one thing a search can walk.
 *
 * ## The measurement this file exists to answer
 *
 * `searchRules` searches `dataset.rules`: **69 sections** out of the **1438**
 * records the app ships. The other 1369 - every weapon, every domain card, every
 * adversary in the bestiary this same app draws - were not in any haystack.
 * Typing `Rally` got the honest silence the search draws for a word that is not
 * in the book, and `Rally` is the Bard's class feature, printed on the sheet of
 * anyone playing one. Typing `Acid Burrower` got the same silence, and it is an
 * adversary at p.75 of the same file, on the GM's own Bestiary screen two taps
 * away. The silence was not a bug in the matcher: the matcher was never given
 * the words.
 *
 * (The plan this part comes from offered `Rally` as *a domain card*. It is not
 * one - no record of any kind is named `Rally`, and the word is a class feature
 * name in `classes` plus three subclass features that grant its die. The
 * example survives being wrong about which shelf it was on, which is why it is
 * kept and corrected rather than swapped: what it was chosen to show is that
 * the word is in the book and the search could not see it, and that was true of
 * it all along. `srdIndex.test.ts` pins where it actually lives.)
 *
 * So this file builds the other haystack. It does not replace `searchRules` and
 * it does not narrow it - a rules section is still searched by the function
 * whose name says rules, because only a rules hit can be *landed* in and lit,
 * and that machinery lives in `RuleSearch.tsx` around `SectionView`. What this
 * adds is the rest of the book, found by name and by its own words.
 *
 * ## The rule this file inherits from `srdReference.ts`
 *
 * Every string a record contributes to its own haystack came out of
 * `data/srd-1.0.json` at runtime. Not one of the book's sentences is typed
 * here. The `label` on a field is the app's word and never the book's - it is
 * the same kind of word `StatBlock.tsx` already prints as `IMPULSES · ` above
 * the SRD's own impulses - and **a label is never in the haystack**, so no
 * search can match on it and no preview line can quote one. That split is the
 * whole of the honesty here: what is searched and what is quoted are the
 * record's own words; what is drawn beside them is the app's furniture.
 *
 * It is strict enough to cost a capital letter, and the cost is worth naming. A
 * weapon's trait is `agility` in the dataset and `Agility` in `TRAIT_LABELS`,
 * which is the table every sheet in this app draws it through - and this file
 * does not use it. A line here can be quoted back to the GM as the book's, so
 * it has to *be* the book's, down to the case the JSON was written in;
 * capitalising it would put a string this repository composed inside a haystack
 * and inside a preview. That is what makes the invariant checkable in one
 * assertion - `srdIndex.test.ts` walks every line of all 1438 records and finds
 * each one verbatim among the dataset's own strings - and an invariant with an
 * exception list is an invariant that grows one more exception a year.
 *
 * ## Why the unit of the AND is the record and not the line
 *
 * `searchRules` requires every word of the query in **one body line**, read
 * together with the section's title, and the docblock there measures what that
 * scoping buys: seventeen of eighty-two section-wide hits had their words in
 * different paragraphs and could not quote a line that carried them.
 *
 * **That reasoning does not transfer, and the reason is what a record is.** A
 * rules section is many subjects under one title - `Attacking` covers damage,
 * resistance, multi-target rolls - so words in two of its paragraphs are words
 * about two different things. A weapon is *one* thing with a handful of short
 * fields. `broadsword melee` asking for both words in one field is asking for a
 * field that does not exist; asking for them in one **record** is asking
 * exactly what the person typing meant. The plan named this as the one part of
 * the index with a rewrite in it - "the cheap reject is written for section
 * bodies, and has to be rewritten for a record with twenty short fields" - and
 * this is that rewrite: the reject is the same, the *scope* of the AND is the
 * record.
 *
 * What the record-wide AND owes, and pays, is a preview line. `quoteIn` below
 * returns the field line carrying the **most** of the query's words, so a hit
 * quotes the best evidence it has rather than the first. Where the words are
 * genuinely spread across two fields no single line carries them all, and the
 * row shows the strongest one under a name that carries the rest - which is the
 * same "read the line with the title" the rules search relies on.
 *
 * ## There is no OR fallback here, and that is a decision
 *
 * `searchRules` falls back to the sections carrying *some* of the words when
 * nothing carries them all, and labels that list with a header saying so. This
 * does not, and the asymmetry is deliberate.
 *
 * The fallback earns its place over sections because a section is a large body
 * where one inflection - `sets` where the GM typed `setting` - can hide the
 * answer, and eighteen sections is a list a person can still read. An OR over
 * **1369 short records** is neither: a common word reaches hundreds of them, and
 * a list of hundreds is not an answer at any size of type. The owner's standing
 * constraint of 2026-08-26 - readability and glanceability in consultation,
 * nothing too small - forbids the only way such a list would fit. So when
 * nothing in the book beyond the rules carries every word, this says nothing,
 * and the rules search's own labelled fallback stands alone and unhelped.
 */
import type {
  Adversary,
  Ancestry,
  Beastform,
  CharClass,
  Community,
  Dataset,
  Domain,
  DomainCard,
  Environment,
  Feature,
  Item,
  Ref,
  RulesSection,
  Stance,
  Subclass,
  Transformation,
  Weapon,
  Armor,
} from '../../../shared/types.ts';
import { ruleTerms, wholeWordIn, type RuleMatchKind } from './srdReference.ts';

/**
 * Which collection of the dataset a record came out of.
 *
 * One per array in `Dataset`, plus `loot` and `consumable` split out of the
 * single `Item` shape because the two are separate collections in the dataset
 * and separate things at a table. `rules` is a kind like any other: the index
 * is *everything the app ships*, and a caller that wants only the 1369 the rules
 * search cannot reach says so at its own call site rather than being handed a
 * second, quietly different index.
 */
export type SrdKind =
  | 'rules'
  | 'domain'
  | 'domainCard'
  | 'class'
  | 'subclass'
  | 'beastform'
  | 'ancestry'
  | 'community'
  | 'transformation'
  | 'stance'
  | 'weapon'
  | 'armor'
  | 'loot'
  | 'consumable'
  | 'adversary'
  | 'environment';

/** What each kind is called on the glass, above the hits that belong to it. */
export const SRD_KIND_LABELS: Record<SrdKind, string> = {
  rules: 'RULES',
  domain: 'DOMAINS',
  domainCard: 'DOMAIN CARDS',
  class: 'CLASSES',
  subclass: 'SUBCLASSES',
  beastform: 'BEASTFORMS',
  ancestry: 'ANCESTRIES',
  community: 'COMMUNITIES',
  transformation: 'TRANSFORMATIONS',
  stance: 'MARTIAL STANCES',
  weapon: 'WEAPONS',
  armor: 'ARMOR',
  loot: 'LOOT',
  consumable: 'CONSUMABLES',
  adversary: 'ADVERSARIES',
  environment: 'ENVIRONMENTS',
};

/**
 * The order the kinds are drawn in, which is the dataset's own order with the
 * two `Item` collections kept where the dataset keeps them.
 *
 * It is not a ranking and nothing here decides which kind a person meant. It is
 * the same refusal `searchRules` makes when it declines to sort its fallback:
 * an order that looked like relevance would be this file guessing.
 */
export const SRD_KINDS: readonly SrdKind[] = [
  'rules',
  'domain',
  'domainCard',
  'class',
  'subclass',
  'beastform',
  'ancestry',
  'community',
  'transformation',
  'stance',
  'weapon',
  'armor',
  'loot',
  'consumable',
  'adversary',
  'environment',
];

/**
 * One field of a record: the app's name for it, and the record's own words.
 *
 * `lines` is what goes in the haystack and what a hit can quote, one line each,
 * verbatim. `label` is drawn beside them and is never searched - see the header.
 * A field with no lines is not emitted at all, so a record that is missing an
 * optional field draws nothing where it would have been rather than a heading
 * over an empty space.
 */
export interface SrdField {
  label: string;
  lines: readonly string[];
}

/**
 * One record of the shipped dataset, in the shape a search and a reader both
 * want.
 *
 * `haystack` is exactly `fields` flattened and newline-joined - built together
 * with them, from the same walk, so the words that can be **found** and the
 * words that are **drawn** cannot drift apart. That is the property the whole
 * file is arranged around: a search that finds a record by a word the open
 * record does not show would be the search pointing at something that is not
 * there.
 */
export interface SrdRecord {
  kind: SrdKind;
  id: Ref;
  name: string;
  page: number | null;
  fields: readonly SrdField[];
  haystack: string;
}

/** A record the query landed in. `where` is `title` or `text`; see `searchSrd`. */
export interface SrdHit {
  kind: SrdKind;
  id: Ref;
  name: string;
  page: number | null;
  where: RuleMatchKind;
  /**
   * The field line the query landed in, verbatim and whole. Null for a `title`
   * hit, which asked for the record by name and has no line to add. Any
   * shortening for a narrow column is the screen's business.
   */
  line: string | null;
}

// ---------------------------------------------------------------------------
// The walk: a record's own words, in the order it reads
// ---------------------------------------------------------------------------

/** A field, dropped when it has nothing in it. */
const field = (label: string, lines: ReadonlyArray<string | null | undefined>): SrdField[] => {
  const kept = lines.filter((line): line is string => typeof line === 'string' && line.trim() !== '');
  return kept.length === 0 ? [] : [{ label, lines: kept }];
};

/**
 * A feature as two lines rather than one joined string.
 *
 * Joining them would need a separator this repository typed, sitting inside a
 * line the row then quotes as the book's - the one thing the header forbids.
 * Two lines cost a query that names the feature *and* a word from its text, and
 * that query is answered anyway: the AND here is over the whole record, so both
 * lines are in scope and the quote goes to whichever carries more of it.
 */
const featureLines = (features: readonly Feature[]): string[] =>
  features.flatMap((f) => [f.name, f.text]);

const domainFields = (d: Domain): SrdField[] => field('ABOUT', [d.description]);

const domainCardFields = (c: DomainCard, domains: readonly Domain[]): SrdField[] => [
  ...field('DOMAIN', [domains.find((d) => d.id === c.domain)?.name]),
  ...field('TYPE', [c.type]),
  ...field('TEXT', [c.text]),
  ...field('FLAVOR', [c.flavorText]),
];

const classFields = (c: CharClass): SrdField[] => [
  ...field('ABOUT', [c.description]),
  ...field('HOPE FEATURE', featureLines([c.hopeFeature])),
  ...field('CLASS FEATURES', featureLines(c.classFeatures)),
  ...field('EQUIPMENT', c.suggestedEquipment),
  ...field('CLASS ITEMS', c.classItems),
  ...field('BACKGROUND', c.backgroundQuestions),
  ...field('CONNECTIONS', c.connectionQuestions),
];

const subclassFields = (s: Subclass): SrdField[] => [
  ...field('SPELLCAST', [s.spellcastTrait]),
  ...field('FOUNDATION', featureLines(s.foundationFeatures)),
  ...field('SPECIALIZATION', featureLines(s.specializationFeatures)),
  ...field('MASTERY', featureLines(s.masteryFeatures)),
];

const beastformFields = (b: Beastform): SrdField[] => [
  ...field('CATEGORY', [b.category]),
  ...field('EXAMPLES', b.examples),
  ...field('ATTACK', [b.attack.name, b.attack.range, b.attack.trait, b.attack.damage]),
  ...field('ADVANTAGE ON', b.advantageOn),
  ...field('FEATURES', featureLines(b.features)),
];

const ancestryFields = (a: Ancestry): SrdField[] => [
  ...field('ABOUT', [a.description]),
  ...field('FEATURES', featureLines(a.features)),
];

const communityFields = (c: Community): SrdField[] => [
  ...field('ABOUT', [c.description]),
  ...field('TRAITS', c.traits),
  ...field('FEATURE', featureLines([c.feature])),
];

/**
 * A transformation card: its prose, its features, its questions.
 *
 * The three fields are the three the book prints, in the order it prints them
 * (folios 43-45: name, prose, `TRANSFORMATION FEATURES`, `TRANSFORMATION
 * QUESTIONS`), and each is the record's own strings. QUESTIONS is a field
 * rather than being dropped for the reason `CharClass.backgroundQuestions` is
 * indexed: a prompt is a line a player reads and therefore a line they can
 * look for, and it is the book's wording, not this repository's.
 */
const transformationFields = (t: Transformation): SrdField[] => [
  ...field('ABOUT', [t.description]),
  ...field('FEATURES', featureLines(t.features)),
  ...field('QUESTIONS', t.questions),
];

/**
 * A martial stance: one field, holding its one sentence.
 *
 * The book prints a name and a rule and nothing else - no prose, no features,
 * no prompts - so there is one field and it is the record's own words. The TIER
 * is deliberately not a field, for the reason the header gives about numbers: a
 * bare `1` is a substring of hundreds of records, and `TIER 1` would be a line
 * this repository composed sitting inside a haystack and quotable as the
 * book's. A person looking for tier-2 stances is filtering, not searching.
 *
 * `TEXT` and not `RULE` or `EFFECT`, because `TEXT` is the label this file
 * already gives a domain card's rules text and a loot item's - the same kind of
 * string under the same word.
 */
const stanceFields = (s: Stance): SrdField[] => field('TEXT', [s.text]);

const weaponFields = (w: Weapon): SrdField[] => [
  ...field('CATEGORY', [w.category]),
  ...field('SLOT', [w.slot]),
  ...field('TRAIT', [w.trait]),
  ...field('RANGE', [w.range]),
  ...field('DAMAGE', [w.damage]),
  ...field('FEATURE', [w.feature]),
];

const armorFields = (a: Armor): SrdField[] => field('FEATURE', [a.feature]);

const itemFields = (i: Item): SrdField[] => field('TEXT', [i.text]);

const adversaryFields = (a: Adversary): SrdField[] => [
  ...field('ROLE', [a.role]),
  ...field('ABOUT', [a.description]),
  ...field('MOTIVES', a.motives),
  ...field('ATTACK', [a.attack.name, a.attack.range, a.attack.damage]),
  ...field('EXPERIENCES', a.experiences.map((e) => e.name)),
  ...field('FEATURES', featureLines(a.features)),
];

const environmentFields = (e: Environment): SrdField[] => [
  ...field('TYPE', [e.type]),
  ...field('ABOUT', [e.description]),
  ...field('IMPULSES', [e.impulses]),
  ...field('POTENTIAL ADVERSARIES', e.potentialAdversaries),
  ...field('FEATURES', featureLines(e.features)),
];

/**
 * A rules section as one field holding its whole body.
 *
 * The section is in the index because the index is everything the app ships,
 * and it is one undivided field because nothing reads it here: `RuleSearch.tsx`
 * searches sections through `searchRules` and draws them through `ruleSection`,
 * which is the pipeline that knows about `## ` subheads, bullets and pipe
 * tables. Splitting the body a second way in this file would be the second
 * renderer both files refuse to grow.
 */
const rulesFields = (s: RulesSection): SrdField[] => field('TEXT', [s.body]);

/** Numbers are not in any haystack; see `srdRecord`. */
const build = (
  kind: SrdKind,
  id: Ref,
  name: string,
  page: number | undefined,
  fields: SrdField[],
): SrdRecord => ({
  kind,
  id,
  name,
  page: page ?? null,
  fields,
  haystack: fields.flatMap((f) => f.lines).join('\n'),
});

/**
 * Every record the app ships, flattened. **1438** in the shipped dataset - the
 * 69 rules sections and the 1369 the rules search cannot reach.
 *
 * 849 and 780 on SRD 1.0. Both figures are pinned in `tests/ui/srdIndex.test.ts`
 * and moved with the switch; the six transformations and the sixteen martial
 * stances are in the 1369.
 *
 * ## What is deliberately not in a haystack
 *
 * **No number.** A weapon's tier, an adversary's HP, a card's recall cost and a
 * loot item's d100 roll are all absent, and leaving them out is the decision
 * rather than an omission. A bare `2` is a substring of a hundred records and
 * would make `tier 2 weapon` return the book; putting it in as `TIER 2` would
 * mean a line this repository composed sitting in a haystack and quotable as
 * the book's own words, which the header forbids. Numbers are drawn beside
 * their labels by the screens that already draw them - `StatBlock`'s stat grid,
 * `DomainCardView`'s cost - and a person looking for a tier is filtering, not
 * searching. A filter is a different control and this is not it.
 *
 * **No id.** `giant-rat` is not what anyone types, and the name is.
 *
 * ## Cost
 *
 * Built once per dataset and memoised by the caller, not per keystroke: the
 * walk allocates a few thousand short strings, which is a keystroke's worth of
 * work exactly once, and a layer that rewrites a collection rebuilds it by
 * changing the identity of `dataset`. Searching it costs what `searchRules`
 * costs and less: the reject is one `includes` per term against a haystack that
 * is a few hundred characters where a section's is a few thousand, and 1369
 * short rejects are cheaper than 69 long ones.
 */
export function srdIndex(dataset: Dataset): SrdRecord[] {
  const out: SrdRecord[] = [];
  for (const s of dataset.rules) out.push(build('rules', s.id, s.title, s.sourcePage, rulesFields(s)));
  for (const d of dataset.domains) out.push(build('domain', d.id, d.name, d.sourcePage, domainFields(d)));
  for (const c of dataset.domainCards) {
    out.push(build('domainCard', c.id, c.name, c.sourcePage, domainCardFields(c, dataset.domains)));
  }
  for (const c of dataset.classes) out.push(build('class', c.id, c.name, c.sourcePage, classFields(c)));
  for (const s of dataset.subclasses) out.push(build('subclass', s.id, s.name, s.sourcePage, subclassFields(s)));
  for (const b of dataset.beastforms) out.push(build('beastform', b.id, b.name, b.sourcePage, beastformFields(b)));
  for (const a of dataset.ancestries) out.push(build('ancestry', a.id, a.name, a.sourcePage, ancestryFields(a)));
  for (const c of dataset.communities) out.push(build('community', c.id, c.name, c.sourcePage, communityFields(c)));
  /*
   * Six on SRD 2.0, none on SRD 1.0, and the empty case is why this loop was
   * missing rather than why it should be. `Dataset.transformations` is required
   * and empty for a book without the chapter (its docblock: "empty is the
   * honest value"), so on the dataset the app ships today this contributes
   * nothing and `SRD_KIND_LABELS.transformation` labels a band with no rows in
   * it. The alternative - a kind that appears only when the dataset has one -
   * is a search whose vocabulary changes under the reader.
   */
  for (const t of dataset.transformations) {
    out.push(build('transformation', t.id, t.name, t.sourcePage, transformationFields(t)));
  }
  /*
   * Sixteen on SRD 2.0, none on SRD 1.0 - the same shape as the loop above and
   * for the same reason. This is the loop whose absence the whole file's opening
   * measurement is about: before it, typing `Otherworldly` into the search got
   * the honest silence drawn for a word that is not in the book, about a stance
   * the app now ships, draws on the sheet and mints a wire id for.
   */
  for (const s of dataset.stances) out.push(build('stance', s.id, s.name, s.sourcePage, stanceFields(s)));
  for (const w of dataset.weapons) out.push(build('weapon', w.id, w.name, w.sourcePage, weaponFields(w)));
  for (const a of dataset.armors) out.push(build('armor', a.id, a.name, a.sourcePage, armorFields(a)));
  for (const i of dataset.loot) out.push(build('loot', i.id, i.name, i.sourcePage, itemFields(i)));
  for (const i of dataset.consumables) out.push(build('consumable', i.id, i.name, i.sourcePage, itemFields(i)));
  for (const a of dataset.adversaries) out.push(build('adversary', a.id, a.name, a.sourcePage, adversaryFields(a)));
  for (const e of dataset.environments) {
    out.push(build('environment', e.id, e.name, e.sourcePage, environmentFields(e)));
  }
  return out;
}

/**
 * The field line carrying the most of `terms`, or null when no line carries
 * any.
 *
 * "Most" and not "first", and unlike the section quote there is no heading to
 * prefer: a record has no subheads, so the two ranks that matter are how many
 * of the query's words a line carries and whether it carries them as whole
 * words. A tie goes to the earlier line, which is the record's own field order
 * - the order it was written in and the order it draws in.
 */
function quoteIn(haystack: string, terms: readonly string[]): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const raw of haystack.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const low = line.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (!low.includes(t)) continue;
      // Two points for the word itself, one for it inside a longer word, so a
      // line spelling the query out beats a line that merely contains it.
      score += wholeWordIn(low, t) ? 2 : 1;
    }
    if (score <= bestScore) continue;
    best = line;
    bestScore = score;
  }
  return best;
}

/**
 * Every record carrying every word of `query`: by name first, then by its own
 * words.
 *
 * Names first and then bodies, each in the index's order, which is the split
 * `searchRules` makes for the same reason it gives - a record whose *name* is
 * what you typed is a record you asked for by name. There is no middle band
 * here: `heading` belongs to a section's `## ` subheads and a record has none,
 * so `where` is only ever `title` or `text` and `table` never occurs.
 *
 * The AND is over the whole record rather than over one line; the header says
 * why, and says why there is no fallback when it finds nothing.
 */
/**
 * Fold what a phone keyboard cannot type.
 *
 * SRD 2.0 sets ten card names with a NON-BREAKING hyphen, U+2011: the nine
 * `*‑Touched` cards and `Battle‑Hardened`. SRD 1.0 had none. A player types
 * `Arcana-Touched` with the ASCII hyphen their keyboard offers and the app
 * answers *"Nothing in this dataset carries that"* — about a card it ships and
 * draws. Measured on the real Search screen: 0 of 10 found by the hyphen, all
 * 10 found by a space.
 *
 * Folded here rather than at extraction, because the NAME is right: the book
 * prints U+2011 so a card would not break across a line, and rewriting it would
 * be the app inventing a spelling. What is wrong is the comparison.
 *
 * The soft hyphen and zero-width space are folded too. They buy nothing on
 * either book — measured, one U+00AD and four U+200B in 224 pages, none in a
 * name — and they cost one character class here.
 */
export const foldQuery = (s: string): string =>
  s
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/[\u00AD\u200B]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

export function searchSrd(index: readonly SrdRecord[], query: string): SrdHit[] {
  const needle = foldQuery(query);
  if (needle === '') return [];
  const terms = ruleTerms(needle);

  const named: SrdHit[] = [];
  const bodies: SrdHit[] = [];

  for (const record of index) {
    // Folded on BOTH sides, or it buys nothing: a needle turned into an ASCII
    // hyphen still misses a haystack that kept U+2011.
    const name = foldQuery(record.name);
    const seen = { kind: record.kind, id: record.id, name: record.name, page: record.page };

    if (terms.every((t) => name.includes(t))) {
      named.push({ ...seen, where: 'title', line: null });
      continue;
    }
    // The cheap reject, once per term, against the record read whole. Most
    // records lose here on any real query and never pay for the line split.
    const low = foldQuery(record.haystack);
    if (!terms.every((t) => low.includes(t) || name.includes(t))) continue;

    const line = quoteIn(record.haystack, terms);
    // Unreachable while a record survived the reject above on something other
    // than its name alone, and answered rather than asserted: a record whose
    // every term came out of its *name* is a title hit and returned already.
    if (line === null) continue;
    bodies.push({ ...seen, where: 'text', line });
  }

  return [...named, ...bodies];
}
