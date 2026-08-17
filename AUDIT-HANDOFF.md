# Audit di resa — handoff 2, per ripartire a contesto pulito

Questo file **sostituisce** l'handoff precedente, che descriveva un albero dove
nessuna riga era stata scritta. Ora ne sono state scritte molte.

**Stato.** `main` è a `42aa3bd`, **2373 test in 103 file, verdi**, `tsc --noEmit`
pulito, albero pulito a parte questo file. **61 commit avanti a `origin/main`;
niente è pushato.** Il push fa partire un deploy vero su GitHub Pages.

---

## 1. Cosa è già in `main`

Sette lane fuse, ciascuna da un worktree isolato tagliato da `main` locale.

| Chiuso | Cos'era, misurato | Nota |
|---|---|---|
| **Difetto 1** — dialoghi di Play | Quattro dialoghi (non tre) tagliati su ogni telefono: CLOSE dipinto 9-10px su 44 e il suo centro colpiva **PLAY**, CLEAR ALL colpiva **GM** | **La causa nell'handoff era sbagliata.** Non un containing block: `.scroll-fade` è `mask-image`, un effect node che ritaglia paint e hit-testing di tutto il sottoalbero, discendenti `fixed` inclusi. Un fix mirato alla causa dichiarata non avrebbe spostato nulla |
| **Difetti 2 + 4** — shell | Il tab GM occluso al 100% fino a **802px** (non 828) e la riga flex sovra-sottoscritta fino a 864; un nome più largo di ~118px spingeva SETTINGS fuori schermo | `minmax(0,1fr)` da solo **non** basta: serve anche `min-width: 0`, o il minimo content-based dell'header sborda la traccia già limitata |
| **Difetto 3** — Cards | «12px di lista» era **0px di contenuto**: i 12 erano tutto padding. Nessuna carta disegnata a 640×360. Più i rail dei filtri che nascondevano l'intero gruppo RECALL | |
| **Difetto 7 / decisione 8** — wizard | Esteso da solo alla classe a **quattro** pickers: ancestry e community nascondono di più (111-285px e 158-253px) sotto una clamp più stretta, e **Mixed Ancestry era vuota** — zero parole su entrambi i lignaggi | |
| **Decisione 10** — erase | Non contava le campagne né i record quarantenati che `clearAll` cancella comunque | Il numero ovvio (`readCampaigns().campaigns.length`) era **lo stesso difetto travestito da correzione** |
| **Gear picker** (HIGH) | Lista a 0px di contenuto su 20.534px, Unequip e Done tagliati senza scroll | Trovato **solo** dalla verifica avversariale |
| **Level up** | 123px di finestra su 1938px; +69px a ogni viewport, portrait incluso | E il selettore personaggio dentro quella banda poteva **ripuntare un piano a metà su un altro personaggio** |
| **Banner** | Il warning troncava la propria spiegazione; costa **66px** non 58 | E **due banner insieme costano 132** — installazione nuova + update in coda, margini che non collassano perché `<main>` è flex |
| `.gitignore` | `Manuali/` con la barra non matcha un symlink: una lane aveva già committato un blob 120000 che al merge avrebbe sostituito **321MB di PDF acquistati** con un link a sé stesso | Preso prima del merge leggendo `git diff --name-only`. Backup in `~/Documents/Manuali-BACKUP-audit` |
| Onestà | `probe.js` chiamava «WCAG 2.5.8» un test `w<24||h<24` senza controllo di spaziatura; sette rilevazioni portavano l'accusa sbagliata | Accusare sempre il **floor 44/34 di questo progetto**, che è più severo e sufficiente |

---

## 2. Cosa è in volo, dove sta, e come riprenderlo

**Tutto è su disco. Nessun agente sopravvive al riavvio; i commit sì.**

### 2a. `a2-play` — worktree `~/Documents/dh-wt2/play`, ramo **`a2-play-reflow`** a `88a1e05`

⚠️ Il ramo si chiama `a2-play-reflow`, non `a2-play`: la lane se l'è creato da sé.

**13 commit fatti.** Decisione 7 (pips) completa; decisioni 1, 3, 2, 4, 5, 6
completa; larghezze strette completa; ellissi dei riassunti completa.

    88a1e05 Let a fold summary end in an ellipsis instead of running off the glass
    a9d8381 Let the counter cells shrink to the column instead of cutting the + off the glass
    0a5ff3c Put the Cards fold above Carried
    c982d5b Stack the trait chips at 15px, and stop the row wrapping on every 360px Android
    2896081 Draw the numbers people read at 32 and 22, inside heights that did not move
    f814a3a Move the conditions door into the defence band and take the identity block off the phone
    fd26b6f Take RENAME off the Play sheet, where Build already had the only door needed
    ... e sei commit della decisione 7

**Lavoro NON committato nel worktree**: `src/ui/player/Play.tsx` e
`tests/ui/playSheet.test.tsx`, 240 righe. È la riscrittura del budget
(`STACK`/`INDEX` ai numeri nuovi). **Verificato prima della pausa: compila
(`tsc` pulito) e i 110 test di `playSheet.test.tsx` passano.** Copia di sicurezza:
`audit-harness/play-budget-WIP.patch`.

**Resta da fare in questo worktree — il passo 3 di 3, mai iniziato: il cockpit.**
Tre difetti HIGH confermati che non stanno in nessuna lista del proprietario:

- **#24 — ROLL dipinto 0 di 54px** a 698px di altezza viewport e sotto, a **ogni**
  larghezza desktop, nello stato ordinario appena installato + caduto.
  Fix proposto e verificato dal codice: `DualityRoll.tsx:874`
  `overflow: 'hidden'` → `overflowY: 'auto'`. Chiude anche **#23** (bottone danno
  a 15 di 44px a 1280×800). Poi riscrivere `Play.tsx:26-27` («fits without
  scrolling») e l'argomento di posizione a `DualityRoll.tsx:961-969`.
- **#21 — la mensola dei modificatori è 303px e ne contiene 1058**, con
  `scrollbarWidth: 'none'`: DIFF, + DIE, SPELLCAST e 4 chip Esperienza su 5
  dipinti a **0px**, a ogni larghezza. Identica a 1180, 1280, 1440 e 2560 perché
  la traccia centrale è limitata a `minmax(360px, 428px)`.
  Fix: `DualityRoll.tsx:644` `wrap={layout === 'phone'}` → `wrap`. **Costa ~120px
  al pannello, quindi va dopo il fix di #24, mai prima.**
- **#27** chip Esperienza del cockpit clampata a 2 righe (14px nascosti),
  **#28** porta delle condizioni spinta 133px fuori dalla striscia con due
  condizioni nominate, **#76** casella danno a 866,6px dalle soglie che il suo
  docblock dice di leggere «accanto», **#22** `TO VAULT` 56×10 su cinque carte
  (nessun test in tutto il repo lo nomina), **#36** `USE` 30,8×44 mentre
  `Play.tsx:678-680` dichiara che ogni mis-tap costoso ha «un bersaglio molto più
  grande o un secondo tocco».

### 2b. `a2-clearall` — worktree `~/Documents/dh-wt2/clearall`, a `d320aa3` — **FINITO**

Un commit, verde, **da fondere**. Chiude il difetto HIGH che il fix del difetto 1
ha *creato*: con la maschera via, il piede del dialogo copre 49 dei 61px della
tab bar e **il centro del tab GM colpiva `CLEAR ALL`**, che cancellava tutto senza
conferma.

La lane ha corretto il mio brief con la misura: armare-sul-posto non basta, perché
chi allunga verso GM **non vede la tab bar** e riallunga alle stesse coordinate.
Quindi i controlli si **scambiano**: armato, il chip in basso a destra diventa
`KEEP THEM` e la conferma `CLEAR THEM` è a tutta larghezza sopra. Ha anche trovato
che uno dei suoi nove test **passava sul codice rotto** e l'ha riscritto.

### 2c. `a2-onboarding` — worktree `~/Documents/dh-wt2/onboarding`, a `42aa3bd` — **appena partito, nessun commit**

Decisione 9. Il brief completo e il blueprint sono in
`audit-harness/analysis/bp/onboarding.json`. Va **rilanciato da zero**.

### 2d. Worktree già fusi, eliminabili

`banners`, `cards`, `erase`, `gear`, `levelup`, `shell`, `wizard` in
`~/Documents/dh-wt2/`. `git worktree remove --force <path>` e `git branch -D a2-<nome>`.

---

## 3. Cosa resta dopo il merge

1. **Fondere** `a2-play-reflow` e poi `a2-clearall`. Verificato prima della pausa
   con `git merge-tree`: **zero hunk in conflitto** per entrambi. Fondere play
   **per primo** (il diff grande), clearall dopo.
2. **Tre `minWidth` mancanti** che nessuna lane ha preso, stessa classe di
   omissione di `USE`: `GearPicker.tsx:430`, `GearPicker.tsx:522`,
   `Conditions.tsx:547`. La dichiarazione esatta da copiare è a
   `GearPicker.tsx:478`.
3. **Tastierino dei dadi (#35)**: dodici tasti 36,1×44 sotto i 438px e 24×34 sul
   cockpit, con passo 27px (3px fra tasti adiacenti). Fix proposto:
   `DualityRoll.tsx:160`, colonne come token `repeat(var(--die-keys, 4), 1fr)` con
   `@media (max-width: 437px) { :root { --die-keys: 3 } }` → tasti da 48,2px a 375,
   desktop invariato. **Non `auto-fill`**: sul cockpit scenderebbe a due colonne e
   farebbe esplodere l'`overflow: hidden` del pannello. E aggiungere nello stesso
   commit l'uscita dalla griglia delle facce (è BACKLOG P3-12, non costruito).
4. **Decisione 9, onboarding** — vedi 2c.
5. **Caccia alle regressioni.** Lo script è già scritto e pronto:
   `audit-harness/analysis/review-wave.js`. Sei cacciatori su superfici diverse
   che cercano *solo* ciò che i fix hanno creato, poi **tre scettici per candidato
   con lenti diverse** (correttezza, raggiungibilità, già-coperto), poi un verdetto
   secco su production-ready. Lanciarlo con
   `Workflow({scriptPath: '<quel file>', args: {base: '86f4a0e'}})`.
   Il motivo per cui esiste è dimostrato: due difetti di questa tornata sono stati
   **creati dai fix** (`CLEAR ALL`, e il tab GM che lo colpiva).
6. **Pass sui quattro documenti** — vedi §5, i numeri sono sbagliati in più punti.
7. **Push.**

---

## 4. Il rig di misura è stato riparato — cinque difetti, ognuno con la prova

Vive in `~/.claude/projects/.../audit-harness/`. **Fabbricava rilevazioni.**

1. `run.mjs` intersecava il box dipinto con ogni antenato che ritaglia — invalido
   per un discendente `position: fixed`. Da qui **tre rilevazioni false** (33, 66,
   67) e metà di 32 e 34. Ora c'è `paint.js` condiviso, che salta il clipping da
   scroll mentre un elemento «scappa» ma applica comunque gli effetti di paint
   (mask, clip-path, contain), perché quelli *sì* ritagliano un `fixed`.
2. `__find` chiamava `scrollIntoView` quando il box era corto: su una colonna
   `overflow-x: hidden` scrollava di lato 37px, trasformava 5 clip in 60, e poi
   registrava `ok: true` — cioè il contrario della verità. Ora un bersaglio
   irraggiungibile **non viene toccato** e il passo dice `unreachable`.
3. L'emulazione touch era legata alla larghezza, quindi **ogni caso desktop girava
   a puntatore fine** e veniva giudicato sul floor 34. Ora il caso dichiara
   `pointer: 'fine' | 'coarse' | 'hybrid'`; `hybrid` richiede un riavvio di Chrome
   con `blinkSettings` perché CDP non sa esprimerlo.
4. `probe.js` saltava i bersagli entro 0,5px dal floor, sotto-riportando la banda
   proprio in cima.
5. `belowWcagFloor` non misurava WCAG. Rinominato, con l'eccezione di spaziatura
   implementata — e si scopre che **il verdetto 2.5.8 dipende dal puntatore**:
   gli stessi cinque `TO VAULT` falliscono col mouse e passano col dito.

**Non riparato**: `position: absolute` prende ancora la camminata in-flow.

Ri-misurato dopo la riparazione: **`clippers: []` su tutti e cinque i dialoghi**,
a due misure telefono e tre tablet. Il difetto 1 è chiuso davvero.

---

## 5. Numeri da correggere nei quattro documenti

- Il banner costa **66**, non 58 (`HANDOFF.md:451` e l'oggetto di `a46f09c`).
  E **132 con due banner**, stato mai contato.
- Un compagno costa **+58**, non il +50 di `Play.tsx:2211` e `BACKLOG.md`.
- Difetto 6: la soglia è **337**, non 336 — e **349** con 10 HP su 11 marcati.
- Difetto 2: la banda è **720-836**, non 720-828, e arriva a ~894 con tre
  personaggi in libreria.
- `Architecture.md:805` dice che lo scroll di Cards vive «nella griglia»; sotto i
  380px di altezza quella griglia ha 0px di contenuto (la lane cards l'ha già
  corretto — verificare).
- Il contatore era **20px**, non 16: la decisione 4 a 375 e 360 è una *riduzione*
  a 18 ed è un bugfix.
- «Entra a 360×800» è vero dopo la decisione 2 e **falso dopo tutte e sei** se non
  si chiude anche l'a-capo dei tratti — che la lane ha chiuso portando la
  `flex-basis` da 46 a 44 (una riga sola da viewport 356 in su).

---

## 6. Il deploy, verificato e pronto

`gh` autenticato, Pages abilitato (`build_type: workflow`, `https_enforced`).
Un push su `main` fa partire `.github/workflows/deploy.yml`, che **esegue tutta la
suite prima di pubblicare** e stampa il commit dentro `sw.js` (altrimenti il
service worker non si aggiornerebbe mai).

**URL: `https://simone-albanese.github.io/daggerheart-companion/`**

CI gira su Node **24** (`.nvmrc`); questa macchina è su **26.7.0**.

**Decisione del proprietario, presa in questa sessione: un solo deploy con tutto
dentro, onboarding compreso.** Non pubblicare prima.

---

## 7. Cosa deve misurare un umano, e solo lui

Il proprietario ha iPhone e iPad e farà il giro a mano dopo il deploy.

1. **`env(safe-area-inset-bottom)` sul suo telefono.** Nessuno l'ha mai misurato.
   Era la differenza fra la scheda che entra e un pixel di troppo.
2. **L'inset superiore da 59px** su iPhone col notch (rilevazione 7).
3. **PWA installata contro scheda Safari** — chrome e inset diversi.
4. **La portata di ROLL.** Il reflow lo allontana di ~99px dal bordo inferiore.
   Solo una mano vera lo giudica.
5. **iPad in verticale a 744 e 768**: il tab GM che era morto.
6. **Orizzontale col notch**: *niente* in `src/` paga `safe-area-inset-left` o
   `-right` — zero occorrenze. Il gruppo sinistro dell'header e i rail dei filtri
   di Cards finiscono sotto il notch. Difetto reale, mai assegnato.
7. **Versione di iOS.** `color-mix()` richiede Safari 16.2, `svh` 15.4, e non
   c'è né `browserslist` né un solo `@supports` (P4-8).

---

## 8. Dove sta tutto

    ~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/
      analysis/bp/*.json      i dieci blueprint per voce di lavoro
      analysis/verdicts.json  i 57 verdetti avversariali
      analysis/ranked.json    promote / fold / drop, 14 voci promosse
      analysis/guards.json    quale assertion rompe quale modifica, e in che ordine
      analysis/review-wave.js la caccia alle regressioni, scritta e mai lanciata
      analysis/mkwt.sh        crea un worktree da main locale, senza le due trappole
      play-budget-WIP.patch   il lavoro non committato del lane play
      out/lane-findings.json  le 78 rilevazioni originali delle sette lane

Backup dei PDF: `~/Documents/Manuali-BACKUP-audit` (321MB). Cancellabile una volta
verificato che `Manuali/` nel repo è intatto.

---

## 9. Regola di lavoro

Al **45% del contesto** la sessione si mette in pausa e riparte pulita, lasciando
dietro un handoff come questo. Questa è la seconda applicazione.
