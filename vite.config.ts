import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// GitHub Pages serves project sites from /<repo>/. Override with BASE_PATH when
// deploying elsewhere (a user site, a custom domain, or a local file server).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
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
