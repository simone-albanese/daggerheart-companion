/**
 * pdfjs-dist ships types for its main entry only; the worker half is meant to
 * be loaded as a URL, not imported. `worker.ts` imports it on purpose - see
 * the note there about not nesting workers - and needs a name for the one
 * export it registers.
 */
declare module 'pdfjs-dist/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
