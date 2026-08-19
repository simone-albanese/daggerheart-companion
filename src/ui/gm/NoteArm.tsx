/**
 * What is inside a note row when the GM opens it: the note, drawn.
 *
 * The format stores emphasis as a run of spans rather than `**bold**` inside a
 * string, so drawing it is a walk over data and not a parse. Nothing here
 * builds markup from text, which is the property the format was chosen for:
 * there is no string in this file that a later reader could be tempted to run
 * through a parser, and no `dangerouslySetInnerHTML` anywhere near it.
 *
 * `plainTextOf` is still the row's *collapsed* summary - that is in
 * `session.ts` and unchanged. It stays plain text there on purpose: a summary
 * line that rendered a heading would be a second, smaller drawing of the same
 * note, and the two would drift.
 *
 * Bullets carry no `align`, which is the format's decision and not an omission
 * here: a centred bullet list is not a thing the wireframe draws.
 *
 * It has a file of its own for the same reason `UrlArm` does, which is stated
 * there: these two arms were the only pair in `SessionBody.tsx` sharing one
 * region, and a lane each replaced them. The other five arms stayed where they
 * are.
 */
import type { NoteBlock, NoteSpan } from '../../../shared/richText.ts';
import type { SessionItem } from '../../../shared/campaigns.ts';
import { isNoteEmpty } from '../../../shared/richText.ts';
import { Fact } from './Fact.tsx';

/** One run of text with its emphasis. `<strong>`/`<em>`, so it reads as emphasis to a screen reader too. */
function Spans({ spans }: { spans: readonly NoteSpan[] }): React.JSX.Element {
  return (
    <>
      {spans.map((span, i) => {
        const key = `${String(i)}-${span.text.slice(0, 12)}`;
        if (span.bold && span.italic)
          return (
            <strong key={key}>
              <em>{span.text}</em>
            </strong>
          );
        if (span.bold) return <strong key={key}>{span.text}</strong>;
        if (span.italic) return <em key={key}>{span.text}</em>;
        return <span key={key}>{span.text}</span>;
      })}
    </>
  );
}

const BODY = {
  margin: 0,
  color: 'var(--text)',
  maxWidth: '62ch',
  overflowWrap: 'anywhere',
} as const;

function Block({ block }: { block: NoteBlock }): React.JSX.Element {
  if (block.type === 'bullets') {
    return (
      <ul className="t-dense" style={{ ...BODY, paddingLeft: 20 }}>
        {block.items.map((item, i) => (
          <li key={`${String(i)}-${item[0]?.text.slice(0, 12) ?? ''}`}>
            <Spans spans={item} />
          </li>
        ))}
      </ul>
    );
  }
  const align = block.align === 'center' ? ('center' as const) : ('start' as const);
  if (block.type === 'heading') {
    // `t-label` rather than an `<h_>` level: this sits inside an opened session
    // row, and the row's own name is already the heading of this region.
    return (
      <p className="t-label" style={{ ...BODY, textAlign: align, letterSpacing: '0.06em' }}>
        <Spans spans={block.spans} />
      </p>
    );
  }
  return (
    <p className="t-dense" style={{ ...BODY, textAlign: align, whiteSpace: 'pre-wrap' }}>
      <Spans spans={block.spans} />
    </p>
  );
}

export function NoteArm({ item }: { item: Extract<SessionItem, { kind: 'note' }> }): React.JSX.Element {
  if (isNoteEmpty(item.note)) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <Fact>This note is empty.</Fact>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      {item.note.map((block, i) => (
        <Block key={`${String(i)}-${block.type}`} block={block} />
      ))}
    </div>
  );
}
