/**
 * What is inside a web link row when the GM opens it: an address, as text.
 *
 * `displayUrl` and not `item.href`: the host comes first, and it is punycode,
 * so a homograph domain reads as `xn--pple-43d.com` here exactly as it does on
 * the shut row. See the six mitigations in `shared/externalLink.ts`.
 *
 * The anchor is built out of `externalLinkAttrs`, which is the only sanctioned
 * way to make one: it re-reads the stored value rather than trusting it - a
 * record written before that reader existed is still on somebody's phone - and
 * it carries `target` and `rel` with it. It returns `null` rather than an
 * anchor with no `href`, and this arm prints the reader's warning in that case,
 * because a dead `<a>` is a control that looks tappable and is not.
 *
 * ## Why this arm has a file and the scene, encounter, link, countdown and
 * ## unreadable arms do not
 *
 * Nothing about it is more complicated than theirs - it is the shortest arm in
 * the set. It is here because it and `NoteArm` are the two arms two *separate*
 * lanes are about to replace wholesale, and in `SessionBody.tsx` they sat in
 * one region with no section rule between them. Two lanes rewriting one region
 * of one file is a conflict in work that has nothing else in common; two lanes
 * rewriting a file each is not. The other five arms are not being replaced by
 * anybody, so moving them would have been churn dressed up as symmetry, and
 * `SessionBody.tsx`'s header keeps the argument they are the subject of.
 */
import type { SessionItem } from '../../../shared/campaigns.ts';
import { displayUrl, externalLinkAttrs } from '../../../shared/externalLink.ts';
import { Fact } from './Fact.tsx';

export function UrlArm({ item }: { item: Extract<SessionItem, { kind: 'url' }> }): React.JSX.Element {
  const attrs = externalLinkAttrs(item.href);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {attrs === null ? (
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
            className="t-hint"
            style={{ margin: 0, color: 'var(--text)', overflowWrap: 'anywhere' }}
          >
            {displayUrl(item.href, 2048)}
          </p>
          <a {...attrs} className="btn" style={{ alignSelf: 'flex-start', minHeight: 44 }}>
            OPEN IN A NEW TAB
          </a>
          <Fact>
            Nothing here opens on its own: this is the only control that leaves the app, it needs a
            tap, and it opens in a new tab so tonight&rsquo;s list is still behind it.
          </Fact>
        </>
      )}
    </div>
  );
}
