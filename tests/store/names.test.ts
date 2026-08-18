/**
 * The one rule about two things on this device with the same name.
 *
 * `merge.ts::duplicateFor` argues for it - *"the character picker in the header
 * is a `<select>` of names, so two characters called 'Ilya' would be
 * indistinguishable at exactly the moment the user most needs to tell them
 * apart"* - and then enforced it on one of its doors. The others had no guard
 * at all (the wizard, a plain import, NEW CAMPAIGN) or a different one in
 * different words (MENU's campaign rename, which refused every empty name and
 * allowed every duplicate).
 *
 * And the comparison `duplicateFor` did make was `new Set(taken.map(c => c.name))`,
 * which cannot see "ilya", cannot see " Ilya", and cannot see two records both
 * stored as `''` - all three of which every list in this app draws identically.
 *
 * So this file tests the definition rather than any door: that it is one
 * comparison, that it is the same comparison for a campaign as for a character,
 * and that the sentence a door prints comes from here rather than from the
 * door. `tests/ui/rename.test.tsx`, `tests/ui/wizardCreate.test.tsx`,
 * `tests/gm/gmScreen.test.tsx` and `tests/store/import.test.ts` are the doors.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_NAMES,
  CHARACTER_NAMES,
  freeName,
  judgeName,
  nameHolder,
  spokenName,
} from '../../src/store/names.ts';

/** The shape the rule takes: an id and a name, whatever else the record has. */
const rec = (name: string, id = `id-${name}`): { id: string; name: string } => ({ id, name });

describe('what the app speaks where a name is missing', () => {
  it('reads an empty name as the word the screens already print, per kind', () => {
    // Not decoration: thirteen character sites do `name || 'Unnamed'`, and both
    // MENU and the GM top bar draw "Unnamed campaign". For two records stored
    // as '' that word IS the name, and it is the same name twice.
    expect(spokenName('', CHARACTER_NAMES)).toBe('Unnamed');
    expect(spokenName('   ', CAMPAIGN_NAMES)).toBe('Unnamed campaign');
  });

  it('trims and collapses, because the screen does it first', () => {
    expect(spokenName('  Il  ya  ', CHARACTER_NAMES)).toBe('Il ya');
  });
});

describe('who else answers to a name', () => {
  it('sees through case, space and emptiness alike', () => {
    const taken = [rec('Ilya'), rec('')];
    expect(nameHolder('ilya', taken, CHARACTER_NAMES)?.name).toBe('Ilya');
    expect(nameHolder(' Ilya ', taken, CHARACTER_NAMES)?.name).toBe('Ilya');
    expect(nameHolder('', taken, CHARACTER_NAMES)?.name).toBe('');
    expect(nameHolder('Unnamed', taken, CHARACTER_NAMES)?.name).toBe('');
  });

  it('leaves the record being renamed out, or nothing could keep its own name', () => {
    const c = rec('Ilya');
    expect(nameHolder('Ilya', [c], CHARACTER_NAMES, c.id)).toBeUndefined();
  });

  it('answers for campaigns with the same comparison and the campaign’s word', () => {
    const taken = [rec('')];
    expect(nameHolder('unnamed campaign', taken, CAMPAIGN_NAMES)?.name).toBe('');
    // And the word is per kind: a campaign called '' does not collide with the
    // character word, which nothing draws for a campaign.
    expect(nameHolder('Unnamed', taken, CAMPAIGN_NAMES)).toBeUndefined();
  });
});

describe('the nearest free name', () => {
  it('offers the bare base when the base is free', () => {
    // The difference between the two sequences, and the reason the rename path
    // could not simply call `duplicateFor`: a person renaming something wants
    // the nearest free name, and the bare one when it is free.
    expect(freeName('Ilya', [], CHARACTER_NAMES)).toBe('Ilya');
  });

  it('counts up past every name that is taken', () => {
    const taken = [rec('Ilya'), rec('Ilya (2)')];
    expect(freeName('Ilya', taken, CHARACTER_NAMES)).toBe('Ilya (3)');
  });

  it('counts up case-blind, so the offer is not itself a collision', () => {
    const taken = [rec('ilya'), rec('ILYA (2)')];
    expect(freeName('Ilya', taken, CHARACTER_NAMES)).toBe('Ilya (3)');
  });

  it('reads leading and trailing space as no difference', () => {
    expect(freeName(' Ilya ', [rec('Ilya')], CHARACTER_NAMES)).toBe('Ilya (2)');
  });

  it('reads a doubled space as no difference, because HTML collapses it', () => {
    expect(freeName('Il  ya', [rec('Il ya')], CHARACTER_NAMES)).toBe('Il ya (2)');
  });

  it('reads an empty name as the word every screen prints for it', () => {
    expect(freeName('', [], CHARACTER_NAMES)).toBe('Unnamed');
    expect(freeName('', [rec('')], CHARACTER_NAMES)).toBe('Unnamed (2)');
    expect(freeName('   ', [rec('Unnamed')], CHARACTER_NAMES)).toBe('Unnamed (2)');
  });

  it('never offers the bare base to the import path', () => {
    // The copy's job is to be tellably different from the original, even when
    // the original is not in `taken` at all.
    expect(freeName('Ilya', [], CHARACTER_NAMES, { suffix: 'imported' })).toBe('Ilya (imported)');
  });

  it('leaves the record being renamed out of the count', () => {
    // Without this, opening rename and pressing SAVE unchanged would offer to
    // rename Ilya to "Ilya (2)".
    const c = rec('Ilya');
    expect(freeName('Ilya', [c], CHARACTER_NAMES, { except: c.id })).toBe('Ilya');
  });

  it('counts campaigns up from their own empty word', () => {
    // NEW CAMPAIGN twice used to make two rows both reading "My campaign".
    expect(freeName('My campaign', [rec('My campaign')], CAMPAIGN_NAMES)).toBe('My campaign (2)');
    expect(freeName('', [rec('')], CAMPAIGN_NAMES)).toBe('Unnamed campaign (2)');
  });
});

describe('the sentence a door prints, which is written here and not there', () => {
  it('says nothing when the name is free, and offers nothing either', () => {
    const verdict = judgeName('Marek', [rec('Ilya')], CHARACTER_NAMES);
    expect(verdict.refusal).toBeNull();
    expect(verdict.offer).toBeNull();
    expect(verdict.holder).toBeUndefined();
  });

  it('names who holds it, rather than saying only that it is taken', () => {
    // "That name is taken" with no owner is the app knowing something the
    // person reading the screen cannot.
    const verdict = judgeName('ilya', [rec('Ilya')], CHARACTER_NAMES);
    expect(verdict.refusal).toBe('Another character is already called "Ilya".');
    // The offer counts up from what was *typed*, not from what the other one is
    // called: the person wrote a lower-case i and the app is not in the business
    // of correcting that on their behalf. The refusal quotes the holder because
    // it is pointing at a row on the screen; the offer is the typist's own.
    expect(verdict.offer).toBe('ilya (2)');
  });

  it('quotes the holder as it is spoken, not as it is stored', () => {
    // The sentence exists to point at a row on the screen, and the row reads
    // "Ilya" whether the record says "Ilya" or "  Ilya  ".
    expect(judgeName('Ilya', [rec('  Ilya  ')], CHARACTER_NAMES).refusal).toBe(
      'Another character is already called "Ilya".',
    );
  });

  it('has a second sentence for the empty name, because there is no name to quote', () => {
    expect(judgeName('', [rec('')], CHARACTER_NAMES).refusal).toBe(
      'Another character already reads "Unnamed", so both would read "Unnamed".',
    );
  });

  it('says the same two things about a campaign, in the campaign’s nouns', () => {
    // The whole point of the module: one rule, one shape of sentence, and the
    // kind is the only thing that varies. MENU used to say "A campaign needs a
    // name" for the empty case and nothing at all for a duplicate.
    expect(judgeName('the sablewood winter', [rec('The Sablewood Winter')], CAMPAIGN_NAMES).refusal)
      .toBe('Another campaign is already called "The Sablewood Winter".');
    expect(judgeName('  ', [rec('')], CAMPAIGN_NAMES).refusal).toBe(
      'Another campaign already reads "Unnamed campaign", so both would read "Unnamed campaign".',
    );
  });

  it('refuses an empty name only when something else is already unnamed', () => {
    // The strictness is the same at every door, and it is this: emptiness is a
    // name like any other, refused when it collides and stored as '' when it
    // does not. Nothing ever writes the word onto a record.
    expect(judgeName('', [rec('Ilya')], CHARACTER_NAMES).refusal).toBeNull();
    expect(judgeName('', [rec('Ilya')], CAMPAIGN_NAMES).refusal).toBeNull();
  });
});
