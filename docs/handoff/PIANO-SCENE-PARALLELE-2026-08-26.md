<!--
  Provenienza e stato di verifica — leggere prima del corpo.

  Questo documento è il prodotto di un workflow a quattordici agenti (run
  `wf_45c0308a-1a6`): quattro lettori in parallelo su store, runner, countdown e
  test; tre progetti indipendenti da angoli diversi; sei revisori avversari, due
  per progetto; una sintesi.

  NON È STATO PRESO PER BUONO. Nove delle sue citazioni sono state riaperte a
  mano contro l'albero al commit `27628f0` e sono tutte e nove esatte:
  `gmStore.ts:826` (lo scan degli indici di `spawn`), `GmSheet.tsx:126` (la riga
  del titolo da 44px), `SessionBody.tsx:351` (`disabled={onBoard ||
  item.environmentRef === null}`, verbatim), `campaignMigration.ts:215`,
  `SessionBody.tsx:71`, `campaignFile.ts` (`JSON.stringify(campaign)`),
  `gmStore.ts:742`, `session.ts:349`, `campaigns.ts:599` e `:1145`,
  `gmStore.ts:114`.

  QUELLO CHE IL PIANO HA CORRETTO A CHI SCRIVE. Due proposte fatte a voce al
  proprietario il 26 agosto sera erano sbagliate, e questo piano è ciò che le ha
  smontate:

    1. «Metti una striscia nuova in cima al runner». Costava 61px in un pannello
       da 498 dove una carta è 471.00, cioè annullava la piega della wave 5. La
       riga del titolo esiste già ed è la risposta.
    2. «Togli la copia, il runner punti alla riga». `spawn` cerca l'indice libero
       solo su `get().combatants`, quindi due righe possono portare entrambe un
       `acid-burrower-0`. La copia al salto è ciò che tiene sani gli id — era il
       punto forte, non quello debole.

  NON È STATO ESEGUITO NIENTE. Zero righe di codice di questa funzione esistono.
-->

# PARK, RESUME, FLIP — il piano

Tutto è ancorato a `/Users/simonealbanese/Documents/Daggerheart Companion`. Ogni cifra marcata **(derivata)** viene da dichiarazioni che ho letto in questa sessione e **non è mai stata in un browser**; le trovi tutte raccolte in §3.4.

**Spina dorsale: la versione `durable`** — il pointer sul board, il gruppo di helper puri in `shared/campaigns.ts`, lo switcher nella title row di `GmSheet` a costo zero. Su quella spina ho innestato sei cose, dette una per una dove stanno.

---

## 1. IL MODELLO, COME LO SI DIREBBE A UN GM

> Ogni scena di combattimento tiene il **suo** tavolo: i nemici che ci metti restano lì, con ogni ferita, ogni Stress e ogni riflettore, finché non sei tu a toglierli.
>
> Far partire una scena ti mette davanti il suo tavolo e posa in silenzio quello che avevi in mano, nella riga da cui era venuto — così due combattimenti possono essere a metà nello stesso momento e nessuno dei due perde un graffio.
>
> Un countdown può appartenere a una scena invece che alla campagna: allora sta sul vetro solo mentre quella scena è in corso, e — come sempre — non lo muove nient'altro che il tuo pollice.

---

## 2. LE TRE PARTI

### 2.1 PARK AND RESUME

#### Lo stato

`shared/campaigns.ts:501-508`, `GmBoard` guadagna un settimo campo:

```ts
  environmentRef: Ref | null;
+ /**
+  * The session row this fight came from, or null when it came from nowhere.
+  *
+  * Not derivable. `spawn` scans for a free index over `get().combatants` only
+  * (`gmStore.ts:826`), so the dungeon and the forest can both hold
+  * `acid-burrower-0` and an id intersection is ambiguous by construction. It
+  * is a `GmBoard` field and not a flag on the row because `GmLive` is exactly
+  * `GmBoard` + four (`gmStore.ts:114-120`) and `spread`/`gather` (:284-311)
+  * carry `GmBoard`'s fields and nothing else. A `live: boolean` on the row
+  * would need a dedupe pass on read, the way `primary` does at :1305-1322,
+  * and would need this same schema bump anyway.
+  *
+  * NOT the `board.region` exemption argued at :406-477. That exemption bounds
+  * itself - "whether they are widening THIS field or a different one" - and
+  * this is a different one.
+  */
+ liveScene: string | null;
```

`emptyBoard()` (`shared/campaigns.ts:599-606`) semina `liveScene: null`. `spread` (`gmStore.ts:284-295`) e il literal `board` di `gather` (`:304-311`) guadagnano una riga ciascuno. `src/store/campaignMigration.ts:215-216` costruisce un `GmBoard` a campi: è un errore di compilazione, e la risposta è `liveScene: null`.

**Il campo della riga non cambia.** `shared/campaigns.ts:338-344` dichiara già `combatants: SceneCombatant[]`, `readSessionItem` lo legge già a `:1145`, `serializeCampaign` (`src/transfer/campaignFile.ts:75-87`) fa `JSON.stringify` del record intero senza writer campo per campo, e `readArchivedSession` (`:1208-1225`) lo porta anche in archivio. **Lo storage del park costa zero.** È la ragione per cui questo piano è affrontabile.

#### La regola di vivacità, derivata e non memorizzata

```ts
/** The rows a GM is flipping between. */
export const liveScenes = (session: readonly SessionItem[], liveScene: string | null): SessionItem[] =>
  session.filter((i) => i.kind === 'scene' && (i.combatants.length > 0 || i.id === liveScene));
```

Nessun campo per lo switcher. Non può andare stale, sopravvive all'export gratis, una riga archiviata correttamente non è live perché non è in `session`, e cancellare una riga la toglie dalla strip senza cleanup. **Preso da `durable` §2.2 ed è la sua idea migliore.**

Nota: **solo `kind: 'scene'`**, mai `encounter`. `durable` includeva l'arm legacy; lo rifiuto in §4.4.

#### Le azioni di store

`src/ui/gm/gmStore.ts`, dichiarata accanto a `clearScene` (`:190`), implementata accanto a `:840`:

```ts
/** Park the board into the row it came from, and put this row's fight on it. */
runScene: (sceneId: string) => void;
```

```ts
runScene(sceneId) {
  const s = get();
  if (sceneId === s.liveScene) return;
  const target = s.session.find((i) => i.id === sceneId && i.kind === 'scene');
  if (target === undefined || target.kind !== 'scene') return;

  // Copy at BOTH crossings. `spread` hands the board's array in by reference
  // (:289) and `gather` hands it back (:308); every writer rebuilds the array
  // today, and one edit is all that stands between that and a row holding a
  // live handle. `newScene` copies its roster entries for the same reason
  // (`session.ts:349`, argued :305-307).
  const copy = (c: SceneCombatant): SceneCombatant => ({ ...c, hp: { ...c.hp }, stress: { ...c.stress } });

  // A board that belongs to no row is a fight a GM started from the bestiary.
  // It gets a home rather than being dropped: minting an untitled scene row is
  // better than today's anonymous board, and it is what `archive` will want.
  const minted = s.liveScene === null && s.combatants.length > 0
    ? newScene('', s.environmentRef)
    : null;

  const parkId = minted?.id ?? s.liveScene;
  const base = minted === null ? s.session : [...s.session, { ...minted, order: s.session.length }];

  const session = base.map((item) => {
    if (item.kind !== 'scene') return item;
    // Park: the board goes back to the row it came from.
    if (item.id === parkId) return { ...item, combatants: s.combatants.map(copy) };
    // Resume: the row hands its fight over and keeps no copy. Two copies of one
    // fight with different marks is a state no screen can draw honestly, and
    // `describeItem` would print the pre-flip count for the running scene.
    if (item.id === sceneId) return { ...item, combatants: [] };
    return item;
  });

  // ONE commit. Two leave a frame where the fight is in both places or in
  // neither, and `commit` re-derives `countdowns` only on the call that carries
  // `session` (:742). And it must be `commit`, never a bare `set`: this changes
  // the record AND the board, the opposite of the campaign-switch paths at
  // :999/:1035/:1122 where the record loaded IS what is on disk.
  commit({
    session: session.map((item, order) => ({ ...item, order })),
    liveScene: sceneId,
    combatants: target.combatants.map(copy),
    // Only when the row has one. `PUT THIS ON THE BOARD` is disabled at
    // `SessionBody.tsx:351` on exactly `item.environmentRef === null`; resume
    // must not walk through a door the app locks.
    ...(target.environmentRef !== null ? { environmentRef: target.environmentRef } : {}),
  });
},
```

**Cosa attraversa, e cosa no.**

| campo | park (board → riga) | resume (riga → board) | perché |
|---|---|---|---|
| `combatants` | ✅ | ✅ (la riga resta vuota) | il combattimento com'è combattuto; la riga è la sua unica altra casa |
| `environmentRef` | ❌ | ✅ solo se non-`null` | la riga **è il piano**. Il park che riscrive il piano è la falla fatale di `thrifty`: con il dungeon live, premere `PUT THIS ON THE BOARD` sulla riga FOREST (`SessionBody.tsx:351-353`, abilitato lì) mette Forest sul board, e il flip successivo lo parcheggia nella riga DUNGEON. `Bestiary.tsx:296` e `LinkArm` (`SessionBody.tsx:659`) non sono nemmeno gated. `KEEP WHAT IS ON THE BOARD` (`SessionBody.tsx:356-359`) resta l'unico verbo che scrive il piano |
| `roster`, `adjustments` | ❌ | ❌ | `SessionBody.tsx:70-74` lo rifiuta per nome: *"Folding the board write into it would have meant one button quietly overwriting a roster the GM was in the middle of building."* Tiene verde `tests/gm/sessionList.test.tsx:616` |
| `partyTier`, `fear`, `region` | ❌ | ❌ | sono della campagna |

Due modifiche ad azioni esistenti, ciascuna **un solo commit**:

```ts
// clearScene (:840). END SCENE deve arrivare anche alla riga, o il GM finisce
// il combattimento, gira e torna, e i morti sono tutti in piedi.
clearScene: () => {
  const s = get();
  commit({
    session: s.session.map((i) =>
      i.kind === 'scene' && i.id === s.liveScene ? { ...i, combatants: [] } : i),
    combatants: [],
    liveScene: null,
  });
},
```

```ts
// removeSessionItem (:938-944). Oggi non ha guardie: cancellare la riga da cui
// viene il combattimento lascerebbe il pointer penzoloni, e il park successivo
// e' un `.map` che non trova niente e butta il combattimento per terra - la
// perdita silenziosa che `SessionBody.tsx:55-58` rifiuta.
removeSessionItem(id) {
  const s = get();
  commit({
    session: s.session
      .filter((i) => i.id !== id)
      .map((i, order) =>
        i.kind === 'countdown' && i.sceneId === id ? { ...i, order, sceneId: null } : { ...i, order }),
    ...(s.liveScene === id ? { liveScene: null } : {}),
  });
}
```

Il board **non** viene svuotato: il GM ha cancellato una riga del piano, non ha chiesto di finire un combattimento. Il combattimento resta sul vetro, senza riga dietro — e il prossimo `runScene` gli conia una casa.

`newScene` (`src/ui/gm/session.ts:328-345`) resta invariato: `combatants: []` alla creazione. Cambia solo la *ragione* nel suo docblock (§7).

#### Il componente: `SceneArm`, `src/ui/gm/SessionBody.tsx:298-365`

Oggi disegna un `<select>`, un `Fact` e tre verbi, e non nomina `combatants` da nessuna parte — parcheggiare un combattimento lì lo metterebbe dove il GM non può vederlo. Guadagna `useApp` per gli adversary e un indice `byId`, come `EncounterArm` ha già a `:404`.

**I verbi, esaustivamente.** Uno solo è `primary`, sempre.

| condizione | label | azione | disabled | armato |
|---|---|---|---|---|
| `item.id === liveScene` | `OPEN THE SCENE` (primary) | `onOpenTool('scene')` | mai | no |
| `combatants.length > 0` | `BACK TO THIS FIGHT` (primary) | `runScene(item.id); onOpenTool('scene')` | mai | no |
| `combatants.length === 0 && spawnable.length > 0` | `START THIS FIGHT` (primary) | `runScene(item.id)`, poi `for (const e of spawnable) spawn(byId.get(e.ref)!, partySize, e.count)`, poi `onOpenTool('scene')` | mai | no |
| `combatants.length === 0 && spawnable.length === 0` | `OPEN THE SCENE` (primary) | `onOpenTool('scene')` | mai | no |
| `combatants.length > 0` | `CLEAR THIS FIGHT` → `TAP AGAIN TO CLEAR` | `patchSessionItem(item.id, { combatants: [] })` | mai | **sì, 4 s** |
| — | `PUT THIS ON THE BOARD` | invariato | `onBoard \|\| item.environmentRef === null` (`:351`, invariato) | no |
| — | `KEEP WHAT IS ON THE BOARD` | invariato | `item.environmentRef === live` (`:357`, invariato) | no |

`START THIS FIGHT` è **un innesto mio, e risolve il bootstrap che tutti e tre i progetti mancano**: una riga FOREST pianificata ma mai combattuta ha `combatants: []`, non è live, e non è sulla strip. Senza questo verbo, iniziare il secondo combattimento costa ancora i cinque gesti. Con questo, costa cinque gesti **una volta per split**, e un tap per beat da lì in poi — che è esattamente il modello di costo che l'owner ha descritto. È lo stesso loop di `openFight` (`SessionBody.tsx:431-434`), spostato sull'arm che può ancora essere creato.

`CLEAR THIS FIGHT` risponde all'edge case che nessuno dei tre aveva: **niente svuota un combattimento parcheggiato**. Senza, la strip cresce monotonicamente per tutta la sera. Il verb row di `SceneArm` è `flexWrap: 'wrap'` (`:349`), quindi un quarto verbo non ha il problema di larghezza del footer di `SessionRow`.

**I `Fact`.** `SessionBody.tsx:344-345` oggi dice *"the scene runner shows whatever environment is on the board right now, **which is one per campaign**"* — falso dopo questo lavoro, e **non pinnato da nessun test** (`tests/gm/sessionList.test.tsx:358` asserisce solo `'This is the plan'`). Sostituito da:

- sempre: `This is the plan. Running this scene puts its environment on the board; parking it leaves whatever is there.`
- `combatants.length > 0` e non live: `Parked here: {n} adversar{y|ies}, with their marks. BACK TO THIS FIGHT puts them back exactly as they were, and parks whatever is on the board into its own row.`
- live: `This scene is on the board. Its adversaries and their marks are on the table, not in the plan, until you run another scene or end this one.`

**`describeItem`, `src/ui/gm/session.ts:202-224`.** Il caso `scene` guadagna un terzo termine, `{n} PARKED`, unito con le stesse regole di `:204-212` (mai due segmenti che dicono la stessa cosa). Poiché il resume **svuota** la riga, la riga live legge `combatants.length === 0` e stampa solo `PLANNED`: non c'è mai un numero stale nel piano, e **la firma di `describeItem` non cambia** — quindi nessuno dei suoi ~20 call site nei test si muove. È l'innesto che rende onesta la lista senza allargare l'API.

---

### 2.2 LO SWITCHER

#### Dove: la title row di `GmSheet`, `src/ui/gm/GmSheet.tsx:259-282`. **Costo verticale 0.00px.**

Un nuovo prop opzionale:

```ts
// GmSheet.tsx:209-219
+ /** Replaces the visible title. `label` stays the dialog's accessible name. */
+ title?: React.ReactNode;
```

e a `:268-270`, `{title ?? <span className="t-label" style={{ flex: 1, minWidth: 0, color: 'var(--text-2)' }}>{label}</span>}`. Opzionale, quindi gli altri sette tool e tutti gli sheet non sono toccati. `useDialog(label, …)` (`:222`) tiene `label` come nome accessibile del dialog.

**Il ✕ resta dov'è.** Non lo sposto in fondo al pannello come fa `ergonomic`: quel piano lo mette a y 756.00 con `GmBar` che inizia a 757.00 — **1.00px** dai tre target di navigazione da 131×60, e `Gm.tsx:304` mette `inert` solo sul wrapper della `SessionList`, non sulla barra. Un tap basso sul chip più a sinistra apre ADD sopra il combattimento. `GmSheet.tsx:150-155` — *"a right thumb slides up the right edge"* — resta in vigore, invariato.

#### Il componente: `src/ui/gm/SceneSwitcher.tsx`

Legge lo store, non prende props. Montato da `src/ui/gm/Gm.tsx:309` solo per `tool === 'scene'`.

Root: `<div className="row" style={{ flex: 1, minWidth: 0, gap: 6, overflowX: 'auto' }}>`. Chip: **non** il `Chip` di `GmTopBar.tsx:186-212` — quello è `flex: 'none'` senza `overflow`/`textOverflow` (verificato a `:201-206`) e non tronca. Un `SceneChip` locale, `flex: 'none'`, `minHeight: 44`, `padding: '0 10px'`, `letterSpacing: '0.1em'`, `maxWidth: cap`, `overflow: hidden`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'`.

**Ogni label, esaustivamente.** In `order`, mai per recency: una strip che si riordina sotto il pollice è l'unica cosa che la memoria muscolare non può usare.

| N live | cosa si disegna | target |
|---|---|---|
| 0 | niente; la `.t-label` di oggi, `The live scene` | — |
| ≥ 1 | un chip per ogni riga live | ogni chip **tranne** quello corrente |

| stato del chip | visibile | nome accessibile | elemento |
|---|---|---|---|
| in corso (`id === liveScene`) | nome maiuscolo troncato, `background: var(--hope)`, `color: var(--app)`, `aria-current="true"` | il nome intero, come testo | **`<span>`, non un bottone** |
| parcheggiato | nome maiuscolo troncato, `background: var(--raised)`, `color: var(--muted)` | `Run {nome intero}` | `<button>` |
| riga senza nome | `SCENE` (`sessionTitle`'s invented arm, `session.ts:99-110`) | `Run this scene` | `<button>` |

**Nessuno stato `disabled`, in nessun punto della strip.** `Countdowns.tsx:427` — *"a button that can be pressed and does nothing is the worse of the two lies."* Ma il chip corrente **non è nemmeno un bottone disabilitato**: dentro il runner non ha azione, quindi è un'etichetta e viene disegnato come tale. `durable` lo faceva `disabled` con `aria-current`, che su alcuni screen reader non viene annunciato affatto; `<span>` sì. Il nome intero sta nel testo, non in un `title` — un `title` è un affordance da mouse su un dispositivo senza mouse, ed è la critica che `ergonomic` §7 muove a sé stesso.

**Nessuna conferma, nessun arming sul flip.** Il flip non distrugge niente — è l'intero motivo per cui lo storage esiste — e una conferma raddoppierebbe il costo dell'unico gesto per cui la feature esiste.

`GmTopBar`'s `SCENE · {n}` chip (`:111-114`) resta identico e continua a leggere il board. Non dice *quale*; lo dice la strip, un tap dopo. `tests/gm/gmScreen.test.tsx:252` passa invariato.

---

### 2.3 COUNTDOWN PER SCENA

#### Lo stato

`shared/campaigns.ts:367`:

```ts
- | (SessionItemBase & { kind: 'countdown'; countdown: Countdown; primary: boolean })
+ | (SessionItemBase & {
+     kind: 'countdown';
+     countdown: Countdown;
+     primary: boolean;
+     /**
+      * The scene row this clock belongs to, or null for the campaign's own.
+      *
+      * On the ROW, beside `primary`, and never a `countdowns: Countdown[]` on
+      * the scene row: :628-636 refuses the second array by name, and a clock is
+      * a plan row with a home already. (`combatants` on the scene row is not the
+      * same case - combatants are not plan rows and have no other home.) Not on
+      * `Countdown` in `shared/types.ts` either: `primary` is up here for the
+      * same reason, and the two are repaired together.
+      *
+      * INVARIANT: `sceneId !== null` implies `primary === false`.
+      */
+     sceneId: string | null;
+   })
```

**L'invariante è imposta da due writer totali, non da una convenzione della UI.**

```ts
// shared/campaigns.ts:654-657, one clause
  session.map((item) =>
    item.kind === 'countdown'
-     ? { ...item, primary: item.id === id }
+     ? { ...item, primary: item.sceneId === null && item.id === id }
      : item,
  );

// new, beside it
/** Give a countdown row to a scene, or back to the campaign. Clears its pin. */
export const withSceneScope = (session: SessionItem[], rowId: string, sceneId: string | null): SessionItem[] =>
  session.map((item) =>
    item.kind === 'countdown' && item.id === rowId
      ? { ...item, sceneId, primary: sceneId === null ? item.primary : false }
      : item,
  );
```

Servono **entrambi**. La clausola in `withPrimaryCountdown` è l'innesto da `ergonomic` §2b; da sola lascia un buco che un giudice ha trovato — `setCountdownScene` non passa da `withPrimaryCountdown`, quindi scopare un orologio già pinnato lo lascerebbe `primary: true` sul vetro fino al reload. `withSceneScope` è l'innesto da `durable` §2.2 e chiude quel buco. Nessuna delle due strada può creare lo stato proibito.

`addCountdown` (`gmStore.ts:846-888`) semina `sceneId: null` accanto a `primary: false` (`:864`), per la ragione che il suo stesso commento dà a `:876-880` sulla triade.

#### L'azione di store

```ts
setCountdownScene: (rowId, sceneId) => commit({ session: withSceneScope(get().session, rowId, sceneId) }),
```

#### Chi legge cosa — la tabella che non deve andare alla deriva

| superficie | legge | cambio |
|---|---|---|
| `GmTopBar.tsx:109` `primaryCountdownOf(session)` | **invariato**, unico call site | un orologio scoped non può essere primary, quindi è già solo di campagna. **La top bar non impara mai quale scena è in corso.** |
| `Countdowns.tsx:177` | `countdowns` (tutti) | raggruppati: prima la campagna, poi una sezione per scena, in `order`, testata della scena live in `var(--hope)` |
| `RestControl.tsx:126` | `countdowns` (tutti), `.filter(kind === 'long-term')` | **filtro invariato.** Un riposo è un evento di campagna; l'SRD dà al GM *"advance a long-term countdown of their choice"* e quella scelta è su tutti. Ogni voce guadagna il nome della scena come suffisso. Restringere qui è la regressione senza messaggio d'errore |
| `SessionList` | ogni riga, sempre | il piano resta completo; il caso `countdown` di `describeItem` (`session.ts:244-249`) guadagna ` · {SCENA}` |
| il runner | `countdownsIn(session, liveScene)` | **è tutta la feature** |
| l'export | il record intero, `JSON.stringify` | nessun cambio |

```ts
/**
 * The countdowns one scope owns. `null` is the campaign's own.
 *
 * `countdownsOf` KEEPS its meaning - every clock in the campaign - because
 * three callers depend on that: the store's derived `countdowns`
 * (`gmStore.ts:294,742`), the export, and the long rest. Scope is an argument
 * at a call site and never a narrowing of what "the campaign's countdowns"
 * means. A `countdownsOf(session, sceneId)` would take the forest's long-term
 * clock off the list a rest may advance, with no error message.
 */
export const countdownsIn = (session, sceneId) => …
```

#### Il componente: `CountdownArm`, `src/ui/gm/SessionBody.tsx:712-…`

| controllo | disegnato quando | label | disabled |
|---|---|---|---|
| `<select>` `BELONGS TO` | esiste ≥ 1 riga `scene` | `The campaign` (`value=""`) + `sessionName(row)` per ogni riga scena; `aria-label={\`BELONGS TO — ${row}\`}` (l'idioma già a `:322`) | mai |
| un `<Fact>` al suo posto | nessuna riga scena | `There are no scenes to belong to yet.` | — (non offerto, non disabilitato — `Countdowns.tsx:280-287`) |
| `PIN IT TO THE TOP BAR` / `PINNED TO THE TOP BAR` | `sceneId === null` | invariato (`:846-853`) | mai |
| un `<Fact>` al suo posto | `sceneId !== null` | `This clock belongs to {SCENA}. It is on the glass while that scene is running, and it is not on the top bar — the top bar is the campaign's.` | — |
| un secondo `<Fact>` | `sceneId !== null && kind === 'long-term'` | `A long rest can still advance it. Resting is the campaign's, not a scene's, so this clock is on the rest's list wherever the party is.` | — |

Lo scaffale dei template (`Countdowns.tsx:280-287`) continua a non pinnare, e ora non scopa nemmeno: un drop è di campagna, e lo scope si sceglie sulla riga.

#### Il blocco nel runner

Un figlio `flex: 'none'` dello stack di `Scene.tsx:88`, subito sotto la `EnvironmentBand` (`:89-91`). Una riga da 44px per orologio: nome in `.t-label`, `−` 44×44, valore `minWidth: 62`, `+` 44×44 — gli stessi cinque termini che `PrimaryCountdown` dichiara (`GmTopBar.tsx:226-277`), così le mani conoscono già la forma. **Mai `.t-dense`**: `costLine()` in `sceneTruth.test.tsx:569` e in `sceneConfirmation.test.tsx` esige *esattamente un* `p.t-dense` in tutto l'albero di Scene.

Costo: **54.00 di contenuto scrollabile per orologio** (44 più il gap 10 dello stack), **0.00 di viewport**, **0.00 alla card** — la griglia è `flex: 'none'` con `gridAutoRows: 'max-content'` (`Scene.tsx:310-318`), dimensionata dalle sue card e da nient'altro.

**Niente ticchetta.** Non al park, non al resume, non a END SCENE, non all'archiviazione. `Countdowns.tsx:4-8` — *"a countdown that ticks on its own is one you stop trusting. So: plus and minus, and nothing else."* Lo scope cambia raggiungibilità e attenzione, mai aritmetica. Va scritto nel docblock, perché è la prima ottimizzazione che qualcuno proporrà.

---

## 3. LA GEOMETRIA

### 3.1 Costo verticale: 0.00px, e chi paga

La title row del pannello è già alta 44. Ho letto le dichiarazioni:

- `.row` è `display:flex; align-items:center; gap:var(--s3)` con **nessun min-height e nessun `flex-wrap`** (`src/ui/base.css:287-291`);
- il suo figlio più alto è il ✕, `width: 44, height: 44` inline (`GmSheet.tsx:275-281`);
- la `.t-label` che sostituisco è già `flex: 1, minWidth: 0` (`GmSheet.tsx:268`).

Quindi chip a `minHeight: 44` non aggiungono **niente**, e la strip è un drop-in nello slot che già si restringe: non può spingere fuori il ✕ e non può andare a capo.

**Lo stage 548.00 / 498.00 (`GmSheet.tsx:78-84`, `SessionList.tsx:62-63`), la card da 471.00 e i 27.00 di margine (`Scene.tsx:451-455`) sono intatti.** Nessuna cifra di `Scene.tsx` si muove, quindi `tests/ui/gmGeometryProse.test.ts:1191`, `:1307`, `:1360`, `:794`, `:813` restano verdi.

### 3.2 Perché **non** la row B di `GmTopBar`, che è la scelta di `thrifty`

L'ho verificata e **si rompe in silenzio a tre chip**, in un modo che jsdom non può vedere. `.row` non ha `flex-wrap`; `Chip` è `flex: 'none'` (`GmTopBar.tsx:201`); e il root di `FearBar` è `<div className="row" style={{ gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>` (`src/ui/gm/FearPool.tsx:103`) — **l'unico elemento comprimibile della riga**, con tutti figli fissi. Tre o quattro chip non mandano a capo la riga e non la fanno scrollare: comprimono la scatola di Fear sotto il suo contenuto, e con `justifyContent: 'flex-end'` l'overflow esce dal **bordo iniziale** — il `−` di Fear e parte del readout scivolano sotto i chip e fuori dai 393px. Le 24 runtime case di `tests/gm/fearOnTheGlass.test.tsx` asseriscono *presenza*, non posizione: resterebbero verdi mentre un controllo esce dallo schermo. Lo scenario dell'owner ha quattro scene di combattimento. La row B è esclusa.

### 3.3 Costo orizzontale, a 393×852

```
391.00  contenuto del pannello (393 − 2 di border, GmSheet.tsx:255, box-sizing globale a base.css:13;
        e GmSheet.tsx:240-242 dice "every column measured inside this panel still divides 391")
− 20.00  padding della title row, '0 6px 0 14px'  (GmSheet.tsx:264)
−  0.00  la .keycap ESC: `display: none` fuori da (hover:hover) and (pointer:fine)
         (base.css:382-397), quindi su coarse non e' un flex item e non costa nemmeno il suo gap
− 44.00  il ✕
− 12.00  un gap
= 315.00  per la strip
```

**Metrica per carattere: 7.0px.** `.t-meta` è `500 10px/1 var(--mono)` (`src/ui/tokens.css:608-610`), `SceneChip` sovrascrive `letterSpacing: '0.1em'` → 0.6em + 0.1em = 7.0px, più 20 di padding. **Corroborata da due punti misurati in Chrome nello stesso repo**, `SessionRow.tsx:81-93`: `DELETE` = 62 a 6 caratteri (6×7+20 = 62 ✓) e `TAP AGAIN TO DELETE` = 153 a 19 caratteri (19×7+20 = 153 ✓). Due fit esatti indipendenti. Resta da confermare che il padding di 20 valga anche qui (§3.4).

**Il cap adattivo**, `Math.max(74, Math.floor((315 - 6 * (N - 1)) / N))`:

| N live | cap per chip | caratteri visibili | verdetto |
|---|---|---|---|
| **1** | 315 | 42 | targa: il runner dice finalmente *quale* combattimento è, cosa che la title row non ha mai fatto |
| **2** | 154.50 | **19** | `DUNGEON` 69 + gap 6 + `FOREST` 62 = **137.00 in 315.00, 178.00 di avanzo.** Lo scenario dell'owner, un tap, un solo target, sempre nello stesso posto |
| **3** | 101.00 | 11 | comodo |
| **4** | 74.25 | **7** | `DUNGEON` è esattamente 7. Il pavimento. Tutti e quattro sul vetro, ancora ≥44 in entrambi gli assi |
| **5+** | 74.00 (floor) | 7 | **non ci stanno.** `overflowX: 'auto'`, **zero px verticali**, e il flip diventa una strisciata più un tap |

A N=5 non mando a capo su una seconda riga: costerebbe 44.00 allo scroller e riflusso sotto il pollice nel momento peggiore. Il degrado è una strisciata, dichiarato e non nascosto. Un GM con cinque combattimenti simultanei su un telefono da 393px ha un problema che quest'app non può risolvere col design.

### 3.4 Il numero che nessuno ha scritto, e che regge tutto

Il 498 è lo **stage**, cioè il border box del pannello di `GmSheet`. Fra lui e le card ci sono, per dichiarazione: 2.00 di border del pannello (`GmSheet.tsx:255`), 44.00 di title row e 1.00 del suo `borderBottom` (`:264`), poi lo scroller a `flex: 1, minHeight: 0, overflowY: 'auto'` (`:314`).

**Lo scroller è 451.00 con un countdown pinnato e 501.00 senza. (derivata)**

| | stage | scroller | card 471.00 | Minion 484.00 | custom 509.00 |
|---|---|---|---|---|---|
| senza pin | 548.00 | **501.00** | +30.00 | +17.00 | −8.00 |
| con pin | 498.00 | **451.00** | **−20.00** | −33.00 | −58.00 |

I *"27.00 left over"* di `Scene.tsx:455` sono la card contro lo **stage**, non contro lo scroller. **Con un countdown pinnato, il difetto di `Scene.tsx:403-409` — "THERE IS NO SCROLL POSITION AT WHICH A WHOLE CARD IS ON THE GLASS" — è vivo oggi, prima di questo lavoro.** Questo piano non lo crea e non lo aggiusta. L'unico effetto che ha è comportamentale e piccolo: un orologio scoped non può essere pinnato, quindi la ragione più comune per cui un GM con il gruppo diviso avrebbe pinnato la marea sparisce, e la row C è assente più spesso. Non lo spaccio per geometria.

### 3.5 Cosa va misurato in Chrome prima di spedire

Tre numeri. Sono un **gate sulla lane 2**, non sulle lane 0 e 1.

1. **Lo scroller: 451.00 e 501.00.** Non è dichiarato da nessuna parte in `src/` né in `tests/`, e non è pinnato in nessuna direzione. Va misurato a 393×852, inset 47/34, pointer coarse. Attenzione a `tests/ui/gmGeometryProse.test.ts:1446`: le cifre ritirate 558 / 534 / 504 possono comparire solo dentro virgolette doppie, quindi una nuova misura che atterra su una di quelle fallisce per nome.
2. **Il costo per carattere del `SceneChip` dentro la title row.** I 7.0px/car sono corroborati due volte dal footer di `SessionRow`, ma quel bottone non è questo chip. A 7.4 il chip a N=4 tiene 7 caratteri senza margine; a 6.6 ne tiene 8. **Il cap a 7 caratteri per N=4 non va trattato come vero finché non è misurato.**
3. **Il footer armato di `SessionRow`** dopo il cambio di §4.6 — `TAP AGAIN TO DELETE THE FIGHT` è 29 caratteri ≈ 223.00 nei 349.00 dichiarati a `SessionRow.tsx:80-84`.

Una quarta cosa da guardare ma non da bloccare: la `EnvironmentBand` è 74.00 / 89.00 / 104.00 a una/due/tre righe di impulse (`StatBlock.tsx:240-276`), quindi dungeon e foresta non concorderanno e il top della prima card si sposta fino a 30px a ogni flip. È riflusso di *contenuto* dentro lo scroller, non di viewport, e lo scroller non cambia mai altezza — ma va detto, perché è la stessa famiglia di obiezione per cui ho rifiutato di svuotare la row C.

---

## 4. GLI EDGE CASE, TUTTI

### 4.1 Il board che non appartiene a nessuna riga viene distrutto in silenzio

Era la falla fatale di `durable`, ed è raggiungibile in due modi normali: `Bestiary.tsx:275-276` fa `spawn` sul board senza riga, e la regola di cancellazione di §2.1 crea esattamente quello stato. Un `runScene` che parcheggia con `item.id === liveScene` non trova niente quando `liveScene === null`, e il `commit` sovrascrive `combatants`.

**Risposta: `runScene` conia la riga.** `newScene('', s.environmentRef)` (`src/ui/gm/session.ts:328-345`; nessun ciclo di import — `session.ts` importa solo da `shared/` e da `engine/`, verificato ai suoi `import` di `:26-36`). Un nome vuoto è legale (`SessionItemBase.name`: *"Never generated; an empty one stays empty"*) e `sessionTitle` lo disegna come `SCENE` (`session.ts:99-110`), quindi il piano guadagna una riga onesta e rinominabile. **L'app fa una casa invece di chiedere il permesso di distruggere.** Preso da `ergonomic` §5 e da `durable` §7, che lo argomentava e poi non lo adottava.

### 4.2 Due copie dello stesso combattimento

Era la seconda falla fatale di `durable`: `runScene` copiava sul board e lasciava la copia sulla riga, così l'export portava lo stesso combattimento due volte con marchi diversi. **Il resume svuota la riga di destinazione** (§2.1). `liveScenes` porta già `|| i.id === liveScene` esattamente per quel caso.

### 4.3 `environmentRef` scritto da tre controlli che non sanno niente delle righe

Verificato: `setEnvironment` ha tre call site senza contesto di riga — `Bestiary.tsx:296`, `SessionBody.tsx:350`, `SessionBody.tsx:659`. Il park di `thrifty` li trasformava tutti in corruttori silenziosi del piano. **Il park non scrive mai `environmentRef`.** Il resume lo scrive solo se la riga ne ha uno, che è la stessa condizione con cui `PUT THIS ON THE BOARD` è abilitato (`SessionBody.tsx:351`).

### 4.4 `OPEN THE FIGHT` unisce due combattimenti

Verificato a `SessionBody.tsx:431-434`: `openFight` fa `for (const entry of spawnable) spawn(...)` e non pulisce; la riga lo dice già a `:547-552`. Con il dungeon live, premerlo su un'altra riga versa i suoi nemici dentro il dungeon.

**Guardia: `disabled={liveScene !== null && liveScene !== item.id}`**, con un `Fact`: `The board is running {SCENA}. Run this row instead, or end that fight first.` È l'unico path che appende, ed è su `EncounterArm` (`:369`), l'arm che nulla può più coniare (`campaigns.ts:271-277`, `:346-359`).

**`runScene` accetta solo righe `scene`.** `durable` accettava anche `encounter`; lo rifiuto: quell'arm non ha `environmentRef`, quindi il resume aprirebbe il combattimento nel posto della scena precedente — testualmente il difetto che `shared/campaigns.ts:330-331` dice essere la ragione per cui lo schema 3 ha assorbito il combattimento nella riga scena. Conseguenza voluta: il `Fact` di `SessionBody.tsx:538-545` (*"No control here brings those marks back"*) resta **vero alla lettera** sulle righe encounter, e `tests/gm/sessionList.test.tsx:389` — che semina `kind: 'encounter'` a `:393` — **passa invariato**. La decisione sopravvive sul tipo che non può essere creato ed è superata solo su quello che può: il confine più pulito disponibile.

### 4.5 Iniziare il secondo combattimento

Nessuno dei tre progetti lo risolve: una riga pianificata e mai combattuta non è live, quindi non è sulla strip. `START THIS FIGHT` su `SceneArm` (§2.1) lo risolve. Cinque gesti una volta per split, un tap per beat dopo.

### 4.6 Cancellare una riga con un combattimento parcheggiato

Tre pezzi, tutti nello stesso commit di §2.1:

1. **La riga live**: `liveScene → null`, il combattimento resta sul vetro. Il GM ha cancellato una riga del piano, non ha chiesto di finire un combattimento.
2. **La riga deve dire cosa tiene, prima che DELETE possa distruggerlo onestamente.** Oggi non dice niente: `SceneArm` non nomina `combatants` e `describeItem` legge solo `roster`. Risolto dai `Fact` di §2.1 e dal `· {n} PARKED` in `describeItem`.
3. **`armedLabel` (`SessionRow.tsx:176-181`) guadagna un terzo arm**: `TAP AGAIN TO DELETE THE FIGHT` quando `item.kind === 'scene' && item.combatants.length > 0`, prima del caso `unreadable`.

**E questo forza un secondo cambio, che è un miglioramento netto.** Con la metrica del file stesso — `DELETE` 62, `TAP AGAIN TO DELETE` 153, quindi 7.0px/car — 29 caratteri sono **223.00**, e il footer armato sarebbe `MOVE UP` 69 + `MOVE DOWN` 83 + 223 = **375 su 349: va a capo**, cioè il difetto che `SessionRow.tsx:86-94` ha misurato e rifiutato per RENAME. Quindi: **MOVE UP e MOVE DOWN escono mentre `armed`, incondizionatamente, accanto a RENAME.** Il footer armato diventa il solo bottone: 223 ≤ 349 ✓, i 153 di oggi ✓, e **i 251 della riga `unreadable` — che `SessionRow.tsx:93-95` registra come già a capo — smettono di andare a capo.** Regola incondizionata, quindi la forma del footer non dipende mai da stato che il GM non sta guardando, che è l'obiezione di `Scene.tsx:66-79`. Da rimisurare (§3.5).

### 4.7 Riordinare le righe a combattimento in corso

`moveSessionItem` (`gmStore.ts:946-953`) è sicuro com'è: l'identità è `item.id`, l'oggetto spostato è lo stesso riferimento, `combatants` viaggia con lui. Due conseguenze. **Nessun pointer può mai essere un indice**: `readCampaignRecord` riordina per `order` (`:1323`) e rinumera (`:1342`) a ogni load, quindi `order` non è identità stabile fra un reload e l'altro — solo `id` lo è. Entrambi i campi nuovi sono id. E la strip si riordina — ma non può succedere sotto il pollice: `Gm.tsx:304` mette `inert` sul wrapper della `SessionList` mentre un tool o uno sheet è aperto, quindi **il piano non è trascinabile mentre la strip è sul vetro**.

### 4.8 Un countdown la cui scena viene cancellata

Due strati, entrambi degradano a scope di campagna e mai a niente. A runtime, `removeSessionItem` azzera `sceneId` su ogni riga che nominava quella cancellata, nello stesso commit — senza, l'orologio sarebbe invisibile fino al prossimo lancio. A freddo, la riparazione del reader (§5). Stessa politica dell'arm `unknown` di `LinkTarget` (`campaigns.ts:786-792`) e di `Countdown.owner` (`shared/types.ts:580-587`): mai svuotare in silenzio i dati del GM, mai lasciare una riga irraggiungibile. E **non** viene ri-pinnato: un countdown non diventa primary per un incidente di cancellazione.

### 4.9 Il countdown primary che appartiene a una scena parcheggiata

**Strutturalmente impossibile**, imposto a tre estremi (§2.3). Le due alternative sono peggiori e la seconda sembra ovvia: *continuare a disegnarlo* mette la marea nel dungeon, che è ciò che la parte 3 rifiuta; *svuotare la row C mentre la scena è parcheggiata* farebbe oscillare la barra 159.00 ↔ 109.00 e lo stage 498.00 ↔ 548.00 **a ogni beat** — 50px di riflusso sotto il pollice nel momento in cui il pollice è occupato.

Il guadagno è geometrico ed è la ragione per farlo così: **`GmTopBar` è 109.00 oppure 159.00 per tutta la sera e non oscilla mai**, quindi il budget del runner è una costante nota (27.00 con un pin, 77.00 senza) invece di qualcosa che cambia per beat. `primaryCountdownOf` tiene firma e unico call site (`GmTopBar.tsx:109`).

### 4.10 Spawnare dal bestiario mentre due scene sono live

`spawn` (`gmStore.ts:820-831`) scrive solo `board.combatants` — **invariato, zero codice**. Il nemico entra nel combattimento sul board, che è la scena in corso, e si parcheggia con lei al flip successivo.

**Le id collidono fra righe ed è innocuo, ma solo per costruzione.** La scansione dell'indice libero a `:826` corre sul board soltanto, quindi dungeon e foresta possono tenere entrambi `acid-burrower-0`. Le due liste non si fondono mai, perché `runScene` **sostituisce** il board e non appende mai, e l'unico path che appende è guardato (§4.4). Niente nel type system lo dice: **va scritto in una frase accanto al campo**, perché qualunque feature futura che legga fra righe (una vista d'archivio, un "sposta questi in quella scena") collide esattamente.

### 4.11 Un combattimento parcheggiato i cui `adversaryRef` hanno lasciato il dataset

`SceneCombatant` (`shared/types.ts:607-619`) è autosufficiente per hp/stress/thresholds/difficulty/name, e `Scene.tsx:325` passa `adversary={byRef.get(c.adversaryRef)}`, cioè `undefined`-tollerante. **Nessun marchio si perde.** Ma la riga attacco da 46px è derivata dall'adversary, quindi una card orfana ha un'altezza che i nove termini di `Scene.tsx:451-455` non pinnano. È preesistente — e il park è ciò che trasforma uno stato raro in uno di routine, perché un combattimento ora può stare fermo per settimane attraverso un cambio di dataset. **Serve la frase, non ho la misura.** Non blocca lo ship.

### 4.12 Righe archiviate che portano `sceneId`

`readArchivedSession` (`campaigns.ts:1208-1225`) passa ogni riga archiviata per lo stesso `readSessionItem`, quindi un countdown archiviato porterà un `sceneId`. Le riparazioni girano su `session` e non su `archive`, quindi un orologio archiviato scoped tiene un pointer penzoloni per costruzione. **Innocuo oggi solo perché niente in `src/` scrive `archive`** (verificato: `gather` lo porta solo via `...base`). La riparazione è scritta come **una funzione che prende `session` e restituisce `session`**, in un punto solo, così qualunque cosa chiuda una serata la chiama. È l'argomento migliore di `durable` §5 ed è il motivo per cui vale la pena scriverla come pass e non come due `if`.

### 4.13 Le due che non hanno una buona risposta, e lo dico

**Due tab sulla stessa campagna.** Il debounce da 400 ms e il last-write-wins esistevano già per il board; il park mette combattimenti anche sulle righe, quindi il flush di un tab stantio può ora sovrascrivere un combattimento **parcheggiato** che non ha mai visto. ~~È una classe di perdita che prima non c'era.~~ **Corretto il 27 agosto 2026, corsia A4: questa frase è falsa, e la classe di perdita c'era già.** `gather` (`src/ui/gm/gmStore.ts`, `const gather = (base, live, at)`) non scrive un campo per volta: costruisce il record **intero** — `...base`, `updatedAt`, `fear`, `session`, `party` e tutto `board` — e `putCampaign` lo sostituisce. Lo fa **in questa forma da sempre**: `gather` nasce in `33d7c63` — *«Take the GM's board out of localStorage, and give them more than one table»*, il commit in cui questo store ha cominciato a scrivere un record di campagna, la forma del record essendo arrivata un commit prima in `c392d0e` — e ci nasce già con `...base`, `fear`, `session`, `party` e `board` interi. `session` è dentro quel record dalla prima riga che lo store ne abbia mai scritta. Quindi il flush di un tab stantio può già oggi cancellare una riga rinominata, un roster rifatto, un countdown avanzato — e, dallo schema 3 (23 agosto, `DECISIONI-2026-08-23.md` §1, che ha dato alla riga scena i suoi `combatants`), anche un combattimento su una riga. **Quello che il park cambia non è cosa si può perdere: è quanto pesa perderlo**, un combattimento a metà con ogni ferita segnata invece di un nome e un roster. Non propongo coordinamento: sarebbe una feature a sé. **Va registrato come rischio accettato, non risolto** — e va registrato per quello che è, cioè vecchio, perché «classe nuova» è la parola che fa sembrare il park la causa di una cosa che il park al massimo aggrava.

**Due chip con la stessa etichetta.** Due scene senza nome danno due chip che dicono `SCENE`; a N=4, `The Dungeon` e `The Dungeon Below` si troncano entrambe a 7 caratteri. Il nome intero è nel nome accessibile e nel runner, ma sul vetro sono identici. **Non ho una risposta a 74.25px di larghezza.** L'app non può aggiustarlo e non fingerà di poterlo fare.

---

## 5. IL READER: UNA PASS, UNA POLITICA, UN POSTO

Nuova, in `readCampaignRecord`, **prima** della dedupe di primacy (`shared/campaigns.ts:1313-1322`) e con il suo risultato che alimenta il resto:

```ts
/*
 * Two pointers into this list, answered together.
 *
 * `board.liveScene` and a countdown row's `sceneId` both name a row by id, and
 * both are reachable dangling: a hand-edited file, a row deleted by a build
 * that did not know about the pointer, two builds writing one campaign. ONE
 * pass rather than an `if` beside each field, because the third pointer is
 * coming - an archived sitting's source, a nested row's parent - and three
 * policies in three places is how they diverge.
 *
 * DEGRADE, NEVER VANISH: a clock whose scene is gone becomes the campaign's,
 * visible everywhere, which is `LinkTarget`'s `unknown` policy (:786-792) and
 * `owner`'s (`types.ts:580-587`).
 *
 * The set is EVERY row's id, not every scene row's. An `unreadable` row keeps
 * its id (:1186) precisely so a build that cannot parse it still cannot lose
 * it; nulling a pointer at one and letting `writeAside` write that back is how
 * that arm's whole purpose gets defeated.
 */
const rowIds = new Set(session.map((i) => i.id));
const scoped = session.map((item) => {
  if (item.kind !== 'countdown' || item.sceneId === null) return item;
  if (!rowIds.has(item.sceneId)) {
    warn('a countdown belonged to a scene this campaign no longer has, so it is the campaign’s again');
    return { ...item, sceneId: null };
  }
  if (item.primary) {
    warn('a countdown was both pinned to the top bar and given to a scene, so the pin was cleared');
    return { ...item, primary: false };
  }
  return item;
});
```

**L'ordine è obbligatorio e `thrifty` lo sbagliava** dicendo che le due riparazioni sono indipendenti. La dedupe (`:1313-1321`) mette `seenPrimary = true` sulla **prima** riga primary in ordine di array e azzera tutte le successive; se quella prima è scoped, tiene lei e cancella un primary legittimo che viene dopo, e poi la riparazione di scope cancella anche la prima — zero primary, top bar vuota, pin reale distrutto. **Prima si spogliano i primary scoped, poi si deduplica.**

Poi: `let seenPrimary = false; const deduped = scoped.map(...)` (il blocco esistente, invariato salvo la sorgente), `deduped.sort(...)` a `:1323`, e il literal a `:1342` continua a leggere `deduped`. **Attenzione a non ripetere l'errore di `durable` §2.3, che calcolava `repaired` e poi lasciava `session: deduped.map(...)` — codice morto, cioè esattamente la perdita silenziosa che la pass esiste per evitare.**

E nel board, subito dopo `:1331`:

```ts
const rawLive = board['liveScene'];
const liveScene = typeof rawLive === 'string' && rowIds.has(rawLive) ? rawLive : null;
if (typeof rawLive === 'string' && liveScene === null) {
  warn('the fight on the board came from a scene this campaign no longer has, so it belongs to no row');
}
```

Poi `liveScene` va **nominato nel literal `board` a `:1357-1365`**, o è scartato in silenzio a ogni lettura.

---

## 6. LA MIGRAZIONE

| costante | oggi | dopo | dove |
|---|---|---|---|
| `CAMPAIGN_SCHEMA_VERSION` | 3 | **4** | `shared/campaigns.ts:101` |
| `OLDEST_READABLE_CAMPAIGN` | 1 | **1** | `:116` — invariato: niente di più vecchio esiste, e nessun campo di schema 1 cambia, quindi non c'è ragione di smettere di leggere v1 |
| `DB_VERSION` | 2 | **2** | `src/store/db.ts:45` — indipendente per politica (`db.ts:25-45`); qui cambia il *contenuto* del record, non la forma dello store |

Terza entry in `CAMPAIGN_MIGRATIONS` (`shared/campaigns.ts:146-178`):

```ts
{
  from: 3,
  note: 'the board gained the scene its fight came from, and a countdown row gained the scene it belongs to; no schema-3 field changed',
  /*
   * A copy, for the reason the two entries above give at length, and seeding
   * nothing for the reason the `from: 2` entry gives at :166-175: the readers
   * below already supply `null` for both fields on the way in, and a default
   * written here as well is the one nobody notices has gone stale.
   */
  apply: (r) => ({ ...r }),
}
```

**Il converter è puro**: una copia, non `r`, non una riparazione. `tests/store/campaignSchema.test.ts:650` (`hands the chain a copy rather than the record it was given`) resta verde, e `:624` — il cammino byte per byte del fixture v1 congelato — resta verde con una terza `note` in `applied`, perché il converter non cambia nessun campo. L'identità di `:616` regge: `[1,2,3]`, `length === 4 − 1`.

**Fixture congelati.** Serve **`v4.campaign.json`, scritto dalla build che spedisce lo schema 4, il giorno che lo spedisce, e mai rigenerato.** `v1`, `v2`, `v3` non si toccano — in particolare `v3.campaign.json` resta a `"combatants": []` sulla sua riga scena. La regola è `tests/store/campaignSchema.test.ts:138`: *"A fixture rewritten by a later build proves only that the current code can read its own output, which is not the question being asked."*

**Perché il bump non è opzionale, detto correttamente.** Una build schema-3 che apre un record schema-4 **non** ricostruisce il board e non riscrive: `checkReadable` (`shared/migrations.ts:166-183`) lancia quando `version > current` e `readCampaigns` (`src/store/campaigns.ts:95-105`) lo mette in quarantena. È il bump *a produrre* quella protezione. Il pericolo è quello che si corre **senza** bump: ogni arm del reader ricostruisce campo per campo e scarta ciò che non nomina (`campaigns.ts:1100-1109`), `hydrateGm` spinge ogni id riparato in `scheduleAside` (`gmStore.ts:577`), e `writeAside` (`:428-459`) scrive su disco **l'output del reader** — quindi i due pointer sparirebbero e la sparizione verrebbe persistita al salvataggio successivo. È l'argomento di `campaigns.ts:126-144`. *(Il paragrafo equivalente di `durable` §2.4 descriveva i due stati come simultanei; non lo sono.)*

L'esenzione di `board.region` (`campaigns.ts:406-477`) **non si applica**: si limita da sola — *"whether they are widening **this** field or a different one"* — e questo è un campo diverso.

**Export/import.** Nessuna modifica al transfer layer: `serializeCampaign` (`campaignFile.ts:75-87`) è `JSON.stringify` del record intero. Nota il limite e non appoggiarcisi: il read-back di `exportCampaign` (`:174-199`) controlla solo `back.campaign.id`, e `parseCampaignFile` ricalcola il CRC sul `parsed['campaign']` grezzo, non sull'output del reader — **la verifica dell'export non è una guardia sulla completezza del reader**, e non potrebbe esserlo. La guardia è §5 più `campaignSchema.test.ts:147`. Import in `src/` non esiste (`campaignFile.ts:31-36`), quindi l'unico consumatore vivo della finestra di versione è `checkReadable` (`:129-138`).

---

## 7. LE DECISIONI IN VIGORE, CITATE

**Overturn — sono decisioni dell'owner, non le do per assunte. Nessuna riga di codice le tocca finché non sono approvate.**

| # | decisione | dove | cosa succede |
|---|---|---|---|
| **O1** | *"The fight as it is being fought is never in the plan, only the plan for it."* | `tests/store/campaignSchema.test.ts:520-521` | **needs-an-overturn.** L'asserzione `expect(scene.combatants).toEqual([])` **resta verde** sul fixture v3 congelato; muore solo la ragione dichiarata. Riscrivere il commento nel commit che atterra. **Non rigenerare il fixture.** |
| **O2** | *"no action in `gmStore` sets a combatant list wholesale"* | `SessionBody.tsx:55-58`, `AddSheet.tsx:59-61`, `session.ts:302-307` | **needs-an-overturn.** `runScene` **è** quell'azione. Prosa riscritta, non cancellata: deve dire che è l'unica e perché. `newScene` continua a coniare `[]` (una scena nuova non è stata combattuta), quindi `tests/gm/session.test.ts:402` passa. |
| **O3** | *"The scene runner shows whatever environment is on the board right now, **which is one per campaign**"* | `SessionBody.tsx:344-345` | **needs-an-overturn.** Falsa dopo, e **pinnata da nessun test** (`sessionList.test.tsx:358` asserisce solo `'This is the plan'`), quindi marcisce in silenzio se nessuno la riscrive a mano. |

**Extends**

| decisione | dove | come |
|---|---|---|
| *"the honest reading of 'make that one primary' when that one cannot be"* è azzerare il flag | `campaigns.ts:645-653` | è il precedente citato per scope-cancella-pin; il writer resta totale e guadagna una clausola |
| `armedLabel` cambia le parole quando ciò che si distrugge è l'unica copia | `SessionRow.tsx:170-181` | terzo arm per la riga scena con marchi |
| RENAME esce mentre `armed`, per misura | `SessionRow.tsx:86-94` | MOVE UP e MOVE DOWN escono con lui, incondizionatamente; il footer armato torna a una riga sola in **tutti** i casi, incluso `unreadable` |
| lo scaffale dei template non pinna | `Countdowns.tsx:280-287` | ora non scopa nemmeno |

**Respects — invariate, e questo piano è scritto per non toccarle**

- `Countdowns.tsx:4-8` — *"a countdown that ticks on its own is one you stop trusting. So: plus and minus, and nothing else."* Niente avanza per un park, un resume o un END SCENE.
- `Countdowns.tsx:110-153` e `docs/handoff/DECISIONI-2026-08-25.md:30-42` — i quattro hint restano parole dell'app.
- `Countdowns.tsx:424-427` — *"a button that can be pressed and does nothing is the worse of the two lies."* Tre controlli non-renderizzati, zero nuovi `disabled`, e il chip corrente è uno `<span>`.
- `Scene.tsx:66-79` — END SCENE si arma incondizionatamente. **Esplicitamente: non gatearlo nemmeno su `liveScene !== null`.**
- `GmSheet.tsx:150-155` — il ✕ resta 44×44 in alto a destra. È la differenza principale da `ergonomic`.
- `GmBar.tsx:20-33` — nessun quarto verbo; uno switcher è una destinazione.
- `campaigns.ts:628-636` — *"two arrays would need keeping in step"*. Lo scope è un campo sulla riga countdown; nessun `countdowns[]` sulla riga scena.
- `SessionBody.tsx:70-74` — OPEN THE FIGHT non scrive il roster del board. `runScene` non muove né roster né adjustments.
- `campaigns.ts:406-477` — l'esenzione di `board.region` non è invocata.

---

## 8. BUILD ORDER

**Lane 0 — schema, reader, plumbing.** `shared/campaigns.ts` (i due campi, `emptyBoard`, i due seat nel reader, la pass di riparazione, `withPrimaryCountdown`'s clausola, il converter, la versione), `src/store/campaignMigration.ts:215-216`, `src/ui/gm/gmStore.ts` (**solo** `spread`/`gather`/`initial`/`addCountdown`), `tests/fixtures/schema/v4.campaign.json`, e i test di `tests/store/`.

**È lane 0 perché tutto il resto importa il tipo**: `sceneId` è obbligatorio sull'arm countdown e `liveScene` su `GmBoard`, quindi ogni literal nel repo è un errore di compilazione finché lane 0 non atterra. E perché il bump di schema è l'unico commit in questo repo che non si può sbagliare: deve atterrare da solo, con una catena il cui converter è una copia pura e la cui politica sui fixture è intatta.

**Lane 0 non esporta nessun helper nuovo.** `liveScenes`, `countdownsIn` e `withSceneScope` arrivano con la lane che li usa, o `tests/harness/orphans.test.ts` fallisce su un simbolo esportato senza chiamante. Le riparazioni sono interne a `readCampaignRecord`; l'insieme `rowIds` è inline.

**Lane 1 — park and resume.** `gmStore.ts` (`runScene`, `clearScene`, `removeSessionItem`), `SessionBody.tsx` (`SceneArm`, la guardia su `EncounterArm`), `session.ts` (`describeItem` caso `scene`, e `liveScenes` esportato da `shared/campaigns.ts` — attenzione, **tocca `shared/campaigns.ts`**), `SessionRow.tsx` (`armedLabel` + il footer armato), `Scene.tsx` (cost line + count line).

**Lane 2 — lo switcher.** `GmSheet.tsx` (il prop `title`), `src/ui/gm/SceneSwitcher.tsx` (nuovo), `Gm.tsx:309`, `tests/ui/screens.test.tsx` (la mount fixture, o `:1003` fallisce). Dipende da lane 1 perché chiama `runScene`. **Gate di misurazione Chrome (§3.5).**

**Lane 3 — countdown per scena.** `gmStore.ts` (`setCountdownScene`), `SessionBody.tsx` (`CountdownArm`), `session.ts` (`describeItem` caso `countdown`), `Countdowns.tsx`, `RestControl.tsx`, `AddSheet.tsx`, `Scene.tsx` (il blocco orologi), `shared/campaigns.ts` (`countdownsIn`, `withSceneScope`).

### Le collisioni, dette per nome — è l'errore che questo repo ha già pagato due volte

- **lane 1 e lane 3 scrivono entrambe `src/ui/gm/gmStore.ts`, `src/ui/gm/SessionBody.tsx`, `src/ui/gm/session.ts`, `src/ui/gm/Scene.tsx` e `shared/campaigns.ts`.** **Non possono girare in parallelo.** Sequenziali.
- **lane 2 e lane 3 sono disgiunte** (`GmSheet`/`SceneSwitcher`/`Gm` contro `gmStore`/`SessionBody`/`Countdowns`/`RestControl`/`AddSheet`/`Scene`) e possono girare in parallelo dopo lane 1 — **con un'eccezione: `tests/gm/gmScreen.test.tsx`**, che entrambe toccherebbero (la top bar e ADD). Assegnalo a lane 3 e fai che lane 2 non lo apra, oppure serializza.

**Ordine: 0 → 1 → (2 ∥ 3).** Ogni lane finisce verde per conto suo. Lane 0 è verde con due campi che nessuno legge — legittimo, perché la sua asserzione è il round-trip su disco. Lane 1 è verde con lo switcher assente: il flip costa i cinque gesti, esattamente come oggi, ma niente si perde. Lane 2 è la sola che rende lo scenario dell'owner un tap.

---

## 9. COSA COSTA

**File di produzione: 12.** `shared/campaigns.ts`, `src/ui/gm/gmStore.ts`, `src/ui/gm/SessionBody.tsx`, `src/ui/gm/session.ts`, `src/ui/gm/SessionRow.tsx`, `src/ui/gm/Scene.tsx`, `src/ui/gm/GmSheet.tsx`, `src/ui/gm/Gm.tsx`, `src/ui/gm/Countdowns.tsx`, `src/ui/gm/RestControl.tsx`, `src/ui/gm/AddSheet.tsx`, `src/store/campaignMigration.ts`. Più uno nuovo: `src/ui/gm/SceneSwitcher.tsx`. **Nessuna modifica al transfer layer.**

**Test.** Il raggio d'esplosione misurato è **1.133 `it()` statiche su 3.215 in 52 file su 148 (35,2%)**, 1.527 runtime case su 3.844. Dentro:

- **Riscritture vere, ~40 blocchi**: `sessionList.test.tsx:652` (`adds this roster to them` — il `Fact` sopravvive, il verbo è ora guardato), `:343`/`:358`/`:591`/`:605`/`:640`; `gmScreen.test.tsx:252`; `sceneConfirmation.test.tsx` (tutti e 8) e `sceneTruth.test.tsx:569` (6) per la cost line; `campaignSchema.test.ts:513`/`:616`/`:132`/`:138`/`:147`/`:624`/`:94`/`:106`/`:119`/`:124`; `campaignDb.test.ts` (~8 quarantine keyed su `CAMPAIGN_SCHEMA_VERSION + 1`); `campaignFile.test.ts:184`/`:264`/`:305`.
- **Verdi per progetto, ed è il progetto che funziona**: `sessionList.test.tsx:389` (semina `kind: 'encounter'` a `:393`); `:616` (roster e adjustments non si muovono); `gmScreen.test.tsx:568` e `session.test.ts:402`/`:419` (`newScene` invariato); tutti e sette i blocchi di `gmGeometryProse.test.ts` ancorati a `Scene.tsx`; `session.test.ts:323` (`SESSION_ITEM_KINDS` non si allarga, quindi `ADD_FORMS` e `AddSheet.tsx:154` non si toccano).
- **Compilatore, non test**: `sceneId` è obbligatorio, quindi tutti i **19** literal countdown della suite prendono `sceneId: null`; `liveScene` idem su ogni literal `GmBoard` che non passa da `emptyBoard()`.
- **Cross-test leakage**: tutti e **15** i `beforeEach` che fanno `useGm.setState({ combatants: [], environmentRef: null })` devono aggiungere `liveScene: null`, o un test che ha chiamato `runScene` lascia il pointer acceso per ogni test successivo del file. `thrifty` ne nominava tre.
- **Nuovi, ~15**: le tre riparazioni del reader accanto a `campaignSchema.test.ts:372-396`; `runScene` è un solo commit; il park copia invece di aliasare (muta l'array della riga dopo un flip, asserisci che il board non si muove); il resume svuota la riga; i chip dichiarano `minHeight: 44` inline; la mount fixture di `SceneSwitcher`.
- `tests/fixtures/factories.ts:249` — `NO_FIGHT`, spread in 21 literal scena su 7 file: il docblock (*"reads as 'no fight here'"*) diventa anche *"parcheggiata vuota"*. Vero per tutti e 21; una frase in più.
- `tests/harness/orphans.test.ts`: `runScene`, `setCountdownScene`, `liveScenes`, `countdownsIn`, `withSceneScope` e il prop `title` di `GmSheet` devono spedire cablati nello stesso commit della lane che li introduce.

**Chrome gate: solo la lane 2.** Le lane 0, 1 e 3 non spostano nessuna cifra dichiarata. La lane 2 non può dichiararsi finita finché §3.5 punti 1 e 2 non sono in un browser.

---

## 10. LE DOMANDE APERTE

1. **I tre overturn di §7 sono tuoi.** In particolare O1: la frase *"The fight as it is being fought is never in the plan"* è la ragione dichiarata dello schema 3, e questo piano la inverte. L'asserzione resta verde e il fixture resta congelato — ma la frase va riscritta di proposito, e non lo faccio senza il tuo sì.
2. **Lo switcher in alto o sotto il pollice.** La title row costa 0.00px e tiene il ✕ dov'è. Il fondo del pannello sarebbe a 118px dal pollice invece di 570 — ma mette il chip a 1.00px dai tre target di `GmBar`, che restano vivi sotto l'overlay, e un flip mancato apre ADD sopra il combattimento. Ho scelto in alto. **Questa si decide a un tavolo con due build e un gruppo diviso, non con un docblock più lungo.**
3. **Un `long-term` scoped a una scena è coerente?** Il piano lo permette e lascia `RestControl` che li elenca tutti, etichettati per scena. È la lettura onesta ("il riposo è della campagna"), ma è anche l'unico posto dove uno scope non nasconde niente — quindi potrebbe valere la pena vietarlo del tutto. Non l'ho vietato.
4. **Cosa fa l'archiviazione a un combattimento parcheggiato e a un orologio scoped.** `Campaign.archive` (`campaigns.ts:591`) è persistito, letto ed esportato, e **niente in `src/` lo scrive**. La pass di §5 è scritta per essere l'unico posto dove si risponde a un id penzoloni, ma la domanda "archiviare una scena col suo combattimento dentro cosa significa" è viva, non risposta.
5. **Due tab, e il chip omonimo** (§4.13). Registrati come non risolti.
6. **Il piano più durevole non è questo, e `durable` §7 lo dice meglio di me**: cancellare `GmBoard.combatants` e far leggere e scrivere al runner direttamente `session[i].combatants`. Niente park, niente copia a due attraversamenti, niente "un commit non due", niente pointer penzolante — e §4.1 non esisterebbe come classe. Costa `spread`/`gather`, tutti e cinque i writer del board, `GmTopBar.tsx:104`, ogni lettura di `Scene.tsx` e tutti i 29 seeding site in 15 file di test, **nello stesso commit del bump di schema**. Se accetti quel raggio, quello è l'app che non si riapre fra sei mesi. Se non lo accetti, questo è il piano additivo, e paga la compatibilità con un pointer e due copie di array per beat.

> **DECISA — 27 agosto 2026, corsia A4. Il raggio è stato accettato, ed è questo punto che si sta costruendo.** `docs/handoff/PIANO-B-SCENE-PER-RIGA-2026-08-27.md` cancella `GmBoard.combatants`, fa vivere la rissa sulla riga in cui viene combattuta e porta `CAMPAIGN_SCHEMA_VERSION` da 4 a 5 **nello stesso commit**, che è esattamente il raggio descritto qui sopra. Il resto di questo documento va letto sapendolo: `runScene` con park e resume e `adoptBoard` — che *sono* in albero, `gmStore.ts` li dichiara entrambi — vengono **eliminati**; lo switcher sopravvive e passa da `runScene` a `showScene`, e il modello dei countdown per scena (§2.3) resta in piedi — cambia solo il nome del pointer che lo legge.
>
> **Questo documento si contraddice, e la contraddizione va vista.** La nota di provenienza in cima respinge lo stesso modello al punto 2 — *«Togli la copia, il runner punti alla riga»* — sull'obiezione che `spawn` cerca l'indice libero solo su `get().combatants`, verificata ancora oggi (`spawn` apre con `const combatants = [...get().combatants]` e poi `while (combatants.some((c) => c.id === …))`), e che due righe potrebbero quindi portare entrambe un `acid-burrower-0`. **L'obiezione era giusta e non è stata ignorata: è stata sciolta invece che aggirata.** Il piano nuovo dichiara gli id **locali alla riga** — `acid-burrower-0` è legale nel dungeon e nella foresta nello stesso momento, e non significa niente fuori dalla propria riga — e rende quella località una proprietà del *tipo*: ogni writer è indirizzato per `(sceneId, id)`, così un writer che cerchi un combattente per solo id non compila. Quello che il preambolo trattava come «il punto forte» della copia era la copia che teneva sani gli id; il piano nuovo li tiene sani senza copia.

