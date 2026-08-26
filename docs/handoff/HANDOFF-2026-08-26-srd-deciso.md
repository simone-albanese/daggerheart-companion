# Handoff — 26 agosto 2026, notte

**Questo file apre al contrario del precedente: `main` È lo stato del lavoro.**

`main` è **`5def23e`**, il cancello è verde per intero, e il sito serve quel commit. Non c'è
niente di finito che non sia spedito, nessuna PR aperta, nessun ramo con dentro lavoro non unito.
`HANDOFF-2026-08-26-scene-wiring.md` — che apriva con l'avvertimento opposto — è **eseguito**:
la sua PR #33 è unita e pubblicata.

Le tre domande della §6 del piano SRD **sono state fatte e risposte**. Il registro è
`DECISIONI-2026-08-26.md`.

---

## 1. Il cancello

Locale, su `main` `5def23e`, passato per intero. Node **v24.19.0** via `. ./env.sh`.

| | atteso | esito |
|---|---|---|
| `. ./env.sh && npx vitest run` | 150 file / 3947 test | **combacia** |
| `. ./env.sh && npx tsc --noEmit` | pulito | **pulito** |
| `. ./env.sh && npx vite build` | verde | **verde** |
| `. ./env.sh && npm run build:srd -- --check` | combacia | **`data/srd-1.0.json matches the source`** |
| `gh run list --workflow=ci.yml --limit 1` | success | **success** |
| `gh run list --workflow=deploy.yml --limit 1` | success | **success** |
| `sw.js` sul sito pubblicato | `5def23e` | **`5def23e`** |

**Il conto non si è mosso: 150 / 3947.** Nessuno dei tre commit di oggi ha aggiunto o tolto un
test — uno è codice di layout senza asserzioni nuove, due sono documenti.

**Se `vitest` dice 152 file, cerca sonde non tracciate in `tests/` prima di cercare una
regressione.** È successo il 26 agosto: due agenti di audit hanno lasciato `zzprobe.test.tsx` e
`zzDestroyProbe.test.tsx` nel working tree. Oggi l'albero è pulito — `git status --short
--untracked-files=all` non dà nulla.

**Verificare il deploy leggendo il worker, non il semaforo.** `deploy.yml` timbra `GITHUB_SHA` in
`dist/sw.js`, quindi
`curl -s https://simone-albanese.github.io/daggerheart-companion/sw.js | grep -oE '[0-9a-f]{40}'`
dice quale commit il sito sta davvero servendo. È l'unico controllo che non si fida di niente.

---

## 2. Cosa è entrato oggi, e in che ordine

| PR | commit | cosa |
|---|---|---|
| **#33** | `15b50c7` | la riparazione delle scene end-to-end |
| **#34** | `0b5505c` | la riga del titolo di ogni foglio GM respira |
| **#35** | `5def23e` | le tre domande SRD risposte, il ballottaggio ratificato |

### 2.1 La CI di #33 non era rotta: GitHub era guasto

La run `32984933419` è rimasta `queued` per oltre un'ora. **Incidente Actions dichiarato, aperto
alle 15:11:58Z — dodici minuti prima che quella run venisse creata.** Non era il workflow, non era
il repo, e nessuna delle diagnosi di ramo aveva senso.

Tre cose imparate, e valgono la prossima volta:

- **`gh run rerun` non funziona su una run in coda** («This workflow is already running») e
  **`gh run cancel` nemmeno** («Cannot cancel a workflow run that is completed»). Due risposte che
  si contraddicono sulla stessa run: è il sintomo del guasto, non una diagnosi.
- **`gh workflow run ci.yml --ref <ramo>` gira lo stesso.** Durante il guasto il percorso
  `workflow_dispatch` prendeva un runner in **7 secondi** mentre gli eventi `push` e
  `pull_request` non creavano nemmeno la run. Se il ramo è un fast-forward puro di `main`, quel
  verde prova esattamente lo stesso albero.
- **Chiudere e riaprire la PR funziona, ma il ritardo può essere di diciassette minuti.** Ho
  concluso troppo presto che non avesse prodotto niente, dopo cinque minuti e mezzo di attesa. La
  run è arrivata dopo, ed è andata verde.

**`https://www.githubstatus.com/api/v2/components.json` andava letto per primo.** Un `curl` e la
domanda era chiusa.

**Resta una run zombie: `32984933419`, ancora `queued`, `updated_at` fermo alle 15:23:21Z, zero
job creati.** Non partirà mai. È cosmetica e si può ignorare.

### 2.2 La riga del titolo — la causa, non il sintomo

Il proprietario ha guardato il runner e ha detto che il nome della scena era schiacciato. Lo era,
e la causa non stava dove sembrava.

`GmSheet.tsx` dichiarava `padding: '0 6px 0 14px'` sulla riga del titolo — **padding verticale
zero** — quindi l'altezza era quella del figlio più alto, la ✕ da 44×44, più il rigo da 1px.
**45.00.** Ha retto per sempre perché il titolo era `t-label`, cioè **testo**: un glifo senza
scatola non ha niente da premere contro un bordo. `SceneSwitcher` ci ha messo un **chip pieno**
(`background: var(--hope)`, `minHeight: 44`) e un blocco alto esattamente quanto la riga tocca
entrambi i bordi. Misurato prima: **0.50px d'aria per lato**.

Misurato dopo: riga **57.00**, aria **6.00 sopra e 7.00 sotto**, ✕ sulla stessa linea del chip,
`docOverflowX` **0.00**. `ShowSheet` misura anch'essa 57.00 — la sua etichetta su due righe resta
dentro i 44 della ✕.

**Il costo è reale ed è scritto, non nascosto.** Header `flex: none`, scroller `flex: 1`, pannello
fisso fra i due: i **+12** dell'uno sono i **−12** dell'altro, esatti. I **582.00** che
`scene-wiring` aveva misurato a 393×852 sono **570.00**. Il CHANGELOG lo dice in una voce che
nomina quali due numeri della voce sopra si sono mossi, invece di riscriverli — quel file dichiara
di sé che un numero è quello che il suo commit ha misurato.

**Trovato e non sfruttato, di proposito:** il chip della scena corrente è uno `<span>` senza
`onClick` (`SceneSwitcher.tsx:169`), quindi il pavimento dei 44px non l'ha mai vincolato e si
sarebbe potuto rimpicciolire. Sarebbe stato il sintomo: il prossimo blocco pieno su quella riga
avrebbe riscoperto lo stesso bordo.

---

## 3. Le decisioni, e dove stanno

**`docs/handoff/DECISIONI-2026-08-26.md`**, tracciato. Cinque voci. In breve:

1. **Il catalogo `ask.ts` resta sulle 69 sezioni di regole.** Non è una quinta parte.
2. **La porta della ricerca su Play è una quinta voce della TabBar.** Costo verticale **0.00px**.
3. **Il ballottaggio dei momenti è ratificato: 8 orfani, 94 appartenenze su 61 sezioni.** Nessuna
   delle sette righe contestate è stata svuotata.
4. **Il test della §2.3 è una lista di esclusione**, e ora il suo confine è fermo.
5. **La riga del titolo di ogni foglio GM respira** — decisa ed eseguita.

I due file del ballottaggio **ora sono tracciati**. Erano fuori da git perché erano una proposta;
sono una decisione ratificata, e un registro che cita un percorso non tracciato è un puntatore che
muore con la macchina.

---

## 4. `RICERCA-SRD-2026-08-26.md` NON si esegue da solo

Il piano porta **sette affermazioni false**, due delle quali portanti. **È marcato in testa, non
riscritto**, perché qualcuno potrebbe eseguirle e perché questo repo ha già imparato che riscrivere
una prosa storica perde il fatto che era sbagliata.

| # | dove | dice | è |
|---|---|---|---|
| 1 | §2.1 e §4.4 | *«`ask.ts` continua a chiamare `searchRules`»* | **non lo chiama.** Importa `Ref` (`:87`) e `ruleTerms` (`:88`); le tre occorrenze sono prosa. Il pagliaio di `searchAsk` (`:188`) ha **zero testo del dataset**. Premessa portante in due sezioni. |
| 2 | §2.3 | *«il campo vuoto oggi disegna una lista vuota»* | **disegna i sei chip dei momenti e le porte**, e li disegnava già al commit a cui il piano si àncora. `RuleSearchResults` non monta mai su query vuota. |
| 3 | §1.3 | *«34 sezioni su 69»* senza sottotitoli | **33.** Il 34 è un'altra misura — le sezioni disegnate come un blocco solo. |
| 4 | §2.2 | *«le stesse tre bande»* | **cinque.** `SOME` sostituisce le tre quando un hit è parziale; `QUESTIONS` sta sopra e sopravvive allo scambio. |
| 5 | §4.3 | *«un record con venti campi corti»* | il più largo è un avversario con **16**. |
| 6 | §5.3 | le sei righe dei momenti *(da misurare)* | **già misurate** in `ShowSheet.tsx`. Ma il pannello NON è rimisurato: `ShowSheet.tsx:140-144` lo ammette. |
| 7 | §4.3 | il rigetto a buon mercato evita un'allocazione | il suo commento dice *«never pay for the line split»*. |

**Le §5.1 e §5.2 non sono più «da misurare» per la porta.** Resta da misurare **una cosa sola**:
la lista dei risultati **dentro** Play, che è una colonna diversa da quella di `ShowSheet` — i
294.3px di quella non si trasportano.

### La misura della porta, per intero

Chrome vero, `pointer: coarse` vero, personaggio di livello 5 costruito attraverso il percorso
reale, origine separata con IndexedDB vuoto.

| | 393×852 | 375×667 |
|---|---|---|
| margine fra l'ultima riga toccabile e il fondo della colonna | **138.00** | **21.00** |
| **quinta scheda** — costo verticale | **0.00** | **0.00** |
| schede, da quattro a cinque | 98.25 → **78.60** | 93.75 → **75.00** |
| aria attorno a `SEARCH` (42.00 di testo) | 36.59 | **33.00** |
| bersaglio di ogni scheda | 78.60 × 60 | **75 × 60** |
| `docOverflowX` | 0.00 | 0.00 |

**Le due scartate, con i numeri.** Un **verbo nell'header** costa anch'esso **0.00px** — 44×44 a
`y 4` dentro i 53 esistenti, con 136.59px di vuoto contiguo anche a 375. Scartato per il **disegno,
non per i pixel**: l'header sta in `src/ui/shell/App.tsx`, è della shell, e la porta comparirebbe
anche sulla schermata GM dove `SHOW` ha già la ricerca. Un **campo in cima alla colonna** costa
**+52.00px**: entra a 393×852 con 86.00 di margine, **non** a 375×667 — spinge l'ultima riga
**31.00px sotto la piega**.

**Due assunzioni cadute.** Una barra **non** costa 60px di vetro permanente: la TabBar c'è già. E
i «13px di margine» del piano a 375×667 sono **21.00** letti da uno schermo con un personaggio
vero sopra.

### Una nota di forma per chi scrive la 2.3

`AskEntry.moment` è **singolo** (`ask.ts:143`). Il ballottaggio è **plurale**: 30 righe con un
momento, 29 con due, 2 con tre. **In `src/` non esiste nessun tipo sezione→momenti**, e
`RulesSection` è id/title/body. La §2.3 propone una forma che il codice non ha.

E il piano dice *«i sei momenti non taggano nessuna delle 69 sezioni»*: falso. `askCatalogue.ts`
spedisce **12 voci con un `moment` non nullo**, su 12 sezioni distinte.

---

## 5. Trovato e NON riparato — sono decisioni del proprietario

Le cinque voci di `HANDOFF-2026-08-26-scene-wiring.md` §3 **restano tutte aperte**. Una è
verificata di nuovo oggi nel codice, e va per prima:

1. **Il numero mente, e mente al tavolo.** Tre punti contano lo stesso roster in due modi:
   `Encounter.tsx:718` (`SEND {n} TO THE SCENE`) e `AddSheet.tsx:332` (`TAKE THE {n} ON THE BOARD
   NOW`) sommano i **gruppi**; `session.ts:178` (`plannedAdversaries`, la riga chiusa) moltiplica
   per i giocatori quando l'avversario è un Minion. Tre gruppi di Giant Rat con quattro giocatori:
   il bottone dice **3**, la riga chiusa dice **12**, e ne arrivano dodici. **Quale dei due numeri
   è quello giusto è una decisione, non un bug con una risposta sola.**
2. **Il roster di una riga scena è a scrittura unica.** Gli scrittori sono `AddSheet.tsx:340`
   (creazione) e `SessionBody.tsx:695`, che sta su `EncounterArm` — il tipo morto. Una riga creata
   prima della rissa non può più riceverne una, e non c'è nessun messaggio che lo dica.
3. **`adjustments` su una riga scena è scritto alla creazione e letto da nulla.** Verificato dal
   vivo il 26 agosto leggendo IndexedDB: sta su ogni riga scena creata, `{easier, harder,
   damageBump}`, tutti `false`, e viaggia negli export.
4. **Il ✕ «Remove X from the scene» è 34×44**, contro il pavimento di 44, su un'azione
   irreversibile. Aperta da due handoff. **È la stessa famiglia del difetto riparato in #34.**
5. **Le parole.** Lo stesso posto si chiama `the board` sulla riga e `the scene` nel costruttore,
   e la didascalia parla di *running* e *parking*, parole che non stanno su nessun bottone.

**La 1 e la 2 rovinano una serata di gioco. Le altre tre sono debito.**

---

## 6. Cosa non toccare, e sono decisioni

Restano in vigore `WAVE3 §8`, `HANDOFF-2026-08-26 §8`, `HANDOFF-2026-08-26-notte §7` e
`HANDOFF-2026-08-26-scene-wiring §5`. Più, da oggi:

- **La riga del titolo di `GmSheet` è 57px, e i 12 di padding sono la riparazione, non decorazione.**
  Toglierli rimette un blocco pieno contro un bordo.
- **Il catalogo `ask.ts` non si allarga ai record.** Deciso. Se qualcuno lo ripropone citando
  `searchRules`, la citazione è falsa.
- **Gli otto orfani sono ratificati** e il test della §2.3 è una lista di esclusione. Non è un
  settimo momento: `ShowSheet.tsx:359` è `repeat(3, 1fr)` e il settimo chip costa **52px** in una
  colonna che entra per **0.3px**.
- **`searchRules` non si cancella e non si restringe**: lo chiama `RuleSearch.tsx`.
- **Nessuna parola dell'SRD va mai ribattuta nel repository.**
- **Mai `git add -A`.** **`. ./env.sh` prima di ogni comando npm.** **Le prove per mutazione in una
  copia isolata.** **`build:srd -- --check` è il cancello vero.**
- **Non camminare l'app sui dati del proprietario.** `localhost:5199` è la sua campagna vera. Tutta
  la prova di oggi è su `localhost:5201`, IndexedDB vuoto verificato (`campaigns: 0`,
  `characters: 0`). Nulla di reale è stato letto, scritto o cancellato.

---

## 7. Dove stanno le cose, e un errore di metodo da non ripetere

**Il rig di misura ESISTE, ed è qui:**
`~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/` —
`cdp.mjs`, `probe.js`, `run.mjs casi.json`, i fixture seminati, 1660 misure in `out/digest.json`.

**Oggi non è stato usato, ed è un errore.** L'ho cercato nelle cartelle `scratchpad`, un
`find ~ -maxdepth 4` è andato in timeout a 120s, e ho concluso che non ci fosse. Il percorso era
scritto in memoria. **Un `ls` su quel percorso risponde subito: non lanciare mai un `find` sulla
home per trovarlo.** Le misure di oggi restano valide — Chrome vero, `pointer: coarse` vero — ma
il rig ha anche `elementFromPoint` su ogni punto di tap, che coglie un controllo dipinto *sotto*
un altro, e la strada ad hoc no.

**La strada ad hoc, se serve di nuovo:** `mcp__claude-in-chrome__resize_window` **non scende sotto
un minimo di finestra** — chiesto 393×852, ottenuto 529×675, e `pointer: coarse` resta `false`,
quindi ogni misura fatta così non è la misura dell'audit. Quello che funziona è
`chrome-devtools__emulate` con `viewport: '393x852x3,mobile,touch'`. Gli strumenti
`claude-in-chrome` si piantano con *«Cannot access a chrome-extension:// URL of different
extension»* e l'unico recupero è un tab nuovo.

**Per mettere un personaggio su Play:** un file temporaneo *dentro* `tools/` (gli import sono
relativi) che chiama `buildCharacter({ classRef, level, index, ds, ix })` da
`sampleCharacters.ts`, poi si inietta il record nello store `characters` di IndexedDB e si scrive
`dhc.prefs.v1` con `{ onboarded: true, gmTools: true, activeCharacterId }`. **Cancella il file
temporaneo e controlla `git status` prima di committare.**

Altro:
- **Ballottaggio dei 69 momenti**, ora tracciato: `docs/handoff/BALLOT-MOMENTI-2026-08-26.json`
  (69 righe con `moments`, `why`, `confidence`, `note`) e
  `docs/handoff/BALLOT-MOMENTI-CRITICHE-2026-08-26.json` (quattro letture avversariali).
  **Ratificato**, non più una proposta.
- **Documento dell'audit scene, pubblicato:**
  https://claude.ai/code/artifact/25c75908-8c6d-412d-8821-fd67eab8e847 — «Il tavolo di nessuno».
  **Scritto prima della riparazione**, quindi descrive al presente un difetto che non c'è più:
  va marcato come storico.
- **Il ramo `scene-wiring`, `sheet-title-air` e `srd-decisions` non sono stati cancellati**, come
  ogni ramo unito di questo repo (`delete_branch_on_merge: false`).

---

## 8. Per riprendere

Non c'è niente da sbloccare. Il lavoro seguente è **la parte 2.1 del piano SRD**, ed è la prima
volta che parte con tutte le domande risposte.

1. **Leggi `DECISIONI-2026-08-26.md` per primo, non il piano.** Il piano è marcato e le sue
   premesse false sono portanti in due sezioni.
2. **Parte 2.1 — l'indice unificato.** `src/ui/shared/srdIndex.ts` nuovo, che appiattisce gli 849
   record in `{ kind, id, name, page, haystack }`; `searchSrd` accanto a `searchRules`, non al suo
   posto. **`tests/harness/orphans.test.ts` cammina `src/` e fallisce su un export senza
   chiamante: la 2.1 deve CABLARE `searchSrd`, non solo costruirlo.**
3. **L'ordine `2.1 → 2.2 → 2.3 → 2.4` regge e non è parallelizzabile**: tutte e quattro scrivono
   `RuleSearch.tsx`, tre su quattro anche `srdReference.ts`. Una PR per parte.
4. **Un vincolo che la 2.2 deve affrontare e nessun documento tranne questo nomina:**
   `src/ui/shared/` oggi **non importa niente da `src/ui/gm/`** — verificato. Spostare
   `RuleSearch.tsx` in `shared/` invertirebbe quel livello, perché disegna `BlockView` da
   `src/ui/gm/ReferenceTables.tsx`.
5. **Se invece vuoi chiudere le scene prima**, le cinque voci del §5 sono pronte da porre come
   decisioni. La prima — quale dei due conteggi di Minion è quello giusto — è quella che si vede
   al tavolo.
