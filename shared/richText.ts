/**
 * The note a GM writes into a session row, and the format it is stored in.
 *
 * ## The one decision that cannot be taken back
 *
 * A note carries bold, italic, bullets and a centred heading. Three of those
 * four have a markdown spelling; **centring does not**. Markdown has no
 * alignment at all - every dialect that offers it does so by falling through to
 * raw HTML, which this app has no way to render and no intention of acquiring.
 * So whatever carries centring here is invented here, and it goes into every
 * `.dhcampaign` anybody ever exports, for ever. That is the decision this
 * docblock exists to defend.
 *
 * **The syntax chosen is no syntax at all.** A note is stored as an array of
 * block objects with an `align` *field*, not as a string of markup with an
 * invented sigil in it. The alternatives were `->centred<-`, `:::center`, and
 * `<center>`; all three were rejected for the same reason, which is not
 * aesthetic:
 *
 *  - **A sigil is a thing a GM can type by accident.** `->` and `:::` and `<`
 *    are characters that appear in real prose about a fantasy campaign - stat
 *    arrows, scene separators, a whispered `<the door opens>`. The moment a
 *    sigil exists, the format needs an escape for it, and the escape needs an
 *    escape. A field name cannot be typed into prose at all, so that entire
 *    class of bug does not exist here.
 *  - **A markup string has to be parsed on every read, and this string is
 *    untrusted.** It arrives in somebody else's `.dhcampaign`. A parser is
 *    exactly the component that has to survive a hostile input, and the safest
 *    parser is the one that was never written: `JSON.parse` has already run by
 *    the time this file sees anything, and what is left is shape validation.
 *  - **The exported file stays readable in a text editor**, which is the
 *    promise `.dhcampaign` already makes in `campaignFile.ts`. A block array is
 *    verbose and completely self-describing; `->x<-` is neither.
 *
 * The cost is real and is accepted: the file is bigger, and an editor has to
 * build blocks rather than manipulate a string. `MAX_NOTE_CHARS` is what keeps
 * the first cost bounded.
 *
 * ## Why not `src/ui/shared/ruleText.ts`
 *
 * That module is on the SRD read path. It formats text this repo *ships*, from
 * a dataset that is built at compile time and is trusted by construction.
 * Widening it to also carry a GM's typed, exported, imported, attacker-supplyable
 * prose would put untrusted input through the code that renders the rulebook,
 * and would tie the SRD's formatting to a file format we can never change. Two
 * different trust levels do not share a parser.
 *
 * ## Untrusted, therefore bounded
 *
 * A note is on exactly the same footing as a URL row: it arrives from another
 * person and it is stored. So it is bounded in every dimension that can grow -
 * total characters, blocks, spans per block, bullets per list - and clamped by
 * the reader rather than by whatever screen happens to draw it. Every bound is
 * enforced on the way in, so a hostile value never reaches storage.
 *
 * ## What this file does not do
 *
 * It does not render. There is no HTML here, no markup, no string
 * concatenation into a tag. The only text function it exports is
 * `plainTextOf`, and both of its call sites draw the string it returns as a
 * text node and nothing else: `describeItem` in `src/ui/gm/session.ts` for the
 * collapsed row's one summary line, and `NoteArm` in
 * `src/ui/gm/SessionBody.tsx` for the opened row's body. No component in this
 * tree reads `spans`, `bold`, `italic` or `align` to draw with; emphasis,
 * headings and centring are stored and exported but not yet drawn, and the
 * editor that will draw them is not written. So "it is never rendered as
 * anything but text" is a property of the format - there is no markup for a
 * component to build - rather than a promise about any one component.
 */

/** Where a block sits. Two values, because a third has no wireframe. */
export type NoteAlign = 'start' | 'center';

/**
 * A run of text with its emphasis, rather than `**bold**` inside a string.
 *
 * `bold` and `italic` are required rather than optional so that a note
 * round-trips through JSON to the same bytes: an absent key and a `false` one
 * would be two spellings of the same note, and the `.dhcampaign` checksum is
 * computed over `JSON.stringify`, which can tell them apart.
 */
export interface NoteSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

export type NoteBlock =
  | { type: 'heading'; align: NoteAlign; spans: NoteSpan[] }
  | { type: 'paragraph'; align: NoteAlign; spans: NoteSpan[] }
  /** No `align`: a centred bullet list is not a thing the wireframe draws. */
  | { type: 'bullets'; items: NoteSpan[][] };

export type NoteDoc = NoteBlock[];

/** Total characters of actual text across every span. Everything else is shape. */
export const MAX_NOTE_CHARS = 4000;
export const MAX_NOTE_BLOCKS = 200;
export const MAX_NOTE_SPANS = 200;
export const MAX_NOTE_BULLETS = 100;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const ALIGNS: readonly NoteAlign[] = ['start', 'center'];

/**
 * Every character a span may not contain, replaced by a single space.
 *
 * C0 and C1, which covers the newline: a line break inside a span is a block
 * boundary wearing a disguise, and a note whose structure lives half in the
 * array and half in the characters is a note that two screens will draw
 * differently. U+2028 and U+2029 go with them - they are line terminators to a
 * JavaScript parser and invisible to a reader, a combination with no honest
 * use in prose about a fantasy campaign.
 *
 * Replaced rather than deleted, so that a span holding a newline reads as two
 * words rather than as one run-together one.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;

/** One span, or nothing. An empty one is a block's worth of nothing to draw. */
const readSpan = (v: unknown): NoteSpan[] => {
  const r = isRecord(v) ? v : {};
  const raw = typeof r['text'] === 'string' ? r['text'] : '';
  const text = raw.replace(FORBIDDEN, ' ');
  if (text === '') return [];
  return [{ text, bold: r['bold'] === true, italic: r['italic'] === true }];
};

const readSpans = (v: unknown): NoteSpan[] =>
  (Array.isArray(v) ? v : []).slice(0, MAX_NOTE_SPANS).flatMap(readSpan);

const readAlign = (v: unknown): NoteAlign =>
  ALIGNS.includes(v as NoteAlign) ? (v as NoteAlign) : 'start';

/**
 * Read a note out of a record nobody in this build wrote.
 *
 * Blocks whose `type` this build has no name for are dropped rather than kept,
 * which is the opposite of what `readSessionItem` does one level up, and the
 * difference is deliberate. A session *row* the app cannot read is a row the GM
 * counted and would notice missing, so it is kept and named. A paragraph inside
 * a note has no identity of its own and nothing to name it with - "one block of
 * this note could not be read" is a sentence that helps nobody - and keeping it
 * would mean carrying an arbitrary untyped object through the store for the
 * lifetime of the format. The whole-note character bound is what makes dropping
 * safe: a note that lost a block is still the note, and `warn` says it happened.
 *
 * `warn` is optional so a caller with nowhere to put a sentence is not forced
 * to invent one.
 */
export function readNoteDoc(value: unknown, warn: (s: string) => void = () => {}): NoteDoc {
  const raw = Array.isArray(value) ? value : [];
  if (raw.length > MAX_NOTE_BLOCKS) {
    warn(
      `a note held ${String(raw.length)} blocks, and this app stores at most ${String(MAX_NOTE_BLOCKS)}, so the rest were left out`,
    );
  }
  let dropped = false;
  const blocks: NoteDoc = raw.slice(0, MAX_NOTE_BLOCKS).flatMap((entry): NoteBlock[] => {
    const r = isRecord(entry) ? entry : {};
    switch (r['type']) {
      case 'heading':
      case 'paragraph': {
        const spans = readSpans(r['spans']);
        if (spans.length === 0) return [];
        return [{ type: r['type'], align: readAlign(r['align']), spans }];
      }
      case 'bullets': {
        const items = (Array.isArray(r['items']) ? r['items'] : [])
          .slice(0, MAX_NOTE_BULLETS)
          .map(readSpans)
          .filter((spans) => spans.length > 0);
        if (items.length === 0) return [];
        return [{ type: 'bullets', items }];
      }
      default:
        dropped = true;
        return [];
    }
  });
  if (dropped) {
    warn('part of a note was written by a newer version of the app and could not be read');
  }

  // The character bound last, over the shape that survived: bounding the input
  // string instead would let a note of ten thousand empty spans through.
  return truncateNote(blocks, warn);
}

/**
 * Cut a note down to `MAX_NOTE_CHARS` of actual text.
 *
 * Cut, rather than refuse. A note is prose somebody typed at a table, and
 * refusing the row would take the readable four thousand characters away along
 * with the rest. The cut lands inside a span so no block loses its shape.
 */
function truncateNote(blocks: NoteDoc, warn: (s: string) => void): NoteDoc {
  let left = MAX_NOTE_CHARS;
  let cut = false;
  const take = (spans: NoteSpan[]): NoteSpan[] =>
    spans.flatMap((span) => {
      if (left <= 0) {
        cut = true;
        return [];
      }
      if (span.text.length <= left) {
        left -= span.text.length;
        return [span];
      }
      const text = span.text.slice(0, left);
      left = 0;
      cut = true;
      return [{ ...span, text }];
    });

  const out = blocks.flatMap((block): NoteBlock[] => {
    if (block.type === 'bullets') {
      const items = block.items.map(take).filter((spans) => spans.length > 0);
      return items.length === 0 ? [] : [{ type: 'bullets', items }];
    }
    const spans = take(block.spans);
    return spans.length === 0 ? [] : [{ ...block, spans }];
  });

  if (cut) {
    warn(
      `a note was longer than the ${String(MAX_NOTE_CHARS)} characters this app stores, so the end of it was left out`,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Writing one
// ---------------------------------------------------------------------------

/** An empty note. A row always has one; it is never null. */
export const emptyNote = (): NoteDoc => [];

/** One span with no emphasis. The unit an editor builds everything else from. */
export const noteSpan = (text: string, bold = false, italic = false): NoteSpan => ({
  text,
  bold,
  italic,
});

/**
 * A note from plain typed text, one paragraph per line.
 *
 * The writer an editor falls back to, and the one a paste lands in. Blank lines
 * separate paragraphs rather than becoming empty ones, because an empty
 * paragraph is a block with nothing to draw and the reader drops it anyway.
 *
 * It runs the result through `readNoteDoc`, so text typed into the app is bound
 * and cleaned by exactly the code that binds and cleans text arriving from
 * somebody else. One path in, not two.
 */
export const noteFromPlainText = (text: string): NoteDoc =>
  readNoteDoc(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .map((line) => ({ type: 'paragraph', align: 'start', spans: [noteSpan(line)] })),
  );

// ---------------------------------------------------------------------------
// Reading one back out as text
// ---------------------------------------------------------------------------

/**
 * The note as plain text: the collapsed row's summary line and the opened
 * row's body, which are the only two things that read a note at all.
 *
 * Bullets get a `• ` because a list read as a run-on sentence is a different
 * document. No emphasis marks: this is not a serialisation and it is not
 * reversible, and adding `**` here would create exactly the markup string this
 * format was chosen to avoid - one that a later reader would be tempted to
 * parse.
 */
export const plainTextOf = (doc: NoteDoc): string =>
  doc
    .map((block) =>
      block.type === 'bullets'
        ? block.items.map((item) => `• ${textOfSpans(item)}`).join('\n')
        : textOfSpans(block.spans),
    )
    .join('\n');

const textOfSpans = (spans: readonly NoteSpan[]): string => spans.map((s) => s.text).join('');

/** How many characters of prose it holds. What the bound is measured against. */
export const noteLength = (doc: NoteDoc): number =>
  doc.reduce(
    (total, block) =>
      total +
      (block.type === 'bullets'
        ? block.items.reduce((n, item) => n + textOfSpans(item).length, 0)
        : textOfSpans(block.spans).length),
    0,
  );

export const isNoteEmpty = (doc: NoteDoc): boolean => noteLength(doc) === 0;
