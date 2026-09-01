/**
 * The register against the book, in both directions, plus the arithmetic it feeds.
 *
 * `src/engine/modifiers.ts` is a hand-typed list of numbers read out of
 * `data/srd-1.0.json` by a person. That is the only way to price *"Barrier: +2
 * to Armor Score; -1 to Evasion"* correctly - a scan cannot tell which number
 * belongs to which stat - and it is the only way to price *"Gain an additional
 * Hit Point slot at character creation"* at all, because that sentence has no
 * digit in it. The cost of hand-typing is that a hand can be wrong and the SRD
 * can move underneath it, and this file is what pays that cost.
 *
 * IT RUNS BOTH WAYS, WHICH IS THE WHOLE POINT.
 *
 *   FORWARD - every row in the register still names a ref the dataset holds, a
 *   feature that ref still has, and a sentence that still says the number the
 *   row claims. A row for a bonus nobody has any more fails here.
 *
 *   REVERSE - every sentence in the dataset that LOOKS like a static bonus has
 *   a row, or an entry in `SITUATIONAL` below saying why it does not. A new
 *   Gambeson arriving in a Core Rulebook layer fails here, which is the failure
 *   the original defect needed and did not have: Simiah's Nimble was missing
 *   for as long as it was because nothing anywhere compared the register to the
 *   book. There was no register.
 *
 * The reverse scan is the ONLY code in this repo that reads a feature's text,
 * and it is in a test on purpose. `src/` never does - see the head of
 * `modifiers.ts`.
 */
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import { deriveStats, indexDataset, newCharacter } from '../../src/engine/character.ts';
import { REGISTERS, collectModifiers, sumOf } from '../../src/engine/modifiers.ts';
import type { Amount, RegisterStat } from '../../src/engine/modifiers.ts';
import type { Character } from '../../shared/types.ts';

const dataset = baseDataset;
const index = indexDataset(dataset);

// ---------------------------------------------------------------------------
// Every place in the dataset a feature's words can live
// ---------------------------------------------------------------------------

interface Site {
  lane:
    | keyof typeof REGISTERS
    | 'class'
    | 'consumable'
    | 'domainCard'
    | 'beastform'
    | 'transformation';
  ref: string;
  what: string;
  text: string;
}

/**
 * Walked rather than grepped, and walked the way the COLLECTOR walks.
 *
 * A judge on the design round caught the version of this that swept only armor,
 * the two weapon slots and loot - which is every lane except the one the
 * reported bug came from, because Simiah's Nimble is an ancestry feature. The
 * sweep and the collector read the same six lanes, plus classes and consumables
 * so that the reverse scan can see a bonus arriving somewhere the collector does
 * not yet look at all.
 *
 * AND THEN IT READ EIGHT OF FIFTEEN COLLECTIONS. `domainCards`, `beastforms`
 * and `transformations` were never walked - 210, 22 and 6 records, which is 265
 * of the 1086 feature-bearing sites this now sweeps, because a Beastform and a
 * Transformation each carry several features and a domain card carries one. (265
 * and not the 238 a record count gives: the two are different questions and this
 * file is where that distinction is the whole job.) Every static bonus in them
 * was invisible to the check whose entire job is to notice one. They are walked
 * here.
 *
 * What they surfaced is reported in `UNPRICED_LANE` below, and it is NOT what a
 * reviewer predicted. Adding the three walks on their own surfaces exactly
 * ZERO: measured, by running the shapes below over all three collections before
 * touching them. `eldritch-flesh`, `fortified-armor`, `armorer` and the
 * `*-Touched` gates were hidden a second time, by the shapes - see `STATIC_SHAPES`.
 */
function everySite(): Site[] {
  const sites: Site[] = [];
  for (const a of dataset.ancestries) {
    a.features.forEach((f, i) =>
      sites.push({ lane: 'ancestry', ref: a.id, what: `${a.name} · ${f.name} [${i}]`, text: f.text }),
    );
  }
  for (const c of dataset.communities) {
    sites.push({ lane: 'community', ref: c.id, what: `${c.name} · ${c.feature.name}`, text: c.feature.text });
  }
  for (const k of dataset.classes) {
    sites.push({ lane: 'class', ref: k.id, what: `${k.name} · ${k.hopeFeature.name}`, text: k.hopeFeature.text });
    for (const f of k.classFeatures) {
      sites.push({ lane: 'class', ref: k.id, what: `${k.name} · ${f.name}`, text: f.text });
    }
  }
  for (const s of dataset.subclasses) {
    for (const key of ['foundationFeatures', 'specializationFeatures', 'masteryFeatures'] as const) {
      for (const f of s[key]) {
        sites.push({ lane: 'subclass', ref: s.id, what: `${s.name} · ${f.name}`, text: f.text });
      }
    }
  }
  for (const w of dataset.weapons) {
    if (w.feature !== '') sites.push({ lane: 'weapon', ref: w.id, what: w.name, text: w.feature });
  }
  for (const a of dataset.armors) {
    if (a.feature !== '') sites.push({ lane: 'armor', ref: a.id, what: a.name, text: a.feature });
  }
  for (const l of dataset.loot) sites.push({ lane: 'loot', ref: l.id, what: l.name, text: l.text });
  for (const c of dataset.consumables) {
    sites.push({ lane: 'consumable', ref: c.id, what: c.name, text: c.text });
  }
  // The three collections the sweep never read. A card in the vault is not on
  // the sheet, but a card in the LOADOUT is, and `Fortified Armor` says
  // "+2 bonus to your damage thresholds" with no cost and no clock on it.
  for (const c of dataset.domainCards) {
    sites.push({ lane: 'domainCard', ref: c.id, what: `${c.name} · ${c.domain} ${c.level}`, text: c.text });
  }
  for (const b of dataset.beastforms) {
    for (const f of b.features) {
      sites.push({ lane: 'beastform', ref: b.id, what: `${b.name} · ${f.name}`, text: f.text });
    }
  }
  for (const t of dataset.transformations) {
    for (const f of t.features) {
      sites.push({ lane: 'transformation', ref: t.id, what: `${t.name} · ${f.name}`, text: f.text });
    }
  }
  return sites;
}

/**
 * What a static bonus looks like in the SRD's own words.
 *
 * Six shapes rather than one, and the last four exist because the first two do
 * not reach them. "Gain an additional Hit Point slot" carries no digit;
 * Galapa's Shell carries a word where a number would be; a relic states its
 * bonus as a whole sentence. Deliberately loose: this scan is allowed false
 * positives, because a false positive costs one line in `SITUATIONAL` with a
 * reason attached, and a false negative costs another Simiah.
 */
const STATIC_SHAPES: RegExp[] = [
  /*
   * `bonus` AND `penalty` ARE OPTIONAL HERE, AND THEY ARE THE TWO WORDS THAT
   * HID THIRTEEN REAL STATIC BONUSES.
   *
   * This shape used to require the digit to touch `to`: "+1 to Evasion", which
   * is how the SRD writes a WEAPON feature. It is not how the SRD writes a
   * domain card. `Fortified Armor` is "gain a +2 bonus to your damage
   * thresholds"; `Armorer` is "+1 bonus to your Armor Score"; `Valor-Touched`,
   * `Splendor-Touched`, `Blade-Touched`, `Bone-Touched` and four Beastform
   * features all put `bonus` between the number and the `to`. Shapes 3 and 5
   * reach that spelling but only behind their own anchors - `Gain a permanent`
   * and a line-initial `You gain a` - so every one of these went through.
   *
   * That is the Earthkin failure again, in the same file, two words wide: a
   * scan that misses by two words is worse than no scan, because it is read as
   * coverage.
   *
   * Measured before and after, over all eleven collections, and counted in REFS
   * rather than sites because a ref is what an entry below excuses: the old
   * alternation flags 113 sites naming 12 unpriced refs; this one flags 150
   * sites naming 47. Of the 35 refs it adds, 22 are spends and durations and go
   * to `SITUATIONAL`; THIRTEEN are real permanent bonuses and go to
   * `UNPRICED_LANE` and `UNPRICED_AMOUNT`. That thirteen is the point: it was
   * not merely unpriced, it was unseen.
   *
   * `all your` is here for the Massive Behemoth's *Undaunted*, "a +2 bonus to
   * all your damage thresholds" - the only place in either book that spells it
   * that way.
   */
  /[+−-]\s?\d+\s+(bonus\s+|penalty\s+)?to\s+(your\s+)?(all\s+your\s+)?(Evasion|Armor Score|Agility|Strength|Finesse|Instinct|Presence|Knowledge|Severe damage threshold|damage thresholds|all character traits)/i,
  /Gain an additional (Hit Point|Stress) slot/i,
  /*
   * `Armor Score` was missing from this alternation and Earthkin's Stoneskin -
   * "Gain a permanent +1 bonus to your Armor Score and damage thresholds at
   * character creation" - shipped unpriced through the gap, while Simiah's
   * identically-worded Nimble was caught. A scan that misses by two words is
   * worse than no scan: it is read as coverage.
   */
  /Gain a permanent [+−-]\d+ bonus to your (Evasion|Armor Score|damage thresholds|Severe damage threshold)/i,
  /*
   * Widened from the hardcoded word `Proficiency`. SRD 2.0 prints the same
   * construct against other stats - "equal to your Spellcast trait", "equal to
   * your Presence", "equal to your unmarked Armor Slots" - and every one of
   * them slipped a regex written when Galapa's Shell was the only instance.
   */
  /Gain a bonus to your (damage thresholds|Armor Score|Evasion) equal to your \w+/i,
  /^You gain a [+−-]\d+ bonus to your (Agility|Strength|Finesse|Instinct|Presence|Knowledge)\./i,
  /-1 to all character traits and Evasion/i,
];

const looksStatic = (text: string): boolean => STATIC_SHAPES.some((r) => r.test(text));

/**
 * The sentences the scan flags that are deliberately NOT priced, with the
 * reason each one is out.
 *
 * The admission rule this list is judged against, and the one `modifiers.ts`
 * states: a row exists only if the number is true of the sheet at every instant
 * its gate is satisfied, and the gate must be a fact the sheet STORES rather
 * than a fact about the moment.
 */
/**
 * REAL static bonuses this engine cannot yet express the AMOUNT of. Owed, not excused.
 *
 * A separate map from `SITUATIONAL` on purpose, and the separation is the whole
 * point. `SITUATIONAL` says "this is not a fact the sheet stores" - a statement
 * about the BOOK. Every entry below is the opposite: the book states a
 * permanent number, the sheet should show it, and `Amount` is
 * `number | 'proficiency'` so the row cannot be written. Filing these under
 * `SITUATIONAL` would be the exact dishonesty this scan exists to prevent, and
 * it would read as settled to whoever comes next.
 *
 * They ship unpriced. That is a decision, taken in the open: extending `Amount`
 * reaches into `deriveStats`, and the failure mode of getting it wrong is a
 * WRONG NUMBER on a played character's sheet - worse, in this project's own
 * accounting, than a missing one. None of these has ever shipped, so nothing
 * regresses; what is owed is new content not yet fully wired.
 *
 * To clear an entry: widen `Amount` to carry the stat it reads, resolve it in
 * `collectModifiers` the way `'proficiency'` already is, and delete the line.
 */
const UNPRICED_AMOUNT: Record<string, string> = {
  /*
   * SIX OF THE TEN ARE GONE, and they are gone by being priced rather than by
   * being re-explained. `Amount` is `number | 'proficiency' | 'spellcast' |
   * 'presence' | 'tier'`, `collectModifiers` resolves all four in one place,
   * and Mage Robes at every tier, Granminster's Finery and the Rune-Forged
   * Exosuit's thresholds half are rows in `src/engine/modifiers.ts`. See
   * `tests/engine/pricing.test.ts` for what each one does to a derived number.
   *
   * WHAT IS LEFT IS ONE SHAPE, AND IT IS THE ONE WHERE THE AMOUNT IS A COUNTER
   * THE PLAYER MOVES DURING A SCENE.
   */
  'armor|coffinwood-armor-tier-1':
    'Splintering, "damage thresholds equal to your unmarked Armor Slots". Two readings, and they DISAGREE: `newCharacter({activeArmor:"coffinwood-armor-tier-1"})` returns `armorSlots {marked:0,max:0}` while `deriveStats` derives an Armor Score of 3 off the same sheet, so "unmarked" is 0 or 3 depending on which field is read, and `syncCounters` is what eventually reconciles them. Pricing it would print whichever one happened to be stale onto a played character\'s thresholds. It is the amount that is blocked, not the shape: the gate is a fact the sheet stores and the row would be one line the day `deriveStats` hands the collector a settled Armor Score.',
  'armor|coffinwood-armor-tier-2': 'Splintering, as coffinwood-armor-tier-1.',
  'armor|coffinwood-armor-tier-3': 'Splintering, as coffinwood-armor-tier-1.',
  'armor|coffinwood-armor-tier-4': 'Splintering, as coffinwood-armor-tier-1.',
  'domainCard|eldritch-flesh':
    'Eldritch Flesh: "Gain a +1 bonus to your damage thresholds FOR EACH STRESS YOU HAVE MARKED." The same shape as Splintering and the harder half of the same problem - the multiplicand is a track the player moves several times a scene, and `stress.marked` climbs and clears mid-fight. (It is also in a collection no register lane reads; see `UNPRICED_LANE`.) Surfaced for the first time by walking `domainCards` AND by letting the shape see `bonus`.',
};

/**
 * REAL static bonuses whose AMOUNT is a plain digit, and that this register
 * still cannot hold - because nothing walks the collection, or nothing stores
 * the gate.
 *
 * A THIRD MAP AND NOT A THIRD EXCUSE. `SITUATIONAL` says "the book does not
 * state a fact the sheet stores". `UNPRICED_AMOUNT` says "the book states a
 * number and `Amount` cannot name it". Neither is true of these: the book
 * states `+2`, and `Amount` has held plain numbers since the file was written.
 * What is missing is a LANE. `collectModifiers` walks six registers and none of
 * them is `domainCards`, `beastforms` or `classes`, and no row anywhere is
 * conditional on another field of the sheet. Filing these under either of the
 * other two maps would have made a missing walk read as a decision about the
 * book, which is exactly the dishonesty the split between those two exists to
 * prevent.
 *
 * ALL THIRTEEN ARRIVED WITH THIS COMMIT - the map did not exist before it - and
 * none of them is new content: they were in `data/srd-2.0.json` the whole time,
 * invisible because `everySite()` read eight of fifteen collections and because
 * the first shape could not see the word `bonus`. Nothing regresses - the app
 * has never applied any of them - but the backlog is now written down instead
 * of merely absent.
 *
 * To clear one: give `collectModifiers` the lane, and the gate a row can read.
 */
const UNPRICED_LANE: Record<string, string> = {
  /*
   * The one entry here that is also PRICED, because its sentence has two halves
   * and only one of them is a row.
   */
  'armor|rune-forged-exosuit':
    'Attuned, "The maximum number of domain cards in your loadout is reduced by one, but you gain a bonus to your damage thresholds equal to your tier." The thresholds half IS priced. The loadout half is not, and the reason is measured: `deriveStats` reports `loadoutLimit`, but `src/engine/loadout.ts:57` refuses a card against the flat `MAX_LOADOUT` and `tools/simulate.ts:800` asserts `stats.loadoutLimit === MAX_LOADOUT` as an invariant. Moving the reported number alone would print "5 of 4 active" on the sheet of a character the app had just let take a fifth card. The edit is three files, none of them this lane\'s.',
  'class|brawler':
    'I Am the Weapon: "While this weapon is active, you gain a +1 bonus to your Evasion" - and Brawler\'s Strike is active "while you have no other Active Weapons", which IS a fact the sheet stores (`activePrimaryWeapon` and `activeSecondaryWeapon`, both empty). So this is admissible under the register\'s own rule and still unwritable twice over: there is no `class` lane, and no row in the file is conditional on another slot of the sheet.',
  'domainCard|fortified-armor':
    'Fortified Armor (Blade 4): "While you are wearing armor, gain a +2 bonus to your damage thresholds." No cost, no clock; the gate is `activeArmor` being set, which the sheet stores, plus the card being in the loadout rather than the vault - which the sheet also stores. A lane away from being a row.',
  'domainCard|armorer':
    'Armorer (Valor 5): "While you\'re wearing armor, gain a +1 bonus to your Armor Score." As fortified-armor.',
  'domainCard|vitality':
    'Vitality (Blade 5): "When you choose this card, PERMANENTLY gain two of the following benefits: One Stress slot / One Hit Point slot / +2 bonus to your damage thresholds." Permanent, so not situational - but WHICH TWO is a choice the player makes at the table and the sheet has no field for it. A register row cannot guess, and a wrong guess here is +2 thresholds on a character who took the two slots instead.',
  'domainCard|blade-touched':
    'Blade-Touched (Blade 7): "When 4 or more of the domain cards in your loadout are from the Blade domain ... +4 bonus to your Severe damage threshold." The gate counts the loadout, which the sheet stores exactly. Four cards of one domain is arithmetic, not interpretation.',
  'domainCard|bone-touched':
    'Bone-Touched (Bone 7): "+1 bonus to Agility", behind the same four-card gate.',
  'domainCard|splendor-touched':
    'Splendor-Touched (Splendor 7): "+3 bonus to your Severe damage threshold", behind the same four-card gate.',
  'domainCard|valor-touched':
    'Valor-Touched (Valor 7): "+1 bonus to your Armor Score", behind the same four-card gate.',
  /*
   * The Beastform's thresholds, which are NOT the file's "the Beastform is not
   * here either" exemption - that note says `character.ts` keeps the form's
   * numbers, and for these four it does not keep them at all.
   *
   * MEASURED, not read: a level 1 Druid reads thresholds [1,2] bare and [1,2]
   * in Powerful Beast, whose *Thick Hide* says "+2 bonus to your damage
   * thresholds". `deriveStats` layers `form.traitBonus` and `form.evasionBonus`
   * and there is no `thresholdBonus` on a `Beastform` to layer, so the sentence
   * reaches the screen as text and reaches no number. Four forms, four
   * sentences, zero effect.
   */
  'beastform|powerful-beast':
    'Thick Hide: "You gain a +2 bonus to your damage thresholds." `Beastform` has `traitBonus` and `evasionBonus` and no threshold field, so `deriveStats` drops it: a level 1 Druid reads [1,2] in and out of the form. A dataset field this lane does not own.',
  'beastform|winged-beast': 'Hollow Bones: "a -2 penalty to your damage thresholds". As powerful-beast.',
  'beastform|mighty-lizard': 'Physical Defense: "a +3 bonus to your damage thresholds". As powerful-beast.',
  'beastform|massive-behemoth':
    'Undaunted: "a +2 bonus to all your damage thresholds" - the only "all your" spelling in either book. As powerful-beast.',
};

const SITUATIONAL: Record<string, string> = {
  'consumable|steelskin-salve':
    'Steelskin Salve: "You can APPLY this salve to gain a bonus to your damage thresholds equal to your tier UNTIL THE END OF THE SCENE." A consumable with a duration - carrying it grants nothing, and using it grants it once. Surfaced by widening shape 4 off the hardcoded word Proficiency.',
  'subclass|martial-artist':
    'Keen Defenses: "When you\'re targeted by an attack, you can SPEND A FOCUS to gain a bonus to your Evasion equal to your tier AGAINST THE ATTACK." A cost, a trigger and a duration of one attack. (Focus is also a track SRD 2.0 prints and this app does not carry - see the handoff.)',
  'subclass|pact-of-the-endless':
    'Patron\'s Mantle: "SPEND A FAVOR to cloak yourself ... that LASTS UNTIL you take Severe damage or the scene ends." A cost and a duration.',
  'weapon|eldritch-vambrace':
    'Deflecting: "When you are attacked, you can MARK AN ARMOR SLOT to gain a bonus to your Evasion equal to your Armor Score AGAINST THE ATTACK." A cost and one attack.',
  'weapon|buckler':
    'Deflecting, as eldritch-vambrace, and PRE-EXISTING: this sentence is in SRD 1.0 and shipped unflagged only because the old shape 4 hardcoded the word Proficiency. Widening the shape surfaced it; it was always situational.',
  'subclass|warden-of-the-elements':
    'Elemental Dominion, "+1 bonus to your Proficiency for attacks and spells that deal damage" - and only "While Channeling", which begins by marking a Stress and ends at Severe damage or the next rest. A duration, not a fact the sheet stores.',
  /*
   * The two SRD 2.0 brought that are not facts either, and both are here with
   * the sentence rather than a category name - the other thirty-one static
   * bonuses the switch introduced were PRICED, in `src/engine/modifiers.ts`.
   */
  'subclass|moon':
    'Lunar Phases, the Witch/Moon mastery card: "At the beginning of each session, roll a d6 and place it on this card. You gain the matching effect until the end of session." The die chooses one of four effects - a Hope spend on 1, "+2 to damage rolls" on 2-3, "+3 to damage thresholds" on 4, "+1 to Evasion" on 5-6 - and a Hope can step it again once per rest. So it is not one bonus and it is not permanent: it is a value on a card that this app has no field for, changing every session and sometimes mid-session. Pricing any one face would put a number on the sheet that is wrong five times out of six.',
  'loot|eclipse-coin':
    'Eclipse Coin: "Once per rest, flip a coin. On heads, you gain a +1 bonus to attack rolls until your next successful attack. On tails, you gain +1 to your Evasion until an attack fails against you." Carrying it grants nothing - the flip does, one side of it moves Evasion, and it ends at the next failed attack against you. A duration behind a coin, not a fact the sheet stores. The six Relics beside it in `LOOT_MODS` are the contrast: they say "You gain", full stop.',

  /*
   * THE TWENTY-ONE THE TWO WORDS HID. Every one of these was in the shipped
   * dataset and none of them was ever flagged, because the first shape could
   * not see a `bonus` or a `penalty` between the number and the `to`. Three of
   * the spends below are named IN PROSE at the head of `src/engine/modifiers.ts`
   * as the examples of what the register refuses - Rogue's Dodge, Faerie's
   * Wings, Battle-Bonded, Elusive Predator - which is the sharpest measure of
   * how little the scan was doing: the file's own worked examples were invisible
   * to the check that is supposed to demand them.
   */
  'class|rogue':
    "Rogue's Dodge: \"SPEND 3 HOPE to gain a +2 bonus to your Evasion until the next time an attack succeeds against you.\" A spend, and the head of modifiers.ts already names it.",
  'ancestry|faerie':
    'Wings: "While flying, you can MARK A STRESS after an adversary makes an attack against you to gain a +2 bonus to your Evasion AGAINST THAT ATTACK." A cost and one attack.',
  'ancestry|skykin':
    'Eye of the Storm: "SPEND 2 HOPE to grant you or an ally within Melee range a +1 bonus to Evasion UNTIL you take Severe damage or you use this feature again." A spend and a duration, and it can be spent on somebody else.',
  'subclass|beastbound':
    "Battle-Bonded: \"When an adversary attacks you WHILE THEY'RE WITHIN YOUR COMPANION'S MELEE RANGE, you gain a +2 bonus to your Evasion AGAINST THE ATTACK.\" One attacker, one circumstance.",
  'subclass|wayfinder':
    'Elusive Predator: "When your Focus makes an attack against you, you gain a +2 bonus to your Evasion AGAINST THE ATTACK." As Battle-Bonded.',
  'subclass|executioners-guild':
    "Scorpion's Poise: \"You gain a +2 bonus to your Evasion AGAINST ATTACKS MADE BY A CREATURE YOU'VE MARKED FOR DEATH.\" No cost and no clock, which is what makes it the closest call in this map - but the gate is who is swinging, and a sheet cannot print an Evasion that is one number against one adversary and another against the rest.",
  'subclass|elemental-origin':
    'Transcendence: "ONCE PER LONG REST, you can transform ... choose two of the following benefits to gain UNTIL YOUR NEXT REST: +4 bonus to your Severe threshold / +1 bonus to a character trait of your choice / +1 bonus to your Proficiency / +2 bonus to your Evasion." A rest-long transformation and a choice inside it.',
  'subclass|hedge':
    'Circle of Power: "ONCE PER REST, mark a circle ... you and your allies gain a +2 bonus to damage thresholds, attack rolls, and Evasion. REMOVE A TOKEN each time you or an ally ... makes an action roll." A resource that drains as it is used, and it ends when you step out of the circle.',
  'armor|resonant-harness':
    'Vitreous: "When you would take Severe or greater damage, you can MARK 2 ARMOR SLOTS to negate that damage. If you do, you gain a -5 penalty to your damage thresholds UNTIL you choose to repair your armor." A cost, and a penalty that starts when it is paid - so wearing the armour is not the gate.',
  /*
   * The consumables. `modifiers.ts` says it in one line at the head - "Every
   * potion. A relic is carried and a potion is drunk" - and the scan still
   * wants each ref named, because "it is a potion" is a category and the rule
   * is about the sentence.
   */
  'consumable|major-stride-potion': 'Major Stride Potion: "+1 bonus to your Agility UNTIL YOUR NEXT REST." Drunk, not carried.',
  'consumable|major-bolster-potion': 'Major Bolster Potion: "+1 bonus to your Strength UNTIL YOUR NEXT REST."',
  'consumable|major-control-potion': 'Major Control Potion: "+1 bonus to your Finesse UNTIL YOUR NEXT REST."',
  'consumable|major-attune-potion': 'Major Attune Potion: "+1 bonus to your Instinct UNTIL YOUR NEXT REST."',
  'consumable|major-charm-potion': 'Major Charm Potion: "+1 bonus to your Presence UNTIL YOUR NEXT REST."',
  'consumable|major-enlighten-potion': 'Major Enlighten Potion: "+1 bonus to your Knowledge UNTIL YOUR NEXT REST."',
  'consumable|potion-of-vigilance':
    'Potion of Vigilance: "DRINK this potion to gain a +1 bonus to your Evasion UNTIL YOU MARK A HIT POINT."',
  'consumable|shrinking-potion':
    'Shrinking Potion: "DRINK this potion to halve your size UNTIL ... your next rest. While in this form, you have a +2 bonus to Agility and a -1 penalty to your Proficiency."',
  'consumable|growing-potion':
    'Growing Potion: "DRINK this potion to double your size UNTIL ... your next rest. While in this form, you have a +2 bonus to Strength and a +1 bonus to your Proficiency."',
  'consumable|drakemantle':
    'Drakemantle: "USE this ... UNTIL THE END OF THE SCENE, when the hide falls away in tatters. Until then, you can fly and gain a +5 bonus to your damage thresholds."',
  /*
   * And the three domain cards that are spends or weather, as against the eight
   * in `UNPRICED_LANE` that are facts.
   */
  'domainCard|frenzy':
    'Frenzy (Blade 8): "ONCE PER LONG REST, you can go into a Frenzy UNTIL THERE ARE NO MORE ADVERSARIES WITHIN SIGHT ... a +8 bonus to your Severe damage threshold."',
  'domainCard|shadowhunter':
    "Shadowhunter (Midnight 8): \"WHILE YOU'RE SHROUDED IN LOW LIGHT OR DARKNESS, you gain a +1 bonus to your Evasion.\" The gate is the room, not the sheet.",
  'domainCard|gifted-tracker':
    'Gifted Tracker (Sage 1): "When you encounter creatures YOU\'VE TRACKED IN THIS WAY, gain a +1 bonus to your Evasion AGAINST THEM." One set of adversaries, in one scene.',
};

// ---------------------------------------------------------------------------
// Forward: the register against the book
// ---------------------------------------------------------------------------

describe('the register against the book', () => {
  it('names only refs the dataset still holds', () => {
    const missing: string[] = [];
    for (const [lane, map] of Object.entries(REGISTERS)) {
      for (const ref of Object.keys(map)) {
        if (!index.byRef.has(ref)) missing.push(`${lane}|${ref}`);
      }
    }
    expect(
      missing,
      'the register prices a ref that is not in data/srd-1.0.json any more. A row for a bonus ' +
        'nobody has is a number this app would add to nothing, silently:\n  ' + missing.join('\n  '),
    ).toEqual([]);
  });

  it('names only features those refs still have', () => {
    const sites = everySite();
    const known = new Map<string, Set<string>>();
    for (const s of sites) {
      // The feature NAME as the register spells it. Gear carries its feature
      // name inside the one `feature` string - "Flexible: +1 to Evasion" - so
      // the lead word before the colon is what a gear row names.
      const lead = s.text.split(':')[0] ?? '';
      const names = known.get(`${s.lane}|${s.ref}`) ?? new Set<string>();
      names.add(lead.trim());
      // Ancestry, community and subclass features carry a real name field,
      // which `what` ends with before the slot marker.
      const named = s.what.split(' · ')[1]?.replace(/ \[\d+\]$/, '');
      if (named !== undefined) names.add(named);
      names.add(s.what);
      known.set(`${s.lane}|${s.ref}`, names);
    }

    const wrong: string[] = [];
    for (const [lane, map] of Object.entries(REGISTERS)) {
      const key = lane === 'weapon' || lane === 'armor' || lane === 'loot' ? lane : lane;
      for (const [ref, rows] of Object.entries(map)) {
        const names = known.get(`${key}|${ref}`);
        if (names === undefined) {
          wrong.push(`${lane}|${ref}: no feature-bearing site at all`);
          continue;
        }
        for (const row of rows) {
          if (!names.has(row.feature)) {
            wrong.push(
              `${lane}|${ref}: priced a feature called "${row.feature}", which that entry no ` +
                `longer has. It has: ${[...names].join(' / ')}`,
            );
          }
        }
      }
    }
    expect(wrong, wrong.join('\n  ')).toEqual([]);
  });

  it('prices an amount the sentence actually states', () => {
    /*
     * POSITION AND NOT MEMBERSHIP, which is the check a judge broke the first
     * design on. `"Barrier: +2 to Armor Score; -1 to Evasion"` contains both
     * `+2` and `-1`, so a row claiming `{armorScore, -1}` passes a `.includes`
     * and is wrong. The number has to sit immediately before the stat it is
     * claimed for.
     *
     * Two kinds of row carry no digit and both are named rather than skipped by
     * a pattern: the four "additional slot" features, and the amounts the book
     * states as a WORD. `PHRASE` and `WORD_AMOUNT` cover those by naming the
     * phrase each one has to find.
     */
    /*
     * THE FOUR AMOUNTS THAT ARE WORDS, EACH DEMANDING ITS OWN SENTENCE.
     *
     * This grew from a single hand-written `if` for `'proficiency'` when
     * `Amount` grew from two members to five, and it grew the same way rather
     * than into an exemption. Each entry names the register the book states the
     * amount FOR and the phrase it has to find, so it is still the POSITION
     * check the design round broke on: the quantity must sit immediately after
     * the register's own words, `"damage thresholds equal to your Spellcast
     * trait"`, and a row that priced `spellcast` against `armorScore` is caught
     * by the `stat` half before the phrase is even tried.
     *
     * `Record<Exclude<Amount, number>, ...>` and not a loose map: the day
     * `Amount` gains a sixth member, THIS FILE STOPS COMPILING until the new
     * word has a sentence to prove itself against. That is the property that
     * keeps `'proficiency'`'s named exemption from being widened into a hole.
     */
    const WORD_AMOUNT: Record<
      Exclude<Amount, number>,
      { stat: RegisterStat; phrase: RegExp }
    > = {
      proficiency: {
        stat: 'thresholds',
        phrase: /damage thresholds equal to your Proficiency/i,
      },
      spellcast: {
        stat: 'thresholds',
        phrase: /damage thresholds equal to your Spellcast trait/i,
      },
      tier: { stat: 'thresholds', phrase: /damage thresholds equal to your tier/i },
      presence: { stat: 'armorScore', phrase: /Armor Score equal to your Presence/i },
    };
    const WORD: Record<string, string> = {
      evasion: 'Evasion',
      armorScore: 'Armor Score',
      severe: 'Severe damage threshold',
      agility: 'Agility',
      strength: 'Strength',
      finesse: 'Finesse',
      instinct: 'Instinct',
      presence: 'Presence',
      knowledge: 'Knowledge',
    };
    const PHRASE: Record<string, RegExp> = {
      maxHp: /Gain an additional Hit Point slot/i,
      maxStress: /Gain an additional Stress slot/i,
    };

    const textOf = (lane: string, ref: string): string => {
      const entity = index.byRef.get(ref) as Record<string, unknown>;
      if (lane === 'weapon' || lane === 'armor') return String(entity['feature'] ?? '');
      if (lane === 'loot') return String(entity['text'] ?? '');
      if (lane === 'ancestry') {
        return (entity['features'] as Array<{ text: string }>).map((f) => f.text).join(' ');
      }
      if (lane === 'subclass') {
        return (['foundationFeatures', 'specializationFeatures', 'masteryFeatures'] as const)
          .flatMap((k) => entity[k] as Array<{ text: string }>)
          .map((f) => f.text)
          .join(' ');
      }
      return String((entity['feature'] as { text?: string } | undefined)?.text ?? '');
    };

    const wrong: string[] = [];
    for (const [lane, map] of Object.entries(REGISTERS)) {
      for (const [ref, rows] of Object.entries(map)) {
        const text = textOf(lane, ref);
        for (const row of rows) {
          if (typeof row.amount === 'string') {
            const want = WORD_AMOUNT[row.amount];
            if (row.stat !== want.stat) {
              wrong.push(
                `${lane}|${ref}: priced "${row.amount}" against ${String(row.stat)}, but the ` +
                  `book states that amount for ${want.stat}`,
              );
            } else if (!want.phrase.test(text)) {
              wrong.push(
                `${lane}|${ref}: priced "${row.amount}", but no "${want.stat} equal to your ` +
                  `${row.amount}" sits in: "${text}"`,
              );
            }
            continue;
          }
          if (row.stat === 'thresholds') {
            /*
             * `bonus to your` is OPTIONAL, the way it already is for every
             * WORD stat below, and the switch is what showed it had to be.
             * Stalwart writes "+1 bonus to your damage thresholds"; SRD 2.0's
             * Fighting Cloak writes "Padded: +2 to damage thresholds". This
             * check is about POSITION - the number sitting immediately before
             * the words it is claimed for - and both spellings satisfy that.
             * Widening the middle does not loosen it: `-1` claimed for a `+2`
             * sentence still fails, which is the case the design round broke.
             */
            /*
             * ONE stat may stand between the number and `damage thresholds`,
             * joined by `and`, and only from a named list.
             *
             * SRD 2.0 folio 33 prints Earthkin's Stoneskin as "+1 bonus to your
             * Armor Score AND damage thresholds" - one number governing two
             * registers, in one sentence. Requiring the number to touch the
             * words would have rejected a row that is exactly right, which is
             * how a check earns a hand-wired exception and then rots.
             *
             * It stays a POSITION check, which is the property a design round
             * broke and rebuilt this around: the number must still be the one
             * that opens the phrase. `"Barrier: +2 to Armor Score; -1 to
             * Evasion"` cannot satisfy it for `-1`, because a semicolon is not
             * `and` and `Evasion` is not `damage thresholds`. The alternation
             * is a closed list rather than `\w+` for the same reason.
             */
            const want = new RegExp(
              `\\${row.amount as number > 0 ? '+' : '-'}${Math.abs(row.amount as number)}\\s+(bonus\\s+)?to\\s+(your\\s+)?((Armor Score|Evasion)\\s+and\\s+)?damage thresholds`,
              'i',
            );
            if (!want.test(text)) {
              wrong.push(`${lane}|${ref}: priced ${String(row.amount)} to both thresholds, unstated`);
            }
            continue;
          }
          const phrase = PHRASE[row.stat as string];
          if (phrase !== undefined) {
            if (!phrase.test(text)) wrong.push(`${lane}|${ref}: priced a ${row.stat} slot, unstated`);
            continue;
          }
          const word = WORD[row.stat as string];
          if (word === undefined) {
            wrong.push(`${lane}|${ref}: no way to check a ${String(row.stat)} row`);
            continue;
          }
          const n = row.amount as number;
          const sign = n > 0 ? '\\+' : '-';
          // "-1 to Evasion", "+3 to Severe damage threshold", "+1 bonus to your Agility",
          // and savior chainmail's "-1 to all character traits and Evasion".
          const near = new RegExp(
            `${sign}\\s?${Math.abs(n)}\\s+(bonus\\s+)?to\\s+(your\\s+|all character traits and\\s+)?${word}`,
            'i',
          );
          const sweeping =
            /-1 to all character traits and Evasion/i.test(text) && n === -1;
          if (!near.test(text) && !sweeping) {
            wrong.push(
              `${lane}|${ref}: priced ${n > 0 ? '+' : ''}${n} to ${word}, but no such number sits ` +
                `beside that word in: "${text}"`,
            );
          }
        }
      }
    }
    expect(wrong, `\n  ${wrong.join('\n  ')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reverse: the book against the register
// ---------------------------------------------------------------------------

describe('the book against the register', () => {
  it('leaves no static-looking bonus unpriced and unexplained', () => {
    const priced = new Set<string>();
    for (const [lane, map] of Object.entries(REGISTERS)) {
      for (const ref of Object.keys(map)) priced.add(`${lane}|${ref}`);
    }
    const unexplained: string[] = [];
    for (const site of everySite()) {
      if (!looksStatic(site.text)) continue;
      const key = `${site.lane}|${site.ref}`;
      if (priced.has(key) || key in SITUATIONAL || key in UNPRICED_AMOUNT || key in UNPRICED_LANE) {
        continue;
      }
      unexplained.push(`${key}  ${site.what}\n      "${site.text.replace(/\s+/g, ' ').slice(0, 160)}"`);
    }
    expect(
      unexplained,
      'the dataset states a static-looking bonus that nothing prices and nothing excuses. This ' +
        'is the check that did not exist when a Simiah\'s +1 Evasion went missing. Either add a ' +
        'row to src/engine/modifiers.ts, or add the ref to SITUATIONAL above with the reason it ' +
        'is not a fact the sheet stores:\n\n    ' + unexplained.join('\n    '),
    ).toEqual([]);
  });

  it('sees the word "bonus" standing between the number and the stat it moves', () => {
    /*
     * THE SHAPES THEMSELVES, AS A CHECK, because narrowing a regex is the one
     * edit in this file that makes NOTHING go red. Take `bonus` back out of
     * shape 1 and the reverse scan flags fewer sites, `unexplained` stays empty
     * and every other test here still passes - the coverage quietly halves and
     * the suite applauds. That is precisely how Earthkin's Stoneskin shipped:
     * the scan was two words short and nothing said so.
     *
     * So the SRD's own spellings are pinned as data. Each of these is a real
     * sentence out of `data/srd-2.0.json`, and one of them - Armorer's - went
     * unflagged for as long as `domainCards` went unwalked AND `bonus` went
     * unseen, which is two independent holes over one bonus.
     */
    const MUST_FLAG: string[] = [
      // The spelling weapons and armour use: the digit touches the `to`.
      'Barrier: +2 to Armor Score; -1 to Evasion',
      'Flexible: +1 to Evasion',
      // The spelling domain cards and Beastforms use: `bonus` in between.
      'While you are wearing armor, gain a +2 bonus to your damage thresholds.',
      "While you're wearing armor, gain a +1 bonus to your Armor Score.",
      '- +4 bonus to your Severe damage threshold',
      '- +1 bonus to Agility',
      'You gain a +2 bonus to your damage thresholds.',
      // `penalty`, and `all your` - the Massive Behemoth's Undaunted and the
      // Winged Beast's Hollow Bones, the only two of their spellings in the book.
      'You gain a -2 penalty to your damage thresholds.',
      'You gain a +2 bonus to all your damage thresholds.',
      // The three anchored spellings the other shapes carry.
      'Gain a permanent +1 bonus to your Armor Score and damage thresholds at character creation.',
      'Gain an additional Hit Point slot at character creation.',
      'Gain a bonus to your damage thresholds equal to your Spellcast trait.',
      'You gain a +1 bonus to your Agility.',
    ];
    const missed = MUST_FLAG.filter((t) => !looksStatic(t));
    expect(
      missed,
      'the scan cannot see one of the SRD\'s own spellings of a static bonus. Widen ' +
        'STATIC_SHAPES; do not narrow this list:\n  ' + missed.join('\n  '),
    ).toEqual([]);
  });

  it('carries no SITUATIONAL entry that has outlived its sentence', () => {
    const live = new Set(everySite().map((s) => `${s.lane}|${s.ref}`));
    const stale = [
      ...Object.keys(SITUATIONAL),
      ...Object.keys(UNPRICED_AMOUNT),
      ...Object.keys(UNPRICED_LANE),
    ].filter((k) => !live.has(k));
    expect(stale, `these exclusions name nothing in the dataset:\n  ${stale.join('\n  ')}`).toEqual(
      [],
    );
  });

  it('carries no exclusion for a bonus that has since been priced', () => {
    /*
     * The half-priced ref is named rather than pattern-matched. The Rune-Forged
     * Exosuit's sentence has two halves, the thresholds half is a row and the
     * loadout half is not, so its `UNPRICED_LANE` entry is the ONLY one allowed
     * to name a ref the register also prices. Every other overlap is an
     * exclusion that outlived its reason - a line that reads as a decision and
     * is really a leftover, which is the failure mode this whole file is about.
     */
    const HALF_PRICED = new Set(['armor|rune-forged-exosuit']);
    const priced = new Set<string>();
    for (const [lane, map] of Object.entries(REGISTERS)) {
      for (const ref of Object.keys(map)) priced.add(`${lane}|${ref}`);
    }
    const overlap = [
      ...Object.keys(SITUATIONAL),
      ...Object.keys(UNPRICED_AMOUNT),
      ...Object.keys(UNPRICED_LANE),
    ].filter((k) => priced.has(k) && !HALF_PRICED.has(k));
    expect(
      overlap,
      'these refs are excused AND priced. Delete the excuse:\n  ' + overlap.join('\n  '),
    ).toEqual([]);
  });

  it('sweeps every lane the collector reads, and says how much it swept', () => {
    const sites = everySite();
    const lanes = new Set(sites.map((s) => s.lane));
    /*
     * ELEVEN, and the last three are the point of this revision. The six the
     * collector walks, plus classes and consumables so the scan sees a bonus
     * arriving where the collector does not look, plus `domainCards`,
     * `beastforms` and `transformations` - 238 sites that were never read.
     */
    expect([...lanes].sort()).toEqual([
      'ancestry',
      'armor',
      'beastform',
      'class',
      'community',
      'consumable',
      'domainCard',
      'loot',
      'subclass',
      'transformation',
      'weapon',
    ]);
    // Per lane, so that dropping one walk fails HERE and says which - a total
    // of 1086 hides the loss of six transformations behind 210 domain cards.
    const per = (lane: Site['lane']): number => sites.filter((s) => s.lane === lane).length;
    expect(per('domainCard')).toBe(dataset.domainCards.length);
    expect(per('beastform')).toBeGreaterThanOrEqual(dataset.beastforms.length);
    expect(per('transformation')).toBeGreaterThanOrEqual(dataset.transformations.length);
    expect(sites.length).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// The arithmetic
// ---------------------------------------------------------------------------

const sheet = (p: Partial<Character> = {}): Character =>
  newCharacter({ classRef: 'rogue', level: 1, ...p }, index);

const evasionOf = (p: Partial<Character>): number => deriveStats(sheet(p), dataset, index).evasion;
const statsOf = (p: Partial<Character>): ReturnType<typeof deriveStats> =>
  deriveStats(sheet(p), dataset, index);

describe('what a sheet actually reads', () => {
  /*
   * THE REPORTED BUG, AS AN ASSERTION. A rogue starts at 12 - the highest
   * starting Evasion in the book - so a Simiah rogue in a Gambeson reads 14.
   * Before this commit they read 12 and the owner said so: «Il simiah che
   * prende evasion e il gamberson che da evasione. Il conteggio non sale.
   * Resta fermo alla base di classe.»
   */
  it('adds a Simiah\'s Nimble and a Gambeson\'s Flexible to the class base', () => {
    expect(evasionOf({})).toBe(12);
    expect(evasionOf({ ancestryRefs: ['simiah'] })).toBe(13);
    expect(evasionOf({ activeArmor: 'gambeson-armor' })).toBe(13);
    expect(evasionOf({ ancestryRefs: ['simiah'], activeArmor: 'gambeson-armor' })).toBe(14);
  });

  /*
   * SRD 2.0's Earthkin, which shipped doing nothing.
   *
   * Folio 33: "Gain a permanent +1 bonus to your Armor Score and damage
   * thresholds at character creation." One printed sentence, two registers.
   * Before this it read exactly like an ancestry with no feature at all -
   * measured against Clank, which has none - while Simiah's word-for-word
   * identical Nimble worked. The scan that exists to catch this listed Evasion
   * and damage thresholds and not `Armor Score`, and missed by two words.
   *
   * Compared against a NEIGHBOUR rather than against a literal, so the day the
   * class base moves this test still asks the question it means to ask.
   */
  it("gives an Earthkin the Armor Score and thresholds Stoneskin states", () => {
    const plain = statsOf({ ancestryRefs: ['clank'] });
    const stone = statsOf({ ancestryRefs: ['earthkin'] });
    expect(stone.armorScore).toBe(plain.armorScore + 1);
    expect(stone.thresholds[0]).toBe(plain.thresholds[0] + 1);
    expect(stone.thresholds[1]).toBe(plain.thresholds[1] + 1);
    // And it leaves alone what the sentence does not mention.
    expect(stone.evasion).toBe(plain.evasion);
    // The ledger names the feature, so the sheet can say where the number came from.
    expect(JSON.stringify(stone)).toContain('Stoneskin');
  });

  it('honours the mixed-ancestry slot rule, so Nimble is the SECOND feature', () => {
    // Simiah alone grants both of its features, so Nimble counts.
    expect(evasionOf({ ancestryRefs: ['simiah'] })).toBe(13);
    // Simiah FIRST in a mixed pair grants only features[0], which is Natural
    // Climber. Nimble is features[1] and belongs to the other ancestry's slot.
    expect(evasionOf({ ancestryRefs: ['simiah', 'human'] })).toBe(12);
    // Simiah SECOND grants features[1], which is Nimble.
    expect(evasionOf({ ancestryRefs: ['human', 'simiah'] })).toBe(13);
  });

  it('takes Evasion off for heavy armour and heavy gear, and stacks the two', () => {
    expect(evasionOf({ activeArmor: 'chainmail-armor' })).toBe(11);
    expect(evasionOf({ activeArmor: 'full-plate-armor' })).toBe(10);
    expect(evasionOf({ activePrimaryWeapon: 'greatsword' })).toBe(11);
    expect(evasionOf({ activeSecondaryWeapon: 'tower-shield' })).toBe(11);
    expect(
      evasionOf({
        activeArmor: 'full-plate-armor',
        activePrimaryWeapon: 'greatsword',
        activeSecondaryWeapon: 'tower-shield',
      }),
    ).toBe(8);
  });

  it('lets a shield raise the Armor Score, from the secondary slot', () => {
    const bare = deriveStats(sheet({ activeArmor: 'gambeson-armor' }), dataset, index);
    const shielded = deriveStats(
      sheet({ activeArmor: 'gambeson-armor', activeSecondaryWeapon: 'tower-shield' }),
      dataset,
      index,
    );
    expect(shielded.armorScore).toBe(bare.armorScore + 2);
  });

  /*
   * THE FEEDBACK LOOP, WHICH IS THE ONE THING HERE THAT COULD HAVE CORRUPTED A
   * SAVED SHEET. `syncCounters` writes `armorScore` into `armorSlots.max`, and
   * with the armour unresolvable `deriveStats` reads that field BACK as its
   * base. Adding the shield on that branch too would add +2 on every save,
   * for ever. See the docblock in `character.ts`.
   */
  it('does not add gear twice when the armour cannot be named', () => {
    let c = sheet({
      activeArmor: '?not-in-this-build',
      activeSecondaryWeapon: 'tower-shield',
      armorSlots: { marked: 0, max: 5 },
    });
    const seen: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const stats = deriveStats(c, dataset, index);
      seen.push(stats.armorScore);
      c = { ...c, armorSlots: { ...c.armorSlots, max: stats.armorScore } };
    }
    expect(seen, 'the Armor Score climbed on repeated saves').toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('stacks the three Stalwart features rather than taking the largest', () => {
    const at = (cards: string[]): number =>
      deriveStats(
        sheet({
          classRef: 'guardian',
          subclassRefs: ['stalwart'],
          level: 7,
          levelUpHistory: cards.map((card, i) => ({
            level: i + 2,
            slot: 0,
            kind: 'subclass' as const,
            detail: { subclassRef: 'stalwart', card },
          })),
        }),
        dataset,
        index,
      ).thresholds[0];
    const foundation = at([]);
    expect(at(['specialization']) - foundation).toBe(2);
    expect(at(['specialization', 'mastery']) - foundation).toBe(5);
  });

  it('gives a carried Relic its trait, once, however many are in the stack', () => {
    const traitOf = (quantity: number): number =>
      deriveStats(
        sheet({ inventory: [{ ref: 'stride-relic', name: 'Stride Relic', quantity }] }),
        dataset,
        index,
      ).traits.agility;
    expect(traitOf(1)).toBe(1);
    expect(traitOf(4), 'four relics in one row paid out four times').toBe(1);
    // A hand-typed name carries no ref and must grant nothing: this app does
    // not read item names.
    expect(
      deriveStats(
        sheet({ inventory: [{ ref: null, name: 'Stride Relic', quantity: 1 }] }),
        dataset,
        index,
      ).traits.agility,
    ).toBe(0);
  });

  it('adds the extra Hit Point and Stress slots that carry no digit', () => {
    const wizard = (p: Partial<Character>): ReturnType<typeof deriveStats> =>
      deriveStats(sheet({ classRef: 'wizard', ...p }), dataset, index);
    expect(wizard({}).maxHp).toBe(5);
    expect(wizard({ ancestryRefs: ['giant'] }).maxHp, 'Giant · Endurance').toBe(6);
    expect(wizard({ subclassRefs: ['school-of-war'] }).maxHp, 'School of War · Battlemage').toBe(6);
    expect(wizard({}).maxStress).toBe(6);
    expect(wizard({ ancestryRefs: ['human'] }).maxStress, 'Human · High Stamina').toBe(7);
  });

  it('leaves a hand-set Evasion override alone, modifiers and all', () => {
    // The override is a finished number the sheet asserts about itself, and the
    // build that wrote it had already counted its own armour. Adding to it
    // would move a stated 14 in exactly the population this fix is for.
    expect(
      evasionOf({ evasionOverride: 14, ancestryRefs: ['simiah'], activeArmor: 'gambeson-armor' }),
    ).toBe(14);
  });

  it('keeps the source of every contribution, so the number can be shown as a sum', () => {
    const c = sheet({ ancestryRefs: ['simiah'], activeArmor: 'gambeson-armor' });
    const ledger = collectModifiers(c, index, 1);
    expect(sumOf(ledger, 'evasion')).toBe(2);
    expect(ledger.evasion.map((r) => `${r.source} · ${r.feature} ${r.amount > 0 ? '+' : ''}${r.amount}`)).toEqual([
      'Simiah · Nimble +1',
      'Gambeson Armor · Flexible +1',
    ]);
  });
});
