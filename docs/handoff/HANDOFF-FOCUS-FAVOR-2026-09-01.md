# Handoff — il Focus e il Favor: le otto domande, e cosa ne è uscito

**Questo documento è cambiato di natura.** È nato la mattina del 1 settembre 2026 per dire
*«non costruire prima di aver posto otto domande»*. Le domande sono state poste la sera
stessa, decise dal proprietario, e il lavoro che ne è seguito è **unito e pubblicato**.

Quello che resta qui è il **verbale**: le otto risposte (§1), il progetto su cui poggiavano
(§2), le regole macchina che mordono (§3), gli errori di quella sessione (§4), e cosa è
stato costruito (§6). I commit si citano **per oggetto, mai per SHA**.

---

## 0. Stato, misurato — 1 settembre 2026, notte

```
main                        «Merge pull request #72 from …/corsia-c-folii-equipment»
sw.js pubblicato            0541bda25e8fa8dc173bac133d3f86a5df329c19  (combacia con main)
npx tsc --noEmit            0 errori
npx vitest run              192 file / 4776 test
build:srd --check           entrambi i libri combaciano con la sorgente
build:registry --check      1368 id
SCHEMA_VERSION / CODEC      9 / 9
```

**Il deploy è verificato sul sito e non dedotto**, e non solo con lo SHA: i chunk serviti
sono stati scaricati e ci sono state cercate dentro le cose nuove. Vedi §6 per dove
guardare, perché **cercarle nel chunk sbagliato dà «assente» e fa concludere che il deploy
sia rotto**.

**UNIRE È IL DEPLOY.** `deploy.yml` parte su ogni push a `main`. Spingere un ramo non lo è.

---

## 1. LE OTTO DOMANDE — POSTE, DECISE, NON RIAPRIRLE

Il proprietario le ha decise il 1 settembre 2026. Chi riprende **non le ripone**.

### Bloccanti

1. **Il seme del Favor in migrazione → `{ marked: 0, max: 6 }`, e il 3 solo a una scheda
   nuova.** Una migrazione aggiorna chi gioca già, e seminargli 3 è inventargli uno stato
   che non ha guadagnato. Come `stanceRefs: []` e `focus` prima di lui.
   **Precisato in costruzione, ed è una decisione in più:** il 3 va **solo a un Warlock**.
   La prima implementazione lo dava a *ogni* scheda nuova — un Bardo compreso — con la
   giustificazione, **falsa**, che `newCharacter` non conoscesse la classe: la conosce, la
   risolve poche righe sopra il seme, e la riga di `hp` accanto la usa già.

2. **Dove su Gioco → una riga propria sotto `Vitals`**, non dentro la fila delle quattro.
   Metterle nella fila porterebbe Vitals da 4 a 6 card in un solo wrap, e il min-content di
   una card è 44+44: il wrap preme e le quattro esistenti si stringono.
   **La misura va fatta in Chrome a 393×852, non dedotta.**

3. **Il Focus resta anche in Build → sì, in tutte e due.** Build è dove si *conoscono* le
   stance, Gioco è dove si *spende*. Lo stato è uno solo nello store, quindi non c'è nulla
   da tenere in accordo.

### Di indirizzo

4. **Il Patron Die → pool *e* armabile.** `dicePools.ts` lo dichiara (d6, d8 dal livello 5),
   `heldDice.ts` lo arma dentro il tiro, e la spesa del Favor si aggancia all'armamento.
   Nota: `heldDice.ts` sta in **`src/ui/player/`**, non nel motore. E la scala d6→d8-al-5 già
   presente in `dicePools.ts` è quella del **Rally Die** — precedente esatto, non lo stesso dado.

5. **«Gain a Favor instead of a Hope» → l'app lo offre** sul risultato del Duality Roll.
   È coerente con la regola di casa: l'app propone e non applica. Tocca il percorso del
   tiro, non solo `Vitals` — è il quinto costo, che l'elenco della §2 non contava.

6. **`invigorating` → a mano.** Nessun d4 proposto; lo stepper del Focus copre il caso.

### Pulizia

7-8. **Rimandata quel giorno, eseguita a lavoro finito.** I rami uniti e gli scratchpad sono
   stati ripuliti solo dopo che le tre PR erano unite e il deploy verificato.

### E una nona domanda, che è nata dalle prime otto

**Due lavori chiedevano lo stesso, unico allargamento dell'header** — il campo `favor` e lo
scambio di carta dello Step Four. `codec.ts` diceva: *«When 8 is spent there is no fifth value
with it, and the next bump has to widen the header rather than pick a worse number quietly.»*
Deciso: **una sola volta, e porta dentro entrambi**. Perciò il Focus/Favor ha perso il suo
bump e si è ridotto a UI più motore dei dadi.

---

## 2. Il progetto, e la misura su cui poggia

> **Letto il 1 settembre 2026, sera: questa sezione è il progetto COM'ERA, e si legge come
> tale.** Dei quattro costi elencati in fondo, i primi due sono **fatti e pubblicati** — il
> campo `Character.favor` con il suo bump, e le quattro liste di guardia — mentre il terzo
> (`Vitals.tsx`) e il quarto (`dicePools.ts`) no. E l'elenco è **incompleto**: la risposta 5
> della §1 aggiunge un quinto costo che qui non c'è, l'offerta sul risultato del Duality Roll.
> Marcata e non riscritta: un verbale che si riscrive smette di essere un verbale.


**Sono la stessa cosa due volte: due tracce con lo stesso tetto stampato, 6.**

### Il Focus — Martial Artist

Già modellato dalla #66. `Character.focus` è un `Counter`, il tetto è
`MAX_FOCUS = 6` da una frase del folio 13, e la regola di ricarica è nel dataset
dalla #66 (`rules/focus`: una volta per riposo, azzeri, tiri d6 pari all'Istinto,
prendi il più alto). **È disegnato solo in Build.** Un Martial Artist deve
uscire da Gioco per spendere un Focus: è il difetto segnalato.

Cancello: la sottoclasse `martial-artist`, lo stesso che la #67 ha spedito.

### Il Favor — Warlock

**Non modellato affatto.** `Character` non ha il campo. Il libro lo definisce per
intero, nella feature di classe del Warlock:

> *"You start with 3 Favor. You can use a downtime move to show tribute to your
> patron. Describe how and gain Favor equal to your Spellcast trait.
> Additionally, when you succeed on an action roll with Hope, you can choose to
> gain a Favor instead of a Hope. **The maximum Favor you can hold at one time
> is 6.**"*

E il dado:

> *"Before making an action roll that relates to your patron's sphere of
> influence, you can spend a Favor to call upon their aid, rolling your Patron
> Die and adding its result to the total. **Your Patron Die starts at a d6 and
> increases to a d8 at level 5.**"*

Cancello: la classe `warlock`.

> **TRAPPOLA MISURATA.** Cercare `Favor` nel dataset dà 15 siti e **tre sono
> inglese comune**: *"in favor of the PCs"* (regole), *"They owe me a favor"*
> (syndicate), *"garner favor"* (endless-charisma). E le classi **non hanno**
> `features`: hanno `hopeFeature` e `classFeatures`. Una sonda che cerca
> `c.features` trova zero per tutte e tredici e fa concludere che il libro taccia.
> Io ci sono cascato e stavo per riferire un difetto del parser inesistente.

### Cosa costa costruirlo

1. **`Character.favor`**, un `Counter`. Schema **8 → 9**, con una migrazione
   (vedi domanda 1). Il codec va bumpato: `CODEC_VERSION` è 8 e
   `READABLE_CODEC_VERSIONS` è `[1,2,4,8]`; **8 era l'ultimo nibble utilizzabile**
   — il docblock di `codec.ts` dice che il prossimo bump deve **allargare
   l'header**, non scegliere un numero peggiore. Questo è quel bump.
2. **Le quattro liste di guardia**, ed è la parte che si dimentica:
   `readCounter` in `readCharacterRecord`, le chiavi di `checkShapes`,
   `boundCounters` in `src/store/state.ts`, e il codec. Vedi la memoria
   `the-guard-is-a-list`: tre campi in tre ondate sono arrivati senza. La prova
   è un confronto — dare al campo nuovo lo stesso abuso che si dà a `hp` e
   vedere se risponde allo stesso modo.
3. **`Vitals.tsx`**: disegnare le due tracce, ciascuna col suo cancello.
4. **`dicePools.ts`**: il Patron Die come pool, taglia d6 → d8 al livello 5.

---

## 3. Le regole macchina che mordono

- **`. ./env.sh >/dev/null 2>&1 && node -v` deve dire v24. MAI `. ./env.sh | head`**:
  la pipe crea una subshell e lascia Node 26 sul PATH del padre, che nasconde
  `localStorage` a jsdom — una suite verde in locale è più debole di quella di CI.
- **Per annullare una mutazione su un file con modifiche NON committate si usa
  `cp`, mai `git checkout`**: checkout riporta a HEAD e cancella la riparazione
  insieme al mutante. È successo oggi. Il controllo dopo il ripristino è *grep
  del mutante E grep della riparazione*, non «i test sono verdi».
- Una probe deve stare nella **radice** dell'albero o `tsx` fallisce, e va
  cancellata.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- **Mai la porta 5199**: è la campagna vera del proprietario.
- **Verificare che una run CI esista** e sia sul commit esatto prima di unire.
- Il PDF dell'SRD 1 è `Manuali/Daggerheart-SRD-9-09-25.pdf`; l'SRD 2 è
  `DH_SRD_2_2026_08_25.pdf`. Nessun file ha «srd» e «1» insieme nel nome.

**Aggiunte la sera del 1 settembre, tutte pagate in tempo perso:**

- **Una fixture di misura con uno `schemaVersion` vecchio si vede azzerare i campi nuovi
  dalla migrazione.** Ne ho scritta una con `stanceRefs: ['favored']` e schema 4, e la
  migrazione ha seminato `[]` sopra: il caso non misurava niente e sembrava un difetto
  dell'app. **Per misurare uno stato introdotto dopo un bump, la fixture deve dichiarare uno
  schema oltre quel bump.**
- **Il rig di misura esiste e non va ricostruito**, in
  `~/.claude/projects/…/audit-harness/`. `resize_window` di `claude-in-chrome` **non scende
  sotto un minimo di finestra** e ti lascia a 529×675 con `pointer: fine`, cioè non è la
  misura dell'audit. Il rig dà 393×852, dpr 3, `pointer: coarse`.
- **Un verificatore che cerca in un worktree diverso da quello che possiede il file produce
  un'accusa, non una misura.** È successo: una passata ha dichiarato «citazione inventata»
  una frase che esisteva davvero, nel ramo di un'altra corsia. Prima di chiamare inventata
  una cosa, controlla di non essere nell'albero sbagliato.
- **Un conflitto sui due `data/srd-*.json` non si risolve scegliendo un lato: si rigenera.**
  Sono file di **una riga sola**, quindi due rami che ne toccano parti diverse toccano
  comunque la stessa riga. `npm run build:srd` per entrambi i libri dà esattamente l'unione,
  perché il generatore legge `SCHEMA_VERSION` dal codice. Le due risoluzioni ingenue sono
  **entrambe rosse**, ed è misurato.
- **`build:srd --check` non gira in CI** — senza `Manuali/` quello step è saltato in ogni
  run. Un test che legge `data/*.json` e non ha bisogno del PDF vale più di tre che ce
  l'hanno.

---

## 4. Cosa ha sbagliato questa sessione

Sei errori, tutti trovati dalla misura e non dal ragionamento. La forma si
ripete: **leggere una fonte una volta sola e trattare quella lettura come
definitiva.**

1. Ho dichiarato finita un'ondata che aveva **tre fasi** che non avevo visto,
   perché avevo letto il journal una volta sola quando era ancora a due righe.
2. Ho integrato la **prima** consegna di una corsia che poi ne ha fatta una
   seconda migliore, avendo controllato la *coincidenza* e non la *quiete*.
3. Il mio primo test passava sul codice rotto: l'ago `'a'` era soddisfatto dal
   nome del record e `matches` faceva corto circuito prima delle etichette.
4. Ho cercato `stance` e trovato **circum*stance***; poi `c.features` sulle
   classi, che non esiste. Due volte la stessa forma.
5. Ho annullato un mutante con `git checkout` cancellando una riparazione non
   committata.
6. Ho lasciato cadere una condizione (`all.length === 0`) mentre stringevo un
   cancello, e un test esistente l'ha preso.

---

## 5. Lasciato di proposito

- Il debito dell'SRD 2 è nella §4 di `HANDOFF-SRD-2-2026-08-31.md`: 6 voci in
  `UNPRICED_AMOUNT`, 13 in `UNPRICED_LANE`, 32 in `SITUATIONAL`; lo sweep
  percorre 12 collezioni su 16; gli undici sottosistemi delle Supplemental
  Campaign Mechanics che nulla legge; `srdIndex` che non indicizza livello né
  modulo per le armi; `Item.roll` chiamato d100 quando è 1..60.
- L'ondata `wf_dc7af188-94f` è chiusa: 5 agenti, 5 risultati, 0 errori. Journal
  e transcript sono in `~/.claude/projects/…/subagents/workflows/`, **fuori**
  dagli scratchpad, e sopravvivono a qualunque pulizia.

---

## 6. Cosa è stato costruito, e dove guardare

Tre PR, unite in quest'ordine perché la prima tocca `shared/types.ts` e l'ultima il dataset.

**Il formato nuovo.** L'header allargato — escape `0x0f` nel nibble basso del byte 0,
versione nel byte 1, crc32 ai byte 2-5 — con `NARROW_CODEC_VERSIONS = [1, 2, 4, 8]` e
`WIDE_CODEC_VERSIONS = [9]`. Dentro ci sono `Character.favor`, lo **scambio dello Step Four**
del level-up (la metà che il libro concede al folio 53 e che l'app non faceva) e la **✕ sulle
carte di dominio**, che prima non si potevano restituire: `acquire` aveva tre rami e nessuno
riduceva la proprietà.

**Il wizard dice invece di imporre.** Era la contraddizione più vecchia del progetto: il
foglio si rifiutava di imporre con una motivazione scritta nel suo docblock, il wizard
imponeva. Ora il wizard segue il foglio — via il blocco sullo slot secondario, via la
cancellazione silenziosa dell'off-hand — e la frase che dice è **vera**, perché consulta
`hasCombatTraining`: un Warrior ignora il burden, e per lui quella riga non compare affatto.

**Il capitolo che l'app applicava senza spedirlo.** I folii 55-83 non entravano nel dataset:
un'isola del parser chiudeva a `Equipment` e la successiva ripartiva da `GOLD`. Otto capitoli
nuovi, `rules` da 69→77 e 74→82. E il libro, una volta dentro, ha **cambiato una decisione**:
sull'ingombro si ferma al numero, sul tier spende un verbo — *«You can't equip weapons or
armor with a higher tier than you»* — quindi l'app segue quella grammatica invece di
sceglierne una propria. Il tier **rifiuta**, il burden **dice**.

### Dove sono le stringhe nel bundle pubblicato

**È la trappola in cui sono cascato verificando il deploy.** Le stringhe di `gear.ts` — la
nota sulle mani, il `kept; you cannot equip it again until level`, il `The book lists` —
finiscono nel chunk **`Fold-*.js`**, **non** in `Build-*.js`. Cercarle in `Build-*` dà
«assente» e fa concludere che il deploy sia rotto. Nel chunk `Build-*` ci sono invece
l'armamento delle stance (`tap again to confirm`, `no picker to put it back`); nel
`levelUp-*` lo scambio; nel `srd-*` il dataset.

E: **un hash di chunk diverso non è una prova di divergenza.** Il `Fold` locale e quello
servito avevano hash diversi e stessa dimensione; differivano per **sette caratteri**, il
solo nome del chunk d'ingresso dentro l'`import`, perché la build incorpora lo SHA del
commit. I tree git combaciavano. Guarda i byte prima di gridare.

### Il debito che questo lavoro lascia

- **`favor` non ha ancora una schermata** al momento in cui questo documento è unito: il
  campo è immagazzinato, migrato, guardato e trasportato, e nessuno lo mostra. È il lavoro
  della §1 punti 2-5, e **non dovrà bumpare il formato**.
- Le **otto sezioni nuove** del dataset non compaiono sotto nessun chip di ShowSheet: serve
  un terzo ballottaggio dei momenti. Lo stato `UNRATIFIED` in `tests/gm/moments.test.ts` lo
  tiene visibile invece di lasciarlo silenzioso.
- La **seconda metà di Combat Training** (+livello al tiro di danno fisico) resta testo:
  aprire il canale dei bonus al tiro renderebbe candidati i 79 testi del dataset che dicono
  «damage roll», ed è una decisione di perimetro.
- *«They can't equip armor while in danger or under pressure»* è **deliberatamente non
  implementata**: è uno stato di gioco, e nessun campo di nessuna scheda dice se sei in
  pericolo. Un test lo asserisce, così non è una dimenticanza che nessuno ha scritto.

---

## 7. Le tre segnalazioni che hanno fatto partire tutto

Un tester ha segnalato tre cose. **Erano tutte e tre vere, e nessuna per il motivo che
credeva** — il che è la ragione per cui vale la pena scriverle qui.

1. *«Ho preso una carta per sbaglio e non posso toglierla.»* Vero in due posti diversi con
   due cause diverse: su Gioco una carta di dominio presa era presa per sempre; nella
   creazione l'arma e l'armatura si potevano solo *sostituire*, perché il gesto per
   svuotarle esisteva ma era sepolto dentro il pannello di scelta.
2. *«Le armi a due mani possono essere tenute a una mano.»* La meccanica è un'altra — il
   Warrior **ignora l'ingombro**, non impugna diversamente — ma il difetto che vedeva era
   reale e l'app gli stava impedendo una mossa legittima.
3. *«Mi segnala errore perché ho preso una off-hand, ma non è così.»* Il messaggio si
   accendeva senza mai guardare se un'arma secondaria ci fosse davvero.

E tre difetti che il tester **non** ha segnalato, trovati misurando: l'app vietava a parole e
contava nei numeri (uno scudo insieme a un'arma a due mani dava comunque i suoi punti
armatura); la casella secondaria accettava qualunque arma, spadone compreso, senza dire
niente; e la definizione di «ingombro» non era in nessuna schermata perché il capitolo non
era mai stato ingerito.

**La forma che si ripete, ed è la lezione:** una segnalazione può essere giusta nel sintomo
e sbagliata nella causa. Va creduta sul sintomo e verificata sulla causa.
