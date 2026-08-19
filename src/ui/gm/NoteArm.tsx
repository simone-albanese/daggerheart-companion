/**
 * What is inside a note row when the GM opens it: the note, as plain text.
 *
 * `plainTextOf` is the format's own summary function, and it is text by
 * construction - no markup is built anywhere in this app from a note. The
 * emphasis, the heading and the centring are stored and exported; drawing them
 * is the lane that builds the editor.
 *
 * It has a file of its own for the same reason `UrlArm` does, which is stated
 * there: these two arms are the two a separate lane each replaces wholesale,
 * and they were the only pair in `SessionBody.tsx` sharing one region. The
 * other four arms stayed where they are.
 */
import type { SessionItem } from '../../../shared/campaigns.ts';
import { plainTextOf } from '../../../shared/richText.ts';
import { Fact } from './Fact.tsx';

export function NoteArm({ item }: { item: Extract<SessionItem, { kind: 'note' }> }): React.JSX.Element {
  const text = plainTextOf(item.note);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {text === '' ? (
        <Fact>This note is empty.</Fact>
      ) : (
        <>
          <p
            className="t-dense"
            style={{
              margin: 0,
              color: 'var(--text)',
              maxWidth: '62ch',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {text}
          </p>
          <Fact>
            Bold, italics, bullets and a centred heading are stored in this note and travel with it
            when the campaign is exported. This version of the app shows it as plain text.
          </Fact>
        </>
      )}
    </div>
  );
}
