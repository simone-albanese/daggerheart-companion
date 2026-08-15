/**
 * Reading a rules section out of the dataset.
 *
 * The app quotes the SRD rather than restating it. A paraphrase of "after an
 * adversary moves to where they would see you... you are no longer Hidden" is
 * a house rule waiting to happen, and the text is already sitting in
 * `dataset.rules`. These are the only two shapes those bodies come in: `## `
 * subheads and `- Label: text` bullets.
 */

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
