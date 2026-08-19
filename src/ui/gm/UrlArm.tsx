/**
 * What is inside a web link row when the GM opens it: an address, as text.
 *
 * `displayUrl` and not `item.href`: the host comes first, and it is punycode,
 * so a homograph domain reads as `xn--pple-43d.com` here exactly as it does on
 * the shut row. See the six mitigations in `shared/externalLink.ts`.
 *
 * There is no anchor, and that is the current state rather than a design: the
 * lane that builds this row builds it out of `externalLinkAttrs`, which is the
 * only sanctioned way to make one and carries `target` and `rel` with it.
 *
 * ## Why this arm has a file and the scene, encounter, link and countdown arms
 * ## do not
 *
 * Nothing about it is more complicated than theirs - it is the shortest arm in
 * the set. It is here because it and `NoteArm` are the two arms two *separate*
 * lanes are about to replace wholesale, and in `SessionBody.tsx` they sat in
 * one region with one section rule between them. Two lanes rewriting one region
 * of one file is a conflict in work that has nothing else in common; two lanes
 * rewriting a file each is not. The other four arms are not being replaced by
 * anybody, so moving them would have been churn dressed up as symmetry, and
 * `SessionBody.tsx`'s header keeps the argument they are the subject of.
 */
import type { SessionItem } from '../../../shared/campaigns.ts';
import { displayUrl } from '../../../shared/externalLink.ts';
import { Fact } from './Fact.tsx';

export function UrlArm({ item }: { item: Extract<SessionItem, { kind: 'url' }> }): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {item.href === '' ? (
        <Fact>
          This row has no web address on it. If it arrived in a campaign somebody sent you, the
          address it carried was not one this app will store — the reason was named when the
          campaign was opened.
        </Fact>
      ) : (
        <>
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            WHERE IT POINTS
          </span>
          <p
            className="t-dense"
            style={{ margin: 0, color: 'var(--text)', overflowWrap: 'anywhere' }}
          >
            {displayUrl(item.href, 2048)}
          </p>
          <Fact>
            This version of the app stores this address, exports it and reads it back, and has no
            button that opens it. Nothing here ever opens on its own.
          </Fact>
        </>
      )}
    </div>
  );
}
