# Step 5 — l'indice della reference, ri-progettato

**Sostituisce il piano dello step 5 prodotto il 25 agosto in sola lettura**, che era giudicato
`DA_CORREGGERE` e che tre cose hanno reso obsoleto nello stesso giorno in cui è stato scritto.
Questo documento non è un piano nuovo da zero: è quello, con la premessa rifatta e le sette
affermazioni false tolte.

Leggi prima: `docs/handoff/DECISIONI-2026-08-25.md` §1, e `PROGETTO-GM-2026-08-23.md` §3 e §6
step 5.

---

## 1. Le tre cose che sono cambiate sotto il piano

### 1.1 Il blocco è stato sciolto, e riduce lo step invece di allargarlo

Il piano si dichiarava bloccato su una domanda sola: *che indirizzo hanno i due chip compositi.*
**Risposta del proprietario, `DECISIONI-2026-08-25.md` §1: quei due non sono pin.**

La conseguenza è la parte che va letta due volte, perché il piano dice l'opposto:

> **`REFERENCE_TOPICS` NON si ritira.** Resta, ed è l'unica porta ai due renderer compositi.
> I pin seminati sono **sei**, non otto.

Questo **toglie** allo step il suo passo più invasivo. Il piano prometteva un rosso progettato —
`tests/ui/gmGeometryProse.test.ts` che va rosso *all'import* della costante cancellata, più i tre
test di `describe('the topic strip')` in `tests/gm/reference.test.tsx` — e avvertiva che quel
rosso «è più grosso di come lo step lo descrive». **Adesso non c'è nessun rosso da progettare:**
la costante resta, la strip resta, quei quattro test restano verdi.

Chi esegue deve resistere alla tentazione di ritirarla comunque «già che c'è». Toglierla senza un
indirizzo per i due compositi **perde funzionalità**, ed è la ragione per cui la domanda era una
domanda.

### 1.2 L'atterraggio non è «non ancora fatto». È fatto, e più di prima

Il piano ordinava di cancellare `blockOf`, la variabile `landing`, il ref, «e l'effetto». Tre
cose sono sbagliate in quella frase:

- **Non è mai esistito nessun effetto.** C'era un callback ref, e il commento sopra diceva
  testualmente perché: *«A callback ref rather than an effect, because the thing being waited for
  is the node and not a render»*. Il piano ordinava di cancellare due cose dove ce n'era una.
- **`blockOf` non esiste più.** Il 25 agosto la lane ricerca l'ha sostituito con `landingIn`,
  esportato, che atterra a granularità di **part** e non di blocco.
- **La premessa «a hit opens at the top of a 10,879-character section» è superata.** Un hit apre
  sulla riga che l'intestazione sta citando, e le parole del GM sono accese nel corpo. Misurato in
  Chrome sul deploy: lo scroller scende di **1491px** e il sottotitolo del blocco d'atterraggio si
  ferma a `top: 378.2` contro il bordo dello scroller a `379.7`.

**Quindi il passo «ri-puntare la ricerca sulle unità» va riscritto da capo**, non corretto: la
ricerca oggi atterra più fine di un'unità. La domanda vera che resta è se un'*unità* debba
diventare un **bersaglio indirizzabile** (un id che un pin può contenere), non se l'atterraggio
vada costruito.

### 1.3 La finestra di lettura è di 308px, e adesso è un numero misurato

`PROGETTO-GM §7` voce 5 chiedeva se sei righe di gruppo più un campo pinnato da 44px più la barra
delle schede lascino l'albero raggiungibile senza scorrere al primo disegno.

Misurato il 25 agosto in Chrome sul deploy, a 393×852 con insets 47/34, dentro SHOW con un
risultato aperto: **`clientHeight` dello scroller dei risultati = 308px**, `scrollHeight` 2065.

Trecentootto pixel. Sei righe di gruppo a 44px sono 264 da sole. **L'albero di navigazione non ci
sta**, e questo è un dato, non un timore. Va progettato contro 308, non contro il 717.4 che i
documenti citano per un'altra superficie.

---

## 2. I numeri veri, e quelli che il piano sbagliava

| cosa | il piano | misurato il 25 agosto |
|---|---|---|
| unità | 215 | **215** ✓ |
| la sua giustificazione | «259 è impossibile» | **falsa**: 259 era esatto sul corpus pre-Witherwild |
| sezioni distinte dietro gli otto chip | 11 | **13** |
| sezioni | 69 | **69** ✓ |

**L'aritmetica delle unità, rimisurata col parser vero:** 69 sezioni, **215 blocchi**, 156
sottotitoli, 10 sezioni senza testata. `156 + (69 − 10) = 215`, che è esattamente la stessa
aritmetica che pre-Witherwild dava `189 + (80 − 10) = 259`. Il numero del piano era giusto; il
rischio che ci costruiva sopra — *«chi esegue senza saperlo scriverà un test che non può
passare»* — poggia su una premessa falsa e va tolto.

**Le 13 sezioni**: sei chip uno-a-uno (`experiences`, `difficulty`, `countdowns`, `distance`,
`costs`, `fear`), più le due di `TierBenchmarks`, più le cinque di `GmMoves`. Nessuna
sovrapposizione. La cifra 11 del piano è sbagliata; **l'argomento che ci stava sopra regge lo
stesso**, ed è quello che ha prodotto la decisione §1.

---

## 3. Due passi che non compilano, e uno che accusa il test sbagliato

Chi esegue deve saperli prima, non scoprirli:

1. **`Fold` non prende il titolo in `summary`.** La firma è `Fold({ label, summary, defaultOpen,
   children })` e **`label` è obbligatorio**: è lo `.t-label` a sinistra. `summary` è opzionale,
   allineato a destra, e il suo commento dice *«Say what is inside, not how much of it»*.
   `PROGETTO-GM §3` chiede «one 44px row **labelled** with the section title»: il titolo va in
   `label`. Il passo del piano lo mette nella casella sbagliata e omette il prop richiesto —
   così com'è **non compila**.
2. **Il test che accusa i componenti non registrati non è il primo del file.** È
   `it('has a fixture for every one of them')`, il **secondo** test di
   `describe('every component in src/ui')` in `tests/ui/screens.test.tsx`. Il messaggio che il
   piano cita è giusto, la posizione no — e chi cerca un rosso nel posto sbagliato conclude che
   il passo non serve.
3. **I tipi non possono essere orfani.** `tests/harness/reachability.ts` salta le dichiarazioni di
   tipo per costruzione, col commento *«Types have no runtime existence, so they cannot "ship
   switched off"»*. L'avvertimento del piano — «non esportare altro, ogni export senza chiamante
   fa fallire `orphans.test.ts`» — **non si applica** a `export interface RuleUnit`, e applicarlo
   costringerebbe a un disegno peggiore per niente.

---

## 4. Lo step, riscritto

Nell'ordine. Ogni passo è ancorato a **simboli**, non a numeri di riga: due lane stanno scrivendo
in questi file mentre questo documento viene scritto, e un numero di riga citato qui sarebbe già
falso quando qualcuno lo legge.

**a. `ruleUnits()` e gli id stabili.** Una unità è un blocco: 215 di loro. L'id deve sopravvivere
a una ricostruzione del dataset — `tools/build-srd.ts` deriva le intestazioni dal PDF, quindi un
id derivato dal testo dell'intestazione marcisce quando il PDF viene reimpaginato. Deriva da
`sezione + indice del blocco`, e **pinna in un test** che i 215 id sono unici e che ognuno
risolve attraverso `ruleSection`.

**b. L'albero di navigazione a sei gruppi**, col tiebreak di p.113. **Progettalo contro i 308px
misurati** (§1.3). Sei righe a 44px sono 264: o i gruppi si aprono uno alla volta, o l'albero
scorre e lo si dichiara. Non fingere che ci stia.

**c. `prefs.gmRecentRules` e `prefs.gmPinnedRules`, seminati con SEI.** Non otto. I due compositi
restano righe permanenti fuori da `prefs`, raggiunte dalla strip che resta.

**d. NON ritirare `REFERENCE_TOPICS`.** Aggiorna invece il suo docblock: oggi argomenta l'ordine
per larghezza come se la strip fosse l'unica porta alla reference, e da domani sarà la porta ai
**due compositi** accanto a un elenco di pin. Quella è una frase da riscrivere, non da cancellare.

**e. L'unità come bersaglio indirizzabile.** Non «ri-puntare la ricerca»: la ricerca atterra già
più fine. Il lavoro è che un id di unità possa stare in un pin e riaprire quel blocco.

---

## 5. Cosa questo step NON fa

- **Non tocca l'atterraggio né la marcatura.** Sono usciti il 25 agosto, sono pinnati, e la
  decisione §8 del proprietario dice che si accende solo il blocco d'atterraggio.
- **Non ritira la strip** (§1.1). È la cosa che il piano vecchio voleva più di tutte.
- **Non spezza il `<p>` per riga**: decisione §7 del proprietario, si atterra sul paragrafo.
- **Non rimisura le cifre di forma del dataset.** 35 liste, 7 tabelle, 3 entrambe, 39 su 69 sono
  asserite e vive in `tests/ui/srdReference.test.ts`, e la lane 0 le ha tolte da quattro docblock
  proprio perché non venissero riderivate.

---

## 6. Una cosa che resta aperta e non è di questo step

`PROGETTO-GM §7` voce 6 chiede se un terzo gruppo QUESTIONS spinga il primo risultato sotto la
piega. **Non è rispondibile finché il catalogo non esiste**, e il catalogo è in costruzione
adesso. Va misurato dopo — sui 308px, non su una stima.
