# Decisioni del proprietario — 26 agosto 2026

Quattro decisioni. Le tre domande aperte di `RICERCA-SRD-2026-08-26.md` §6, poste tutte insieme
come il proprietario aveva chiesto e **corrette prima di essere poste**, più una riparazione di
interfaccia decisa e spedita in giornata.

I registri precedenti (`DECISIONI-2026-08-25.md`, dieci voci; `DECISIONI-2026-08-23.md`, nove)
restano in vigore su tutto ciò che questo file non tocca.

**Nessuna delle prime tre è stata ancora eseguita.** La quarta è unita e pubblicata.

---

## 1. Il catalogo delle domande resta sulle 69 sezioni di regole

**Risposta: no.** `ask.ts` non si allarga ai 780 record. Non è una quinta parte.

**Il motivo scritto nel piano è falso, e va sostituito prima che qualcuno lo esegua.** §4.4 e
§2.1 dicono entrambe *«`ask.ts` continua a chiamare `searchRules`»*. **Non lo chiama.** Importa
`Ref` (`ask.ts:87`) e `ruleTerms` (`:88`) e nient'altro; le tre occorrenze di `searchRules` nel
file sono prosa di docblock (`:153`, `:162`, `:173`), e il pagliaio di `searchAsk` (`:188`) è
`entry.ask` + `entry.also` + l'etichetta del momento — **zero testo del dataset**. Allargare il
corpus di `searchSrd` non potrebbe toccare il catalogo per nessun meccanismo.

**Il motivo vero è semantico.** `at` è un puntatore a un blocco di prosa citabile, e una domanda
come *«un avversario è battuto e vuole arrendersi»* non ha un equivalente nella riga di
statistiche di un'arma. Le dodici voci spedite sono tutte di forma «regola».

**Conseguenza:** la frase di §5 del handoff che ripete la stessa premessa falsa va corretta. La
regola operativa — **`searchRules` non si cancella e non si restringe** — resta in vigore: la
chiama `RuleSearch.tsx` per la banda delle regole, che è ciò che l'autore intendeva.

---

## 2. La porta della ricerca su Play è una quinta voce della TabBar

**Risposta: né un verbo né una barra nuova. La quinta scheda in quella che c'è già.**

Misurato in Chrome contro `0b5505c`, `pointer: coarse` vero, con un personaggio di livello 5
costruito attraverso il percorso reale (`tools/sampleCharacters.ts`), su origine separata
(`localhost:5201`, IndexedDB vuoto):

| | 393×852 | 375×667 |
|---|---|---|
| margine fra l'ultima riga toccabile e il fondo della colonna | **138.00** | **21.00** |
| **quinta scheda** — costo verticale | **0.00** | **0.00** |
| schede, da quattro a cinque | 98.25 → **78.60** | 93.75 → **75.00** |
| aria attorno all'etichetta più larga (`SEARCH`, 42.00) | **36.59** | **33.00** |
| bersaglio di ogni scheda | 78.60 × 60 | **75 × 60** |
| `docOverflowX` | 0.00 | 0.00 |

Nessuna etichetta trabocca a nessuna delle due taglie (`labelOverflow` 0 su tutte e cinque), e
ogni bersaglio resta molto sopra il pavimento dei 44 in entrambi gli assi.

**Le altre due opzioni, misurate e scartate:**

- **Un verbo nell'header** costa anch'esso **0.00px** — 44×44 a `y 4` dentro i 53 che l'header ha
  già, con 136.59px di vuoto contiguo in cui atterrare anche a 375. Scartata **non** per i pixel:
  l'header sta in `src/ui/shell/App.tsx`, è la barra della **shell**, e la porta comparirebbe su
  tutte e quattro le schermate — GM compreso, dove `SHOW` contiene già la ricerca delle regole.
  Sarebbe una seconda porta per la stessa cosa.
- **Un campo in cima alla colonna** costa **+52.00px** ed **entra a 393×852** (86.00 di margine
  residuo) ma **non a 375×667**: spinge `Lineage, domains & features` **31.00px sotto la piega**.

**Due assunzioni cadute, e vanno corrette nel piano:**

1. **Una barra non costa 60px di vetro permanente.** La TabBar esiste già; la quinta voce divide
   gli stessi 375 in cinque invece che in quattro. Il costo verticale è **zero**. Il piano §5.1 e
   la sintesi che lo verificava assumevano entrambi il contrario.
2. **La stima «13px di margine a 375×667» era declamata, non letta.** Misurata su uno schermo con
   un personaggio vero è **21.00px**. Non cambia la conclusione — 52 non entra in 21 — ma cambia
   il numero.

**Resta aperto:** cosa disegna la scheda una volta toccata, e con quale ambito predefinito. La
§2.2 dice «già ristretto a ciò che il giocatore ha in mano»; la lista dei risultati dentro Play è
una colonna diversa da quella di `ShowSheet` e non è ancora stata misurata.

---

## 3. Il ballottaggio dei 69 momenti è ratificato — gli orfani sono otto

`docs/handoff/BALLOT-MOMENTI-2026-08-26.json` era **una proposta, non una decisione**. Ora è
ratificato riga per riga sulle sette che si dichiaravano incerte. **Il conto non si muove: 8
orfani, 94 appartenenze su 61 sezioni.**

**Gli otto orfani, confermati:** `introduction`, `ranger-companion`, `multiclassing`,
`running-an-adventure`, `gm-guidance`, `additional-gm-guidance`, `preparing-combat-encounters`,
`campaign-frames`.

**Le sette contestate, giudicate:**

| # | sezione | esito |
|---|---|---|
| 2 | `the-golden-rule` | **dentro**, `before-the-roll` + `between-scenes` |
| 12 | `core-gameplay-loop` | **dentro**, `before-the-roll` |
| 31 | `leveling-up` | **dentro**, `between-scenes` |
| 36 | `gm-principles` | **dentro**, `before-the-roll` + `between-scenes` |
| 50 | `optional-gm-mechanics` | **dentro**, `before-the-roll` + `damage` + `this-place` |
| 54 | `adversary-stat-block-benchmarks` | **dentro**, `before-the-roll` + `my-turn` |
| 60 | `battles-and-narrative` | **dentro**, `my-turn` |

**Sulla 54, dove il ballottaggio chiedeva di svuotare, ha vinto il codice spedito.** La sezione è
361 caratteri, zero sottotitoli, ed è **interamente una tabella** — la forma canonica di una cosa
che si consulta invece di leggerla. `Reference.tsx:259` apre il riferimento del GM **su
`improvise` come topic predefinito**, e `ReferenceTables.tsx:139` disegna proprio questa sezione;
il suo docblock lo dice per esteso, *«gli avversari a 73, gli ambienti a 102»*. È già dentro
`MID_SCENE` (`ask.test.ts:416`), ratificata il 25 agosto senza correzioni, e la **decisione 1 del
25 agosto** nomina la stessa composizione. L'obiezione del ballottaggio è reale ma parziale:
`running-gm-npcs` (p.69) dice davvero che un avversario si improvvisa modificando il blocco di
uno esistente — è **una** strada, e l'app ne spedisce una seconda.

**Sulla 59 e la 60 il ballottaggio chiedeva di farle combaciare. La richiesta è respinta, e la
differenza è deliberata:** `battles-and-narrative` porta una frase da tavolo vera — *«base
adversaries' moves on their motives»* — e `preparing-combat-encounters` no. Restano diverse
perché sono diverse, non per svista.

**Un conto che nessun documento riportava, e che ora è agli atti:** delle 69 righe, **31 sono
`obvious`, 31 `arguable`, 7 `contested`**. Le sette sono quelle giudicate qui sopra.

---

## 4. Il test della §2.3 è una lista di esclusione, e ora ha un confine fermo

Il piano prometteva *«il test che cammina ogni sezione e fallisce su una che non appartiene a
niente»*. **Quel test non può spedire come scritto:** fallirebbe il primo giorno su otto righe.

Le tre uscite erano un settimo momento, una lista di esclusione esplicita, o un test più debole.
**La ratifica del §3 sceglie da sé:** con otto orfani veri e fermi, la lista di esclusione è
esattamente ciò che serve, e non è più un bersaglio mobile — era questa la sua unica obiezione
seria, che le critiche fissavano a **28 righe su 69, il 41%**.

**Il settimo momento è morto per misura, non per gusto.** `ShowSheet.tsx:359` è
`repeat(3, 1fr)`: un settimo chip porta la griglia a 3×3, cioè una terza riga da 44 più 8 di gap,
**52px** dentro una colonna che oggi entra per **0.3px** (294.0 in 294.3) e il cui stesso docblock
chiama quel margine *«una coincidenza, non un margine»*. In più ogni chip deve trovare almeno una
domanda (`ask.test.ts:236-241`), quindi servirebbe anche una tredicesima voce di catalogo.

**Nota sulla forma, da rispettare quando si scrive:** l'unico campo che porta un momento oggi è
`AskEntry.moment`, ed è **singolo**. Il ballottaggio è **plurale** — 30 righe con un momento, 29
con due, 2 con tre. Non esiste in `src/` nessun tipo sezione→momenti. La §2.3 propone una forma
che il codice non ha ancora.

---

## 5. La riga del titolo di ogni foglio GM respira — deciso ed eseguito

Deciso a schermo aperto guardando il runner: il nome della scena era schiacciato.

La causa non era in `SceneSwitcher`. La riga del titolo di `GmSheet` dichiarava
`padding: '0 6px 0 14px'` — **padding verticale zero** — quindi la sua altezza era quella del
figlio più alto, la ✕ da 44×44, più il rigo da 1px. **45.00**, misurato. Ha retto finché il titolo
era testo: un glifo senza scatola non ha niente da premere contro un bordo. Il chip pieno del
runner sì, e toccava entrambi i bordi — **0.50px d'aria per lato**.

**Scelta la riparazione della causa e non del sintomo**, sapendo che costa: riga da **45.00 a
57.00**, aria da 0.50 a **6.00 sopra e 7.00 sotto**, su **ogni** foglio GM. L'header è
`flex: none` e lo scroller `flex: 1` con il pannello fisso fra i due, quindi i +12 dell'uno sono
i −12 dell'altro, esatti: i **582.00** misurati a 393×852 diventano **570.00**.

Unita in PR #34, `0b5505c`, pubblicata — il service worker vivo porta quel timbro.

**Trovato e non sfruttato, di proposito:** il chip della scena corrente è uno `<span>` senza
`onClick` (`SceneSwitcher.tsx:169`), quindi il pavimento dei 44px non l'ha mai vincolato e si
sarebbe potuto rimpicciolire. Sarebbe stato il sintomo: il prossimo blocco pieno su quella riga
avrebbe riscoperto lo stesso bordo.
