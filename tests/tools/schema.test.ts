/**
 * The `SCHEMA_VERSION` 5 -> 6 bump, and the four things the contract could not
 * say before it.
 *
 * `tests/store/migrations.test.ts` owns the POLICY - a converter for every step,
 * a fixture for every readable version, both ends refused. This file owns the
 * BUMP: what moved, what did not, and the properties that would otherwise be
 * carried only by a type nothing checks at runtime.
 *
 * That last clause is the reason most of this exists. Every one of the four
 * widenings reached `data/srd-1.0.json` through a cast (`m[2] as DamageKind`,
 * `start[2] as Feature['kind']`, a `NO_STRESS_TRACK` constant), and the shipped
 * dataset reaches the app through `srd as unknown as Dataset`. A cast at both
 * ends means `tsc` is looking at a contract while the JSON does whatever the
 * parser did, so the contract has to be checked against the artifact by reading
 * the artifact.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  type Adversary,
  type DamageKind,
  type Dataset,
  type Feature,
  type Transformation,
} from '../../shared/types.ts';
import { migrateCharacterRecord, MIGRATIONS } from '../../shared/migrations.ts';
import { baseDataset } from '../../src/store/dataset.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/schema', import.meta.url));
const raw = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as Record<string, unknown>;

/** Every `Feature` in the dataset, nested ones included. */
function everyFeature(ds: Dataset): Feature[] {
  const out: Feature[] = [];
  const walk = (fs: readonly Feature[] | undefined): void => {
    for (const f of fs ?? []) {
      out.push(f);
      walk(f.features);
    }
  };
  for (const a of ds.adversaries) walk(a.features);
  for (const e of ds.environments) walk(e.features);
  for (const b of ds.beastforms) walk(b.features);
  for (const c of ds.classes) walk([c.hopeFeature, ...c.classFeatures]);
  for (const s of ds.subclasses) {
    walk(s.foundationFeatures);
    walk(s.specializationFeatures);
    walk(s.masteryFeatures);
  }
  for (const a of ds.ancestries) walk(a.features);
  for (const c of ds.communities) walk([c.feature]);
  for (const t of ds.transformations) walk(t.features);
  return out;
}

describe('what the version number is stamped on', () => {
  it('is six, and the chain leaves exactly the version below it', () => {
    // The literal, not the constant, on both sides: `toBe(SCHEMA_VERSION)`
    // would agree with itself whatever the constant said.
    expect(SCHEMA_VERSION).toBe(6);
    expect(MIGRATIONS.map((m) => m.from)).toEqual([3, 4, 5]);
  });

  it('stamps the shipped dataset with the schema this build is', () => {
    // Duplicated on purpose from migrations.test.ts. That one asks the question
    // of `Character`'s number; this one asks it of the DATASET, which is the
    // half this bump is actually for - `data/srd-1.0.json` is the artifact
    // whose shape moved, and it reaches the app through a cast that believes
    // whatever number it finds.
    expect(baseDataset.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('the collection the bump adds', () => {
  it('is present in the shipped dataset, and empty, because SRD 1.0 has no such chapter', () => {
    // `toEqual([])` and not `.toBeDefined()`: an absent key and an empty array
    // are different facts, and the structural diff of this rebuild names the
    // added key by exactly this value.
    expect(baseDataset.transformations).toEqual([]);
    expect(Object.keys(baseDataset)).toContain('transformations');
  });

  it('holds the shape SRD 2.0 folios 43-45 print', () => {
    // A type-level assertion with a body, so the shape the other lanes were
    // handed is written down somewhere a reader can see it rather than only in
    // an interface. If `Transformation` loses `questions`, or `features` goes
    // back to a two-tuple, this stops compiling.
    const demigod: Transformation = {
      id: 'demigod',
      name: 'Demigod',
      description: 'Demigods are mortal creatures whose veins flow with the blood of the gods.',
      features: [
        { name: 'Gifted', text: 'You gain a +1 bonus to action, reaction, and damage rolls.' },
        {
          name: 'Weight of Divinity',
          text: 'When you fail a roll, you must mark a Stress or the GM gains a Fear.',
        },
      ],
      questions: ['Who bestowed demigod status upon you, and what trial did you complete?'],
      sourcePage: 43,
    };
    expect(demigod.features).toHaveLength(2);
    expect(demigod.questions).toHaveLength(1);
  });
});

describe('the four things the contract could not say', () => {
  it('admits both spellings the books print for either-kind damage', () => {
    const both: DamageKind[] = ['phy', 'mag', 'phy or mag', 'phy/mag'];
    expect(both).toHaveLength(4);
  });

  /**
   * The measurement that made the widening non-optional, and it is not about
   * SRD 2.0 at all.
   *
   * SRD 1.0 - the book this app ships - already prints BOTH spellings: folio 49
   * sets Ghostblade's `d10+7 phy or mag`, and folio 82 sets the Spellblade's
   * `ATK: +3 | Empowered Longsword: Melee | 1d8+4 phy/mag`. Both were in
   * `data/srd-1.0.json` before this bump, through `m[2] as DamageKind` and
   * `damage[2]!.trim() as AdversaryAttack['damageType']`, and `DamageKind` said
   * neither existed.
   */
  it('finds every spelling in the shipped dataset inside the widened union', () => {
    const admitted = new Set<string>(['phy', 'mag', 'phy or mag', 'phy/mag']);
    const weapons = new Set(baseDataset.weapons.map((w) => w.damageType as string));
    const attacks = new Set(baseDataset.adversaries.map((a) => a.attack.damageType as string));
    expect([...weapons].sort()).toEqual(['mag', 'phy', 'phy or mag']);
    // `direct phy` / `direct mag` are `AdversaryAttack`'s own members and
    // neither is in SRD 1.0; this asserts the census rather than the type.
    expect([...attacks].sort()).toEqual(['mag', 'phy', 'phy/mag']);
    for (const t of [...weapons, ...attacks]) expect(admitted.has(t), t).toBe(true);

    const ghostblade = baseDataset.weapons.find((w) => w.id === 'ghostblade');
    expect(ghostblade?.damageType).toBe('phy or mag');
    const spellblade = baseDataset.adversaries.find((a) => a.id === 'spellblade');
    expect(spellblade?.attack.damageType).toBe('phy/mag');
    expect(spellblade?.sourcePage).toBe(82);
  });

  it('admits Evolution as a feature kind, and lets a feature carry the features it grants', () => {
    const nestWarden: Feature = {
      name: 'Nest Warden',
      kind: 'Evolution',
      text: 'When the Roc is defeated, it gains the following features:',
      features: [
        { name: 'Wrathful', kind: 'Passive', text: 'The Roc gains a +2 bonus to its Difficulty.' },
        { name: 'Electrifying Aura', kind: 'Passive', text: 'Lightning arcs from the Roc.' },
      ],
    };
    expect(nestWarden.features).toHaveLength(2);
  });

  it('lets an adversary have no Stress track at all, which is not a track of zero', () => {
    const spellboundArmor: Pick<Adversary, 'stress' | 'thresholds'> = {
      stress: null,
      thresholds: null,
    };
    const minion: Pick<Adversary, 'stress'> = { stress: 0 };
    expect(spellboundArmor.stress).toBeNull();
    expect(minion.stress).toBe(0);
    expect(spellboundArmor.stress === minion.stress).toBe(false);
  });
});

describe('what SRD 1.0 does with the new room: nothing', () => {
  /*
   * The other half of the invariant. The structural diff proves the FILE
   * changed by exactly the bump; this proves the CONTENT did not quietly start
   * using the space the bump opened. A parser that began emitting `stress:
   * null` or a nested feature for SRD 1.0 would be a real regression that the
   * diff of one rebuild would show and a later one would not.
   */
  it('uses no Evolution, no nesting, no absent Stress track and no module', () => {
    const features = everyFeature(baseDataset);
    expect(features.length).toBeGreaterThan(400);
    expect(features.filter((f) => f.kind === 'Evolution')).toEqual([]);
    expect(features.filter((f) => f.features !== undefined)).toEqual([]);
    expect(baseDataset.adversaries.filter((a) => a.stress === null)).toEqual([]);
    expect([...baseDataset.weapons, ...baseDataset.armors].filter((g) => g.module !== undefined))
      .toEqual([]);
  });
});

describe('the 5 -> 6 converter', () => {
  it('changes no character field, and says so in its note', () => {
    const before = raw('v5.dhchar')['character'] as Record<string, unknown>;
    const after = migrateCharacterRecord(before);

    expect(after.from).toBe(5);
    expect(after.applied).toEqual([
      'the dataset grew a transformations collection and four widened fields; no schema-5 character field changed',
    ]);
    // Every field, not a spot check: the whole record apart from the stamp.
    expect({ ...after.record, schemaVersion: 5 }).toEqual(before);
    expect(after.record['schemaVersion']).toBe(SCHEMA_VERSION);
  });

  it('does not mutate the record it was handed', () => {
    const record = { schemaVersion: 5, name: 'Fixture' };
    migrateCharacterRecord(record);
    expect(record).toEqual({ schemaVersion: 5, name: 'Fixture' });
  });
});

describe('the v6 fixtures', () => {
  it('are this build fed the v5 pair, body for body', () => {
    for (const [five, six] of [
      ['v5.dhchar', 'v6.dhchar'],
      ['v5.dhbackup', 'v6.dhbackup'],
    ] as const) {
      const a = raw(five);
      const b = raw(six);
      expect(a['schemaVersion']).toBe(5);
      expect(b['schemaVersion']).toBe(6);

      const bodyOf = (f: Record<string, unknown>): Array<Record<string, unknown>> =>
        (f['characters'] ?? [f['character']]) as Array<Record<string, unknown>>;
      const oldBody = bodyOf(a).map((c) => ({ ...c, schemaVersion: 0 }));
      const newBody = bodyOf(b).map((c) => ({ ...c, schemaVersion: 0 }));
      expect(newBody, six).toEqual(oldBody);
    }
  });

  it('keeps the companion damage type the whole 4 -> 5 step existed for', () => {
    // The v5 pair was committed with this field read by nothing, which review
    // named. Carrying the assertion forward is the cheapest way for v6 not to
    // repeat it.
    for (const name of ['v6.dhchar', 'v6.dhbackup']) {
      const file = raw(name);
      const records = (file['characters'] ?? [file['character']]) as Array<
        Record<string, unknown>
      >;
      const companion = records[0]?.['companion'] as Record<string, unknown> | undefined;
      expect(companion?.['damageType'], name).toBe('mag');
    }
  });
});
