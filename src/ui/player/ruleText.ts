/**
 * Reading a rules section out of the dataset.
 *
 * The app quotes the SRD rather than restating it. A paraphrase of "after an
 * adversary moves to where they would see you... you are no longer Hidden" is
 * a house rule waiting to happen, and the text is already sitting in
 * `dataset.rules`. These are the only two shapes those bodies come in: `## `
 * subheads and `- Label: text` bullets.
 */
import { TRAITS, type RulesSection, type Trait } from '../../../shared/types.ts';

export interface RuleBlock {
  /** The `## ` subhead, or null for whatever came before the first one. */
  heading: string | null;
  text: string;
}

export function ruleBlocks(body: string): RuleBlock[] {
  const out: RuleBlock[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    const text = buffer.join('\n').trim();
    if (heading !== null || text !== '') out.push({ heading, text });
    buffer = [];
  };

  for (const line of body.split('\n')) {
    const match = /^##\s+(.+)$/.exec(line);
    if (match) {
      flush();
      heading = match[1]!.trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return out;
}

export const paragraphs = (text: string): string[] =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== '');

/** The block under a named subhead. Case-insensitive; null when absent. */
export function blockNamed(blocks: RuleBlock[], heading: string): RuleBlock | null {
  const wanted = heading.toLowerCase();
  return blocks.find((b) => b.heading?.toLowerCase() === wanted) ?? null;
}

export interface RuleBullet {
  label: string;
  text: string;
}

/**
 * `- Blaze of Glory: Your character embraces death...` The label is bounded so
 * an ordinary bullet with a colon deep inside it is not mistaken for one.
 */
export function ruleBullets(body: string): RuleBullet[] {
  const out: RuleBullet[] = [];
  for (const line of body.split('\n')) {
    const match = /^-\s+([^:]{1,48}):\s+(.+)$/.exec(line.trim());
    if (match) out.push({ label: match[1]!.trim(), text: match[2]!.trim() });
  }
  return out;
}

/**
 * One sentence out of the `downtime` rule, found by what it says.
 *
 * The two sentences the rest surface has to quote are both buried mid-paragraph
 * in a 2KB body, so there is no subhead and no bullet to key on - `ruleBlocks`
 * and `ruleBullets` are the wrong tools for this shape. Splitting on a full
 * stop followed by whitespace is enough here because the SRD's downtime prose
 * carries no abbreviations and no decimals; it is checked against the shipped
 * text rather than assumed.
 *
 * Null rather than a guess when the search finds nothing. A rules layer that
 * dropped or reworded the section leaves the screen with no sentence, and the
 * screen then says only what it can count - see `Rest.tsx`, which prints the
 * number on its own rather than a paraphrase this file invented.
 */
const downtimeSentence = (rules: RulesSection[], needle: string): string | null => {
  const downtime = rules.find((r) => r.id === 'downtime');
  if (downtime === undefined) return null;
  const wanted = needle.toLowerCase();
  for (const paragraph of paragraphs(downtime.body)) {
    for (const sentence of paragraph.split(/(?<=\.)\s+/)) {
      if (sentence.toLowerCase().includes(wanted)) return sentence.trim();
    }
  }
  return null;
};

/**
 * The SRD's own sentence about three short rests in a row.
 *
 * Quoted, never restated. The rule is what the app is refusing on, and a
 * refusal that paraphrases its own reason is a house rule wearing the book's
 * authority. Typing it into this file instead would also put licensed text in
 * the repository - the reason `Manuali/` is gitignored - and would stop a
 * homebrew rules layer from redefining the thing it is enforcing.
 */
export const longRestRule = (rules: RulesSection[]): string | null =>
  downtimeSentence(rules, 'three short rests in a row');

/**
 * The SRD's own sentence about a long rest that was interrupted.
 *
 * The app cannot know that a rest was interrupted - nothing at this table is
 * on the wire - so it does not offer a control that claims to model it. It
 * prints the rule beside the long rest and leaves the choice where it already
 * is: the short rest on the same surface *is* a short rest's benefits, so the
 * route out of an interrupted long rest is the button that is already there
 * rather than a second one that would resolve to the same call - except at
 * three short rests in a row, where that button is deliberately not drawn, and
 * `Rest.tsx` then says the short rest is off the screen instead of pointing at
 * a control it has just taken away.
 */
export const interruptedRestRule = (rules: RulesSection[]): string | null =>
  downtimeSentence(rules, 'long rest is interrupted');

/**
 * The three verbs printed under each trait on the character sheet.
 *
 * "Use it to Sprint, Leap, Maneuver" is what tells a player who has never read
 * the book which of the six numbers a thing they want to do is rolled against,
 * and the sheet prints it under every trait for exactly that reason.
 *
 * Read out of the shipped dataset rather than typed in from the PDF. The SRD
 * carries them in `character-creation`, one bullet a trait, in the shape
 * `- Agility (Use it to Sprint, Leap, Maneuver,etc.) ...`. Typing them into
 * this file instead would put licensed text in the repository, which is the
 * whole reason `Manuali/` is gitignored - and it would also mean an app whose
 * verbs cannot follow a homebrew rules layer that redefines them.
 *
 * Verbatim, including the book's American spellings: this is the SRD's own
 * wording and the app does not re-word it. A trait the parse cannot find is
 * simply absent from the map, and the tiles then draw no verb line rather than
 * a guessed one.
 */
export function traitVerbs(rules: RulesSection[]): Partial<Record<Trait, string[]>> {
  const creation = rules.find((r) => r.id === 'character-creation');
  if (creation === undefined) return {};

  const out: Partial<Record<Trait, string[]>> = {};
  for (const line of creation.body.split('\n')) {
    // `[Uu]se it to` because the bullet is the only place this phrase occurs,
    // and the trailing `,etc.` in the shipped text has no space before it.
    const match = /^-\s+([A-Za-z]+)\s+\(\s*Use it to\s+([^)]*)\)/.exec(line.trim());
    if (match === null) continue;
    const trait = TRAITS.find((t) => t === match[1]!.toLowerCase());
    if (trait === undefined) continue;
    const verbs = match[2]!
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '' && !/^etc\.?$/i.test(v));
    if (verbs.length > 0) out[trait] = verbs;
  }
  return out;
}
