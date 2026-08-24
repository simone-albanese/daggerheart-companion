/**
 * The number this app budgets for, and the number of sheets on the board.
 *
 * `prefs.gmPartySize` is read on five surfaces - `Encounter`, `Bestiary`,
 * `SessionRow`, `SessionBody` and `Rest` - where it sets the battle-point base,
 * the size of every Minion group, and the Fear a long rest hands over.
 * `party.length` is how many character sheets the GM has actually imported.
 * Nothing joins the two, and nothing here starts to.
 *
 * **The preference is not derived from the board, and this module offers no
 * control that sets one number from the other.** A GM whose fifth player is
 * away keeps that sheet on the board - it is where the character's marks live
 * and it will be needed next week - and builds tonight's fight for the four who
 * turned up. Both numbers are correct at once. Deriving would take the right
 * one away to satisfy an invariant nobody at the table asked for, and a "fix
 * it" button would be the same act with a tap in front of it.
 *
 * What is actually wrong is only that the disagreement is invisible: the
 * builder prints `(3 × 4) + 2 = 14 BASE` next to five imported sheets and never
 * mentions the five. So this says both numbers, in one sentence, at the places
 * the preference is used - and says nothing at all otherwise, because a line
 * that is on the screen every evening stops being a line anybody reads.
 *
 * ## One sentence, not one per surface
 *
 * The temptation is to word it for each site: `BUDGET FOR 4` under the builder's
 * base, something about group size under the bestiary's spawn. It is the same
 * preference and the same disagreement in both places, and a GM who meets it
 * twice has to recognise it as one fact rather than read two. This repo has
 * paid for the alternative already. `damageBumpRule` exists because one
 * sentence had been transcribed by hand at three sites - two screens,
 * `Encounter.tsx` under the toggles and `SessionBody.tsx` on a planned row,
 * plus the engine's budget line in `engine/encounter.ts` - and all three had
 * dropped the same word. The SRD writes `+1d4 (or a static +2)`; the engine
 * read `'+1d4 (or +2) to all adversary damage rolls'` and both screens carried
 * that same parenthesis, uppercased. No copy was the right one, so no site
 * could be checked against another. `ruleText.ts:236-246` writes the whole
 * episode up, including why the engine's copy could not be repaired by quoting
 * the selector: it computes points and has no rules layer to read, so it names
 * the switch now instead. The lesson is the hand transcription rather than the
 * count - a fact worded once per surface is a fact that is free to differ per
 * surface, and three hands drifted as a set rather than one hand slipping.
 *
 * So the sentence names the number's largest job rather than the one nearest
 * the cursor. `BUDGET FOR 4` is what `gmPartySize` is for, at the surface where
 * a GM sets it; the bestiary's Minion group is the same number spent a second
 * way.
 *
 * ## Wiring the third site
 *
 * `SessionBody`'s `EncounterArm` reads the same preference and prints
 * `n GROUPS OF 4` beside a Minion entry, and it is not wired there yet. (Named
 * rather than cited by line, and this paragraph is why: it said `:305` and
 * `:384`, and the lane that rewrote `SessionBody` in the same wave moved both
 * before either could be read.) Doing it is one
 * import and one element, with no argument to re-litigate and no shape to
 * agree on:
 *
 * ```tsx
 * const note = partySizeNote(partySize, useGm((s) => s.party).length);
 * // ...
 * {note !== null && <span className="t-meta" style={{ color: 'var(--dim)' }}>{note}</span>}
 * ```
 *
 * A pure function rather than a component for exactly that reason: the three
 * surfaces set their line in three different boxes - between the base and the
 * stepper inside the builder's Party panel, a right-aligned line over the
 * bestiary's stat-block header, a row in a session row's open arm - and a
 * component would have had to grow a prop for each of them. The bestiary's is
 * the one that had to move: it started inside the header's `action` column and
 * was taking the adversary's name's width to do it. `Bestiary.tsx` carries the
 * mechanism, and it is a caution for the third site too - this line is long,
 * so it wants a box whose width nothing else is competing for.
 */

/**
 * What to say about a party size the board does not agree with, or `null`.
 *
 * Two silences, and they are different things. **They agree** - there is no
 * disagreement to make visible, and the line would be pure furniture. **The
 * board is empty** - which is not a disagreement either: a GM who has never
 * imported a sheet is not in conflict with the app, they are simply not using
 * the party board, and `BUDGET FOR 4 · 0 SHEETS ON THE BOARD` would follow them
 * onto every screen for the whole campaign saying nothing. The price of that
 * second silence is real and accepted: a GM who imports four sheets, then
 * deletes all four while the preference still says four, is told nothing. That
 * board is empty, and an empty board has no opinion about the number.
 */
export function partySizeNote(gmPartySize: number, sheetsOnTheBoard: number): string | null {
  if (sheetsOnTheBoard === 0) return null;
  if (sheetsOnTheBoard === gmPartySize) return null;
  const sheets = `${String(sheetsOnTheBoard)} SHEET${sheetsOnTheBoard === 1 ? '' : 'S'}`;
  return `BUDGET FOR ${String(gmPartySize)} · ${sheets} ON THE BOARD`;
}
