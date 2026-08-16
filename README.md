# Daggerheart Companion

A digital character sheet and GM toolkit for **Daggerheart**. Local-first,
offline, no account, no server, no telemetry.

The app ships with the whole SRD already in it — 189 domain cards, 129
adversaries, 19 environments, nine classes and every table — so the first
screen is *create a character*, not *load a PDF*.

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

Where a feature has a *declared* numeric effect, the app offers a button that
**proposes** it — never one that applies it silently.

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

The repo carries no Node of its own. If your system Node is broken, drop a
release tarball into `.tools/node` and `. ./env.sh` will pick it up — the
project never asks you to repair anything outside it.

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
use. It appears where a reader is asking what this app's relationship to the
game is — the About panel and the first-run screen — and deliberately never as
the app's own icon, because a home-screen icon that is the official logo reads
as an official app, which this is not. No rulebook PDF and no rulebook artwork
is in this repository.

Fonts: Archivo and IBM Plex Mono, both SIL Open Font License 1.1, self-hosted
so the app works with the radio off (`public/fonts/`).

Code: MIT.
