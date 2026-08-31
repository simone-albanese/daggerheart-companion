# Handoff — 31 agosto 2026, la rimozione dell'importatore, a un terzo

**Questo documento è scritto MENTRE la corsia gira.** Il ramo
`togliere-import-manuale` si muove sotto queste righe: **leggi `git log` prima di
credere a qualunque SHA scritto qui.** `b35523d` è il pavimento, non la punta.

Segue `HANDOFF-2026-08-31-PROSSIMI-DUE-PASSI.md` (#63), che resta l'autorità sul **perché**.
Questo dice **dove siamo** e **cosa manca**.

---

## 0. La decisione, e la domanda che non va ri-posta

> **«Via tutto.»** — il proprietario, 31 agosto 2026.

È la strada **(c)** del §3 di #63: via l'importatore PDF, via le buste `.dhart`, via lo store
`art`, via il ramo dell'illustrazione. **Le carte restano di solo testo.**

**La domanda aperta di #63 §3 HA RISPOSTA. Non chiederla di nuovo.**

---

## 1. Cosa è già fatto: R1, commit `b35523d`

**45 file, +398 / −4878.** Misurato nel worktree, con `. ./env.sh >/dev/null 2>&1 && node -v`
→ `v24.19.0`:

```
npx tsc --noEmit             → 0 errori
npx vitest run               → 154 file / 4171 test, 0 falliti, 0 saltati
npm run build:srd -- --check → allineato   (la pipeline SRD non è stata sfiorata)
npm audit                    → 0 vulnerabilities
```

**L'avviso `GHSA-hq66-cqwq-w95j` è già chiuso.** È il risultato che la rimozione doveva comprare, ed
è arrivato al primo passo. Il totale dei test cala da 4260 a 4171 perché `tests/import/` se ne va:
un totale che cala è atteso qui, e chi lo rivede deve sapere perché.

### 1a. Le due volte in cui R1 ha disobbedito al brief, e aveva ragione

Il brief era **mio**, ed era sbagliato in due punti. Sono registrati perché la stessa trappola
aspetta chiunque scriva il prossimo.

1. **`'art'` RESTA in `STORES` e nella transazione di `removeLayer`.** Il brief diceva di toglierlo
   *e* di non toccare il blocco `upgrade`: **internamente contraddittorio.** `STORES` è esattamente
   ciò che `clearAll` scorre, e il blocco `upgrade` di versione 1 crea ancora lo store. Toglierlo
   avrebbe **silenziosamente smesso di far cancellare le illustrazioni al pulsante di reset**, e
   rotto tre test che asseriscono `STORES == objectStoreNames`. R1 ha tolto invece **l'API**
   (`getArt`/`putArt`/`artKeys`), ha declassato `ArtRecord` a modulo-locale con un docblock che dice
   perché lo store sopravvive all'API, e ha aggiunto due asserzioni sullo store grezzo che provano
   che `clearAll` e `removeLayer` arrivano ancora ai byte.
2. **Il messaggio `warm-importer` del service worker era ANCHE l'unico evento client che chiamava
   `ensurePrecached()`** — la correzione di uno schermo bianco documentato in produzione (worker
   attivato + Cache Storage reclamata; `activate` è l'altro unico chiamante e non gira mai più).
   Cancellare la macchineria dell'importatore **si sarebbe portata via quella correzione**, che con
   l'importatore condivide solo il messaggio. Ora è `hello`, mandato da ogni pagina, con due test.

### 1b. Ambito oltre il brief, imposto dalla regola «cancellare non è nascondere»

Il brief non li elencava; R1 li ha trovati seguendo la regola: `public/sw.js`
(`isDeferred`/`importerWasWanted`/`warmImporter` e 4 chiamate), `src/pwa/register.ts`,
`vite.config.ts` (**tutto il blocco `worker:` — il worker dell'importatore era l'unico
`new Worker` dell'albero**), `shared/types.ts` (`artKey`).

**Gli 1,6 MB di pdf.js già sui dispositivi se ne vanno con la potatura ordinaria del precache**: il
documento nuovo non nomina più alcun worker, quindi la prima attivazione li spazza. Il test che
asseriva **il contrario** — che il chunk sopravviveva a un aggiornamento offline — ora asserisce la
spazzata, offline, contro una cache seminata come quella di un dispositivo vero.

---

## 2. LA COSA PIÙ IMPORTANTE CHE MANCA, e non è lo store `art`

R1 l'ha trovata e l'ha passata a R2 come **primo dovere**:

> Importare il Core Rulebook non aggiungeva solo *illustrazioni*. Aggiungeva un **layer** — testo
> di ambientazione e numeri di pagina, sovrapposti al contenuto SRD. `src/store/dataset.ts` stende
> ancora i layer preesistenti sopra l'SRD, e **con `Rulebook.tsx` cancellato non esiste più alcuna
> interfaccia per togliere un layer importato**, se non un reset completo dell'app.

Cioè: **un dispositivo che aveva importato il manuale si tiene il testo di ambientazione e i numeri
di pagina, senza alcun modo di levarli.** È la regola «cancellare non è nascondere» che morde più a
fondo dello store `art`, e va risolta prima di considerare finita la corsia.

`putLayer`/`putOverlays`/`removeLayer` sono già nella lista bianca DELIBERATE degli orfani, con
scritto `R2` accanto.

---

## 3. Cosa resta, in ordine

**R2 — la migrazione, e i layer.** Due doveri, e il secondo è quello di §2.

- Il layer importato deve poter uscire dal dispositivo. Decidere **come**: cancellarlo nella
  migrazione, o dargli un comando in Impostazioni. La prima è coerente con «via tutto»; la seconda
  lascia al proprietario ciò che ha già. **È una domanda da porre, non da decidere in corsia.**
- `DB_VERSION` 2 → 3 con un `deleteObjectStore('art')` vero. Toglierlo dallo schema non lo cancella
  dai dispositivi: sarebbero decine di MB di WebP abbandonati.
- **Attenzione al ramo `oldVersion < 1`**, che crea ancora `art`: un dispositivo nuovo eseguirebbe
  entrambi i blocchi in ordine, creando lo store e poi cancellandolo. Funziona ed è sciocco;
  toglierlo dal ramo 1 è più pulito ma rende i due rami una cronologia non più fedele. **Scrivi la
  ragione, qualunque strada prendi.**
- **Mutanti obbligatori:** (a) togli il `deleteObjectStore` lasciando il bump; (b) lascia
  `DB_VERSION = 2` tenendo la cancellazione. Ognuno deve far diventare rosso un test **nominato**.

**R3 — il cancello.** `npm audit` senza l'avviso (già vero a R1: riconfermalo), `pdfjs` assente da
`package.json` **e** dal lockfile, `grep -rn "pdfjs" src shared tools tests` vuoto, e **il bundle
misurato prima e dopo** — `npx vite build` sui due alberi, confrontando il totale di `dist/` e il
numero di chunk. **Non ereditare l'1,67 MB da nessun documento: misuralo.** È il numero che dice al
proprietario cosa ha guadagnato.

---

## 4. Due cose riferite fuori corsia, che aspettano una decisione

1. **`tools/pdfText.ts:11` dice ancora**: *"pdf.js stays in `src/import/`, where the Core Rulebook
   … is handled."* Falso da `b35523d`. R1 non l'ha toccato perché il brief dichiarava `tools/`
   intoccabile e gli diceva di fermarsi. **Una riga, serve una decisione.**
2. **`shared/textLayout.ts` e `shared/parsers/*` non hanno più alcun consumatore in `src/`** — ogni
   riferimento da `src/` è un commento, non un import. Sono codice di build che vive in `shared/`, e
   il vincolo di `textLayout` («non deve importare nulla di specifico a Node») ha perso la sua
   giustificazione. R1 l'ha **registrato nel docblock e NON ha rilassato il vincolo**, perché dove
   viva quel modulo è una decisione separata dal togliere un importatore. **Corsia futura.**

---

## 5. Le regole macchina, che mordono ancora

- **`. ./env.sh >/dev/null 2>&1 && node -v` → deve dire v24. MAI `. ./env.sh | head`**: la pipe
  crea una subshell, stampa il banner di Node 24 e lascia Node **26** sul PATH del padre.
  **Il banner mente**, e costa 31 fallimenti fantasma.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- **Mai la porta 5199**: è la campagna vera del proprietario.
- Chi muta lavora in una copia `rsync`, mai nel worktree condiviso.
- **Refuta i tuoi rilievi, ma non oltre:** se due revisori indipendenti sollevano lo stesso rilievo
  avendo *eseguito* il comando, quell'accordo **è** la prova. Rimetterlo in discussione ha ucciso 13
  rilievi su 17, di cui 5 erano veri.
- Dopo due giri di riparazione: **imporre, marcare o cancellare — non ri-derivare.** Meglio imporre
  un invariante nel layout che riaffermarlo in prosa.

---

## 6. Poi, e solo poi, l'SRD 2

`Manuali/DH_SRD_2_2026_08_25.pdf`, 224 pagine contro 68. **Oggi è inerte**: `tools/loadSrd.ts`
cerca due nomi esatti e verifica uno SHA fissato, quindi il file nuovo non viene nemmeno trovato.

Additivo nel contenuto: **772 voci su 780 sopravvivono**. Ma il changelog dice *«reformatted to
single-page output instead of spreads»* e i parser sono guidati dal layout, quindi il lavoro è la
**geometria**. E i trattini sono **U+2011**: normalizzali prima di confrontare per nome, o 9 carte
sembreranno scomparse e non lo sono.

**Ondata propria.** Non intrecciarla con un bump di schema.
