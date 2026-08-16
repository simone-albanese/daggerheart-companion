/**
 * Which build is this?
 *
 * A user on a stale cached build had no way to tell us which one and we had no
 * way to ask. That is the whole of P4's complaint, and it matters more here
 * than in an app with a server: this one installs a service worker, holds a
 * bundle in Cache Storage until the user accepts an update, and can sit on a
 * home screen for months without touching the network. "It does not do that on
 * mine" is not a useful exchange when neither person can name the bytes they
 * are looking at.
 *
 * Both values are compiled in by `vite.config.ts`, and neither is typed
 * anywhere: `__APP_VERSION__` comes out of `package.json`, and `__BUILD_ID__`
 * out of `GITHUB_SHA` - the same variable `.github/workflows/deploy.yml`
 * stamps over the `__BUILD__` placeholder in `dist/sw.js`, so the worker and
 * the bundle are two readings of one value. The workflow then greps the built
 * bundle for it, so a build id that failed to reach the JavaScript fails the
 * deploy rather than shipping a number that means nothing.
 *
 * The `typeof` guards are not defensive noise. `define` is a textual
 * substitution performed by the bundler, so in the bundle these read
 * `typeof "0.2.0"` and fold away entirely - but any consumer running outside a
 * Vite pipeline (a bare `tsx` script in `tools/`, say) would otherwise get a
 * `ReferenceError` on import rather than a string. `vitest.config.ts` merges
 * the Vite config, so the tests see the real values.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;

/** The version in `package.json`, as of the moment this bundle was compiled. */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';

/**
 * The commit this bundle was built from, or `dev` when it was not built by the
 * deploy workflow. `dev` is deliberately not a fabricated hash: locally there
 * is only ever one build, and inventing an identifier for it would be the one
 * failure mode this whole seam exists to avoid.
 */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown';

/**
 * The build id at the length a person can read out loud and a `git` command
 * still accepts. The full value stays available for a `title`, because seven
 * characters is a convention rather than a guarantee.
 */
export const shortBuildId = (): string =>
  /^[0-9a-f]{40}$/.test(BUILD_ID) ? BUILD_ID.slice(0, 7) : BUILD_ID;
