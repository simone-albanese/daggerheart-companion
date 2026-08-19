# Daggerheart Companion

A digital character sheet and GM toolkit for **Daggerheart**. Local-first,
offline, no account, no server, no telemetry.

The app ships with the whole SRD already in it — 189 domain cards, 129
adversaries, 19 environments, nine classes and every table — so nothing has to
be loaded before it is usable. The first screen asks **who is at the table**:
two questions for a player, three for a GM, and for somebody whose character
already exists on another device, a door to bring it over rather than a
question. It is skippable at every step, and a skip lands on the same summary
card as answering, carrying the shipped defaults. Before that the app opened on
the character wizard's class step — the same nine cards whether you were making
a character, running the game, or arriving with a finished sheet in your pocket.

---

## What it does, and what it deliberately doesn't

The reason digital character sheets for tabletop RPGs become unusable is that
they try to *execute* the rules. Here the boundary is stated out loud.

**It calculates** — the arithmetic that has exactly one right answer:

- damage thresholds (armour base + level), and incoming damage → HP marked,
  including the step an Armour Slot saves
- Proficiency by level, and the damage roll it multiplies
- the Duality Roll: outcome, Hope and Fear, criticals on matching dice
- loadout of five, and the Recall Cost a swap charges in Stress
- gold, with the carry at ten handfuls and ten bags
- the GM's battle points, `(3 × PCs) + 2`, and every adjustment
- which advancements a tier actually offers, and how many slots each has left

**It doesn't calculate** — it shows the text and you apply it:

- class, subclass, ancestry and community features
- the text of all 189 domain cards
- adversary and environment features
- countdowns: it displays and advances them by hand, it never infers a tick
- conditions
- anything your table does differently

That is not laziness. Modelling 189 cards and their exceptions is a bigger
project than everything else combined, and every table with a house rule would
end up fighting the app instead of using it.

Where the app can work a number out, it **proposes** it and never applies it
silently: a successful attack roll offers the damage roll that follows, rather
than rolling one for you, and the total is read aloud rather than written onto
anybody's sheet. The same is promised for features with a *declared* numeric
effect — *"Tusks: +1d6 damage"* — and that half is not built: `rollDamage` takes
a flat modifier and has no notion of an added die. `BACKLOG.md` P1-1 says so
under what it leaves out.

---

## Getting started

**Node 24**, which is what `.nvmrc` says and what CI and the deploy both read
out of it. `nvm use` picks it up. Newer majors will very likely work — nothing
here is close to the edge of the runtime — but 24 is the only one anything
verifies, so it is the one number in this repo worth matching.

```sh
npm install
npm run dev
```

The committed dataset (`data/srd-1.0.json`) is all the app needs at runtime.

### Rebuilding the dataset

Only needed when the SRD is revised.

```sh
brew install poppler          # or: apt-get install poppler-utils
# put Daggerheart-SRD-9-09-25.pdf in Manuali/  (it is not committed)
npm run build:srd
```

The build refuses to emit a dataset that fails validation: wrong counts, a
surviving Private Use Area glyph, a broken ligature, a dangling reference, a
duplicate id. `npm run build:srd -- --check` validates and writes nothing, and
fails if `data/srd-1.0.json` no longer matches the source.

CI reaches the same verdict by a different route: it rebuilds and then runs
`git diff --exit-code -- data/`, which also catches a dataset that was edited
by hand. Either way it only runs on a runner that has been given the PDF, and a
stock one has not — the rest of CI builds against the committed JSON.

### Toolchain note

The repo carries no Node of its own. If you already manage Node per project —
nvm, fnm, asdf, mise, Volta — they all read `.nvmrc` and there is nothing here
for you to do.

If you do not, and you would rather not move a system Node that other projects
on the machine are relying on, unpack a release of that major into
`.tools/node`; `. ./env.sh` puts it first on PATH for that shell. Either way,
`env.sh` warns when the Node you end up with is a different major from the one
CI runs, so the mismatch surfaces on the machine that has it.

---

## Two parsers, two risk profiles

The most important structural decision in the project.

```
BUILD TIME (your machine, CI)         RUNTIME (the user's browser)
─────────────────────────────         ────────────────────────────
tools/build-srd.ts                    src/import/
     ↓                                     ↓
SRD 1.0 (68 pp, 0.9 MB)               Core Rulebook (397 pp, 318 MB)
     ↓                                     ↓
data/srd-1.0.json, committed          an optional layer in IndexedDB
     ↓                                     ↓
precached by the service worker       art, flavour, campaign frames
```

If the build parser is wrong, CI says so. If the runtime parser were wrong,
a player would find out at a table, mid-session, on a device you cannot
reproduce. That asymmetry justifies the whole separation.

Three things the SRD does that break a naive parser, all handled and all
regression-tested:

1. **It is imposed as spreads.** Every page after the cover is 1224×792pt —
   two letter pages side by side. Nothing in the file says so.
2. **Each book page is set in two columns**, and the column structure changes
   *within* a page: two columns of prose above a full-width table, a
   four-column contents list above two-column stat blocks. A recursive XY-cut
   handles it; a single projection onto either axis does not.
3. **Tier numbers are not digits.** They are decorative glyphs in the Unicode
   Private Use Area. A parser that ignores them produces a dataset that looks
   correct and is quietly wrong. They are remapped, cross-checked against the
   section headings and the prose, and an *unknown* PUA glyph fails the build.

A fourth, found while building: poppler splits a word wherever a ligature glyph
sits, so `Difficulty` arrives as `Diffi` + `culty:`. The repair is geometric,
not a word list — a spurious split has no advance at all, a real space has
about a quarter of the glyph height.

---

## Layout of the repo

```
tools/          runs in Node, never shipped to the browser
data/           the only committed content: srd-1.0.json, registry.json
shared/         used by both tools/ and src/: textLayout, slugify, parsers
src/engine/     pure rules arithmetic. No UI, no I/O, fully tested
src/store/      IndexedDB, the layered dataset, preferences, backup
src/transfer/   the .dhchar file, the binary codec, animated QR
src/import/     the optional Core Rulebook importer (desktop only)
src/pwa/        service worker registration, the update prompt, the wake lock
src/ui/         shell, player, build, gm, settings, print, and what they share
```

`.gitignore`, first line: `*.pdf`.

---

## Your character is the thing that must not be lost

Safari's ITP can evict IndexedDB after roughly seven days of inactivity, and
`navigator.storage.persist()` is granted inconsistently. A group that plays
every three weeks would lose a character between sessions.

So: persistence is requested at the right moment and with an explanation; the
indicator says how long it has been since the last export, and gets loud at
five days; and every launch checks that what the last session left behind is
still there. When it is not, the app names the missing characters rather than
counting them, and points at the screen that can restore them. Past seven idle
days it also names the browser as the likely cause — and only then, because
that is when there is evidence for it rather than a guess.

**The automatic export has a precondition, and the app does not pretend
otherwise.** Choose a folder once in Settings and a copy is written into it
when you put the app down and when the page goes away. Until you do, nothing is
exported automatically, and Settings says exactly that instead of implying a
copy exists. Choosing a folder needs `showDirectoryPicker`; where the browser
does not have it, the app says so and the export stays a button you press.

A character is months of someone's work; losing it is the one unforgivable bug
in an app like this.

---

## Runbook: the app opens to a blank rectangle

The failure this section exists for is a deploy whose bundle does not evaluate:
a hashed chunk that 404s, a syntax the engine will not parse, a throw at module
scope. It lands on every installed device at once, and no error boundary can
report it, because a boundary is itself part of the module graph that never
ran.

**The two things not to do, and they are the two every support page suggests:
do not clear site data, and do not delete and reinstall the app.** Both erase
IndexedDB, which is where the only copy of every character lives. A broken
build is a bad evening; either of those is a lost character.

### What is already on screen

`index.html` carries a static block inside `<div id="root">` that React wipes
out the moment it mounts. Three seconds after the document parses, if React has
not mounted, an inline script reveals it: what the app is, that the characters
are untouched in this browser's storage, what to do, and — in as many words —
not to clear site data.

Ten seconds in, a second inline script opens IndexedDB with no help from the
bundle, reads the `characters` store, and offers the whole library both as a
`.dhbackup` file and as selectable text, because an installed iOS app can
swallow a download silently. It is ES5 on purpose: one of the ways a bundle
fails to evaluate is an engine too old to parse it, and a hatch written in the
syntax that broke the app rescues nobody. It reveals itself only when it finds
characters, so a first visit over a bad connection never sees it, and it opens
the database without a version so that it keeps working when `DB_VERSION`
moves. Neither timer does anything on a healthy launch: React clears `#root`,
the marker element stops existing, and no database is ever opened.

`tests/pwa/bootFallback.test.ts` runs that script for real against a database
the app's own `db.ts` wrote, and fails if the hardcoded names drift.

### Getting the fleet back

1. **Publish a fixed build.** Usually this is the whole runbook, and it needs
   nothing from the user. The worker serves the document
   stale-while-revalidate: the next launch with a connection serves the cached,
   broken document, fetches the new one in the background, precaches its assets
   and only then adopts it — so the launch *after* that is the fixed app. Two
   launches, online.

2. **If clients are still stuck, bump `VERSION` in `public/sw.js`.** This is
   the un-ship lever, and until now it existed only as a sentence in a comment
   inside that file. `const VERSION = 'v1'` names both caches —
   `dhc-shell-<VERSION>` and `dhc-assets-<VERSION>` — so renaming it makes
   every `dhc-` cache on the device stale to `takeOver()`, which deletes them
   on activation; `ensurePrecached()` then rebuilds from the network.

   The price, in full, because it is not small. Every installed client
   re-downloads the entire app: document, bundle, the SRD chunk, the fonts, the
   icons. Every client that ever ran the Core Rulebook importer re-downloads
   its pdf.js worker as well, 1.6 MB of it. And it is not immediate: the worker
   deliberately does not call `skipWaiting()`, so the replacement sits in
   `waiting` until the user accepts the update prompt or closes every tab of
   the app. That is the right trade for a table mid-session and the wrong one
   for a panic, so bump `VERSION` for caches holding a state a redeploy cannot
   correct — not as a faster version of step 1.

   `BUILD`, next to it, is a different thing and is not yours to edit: the
   Pages workflow stamps it with the commit at deploy time, which is the only
   reason an ordinary deploy installs a new worker at all. Both `ci.yml` and
   `deploy.yml` fail if the `__BUILD__` placeholder is missing from the
   committed file.

3. **Tell people to open the app again with a connection, and nothing else.**
   The character is in IndexedDB, intact and unreachable; every launch is
   another chance for the worker to pick up the fix, and every "start clean" is
   final.

---

## Language

English throughout — interface, data, errors, filenames, code, commits. The
game's terms are *mechanical*, not descriptive: when a card says "mark a
Stress", a translated label beside it adds a beat of mental translation every
time your eye passes over it, which is exactly what a sheet you read mid-scene
cannot afford. `Architecture.md` is in Italian because it is the author's
working document.

---

## Legal

> This product includes materials from the Daggerheart System Reference
> Document 1.0, © Critical Role, LLC, under the terms of the Darrington Press
> Community Gaming License. More information at www.daggerheart.com.
>
> Daggerheart Compatible. Independent community content, not affiliated with
> or endorsed by Critical Role, LLC or Darrington Press.

The SRD 1.0 is Public Game Content under the DPCGL and is redistributable with
attribution — which is why `data/srd-1.0.json` is committed. The full Core
Rulebook is not: it stays on the owner's device, and an art pack made from it
is personal, for their own devices, not for sharing.

The one piece of official artwork here is Darrington Press's "Daggerheart
Compatible" mark, in `public/brand/`, supplied with the DPCGL for exactly this
use. The full lockup sits under the attribution on the empty-library screen and
nowhere else — `<Attribution>` is the only thing that mounts `CompatibleLockup`,
and `EmptyState` in `App.tsx` holds the one `<Attribution>` in `src/`. The
dagger-and-flame icon alone is what appears everywhere else: `CompatibleIcon
size={18}` in the header on every screen (inside `Header`, in `Header.tsx`), and
`size={14}` at the foot of every screen's own scroll, beside the attribution
text, inside `LicenceFooter`. Named by symbol rather than by line: the three
line numbers that stood here were correct when written and were pushed off their
targets by later edits to those same three files.
*(This paragraph used to say the lockup was at the foot of every scroll too —
**superseded**: `LicenceFooter` has never rendered it, and the distinction is
worth keeping because a 220px lockup below every page is a different licensing
posture from a 14px mark.)* It is
deliberately never the app's own icon, because a home-screen icon that is the
official logo reads as an official app, which this is not. The licence text in
Settings › About carries the attribution as words, without the mark. No
rulebook PDF and no rulebook artwork is in this repository.

Fonts: Archivo and IBM Plex Mono, both SIL Open Font License 1.1, self-hosted
so the app works with the radio off (`public/fonts/`).

Code: MIT.
