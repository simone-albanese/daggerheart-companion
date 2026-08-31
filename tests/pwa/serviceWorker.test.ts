/**
 * The service worker against a real build.
 *
 * `public/sw.js` is plain JavaScript that no other check ever looks at: tsc
 * ignores `public/`, and the browser only disagrees with it in production, on a
 * phone, in flight mode. Worse, what it precaches is *inferred* from whatever
 * Vite emitted - so the day someone puts a screen behind a lazy `import()`, a
 * worker that only reads the document quietly stops covering the app and
 * nothing anywhere says so. That has already happened once.
 *
 * So: build the app for real, boot the real worker against a fake Cache API and
 * a disk-backed fetch, and pull the plug.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const ORIGIN = 'https://example.test';
// A project page, because that is the deploy that has a base path to get wrong.
const BASE = '/daggerheart-companion/';

interface FetchEvent {
  request: { url: string; method: string; mode?: string };
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (response: Promise<Response>) => void;
}

interface Dispatch {
  rejected: unknown[];
  response: Response | null;
  responded: boolean;
}

class FakeCache {
  readonly entries = new Map<string, Response>();

  private key(request: Request | string): string {
    return typeof request === 'string' ? new URL(request, ORIGIN).href : request.url;
  }

  async match(request: Request | string): Promise<Response | undefined> {
    return this.entries.get(this.key(request))?.clone();
  }

  async put(request: Request | string, response: Response): Promise<void> {
    const body = await response.arrayBuffer();
    this.entries.set(this.key(request), new Response(body, { headers: response.headers }));
  }

  async keys(): Promise<Array<{ url: string }>> {
    return [...this.entries.keys()].map((url) => ({ url }));
  }

  async delete(request: Request | string): Promise<boolean> {
    return this.entries.delete(this.key(request));
  }
}

function world(dist: string, base: string = BASE) {
  const files = new Map<string, Buffer>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.set(base + relative(dist, path).split(sep).join('/'), readFileSync(path));
    }
  };
  walk(dist);

  const net = {
    online: true,
    requests: [] as string[],
    /** Answers "no such file". */
    refuse: (_path: string) => false,
    /** Says nothing at all, the way a dead connection does. */
    drop: (_path: string) => false,
  };
  const caches = new Map<string, FakeCache>();
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const warnings: string[] = [];
  const errors: string[] = [];

  const fetch = async (input: Request | string): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input.url, ORIGIN + base);
    net.requests.push(url.pathname);
    if (!net.online || net.drop(url.pathname)) throw new TypeError('Failed to fetch');
    if (url.origin !== ORIGIN) return new Response('offsite', { status: 200 });
    if (net.refuse(url.pathname)) return new Response('gone', { status: 503 });
    const body = files.get(url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname);
    return body
      ? // Node's Buffer is a Uint8Array, but its type carries an ArrayBufferLike
        // that BodyInit will not accept; the bytes are what Response wants.
        new Response(new Uint8Array(body), { status: 200 })
      : new Response('not found', { status: 404 });
  };

  const cacheStorage = {
    open: async (name: string): Promise<FakeCache> => {
      const existing = caches.get(name) ?? new FakeCache();
      caches.set(name, existing);
      return existing;
    },
    keys: async (): Promise<string[]> => [...caches.keys()],
    delete: async (name: string): Promise<boolean> => caches.delete(name),
  };

  const sandbox: Record<string, unknown> = {
    caches: cacheStorage,
    fetch,
    Request,
    Response,
    URL,
    console: {
      ...console,
      warn: (...a: unknown[]) => warnings.push(a.map(String).join(' ')),
      error: (...a: unknown[]) => errors.push(a.map(String).join(' ')),
      info: () => {},
    },
    self: {
      location: new URL(`${base}sw.js`, ORIGIN),
      caches: cacheStorage,
      clients: { claim: async () => {} },
      skipWaiting: () => {},
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), fn]);
      },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(REPO, 'public', 'sw.js'), 'utf8'), sandbox, { filename: 'sw.js' });

  const dispatch = async (
    type: string,
    request?: FetchEvent['request'],
    extra: Record<string, unknown> = {},
  ): Promise<Dispatch> => {
    const waits: Array<Promise<unknown>> = [];
    const responses: Array<Promise<Response>> = [];
    const event = {
      request,
      ...extra,
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
      respondWith: (response: Promise<Response>) => responses.push(response),
    };
    for (const fn of listeners.get(type) ?? []) fn(event);
    const answered = await Promise.allSettled(responses);
    // Only now. A fetch handler calls `waitUntil` from inside itself, several
    // awaits in, so the list of background work is not complete until the
    // response is - and collecting it any earlier silently awaits nothing,
    // which makes every assertion about a revalidate a coin toss.
    const background = await Promise.allSettled(waits);
    const settled = [...answered, ...background];
    return {
      rejected: settled.filter((s) => s.status === 'rejected').map((s) => s.reason),
      response: answered[0]?.status === 'fulfilled' ? answered[0].value : null,
      responded: responses.length > 0,
    };
  };

  return {
    files,
    net,
    warnings,
    errors,
    dispatch,
    cached: (name: string): string[] => [...(caches.get(name)?.entries.keys() ?? [])].sort(),
    caches,
    /** What a browser does to a site it has not seen for a while, and what
     *  clearing site data does: the caches go, the registration stays. */
    reclaimStorage: (): void => caches.clear(),
    get: (path: string): Promise<Dispatch> => dispatch('fetch', { url: ORIGIN + path, method: 'GET' }),
    /** A client posting to the worker: the payload rides on `data`, not `request`. */
    post: (data: unknown): Promise<Dispatch> => dispatch('message', undefined, { data }),
    navigate: (path: string): Promise<Dispatch> =>
      dispatch('fetch', { url: ORIGIN + path, method: 'GET', mode: 'navigate' }),
    emitted: (pattern: RegExp): string[] =>
      [...files.keys()].filter((path) => pattern.test(path)).map((path) => ORIGIN + path).sort(),
  };
}

/**
 * A new deploy, on the server this world serves from: every hash moves, because
 * every chunk names the ones it imports and the names are what changed.
 *
 * A distinct suffix per file: two chunks can share a stem (there is more than
 * one `index-*.js`), and collapsing them onto one new name would make the
 * fixture lose a chunk and look like a pruning bug.
 */
function redeploy(app: ReturnType<typeof world>): void {
  const renamed = new Map(
    [...app.files.keys()]
      .filter((path) => /\/assets\/.+\.(js|css)$/.test(path))
      .map((path, i) => {
        // Only the hash moves, and the boundary is the last hyphen before the
        // extension rather than the first: a Vite hash can itself contain a
        // hyphen, and cutting at the first would rename `import-worker-<hash>.js`
        // to `import-<n>.js`. That chunk went with the Core Rulebook importer,
        // but the rule it forced is about hashes, not about that file.
        const name = path.split('/').pop()!;
        const dot = name.indexOf('.');
        const stem = name.slice(0, dot);
        return [name, `${stem.slice(0, stem.lastIndexOf('-'))}-next${i}${name.slice(dot)}`];
      }),
  );
  const rewrite = (text: string): string =>
    [...renamed].reduce((out, [was, now]) => out.split(was).join(now), text);
  for (const [path, body] of [...app.files]) {
    if (!/\.(html|js|css)$/.test(path)) continue;
    app.files.delete(path);
    app.files.set(rewrite(path), Buffer.from(rewrite(body.toString())));
  }
}

const SHELL = 'dhc-shell-v1';
const ASSETS = 'dhc-assets-v1';

let dist: string;
let rootDist: string;

const buildInto = async (base: string): Promise<string> => {
  const out = mkdtempSync(join(tmpdir(), 'dhc-sw-'));
  await build({
    configFile: join(REPO, 'vite.config.ts'),
    base,
    logLevel: 'silent',
    build: { outDir: out, emptyOutDir: true },
  });
  return out;
};

beforeAll(async () => {
  dist = await buildInto(BASE);
  rootDist = await buildInto('/');
}, 120_000);

afterAll(() => {
  for (const dir of [dist, rootDist]) rmSync(dir, { recursive: true, force: true });
});

describe('service worker, against what the build actually emitted', () => {
  it('precaches every chunk the build produced, however the app reaches it', async () => {
    const app = world(dist);
    const install = await app.dispatch('install');

    expect(install.rejected).toEqual([]);
    // Not "the chunks index.html names" - all of them. A screen behind a lazy
    // import is named nowhere in the document and is still part of the app.
    //
    // Every one, with no exception. There used to be one: the Core Rulebook
    // importer's worker was pdf.js, more than half of everything shipped, and
    // it was held back until a client that could actually run the importer
    // asked for it. The importer, the chunk and the dependency are gone, so the
    // precache and the build agree exactly, and this asserts that rather than
    // an emptied-out exception nobody would notice going stale.
    const emitted = app.emitted(/\/assets\/.+\.(js|css)$/);
    expect(emitted.length, 'this build emitted no assets; the assertion below is empty').toBeGreaterThan(0);
    expect(app.cached(ASSETS)).toEqual(emitted);
    expect(app.cached(ASSETS).filter((url) => /\/srd-/.test(url)), 'the SRD chunk is the whole point').toHaveLength(1);
    expect(
      emitted.filter((url) => /\/import-worker-/.test(url)),
      'the importer worker is still being emitted; the removal is incomplete',
    ).toHaveLength(0);
    // pdf.js was the one dependency that named a file this app does not ship
    // ("./qcms_bg.js"), and the name scanner asked the server about it once it
    // was cached. Nothing emits that string now, so no navigation can produce
    // the request - which is the deferral's second job outliving the deferral.
    await app.dispatch('activate');
    await app.navigate(BASE);
    await app.navigate(BASE);
    expect(app.net.requests.filter((path) => path.includes('qcms'))).toHaveLength(0);
  });

  /**
   * The same build, at the one moment this worker deletes.
   *
   * The assertion above is about install, which only fills. Activation prunes,
   * and it prunes by walking the cached document with no network at all: what
   * the walk cannot name from what is already cached is superseded, and goes. A
   * lazy screen is named nowhere in the document - only inside another chunk,
   * as the literal specifier of an `import()` - so it is precisely the file a
   * prune that read only the document would take, and the file with the least
   * to fall back on once it is taken, because offline there is nothing left to
   * fetch it from.
   *
   * The set is derived from `dist/index.html` rather than from a name pattern
   * on purpose. A pattern is a second guess about what the build emitted, and
   * the property under test is about what the document does and does not say.
   */
  it('keeps the chunks the document never names, through the activation that deletes', async () => {
    const app = world(dist);
    const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');
    const unnamed = app
      .emitted(/\/assets\/.+\.js$/)
      .filter((url) => !indexHtml.includes(url.split('/').pop()!));
    expect(
      unnamed.length,
      'this build names every chunk in its document; there is nothing here for a prune to lose',
    ).toBeGreaterThan(0);

    await app.dispatch('install');
    const filled = app.cached(ASSETS);
    await app.dispatch('activate');

    expect(app.cached(ASSETS), 'the prune took nothing this build still uses').toEqual(filled);
    expect(app.cached(ASSETS), 'the lazy screens above all').toEqual(expect.arrayContaining(unnamed));
  });

  /**
   * Every expectation here is derived from what Vite actually emitted, because
   * a hand-written list of filenames is a test that passes while the app is
   * broken - the worker infers its precache from the build, so the test has to
   * infer its expectations from the same place or it is only checking that two
   * copies of one guess agree.
   *
   * That was already true of the fonts and the icons. It was not true of
   * anything else, and there was no anything else: `public/brand/` shipped
   * uncovered because no clause here mentioned it, which is a shape of hole
   * that repeats the day someone adds `public/sounds/`. So the last assertion
   * is not a fourth directory - it is the whole of `public/` at once, with the
   * two exemptions named out loud. Add a directory and it is covered before it
   * exists; decide something must not be precached and you say so here, with a
   * reason, where the next reader can disagree with you.
   */
  it('precaches everything the build copied out of public/, and says why for what it skips', async () => {
    const app = world(dist);
    await app.dispatch('install');
    const shell = app.cached(SHELL);

    expect(shell.filter((url) => url.endsWith('.woff2'))).toEqual(app.emitted(/\/fonts\/.+\.woff2$/));
    // Every icon the install prompt may ask for - the 512s and the maskable,
    // which the document never names - and not merely the one it does.
    expect(shell.filter((url) => url.includes('/icons/'))).toEqual(app.emitted(/\/icons\//));
    // Both cuts of the licensed mark, named nowhere but an `<img src>` inside a
    // chunk. Offline this is the difference between the mark and its alt text.
    expect(shell.filter((url) => url.includes('/brand/'))).toEqual(app.emitted(/\/brand\//));

    const exempt = (url: string): boolean =>
      // The worker itself. The browser owns that copy and updates it out of
      // band; a worker that cached its own bytes could pin its own successor.
      url.endsWith('/sw.js') ||
      // The font licences, which sit in the same directory as the fonts and are
      // nobody's business offline. The licence the app must show is in the DOM.
      url.endsWith('.txt');
    expect(shell).toEqual(
      app.emitted(/^(?!.*\/assets\/).*$/).filter((url) => !exempt(url)),
    );
  });

  /**
   * The licensed mark is the one asset whose absence the app papers over.
   *
   * A broken `<img>` paints its alt text, so offline the header kept saying
   * "Daggerheart Compatible" in words while the mark Darrington Press licensed
   * for that sentence was a 404 - the statement surviving without the thing it
   * is a statement about, which is the worse half to lose. And it is on every
   * screen at every width: `Header.tsx` renders `<CompatibleIcon />` outside
   * both of its `{!phone && ...}` guards.
   */
  it('keeps the licensed compatibility mark offline, not just the words beside it', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');

    // Every file, not one: the mark comes in a light and a dark cut, and the
    // theme is a switch the user can throw in flight mode.
    const marks = app.emitted(/\/brand\//);
    expect(marks.length, 'this build ships no compatibility mark; the loop below is empty').toBeGreaterThan(0);

    app.net.online = false;
    for (const url of marks) {
      const hit = await app.get(new URL(url).pathname);
      expect(hit.response?.status, url).toBe(200);
    }
  });

  it('serves the app offline: cold start, deep link, and a screen never opened before', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');
    app.net.online = false;

    expect((await app.navigate(BASE)).response?.status).toBe(200);
    expect((await app.navigate(`${BASE}play/some-character`)).response?.status).toBe(200);

    const lazy = app
      .emitted(/\/assets\/(?!index-|srd-)[A-Za-z]+-.+\.js$/);
    expect(lazy.length, 'this build has no lazy chunks; the assertion below is empty').toBeGreaterThan(0);
    for (const url of lazy) {
      const hit = await app.get(new URL(url).pathname);
      expect(hit.response?.status, url).toBe(200);
    }
  });

  /**
   * The caches are not as durable as the worker that fills them.
   *
   * A browser reclaims Cache Storage under pressure and clears it for sites it
   * has not seen in a while; clearing site data by hand takes the caches and
   * leaves the registration. What is left over is an activated worker sitting
   * on nothing - and install, which is the only thing here that fills a cache,
   * is never coming back, because a browser installs a replacement worker only
   * when the bytes of sw.js change and a deploy is what changes them.
   *
   * This is what was happening in production: one registration, activated, one
   * cache named `dhc-shell-v1` with nothing in it, and no `dhc-assets-v1` at
   * all. Which reads like a precache that ran and wrote nothing, and was not:
   * nothing had precached in that profile for days. The empty cache was opened
   * by `warmImporter` - a *read* - and the app was one flight away from being
   * a white screen.
   *
   * The client event that carried the fix was `warm-importer`, posted by a
   * desktop that had just decided it could run the Core Rulebook importer. The
   * importer has been removed; this had nothing to do with it beyond sharing
   * its message, so the message is now `hello` and every page posts it. The
   * property is unchanged and so is the reason it cannot be tested through a
   * navigation: the page that has just loaded is not controlled by this worker
   * yet, so its navigation never reached it.
   */
  it('rebuilds a precache the browser reclaimed, rather than sit on an empty cache', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');
    expect(app.cached(SHELL)).toContain(`${ORIGIN}${BASE}index.html`);

    app.reclaimStorage();
    // A client saying hello, which is every event this worker gets while it is
    // activated but not yet controlling the page that just loaded.
    await app.post({ type: 'hello' });

    expect(app.cached(SHELL), 'the document is back').toContain(`${ORIGIN}${BASE}index.html`);
    expect(app.cached(ASSETS).some((url) => /\/srd-/.test(url)), 'and the dataset with it').toBe(true);

    app.net.online = false;
    expect((await app.navigate(BASE)).response?.status, 'so the app still opens in flight mode').toBe(200);
  });

  it('rebuilds a reclaimed precache as it activates, so an update never lands on an empty cache', async () => {
    const app = world(dist);
    await app.dispatch('install');
    app.reclaimStorage();
    await app.dispatch('activate');

    expect(app.cached(SHELL)).toContain(`${ORIGIN}${BASE}index.html`);
    app.net.online = false;
    expect((await app.navigate(BASE)).response?.status).toBe(200);
  });

  it('says so when it cannot rebuild one, rather than leave an empty cache and no explanation', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');
    app.reclaimStorage();
    app.net.online = false;

    await app.post({ type: 'hello' });

    expect(app.warnings.join(' ')).toContain('precache');
  });

  it('leaves alone everything that is not the app', async () => {
    const app = world(dist);
    await app.dispatch('install');

    const post = await app.dispatch('fetch', { url: `${ORIGIN}${BASE}index.html`, method: 'POST' });
    const offsite = await app.dispatch('fetch', { url: 'https://cdn.example.com/x.js', method: 'GET' });
    const sibling = await app.get('/another-app/index.html');
    const unknown = await app.get(`${BASE}not-a-file`);

    expect([post.responded, offsite.responded, sibling.responded, unknown.responded]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('sweeps its own old caches on activation and no one else\'s', async () => {
    const app = world(dist);
    app.caches.set('dhc-shell-v0', new FakeCache());
    app.caches.set('some-other-app', new FakeCache());
    await app.dispatch('install');
    await app.dispatch('activate');

    expect([...app.caches.keys()].sort()).toEqual([ASSETS, SHELL, 'some-other-app']);
  });

  it('drops superseded chunks once an update is taken, and keeps the live bundle', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');
    const first = app.cached(ASSETS);

    redeploy(app);

    await app.dispatch('install');
    expect(app.cached(ASSETS), 'the running page keeps its bundle until it reloads').toEqual(
      expect.arrayContaining(first),
    );

    await app.dispatch('activate');
    const after = app.cached(ASSETS);
    expect(after).toHaveLength(first.length);
    expect(after.every((url) => /-next\d+\./.test(url))).toBe(true);
    expect(after.some((url) => /\/srd-/.test(url)), 'the dataset is not collateral').toBe(true);
  });

  /**
   * Removing a feature is not the same as removing it from the device.
   *
   * This test used to be the opposite of itself. It asserted that the Core
   * Rulebook importer's pdf.js chunk *survived* an update accepted offline:
   * the chunk was deliberately held out of the precache, so it was the one
   * file activation could prune with nothing left to refetch it, and a user who
   * took an update in a tunnel came out with an importer that had quietly
   * stopped existing.
   *
   * The importer has now been removed on purpose, which turns that hazard into
   * the mechanism. 1.6 MB of pdf.js is sitting in the asset cache of every
   * device that ever asked for it, and no source change can reach into it. What
   * takes it off is the ordinary prune: `pruneAssets` keeps only what the new
   * document names, the new document names no importer, and the first
   * activation after the update sweeps it out with the rest of the superseded.
   *
   * So this asserts on a cache seeded the way such a device's actually is,
   * rather than on a build artefact - there is no longer a build that emits
   * one. Offline, because that is the update this app has already been bitten
   * by once, and because a sweep that needs the network is a sweep that does
   * not happen on the device that most needs it.
   */
  it('sweeps the removed importer off a device that had cached it, offline', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');

    // The device as it was left by the last build that had an importer.
    const stranded = `${ORIGIN}${BASE}assets/import-worker-B1oldHash.js`;
    await app.caches.get(ASSETS)!.put(stranded, new Response('/* pdf.js */'));
    expect(app.cached(ASSETS), 'the fixture did not seed').toContain(stranded);

    redeploy(app);
    await app.dispatch('install'); // Downloaded on the platform,
    app.net.online = false;
    await app.dispatch('activate'); // and accepted in the tunnel.

    expect(app.cached(ASSETS), 'the bytes are still on the device').not.toContain(stranded);
    expect(
      app.cached(ASSETS).filter((url) => /\/import-worker-/.test(url)),
      'nor under any other hash',
    ).toHaveLength(0);
    expect(
      (await app.navigate(BASE)).response?.status,
      'and the app itself came through the same activation',
    ).toBe(200);
  });

  it('never stores a document whose bundle it could not fetch', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');

    // A deploy caught half-published: the new document is up, its chunk is not.
    const document = app.files.get(`${BASE}index.html`)!.toString();
    const entry = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(document)![0];
    app.files.set(`${BASE}index.html`, Buffer.from(document.replace(entry, 'assets/index-missing.js')));
    app.net.refuse = (path) => path.includes('index-missing');

    await app.navigate(BASE);
    app.net.online = false;

    const served = await (await app.navigate(BASE)).response!.text();
    expect(served, 'an old shell with its own assets boots; a new one without them does not').toContain(
      entry,
    );
    expect(app.errors.join(' '), 'and it says so, rather than failing later and elsewhere').toContain(
      'not adopted',
    );
  });

  it('leaves the running worker a bootable cache when its own install fails', async () => {
    // The worker being replaced serves out of these same two caches, so an
    // install that gets halfway is not a private failure: it can take the app
    // that is already working offline down with it.
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');

    const document = app.files.get(`${BASE}index.html`)!.toString();
    const entry = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(document)![0];
    app.files.set(`${BASE}index.html`, Buffer.from(document.replace(entry, 'assets/index-missing.js')));
    app.net.refuse = (path) => path.includes('index-missing');

    expect((await app.dispatch('install')).rejected).not.toEqual([]);

    app.net.online = false;
    const served = await (await app.navigate(BASE)).response!.text();
    expect(served, 'the old document is still the one on disk, and it still boots').toContain(entry);
  });

  it('retries a chunk the network dropped, and stops asking only for one that is gone', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');

    // A deploy that adds a screen, over a connection that dies fetching it.
    const document = app.files.get(`${BASE}index.html`)!.toString();
    const entry = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(document)![0];
    const next = 'assets/index-nextbuild.js';
    app.files.set(`${BASE}assets/Extra-A1b2C3d4.js`, Buffer.from('export const extra = 1;\n'));
    app.files.set(
      `${BASE}${next}`,
      Buffer.concat([app.files.get(`${BASE}${entry}`)!, Buffer.from('\nimport("./Extra-A1b2C3d4.js");\n')]),
    );
    app.files.set(`${BASE}index.html`, Buffer.from(document.replace(entry, next)));
    app.net.drop = (path) => path.includes('Extra-');

    await app.navigate(BASE);
    expect(app.cached(ASSETS).some((url) => url.includes('Extra-'))).toBe(false);

    // Back on a train with signal. Nothing said the file does not exist.
    app.net.drop = () => false;
    await app.navigate(BASE);
    expect(app.cached(ASSETS).some((url) => url.includes('Extra-'))).toBe(true);
  });

  it('does all of that at a root base too, where every path lines up differently', async () => {
    // A user or org page is served from `/`, a project page from `/<repo>/`.
    // Every path in the worker is derived from where sw.js itself was served,
    // and getting that wrong is a blank screen with 404s behind it.
    const app = world(rootDist, '/');
    await app.dispatch('install');
    await app.dispatch('activate');

    const emitted = app.emitted(/\/assets\/.+\.(js|css)$/);
    expect(app.cached(ASSETS)).toEqual(emitted);
    expect(app.cached(SHELL).filter((url) => url.endsWith('.woff2')).length).toBeGreaterThan(0);

    app.net.online = false;
    expect((await app.navigate('/')).response?.status).toBe(200);
    expect((await app.navigate('/play/some-character')).response?.status).toBe(200);
  });

  it('fails the install for a missing chunk, but not for a missing lazy screen', async () => {
    const strict = world(dist);
    strict.net.refuse = (path) => /\/assets\/srd-/.test(path);
    expect((await strict.dispatch('install')).rejected).not.toEqual([]);

    const lenient = world(dist);
    const lazy = lenient.emitted(/\/assets\/(?!index-|srd-)[A-Za-z]+-.+\.js$/)[0]!;
    const name = new URL(lazy).pathname.split('/').pop()!;
    lenient.net.refuse = (path) => path.endsWith(name);

    expect((await lenient.dispatch('install')).rejected).toEqual([]);
    expect(lenient.warnings.join(' ')).toContain(name);
    expect(lenient.cached(SHELL).some((url) => url.endsWith('index.html'))).toBe(true);
  });

  /**
   * The two licence texts the build emits.
   *
   * `dist/` was 28 files and neither `LICENSE` nor any copy of the DPCGL was
   * among them, while `LICENSE` requires its own notice in all copies and a
   * deployed bundle is a copy. They are emitted from the canonical files now,
   * which puts them somewhere this worker has an opinion about - and its
   * default opinion was the wrong one, because every in-scope *navigation*
   * resolves to the app document. Under that rule a browser pointed at
   * `legal/DPCGL-2025-07-30.txt` would be handed a character sheet, which is
   * the app substituting itself for a legal document at the one address that
   * promises otherwise.
   */
  describe('the licence texts in the build output', () => {
    const paths = ['LICENSE.txt', 'legal/DPCGL-2025-07-30.txt'];

    it('are in dist, byte for byte from the files they are copies of', () => {
      const app = world(dist);
      for (const path of paths) {
        const emitted = app.files.get(BASE + path);
        expect(emitted, `${path} is not in the build output`).toBeDefined();
      }
      expect(app.files.get(`${BASE}LICENSE.txt`)!.toString('utf8')).toBe(
        readFileSync(join(REPO, 'LICENSE'), 'utf8'),
      );
      expect(app.files.get(`${BASE}legal/DPCGL-2025-07-30.txt`)!.toString('utf8')).toBe(
        readFileSync(join(REPO, 'src/legal/dpcgl-2025-07-30.txt'), 'utf8'),
      );
    });

    it('are served as themselves, not as the app, when a browser navigates to one', async () => {
      const app = world(dist);
      await app.dispatch('install');
      await app.dispatch('activate');

      for (const path of paths) {
        const hit = await app.navigate(BASE + path);
        expect(
          hit.responded,
          `the worker answered a navigation to ${path} — with the shell, since that is what ` +
            'every in-scope navigation resolves to, so the licence URL serves the app instead',
        ).toBe(false);
      }

      // And the app's own deep links still do resolve to the document, which is
      // the rule this exemption has to leave standing.
      expect((await app.navigate(`${BASE}play/some-character`)).responded).toBe(true);
    });

    it('are not precached, and the app does not pretend otherwise', async () => {
      // Deliberate: nothing in the built document names these files, so the
      // precache - inferred by reading what the build emitted - cannot find
      // them, and a hand-written list of URLs to cache would be the second
      // source of truth this whole worker avoids. The offline copy of both
      // texts is compiled into the Settings chunk, which *is* precached.
      const app = world(dist);
      await app.dispatch('install');
      await app.dispatch('activate');

      const cached = [...app.cached(SHELL), ...app.cached(ASSETS)];
      expect(cached.some((url) => url.includes('/LICENSE.txt'))).toBe(false);
      expect(cached.some((url) => url.includes('/legal/'))).toBe(false);

      const settings = app
        .emitted(/\/assets\/Settings-.+\.js$/)
        .filter((url) => app.cached(ASSETS).includes(url));
      expect(
        settings.length,
        'the Settings chunk is not precached, so the in-app licence texts are not readable offline',
      ).toBe(1);
      const chunk = app.files.get(new URL(settings[0]!).pathname)!.toString('utf8');
      expect(chunk, 'the DPCGL text is not in the chunk that is precached').toContain(
        'Darrington Press Community Gaming License',
      );
      expect(chunk, 'the MIT text is not in the chunk that is precached').toContain(
        'Permission is hereby granted, free of charge',
      );
    });
  });
});
