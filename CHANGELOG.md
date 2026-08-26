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

Two decisions taken on 23 August, both of them about what this app is allowed to
be rather than about what it does — one taken on 26 August about running two
fights at once, and a repair the same evening to the thing that made all of it
unreachable.

### The row you opened is the row on the table

- **`OPEN THE SCENE` now puts that scene on the table**, where before it opened
  the runner and told the app nothing. A GM who added a scene, opened it, built
  an encounter and sent it "to the scene" ended with adversaries on a board that
  named no row of the plan — and the row they had been looking at the whole time
  still empty. Pressing the verb on one row or on another did the same thing.
  It claims the table only when the table is empty and belongs to nobody;
  where another scene is running it stays the quiet verb it was, and the row
  now says why in the sentence that had been shipping on a row kind nothing can
  create.
- **A fight that belongs to no row can be given one, by name.** Adversaries
  dropped in from the bestiary, or built from the menu, used to belong to
  nothing until they were ended: no chip named them, and the plan could not mark
  them. Any scene row now offers **TAKE THE FIGHT ON THE BOARD**, which moves
  nothing — the marks on the glass are the same marks after the tap.
- **A shut row says when it is the one being played**, reading `ON THE TABLE`
  where it would otherwise count a roster nobody is planning any more. The plan
  never read that pointer at all, so two scene rows with a fight running between
  them read identically.
- **The runner's title row keeps its name when there is no scene to flip
  between.** It was rendering as a bare close button: the strip returned nothing
  and the fallback beneath it could never fire. Measured in Chrome at 393×852,
  coarse: the title row is **45.00px** and the scroller **582.00px** in both
  states, the ✕ 44×44 at the same 386.00, and the strip's 315.00 unchanged —
  **0.00px** either way.
- **THE CAMPAIGN no longer lights up as though it were the scene on the table.**
  The campaign's own countdown group carries no scene id, and the comparison
  that highlights the live one was matching it against nothing.

### Two scenes can be half-fought at the same time

- **A fight you leave is parked in the row it came from, not thrown away.**
  Running another scene puts the table you were on back into its own row of the
  plan — every HP mark, every Stress mark, every spotlight — and puts that row's
  fight on the table instead. Come back and it is exactly as you left it. A
  split party stops costing you one of the two halves.
- **A strip in the scene runner's title row says which scene is on the table,
  and flips to another in one tap.** It costs **0.00px** of vertical space,
  measured in Chrome against a build without it: the title row was already 44px
  tall because of the close button, and the strip drops into the slot the title
  was using. At four scenes every chip is still a 44px target in both axes;
  past four the strip scrolls sideways rather than wrapping, because wrapping
  would move the fight under your thumb.
- **The flip is one tap, with no confirmation**, because it destroys nothing.
  What destroys still asks twice: clearing a parked fight, and deleting a row
  that is holding one — that row's delete button now says **TAP AGAIN TO DELETE
  THE FIGHT**, because those marks exist nowhere else.
- **A row you planned and never fought starts in one tap too.** `START THIS
  FIGHT` puts its roster on the table and opens the runner, so the second fight
  of a split party costs five gestures once instead of five gestures a beat.
- **A shut row says how many are parked in it**, beside how many it plans. The
  row being played says nothing about a fight, because the fight is on the
  table and not in the plan.
- **`END SCENE` now empties the row as well as the table.** Before this it
  cleared only the glass — which was complete when the table was the only place
  a fight could be, and would have meant ending a fight, flipping away and back,
  and finding everyone on their feet.
- **Deleting a row never drops the fight on it.** The plan row goes; what is on
  the table stays there and gets a new row the next time you run a scene. A
  fight started from the bestiary with no row behind it gets one the same way.

### A countdown can belong to one scene

- **A clock scoped to a scene is on the glass while that scene is running**, and
  out of the way while it is not. A GM with a split party stops scrolling the
  whole campaign to find the clock about the room they are in.
- **Nothing about it is hidden anywhere else.** The Fear and countdowns board
  still shows every clock, grouped by whose it is; a long rest still offers
  every long-term clock, each labelled with the scene that owns it — resting is
  the campaign's, not a scene's.
- **A scoped clock is never on the top bar**, and the pin is not offered on it
  rather than offered and refused. The top bar is the campaign's.
- **Nothing ticks on its own.** Not when a scene starts, not when one ends, not
  when you flip. Plus and minus, and nothing else, exactly as before.
- **A clock whose scene you delete becomes the campaign's again**, immediately,
  rather than going quiet until you next run some scene.

### The app is called Duality Companion

- **The Name Mark is out of the title.** DPCGL §2.5(a) — *"Name Marks cannot be
  used in the title of a work or a chapter title"* — is flatter than "not first",
  so `Daggerheart` leaves the title outright. `Duality` is this app's own word
  for the roll the whole sheet is built around, and it is not on the Name Mark
  List, which is three entries long.
- **The home-screen label was the actual violation.** `short_name` was the bare
  word `Daggerheart`; it is now `Duality`. The full name is `Duality Companion`.
- **Both descriptions now open with "Daggerheart Compatible"**, which is what
  §2.5(c) asks for in descriptive text. They carried the bare mark before.
- **Nothing you have saved moves.** The repository, the published URL and the
  IndexedDB name are all untouched, so an installed app keeps working and every
  character stays where it is.

### The Witherwild campaign frame is no longer shipped

- **Eleven sections leave the rules text**, 27,679 characters — 21.7% of the
  corpus. The reference screen and rule search go from 80 sections to **69**, and
  the rules JSON from 137,082 bytes to **107,884** (35,936 gzipped, down from
  46,795). Everything else in the dataset is byte-identical.
- **Nothing else was lost with it.** The Campaign Frames section stays: it
  describes what a campaign frame *is* and never named this one.

### A rule you searched for opens on your line

- **A hit lands on the line the header is quoting**, not on the block around it.
  Of the 769 lines rule search can quote, **613** now have a target inside a
  block; the other 156 are `## ` subheads, and a subhead still opens its own
  block, because a subhead *is* where its block starts.
- **Your words are lit in the section that opens**, not only in the preview
  above it. Before this, a search took you to a subhead that arrived with no word
  on it lit, and the hunt started again by eye.
- **Only the block you landed in is lit.** Lighting every occurrence in a long
  section turns the marking into wallpaper, and a section the SRD draws as one
  block is still lit whole — 34 of the 69 shipped sections are drawn that way.
- **A section a rules layer rewrote still opens.** A target that does not fit
  the text it names — a paragraph index past the end, a bullet that is not a
  bullet — opens the block instead of breaking.

### The GM's screen does the arithmetic the engine already knew

- **Type the damage onto a monster.** The combatant card takes a number, shows
  what it will do before you commit it, and applies it on APPLY or Enter. Minion
  overkill comes out of the same number instead of a second count in your head.
- **Massive Damage reaches adversaries too, if you turned it on.** The optional
  rule is off by default and unchanged there; when it is on, it now applies on
  both sides of the screen rather than to the party alone.
- **A rest gives the GM the Fear it owes them**, on the screen they are holding:
  a short rest and a long one, each quoting the sentence the Downtime section
  writes for it, honouring both dice switches, and stopping at the Fear cap where
  you can see it. Nothing is written until you press.
- **A long rest can leave a sentence on the countdown it moved.** A countdown
  has carried per-tick beats since the schema gained them, and until now no
  screen could put anything in them: the field was written on save and read on
  load, and never filled.
- **The board says something when a PC marks their last Hit Point.** A prompt
  under the four tracks, a `DEATH MOVE` chip on the shut row, and RECORD writes
  what happened into tonight's plan.
- **A long-term countdown stopped claiming it advances between sessions.** It
  said so on two screens. In the whole shipped dataset that phrase appears twice
  and both times it is about Fear carrying over, never about clocks; the hint now
  says the app's own words for what the book describes — it advances when the
  party rests.

## 0.6.0 — 2026-08-24

The version moved for the same reason 0.4.0's did, and it is worth stating
plainly: **this release changes what a saved file can carry.** `SCHEMA_VERSION`
is 5, a companion's sheet now records whether their damage is physical or magic,
and a `.dhchar` written before this and one written after it must not claim to
be the same build. Files from schema 3 and 4 open and are converted, and the
conversion is announced rather than done quietly.

Two subclasses could be built in this app and not played in it. A Druid could
put on a Beastform and then had no way to roll what the form attacks with; a
Beastbound Ranger had a companion sheet and no way to command the animal. Both
were prose sitting on folios the rules parser had never reached.

### A Druid in a Beastform can attack with it

- **The form's attack is a row you can declare**, in `Equipped`, with
  **Proficiency already in the dice**: a Massive Behemoth's `d12+12` is `4d12+12`
  at Proficiency 4, which is the difference between reading a stat block and
  rolling one. All 22 shipped forms.
- **Arming it moves the trait chip to the form's own** — *"you use the
  creature's listed range, trait, and damage dice"* — and **the trait follows a
  change of shape**. Swap a bear for a raven mid-turn and the roll changes with
  you rather than keeping the bear's Strength.
- **Dropping the form takes the attack with it.** So does the automatic drop
  below, and neither leaves an attack armed that the next transformation would
  silently re-arm under the old shape's trait.
- **Weapons and domain spells are marked, not refused.** *"While transformed,
  you can't use weapons or cast spells from domain cards"* — they stay on the
  screen, struck through and labelled, because a rule that hides your kit is a
  rule you cannot check.
- **The form falls when you mark your last Hit Point**, at the moment you mark
  it, wherever in the app the mark came from.

### The Ranger's companion is a creature you can play, not a form you fill in

- **Command them, as the roll the book names.** *"Make a Spellcast Roll to
  connect with your companion and command them to take action."* It is the one
  attack in this app whose roll belongs to one creature and whose damage belongs
  to another, and the trait chip says so.
- **Their Experiences, not yours**, when they are what is armed — *"spend a Hope
  to add an applicable **Companion** Experience to the roll"*.
- **Physical or magic is a choice now.** Folio 18 asks outright; the app had
  answered physical for every companion there had ever been, under a comment
  calling it the SRD's default. It is on the sheet, and it can be changed back.
- **A rest reaches them.** A downtime move that clears your Stress clears an
  equal number of theirs. A full Stress track takes them out of the scene, the
  panel says so and says when they are back, and a long rest returns them with
  1 Stress cleared. **A short rest does not bring them back** — see the
  deviations below.
- **The eight level-up options come out of the book**, not out of the app's
  source, so a layer that rewrites folio 18 is obeyed. The sheet counts what is
  marked and what has been earned, and a tier achievement gives the companion an
  Experience alongside yours.
- **The Spellcast trait is on the line that says what class you are** — and says
  `NO SPELLCAST TRAIT` for the four subclasses that have none, because an
  absence explains nothing.
- **They are on the GM's party board and on the printed sheet.** The board draws
  their Evasion, the pool that will be rolled, their damage type and their
  Stress, and greys them out when they have left the scene.

### A GM's party board that went down, and files that can no longer take one down

**Any board holding a Beastbound Ranger imported before this release crashed on
first render.** A campaign keeps whole copies of the players' sheets and reads
them back without running the character conversion, so a sheet saved by 0.5.0
arrived without the new damage-type field and the board called a method on it.
Fixed, and pinned by the shape that broke it.

Two more of the same kind are closed on the way in rather than on the way out:
an imported sheet's companion damage type is narrowed the way a weapon's already
was, and **a file carrying half a companion is refused with the field named**
instead of being stored and rendered. Every field that clause checks has been on
the companion sheet since the companion existed, so nothing 0.5.0 could write is
turned away.

### The rules text the app draws reaches two more folios

`parseRules` stops at folio 11 no longer: folios 12 and 18 bring **five new rule
sections, 75 to 80**, and everything the beast sheets quote is read from the
dataset rather than typed into the source. Folio 19 stays out on purpose — it is
the Rogue.

### The printed sheet

The companion has a section: their numbers, their Experiences with ruled blank
lines to fill in, and **all eight level-up options each with a box to mark**,
because folio 18 says to mark it on your sheet. The boxes are drawn with the
page's own hairline primitive rather than a Unicode ballot glyph, which prints
as a blank square wherever the printer's font does not carry one.

### Three deliberate deviations, said out loud

- **A QR code does not carry the companion's damage type**, and a companion
  handed over that way arrives dealing physical. It is the fourth documented
  loss of the compact format and it is a format-number decision, not a byte one:
  carrying it needs format 4, and a phone that has not updated would stop being
  able to receive **any** sheet in exchange. A `.dhchar` file carries it exactly.
- **A short rest does not bring an out-of-scene companion back**, even when its
  move clears Stress. Folio 18 says both *"your companion clears an equal number
  of Stress"* and *"they remain unavailable until the start of your next long
  rest, where they return with 1 Stress cleared"*, and on a short rest those
  cannot both hold. The second wins because it is the more specific one and
  because it names its own return; the exception to the first is not in the book
  and is written into the code that makes it.
- **The companion's tier Experience is applied, not offered.** *"Your companion
  also gains one"* offers nothing to choose; what the player chooses is the
  words, and those are typed on the companion sheet.

---

## 0.5.0 — 2026-08-23

### Rally, Prayer and Slayer Dice are a pool now, not a guess

The app had a tray: pick a die size by hand, hold it, arm it into a Duality
Roll. Its own docblock said it was deliberately not an inventory — "knowing
which feature gives which die is reading the feature text" — and for a die
somebody hands you that is still exactly right, so the tray is unchanged. What
it could not do is hold a **pool**, and three features in the book hand one out.

- **It knows how many.** A Seraph's Prayer Dice are *"a number of d4s equal to
  your subclass's Spellcast trait"*; a Slayer's cap is their Proficiency. Both
  come off the sheet instead of being counted by the player.
- **It knows how big.** A Rally Die is a d6, **a d8 from level 5**, and **a d10**
  for a Wordsmith holding *Epic Poetry* — gated on the mastery card actually
  being taken, not on the level.
- **It can hold a face**, which is the one Prayer Dice cannot do without: they
  are rolled at the start of a session and sit on the sheet showing what they
  came up, and you spend a die whose number you already know.
- **Both roads to that face.** The app rolls it, or you type what your own dice
  showed — a table that rolls physical dice is not a table that wants an app to
  roll for it. A d6 refuses a 9.
- **Divine Wielder's *Devout* is applied**: *"roll an additional die and discard
  the lowest result"* is arithmetic, so the app does it when the app rolls.
- **The end of a session finally exists.** All three features say to clear the
  unspent dice and nothing in this app had ever done it. The Slayer's pays for
  it — *"gain a Hope per die cleared"* — and the button says how much before it
  is pressed.

**It asks whose sheet it is about before it writes anything.** Prayer Dice are
spent *"to aid yourself **or an ally within Far range**"*, so *"gain Hope equal
to the result"* is only sometimes about the character this device is holding. An
app that added the Hope to the sheet in front of it would be writing the wrong
one every time the die was for somebody else, silently. So the spend sheet asks
first, and the ally branch applies **nothing** — it shows the number to read out
loud. A Rally Die and a Slayer Die are yours by the rules and are not asked
about.

The section is drawn **only for a character who has a pool**: a Ranger is not
charged a fold for a Seraph's dice. When it is drawn it costs the phone column
52px, which takes a Bard on a 375×667 phone 39px past the whole-sheet fit — a
scroll on a screen that already scrolls, paid only by the three archetypes that
have the feature. `playSheet.test.tsx` states both halves rather than absorbing
either.

As with the modifier register, nothing here reads a feature's text: the pools
are a hand-authored register keyed on ref and feature name, and a test walks the
dataset against it in both directions.

---

## 0.4.0 — 2026-08-23

Deployed as it was written, like 0.3.0 before it. The version moved for one
reason and it is worth stating plainly: **this release changes a number on
every sheet that already exists.** A Simiah's Evasion, a character in a
Gambeson, a Guardian behind a Tower Shield, a Human's Stress track — all of
them read differently after this than before, and all of the new readings are
the right ones. The version is stamped into every exported `.dhchar` and
`.dhbackup` and is what a bug report quotes back, so a file written before this
and a file written after it must not claim to be the same build.

### The numbers on the sheet now include the things that change them

The engine computed Evasion as the class's starting value plus the advancements
that raise it, **and nothing else**. Of the static effects the shipped dataset
carries, it applied the Beastform's and no others. The owner reported it in the
shortest possible form: «Il simiah che prende evasion e il gamberson che da
evasione. Il conteggio non sale. Resta fermo alla base di classe.»

- **Ancestry.** Simiah's *Nimble* (+1 Evasion), Giant's *Endurance* (a Hit Point
  slot), Human's *High Stamina* (a Stress slot), Galapa's *Shell* (both damage
  thresholds, by your Proficiency). All four honour the SRD's mixed-ancestry
  rule: *Nimble* is the second feature slot, so a mixed character who took
  Simiah **first** does not have it — and the sheet that prints the feature and
  the engine that counts it now read that from one place.
- **Subclass**, gated on the card actually taken rather than on the level.
  Nightwalker's *Fleeting Shadow*, School of War's *Battlemage*, Vengeance's
  *At Ease*, Winged Sentinel's *Ascendant*, and Stalwart's three — which
  **stack**: a Stalwart holding the mastery card is at +6 to both thresholds,
  not +3.
- **Armour.** Gambeson +1 Evasion, Chainmail −1, Full Plate −2 and −1 Agility,
  Bellamoi Fine Armor +1 Presence, Savior Chainmail −1 to Evasion and all six
  traits — every tier of each.
- **Weapons, in both slots.** Greatsword, Warhammer and the Heavy-Frame
  Wheelchair take Evasion off; Halberd and Longbow take Finesse; the Sledge Axe
  takes Agility; the Bravesword takes Evasion and gives Severe. The shields are
  secondary weapons and raise the Armor Score: Round, Tower, Spiked, and the
  Labrys Axe from the primary slot.
- **Carried items.** The six Relics give their trait, once per relic however
  many are in the stack. A hand-typed "Stride Relic" carries no dataset
  reference and correctly gives nothing: this app does not read item names.

What is deliberately **not** counted is anything whose number is not true of the
sheet at rest — Rogue's Dodge, a Buckler's mark, Faerie's Wings, School of War's
*Conjure Shield* (no cost and exact arithmetic, but gated on a Hope counter that
moves several times a scene), every potion. They are all on the screen in full;
what they are not is a term in a total.

Nothing here reads a feature's text. The arithmetic is a hand-authored register
keyed on dataset reference, and a test walks the whole dataset against it in
**both** directions — every row must still match the sentence it was priced
from, and every sentence that looks like a static bonus must have a row or a
written reason for not having one. That second direction is the check that did
not exist while a Simiah's +1 was missing.

### The Play screen shows what a character actually has

Not one word of class, subclass, ancestry or community feature text was
reachable from Play. After character creation the only way to reread your own
Hope feature was to print the sheet.

- **Every feature, on the screen that is open while you play** — on the phone
  inside the fold that names them, now `Lineage, domains & features` with the
  count on its shut header; in the desktop cockpit, open, in the column that
  scrolls. The class Hope feature leads, because it is the one you look up most.
- **A feature that changes a number says so**, with a chip drawn from the same
  ledger the total was summed from — so `+1 EVASION` beside *Nimble* is a claim
  you can check against the band by looking. A bare integer with no derivation
  anywhere is how the defect above survived as long as it did.
- **Equipped gear prints its own feature at last.** A Greatsword said `2d10+3`
  and nothing else; a Gambeson said its score and its thresholds and never
  *Flexible: +1 to Evasion* — on the one screen that draws the Evasion it
  changes.
- **The cockpit's defence band shows the sum**: `11+1` under a 12. The phone
  does not, and that is measured rather than forgotten — its band is 56px and
  the small phone has thirteen pixels of slack in the whole column.

### One counter shape instead of two

The player's four tracks were a three-line card on a phone and a two-line row in
the cockpit, with the value on the left and both steppers pinned after it. The
owner asked for one shape and named what they were rejecting: «va uniformato con
lo stile del mobile per coerenza e non con più e meno affianco alla statistica».

- **The card is the only shape now.** `[−] value [+]`, steppers at the two outer
  edges, the number on a line of its own with its maximum beneath. The rejected
  row is deleted rather than left behind a flag, and the test that pins the
  order carries the reason.
- **Sized for the surface it is on, not copied across.** The cockpit's cell is
  **62px** against the phone's 90: three lines at 3 + 13 + 2 + 26 + 2 + 10 + 3
  is 59, 61 with the border. The phone's own 90 was the other option and it was
  refused with the arithmetic — it costs 84px of `DualityRoll` against 28, which
  measured in Chrome takes ROLL off the glass at 1180×695 and 1366×768. At 62px
  ROLL stays painted at every cockpit height from 650px up with the shell
  banners down; with both banners up it needs 762, where before this it needed
  734.

---

## 0.3.0 — 2026-08-19

Deployed as it was written, so everything here was live before it was numbered.
**The band is still not empty** — `BACKLOG.md` carries items that tell a player
a wrong number, and this stretch closed several more without clearing them. The
version moved anyway, by the owner's decision once the waves were closed, and
that is the honest reason rather than a claim that the reason from 18 August
went away.

### The GM screen got the two things the table was waiting for

- **A planned encounter can be opened.** A configured row now has a verb that
  puts its roster straight onto the scene, with the same call the builder's SEND
  makes. It does not write the board: folding that in would let one tap
  overwrite a roster somebody is in the middle of assembling, and the row says
  so. Disabled when nothing in the roster resolves, and when the scene is not
  empty it says how many are already there before it adds.
- **A roster entry opens its own stat block, in the row.** Read-only as a
  property of the component rather than as a promise: it renders no button, no
  input and no select at all.
- **`×3` was wrong, not terse.** For a Minion, that count is *groups* the size
  of the party, and the budget charges a point per group - so `×3` said three
  where twelve had been paid for, while the builder had printed "3 GROUPS OF 4"
  for the same number all along. The row says what the builder says.
- **A name generator**, as a GM tool. 15,325 names, places and regions from
  tables written for this project - the Core Book's lists are not in this app
  and are not the source of these. Nothing it can produce collides with anything
  in the shipped dataset, and the test proves that by enumerating the entire
  space rather than by sampling it.
- **ENDING A SCENE always asks.** It used to ask only when the scene was
  occupied. It costs a tap at an empty table, which is the point.

### The rules on screen are the rules in the book

- **Lists and tables in a linked rule are drawn as lists and tables.** They came
  out with a literal `- ` down the left and raw pipes, in 38 of the 75 sections
  the ADD menu offers. The Average Costs table and eleven others arrive with it.
- **The damage bump says what the book says.** The `+1d4 (or a static +2)` is
  read out of whatever rules layer is loaded, on both the builder and the
  planned row, instead of being typed into three files that had already drifted.
- **How far a reach reaches**, in the figure the book gives it.
- **The ARM chip offers what the engine will spend.** It cycled to three; one
  incoming attack marks one Armor Slot.

### Controls that can be reached, and pressed, and got out of

- **The Conditions door on the wide layout drew zero pixels.** It was the last
  child of a silent horizontal scroller, and with two conditions named it was
  laid out past the right edge - the only way into that dialog, invisible.
- **`TO VAULT` was a 56x10 target**, five to a screen, all with the same
  accessible name.
- **The damage die grid can be closed without answering it.** The Duality keypad
  got that months ago; the two halves had diverged.
- **The stepper you press wears a ring**, drawn inside its own bounds so no
  target loses a pixel.
- **A weapon or a set of armour can be rolled for by tier.** Not loot or
  consumables, which have no tier - offering the filter there would be the app
  implying an absence that is not real.

### The app says when it has not saved, wherever you are standing

- **A campaign that did not reach the disk is said on every screen**, not only
  on the GM screen the GM has walked away from - and said once, never twice.
- **A rename of a campaign that is not open now reaches the disk.** It sat in
  the window looking right and was gone on the next reload.
- **A repaired campaign is repaired once**, not again on every launch.
- **Deleting a campaign refuses a record a newer build wrote**, the way writing
  over one already did. A campaign holds copies of other people's sheets.
- **An imported character no longer lands under a name the device already has**
  when the same file also decided to keep the local copy of another one.
- **The transfer warning says what happens.** It promised a repair no code
  performs; a first correction denied a row the sheet actually draws. It now
  says the three true things: the ids stay and are drawn, they travel unchanged,
  and this build cannot name them - though a device that has the content will.

### The reference got an eighth topic, and the chips got shorter

- **Gold, equipment and loot is a topic of its own.** The SRD's table of what
  things cost was reachable only through a session row's `LINK → Rule` before;
  it is the eighth entry of the reference now, opened from MENU like the other
  seven, with every word still read out of `data/srd-1.0.json` at render time
  and the page stamped beside the table rather than above the topic.
- **The chip strip is ordered by width now, not by meaning.** That is a real
  cost and it is the reason the eighth chip fits at all: seven chips in semantic
  order took three rows and 144.00px, and eight sorted by width take the same
  three rows and the same 144.00px. The eighth topic is free in height and paid
  for in order — a GM looking for a topic scans rather than predicts.

### SHOW has a third door: a merchant

- **A stall to draw stock for**, over the SRD's own table of what things cost.
  It never spends anybody's gold: nothing in it writes to a character sheet,
  switched on or off.
- **Switchable, like the bestiary and the party board**, and for the same reason
  those two are — no session row opens any of the three, so a switch that hides
  one cannot make a row the GM has already written unopenable. On by default,
  because a tool that ships switched off is a tool nobody discovers.
- **SHOW leaves the bar only when all three doors are off.** Two off is no
  longer enough, and the bar redistributes to two verbs when it happens. The
  test proves the property rather than the instance: it is titled for *every*
  door being off, and it covers each door being the last one left.
- **The list of doors is one array now.** Five files used to name the bestiary
  and the party board by hand — the sheet, the bar, the dialog's announced name,
  the menu, and Settings — and four of the five would have failed *quietly* on a
  missed edit: a bar that hides SHOW from a GM whose only live tool is the new
  one, a dialog announcing a sheet that is not there, a menu sending the GM
  after a door the sheet does not offer, a notice that simply never prints. A
  fourth door is one row in that array.

**What this does not fix:** with only one door switched on, SHOW is still a menu
with a single entry — two taps for one destination. That was a known defect
before the merchant, and the merchant makes it *more* frequent rather than less:
one-door states go from two to three. It is recorded, deliberately, rather than
quietly widened.

## 0.2.0 — 2026-08-16

The first version this project chose. `0.1.0` was the scaffold default and
described nothing; everything listed here happened under it, unreleased.

~~**And this one has not been deployed either.** `origin/main` is behind the work
below and the Pages deploy fires on a push, so no browser has run any of it yet.~~
**No longer true, corrected 2026-08-18:** `origin/main == main`, the Pages deploy
has run green, and everything below is live at
<https://simone-albanese.github.io/daggerheart-companion/>. The sentence is struck
rather than deleted because it was the honest state when it was written, and a
changelog that quietly rewrites its own past is worth less than one that does not.
The date above is still the date the entry was written. **Nothing here is a 1.0** — the
version is `0.2.0` on purpose, `BACKLOG.md` still carries the band of items that
tell a player a wrong number, and no document in this repository may say
otherwise.

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

- **A reaction roll no longer says you gained a Hope.** It grants no Hope, gives
  the GM no Fear and clears no Stress on a critical, and the app has always
  applied that correctly — it just did not *say* it. The line under the outcome
  came straight off the outcome table, which has no reaction in it, so the roll
  bar read "You gain a Hope" while the Hope counter a few rows up did not move.
  It now says a reaction roll pays nothing either way, and on a critical that
  you ignore what a success would have cost you.
- **Whatever you have armed for the next roll is spelled out on the ROLL bar,
  whether or not a result is still on it.** Arming an Experience after a roll
  used to leave the bar showing the old verdict and nothing else, so the next
  roll was quietly two points higher and a Hope cheaper with nowhere on the
  screen saying so. It is named there now, prefixed `NEXT:` so a `+2` sitting
  beside a total cannot be read as a total that already counted it.
- **An attack roll leads into a damage roll, on the screen.** The engine could
  roll damage correctly from the first commit — Proficiency multiplies the dice
  and not the modifier, and a critical adds the maximum the dice could have
  rolled — and `rollDamage` had never had a caller outside its own tests. So no
  screen in this app had ever rolled damage, and the critical the Duality Roll
  had just worked out was thrown away one line after it was computed. Now a
  successful roll offers the damage roll it earned, as a control and not as a
  note: it carries the pool the attack actually rolls, it writes what it rolled
  to the log, and it never touches the sheet — there is no adversary on this
  screen, so damage is read aloud rather than applied. A reaction roll is
  offered nothing, because a reaction roll is not an attack roll. A miss says so
  in words instead of leaving a gap where a button was. And when the GM has kept
  the Difficulty to themselves the offer still appears, labelled IF IT HIT: the
  engine returns "undecided" rather than guessing a verdict, so a table that
  hides its Difficulties can roll damage like everyone else.
- **Unarmed attacks exist.** `[Proficiency]d4`, as a row you can declare, drawn
  even when nothing is equipped — having no gear is not the same fact as having
  no attack. Arming it moves no trait chip: the rule hands Strength-or-Finesse
  to the GM, and the app does not make that call on their behalf.
- **Spellcast damage rolls a number of dice equal to your Spellcast trait**,
  which is a different rule from every other pool on the sheet, and at +0 or
  lower it rolls nothing and says so in the book's own sentence rather than in
  ours. The app supplies the count, which is on your sheet; you tap the die and
  type the modifier, which are on the card in your hand. Nothing is parsed out
  of card text, so a card that prints its own `2d8+4` cannot be quietly
  overwritten.
- **Damage dice can be typed**, for tables that roll physical dice, behind the
  same switch the Duality dice already used: one slot per die, and the engine
  still does all of the arithmetic. Extra damage *dice* are still not supported
  — the SRD's "Tusks: +1d6" has nowhere to go yet, and `Architecture.md` §3.2
  now says so rather than promising the button in the present tense.
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
- **Resting does its own arithmetic, and shows you the numbers first.** The app
  could apply a rest correctly from the first commit and there was no screen
  that did it, so somebody at the table was adding 1d4+Tier to three tracks by
  hand while the scene waited. Rest & downtime is now a fold on the Play
  screen: pick short or long, pick two moves — the same one twice if you like —
  and every row says what tapping it will clear before you tap it, down to the
  second copy of a move only getting what the first one left. Nothing is rolled
  or applied until you commit, because a roll that happens because you opened a
  screen is a roll you cannot refuse. The one number the app has not got is the
  GM's Fear, and until you commit it says `1d4` rather than a number.
- **The app will tell you the next rest has to be a long one**, in the SRD's own
  words rather than by greying out a button — three short rests in a row is a
  rule, and a dead control says the app could do this and will not. It counts
  what this device watched: a sheet that arrived by QR arrives having counted
  nothing, and the fold says so instead of claiming you are ready.
- **Cards move between loadout and vault for free during a rest**, through the
  same five-card cap as everywhere else, so the price changes and nothing else
  does. The move is part of the rest rather than something done beside it: it is
  proposed with the moves, applied by the same press, and written into the
  rest's own log entry. A card that moved the moment you tapped it would have
  been charged the rest's price before the rest — and the rest might never come.
- A recall that cost nothing used to be logged as "Free during downtime" even
  in the middle of a fight — 31 of the 189 cards have a Recall Cost of 0. The
  log now says which of the two it was.

### On a phone

- **The Play screen is the whole sheet, in the order you read it at the table,
  and nothing on it is pinned any more.** Evasion and the two
  damage thresholds and Proficiency as four big numbers, then HP, Stress, Hope
  and Armor, then the six traits, then ROLL — and under ROLL, one row each:
  weapons & armour, Experiences, what you are carrying, your cards, rest &
  downtime, and where you are from. Every one of those opens with a tap and
  remembers per character whether you left it open. **On the build before this
  one, HP, Stress, Hope and Armor were not on the screen at all** on a 393px
  phone: they were below the fold, under the identity block, the defence band
  and six trait tiles, while a fixed block at the bottom held the trait chips
  and ROLL.
- **ROLL is in the flow now, and that is a bigger target further from the one
  control you must not hit by mistake.** Pinned, it sat 8px above the Play tab —
  a 98×60 control that navigates away from your sheet mid-turn. It is now
  **432px** clear of it, and still above the fold without being fixed there: its
  lower edge lands at 306px of the 730px a 393×852 phone leaves for content, and
  at 306 of 545 on a 375×667 one — 239px of margin on the small phone, where it
  was ten before the counters went two across. Nothing ordinary eats that any
  more; the dearest thing the count cannot see is dice you type by hand, at 68px.

  **The part that is a cost, and it is a real one, and it got worse.** On a
  393×852 phone, with the sheet scrolled to the top, ROLL sits **493 to 559px**
  above the bottom edge of the screen — further than a thumb comfortably reaches
  one-handed, where the pinned block was inside that reach. On a 375×667 phone it
  is **308 to 374px** up, which puts it half out: its top edge is 44px past the
  ~330px one-handed sweep and its bottom edge is still 22px inside, where at
  229-295 the whole row was comfortably in. Every row taken off the top of the sheet lifts ROLL further
  from a thumb at rest, so the same rearrangement that put the whole sheet on one
  screen moved the button further away. The judgement behind keeping it: the page
  scrolls, so when you are about to roll you can bring ROLL to your thumb with
  the same flick that got you there, and a pinned block's position was nobody's
  to choose. Nobody has watched a real hand do it at a table yet.

  It was also being crushed rather than scrolled to, on every build since the
  block was unpinned. The column is a flex column and the roll surface was the
  one section in it that had not said it must not shrink, so the browser took
  the whole overflow of the sheet out of it: 33px of box holding a 66px ROLL,
  overlapping the fold header underneath. Fixed, and the sheet scrolls.
- **The six traits are one row of chips, and the verbs are one tap behind it.**
  SPRINT · LEAP · MANEUVER under every trait cost about 210px, a quarter of the
  glass. The row costs 44. The verbs are still there behind a control at the end
  of it that remembers per character — and they are still read out in full by a
  screen reader with that control shut, so nothing is lost by listening.
- **The advantage / disadvantage / reaction row is not drawn when nothing is
  armed.** It used to be a permanent band saying `MODIFIERS … NONE`. The
  controls are behind a MODS button on the roll bar, which costs no height at
  all, and the moment anything *is* armed — ADV, DIS, REACTION, a Difficulty, a
  held die — a row appears above ROLL and names it, because a modifier you
  cannot see is a modifier the app is applying behind your back.
- **The four counters are two across, and the damage box moved next to the
  thresholds.** HP, Stress, Hope and Armor were four full-width rows: 194px of a
  730px screen for four numbers. As a 2×2 grid they are 94, and each one keeps
  everything it had — the number, `[−]` and `[+]` at 44×44, and the value itself
  a target you tap to type into. What it costs is the gap between the value and
  the steppers, which was about 105px on a 393px phone and is now 4: a thumb
  that misses now opens the keypad instead of travelling past it, which writes
  nothing and closes on one tap. **Boxes instead of numbers are gone from the
  player's own sheet entirely** — on the desktop too, where they were 29 targets
  32px tall against this app's own 44px floor and the preference could not reach
  them anyway. They survive where you read somebody else's state rather than
  marking your own: the party board, the live scene and the companion.

  And the box you type a hit into is now the fifth cell of the defence band,
  beside MAJOR and SEVERE. It used to print `8/16` beside itself in the smallest
  type on the screen, because it needed the ladder and could not see it. It
  costs the band nothing: a 44px field fits inside a row the numbers already
  hold open at 64. Below a 353px-wide phone the field wraps under the door
  instead of pushing sideways into the Proficiency number a player reads under
  pressure — which is what it used to do, by 27.2px at 320.
- **Conditions take no room on the sheet until you have one.** There used to be
  a permanent row of seven grey chips scrolling sideways to tell you that you
  are not Hidden, not Restrained and not Vulnerable; then a folded row saying
  `Conditions · NONE`, which cost exactly the same. Now nothing is drawn to say
  nothing. The way in is a small square at the end of the defence band, in a row
  that was already 64px tall for the numbers, so it costs the page no height: it
  reads `— COND` when you are clear, and fills in with a count when you are not.
  The
  moment anything is on — including the Vulnerable that a full Stress track
  gives you, which nobody switched on — the chips are back where they always
  were, naming it. Nothing the GM did to you is ever left unsaid.
- **Two rows fewer for the same facts:** the vault is a fold inside your cards
  rather than beside them, with both counts on the shut header (`3 / 5 · 3
  INACTIVE`), and the gold moved onto the Carried header (`2 ITEMS · 1 BAG · 4
  HANDFULS`) instead of a row of its own. The lineage fold opens with your
  domains and their card level caps, then says where you are from — that is the
  order you actually look them up in.
- **And with every fold shut, the whole sheet is on the screen.** 618px against
  the 730 a 393×852 phone leaves, so you really do see all of it at once, with
  112px to spare — and 454px to spare on an iPad mini. That was the point of the
  whole rearrangement and it took four goes to get there: the first left it
  169px over, the second 19, the third fitted by 33. A 375×667 phone is still
  73px short of it, which is one folded row and a gap where it used to be three
  rows. **And it fits a 360×800 Android for the first time** — 618 against 678 —
  which the plan said it would not, because the plan costed a taller trait chip
  without the narrower one beside it. Nothing here was bought by squeezing the
  spacing, because a fit bought that way is one the next change undoes.
- **What it does not do, said plainly.** If you have installed the app to your
  home screen on an iPhone with a home indicator, the system takes another 34px
  off the bottom of the page, taking the column from 730 to 696. That used to
  make the sheet one pixel over; it is now 78px inside it. Nobody has measured
  that inset on a real phone yet even so, and everything in the app that pays it
  is arranged around a number no one has read.
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
- **The app will no longer let you make two characters you cannot tell apart.**
  Renaming already worked and was four gestures deep in the tab visited least. It
  came onto the sheet as a 72×44 RENAME chip and then **left it again**: the
  header already says the name, the class and the level, so the sheet was saying
  them a second time 53px lower, and Build's Identity section already held the
  only door a rename needs. The name line on the sheet is still not a target,
  because a name at the top of a scrolling
  screen that opens a keyboard when a thumb brushes it is worse than a name you
  cannot edit. Nothing is written while you type — the old field wrote on every
  keystroke, which stamped the sheet's "last edited" clock once per letter
  typed. The field writes when you press SAVE or Return, and on the Build form —
  where there is no ✕ and every neighbouring field writes as you type — when you
  leave it as well, so a half-typed name is not the one thing on that screen a
  tab tap throws away. If another character already answers to the name the app says
  whose it is and offers the next free one, instead of quietly changing what
  you typed; "ilya", " Ilya" and a second character with no name at all all
  count, because the picker draws all three the same. A refusal is a sentence
  on the screen and is announced to a screen reader; it is never a greyed
  button and nothing else. Clearing the name stores nothing rather than writing
  the word "Unnamed" onto your sheet. Your keyboard's autocorrect is turned off
  over this field, because a name is not a word it gets to have an opinion
  about. This holds on
  the rename path and on the *keep both* copy of an import. Creating a
  character, and importing a file that is a genuinely different character with
  the same name, are still unguarded — `BACKLOG.md` P5-1(c).
- **iOS stopped zooming the page** when you focus the damage box — done with a
  16px floor on the controls rather than by taking pinch-zoom away from
  everyone.
- **A press-and-hold in a track's header no longer zeroes the track.** A slow
  press on "SEVERE · 3 HP" left HP marked at 3 instead of 8: a number that
  reads like a real total rather than like an obvious loss.
- Six text-on-surface pairs that were below WCAG AA are lifted, including the
  10px label that carries 44 of the 61 small-caps captions in the app.

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
- **Arriving at the GM screen opens nothing, and neither does changing table.**
  The record remembers which tool was last open, which is worth keeping and is
  not an instruction — reading it as one would have put the encounter builder
  over the plan every single time you arrived, and switching campaign or making
  a new one would have dropped you into whatever that table had open last,
  including a tool you had switched off in Settings.
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
- **The GM section has a bottom bar of its own: ADD, SHOW, SAVE.** They are
  verbs rather than places — each opens something over the plan and hands the
  screen back when it closes — which is why none of them lights up as "where
  you are".
- **ADD writes the night.** Scene, encounter, link, countdown. A scene
  remembers an environment; an encounter can take the roster that is on the
  board right now; a link points at an adversary, an environment, a card or a
  rule already inside the app, never at a web page; a countdown can be pinned
  to the top bar from the form that makes it. Every new row arrives closed and
  at the end of the list, and the button says so, so a sheet closing over a
  twelve-row night does not look like nothing happened.
- **SHOW is the two tools no row opens** — the bestiary, read-only, and the
  party board. They were chips borrowed at the top of the screen while there
  was no bar to put them in; they have gone back where they belong.
- **SAVE says where your campaign is, and never pretends you had to press it.**
  The campaign has been written 400 ms after every change since it moved into
  the database, so the sheet flushes whatever is still in flight and then says
  when the last change actually reached the disk — not when the record changed,
  when the *write landed*. If a write failed, that sentence is replaced by the
  failure and by a retry that does something.
- **TRY AGAIN only appears where trying again would do something, and says when
  it did not work.** It used to be drawn over every failure and to call the same
  flush every time — which writes the open campaign, and so could do nothing at
  all about a campaign that failed to be *deleted*, a device that could not be
  *read*, or a new campaign whose write threw and left nothing marked as
  unwritten. You pressed a red button, watched it say TRYING…, and got the same
  red strip back. Now: the new campaign is written by the retry, a failed read
  is retried by reading again, and a failed delete draws no button because
  nothing was lost and the REMOVE you already have is the retry. A retry that
  fails says so instead of settling back into the same sentence.
- **A first campaign that could not be written says so.** On a device with no
  campaign at all the app makes one, and if that very first write failed the
  error was swallowed with a comment. Nothing read it, so nothing was visibly
  wrong until SAVE existed — at which point the sheet would have stamped
  "already on this device, just now" over a write that threw.
- **A campaign file is a copy, and the app says it cannot read one back.**
  `.dhcampaign` holds the whole table, party sheets included, and there is no
  import for it yet. That is written where the button is now, rather than being
  discovered on the day it matters.
- **The tab bar is not on the GM screen, and MENU is where the way out went.**
  The bottom of the phone belongs to ADD, SHOW and SAVE while you are running a
  session; Play, Cards and Build are behind the campaign name at the top, which
  is now a button the width of the screen rather than a label. Leaving the GM
  tools is a rare gesture and the easiest reach should go to the ones you make
  all evening. Settings is where it always was, in the header.
- **MENU opens the two tools that a row would otherwise be needed for.** The
  encounter builder and the live scene are the content of a session row, which
  is the point of the rebuild — but improvising a fight should not mean writing
  a plan row for it first. The other three are not repeated there: Fear and the
  countdowns is behind the Fear number at the top, the bestiary and the party
  board are behind SHOW, and the sheet says so rather than leaving you to
  wonder.
- **The campaigns you already had have a door.** Switch between them, make
  another, rename the open one, remove one behind two taps. Renaming is offered
  on the open campaign only, and the sheet says why: for any other row the app
  would show you the new name and never write it down.
- **A campaign cannot be renamed to nothing,** and it says so instead of quietly
  putting the old name back. Two campaigns both called nothing at all are two
  rows in a list you cannot tell apart.
- **What this device did with your campaigns is finally on a screen.** Repairs
  the app made while reading them, and campaigns written by a newer version of
  the app that this one will not open — named, not counted, with the sentence
  that nothing has been deleted.
- **If the saved table wins a race against your hand, the screen says so.** The
  campaign is read off the disk as the GM screen arrives, and anything you
  change in that window is replaced by what was saved — the alternative is
  writing an empty board over a real campaign. The loading panel used to promise
  the opposite in the same breath ("nothing you do before it arrives will be
  lost — it is the saved campaign that wins"), and the notice that it had
  happened lived behind the MENU button. It says what actually happens now, and
  if it happens it is a line under the top bar with a ✕, on the screen where you
  made the change.
- **Every control inside an open row says which row it belongs to.** A night
  with three scenes drew three buttons called OPEN THE SCENE and three called
  PUT THIS ON THE BOARD; on a screen read out loud they were indistinguishable.
  The row already named its own DELETE that way; now the contents do too.
- **The licence notice did not leave the GM screen; it moved into the scroll.**
  It is 126px on a phone, and that screen has bars at the top and the bottom —
  but a notice the licence asks to be displayed is not what pays for a layout,
  so it is the last thing in the session list instead of a strip above the bar.
  It went in floated to the foot of the region, which on a night with three rows
  in it looked and cost exactly like the strip it replaced; see *The licence
  notice* below, which is where that was finished and where the other four
  screens caught up.

- **A campaign that is not reaching this device says so on the screen, not in a
  sheet.** The GM tools have known when a write failed since campaigns moved
  into the database, and the only place that said so was behind the SAVE
  button — which is one tap too many for that particular sentence. The person
  who needs it is three hours into a session, adding rows and watching them
  appear, with a tab that is about to close on all of it. It is a strip under
  the top bar now, in the store's own words, with a retry beside it, and
  nothing you open covers it.
- **The whole GM section can be switched off, in Settings.** Most people holding
  this app are players, and the GM tab is a quarter of the bar they navigate by.
  Off, the tab goes, the desktop header's entry goes, and the app will not open
  on the screen behind them — including on the next launch, when the last screen
  you were on was that one. Nothing is deleted: every campaign is still on the
  device and comes back with the switch.
- **The bestiary and the party board can be switched off on their own,** and
  when both are, SHOW leaves the bar rather than opening a sheet with nothing in
  it — the two verbs that remain take the width it had. With one of the two off
  SHOW still opens, offers the one that is left, and is announced as that one
  rather than as both. The scene runner's empty state stops offering the
  bestiary as well, so nowhere in the app points at a tool you have put away.

**Not there yet, and named here rather than left to be discovered:** the bar has
no SEARCH — full-text rule search is deferred, and the search a GM does at the
table is the bestiary's own filter behind SHOW. The encounter builder and the
scene runner have no switches of their own, because they are what a session row
opens and a switch would make a row you had already written unopenable; Fear and
the countdowns has none either, because the pool is spent from every corner of
the app and the board behind that readout is the only place it can be set
outright rather than one point at a time.

### The rules the GM was looking up on paper

- **MENU opens a reference, in seven subjects.** What to give an adversary you
  are inventing, how hard to make a roll, what a scene is worth in Fear, how far
  a dynamic countdown ticks, what Close and Far actually mean, the GM moves and
  principles, and the Experiences to hang on a creature. Every word of it is
  read out of the SRD this app already ships, at the moment it is drawn, with
  the page number beside the table it came from — so a homebrew rules layer that
  rewrites a section rewrites what you see.
- **The two a GM wants mid-gesture are folded in beside the control.** The Fear
  guidance sits under the Fear board's twelve targets; the advancement chart
  sits under a dynamic countdown's own row. Both start shut, and neither moved
  anything that was already there. The counter has had a maximum on it since the
  GM screen was built and had never once said what a scene should cost.
- **The advancement chart is six buttons, not ten.** Six of the SRD's cells
  carry a number and those move the countdown you opened it from; the four that
  say no advancement are printed and are not pressable, because a button that
  performs no change is the app claiming something it will not do. Nothing
  advances by itself — the app cannot know which roll was the one that mattered.
- **Distances come with metres, and the screen says the metres are its own.**
  The rules are written in feet and carry no metric figure anywhere, so every
  one here is arithmetic this app did: feet times 0.3048, rounded to the nearest
  half metre below ten and the nearest whole metre above, printed with the words
  COMPUTED BY THIS APP on the same line. The conversion is made on the range
  lines themselves — a span like "5-10 feet" or a single figure — and the note
  above them says so, and says that figures inside the surrounding prose are
  left exactly as the book wrote them. Where a line gives no figure, neither
  does this.
- **Setting a Difficulty is answered with an example, not an adjective.** For
  each of the eighteen trait verbs there is a concrete sentence at 5, 10, 15,
  20, 25 and 30 — "walk slowly across a narrow beam" rather than "medium". The
  adjectives on the printed GM screen are not in the SRD and are not this app's
  to print.
- **Character creation shows all seventy-nine Experience examples.** It used to
  show five, typed into the app by hand, under a restatement of the rule that
  kept one of its four worked examples. Both are the SRD's own now, with the
  examples behind a fold that starts shut so the two fields you type in did not
  move.
- **What a panel says when it has nothing to show is about the screen it is on.**
  Three of these tables are drawn in two places — once in the reference, once
  folded under the control they belong to — and where a homebrew rules layer
  leaves one of them empty, the sentence that replaces it used to describe the
  other place. The advancement chart told you to use "the − and + above" on a
  screen that has neither; the Fear guidance said "the pool above still works"
  where there is no pool; and the note explaining which tier column is marked was
  printed even when a rules layer's own column headings had left nothing marked.
  Each now checks before it speaks.

**Not there, and named rather than left to be found:** there are no name or
place generators. The SRD this app ships contains none — no name list, no place
list, nothing to roll on — and building them would mean copying text out of a
licensed book, which is the one thing this project will not do. The Difficulty
examples are also not attached to the roll screen's own difficulty box: that box
is on the player's side, and the rules say the GM sets the number.

### The licence notice

- **Scroll to the end of any page and it is there.** The Daggerheart licence
  asks for the notice to be displayed, and the app had three different answers
  to that. On Cards, Build and Settings it was a fixed strip above the tab bar:
  126px of a 393px phone, permanently, for two sentences a reader looks at once.
  On the GM screen it was inside the scroll but floated to the foot of the
  region, so on a night with three rows written it sat above the bar and cost
  the same 126px. On Play it was not drawn at all — on the screen that is open
  for most of a session. Now there is one answer on all five: the notice is the
  last thing in the page's own content, under everything else, and it looks like
  the end of a page rather than a bar — a hairline and some quiet text.
- **That gives Cards, Build and Settings 126px of their screen back**, and gives
  a GM whose night is only half written about 236px more list. **It costs the
  Play sheet nothing**: it sits below the last folded row, past everything the
  sheet's own height budget counts, so the numbers that decided ROLL's place
  are unchanged by it — 385px down a 730px column and a 697px sheet when this
  landed, 306 and 618 after the reflow that followed, and the notice moved
  neither of them either time.
- **The notice itself is not touched.** It is the same 342 characters, written
  out in exactly one place in the source, and the suite still fails if a second
  copy of them is ever declared.

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
  rather than described, built before the first bump instead of after it — and
  then taken for the first time, to store how many short rests you have had in
  a row. Every file written by an older build still opens, says it was
  converted and says what changed; the fixtures those older builds wrote are
  committed untouched, because they are the only proof the conversion works.
  The first launch after the update rewrites your library once and produces one
  fresh backup, which is expected rather than a fault.
- Documentation: the README's factual claims are checked against the code, the
  Node version is written down once in `.nvmrc`, and `env.sh` explains why it
  exists today rather than why it existed once.
- The desktop roll panel's "there is more below" fade stopped rebuilding its own
  machinery. Reading whether content is below the fold has to happen on every
  commit — a child growing is not observable any other way — but the wiring was
  sharing that effect, so every die tap, every armed modifier and every frame of
  the roll animation tore off a scroll listener, put an identical one back and
  threw away a `ResizeObserver` before it had reported anything. Counted against
  the old hook: two observers and two listeners at a bare mount, six and six
  after four taps. It is one and one for the life of the panel now, and the
  count is a test rather than a claim.

### The resolution audit — what a screen actually painted, on glass it was never opened on

Everything above was written from what the code *declares*. This pass measured
what it *draws*, at fifteen window sizes in a real browser, and found controls
painted at zero pixels on screens nobody had opened the app on.

- **The desktop roll panel could not be rolled from on a laptop.** On a 1180×695
  window — an ordinary 13" laptop with a browser bar — with the backup nag up and
  your last Hit Point marked, both of which a fresh install has, the ROLL button
  was painted **0.0 pixels tall**. It was in the page, a keyboard could still
  reach it, and no wheel, drag or tap anywhere on the glass could: the panel was
  told to hide its overflow rather than scroll it. The same clip cut the damage
  button to 15px of its 44 at 1280×800. The panel scrolls now, with its
  scrollbar's width reserved in advance so the twelve die keys do not shift
  sideways under a pointer already moving towards one the moment it opens.
- **Four of five Experience chips, the difficulty box, the extra-die button and
  SPELLCAST were painted at zero on the same panel, at every desktop width.**
  They were on one line 303px wide holding 1058px of content, with the scrollbar
  switched off — so they were not merely off-screen, they were unreachable. The
  row wraps now, and the panel is 402px wide rather than 303 because the
  decorative `Duality Roll` title above it, which existed only on desktop, was
  spending 93px of the width its own controls needed.
- **The die keypad had one way out: answering it.** Brush a die on a scrolling
  screen and you had to enter a number you did not roll, then re-open it and
  enter the right one — which in the damage row wrote two log lines for one
  attack. The Duality dice now have a labelled exit carrying HOPE or FEAR, an ✕,
  and the Escape key; the keypad takes the keyboard when it opens and hands it
  back to the die when it shuts, where before the exit was the 53rd stop of 81 on
  a Tab key. Escape stands down when a card is open over it, so one press no
  longer closes both. **The typed damage slots still have no way out** and that
  is written down as open rather than described as done.
- **Three controls were 44 pixels tall and 31 to 43 wide.** All/Any in the gear
  picker's filters, SET in the conditions dialog and USE beside every carried
  item: each declared a height floor and took its width from its own three-letter
  label. They are 44×44 now, on both axes, and every button in those blocks
  declares the floor even where its label is already wide enough — a rule the
  next reader can check beats a coincidence they cannot.
- **The whole TIER 4 chip in the armour picker was off the glass on a 320px
  phone** — 44 pixels of target with 0.0 of it visible, behind a scroller with
  its bar hidden. The rail wraps.
- **The incoming-damage box sat up to 826 pixels from the thresholds it is read
  against**, at the far end of the defence band, on every screen wider than a
  phone. It sits beside SEVERE now, 103px away at every width from 353 up. What
  that costs is written down too: on a phone held sideways the box and the
  conditions door move out of the near thumb's sweep.
- **The app stopped opening on nine class cards.** The first thing this app ever
  showed anybody was the character wizard's class step — shown to a GM, and shown
  to somebody whose character was finished an hour ago on another phone. It asks
  first now: who is at the table, how your table rolls dice, and, for a GM, how
  many players. Skippable at every step, and a skip lands on the same summary
  card as every other route with the shipped defaults on it, so nothing is
  half-applied. "My character is on another device" is not an answer but a door:
  it ends the questions and opens the import routes. Upgrading does not trigger
  it — a preferences record written before this existed is read as already
  answered, or two years of users would be asked who they are.
- **And it never asks again once you have a character, whichever door you came
  in by.** The first-run flow writes down that you answered, at the end of each
  route it knows about — so any *other* way of putting a character on the device
  left "not yet answered" on the disk for good, and the symptom only surfaced
  months later, the first time the library was empty again: a deletion, an
  eviction, a quarantine, and the app asks somebody who has been playing since
  spring who they are. Restoring from a backup did exactly that. Rather than
  patch that one door, having a character now *is* the answer, recorded the
  moment there is one — file import, clipboard, QR, backup restore, or simply
  launching with a library that is not empty. **A device already carrying the
  wrong answer repairs itself on its next launch.** A device with no characters
  keeps its "not yet" and is still asked, which is the whole point of the
  question.
- **The two bars that paint to the edge of the glass move out from under a
  display cutout.** On an iPhone held sideways, iOS reserves a strip down *both*
  long edges. 39 of the 54 pixels of the SETTINGS button — the only permanent
  door to export, import, backup and print — were inside the right strip, and the
  app mark was wholly inside the left one, in the same frame. The header and the
  tab bar now inset their contents while their backgrounds keep painting to the
  edge, which is what a bar is supposed to do under a cutout. **And so do the six
  chrome blocks under the header** — the four alerts and the two banners — which
  had stayed at a flat 20px gutter while the bar 8px above them moved: the
  banner's dismiss ✕ had 32 of its 44 pixels inside the strip, a worse casualty
  than the SETTINGS button this repair was written for. The gutter is spelled
  once now, in `src/ui/shell/gutter.ts`, and the header and all six blocks read
  it. **What still starts at the physical edge is the whole Play column**, and on
  Play that includes the five 44×44 controls at the right-hand end of the sheet —
  MODS, the trait-help button and the three `+` steppers. Nobody has seen any of
  this on a real phone — see *Known to be wrong*.

### Known to be wrong

Kept here because a changelog that lists only the fixes describes a different
app. `BACKLOG.md` is the full account. The tablet layout **can** roll now, so
that line has gone from this list. What is still open, in order of what it costs
someone:

- **A card this build cannot name is drawn on the sheet, but never healed.** The
  ghost rows are there and the loadout cap counts them, which is the half a
  player sees. The other half — the sentence on the transfer screen promising
  that a missing card *"will resolve when the missing source is added"* — is a
  repair no code in the app performs. `BACKLOG.md` P1-6.
- **Two characters with the same name can still be created**, and a plain import
  of a genuinely different character with a colliding name still writes it. The
  rule holds on the rename control and on the *keep both* copy, and nowhere else.
  `BACKLOG.md` P5-1(c).
- **A roll result is still announced to nobody on a desktop.** On a phone the
  verdict is inside the button you pressed; on a desktop it renders into an inert
  panel with no live region anywhere near it. `BACKLOG.md` P2-6.
- **Typography is in pixels**, so the operating system's font-size setting does
  nothing to this app. `BACKLOG.md` P2-3.
- **The browser floor is written down nowhere**, and nine `color-mix()` values
  sit where no build target can reach them — eight was an undercount, `Play.tsx`
  holds two. `BACKLOG.md` P4-8.
- **On a touchscreen laptop every chip, stepper and die key is 34 pixels rather
  than 44.** The app asks the browser whether the *primary* pointer is a finger;
  a laptop with a touchscreen answers "mouse" while a finger is on the glass. The
  fix is one word in one media query and it changes every desktop surface in the
  app, so it is its own piece of work rather than a line slipped into somebody
  else's. `BACKLOG.md`, *Opened by the resolution audit*.
- **The display cutout is paid on the two bars and the six chrome blocks, and
  nowhere else.** The Cards filter rails, the GM bar and the whole Play column
  still lay out to the physical edge of the glass, which on a phone held sideways
  puts five 44×44 controls on Play entirely inside the strip — MODS, the
  trait-help button and the three `+` steppers, each at [796, 840] against a
  strip starting at 793. *(~~"paid on two bars and nowhere else … the banners and
  alerts across the top of every screen"~~ — **superseded**: the banners and
  alerts were closed after this list was written, and they were the half with a
  44×44 target in it.)* Same section of `BACKLOG.md`.
- **A typed damage die still has one way out.** The Duality dice got a cancel and
  an Escape key; the damage slots did not, so the two gestures now disagree.
  `BACKLOG.md` P3-12, half struck.
- **Nothing here has been seen on real hardware.** Every safe-area figure in this
  release — the home indicator, the notch, the side cutout — is a number this
  project assumed or substituted, not one read off a phone. `AUDIT-HANDOFF.md`
  §7 is the list of what a person with an iPhone and an iPad has to check, and
  it is the last thing that should happen before this is published.
