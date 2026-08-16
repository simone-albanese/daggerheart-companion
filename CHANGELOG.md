# Changelog

Grouped by what someone using the app would notice, which is not the same
shape as the commit history. Every entry is drawn from a commit in this
repository; where a number appears — a measurement, a pixel count, a
percentage — it is the number that commit recorded, not an estimate made here.

The version in `package.json` is stamped into every exported `.dhchar` and
`.dhbackup`, so it is also what a bug report will quote back. `deploy.yml`
publishes `main` to GitHub Pages on every push; there are no tagged releases
before the one below.

---

## Unreleased

### The GM screen is the night, not five menus

- **The session list is the GM screen.** It used to be a strip of five tabs —
  encounter, scene, party, bestiary, countdowns — and every one of them worked.
  What none of them was is the *evening*: a GM runs scene one, then an
  encounter, then scene two, in an order they decided beforehand and change on
  the fly, and the app made them navigate a menu to reach each one. The campaign
  record has carried that list since campaigns were built, and nothing had ever
  drawn it. Now the list is the screen, each row opens where it sits, and the
  five tools open *over* it and close again.
- **A row this version cannot read is still a row.** The store already refused
  to drop an item written by a newer build, and a link pointing at something
  this dataset does not carry; until now nothing could draw either, which made
  that refusal worth nothing. Both are drawn: the unreadable row shows why and
  the bytes exactly as they were stored, and an unresolved link says which kind
  of thing is missing and prints the ref.
- **A tool that is closed is gone, not hidden.** The party board opens the
  camera to scan a player's character; a panel kept alive behind the screen
  would leave it running.
- **Arriving at the GM screen opens nothing.** The record remembers which tool
  was last open, which is worth keeping and is not an instruction — reading it
  as one would have put the encounter builder over the plan every single time.
- **Rows move.** A handle at the right edge of every row: hold it for a quarter
  of a second and drag, and the row goes where you put it. The list under the
  same thumb still scrolls, because only the handle itself is taken away from
  scrolling. If the phone interrupts the gesture — a call, the notification
  shade — the row is put down where it got to and says so, rather than staying
  stuck to your finger.
- **And they move without dragging.** The arrow keys move the row whose handle
  is focused, Home and End send it to either end, and an open row carries MOVE
  UP and MOVE DOWN as ordinary buttons. A quarter-second hold followed by
  accurate travel is not a gesture everybody can perform, and this is the same
  feature rather than a lesser one.

**Not there yet, and named here rather than left to be discovered:** nothing in
this build adds a new scene, encounter or link row — the list reads, draws,
reorders and deletes them, and the ADD button that mints one comes with the
bottom bar. Countdowns are the exception; they start where they always did.

---

## 0.2.0 — 2026-08-16

The first version this project chose. `0.1.0` was the scaffold default and
described nothing; everything listed here happened under it, unreleased.

The one thing that categorically changed in this stretch: the app no longer has
a known way to lose a character. That is the whole of the version bump. It is
not a claim that the numbers on the sheet are all correct yet — see *Known to
be wrong* at the foot of this entry.

### Your character stays where you put it

- **The automatic backup runs.** It had been written, documented and tested,
  and never called from anywhere in `src` — the bundler removed the entire
  regime, while the settings screen told anyone who had chosen a folder that a
  copy was written at the end of every session. It now hooks
  `visibilitychange` and `pagehide`, verifies the file by reading it back and
  counting the characters in it, and reports a failure rather than a success it
  cannot prove.
- **The "last backup" clock stopped erasing itself.** Every tab tap wrote the
  whole preferences key back from a copy taken at launch, so the stamp from a
  backup that really did run was destroyed seconds later and the indicator read
  "never" forever. On a phone that also meant the nag could never appear at
  all, at any age.
- **Importing a file no longer writes over a newer character.** It used to be a
  single `put` keyed on `id`: restoring an August backup silently replaced the
  September sheet, with no prompt and no undo. Now nothing is written until you
  answer — keep mine, take theirs, or keep both — and *keep both* mints a new
  name as well as a new id, because two characters with the same name are
  indistinguishable in the picker at exactly the moment you need to tell them
  apart.
- **A write that fails says so, on screen, and cannot be dismissed.** Before,
  it went into a promise nobody was holding while the sheet went on showing
  every mark and every level-up as applied. Hours later the tab closes.
- **A pending write can no longer bring back a character you deleted**, and a
  deliberate refusal no longer emits a second, invisible failure behind the
  first.
- **One damaged record no longer takes the whole library with it.** The sort
  threw on a record with no timestamp, and whether it threw at all depended on
  where the database happened to put it — so this failed intermittently, and
  presented as a banner saying everything was probably fine. Records are now
  read through the same hardened reader the file path uses: what can be
  repaired is repaired, and what cannot is quarantined **by name**, because
  "some characters could not be read" is the sentence that makes a person open
  every sheet looking for the missing one.
- **Persistent storage is asked for on every path that fills an empty
  library**, not only on create — the import path, where the user has the most
  at stake, was never asking.
- **A file from an older schema is converted when you open it**, instead of
  refused with a sentence that was true about the file and false about the
  person holding it. You are told which schema it came from and what changed.
  A record from a *newer* build is left alone and kept off the screen rather
  than quietly downgraded and written back — two builds coexist on one device
  by design here, so that was reachable by taking an update in another tab.
- **After a week away, the app checks that last session's characters are still
  there** and names any that are not, with a route to the screen that can
  restore them. It blames the browser only when there is evidence — a gap long
  enough for the browser's own eviction window — rather than every time
  anything is missing.

### Sending a character to another device

- **Every payload carries its own checksum, and the format is 2.** Measured
  before the fix: 8136 single-bit flips across 15 real sheets produced 2512
  payloads — 30.9% — that decoded into a *different* character without
  complaining. A different card, a different scar, in eight cases a different
  level. Now zero. Format 1 is still read, because the device that has not
  updated is the sending one.
- Verifying a received payload is no longer something a receive surface can
  forget to switch on.

### Numbers on the sheet

- **An attack roll leads into a damage roll.** The engine could roll damage
  correctly from the first commit and no screen had ever called it. Damage is
  offered when the roll succeeds, never on a reaction roll, and never guessed
  when the GM has kept the Difficulty to themselves.
- **Proficiency and Multiclass cost both of their tier's slots.** They are
  printed in a joined black box and the rule says to mark both; the app let you
  take Proficiency twice in one tier, reaching 8 at level 10 where the sheet
  allows 6 — two extra damage dice on every weapon roll, with nothing on screen
  suggesting anything was wrong.
- A level-up screen no longer announces "4 of 2 slots marked" to a screen
  reader.
- **School of Knowledge starts with three domain cards, not two.** The count
  was hardcoded in seven places, one of them a label reading "TWO ALREADY"
  beside a character holding three.
- **Character creation gives you both Experiences**, which it had been
  discarding whenever they were left unnamed — two lines after the review
  screen promised they were worth +2 named or not. Adding one later starts at
  +2, the value the rules grant, rather than +1.

### On a phone

- **The Play screen scrolls, and your weapons, armour and items are on it.**
  Equipped gear had only ever rendered inside the desktop layout. With every
  band pinned, the loadout absorbed every shortfall: measured at 130px of the
  230 it needs on a 393px phone, and at zero on a 375px one, where five cards
  rendered into a box with no height and ROLL sat 14px under the tab bar.
- Armor, HP, Stress and Hope stay on screen, ordered by how often the game
  makes you touch them. Pips size themselves to the pointer and wrap onto a
  second line instead of shrinking — at armour score 6 they had been 18px wide,
  and a third of the armour in the SRD scores 6 or more.
- **The four navigation icons are visible.** They had never been painted, in
  any build: a shorthand and a longhand in the same style object cancelled the
  colour out, so all four computed to fully transparent and nothing threw.
- Marked HP and Stress pips are filled in again.
- **Experiences show their whole name.** They are what the player wrote, so a
  truncated chip has thrown away the entire content of the thing.
- The character's name, class and level are in the top bar.
- **iOS stopped zooming the page** when you focus the damage box — done with a
  16px floor on the controls rather than by taking pinch-zoom away from
  everyone.
- **A press-and-hold in a track's header no longer zeroes the track.** A slow
  press on "SEVERE · 3 HP" left HP marked at 3 instead of 8: a number that
  reads like a real total rather than like an obvious loss.
- Six text-on-surface pairs that were below WCAG AA are lifted, including the
  10px label that carries 44 of the 61 small-caps captions in the app.

### Offline

- **The service worker is registered.** It existed, was tested, and no browser
  had ever installed it: nothing precached, no update ever reached a client,
  and the deploy stamped a build into a file nobody fetched. An update is now
  offered rather than swapped in underneath a session.
- The screen stays awake when the preference says so. The only thing reading
  that preference had been the checkbox drawing its own state.

### Settings

- Typing dice values by hand is its own switch, off by default. The old hint
  said the digital-dice switch was what made the faces editable; they were
  always editable, and that switch only greyed out ROLL.

### Under the hood — no user notices these, and they are why the rest is true

- Every screen in the app is mounted by the suite, against a character built
  from the shipped SRD; a React warning during a mount fails the run.
- The suite asks the whole tree what it never calls. Four defects had already
  reached users with that exact shape — the service worker, the wake lock, the
  navigation icons, the discarded Experiences — and each one passed every unit
  test, because every unit worked.
- A schema bump now requires a converter and a committed fixture, enforced
  rather than described, built before the first bump instead of after it.
- Documentation: the README's factual claims are checked against the code, the
  Node version is written down once in `.nvmrc`, and `env.sh` explains why it
  exists today rather than why it existed once.

### Known to be wrong

Kept here because a changelog that lists only the fixes describes a different
app. `BACKLOG.md` is the full account; the headline items still open are that
the app can still show a player a wrong number in places, the tablet layout
still cannot roll, and some failures are still silent.
