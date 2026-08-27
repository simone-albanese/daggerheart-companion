# Handoff — 27 agosto 2026, fine sessione

**Questo documento è l'autorità.** Supersede `HANDOFF-2026-08-27-notte.md` su tutto ciò che
contraddice; quello che quel file dice e questo non tocca resta in vigore.

`main` è **`e850497`** e il service worker pubblicato porta quel timbro.

---

## 1. Lo stato, in una tabella

| | |
|---|---|
| `main` | **`e850497`** — pulito, `git status --untracked-files=all` vuoto |
| `sw.js` pubblicato | **`e850497`** — combacia, verificato |
| `vitest` | **153 file / 4020 test** |
| `tsc --noEmit` | pulito |
| `vite build` | verde |
| `build:srd -- --check` | `matches the source` |
| **PR aperte** | **nessuna** |

Node **v24.19.0** via `. ./env.sh`, sempre.

---

## 2. IL PIANO SRD È FINITO

`RICERCA-SRD-2026-08-26.md` è concluso: **2.1, 2.2, 2.3 e 2.4 sono spedite e pubblicate.**
Da qui in avanti è lavoro nuovo, non continuazione. Sette PR:

| PR | cosa |
|---|---|
| **#43** | la ricerca esce dalla schermata GM; `BlockView` doveva uscire per primo |
| **#44** | l'handoff della notte |
| **#45** | **2.2** — la porta sul lato del giocatore |
| **#46** | la testata del piano, da «sette punti falsi» a nove |
| **#47** | **2.3** — i momenti come appartenenza |
| **#48** | l'ambito della ricerca tolto: la ricerca è globale |
| **#49** | **2.4** — la risposta sulla riga chiusa |

### 2.2 — la porta (#45)

`Screen` guadagna `'search'`, che **porta l'unione a sei membri** ed è la **quinta scheda**. Sono
due liste diverse e vanno lette contro quella giusta: `settings` è uno `Screen` e non è una scheda.
Attenzione a non leggere «sesto» come una posizione — nell'unione `search` sta al quinto posto e
`settings` al sesto; quello che diventa sei è il conteggio.
Più una voce nell'header, una rotta `lazy()` e `src/ui/search/Search.tsx`.

`openingScreen` esenta `search` accanto a `gm` dalla regola «libreria vuota → Build», per la
stessa frase che aveva esentato il GM: non ha mai avuto bisogno di un personaggio.

**Il `mark` della quinta scheda è un anello**, scelto disegnando i candidati coi colori veri e
guardandoli. Un cerchio *pieno* era la scelta peggiore: il suo vicino più prossimo è l'esagono del
GM — stessa densità, stesso peso a 17px — e stanno accanto. L'anello è l'unica forma tonda e vuota
del gruppo. Non è una lente disegnata a mano: uno `<span>`, `borderRadius: '50%'`, un bordo.

Misurato: cinque schede sono **78.59** a 393, **75.00** a 375, **64.00** a 320, **115.00** a
693×320 con 59px di ritaglio per lato e **55.00** a 393 con lo stesso. Tutte sopra il pavimento dei
44, zero traboccamento di etichetta, `docOverflowX` 0.

### 2.3 — i momenti come appartenenza (#47)

Un chip non scrive più la propria etichetta nel campo: **è una selezione accesa**. Prima le sezioni
che restituiva erano un incidente di vocabolario — `my` e `this` sono stopword, quindi `MY TURN`
cercava `turn` e `THIS PLACE` cercava `place`; `DAMAGE` dava 24 sezioni sepolte sotto 322 righe di
equipaggiamento; e due chip su sei non trovavano nessuna sezione con tutte le parole e stampavano
`NO SECTION CARRIES ALL OF THOSE WORDS`.

La tabella è `src/ui/shared/moments.ts`, un `Record<Ref, readonly Moment[]>`. Le altre due case
sono chiuse da prove, non da gusto: un campo su `RulesSection` sarebbe `undefined` su tutte e 69 la
prima volta che qualcuno rigenera il dataset, e un `data/moments.json` starebbe dentro un cancello
CI che rigenera quella cartella e ne fa il diff — un file scritto a mano lì passerebbe per sempre
qualunque cosa dicesse.

La lista di esclusione degli **otto orfani** sta in `tests/gm/moments.test.ts`, non in `src/`: è
ciò che la guardia può saltare, quindi appartiene alla guardia. Guardata nelle due direzioni.

### 2.4 — la risposta prima (#49)

**Il titolo della parte era la prima cosa sbagliata.** «Le domande con un numero dentro» non
descrive niente: **zero delle dodici domande e zero delle novanta formulazioni alternative
contengono una cifra.** L'unico blocco ancorato il cui contenuto è un numero è quello di `q-chase`,
e la sua risposta sono cinque righe di tabella condizionate a un tiro non ancora fatto.

Quindi la 2.4 è la promessa che `askCatalogue.ts` faceva già — *«il paragrafo che un GM dovrebbe
avere davanti mentre decide»* — resa più fine e disegnata sulla riga chiusa. Dieci voci su dodici
prendono un paragrafo; le due il cui blocco è una tabella o una lista di sedici mosse prendono una
frase dell'app.

`AskEntry.at.part` è **un intero, mai una frase**, e questa è una decisione di licenza prima che di
disegno. La regola vera di questo repo non è «nessuna parola dell'SRD viene mai ribattuta» — è
**«un indirizzo può essere scritto quando è verificato byte per byte contro il dataset a ogni
esecuzione; una risposta no»**. Un numero non può contenere una parola del libro.

---

## 3. Quello che ho tolto, e su richiesta del proprietario

**L'ambito della ricerca (#48).** La schermata si apriva ristretta al materiale del personaggio con
i chip `WHAT I CARRY` / `THE WHOLE BOOK`. Tolto: la ricerca è globale.

Il motivo, che vale la pena tenere: un default che leggeva in silenzio una sola scheda rendeva
**ambiguo ogni risultato vuoto** — chi legge non poteva distinguere una parola che l'SRD non
contiene da una che il suo personaggio non porta, senza prima accorgersi di un controllo che non
aveva motivo di guardare.

È stata tolta per intero, non a metà: `SearchScope` aveva tre campi e due esistevano solo per il
restringimento, quindi sono andati anche `only`, `sections`, `NO_SECTIONS`, `WHOLE_BOOK`, una delle
frasi parlate, il secondo paragrafo del silenzio e `holdingsOf`. È rimasto `questions?: boolean`,
che non è mai stato un ambito: dice *chi* guarda.

Ha restituito 52px alla lista — finestra di lettura da 475 a **527** a 393×852 e da 290 a **342** a
375×667, righe intere da 5 a **6** e da 3 a **4**.

---

## 4. Quello che ho trovato e NON ho riparato

Tutto verificato, niente dedotto — e questa lista è stata ricontrollata da tre verificatori contro
il repo prima di essere unita, perché un handoff che si dichiara autorità è esattamente il tipo di
documento che in questo progetto è già andato stantio. Sono debiti, non difetti da inseguire
subito.

1. **Il piano ha un DECIMO punto falso, e la sua testata dice nove.** La tabella dei file della
   §2.3 è sbagliata in entrambe le direzioni: nomina `srdIndex.ts`, che è un vicolo cieco — i
   record `rules` vengono scartati da `RuleSearch.tsx` (`kind !== 'rules'`) prima della ricerca,
   quindi un campo lì non è raggiungibile su nessun percorso — e **omette `ShowSheet.tsx`**, che
   era l'unico punto in `src/` dove un chip veniva disegnato. Va aggiunto alla testata come il #46
   ha aggiunto l'ottavo e il nono.
2. **Il docblock di `ShowSheet.tsx` dice che lo stato vuoto «non scorre affatto».** Non è più vero:
   la finestra di lettura è **240.00** a 393×852 e **83.00** a 375×667, e i 308 di contenuto
   traboccano. **Misurato contro `main` da un worktree separato: numeri identici**, quindi è prosa
   stantia e non una regressione mia. La cifra 308.3 che il file cita è dello stesso vintage.
3. **`RuleSearch.tsx:325` porta un tetto di 717.4px che è morto.** Si àncora a un pannello che
   `GmSheet.tsx:113` misura oggi a **465.80** (85% di uno stage da 548). Precede il cambio di
   stage.
4. **`RICERCA-SRD §5.3` chiede ancora una misura Chrome per «le sei righe dei momenti»**, che la
   sua stessa testata elenca fra le correzioni come già misurate — e le chiama sei righe quando
   sono una griglia 3×2.
5. **`RICERCA-SRD §4.6` chiede la guardia «un momento senza membri non si disegna».** Non l'ho
   scritta di proposito: il momento più piccolo ha **7** sezioni, sarebbe un ramo irraggiungibile.
6. **`ShowSheet.tsx` cita al presente «the search screen's scope chips»** come precedente per come
   si accende un chip di momento. Quei chip non esistono più dalla #48: la regola tiene nel codice
   e non nella prosa. Va riscritta nominando i token (`--hope-wash` / `--hope`) invece di un
   controllo cancellato.
7. **Il placeholder del campo sulla schermata GM dice `Search 69 rules sections`** mentre lo stesso
   campo guida anche i 780 record da quando esiste l'indice. È un difetto precedente e i test lo
   fissano; correggerlo è un cambio di testo alla schermata GM, non a questa porta.

---

## 5. Le cose decise, da non riaprire

Tutti i divieti degli handoff precedenti restano. In più:

- **La ricerca è globale e non restringe a nessuno.** Se un ambito torna, serve un argomento nuovo:
  quello vecchio è stato provato e respinto.
- **`at.part` è un indice, non una frase.** Una frase-ago metterebbe le parole del libro dentro
  `askCatalogue.ts`.
- **Il chip è una selezione, non una parola scritta nel campo.** Digitare spegne un chip acceso e
  premere un chip svuota il campo: non c'è mai una lista che sia metà ricerca e metà momento.
- **Sotto un momento le sezioni si disegnano PRIMA delle domande.** Il motivo per cui QUESTIONS sta
  in cima — «una domanda ha trovato e nessuna sezione» — non può accadere sotto un momento, perché
  il più piccolo ne porta sette. È anche ciò che riporta `rowsFullyVisible` da 0 a 2.
- **Spillare i chip sopra lo scroller è stato provato e respinto, per misura.** Il pannello ha
  altezza fissa: un blocco fermo non libera i 96px dello scroller, se li mangia — finestra da 240 a
  **120** a 393×852 e da 83 a **14** a 375×667, e il conteggio restava 0.
- **Un settimo momento è morto per misura**: la griglia è `repeat(3, 1fr)`, un settimo chip la
  porta a tre righe, 52px in una colonna che entra per 0.3px.
- **La voce nell'header costa il cap del nome.** La quinta voce ha portato la nav da 287.2 a 380.01
  e a 720×900 con un nome lungo la nav disegnava **69.22px fuori dal proprio riquadro**. L'A/B con
  quattro voci e lo stesso nome: 0 a ogni larghezza. Il cap è proporzionale ora
  (`min(220px, 19vw)`), e il prezzo è che su tablet un nome lungo si tronca prima.

---

## 6. Regole che non si negoziano

- `. ./env.sh` prima di ogni comando npm.
- Mai `git add -A`.
- **`build:srd -- --check` è il cancello vero, ed è un cancello SOLO LOCALE.** La CI non lo lancia,
  e non lancia nemmeno l'alternativa che si potrebbe supporre: lo step
  `npm run build:srd` + `git diff --exit-code -- data/` esiste in `ci.yml`, ma è condizionato a
  `if: steps.srd.outputs.present == 'true'`, e `present` è vero solo se il PDF dell'SRD sta in
  `Manuali/` o in `tools/.cache/`. **`Manuali` è in `.gitignore` e non arriva mai a un runner**, per
  cui lo step è sempre saltato — l'annotazione «*Re-extraction is skipped*» compare in ogni run,
  compresi quelli verdi di stanotte. Conseguenza da tenere in mente: **nessuna CI verifica che
  `data/srd-1.0.json` sia ancora ciò che i parser producono.** Solo tu, in locale, prima di unire.
- **`gh pr merge` è ciò che pubblica.** Il `git push origin main` dopo è un no-op.
- **Verifica che un run CI esista davvero prima di unire** — `gh run list --branch <ramo>`, non solo
  `gh pr view`. Una PR può dire CLEAN con zero check.
- La larghezza di un bersaglio distruttivo è `var(--control)`, mai un letterale.
- Leggibilità: se una lista non entra, si taglia il numero di risultati o si scorre. **Non** si
  scende di corpo.
- **Un test che porta la risposta attesa come letterale conferma qualunque cosa il codice faccia
  dopo.** Stanotte è successo tre volte e le ho riscritte tutte e tre: le vie d'uscita del MENU del
  GM, la nav dell'header e i glifi pieni della TabBar filtravano tutte per la lista che poi
  asserivano.
- **Un mutante sopravvissuto va affrontato, non nascosto.** Stanotte ne sono sopravvissuti tre: la
  soppressione dei record era vera per il motivo sbagliato, il filtro delle domande è
  indistinguibile sui dati veri (e il docblock lo dice), e la riparazione dell'atterraggio non
  aveva test — quello è il caso in cui il mutante ha trovato un buco vero.
- Non camminare l'app sui dati del proprietario: **5199 è la campagna vera**. Stanotte sono state
  usate la 5203 e la 5206, IndexedDB vuoto.

---

## 7. Da dove ripartire

Il piano SRD non ha una parte successiva. Il debito più leggibile è il §4 qui sopra, e il primo
punto — la testata del piano che dice nove quando sono dieci — è lo stesso difetto che la #46 è
esistita per riparare.

Il rig di misura sta fuori dal repo, e si elenca con un `ls` diretto, mai un `find` sulla home:

```
~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/
```

Casi nuovi scritti stanotte e riusabili: `cases-playsearch.json`, `cases-tabs5.json`,
`cases-hdrname.json`, `cases-moments.json`, `cases-global.json`, `cases-askrow.json`. Si lanciano
con `AUDIT_ORIGIN=http://localhost:52xx AUDIT_PORT=93xx node run.mjs <file>` — **mai** 5199.
