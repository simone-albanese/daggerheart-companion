/**
 * The freshest campaigns this app has, published by whoever is holding them.
 *
 * `backup.ts` needs the GM's campaigns and must not import `gmStore.ts`. That
 * module ends in a bare `void hydrateGm()` at module scope, deliberately, so
 * that the GM chunk arriving *is* the hydration starting - and `backup.ts` is
 * reached from `App.tsx`, `Settings.tsx` and both error boundaries on the very
 * first paint. A static edge from there into the GM store would drag the lazy
 * GM chunk into that paint and start a campaign read for every player who never
 * opens the GM screen, including from a crashed one.
 *
 * So the direction is inverted, exactly as `ui/shell/campaignAlert.ts` inverts
 * it for the other half of this problem: this module owns a slot, `gmStore`
 * fills it from its own module-scope epilogue - beside the alert publisher it
 * already had there - and the store is the thing that knows the backup exists
 * rather than the other way round.
 *
 * The only value this file imports is `readCampaigns`; the rest is a type,
 * which is erased. So it costs a caller exactly what the campaigns store costs
 * and nothing beyond it.
 *
 * ## Why memory, and why a flush is not a substitute
 *
 * `writeActive` in `gmStore.ts` updates `state.campaigns` only inside the `try`
 * after `putCampaign` resolves, and on a throw deliberately leaves `dirty`
 * true. So on the day writes are failing - a full disk, an older build refusing
 * a newer record, which is precisely the evening the user is about to lose -
 * `flushGm()` cannot make the disk fresh. A disk-sourced backup would then
 * write the stale record, verify it happily (it is a valid `.dhcampaign` of the
 * wrong record) and stamp "last backup: today" over an evening that exists
 * nowhere. `backupDeps.ts` states the same rule for characters and gives the
 * same reason.
 *
 * The fallback is the disk, and it has to be: a device whose GM screen has not
 * been opened this session still has campaigns to back up, and the seam is
 * empty until that chunk loads.
 */
import type { Campaign } from '../../shared/campaigns.ts';
import { readCampaigns } from './campaigns.ts';

/**
 * Every campaign on this device, and the ones this build must not touch.
 *
 * The quarantined half is carried because the backup has a sentence to say
 * about it: a record a newer build wrote is *on the disk and untouched*, not
 * lost, so it is named as a notice rather than counted as a failure or reported
 * as missing. Only the id and the name are carried - the reason belongs to the
 * screen that renders it, not to a file being written.
 */
export interface CampaignSnapshot {
  campaigns: Campaign[];
  quarantined: { id: string; name: string | null }[];
}

let live: (() => CampaignSnapshot | null) | null = null;

/** Fill the slot, or empty it. `gmStore` fills it; tests empty it. */
export function publishCampaignSource(source: (() => CampaignSnapshot | null) | null): void {
  live = source;
}

/**
 * The GM store's campaigns when it has an answer, the disk's otherwise.
 *
 * The source may say `null`, and that is a third answer rather than an empty
 * list: the store returns it while it has not hydrated, and after a hydration
 * whose read *failed*, where `state.campaigns` is empty for want of an answer
 * and not because the device has none. Taking that empty list at face value
 * would drop every campaign out of the backup in silence, on the one launch
 * where the storage is already misbehaving. So it falls through to the disk,
 * which is the conservative direction: reading it again can fail to notice a
 * campaign, never invent one.
 */
export async function currentCampaigns(): Promise<CampaignSnapshot> {
  const said = live === null ? null : live();
  if (said !== null) return said;
  const { campaigns, quarantined } = await readCampaigns();
  return { campaigns, quarantined: quarantined.map(({ id, name }) => ({ id, name })) };
}
