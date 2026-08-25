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
