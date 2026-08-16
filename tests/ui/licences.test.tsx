// @vitest-environment jsdom
/**
 * Can someone read the terms, on the device, with the radio off?
 *
 * `rg darringtonpress src/ public/ index.html` returned nothing. This is an
 * offline-first app that ships redistributed SRD content, and the licence that
 * content is published under existed for its users only as a URL - which is to
 * say, not while they were using the app. The MIT notice was not in the
 * deployed bundle at all, while `LICENSE` itself requires that notice "in all
 * copies or substantial portions of the Software" and a deployed bundle is a
 * copy.
 *
 * `LICENSE` also cited the DPCGL by bare URL with no version and no retrieval
 * date, which is not a citation of a document whose own Section 11 reserves the
 * right to amend it at any time without notice - the same file was already
 * saying of the fonts that "each licence text sits beside the files it covers".
 *
 * These tests hold the user-facing half: both texts on screen, from the device,
 * and the provenance said precisely enough that a reader can check it. The
 * build-output half - `dist/LICENSE.txt`, `dist/legal/*` and the service worker
 * not answering those URLs with the app - is in
 * `tests/pwa/serviceWorker.test.ts`, which already builds for real.
 */
import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useApp } from '../../src/store/state.ts';
import { About } from '../../src/ui/settings/About.tsx';
import { dataset, index } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({ ready: true, dataset, index, characters: [], activeId: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';

async function renderAbout(): Promise<void> {
  await act(async () => {
    root.render(<About />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function press(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  const names = [...container.querySelectorAll('button')].map((b) => b.textContent);
  expect(button, `no button says "${label}" — found: ${names.join(' | ')}`).toBeDefined();
  await act(async () => {
    button!.click();
  });
}

/** What the open licence panel is showing, if anything is. */
const shown = (): string => container.querySelector('pre')?.textContent ?? '';

describe('the licence texts, on the device', () => {
  it('shows the whole DPCGL, not a link to it', async () => {
    await renderAbout();
    await press('Read the DPCGL');

    const bundled = read('src/legal/dpcgl-2025-07-30.txt');
    expect(
      shown(),
      'the licence panel is not showing the licence, so an offline user still cannot read ' +
        'the terms the content in front of them was published under',
    ).toBe(bundled);
    // Spot-checks against the actual document rather than against itself: the
    // title, the attribution clause the app's own notice comes from, and the
    // amendment clause that is why the citation needs a date.
    expect(shown()).toContain('Darrington Press Community Gaming License');
    expect(shown()).toContain('4.3. Copyright Notice');
    expect(shown()).toContain('11. Amendments or Revisions to License.');
  });

  it('shows the MIT licence, and the same bytes the repository carries', async () => {
    await renderAbout();
    await press('Read the MIT licence');

    expect(
      shown(),
      'the licence shown in the app is not the file this project is licensed under',
    ).toBe(read('LICENSE'));
    expect(shown()).toContain('Permission is hereby granted, free of charge');
  });

  it('shows one at a time, and closes again', async () => {
    await renderAbout();
    expect(container.querySelector('pre'), 'the panel starts open').toBeNull();

    await press('Read the DPCGL');
    expect(container.querySelectorAll('pre')).toHaveLength(1);

    await press('Read the MIT licence');
    expect(container.querySelectorAll('pre'), 'both texts opened at once').toHaveLength(1);
    expect(shown()).toContain('MIT License');

    await press('Hide the MIT licence');
    expect(container.querySelector('pre'), 'the panel will not close again').toBeNull();
  });

  it('says where the text came from, precisely enough to check', async () => {
    await renderAbout();
    const body = text();
    // A version, a retrieval date and a hash, because DRP may amend the licence
    // at any time and "see darringtonpress.com/license" names whatever is there
    // today rather than what this release was published under.
    expect(body, 'no version').toContain('30 July 2025');
    expect(body, 'no retrieval date').toContain('retrieved 16 August 2026');
    expect(body, 'no hash of the document this text came from').toMatch(/SHA-256 9d435c4e/);
    expect(body, 'the app implies it is quoting the authority rather than a transcription')
      .toMatch(/extracted from the official PDF/);
    expect(body).toMatch(/that PDF is the authority/);
  });
});

describe('what the repository says about the licence', () => {
  it('names a version and a retrieval date, not a bare URL', () => {
    const licence = read('LICENSE');
    expect(licence, 'LICENSE still cites the DPCGL by bare URL').toContain('retrieved 2026-08-16');
    expect(licence).toContain('DPCGL-July-30th-2025.pdf');
    expect(licence).toMatch(
      /9d435c4ee64ab1485fe7cc6a164daff7f4e2bad0a12bc9e1660e0e9393d4aa04/,
    );
  });

  it('has the terms somewhere `rg darringtonpress src/` can find them', () => {
    // The item's own probe. It returned nothing before this.
    expect(read('src/legal/dpcgl-2025-07-30.txt')).toContain('darringtonpress.com');
  });

  it('pins the extracted text, so a silent edit to a licence cannot pass', () => {
    // Not a checksum for its own sake: this file is a transcription of somebody
    // else's legal document, and the one thing that must never happen to it is
    // a quiet edit. Changing it deliberately - a newer DPCGL, a better
    // extraction - means changing this line, the citation in LICENSE and the
    // provenance sentence in About, together.
    const bytes = readFileSync(join(ROOT, 'src/legal/dpcgl-2025-07-30.txt'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'f0351ac8b4be5ea50d96413fe5509d393c02fdccaacba564a9c8df62f35643e8',
    );
    expect(bytes.toString('utf8')).toContain('Last Updated 7/29/2025');
  });
});
