/**
 * The rot test: does every question still point somewhere real?
 *
 * `PROGETTO-GM` §4 asks for seven assertions here, "each catching a distinct
 * rot", and it asks for them the way `tests/ui/srdReference.test.ts` states the
 * principle for this repository: **the book's values are pinned in the tests,
 * never in `src`.** So the page each entry resolves to is written down here and
 * nowhere else, the length budget is here, and the list of sections a GM opens
 * mid-scene is here - none of the three is a number or a judgement `src` is
 * allowed to hold.
 *
 * The seven, and what each one catches:
 *
 *   1. the section id still exists in the shipped dataset;
 *   2. the heading matches the SRD's own `## ` string byte for byte;
 *   3. the block that heading opens still has at least one non-empty part;
 *   4. the page it resolves to is the page pinned here - a PDF reflow tripwire;
 *   5. the ids are unique, `ask` ends in `?` and fits the one-line budget;
 *   6. every question is reachable: each of its own `also` words finds it;
 *   7. every mid-scene section has an entry - see the last `describe`, which is
 *      the one of the seven that cannot be true yet and says so in a form that
 *      still bites.
 *
 * ## The mutants are the point, at a catalogue of twelve
 *
 * A catalogue of twelve entries that all pass is a green test that has proved
 * almost nothing: the same green comes back if `checkEntry` is gutted to
 * `return`. So every check is run twice - once over the shipped entries, which
 * is the property, and once over an entry built here to violate exactly that
 * check, which is the proof the check can fail. Six mutants, one per rot. They
 * are red today if the corresponding line of `checkEntry` is deleted, which is
 * the only form of "this test can fail" a passing suite can demonstrate.
 *
 * ## The rot no assertion in this file can catch
 *
 * Content moving from one subhead to another while both keep their names.
 * `tools/build-srd.ts` derives headings from the PDF; a folio that reorganises
 * a section can leave `## DEFEATED ADVERSARIES` standing over a different
 * paragraph, and then the id exists, the heading matches byte for byte, the
 * block is non-empty, the page is unchanged - every one of the six passes - and
 * the GM is quietly reading the wrong rule.
 *
 * Nothing here can see that, and pretending otherwise would be worse than
 * saying it. What stands against it is not a test: `AskRow` prints the section
 * title, the subhead and the page stamp above text the app did not write, so a
 * GM who opens a question is reading the book's own words under the book's own
 * address, and a wrong answer is visibly a wrong *place* rather than an
 * authoritative sentence. That is the whole reason an entry carries no answer
 * field.
 */
import { describe, expect, it } from 'vitest';
import type { RulesSection } from '../../shared/types.ts';
import { MOMENTS, searchAsk, type AskEntry } from '../../src/ui/shared/ask.ts';
import { ASK_CATALOGUE } from '../../src/ui/shared/askCatalogue.ts';
import { ruleSection } from '../../src/ui/shared/srdReference.ts';
import { dataset } from '../ui/fixture.ts';

const rules = dataset.rules;

/**
 * The page each entry's section resolves to, in the shipped dataset.
 *
 * This is the reflow tripwire, and it is the assertion that has to be written
 * as a table rather than derived: deriving it from the same `sourcePage` the
 * screen reads would be the test agreeing with itself. When `tools/build-srd.ts`
 * re-extracts a folio that has moved, these go red one by one and each one is a
 * page stamp a GM would otherwise have read off the glass and typed into a
 * chat message to another table.
 *
 * A red row here is not a bug in the catalogue. It is a page number to check
 * against the new PDF and re-pin, deliberately, in this file.
 */
const PAGES: Readonly<Record<string, number>> = {
  'q-no-rule': 3,
  'q-difficulty': 88,
  'q-impossible': 86,
  'q-npc-difficulty': 91,
  'q-blank-consequence': 86,
  'q-party-flees': 51,
  'q-scene-stalled': 86,
  'q-surrender': 94,
  'q-death-move-refused': 53,
  'q-chase': 91,
  'q-safety': 85,
  'q-session-ends': 183,
};

/*
 * The eleven that moved when SRD 2.0 became the shipped book, and what did NOT
 * move with them.
 *
 * The SRD 1.0 numbers were 3 / 66 / 64 / 69 / 64 / 40 / 64 / 72 / 42 / 69 / 63
 * / 112. `q-no-rule` is the only one still on its own folio. Everything else in
 * this file - every `at.section`, every `at.heading`, and every one of the ten
 * `at.part` indices - resolved unchanged: `HEADS` below is byte-identical
 * across the two books, measured by running the resolution over both datasets
 * rather than by re-pinning until green. A part index surviving a whole book
 * being re-laid out is the property `at.part` was chosen for, and this is the
 * first printing that has tested it.
 */

/**
 * The most characters a question may be.
 *
 * **This is a budget and not a measurement, and the difference matters.** §4
 * asks that `ask` "fits one line". One line of what has never been measured:
 * `AskRow` draws the question in `.t-read`, which is `--read-size` Archivo at
 * 400, in the sheet's 363px inner column, and how many characters of that face
 * come to one line at that width is a Chrome question - the same one
 * `RuleSearch.tsx` says out loud it cannot answer about its own preview lines,
 * and the same one the moment chips' grid height is waiting on.
 *
 * So what is pinned is the thing a test can actually check: a character
 * ceiling, set where the twelve shipped questions sit with room for a
 * thirteenth to be written without a rewrite. 72 is seven characters above the
 * longest of the twelve. When the Chrome pass happens it may say that one line
 * of that face is 40 characters or 60, and then this number moves and some of
 * the twelve are reworded - which is a smaller job than discovering the same
 * thing from a photograph of a phone.
 *
 * What it does catch today is the real failure mode of writing entry thirteen:
 * a question that is a paragraph. A cap that is loose still refuses that.
 */
const ASK_MAX = 72;

/** Every check one entry has to pass, each with its own way of failing. */
/**
 * The head of the paragraph each pointer resolves to, pinned here.
 *
 * The tripwire for the one rot a part index cannot survive on its own. An
 * index is a position, so inserting a paragraph at the top of a block shifts
 * every index below it while the section id still resolves, the subhead still
 * matches byte for byte and the page may not move at all - the row would draw
 * the wrong sentence under the right address, and nothing else in this suite
 * would notice.
 *
 * The book's values live in this file and never in `src`, which is the same
 * arrangement `PAGES` above has and for the same reason: an expectation may
 * quote the book, a shipped file may not.
 *
 * Forty characters, not the whole sentence. Enough that no two paragraphs in
 * one block share it, short enough that a reflow that rewords a sentence
 * without moving it does not fail this - which is a real edit and not a
 * defect.
 */
const HEADS: Record<string, string | null> = {
  'q-no-rule': "While playing Daggerheart, the GM and pl",
  'q-difficulty': "When a player makes an action roll witho",
  'q-impossible': "After a player describes a move they wan",
  'q-npc-difficulty': "The only essential elements for a NPC ar",
  'q-blank-consequence': null,
  'q-party-flees': "When you\u2019re under pressure or in danger ",
  'q-scene-stalled': "Shake it up or cut away when a scene has",
  'q-surrender': "When an adversary marks their last Hit P",
  'q-death-move-refused': "When a PC marks their last Hit Point, th",
  'q-chase': null,
  'q-safety': "Empower players to speak out of characte",
  'q-session-ends': "Reward players at the end of a session w",
};

function checkEntry(entry: AskEntry, sections: RulesSection[]): void {
  const section = ruleSection(sections, entry.at.section);
  if (section === null) {
    throw new Error(`${entry.id}: no section \`${entry.at.section}\` in this dataset`);
  }

  const heading = entry.at.heading;
  const block =
    heading === null
      ? section.blocks[0]
      : section.blocks.find((one) => one.heading === heading);
  if (block === undefined) {
    throw new Error(
      `${entry.id}: \`${section.id}\` carries no heading \`${heading ?? ''}\`. Its headings are: ` +
        section.blocks.map((one) => one.heading ?? '(the opening block)').join(' | '),
    );
  }

  const carries = block.parts.some((part) => {
    if (part.kind === 'text') return part.text.trim() !== '';
    if (part.kind === 'list') return part.items.some((item) => item.trim() !== '');
    return part.table.rows.length > 0;
  });
  if (!carries) {
    throw new Error(`${entry.id}: the block it points at draws nothing`);
  }

  /*
   * The part index, checked the same way the heading is: it must name a real
   * thing in the shipped data, and it must name a PARAGRAPH.
   *
   * A list or a table is not a line and cannot be drawn on a shut row, so an
   * index pointing at one is a mistake caught here rather than a row that
   * silently draws nothing. `null` is the honest answer for the two blocks
   * that hold no paragraph at all, and it is allowed only when the block
   * really has none - otherwise `null` becomes the place to hide an index
   * nobody worked out.
   */
  const part = entry.at.part;
  const prose = block.parts.filter((one) => one.kind === 'text');
  if (part === null) {
    if (prose.length > 0) {
      throw new Error(
        `${entry.id}: at.part is null but its block has ${String(prose.length)} paragraph(s). ` +
          `null is for a block with none, not for one nobody chose from.`,
      );
    }
  } else {
    const chosen = block.parts[part];
    if (chosen === undefined) {
      throw new Error(
        `${entry.id}: at.part ${String(part)} is past the end - the block has ` +
          `${String(block.parts.length)} part(s)`,
      );
    }
    if (chosen.kind !== 'text') {
      throw new Error(
        `${entry.id}: at.part ${String(part)} is a ${chosen.kind}, not a paragraph. ` +
          `A shut row draws one line, and a ${chosen.kind} is not one.`,
      );
    }
    if (chosen.text.trim() === '') {
      throw new Error(`${entry.id}: at.part ${String(part)} is empty`);
    }
  }

  const head = HEADS[entry.id];
  if (head === undefined) {
    throw new Error(`${entry.id}: no answer head pinned in this file`);
  }
  const drawn = part === null ? null : (block.parts[part] as { text: string }).text.trim().slice(0, 40);
  if (drawn !== head) {
    throw new Error(
      `${entry.id}: at.part ${String(part)} now resolves to ${JSON.stringify(drawn)}, ` +
        `and this file pins ${JSON.stringify(head)}. Either the book moved under the index or ` +
        `the index moved under the book - re-read the block and repin, do not just update this.`,
    );
  }

  const pinned = PAGES[entry.id];
  if (pinned === undefined) throw new Error(`${entry.id}: no page pinned in this file`);
  if (section.page !== pinned) {
    throw new Error(
      `${entry.id}: \`${section.id}\` is on page ${String(section.page)} now, not ${String(pinned)}`,
    );
  }

  if (!entry.ask.endsWith('?')) throw new Error(`${entry.id}: \`ask\` is not a question`);
  if (entry.ask.length > ASK_MAX) {
    throw new Error(`${entry.id}: \`ask\` is ${String(entry.ask.length)} characters, over ${String(ASK_MAX)}`);
  }

  /*
   * Reachability, and it is a round trip through the matcher rather than a
   * question about `ruleTerms`.
   *
   * The check drafted for this was "`ruleTerms(also.join(' '))` is not empty -
   * an entry indexed only by stopwords is unreachable", and it is written down
   * here because it was wrong twice over and the second half is the useful
   * part. It can never fire: `ruleTerms` falls back to the words as typed when
   * every one of them is a stopword, and it says so in its own docblock, so
   * that expression is empty only for a string that was empty already. And the
   * claim under it is false as well - with that fallback, an entry indexed
   * under `the` *is* found by typing `the`; what makes it useless is that so is
   * every section of the book.
   *
   * What is asserted instead is the property that was wanted: **every word
   * written into `also` finds this entry when a GM types it.** That is the
   * whole job of the field, and unlike the draft it can fail - on a phrase that
   * is blank or nothing but spaces, on an empty index, and on the day somebody
   * takes `also` out of `searchAsk`'s haystack, which would leave twelve
   * entries findable only by the words of `ask` that a GM was never going to
   * use.
   */
  if (entry.also.length === 0) {
    throw new Error(`${entry.id}: no \`also\` index at all`);
  }
  for (const phrase of entry.also) {
    if (!searchAsk([entry], phrase).includes(entry)) {
      throw new Error(`${entry.id}: typing \`${phrase}\` does not find it`);
    }
  }
}

/** One shipped entry, bent in one place. */
const bent = (change: Partial<AskEntry>): AskEntry => ({ ...ASK_CATALOGUE[0]!, ...change });

describe('the shipped catalogue, against the shipped dataset', () => {
  it('points every question at a section, a heading and a block that are all still there', () => {
    for (const entry of ASK_CATALOGUE) {
      expect(() => {
        checkEntry(entry, rules);
      }, entry.id).not.toThrow();
    }
    // Not vacuous: the loop above proves nothing if the catalogue is empty.
    expect(ASK_CATALOGUE.length).toBeGreaterThan(0);
  });

  it('holds exactly the entries somebody decided to write', () => {
    /*
     * The length is pinned so that entry thirteen is a deliberate diff.
     * `DECISIONI-2026-08-23.md` §9 fixed the catalogue at 48 and left entry 49
     * to the table; `DECISIONI-2026-08-25.md` §4 seeded it at ten to twelve,
     * on the questions the SRD does not answer. This is the twelve, and a
     * thirteenth arrives through this line.
     */
    expect(ASK_CATALOGUE).toHaveLength(12);
    expect(new Set(ASK_CATALOGUE.map((entry) => entry.id)).size).toBe(ASK_CATALOGUE.length);
    expect(Object.keys(PAGES).sort()).toEqual(ASK_CATALOGUE.map((entry) => entry.id).sort());
  });

  it('stores a question and a pointer, and no answer', () => {
    /*
     * The licence guard §4 hands to the type, asserted at runtime because a
     * type is not a fence: `{ ...entry, answer: 'roll 2d6' } as AskEntry`
     * typechecks at the call site that writes it, and the day somebody pastes
     * the book's own sentence into this file is the day this project stops
     * being a pointer to the SRD and starts being a copy of it.
     */
    const allowed = ['id', 'ask', 'also', 'at', 'moment'];
    for (const entry of ASK_CATALOGUE) {
      expect(Object.keys(entry).sort(), entry.id).toEqual([...allowed].sort());
      /*
       * `part` was added to `at` on 27 August and this line is where that was
       * allowed, deliberately and in one place. It is worth being slow about,
       * because widening this list silently is how a guard gets removed while
       * appearing to be kept.
       *
       * It passes the guard because of what it is rather than what it is
       * called: an integer index into `SectionBlock.parts`. A number cannot
       * carry a word of the book, so the property this test exists to defend -
       * that the catalogue stores an address and never an answer - is held by
       * the type itself here, not by this assertion. The next key that wants in
       * must clear the same bar: an address, checkable against the dataset on
       * every run. A string that named a line rather than counted to it would
       * not, whatever it was called.
       */
      expect(Object.keys(entry.at).sort(), entry.id).toEqual(['heading', 'part', 'section']);
      expect(
        typeof entry.at.part === 'number' || entry.at.part === null,
        `${entry.id}: at.part must be an index or null, never a string`,
      ).toBe(true);
    }
  });

  it('files every question under one of the six moments, or under none', () => {
    const ids = MOMENTS.map((moment) => moment.id);
    for (const entry of ASK_CATALOGUE) {
      if (entry.moment === null) continue;
      expect(ids, entry.id).toContain(entry.moment);
    }
    // Every chip finds something. A chip that draws an empty band is a control
    // that answers nothing, and this is the cheapest way to know before a GM
    // presses it: the labels are what `ShowSheet` types into the field.
    for (const moment of MOMENTS) {
      expect(
        searchAsk(ASK_CATALOGUE, moment.label.toLowerCase()).length,
        `${moment.label} finds no question`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('checkEntry, against entries bent on purpose', () => {
  // Six mutants, one per check. Without these the suite above is green whether
  // `checkEntry` does its job or does nothing at all - which at twelve entries
  // is not a hypothetical: none of the six has ever been red on real data.

  it('refuses a section this dataset does not carry', () => {
    expect(() => {
      checkEntry(bent({ at: { section: 'the-witherwild', heading: null, part: null } }), rules);
    }).toThrow(/no section/);
  });

  it('refuses a heading that is one byte off the book’s own', () => {
    const real = ASK_CATALOGUE.find((entry) => entry.at.heading !== null)!;
    const heading = real.at.heading!;
    expect(() => {
      checkEntry(
        { ...real, at: { ...real.at, heading: heading.toLowerCase() } },
        rules,
      );
    }).toThrow(/carries no heading/);
    expect(() => {
      checkEntry({ ...real, at: { ...real.at, heading: `${heading} ` } }, rules);
    }).toThrow(/carries no heading/);
  });

  it('refuses a heading whose block draws nothing', () => {
    const real = ASK_CATALOGUE.find((entry) => entry.at.heading !== null)!;
    const hollow = rules.map((section) =>
      section.id === real.at.section
        ? { ...section, body: `## ${real.at.heading ?? ''}\n\n` }
        : section,
    );
    expect(() => {
      checkEntry(real, hollow);
    }).toThrow(/draws nothing/);
  });

  it('refuses a section that has moved off its pinned page', () => {
    const reflowed = rules.map((section) =>
      section.id === ASK_CATALOGUE[0]!.at.section
        ? { ...section, sourcePage: (section.sourcePage ?? 0) + 1 }
        : section,
    );
    expect(() => {
      checkEntry(ASK_CATALOGUE[0]!, reflowed);
    }).toThrow(/not \d+$/);
  });

  it('refuses a question that is not one, and one that is a paragraph', () => {
    expect(() => {
      checkEntry(bent({ ask: 'The party wants to run.' }), rules);
    }).toThrow(/not a question/);
    expect(() => {
      checkEntry(bent({ ask: `${'a'.repeat(ASK_MAX)}?` }), rules);
    }).toThrow(/over 72/);
  });

  it('refuses an index that does not find its own entry', () => {
    expect(() => {
      checkEntry(bent({ also: [] }), rules);
    }).toThrow(/no `also` index/);
    expect(() => {
      checkEntry(bent({ also: ['surrender', '   '] }), rules);
    }).toThrow(/does not find it/);
    // And the check is not vacuous in the other direction: a stopword-only
    // index passes, because `ruleTerms` keeps a stopword query's own words and
    // the entry really is found by typing them. It is a bad index rather than
    // an unreachable one, and this file does not pretend to catch it.
    expect(() => {
      checkEntry(bent({ also: ['the'] }), rules);
    }).not.toThrow();
  });
});

/**
 * THE SEVENTH ASSERTION, WHICH IS A JUDGEMENT AND NOT A MEASUREMENT.
 *
 * §4 asks for "every mid-scene section has ≥1 entry". Nothing in this
 * repository could answer it, because nothing in this repository said which
 * sections those are. The term is in the handoff documents - `PROGETTO-GM`
 * lines 242, 458 and 461, `RECUPERO-JOURNAL` line 602 - and what was missing
 * was never the term. It was **a list**.
 *
 * The count that circulates is stale and must not be copied: the journal's "145
 * anchors across the 46 mid-scene ones" was taken over a dataset of 80 sections
 * that no longer exists. The shipped dataset carries 69.
 *
 * So the list below is written here, and the owner corrects it
 * (`DECISIONI-2026-08-25.md` §5). Getting a line of it wrong is cheap by
 * construction: a section filed wrongly produces one entry too many or one too
 * few, never a false assertion about the book.
 *
 * ## The criterion, stated so it can be argued with
 *
 * **A mid-scene section is one a GM opens *during* a scene, with their hands
 * busy and people waiting.** Not one they read to prepare, not one they read to
 * get better at running the game, and not one a player owns. Three questions
 * decide each line:
 *
 *   - Is the thing it answers *happening*? `attacking` is; `leveling-up` is
 *     not, and neither is `character-creation`.
 *   - Is it the GM's to answer? `beastform-options` and
 *     `working-with-your-companion` are rules a player runs off their own
 *     sheet, and this app draws them on the player's side.
 *   - Would they open it *now*, or later? `pitfalls-to-avoid` and
 *     `gm-practices` are how a GM gets better between sessions, even though a
 *     question in this catalogue points at each of them - a pointer may aim
 *     outside this list, because the nearest thing the book says about a
 *     mid-scene problem is sometimes a principle.
 *
 * Three of the calls are close enough to name:
 *
 *   - `downtime` is out. A rest is run at the table and its move list is read
 *     there, but downtime is between scenes rather than inside one, and §4's
 *     own sixth chip is `BETWEEN SCENES`.
 *   - `engaging-your-players` is in, for one reason that is not its title: it
 *     carries the 1d12 table of random objectives, which is rolled mid-fight.
 *   - `adversary-stat-block-benchmarks` and `adapting-environments` are in
 *     because this app already treats them as the mid-scene pair - the
 *     reference's `improvise` topic composes exactly those two, for a GM
 *     inventing a monster while the party waits.
 *
 * ## Why the assertion is pinned as a gap instead of asserted as a fact
 *
 * There are 35 sections in the list and 12 entries in the catalogue, so "every
 * mid-scene section has ≥1 entry" is *false today* and no honest test can make
 * it pass. Two ways out were rejected: writing 35 entries now, which the owner
 * explicitly did not ask for (§4: a seed of ten to twelve, and the table
 * decides the rest), and defining "mid-scene" as whatever the twelve entries
 * happen to cover, which would be a test agreeing with itself.
 *
 * So the gap itself is pinned. The uncovered list is exact, and it goes red
 * from either end: cover one and this line has to be shortened deliberately,
 * or add a section to the dataset that belongs on the list and it fails until
 * somebody classifies it. It is also, read the other way, the work list for
 * entries 13 to 48 - 27 sections, against 36 entries left before the size the
 * owner fixed. When it reaches `[]`, this test becomes §4's seventh assertion
 * word for word, and the line to change is the last `expect` in this file.
 */
const MID_SCENE: readonly string[] = [
  'rulings-over-rules',
  'the-spotlight',
  'turn-order-and-action-economy',
  'making-moves-and-taking-action',
  'gm-moves-and-adversary-actions',
  'adversary-actions',
  'special-rolls',
  'group-action-rolls',
  'tag-team-rolls',
  'advantage-and-disadvantage',
  'hope-and-fear',
  'combat',
  'stress',
  'attacking',
  'maps-range-and-movement',
  'conditions',
  'death',
  'additional-rules',
  'core-gm-mechanics',
  'guidance-on-action-rolls',
  'making-gm-moves',
  'using-fear',
  'difficulty-benchmarks',
  'giving-advantage-and-disadvantage',
  'adversary-action-rolls',
  'countdowns',
  'running-gm-npcs',
  'npc-feature-examples',
  'optional-gm-mechanics',
  'using-adversaries',
  'example-adversary-features',
  'adversary-stat-block-benchmarks',
  'using-environments',
  'adapting-environments',
  'engaging-your-players',
];

describe('the sections a GM opens mid-scene', () => {
  it('names sections this dataset actually carries', () => {
    const missing = MID_SCENE.filter((id) => !rules.some((section) => section.id === id));
    expect(
      missing,
      'the mid-scene list names sections that are not in the shipped dataset. A dataset ' +
        'rebuild can rename or drop one; re-classify it rather than deleting the line ' +
        'silently.',
    ).toEqual([]);
    expect(new Set(MID_SCENE).size).toBe(MID_SCENE.length);
  });

  it('is a judgement about half the book, not a synonym for all of it', () => {
    // A list that swallowed the whole dataset would make the assertion below
    // meaningless in the other direction: everything would be mid-scene, and
    // "a GM opens this during a scene" would have stopped being a claim.
    expect(MID_SCENE.length).toBeLessThan(rules.length);
    expect(MID_SCENE).toHaveLength(35);
    expect(rules).toHaveLength(69);
  });

  it('has no entry yet for exactly these, which is the catalogue’s own to-do list', () => {
    const covered = new Set(ASK_CATALOGUE.map((entry) => entry.at.section));
    expect([...covered].filter((id) => MID_SCENE.includes(id)).sort()).toEqual(
      [
        'countdowns',
        'death',
        'difficulty-benchmarks',
        'guidance-on-action-rolls',
        'making-gm-moves',
        'maps-range-and-movement',
        'rulings-over-rules',
        'running-gm-npcs',
      ],
    );
    expect(
      MID_SCENE.filter((id) => !covered.has(id)),
      'the sections a GM opens mid-scene that the catalogue still has nothing to say about. ' +
        'Writing an entry for one of these is what shortens this list, and shortening it is ' +
        'a deliberate diff - when it is empty, this becomes `toEqual([])` and the catalogue ' +
        'has the seventh assertion PROGETTO-GM §4 asked for.',
    ).toEqual([
      'the-spotlight',
      'turn-order-and-action-economy',
      'making-moves-and-taking-action',
      'gm-moves-and-adversary-actions',
      'adversary-actions',
      'special-rolls',
      'group-action-rolls',
      'tag-team-rolls',
      'advantage-and-disadvantage',
      'hope-and-fear',
      'combat',
      'stress',
      'attacking',
      'conditions',
      'additional-rules',
      'core-gm-mechanics',
      'using-fear',
      'giving-advantage-and-disadvantage',
      'adversary-action-rolls',
      'npc-feature-examples',
      'optional-gm-mechanics',
      'using-adversaries',
      'example-adversary-features',
      'adversary-stat-block-benchmarks',
      'using-environments',
      'adapting-environments',
      'engaging-your-players',
    ]);
  });
});
