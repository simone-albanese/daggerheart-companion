// @vitest-environment jsdom
/**
 * What is on screen when the bundle does not evaluate.
 *
 * Every other test in this repository runs inside the module graph, and so
 * cannot see the one failure where the module graph never exists: a hashed
 * chunk that 404s after `pruneAssets()` swept the previous build, a syntax the
 * engine will not parse, a throw at module scope. A React error boundary
 * cannot see it either, for the same reason, and `init()`'s eight-second
 * deadline covers only the adjacent case where the app mounts and then hangs.
 * The residual - "the bundle did not run" - used to have no observer at all:
 * `<body>` was the theme script and an empty `<div id="root">`, so the app was
 * a blank rectangle on every device at once, with a character intact in
 * IndexedDB and unreachable, and the remedy every support page gives (clear
 * site data, delete and reinstall) destroys the only copy that exists.
 *
 * So this file loads the real `index.html`, runs its inline scripts in a
 * document where the module script deliberately never executed, and asks the
 * two questions that matter: does it say anything, and can it still hand the
 * user their characters.
 *
 * The drift guard is the point of the last describe block. The hatch has to
 * hardcode the database and store names - it cannot import them, that is the
 * whole idea - and a hardcoded name that has quietly drifted from `db.ts` is a
 * rescue hatch that rescues nothing, failing silently at 2am. So the round trip
 * here is written entirely through the real modules: `db.putCharacter` writes,
 * the inline script reads, and `parseBackupFile` reads back what it produced.
 * Rename the store, rename the database, change the envelope, and this fails at
 * test time instead.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME } from '../../src/store/db.ts';
import { BACKUP_EXTENSION, BACKUP_FORMAT, parseBackupFile } from '../../src/transfer/fileIo.ts';
import type { Character } from '../../shared/types.ts';
import { makeCharacter } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/* Not `import.meta.url`: under the jsdom environment that is an http URL and
 * `fileURLToPath` refuses it. Vitest runs from the project root. */
const REPO = process.cwd();
const INDEX = readFileSync(`${REPO}/index.html`, 'utf8');

/** The delays the hatch is written around. Asserted, not assumed: they are the
 *  one thing in it a reader is entitled to disagree with. */
const SAY_AFTER = 3000;
const HATCH_AFTER = 10000;

interface Timer {
  ms: number;
  fn: () => void;
}

/**
 * Put the real document in the jsdom page and run its inline scripts.
 *
 * `innerHTML` never executes a script, which is convenient: it models exactly
 * the state this screen exists for - the markup is there and `main.tsx` did
 * not run - and leaves the inline scripts to be run by hand. `setTimeout` is
 * shimmed across that call so the two delays are captured rather than waited
 * on; fake timers are avoided deliberately, because `fake-indexeddb` schedules
 * its own work and faking the clock out from under it makes every read here a
 * question about the test harness instead of about the hatch.
 *
 * `new Function` parses the whole body before it runs a line of it, which makes
 * this the only syntax check the inline scripts get: `ci.yml` runs
 * `node --check` over `public/sw.js` and over nothing else, and `tsc` does not
 * look inside HTML. A typo in the hatch would otherwise ship.
 */
function boot(): Timer[] {
  const parsed = new DOMParser().parseFromString(INDEX, 'text/html');
  // The stylesheet comes too. `hidden` is only an attribute until something
  // honours it, and every layout rule in that block outranks the UA's
  // `[hidden] { display: none }` - so whether this screen is actually off is a
  // question about the cascade, not about the property.
  document.head.innerHTML = '';
  for (const style of parsed.querySelectorAll('style')) {
    document.head.append(style.cloneNode(true));
  }
  document.body.innerHTML = parsed.body.innerHTML;

  const timers: Timer[] = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    timers.push({ ms: ms ?? 0, fn });
    return 0;
  }) as unknown as typeof setTimeout;
  try {
    for (const script of parsed.querySelectorAll('script:not([src])')) {
      new Function(script.textContent ?? '')();
    }
  } finally {
    globalThis.setTimeout = real;
  }
  return timers;
}

const fire = (timers: Timer[], ms: number): void => {
  const timer = timers.find((t) => t.ms === ms);
  expect(timer, `nothing was scheduled for ${ms}ms; found ${timers.map((t) => t.ms).join(', ')}`)
    .toBeDefined();
  timer!.fn();
};

/** Let `fake-indexeddb` finish. It runs on the microtask/immediate queue, so
 *  yielding a few times is all it takes and no clock has to be involved. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

const el = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  expect(node, `#${id} is not in index.html`).not.toBeNull();
  return node!;
};

/** As a reader sees it: the markup is wrapped at eighty columns, so a sentence
 *  in the source carries newlines a person never sees. */
const spoken = (node: Node): string => (node.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * jsdom has no `createObjectURL`, and it is not the subject here - the bytes
 * handed to it are. Installed as real properties rather than spied onto
 * nothing, so each test can spy on them the ordinary way.
 */
interface BlobUrls {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}
const urls = URL as unknown as BlobUrls;

/** Write through the real store, so the round trip below is a question about
 *  `db.ts` and the hatch rather than about a hand-built record. */
async function seed(...characters: Character[]): Promise<void> {
  vi.resetModules();
  const db = await import('../../src/store/db.ts');
  for (const c of characters) await db.putCharacter(c);
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  document.body.innerHTML = '';
  document.documentElement.dataset['theme'] = 'dark';
  urls.createObjectURL = () => 'blob:rescue';
  urls.revokeObjectURL = () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
  delete urls.createObjectURL;
  delete urls.revokeObjectURL;
});

describe('the words on screen when nothing else ran', () => {
  it('keeps the fallback inside #root, which is the container main.tsx mounts into', () => {
    boot();
    const root = el('root');
    expect(root.contains(el('boot-fallback'))).toBe(true);
    expect(root.querySelector('noscript'), 'a scriptless browser gets nothing').not.toBeNull();

    // The other half of "React overwrites it": the container React is handed
    // has to be this one. Asserted on the source, because the whole point is
    // that in the failing case this module never runs.
    const main = readFileSync(`${REPO}/src/main.tsx`, 'utf8');
    expect(main).toMatch(/getElementById\('root'\)/);
    expect(main).toMatch(/createRoot\(root\)\.render\(/);
  });

  it('is a real mount that clears it, not a claim that one would', async () => {
    boot();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // There has to be something to clear, or this passes against a document
    // that never had a fallback in it - which is the state it is testing away.
    expect(el('boot-fallback')).not.toBeNull();

    // Exactly what `main.tsx` does, against the markup this document ships.
    const root = createRoot(el('root'));
    await act(async () => {
      root.render(createElement('span', null, 'the app'));
    });

    expect(document.getElementById('boot-fallback')).toBeNull();
    expect(errors, 'React complained about the markup it was handed').not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
    root.unmount();
  });

  it('says nothing at all until the app has had its chance', () => {
    boot();
    expect(el('boot-fallback').hidden, 'the fallback is on screen from the first paint').toBe(true);
    expect(el('boot-rescue').hidden).toBe(true);
    expect(el('boot-text').hidden).toBe(true);
  });

  it('keeps `hidden` meaning hidden against its own stylesheet', () => {
    boot();
    /*
     * `hidden` is an attribute until something honours it, and the UA rule that
     * does - `[hidden] { display: none }` - is only specificity (0,1,0). Every
     * layout rule in this document's `<style>` outranks it: `.boot` ties and
     * wins on order, `.boot textarea { display: block }` wins outright. Left
     * alone that paints the whole screen, rescued JSON included, on top of
     * every healthy launch.
     *
     * Read off the parsed rule rather than a computed style, because jsdom's
     * cascade is not a browser's and quietly agrees with either version.
     */
    const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]);
    const guard = rules.find(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule && rule.selectorText.includes('[hidden]'),
    );
    expect(guard, 'nothing in index.html restates what [hidden] has to mean').toBeDefined();
    expect(guard!.selectorText, 'the textarea inside the panel is not covered').toMatch(
      /\.boot \[hidden\]/,
    );
    expect(
      guard!.style.getPropertyPriority('display'),
      'the hiding rule loses to the layout rules below it',
    ).toBe('important');
  });

  it('speaks at three seconds and offers the hatch at ten', () => {
    const timers = boot();
    expect(timers.map((t) => t.ms).sort((a, b) => a - b)).toEqual([SAY_AFTER, HATCH_AFTER]);
  });

  it('reveals the text once the app has plainly not started', () => {
    const timers = boot();
    fire(timers, SAY_AFTER);
    const text = spoken(el('boot-fallback'));
    expect(el('boot-fallback').hidden).toBe(false);
    expect(text).toMatch(/has not started/i);
    // The three things the item asks the words to carry.
    expect(text, 'it never says what the app is').toMatch(/Duality Companion/);
    expect(text, 'it never says the characters are still there').toMatch(
      /in this browser’s own storage/i,
    );
    expect(text, 'it never says what to do').toMatch(/open it again/i);
  });

  it('never tells anyone to clear site data or reinstall', () => {
    const timers = boot();
    fire(timers, SAY_AFTER);
    const words = [el('boot-fallback'), ...document.querySelectorAll('noscript')]
      .map(spoken)
      .join(' ');

    /*
     * The remedy every support page gives is the one action that destroys the
     * only copy of a character that exists. So this is not "the page happens to
     * say do not" - it is: every sentence on this screen that mentions clearing,
     * deleting or reinstalling has to be a sentence forbidding it.
     */
    const sentences = words.split(/(?<=[.!?])\s+/).filter((s) => /\b(clear|reinstall|delete)/i.test(s));
    expect(sentences.length, 'the screen does not raise the subject at all').toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence, `this sentence does not forbid it: ${sentence}`).toMatch(
        /\bdo not\b|\bnothing you\b|\bnever\b/i,
      );
    }
  });
});

describe('the hatch that does not need the bundle', () => {
  it('hands back a file the app can read, written by the real store', async () => {
    const ash = makeCharacter({ id: 'char-ash', name: 'Ash' });
    const bramble = makeCharacter({ id: 'char-bramble', name: 'Bramble' });
    await seed(ash, bramble);

    const timers = boot();
    fire(timers, HATCH_AFTER);
    await settle();

    expect(el('boot-rescue').hidden, 'the hatch never opened').toBe(false);
    // Named, not counted. "2 characters" is a number; the person reading this
    // wants to know Bramble is one of them.
    expect(el('boot-found').textContent).toContain('Ash');
    expect(el('boot-found').textContent).toContain('Bramble');

    // Capture what the download would have carried. jsdom implements neither
    // `createObjectURL` nor a real anchor navigation, and neither is the
    // subject: the bytes are.
    let saved: Blob | null = null;
    const anchors: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      saved = blob as Blob;
      return 'blob:rescue';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      anchors.push(this.download);
    });

    (el('boot-save') as HTMLButtonElement).click();
    expect(saved, 'the save button produced no blob').not.toBeNull();
    expect(anchors[0]).toMatch(/^daggerheart-rescue-\d{4}-\d{2}-\d{2}\.dhbackup$/);

    const json = await (saved as unknown as Blob).text();
    const recovered = parseBackupFile(json);
    expect(recovered.map((c) => c.id).sort()).toEqual(['char-ash', 'char-bramble']);
    expect(recovered.find((c) => c.id === 'char-ash')?.name).toBe('Ash');

    // The textarea is the same bytes, because an installed iOS app swallows a
    // download and leaves copy-and-paste as the only way out.
    (el('boot-show') as HTMLButtonElement).click();
    expect((el('boot-text') as HTMLTextAreaElement).value).toBe(json);
    expect(el('boot-text').hidden).toBe(false);
  });

  it('does not claim the file was saved, because it cannot know that', async () => {
    await seed(makeCharacter({ id: 'char-ash', name: 'Ash' }));
    const timers = boot();
    fire(timers, HATCH_AFTER);
    await settle();

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:rescue');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    (el('boot-save') as HTMLButtonElement).click();

    const status = el('boot-status').textContent ?? '';
    expect(status, 'a download this code cannot observe is reported as a fact').not.toMatch(
      /\bsaved\b/i,
    );
    expect(status).toMatch(/if no file appeared/i);
  });

  it('says so instead of dying when the browser will not make a file', async () => {
    await seed(makeCharacter({ id: 'char-ash', name: 'Ash' }));
    const timers = boot();
    fire(timers, HATCH_AFTER);
    await settle();

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('nope');
    });
    (el('boot-save') as HTMLButtonElement).click();
    expect(el('boot-status').textContent).toMatch(/show it as text/i);
  });

  it('stays shut on a healthy launch, and never opens the database', async () => {
    await seed(makeCharacter({ id: 'char-ash', name: 'Ash' }));
    const timers = boot();
    const open = vi.spyOn(globalThis.indexedDB, 'open');

    // What React does on mount, which is what makes this the healthy case.
    el('root').textContent = '';
    fire(timers, SAY_AFTER);
    fire(timers, HATCH_AFTER);
    await settle();

    expect(open, 'a booting app paid for a database connection it never needed').not.toHaveBeenCalled();
    expect(document.getElementById('boot-rescue')).toBeNull();
  });

  it('stays shut when there is nothing to rescue', async () => {
    const timers = boot();
    fire(timers, HATCH_AFTER);
    await settle();
    expect(el('boot-rescue').hidden).toBe(true);
  });

  /*
   * The footgun this branch exists for. `indexedDB.open(name)` with no version
   * *creates* the database when it is absent - empty, at version 1 - and the
   * real `openDB(name, 1)` would then find the version it wanted, skip its
   * `upgrade` callback, and never create its four stores. A rescue hatch that
   * bricks a first launch is worse than no hatch at all.
   */
  it('does not create the database on a device that has never run the app', async () => {
    const timers = boot();
    fire(timers, HATCH_AFTER);
    await settle();

    expect(await indexedDB.databases()).toEqual([]);

    /*
     * And the real thing still gets its stores - derived from `STORES` rather
     * than written out a third time. This assertion was a literal four-name
     * array and it broke the day a fifth store landed, which is the drift
     * `db.ts::clearAll` already warns about in its own words: "the list written
     * out again is how a new store gets added and quietly survives the button
     * that promises to remove everything." The claim here is not "there are four",
     * it is "the naked rescue `open` did not leave a version-1 database behind
     * that makes `openDB` skip its own upgrade" - and that claim is strongest
     * when it asks for whatever `db.ts` currently declares.
     */
    vi.resetModules();
    const db = await import('../../src/store/db.ts');
    const database = await db.db();
    expect([...database.objectStoreNames].sort()).toEqual([...db.STORES].sort());
    expect(db.STORES.length, 'a database with no stores would pass the line above').toBeGreaterThan(0);
  });
});

describe('the names the hatch has to hardcode', () => {
  const script = /\(function \(\) \{[\s\S]*?boot-fallback[\s\S]*?\}\)\(\);/.exec(INDEX)?.[0] ?? '';

  it('found the inline script to read them out of', () => {
    expect(script, 'the hatch is not where this test expects it in index.html').not.toBe('');
  });

  it('names the database db.ts actually opens', () => {
    expect(/DB_NAME\s*=\s*'([^']+)'/.exec(script)?.[1]).toBe(DB_NAME);
  });

  it('names the store db.ts actually creates', () => {
    const store = /STORE\s*=\s*'([^']+)'/.exec(script)?.[1];
    const created = readFileSync(`${REPO}/src/store/db.ts`, 'utf8');
    expect(created).toContain(`createObjectStore('${store}'`);
  });

  it('writes the envelope fileIo.ts reads', () => {
    expect(script).toContain(`format: '${BACKUP_FORMAT}'`);
    expect(script).toContain(BACKUP_EXTENSION);
  });

  /*
   * Opened without a version on purpose. A hatch pinned to `DB_VERSION` would
   * start failing the day the schema moves, which is the day the database has
   * the most in it.
   */
  it('opens without pinning a version', () => {
    expect(script).toMatch(/idb\.open\(DB_NAME\)/);
  });
});

describe('the un-ship lever, written where a maintainer in a panic will find it', () => {
  const readme = readFileSync(`${REPO}/README.md`, 'utf8');
  const architecture = readFileSync(`${REPO}/Architecture.md`, 'utf8');

  /*
   * Bumping `public/sw.js`'s `VERSION` renames both caches, so `takeOver()`
   * sweeps the old ones and rebuilds from the network. Until now that existed
   * only in a comment inside the file, which is not where somebody looks at
   * 2am with a dead build in production.
   */
  it('is in the README as a runbook, not only in a code comment', () => {
    expect(readme).toMatch(/##\s*.*runbook/i);
    expect(readme).toContain('public/sw.js');
    expect(readme).toMatch(/\bVERSION\b/);
  });

  it('is in Architecture.md too, next to the caches it renames', () => {
    expect(architecture).toContain('public/sw.js');
    expect(architecture).toMatch(/dhc-shell-|dhc-assets-/);
  });

  it('quotes the cache names the worker really uses', () => {
    const sw = readFileSync(`${REPO}/public/sw.js`, 'utf8');
    const version = /const VERSION = '([^']+)'/.exec(sw)?.[1];
    expect(version, 'sw.js no longer has a VERSION to bump').toBeDefined();
    for (const doc of [readme, architecture]) {
      expect(doc).toContain('dhc-shell-');
      expect(doc).toContain('dhc-assets-');
    }
  });
});
