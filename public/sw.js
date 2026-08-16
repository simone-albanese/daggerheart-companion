/**
 * Service worker. Hand-written, because there is almost nothing to generate:
 * the app is a static bundle that makes no network requests of its own once it
 * is running, so "cache the app, cache the dataset, cache nothing else" is the
 * whole policy and it fits on a page.
 *
 * Two caches:
 *
 *   shell   the entry document, the manifest, the icons, the fonts and the
 *           licensed Daggerheart Compatible marks - everything Vite copies out
 *           of `public/` verbatim. Their names never change, so the copy on
 *           disk can go stale: stale-while-revalidate.
 *   assets  everything Vite emits under `assets/` with a content hash in the
 *           filename, the SRD dataset chunk included. The name *is* the
 *           version, so a hit can never be wrong: cache-first, no revalidation.
 *
 * Nothing else is ever written to a cache. A request that reaches the network
 * from here is either the dev server or a bug, and quietly caching it would
 * hide both.
 *
 * A browser installs a replacement worker only when the bytes of this file
 * change, and a deploy does not touch it: without BUILD, which the Pages
 * workflow stamps with the commit, an ordinary deploy would install no worker,
 * fire no `updatefound`, and never reach `activate` - so the update prompt and
 * the cache sweep below would both be unreachable code. VERSION is the separate
 * hand bump, for when the shape of the caches changes and every client has to
 * rebuild from the network.
 */
const BUILD = '__BUILD__';
const VERSION = 'v1';
const SHELL_CACHE = `dhc-shell-${VERSION}`;
const ASSET_CACHE = `dhc-assets-${VERSION}`;
const CURRENT = new Set([SHELL_CACHE, ASSET_CACHE]);

/** The worker is served from the same directory as index.html, so this is the
 *  deployed base path: `/` locally, `/<repo>/` on GitHub Pages. */
const ROOT = new URL('./', self.location.href);
const SHELL_URL = new URL('index.html', ROOT).href;
const MANIFEST_URL = new URL('manifest.webmanifest', ROOT).href;

/** Always go to the network for a precache fill. An HTTP-cached copy of the
 *  document being installed against would defeat the entire update. */
const fromNetwork = (url) => new Request(url, { cache: 'reload' });

const isImmutable = (url) => url.pathname.startsWith(`${ROOT.pathname}assets/`);

/**
 * The Core Rulebook importer's worker chunk, which is pdf.js: 503 KB gzipped,
 * more than half of everything this app ships, and unusable on a phone - the
 * importer is desktop-only, because rasterising a 319 MB PDF is an
 * out-of-memory risk there.
 *
 * So the first copy is fetched on request rather than on install. A client that
 * can actually run the importer posts `warm-importer` once it knows, and it is
 * cached then; a phone never downloads it at all. The offline promise is kept
 * where the feature exists, and the bytes are not spent where it does not.
 *
 * Every copy after the first is fetched on install, because by then the device
 * has already answered the question: see `installUpdate`.
 */
const isDeferred = (url) => /\/import-worker-[^/]*\.js$/.test(url.pathname);

/**
 * The directories Vite copies out of `public/` untouched.
 *
 * `brand/` is the licensed Daggerheart Compatible mark, and it belongs here and
 * emphatically not in the assets cache: Vite copies these four files verbatim,
 * so their names carry no content hash, and the assets cache is cache-first on
 * the strength of the name *being* the version. A hit there could be wrong
 * forever. Here it is stale at worst, and revalidated on the next request.
 */
const STATIC_DIRS = ['icons/', 'fonts/', 'brand/'];

const isShell = (url) =>
  url.href === SHELL_URL ||
  url.href === MANIFEST_URL ||
  url.pathname === ROOT.pathname ||
  STATIC_DIRS.some((dir) => url.pathname.startsWith(`${ROOT.pathname}${dir}`));

// ---------------------------------------------------------------------------
// Lifecycle

self.addEventListener('install', (event) => {
  event.waitUntil(installUpdate());
});

/**
 * Everything that has to happen while there is certainly a network.
 *
 * Which is the whole of install and nothing else. A worker installs only when
 * it can fetch - the precache below is fetched, and an install that cannot
 * fetch fails and leaves the old worker in charge - and then it sits in
 * `waiting` for as long as it takes the user to notice the prompt and tap it.
 * That tap can land in a tunnel, and everything downstream of it runs there.
 *
 * The importer's chunk is the only file that cares. It is held back from the
 * precache on purpose, so nothing else fetches it, and activation prunes every
 * hashed file the new document does not name - which after a deploy includes
 * the copy under the old hash. Refetching it from `activate` meant refetching
 * it at the one moment the network may be gone, and a user who took an update
 * offline came out of the tunnel with an importer that had silently stopped
 * existing. Keeping the old chunk instead would not have helped for a second:
 * the new bundle asks for the new hash and would never look at it.
 *
 * So the fetch moves to the moment that is guaranteed. `wanted` is read before
 * the precache to say what it is a question about - what this device had before
 * the update, not what it has after - though nothing in `precache` touches it.
 */
async function installUpdate() {
  const wanted = await importerWasWanted();
  await precache();
  if (wanted) await warmImporter();
}

async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  const [document, manifest] = await Promise.all([
    fetchFresh(SHELL_URL),
    fetchFresh(MANIFEST_URL),
  ]);
  await cache.put(MANIFEST_URL, manifest);
  // The bundle before the document. The worker being replaced is still serving
  // from this same cache, so a document stored ahead of its assets is one that
  // boots into a blank page the next time the user is in flight mode.
  await warmAssets(await document.clone().text());
  await cache.put(SHELL_URL, document);
  // No skipWaiting. The new worker sits in `waiting` until the UI offers the
  // reload and the user takes it: swapping the bundle out from under a table
  // mid-session is the one thing an offline app must never do.
}

/**
 * Fill the caches again if something has emptied them.
 *
 * `precache` runs on install, and install happens once: a browser installs a
 * replacement worker only when the bytes of this file change, and between
 * deploys they do not. The caches are nowhere near as durable as the
 * registration that owns them - a browser reclaims Cache Storage under pressure
 * and clears it for a site nobody has opened in a while, and clearing site data
 * by hand takes the caches and leaves the worker behind. Every one of those
 * ends the same way: an activated worker sitting on an empty cache, an app that
 * still looks installed, and no path back, because the one thing that fills
 * these caches has already run and will not run again.
 *
 * The symptom is silent until it is total. The app opens fine on a train with
 * signal - the fetch handler misses, goes to the network, and refills as it
 * goes - and then one evening it is opened in a basement and it is a white
 * screen, with a character sheet inside it that the user cannot reach.
 *
 * So the check happens whenever the worker is awake and in a position to do
 * something about it: as it activates, and whenever a client talks to it. Best
 * effort, because offline there is nothing to fetch and an activation that
 * failed over it would leave the user worse off than one that quietly tried;
 * loud, because a precache that will not rebuild is worth a console line.
 *
 * Returns the cached document, or nothing if it could not be had.
 */
async function ensurePrecached() {
  const shellCache = await caches.open(SHELL_CACHE);
  const cached = await shellCache.match(SHELL_URL);
  if (cached) return cached;
  try {
    await precache();
  } catch (error) {
    console.warn('[sw] could not rebuild the precache', error);
    return undefined;
  }
  return shellCache.match(SHELL_URL);
}

self.addEventListener('activate', (event) => {
  event.waitUntil(takeOver());
});

async function takeOver() {
  const names = await caches.keys();
  // Ours only. Every project of the same account shares an origin on
  // github.io, and deleting a sibling app's caches would be a nasty bug to
  // find from the other side.
  const stale = names.filter((name) => name.startsWith('dhc-') && !CURRENT.has(name));
  await Promise.all(stale.map((name) => caches.delete(name)));

  // A device that asked for the importer once still wants it. `installUpdate`
  // has already fetched this build's copy, back when there was a network to
  // fetch it from; this is the retry for the install whose connection died on
  // that one file, and it has to be asked before the prune, because the prune
  // is what removes the evidence that this device ever wanted the thing.
  const wanted = await importerWasWanted();
  // Refill before pruning, not after. A cache the browser reclaimed has nothing
  // to prune and everything to rebuild, and `pruneAssets` reads the very
  // document that is missing - so on its own it looks at an empty cache, finds
  // no document, and returns satisfied.
  await ensurePrecached();
  // Both refills ahead of the delete, so that no ordering here can read as
  // "drop the copy we have and then go looking". Offline the retry cannot
  // help - which is exactly why install does not leave it until now.
  if (wanted) await warmImporter();
  await pruneAssets();

  await self.clients.claim();
  console.info('[sw] active', VERSION, BUILD);
}

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'skip-waiting') self.skipWaiting();
  if (event.data.type === 'warm-importer') event.waitUntil(warmImporter());
});

/**
 * Fetch the chunks `isDeferred` held back, on a client's say-so.
 *
 * The names are read out of the cached document rather than taken from the
 * client: a client would have to know its own build's hashes, and a stale one
 * would fill the cache with a chunk this build never used.
 */
/** True when a build of the importer is already cached, from any deploy. */
async function importerWasWanted() {
  const assets = await caches.open(ASSET_CACHE);
  return (await assets.keys()).some((request) => isDeferred(new URL(request.url)));
}

async function warmImporter() {
  // Not a bare read of the shell cache. A client only posts this once it knows
  // it can run the importer, which is to say on a desktop that has just loaded
  // the app - so it is the one event that reliably reaches a worker that is
  // activated but not yet controlling anything, and the best chance the worker
  // gets to notice its cache is gone. Reading first and giving up quietly is
  // what left production with a `dhc-shell-v1` holding nothing, opened by this
  // line and never written to by anyone.
  const document = await ensurePrecached();
  if (!document) return;
  const assets = await caches.open(ASSET_CACHE);
  const { hashed } = await reachableFrom(await document.text(), assets);
  for (const url of hashed.values()) {
    if (isDeferred(url)) await tryFill(assets, url.href);
  }
}

// ---------------------------------------------------------------------------
// Routing

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(ROOT.pathname)) return;

  // Every in-scope navigation resolves to the one document. There is no server
  // to ask about a deep link, and on Pages a deep link is a 404.
  if (request.mode === 'navigate') {
    event.respondWith(serveShell(event));
    return;
  }
  if (isImmutable(url)) {
    event.respondWith(cacheFirst(event, request));
    return;
  }
  if (isShell(url)) {
    event.respondWith(staleWhileRevalidate(event, request));
  }
  // Anything else is not ours. Falling through leaves the browser to do
  // exactly what it would have done with no worker installed at all.
});

async function serveShell(event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(SHELL_URL);
  const fresh = revalidate(cache, SHELL_URL);
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  // First visit, or a cache the browser reclaimed. Nothing to serve but the
  // network, and if that fails the failure is the browser's to render.
  return (await fresh) ?? Response.error();
}

async function cacheFirst(event, request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) event.waitUntil(cache.put(request, response.clone()));
  return response;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(request);
  const fresh = revalidate(cache, request.url);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  return (await fresh) ?? Response.error();
}

/** Refetch a shell entry, and adopt any assets a new document names. */
async function revalidate(cache, url) {
  let response;
  try {
    response = await fetch(fromNetwork(url));
  } catch {
    return undefined; // Offline. The cached copy has already answered.
  }
  if (!response.ok) return undefined;
  if (url === SHELL_URL) {
    try {
      await warmAssets(await response.clone().text());
    } catch (error) {
      // Serve it - the network is plainly alive and the browser can fetch the
      // rest itself - but do not store it. A deploy caught half-published
      // leaves a document whose bundle is not in the cache, and the last thing
      // an offline app should do is overwrite a shell that still works.
      console.error('[sw] shell not adopted: its assets did not precache', error);
      return response;
    }
  }
  await cache.put(url, response.clone());
  return response;
}

// ---------------------------------------------------------------------------
// Precaching without a build plugin

const HTML_URLS = /\b(?:src|href)\s*=\s*["']([^"']+)["']/g;
const CSS_URLS = /url\(\s*["']?([^"')]+?)["']?\s*\)/g;
/**
 * Every same-origin file a chunk names.
 *
 * Three shapes, and the third is the one that bites: `import("./Gm-1a2b.js")`
 * for a lazy screen, `from"./chunk-3c4d.js"` for a shared chunk, and
 * `new URL("/assets/worker-5e6f.js", import.meta.url)` for a Web Worker -
 * which is how the Core Rulebook importer's worker is named, and is named
 * nowhere else at all. Matching only `import(...)` left that chunk out of the
 * precache, so the app booted offline and then dead-ended the first time
 * anyone opened the importer.
 *
 * A string that merely looks like a path costs nothing: `tryFill` skips what it
 * cannot fetch, and remembers. (pdf.js carries a literal `"./qcms_bg.js"` that
 * is no file of ours - matching only hash-shaped names would exclude it, at the
 * price of a worker that silently skips any chunk Vite names differently, which
 * is the more expensive mistake by far.)
 */
const JS_IMPORTS = /["']((?:\.{1,2}\/|\/)[^"'\s]*\.(?:js|css))["']/g;

/**
 * Files a chunk hands to the DOM rather than to the module loader. Today that
 * is the Daggerheart Compatible mark and nothing else: four unhashed files
 * under `brand/`, named by an `<img src>` in a component and named nowhere
 * else - not in the document, not in a stylesheet, not in the manifest.
 *
 * A separate pass, rather than three more extensions on `JS_IMPORTS`, because
 * the base differs. A module specifier is relative to the module that writes
 * it; an attribute is relative to the page that renders it. `"./brand/x.png"`
 * sitting in `assets/index-1a2b.js` is `brand/x.png` to the browser and
 * `assets/brand/x.png` to anything that resolves it the way an import is
 * resolved - which is not a file, and would be a 404 and a console line on
 * every install for as long as the app was installed.
 *
 * Being generous costs nothing: a match that is neither hashed nor already
 * shell is dropped without a fetch, so a vendored bundle's stray "./icon.png"
 * is never asked about.
 */
const DOM_ASSETS = /["']((?:\.{1,2}\/|\/)[^"'\s]*\.(?:svg|png|jpe?g|webp|avif|gif))["']/g;

/** In-scope, same-origin URLs named by a document or a stylesheet, resolved
 *  against the file that names them - a stylesheet's `url()` is relative to the
 *  stylesheet, which is not where the document lives. */
function urlsIn(text, pattern, base = ROOT) {
  const found = new Map();
  for (const match of text.matchAll(pattern)) {
    let url;
    try {
      url = new URL(match[1], base);
    } catch {
      continue; // Not resolvable, so not something the browser will request.
    }
    if (url.origin !== self.location.origin) continue;
    if (!url.pathname.startsWith(ROOT.pathname)) continue;
    url.hash = '';
    if (url.href === ROOT.href) continue; // A bare `#anchor`, not a file.
    found.set(url.href, url);
  }
  return [...found.values()];
}

/**
 * Everything one document pulls in: the files it names, the files its
 * stylesheets go on to name, and the files its chunks go on to import. Split by
 * cache, because the halves are governed differently.
 *
 * Without a build plugin nothing hands this worker the names Vite chose, so it
 * reads them back out of what the build produced - cruder than a generated
 * manifest, and with the considerable advantage of describing whatever the
 * build actually is. Three sources, because the build leaves the names in three
 * places:
 *
 *   the document      a <script> for the entry, a <link rel="modulepreload">
 *                     for each chunk it statically imports - the SRD dataset
 *                     among them, which is why the build keeps it a separate
 *                     chunk - and a <link rel="stylesheet"> for the CSS.
 *   the stylesheet    the fonts, which nothing else names.
 *   the chunks        the lazily loaded screens, the Core Rulebook importer's
 *                     worker, and the Daggerheart Compatible mark, which is an
 *                     `<img src>` inside a component. None of the three is
 *                     named in the document, and precaching only what the
 *                     document names leaves the app booting offline and then
 *                     dead-ending on the first tap into one of them. The worker
 *                     is 1.6 MB, half a megabyte gzipped, and every client pays
 *                     it: worth knowing, since the architecture calls that
 *                     importer optional and desktop-only.
 *
 * Breadth-first, so each chunk is read once however many others point at it.
 * `fetchMissing` is what separates the two callers: the precache passes one and
 * the graph is walked as it is filled; the prune passes none and sees only what
 * is already cached, which is exactly the set it is allowed to keep.
 */
async function reachableFrom(html, assets, fetchMissing) {
  const named = urlsIn(html, HTML_URLS);
  const hashed = new Map(named.filter(isImmutable).map((url) => [url.href, url]));
  const shell = new Map(
    named.filter((url) => !isImmutable(url) && isShell(url)).map((url) => [url.href, url]),
  );

  const queue = [...hashed.values()];
  for (let i = 0; i < queue.length; i++) {
    const url = queue[i];
    const isCss = url.pathname.endsWith('.css');
    if (!isCss && !url.pathname.endsWith('.js')) continue;
    if (fetchMissing) await fetchMissing(url);
    const cached = await assets.match(url.href);
    if (!cached) continue;
    const text = await cached.text();
    // Two passes over a chunk, because a chunk names files in two coordinate
    // systems: see DOM_ASSETS. A stylesheet names files in one.
    const refs = isCss
      ? urlsIn(text, CSS_URLS, url)
      : [...urlsIn(text, JS_IMPORTS, url), ...urlsIn(text, DOM_ASSETS, ROOT)];
    for (const ref of refs) {
      if (isImmutable(ref)) {
        if (hashed.has(ref.href)) continue;
        hashed.set(ref.href, ref);
        queue.push(ref);
      } else if (isShell(ref)) {
        shell.set(ref.href, ref);
      }
    }
  }
  return { hashed, shell };
}

/**
 * Fill the caches for a document.
 *
 * What the document itself names is strict: a failure propagates, and during
 * install that fails the install and leaves the previous worker in charge,
 * which is right - a half-filled precache is an app that breaks on the first
 * tap in flight mode.
 *
 * Everything found by reading the build is best effort. The fonts, because a
 * typeface that will not load costs the app its typography while failing the
 * install would cost it offline altogether. The lazy chunks, because they are
 * found by running a regular expression over minified JavaScript, and no
 * heuristic over generated text should be able to pin every client to an old
 * bundle for good. Both are loud in the console when they miss.
 */
async function warmAssets(html) {
  const assets = await caches.open(ASSET_CACHE);
  const shellCache = await caches.open(SHELL_CACHE);

  const named = urlsIn(html, HTML_URLS).filter(isImmutable);
  await Promise.all(named.map((url) => fill(assets, url.href)));

  const { shell } = await reachableFrom(html, assets, (url) =>
    isDeferred(url) ? undefined : tryFill(assets, url.href),
  );
  for (const url of shell.values()) await tryFill(shellCache, url.href);
  await warmManifestIcons(shellCache);
}

async function fill(cache, href) {
  if (await cache.match(href)) return;
  await cache.put(href, await fetchFresh(href));
}

/** URLs the server has answered for, definitively, with "no such file". Inferring
 *  names from minified code turns up the occasional string that was never a file
 *  here, and warmAssets runs on every navigation: without this, one bad guess is
 *  a 404 and a console line for as long as the app is installed. Only a real
 *  answer counts - a fetch that failed because the device is offline has said
 *  nothing about whether the file exists. */
const absent = new Set();

async function tryFill(cache, href) {
  if (absent.has(href)) return;
  try {
    await fill(cache, href);
  } catch (error) {
    if (error.status !== undefined) absent.add(href);
    console.warn('[sw] optional precache skipped', href, error);
  }
}

async function fetchFresh(href) {
  const response = await fetch(fromNetwork(href));
  if (response.ok) return response;
  const error = new Error(`precache ${href}: HTTP ${response.status}`);
  error.status = response.status;
  throw error;
}

/** The install prompt asks for icons the document never names - the 512s and
 *  the maskable - and asks for them at whatever moment the user taps Add to
 *  Home Screen, which may well be offline. The manifest is already cached, so
 *  the list is right here. */
async function warmManifestIcons(shellCache) {
  const cached = await shellCache.match(MANIFEST_URL);
  if (!cached) return;
  let icons;
  try {
    ({ icons = [] } = await cached.json());
  } catch (error) {
    console.warn('[sw] manifest is not readable', error);
    return;
  }
  for (const icon of icons) {
    if (typeof icon?.src !== 'string') continue;
    const url = new URL(icon.src, MANIFEST_URL);
    if (url.origin === self.location.origin) await tryFill(shellCache, url.href);
  }
}

/**
 * Drop the hashed files of superseded builds. Ordinary deploys keep the cache
 * names - they have to, or every deploy would re-download a bundle whose
 * content hashes mostly did not change - so nothing else ever removes them and
 * the assets cache grows by a full bundle, SRD chunk included, every deploy.
 *
 * Activation is the moment to do it: it happens only once the user has accepted
 * the update, and the client that accepted reloads immediately after.
 *
 * What this cannot see is a chunk that only a dynamic `import()` names, since
 * the document never mentions it - such a chunk is dropped here and refetched,
 * online, the next time it is wanted. Today there are none: the SRD is a static
 * import and so appears as a modulepreload. Anything lazily loaded that has to
 * survive offline needs naming here first.
 */
async function pruneAssets() {
  const shellCache = await caches.open(SHELL_CACHE);
  const document = await shellCache.match(SHELL_URL);
  if (!document) return;
  const assets = await caches.open(ASSET_CACHE);
  const { hashed } = await reachableFrom(await document.text(), assets);
  // A document that names no bundle at all is one this worker has misread.
  // Deleting the whole cache on the strength of that guess would take the app
  // offline; leaving a few stale megabytes would not.
  if (hashed.size === 0) return;
  const superseded = (await assets.keys()).filter((request) => !hashed.has(request.url));
  await Promise.all(superseded.map((request) => assets.delete(request)));
}
