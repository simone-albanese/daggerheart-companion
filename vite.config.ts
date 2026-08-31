import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Put the two licence texts in the build output.
 *
 * `dist/` was 28 files and neither `LICENSE` nor any copy of the DPCGL was
 * among them, while `LICENSE` itself requires its notice "in all copies or
 * substantial portions of the Software" - and a deployed bundle is a copy. So
 * the artifact anyone downloads, mirrors or serves now carries both.
 *
 * These are emitted rather than dropped into `public/` on purpose. A file in
 * `public/` is a second copy that has to be kept in step by hand, and the whole
 * point of the root `LICENSE` is that there is one of it; `emitFile` reads the
 * canonical file at build time, so the two cannot drift. It also keeps them out
 * of the dev server's static tree, where they would be answered by the service
 * worker's shell rules rather than as themselves.
 *
 * These files are not the offline story. Nothing in the built document names
 * them, so the worker - which infers its precache by reading what the build
 * emitted - will not cache them, and they are readable only online. The offline
 * copy is the one compiled into the Settings chunk and rendered on the About
 * screen, which the worker already precaches because it precaches every chunk
 * the document reaches. Two copies of each text, from one source file each,
 * for two different readers: `dist/` is for whoever holds the software, About
 * is for whoever is using it in a basement.
 */
function shipLicenceTexts(): Plugin {
  const emitted: Array<[string, string]> = [
    ['LICENSE.txt', './LICENSE'],
    ['legal/DPCGL-2025-07-30.txt', './src/legal/dpcgl-2025-07-30.txt'],
  ];
  return {
    name: 'dhc:ship-licence-texts',
    apply: 'build',
    generateBundle() {
      for (const [fileName, source] of emitted) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(fileURLToPath(new URL(source, import.meta.url)), 'utf8'),
        });
      }
    },
  };
}

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
  plugins: [react(), shipLicenceTexts()],
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
          // large, and precached independently of the app shell. It is now the
          // only one. pdf.js used to be the other large thing this build
          // emitted and it was never named here either - it lived inside the
          // import worker, which rollup emitted as its own bundle - and the
          // importer, the worker and the dependency have all been removed.
          return id.includes('data/srd-1.0.json') ? 'srd' : undefined;
        },
      },
    },
  },
});
