# Il cancello prima del merge — `beast-sheets`, 24 agosto 2026

> Esegue **tutto** il §7 di `HANDOFF-beast-sheets-2026-08-24.md`: i punti 1-6 e le nove prove
> per mutazione (§1-§6 qui sotto), e poi il punto 7 — le due decisioni del proprietario, in §7.
> **§8 è il briefing per quello che viene dopo.**
>
> ~~`main` è ancora `f0c23f1`. Il branch è **pushato** e sta su **PR #1**, aperta e verde; non è
> unito.~~ **Superato il 24 agosto: PR #1 è UNITA (`a115f2d`) e 0.6.0 è pubblicata.** Erano 31
> commit, non 30 come diceva `RIPRESA`. Conta i commit con `git rev-list --count main..HEAD` —
> non fidarti di un numero scritto, che è la regola che questo file ha già dovuto imparare due
> volte.
>
> **§6 è la fotografia del momento in cui la decisione era ancora aperta**, e resta com'era
> scritta perché è l'argomento su cui è stata presa. §7 dice come è andata.

---

## 0. Dove sta la verità adesso

- **Cancelli**: 134 file / **3283** test verdi, `tsc --noEmit` pulito, `npm run build` verde,
  tutto sotto Node **v24.19.0** via `. ./env.sh`. *(3281 al momento in cui §1-§6 sono stati
  scritti; i due in più sono i test del difetto 8, §7 punto 1.)*
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

1. ~~**Il difetto 8 (prova i) è vivo.**~~ **CHIUSO il 24 agosto** — decisione del proprietario,
   opzione A: guardia in testa a `alsoTheCompanion`, `86dad3c`. Il compagno fuori scena non
   viene più ripulito da un riposo breve. **È una deviazione dichiarata, non l'applicazione
   della regola**: il folio 18 non mette eccezioni a *«your companion clears an equal
   number»*, e la frase che vince — *«they remain unavailable until the start of your next
   long rest, where they return with 1 Stress cleared»* — vince perché è la più specifica e
   perché nomina il proprio meccanismo di rientro. Scritta nel docblock, nel CHANGELOG e qui.
   Il riposo **lungo** non è toccato: il rientro gira prima delle mosse, e adesso c'è un test
   anche per quello. **La versione fedele resta aperta** e costa uno schema: un campo `away`
   esplicito su `CompanionState`, cioè `SCHEMA_VERSION` 5→6 più una decisione sul codec, e
   falsifica `companion.ts` («non c'è un secondo modo di essere fuori scena»). Va con il
   prossimo passo che muove lo schema dei personaggi.
   *(Due test pinnavano il comportamento sbagliato: costruivano il compagno a 3 di 3, che è
   già fuori scena, e poi asserivano che un riposo breve gli svuotasse la traccia.)*
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

## 6. La decisione, com'era quando era ancora da prendere

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

---

## 7. Cosa è stato deciso, il 24 agosto

Il proprietario ha scelto **A** sul difetto 8 (`86dad3c`) e **push del branch + PR** sul merge.
Quindi, in ordine e già fatti:

1. **Difetto 8 chiuso** con la guardia, come deviazione dichiarata — §5 punto 1 qui sopra.
2. **`CHANGELOG.md` e la versione** (`6e71200`). Tredici commit di funzionalità erano senza una
   riga di changelog e `package.json` diceva ancora `0.5.0` — **una versione che i compagni non
   li aveva**, e quel numero è timbrato dentro ogni `.dhchar` e `.dhbackup`. Ora è **0.6.0**,
   con `APP_VERSION` mosso insieme (la suite lo controlla già, ed è diventata rossa per prima).
   Le sezioni rilasciate non sono state toccate.
3. **Push del branch e PR.** `deploy.yml` gira **solo** su push a `main`: pushare
   `beast-sheets` **non pubblica niente**. `ci.yml` gira su `pull_request`, quindi la PR
   esegue i cancelli su Node `.nvmrc` = 24, che è lo stesso major usato qui.

**PR #1** — https://github.com/simone-albanese/daggerheart-companion/pull/1 — aperta,
`MERGEABLE`, `CLEAN`, **CI verde in 2m6s** su Node `.nvmrc` = 24. Base `main` = `f0c23f1`, che è
esattamente il commit da cui il branch è stato tagliato: `origin/main == main`.

~~Resta non fatto, e resta del proprietario: **unire la PR**, e poi **pushare `main`** — che è
il momento in cui 0.6.0 viene davvero pubblicata.~~

**Fatto il 24 agosto, e la seconda metà di quella frase era sbagliata.** PR #1 è unita in
`a115f2d` e **0.6.0 è pubblicata** — deploy `32713871427`, `success`.

*Correzione al meccanismo, misurata invece che dedotta.* Non è il push di `main` a pubblicare:
**è il merge**. `gh pr merge` scrive il commit di merge su `main` lato GitHub, e quello *è* un
push event, quindi `deploy.yml` parte lì. Merge alle 09:52:44, deploy partito alle 09:52:47 sul
commit di merge, e il `git push origin main` eseguito subito dopo ha risposto `Everything
up-to-date` perché non restava niente da spingere. La metà che resta vera, e che vale ancora
per ogni branch futuro: pushare un branch che non sia `main` non pubblica niente, ed è il motivo
per cui PR #2 e PR #3 possono stare aperte e verdi senza pubblicare.

**Conseguenza pratica per chi legge questo file dopo:** non esiste un ordine dei gesti che
unisca senza pubblicare. Se un merge non deve pubblicare, va deciso **prima** — tenendo la PR
chiusa, o mettendo un cancello su `deploy.yml`.

---

## 8. Il briefing per il prossimo passo — A e B

> **ESEGUITO il 24 agosto.** **A** sta su **PR #2** (`legal-and-backlog`), **B** su **PR #3**
> (`witherwild-out`); entrambe verdi, `MERGEABLE`/`CLEAN`, e unirle resta del proprietario —
> ricordando, adesso che si sa, che ogni merge pubblica.
>
> Il briefing qui sotto è lasciato **com'era scritto**, perché è l'argomento su cui il lavoro è
> stato fatto e perché le sue misure si sono rivelate esatte. Tre cose che ha sbagliato, per nome:
>
> - **I posti da muovere erano sette, non sei.** La tabella di §8 ne elenca sei. `RuleSearch.tsx`
>   ne porta altri due che nessun test avrebbe preso: la misura *«il più alto è 82.6»* aveva come
>   soggetto **proprio** `The Witherwild: Campaign Mechanics`, e *«`adversary` ne trova
>   ventidue»* adesso ne trova **venti**.
> - **§2.5(a) è più stretto di come la rinomina è descritta qui e in `DECISIONI` §5.** Non
>   «un titolo che non si apre col Name Mark»: *«Name Marks cannot be used in the title of a
>   work»*, punto. Il marchio esce dal titolo del tutto. L'app è **Duality Companion**.
> - **Manca la trappola più cara della rinomina:** `DB_NAME` vale `'daggerheart-companion'` in
>   **due** posti (`store/db.ts` e `index.html`) e **non va mosso**. IndexedDB è per origine, non
>   per percorso: le schede sopravvivono a una rinomina solo finché quella costante non la segue.
>
> E una cosa che il briefing non poteva sapere: **§4.1(e) della DPCGL non è rispettato** —
> nessuna superficie dell'app dichiara che il contenuto è modificato, mentre (a)–(d) ci sono
> tutte. Aperta in `BACKLOG.md`, non chiusa in corsa.

Dopo il merge e il push si parte da **A** e **B**. Sono indipendenti fra loro. Quello che segue
esiste per non farli riderivare.

### A1 — La sezione Legal del README *(1-2 h)*

`DECISIONI-2026-08-23.md` §3. È l'unica decisione senza codice, senza dataset e senza schema.
La lettura accettata è §2.1(a) DPCGL — *«reproduce and Share the Public Game Content in whole or
in part»*, senza limiti di formato dichiarati.

**L'obiezione va scritta, non omessa**: è il punto della decisione. Metà dell'app è Adaptive
Content ai sensi di §1.7 — il dataset è il PDF *riordinato*, `deriveStats` *trasforma* — §2.1(b)
consente l'Adaptive Content **solo nei Permitted Formats**, e §1.9 elenca stampa, streaming,
podcast e VTT, chiudendo con l'esclusione di *«any other audiovisual medium not expressly
permitted»*. **Un'app web non è in quell'elenco.** §1.9.1 nomina il rimedio: approvazione scritta
di DRP. La sezione dichiara la lettura **e** il rischio accettato.

### A2 — Il passaggio su `BACKLOG.md`, in un commit solo *(90 min)*

**Usa gli undici blocchi già scritti** in `RECUPERO-JOURNAL-2026-08-24.md` §1 invece di
riderivarli. Contati riga per riga, sono: **cinque spunte** (`:651`, `:975`, `:686`, `:654`,
`:751`), **uno split già chiuso** (`:2459`), **un reword** (`:2840`), e **quattro che restano
aperte** — `:646`, `:2462`, `:2467` e `:1653`.

Le trappole, tutte già pagate una volta:

- **`:1653` va spezzata, non spuntata.** `AppBoundary.tsx:60-62` porta ancora il difetto identico.
- **`:2117` va riscritta, non spuntata.** La decisione 8 la **supera esplicitamente**.
- **`:3136` è chiusa sulla carta e non nel file.** `:3136` e `:3140` sono ancora `- [ ]` sotto
  *«Still open»*, e `:3138` dice ancora «ask Giorgio».
- **Niente si spunta su un «probabilmente».**

Nello stesso commit vanno **aperte** le voci nuove di questa sessione, che sono §5 qui sopra:
il cast di `readPartyMember`; `CompanionLine` che non obbedisce al proprio docblock;
`EXPERIENCE_LINES` giusto per coincidenza; `NO_EXPERIENCES` da congelare (`Object.freeze` e tipo
di ritorno `readonly`); il test del party board che passa da `importParty` e quindi salta il
lettore; il campo `away` esplicito, che è la versione fedele del difetto 8 e costa uno schema;
le sei superfici mai misurate.

### B — Witherwild fuori, e la rinomina *(`DECISIONI` §4 e §5)*

**Un numero da correggere prima di cominciare.** `DECISIONI` §4 dice «12 sezioni, 28.549
caratteri». Misurato sul dataset di questo branch: **11 sezioni**, tutte con id che comincia per
`witherwild` (pagine 113-118), **27.679 caratteri di body**. La quota regge: **21,7 %**, che è
il «22 %» della decisione. Verifica tu, non fidarti di questo paragrafo più che dell'altro.

**Il raggio d'esplosione, misurato.** Togliendole, `rules` va **80 → 69**, il JSON delle regole
137.082 → **107.884 byte** (gzip 46.795 → **35.936**), i paragrafi-lista puri 74 → **64**, i
paragrafi-tabella restano **12**. Quindi si muovono, e vanno mossi insieme al dataset:

| dove | cosa dice oggi |
|---|---|
| `src/ui/shared/srdReference.ts` (docblock di `blockParts`) | «seventy-four bullet paragraphs» → 64 |
| `src/ui/shared/srdReference.ts` (docblock della ricerca) | «eighty sections», 137.082 byte, 46.795 gzip |
| `src/ui/gm/ReferenceTables.tsx` | «all eighty sections» |
| `src/ui/gm/RuleSearch.tsx` | «eighty in the shipped SRD» |
| `tests/gm/ruleSearch.test.tsx` | «all eighty sections» |
| `tests/ui/srdReference.test.ts` | il censimento 38/7/3/42/12 **e** `toHaveLength(74)` |

Quel `74` **diventerà rosso, ed è per questo che l'ho messo**: era «seventy» scritto in lettere,
è invecchiato in silenzio quando il dataset è andato 75 → 80, ed è sfuggito alla passata che
aveva mosso le cifre. Adesso il prossimo che muove il dataset lo scopre dal test.

E `npm run build:srd -- --check` è il cancello vero della rimozione: se `shared/parsers/rules.ts`
e `data/srd-1.0.json` non dicono la stessa cosa, dice «out of date».

**La rinomina** tocca nome, repo e URL del deploy. §2.5(a) e (b) vietano il marchio nel titolo e
in copertina; (c) esige «Compatible» adiacente nel testo descrittivo. Oggi `manifest.short_name`
è la parola nuda. Nota che la rinomina del **repo** cambia l'URL del remoto: se si fa dopo il
merge, `origin` va ripuntato.
