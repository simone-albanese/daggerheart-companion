/**
 * Reading a rules section out of the dataset.
 *
 * The app quotes the SRD rather than restating it. A paraphrase of "after an
 * adversary moves to where they would see you... you are no longer Hidden" is
 * a house rule waiting to happen, and the text is already sitting in
 * `dataset.rules`.
 *
 * Three shapes, not the two this file claimed for its first year: `## `
 * subheads, `- Label: text` bullets, and pipe tables. Twelve tables ship across
 * seven sections and every one of them fell through `paragraphs()` as a single
 * undifferentiated string - which is why the tables a GM looks up by hand were
 * invisible to every screen in the app.
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

export interface RuleTable {
  /** The first row that is not a separator. Cells trimmed, in order. */
  header: string[];
  rows: string[][];
}

/**
 * Every pipe table in a body or a block, in order.
 *
 * A run of consecutive lines that both begin and end with `|` is one table; a
 * blank line or any prose ends the run. **Every all-dashes row is dropped,
 * wherever it appears** - not only a leading one. `shared/parsers/rules.ts`
 * (813-822) always writes header, separator, then the body, and it pads every
 * cell, so trimming is exact rather than hopeful; no cell in the shipped
 * dataset is bare dashes, so dropping them all costs nothing and survives an
 * emitter that ever writes a second rule.
 *
 * The first surviving row is the header. Nothing here looks a row or a column
 * up by name: the app does not get to know what the SRD's tables are called,
 * because typing `Attack Modifier` into a `.ts` file is the same act as typing
 * the rule it labels. The callers pivot on position within the table they
 * found, and print whatever wording the dataset gave them.
 */
export function ruleTables(text: string): RuleTable[] {
  const out: RuleTable[] = [];
  let run: string[][] = [];

  const flush = (): void => {
    const [header, ...rows] = run;
    if (header !== undefined) out.push({ header, rows });
    run = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length < 2 || !line.startsWith('|') || !line.endsWith('|')) {
      flush();
      continue;
    }
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    run.push(cells);
  }
  flush();
  return out;
}

/**
 * Bare `- ` bullets, without the dash.
 *
 * `ruleBullets` below cannot see these: it needs a bounded `Label:` at the
 * front, and most of the SRD's lists carry none - "Interrupt the players to
 * steal the spotlight and make a move" is one whole bullet, not a label and a
 * gloss. A line that is not a bullet is skipped rather than kept as an empty
 * item, so a lead paragraph handed to this comes back as nothing at all, which
 * is what lets a caller tell a list apart from prose.
 */
export function ruleList(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const match = /^-\s+(.+)$/.exec(line.trim());
    if (match) out.push(match[1]!.trim());
  }
  return out;
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
 * The damage an encounter's adversaries add, in the book's own words.
 *
 * `EncounterAdjustments.damageBump` is a boolean, and every screen that has
 * ever drawn it has said what it means by typing the dice into the file -
 * `engine/encounter.ts` for the budget line, `Encounter.tsx` for the note under
 * the toggles, `SessionBody.tsx` for the chip on a planned row. Three
 * transcriptions of one sentence, and they had already drifted: the engine said
 * `+1d4 (or +2)`, the SRD says `+1d4 (or a static +2)`. A dataset layer that
 * changed the bump would have changed none of them.
 *
 * **All three are gone, and the third went last and for a sharper reason.** The
 * two screens quote this selector. The engine's line could not - it computes
 * points and has no rules layer to read - so it stopped transcribing at all and
 * names the switch instead: `'Adversaries deal extra damage'`. Leaving it as it
 * was would have been worse than before the change rather than better, because
 * a screen that quotes the book eleven lines under a toggle that quotes a stale
 * copy of it is a contradiction where there had only been an error.
 *
 * So the sentence is read out of whatever rules layer is loaded, and the screen
 * quotes it. Found by what the line says rather than by pinning
 * `building-balanced-encounters`, for `spellcastZeroNote`'s reason: a layer that
 * reorganises its sections would leave a section-keyed lookup silently empty,
 * and the phrase is unambiguous - it occurs exactly once in the shipped
 * dataset.
 *
 * The SRD writes it as a budget bullet, `- -2 if you add +1d4 (or a static +2)
 * to all adversaries' damage rolls`. The points are the builder's business and
 * `computeBudget` already owns them, so what comes back is only the half after
 * `if you add`: what the dice do, which is the half a GM reads at the table.
 *
 * Null when no loaded layer carries the line, and then the caller says only
 * that the row was built with the bump on - never a number this file guessed.
 */
export function damageBumpRule(rules: RulesSection[]): string | null {
  for (const rule of rules) {
    for (const line of rule.body.split('\n')) {
      const match = /\bif you add\s+(\+\d+d\d+\b.*)$/i.exec(line.trim());
      if (match !== null) return match[1]!.trim();
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
