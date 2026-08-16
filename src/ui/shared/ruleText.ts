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
