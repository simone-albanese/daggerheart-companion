# Handoff — 27 agosto 2026, sessione «la rete sotto il bump»

**Questo documento è l'autorità.** Supersede `HANDOFF-2026-08-27-parallelo.md` su tutto ciò che
contraddice; quello che quel file dice e questo non tocca resta in vigore. In particolare restano
in vigore le sue §5.1 (il parcheggio è una decisione ratificata, non un incidente) e §5.2, che
questa sessione ha finalmente reso falsa: **`.dhcampaign` adesso si rilegge.**

---

## 1. Cosa è stato spedito

**L'ultimo commit di codice di questa sessione è `b0cb250` (#52), verificato pubblicato.** La
punta di `main` è più avanti e continuerà a muoversi: i commit dopo `b0cb250` sono documentazione,
questo file compreso. **Non fidarti di un SHA di punta scritto qui — leggi `git log -1`.** La
prima stesura ne aveva scritto uno, e la PR che lo correggeva ha spostato la punta di nuovo: un
documento non può nominare il commit a cui atterra.

| | cosa | stato |
|---|---|---|
| **Indice** | l'indice per categorie nel search | **unita, #51, `f0af890`, in produzione** |
| **C** | import delle campagne + backup automatico | **unita, #52, `b0cb250`, in produzione** |
| **Questo documento** | il handoff, e le sue due correzioni | **unito, #53 → #54 → #55** |
| **B** | parallelo vero: ogni riga tiene la sua rissa, schema 4→5 | piano pronto, **non eseguito** |

Entrambe le PR di codice sono verificate **scaricando `sw.js` dal sito pubblicato**, non dedotte
da un run verde: `const BUILD` riportava `f0af890` e poi `b0cb250`, gli stessi SHA dei merge.

### 1a. La #51, e come è stata verificata

La CI era vera e verde, non una PR CLEAN senza check: run `33064159831`, evento `pull_request`,
`headSha` identico a quello della PR. **In più è stato girato in locale il cancello che la CI
salta in ogni run** — il PDF dell'SRD non è sul runner, quindi lo step di ri-estrazione è sempre
saltato: `npm run build:srd -- --check` risponde `data/srd-1.0.json matches the source`,
validazione pulita.

Unita come `f0af890`, e **la pubblicazione è verificata scaricando il sito**, non dedotta:
`curl .../sw.js` riporta `const BUILD = 'f0af8903…'`, lo stesso SHA del merge.

### 1b. La #52 — la corsia C

26 commit, 33 file. Chiude i due blocchi che `HANDOFF-2026-08-27-parallelo.md` §6 chiamava la
cosa più grave uscita da tutta l'indagine, e nessuno dei due riguarda le scene.

**L'import.** Solo aggiunta: `addCampaign` usa `IDBObjectStore.add`, quindi una chiave occupata
è rifiutata da IndexedDB *dentro la transazione* — l'esito distruttivo è irraggiungibile invece
che evitato con cura. Un file il cui id è già qui atterra **accanto** al record che lo tiene, con
un UUID nuovo e un nome coniato; il record che c'era non viene letto, né confrontato, né toccato.
Ogni id tranne la chiave resta identico byte per byte. Il magazzino `characters` è irraggiungibile
dall'import **a livello di tipo**: `CampaignImportDeps` non ha nessun accessore ai personaggi.

**Il backup.** Un `.dhcampaign` datato per campagna, nella stessa cartella del `.dhbackup`,
**preso dalla memoria attraverso un seam e non dal disco** — perché `writeActive` aggiorna
`state.campaigns` solo *dopo* che `putCampaign` ha risolto, quindi proprio quando le scritture
falliscono un backup preso dal disco scriverebbe il record vecchio, lo verificherebbe contento e
timbrerebbe «ultimo backup: oggi» sopra una serata che non esiste da nessuna parte.

## 2. Il piano C è stato verificato PRIMA di essere costruito, e va fatto sempre

121 sue affermazioni contro l'albero, 14 agenti. `git diff 14c995a..main` su ogni file della
corsia era **vuoto**, quindi le citazioni reggevano ancora — tranne cinque.

**Otto sono risultate false, e il giro di refutazione ne ha ribaltate tre: erano sbagliati i
verificatori, non il piano.** È la stessa proporzione della volta scorsa (cinque su diciotto). Il
giro di refutazione non è un lusso: senza, tre correzioni sbagliate sarebbero entrate nel codice.

Le cinque che restano, corrette nel documento del piano e non ri-derivate:

- **`gmStore.ts:300-320` non parla di localStorage.** L'argomento sta nell'intestazione del file
  (`:1-15`), più `:588` e `:600`.
- **`shared/campaigns.ts:669` è una riga vuota.** La frase d'intento è `:665-666`; il campo è in
  `shared/types.ts:657`.
- **`campaignFile.test.ts:340-348`**: il filtro è a `:345`, l'asserzione su «Ilya of the Ninth» a
  `:361`. Il precedente che illustra è vero, sbagliato solo l'intervallo.
- **`parseCampaignFile` era già raggiungibile da `src/`**, per via di `exportCampaign` a
  `campaignFile.ts:182`. La conclusione regge (nessuna voce d'allowlist), la ragione no.
- **«tutto passa dall'unico flag `running`» è falso, e questa ha i denti.** `running` è un `let`
  chiuso dentro `installBackupHooks` e serializza solo le due gambe automatiche; ci sono
  **quattro** chiamanti manuali che non lo toccano (`Settings.tsx`, `ScreenBoundary.tsx`,
  `App.tsx`, `AppBoundary.tsx`).

**Il meccanismo su cui poggia tutto l'import è stato provato eseguendolo, non leggendolo**: 13
test sonda contro idb 8.0.3 e fake-indexeddb 6.2.5. `.name === 'ConstraintError'` esatto;
`tx.done` poi rifiuta `AbortError`; `hold()` e l'assorbimento dentro il catch sono **ciascuno
sufficiente da solo** — la versione ingenua senza nessuno dei due perde una unhandled rejection;
l'occupante resta identico byte per byte; `QuotaExceededError` e `DataError` passano come throw;
due `add` concorrenti sullo stesso id fresco danno esattamente `["added","taken"]`, count 1.

Una ragione del piano è **stantia**: dice di controllare `.name` invece di `instanceof
DOMException` «perché fake-indexeddb ha il suo shim». Non più — la 6.2.5 usa la `DOMException`
della piattaforma. La regola resta giusta, la ragione no.

## 3. La revisione ha trovato tre blocchi, tutti introdotti da questo lavoro

Cinque lenti, 26 rilievi, **23 confermati riproducendoli e 3 refutati**. Tutti e 23 riparati, ogni
riparazione con un test che fallisce senza di essa, ognuna provata rimettendo il difetto e
nominando il test che diventa rosso: **30 mutanti, zero sopravvissuti.**

### 3.1 L'import poteva distruggere in silenzio la campagna appena ripristinata

`applyCampaignImport` decideva la collisione solo su `deps.add`, che interroga il **disco**.
`previewCampaignImport` calcola `localSameId` dalla **memoria**. Quando la memoria tiene un id che
il disco non ha ancora, `add` risponde `'added'`, il record viene scritto **sotto l'id della
campagna aperta**, e poi `switchCampaign(id)` incontra il suo ritorno anticipato su
`id === activeCampaignId` e la lavagna vecchia viene raccolta sopra l'import.

**Il docblock del piano sosteneva che quel ritorno anticipato «non può mai scattare sotto
add-only».** Può. La memoria adesso è autorevole quanto il disco per «la chiave è presa», e
l'argomento è **marcato REFUTED nel documento del piano**, non ri-derivato di nascosto.

### 3.2 Un archivio campagne illeggibile ammazzava anche il backup dei personaggi

`runBackup` non proteggeva la lettura delle campagne. Prima di questa corsia le due cose non si
toccavano: è una regressione contro l'unica regola che quel sottosistema ha, e l'indicatore
restava verde. Adesso degrada a un **fallimento con un nome**, scrive comunque il file dei
personaggi e va rosso.

### 3.3 SAVE A COPY esportava il record precedente a una scrittura fallita

Sotto una frase di successo. È esattamente il fatale attorno a cui la gamba automatica era stata
riprogettata, rimasto aperto sulla gamba manuale. Adesso legge lo stesso record «prima la
memoria» che costruisce `snapshotCampaigns`, così le due gambe della rete non possono discordare.

## 4. Il giro completo è provato, ed è la cosa che nessuna delle due metà poteva provare

`tests/store/campaignRoundTrip.test.ts`. Un file che la gamba di backup ha **davvero scritto**,
riletto dalla gamba di import. Il seam non è iniettato, i byte non sono ricostruiti, il record
attraversa una structured clone e ripassa da `readCampaignRecord`. Zero warning di riparazione.
Compreso il caso sporco: una lavagna modificata e non scaricata viene salvata **con la modifica**
e reimportata modificata.

Mutante che lo dimostra utile: far leggere il disco a `currentCampaigns` uccide tutti e 7 i test —
e `backupSeam.test.ts`, le 21 guardie a livello di sorgente che possiedono quel cablaggio, resta
**interamente verde**. È esattamente il buco che questo file chiude.

## 5. La misura sul vetro, con l'A/B che questo repo pretende

393×852, stessa campagna seminata. La scheda SAVE **già scorreva su main**: non l'ha introdotto
questa corsia.

| | blocchi | scrollHeight | oltre la finestra | SAVE A COPY | porta nuova |
|---|---|---|---|---|---|
| **main** | 2 | 413 | 105px | 78px sopra la piega | — |
| **corsia C** | 3 | 521 | **213px** | 78px, **non si è mosso** | **103px sotto la piega** |

Raggiungibile — la radice della scheda è `scroll stack` per progetto — e adesso è **un numero nel
docblock invece del debito** che la prima passata aveva lasciato.

Un rilievo sulla stessa area è stato **refutato**: «BRING IT IN sta 2,1 schermate sotto la piega»
era la finestra di scorrimento divisa per sé stessa. La misura vera è 0,74.

## 6. Il difetto lasciato dentro, di proposito

**`switchCampaign` butta una lavagna non salvata quando il flush che lo precede non è atterrato, e
`createCampaign` porta la riga identica.** È **preesistente**: la riga campagne di MENU lo guida
già su `main`. Non è stato riparato qui per due ragioni, entrambe scritte nel nuovo docblock
`KNOWN DEFECT`:

1. Ripararlo in una porta sola sarebbe la mezza riparazione che quel docblock esiste per rifiutare
   — chiuderebbe MENU e BRING IT IN e lascerebbe aperto NEW CAMPAIGN.
2. Cambiare la semantica di quel verbo appartiene alla corsia che sta per riscrivere quel file.

**Chi ripara la 6 deve riparare `createCampaign` nello stesso cambiamento.**

## 7. Da dove ripartire

1. **La corsia B**, dal suo piano `PIANO-B-SCENE-PER-RIGA-2026-08-27.md`. Wave A (quattro corsie
   disgiunte) → Wave B (una corsia, un commit, atomica: non si può spezzare) → Wave C.
   Il worktree si taglia da `main` **locale**, cosa che adesso si può fare: la #52 è atterrata,
   che era l'intera ragione dell'ordine C→B.
2. Il difetto §6, nella stessa passata in cui la wave B tocca `gmStore.ts`.
3. Debito minore ancora aperto: `pdfjs-dist` con un avviso HIGH; nessun linter in tutto il repo;
   gli stili inline che mescolano lo shorthand `font` con `fontVariantNumeric` (lo shorthand
   resetta le cifre tabulari, e sono su Fear, HP, countdown e dadi).

   **Due numeri di quel debito erano sbagliati e sono stati rimisurati, non ricopiati.**
   `HANDOFF-2026-08-27-parallelo.md` §6 diceva «86 commit dal `0.6.0` del CHANGELOG e zero tag»,
   e la prima stesura di questo documento ha ricopiato «87». Misurato contro `a0b18ff`:
   `package.json` e la sezione `## 0.6.0` del CHANGELOG sono stati portati a 0.6.0 **nello stesso
   commit**, `6e71200` del 24 agosto, e da lì sono **182 commit** (53 in first-parent, 115 senza i
   merge). Nessuna delle quattro definizioni dà 86. E i tag **non sono zero: sono tre**, tutti
   `safety/*` di metà agosto e **nessuno antenato di `main`**. Quello che è vero, e che il
   CHANGELOG stesso dice, è che non esiste **nessun tag di release**.

   La lezione, perché è costata due volte: un numero in un handoff va rimisurato quando lo si
   riporta, oppure lasciato fuori. Vedi §8.

## 8. Regole che non si negoziano

Tutte quelle di `HANDOFF-2026-08-27-sera.md` §6 e di `HANDOFF-2026-08-27-parallelo.md` §9 restano.
Quelle che questa sessione ha messo alla prova:

- `. ./env.sh` prima di ogni comando npm. Mai `git add -A`.
- **La CI non verifica il dataset.** Lo step di ri-estrazione è gated sul PDF, che non è sul
  runner e non ci sarà mai. `npm run build:srd -- --check` in locale è l'unico cancello che esiste.
- `gh pr merge` è ciò che pubblica, e va verificato scaricando `sw.js`.
- **Non camminare l'app sui dati del proprietario: 5199 è la campagna vera.** Qui sono state usate
  la 5211 e la 5212.
- **Due corsie non scrivono mai un file solo.** Ha retto: 12 file contro 15, zero sovrapposizioni,
  e l'unione dei due rami non ha prodotto un conflitto.
- **Un mutante sopravvissuto va affrontato, non nascosto.** Due sopravvivono per costruzione in
  `addCampaign` — togliere `hold()` *oppure* l'`await tx.done.catch()` è invisibile, perché
  ciascuno basta da solo. Sono tenuti entrambi e la ragione è nel docblock, non allowlistata.
- **Non scrivere in un handoff il SHA della punta di `main`.** Il commit che unisce il handoff
  sposta la punta, quindi quel numero è sbagliato dal primo istante in cui qualcuno può leggerlo.
  Nomina l'ultimo commit di **codice**, che è stabile, e manda il lettore a `git log -1` per il
  resto.
- **Un numero ereditato da un altro documento va rimisurato o tolto.** «86 commit, zero tag» è
  stato ricopiato in avanti una volta e sbagliato in entrambe le metà: vedi §7.3. Vale anche
  quando il numero non è il punto della frase.
- **Refutare sempre le proprie correzioni.** Tre verificatori su otto avevano torto sul piano;
  tre rilievi su ventisei avevano torto sul codice. Senza quel giro entrambi i gruppi sarebbero
  entrati.
- **Il rig di misura sta fuori dal repo** e si riusa:
  `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/`.
  Casi nuovi scritti qui: `cases-takein.json` e `cases-savesheet-ab.json`.
  **Trappola trovata:** gli `eval` del rig girano in un mondo isolato, quindi sostituire
  `window.showOpenFilePicker` dalla pagina **non arriva** al `globalThis` che l'app legge. Per
  guidare un file picker serve altro.
