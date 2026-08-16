/**
 * Recalling a card during a scene, wherever the control for it is drawn.
 *
 * One place, because the surfaces that offer it must not disagree about what a
 * tap costs, and because the log line is the only record the table has of the
 * Stress that was spent. It used to live inside `Play.tsx` and serve the vault
 * shelf and the vault rows; `Cards.tsx` is the third caller, in a different
 * file, and a copy of these fifteen lines over there is how two screens end up
 * charging two prices.
 *
 * A recall *during a rest* is deliberately not routed through here. It is free
 * because the rest happened, so it cannot be applied on the tap that asks for
 * it - `Rest.tsx` stages it and commits it with the rest, in one write and one
 * log entry - and a hook that applies immediately is the wrong shape for that.
 * The price is still the engine's either way: `canAddToLoadout` and
 * `recallCard` take `downtime` and enforce MAX_LOADOUT, and both screens ask
 * them rather than deciding for themselves.
 */
import type { DomainCard } from '../../../shared/types.ts';
import { canAddToLoadout, recallCard } from '../../engine/loadout.ts';
import { useActive, useApp } from '../../store/state.ts';

/**
 * Why a card will not come back, in the space a chip has.
 *
 * `SwapCheck.reason` is a sentence written for a place with room. The vault
 * shelf's chip has about 40px left after the name, so it gets the noun; every
 * surface with a row to spare prints the sentence itself. It lives beside
 * `useRecall` because it is the other half of drawing a refusal, and the rest
 * surface needs both.
 */
export function shortReason(reason: string | null): string {
  if (reason === null) return '';
  if (reason.startsWith('Loadout is full')) return 'FULL';
  if (reason.startsWith('Already')) return 'ACTIVE';
  return reason.toUpperCase();
}

export function useRecall(): (card: DomainCard) => void {
  const character = useActive();
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  return (card: DomainCard) => {
    if (!character) return;
    const check = canAddToLoadout(character, card);
    if (!check.allowed) return;
    const out = recallCard(character, card);
    update(() => out.character);
    pushLog({
      kind: 'note',
      label: `Recalled ${card.name}`,
      /*
       * Why it was free, not just that it was.
       *
       * This line used to read "Free during downtime" for every recall that
       * cost nothing, and nothing here has ever been a downtime - so the only
       * way to reach it was one of the 31 SRD cards whose Recall Cost is 0, in
       * the middle of a scene. The log then said a downtime happened that had
       * not. Two zeroes, two reasons, two sentences, and the rest's own zero is
       * written by the rest, in the entry that records it.
       */
      detail:
        check.stressCost === 0
          ? 'This card costs nothing to recall'
          : `Marked ${out.stressMarked} Stress${out.hpMarked > 0 ? ` and ${out.hpMarked} HP` : ''}`,
    });
  };
}
