import { describe, expect, it } from 'vitest';
import { detectSource, pdfDateToIsoDay, type SourceProbe } from '../../src/import/detectSource.ts';

const CORE_INFO = {
  Title: 'Daggerheart Core Rulebook',
  Author: 'Spenser Starke',
  Subject: 'Core Rulebook for the Daggerheart RPG by Darrington Press',
  Producer: 'macOS Quartz PDFContext',
  CreationDate: "D:20250906211140-04'00'",
};

/** What a broken extractor emits in place of a glyph it cannot map. */
const CONTROL = '\u001E';
const PUA = '\uE541';

/** Enough clean prose to clear the "did any text come out" bar. */
const PROSE = 'Daggerheart is a collaborative fantasy roleplaying game. '.repeat(12);

const probe = (over: Partial<SourceProbe> = {}): SourceProbe => ({
  info: CORE_INFO,
  numPages: 397,
  pageWidth: 612,
  pageHeight: 792,
  sampleText: PROSE,
  ...over,
});

describe('pdfDateToIsoDay', () => {
  it('reads a PDF date and rejects anything else', () => {
    expect(pdfDateToIsoDay("D:20250906211140-04'00'")).toBe('2025-09-06');
    expect(pdfDateToIsoDay('2025-09-06')).toBeNull();
    expect(pdfDateToIsoDay('')).toBeNull();
  });
});

describe('detectSource', () => {
  it('accepts the Core Rulebook and dates the layer from the book', () => {
    const found = detectSource(probe());
    expect(found.kind).toBe('core-rulebook');
    expect(found.refusal).toBeNull();
    expect(found.layerId).toBe('core-2025-09-06');
    expect(found.label).toBe('Core Rulebook');
  });

  it('falls back to an undated layer id rather than failing', () => {
    const found = detectSource(probe({ info: { ...CORE_INFO, CreationDate: undefined } }));
    expect(found.layerId).toBe('core-undated');
  });

  it('recognises the SRD from its text alone, since it carries no title', () => {
    const found = detectSource(
      probe({
        info: { Producer: 'GPL Ghostscript 9.55.0' },
        numPages: 68,
        sampleText: 'System reference Document 1.0 This document is Public Game Content.',
      }),
    );
    expect(found.kind).toBe('srd');
    expect(found.layerId).toBeNull();
    expect(found.refusal).toMatch(/already built into this app/i);
  });

  it('refuses an unrelated PDF without touching anything', () => {
    const found = detectSource(
      probe({ info: { Title: 'Quarterly Report' }, numPages: 12, sampleText: 'Revenue was up.' }),
    );
    expect(found.kind).toBe('unknown');
    expect(found.layerId).toBeNull();
    expect(found.refusal).toMatch(/doesn't look like/i);
  });

  it('refuses a Core Rulebook whose text will not come out', () => {
    const scanned = detectSource(probe({ sampleText: 'Daggerheart' }));
    expect(scanned.kind).toBe('core-rulebook');
    expect(scanned.layerId).toBeNull();
    expect(scanned.refusal).toMatch(/scanned images/i);
  });

  it('refuses when ligatures have been dropped, however plausible the rest looks', () => {
    const found = detectSource({ ...probe(), sampleText: `${PROSE} roll against the Diculty.` });
    expect(found.layerId).toBeNull();
    expect(found.refusal).toMatch(/damaged/i);
    expect(found.evidence.join(' ')).toMatch(/lost ligature/);
  });

  it('refuses when glyphs arrive as control characters, the way the SRD does', () => {
    const found = detectSource({ ...probe(), sampleText: `${PROSE} All rights reserved${CONTROL}` });
    expect(found.layerId).toBeNull();
    expect(found.refusal).toMatch(/no unicode mapping/i);
    expect(found.evidence.join(' ')).toMatch(/U\+001E/);
  });

  it('refuses on a surviving Private Use Area glyph', () => {
    const found = detectSource({ ...probe(), sampleText: `${PROSE} Tier ${PUA} Solo` });
    expect(found.layerId).toBeNull();
    expect(found.evidence.join(' ')).toMatch(/U\+E541/);
  });

  it('does not mistake ordinary words for ligature damage', () => {
    const words = `${PROSE} The profile of a prole in the arm of a role.`;
    expect(detectSource({ ...probe(), sampleText: words }).refusal).toBeNull();
  });
});
