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
 * The book's own sentence about a Spellcast trait of +0 or lower.
 *
 * The Play screen has to refuse a spell damage roll for a character whose
 * Spellcast trait is +0, and a refusal is exactly where an app is most tempted
 * to invent a rule. This lifts the SRD's own words - *"Note: If your Spellcast
 * trait is +0 or lower, you don't roll anything"* - so the screen quotes rather
 * than paraphrases, and so a homebrew rules layer that changes the rule changes
 * what the screen says.
 *
 * Found by the sentence and not by a section id: the phrase is specific enough
 * to be unambiguous - it occurs exactly once in the shipped dataset - and
 * pinning `attacking` would go quiet the moment a layer reorganised its
 * sections, which is the failure this whole module is written against.
 *
 * The leading `Note:` goes because the row prints a sentence, not an
 * annotation to a paragraph that is not on the screen. Null when no rules layer
 * carries the sentence at all, and then the caller says it in the app's own
 * words - unquoted, so that what is between quotation marks on that row is
 * always the book's.
 */
export function spellcastZeroNote(rules: RulesSection[]): string | null {
  for (const rule of rules) {
    for (const line of rule.body.split('\n')) {
      const text = line.trim();
      if (!/spellcast trait is \+0 or lower/i.test(text)) continue;
      return text.replace(/^note:\s*/i, '');
    }
  }
  return null;
}

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
