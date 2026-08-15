/**
 * Shared slug normalisation. Used as the join key between source layers (SRD,
 * Core Rulebook) and as the stable public identifier for every dataset entity.
 *
 * Must stay byte-for-byte stable: `data/registry.json` maps these slugs to the
 * integer ids the transfer codec puts on the wire. Changing the algorithm
 * renumbers the world.
 */
export const slugify = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’']/g, '') // Monett's Cloak -> monetts-cloak
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
