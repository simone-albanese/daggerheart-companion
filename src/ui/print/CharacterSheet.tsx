/**
 * The character sheet, laid out for a sheet of paper.
 *
 * The whole design is one decision applied everywhere: a printed sheet is
 * played with a pencil, so it owes the player *room*, not a snapshot. The
 * tracks are empty boxes rather than filled pips, the purse is empty circles,
 * and every value that a session changes is next to somewhere to write. The
 * values that a session does not change - Evasion, thresholds, Proficiency,
 * the damage a weapon rolls at this Proficiency - are printed, because
 * re-deriving those at the table is exactly the arithmetic this app exists to
 * take off the player.
 *
 * The order of the sections, and which fields sit beside which, follow the
 * official sheet's information architecture rather than this file's original
 * guess at one: Evasion beside Armor and its slot pips, the damage ladder in
 * with the two tracks a hit costs, the class's Hope feature under the Hope
 * diamonds it is about, weapons and armor under their own headings, and the
 * inventory beside the weapons a pack can hold. None of the artwork, framing or
 * lettering is reproduced - only which facts belong next to which.
 *
 * Nothing here computes anything. It is handed a `PrintSheet` and sets it.
 */
import type { PrintSheet, SheetTrack } from './sheetModel.ts';
import { modifier } from './sheetModel.ts';
import { CoinRow, domainLabel, PrintDomainMark, TickRow } from './marks.tsx';
import { CardText } from '../shared/DomainCardView.tsx';
import { ATTRIBUTION } from '../shared/CompatibleMark.tsx';

/** One labelled row of boxes. Silent when the character has no such track. */
function TrackLine({ track }: { track: SheetTrack | undefined }): React.JSX.Element | null {
  if (track === undefined) return null;
  const drawn = track.boxes + track.crossed + track.growth;
  return (
    <div className="dhc-track">
      <span className="dhc-track-label">
        {track.label} {track.boxes}
      </span>
      {drawn > 0 ? (
        <TickRow
          kind={track.kind}
          count={track.boxes}
          growth={track.growth}
          crossed={track.crossed}
        />
      ) : (
        <span className="dhc-meta dhc-empty">none</span>
      )}
    </div>
  );
}

/** A ruled line with something to tick or write in. Never a claim. */
const blanks = (n: number, row: (i: number) => React.JSX.Element): React.JSX.Element[] =>
  Array.from({ length: Math.max(0, n) }, (_, i) => row(i));

export function CharacterSheet({
  sheet,
  printedAt = '',
}: {
  sheet: PrintSheet;
  /** Already formatted. Passed in so a test can pin it. */
  printedAt?: string;
}): React.JSX.Element {
  const track = (kind: SheetTrack['kind']): SheetTrack | undefined =>
    sheet.tracks.find((t) => t.kind === kind);
  const armorTrack = track('armor');

  return (
    <div className="dhc-sheet">
      <header className="dhc-head">
        <div>
          <h1 className="dhc-name">{sheet.name}</h1>
          <div className="dhc-sub">{sheet.headline}</div>
          {sheet.heritage !== '' && (
            <div className="dhc-lineage">
              <span className="dhc-inline-label">Heritage</span>
              {sheet.heritage}
            </div>
          )}
        </div>
        <div className="dhc-stamp dhc-meta">
          <div>
            Level {sheet.level} · Tier {sheet.tier}
          </div>
          {sheet.pronouns !== '' && <div>{sheet.pronouns}</div>}
          {printedAt !== '' && <div>Printed {printedAt}</div>}
        </div>
      </header>

      <section className="dhc-sec dhc-keep">
        <h2 className="dhc-h">Traits</h2>
        <div className="dhc-grid dhc-traits">
          {sheet.traits.map((t) => (
            <div key={t.trait}>
              <span className="dhc-cell-label">{t.label}</span>
              <span className="dhc-cell-value">{modifier(t.value)}</span>
              <span className="dhc-verbs">{t.verbs}</span>
              <span className="dhc-cell-note">
                <span className="dhc-tick" />
                marked{t.spellcast && ' · spellcast'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="dhc-sec dhc-keep">
        <h2 className="dhc-h">Evasion &amp; armor</h2>
        <div className="dhc-grid dhc-pair">
          <div>
            <span className="dhc-cell-label">Evasion</span>
            <span className="dhc-cell-value">{sheet.evasion}</span>
            <span className="dhc-cell-note">{sheet.evasionNote}</span>
          </div>
          <div>
            <span className="dhc-cell-label">Armor</span>
            <span className="dhc-cell-value">{sheet.armorScore}</span>
            {armorTrack !== undefined && armorTrack.boxes > 0 ? (
              <span className="dhc-slot-pips">
                <TickRow kind="armor" count={armorTrack.boxes} />
              </span>
            ) : (
              <span className="dhc-cell-note">Unarmored — no slots to mark</span>
            )}
          </div>
        </div>
      </section>

      <section className="dhc-sec dhc-keep">
        <h2 className="dhc-h">Damage &amp; health</h2>
        <div className="dhc-grid dhc-pair">
          <div>
            <span className="dhc-cell-label">Major threshold</span>
            <span className="dhc-cell-value">{sheet.thresholds[0]}</span>
          </div>
          <div>
            <span className="dhc-cell-label">Severe threshold</span>
            <span className="dhc-cell-value">{sheet.thresholds[1]}</span>
          </div>
        </div>
        {/* One sentence under both cells rather than the same caption twice
            side by side: it is a fact about the pair, not about either. */}
        <p className="dhc-meta dhc-note">{sheet.thresholdNote}</p>

        {/* The ladder, as a ladder: what a hit has to reach, and what it costs
            when it does. It was one run-on grey sentence before, which is the
            hardest possible shape to read a threshold out of mid-scene. */}
        <div className="dhc-grid dhc-bands">
          {sheet.ladder.map((band) => (
            <div key={band.label}>
              <span className="dhc-cell-label">{band.label}</span>
              <span className="dhc-band-from">{band.from}</span>
              <span className="dhc-cell-note">Mark {band.hp} HP</span>
            </div>
          ))}
        </div>

        <div className="dhc-tracks">
          <TrackLine track={track('hp')} />
          <TrackLine track={track('stress')} />
        </div>
        <p className="dhc-meta dhc-note">{sheet.growthNote}</p>
      </section>

      <section className="dhc-sec dhc-keep">
        <h2 className="dhc-h">Hope</h2>
        <div className="dhc-tracks dhc-one">
          <TrackLine track={track('hope')} />
        </div>
        <p className="dhc-meta dhc-note">{sheet.hopeNote}</p>
        {sheet.hopeFeature && (
          <div className="dhc-block">
            <div className="dhc-block-head">
              <span className="dhc-block-name">{sheet.hopeFeature.name}</span>
              <span className="dhc-meta">{sheet.hopeFeature.source}</span>
            </div>
            <div className="dhc-text">
              <CardText text={sheet.hopeFeature.text} />
            </div>
          </div>
        )}
      </section>

      <section className="dhc-sec">
        <h2 className="dhc-h">Active weapons</h2>
        <div className="dhc-prof">
          <span className="dhc-cell-label">Proficiency</span>
          <span className="dhc-prof-value">{sheet.proficiency}</span>
          <span className="dhc-meta">already multiplied into the damage below</span>
        </div>
        {sheet.weapons.length === 0 ? (
          <p className="dhc-text dhc-empty">Nothing wielded.</p>
        ) : (
          sheet.weapons.map((w) => (
            <div className="dhc-block" key={`${w.slot}-${w.name}`}>
              <div className="dhc-block-head">
                <span className="dhc-block-name">{w.name}</span>
                <span className="dhc-block-name">{w.damage}</span>
              </div>
              <div className="dhc-meta">{w.meta}</div>
              {w.feature !== '' && <p className="dhc-text">{w.feature}</p>}
            </div>
          ))
        )}
      </section>

      <section className="dhc-sec dhc-keep">
        <h2 className="dhc-h">Active armor</h2>
        {sheet.armor === null ? (
          <p className="dhc-text dhc-empty">Nothing worn.</p>
        ) : (
          <div className="dhc-block">
            <div className="dhc-block-head">
              <span className="dhc-block-name">{sheet.armor.name}</span>
              <span className="dhc-block-name">Base score {sheet.armor.score}</span>
            </div>
            <div className="dhc-meta">
              Base thresholds {sheet.armor.baseThresholds[0]}/{sheet.armor.baseThresholds[1]},
              before the level already added above
            </div>
            {sheet.armor.feature !== '' && <p className="dhc-text">{sheet.armor.feature}</p>}
          </div>
        )}
      </section>

      <section className="dhc-sec dhc-keep">
        <div className="dhc-halves">
          <div>
            <h2 className="dhc-h">Experience</h2>
            <ul className="dhc-list">
              {sheet.experiences.map((e) => (
                <li key={e.id}>
                  <span>{e.name}</span>
                  <span className="dhc-block-name">{modifier(e.bonus)}</span>
                </li>
              ))}
              {blanks(sheet.experienceLines - sheet.experiences.length, (i) => (
                <li className="dhc-write" key={`blank-${i}`}>
                  <span className="dhc-rule" />
                  <span className="dhc-box" />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="dhc-h">Gold</h2>
            {/* Ten handfuls make a bag and ten bags a chest, so the rows are
                the carry itself: fill the tenth circle, erase the row, tick
                one on the row above. */}
            <div className="dhc-purse">
              <span className="dhc-meta dhc-purse-label">Handfuls</span>
              <CoinRow count={sheet.gold.perStep} />
            </div>
            <div className="dhc-purse">
              <span className="dhc-meta dhc-purse-label">Bags</span>
              <CoinRow count={sheet.gold.perStep} />
            </div>
            <div className="dhc-purse">
              <span className="dhc-meta dhc-purse-label">Chest</span>
              <CoinRow count={sheet.gold.maxChests} />
            </div>
            <p className="dhc-meta">At print: {sheet.gold.summary}</p>
          </div>
        </div>
      </section>

      <section className="dhc-sec dhc-keep">
        <div className="dhc-halves">
          <div>
            <h2 className="dhc-h">Inventory</h2>
            {sheet.inventory.length === 0 ? (
              <p className="dhc-text dhc-empty">Empty.</p>
            ) : (
              <ul className="dhc-list">
                {sheet.inventory.map((item, i) => (
                  <li key={`${item.ref ?? item.name}-${i}`}>
                    <span>
                      {item.name}
                      {item.note !== undefined && item.note !== '' && (
                        <span className="dhc-meta"> — {item.note}</span>
                      )}
                    </span>
                    <span className="dhc-meta">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="dhc-h">Inventory weapons</h2>
            {/* Blank on purpose. The app has two weapon slots and no notion of
                a weapon in the pack, so there is nothing here to print and it
                must not pretend otherwise - these are ruled lines and two
                boxes, which claim nothing at all. */}
            <ul className="dhc-list">
              {blanks(sheet.weaponLines, (i) => (
                <li className="dhc-write" key={`weapon-${i}`}>
                  <span className="dhc-rule" />
                  <span className="dhc-slots dhc-meta">
                    <span>
                      <span className="dhc-tick" />
                      Primary
                    </span>
                    <span>
                      <span className="dhc-tick" />
                      Secondary
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="dhc-sec">
        <h2 className="dhc-h">
          Loadout — {sheet.loadout.length} of {sheet.loadoutLimit} active
          {sheet.vaultCount > 0 && ` · ${sheet.vaultCount} in the vault`}
        </h2>
        {sheet.loadout.length === 0 ? (
          <p className="dhc-text dhc-empty">No cards in the loadout.</p>
        ) : (
          <div className="dhc-two">
            {sheet.loadout.map((card) => (
              <div className="dhc-block" key={card.id}>
                <div className="dhc-block-head">
                  <span className="dhc-block-name">
                    <PrintDomainMark domain={card.domain} />
                    {card.name}
                  </span>
                  <span className="dhc-meta">Recall {card.recallCost}</span>
                </div>
                <div className="dhc-meta">
                  {domainLabel(card.domain)} · level {card.level} · {card.type}
                </div>
                <div className="dhc-text">
                  <CardText text={card.text} />
                </div>
              </div>
            ))}
          </div>
        )}
        {sheet.missing.length > 0 && (
          <p className="dhc-meta">
            {sheet.missing.length} card reference(s) this device could not resolve:{' '}
            {sheet.missing.join(', ')}
          </p>
        )}
      </section>

      <section className="dhc-sec">
        <h2 className="dhc-h">Features</h2>
        {sheet.features.length === 0 ? (
          <p className="dhc-text dhc-empty">No class, ancestry or community chosen yet.</p>
        ) : (
          <div className="dhc-two">
            {sheet.features.map((f) => (
              <div className="dhc-block" key={`${f.source}-${f.name}`}>
                <div className="dhc-block-head">
                  <span className="dhc-block-name">{f.name}</span>
                  <span className="dhc-meta">{f.source}</span>
                </div>
                <div className="dhc-text">
                  <CardText text={f.text} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="dhc-foot">
        {ATTRIBUTION.map((line) => (
          <p key={line.slice(0, 24)}>{line}</p>
        ))}
      </footer>
    </div>
  );
}
