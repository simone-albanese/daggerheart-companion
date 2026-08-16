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
    // The one exception is the importer's worker, which is pdf.js and more
    // than half of everything shipped. It is held back until a client that can
    // actually run the importer asks for it, so a phone - where the importer
    // is disabled outright - never pays for it.
    const emitted = app.emitted(/\/assets\/.+\.(js|css)$/);
    const deferred = emitted.filter((url) => /\/import-worker-/.test(url));
    expect(deferred, 'this build emits no importer worker; the split below is untested').toHaveLength(1);
    expect(app.cached(ASSETS)).toEqual(emitted.filter((url) => !deferred.includes(url)));
    expect(app.cached(ASSETS).filter((url) => /\/srd-/.test(url)), 'the SRD chunk is the whole point').toHaveLength(1);
    // pdf.js names "./qcms_bg.js", which is no file of ours - and holding the
    // worker back means its strings are never scanned, so the app never asks
    // about it at all. That is the deferral paying for itself twice.
    await app.dispatch('activate');
    await app.navigate(BASE);
    await app.navigate(BASE);
    expect(app.net.requests.filter((path) => path.includes('qcms'))).toHaveLength(0);
  });

  it('precaches the fonts and every icon the install prompt may ask for', async () => {
    const app = world(dist);
    await app.dispatch('install');
    const shell = app.cached(SHELL);

    expect(shell.filter((url) => url.endsWith('.woff2'))).toEqual(app.emitted(/\/fonts\/.+\.woff2$/));
    expect(shell.filter((url) => url.includes('/icons/'))).toEqual(app.emitted(/\/icons\//));
    // The font licences sit in the same directory and are nobody's business.
    expect(shell.some((url) => url.endsWith('.txt'))).toBe(false);
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
      .emitted(/\/assets\/(?!index-|srd-)[A-Za-z]+-.+\.js$/)
      .filter((url) => !/\/import-worker-/.test(url));
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
   */
  it('rebuilds a precache the browser reclaimed, rather than sit on an empty cache', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');
    expect(app.cached(SHELL)).toContain(`${ORIGIN}${BASE}index.html`);

    app.reclaimStorage();
    // A desktop client saying hello, which is every event this worker gets
    // while it is activated but not yet controlling the page that just loaded.
    await app.post({ type: 'warm-importer' });

    expect(app.cached(SHELL), 'the document is back').toContain(`${ORIGIN}${BASE}index.html`);
    expect(app.cached(ASSETS).some((url) => /\/srd-/.test(url)), 'and the dataset with it').toBe(true);
    expect(
      app.cached(ASSETS).some((url) => /\/import-worker-/.test(url)),
      'and the client got the importer it actually asked for',
    ).toBe(true);

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

    await app.post({ type: 'warm-importer' });

    expect(app.warnings.join(' ')).toContain('precache');
  });

  it('fetches the importer worker only when a client says it can use it', async () => {
    const app = world(dist);
    await app.dispatch('install');
    await app.dispatch('activate');

    const worker = app.emitted(/\/assets\/import-worker-.+\.js$/)[0]!;
    const path = new URL(worker).pathname;

    // Before anyone asks: not cached, and offline it is simply absent - which
    // is correct, because the device that did not ask is the device that
    // cannot run the importer anyway.
    expect(app.cached(ASSETS)).not.toContain(worker);
    app.net.online = false;
    expect((await app.get(path)).response?.status).toBeUndefined();

    // A desktop client asks. After that it is offline-complete like the rest.
    app.net.online = true;
    await app.post({ type: 'warm-importer' });
    expect(app.cached(ASSETS)).toContain(worker);

    app.net.online = false;
    expect((await app.get(path)).response?.status).toBe(200);

    // Now that pdf.js is cached, its "./qcms_bg.js" string is in reach of the
    // name scanner. Asking the server about it once is the cost; asking on
    // every navigation would not be.
    app.net.online = true;
    await app.navigate(BASE);
    await app.navigate(BASE);
    expect(app.net.requests.filter((p) => p.includes('qcms')).length).toBeLessThanOrEqual(1);
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
    // Warm the importer first, so the update path is tested with it present:
    // a device that asked for it once must not lose it to a deploy.
    await app.post({ type: 'warm-importer' });
    const first = app.cached(ASSETS);

    // A new deploy: every hash moves, because every chunk names the ones it
    // imports and the names are what changed.
    // A distinct suffix per file: two chunks can share a stem (there is more
    // than one `index-*.js`), and collapsing them onto one new name would make
    // the fixture lose a chunk and look like a pruning bug.
    const renamed = new Map(
      [...app.files.keys()]
        .filter((path) => /\/assets\/.+\.(js|css)$/.test(path))
        .map((path, i) => {
          // Only the hash moves. Cutting from the first hyphen would rename
          // `import-worker-<hash>.js` to `import-<n>.js` and the fixture would
          // stop modelling a real deploy: a Vite hash can itself contain a
          // hyphen, so the boundary is the last one before the extension.
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

    await app.dispatch('install');
    expect(app.cached(ASSETS), 'the running page keeps its bundle until it reloads').toEqual(
      expect.arrayContaining(first),
    );

    await app.dispatch('activate');
    const after = app.cached(ASSETS);
    expect(after).toHaveLength(first.length);
    expect(after.every((url) => /-next\d+\./.test(url))).toBe(true);
    expect(after.some((url) => /\/srd-/.test(url)), 'the dataset is not collateral').toBe(true);
    expect(after.some((url) => /\/import-worker-/.test(url)), 'nor is the importer').toBe(true);
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

    const emitted = app.emitted(/\/assets\/.+\.(js|css)$/).filter((url) => !/\/import-worker-/.test(url));
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
});
