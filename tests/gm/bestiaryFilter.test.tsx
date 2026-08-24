/**
 * The bestiary's two filters, against the shipped dataset.
 *
 * Both used to search a feature's **name** and not its text, which is the wrong
 * half: a GM at the table is looking for an adversary that *does* something,
 * and a feature's name almost never says what. `Tangling Roots` is what imposes
 * *Restrained*; the word appears only in the sentence underneath it.
 *
 * These read the real `data/srd-1.0.json` rather than a fixture on purpose. The
 * claim is about the book this app ships, and a fixture written here could be
 * made to pass by choosing its own feature text.
 */
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Dataset } from '@shared/types.ts';

const dataset = srd as unknown as Dataset;

/** The `AdversaryList` predicate, and the `Bestiary` one, as plain functions. */
const matchesAdversary = (a: Dataset['adversaries'][number], needle: string): boolean =>
  a.name.toLowerCase().includes(needle) ||
  a.description.toLowerCase().includes(needle) ||
  a.motives.some((m) => m.toLowerCase().includes(needle)) ||
  a.features.some(
    (f) => f.name.toLowerCase().includes(needle) || f.text.toLowerCase().includes(needle),
  );

const matchesEnvironment = (e: Dataset['environments'][number], needle: string): boolean =>
  e.name.toLowerCase().includes(needle) ||
  e.description.toLowerCase().includes(needle) ||
  e.impulses.toLowerCase().includes(needle) ||
  e.features.some(
    (f) => f.name.toLowerCase().includes(needle) || f.text.toLowerCase().includes(needle),
  );

/** What each filter found before `f.text` was added — name only. */
const nameOnlyAdversary = (a: Dataset['adversaries'][number], needle: string): boolean =>
  a.name.toLowerCase().includes(needle) ||
  a.description.toLowerCase().includes(needle) ||
  a.motives.some((m) => m.toLowerCase().includes(needle)) ||
  a.features.some((f) => f.name.toLowerCase().includes(needle));

describe('finding an adversary by what it does to you', () => {
  it('finds the ones that impose Restrained, which the old filter could not', () => {
    const now = dataset.adversaries.filter((a) => matchesAdversary(a, 'restrained'));
    const before = dataset.adversaries.filter((a) => nameOnlyAdversary(a, 'restrained'));

    // Not "more than none": the gap is the measurement. Seventeen adversaries
    // in the shipped book impose Restrained in a feature's text and say so
    // nowhere else, so a GM searching the obvious word got nothing back.
    expect(now.length - before.length).toBe(17);
    expect(now.map((a) => a.name)).toContain('Bear');
  });

  it('finds an environment the same way', () => {
    const now = dataset.environments.filter((e) => matchesEnvironment(e, 'restrained'));
    expect(now.map((e) => e.name)).toContain('Abandoned Grove');
  });

  it('still finds what it always found, so the widening only adds', () => {
    // A widening that changed an existing answer would be a different bug.
    for (const needle of ['bandit', 'horde', 'minion']) {
      const before = dataset.adversaries.filter((a) => nameOnlyAdversary(a, needle));
      const now = dataset.adversaries.filter((a) => matchesAdversary(a, needle));
      for (const a of before) expect(now).toContain(a);
    }
  });
});
