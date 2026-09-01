# Duality Companion

**Daggerheart Compatible.** A digital character sheet and GM toolkit.
Local-first, offline, no account, no server, no telemetry.

The whole SRD is already inside it — **210 domain cards, 264 adversaries, 47
environments, 13 classes** and every table — so nothing has to be downloaded,
unlocked or imported before the app is usable. The book it publishes is
**SRD 2.0**; the edition before it is still parsed and still checked, because
that is the only thing that can prove the pipeline did not quietly change its
mind about the older one.

The first screen asks **who is at the table**: two questions for a player,
three for a GM, and for somebody whose character already exists on another
device, a door to bring it over rather than a question. It is skippable at
every step, and a skip lands on the same summary card as answering, carrying
the shipped defaults. Before that, the app opened on the character wizard's
class step — the same list whether you were making a character, running the
game, or arriving with a finished sheet in your pocket.

---

## Contents

**The app**
&nbsp;&nbsp;[What it does, and what it deliberately doesn't](#what-it-does-and-what-it-deliberately-doesnt) · [The five screens](#the-five-screens-and-what-is-on-each) · [What the app ships](#what-the-app-ships) · [Moving a character between devices](#getting-a-character-onto-another-device) · [Why a character cannot be lost](#your-character-is-the-thing-that-must-not-be-lost)

**The book, and building from it**
&nbsp;&nbsp;[One parser, at build time](#one-parser-and-it-runs-at-build-time) · [Getting started](#getting-started) · [Rebuilding the dataset](#rebuilding-the-dataset) · [Layout of the repo](#layout-of-the-repo)

**When something goes wrong**
&nbsp;&nbsp;[Runbook: a blank rectangle](#runbook-the-app-opens-to-a-blank-rectangle)

**Language and legal**
&nbsp;&nbsp;[Language](#language) · [Legal](#legal)

---

# The app

*What it does at a table, and what it refuses to do.*

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
- the text of all 210 domain cards
- adversary and environment features
- countdowns: it displays and advances them by hand, it never infers a tick
- conditions
- anything your table does differently

That is not laziness. Modelling 210 cards and their exceptions is a bigger
project than everything else combined, and every table with a house rule would
end up fighting the app instead of using it.

Where the app can work a number out, it **proposes** it and never applies it
silently: a successful attack roll offers the damage roll that follows, rather
than rolling one for you, and the total is read aloud rather than written onto
anybody's sheet. The same is promised for features with a *declared* numeric
effect — *"Tusks: +1d6 damage"* — and that half is not built: `rollDamage` takes
a flat modifier and has no notion of an added die. `BACKLOG.md` P1-1 says so
under what it leaves out.

## The five screens, and what is on each

A guide to what is actually built. Anything this section claims is in the app
today; where a thing is half-built or deliberately absent it says so here
rather than in a footnote, because a feature list that quietly omits its own
limits is how a README starts lying.

### Play — the sheet

The character, in one column that scrolls. HP, Stress and the damage
thresholds are at the top with the counters that mark them; below them sit
Evasion, Proficiency, the six traits, Experiences, weapons and armour, gold,
and the loadout.

- **The Duality Roll**: outcome, Hope and Fear, and the critical on matching
  dice.
- **Held dice**: a dozen features grant a die — a Rally Die, a Prayer Die, a
  Slayer Die, the d6 an ally hands you for Help an Ally — in sizes and numbers
  that depend on subclass, level and what happened this scene. The app holds
  the ones you have rather than asking you to remember them.
- **Damage**, offered rather than applied. A successful attack roll proposes
  the damage roll that follows; the total is read out, not written onto
  anybody's sheet.
- **Incoming damage** → HP marked, including the step an Armour Slot saves.
- **Conditions**, with the SRD's own text.
- **Death moves**, when it comes to that.
- **Rest and downtime**: short rest, long rest, and the downtime moves, with
  the arithmetic the SRD leaves to the table — `1d4 + Tier` across three
  tracks, twice, plus the GM's Fear — proposed and then applied on your word.
- **Beastform** and an **animal companion**, where the class has them.

### Cards — the 210 domain cards

Every domain card in the SRD, filterable and searchable, with the filter bar
inside the grid's scroll rather than fixed above it. The loadout is five, and
swapping a card in charges the **Recall Cost** in Stress; the Vault holds the
rest.

### Build — making a character, and levelling one

A step-by-step wizard for a new character, and free editing afterwards. Level
up offers **only the advancements the tier actually has**, and tracks how many
slots each one has left. Gear is picked from the shipped lists.

### GM — the evening

The session list *is* the screen: rows open where they sit, and can be
reordered by thumb or by keyboard (`ArrowUp` / `ArrowDown` / `Home` / `End`). Three verbs sit on the bar.

- **ADD** writes a row — a *scene* with its environment, an *encounter* with a
  roster you can put on the board when you reach it, a *link* to something
  already in the app, a *web link*, a *countdown*, or a *note*.
- **SHOW** opens the three tools no row opens: the **bestiary** (read-only),
  the **party board**, and the **merchant**. Each of the three can be switched
  off in Settings, and SHOW leaves the bar when all three are off.
- **SAVE** is not what saves. The campaign is already written 400 ms after the
  last change; the sheet flushes and then tells you *when* the last write
  actually reached the disk.

From **MENU**: your campaigns, the encounter builder, the live scene, the
countdowns, a **name generator** (15,325 names, places and regions written for
this project — the Core Book's lists are not in this app), and the reference.

- **The reference**: eight topics — improvising an adversary, setting a
  Difficulty, Fear, advancing a countdown, range and distance, GM moves and
  principles, adversary Experiences, and gold/equipment/loot — plus a
  **full-text search across all 74 SRD sections**. Every word is read out of
  the shipped dataset at render time, with the page number stamped beside the
  table it came from.
- **The encounter builder**: battle points at `(3 × PCs) + 2`, every cost and
  every adjustment.
- **The Fear pool** and a **primary countdown**, both pinned to the top bar.
- **The party board** reads the players' sheets, including by **QR camera**.

### Settings

Export and import, printing, and the switches for the GM tools and the GM
section as a whole.

## What the app ships

Sixteen collections, and the app reads every one of them. The counts are the
shipped file's own, not a promise about it:

| | | | |
|---|---|---|---|
| domains 10 | domain cards 210 | classes 13 | subclasses 26 |
| ancestries 24 | communities 15 | beastforms 22 | transformations 6 |
| martial stances 16 | weapons 391 | armors 85 | loot 120 |
| consumables 120 | adversaries 264 | environments 47 | rules 82 |

Two of those are **shown and never applied**, and it is a decision rather than
an omission. A transformation and a martial stance both grant effects the sheet
would have to be *in* to be entitled to — and the book ties those states to the
scene, to Severe damage, to the last Hit Point. Deciding when a character drops
out of one would be the app interpreting the rules, which is the line the
section above draws. So the records are carried, searchable and drawn in full,
and they move no number. The engine is measured to prove it.

## Getting a character onto another device

Three ways, and none of them needs a server or an account.

| | |
|---|---|
| **Files** | `.dhchar` one character · `.dhbackup` everything · `.dhcampaign` one campaign |
| **Animated QR** | one phone paints a loop of QR codes, the other watches. No handshake, no pairing, no channel — the phone holding the camera never has to talk back, which is what makes it work between two devices that have never met |
| **Print** | the character sheet onto paper |

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

# The book, and building from it

*One parser, one committed dataset, and nothing parsed in a browser.*

## One parser, and it runs at build time

The most important structural decision in the project, and the reason the app
no longer has a second one.

```
BUILD TIME (your machine, CI)         RUNTIME (the user's browser)
─────────────────────────────         ────────────────────────────
tools/build-srd.ts                    nothing parses anything
     ↓
SRD 2.0 (224 pp, 2.3 MB)              ← the book the app publishes
SRD 1.0  (68 pp, 0.9 MB)              ← kept, and still checked
     ↓
data/srd-2.0.json, committed
data/srd-1.0.json, committed
     ↓
precached by the service worker
```

If the build parser is wrong, CI says so. If a runtime parser were wrong,
a player would find out at a table, mid-session, on a device you cannot
reproduce. That asymmetry justified the whole separation while there were two
parsers, and in the end it is what removed the second. `src/import/` used to
put the 397-page Core Rulebook through pdf.js in a Web Worker, on the user's
own desktop, and lay its illustrations and flavour over the SRD as an optional
layer in IndexedDB. It has been deleted: domain cards are text-only, and the
browser parses nothing.

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

## Getting started

**Node 24**, which is what `.nvmrc` says and what CI and the deploy both read
out of it. `nvm use` picks it up. Newer majors will very likely work — nothing
here is close to the edge of the runtime — but 24 is the only one anything
verifies, so it is the one number in this repo worth matching.

```sh
npm install
npm run dev
```

The committed dataset (`data/srd-2.0.json`) is all the app needs at runtime.

### Rebuilding the dataset

Only needed when the SRD is revised.

```sh
brew install poppler          # or: apt-get install poppler-utils
# put DH_SRD_2_2026_08_25.pdf in Manuali/  (it is not committed)
npm run build:srd
```

The build refuses to emit a dataset that fails validation: wrong counts, a
surviving Private Use Area glyph, a broken ligature, a dangling reference, a
duplicate id. `npm run build:srd -- --check` validates and writes nothing, and
fails if `data/srd-2.0.json` no longer matches the source. Pointing it at the
older book with `--check --pdf <SRD 1.0>` does the same for `data/srd-1.0.json`,
which is committed for exactly that reason: it is the only thing that can say
the parser still reads the edition it used to.

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

## Layout of the repo

```
tools/          runs in Node, never shipped to the browser
data/           the only committed content: srd-1.0.json, registry.json
shared/         used by both tools/ and src/: textLayout, slugify, parsers
src/engine/     pure rules arithmetic. No UI, no I/O, fully tested
src/store/      IndexedDB, the dataset, preferences, backup
src/transfer/   the .dhchar file, the binary codec, animated QR
src/pwa/        service worker registration, the update prompt, the wake lock
src/ui/         shell, player, build, gm, settings, print, and what they share
```

`.gitignore`, first line: `*.pdf`.

---

# When something goes wrong

*The failure no error boundary can report.*

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
   icons. And it is not immediate: the worker
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

# Language and legal

*Whose words these are.*

## Language

English throughout — interface, data, errors, filenames, code, commits. The
game's terms are *mechanical*, not descriptive: when a card says "mark a
Stress", a translated label beside it adds a beat of mental translation every
time your eye passes over it, which is exactly what a sheet you read mid-scene
cannot afford. `Architecture.md` is in Italian because it is the author's
working document.

## Legal

> This product includes materials from the Daggerheart System Reference
> Document 1.0, © Critical Role, LLC, under the terms of the Darrington Press
> Community Gaming License. More information at www.daggerheart.com.
>
> Daggerheart Compatible. Independent community content, not affiliated with
> or endorsed by Critical Role, LLC or Darrington Press.

The SRD 1.0 is Public Game Content under the DPCGL and is redistributable with
attribution — which is why `data/srd-1.0.json` is committed. The full Core
Rulebook is not, and this app has no way to take one in: the importer that read
a copy off the owner's own machine, and the art packs it made, were removed.

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

### The reading this project runs on, and the objection to it

Written down because a licensing position nobody has stated is
indistinguishable from one nobody has examined. This is the examination, not
legal advice, and nobody here is a lawyer. The licence text quoted here is the
copy this app ships, `src/legal/dpcgl-2026-08-26.txt`, which Settings › About
prints in full beside the URL it came from and its SHA-256.

**The reading this project runs on.** §2.1(a) grants the right to *"reproduce
and Share the Public Game Content in whole or in part"* and attaches no format
limit of any kind. The format limit in the licence lives in §2.1(b), and it is
attached to Adaptive Content, not to this clause. On that reading, an app that
reproduces SRD text and hands it back to a player is inside the grant.

**The objection to it, which is not a weak one.** About half of what this app
does is Adaptive Content as §1.7 defines it, and §1.7's own verbs are the ones
that fit. It covers content in which the Public Game Content is *"translated,
altered, rearranged, transformed, or otherwise modified"*.

- `data/srd-1.0.json` is the book **rearranged**. `tools/build-srd.ts` pulls
  the text out of the PDF with poppler and restructures it into typed
  records — which is the entire reason that file is generated and not written
  by hand.
- `deriveStats` **transforms**. It reads the SRD's own numbers and returns
  Proficiency, damage thresholds and Evasion for one particular character —
  figures the book prints for nobody.

Neither of those is reproduction, and §2.1(b) permits Adaptive Content *"solely
in the Permitted Formats"*. §1.9 enumerates what those are: print and digital
print *"in the form of supplements, manuals, books, stories, novels, and
cards"*; live-streaming and video; podcasts; and virtual tabletops expressly
approved by DRP and listed in §1.9.1. **A web app is not one of the four.** It
is not print, it is not a broadcast, and it is not on the VTT whitelist.

Stating the objection honestly means saying which half of it carries the
weight. §1.9 closes by excluding *"film, television, video games, and any other
audiovisual medium not expressly permitted"*, and that closing clause is the
weaker half: its enumerated exclusions are all audiovisual media, and a
character sheet that adds up Armor Slots is a strained fit for the phrase. The
objection does not need it. It stands on the enumeration — the list *is* what a
Permitted Format is, and this is not on the list.

**What the exposure actually attaches to.** §1.8 puts *"private, non-commercial
play among friends, family, or gaming groups in a personal setting"* outside
Sharing altogether. Running this app on your own phone for your own table is
not Sharing and does not engage §2.1(b) at all. What creates the exposure is
publishing the build to a public URL — which is what `deploy.yml` does on every
push to `main` — and not anybody using it.

**The remedy the licence names, scoped accurately.** §1.9.1 says *"Sharing on
any other VTT is prohibited unless separately approved in writing by DRP"*, and
reserves DRP's right to add and remove platforms at any time. That sentence is
about VTT platforms specifically; it is not a general waiver of the format
limit. So the route it actually describes for something shaped like this app is
to be approved onto that list, not to be granted a blanket exception. §1.9.1
also requires whitelisted-VTT sharing to be non-commercial and unmonetized,
which this project already is: nothing is sold, there is no subscription, no
paywall and no donation tied to access.

**The one output of this app that is unambiguously a Permitted Format is the
paper.** §1.9(a) covers digital print *"in the form of supplements, manuals,
books, stories, novels, and cards"*, and the printed character sheet is exactly
that — which is why `CharacterSheet.tsx` carries `ATTRIBUTION` of its own
rather than inheriting the shell's footer. The contested surface is the
interactive app, not what it prints.

**One obligation this app does not currently meet, and it is the one the
objection makes pointed.** §4.1 lists five things that must accompany Shared
content. Four are here: the copyright notice and the attribution statement are
in `ATTRIBUTION` (`CompatibleMark.tsx`), which is rendered at the foot of every
screen by `LicenceFooter`, in Settings › About, on the empty-library screen,
and on the printed sheet; the URL is in that same paragraph; and the licence
itself ships in full rather than as a link. The fifth, §4.1(e) — *"a statement
indicating whether you have modified the Public Game Content and whether there
were any previous modifications by you or others"* — **is not written anywhere
in the app.** The two paragraphs of
`ATTRIBUTION` do not say it, and no other surface does. That is awkward
precisely because the paragraphs above argue at length that this app *does*
modify: the licence asks for that admission at the point of Sharing, and the
app does not make it. Filed rather than fixed in passing, because `ATTRIBUTION`
is a licence-critical constant pinned by `tests/ui/attribution.test.tsx` and its
wording is the owner's call, not a drive-by edit.

**The position.** The risk is accepted knowingly, with the objection above read
and not dismissed. What sits on the other side of the ledger are mitigations,
and they are named as mitigations rather than as an answer: the app is free and
unmonetized; it ships SRD content only and never the Core Rulebook, and has no
way to take one in; it carries the attribution on every screen; it keeps the
Name Marks out of its own title and off its home-screen icon; and it holds no
Prohibited Content. If DRP reads §2.1(b) the way this section concedes they
might, there are two answers and both stay available: ask for written approval,
or stop publishing. The second costs almost nothing, because nothing about the
app depends on being hosted — deleting `deploy.yml` and turning Pages off
leaves a thing that still runs on the devices it is already on.
