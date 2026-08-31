/**
 * The Private Use Area table, which had no test at all.
 *
 * `glyphs.ts` decides what every tier number, minion threshold and horde count
 * in the dataset says, and nothing in the suite touched it. A wrong entry
 * produces a dataset that parses clean, validates clean, and is quietly wrong
 * about numbers a GM reads at the table - which is the exact failure the module
 * was written to prevent, left unguarded in the module itself.
 *
 * The VALUES are argued in that module's docblock, against rendered pages of
 * both books, because a rendered page is the only evidence there is: the glyphs
 * carry no meaning a machine can read. What is pinned HERE is the behaviour
 * around them, and above all that an unrecognised glyph is reported rather than
 * passed through - the one thing standing between a new display font and a
 * silently renumbered bestiary.
 */
import { describe, expect, it } from 'vitest';
import { PUA_MAP, remapGlyphs, remapGlyphsStrict } from '../../tools/glyphs.ts';

describe('the private use area table', () => {
  it('maps the whole digit run, 0 through 9', () => {
    // E540 is deliberately absent: neither book uses it. The run is 0 at E53F
    // and 1-9 at E541-E549, so it is NOT contiguous, and writing that down is
    // what stops a later reader closing the gap by assuming it should be.
    expect(PUA_MAP['\u{E53F}']).toBe('0');
    for (let i = 1; i <= 9; i += 1) {
      expect(PUA_MAP[String.fromCodePoint(0xe540 + i)], `digit ${i}`).toBe(String(i));
    }
    expect(PUA_MAP['\u{E540}']).toBeUndefined();
  });

  it('rebuilds the stat-block lines the books print with glyphs', () => {
    // The three shapes the docblock cites, from the pages they were read on.
    expect(remapGlyphs('Minion (\u{E547}) - Passive').text).toBe('Minion (7) - Passive');
    expect(remapGlyphs('Tier \u{E541} Horde (\u{E548}/HP)').text).toBe('Tier 1 Horde (8/HP)');
    expect(remapGlyphs('Horde (1d\u{E546}+3)').text).toBe('Horde (1d6+3)');
  });

  it('reports an unknown glyph instead of dropping or guessing it', () => {
    const result = remapGlyphs('Minion (\u{E54F})');
    expect(result.unknown).toEqual(['U+E54F']);
    // Left in place rather than deleted: a caller that ignores `unknown` still
    // gets a string with the damage visible in it, not "Minion ()".
    expect(result.text).toBe('Minion (\u{E54F})');
  });

  it('says nothing is unknown when nothing is', () => {
    expect(remapGlyphs('Tier \u{E542} Solo').unknown).toEqual([]);
    expect(remapGlyphsStrict('Tier \u{E542} Solo')).toBe('Tier 2 Solo');
  });

  it('leaves ordinary text alone, digits included', () => {
    const plain = 'Tier 1 Horde (8/HP), 2d6+3 physical';
    expect(remapGlyphs(plain).text).toBe(plain);
    expect(remapGlyphs(plain).unknown).toEqual([]);
  });
});
