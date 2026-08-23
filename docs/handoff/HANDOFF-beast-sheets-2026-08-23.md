# Handoff — branch `beast-sheets`, 23 agosto 2026 (seconda sessione)

> **`HANDOFF-2026-08-23.md` nella radice resta l'autorità su `main`.** Questo documento non lo
> sostituisce e non lo contraddice: `main` è ancora `f0c23f1` / `0.5.0`, pubblicata e verificata.
> Questo descrive un branch **non unito e non pushato**, e tre workflow lasciati girare.

---

## 1. Cosa c'è in volo, e la cosa importante su di esso

**Tre workflow stavano girando quando questa sessione è finita.** Sono in sola lettura: non hanno
scritto niente nel repo, per costruzione.

| id | run | cosa fa |
|---|---|---|
| `whwey9un7` | `wf_226cd659-47e` | verifica avversariale dell'audit del branch |
| `w8d0fulms` | `wf_6a80a4c1-7a8` | **FINITO** — le quattro voci di §6. Piano in `docs/handoff/BACKLOG-PLAN-2026-08-23.md` |
| `wzcrewqda` | `wf_d5464f24-a49` | **FINITO** — progetto in `docs/handoff/PROGETTO-GM-2026-08-23.md`, con 9 domande in coda |

Due dei tre sono atterrati e i loro risultati sono **committati nel repo**, non da recuperare:
`w8d0fulms` (24 agenti) e `wzcrewqda` (13 agenti). Resta `whwey9un7`.

### NON SI POSSONO RIPRENDERE. SI POSSONO SOLO LEGGERE.

`resumeFromRunId` funziona **solo nella stessa sessione**. Da un contesto nuovo quei run non
esistono più. Quello che resta, ed è quasi tutto, è su disco:

```
~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/
  b9563823-72a2-4816-be80-b8e823d1a7e4/
    subagents/workflows/<runId>/journal.jsonl      <- il valore di ritorno di OGNI agente
    subagents/workflows/<runId>/agent-*.jsonl      <- le trascrizioni complete
    workflows/scripts/<name>-<runId>.js            <- lo script, rileggibile e rilanciabile
```

**`journal.jsonl` è il file da leggere per primo.** Registra cosa ha davvero restituito ogni
agente. Non dare per scontato che un risultato ci sia: guardalo.

Se un workflow non era arrivato in fondo, **non rilanciarlo alla cieca**: lo script è committato
in `workflows/scripts/`, leggilo, e rilancia solo le lane che mancano. Rilanciarlo intero
ricomincia da capo e ricompra tutto.

I workflow di verifica presuppongono che l'albero sia **esattamente com'era**: se hai modificato
`src/` prima di leggerne i risultati, quei risultati parlano di un altro albero.

---

## 2. Stato, misurato

- Branch **`beast-sheets`**, **15 commit** sopra `main` (= `f0c23f1`), **albero pulito**.
- **3273 test su 134 file**, verdi. `tsc --noEmit` pulito. `npm run build` verde.
- Node **v24.19.0** via `. ./env.sh`. Il Node di sistema è 26 e **nasconde `localStorage` a
  jsdom**: una suite verde sotto quello è più debole di quella di CI.
- **Non unito, non pushato.** `main` non è toccato. Altri branch: `backup-pre-rewrite`.
- `data/srd-1.0.json` è stato **ricostruito** su questo branch: 80 sezioni di regole (erano 75).

---

## 3. Cosa fa il branch

Il Beastform del Druido e il compagno del Ranger, resi giocabili.

| commit | |
|---|---|
| `213b6c3` | `parseRules` arriva ai folio 12 e 18 → cinque sezioni di regole nuove |
| `c7fbc37` | gli otto upgrade del compagno letti dal dataset, non da `src/` |
| `204894a` | **l'attacco del Beastform si arma e si tira** (`beastformDamage`, Proficiency applicata) |
| `336feb3` | armi e incantesimi **marcati, non rifiutati**, in forma animale |
| `ba4c6af` | la forma cade quando segni l'ultimo HP (edge-triggered, nello `update` dello store) |
| `f1a1922` | il riposo scarica lo Stress del compagno; fuori scena e rientro al riposo lungo |
| `31ad61d` | `damageType` del compagno — **SCHEMA 4 → 5**, con convertitore e fixture `v5` |
| `19ddfa8` | **l'attacco del compagno**, come Spellcast Roll, con le *sue* Esperienze |
| `ad78393` | il tratto di Spellcast nelle info di classe |
| `19a24a6` | il nome del compagno svuotabile, ora dichiarato |
| `6be0ff0` | conteggio "N segnate · N guadagnate" + Esperienza al traguardo di tier |
| `eef8f19` | il compagno sul party board del DM e sul foglio stampato |
| `c88bd21` | **l'audit del branch e le sue correzioni** — vedi §5 |

---

## 4. Tre scostamenti dalle decisioni prese col proprietario

Sono argomentati per esteso nei rispettivi commit. Riassunti perché sono decisioni, non sviste.

1. **Il folio 19 è escluso.** È il ROGUE: tutte le regole del compagno stanno sul 18. Un range più
   largo tira una classe dentro una sezione di regole **con "validation clean" ancora a schermo**.
   Pinnato da un test.
2. **Il codec binario resta al formato 2**, contro quanto concordato. Il formato 3 è escluso da una
   proprietà già fissata in `tests/adversarial.test.ts` (nessun flip di un bit del nibble di
   versione deve cadere su un altro formato leggibile; dal 3 danno 2 e 1, entrambi leggibili). Il
   numero sarebbe **4**, e prenderlo impedirebbe a ogni telefono non aggiornato di ricevere
   *qualsiasi* scheda in cambio di un bit. I file portano `damageType` esatto, il QR no: **quarta
   perdita deliberata**, documentata in testa a `codec.ts` e asserita su entrambe le strade.
   Il bump di **schema** invece è stato fatto, come concordato.
3. **L'Esperienza del compagno al level-up è applicata, non offerta**, perché la frase non offre
   nulla: *"your companion also gains one"*. Arriva senza nome, lo mette il giocatore.

E una cosa lasciata fuori di proposito: **le righe del loadout non sono marcate** in forma animale.
Su una riga da 46px a 393px l'unico segno che ci sta è un colore, e questo progetto non accetta il
colore da solo (`prefs.shapeCoding` è la prova).

---

## 5. L'audit del branch, e il P0 che ha trovato

`c88bd21`. Sette rilievi, tutti verificati **eseguendo**, non leggendo.

**Il grave, e vale la pena capirlo perché la classe di difetto resta aperta:** il party board del
DM **andava in crash** su qualunque compagno salvato prima di questo branch. Una campagna conserva
copie intere delle schede dei giocatori, e `readPartyMember` (`shared/campaigns.ts`) fa il cast
dell'oggetto salvato direttamente a `Character`: **la catena di migrazione dei personaggi non gira
mai su di esse**. Quindi `companion.damageType` era `undefined` e `.toUpperCase()` lanciava,
portando giù l'intero board al primo render — l'unico modo di fallire che il docblock di quella
funzione è scritto per impedire.

Gli altri sei: due docblock che affermavano il falso (dicevo che il board del DM e l'anteprima di
stampa montano `Vitals`/`CompanionPanel` — non lo montano affatto); il drop del Beastform che
scattava su un massimo che cala invece che su un HP segnato; due difetti di stampa contro regole
che quegli stessi file dichiarano (glifi `☑`/`☐` su una pagina che disegna solo outline, e un
letterale `2` dove il file deriva quel numero); una costante cancellata che si è portata via la sua
ragione (stabilità referenziale di un array vuoto, che un `useMemo` a valle usava); e
un'asserzione che passava per il motivo sbagliato.

---

## 6. Il pericolo che resta in piedi, ed è tuo da decidere

**Le schede conservate dentro una campagna non passano mai dalla catena di migrazione dei
personaggi.** `CAMPAIGN_SCHEMA_VERSION` è una numerazione a sé e di proposito non si muove con
`SCHEMA_VERSION` (c'è un docblock in `shared/campaigns.ts` che lo argomenta).

Conseguenza: **il prossimo campo che aggiungi a un personaggio mancherà su ogni riga di party già
esistente.** La regola operativa, finché non si decide altro:

> Niente in `src/ui/gm/` può chiamare un metodo su un campo di `PartyMember.sheet`. Confronti sì
> (`x === 'mag'`), chiamate no (`x.toUpperCase()`).

La correzione strutturale sarebbe far girare `readCharacterRecord` dentro `readPartyMember`, ma
oggi quella funzione **ripara** dove il lettore dei personaggi **rifiuta o mette in quarantena**:
è un cambio di design, non una svista, e la decisione è del proprietario.

---

## 7. Cosa fare, in ordine

1. **Leggere i journal dei tre workflow** (§1) e, dai risultati della verifica, eseguire **le prove
   per mutazione** dei rilievi sopravvissuti — sequenzialmente, mai in parallelo, perché mutare i
   sorgenti in parallelo nello stesso worktree si distrugge da sé. Correggere solo ciò che diventa
   davvero rosso.
2. **Decidere cosa fare di `beast-sheets`**: merge, PR, o lasciarlo. `main` non è toccato.
3. **Applicare `BACKLOG.md`** con il piano prodotto da `w8d0fulms`. Regole non negoziabili
   dall'handoff di `main`: le **10 marcate `[NON verificato]` non si spuntano** senza il giro di
   confutazione (che è esattamente ciò che quel workflow ha fatto girare), e **`:1653` va spezzata,
   non spuntata** — `AppBoundary.tsx` porta ancora il difetto identico.
4. **Layout B**, la home del DM a schede (THE NIGHT / REFERENCE): deciso il 19 agosto, **zero
   righe**. `w8d0fulms` ne ha prodotto tre progetti e un giudice.
5. **Le domande al proprietario** prodotte da `wzcrewqda` — vanno fatte tutte insieme, non a rate.
   Fra queste c'è `:3136`, *«una scena è un luogo o un combattimento?»*, che blocca `:3140`.
6. Il tiro dei danni non legge le riserve di dadi (Slayer e Rally dicono entrambi «damage roll»).

---

## 8. Cosa non toccare

- **Il cancello H-9 resta chiuso**: inset orizzontali, rail dei Cards, overlay, `--control`,
  voci 7, 8 e 19.
- Le sezioni rilasciate di `CHANGELOG.md`.
- Di `HANDOFF.md` si mantiene **solo il cartello**.
- **Mai `git add -A`.**
- **Non spuntare niente in `BACKLOG.md` su un "probabilmente".**

---

## 9. Cinque cose sul codice che costano un pomeriggio se le riscopri da solo

- **`readPartyMember` non migra le schede.** §6. È la più cara.
- **`update` nello store è l'unico imbuto** di ogni scrittura sul personaggio, ed è dove vive
  l'unica regola *di transizione* dell'app (il Beastform che cade). Non deve diventare un hook di
  normalizzazione: `syncCounters` e `boundCounters` sono la forma per quello.
- **La stampa disegna outline e mai riempimenti**, e lo dice al rigo 7 del suo foglio di stile.
  `TickRow` è l'idioma; un glifo Unicode è tofu dove il font non lo copre.
- **`parseRules` esige che ogni unità appartenga a una sezione**: una contaminazione da un folio
  vicino è **silenziosa**, con la validazione ancora verde. Per questo esistono i test sul ROGUE.
- **jsdom non misura niente.** Sul branch ci sono due superfici cambiate e mai misurate: la riga
  Spellcast in `Identity` (cockpit) e la geometria della scatola ATTACK nel pannello del compagno.
  Quello è il controllo che manca, e va fatto in Chrome.
