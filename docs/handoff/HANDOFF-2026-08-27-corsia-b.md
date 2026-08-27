# Handoff — 27 agosto 2026, sessione «la corsia B, misurata prima di essere costruita»

**Questo documento è l'autorità.** Supersede `HANDOFF-2026-08-27-corsia-c.md` su tutto ciò che
contraddice; quello che quel file dice e questo non tocca resta in vigore — in particolare tutte le
sue §8, che questa sessione ha messo alla prova una per una e che hanno retto.

---

## 1. Cosa è stato spedito

**L'ultimo commit di codice è `ab66cf2` (#56), verificato pubblicato.** La punta di `main` è più
avanti e continuerà a muoversi: i commit dopo `ab66cf2` sono documentazione, questo file compreso.
**Non fidarti di un SHA di punta scritto qui — leggi `git log -1`.**

| | cosa | stato |
|---|---|---|
| **Wave A** | le quattro corsie di preparazione | **unita, #56, `ab66cf2`, in produzione** |
| **Il piano, corretto** | 34 correzioni + 64 pericoli, marcati nel documento | ramo `plan-b-verificato`, `878d675`, **non unito, 17 rilievi aperti** |
| **Wave B** | la rissa lascia il tavolo, schema 4→5 | ramo `wave-b`, **B1 fatto, B2 a un test dalla fine, B3–B8 non iniziati** |
| **Wave C** | la misura su Chrome + il docblock dell'archivio | non iniziata |

La pubblicazione della #56 è verificata **scaricando `sw.js` dal sito**, non dedotta:
`const BUILD = 'ab66cf299397918a3538eec410f17a77e39220d8'`, lo stesso SHA del merge. La CI era vera
e verde: run `33093218016`, evento `pull_request`, `headSha` identico a quello della PR.

### 1a. La linea di base, misurata su `main` in questa sessione

```
. ./env.sh && npx tsc --noEmit     → pulito
. ./env.sh && npx vitest run       → Test Files 162 passed (162)
                                     Tests     4219 passed (4219)
npm run build:srd -- --check       → data/srd-1.0.json matches the source
```

**Attenzione a un numero che sembra due numeri.** La stessa suite riporta
`161 passed | 1 skipped (162)` e `4212 passed | 7 skipped (4219)` quando il PDF dell'SRD **non** è
raggiungibile. Gli skip sono i test dei parser, che si saltano da soli senza il PDF. In un worktree
serve il symlink `Manuali` oltre a `node_modules` e `.tools` — sono **tre**, non due, e questa
sessione ci è inciampata: senza `Manuali` il cancello `build:srd --check` non gira affatto.

### 1b. Le quattro corsie della Wave A, e cosa ciascuna ha davvero chiuso

**A1 — un combattente generato teneva l'array del bestiario.** `makeCombatant` restituiva
`thresholds: a.thresholds`: tupla mutabile, e `a` è il record del dataset condiviso da tutto il
dispositivo. La prima riparazione usava `=== null`, esatta contro il tipo *dichiarato* e sbagliata
contro i dati — `contributedFields` salta i null, quindi un avversario solo-manuale arriva con la
**chiave assente** e `undefined === null` è falso. Ora è `Array.isArray(...)`, e la stessa guardia
chiude la lettura in `Scene.tsx` che indicizzava `undefined` una schermata dopo.
Corretta in due file la frase *«Minions and some Solos have no thresholds»*: misurato,
**16 avversari su 129 hanno `thresholds: null` e sono tutti Minion**, 0 Solo su 20.

**A2 — un solo aiutante conia la riga-scena che tiene la rissa.** `sceneWith` e `combatant`,
derivati da `makeCombatant` dell'app invece di elencare nove campi a mano. La prima versione
spargeva `...opts` **sopra** `id` e `kind`: il wrapper naturale che i dodici seed avrebbero scritto
compilava pulito e ignorava in silenzio il proprio id, e due righe con lo stesso id rientrano da
`readCampaignRecord` con **zero avvisi**.

**A3 — le due riparazioni che mancavano al reader**, entrambe sugli id duplicati, entrambe
*ri-numera e mai scarta*. E mentre le provava ha trovato una terza cosa, peggiore:
**una riga countdown porta il suo id due volte.** `addCountdown` conia l'id della riga e quello
dell'orologio come la stessa stringa, di proposito, e ogni scrittore del negozio indirizza gli
orologi per `countdown.id`. Ri-numerare solo la riga lasciava due orologi a rispondere a un id —
un tocco ne faceva scattare due, un DELETE li portava via entrambi — *subito dopo* aver detto al GM
nei `warnings` che era stato riparato.

**A4 — la lista dei piani smette di ri-renderizzare.** `describeItem` prende il nome risolto invece
dell'array `session`, e `SessionRow` è dietro un memo. **Il memo sarebbe stato una bugia:**
`SessionList` passava `handle={drag.handleProps(item, i)}`, un oggetto nuovo a ogni render, quindi
il memo non avrebbe saltato *un solo* render. La prova: rimettendo la trappola i test che contano i
render diventano rossi mentre `$$typeof === Symbol.for('react.memo')` **resta verde**.

---

## 2. Il piano è stato verificato PRIMA di essere costruito, e stavolta pesantemente

**14 aree, 224 agenti, ogni verdetto FALSO attaccato da tre scettici indipendenti.**
Risultato: **251 affermazioni confermate vere, 34 correzioni in piedi, 64 pericoli** che il piano
non poteva conoscere — e **36 sfide su 70 ribaltate**, cioè più della metà di quello che i
verificatori avevano segnalato era sbagliato *loro*. Senza il giro di refutazione sarebbero entrate
36 «correzioni» che peggioravano il documento.

Lo stesso è successo sulle corsie: **36 rilievi di revisione, 14 ribaltati.** Quasi tutti per lo
stesso motivo — mezza frase citata, poi confutata la parafrasi. In un caso la correzione proposta
*era* la ragione che la frase già dava nella sua prima metà.

**Tutte e 34 le correzioni e tutti e 64 i pericoli sono scritti dentro il documento del piano**, in
loco e marcati (`> **CORRETTO**` / `> **RAGIONE STANTIA**`), sul ramo `plan-b-verificato`. Il
documento passa da 849 a 1090 righe e **nessuna prosa originale è stata cancellata** — il diff a
livello di parola riporta zero parole rimosse.

### 2a. Le correzioni con i denti — quelle che cambiano cosa si scrive

1. **`gmStore.ts:922-1015` non è `runScene`.** Oggi `runScene` sta a **1000-1092**, più il docblock
   d'interfaccia a **196-207** che il piano non cita mai pur dicendo «with their docblocks».
   Eseguire l'istruzione alla lettera **distrugge otto azioni che non c'entrano**. `adoptBoard` è a
   **990-998**, non 913-920.
2. **`campaignMigration.ts:216-219` non è il commento stantio.** È a **223-226**, e `liveScene: null`
   è a **:227**. Cancellare l'intervallo citato toglie l'apertura del letterale del board.
3. **I siti `setState` che portano `combatants` sono 29, in 17 file — non 12.** Il 12 contava solo
   quelli che stavano su una riga fisica. Contato due volte in questa sessione, con uno scanner a
   parentesi bilanciate, e la verifica indipendente dà lo stesso numero.
4. **I file di test che nominano `combatants` o `liveScene` sono 28** (erano 27 prima che la Wave A
   ne aggiungesse uno), non 25.
5. **Il cancello grep della Wave B non può passare senza `src/store/campaignImport.ts`**, che non è
   nella lista di nessuna corsia.
6. **`tests/store/campaignBackup.test.ts:144` diventa rosso legittimamente.**
   `expect(back.board).toEqual(raw['board'])` confronta il board riletto con quello v4 congelato, e
   il converter ha appena rinominato le chiavi. **L'intestazione di quel file promette il
   contrario** — «goes green today at 4 and stays green at 5 without being edited» — ed è falsificata
   dalla sua stessa riga 144. Va corretta insieme all'asserzione.
   *In una prima stesura di questa sessione avevo detto il contrario, e mi sbagliavo.*
7. **`NO_FIGHT` è già un nome preso.** `tests/fixtures/factories.ts` ne esporta uno che significa
   tre campi vuoti, importato da undici file di test. La costante nuova in `shared/campaigns.ts` si
   chiama **`NO_COMBATANTS`**.
8. **La corsia C2 non può usare il suo cancello come scritto.** `grep -rn "archive" src` oggi dà 10
   risultati, non zero: `campaignImport.ts` e `TakeIn.tsx` sono arrivati con la #52.
9. **§5 è tutta spedita.** Ogni riga che dice «NOT WRITTEN» è falsa; l'indice per categorie è in
   produzione dalla #51, più una banda SHUT appiccicosa che il piano non prevedeva.
10. **La striscia dei verbi non libera 88px: ne libera 0.** Vedi §4 qui sotto — è un errore che ho
    scritto io, non il piano soltanto.

---

## 3. Dove sta esattamente la Wave B

Ramo **`wave-b`**, spinto su `origin`, due commit sopra `ab66cf2`:

| commit | passo | stato |
|---|---|---|
| `13bfa12` | **B1** — `shared/campaigns.ts`: costante 4→5, il quarto converter, `GmBoard`, il reader | **fatto** (+423/−80) |
| `f0ba058` | **B2** — le prove del converter | **WIP, a un test dalla fine** |

**Cosa è verde adesso**, misurato: `campaignSchema.test.ts`, `campaignFile.test.ts` e
`campaignBackup.test.ts` passano — **169 su 170** sui quattro file che B2 possiede.
Le tre fixture congelate nuove esistono: `v5.campaign.json`, `v4.parked.campaign.json` (ramo 2),
`v4.orphan.campaign.json` (ramo 3).

**Cosa è rosso, e perché va bene:**
- `campaignMigration.test.ts:141` — *«brings across every part of it, not just the Fear»*. **Un
  test.** È tutto quello che resta del passo B2.
- Sette test fra `campaignImport.test.ts` (3) e `campaignRoundTrip.test.ts` (4). **Non sono di B2:
  sono i file del passo B7c**, chiamano ancora il verbo cancellato `runScene` e leggono
  `board.combatants`. Rossi qui è previsto.
- **`tsc --noEmit` è rotto in tutto l'albero, ed è corretto.** B1 ha tolto `combatants` e
  `liveScene` da `GmBoard` e niente è stato ancora ri-firmato. Quella lista di errori **è** la lista
  di lavoro dei passi B3–B7.

**La regola che non va tradita in questa corsia:** non aggiungere mai un campo-specchio, un alias di
compatibilità o un `combatants?` opzionale per far tornare verde la compilazione. Ogni variante di
quel tipo *è* il difetto delle-due-case-per-una-rissa che questo cambiamento esiste per cancellare.

### 3a. I passi che restano, nell'ordine

**B2** (finire) → **B3** `gmStore.ts` → **B4** `campaignMigration.ts` → **B5** i dieci lettori →
**B6** `SessionBody.tsx` → **B7a** i tre file di test grossi → **B7b** le suite scene e i seed →
**B7c** `campaignImport.test.ts` + `campaignRoundTrip.test.ts` → **B8** il cancello.

Lo script che li guida è salvato e riutilizzabile:
`~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/piano-b-2026-08-27/wave-b-scenes-per-row-wf_68e063ac-3c9.js`
Le istruzioni per ogni passo sono lì dentro, già corrette con le ancore giuste. **Rileggile prima di
rilanciarle**: sono state scritte contro `ab66cf2` e l'albero si muove.

### 3b. L'obbligo che il piano non porta

`HANDOFF-2026-08-27-corsia-c.md` §6: **chi tocca `gmStore.ts` nella Wave B deve riparare
`switchCampaign` E `createCampaign` nello stesso cambiamento.** Ripararne una sola è la mezza
riparazione che quel docblock esiste per rifiutare. È il passo **B3**, e il brief lo porta.

Il difetto, tracciato in questa sessione: entrambe fanno `await flushGm()` e poi `spread` di
un'altra campagna sopra la lavagna viva **senza leggere `dirty`**. Il flush prova che la scrittura è
stata *tentata*, mai che sia atterrata. La riparazione che il docblock stesso prescrive: ripiegare
la lavagna non atterrata dentro `campaigns` e passarla a `scheduleAside`, come **un passo privato
che entrambe chiamano**, con `gather(c, s, c.updatedAt)` — `c.updatedAt`, non un timbro fresco, e
il docblock di `snapshotCampaigns` dà quella ragione. `writeAside` salta un id uguale a quello
**attivo**, quindi accodare prima dello switch è sicuro: al momento del flush non è più attivo.

---

## 4. Il difetto che ho introdotto io, e come è stato preso

Nel brief del passo B6 avevo scritto, copiando il piano, che ritirare tre etichette di verbo libera
**88px** di riga. **È falso.** I cinque `<Verb>` di quel blocco sono i cinque rami di **un solo
ternario a quattro livelli** (`isLive ? … : parked > 0 ? … : spawnable.length > 0 ? … : orphan ? …
: …`): ne ha sempre disegnato **uno**. Togliere tre rami toglie **zero elementi disegnati**. La
striscia restituisce **0px**.

L'ha trovato il giro che correggeva il documento del piano, io l'ho verificato leggendo il blocco, e
ho fermato la Wave B a metà per riscrivere il brief prima che quel numero finisse in un docblock.
Il brief adesso dice anche di **non inventare un numero sostitutivo** per l'altezza di prosa che le
quattro cancellazioni di `<Fact>` tolgono davvero: quella non l'ha misurata nessuno, e appartiene
alla passata Chrome della Wave C, che è da dove in questo repo un numero misurato ha il diritto di
venire.

---

## 5. Il documento del piano ha 17 rilievi aperti

Il ramo `plan-b-verificato` (`878d675`) **non è unito**, e non deve esserlo prima di un giro di
refuta-e-ripara. I suoi controllori hanno trovato 17 problemi, e i più taglienti sono **la stessa
malattia che il documento stava curando**:

- conteggi `it(` citati come «misurati oggi» che sono di **prima** della Wave A (3502 contro i 3536
  reali a `ab66cf2`);
- una lista di 17 `file:riga` di cui due non atterrano più (`sessionList.test.tsx` è cresciuto di
  270 righe con la A4);
- un comando offerto come prova che oggi restituisce **il contrario** di quello che la correzione
  promette;
- **due affermazioni scritte sotto intestazione `CORRETTO` che il giro di refutazione aveva
  invece assolto** — cioè registrate come errori due cose su cui il piano aveva ragione;
- l'intestazione vende le correzioni su un'unanimità che i voti non sostengono: **nove delle 34
  sono passate 2 su 3**, non 3 su 3.

Il conteggio di `campaignSchema.test.ts` inventato («87 → 91»; è 76 → 88) contraddice in silenzio
una riga della tabella §6 che la passata ha lasciato in piedi non marcata.

---

## 6. Da dove ripartire

1. **Il giro refuta-e-ripara sui 17 rilievi del documento del piano**, poi unire
   `plan-b-verificato`. È corto e sblocca la lettura per chiunque venga dopo.
2. **Finire B2** — un test — e poi B3→B8. Lo script è salvato; le ancore dentro sono corrette.
3. **Wave C**, dopo la B: la misura su Chrome a 393×852 e 375×667 **su una porta che non è la
   5199** (la 5199 è la campagna vera del proprietario), e il docblock di `ArchivedSession.items`.
   Il rig sta fuori dal repo e si riusa:
   `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/`,
   `node run.mjs cases.json`, e `AUDIT_ORIGIN` è la variabile che sposta l'origine.
4. Debito minore ancora aperto, **non rimisurato in questa sessione e quindi da rimisurare o
   togliere**: `pdfjs-dist` con un avviso HIGH; nessun linter in tutto il repo; gli stili inline che
   mescolano lo shorthand `font` con `fontVariantNumeric`.

---

## 7. Regole che non si negoziano

Tutte quelle di `HANDOFF-2026-08-27-corsia-c.md` §8 restano e hanno retto. Quelle che questa
sessione ha aggiunto o messo alla prova:

- **I symlink di un worktree sono tre, non due**: `node_modules`, `.tools` **e `Manuali`**. Senza il
  terzo il cancello `build:srd --check` non gira, e la suite riporta 7 skip che sembrano un
  problema e non lo sono.
- **Un revisore che muta non lavora nel worktree condiviso.** Ho mandato tre lenti a fare
  revert-e-riprova nella stessa cartella in parallelo, e una di loro ha visto il file cambiare
  sotto di sé a metà revisione. È la trappola dei due scrittori in un worktree, per un'altra porta.
  Chi muta fa `rsync` di una copia sua.
- **`$$typeof === Symbol.for('react.memo')` non prova niente.** Prova che `memo()` è stato chiamato,
  non che salti un render. Un prop che è un oggetto letterale fresco rende il memo inerte e quel
  test resta verde. La prova è un test che conta i render.
- **`tests/ui/screens.test.tsx` scansiona `src/ui` con due regex** — `^export (?:function|class)` e
  `^export const … = (` — e `export const X = memo(…)` **non soddisfa nessuna delle due**. Avvolgere
  un componente esportato in un memo lo fa sparire in silenzio da quell'arnese. Lo stesso file monta
  `SessionRow` con `handle` come oggetto letterale, quindi il tipo di quel prop non si può cambiare
  da fuori.
- **Contare `it(` con grep non è contare i test.** Dà 3536 contro i 4219 veri di vitest. L'unico
  totale onesto è la riga che stampa `npx vitest run`.
- **Un mio numero vale quanto quello di un documento.** L'88px della §4 l'ho ripetuto io da un piano
  senza verificarlo, ed è stato preso da un controllo automatico, non da me. La regola
  «un numero ereditato va rimisurato» vale anche quando a ereditarlo è chi scrive il brief.
- **Refutare sempre le proprie correzioni, e stavolta la prova è schiacciante.** 36 sfide su 70
  ribaltate sul piano, 14 rilievi su 36 ribaltati sulle corsie. È la metà.

---

## 8. Dove stanno le cose

- Rami spinti su `origin`: **`wave-b`** (B1 + B2-WIP), **`plan-b-verificato`** (`878d675`).
- I worktree di questa sessione sono stati **rimossi** e i rami sono su `origin`: ricrearli con
  `git worktree add <path> wave-b`, e ricordarsi dei **tre** symlink.
- Gli artefatti della verifica, fuori dal repo e fuori dallo scratchpad di sessione:
  `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/piano-b-2026-08-27/`
  — `plan-b-verification.json` (le 34 correzioni, i 64 pericoli, le 36 sfide ribaltate, con le
  prove), `a12-findings.json` e `a34-findings.json` (i rilievi delle corsie), `ground-truth.md`
  (quello che ho letto di persona nell'albero), e i sette script di workflow di questa sessione.
- **Le correzioni sono comunque tutte dentro il documento del piano** sul ramo
  `plan-b-verificato`: il JSON è una comodità, non l'originale.
