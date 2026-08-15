/**
 * The gate.
 *
 * A parser that quietly drops a card, mangles a number or leaves a decorative
 * glyph behind produces a dataset that *looks* fine and is wrong at a table,
 * mid-session, on someone else's phone. So the build refuses to emit anything
 * that fails these checks, and CI refuses to merge it.
 *
 * Counts come from the SRD itself, not from folklore: they are asserted, and
 * when the source changes the build stops rather than shipping a guess.
 */
import type { Dataset, DomainId } from '../shared/types.ts';
import { ADVERSARY_ROLES, DOMAINS, RANGES, TRAITS } from '../shared/types.ts';
import { hasPua } from './glyphs.ts';

export interface Issue {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

/** Counts the SRD must produce. A mismatch fails the build. */
export const EXPECTED = {
  domains: 9,
  domainCardsPerDomain: 21,
  domainCards: 189,
  classes: 9,
  subclasses: 18,
  ancestries: 18,
  communities: 9,
  beastforms: 22,
  environments: 19,
  /** Adversaries are the one count the book does not state; asserted as a range. */
  adversariesMin: 120,
  adversariesMax: 140,
} as const;

/** Ligature damage from the extractor, in the form it actually takes. */
const LIGATURE_TRAPS =
  /\b(diculty|benets|modier|nesse|specic|reect|Diffi culty|profi t|benefi ts|fi rst|fl ying)\b/i;

function checkText(issues: Issue[], where: string, text: string | undefined): void {
  if (text === undefined || text === '') return;
  if (hasPua(text)) {
    issues.push({
      severity: 'error',
      where,
      message: `contains an unmapped Private Use Area glyph: ${JSON.stringify(text.slice(0, 80))}`,
    });
  }
  const lig = LIGATURE_TRAPS.exec(text);
  if (lig) {
    issues.push({
      severity: 'error',
      where,
      message: `ligature damage: "${lig[0]}" in ${JSON.stringify(text.slice(0, 80))}`,
    });
  }
  if (/�/.test(text)) {
    issues.push({ severity: 'error', where, message: 'contains U+FFFD replacement character' });
  }
}

function expectCount(
  issues: Issue[],
  where: string,
  actual: number,
  expected: number,
): void {
  if (actual !== expected) {
    issues.push({
      severity: 'error',
      where,
      message: `expected ${expected}, got ${actual}`,
    });
  }
}

export function validate(ds: Dataset): Issue[] {
  const issues: Issue[] = [];

  expectCount(issues, 'domains', ds.domains.length, EXPECTED.domains);
  expectCount(issues, 'domainCards', ds.domainCards.length, EXPECTED.domainCards);
  expectCount(issues, 'classes', ds.classes.length, EXPECTED.classes);
  expectCount(issues, 'subclasses', ds.subclasses.length, EXPECTED.subclasses);
  expectCount(issues, 'ancestries', ds.ancestries.length, EXPECTED.ancestries);
  expectCount(issues, 'communities', ds.communities.length, EXPECTED.communities);
  expectCount(issues, 'beastforms', ds.beastforms.length, EXPECTED.beastforms);
  expectCount(issues, 'environments', ds.environments.length, EXPECTED.environments);

  if (
    ds.adversaries.length < EXPECTED.adversariesMin ||
    ds.adversaries.length > EXPECTED.adversariesMax
  ) {
    issues.push({
      severity: 'error',
      where: 'adversaries',
      message: `expected ${EXPECTED.adversariesMin}-${EXPECTED.adversariesMax}, got ${ds.adversaries.length}`,
    });
  }

  // Every domain must carry exactly 21 cards, levels 1 to 10.
  const perDomain = new Map<DomainId, number>();
  for (const d of DOMAINS) perDomain.set(d, 0);
  for (const card of ds.domainCards) {
    if (!DOMAINS.includes(card.domain)) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `unknown domain "${card.domain}"`,
      });
      continue;
    }
    perDomain.set(card.domain, (perDomain.get(card.domain) ?? 0) + 1);
    if (card.level < 1 || card.level > 10) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `level ${card.level} out of range`,
      });
    }
    if (card.recallCost < 0 || card.recallCost > 5) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `recallCost ${card.recallCost} out of range`,
      });
    }
    if (card.text.trim().length < 20) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `text is only ${card.text.trim().length} characters - the parser probably stopped early`,
      });
    }
    checkText(issues, `domainCards/${card.id}`, card.text);
    checkText(issues, `domainCards/${card.id}/name`, card.name);
  }
  for (const [domain, n] of perDomain) {
    if (n !== EXPECTED.domainCardsPerDomain) {
      issues.push({
        severity: 'error',
        where: `domainCards/${domain}`,
        message: `expected ${EXPECTED.domainCardsPerDomain} cards, got ${n}`,
      });
    }
  }

  for (const klass of ds.classes) {
    if (klass.domains.length !== 2) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `expected 2 domains, got ${klass.domains.length}`,
      });
    }
    for (const d of klass.domains) {
      if (!DOMAINS.includes(d)) {
        issues.push({
          severity: 'error',
          where: `classes/${klass.id}`,
          message: `unknown domain "${d}"`,
        });
      }
    }
    if (klass.subclasses.length !== 2) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `expected 2 subclasses, got ${klass.subclasses.length}`,
      });
    }
    if (klass.startingEvasion < 5 || klass.startingEvasion > 15) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `startingEvasion ${klass.startingEvasion} is implausible`,
      });
    }
    if (klass.startingHitPoints < 4 || klass.startingHitPoints > 8) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `startingHitPoints ${klass.startingHitPoints} is implausible`,
      });
    }
    checkText(issues, `classes/${klass.id}`, klass.description);
  }

  for (const sub of ds.subclasses) {
    if (sub.spellcastTrait !== null && !TRAITS.includes(sub.spellcastTrait)) {
      issues.push({
        severity: 'error',
        where: `subclasses/${sub.id}`,
        message: `unknown spellcastTrait "${sub.spellcastTrait}"`,
      });
    }
    if (sub.foundationFeatures.length === 0) {
      issues.push({
        severity: 'error',
        where: `subclasses/${sub.id}`,
        message: 'no foundation features',
      });
    }
  }

  for (const a of ds.ancestries) {
    if (a.features.length !== 2) {
      issues.push({
        severity: 'error',
        where: `ancestries/${a.id}`,
        message: `expected 2 features, got ${a.features.length}`,
      });
    }
    for (const f of a.features) checkText(issues, `ancestries/${a.id}/${f.name}`, f.text);
  }

  for (const c of ds.communities) {
    if (c.feature.text.trim().length < 20) {
      issues.push({
        severity: 'error',
        where: `communities/${c.id}`,
        message: 'feature text is suspiciously short',
      });
    }
  }

  for (const w of ds.weapons) {
    // "spellcast" is legitimate: the arcane-frame wheelchairs defer to
    // whatever Spellcast trait the wielder's subclass names.
    if (w.trait !== 'spellcast' && !TRAITS.includes(w.trait)) {
      issues.push({ severity: 'error', where: `weapons/${w.id}`, message: `unknown trait "${w.trait}"` });
    }
    if (!RANGES.includes(w.range)) {
      issues.push({ severity: 'error', where: `weapons/${w.id}`, message: `unknown range "${w.range}"` });
    }
    if (!/^\d*d\d+([+-]\d+)?$/.test(w.damage.replace(/\s+/g, ''))) {
      issues.push({
        severity: 'error',
        where: `weapons/${w.id}`,
        message: `damage "${w.damage}" is not a dice expression`,
      });
    }
    if (w.tier < 1 || w.tier > 4) {
      issues.push({ severity: 'error', where: `weapons/${w.id}`, message: `tier ${w.tier} out of range` });
    }
  }

  for (const a of ds.armors) {
    if (a.baseThresholds[0] >= a.baseThresholds[1]) {
      issues.push({
        severity: 'error',
        where: `armors/${a.id}`,
        message: `thresholds ${a.baseThresholds.join('/')} are not increasing`,
      });
    }
    if (a.baseScore < 1 || a.baseScore > 12) {
      issues.push({
        severity: 'error',
        where: `armors/${a.id}`,
        message: `baseScore ${a.baseScore} out of range`,
      });
    }
  }

  const byTier = new Map<number, number>();
  for (const adv of ds.adversaries) {
    byTier.set(adv.tier, (byTier.get(adv.tier) ?? 0) + 1);
    if (!ADVERSARY_ROLES.includes(adv.role)) {
      issues.push({
        severity: 'error',
        where: `adversaries/${adv.id}`,
        message: `unknown role "${adv.role}"`,
      });
    }
    if (adv.difficulty < 1 || adv.difficulty > 30) {
      issues.push({
        severity: 'error',
        where: `adversaries/${adv.id}`,
        message: `difficulty ${adv.difficulty} is implausible`,
      });
    }
    if (adv.hp < 1) {
      issues.push({ severity: 'error', where: `adversaries/${adv.id}`, message: `hp is ${adv.hp}` });
    }
    if (adv.role === 'Minion' && adv.thresholds !== null) {
      issues.push({
        severity: 'warning',
        where: `adversaries/${adv.id}`,
        message: 'a Minion should have no damage thresholds',
      });
    }
    if (adv.features.length === 0) {
      issues.push({
        severity: 'error',
        where: `adversaries/${adv.id}`,
        message: 'no features - the stat block was probably truncated',
      });
    }
    checkText(issues, `adversaries/${adv.id}`, adv.description);
    for (const f of adv.features) checkText(issues, `adversaries/${adv.id}/${f.name}`, f.text);
  }
  for (const tier of [1, 2, 3, 4]) {
    if ((byTier.get(tier) ?? 0) === 0) {
      issues.push({ severity: 'error', where: 'adversaries', message: `no tier ${tier} adversaries` });
    }
  }

  for (const env of ds.environments) {
    if (env.features.length === 0) {
      issues.push({ severity: 'error', where: `environments/${env.id}`, message: 'no features' });
    }
    checkText(issues, `environments/${env.id}`, env.description);
  }

  // Ids must be unique across the whole dataset: the registry maps them to
  // integers, and a collision would silently alias two entities on the wire.
  const seen = new Map<string, string>();
  const collections: Array<[string, Array<{ id: string }>]> = [
    ['domains', ds.domains],
    ['domainCards', ds.domainCards],
    ['classes', ds.classes],
    ['subclasses', ds.subclasses],
    ['beastforms', ds.beastforms],
    ['ancestries', ds.ancestries],
    ['communities', ds.communities],
    ['weapons', ds.weapons],
    ['armors', ds.armors],
    ['loot', ds.loot],
    ['consumables', ds.consumables],
    ['adversaries', ds.adversaries],
    ['environments', ds.environments],
    ['rules', ds.rules],
  ];
  for (const [name, items] of collections) {
    for (const item of items) {
      if (item.id === '' || item.id === undefined) {
        issues.push({ severity: 'error', where: name, message: 'an entry has an empty id' });
        continue;
      }
      const prior = seen.get(item.id);
      if (prior !== undefined) {
        issues.push({
          severity: 'error',
          where: `${name}/${item.id}`,
          message: `duplicate id, already used by ${prior}`,
        });
      }
      seen.set(item.id, name);
    }
  }

  // Every class must point at subclasses that exist, and vice versa.
  const subclassIds = new Set(ds.subclasses.map((s) => s.id));
  const classIds = new Set(ds.classes.map((c) => c.id));
  for (const klass of ds.classes) {
    for (const ref of klass.subclasses) {
      if (!subclassIds.has(ref)) {
        issues.push({
          severity: 'error',
          where: `classes/${klass.id}`,
          message: `dangling subclass ref "${ref}"`,
        });
      }
    }
  }
  for (const sub of ds.subclasses) {
    if (!classIds.has(sub.classRef)) {
      issues.push({
        severity: 'error',
        where: `subclasses/${sub.id}`,
        message: `dangling class ref "${sub.classRef}"`,
      });
    }
  }

  return issues;
}

export function formatIssues(issues: Issue[]): string {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const lines: string[] = [];
  for (const i of errors) lines.push(`  ERROR   ${i.where}: ${i.message}`);
  for (const i of warnings) lines.push(`  warning ${i.where}: ${i.message}`);
  lines.push(`\n  ${errors.length} error(s), ${warnings.length} warning(s)`);
  return lines.join('\n');
}
