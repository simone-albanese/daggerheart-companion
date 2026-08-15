import { describe, expect, it } from 'vitest';
import {
  canAddToLoadout,
  cardAvailability,
  missingCardRefs,
  recallCard,
  reorderLoadout,
  resolveCards,
  vaultCard,
} from '@engine/loadout.ts';
import { indexDataset } from '@engine/character.ts';
import { makeCard, makeCharacter, makeDataset, makeStats } from '../fixtures/factories.ts';

const card = (id: string, recallCost = 1, over: Parameters<typeof makeCard>[0] = {}) =>
  makeCard({ id, name: id, recallCost, ...over });

const five = ['a', 'b', 'c', 'd', 'e'];

describe('canAddToLoadout', () => {
  it('allows a card the character does not have out', () => {
    const c = makeCharacter({ vault: ['x'], stress: { marked: 0, max: 6 } });
    expect(canAddToLoadout(c, card('x', 2))).toEqual({
      allowed: true,
      stressCost: 2,
      affordable: true,
      reason: null,
    });
  });

  it('refuses a card already in the loadout', () => {
    const c = makeCharacter({ loadout: ['x'] });
    const check = canAddToLoadout(c, card('x'));
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('Already in the loadout');
  });

  it('refuses a sixth card', () => {
    const c = makeCharacter({ loadout: [...five], vault: ['f'] });
    const check = canAddToLoadout(c, card('f'));
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/full \(5\)/);
    expect(check.stressCost).toBe(0);
  });

  it('costs the Recall Cost in Stress during a scene', () => {
    const c = makeCharacter({ vault: ['x'] });
    expect(canAddToLoadout(c, card('x', 3)).stressCost).toBe(3);
  });

  it('costs nothing during downtime', () => {
    const c = makeCharacter({ vault: ['x'], stress: { marked: 6, max: 6 } });
    const check = canAddToLoadout(c, card('x', 3), { downtime: true });
    expect(check.stressCost).toBe(0);
    expect(check.affordable).toBe(true);
  });

  it('says when the Stress is not there, without forbidding the swap', () => {
    const c = makeCharacter({ vault: ['x'], stress: { marked: 5, max: 6 } });
    const check = canAddToLoadout(c, card('x', 3));
    expect(check.allowed).toBe(true);
    expect(check.affordable).toBe(false);
  });

  it('counts a Recall Cost of zero as always affordable', () => {
    const c = makeCharacter({ vault: ['x'], stress: { marked: 6, max: 6 } });
    expect(canAddToLoadout(c, card('x', 0)).affordable).toBe(true);
  });
});

describe('recallCard', () => {
  it('moves the card and marks the Recall Cost in Stress', () => {
    const c = makeCharacter({ vault: ['x', 'y'], stress: { marked: 1, max: 6 } });
    const r = recallCard(c, card('x', 2));
    expect(r.character.loadout).toEqual(['x']);
    expect(r.character.vault).toEqual(['y']);
    expect(r.stressMarked).toBe(2);
    expect(r.hpMarked).toBe(0);
    expect(r.character.stress.marked).toBe(3);
  });

  it('marks nothing during downtime', () => {
    const c = makeCharacter({ vault: ['x'], stress: { marked: 1, max: 6 } });
    const r = recallCard(c, card('x', 3), { downtime: true });
    expect(r.stressMarked).toBe(0);
    expect(r.character.stress.marked).toBe(1);
    expect(r.character.loadout).toEqual(['x']);
  });

  it('spills into HP when the Stress track cannot cover the cost', () => {
    const c = makeCharacter({
      vault: ['x'],
      stress: { marked: 5, max: 6 },
      hp: { marked: 0, max: 6 },
    });
    const r = recallCard(c, card('x', 3));
    expect(r.stressMarked).toBe(1);
    expect(r.hpMarked).toBe(2);
    expect(r.character.stress.marked).toBe(6);
    expect(r.character.hp.marked).toBe(2);
    expect(r.character.loadout).toEqual(['x']);
  });

  it('changes nothing when the swap is not allowed', () => {
    const c = makeCharacter({ loadout: [...five], vault: ['f'], stress: { marked: 0, max: 6 } });
    const r = recallCard(c, card('f', 2));
    expect(r.character).toBe(c);
    expect(r.stressMarked).toBe(0);
  });

  it('leaves the character it was given untouched', () => {
    const c = makeCharacter({ vault: ['x'], stress: { marked: 0, max: 6 } });
    recallCard(c, card('x', 1));
    expect(c.loadout).toEqual([]);
    expect(c.stress.marked).toBe(0);
  });
});

describe('vaultCard', () => {
  it('is free and always allowed', () => {
    const c = makeCharacter({ loadout: ['x', 'y'], stress: { marked: 4, max: 6 } });
    const next = vaultCard(c, 'x');
    expect(next.loadout).toEqual(['y']);
    expect(next.vault).toEqual(['x']);
    expect(next.stress.marked).toBe(4);
  });

  it('does not duplicate a card the vault already lists', () => {
    const c = makeCharacter({ loadout: ['x'], vault: ['x'] });
    expect(vaultCard(c, 'x').vault).toEqual(['x']);
  });

  it('is a no-op for a card that is not in the loadout', () => {
    const c = makeCharacter({ loadout: ['y'], vault: ['x'] });
    expect(vaultCard(c, 'x')).toBe(c);
  });

  it('frees a slot for a recall', () => {
    let c = makeCharacter({ loadout: [...five], vault: ['f'], stress: { marked: 0, max: 6 } });
    c = vaultCard(c, 'a');
    expect(canAddToLoadout(c, card('f')).allowed).toBe(true);
  });
});

describe('reorderLoadout', () => {
  it('moves a card to a new position', () => {
    const c = makeCharacter({ loadout: ['a', 'b', 'c'] });
    expect(reorderLoadout(c, 0, 2).loadout).toEqual(['b', 'c', 'a']);
    expect(reorderLoadout(c, 2, 0).loadout).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op for an index that is not there', () => {
    const c = makeCharacter({ loadout: ['a', 'b'] });
    expect(reorderLoadout(c, 7, 0)).toBe(c);
  });
});

describe('cardAvailability', () => {
  const stats = makeStats({
    domains: ['blade', 'grace'],
    cardLevelCap: (domain) => (domain === 'grace' ? 3 : 6),
  });
  const cards = [
    card('blade-1', 1, { domain: 'blade', level: 1 }),
    card('blade-7', 1, { domain: 'blade', level: 7 }),
    card('grace-3', 1, { domain: 'grace', level: 3 }),
    card('grace-4', 1, { domain: 'grace', level: 4 }),
    card('bone-1', 1, { domain: 'bone', level: 1 }),
  ];

  it('names the reason a card is out of reach', () => {
    const c = makeCharacter({ loadout: ['blade-1'], vault: ['grace-3'] });
    const byId = new Map(cardAvailability(c, stats, cards).map((a) => [a.card.id, a]));

    expect(byId.get('blade-1')).toMatchObject({
      eligible: true,
      reason: null,
      owned: true,
      inLoadout: true,
    });
    expect(byId.get('grace-3')).toMatchObject({ eligible: true, owned: true, inLoadout: false });
    expect(byId.get('bone-1')).toMatchObject({ eligible: false, reason: 'Not one of your domains' });
    expect(byId.get('blade-7')?.reason).toBe('Level 7 - your cap in blade is 6');
    expect(byId.get('grace-4')?.reason).toBe('Level 4 - your cap in grace is 3');
  });

  it('lets a card sit exactly on the cap', () => {
    const c = makeCharacter();
    const at3 = cardAvailability(c, stats, [card('grace-3', 1, { domain: 'grace', level: 3 })])[0]!;
    expect(at3.eligible).toBe(true);
  });

  it('reports nothing as owned for a fresh character', () => {
    const all = cardAvailability(makeCharacter(), stats, cards);
    expect(all.every((a) => !a.owned && !a.inLoadout)).toBe(true);
  });
});

describe('resolving refs against the dataset', () => {
  const ds = makeDataset({ domainCards: [card('blade-1'), card('blade-2')] });
  const index = indexDataset(ds);

  it('resolves the cards it knows, in order', () => {
    expect(resolveCards(['blade-2', 'blade-1'], index).map((c) => c.id)).toEqual([
      'blade-2',
      'blade-1',
    ]);
  });

  it('drops nothing silently: unknown refs are reported instead', () => {
    const c = makeCharacter({ loadout: ['blade-1', 'ghost-card'], vault: ['blade-2', 'other'] });
    expect(resolveCards(c.loadout, index).map((x) => x.id)).toEqual(['blade-1']);
    expect(missingCardRefs(c, index)).toEqual(['ghost-card', 'other']);
  });

  it('has nothing missing when every ref resolves', () => {
    const c = makeCharacter({ loadout: ['blade-1'], vault: ['blade-2'] });
    expect(missingCardRefs(c, index)).toEqual([]);
  });
});

describe('a recall only moves a card the character owns', () => {
  it('refuses a card that is in neither the vault nor the loadout', () => {
    const c = makeCharacter({ vault: ['x'], stress: { marked: 0, max: 6 } });
    const check = canAddToLoadout(c, card('never-acquired'));
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('Not in your vault');
  });

  it('will not let a recall acquire a card for a Stress', () => {
    const c = makeCharacter({ vault: [], stress: { marked: 0, max: 6 } });
    const r = recallCard(c, card('blade-9', 3));
    expect(r.character).toBe(c);
    expect(r.character.loadout).toEqual([]);
    expect(r.stressMarked).toBe(0);
  });

  it('refuses it during downtime too, when the recall would be free', () => {
    const c = makeCharacter({ vault: [] });
    expect(canAddToLoadout(c, card('blade-9'), { downtime: true }).allowed).toBe(false);
  });

  it('still allows the card once it is in the vault', () => {
    const c = makeCharacter({ vault: ['blade-9'], stress: { marked: 0, max: 6 } });
    expect(canAddToLoadout(c, card('blade-9')).allowed).toBe(true);
    expect(recallCard(c, card('blade-9')).character.loadout).toEqual(['blade-9']);
  });
});
