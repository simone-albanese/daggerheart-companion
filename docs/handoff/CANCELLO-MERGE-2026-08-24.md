# Il cancello prima del merge — `beast-sheets`, 24 agosto 2026

> Esegue i punti **1–6** di `HANDOFF-beast-sheets-2026-08-24.md` §7. Il punto **7** — la
> decisione su cosa fare del branch — **non è stato preso**: è del proprietario, e ora ha
> sotto le prove che gli mancavano.
>
> `main` è ancora `f0c23f1` / `0.5.0`. Il branch **non è unito e non è pushato**.
> Conta i commit con `git rev-list --count main..HEAD` — non fidarti di un numero scritto.

---

## 0. Dove sta la verità adesso

- **Cancelli**: 134 file / **3281** test verdi, `tsc --noEmit` pulito, `npm run build` verde,
  tutto sotto Node **v24.19.0** via `. ./env.sh`.
- **Ma i cancelli verdi non sono la verifica** — è la frase che il handoff precedente ha dovuto
  correggere, e resta vera. Quello che è cambiato è che **le due regole di punta ora sono
  trattenute**: invertire `Play.tsx:248` o `:261` fa diventare rosso qualcosa. Misurato,
  invertendole davvero, prima di committare.
- **Le nove prove per mutazione di `VERIFICA-BRANCH-2026-08-23.md` §38 sono state eseguite**,
  una alla volta, in una copia isolata dell'albero, col mutante verificato presente prima e
  dopo ogni esecuzione. §4 qui sotto ha i colori. **Sette su nove hanno dato il colore
  previsto; due l'hanno cambiato perché il difetto sotto è stato chiuso.**

---

## 1. I sei punti del cancello, e cosa ognuno ha effettivamente cambiato

| # | commit | |
|---|---|---|
| 1 | `924937b` | Le due regole di punta trattenute, più i cinque test vacui e due asserzioni fragili |
| 2 | `d7393b6` | La regressione di stampa disfatta: la casella torna su tutte e otto le opzioni |
| 3 | `c19dc3b` | I due crash vivi chiusi: la coercizione di `damageType` e la clausola di `checkShapes` |
| 4 | `93a5b3a` | Il tratto Beastform che segue la forma, e la dichiarazione che non sopravvive al DROP |
| 5 | `c715538` | Il debito `.md` e di fixture del bump 4→5, più otto affermazioni false e i numeri scritti in lettere |
| 6 | — | Le nove prove per mutazione. Nessun commit: sono misure, e stanno in §4 |

### 1.1 Cosa non teneva, e cosa tiene adesso

**Sette** asserzioni sono state rifatte, non cinque. Le cinque provate vacue dalla verifica,
più due che erano *dipendenti dal valore* nel modo esatto che l'audit del branch condannava:

- **Il tratto del Beastform** si leggeva dalla riga di `Equipped`, che stampa
  `form.attack.trait` per conto suo: la riga era d'accordo con la forma qualunque cosa
  facesse `arm`. Ora si legge dalla **barra ROLL**, che è costruita dallo stato del tiro. Il
  test si rifiuta di girare se la forma più grande del dataset arma il tratto di default.
- **Lo Spellcast del compagno** era un `text()` che cercava `SPELLCAST`, e `SpellcastLine`
  stampa quella stringa sotto il nome della classe **prima** che si armi qualcosa. Ora è
  agganciato alla scatola del tratto nel pannello del tiro.
- **`NO_EXPERIENCES`** era asserito con `toEqual([])`, che passa per un letterale fresco. Ora
  entrambi i rami sono pinnati **per identità**, che è l'unica cosa per cui la costante esiste.
- **`0 OF 8 MARKED`** è ciò che stampa anche un `8` scritto a mano. Ora è asserito contro un
  dataset il cui folio 18 porta **sette** opzioni.
- **Nessuno diceva che un compagno *scelto* fisico stampa PHY**: col solo caso `mag` e la riga
  legacy senza campo, l'intera riga si invertiva restando verde.
- **L'EVASION del compagno** era la parola nuda, che la riga del personaggio stampa una riga
  sopra. Ora porta il numero, e il test asserisce che l'Evasion del fixture è diversa.
- **`not.toMatch(/STRESS \d+\/\d+/)`** era giustificato da una frase falsa: `Pill` scrive lo
  Stress del personaggio nello stesso formato e solo lo spazio mancante teneva il pattern
  lontano. Ora è un **conteggio** su un board che porta una riga per tipo, così un ago che
  smette di pungere fallisce invece di passare ovunque.

### 1.2 I due crash, e perché erano lo stesso crash

`attack.ts` portava `companion.damageType` grezzo fino a `.toUpperCase()`, mentre cinquanta
righe sopra `sourceFromWeapon` **coercizza** il tipo di un'arma — che viene dal dataset
spedito. **I livelli di fiducia erano invertiti**: il valore che arriva dal file di uno
sconosciuto era quello che passava senza controlli.

E `checkShapes` si fermava a «`companion` è un oggetto», quindi `companion: {}` veniva
accettato e usciva identico. Ora **un animale è intero o non c'è**: tutti e nove i campi
controllati, e un file che fallisce dice quale. Ogni campo della clausola sta su
`CompanionState` da quando il compagno esiste, quindi **nessuna scheda che 0.5.0 potesse
scrivere viene rifiutata**.

> **Attenzione a cosa questo NON chiude.** Chiude ogni strada per cui arriva un
> **personaggio** — file, backup, IndexedDB, QR. Non chiude nessuna strada per cui arriva una
> **copia di party**, perché `readPartyMember` fa il cast e non passa da qui. Il docblock di
> `CompanionLine` adesso lo dice per esteso invece di affermare il contrario.

---

## 2. Il debito 4→5, pagato

`Architecture.md:461` era stato scritto dal bump precedente **apposta** perché il successivo
dovesse passare di lì: *«un elenco che deve restare di tre voci esatte, perché una quarta non
scritta da nessuna parte è il modo in cui un formato smette di essere affidabile»*. Il
meccanismo ha funzionato con un giro di ritardo. Ora §5.3 nomina tutte e quattro le perdite e
§6.1 ha il gradino 4→5 accanto al 3→4.

**La metà che non era prosa:**

- `tools/sampleCharacters.ts` faceva ogni compagno `phy` — che è anche ciò che il convertitore
  semina e ciò che il lettore QR inventa. La matrice da 3240 schede **non sapeva distinguere
  «portato esatto» da «perso e ridefault-ato»**. Metà dei compagni ora è `mag`, e aggiungere
  quella riga ha fatto diventare rosse tre asserzioni all'istante: è la misura di quanto la
  passata fosse cieca.
- `normalizeHandles` ha il suo contatore per `damageType`, e `matrix.test.ts` **asserisce la
  perdita su tutta la passata** e conta i compagni magici, così non può tornare a tacere.
- La fixture `v5` portava `damageType: "mag"` che **nessuno leggeva**. Ora è letta su entrambe
  le strade, e il test dice anche **cos'è** quella fixture: un Bardo con un compagno aggiunto a
  mano, perché `v4` è un Bardo e nessun export vero avrebbe potuto produrne uno.

**Le affermazioni false**, sei nominate dalla verifica e due trovate accanto: `COMPANION_START`
«quattro numeri» (sono sette campi); «l'unico posto in cui si guadagna una Esperienza nuova»
(Build ha un pulsante, e **non dà niente al compagno** — la frase falsa nascondeva un buco
vero, ora scritto); `experienceLines` «lo stesso numero» (è lo stesso **pavimento**, e deriva
dalla costante del *personaggio*); `SheetTrait.marked` «stampato come casella, spuntata o no»
per una casella mai spuntata; il docblock di `CompanionLine`; **quattro** citazioni di «Folio
19» per regole che stanno a folio 18, mentre `parseRules` rifiuta il 19 perché è il Ladro;
`SpellcastLine`; il prop `arming` di `CompanionPanel`.

**E i numeri scritti in lettere**, sfuggiti alla passata che aveva mosso le cifre quando il
dataset è andato 75 → 80: «seventy bullet paragraphs» (74), «seventy-five sections» in tre
posti (80), e le dimensioni nel docblock della ricerca (137.082 byte di JSON, 46.795
gzippati — **rimisurati**; i tempi accanto sono lasciati stare e marcati, perché un numero
fresco da un'altra macchina si leggerebbe come una correzione). Il censimento dei bullet è
pinnato da un test: la prossima volta diventa rosso invece di invecchiare.

`HANDOFF.md` **non è stato toccato sotto il cartello**. Quel file dice che solo il cartello è
mantenuto, quindi è il cartello a dire cosa è stantio (`SCHEMA_VERSION` 5 con due convertitori,
`package.json` 0.5.0) e a puntare ad `Architecture.md` §6.1.

---

## 3. Come sono state eseguite le prove

Copia dell'albero via `rsync` in una directory dal nome unico, `node_modules`, `.tools` e
`Manuali` come **symlink** e non copiati. Una mutazione alla volta, mai in parallelo. Per
ognuna: ripristino dalla copia pristina → applicazione → `grep` che il mutante **c'è** →
esecuzione → `grep` che il mutante **c'è ancora** → ripristino. Alla fine `diff -rq` contro la
pristina e `git status` nel repo vero: **pulito**, la directory di lavoro non è mai stata
mutata.

Baseline nella copia: 134 file / 3281 test verdi, uguale al repo.

---

## 4. Le nove prove, e cosa hanno detto

| | mutazione | colore atteso | colore misurato | cosa prova |
|---|---|---|---|---|
| **a** | `READABLE_CODEC_VERSIONS=[1,2,3]` + `BODY_AT[3]` | rosso | **ROSSO** | Il bit 0 ribaltato porta un payload formato 2 a 3, che ora si *legge*: l'errore diventa «checksum» invece di «formato sconosciuto». Il 3 rompe davvero la proprietà |
| **a′** | `[1,2,4]` + `BODY_AT[4]` | verde | **VERDE** | **4 è il numero libero.** Non dedotto: eseguito |
| **b** | fixture `v5` `mag`→`phy` | verde (inerte) | **ROSSO** | *Colore cambiato di proposito*: la fixture era decorazione, adesso è una prova |
| **c** | generatore di nuovo tutto `phy` | rosso (aggiungendo la varietà) | **ROSSO** in entrambe le direzioni | Applicata all'albero non corretto arrossò tre asserzioni; applicata all'inverso su quello corretto arrossa la guardia «nessun compagno magico nella matrice» |
| **d** | `damageType: 42` senza coercizione | rosso oggi, verde dopo | **ROSSO** senza / **VERDE** con | Il crash era vivo. Ora non lo è |
| **e** | `COMPANION_START.experiences = 3` | verde | **VERDE** | `printSheet.test.ts` resta 49/49 mentre il foglio riga **5** linee per un compagno che ne terrà **6**. Accoppiamento vivo, pinnato da niente. Non chiuso: è scritto nel docblock |
| **f** | `readPartyMember` esegue `migrateCharacterRecord` | niente arrossa | **VERDE**, suite intera | **Niente pinna il comportamento «non migra mai».** Vale in tutte e due le direzioni: il cambio è libero, e il comportamento attuale non è coperto |
| **g** | `=== null` → `== null` in `CompanionLine` | niente arrossa | **VERDE**, suite intera | Nessun test copre la forma «compagno assente». Nemmeno la guardia più sicura è pinnata |
| **h** | cancellare la promozione `listy` di `rules.ts` | `build:srd --check` fallisce | **«out of date»** | Il ciclo è trattenuto dal controllo del dataset, non da un test unitario |
| **i** | `expect(companionIsAway(...)).toBe(true)` dopo un riposo breve | rosso | **ROSSO** | **Il difetto 8 è vivo**: un riposo breve con Clear Stress riporta in scena un compagno che l'app ha appena promesso assente fino al riposo lungo |

Le due che hanno cambiato colore (**b** e **c**) l'hanno fatto perché il difetto sotto è stato
chiuso in `c715538`. Le altre sette hanno confermato la previsione di §38 eseguendo.

---

## 5. Cosa resta aperto, e perché è stato lasciato aperto

Non è arretrato scoperto adesso: è arretrato **misurato adesso**, che è diverso.

1. **Il difetto 8 (prova i) è vivo e non è stato corretto.** Un riposo breve con Clear Stress
   riporta in scena un compagno fuori scena. La verifica lo dà per il rilievo più forte del
   run — 9 verificatori su 9 — **e due di loro hanno sollevato l'obiezione che conta**: il
   folio 18 non mette eccezioni alla frase *«when you choose a downtime move that clears
   Stress on yourself, your companion clears an equal number»*, quindi rifiutare il clear
   **scambia una deviazione con un'altra**. Una correzione fedele probabilmente richiede che
   la disponibilità **smetta di essere puramente derivata** — il che falsifica
   `companion.ts:133` («non c'è un secondo modo di essere fuori scena») e ha conseguenze sul
   codec che il branch ha argomentato *contro*. **È una decisione di regole, non un bug da
   chiudere di corsa**, ed è per questo che è qui e non in §1.
2. **`readPartyMember` fa ancora il cast** (prova f). Il momento naturale resta il bump
   `CAMPAIGN_SCHEMA_VERSION` 2→3, che le decisioni 1+6+8 impongono comunque. La prova f dice
   che nessun test si mette di traverso in nessuna delle due direzioni.
3. **`CompanionLine` non obbedisce ancora al proprio docblock** (prova g). Chiuderla per bene
   vuol dire la regola larga — *niente in `src/ui/gm/` chiama un metodo su un campo di
   `PartyMember.sheet`, **né lo passa a una funzione che lo fa*** — e quella dipende da 2.
4. **`EXPERIENCE_LINES` è giusto per un compagno per coincidenza** (prova e). Deriva da
   `STARTING_EXPERIENCES`, un `2` il cui docblock parla solo del personaggio, mentre
   `COMPANION_START.experiences` è un altro `2` che nessuno legge lì.
5. **`NO_EXPERIENCES` è un array condiviso e mutabile.** *Correzione alla verifica*: non è
   esportato — `attack.ts` lo tiene privato al modulo. Esce comunque, come **valore di
   ritorno** di `experiencesFor`, quindi il pericolo (un chiamante che ordina o fa push sul
   posto avvelena tutti gli altri) è reale ma più stretto di come era scritto. Rimedio:
   `Object.freeze` e un tipo di ritorno `readonly`.
6. **Il test di regressione del party board usa `importParty(...)`** e quindi salta
   `readPartyMember`/`readCampaignRecord`: la classe di difetto su cui poggia il rilievo non è
   esercitata da nessuna parte. Va con 2.
7. **jsdom non misura niente.** Le sei superfici mai misurate restano sei. Il rig in Chrome
   esiste: **una lane sola, un rig solo, tutto insieme**, come dice il handoff.

---

## 6. La decisione, che non è stata presa

`main` è fermo a `f0c23f1` con 0.5.0 pubblicata: **aspettare non costa niente**. Quello che è
cambiato è che adesso la domanda si può rispondere su prove lette invece che su cancelli verdi.

Quello che il cancello dice, detto senza ammorbidirlo:

- Le due frasi per cui il branch esiste **adesso sono trattenute**, e la prova è che invertirle
  fa diventare rosso qualcosa.
- I difetti che il branch aveva **creato** — la regressione di stampa, i due crash, il tratto
  stantio — **sono chiusi**, ognuno con un test che era rosso prima.
- Il debito che il branch aveva **lasciato** — prosa, fixture, generatore — **è pagato**.
- Quello che resta aperto è, per intero, **o preesistente a questo branch, o una decisione di
  regole, o dipendente dal bump `CAMPAIGN_SCHEMA_VERSION` che va fatto comunque**. Un solo
  elemento di §5 è un difetto vivo di comportamento, ed è il **numero 1**, che è aperto perché
  correggerlo alla lettera del folio 18 scambia una deviazione con un'altra.

**Chi decide sceglie fra**: unire adesso e aprire il numero 1 come voce di regole; oppure
chiudere prima il numero 1 e unire dopo. Non fra «verde» e «non verde».
