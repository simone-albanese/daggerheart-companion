# Handoff — 31 agosto 2026, i due passi decisi: togliere l'importatore, poi l'SRD 2

Segue `HANDOFF-2026-08-31.md`, che resta l'autorità su **cosa è stato spedito**. Questo documento
dice **cosa viene dopo** e perché, ed è stato scritto misurando l'albero, non ricordandolo.

---

## 0. La decisione del proprietario

> **Togliamo l'importazione del manuale. Teniamo solo l'SRD.**

Presa il 31 agosto 2026, dopo che l'avviso di sicurezza su `pdfjs-dist` è stato tracciato fino al
punto in cui morde. Non è una mitigazione di quell'avviso: è una decisione di prodotto che **lo
chiude come effetto collaterale**.

**Ordine dei due passi, deciso:** prima la rimozione, poi l'SRD 2. Non intrecciarli.

---

## 1. Perché la rimozione chiude l'avviso, e non solo lo aggira

`pdfjs-dist@5.7.284` porta `GHSA-hq66-cqwq-w95j` — *esecuzione di JavaScript arbitrario
all'apertura di un PDF malevolo*. Misurato oggi:

- **`pdfjs` è usato SOLO da `src/import/` e da `tests/import/coreRulebook.test.ts`.**
  Verificato: `grep -rn "pdfjs" src/ shared/ tools/ tests/` non dà un solo risultato fuori di lì.
- **La pipeline dell'SRD non lo usa.** `tools/loadSrd.ts` e `tools/pdfText.ts` estraggono con
  **poppler** (`pdftohtml`), a tempo di build, mai in un browser.

Quindi togliere l'importatore **toglie la dipendenza**, e con essa l'avviso — senza il salto di
major 5.x → 6.x che nessuno voleva fare adesso.

### 1a. Il dettaglio che rende l'avviso reale, e che va ricordato

`src/import/detectSource.ts` rifiuta tutto ciò che non è il Core Rulebook. **Quel controllo non
protegge da questa vulnerabilità**, e il motivo è l'ordine: per sapere *quale* libro sia, l'app deve
prima aprirlo e leggerne il testo — con la libreria vulnerabile. **Il rifiuto arriva dopo
l'analisi.** Chi valuta il rischio non deve leggere quel guardiano come una difesa.

Il percorso d'attacco resta stretto e deliberato — il proprietario deve scaricare un PDF preparato e
poi sceglierlo di persona in Impostazioni → Manuale — ma il raggio non lo è: girerebbe nella stessa
origine che tiene **le campagne** in IndexedDB, e il fatto che stia in un worker non lo contiene,
perché un worker vede lo stesso database.

---

## 2. L'ambito, misurato

| cosa | righe | destino |
|---|---|---|
| `src/import/` (9 file) | **2480** | via, **tranne `artPack.ts`** — vedi §3 |
| ┗ `artPack.ts` | 201 | **dipende dalla domanda aperta** |
| `tests/import/` (8 file) | **1230** | via, tranne `artPack.test.ts` |
| `src/ui/settings/Rulebook.tsx` | **437** | la via del PDF via; la schermata dipende da §3 |
| `pdfjs-dist` in `package.json` | 1 riga | **via — è questo che chiude l'avviso** |
| il pre-riscaldamento in `src/ui/shell/App.tsx:257-265` | ~9 | via |

Altri punti che il grep trova e che vanno letti prima di tagliare:

- **`src/ui/shell/App.tsx:257`** importa `../../import/index.ts` dinamicamente per scaldare la cache
  del worker pdf.js sui dispositivi capaci. Il suo commento spiega perché non sta nel precache: va
  cancellato con la funzione, non lasciato a fallire in silenzio.
- **`tests/engine/names.test.ts`** nomina l'importatore. Leggere perché prima di toccarlo.
- **`src/store/db.ts`** dichiara lo store `art` (`STORES`, `getArt`, `putArt`, `artKeys`, e
  `art` dentro la transazione a :374). **Non è dell'importatore**: vedi §3.

**Totale grezzo: ~4150 righe**, di cui ~1400 restano se le buste d'arte sopravvivono.

---

## 3. LA DOMANDA APERTA, e va risposta prima di cancellare

**Ci sono DUE vie perché le illustrazioni entrino nell'app, e solo una usa pdfjs.**

1. **Il PDF** — `Rulebook.tsx:132`, `pickBinaryFile('application/pdf,.pdf')` → `src/import/` →
   pdfjs. **Questa è la via vulnerabile, ed è quella che il proprietario ha deciso di togliere.**
   Richiede un desktop e il PDF da 319 MB.
2. **La busta `.dhart`** — `Rulebook.tsx:186`, `readArtPack` → `src/import/artPack.ts`.
   **Non usa pdfjs**: è un contenitore volutamente stupido, intestazione fissa, indice a lunghezza
   prefissata, poi i byte WebP di fila. `Blob.slice` li passa dritti in IndexedDB senza decodificarli.
   È **la via che il telefono usa**, e il suo docblock dice esattamente perché esiste: *«estrarre
   l'arte vuole un desktop, un PDF da 319 MB e molta memoria; usarla non vuole niente di tutto ciò,
   e il telefono è dove si gioca davvero»*.

Le illustrazioni sono lette da **`src/ui/shared/DomainCardView.tsx`** via `getArt(key)`, che degrada
da solo quando non c'è nulla (`if (revoked || !record) return;` — la carta resta senza figura).

**Quindi togliere la via 1 non spegne le illustrazioni.** Ma toglie l'unico modo di **crearle**:
oggi la busta viene scritta dal desktop a partire da ciò che il PDF ha già messo nello store
(`Rulebook.tsx:204-212`, `buildArtPack` sui record di `getArt`).

### Le tre strade, e cosa costano

- **(a) Via il PDF, restano le buste.** Chi ha già l'arte la tiene e può ancora scrivere un `.dhart`
  per il telefono. **Ma una installazione nuova, senza busta, non ha più alcun modo di avere
  figure** — e se il proprietario perde la sua busta, le perde per sempre. Taglio: ~2280 righe di
  `src/import/` + i test relativi; `artPack.ts` e `artPack.test.ts` restano; `Rulebook.tsx` perde la
  via del PDF e tiene le due delle buste.
- **(b) Via il PDF dal browser, l'estrazione va in `tools/`.** `tools/` estrae già dai PDF con
  poppler, offline, mai in un browser. Spostare lì la generazione dell'arte **chiude comunque
  l'avviso** (pdfjs sparisce dal bundle) e non perde la capacità. Costa una corsia sua, ed è più
  lavoro della semplice cancellazione.
- **(c) Via tutto**: importatore, buste, store `art`, e `DomainCardView` perde il ramo della figura.
  Il taglio più netto, ~4150 righe, e le carte restano di solo testo per sempre.

**La decisione «togliamo la funzione, teniamo solo l'SRD» è compatibile con (a) e con (c), e non
distingue fra le due.** Chi riprende deve chiederlo prima di cancellare, e la domanda concreta è:

> *«Hai già importato l'arte del manuale, e hai una busta `.dhart` da qualche parte? Vuoi poterla
> ancora usare su un dispositivo nuovo?»*

**Non guardare i dati del proprietario per rispondere.** La 5199 è la sua campagna vera, e questo
repo ha già una regola scritta contro il camminarci dentro.

---

## 4. Come eseguire la rimozione, quando la domanda ha risposta

- **Il cancello resta quello:** `. ./env.sh >/dev/null 2>&1` (**mai `| head`**, vedi
  `HANDOFF-2026-08-31.md` §5), `npx tsc --noEmit` pulito, `npx vitest run` verde,
  `npm run build:srd -- --check` allineato. La base da cui parti: **162 file / 4260 test, 0 saltati**.
- **La prova che la rimozione è completa non è il verde della suite**, è
  `npm audit` che non riporta più l'avviso, più `grep -rn "pdfjs" src shared tools tests` che non
  dà nulla, più `pdfjs-dist` assente da `package.json` **e** da `package-lock.json`.
- **Misura il bundle prima e dopo.** Il worker pdf.js pesa **1,67 MB**. È il numero che dice al
  proprietario cosa ha guadagnato, ed è l'unico numero di questa corsia che vale la pena scrivere.
  Misuralo, non ereditarlo da questo documento.
- **I docblock cancellati portano argomenti, non riassunti.** `art.ts` spiega perché l'arte si
  prende dalle schede-carta e non dai capitoli; `capability.test.ts` spiega che un telefono lasciato
  passare non mostra un errore, **rasterizza un libro di 397 pagine finché la scheda non muore**.
  Se quegli argomenti restano veri per qualcosa che sopravvive, spostali. Se muoiono con il codice,
  muoiono — ma non lasciarli orfani a metà.
- `ART_PACK_WARNING` è mostrato a ogni scrittura di busta e `buildArtPack` **rifiuta senza un
  riconoscimento esplicito**. Se le buste restano, quella catena resta intera.

---

## 5. Poi l'SRD 2, e solo poi

`Manuali/DH_SRD_2_2026_08_25.pdf`, 224 pagine contro 68. **Oggi è inerte**: `tools/loadSrd.ts` cerca
due nomi di file esatti e verifica uno SHA-256 fissato, con il commento *«Locked: a new revision
changes this and the build must stop and be reviewed»*. Il file nuovo non viene nemmeno trovato.

**Nel contenuto è additivo.** Misurato: **772 delle 780 voci** del dataset 1.0 sopravvivono — zero
avversari, ambienti, carte di dominio, classi, stirpi o comunità persi; mancano 7 armi con nome
proprio più una dubbia.

**Attenzione a una misura che sembra una perdita e non lo è:** un primo confronto dava 9 carte di
dominio mancanti. **Erano tutte lì** — l'SRD 2 scrive `ARCANA‑TOUCHED` con il trattino unicode
**U+2011**. Normalizza trattini e apostrofi prima di confrontare per nome.

**Il lavoro è la geometria.** Il changelog dice *«reformatted to single-page output instead of
spreads»*, e i parser sono guidati dal layout (`layoutPages`, `dumpLayout.ts`, riquadri e colonne):
passare da doppia pagina a pagina singola cambia ogni coordinata orizzontale. Più InDesign 21.4
(font diversi → `glyphs.ts`/`remapGlyphs`, e l'U+2011 lo dimostra), **311 statblock contro 148**, il
decimo dominio (Dread), quattro classi nuove (Assassin, Brawler, Warlock, Witch), e
**Transformations** (Demigod, Ghost, Reanimated, Shapeshifter, Vampire, Werewolf), che nello schema
**non ha casa**: c'è `beastform` sulla scheda, non c'è `transformations`. Più i campaign frame,
Witherwild incluso — e il ramo `witherwild-out` dice che era stato escluso **di proposito** una
volta: quella decisione va ripresa, non ereditata.

**È un'ondata propria**, dell'ordine di grandezza della Wave B. Non intrecciarla con un altro bump
di schema: produrrebbe un converter che fa due cose, ed è il difetto che questo repo ha già pagato.
