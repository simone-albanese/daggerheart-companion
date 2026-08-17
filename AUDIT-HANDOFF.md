# Audit di resa — handoff 3, l'albero com'è davvero

Questo file **sostituisce** l'handoff 2, che descriveva tre lane in volo e una
appena partita senza commit. Sono tutte atterrate: **niente è più in volo.**
Resta più recente di `HANDOFF.md` e continua a contraddirlo di proposito dove i
due si toccano.

**Stato.** `main` è a `ae32323` più i commit di questo passaggio, che tocca
soltanto i `.md`. **2481 test in 108 file, verdi**, `tsc --noEmit` pulito.
`origin/main` è a `dd66d35`: `git rev-list --count origin/main..HEAD` dice
**138** (125 senza i merge) contando il commit che scrive questa riga — un
handoff che si modifica sposta il proprio numero, quindi si conta dopo;
**niente è pushato.** Il push fa partire un deploy vero su GitHub Pages.

Le cifre della suite qui sopra non sono ricordate: vengono da `npx vitest run` e
`npx tsc --noEmit` lanciati in questo worktree alla fine del passaggio di
documenti. Ogni cifra di pixel in questo file è ri-derivata dal codice fuso, e
dove non lo è c'è scritto da dove viene.

---

## 1. Cosa è già in `main`

Undici lane fuse, ciascuna da un worktree isolato tagliato da `main` locale.
Le prime sette sono della prima tornata; le ultime quattro sono di oggi.

| Chiuso | Cos'era, misurato | Nota |
|---|---|---|
| **Difetto 1** — dialoghi di Play | Quattro dialoghi (non tre) tagliati su ogni telefono: CLOSE dipinto 9-10px su 44 e il suo centro colpiva **PLAY**, CLEAR ALL colpiva **GM** | **La causa nell'handoff era sbagliata.** Non un containing block: `.scroll-fade` è `mask-image`, un effect node che ritaglia paint e hit-testing di tutto il sottoalbero, discendenti `fixed` inclusi. Un fix mirato alla causa dichiarata non avrebbe spostato nulla |
| **Difetti 2 + 4** — shell | Il tab GM occluso al 100% fino a **802px** e la riga flex sovra-sottoscritta fino a 864; un nome più largo di ~118px spingeva SETTINGS fuori schermo | `minmax(0,1fr)` da solo **non** basta: serve anche `min-width: 0`, o il minimo content-based dell'header sborda la traccia già limitata. Le tre soglie non sono la stessa misura — vedi §5 |
| **Difetto 3** — Cards | «12px di lista» era **0px di contenuto**: i 12 erano tutto padding. Nessuna carta disegnata a 640×360. Più i rail dei filtri che nascondevano l'intero gruppo RECALL | |
| **Difetto 7 / decisione 8** — wizard | Esteso da solo alla classe a **quattro** pickers: ancestry e community nascondono di più (111-285px e 158-253px) sotto una clamp più stretta, e **Mixed Ancestry era vuota** — zero parole su entrambi i lignaggi | |
| **Decisione 10** — erase | Non contava le campagne né i record quarantenati che `clearAll` cancella comunque | Il numero ovvio (`readCampaigns().campaigns.length`) era **lo stesso difetto travestito da correzione** |
| **Gear picker** (HIGH) | Lista a 0px di contenuto su 20.534px, Unequip e Done tagliati senza scroll | Trovato **solo** dalla verifica avversariale |
| **Level up** | 123px di finestra su 1938px; +69px a ogni viewport, portrait incluso | E il selettore personaggio dentro quella banda poteva **ripuntare un piano a metà su un altro personaggio** |
| **Banner** | Il warning troncava la propria spiegazione; costa **66px** non 58 | E **due banner insieme costano 132** — installazione nuova + update in coda, margini che non collassano perché `<main>` è flex |
| **Play, decisioni 1-7** (`0cdf42f`) | Il reflow della scheda: contatori a griglia, casella del danno nella banda, riga dei tratti a una riga sola da 356 in su, numeri a 32 e 22 | La `flex-basis` dei tratti è passata da 46 a 44 — vedi §5, è la riga che rende vera «entra a 360×800» |
| **`CLEAR ALL`** (`ee647db`) | Il difetto che il fix del difetto 1 aveva *creato*: il piede del dialogo copriva 49 dei 61px della tab bar e il centro del tab GM colpiva `CLEAR ALL` | Armare sul posto non bastava: chi allunga verso GM non vede la tab bar. I controlli si **scambiano** |
| **Cockpit** (`9383de6`) | ROLL dipinto **0.0px** su 54 a 1180×695, la mensola dei modificatori a 303px che ne conteneva 1058, il tastierino senza uscita | Il pannello del tiro adesso scorre (`overflowY: 'auto'`), con la gutter della scrollbar riservata. Vedi §2a |
| **Bersagli** (`9e1556a`) | Tre controlli sotto il floor su un asse solo — `Seg` 38,81px, SET 42,81, `USE` 30,81 — e la casella del danno a `viewport − 249,27` dalle soglie | La classe intera, non i tre siti elencati nell'handoff 2. Vedi §3 punto 2 |
| **Ritaglio del display** (`ae42eea`) | Nessuna riga in tutto `src/` pagava `safe-area-inset-left`/`-right`. A 852×393 con 59 di inset, SETTINGS perdeva 39,0 dei suoi 54,4px — il 71,7% — e il marchio da 20,8px era sepolto **nello stesso fotogramma** | L'inset è **simmetrico**, e tutto il primo giro di misure lo trattava come a un lato solo. Vedi §7 punto 6 |
| **Onboarding, decisione 9** (`58c4bd5`) | Il primo schermo che questa app abbia mai mostrato erano nove carte classe — a un GM, e a chi il personaggio ce l'aveva già finito su un altro telefono | Diciassette commit, non zero: l'handoff 2 diceva «appena partito, nessun commit» e si sbagliava |
| `.gitignore` | `Manuali/` con la barra non matcha un symlink: una lane aveva già committato un blob 120000 che al merge avrebbe sostituito **321MB di PDF acquistati** con un link a sé stesso | Preso prima del merge leggendo `git diff --name-only`. Backup in `~/Documents/Manuali-BACKUP-audit` |
| Onestà | `probe.js` chiamava «WCAG 2.5.8» un test `w<24||h<24` senza controllo di spaziatura; sette rilevazioni portavano l'accusa sbagliata | Accusare sempre il **floor 44/34 di questo progetto**, che è più severo e sufficiente. **Tre casi in più con la stessa forma**: 38,81 / 42,81 / 30,81px passano tutti e tre i 24px di WCAG 2.5.8 con margine, e rompevano `--control` / `--tap` |

---

## 2. Cosa hanno lasciato aperto le quattro lane di oggi

**Niente è in volo. Tutti i worktree della tornata 2 e 3 sono fusi**, tranne
`a3-polish`, che sta lavorando adesso su `src/` e `tests/` e non è di questo
passaggio. Quello che segue è ciò che le lane hanno *deciso di non prendere*,
con il motivo, perché è la parte che sparisce se non è scritta.

### 2a. `--control` è 34px sotto un dito, su un portatile touch — difetto vivo

**Aperto. È la cosa che la lane cockpit ha trovato e non ha preso, e la
decisione di non prenderla è giusta.**

`tokens.css:214` è `@media (max-width: 1179px), (pointer: coarse)`. `pointer`
descrive il puntatore **primario**, quindi un portatile con schermo touch e un
iPad in custodia con tastiera — tutti e due `pointer: fine` con
`any-pointer: coarse` — ricevono `--control: 34px` da 1180px in su. Misurato sul
profilo `hybrid` del rig a 1280×800 e 1440×900: `--control` 34px, `--pip-h` 44px.
Quindi sulla macchina che la paragrafo ERGONOMICS del pannello del tiro chiama
«quello che questo pannello lo raggiunge davvero con un dito», ogni chip della
mensola e ogni tasto del tastierino è **10px sotto il floor di 44** che questo
progetto si è dato.

Il vecchio motivo per cui `--control` non poteva seguire la query larga era che
il pannello del tiro era `flex: 1, min-height: 0, overflow: hidden` e allargare
i controlli lo avrebbe gonfiato da dentro contro il proprio ritaglio. **Quel
motivo è morto in `fbd4884`**: il pannello scorre. Il commento accanto a
`--pip-h` in `tokens.css:119-144` adesso lo dice e dice cosa resta.

**Il passaggio successivo**: misurare `Gm.tsx` e `Build` sul profilo `hybrid`,
poi portare `--control` su `(max-width: 1179px), (any-pointer: coarse)` — la
query che `--pip-h` usa già. Non è stato fatto qui perché `--control` regola
ogni chip, voce di nav e stepper anche sulle schermate GM, e la lane di una
schermata sola è il posto sbagliato per cambiarlo.

### 2b. Le sei fasce di chrome dentro `<main>` non pagano il ritaglio laterale

**Aperto, e non è una regressione**: non lo pagavano nemmeno prima.

`App.tsx:293`, `:328`, `:404`, `:572` (`UnsavedWork`, l'alert di storage, quello
di integrità, quello dei personaggi in quarantena) e `ShellBanner.tsx:168`
(`UpdateBanner` e `BackupBanner`, due blocchi da una dichiarazione sola): tutte e
sei hanno `margin: '8px 20px 0'` fisso, mentre l'header 8px sopra adesso rientra
a `calc(20px + env(safe-area-inset-left))`. Misurato a 852×393 con 59 su
entrambi i lati, `BackupBanner` sta a [20, 832] e la sua scatola è **identica** a
inset 0 — non si muove, quindi i suoi primi 39px stanno sotto la striscia
sinistra mentre l'header rientra a 79. Le due grondaie si allineavano a 20 e non
si allineano più.

La riparazione è una riga per ciascuna, ed è quella che `Header.tsx:115-117`
scrive per esteso:

    margin: '8px calc(20px + env(safe-area-inset-right)) 0 calc(20px + env(safe-area-inset-left))'

Lasciata fuori di proposito: quelle righe stanno in `App.tsx` e in
`ShellBanner.tsx`, e vogliono un commit che possa testare quei due file.

### 2c. `P3-12` è metà costruito e non va spuntato intero

Il tastierino dei dadi ha adesso un'uscita: prende tutta la riga delle facce, la
sua etichetta la guida come uscita alta 44px con HOPE o FEAR e una ×, ed Escape
lo chiude da un listener sulla finestra (che si tira indietro se nel documento
c'è un `[role="dialog"]`, o una sola pressione chiudeva anche la carta sotto).
**Le caselle del danno no**: `DamageRoll.tsx:371` è ancora
`{editing === null ? faces : grid}`, senza cancel, senza backdrop, senza Escape.
I due gesti sono divergenti, che è esattamente ciò che P3-12 diceva non dovesse
succedere. Chiuderlo è una modifica a `DamageRoll.tsx`.

### 2d. Worktree eliminabili

Tutti quelli in `~/Documents/dh-wt2/` e, di `~/Documents/dh-wt3/`, `cockpit`,
`safearea` e `targets`. `git worktree remove --force <path>` e
`git branch -D <ramo>`. **Non** `a3-polish`, che è vivo.

---

## 3. Cosa resta

1. ~~**Fondere** `a2-play-reflow` e poi `a2-clearall`~~ — **fatto**, `0cdf42f`
   e `ee647db`, in quell'ordine e senza conflitti come previsto.
2. ~~**Tre `minWidth` mancanti**~~ — **fatto**, lane `a3-targets`, un commit
   (`8a35431`). I controlli davvero sotto il floor erano **tre, e non nei tre
   file elencati qui prima**: i bottoni di `Seg` in `GearPicker.tsx`
   (`All`/`Any`, **38,81px**), il chip SET di `Conditions.tsx` (**42,81px**, solo
   nello stato *off* — `ACTIVE` è 61,62 e passava) e `USE` in `Play.tsx`
   (**30,81px**). L'aritmetica è esatta e verificabile: `.chip` è IBM Plex Mono
   9,5px con `letter-spacing: 0.06em`, il file spedito `plexmono-600-latin.woff2`
   ha `unitsPerEm` 1000 e avanzamento 600 su *ogni* glifo (controllato con
   fontTools, non dato per buono), quindi un carattere è
   9,5 × 0,6 + 9,5 × 0,06 = **6,27px**; tre caratteri più il padding dichiarato
   danno 38,81 / 42,81 / 30,81. `CLEAR FILTERS` di `GearPicker` ha ricevuto la
   stessa dichiarazione ma **non era sotto il floor** (93,51px): è la regola
   «ogni bottone del blocco dichiara il floor su tutti e due gli assi», non una
   riparazione. I due controlli di `Cards.tsx` erano già chiusi da `112cb7f`.
   E il floor sui `Seg` è pagato **dal padding**, non dalla larghezza: `'0 6px'`
   invece di `'0 10px'` (`749d9b4`), o la riga dei filtri delle armi passava da
   due righe a tre per ogni finestra da 348 a 358.
3. ~~**Tastierino dei dadi (#35)**~~ — **fatto**, lane `a3-cockpit` (`4c99b84`),
   per una strada diversa da quella proposta. Non un token `--die-keys` con una
   media query: il tastierino prende **tutta la riga delle facce** invece di una
   faccia sola, quindi la larghezza del tasto è `(G − 23) / 4` su una griglia di
   larghezza esterna G, e G passa a 299 su un telefono da 375 e a 206 sul
   cockpit → **69px** e **45,75px** di tasto, da 37,1 e 24. Su una piattaforma
   con scrollbar classica la scatola di contenuto del pannello è 394 e il tasto è
   **43,75** — un quarto di pixel sotto il floor, ed è il motivo per cui la
   gutter è riservata con `scrollbar-gutter: stable` invece che lasciata
   comparire. L'uscita dalla griglia è arrivata nello stesso commit **solo per le
   facce Duality**: vedi §2c.
4. ~~**Decisione 9, onboarding**~~ — **fatto**, `58c4bd5`, diciassette commit.
5. **Caccia alle regressioni.** Ancora da lanciare, e adesso vale di più: sopra
   i fix della prima tornata ne sono atterrati altri quattro lane.
   `audit-harness/analysis/review-wave.js`, sei cacciatori più tre scettici per
   candidato, con
   `Workflow({scriptPath: '<quel file>', args: {base: '86f4a0e'}})`. Il motivo
   per cui esiste resta dimostrato: due difetti della prima tornata sono stati
   **creati dai fix** (`CLEAR ALL`, e il tab GM che lo colpiva).
6. ~~**Pass sui documenti**~~ — **questo**. Vedi §5 per come è finita ogni cifra.
7. **`--control` sul puntatore ibrido** — §2a.
8. **Le sei fasce di chrome dentro `<main>`** — §2b.
9. **L'uscita dalle caselle del danno**, la metà aperta di P3-12 — §2c.
10. **Push.**

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
   con `blinkSettings` perché CDP non sa esprimerlo. È il profilo che ha trovato
   il difetto di §2a.
4. `probe.js` saltava i bersagli entro 0,5px dal floor, sotto-riportando la banda
   proprio in cima.
5. `belowWcagFloor` non misurava WCAG. Rinominato, con l'eccezione di spaziatura
   implementata — e si scopre che **il verdetto 2.5.8 dipende dal puntatore**:
   gli stessi cinque `TO VAULT` falliscono col mouse e passano col dito.

**Non riparato**: `position: absolute` prende ancora la camminata in-flow.

**E una sesta cosa, trovata dalla lane safearea e che vale per chiunque legga i
numeri del rig**: `insetPatch` in `run.mjs` sostituisce ogni lato col valore che
il caso dichiara, quindi un caso che dichiara `left: 0, right: 0` **rilegge 0
qualunque cosa faccia il codice**. Una rilettura non è mai la prova di cosa
riporti iOS: è la prova di cosa le è stato dato. Chrome è lanciato con
`--hide-scrollbars` (`cdp.mjs`), quindi nessuna misura di questo audit ha mai
visto la larghezza che una scrollbar classica porta via.

Ri-misurato dopo la riparazione: **`clippers: []` su tutti e cinque i dialoghi**,
a due misure telefono e tre tablet. Il difetto 1 è chiuso davvero.

---

## 5. I numeri da correggere: come è finita ognuno

La lista dell'handoff 2 è stata applicata *una voce alla volta contro il codice
fuso*, e non tutta intera: diverse cifre precedevano il reflow e una era
attribuita al difetto sbagliato. Dove una lane e questa lista non erano
d'accordo, **ha misurato dopo la lane**.

| Voce dell'handoff 2 | Esito |
|---|---|
| Il banner costa **66**, non 58; e **132 con due banner** | **Applicato.** Confermato dal codice fuso: `ShellBanner.tsx:33-51` misura 553→487 a 375×667, 738→672 a 393×852, e 738→672→**606** con tutti e due. Il 58 era la scatola sola; i 66 sono la scatola più gli 8px di margine, che `<main>` essendo flex non fa collassare. `HANDOFF.md` corretto |
| Un compagno costa **+58**, non +50 | **Applicato in `BACKLOG.md`, e ri-derivato invece che copiato.** `WhoSwitch` (`Companion.tsx:41-92`) sul telefono è `compact={false}` → bottone `minHeight: 44`, più `padding: 3` due volte e 1px di bordo due volte = **52**; più i 6px di gap del pannello di `Vitals` (`Vitals.tsx:71`, `gap: phone ? 6 : 10`) = **58**. È la stessa correzione del banner: scatola contro scatola-più-spazio. **`Play.tsx:2389` porta ancora +50** e non è di questo passaggio |
| Difetto 6: soglia **337**, e **349** con 10 HP su 11 | **Non applicato come scritto: era attribuito al difetto sbagliato.** 337,37 e 349,9 sono gli attraversamenti della **griglia dei contatori** contro il bordo di ritaglio della colonna (`Vitals.tsx:203-209`), chiusi da `a9d8381` con `minmax(0, 1fr)` più `minWidth: 0`. L'attraversamento della sovrapposizione PROF/casella-danno è **viewport 353** (`Vitals.tsx:352`), chiuso da `f814a3a` con `flexWrap: 'wrap'`. Due difetti, due soglie, e la lista ne aveva scambiate le etichette |
| Difetto 2: la banda è **720-836**, non 720-828, e ~894 con tre personaggi | **Non applicato: non si riproduce, e le tre cifre in giro non misurano la stessa cosa.** Il codice fuso (`Header.tsx:19-24`, misurato a 744×1133 con **un** personaggio in libreria) dice: centro di GM morto **da 720 a 828**, ultimo pixel coperto a **856**, riga sovra-sottoscritta fino a **864**. §1 di questo file dice «occluso al 100% fino a 802», che è una terza soglia ancora, e le tre sono coerenti fra loro in quest'ordine — 802 (coperto al 100%) < 828 (centro coperto) < 856 (coperto in parte) < 864. L'836 e il ~894 non sono derivabili da questo albero e la loro fixture non è dichiarata. **Da rifare col rig prima di scriverli**, dichiarando quanti personaggi ha la libreria: è il termine che sposta il gruppo destro |
| `Architecture.md` sullo scroll di Cards | **Verificato, era già corretto.** La lane cards l'aveva chiuso: la riga §9.1 porta le misure del dopo (scrollport = tutta la colonna, 438 a 320×568, 722 a 393×852, 230 a 640×360) e tiene lo 0px come storia. Lasciata stare |
| Il contatore era **20px**, non 16 | **Applicato.** `Counter.tsx` dichiarava `font: '800 20px/1 var(--sans)'`; 16 non compare in `src/`. Quindi la decisione 4 a 375 e a 360 è una **riduzione** da 20 a 18 ed è un bugfix, non un ingrandimento: `--counter-num` è 18px su `:root` e 22 da `min-width: 380px` (`tokens.css:183`, `:229-232`), e a 360 il 20 chiederebbe 58,09px di riga in 57 di stanza |
| «Entra a 360×800» | **Applicato con la sua condizione.** È vero dopo la decisione 2 e falso dopo tutte e sei se non si chiude l'a-capo dei tratti. La lane l'ha chiuso portando la `flex-basis` da 46 a 44 (`Play.tsx:641-652`): a `1 1 46px` la riga dichiarava 6 × 46 + 44 + 24 = **344**, esattamente la colonna a viewport 368; a `1 1 44px` dichiara **332**, quindi è una riga sola **da 356 in su**. Il budget fuso dice 618 contro 678 a 360×800, 60 di avanzo |

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

Il proprietario ha iPhone e iPad e farà il giro a mano dopo il deploy. **Questa è
la lista che dice dove guardare, ed è l'unica cosa che lo dice.** Ogni voce
nomina cosa cambia se la misura non è quella che il codice ha assunto.

1. **`env(safe-area-inset-bottom)` sul suo telefono.** Nessuno l'ha mai misurato.
   Il codice lo tratta come 0 quando fa i conti del budget di Play: se sul suo
   telefono è 34, la colonna a 393×852 passa da 730 a 696. Lo pagano `TabBar`,
   `GmBar`, le due nav di Build e l'avviso di licenza — **una cosa sola per
   schermata**, e `attribution.test.tsx` conta i pagatori.
2. **L'inset superiore da 59px** su iPhone col notch (rilevazione 7). Il
   `paddingTop` dell'header non è più un `env()` nudo: è
   `calc(0px + env(safe-area-inset-top))` (`Header.tsx:323`), computa gli stessi
   pixel ed è finalmente leggibile dalla suite (`tests/ui/safeArea.test.ts`).
3. **PWA installata contro scheda Safari** — chrome e inset diversi.
4. **La portata di ROLL.** Il reflow lo allontana di ~99px dal bordo inferiore.
   Solo una mano vera lo giudica.
5. **iPad in verticale a 744 e 768**: il tab GM che era morto.
6. **Orizzontale col ritaglio del display, e l'inset è simmetrico.** La shell
   adesso paga `safe-area-inset-left` e `-right`: `Header.tsx:324/326` sopra i
   `20px` di padding che aveva già, `TabBar.tsx:169/170` su base `0px`.

   **La forma da verificare è la simmetria, non la rotazione.** iOS riporta
   `-left` e `-right` allo **stesso valore non nullo** in orizzontale, perché
   UIKit rientra entrambi i bordi lunghi in modo che una rotazione di 180 gradi
   non ricomponga la pagina, e WebKit rispecchia gli inset della view dentro
   `env()`. Solo in verticale la coppia orizzontale è 0. Quindi la scatola di
   contenuto perde **due volte** l'inset, non una, e le due strisce sono vive
   nello stesso fotogramma: a 852×393 con 59 su entrambi i lati, il marchio da
   20,8px sepolto a sinistra e SETTINGS coperto al 71,7% a destra (39,0 dei suoi
   54,4) erano **lo stesso istante**, non due rotazioni alternative. PLAY, il
   primo bottone della nav, partiva da 62,8 e la striscia sinistra la scavalcava
   di 3,8px — quindi la nav non è mai stata la vittima da quel lato: lo era il
   marchio. *Tutto il primo giro di misure di questo audit era scritto sul
   modello a un lato solo ed è stato rifatto; §1 e §2 della delta di quella lane
   portano ancora la vecchia forma e sono superate dalla sua §6.*

   Dopo il fix, misurato a 852×393 con 59 su entrambi i lati: SETTINGS sta a
   [718,6, 773] contro una striscia che comincia a 793 — zero sovrapposizione — e
   il marchio a [79, 99,8], fuori da [0, 59]. I quattro bottoni della nav
   rientrano dell'inset, cioè **verso** il centro della spazzata del pollice
   sinistro, non via.

   **Le due cose da leggere su vetro vero, e il budget sta in piedi su tutte e
   due**:
   - **La grandezza.** 44, 50 o 59 per lato, per classe di dispositivo: nessuna
     di queste è stata letta da un telefono. Il 59 è la cifra che *questo* audit
     ha misurato per l'inset **superiore in verticale**, riusata di taglio. La
     scatola di contenuto dell'header è `larghezza − 40 − insetSinistro −
     insetDestro`; a 812×375 (iPhone 12/13 mini in orizzontale, il telefono col
     notch più stretto che esista) con un nome che tocca il cap dei 220px, la
     riga peggiore che questa barra sa chiedere è 329,8 + 8 + 318,4 = **656,2**,
     e l'avanzo è 115,8 a inset 0, **27,8 a 44**, **15,8 a 50** e **−2,2 a 59**.
     A −2,2 la firma di questo file torna: il gruppo sinistro misura [79, 406,6],
     clientWidth 328 contro scrollWidth 330, e la sua `<nav>` dipinge fino a
     408,8, cioè 2,2px fuori dal proprio genitore. **Niente di ciò che si spedisce
     ci arriva** — i telefoni con Dynamic Island, la classe da cui il 59 viene,
     sono larghi 852 o più in orizzontale (37,8 di avanzo, 117,8 a 932×430), e
     quelli larghi 812 sono col notch, per cui la cifra che si cita di solito è
     44 → 27,8. Ma **sopra circa 46 per lato a 812 il telefono in orizzontale
     diventa la riga peggiore dell'app**, davanti ai 23,8px del tablet più
     stretto a 720×1133. Quindi la domanda per il proprietario è secca: *sul suo
     telefono, in orizzontale, quanto valgono `-left` e `-right`?*
   - **La forma.** Simmetrica è preso dal ragionamento di Apple, non da una
     lettura. Il rig non può esserne la prova: `insetPatch` restituisce il valore
     che il caso gli ha dato (vedi §4).
   - **E la tab bar in orizzontale non è ipotetica.** `App.tsx` disegna `TabBar`
     solo sotto i 720px e ogni iPhone col notch alla risoluzione nativa è più
     largo di così di taglio. Ma **Display Zoom** (Impostazioni > Schermo e
     luminosità > Vista > Testo più grande) porta un iPhone da 6,1" a 320×693,
     cioè 693×320 tenuto di lato: sotto 720, quindi la barra c'è, su un
     dispositivo che il ritaglio ce l'ha ancora. Misurato a 693×320 con 59 per
     lato: padding 59/59, quattro colonne da 143,8×60 fra [59, 634], header a
     79/79 con 239,8 di avanzo. **Da provare accendendo Display Zoom.**

   **Cosa NON è pagato, ed è la metà dentro l'arco del pollice.** Le due barre
   della shell sono a posto e basta. Restano: le **sei fasce di chrome dentro
   `<main>`** (§2b) e **la colonna di Play**, che è la superficie non pagata più
   grande. Misurato a 852×393 con 59 su entrambi i lati, l'unico altro figlio di
   `<main>` è la colonna a [0, 852] e non paga niente: ROLL 2d12 a [12, 788]
   (47px del suo capo sinistro sotto la striscia), il tratto Agility a
   [12, 138,7] col 37% sotto, HP e Hope a [12, 327], sei intestazioni di sezione
   a [12, 840]; e all'altro capo MODS, il pulsante di aiuto sui tratti e i tre
   `+` sono 44×44 a [796, 840], **interamente** dentro la striscia destra che
   comincia a 793. Le vittime dell'header stavano in cima al vetro e fuori da
   ogni arco; queste sono i controlli su cui un pollice atterra a metà scena.
   Chi legge «ritaglio: fatto» ha capito male: è fatto su due barre e su nient'altro.
7. **Versione di iOS.** `color-mix()` richiede Safari 16.2, `svh` 15.4, e non
   c'è né `browserslist` né un solo `@supports` (P4-8).
8. **Un dito su un portatile touch, se ne ha uno in casa.** È il difetto di §2a
   e non è misurabile su un Mac senza schermo touch: ogni chip e ogni tasto del
   tastierino a 1180px e oltre è 34 invece di 44.

---

## 8. Dove sta tutto

    ~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/
      analysis/bp/*.json      i dieci blueprint per voce di lavoro
      analysis/doc-deltas/    cosa ogni lane della tornata 3 ha reso falso nei .md
      analysis/verdicts.json  i 57 verdetti avversariali
      analysis/ranked.json    promote / fold / drop, 14 voci promosse
      analysis/guards.json    quale assertion rompe quale modifica, e in che ordine
      analysis/review-wave.js la caccia alle regressioni, scritta e mai lanciata
      analysis/mkwt.sh        crea un worktree da main locale, senza le due trappole
      play-budget-WIP.patch   il lavoro non committato del lane play, ormai fuso
      out/lane-findings.json  le 78 rilevazioni originali delle sette lane

**Le delta delle lane si leggono in ordine di supersessione, non dall'alto.**
Ognuna ha una seconda metà, «Remediation pass», scritta dopo i verificatori
avversariali, che **annulla** parti della propria prima metà: `safearea.md` §6
e §8 ribaltano §1 e §2 (modello simmetrico, e la lista del lavoro residuo),
`safearea.md` §10 corregge §4, `cockpit.md` §7 supera §6, `targets.md` §9 supera
la riga `Seg` di §4. Applicare una sezione iniziale alla lettera significa
scrivere nei documenti permanenti una tesi che chi l'ha misurata ha ritirato.

Backup dei PDF: `~/Documents/Manuali-BACKUP-audit` (321MB). Cancellabile una volta
verificato che `Manuali/` nel repo è intatto.

---

## 9. Regola di lavoro

Al **45% del contesto** la sessione si mette in pausa e riparte pulita, lasciando
dietro un handoff come questo. Questa è la terza applicazione.
