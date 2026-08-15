/**
 * Developer aid: extract the SRD, de-columnise it and dump the line stream to
 * `tools/.cache/srd-lines.json` (plus a readable .txt) so parsers can be
 * written and reviewed against exactly what they will see.
 *
 *   npm run build:srd -- --dump      (or)      tsx tools/dumpLayout.ts [pdf]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { extractPages } from './pdfText.ts';
import { layoutPages } from '../shared/textLayout.ts';
import { remapGlyphs } from './glyphs.ts';

const DEFAULT_PDF = 'Manuali/Daggerheart-SRD-9-09-25.pdf';

const main = async (): Promise<void> => {
  const pdf = process.argv[2] ?? DEFAULT_PDF;
  const raw = await extractPages(pdf);
  const pages = layoutPages(raw);

  let unknownGlyphs = new Set<string>();
  for (const p of pages) {
    for (const l of p.lines) {
      const { text, unknown } = remapGlyphs(l.text);
      l.text = text;
      unknown.forEach((u) => unknownGlyphs.add(u));
    }
  }

  mkdirSync('tools/.cache', { recursive: true });
  writeFileSync(
    'tools/.cache/srd-lines.json',
    JSON.stringify(
      pages.map((p) => ({
        index: p.index,
        folio: p.folio,
        pdfPage: p.pdfPage,
        side: p.side,
        columns: p.columns,
        lines: p.lines.map((l) => ({
          t: l.text,
          s: l.size,
          f: l.family,
          b: l.bold,
          i: l.italic,
          c: l.column,
          x: Math.round(l.x),
          y: Math.round(l.y),
          w: Math.round(l.w),
        })),
      })),
      null,
      1,
    ),
  );

  const txt = pages
    .map(
      (p) =>
        `\n\n===== book page ${p.index} | folio ${p.folio ?? '?'} | pdf ${p.pdfPage} ${p.side} | ${p.columns} cols =====\n` +
        p.lines.map((l) => `[${l.column}|${l.size}|${l.family}${l.bold ? '|B' : ''}] ${l.text}`).join('\n'),
    )
    .join('');
  writeFileSync('tools/.cache/srd-lines.txt', txt);

  console.log(`pdf pages : ${raw.length}`);
  console.log(`book pages: ${pages.length}`);
  console.log(`lines     : ${pages.reduce((n, p) => n + p.lines.length, 0)}`);
  console.log(`folios    : ${pages[1]?.folio} .. ${pages[pages.length - 1]?.folio}`);
  console.log(`unknown PUA: ${unknownGlyphs.size === 0 ? 'none' : [...unknownGlyphs].join(', ')}`);
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
