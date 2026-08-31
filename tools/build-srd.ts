/**
 * Build the committed SRD dataset.
 *
 *   npm run build:srd            build, validate, write data/srd-1.0.json
 *   npm run build:srd -- --check validate only, write nothing (this is CI)
 *
 * If this script is wrong, CI notices. If the equivalent ran in the browser and
 * were wrong, a player would notice at a table, mid-session, on a device you
 * cannot reproduce. That asymmetry is the whole reason the parsing happens
 * here and the result is committed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseAdversaries } from '../shared/parsers/adversaries.ts';
import { parseAncestries } from '../shared/parsers/ancestries.ts';
import { parseBeastforms } from '../shared/parsers/beastforms.ts';
import { parseClasses } from '../shared/parsers/classes.ts';
import { parseCommunities } from '../shared/parsers/communities.ts';
import { parseDomainCards, parseDomains } from '../shared/parsers/domainCards.ts';
import { parseEnvironments } from '../shared/parsers/environments.ts';
import { parseArmors, parseWeapons } from '../shared/parsers/equipment.ts';
import { parseConsumables, parseLoot } from '../shared/parsers/loot.ts';
import { parseRules } from '../shared/parsers/rules.ts';
import { SCHEMA_VERSION, type Dataset } from '../shared/types.ts';
import { loadSrd } from './loadSrd.ts';
import { formatIssues, validate } from './validate.ts';


const main = async (): Promise<void> => {
  const checkOnly = process.argv.includes('--check');
  const started = Date.now();

  /*
   * `--pdf <path>` points the pipeline at a specific book. It does NOT skip the
   * hash gate: the file still has to be one of `BOOKS`, so this selects among
   * known revisions rather than waving an unknown one through. Without it the
   * only way to read a second book was `allowUnknownRevision`, which had no CLI
   * plumbing at all and used to misname whatever it read.
   */
  const pdfFlag = process.argv.indexOf('--pdf');
  const pdfPath = pdfFlag === -1 ? undefined : process.argv[pdfFlag + 1];
  if (pdfFlag !== -1 && pdfPath === undefined) {
    console.error('--pdf needs a path.');
    process.exit(1);
  }

  const srd = await loadSrd(pdfPath === undefined ? {} : { pdfPath });
  console.log(`source   ${srd.pdfPath}`);
  console.log(`sha256   ${srd.sha256}`);
  console.log(`revision ${srd.revision}`);
  console.log(`pages    ${srd.raw.length} pdf -> ${srd.pages.length} book pages`);

  if (srd.unknownGlyphs.length > 0) {
    console.error(
      `\nUnknown Private Use Area glyph(s) survived parsing: ${srd.unknownGlyphs.join(', ')}\n` +
        `The source's display font changed. Every extracted number is suspect until\n` +
        `each occurrence has been checked against the surrounding prose and\n` +
        `tools/glyphs.ts updated. Refusing to build.`,
    );
    process.exit(1);
  }

  const { pages } = srd;
  const { classes, subclasses } = parseClasses(pages);

  const dataset: Dataset = {
    schemaVersion: SCHEMA_VERSION,
    revision: srd.revision,
    // The source's date, not the build's. A committed artifact that changes
    // every time it is regenerated turns `git diff` into noise and makes CI's
    // "does this still match the PDF" check impossible to write honestly.
    generatedAt: srd.sourceDate,
    // Both halves from the book. The label used to be the literal 'SRD 1.0'
    // beside a variable id, so a second revision would have shipped a dataset
    // labelled as the first one on every screen that draws it.
    layers: [{ id: srd.revision, label: srd.label, priority: 0 }],
    domains: parseDomains(pages),
    domainCards: parseDomainCards(pages),
    classes,
    subclasses,
    beastforms: parseBeastforms(pages),
    ancestries: parseAncestries(pages),
    communities: parseCommunities(pages),
    weapons: parseWeapons(pages),
    armors: parseArmors(pages),
    loot: parseLoot(pages),
    consumables: parseConsumables(pages),
    adversaries: parseAdversaries(pages),
    environments: parseEnvironments(pages),
    rules: parseRules(pages),
  };

  console.log('\ncounts');
  const counts: Array<[string, number]> = [
    ['domains', dataset.domains.length],
    ['domainCards', dataset.domainCards.length],
    ['classes', dataset.classes.length],
    ['subclasses', dataset.subclasses.length],
    ['beastforms', dataset.beastforms.length],
    ['ancestries', dataset.ancestries.length],
    ['communities', dataset.communities.length],
    ['weapons', dataset.weapons.length],
    ['armors', dataset.armors.length],
    ['loot', dataset.loot.length],
    ['consumables', dataset.consumables.length],
    ['adversaries', dataset.adversaries.length],
    ['environments', dataset.environments.length],
    ['rules', dataset.rules.length],
  ];
  for (const [name, n] of counts) console.log(`  ${name.padEnd(14)} ${n}`);

  const issues = validate(dataset);
  const errors = issues.filter((i) => i.severity === 'error');
  if (issues.length > 0) {
    console.log('\nvalidation');
    console.log(formatIssues(issues));
  } else {
    console.log('\nvalidation  clean');
  }

  if (errors.length > 0) {
    console.error('\nRefusing to write a dataset that fails validation.');
    process.exit(1);
  }

  /*
   * Which file this build may write, taken from the BOOK and not from a
   * constant. `const OUT = 'data/srd-1.0.json'` used to sit at the top of this
   * file and `--pdf` did not touch it, so the moment the parsers could read
   * SRD 2.0 end to end, `npm run build:srd -- --pdf <SRD 2>` would have written
   * that book's dataset over SRD 1.0's - destroying the byte-identity that is
   * the only evidence the second book was added rather than substituted.
   */
  const OUT = srd.datasetPath;

  if (checkOnly) {
    /*
     * A revision the app does not ship has nothing committed to compare
     * against, and inventing a comparison would be theatre. Validation has
     * already run above and an error there has already exited; reaching here
     * means the book parsed and passed the gate, which is the whole of what
     * `--check` can honestly assert about it.
     */
    if (OUT === null) {
      console.log(
        `\n${srd.revision} is not the committed revision, so there is nothing to compare against.` +
          `\nThe dataset above passed validation. To make this revision the one the app ships,` +
          `\nsee \`datasetPath\` in tools/loadSrd.ts - it is a decision with a diff, not a flag.`,
      );
      return;
    }
    // CI path: compare against what is committed so a stale dataset is caught.
    try {
      const committed = JSON.parse(readFileSync(OUT, 'utf8')) as Dataset;
      if (JSON.stringify(committed) !== JSON.stringify(dataset)) {
        console.error(
          `\n${OUT} is out of date. Run \`npm run build:srd\` and commit the result.`,
        );
        process.exit(1);
      }
      console.log(`\n${OUT} matches the source.`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.error(`\n${OUT} does not exist. Run \`npm run build:srd\`.`);
        process.exit(1);
      }
      throw err;
    }
    return;
  }

  /*
   * Refusing rather than choosing another name. `data/srd-1.0.json` is a static
   * import in `src/store/dataset.ts` and in ~20 test files, so which revision
   * the app ships is a change to those files. Writing `data/srd-2.0.json` here
   * would produce an artifact nothing reads and a build that looks like it
   * shipped something.
   */
  if (OUT === null) {
    console.error(
      `\nRefusing to write: ${srd.revision} has no committed dataset.` +
        `\n${srd.pdfPath} parsed and validated, and this build has nowhere to put it.` +
        `\nGive the book a \`datasetPath\` in tools/loadSrd.ts, and repoint the static` +
        `\nimport in src/store/dataset.ts and the test files that read the old one.`,
    );
    process.exit(1);
  }

  mkdirSync('data', { recursive: true });
  const json = JSON.stringify(dataset);
  writeFileSync(OUT, json);
  console.log(
    `\nwrote ${OUT}  ${(json.length / 1024).toFixed(0)} KB  in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
