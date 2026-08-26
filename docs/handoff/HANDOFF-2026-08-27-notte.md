# Handoff — notte fra il 26 e il 27 agosto 2026

**Questo documento è l'autorità.** Supersede `HANDOFF-2026-08-26-conteggio.md`, che a sua volta
superseder `HANDOFF-2026-08-26-srd-deciso.md` su un punto. Tutto ciò che quei due dicono e che
questo non contraddice resta in vigore.

`main` è **`82682c4`** e il service worker pubblicato porta quel timbro.

---

## 1. Lo stato, in una tabella

| | |
|---|---|
| `main` | **`82682c4`** — pulito, `git status --untracked-files=all` vuoto |
| `sw.js` pubblicato | **`82682c4`** — combacia |
| `vitest` su `main` | **151 file / 3984 test** |
| `tsc --noEmit` | pulito |
| `vite build` | verde |
| `build:srd -- --check` | `matches the source` |
| **aperta e non unita** | **PR #43** `srd-search-moves` |

Node **v24.19.0** via `. ./env.sh`, sempre.

---

## 2. Quello che è stato unito stanotte

Cinque PR, tutte verdi in CI, tutte pubblicate.

| PR | cosa |
|---|---|
| **#37** | le riparazioni delle scene — era già pronta, unita a inizio sessione |
| **#38** | l'handoff del conteggio |
| **#39** | **SRD 2.1** — l'indice unificato |
| **#40** | `SEND 3` — la domanda aperta, chiusa |
| **#41** | il nome di una riga di risultato, da 10px a 12px |
| **#42** | le due voci scena — erano la stessa omissione |

### 2.1 — l'indice unificato (#39)

`src/ui/shared/srdIndex.ts` appiattisce gli **849** record in
`{ kind, id, name, page, fields, haystack }`. `searchSrd` sta **accanto** a `searchRules`, non al
suo posto: le 69 sezioni restano alla funzione che sa atterrare dentro un blocco e accendere una
riga, gli altri **780** hanno bande proprie **per kind** sotto le tre bande esistenti.

Tre decisioni che le parti successive non devono disfare:

- **L'AND è sull'intero record, non sulla riga.** Una sezione è molti soggetti sotto un titolo;
  un'arma è una cosa sola con campi corti. `broadsword melee` che chiede le due parole *in un
  campo* chiede un campo che non esiste.
- **Nessun fallback OR per i record.** Un OR su 780 record corti restituisce centinaia di righe, e
  il vincolo di leggibilità vieta l'unico modo in cui ci starebbero. Le sezioni tengono il loro,
  etichettato.
- **Nessuna riga composta da questo repository sta in un pagliaio.** Ogni stringa è verbatim dal
  dataset, fino ad `agility` minuscolo che il resto dell'app disegna via `TRAIT_LABELS`, perché
  una riga di qui può essere citata al GM come del libro. Le etichette si disegnano accanto, mai
  dentro. `tests/ui/srdIndex.test.ts` cammina tutte le 849 contro le stringhe del dataset: **0
  estranee.**

### #41 — il corpo della riga

`t-label` è `600 10px/1 var(--mono)` con `0.16em`: giusto per una parola che sta *sopra* qualcosa,
sbagliato per la cosa che si legge. Il nome di un hit era il testo più piccolo della sua riga.

Misurato su `countdown`, 33 righe, 393×852: **10px/0.16em → 1 nome a capo, 1992.62px** di lista;
**12px/0.16em → 3 a capo, 2195.74**; **12px/0.1em → 1 a capo, 2164.54**. Il taglio di spaziatura
paga l'intero aumento a 393. **A 375×667 non lo paga tutto** — tre nomi vanno a capo dove ne
andava uno — ed è scritto nel docblock invece di essere arrotondato. Righe visibili nello
scroller: invariate a entrambe le taglie.

### #40 — `SEND 3` resta un numero nudo

**Nessun sostantivo è vero di ogni roster.** `SEND n` conta carte, e una carta è un gruppo solo se
l'avversario è un Minion: la riga del roster stampa `N GROUPS OF 4` per un Minion e `×N` per tutto
il resto. Due gruppi di Minion più un Solo sono tre carte di cui due sono gruppi, quindi
`SEND 3 GROUPS` sarebbe **falso sul Solo**.

**La prima versione del test passava col mutante dentro.** Leggeva `×1` da
`container.textContent`, che porta anche il badge `IN ×1` del picker. `rosterLine()` è ancorato
allo stepper della riga adesso: rosso col mutante, verde senza, codice identico a `main` dopo.

### #42 — le due voci scena erano una

`AddSheet` scrive `{ roster, adjustments }` su una riga scena in una chiamata sola. `SceneArm`
leggeva il roster **solo** per decidere se mostrare START THIS FIGHT, e gli `adjustments` non li
leggeva affatto. Quindi il piano di una riga scena era **invisibile**, **a scrittura unica**, e
portava al tavolo un damage bump che non nominava.

Tre pezzi **sollevati** da `EncounterArm`, non copiati: `RosterList`, `AdjustmentNotes`,
`useRosterToBoard`. Il giro che rende un piano modificabile: **PUT THIS ROSTER ON THE BOARD** →
modifica nel builder → **KEEP THE BOARD'S ROSTER HERE**.

**È costato una rinomina.** `PUT THIS ON THE BOARD` e `KEEP WHAT IS ON THE BOARD` erano
inequivoci finché un ambiente era l'unica cosa che quella riga potesse mandare da qualche parte.
Adesso ogni verbo che nomina il board nomina anche **cosa** sposta:

| era | è |
|---|---|
| `PUT THIS ON THE BOARD` | `PUT THIS ENVIRONMENT ON THE BOARD` |
| `KEEP WHAT IS ON THE BOARD` | `KEEP THE BOARD'S ENVIRONMENT HERE` |

Misurato: ogni verbo 44.00 alto, `docOverflowX` 0.00, e i quattro prendono **una riga ciascuno**
contro una colonna da 363px — 104px che quel braccio prima non spendeva.

---

## 3. PR #43, aperta: la 2.2 è in due metà

**`srd-search-moves` — solo lo spostamento, nessun cambio di comportamento.** Il conteggio dei
test è identico a `main`: **151 / 3984**.

### Perché la §2.2 del piano non è eseguibile come scritta — il nono punto falso

> §2.2: *«`RuleSearch.tsx` si sposta in `src/ui/shared/`.»*

Non può. **Niente in `src/ui/shared/` importava da `src/ui/gm/`** — era vero di ogni file della
cartella — e `RuleSearch` importa `BlockView` da `ReferenceTables.tsx`, che importa `gmStore`.
Spostare la ricerca da sola avrebbe invertito la stratificazione, o trascinato dietro un file da
1.275 righe e lo store del GM.

Quindi `BlockView` va per primo, e passa solo la parte che non ha store:

| spostato | perché poteva |
|---|---|
| `BlockView` + `BlockTarget` + `BlockLanding` → `shared/BlockView.tsx` | non legge nessuno store |
| `ask.ts`, `askCatalogue.ts` → `shared/` | importavano solo da `shared/` |
| `RuleSearch.tsx` → `shared/` | una volta spostati i due sopra, niente punta più all'indietro |

Verificato, non supposto: `grep -rn "from '../gm/" src/ui/shared/` è **vuoto** dopo la PR.

**Attenzione alla CI di #43:** l'evento `pull_request` non è arrivato e la PR è rimasta senza
check. È stata lanciata a mano con `gh workflow run ci.yml --ref srd-search-moves`. Chi riprende
**controlli l'esito prima di unire** — non dare per verde per il fatto che il cancello locale lo
era.

---

## 4. IL LAVORO CHE RESTA

### 4.1 — la seconda metà della 2.2: la porta

Non è partita. Cosa serve, tutto già deciso:

1. **`Screen` guadagna `'search'`** — `src/store/state.ts:28` è
   `'play' | 'cards' | 'build' | 'gm' | 'settings'`, e `SCREENS` in `src/store/prefs.ts` lo
   accompagna. `allowedScreen` riporta a `play` ogni valore che non conosce, quindi una
   preferenza salvata da una versione vecchia non rompe niente.
2. **Quinta voce della TabBar** — `src/ui/shell/TabBar.tsx:104`, `TABS` è
   `{ id, label, mark }`. **Deciso e misurato il 26 agosto:** costo verticale **0.00px** a
   393×852 e a 375×667; le schede passano da 98.25 a **78.60** di larghezza a 393 e da 93.75 a
   **75.00** a 375; l'etichetta `SEARCH` è 42.00 e le resta 36.59 / 33.00 di aria; ogni bersaglio
   resta 78.60×60 e 75×60. Serve un `mark` nuovo, che è l'unica cosa non decisa.
3. **Una rotta in `App.tsx`** — i blocchi `screen === 'x'` stanno intorno a 510-535, e la TabBar
   si disegna con `phone && !onboarding && screen !== 'gm'` a :566.
4. **L'ambito predefinito**, che è la parte che conta più della porta. §2.2: *«un giocatore apre
   già ristretto a ciò che ha in mano, e un tap allarga a tutto il libro»*. Chi scrive `rally`
   intende *la mia carta*. Senza personaggio aperto degrada a tutto il libro, che è corretto e non
   vuoto (§4.5).

**RESTA DA MISURARE UNA COSA SOLA, ed è questa:** la lista dei risultati **dentro Play**. È una
colonna diversa da quella di `ShowSheet` e i suoi numeri non si trasportano. Il rig esiste — `ls`
diretto, mai un `find` sulla home:

```
~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/
```

Case pronti da riusare, scritti stanotte: `cases-srdindex.json`, `cases-srdshots.json`,
`cases-rowtype.json`, `cases-scenearm.json`. Si lanciano con
`AUDIT_ORIGIN=http://localhost:52xx node run.mjs <file>` — **mai** 5199.

### 4.2 — poi 2.3 e 2.4, in quest'ordine

Sequenziali, una PR per parte, perché scrivono tutte `RuleSearch.tsx` (ora in `shared/`).

- **2.3** — i momenti come appartenenza. Il ballottaggio è ratificato: **8 orfani, 94 appartenenze
  su 61 sezioni**, e il test è una **lista di esclusione**, non un settimo momento (costerebbe
  52px in una colonna che entra per 0.3px). `AskEntry.moment` è **singolo** e il ballottaggio è
  **plurale**: non esiste in `src/` nessun tipo sezione→momenti.
- **2.4** — risposta prima per le domande con un numero dentro. Puntatore a una riga, **mai una
  copia**.

---

## 5. Le cose decise, da non riaprire

Tutti i divieti di `HANDOFF-2026-08-26-conteggio §8` restano. In più:

- **`SEND n TO THE SCENE` conta le carte, ed è giusto**, e adesso il motivo è un test
  (`minionGroups.test.tsx`, *is bare because no noun is true of a roster with both in it*).
- **Il catalogo `ask.ts` non si allarga ai 780 record.** Il motivo è semantico, non meccanico:
  `ask.ts` **non chiama** `searchRules`.
- **`searchRules` non si cancella e non si restringe.** `RuleSearch.tsx` lo chiama per le sezioni,
  perché solo un hit di sezione può atterrare e accendere una riga.
- **`the board`, `the plan` e `a scene` sono tre concetti distinti.** `SessionBody` lo prova.
- **La larghezza di un bersaglio distruttivo è `var(--control)`**, mai un letterale.
- **Un test che porta la risposta attesa come letterale conferma qualunque cosa il codice faccia
  dopo.** Stanotte è successo di nuovo, in #40, e l'ha preso solo la prova del mutante.
- **Nessuna parola dell'SRD va mai ribattuta nel repository**, e adesso c'è un test che lo
  cammina su tutte le 849.
- **Non camminare l'app sui dati del proprietario:** 5199 è la campagna vera. Stanotte è stata
  usata la 5203, IndexedDB vuoto.

---

## 6. I punti falsi del piano, adesso nove

`RICERCA-SRD-2026-08-26.md` è marcato in testa come corretto su sette punti. Stanotte ne sono
emersi due altri, e nessuno dei due si vedeva leggendo:

8. **§1.1 offre `Rally` come *carta di dominio*.** Non lo è: **nessun record di nessun kind si
   chiama `Rally`**. È la feature di classe del Bard, più tre feature di sottoclasse che ne danno
   il dado. Ciò che l'esempio doveva mostrare era vero comunque, quindi è corretto sul posto e
   pinnato in `tests/ui/srdIndex.test.ts`.
9. **§2.2 dice che `RuleSearch.tsx` si sposta in `shared/`, punto.** Non può senza spostare prima
   `BlockView`: vedi §3.

**La regola operativa:** non fidarsi di un *kind*, di un percorso o di una dipendenza nominati in
quel piano senza verificarli nel dataset o nel codice prima di costruirci sopra.

---

## 7. Una domanda aperta, lasciata al proprietario

**Il `mark` della quinta scheda.** Le altre quattro portano una forma geometrica dichiarata inline
(`TabBar.tsx:104-118`). Che forma sia una ricerca non è deciso, e una lente disegnata a mano in
CSS è la cosa che le altre quattro non sono. Va scelta, non indovinata.
