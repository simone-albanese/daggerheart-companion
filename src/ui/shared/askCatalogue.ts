/**
 * The twelve questions, and where each one lands.
 *
 * This module is data and nothing else, and it is a module of its own so that
 * the `import()` in `ask.ts` has something to be a boundary around. Read that
 * file first: it carries why an entry has no answer field, why there are twelve
 * of them rather than forty-eight, and why the specifier that reaches this file
 * has to stay a literal string.
 *
 * ## What each of these is, and what none of them is
 *
 * Not a summary of a section. Not a shortcut to a section a GM could have found
 * by typing its name - `countdown` already finds *Countdowns*, and an entry
 * that only did that would be this app repeating the table of contents back.
 *
 * Every one of these is a question a GM asks **mid-scene, under pressure**, to
 * which the shipped SRD's answer is *the table decides* - and which the search
 * beside it therefore answers with silence, correctly and uselessly. **Five** of
 * the twelve are built on six words measured to appear **nowhere** in the
 * shipped rules text - `surrender` and `concede` are the same entry, and the
 * other four are `chase`, `difficulty roll`, `nearly impossible` and `lines and
 * veils`. Typing any of those into the field today produces the "no rule in
 * this dataset carries that" sentence. What the entry adds is the nearest place
 * the book *does* stand, which is the ruling the GM is about to make anyway.
 *
 * So the pointer is not "the section that contains the answer". It is **the
 * paragraph a GM should have in front of them while they make the call.** For
 * `q-surrender` that is the sentence saying a defeated adversary is
 * "incapacitated, tied up, routed, killed, or anything else the table decides
 * makes sense", because that sentence is the book handing the decision over.
 *
 * ## The addresses are checked, not trusted
 *
 * Every `at` below is asserted by `tests/gm/ask.test.ts` against the shipped
 * dataset on every run: the section id exists, the heading matches the SRD's
 * own `## ` string byte for byte, the block it opens has at least one non-empty
 * part, and the page that resolves is the page pinned there. None of those
 * numbers or headings is typed in this file - the page is not here at all -
 * because `tools/build-srd.ts` derives headings from the PDF and a rebuild can
 * rename one.
 *
 * The one rot no test in this repo can catch is written down in that test:
 * content moving from one subhead to another while both keep their names. Every
 * assertion passes and the answer is quietly wrong. What stands against it is
 * not a test, it is the row: it prints the section's title, the subhead and the
 * page stamp above text the app did not write, so a GM reading the answer is
 * reading the book's own words with the book's own address over them.
 *
 * ## Growing this
 *
 * Entry thirteen is not chosen from a list. `DECISIONI-2026-08-23.md` §9: the
 * next one is written when a table notices itself reaching for something twice.
 * `tests/gm/ask.test.ts` pins the length, so adding one is a deliberate diff
 * and never a drive-by, and it also pins the mid-scene sections that still have
 * no entry - which is the honest to-do list for the rest of the forty-eight.
 */
import type { AskEntry } from './ask.ts';

export const ASK_CATALOGUE: readonly AskEntry[] = [
  {
    id: 'q-no-rule',
    ask: 'No rule covers what they just described. What do I do?',
    also: [
      'ruling',
      'no rule',
      'not in the book',
      'improvise',
      'made up',
      'in doubt',
      'judgement call',
      'homebrew',
    ],
    at: { section: 'rulings-over-rules', heading: null },
    moment: 'before-the-roll',
  },
  {
    id: 'q-difficulty',
    ask: 'Nothing sets a Difficulty for this. What number do I call?',
    also: [
      'difficulty roll',
      'how hard',
      'set the difficulty',
      'target number',
      'benchmark',
      'what number',
      'dc',
    ],
    at: { section: 'difficulty-benchmarks', heading: null },
    moment: 'before-the-roll',
  },
  {
    id: 'q-impossible',
    ask: 'What they are trying looks impossible. Do I let them roll?',
    also: [
      'nearly impossible',
      'refuse',
      'no roll',
      'say no',
      'automatic failure',
      'pointless roll',
      'stakes',
    ],
    at: { section: 'guidance-on-action-rolls', heading: null },
    moment: 'before-the-roll',
  },
  {
    id: 'q-npc-difficulty',
    ask: 'They roll against an NPC I invented. What is its Difficulty?',
    also: [
      'npc',
      'no stat block',
      'improvised',
      'invented',
      'made up',
      'ally',
      'bystander',
      'shopkeeper',
    ],
    at: { section: 'running-gm-npcs', heading: null },
    moment: 'before-the-roll',
  },
  {
    id: 'q-blank-consequence',
    ask: 'Success with Fear, and I have no consequence ready. What now?',
    also: [
      'consequence',
      'success with fear',
      'blank',
      'nothing ready',
      'complication',
      'stuck for a move',
      'what move',
    ],
    at: { section: 'making-gm-moves', heading: 'Example GM Moves' },
    moment: 'the-dice-landed',
  },
  {
    id: 'q-party-flees',
    ask: 'The party wants to run from this fight. Can they just go?',
    also: [
      'flee',
      'run away',
      'retreat',
      'escape',
      'withdraw',
      'disengage',
      'break off',
      'leave the fight',
    ],
    at: { section: 'maps-range-and-movement', heading: 'MOVEMENT UNDER PRESSURE' },
    moment: 'my-turn',
  },
  {
    id: 'q-scene-stalled',
    ask: 'The scene has stalled and nobody is acting. How do I end it?',
    also: [
      'stalled',
      'dragging',
      'boring',
      'stuck',
      'cut away',
      'end the scene',
      'montage',
      'move on',
    ],
    at: { section: 'pitfalls-to-avoid', heading: 'LETTING SCENES DRAG' },
    moment: 'my-turn',
  },
  {
    id: 'q-surrender',
    ask: 'An adversary is beaten and wants to surrender. What happens?',
    also: [
      'surrender',
      'concede',
      'yield',
      'mercy',
      'spare',
      'prisoner',
      'captured',
      'give up',
    ],
    at: { section: 'building-balanced-encounters', heading: 'DEFEATED ADVERSARIES' },
    moment: 'damage',
  },
  {
    id: 'q-death-move-refused',
    ask: 'They marked their last Hit Point and will not choose. Now what?',
    also: [
      'death move',
      'refuse',
      'last hit point',
      'dying',
      'unconscious',
      'stalling',
      'wont choose',
    ],
    at: { section: 'death', heading: null },
    moment: 'damage',
  },
  {
    id: 'q-chase',
    ask: 'Something is chasing them. How do I run a chase?',
    also: [
      'chase',
      'pursuit',
      'pursued',
      'outrun',
      'getting away',
      'head start',
      'catching up',
    ],
    at: { section: 'countdowns', heading: 'DYNAMIC COUNTDOWN ADVANCEMENT' },
    moment: 'this-place',
  },
  {
    id: 'q-safety',
    ask: 'This is heading somewhere the table may not want. How do I check?',
    also: [
      'lines and veils',
      'safety',
      'consent',
      'boundaries',
      'check in',
      'uncomfortable',
      'pause the game',
      'out of character',
    ],
    at: { section: 'gm-practices', heading: 'CREATE A META CONVERSATION' },
    moment: 'between-scenes',
  },
  {
    id: 'q-session-ends',
    ask: 'The session has to end mid-fight. How do I stop here?',
    also: [
      'end the session',
      'stop for tonight',
      'cliffhanger',
      'next time',
      'wrap up',
      'out of time',
      'pick it up later',
    ],
    at: { section: 'session-rewards', heading: null },
    moment: 'between-scenes',
  },
];
