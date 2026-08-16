import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// GitHub Pages serves project sites from /<repo>/. Override with BASE_PATH when
// deploying elsewhere (a user site, a custom domain, or a local file server).
const base = process.env.BASE_PATH ?? '/';

/**
 * What build is this, and can it lie?
 *
 * A user on a stale cached build had no way to say which one and no way for us
 * to ask, so both of these now reach the About screen. The rule that shapes
 * them is that a version string which can disagree with the bundle it is
 * printed in is worse than no version string at all - it turns a report we
 * cannot act on into one we act on wrongly.
 *
 * So neither is typed anywhere. The version is read out of `package.json`,
 * which is the only place this project has ever declared it, at the moment the
 * bundle is compiled. The build id is `GITHUB_SHA`, which is where the deploy
 * already gets it: `.github/workflows/deploy.yml` stamps that same variable
 * over the `__BUILD__` placeholder in `dist/sw.js`, so the worker and the
 * bundle are two readings of one value rather than two values. That workflow
 * then greps the built bundle for it, which is what makes them unable to drift:
 * a build whose id did not reach the JavaScript fails the deploy instead of
 * shipping a number that means nothing.
 *
 * Locally there is no `GITHUB_SHA` and there is exactly one build, so it reads
 * `dev` - the same reasoning as `sw.js` keeping its literal placeholder in a
 * local build, and honest in a way that a fabricated hash would not be.
 */
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };
const buildId = process.env.GITHUB_SHA ?? 'dev';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // The SRD dataset is one large JSON asset; keep it a separate chunk so the
    // service worker can precache it independently of the app shell.
    rollupOptions: {
      output: {
        manualChunks(id) {
          // The dataset is the one asset worth its own chunk: immutable,
          // large, and precached independently of the app shell. pdf.js is
          // deliberately absent - it lives only inside the import worker,
          // which rollup already emits as its own bundle, so naming a chunk
          // for it here only produced an empty file.
          return id.includes('data/srd-1.0.json') ? 'srd' : undefined;
        },
      },
    },
  },
  worker: {
    format: 'es',
    // Name it for what it is. The service worker holds this chunk back from
    // the install-time precache - it is pdf.js, and the importer it serves is
    // desktop-only - and a rule keyed on "worker-" would quietly catch any
    // future worker too. The intent belongs in the filename.
    rollupOptions: { output: { entryFileNames: 'assets/import-worker-[hash].js' } },
  },
});
