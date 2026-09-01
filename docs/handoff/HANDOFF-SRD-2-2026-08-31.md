# Handoff — l'SRD 2 è acceso, la PR è aperta, il deploy non è stato fatto

**Le decisioni stanno in `DECISIONI-SRD-2-2026-08-31.md`.** Questo dice dove siamo, cosa è già
deciso (**non ri-chiederlo**), cosa è dichiarato come debito, e cosa NON è finito.
I commit si citano **per oggetto, mai per SHA**: il ramo si ribasa e gli hash muoiono.

---

## 0. Stato, misurato — 1 settembre 2026

Ramo `srd-2`, spinto fino a *«Bring the handoff up to a branch whose wave has
landed»*; **tre commit nuovi dopo quello**.
**PR #66 APERTA, NON UNITA.** 39 commit, 149 file, +22.236 / −1.421.

**Questi numeri sono misurati a *«Pin the tier head's bold guard, and stop the
docblock claiming what it cannot»*, e il commit di questo documento ne aggiunge
uno.** È esattamente il difetto che la versione precedente di questa sezione aveva:
diceva «27 commit, +18.116» quando erano già 28 e +18.165, perché il commit che
scriveva la frase la rendeva falsa. Un numero qui va riletto, mai ricopiato.

```
npx tsc --noEmit                              0 errori
npx vitest run                                186 file / 4617 test
npm run build:srd -- --check                  data/srd-2.0.json matches the source.
npm run build:srd -- --check --pdf <SRD 1>    data/srd-1.0.json matches the source.
npm run build:registry -- --check             1368 id, 9 conservati, zero numeri spostati
CI sulla PR                                   verde sulla run 33476768085, sul commit
                                              esatto del ramo. (La consegna precedente
                                              citava 33463548440, che era verde ma su un
                                              commit più vecchio.) Dopo gli ultimi tre
                                              commit va rilanciata.
```

Il PDF dell'SRD 1 è `Manuali/Daggerheart-SRD-9-09-25.pdf` — non c'è nessun file
con «srd» e «1» nel nome, e cercarlo così non trova nulla.

**UNIRE È IL DEPLOY**: `deploy.yml` parte su ogni push a `main`. Il proprietario
non ha dato il via. **Spingere il ramo aggiorna la PR e NON è il deploy.**

### Cosa pubblica l'app

`data/srd-2.0.json`: domini 10, carte 210, classi 13, sottoclassi 26,
beastform 22, stirpi 24, comunità 15, trasformazioni 6, **stance 16**, armi 391,
armature 85, bottino 120, consumabili 120, avversari 264, ambienti 47, regole 69.
Sedici collezioni di contenuto.

**`SCHEMA_VERSION` 8, `CODEC_VERSION` 8**, `READABLE_CODEC_VERSIONS` [1, 2, 4, 8],
registro v2, 1368 id.

> Attenzione a come si leggono quelle due costanti. `grep CODEC_VERSION` trova
> per prima una frase in un docblock che dice `CODEC_VERSION = 3`: è prosa, non
> il valore. Leggerle a runtime, o cercare `^export const`.

`data/srd-1.0.json` **resta committato e resta controllato**. Con le stance
guadagna una chiave `stances: []` e nient'altro: **nessun record si è mosso**, e
`--check --pdf <SRD 1>` continua a dire che corrisponde alla sorgente.

---

## 1. L'ondata è ATTERRATA e integrata

`wf_dc7af188-94f`, corsie **pricing** e **stances**, entrambe consegnate,
integrate, verdi e committate. Non c'è nulla in volo.

**Come si è capito che era viva**, perché la prossima volta conterà: i
transcript degli agenti **ritardano di minuti** — quello di `pricing` era fermo
alle 07:20:15 mentre la corsia consegnava alle 07:26:28. Il segnale onesto è
**il mtime della cartella della corsia**.

> **Correzione a una frase che avevo scritto qui.** Avevo scritto che il journal
> «conteneva due righe `started` e nessun `result` dall'inizio alla fine».
> **È falso, e l'errore era mio: l'avevo letto troppo presto.** Alle 08:16 quel
> file aveva **sette** righe — due `started`, due `result`, e poi altri due
> `started` con i loro `result`. Il journal è una fonte **lenta**, non muta: non
> dice mai «ancora niente», dice «niente ANCORA». Rileggerlo, non dedurne la
> morte.

**Due trappole, entrambe scattate:**

1. **Una corsia consegna più di una volta.** `pricing` ha consegnato alle
   07:26:28 e di nuovo alle 07:32:21. La prima consegna è stata integrata, ed
   era quella sbagliata: la seconda aveva **ri-contato sé stessa** (238 → 265
   siti, «un arretrato di undici» → tredici bonus statici) e **cancellato** una
   frase che diceva che lo sweep leggeva otto collezioni su quindici **da un
   anno** — il primo commit del repository è del 15 agosto 2026 e quel file è
   nato il 23: nove giorni. Verificare che una consegna sia **ferma** prima di
   integrarla.
2. **Una corsia può ri-copiarsi dall'albero di riferimento.** `stances` si è
   ri-sincronizzata alle 07:52 e si è portata dentro i cinque commit già fatti
   in questa sessione, quindi la sua consegna **conteneva già** quel lavoro. Un
   merge a tre vie non è servito, ma solo perché è stato **misurato** prima:
   28 file consegnati, 28 percorsi differenti fra corsia e HEAD, zero collisioni.

### L'ondata aveva una FASE DI VERIFICA, e ha trovato cose vere

Dopo le due corsie sono partiti **altri due agenti**, uno per corsia, che hanno
ricostruito l'albero da `git archive` sulla base giusta e rifatto le misure con
sonde proprie. Verdetto di entrambi: **CONFIRMED_WITH_DEFECTS**. Trenta
affermazioni delle corsie messe alla prova, **ventisette reggono**; le tre che
non reggono sono un conteggio già corretto qui, e due istruzioni di consegna che
puntano nella direzione sbagliata.

**Due difetti erano numeri veri su una scheda, e sono riparati:**

1. **Spidersilk Tunic** (armatura tier 2, folio 72), *Wall-Crawling*: **«+1
   Evasion»**. Nessun `to`, nessun `bonus`: la cifra attaccata alla statistica.
   È la **terza** grafia che il libro usa e questo file ne conosceva due. Non
   prezzata: chi la indossava leggeva **un'Evasione in meno** di quella che il
   libro gli dà. Ora è una riga di registro, provata sulla scheda contro
   `improved-leather-armor` — stesso tier, stesso Armor Score, stesse soglie,
   **nessuna feature** — 12 → 13.
2. **Untouchable** (carta Bone 1): «Gain a bonus to your Evasion equal to **half**
   your Agility». Stessa forma di `fortified-armor` e `armorer`, che erano state
   prese; passata per una parola. Dichiarata in `UNPRICED_AMOUNT`: dimezzare è
   una **quinta** quantità e `Amount` ne sa nominare quattro.

**E il buco che le aveva lasciate passare è chiuso.** `MUST_FLAG` inchiodava le
GRAFIE e non le STATISTICHE: si potevano cancellare cinque tratti
dall'alternanza con la suite tutta verde, accecando la scansione su **22 siti
veri**. Ora c'è una voce per ogni membro dell'alternanza, ogni frase letta dal
dataset e non inventata. Provato: quella cancellazione è rossa, rimettere `to`
obbligatorio è rosso, togliere `half|twice` è rosso.

**Un terzo difetto, sulla corsia stances:** la guardia `isBoldSans` di `tierOf`
si poteva togliere **del tutto** lasciando 4615 test verdi. Ora è inchiodata
dal caso raggiungibile (una riga *chiara* che legge `TIER 2`). Il caso *display*
invece **non è testabile**, ed è un ramo irraggiungibile: il taglio della coda
toglie ogni riga display prima che `tierOf` la veda. Il docblock che sosteneva
il contrario è stato corretto.

---

## 2. Le decisioni del proprietario. NON RI-CHIEDERLE.

Prese il 31 agosto e il 1 settembre 2026.

1. **Le 9 armi tolte dall'SRD 2 SPARISCONO.** Non tenute, non marcate eredità, **non rimappate**.
   La prova che il documento diceva mancante è stata cercata e **non esiste**: 0 provate,
   1 plausibile, 8 senza erede. Vedi §5.
2. **Una perdita deve VEDERSI.** Costruito: l'arma sparita si annuncia su Gioco, in Modifica e
   sulla pagina stampata, come già faceva un'armatura.
3. **Superficie UI completa prima dell'accensione.** Fatto.
4. **Un personaggio può TENERE una trasformazione**, aggiunta dalla scheda, **non** dalla creazione.
5. **Mostrata, non applicata**: non muove Evasione, Soglie o Stress. C'è un test che lo prova.
6. **Viaggia sul filo.** Non farlo ripeterebbe il difetto già registrato per il dominio Dread.
7. **La striscia dei domini va misurata, non dedotta.** Fatto.
8. **Witherwild e i campaign frame restano FUORI, e la ragione è LEGALE.** Ora scritto nel codice
   (`shared/parsers/rules.ts`): il folio 1 del libro dice che Witherwild **È** Public Game Content,
   quindi senza quella frase il prossimo lettore lo legge come un difetto e prova a «ripararlo».
9. **`--Forest Sprites` si pubblica come stampato.** È un refuso del libro (folio 220), reso fedele.
10. **Martial Stances: sviluppare adesso.** FATTO — 16 stance, §1.
11. **I dieci bonus: prezzarli prima di unire.** FATTO per sei, §4.
12. **Il `Revolver` resta quattro record** (uno per livello), non uno con la scala dentro.

---

## 3. La licenza: era un blocco, è sciolto

L'app spediva la DPCGL del 30 luglio 2025, il cui §1.6 elenca come Public Game Content **solo
l'SRD 1.0**. L'app pubblica il 2.0.

**Esiste la DPCGL 2.0**, pubblicata il **26 agosto 2026** — il giorno dopo il libro. Scaricata,
estratta con `pdftotext -layout`, letta. Il suo §1.6 nomina **«Daggerheart System Reference
Document 2.0 (including Domain icons) and Candela Obscura»** e aggiunge che l'SRD 1.0 resta Public
Game Content per i contenuti legacy. Il modello di attribuzione del §4 è **identico al precedente
tranne il numero di versione**.

Spedita al posto di quella vecchia, con l'hash fissato in `tests/ui/licences.test.tsx`, la
citazione in `LICENSE` e la frase di provenienza in `About` mosse **insieme**, come il commento di
quel test esige. Il PDF stampa «Last Updated 8/05/2026» mentre l'indice dell'editore e il nome del
file dicono 26 agosto: **tre settimane di scarto, registrate entrambe** in `LICENSE`.

---

## 4. Debito DICHIARATO, non nascosto

- **Dieci bonus il cui importo era una parola: sei sono prezzati.** `Amount` è
  passato da `number | 'proficiency'` a `number | DynamicAmount`, e
  `collectModifiers` riceve tier e tratto Spellcast. **`mage-robes` è fra quelli
  chiusi**, ed era il caso che pesava: armatura iniziale di livello 1.
  Restano dichiarati e non prezzati: **6** in `UNPRICED_AMOUNT` (le quattro
  coffinwood, `domainCard|eldritch-flesh` e `domainCard|untouchable`), **13** in `UNPRICED_LANE`, **32** in
  `SITUATIONAL`.
- **`everySite()` percorre 12 collezioni su 16** (erano 8 su 15). Non percorse:
  `domains`, `adversaries`, `environments`, `rules`. 1102 siti.
- **Il registro non conosce le stance.** `src/engine/modifiers.ts` non è stato
  toccato dalla corsia: le stance si **mostrano e non si applicano**, come le
  trasformazioni. Le due che stampano un bonus statico — `anchored` (+2 alle
  soglie) e `aggressive` (−1 all'Evasione) — sono in `SITUATIONAL`, e la ragione
  NON è la corsia mancante: è che sono legate all'**essere in** una stance, e
  `shared/types.ts` rifiuta per iscritto un `activeStanceRef`.
- **Supplemental Campaign Mechanics, folio 190 e 193-205**: undici sottosistemi,
  **82.876 caratteri** che nulla legge — mentre l'app pubblica **92 pezzi
  d'equipaggiamento** timbrati con i nomi di quelle campagne.
- **`srdIndex.ts` non indicizza né LIVELLO né MODULO per le armi.** 11 nomi
  coprono 44 record: cercare «Blessed Brass Knuckles» dà quattro righe identiche
  tranne il dado.
- **`shared/types.ts` chiama `Item.roll` un d100.** È 1..60, in entrambi i libri.
- **Prosa stantia altrove**: `HANDOFF.md` dice `SCHEMA_VERSION` 5 e
  `CODEC_VERSION` 2 — sono 8 e 8. 42 menzioni di `srd-1.0` in 21 file.
  **Rimisurare o marcare, mai `sed`.**

---

## 5. Cosa perde un personaggio già salvato

3333 schede costruite sull'SRD 1 e risolte contro l'SRD 2: **59.256 riferimenti percorsi**.

```
classi 0 · sottoclassi 0 · stirpi 0 · comunità 0 · carte 0 · beastform 0
armature 0 · bottino 0 · consumabili 0 · avversari 0 · ambienti 0 · armi 9
```

**186 schede su 3333** ne tengono una, sempre nello slot primario. Delle 840 voci stampate da
entrambi i libri, 667 identiche e 173 con un campo cambiato — **nessuno è un numero**. Nessuna
classe cambia i Punti Ferita iniziali. Una sola carta, *Notorious*, perde una frase che l'SRD 2 non
stampa più.

**Perché non si rimappa.** Il documento diceva che l'SRD 2 aveva sostituito le nove con «famiglie
scalate: Shadowblade, Bloodstaff, Wand of Essek». **Due di quei tre erano già nell'SRD 1**, folio
51, due pagine dopo le nove, con le stesse capacità. Una ricerca per etichetta di capacità li trova
— ed è esattamente per questo che **non è una prova**. E 195 armi su 195 sopravvissute sono
identiche campo per campo: «rinominata e riscalata» non ha un precedente nel libro.

---

## 6. I quattro buchi nella prova sono CHIUSI

Ognuno lasciava verde l'intera suite, e ognuno è stato **provato per mutazione**:
il mutante uccide solo il suo test, e nient'altro nella suite si muove.

- `codec.ts` — i due controlli di collezione, l'intera difesa della collisione
  `vampire`. **Erano entrambi nudi**: togliendone uno, 185 file / 4557 test
  restavano verdi. Ora un test per porta.
  Il test che *sembrava* coprirli — «refuses to guess when the id in the slot
  belongs to another collection» — **non li copre**: passa un id che il registro
  non possiede affatto, quindi `keyOf` risponde `null` e il controllo non viene
  mai consultato. Il nome prometteva la guardia, il corpo provava il ramo
  «id assente».
- `GearPicker.tsx` 1249/1430 — il controllo dei moduli riceve la collezione
  intera. **Non era un difetto vivo**, era una porta senza serratura: ricablarlo
  sulle righe già filtrate lo rende a senso unico. Due test, uno per call site.
- `gear.ts` `origin()` — chiuso con `typeof s === 'string'`. **La consegna
  descriveva male metà del difetto**: `join` rende `undefined` come stringa
  vuota, quindi il timbro non stampa mai la parola «undefined» — stampa un
  separatore a vuoto, ` · X`. La metà con i denti era la ricerca, che lancia.
  **L'ago conta**: `matches` è `search === '' || prose.some(...) || labels.some(...)`,
  quindi un ago che il nome soddisfa fa corto circuito e il test passa sul codice
  rotto.
- `holdings.ts` — quel file ha **due** `ref !== ''`, non uno. Quello in
  `characterRefs` **era già coperto** (toglierlo fa fallire due test). Solo
  quello in `unresolvedWeapons` era nudo, e costa caro: senza, uno slot **vuoto**
  viene riportato come arma che questa build non sa nominare, e Gioco e Modifica
  disegnano l'insegna sopra il nulla.

---

## 7. Le regole macchina

- **`. ./env.sh >/dev/null 2>&1 && node -v` → deve dire v24. MAI `. ./env.sh | head`**: la pipe crea
  una subshell e lascia Node **26** sul PATH del padre. Il banner mente, e Node 26 nasconde
  `localStorage` a jsdom: una suite verde in locale è **più debole** di quella di CI.
- Una probe **deve stare nella radice dell'albero**, o `tsx` risponde *«Top-level await ... cjs»*.
  E va cancellata: una probe lasciata nell'albero è un incidente già successo qui.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- Chi muta lavora in una copia `rsync` **senza `.git`**, mai nel worktree condiviso.
- **Mai la porta 5199**: è la campagna vera del proprietario.
- **Una PR può risultare pulita senza che alcun controllo sia girato.** Verificare che una run
  esista, prima di unire.
- **CI non estrae mai il dataset**: il passo è dietro una sonda sul PDF che nessun runner soddisfa.
  Nascondendo `Manuali/`, 78 test su 226 in `tests/tools` si saltano. **Un test nuovo che non ha
  bisogno del PDF vale più di tre che ce l'hanno.**

---

## 8. Le due cose che ho sbagliato a dire, perché non si ripetano

1. **«Il riferimento non risolto è visibile, quindi non si perde in silenzio.»** Vero per le
   armature, **falso per le armi**: un'arma sparita non lasciava traccia da nessuna parte, e l'unico
   segno era un contatore che scendeva di uno. Due decisioni del proprietario poggiavano su quella
   frase e sono state riprese. Il segno ora esiste.
2. **Ogni cifra che questo repository diceva di sé è stata sbagliata più spesso che giusta.** E una
   volta la **correzione di un revisore era sbagliata a sua volta**, perché aveva ri-implementato un
   ramo invece di strumentare il ciclo: la risposta vera era nove pagine per libro, non otto, e per
   due rami diversi. **Ri-implementare non è strumentare.**

---

## 9. Quello che ha sbagliato QUESTA sessione, misurato

Tre errori miei, tutti scoperti dalla misura e non dal ragionamento. Sono qui
perché la forma si ripete.

1. **Ho integrato la prima consegna di una corsia ancora viva.** Avevo perfino
   controllato che corsia e albero coincidessero — sei minuti prima che la
   corsia riscrivesse il file. Un controllo di coincidenza non è un controllo di
   **quiete**: la consegna va vista ferma, e la corsia zitta, prima di toccarla.
2. **Il mio primo test passava sul codice rotto.** Cercavo il crash di
   `origin()` con l'ago `'a'`, che «Sky Anchor» soddisfa: `matches` fa corto
   circuito sulla prosa e non arriva mai alle etichette. Un test che non ha
   **fallito prima** della riparazione non ha provato niente.
3. **Ho detto la collezione giusta e il record sbagliato.** Avevo annunciato che
   le stance sfuggite allo sweep fossero `anchored` e `favored`; misurando con le
   `STATIC_SHAPES` vere sono `anchored` e `aggressive`. `favored` dice «equal to
   a trait of your choice» sui **tiri di danno**, che il registro non modella.
   Avevo indovinato la forma della regex invece di eseguirla.

4. **Ho dichiarato l'ondata finita mentre aveva una fase di verifica in corso**,
   e ho scritto in §1 che il journal non aveva mai prodotto una riga `result`.
   Falso: ne aveva quattro, più due `started` che non avevo visto. Avevo letto
   il file una volta sola, presto, e trattato quella lettura come definitiva.
   Un journal vuoto non dice «niente»: dice «niente ANCORA».

E una quinta, che non era mia ma va detta perché è la stessa forma: la corsia
`pricing` ha **corretto sé stessa** fra la prima e la seconda consegna, su
numeri che aveva scritto lei. Una consegna non è una fonte più affidabile di un
documento: si rilegge.

**La verifica ha ripagato il suo costo.** Due numeri sbagliati su una scheda vera
(§1), trovati non rileggendo le corsie ma **costruendo una scansione diversa** e
guardando cosa segnalava che le corsie non spiegavano. Rileggere il lavoro di
qualcun altro con i suoi stessi strumenti non è verificarlo.
