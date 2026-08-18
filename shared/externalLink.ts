/**
 * The one place a string from somebody else's `.dhcampaign` becomes a URL.
 *
 * ## The threat, stated before the mitigations
 *
 * A `.dhcampaign` arrives from another person - by file, by AirDrop, by QR -
 * and every byte in it is theirs. Until now that did not matter very much:
 * every field the reader kept was a ref into the shipped dataset, a number, or
 * a name, and the worst a hostile one could do was look silly on screen. A URL
 * row is the first field this app stores whose whole purpose is to be *acted
 * on*, and the action is navigation. So the record now carries an attack
 * surface, and it carries it into IndexedDB where it stays.
 *
 * Two facts about this app decide the shape of the answer:
 *
 *  - **There is no CSP and there cannot be one.** The app ships on GitHub
 *    Pages, which serves no headers of our choosing, and a `<meta>` CSP cannot
 *    carry `frame-ancestors` or a nonce for the inline boot script. So there is
 *    no second net under any of this.
 *  - **There is not one HTML injection sink in `src/` or `shared/`.** No
 *    `innerHTML`, no `dangerouslySetInnerHTML`, no `insertAdjacentHTML`, no
 *    `document.write`. React escapes every string it renders, and that
 *    *absence* is the entire defence against a URL being rendered as markup. It
 *    is therefore a property worth a test rather than a habit worth trusting,
 *    and `tests/store/campaignUrlRow.test.ts` scans the tree for it.
 *
 * ## The six mitigations, named
 *
 * The owner approved all six. They are applied **in the reader**, not at
 * render, because a render-time check is one a future screen can forget and a
 * reader-time check is one nothing downstream can opt out of - the same
 * argument P0-6 used to put the QR checksum inside the decoder.
 *
 * 1. **A scheme allowlist, never a denylist.** `URL_SCHEMES` is `https:` and
 *    `http:` and nothing else. A denylist would have to enumerate a set that
 *    grows without us (`intent:`, `blob:`, `filesystem:`, whatever ships next)
 *    and would lose anyway to `java\tscript:`, which the URL parser folds back
 *    to `javascript:` - measured, in this Node - after the denylist has already
 *    said yes. An allowlist fails closed on every scheme nobody thought about,
 *    including the ones that do not exist yet.
 * 2. **Sanitising happens on the way in, so a hostile value never reaches
 *    storage.** What is stored is `new URL(raw).toString()` - the parser's own
 *    normalised output - and a URL that fails any check is stored as the empty
 *    string. The refused bytes are *not* kept. This is the one place this file
 *    deliberately contradicts `readSessionItem`'s house style of keeping
 *    everything: `unreadable` keeps raw bytes because they are inert, and a
 *    rejected URL is exactly the thing that is not. The sentence saying why is
 *    handed to the reader's warning list, which is where the GM sees it, and is
 *    never written onto the row - a stored `why` would be one more string
 *    somebody else's file gets to put on this screen.
 * 3. **A bound on the stored string.** `MAX_URL_LENGTH` is 2048, checked
 *    *before* parsing so a ten-megabyte href is never handed to the URL parser
 *    at all, and checked again after, because normalising can lengthen a string
 *    (percent-encoding, an IDN host becoming punycode). The record is untrusted
 *    input in a store whose whole budget is a few megabytes, and a session list
 *    has no bound of its own.
 * 4. **An anchor built from a *stored* href carries `target="_blank"` and
 *    `rel="noopener noreferrer nofollow"`, and there is one function that says
 *    so.** `externalLinkAttrs` is the only sanctioned way to build that anchor,
 *    and it re-validates the href on the way out - defence in depth for a value
 *    that reached storage before this file existed, or was hand-edited into
 *    IndexedDB afterwards. **"From a stored href" is the whole of the scope,
 *    and it is not the whole app.** `src/` builds three anchors and not one of
 *    them has a stored href. The only `<a>` written as markup is at
 *    `src/ui/settings/About.tsx`, and its href is the literal
 *    `https://daggerheart.com/buy` written into the source. It is built by hand
 *    and carries `target="_blank" rel="noreferrer noopener"`, without
 *    `nofollow` - correct for it, because `nofollow` is about content this app
 *    did not write and that address is content this app did write. The other
 *    two are `document.createElement('a')`, in `src/ui/settings/binaryFiles.ts`
 *    and in `src/transfer/fileIo.ts`, and they are the same anchor twice: a
 *    detached element appended, `click()`ed and removed to save a file. Each
 *    href is a `blob:` URL this app minted a line earlier, and neither
 *    navigates anywhere, because both carry `download`. Nothing in this file
 *    governs any of the three. In the other direction, `externalLinkAttrs` has no
 *    production caller at all yet: the URL row draws its address as text and
 *    builds no anchor, so this mitigation protects nothing shipping today and
 *    is here for the lane that builds the row. `noopener` is the load-bearing
 *    part of it: without it the opened page gets `window.opener` and can
 *    navigate this tab to a copy of itself while the GM is looking away from
 *    the phone. `noreferrer` keeps the campaign's URL out of somebody else's
 *    logs; `nofollow` is simply honest about content this app did not write.
 * 5. **Nothing navigates without a tap, and the destination is legible before
 *    it.** Three separate things, and each one is a hole on its own:
 *     - The reader hands back data and never an affordance. It rebuilds the row
 *       field by field, so a `target`, an `onclick` or an `autoOpen` smuggled
 *       into the JSON is dropped rather than carried into a spread.
 *     - `displayUrl` prints the *parsed* host, which is punycode - a homograph
 *       domain shows as `xn--pple-43d.com` rather than as something that looks
 *       like `apple.com`, because the mitigation for a homograph is to stop
 *       hiding it, not to try to detect it.
 *     - **A URL carrying credentials is refused outright.**
 *       `https://apple.com@evil.example/` is the oldest way to make a link read
 *       as one host and resolve to another, and it beats "print the host"
 *       because the part a person's eye stops at is the part before the `@`.
 *       Nothing legitimate a GM pastes at a table has userinfo in it, so this
 *       one is a refusal rather than a strip: stripping would hand back an
 *       address the sender did not write, and this app does not invent URLs.
 * 6. **It is never rendered as anything but text.** Nothing here produces
 *    markup, and `tests/store/campaignUrlRow.test.ts` asserts the absence of
 *    every HTML injection sink across `src/` and `shared/` - because with no
 *    CSP possible, that absence is not a nicety, it is the whole defence. The
 *    scanner is checked against source written to contain a sink - written in
 *    the test, because no module here has one - before the scan's "clean" is
 *    believed, for the reason `tests/harness/reachability.ts` gives about
 *    itself: an analysis that answers "clean" to everything is the same defect
 *    as the code it hunts.
 *
 * ## What this is not
 *
 * It is not a safe-browsing check. `https://evil.example/` passes every one of
 * the six, and should: this app cannot know what is at the other end of a link
 * and pretending otherwise would be worse than saying nothing. What the six
 * buy is that the *string itself* cannot execute, cannot grow without bound,
 * cannot reach across to this tab, and cannot lie about where it points.
 */

/**
 * The two schemes a stored URL may use.
 *
 * `http:` survives beside `https:` on purpose. A GM's own machine on the table
 * LAN has no certificate, and refusing it would push people to type it into a
 * browser by hand - which is the same navigation with none of these checks in
 * front of it. Everything the six mitigations actually stop is stopped for
 * `http:` too, and whether the transport is encrypted is a question the browser
 * already answers in its own address bar, out loud, where this app cannot.
 */
export const URL_SCHEMES: readonly string[] = ['https:', 'http:'];

/**
 * The longest href this app will store, in UTF-16 code units.
 *
 * 2048 is not a browser limit - modern ones go far past it - it is the length
 * past which no honest link is being pasted. It is a bound on untrusted input
 * in a store measured in single-digit megabytes, and it is checked before the
 * string is parsed so that the parser is never the thing that has to survive a
 * pathological input.
 */
export const MAX_URL_LENGTH = 2048;

/** The `target` any anchor built from a stored href must carry. */
export const EXTERNAL_LINK_TARGET = '_blank';

/** The `rel` any anchor built from a stored href must carry. See mitigation 4. */
export const EXTERNAL_LINK_REL = 'noopener noreferrer nofollow';

export interface ReadUrl {
  /** The normalised URL, or `''` when it was refused. Never the raw bytes. */
  href: string;
  /** Why it was refused, in a sentence a row can print. `''` when it was not. */
  why: string;
}

/**
 * Read one href out of a record nobody in this build wrote.
 *
 * The invariant, which `tests/store/campaignUrlRow.test.ts` pins: `href` is
 * non-empty exactly when `why` is empty. There is no third state, so a caller
 * that checks one has checked both.
 */
export function readExternalUrl(value: unknown): ReadUrl {
  if (typeof value !== 'string' || value.trim() === '') {
    return { href: '', why: 'this row has no address on it' };
  }
  // Mitigation 3, before mitigation 1: the parser never sees the long string.
  if (value.length > MAX_URL_LENGTH) {
    return {
      href: '',
      why: `that address is ${String(value.length)} characters long, and this app stores at most ${String(MAX_URL_LENGTH)}`,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { href: '', why: 'that is not an address a browser can open' };
  }

  // Mitigation 1, after parsing rather than before it: the parser is what folds
  // `java\tscript:` and `  javascript:` back to their real scheme, and checking
  // the raw string would be checking the disguise.
  if (!URL_SCHEMES.includes(parsed.protocol)) {
    return {
      href: '',
      why: `this app only opens ${URL_SCHEMES.map((s) => s.replace(':', '')).join(' and ')} addresses, and that one is "${parsed.protocol.replace(':', '')}"`,
    };
  }

  // Mitigation 5, third clause. `apple.com` in front of the `@` is userinfo,
  // not a host, and it is the part the eye stops at.
  if (parsed.username !== '' || parsed.password !== '') {
    return {
      href: '',
      why: `that address puts "${parsed.username}" in front of the site name, which is a way of making a link look like it points somewhere it does not - it really points at "${parsed.hostname}"`,
    };
  }

  // Mitigation 2: what is stored is the parser's output, not the input. The
  // length is re-checked because normalising can lengthen a string (percent
  // encoding, an IDN host becoming punycode).
  const href = parsed.toString();
  if (href.length > MAX_URL_LENGTH) {
    return {
      href: '',
      why: `that address is ${String(href.length)} characters long once written out in full, and this app stores at most ${String(MAX_URL_LENGTH)}`,
    };
  }
  return { href, why: '' };
}

export interface ExternalLinkAttrs {
  href: string;
  target: typeof EXTERNAL_LINK_TARGET;
  rel: typeof EXTERNAL_LINK_REL;
}

/**
 * The only sanctioned way to build an anchor from a stored href.
 *
 * Returns `null` rather than an anchor with no `href` when the value does not
 * pass: a dead `<a>` is a control that looks tappable and is not, and the row
 * has the reader's warning to print instead.
 *
 * It re-runs `readExternalUrl` rather than trusting its caller. That is not
 * paranoia about the reader - it is that IndexedDB is editable from the
 * browser's own devtools, and a record written before this file existed is
 * still on somebody's phone.
 */
export function externalLinkAttrs(value: unknown): ExternalLinkAttrs | null {
  const { href } = readExternalUrl(value);
  if (href === '') return null;
  return { href, target: EXTERNAL_LINK_TARGET, rel: EXTERNAL_LINK_REL };
}

/**
 * The destination, in the form a GM should read before tapping.
 *
 * Host first and host always, because the host is the only part of a URL that
 * says who is on the other end. The path follows when there is one and is cut
 * at `max` with an ellipsis, so a long link cannot push the host off a 393px
 * phone - the one part that must never be the part that is truncated.
 *
 * Deliberately *not* decoded: `parsed.hostname` is punycode, and a domain that
 * would render as `аpple.com` prints as `xn--pple-43d.com`. That is mitigation
 * 5, and it reads as ugly on purpose.
 */
export function displayUrl(href: string, max = 48): string {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return '';
  }
  const rest = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`;
  const whole = `${parsed.hostname}${rest}`;
  if (whole.length <= max) return whole;
  const room = Math.max(0, max - parsed.hostname.length - 1);
  return room === 0 ? parsed.hostname : `${parsed.hostname}${rest.slice(0, room)}…`;
}
