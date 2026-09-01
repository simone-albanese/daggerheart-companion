/**
 * Private Use Area remapping for the Daggerheart SRD.
 *
 * The SRD's stat blocks do not use real digits for tier numbers and horde /
 * minion counts: they use decorative glyphs from the Eveleth display face that
 * live in the Unicode Private Use Area. A parser that ignores them silently
 * produces a dataset that *looks* right and is quietly wrong:
 *
 *   raw:  "Tier  Solo"          want: "Tier 1 Solo"
 *   raw:  "Horde (/HP)"         want: "Horde (2/HP)"
 *   raw:  "Horde (/HP)"   want: "Horde (10/HP)"
 *
 * The table below was derived by counting every PUA codepoint in the 9-09-25
 * SRD and cross-checking each occurrence against the surrounding prose, where
 * the same numbers also appear as ordinary digits.
 *
 * ## 7, 8 and 9 arrived with SRD 2, and were read off the page
 *
 * `DH_SRD_2_2026_08_25.pdf` uses three codepoints this table did not have, and
 * they continue the run - which is exactly why they were not taken on that
 * basis. A guessed digit is the failure this module exists to prevent: it
 * parses clean and is silently wrong, and nothing downstream can tell. So each
 * was rendered and looked at, and the two the prose also restates carry that
 * second witness:
 *
 *   E547  PDF p122  `Minion (7)`, and the next line: "For every 7 damage a PC
 *                   deals to the Recruit, defeat an ..."
 *   E548  PDF p99   `Tier 1 Horde (8/HP)`, Darkweave Swarmlings; again on p112,
 *                   Will-o'-the-Wisps. Two independent stat blocks.
 *   E549  PDF p135  `Minion (9)`, and the next line: "For every 9 damage a PC
 *                   deals to the Elemental, ..."
 *
 * The method was validated on two codepoints whose value this table already
 * fixed: E545 renders `Tier 1 Horde (5/HP)` on p100, and E546 renders
 * `Horde (1d6+3)` on p114 with the same line restating `1d6+3` in bold.
 *
 * E540 is used by neither book. The run is therefore 0 at E53F and 1-9 at
 * E541-E549, which is not contiguous; whether E540 is an alternate zero or
 * simply unassigned in the subset is unknown and only matters if a revision
 * starts using it - at which point `unknown` below stops the build, which is
 * the whole arrangement working.
 *
 * This module is BUILD TIME ONLY. The Core Rulebook uses real digits, so the
 * runtime importer never needs it.
 */

/** Codepoint -> replacement. Counts are from the 2025-09-09 SRD. */
export const PUA_MAP: Readonly<Record<string, string>> = Object.freeze({
  '\u{E53F}': '0', // x1
  '\u{E541}': '1', // x63
  '\u{E542}': '2', // x43
  '\u{E543}': '3', // x29
  '\u{E544}': '4', // x23
  '\u{E545}': '5', // x1
  '\u{E546}': '6', // x1
  '\u{E547}': '7', // SRD 2 only
  '\u{E548}': '8', // SRD 2 only
  '\u{E549}': '9', // SRD 2 only
  '\u{F0E0}': '→', // x4 - Wingdings right arrow
});

const puaRe = (): RegExp => /[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu;

export interface GlyphResult {
  text: string;
  /** Codepoints that were not in the table, as `U+XXXX` strings. */
  unknown: string[];
}

/**
 * Replace known PUA glyphs and report anything unrecognised.
 *
 * Callers must treat a non-empty `unknown` as fatal: an unknown decorative
 * glyph means the source revision changed the display font, and every number
 * that came from it is now suspect. Failing the build is the only safe answer.
 */
export function remapGlyphs(text: string): GlyphResult {
  const unknown = new Set<string>();
  const out = text.replace(puaRe(), (ch) => {
    const hit = PUA_MAP[ch];
    if (hit !== undefined) return hit;
    unknown.add(`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
    return ch;
  });
  return { text: out, unknown: [...unknown].sort() };
}

/** Convenience for call sites that have already validated the source. */
export function remapGlyphsStrict(text: string): string {
  const { text: out, unknown } = remapGlyphs(text);
  if (unknown.length > 0) {
    throw new Error(
      `Unknown Private Use Area glyph(s) survived parsing: ${unknown.join(', ')}. ` +
        `The source PDF's display font changed; every extracted number is suspect. ` +
        `Update PUA_MAP in tools/glyphs.ts after checking each occurrence against the prose.`,
    );
  }
  return out;
}

/** True when any PUA codepoint remains in the string. */
export const hasPua = (text: string): boolean => puaRe().test(text);
