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
 * Nothing here computes anything. It is handed a `PrintSheet` and sets it.
 */
import type { PrintSheet } from './sheetModel.ts';
import { modifier } from './sheetModel.ts';
import { CoinRow, domainLabel, PrintDomainMark, TickRow } from './marks.tsx';
import { CardText } from '../shared/DomainCardView.tsx';
import { ATTRIBUTION } from '../shared/CompatibleMark.tsx';

export function CharacterSheet({
  sheet,
  printedAt = '',
}: {
  sheet: PrintSheet;
  /** Already formatted. Passed in so a test can pin it. */
  printedAt?: string;
}): React.JSX.Element {
  return (
    <div className="dhc-sheet">
      <header className="dhc-head">
        <div>
          <h1 className="dhc-name">{sheet.name}</h1>
          <div className="dhc-sub">{sheet.headline}</div>
          {sheet.lineage !== '' && <div className="dhc-lineage">{sheet.lineage}</div>}
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
              <span className="dhc-cell-note">
                <span className="dhc-tick" />
                marked{t.spellcast && ' · spellcast'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="dhc-sec dhc-keep">
        <h2 className="dhc-h">Defenses</h2>
        <div className="dhc-grid dhc-defense">
          <div>
            <span className="dhc-cell-label">Evasion</span>
            <span className="dhc-cell-value">{sheet.evasion}</span>
          </div>
          <div>
            <span className="dhc-cell-label">Major threshold</span>
            <span className="dhc-cell-value">{sheet.thresholds[0]}</span>
          </div>
          <div>
            <span className="dhc-cell-label">Severe threshold</span>
            <span className="dhc-cell-value">{sheet.thresholds[1]}</span>
          </div>
          <div>
            <span className="dhc-cell-label">Proficiency</span>
            <span className="dhc-cell-value">{sheet.proficiency}</span>
            <span className="dhc-cell-note">weapon dice already multiplied</span>
          </div>
        </div>
        <p className="dhc-ladder">
          {sheet.ladder
            .map((band) => `${band.label} (${band.from}) mark ${band.hp} HP`)
            .join(' · ')}
        </p>
      </section>

      <section className="dhc-sec dhc-keep">
        <h2 className="dhc-h">Tracks</h2>
        <div className="dhc-tracks">
          {sheet.tracks.map((track) => (
            <div className="dhc-track" key={track.kind}>
              <span className="dhc-track-label">
                {track.label} {track.boxes}
              </span>
              {track.boxes > 0 ? (
                <TickRow kind={track.kind} count={track.boxes} />
              ) : (
                <span className="dhc-meta dhc-empty">none</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="dhc-sec">
        <h2 className="dhc-h">Equipment</h2>
        {sheet.weapons.length === 0 && sheet.armor === null ? (
          <p className="dhc-text dhc-empty">Nothing equipped.</p>
        ) : (
          <>
            {sheet.weapons.map((w) => (
              <div className="dhc-block" key={`${w.slot}-${w.name}`}>
                <div className="dhc-block-head">
                  <span className="dhc-block-name">{w.name}</span>
                  <span className="dhc-block-name">{w.damage}</span>
                </div>
                <div className="dhc-meta">{w.meta}</div>
                {w.feature !== '' && <p className="dhc-text">{w.feature}</p>}
              </div>
            ))}
            {sheet.armor && (
              <div className="dhc-block">
                <div className="dhc-block-head">
                  <span className="dhc-block-name">{sheet.armor.name}</span>
                  <span className="dhc-block-name">Score {sheet.armor.score}</span>
                </div>
                <div className="dhc-meta">
                  Armor · base thresholds {sheet.armor.baseThresholds[0]}/
                  {sheet.armor.baseThresholds[1]}, before the level already added above
                </div>
                {sheet.armor.feature !== '' && <p className="dhc-text">{sheet.armor.feature}</p>}
              </div>
            )}
          </>
        )}
      </section>

      <section className="dhc-sec dhc-keep">
        <div className="dhc-thirds">
          <div>
            <h2 className="dhc-h">Experiences</h2>
            {sheet.experiences.length === 0 ? (
              <p className="dhc-text dhc-empty">None yet.</p>
            ) : (
              <ul className="dhc-list">
                {sheet.experiences.map((e) => (
                  <li key={e.id}>
                    <span>{e.name}</span>
                    <span className="dhc-block-name">{modifier(e.bonus)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
              <span className="dhc-meta dhc-purse-label">Chests</span>
              <CoinRow count={sheet.gold.maxChests} />
            </div>
            <p className="dhc-meta">At print: {sheet.gold.summary}</p>
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
