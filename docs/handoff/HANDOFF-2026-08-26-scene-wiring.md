# Handoff — 26 agosto 2026, sera tardi

**Questo file apre con un avvertimento, ed è il primo dopo due sere che lo fa.**

`main` è `79a1469` e **non è lo stato del lavoro**. C'è una PR aperta con dentro una riparazione
finita, provata e non spedita: **#33, ramo `scene-wiring`, commit `866782a`**. La sua CI è
`queued` da 46 minuti senza che un runner la prenda — non è rossa, non è verde, non è mai partita.
Le tre CI precedenti di questo repo hanno girato in 1m47s–2m22s.

**La prima cosa da fare è decidere cosa farne.** Non costruire sopra prima di averlo fatto.

---

## 1. Il cancello

Locale, sul ramo `scene-wiring`, passato per intero:

| | atteso |
|---|---|
| `. ./env.sh && npx vitest run` | **150 file / 3947 test** |
| `. ./env.sh && npx tsc --noEmit` | pulito |
| `. ./env.sh && npx vite build` | verde |
| `. ./env.sh && npm run build:srd -- --check` | combacia |
| `gh run view 32984933419` | **`queued`** — è questo il punto aperto |

Il conto è passato da **150 / 3941** a **150 / 3947**: sei test nuovi, zero file nuovi.

**Se `vitest` dice 152 file, qualcuno ha lasciato sonde nell'albero.** È già successo oggi: due
agenti di audit hanno scritto `tests/gm/zzprobe.test.tsx` e `tests/gm/zzDestroyProbe.test.tsx`
nel working tree. Li ho cancellati e non sono nel commit. Controlla `git status --short
--untracked-files=all` prima di fidarti del conto.

---

## 2. Cosa c'è dentro la PR #33, e perché

**Il proprietario ha detto: «Le scene end to end continuano a non funzionare. Deve essere più
intuitivo, così ci si perde.»** L'audit ha trovato che non era una questione di parole.

### 2.1 La causa, una sola

`SessionBody.tsx` — `OPEN THE SCENE` faceva `onOpenTool('scene')` e **non scriveva `liveScene`**.
Camminati a mano su origine pulita, 393×852 `pointer: coarse`, i cinque tap che l'app stessa
suggerisce — `ADD → SCENE` → `OPEN THE SCENE` → *Build an encounter* → `SEND 2 TO THE SCENE` —
producevano:

```
board:   combatants [Acid Burrower 1/8 spotlit, Dire Wolf 1/4]
         liveScene: null
session: DUNGEON { roster: [], combatants: [] }
         FOREST  { roster: [], combatants: [] }
```

Premere il verbo su una riga o sull'altra faceva **la stessa identica cosa**: apriva lo stesso
tavolo, che non era di nessuna delle due.

**Non si riparava da solo.** `runScene` è l'unico scrittore di un puntatore non nullo e i suoi tre
chiamanti — `BACK TO THIS FIGHT`, `START THIS FIGHT`, i chip dello switcher — pretendono tutti che
la riga abbia *già* combattenti o un roster. Il percorso in avanti non gliene dà mai. Quello che
funzionava era **all'incontrario**: costruisci la rissa, *poi* crea la riga e prendi il roster con
`TAKE THE n ON THE BOARD NOW`.

Il docblock lo sospettava a metà — di `OPEN THE SCENE` diceva già *«lies about which row it belongs
to»* — ed era stato **retrocesso da primario** invece che riparato.

### 2.2 Le sei modifiche

- **`OPEN THE SCENE` reclama un tavolo vuoto e senza proprietario.** Solo quello: con una rissa
  sopra, la stessa chiamata parcheggerebbe quella di un altro sotto una parola che dice *apri*.
- **`TAKE THE FIGHT ON THE BOARD`** su qualunque riga scena, per la rissa che non è di nessuno
  (raggiungibile dal bestiario e dal costruttore aperto da MENU). `adoptBoard` scrive il puntatore
  e nient'altro; rifiuta una riga che ha già un parcheggio.
- **La riga chiusa legge `ON THE TABLE`**, al posto di un `PLANNED` che nessuno sta più pianificando.
  `SessionRow.tsx` non leggeva `liveScene` **per niente**.
- **La title row del runner tiene il suo nome** quando la striscia non ha nulla da mostrare.
  `Gm.tsx` passa un elemento qualunque cosa lo switcher renderizzi, quindi `{title ?? label}` di
  `GmSheet` non poteva cadere e l'intestazione si disegnava come un ✕ nudo.
- **La frase arenata torna sul tipo vivo.** *«The board is running another scene…»* stava su
  `EncounterArm` — `encounter` non è creabile da schema 3.
- **`THE CAMPAIGN` smette di illuminarsi come scena viva**: il suo gruppo ha id `null` e il
  puntatore pure, quindi `null === null`.

### 2.3 Misurato, non argomentato

Chrome, 393×852, `pointer: coarse`, contro questo ramo:

| stato | title row | scroller | ✕ | striscia | `docOverflowX` |
|---|---|---|---|---|---|
| nessuna scena viva (ripiego) | **45.00** | **582.00** | 44×44 @ right 386.00 | 315.00 | 0.00 |
| una scena viva (chip) | **45.00** | **582.00** | 44×44 @ right 386.00 | 315.00 | 0.00 |

**Costo verticale 0,00px.** La striscia è 315.00, la stessa cifra che `SceneSwitcher` aveva già
misurato per conto suo.

### 2.4 Due test ribaltati, di proposito

`sessionList.test.tsx` pinnava la demozione di `OPEN THE SCENE` sull'argomento *«the only verb that
would fit opens somebody else's scene»*. Quella frase è **falsa nell'unico stato che i test
seminavano** — nessuna scena viva, plancia vuota — cioè dove la mancata rivendicazione *era* il
difetto. Ora pinnano la demozione dove la frase è vera, con una seconda scena sul tavolo, più tre
test nuovi per la rivendicazione, l'adozione e la parola della riga chiusa.

### 2.5 Un reperto dell'audit respinto

L'audit chiamava «la trappola peggiore» il fatto che `DELETE` sulla riga viva riceva la parola più
mite. **È sbagliato.** `removeSessionItem` dice *«the pointer goes, the fight stays»*: cancellare
la riga viva non distrugge nessun segno. La parola mite è corretta e non è stata toccata.

---

## 3. Trovato e NON riparato — sono decisioni del proprietario, non cablaggio

1. **`SEND {n} TO THE SCENE` e `TAKE THE {n} ON THE BOARD NOW` contano i *gruppi* di Minion, non i
   corpi.** `roster.reduce((s, e) => s + e.count, 0)` è una somma grezza. Tre gruppi di Giant Rat
   con quattro giocatori dicono «3» e ne arrivano dodici. La riga chiusa invece conta giusto, via
   `plannedAdversaries`. **Due numeri per lo stesso roster, a una schermata di distanza.**
2. **Il roster di una riga scena è a scrittura unica.** Gli unici scrittori sono `AddSheet.tsx:340`
   (creazione) e `SessionBody.tsx:695`, che sta su `EncounterArm` — il tipo morto. Una riga creata
   prima della rissa non può più riceverne una.
3. **`adjustments` su una riga scena è scritto alla creazione e letto da nulla.** Dato morto che il
   record porta e che il GM può creare.
4. **Il ✕ «Remove X from the scene» è 34×44**, contro il pavimento di 44, su un'azione
   irreversibile. Misurato vivo. È la voce aperta n.2 del handoff precedente, ancora aperta.
5. **Le parole.** Oggi lo stesso posto si chiama `the board` sulla riga e `the scene` nel
   costruttore, e la didascalia lì sopra parla di *running* e *parking*, parole che non stanno su
   nessun bottone. **La scelta è del proprietario**, e va fatta una volta e applicata a tutte e
   quattro le schermate.

---

## 4. Il lavoro SRD è congelato prima della prima riga

`RICERCA-SRD-2026-08-26.md` è ancora il piano, e **niente di quel lavoro è iniziato**. Le tre
domande aperte della sua §6 non sono mai state fatte al proprietario, e nel frattempo sono emerse
**due cose che le cambiano**. Falle prima di scrivere una riga.

### 4.1 La §6.3 è già mezza decisa nel repo, e il piano non lo cita

`tests/gm/ask.test.ts:384` porta **`MID_SCENE`**: una lista per riga, pinnata a **35 delle 69**
sezioni, sotto un criterio scritto — *«a GM opens this during a scene, with their hands busy and
people waiting»*. Metà del giudizio riga-per-riga che il piano chiede al proprietario **esiste
già**. Partire da lì, non da zero.

### 4.2 Il test promesso dalla §2.3 non può spedire come scritto

Il piano promette *«il test che cammina ogni sezione e fallisce su una che non appartiene a
niente»*. Un ballottaggio su tutte e 69 le sezioni (10 agenti) trova **8 orfani veri**:

`introduction`, `ranger-companion`, `multiclassing`, `running-an-adventure`, `gm-guidance`,
`additional-gm-guidance`, `preparing-combat-encounters`, `campaign-frames`.

Quindi quel test fallirebbe il primo giorno su otto righe. Il proprietario deve scegliere cosa lo
sostituisce: un settimo momento, una lista di esclusione esplicita, o un test più debole.

**Distribuzione proposta** (94 appartenenze su 61 sezioni non orfane):

| momento | sezioni |
|---|---|
| `my-turn` | 26 |
| `before-the-roll` | 22 |
| `between-scenes` | 15 |
| `the-dice-landed` | 13 |
| `damage` | 11 |
| `this-place` | 7 |

Due segnalazioni dei critici: **`MY TURN` prende 26 su 69 e significa due persone diverse** (16
sono il turno del GM, 7 quello del PC); **`THIS PLACE` ha 7 membri di cui 5 solo-GM**, e un
giocatore non lo toccherebbe mai. Il ballottaggio completo con le motivazioni riga per riga è in
`ballot.json`; le critiche in `critiques.json` (percorsi in §6).

### 4.3 Una settima citazione sbagliata del piano

Il handoff precedente ne elencava sei. La settima: il piano §1.3 dice **«34 sezioni su 69»** senza
sottotitoli. Sono **33**. Il 34 esiste ma è un'altra misura — le sezioni che si disegnano come *un
blocco solo* — e `RuleSearch.tsx:87` lo spiega già: *«33 carry no `##` at all, and `the-basics`
opens with its only one»*. Quel 34 è pinnato in `ruleSearch.test.tsx:1397`. L'argomento del piano
regge; il numero è preso in prestito dalla misura sbagliata.

### 4.4 Due imprecisioni del piano sulla parte 2.3

- Dice che il campo vuoto «oggi disegna una lista vuota». Falso su `ShowSheet`: disegna i **sei
  chip dei momenti** (griglia 3×2, già misurata, 44px) e le porte.
- Mette «le sei righe dei momenti sopra il campo» fra le cose **da misurare in Chrome**. Sono già
  misurate: `ShowSheet.tsx` porta l'aritmetica, inclusi i 16,33px di tracking che comprano la terza
  colonna.

Le altre cifre del piano sono verificate e **tornano tutte**: 156 `##`, zero `###`, 100.165
caratteri, 780 record fuori dal pagliaio, 69 sezioni.

### 4.5 Un vincolo strutturale che nessun documento nomina

`src/ui/shared/` oggi **non importa niente da `src/ui/gm/`**. `BlockView` sta in
`src/ui/gm/ReferenceTables.tsx` e `AdversaryBlock`/`EnvironmentBlock` in `src/ui/gm/StatBlock.tsx`.
Spostare `RuleSearch.tsx` in `shared/` (parte 2.2) invertirebbe quel livello. `DomainCardView` e
`RuleTableView` sono già in `shared/`.

Inoltre: **`tests/harness/orphans.test.ts` cammina `src/` e fallisce su un export senza chiamante.**
Quindi la parte 2.1 deve *cablare* `searchSrd`, non solo costruirlo.

---

## 5. Cosa non toccare, e sono decisioni

Restano in vigore le voci di `WAVE3 §8`, `HANDOFF-2026-08-26 §8` e `HANDOFF-2026-08-26-notte §7`.
Più, da oggi:

- **`liveScene` si scrive in tre punti e basta**: `runScene`, `adoptBoard`, `clearScene`
  (e `removeSessionItem` lo azzera). Un quarto scrittore va argomentato.
- **`adoptBoard` non copia niente.** È il puntatore e solo il puntatore. Rifiuta una riga che ha
  già un parcheggio: due risse e una plancia è uno stato che nessuno schermo può disegnare
  onestamente.
- **`OPEN THE SCENE` non reclama mai un tavolo che ha una rissa sopra.** La demozione resta dove
  la sua frase è vera.
- **Mai `git add -A`.** **`. ./env.sh` prima di ogni comando npm** (il node di sistema è 26 e
  nasconde `localStorage` a jsdom). **Le prove per mutazione in una copia isolata.**
  **`build:srd -- --check` è il cancello vero.**
- **`searchRules` non si cancella e non si restringe**: `ask.ts` lo chiama.
- **Nessuna parola dell'SRD va mai ribattuta nel repository.**
- **Non camminare l'app sui dati del proprietario.** `localhost:5199` ha la sua campagna vera —
  otto personaggi, `MY CAMPAIGN`. Tutta la prova di oggi è stata fatta su `localhost:5200`, origine
  separata, IndexedDB vuoto. Nulla di reale è stato letto, scritto o cancellato.

---

## 6. Dove stanno le cose

- **Documento dell'audit, pubblicato:**
  https://claude.ai/code/artifact/25c75908-8c6d-412d-8821-fd67eab8e847 — «Il tavolo di nessuno».
  Nove reperti ordinati per gravità, i cinque tap, la proposta di riparazione. **Scritto prima
  della riparazione**, quindi descrive il difetto al presente: va aggiornato o marcato come storico.
- **Risultati grezzi dell'audit scene** (16 agenti, 2,8M token):
  `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/288c533a-1584-4e59-a5d4-c3726c5b1ed0/subagents/workflows/wf_358a2e72-367/journal.jsonl`
- **Ballottaggio dei 69 momenti** (10 agenti), salvato nel repo perché lo scratchpad muore con la
  sessione — **non tracciati da git**, sono materiale per una decisione, non una decisione:
  - `docs/handoff/BALLOT-MOMENTI-2026-08-26.json` — 69 righe, ognuna con `moments`, una
    motivazione `why` nelle parole di chi sta al tavolo, `confidence`
    (`obvious`/`arguable`/`contested`) e una `note` sugli orfani e sugli strappi;
  - `docs/handoff/BALLOT-MOMENTI-CRITICHE-2026-08-26.json` — quattro letture avversariali
    (orfani, distribuzione, righe sbagliate, il posto del giocatore);
  - grezzo: `wf_7c02e453-5af/journal.jsonl` nella cartella dei workflow di sessione.

**Il ballottaggio non è una decisione.** È una proposta riga per riga da ratificare o correggere,
e la §6.3 del piano dice che quella decisione è del proprietario.

---

## 7. Per riprendere

1. **Decidi cosa fare della PR #33.** Rilanciare la CI (`gh run rerun 32984933419`, o un
   `workflow_dispatch`) è la mossa più economica per capire se è la coda o il workflow. Unire è ciò
   che pubblica — il `git push origin main` successivo è un no-op.
2. Ricontrolla il cancello del §1 su `main` dopo il merge.
3. Poi: **le tre domande della §6 del piano SRD**, tutte insieme, prima di scrivere una riga,
   corrette da §4.1 e §4.2 di questo file.
4. L'ordine `2.1 → 2.2 → 2.3 → 2.4` regge e **non è parallelizzabile**: tutte e quattro scrivono
   `RuleSearch.tsx`, tre su quattro anche `srdReference.ts`.
