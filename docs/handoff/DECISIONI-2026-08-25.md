# Decisioni del proprietario — 25 agosto 2026

Nove domande, tutte risposte. Sono le domande che `HANDOFF-2026-08-25.md` §5 lasciava aperte —
due — più le sette che la sintesi della tornata di progettazione portava e che il handoff aveva
compresso via.

**Nessuna di queste è stata ancora eseguita**, tranne dove detto. Il registro precedente
(`DECISIONI-2026-08-23.md`, nove decisioni) resta in vigore su tutto ciò che questo file non
tocca.

---

## 1. I due chip compositi restano fuori da `prefs`

`REFERENCE_TOPICS` (`src/ui/gm/Reference.tsx:237`) ha otto chip. Sei indirizzano una sezione
sola. Due no: `improvise` disegna `TierBenchmarks`, che compone `adversary-stat-block-benchmarks`
(p.73) e `adapting-environments` (p.102); `moves` disegna `GmMoves`, che compone cinque sezioni
intere.

**Risposta: quei due non sono pin.** Restano righe permanenti fuori da `prefs`, che continua a
contenere **solo indirizzi SRD veri**. L'alternativa — un id sintetico tipo `topic:improvise` —
è stata rifiutata perché farebbe entrare nel modello dei dati una categoria di indirizzo che
esiste per due casi soli, e la lista PINNED che il GM vede mescolerebbe per sempre indirizzi del
libro e nomi scritti dall'app.

**Conseguenza sullo step 5, e va scritta nel piano prima che qualcuno lo esegua:** lo step non è
più «ritira `REFERENCE_TOPICS`». La strip **resta**, perché è l'unica porta a quei due renderer.
La frase «seminati con gli otto» non è più vera alla lettera: i pin seminati sono sei.

## 2. L'hint `long-term` si corregge con le parole dell'app

L'hint di oggi (`src/ui/gm/Countdowns.tsx:133`) dice *«Advances across downtime and between
sessions.»* Misurato sul dataset spedito: `between sessions` compare **due volte in tutte le 69
sezioni**, e tutte e due nella prosa di Hope/Fear — mai negli orologi. Quello che la sezione
`countdowns` dice è *«Long-term countdowns that advance after rests instead of action rolls.»*

**Risposta: riscritto con le parole dell'app, non citando il libro.** Il docblock a
`Countdowns.tsx:102` — *«The four hints below are the app's own words, and stay that way»* —
**resta in vigore** e non viene revocato. Ci va aggiunta una riga che dice quale dei quattro è
stato corretto e perché, così l'obiezione che il docblock solleva — *«correggerne uno dei quattro
lasciandone tre è arbitrario»* — viene **risposta** invece che aggirata: non è arbitrario, quello
diceva una cosa che il libro attribuisce a un'altra risorsa.

## 3. Il Massive Damage segue `prefs` anche contro un avversario

**Va deciso ora perché la funzione non esiste ancora.** Il journal la descrive come già recintata
in `combatantHit`; verificato: `combatantHit` non è in albero. La scrive lo step 3, ed è il campo
danno sulla carta del combattente.

Oggi il flag vive in `prefs.massiveDamageRule` (default `false`, `store/prefs.ts:140`), lo legge
`severityFor` (`engine/damage.ts:170`), e lo usano le vitali del giocatore e la scheda di stampa.

**Risposta: sì.** La funzione nuova prende il flag come argomento e legge lo stesso `prefs`.
Costa un argomento e un caso di test. Il motivo del sì: hardcodare `false` significa che un
tavolo che ha *acceso* la regola opzionale la vede applicata ai propri PG e non ai mostri, senza
che niente sullo schermo lo dica — che è la forma peggiore, perché è silenziosa.

L'SRD dice a p.71 che soglie, HP e Stress degli avversari «function the same way they do for
PCs». Il testo del Massive vive nella parte PC e nel dataset non c'è una frase che lo estenda
esplicitamente: questa decisione è una lettura, non una citazione, ed è registrata come tale.

## 4. Le 48 voci del catalogo partono da un seme di dodici

`DECISIONI-2026-08-23.md` §9 fissava il numero (48 adesso) e la crescita (la voce 49 la decide il
tavolo), non il **chi**. Verificato: `askCatalogue.ts` non esiste e le 48 voci non sono in nessun
ramo.

**Risposta: dieci-dodici voci scritte come seme**, sulle domande che l'SRD **non** risponde —
grepate contro il testo spedito e verificate a zero occorrenze: `surrender`, `concede`, `chase`,
`lines and veils`. Sotto la dozzina il catalogo «risponde solo a ciò che hai già memorizzato»
(`PROGETTO-GM:458`), quindi dieci è la soglia minima onesta. La 49ª la decide comunque il tavolo,
per decisione già presa.

## 5. La lista delle «sezioni di mezza scena» si scrive e si corregge

È la settima delle sette asserzioni del rot test (`PROGETTO-GM:242`): *«every mid-scene section
has ≥1 entry»*. Non è una misura, è un giudizio su cosa un GM apre **durante** una scena.

Il conteggio che gira nei documenti è stantio: `RECUPERO-JOURNAL:602` dice «145 ancore su 46
sezioni mezza-scena» su un dataset di **80** sezioni, che non esiste più. Oggi sono **69**.

**Risposta: la lista si scrive e il proprietario la corregge.** Sbagliarla non è pericoloso: una
sezione classificata male produce una voce in più o in meno, non un'asserzione falsa.

## 6. SHOW a campo vuoto: chip sopra, porte sotto

Verificato in `src/ui/gm/ShowSheet.tsx:180`: oggi i due stati sono **esclusivi**. Campo pieno →
`RuleSearchResults`. Campo vuoto → `liveDoors(prefs)`. I sei chip «momento» sarebbero una terza
cosa in uno spazio che ne tiene due.

**Risposta: entrambi, in un solo scroll — griglia di chip in cima, le porte sotto.**

La premessa che rendeva questa scelta dolorosa è caduta il 25 agosto: **il pannello adesso scorre
davvero** (PR #9). Ma i vincoli restano e non sono opinabili: sei chip a 363px danno **53,8px
l'uno** con gap 8px — passano il pavimento del tocco in larghezza ma **non tengono `BETWEEN
SCENES`**, quindi serve una griglia 2×3 **la cui altezza non è mai stata misurata**. Il cancello
H-9 resta chiuso, quindi l'overflow laterale non è una via d'uscita.

→ **Questa decisione ha un pezzo che solo Chrome può chiudere.** Non spedirla su un'altezza
dedotta.

## 7. L'atterraggio della ricerca è sul paragrafo

Quando un layer homebrew scrive un paragrafo su più righe, si atterra sul **paragrafo** che
contiene la riga, non sulla riga.

Sul dataset spedito la domanda è teorica — 312 part di prosa, zero su più righe — e la risposta
opposta resta **additiva**: un ramo in più dentro due file e in nessun chiamante. Non è una porta
che si chiude.

## 8. La marcatura accende solo il blocco d'atterraggio

Non tutta la sezione aperta. Accendere ogni occorrenza rende la marcatura rumore invece che
indicazione, ed è il rischio già registrato in `PROGETTO-GM` §7 voce 13 — se `<mark>` sia
trovabile a colpo d'occhio in una stanza buia. La variante minima è un cambio di una riga.

## 9. L'assenza del Witherwild si dice nel README, non sullo schermo

Il Witherwild è fuori: verificato, **69 sezioni e zero occorrenze**, la decisione §4 del 23 agosto
è eseguita. Nessuna delle nove decisioni diceva se un GM debba *sapere* che quel materiale è stato
tolto di proposito.

**Risposta: una riga nella sezione Legal del README**, che esiste già (`README.md:368`) ed è dove
le posizioni dichiarate di questo progetto vivono. Lo schermo resta pulito. Dirlo nella reference
sarebbe stato prodotto nuovo, da disegnare e misurare come tale.

---

## Cosa cambia nei piani, e va applicato prima di eseguirli

Tre di queste risposte non sono preferenze: **invalidano un passo scritto.**

1. **Step 5** — non è più «retire `REFERENCE_TOPICS`». La strip resta (§1), e i pin seminati sono
   sei, non otto.
2. **Step 3** — la funzione che applica danno a un combattente nasce con l'argomento del Massive
   (§3), non con un `false` scritto dentro.
3. **Step 3, il passo sui countdown** — l'hint si corregge, ma con le parole dell'app, e il
   docblock di `Countdowns.tsx` **non** si revoca (§2). Un passo che lo aggira in silenzio va
   respinto in revisione.

E una che apre lavoro di misura invece di chiuderlo: **§6 non è spedibile senza Chrome.**
L'altezza della griglia 2×3 di chip è un numero che nessuno ha.

---

## 10. QUESTIONS sta sopra `SOME` — deciso il 25 agosto, a costruzione avvenuta

La domanda è nata guardando il codice, non progettandolo: la lane del catalogo ha messo il gruppo
QUESTIONS **sopra** la banda `SOME` nei risultati di ricerca, se n'è accorta che **nessuna delle
nove decisioni lo autorizzava**, e l'ha segnalato invece di lasciarlo passare.

**Risposta: sopra, e diventa una decisione.** Una voce curata da una persona, con un puntatore
verificato a mano contro l'SRD, batte una corrispondenza parziale trovata da un algoritmo. È il
senso stesso per cui il catalogo esiste: le domande che ci stanno dentro sono precisamente quelle
a cui una ricerca per parole **non sa rispondere**, perché il libro non usa quelle parole.
Verificato sul testo spedito, zero occorrenze ciascuna: `surrender`, `concede`, `chase`,
`difficulty roll`, `nearly impossible`, `lines and veils`.

**Il costo, e perché è minore di quanto sembri.** L'obiezione seria è che l'SRD dovrebbe venire
prima: chi cerca una parola del libro deve trovare il libro. Ma i due casi non collidono quasi
mai — quando la parola è nel libro, sopra QUESTIONS ci sono comunque le corrispondenze **esatte**,
e QUESTIONS scavalca solo `SOME`, che è già la banda di ripiego. Quando la parola nel libro non
c'è, sopra non c'è niente da scavalcare.

**Cosa costa se la si scopre dopo.** Due delle sei bande di momento cadono già nel ripiego OR
(`THE DICE LANDED`, `BETWEEN SCENES`): se un giorno si volesse invertire l'ordine, quelle due sono
le superfici dove il cambiamento si vedrebbe per prime, ed è lì che va guardato al tavolo prima di
toccarlo.

---

# Le decisioni del 26 agosto

Il registro continua qui invece di aprirne un altro, perché queste sette rispondono alle domande
che le nove sopra hanno lasciato aperte — la §15 è letteralmente la risposta alla §5 — e separarle
avrebbe messo la domanda e la risposta in due file. La data di ciascuna è nel titolo.

## 11. `ShowDoor.body` resta, ed è la formulazione canonica

Togliere le descrizioni dalle porte di SHOW ha lasciato `ShowDoor.body` — il campo, e tutte e tre
le voci — **letto da nessuno in `src`**. Un campo così è esattamente ciò che un giro di pulizia
cancella.

**Risposta: resta, e non è un orfano.** Quelle tre frasi sono la formulazione canonica dell'app per
ciò che ogni strumento **non** è — un bestiario che non aggiunge niente a stasera, un tabellone che
non scrive su nessun personaggio, una bancarella che non spende i soldi di nessuno. `Settings.tsx`
le **parafrasa** con parole sue, perché un hint accanto a un interruttore risponde a una domanda
diversa da una porta: cosa ti toglie spegnerlo, non cosa c'è dietro.

→ **Serve un commento sul campo che dica questo**, in `showDoors.ts`, dove chi pulisce guarda. E la
frase di `ShowSheet.tsx` che dice *«It is the next thing to settle here»* va aggiornata: è settled.

## 12. Il `--control` su `hybrid` segue `coarse`, cioè sale a 44px

Misurato: su profilo `hybrid` (portatile touch) `--control` risolve a **34px** e undici bottoni
stanno sotto il pavimento di 44 — fra cui *Play / Cards / Build / GM*, cioè la navigazione. Su
`coarse` sono 44. **Un portatile touch riceve i controlli da mouse.**

**Risposta: sì, la query si allarga** — `(pointer: coarse)` diventa `(any-pointer: coarse)` a
`tokens.css:334`, che è già la query che `--pip-h` usa.

**Ma costa più di così, e va scritto qui perché il handoff non lo diceva.** Il repo porta una
guardia che **vieta** questo cambiamento: `tests/ui/stylesheets.test.ts:318`, *«does not drag
--control along with them»*, asserisce che nessun blocco `any-pointer: coarse` contenga
`--control:`. La sua motivazione — il pannello del cockpit *«clips its own overflow»* — **non è più
vera**: `DualityRoll.tsx:130` dice *«The panel scrolls»*, e `tokens.css:129-142` lo registra già
sotto il titolo *WHAT NO LONGER APPLIES*, concludendo che quel che resta è *«a live defect rather
than a decision»*.

Quindi `tokens.css:435` — *«because `--control` must not follow it — see the note beside
`--pip-h`»* — **contraddice la nota a cui rimanda**, nello stesso file. È prosa stantia, ed è il
difetto che questo repo paga più spesso.

→ Il ramo che esegue questa decisione fa **tre** cose, non una: gira la query, ritira la guardia
(o la inverte), e corregge la frase del 435. E `tokens.css:142` chiede *«its own measurements
of the GM screens»*: la misura del **prima** c'è, quella del **dopo** no.

## 13. Un test pinna il margine da 0.3px dello stato vuoto di SHOW

La colonna dello stato vuoto viene **294.0** in una finestra da **294.3**. `ShowSheet.tsx` lo dice
già e lo chiama *«a coincidence and not a margin»*.

**Risposta: si pinna.** Un margine che nessuno ha scelto e che nessun test difende è un margine che
il prossimo cambio di padding consuma in silenzio.

## 14. Il fixture del rig porta un gruppo di Minion — **fatto**

`comb-minions`, `minionsRemaining: 4`, quattro Giant Rat nella riga `row-encounter`. È ciò che ha
reso misurabile la carta dei Minion: **tre tentativi di portarcene uno pilotando il builder non
hanno mai superato il passaggio del roster.** La copia precedente è in
`fixtures.json.bak-pre-minion`.

## 15. La lista delle 35 sezioni di mezza scena è confermata così com'è

È la risposta alla **§5**, che diceva *«la lista si scrive e il proprietario la corregge»*. La lista
è scritta (`tests/gm/ask.test.ts:384`) e il proprietario l'ha letta.

**Risposta: nessuna correzione. Le tre chiamate contestabili restano come sono:**

- **`downtime` fuori.** Un riposo si conduce al tavolo, ma il downtime sta *fra* le scene e non
  dentro una — e il sesto chip momento è per l'appunto `BETWEEN SCENES`.
- **`engaging-your-players` dentro**, per la tabella d'obiettivi casuali a 1d12, che si tira a metà
  rissa. Non per il titolo.
- **`pitfalls-to-avoid` e `session-rewards` fuori**, anche se delle voci del catalogo ci puntano.
  Un puntatore può mirare fuori dalla lista: la cosa più vicina che il libro dice su un problema di
  scena è a volte un principio.

Il conto resta **35 su 69**, e i due `expect` che lo pinnano non si toccano.

## 16. Le due cose che un rig non può misurare si guardano al tavolo **dopo**

Sono il `<mark>` a sfondo azzerato in una stanza buia, e i 102px di mono da 10px a metà spaziatura
dei chip momento.

**Risposta: dopo.** Il ragionamento è di rischio, non di qualità: undici commit verdi che esistono
su una macchina sola sono più fragili di una marcatura poco visibile, e **entrambe le correzioni
sono piccole** — la marcatura è un cambio di una riga (§8), la spaziatura dei chip è un token. Un
deploy si torna indietro con un revert; un disco no.

La wave 5 è stata spedita il 26 agosto in cinque PR (**#16** `wave5-pin`, **#17** `wave5-step5-replan`,
**#18** `wave5-handoff`, **#19** `wave5-carta`, **#20** `wave5-catalogo`), unite dalla più piccola
alla più grande, con la #20 **riallineata su `main` prima del merge** — e quel verde, a differenza
di quello della #14 del 25 agosto, ha girato sul base giusto.

## 17. Un avversario a Stress pieno diventa Vulnerable

La domanda è nata al tavolo, non progettando: *«ma i nemici se raggiungono il massimo di stress non
diventano vulnerabili?»*

Verificato sul dataset spedito. `rules/stress`: *«When a character marks their last Stress, they
become Vulnerable (see: Conditions) until they clear at least 1 Stress.»* E `rules/using-adversaries`,
sotto *DAMAGE THRESHOLDS, HIT POINTS, AND STRESS*: *«These systems function the same way they do for
PCs.»*

Verificato nel codice: il lato giocatore lo deriva (`engine/damage.ts:296`, `isVulnerableFromStress`,
disegnato dalla striscia di `Conditions.tsx`). Il lato GM **no**: `makeCombatant`
(`engine/encounter.ts:189`) tiene `stress: { marked, max }`, la carta lo disegna come contatore, e
`src/ui/gm/` non contiene la parola *vulnerable* nemmeno una volta.

**Risposta: sì, e in un ramo suo.** È **esattamente la stessa forma della §3** — una lettura di p.71
e non una citazione — e la §3 l'ha già risolta nella stessa direzione, con lo stesso motivo: un
tavolo che vede la regola applicata ai propri PG e non ai mostri, senza che niente sullo schermo lo
dica, è la forma peggiore, perché è silenziosa. Qui è persino più netta, perché la frase sullo
Stress che si esaurisce sta nella sezione `stress` e p.71 ci rimanda esplicitamente.

Registrata, come la §3, **come lettura e non come citazione.**

---

# La decisione del 26 agosto, sera

## 18. Le scene si parcheggiano, e l'interruttore sta sul runner

**Questa risponde alla §7.1 di `SCENE-MODEL-2026-08-26.md`, che era la domanda aperta più grande
del documento:** se *«non si capisce niente»* volesse dire *non capisco cosa fanno questi pulsanti*
oppure *ho pianificato quattro scene e l'app ne regge una sola*.

**Risposta: la seconda.** E lo scenario che l'ha resa concreta è del proprietario:

> *«Preparo 6 scene, 4 di combattimento, il gruppo si divide e ho 2 combattimenti in parallelo in
> scene diverse. Uno in un dungeon e l'altro in una foresta.»*

### Il fatto fisico che ha deciso la forma

**Due risse disegnate insieme non ci stanno.** Una carta combattente misura **471.00px** in un
pannello da **498** — è la misura della wave 5, ed è il motivo per cui la carta è stata piegata.
Su 393×852 non esiste un posto dove metterne due.

Quindi la domanda non era *«parallelo o sequenziale»*. Era **quanto costa il salto, e se si perde
qualcosa.**

### Cosa è stato deciso

1. **Ogni riga scena tiene la sua rissa.** Far partire una riga, o tornarci, **parcheggia** ciò che
   è sul tavolo dentro la riga da cui veniva e mette in campo quella di questa. Nessun segno perso.
2. **L'interruttore sta sul runner, non nel piano.** Una striscia in cima alla scena che nomina le
   scene vive — `DUNGEON | FORESTA` — e un tocco la ribalta.
3. **Un countdown può appartenere a una scena** invece che alla campagna, così *«la marea sale»* non
   segue il GM dentro il dungeon.

### Perché l'interruttore non poteva stare nel piano

In Daggerheart **non c'è iniziativa**: lo spotlight passa di continuo, quindi col gruppo diviso si
salta dungeon↔foresta **a ogni battuta**, non una volta a scena. Dal piano il salto è chiudi il
runner → scorri la lista → trova la riga → apri → premi: **cinque gesti per battuta.** Un tocco va
bene solo se è dove il pollice è già.

### Cosa questo costa meno di quanto sembrasse

**Il magazzino c'è già.** Verificato: una riga `scene` possiede `combatants: SceneCombatant[]` da
`shared/campaigns.ts:338-344`, schema 3, persistito ed esportato — e **niente in `src` lo scrive**.
`spread`/`gather` (`gmStore.ts:283-312`) muovono soltanto `board.combatants`. Il campo aspetta
esattamente questa funzione da quando esiste.

Serve **un** campo nuovo — quale riga sta girando, perché per parcheggiare bisogna sapere dove
rimettere — più il campo che lega un countdown a una scena.

### Una correzione al documento di stamattina

La sua §4 rifiutava il parcheggio dicendo che *«rimetterebbe a posto la metà del GM e lascerebbe
cadere in silenzio quella del tavolo»*. **Non regge, ed è verificato:** `campaign.party` è
`PartyMember[]` con i suoi `tracks` **a livello di campagna** (`shared/campaigns.ts:595`,
`shared/types.ts:651-660`) — e deve esserlo, perché gli HP di un PG **attraversano** le scene. Un
personaggio ferito nel dungeon è ferito anche in foresta.

Quindi la metà che deve parcheggiare (i mostri, l'ambiente) parcheggia, e la metà che non deve (i
PG, la Fear) giustamente resta ferma. **L'obiezione che affossava questo design era sbagliata.**

### Il buco che lo scenario ha fatto emergere, e che nessun documento aveva

I countdown sono righe del piano, quindi si vedono **tutti, sempre**. Col gruppo diviso è la prima
cosa che confonde: un orologio che riguarda la foresta ti sta davanti mentre corri il dungeon. Non
era nel documento di stamattina — è uscito guardando lo scenario delle sei scene.

### Cosa resta da progettare, e dove

Il rischio è **geometrico**: la striscia va in cima al pannello dove una carta è già 471 su 498.
Non si spedisce su un'altezza dedotta. Il progetto è in corso.
