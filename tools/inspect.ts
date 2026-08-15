/**
 * Parser development harness. Prints the de-columnised line stream for a folio
 * range, with every typographic signal a parser can key off.
 *
 *   npx tsx tools/inspect.ts 75 78            lines for folios 75..78
 *   npx tsx tools/inspect.ts 46 46 --runs     raw positioned words (tables)
 *   npx tsx tools/inspect.ts --grep "Horde"   every line matching a pattern
 */
import { loadSrd } from './loadSrd.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(name);

const main = async (): Promise<void> => {
  const { pages } = await loadSrd();
  const grep = flag('--grep');

  if (grep !== undefined) {
    const re = new RegExp(grep, 'i');
    for (const p of pages) {
      for (const l of p.lines) {
        if (re.test(l.text)) {
          console.log(`f${String(p.folio).padStart(3)} c${l.column} ${l.size.toFixed(1)} ${l.family}${l.bold ? '/B' : ''} | ${l.text}`);
        }
      }
    }
    return;
  }

  const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
  const from = nums[0] ?? 1;
  const to = nums[1] ?? from;

  for (const p of pages) {
    if (p.folio === null || p.folio < from || p.folio > to) continue;
    console.log(
      `\n===== folio ${p.folio} | pdf ${p.pdfPage} ${p.side} | ${p.columns} cols | ${p.lines.length} lines =====`,
    );
    if (has('--runs')) {
      for (const r of [...p.runs].sort((a, b) => a.y - b.y || a.x - b.x)) {
        console.log(
          `  x=${r.x.toFixed(1).padStart(6)} y=${r.y.toFixed(1).padStart(6)} w=${r.w.toFixed(1).padStart(5)} ${r.size.toFixed(1)} ${r.family}${r.bold ? '/B' : ''} :: ${r.text}`,
        );
      }
    } else {
      for (const l of p.lines) {
        console.log(
          `  [c${l.column} ${l.size.toFixed(1)} ${l.family}${l.bold ? '/B' : ''}${l.italic ? '/I' : ''} x=${l.x.toFixed(0)} y=${l.y.toFixed(0)}] ${l.text}`,
        );
      }
    }
  }
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
