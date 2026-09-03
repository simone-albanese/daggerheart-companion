/**
 * The bestiary: 129 adversaries and 19 environments.
 *
 * This is the screen a GM reads *during* a scene, so the list scrolls inside
 * its own region and the stat block never moves out from under a finger. On a
 * phone the block takes the whole region rather than sharing it - half a stat
 * block at 9px is not a compromise, it is unreadable.
 *
 * The active environment rides along above the adversary you are reading,
 * because "does the terrain do anything here?" is asked at exactly that moment.
 */
import { useMemo, useState } from 'react';
import type { Environment, Ref, Tier } from '../../../shared/types.ts';
import { useApp } from '../../store/state.ts';
import { AdversaryRow, FilterBar, NO_FILTER, useFiltered, type Filter } from './AdversaryList.tsx';
import { AdversaryBlock, EnvironmentBand, EnvironmentBlock } from './StatBlock.tsx';
import { useGm } from './gmStore.ts';
import { partySizeNote } from './partySize.ts';

type Tab = 'adversaries' | 'environments';

export function Bestiary({ phone }: { phone: boolean }): React.JSX.Element {
  const adversaries = useApp((s) => s.dataset.adversaries);
  const environments = useApp((s) => s.dataset.environments);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const environmentRef = useGm((s) => s.environmentRef);
  const setEnvironment = useGm((s) => s.setEnvironment);
  const onTheBoard = useGm((s) => s.party).length;
  const spawn = useGm((s) => s.spawn);
  const setRegion = useGm((s) => s.setRegion);
  /*
   * The two halves of one door, read from the store together so the label and
   * the tap cannot disagree about where the adversary is going.
   *
   * `openScene` is trusted to name a scene row without this file checking:
   * `showScene` refuses an id that names none, `openNewScene` mints the row in
   * the same commit that points at it, `removeSessionItem` nulls the pointer
   * when it deletes the row it names, and `readCampaignRecord` nulls a
   * dangling one on the way off the disk. The alternative - subscribing to
   * `session` here to verify - would repaint the whole bestiary on every HP
   * mark, now that a mark rewrites a session row.
   */
  const openScene = useGm((s) => s.openScene);
  const openNewScene = useGm((s) => s.openNewScene);

  // Read, never written back: nothing here sets the preference from the board.
  const disagreement = partySizeNote(partySize, onTheBoard);

  const [tab, setTab] = useState<Tab>('adversaries');
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [envQuery, setEnvQuery] = useState('');
  const [envTier, setEnvTier] = useState<Tier | 'all'>('all');
  const [pickedAdversary, setPickedAdversary] = useState<Ref | null>(null);
  const [pickedEnvironment, setPickedEnvironment] = useState<Ref | null>(null);

  const shownAdversaries = useFiltered(adversaries, filter);
  const shownEnvironments = useMemo(() => {
    const needle = envQuery.trim().toLowerCase();
    return environments.filter(
      (e) =>
        (envTier === 'all' || e.tier === envTier) &&
        (needle === '' ||
          e.name.toLowerCase().includes(needle) ||
          e.description.toLowerCase().includes(needle) ||
          e.impulses.toLowerCase().includes(needle) ||
          // `f.text` as well as `f.name`, because the words a GM searches for
          // are almost never in a feature's title. A feature called "Tangling
          // Roots" is what imposes *Restrained*, and the only place that word
          // appears is the sentence underneath.
          e.features.some(
            (f) =>
              f.name.toLowerCase().includes(needle) || f.text.toLowerCase().includes(needle),
          )),
    );
  }, [environments, envQuery, envTier]);

  const adversary = adversaries.find((a) => a.id === pickedAdversary);
  const environment = environments.find((e) => e.id === pickedEnvironment);
  const active = environments.find((e) => e.id === environmentRef);
  const selection = tab === 'adversaries' ? adversary : environment;

  const list = (
    <div className="stack" style={{ gap: 10, minHeight: 0 }}>
      <div className="row" style={{ gap: 4, flex: 'none' }}>
        {(
          [
            ['adversaries', `ADVERSARIES ${adversaries.length}`],
            ['environments', `ENVIRONMENTS ${environments.length}`],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={on}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                minHeight: 'var(--control)',
                background: on ? 'var(--raised)' : 'transparent',
                border: `1px solid ${on ? 'var(--line)' : 'var(--line-soft)'}`,
                color: on ? 'var(--text)' : 'var(--dim)',
                fontWeight: on ? 700 : 600,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'adversaries' ? (
        <FilterBar
          value={filter}
          onChange={setFilter}
          shown={shownAdversaries.length}
          total={adversaries.length}
        />
      ) : (
        <div className="stack" style={{ gap: 8, flex: 'none' }}>
          <input
            type="search"
            value={envQuery}
            aria-label="Filter environments by text"
            placeholder="Search environments"
            onChange={(e) => setEnvQuery(e.target.value)}
            style={{ minHeight: 44, padding: '8px 11px', font: '600 14px/1 var(--sans)' }}
          />
          <div className="row" style={{ gap: 4 }}>
            {(['all', 1, 2, 3, 4] as Array<Tier | 'all'>).map((t) => {
              const on = envTier === t;
              return (
                <button
                  key={String(t)}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => setEnvTier(t)}
                  style={{
                    minHeight: 'var(--control)',
                    minWidth: 'var(--control)',
                    background: on ? 'var(--text)' : 'var(--raised)',
                    color: on ? 'var(--app)' : 'var(--muted)',
                    fontWeight: on ? 700 : 600,
                  }}
                >
                  {t === 'all' ? 'ALL' : `T${t}`}
                </button>
              );
            })}
          </div>
          <div className="t-meta" style={{ color: 'var(--dim)' }}>
            {shownEnvironments.length} OF {environments.length} SHOWN
          </div>
        </div>
      )}

      <ul
        className="scroll stack"
        style={{ gap: 6, flex: 1, minHeight: 0, margin: 0, padding: 0, listStyle: 'none' }}
      >
        {tab === 'adversaries'
          ? shownAdversaries.map((a) => (
              <AdversaryRow
                key={a.id}
                adversary={a}
                selected={a.id === pickedAdversary}
                onSelect={() => setPickedAdversary(a.id)}
              />
            ))
          : shownEnvironments.map((e) => (
              <EnvironmentRow
                key={e.id}
                environment={e}
                selected={e.id === pickedEnvironment}
                isActive={e.id === environmentRef}
                onSelect={() => setPickedEnvironment(e.id)}
              />
            ))}
        {(tab === 'adversaries' ? shownAdversaries : shownEnvironments).length === 0 && (
          <li className="t-hint" style={{ color: 'var(--dim)', padding: '10px 2px' }}>
            Nothing matches that filter.
          </li>
        )}
      </ul>
    </div>
  );

  const detail =
    selection === undefined ? (
      <div className="stack" style={{ gap: 12 }}>
        {active !== undefined && <EnvironmentBand environment={active} />}
        <div className="panel stack" style={{ padding: 16, gap: 9 }}>
          <span className="t-card" style={{ color: 'var(--muted)' }}>
            Pick something to read
          </span>
          <p className="t-body" style={{ margin: 0, maxWidth: 440 }}>
            The full stat block opens here: the attack line, the thresholds and the feature names
            first, at a size you can read without leaning in. Set an environment active and it rides
            along above whatever you are reading.
          </p>
        </div>
      </div>
    ) : (
      <div className="stack" style={{ gap: 12 }}>
        {tab === 'adversaries' && adversary !== undefined && (
          <>
            {active !== undefined && <EnvironmentBand environment={active} />}
            {/*
              ABOVE THE BLOCK, NOT INSIDE THE HEADER, AND THE REASON IS WIDTH.

              `AdversaryBlock`'s header in `StatBlock.tsx` is a `.spread`
              holding the name and whatever the host passes as `action`, and
              this screen's `action` is a `flex: 'none'` column - so its base
              size is the max-content width of its widest child, and every
              pixel it takes comes off the `<h2 class="t-card">` beside it.
              How far the name is allowed to give before the header overflows
              instead is a separate question - it turns on the `min-width` of
              that `h2`, which declares only `margin: 0` and so keeps a flex
              item's default `min-width: auto`, and on glyph widths - and this
              comment does not answer it. Three earlier drafts of this
              paragraph did answer it, each differently and at least one of
              them backwards, none of them from a browser. The direction is
              the part that needs no measuring and the part the decision below
              rests on, so the direction is all that is claimed here.

              `ADD TO THE SCENE` at 16 characters and `ONE GROUP OF 4` at 14 are
              short enough that the name has been paying nothing for them;
              `BUDGET FOR 4 · 5 SHEETS ON THE BOARD` is 36, more than twice
              either, and tracked out at `0.08em` on top.

              **Measured elsewhere, and not re-measured here.** The review pass
              that caught this ran the header in Chrome against this repo's
              `base.css` and `tokens.css` at 393: the action column went
              156.34 → 245.54px, the title 149.28 → 111.46, and eight of the
              sixteen SRD Minion names wrapped to two lines - from `Jagged
              Knife Lackey` at 19 characters down to `Tangle Bramble` at 14.
              Glyph widths and not character counts decide that boundary:
              `Treant Sapling` is 14 too and stayed on one line. Those figures
              belong to that pass and to the layout this comment removes; do
              not read them as current. What survives them is the mechanism
              above, which needs no browser: a wider child in a `flex: 'none'`
              column is a narrower name.

              So the line comes out of the header and sits over it instead,
              right-aligned so it still reads as attached to the button it
              qualifies, in the detail's own full-width column where its length
              costs nothing at all. It is read and never touched, so nothing
              here changes a target or a thumb's reach; the only price is 30px
              of vertical space in a column that already scrolls, and only on
              the evenings the two numbers disagree. That figure is arithmetic,
              not a measurement: `.t-meta` is 12px on a phone since the
              readability ramp (`500 10px/1` when this was summed, and 27 then),
              and the element this comment stands over steps its leading to
              `lineHeight: 1.5`, so the line box is 18, and the enclosing
              `.stack` - the detail column this block opens,
              `<div className="stack" style={{ gap: 12 }}>` - charges that gap
              once to a new flex item. 18 + 12.

              Still only under a Minion. The rule in `partySize.ts` is that the
              two numbers are said where the preference is *used*, and beside
              `ONE ADVERSARY, FULL HP` it is not used at all - the party size
              has nothing to do with how many bodies that button puts on the
              board. A line about a number nothing near it spends is the
              furniture the whole design is written against.
            */}
            {adversary.role === 'Minion' && disagreement !== null && (
              <span
                className="t-meta"
                style={{
                  color: 'var(--dim)',
                  letterSpacing: '0.08em',
                  lineHeight: 1.5,
                  textAlign: 'right',
                }}
              >
                {disagreement}
              </span>
            )}
            <AdversaryBlock
              adversary={adversary}
              action={
                <span className="stack" style={{ flex: 'none', alignItems: 'flex-end', gap: 5 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      spawn(openScene ?? openNewScene(), adversary, partySize);
                      setRegion('scene');
                    }}
                  >
                    {openScene === null ? 'ADD TO A NEW SCENE' : 'ADD TO THE SCENE'}
                  </button>
                  <span className="t-meta" style={{ color: 'var(--dim)' }}>
                    {adversary.role === 'Minion'
                      ? `ONE GROUP OF ${partySize}`
                      : 'ONE ADVERSARY, FULL HP'}
                  </span>
                </span>
              }
            />
          </>
        )}
        {tab === 'environments' && environment !== undefined && (
          <EnvironmentBlock
            environment={environment}
            active={environment.id === environmentRef}
            onToggle={() =>
              setEnvironment(environment.id === environmentRef ? null : environment.id)
            }
          />
        )}
      </div>
    );

  if (phone) {
    const open = tab === 'adversaries' ? pickedAdversary !== null : pickedEnvironment !== null;
    if (open && selection !== undefined) {
      return (
        <div className="stack" style={{ flex: 1, minHeight: 0, padding: '10px 12px 0' }}>
          <button
            type="button"
            className="row"
            onClick={() =>
              tab === 'adversaries' ? setPickedAdversary(null) : setPickedEnvironment(null)
            }
            style={{ gap: 8, minHeight: 44, flex: 'none' }}
          >
            <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
              ← BACK TO THE LIST
            </span>
          </button>
          <div className="scroll" style={{ flex: 1, minHeight: 0, paddingBottom: 16 }}>
            {detail}
          </div>
        </div>
      );
    }
    return (
      <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: '10px 12px 0' }}>
        {list}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 360px) 1fr',
        gap: 18,
        padding: '14px 20px 0',
      }}
    >
      {list}
      {/* Capped measure: feature text is prose, and prose at 1100px is not read. */}
      <div className="scroll" style={{ minHeight: 0, paddingRight: 6, paddingBottom: 18 }}>
        <div style={{ maxWidth: 780 }}>{detail}</div>
      </div>
    </div>
  );
}

function EnvironmentRow({
  environment,
  selected,
  isActive,
  onSelect,
}: {
  environment: Environment;
  selected: boolean;
  isActive: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="stack"
        style={{
          width: '100%',
          minHeight: 52,
          justifyContent: 'center',
          gap: 4,
          padding: '6px 10px',
          textAlign: 'left',
          borderRadius: 'var(--r3)',
          background: selected ? 'var(--raised)' : 'var(--panel)',
          border: `1px solid ${selected ? 'var(--line)' : 'var(--line-soft)'}`,
          borderLeft: `3px solid ${isActive ? 'var(--sage)' : selected ? 'var(--hope)' : 'transparent'}`,
        }}
      >
        <span className="row" style={{ gap: 7 }}>
          <span
            style={{
              font: '700 14px/1.15 var(--sans)',
              color: selected ? 'var(--text)' : 'var(--text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {environment.name}
          </span>
          {isActive && (
            <span className="chip" style={{ color: 'var(--sage)', flex: 'none' }}>
              ACTIVE
            </span>
          )}
        </span>
        <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
          {/*
            NOT A PROPERTY OF THE TYPE, AND THE OLD COMMENT HERE SAID IT WAS.

            Two environments in the shipped dataset print `Difficulty: Special`
            instead of a number, Ambushed and Ambushers, and
            `shared/parsers/environments.ts:37-43` records that the book prints the
            word and that this app stores it as 0 because
            `Environment.difficulty` is a `number`. Both happen to be Events,
            which is what the sentence that stood here generalised from - but
            the other four Events all carry a Difficulty (Cult Ritual 14, Castle
            Siege 17, Pitched Battle 17, Divine Usurpation 20), so the type
            never had anything to do with it and no other type is exempt either.

            Dropping the field on 0 was right about the 0 - printing `DIF 0`
            would be a number the book does not give - and wrong about the
            silence: a row reading `T1 · EVENT` where every neighbour reads
            `T1 · EVENT · DIF 14` says the app lost the field, not that the
            place has no fixed Difficulty. So it prints the book's own word.
            No row gets wider for it: `T1 · EVENT · DIF SPECIAL` is shorter than
            `T4 · EXPLORATION · DIF 19`, which this list already sets.
          */}
          T{environment.tier} · {environment.type.toUpperCase()} · DIF{' '}
          {environment.difficulty > 0 ? environment.difficulty : 'SPECIAL'}
        </span>
      </button>
    </li>
  );
}
