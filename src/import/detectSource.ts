/**
 * Identify the PDF the user just picked, and refuse politely when it is not
 * the one book this importer reads.
 *
 * There are three files a user plausibly drops here, and only one of them is
 * worth parsing:
 *
 *   Core Rulebook   the book they bought. Import it.
 *   SRD             free, already compiled into the app. Importing it would
 *                   add nothing, so say so rather than churn for a minute.
 *   anything else   refuse, and do not touch the database.
 *
 * Metadata alone is not enough: it is trivially editable and says nothing
 * about whether the *text* can be read. So identification pairs the document
 * info with a probe of the extracted text, which also re-checks the one
 * assumption everything downstream rests on - that pdf.js reads this file
 * correctly. The SRD is the cautionary tale: its subset fonts hand pdf.js C0
 * control characters where the card levels should be, and a parser that
 * trusted them would produce a dataset that merely *looks* right (see
 * `tools/pdfText.ts`). If that ever happens to the Core Rulebook, this refuses
 * instead of importing silently corrupted content.
 */

export type SourceKind = 'core-rulebook' | 'srd' | 'unknown';

/** Everything identification is allowed to look at. Gathered by the worker. */
export interface SourceProbe {
  /** pdf.js `getMetadata().info`, verbatim. Values may be anything. */
  info: Record<string, unknown>;
  numPages: number;
  /** Media box of the first page, in points. */
  pageWidth: number;
  pageHeight: number;
  /** Concatenated text of a handful of pages spread through the file. */
  sampleText: string;
}

export interface DetectedSource {
  kind: SourceKind;
  /** Layer id to write under, or null when the file must not be imported. */
  layerId: string | null;
  label: string;
  /** What the decision was based on. For the import log, not for the user. */
  evidence: string[];
  /** Non-null means: stop, show this, write nothing. */
  refusal: string | null;
}

const CORE_LABEL = 'Core Rulebook';

/**
 * Ligature damage, as it appears when an extractor drops the glyph instead of
 * decomposing it. These are exactly the regression cases the SRD build guards
 * against; here they are a reason to refuse rather than a reason to fail a
 * build, because the file belongs to the user and we cannot fix it. Every
 * entry is a non-word in English, so a false positive would take a typo in
 * the book itself.
 */
const BROKEN_LIGATURES =
  /\b(?:diculty|benets|modier|nesse|specic|reect|dierent|eect|conict|sucient)\b/i;

/**
 * Characters that mean the extractor gave up: C0 controls, which is what
 * pdf.js emits for a glyph with no ToUnicode entry, and Private Use Area
 * codepoints, which is where the SRD hides its decorative digits.
 */
const UNREADABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uE000-\uF8FF]/;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** `D:20250906211140-04'00'` -> `2025-09-06`. */
export function pdfDateToIsoDay(raw: string): string | null {
  const m = /^D:(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(day)) ? null : day;
}

/**
 * The layer id comes from the book's creation date rather than from a hash:
 * hashing 319 MB before we even know the file is the right book would cost a
 * minute of the user's time for nothing. A reprint with corrected text carries
 * a new date and therefore lands in a new layer instead of silently
 * overwriting the old one.
 */
function coreLayerId(info: Record<string, unknown>): string {
  const day = pdfDateToIsoDay(str(info['CreationDate']));
  return day ? `core-${day}` : 'core-undated';
}

function looksLikeSrd(info: Record<string, unknown>, sample: string): boolean {
  const meta = `${str(info['Title'])} ${str(info['Subject'])} ${str(info['Keywords'])}`;
  if (/system\s+reference\s+document/i.test(meta)) return true;
  if (/\bSRD\b/.test(meta) && /daggerheart/i.test(meta)) return true;
  return /system\s+reference\s+document/i.test(sample);
}

/** Confidence that this is the Core Rulebook. Three or more is a match. */
function coreScore(info: Record<string, unknown>, sample: string): number {
  let score = 0;
  const title = str(info['Title']);
  if (/daggerheart/i.test(title) && /core\s+rule\s?book/i.test(title)) score += 3;
  else if (/core\s+rule\s?book/i.test(title)) score += 2;
  if (/darrington\s+press/i.test(`${str(info['Subject'])} ${str(info['Author'])}`)) score += 1;
  if (/daggerheart/i.test(sample)) score += 1;
  if (/darrington\s+press/i.test(sample)) score += 1;
  if (/core\s+rule\s?book/i.test(sample)) score += 1;
  return score;
}

const REFUSE_UNKNOWN =
  "This doesn't look like the Daggerheart Core Rulebook, so nothing was imported. " +
  'The importer reads that one book and nothing else. If you own it, pick its PDF instead.';

const REFUSE_SRD =
  'That is the free System Reference Document, and every rule in it is already built ' +
  'into this app - importing it would add nothing. The artwork, the campaign frames ' +
  'and the fuller flavour text are in the Core Rulebook PDF, sold separately at ' +
  'daggerheart.com.';

/** Decide what the file is. Pure, so the decision is testable without a PDF. */
export function detectSource(probe: SourceProbe): DetectedSource {
  const { info, sampleText } = probe;
  const evidence: string[] = [
    `pages=${probe.numPages}`,
    `page=${Math.round(probe.pageWidth)}x${Math.round(probe.pageHeight)}pt`,
    `title=${JSON.stringify(str(info['Title']))}`,
    `producer=${JSON.stringify(str(info['Producer']))}`,
    `sample=${sampleText.length} chars`,
  ];

  if (looksLikeSrd(info, sampleText)) {
    evidence.push('matched: system reference document');
    return { kind: 'srd', layerId: null, label: 'SRD 1.0', evidence, refusal: REFUSE_SRD };
  }

  const score = coreScore(info, sampleText);
  evidence.push(`coreScore=${score}`);
  if (score < 3) {
    return {
      kind: 'unknown',
      layerId: null,
      label: 'Unknown PDF',
      evidence,
      refusal: REFUSE_UNKNOWN,
    };
  }

  // Identified. Now the question that decides whether parsing may proceed at
  // all: did the text come out readable?
  const refuse = (why: string, refusal: string): DetectedSource => {
    evidence.push(`text probe: ${why}`);
    return { kind: 'core-rulebook', layerId: null, label: CORE_LABEL, evidence, refusal };
  };

  if (sampleText.trim().length < 400) {
    return refuse(
      'too little text',
      'This is the Core Rulebook, but almost no text could be read from it - the ' +
        'pages may be scanned images rather than typeset text. Nothing was imported. ' +
        'A copy downloaded again from your storefront usually works.',
    );
  }

  const broken = BROKEN_LIGATURES.exec(sampleText);
  if (broken) {
    return refuse(
      `lost ligature ${JSON.stringify(broken[0])}`,
      'This is the Core Rulebook, but its text is coming out damaged on this device ' +
        `(${JSON.stringify(broken[0])} should be a word with a ligature in it). Importing ` +
        'it would fill the app with subtly wrong rules text, so nothing was imported.',
    );
  }

  const unreadable = UNREADABLE.exec(sampleText);
  if (unreadable) {
    const code = unreadable[0]!.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
    return refuse(
      `unmapped glyph U+${code}`,
      `This is the Core Rulebook, but some of its glyphs have no unicode mapping ` +
        `(U+${code}), which silently destroys numbers such as card levels and recall ` +
        'costs. Nothing was imported.',
    );
  }

  evidence.push('text probe: clean');
  return {
    kind: 'core-rulebook',
    layerId: coreLayerId(info),
    label: CORE_LABEL,
    evidence,
    refusal: null,
  };
}
