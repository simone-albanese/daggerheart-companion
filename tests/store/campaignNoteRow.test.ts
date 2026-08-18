/**
 * The note row's format, and the one decision in it that cannot be taken back.
 *
 * A note carries bold, italic, bullets and a centred heading. Three of those
 * four have a markdown spelling; **centring does not** - markdown has no
 * alignment at all, and every dialect that offers it does so by falling through
 * to raw HTML, which this app has no way to render and no intention of
 * acquiring. So whatever carries centring is invented here, and it goes into
 * every `.dhcampaign` anybody ever exports, for ever.
 *
 * `shared/richText.ts` argues the choice: **no syntax at all.** A note is an
 * array of block objects with an `align` field, not a string of markup with an
 * invented sigil in it. This file is what makes that argument checkable, and
 * the sharpest assertion in it is the one about prose: a GM who types `->`,
 * `:::`, `<center>` or `**` into a note about a fantasy campaign gets those
 * characters back, because they are not syntax and there is nothing to escape.
 * That whole class of bug - a sigil, then an escape for it, then an escape for
 * the escape - does not exist in a format where the structure is never in the
 * characters.
 *
 * The second half is the trust level. A note arrives in somebody else's file on
 * exactly the same footing as a URL, so it is bounded in every dimension that
 * can grow and clamped by the reader rather than by whatever screen draws it.
 * Every bound below is asserted with a payload and, in the comment beside it,
 * the one-line change that lets the payload through - applied and run before
 * this file was committed.
 */
import { describe, expect, it } from 'vitest';
import { newCampaign, readCampaignRecord, type Campaign } from '../../shared/campaigns.ts';
import {
  emptyNote,
  isNoteEmpty,
  MAX_NOTE_BLOCKS,
  MAX_NOTE_BULLETS,
  MAX_NOTE_CHARS,
  MAX_NOTE_SPANS,
  noteFromPlainText,
  noteLength,
  noteSpan,
  plainTextOf,
  readNoteDoc,
  type NoteBlock,
  type NoteDoc,
} from '../../shared/richText.ts';
import { parseCampaignFile, serializeCampaign } from '../../src/transfer/campaignFile.ts';

const AT = new Date('2026-08-18T10:00:00.000Z');

const para = (text: string, align: 'start' | 'center' = 'start'): NoteBlock => ({
  type: 'paragraph',
  align,
  spans: [noteSpan(text)],
});

/** A note row as it would arrive off a disk, read by the campaign reader. */
const noteRow = (note: unknown): { doc: NoteDoc; warnings: string[] } => {
  const { campaign, warnings } = readCampaignRecord({
    id: 'campaign-1',
    name: 'A Campaign',
    session: [{ id: 'n1', kind: 'note', name: 'A note', note }],
  });
  const item = campaign.session[0]!;
  if (item.kind !== 'note') throw new Error(`the row came back as ${item.kind}, not a note row`);
  return { doc: item.note, warnings };
};

/** Out to a `.dhcampaign` and back in, which is the only round trip that ships. */
const roundTrip = (note: NoteDoc): NoteDoc => {
  const campaign: Campaign = {
    ...newCampaign('Theirs', '2026-08-18T10:00:00.000Z', 'c-note'),
    session: [{ id: 'n1', kind: 'note', name: 'A note', order: 0, collapsed: true, note }],
  };
  const back = parseCampaignFile(serializeCampaign(campaign, AT)).campaign.session[0]!;
  if (back.kind !== 'note') throw new Error('the row did not come back as a note');
  return back.note;
};

describe('the invented part, which is centring', () => {
  it('carries alignment as a field, and it survives a file', () => {
    /*
     * The whole reason this is a 16-hour job rather than a 2-hour one. There is
     * no markdown for this, so a string format would have needed a sigil
     * chosen here and frozen into every exported file for ever. A field cannot
     * be typed into prose, so it needs no escape and has no ambiguity.
     */
    const doc: NoteDoc = [
      { type: 'heading', align: 'center', spans: [noteSpan('Terms', true)] },
      para('Rhys wants the cargo.'),
    ];
    const back = roundTrip(doc);
    expect(back).toEqual(doc);
    expect(back[0]!.type !== 'bullets' && back[0]!.align).toBe('center');
    expect(back[1]!.type !== 'bullets' && back[1]!.align).toBe('start');
  });

  it('gives a bullet list no alignment at all, because the wireframe draws none', () => {
    const doc = readNoteDoc([
      { type: 'bullets', align: 'center', items: [[noteSpan('one')]] },
    ]);
    expect(doc[0]!.type).toBe('bullets');
    expect(Object.keys(doc[0]!).sort()).toEqual(['items', 'type']);
  });

  it('falls back to start for an alignment no build knows', () => {
    // Not a refusal: a note whose heading came back left-aligned is still the
    // note, and refusing the block would cost the words as well as the layout.
    const doc = readNoteDoc([{ type: 'heading', align: 'justify', spans: [noteSpan('x')] }]);
    expect(doc[0]!.type !== 'bullets' && doc[0]!.align).toBe('start');
  });
});

describe('the sigils that were rejected, which are now just prose', () => {
  /*
   * `->centred<-`, `:::center` and `<center>` were the three alternatives, and
   * all three were rejected for the same reason: `->`, `:::` and `<` appear in
   * real prose about a fantasy campaign - stat arrows, scene separators, a
   * whispered `<the door opens>`. The moment a sigil exists, the format needs
   * an escape for it, and the escape needs an escape.
   *
   * There is no mutation to run against this one, and that is the point: there
   * is no parser to break. The assertion is that the characters come back.
   */
  it('gives a GM back every character they typed, sigil-shaped or not', () => {
    const typed = [
      '->centred<-',
      ':::center',
      '<center>the door opens</center>',
      '**not bold**',
      '# not a heading',
      '- not a bullet',
      'STR -> +2, and the ford is <difficult> terrain',
    ];
    const doc = roundTrip(typed.map((t) => para(t)));
    expect(doc.map((b) => (b.type === 'bullets' ? '' : b.spans[0]!.text))).toEqual(typed);
    // None of them turned into structure on the way through.
    expect(doc).toHaveLength(typed.length);
    for (const block of doc) expect(block.type).toBe('paragraph');
  });

  it('never emits a sigil of its own, even in the one text function it has', () => {
    /*
     * `plainTextOf` feeds the collapsed row's summary line and the opened row's
     * body, which are its two call sites, and both draw what it returns as a
     * text node. It is not a serialisation and it is not reversible, and
     * putting `**` in it would create exactly the markup string this format was
     * chosen to avoid - one that a later reader would be tempted to parse.
     */
    const text = plainTextOf([
      { type: 'heading', align: 'center', spans: [noteSpan('Terms', true)] },
      { type: 'paragraph', align: 'start', spans: [noteSpan('very', false, true)] },
      { type: 'bullets', items: [[noteSpan('one')], [noteSpan('two')]] },
    ]);
    expect(text).toBe('Terms\nvery\n• one\n• two');
    for (const sigil of ['**', '*', '_', '#', '->', ':::', '<']) {
      expect(text, sigil).not.toContain(sigil);
    }
  });
});

describe('the round trip, byte for byte', () => {
  it('gives back a note identical to the one that went out', () => {
    const doc: NoteDoc = [
      { type: 'heading', align: 'center', spans: [noteSpan('Terms the bandits will take', true)] },
      {
        type: 'paragraph',
        align: 'start',
        spans: [
          noteSpan('Rhys wants the '),
          noteSpan('cargo', true),
          noteSpan(', not the fight, and she will say so if '),
          noteSpan('someone asks her name', false, true),
          noteSpan('.'),
        ],
      },
      {
        type: 'bullets',
        items: [
          [noteSpan('Half the crates, and the ford stays open.')],
          [noteSpan('No deal at all', true), noteSpan(' once the burrower surfaces.')],
        ],
      },
    ];
    expect(roundTrip(doc)).toEqual(doc);
    // Deep equality is not enough on its own here: the `.dhcampaign` checksum
    // is computed over `JSON.stringify`, so the *bytes* have to match too or
    // the file this app writes will not verify against the file it reads.
    expect(JSON.stringify(roundTrip(doc))).toBe(JSON.stringify(doc));
  });

  /*
   * Mutation, run: `bold: r['bold'] === true` -> `bold: r['bold']` in
   * `readSpan`.
   * Result: red - a span written `{ text: 'x' }` comes back with
   * `bold: undefined`, `JSON.stringify` drops the key, and the two spellings of
   * an unemphasised span stop being one.
   */
  it('always writes bold and italic, so one note has one spelling', () => {
    // An absent key and a `false` one would be two spellings of the same note,
    // and the checksum can tell them apart - so a file would fail to verify
    // against itself depending on which editor built the span.
    const doc = readNoteDoc([{ type: 'paragraph', spans: [{ text: 'plain' }] }]);
    expect(JSON.stringify(doc)).toBe(
      '[{"type":"paragraph","align":"start","spans":[{"text":"plain","bold":false,"italic":false}]}]',
    );
  });

  it('reads a truthy non-boolean as false rather than as itself', () => {
    // `bold: 'yes'` in a hand-edited file is not a boolean, and carrying it
    // would put a string somebody else wrote where a flag belongs.
    const doc = readNoteDoc([{ type: 'paragraph', spans: [{ text: 'x', bold: 'yes', italic: 1 }] }]);
    const span = doc[0]!.type !== 'bullets' ? doc[0]!.spans[0]! : null;
    expect(span?.bold).toBe(false);
    expect(span?.italic).toBe(false);
  });
});

describe('untrusted, therefore bounded, and bounded in the reader', () => {
  it('has four bounds, and they are numbers rather than each other', () => {
    /*
     * Every assertion below reads its expected size off the constant, which is
     * the right way round for a bound that may move - and on its own it is a
     * test that would pass against `Number.POSITIVE_INFINITY` if the assertion
     * happened to be `toBeLessThanOrEqual`. So the four values are pinned once,
     * here, as the literals they are: raising one is then a deliberate edit to
     * this line rather than a number quietly going away.
     */
    expect(MAX_NOTE_CHARS).toBe(4000);
    expect(MAX_NOTE_BLOCKS).toBe(200);
    expect(MAX_NOTE_SPANS).toBe(200);
    expect(MAX_NOTE_BULLETS).toBe(100);
  });

  /*
   * Mutation, run: `MAX_NOTE_CHARS = Number.POSITIVE_INFINITY`.
   * Result: red, 5 tests - the whole million characters are stored. This one,
   * the cut-inside-a-span test below it, the on-the-way-in test that checks the
   * store rather than the reader, the pin on the four numbers above, and the
   * writer test that runs the app's own typing through the same reader.
   */
  it('cuts a note down to its character bound rather than refusing the row', () => {
    // Cut, not refuse. A note is prose somebody typed at a table, and refusing
    // the row takes the readable four thousand characters away with the rest.
    const { doc, warnings } = noteRow([{ type: 'paragraph', spans: [{ text: 'a'.repeat(1_000_000) }] }]);
    expect(noteLength(doc)).toBe(MAX_NOTE_CHARS);
    expect(warnings.join(' ')).toMatch(/longer than the 4000 characters/);
  });

  it('cuts inside a span, so no block loses its shape', () => {
    const doc = readNoteDoc([
      { type: 'heading', align: 'center', spans: [{ text: 'Head' }] },
      { type: 'paragraph', spans: [{ text: 'b'.repeat(MAX_NOTE_CHARS) }] },
    ]);
    expect(doc[0]!.type).toBe('heading');
    expect(doc[0]!.type !== 'bullets' && doc[0]!.align).toBe('center');
    expect(noteLength(doc)).toBe(MAX_NOTE_CHARS);
  });

  /*
   * Mutation, run: `MAX_NOTE_BLOCKS = Number.POSITIVE_INFINITY`.
   * Result: red, 2 tests - all 5000 blocks are kept here, and the pin on the
   * four numbers above stops being true.
   */
  it('bounds the number of blocks, and says it did', () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      type: 'paragraph',
      spans: [{ text: `line ${String(i)}` }],
    }));
    const { doc, warnings } = noteRow(many);
    expect(doc).toHaveLength(MAX_NOTE_BLOCKS);
    expect(warnings.join(' ')).toMatch(/5000 blocks/);
  });

  /*
   * Mutation, run: `MAX_NOTE_SPANS = Number.POSITIVE_INFINITY`.
   * Result: red, 2 tests - 5000 spans survive in the one block here, and the
   * pin on the four numbers above stops being true.
   *
   * The character bound does not cover this on its own: five thousand spans of
   * one character each is 5000 characters of prose and 5000 objects of shape,
   * and the shape is the part that costs.
   */
  it('bounds the number of spans in a block', () => {
    const doc = readNoteDoc([
      { type: 'paragraph', spans: Array.from({ length: 5000 }, () => ({ text: 'x' })) },
    ]);
    expect(doc[0]!.type !== 'bullets' && doc[0]!.spans).toHaveLength(MAX_NOTE_SPANS);
  });

  /*
   * Mutation, run: `MAX_NOTE_BULLETS = Number.POSITIVE_INFINITY`.
   * Result: red, 2 tests - all 900 bullets are kept here, and the pin on the
   * four numbers above stops being true.
   */
  it('bounds the number of bullets in a list', () => {
    const doc = readNoteDoc([
      { type: 'bullets', items: Array.from({ length: 900 }, () => [{ text: 'x' }]) },
    ]);
    expect(doc[0]!.type === 'bullets' && doc[0]!.items).toHaveLength(MAX_NOTE_BULLETS);
  });

  /*
   * Mutation, run: `note: r['note']` in the `note` arm of `readSessionItem`.
   * Result: red - the raw million-character array reaches the campaign object
   * that `putCampaign` writes, and the exported file with it.
   *
   * This is the same argument mitigation 2 makes about the URL: bounding at
   * render time is a check a future screen can forget, and there is only one
   * way into the store.
   */
  it('does the bounding on the way in, so the store never holds the big one', () => {
    const { doc } = noteRow([{ type: 'paragraph', spans: [{ text: 'a'.repeat(1_000_000) }] }]);
    expect(noteLength(doc)).toBe(MAX_NOTE_CHARS);
    expect(JSON.stringify(doc).length).toBeLessThan(MAX_NOTE_CHARS + 200);
  });

  /*
   * Mutation, run: replace the `FORBIDDEN` character class with one that
   * matches nothing (`/[^\s\S]/g`).
   * Result: red - the newline and U+2028 survive inside the span.
   */
  it('replaces every control character with a space, newlines included', () => {
    /*
     * A line break inside a span is a block boundary wearing a disguise, and a
     * note whose structure lives half in the array and half in the characters
     * is one that two screens will draw differently. U+2028 and U+2029 go with
     * them: they are line terminators to a JavaScript parser and invisible to a
     * reader, which is a combination with no honest use in prose.
     *
     * Replaced rather than deleted, so two words do not run together.
     */
    const payload = 'one\ntwo\u2028three\u0000four\u007ffive';
    const doc = readNoteDoc([{ type: 'paragraph', spans: [{ text: payload }] }]);
    const text = doc[0]!.type !== 'bullets' ? doc[0]!.spans[0]!.text : '';
    expect(text).toBe('one two three four five');
    // eslint-disable-next-line no-control-regex
    expect(text).not.toMatch(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/);
    // The length is unchanged, which is what "replaced rather than deleted"
    // means: two words separated by a newline stay two words, not one.
    expect(text).toHaveLength(payload.length);
  });

  it('drops an empty span rather than storing a block with nothing to draw', () => {
    const doc = readNoteDoc([
      { type: 'paragraph', spans: [{ text: '' }, { text: 'kept' }] },
      { type: 'paragraph', spans: [{ text: '' }] },
    ]);
    expect(doc).toHaveLength(1);
    expect(doc[0]!.type !== 'bullets' && doc[0]!.spans).toHaveLength(1);
  });
});

describe('a block this build cannot read', () => {
  /*
   * Mutation, run: `default: return [entry as NoteBlock];` in `readNoteDoc`.
   * Result: red - the `table` block, and the payload inside it, are stored.
   *
   * The opposite of what `readSessionItem` does one level up, and the
   * difference is deliberate. A session *row* the app cannot read is a row the
   * GM counted and would notice missing, so it is kept and named. A paragraph
   * inside a note has no identity of its own and nothing to name it with -
   * "one block of this note could not be read" helps nobody - and keeping it
   * would mean carrying an arbitrary untyped object through the store for the
   * lifetime of the format.
   */
  it('is dropped, and the rest of the note is not', () => {
    const { doc, warnings } = noteRow([
      { type: 'paragraph', spans: [{ text: 'before' }] },
      { type: 'table', rows: [['a', 'b']], onclick: 'fetch("https://evil.example/")' },
      { type: 'paragraph', spans: [{ text: 'after' }] },
    ]);
    expect(plainTextOf(doc)).toBe('before\nafter');
    expect(JSON.stringify(doc)).not.toContain('evil.example');
    expect(warnings.join(' ')).toMatch(/newer version of the app/);
  });

  it('says nothing about blocks when there were none to drop', () => {
    // The warning has to mean something. A note that read cleanly must not
    // carry a sentence about a newer version of the app.
    const { warnings } = noteRow([{ type: 'paragraph', spans: [{ text: 'fine' }] }]);
    expect(warnings).toEqual([]);
  });

  it('reads a note that is not an array at all as an empty one', () => {
    for (const junk of [null, 'a string', 42, { type: 'paragraph' }, undefined]) {
      expect(readNoteDoc(junk)).toEqual([]);
    }
    expect(noteRow('a string').doc).toEqual([]);
  });
});

describe('writing one', () => {
  it('starts empty, and knows that it is', () => {
    expect(emptyNote()).toEqual([]);
    expect(isNoteEmpty(emptyNote())).toBe(true);
    expect(noteLength(emptyNote())).toBe(0);
    expect(isNoteEmpty([para('x')])).toBe(false);
  });

  it('turns typed text into one paragraph per line, and drops the blank ones', () => {
    const doc = noteFromPlainText('  The ford  \n\n\nThe bandits\n');
    expect(doc).toHaveLength(2);
    expect(plainTextOf(doc)).toBe('The ford\nThe bandits');
    // An empty paragraph is a block with nothing to draw, and the reader drops
    // it anyway - so the writer does not make one for the reader to remove.
    for (const block of doc) expect(block.type).toBe('paragraph');
  });

  it('runs what the app types through the same reader as what somebody sends', () => {
    /*
     * One path in, not two. Text pasted into the app is bounded and cleaned by
     * exactly the code that bounds and cleans text arriving in somebody else's
     * file - which is the only way the two can be guaranteed not to drift.
     */
    const doc = noteFromPlainText('a'.repeat(1_000_000));
    expect(noteLength(doc)).toBe(MAX_NOTE_CHARS);
    // Written as an escape rather than as the character itself, because a NUL
    // byte sitting invisibly in a source file is exactly the kind of thing this
    // test is about. Typed text goes through `readNoteDoc` too, so the scrub
    // that cleans somebody else's file cleans a paste into this app as well.
    expect(plainTextOf(noteFromPlainText('one\u0000two'))).toBe('one two');
    expect(noteFromPlainText('one two')[0]!.type).toBe('paragraph');
  });
});
