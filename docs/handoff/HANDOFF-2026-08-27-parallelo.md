# Handoff — 27 agosto 2026, sessione «le scene in parallelo»

**Questo documento è l'autorità.** Supersede `HANDOFF-2026-08-27-sera.md` su tutto ciò che
contraddice; quello che quel file dice e questo non tocca resta in vigore.

---

## 1. Da dove è partita

Il proprietario ha aperto la scena «Foresta» e ha avuto un combattimento; ha aperto «Pub» e si è
aperta **la stessa scena**. La sua frase: *«Non c'è tutta la dimensione di messa in produzione
della scena e del combattimento in parallelo. Tutto il lavoro fatto non sembra essere stato messo
in produzione. Controlla perché devo andare production ready con l'app.»*

**Il deploy non c'entra, ed è verificato scaricando il sito pubblicato**, non dedotto:
`curl .../sw.js` riporta `const BUILD = 'e25db1f…'`, lo stesso SHA di `main`, e il chunk GM
pubblicato contiene `liveScene`, `runScene`, `adoptBoard` e ogni etichetta degli screenshot.
Confrontato byte a byte con una build locale: 76 byte di differenza su 163.555, tutti riferimenti
a hash di chunk. **Il lavoro è nel codice spedito. Quello che non è in produzione è il modo di
raggiungerlo.**

## 2. Il difetto, riprodotto

Riprodotto in Chrome sulla 5203 con IndexedDB vuota, due righe scena create normalmente.

`runScene` è raggiungibile da tre soli verbi: `START THIS FIGHT` (serve un roster risolvibile),
`BACK TO THIS FIGHT` (serve qualcosa di parcheggiato) e un `OPEN THE SCENE` **declassato** che
chiama `runScene` solo quando `claimable` (`liveScene === null && onTable === 0`). Una riga appena
creata non ha nessuna delle tre — `AddSheet` dice *«THERE IS NO ROSTER TO CARRY»* — e
`SceneSwitcher` disegna solo le righe che hanno già combattenti o sono vive, quindi Pub non entra
mai nella striscia.

**Con due righe scena create normalmente non esiste nessun gesto che faccia partire la seconda.**
E la riga stampa *«Run this row instead»* senza disegnare nessun verbo che lo faccia. L'unica
uscita è END SCENE, che `clearScene` usa per **svuotare i combattenti**.

## 3. Le decisioni prese, e su cosa

Il proprietario ha scelto **C poi B, e l'indice in parallelo**, dopo una correzione (§5.1).

| | cosa | stato |
|---|---|---|
| **Indice** | l'indice per categorie nel search | **fatto, PR #51** |
| **C** | import delle campagne + backup automatico | piano pronto, non eseguito |
| **B** | parallelo vero: ogni riga tiene la sua rissa, schema 4→5 | piano pronto, non eseguito |

**C prima di B è la scelta del proprietario ed è la scelta giusta:** un bump di schema riscrive il
record e `checkReadable` fa poi *rifiutare* quel record a una build vecchia, per progetto. Oggi
sotto quel bump non c'è nessuna rete.

## 4. I due piani NON stanno in un journal

Lezione già imparata una volta in questo repo. Sono nel repo:

- `docs/handoff/PIANO-C-IMPORT-E-BACKUP-2026-08-27.md` — 619 righe, da `wf_b1702d82-b2d`
- `docs/handoff/PIANO-B-SCENE-PER-RIGA-2026-08-27.md` — 849 righe, da `wf_03f9674c-648`

Entrambi: 4 progetti indipendenti, un pannello di giudizio a 4 lenti, una sintesi. Entrambi
**piani e non registri**: nulla è stato eseguito, e le loro citazioni file:riga erano vere contro
`14c995a`.

## 5. Le correzioni. Leggerle prima di tutto il resto

### 5.1 «Una scena viva per campagna è un incidente» — ERA VERO IL 23, FALSO DAL 26

È la correzione che conta di più, perché il proprietario ha preso una decisione su di essa e la
premessa era mia e sbagliata.

`docs/handoff/DECISIONI-2026-08-25.md` **§18** risponde allo scenario del proprietario con le sue
stesse parole — *«Preparo 6 scene, 4 di combattimento, il gruppo si divide…»* — e decide il
parcheggio, **con un motivo misurato**: una carta combattente è **471px in un pannello da 498** a
393×852. Due risse non si disegnano insieme.

Conseguenza da tenere ferma: **la route B non dà due risse visibili**. La geometria non cambia.
Quello che compra è modificare una rissa che non stai guardando, e un modello più semplice. Chi
riapre la questione deve dirlo *prima* che qualcuno pesi il costo.

### 5.2 `.dhcampaign` non è una via d'uscita

Ho detto al proprietario di fare SAVE A COPY prima della migrazione. **Quel file non si rilegge.**
`parseCampaignFile` ha due chiamanti in tutto l'albero: il suo verificatore di andata e ritorno e i
test. Zero in `src/`. `SaveSheet.tsx:45-47` lo dice sul vetro. Non offrirlo mai come rollback
finché la corsia C non esiste.

### 5.3 I conteggi di test in circolazione sono tutti sbagliati

- **«~716 test»** (`SCENE-MODEL-2026-08-26.md:174`): non è supportato da niente nell'albero.
- **«29 file»**: mio, ed è un grep sulla parola `combatants`. Il 29 di `PIANO-SCENE-PARALLELE`
  §700 è un conteggio di **siti di seeding**, non di file.
- **Il numero vero, ricontato:** 154 file di test; **23** nominano `combatants`, **22**
  `liveScene`, **25** nell'unione; 3.361 blocchi `it(` in tutta la suite.

### 5.4 Altre, dal workflow diagnostico (22 su 40 affermazioni corrette)

- «Aprire una riga non viva mostra sempre la scena viva» — **solo** su una riga senza niente
  parcheggiato *e* senza roster risolvibile. Con un roster disegna `START THIS FIGHT` e funziona.
- «Pub non può MAI comparire nella striscia» — compare appena diventa `liveScene`, con zero
  combattenti. Vero il blocco, sbagliata la frase.
- «Sei stati, sei verbi primari» — sei stati, **quattro** etichette.
- Tre merge del 26 agosto hanno run di Deploy **cancellate** dalla coda `pages`. Niente perso, ma
  «gli ultimi 15 run sono verdi» non prova che uno specifico merge sia stato pubblicato.

## 6. I due blocchi veri per andare in produzione

Sono la cosa più grave uscita da tutta l'indagine, e non c'entrano con le scene.

1. **Una campagna si esporta e non si importa.** §5.2.
2. **Le campagne non sono in nessun backup automatico.** `grep -ci campaign src/store/backup.ts`
   = **0**. Quel sottosistema esiste perché Safari sfratta IndexedDB dopo ~7 giorni di inattività
   — e le campagne stanno in quello stesso IndexedDB.

Insieme: lo sfratto che il backup dei personaggi è stato costruito per sopravvivere si porta via
l'intera campagna, senza copia automatica e senza modo di rileggerne una a mano. **Trappola per
chi ripara: un backup scritto dentro lo store sfrattato non è un backup.**

Debito minore verificato: `pdfjs-dist` in produzione con un avviso HIGH; nessun linter in tutto il
repo; ~20 stili inline che mescolano lo shorthand `font` con `fontVariantNumeric` (lo shorthand
resetta le cifre tabulari, e sono su Fear, HP, countdown e dadi); 86 commit dal `0.6.0` del
CHANGELOG e zero tag.

## 7. Cosa è stato spedito: l'indice (PR #51)

Ramo `search-topic-index`, due commit sopra `main`. **CI ancora in coda alla scrittura di questo
documento — verificarla prima di unire, e verificare che un run esista davvero.**

Quattordici blocchi sul campo vuoto, coi conteggi letti dall'indice vivo; RULES apre nei cinque
capitoli del libro, un capitolo nelle sue sezioni, un tipo nei suoi record. È una **navigazione,
mai un filtro**: accendere un blocco svuota il campo, digitare spegne il blocco.

**I capitoli del libro sono cinque, e non erano nel dataset.** Una `RulesSection` è
`{id, title, body, sourcePage}`. La prima derivazione leggeva i marcatori `drop` del parser e dava
sei capitoli: sbagliata in entrambe le direzioni. Misurata invece la tipografia del PDF — **sette
sole righe a corpo 28 in tutto il libro** — restano cinque capitoli sulle 69 sezioni,
`4 / 1 / 5 / 24 / 35`. Questo decide anche `gold` (CORE MECHANICS: il capitolo Equipment non
esiste), le due sezioni degli ambienti (RUNNING AN ADVENTURE) e smentisce «THE BASICS» come nome
di capitolo — è una riga di INTRODUCTION, non il suo titolo.

Due difetti li ha trovati il **guardare**: l'etichetta ripetuta due righe sotto sé stessa
(`banded={false}`), e 8px di riga che trapelavano sopra l'intestazione appiccicata, perché uno
sticky si àncora al bordo del *padding* (`top: -8`).

Due misure hanno **smentito il progetto**, e stanno nel docblock invece che aggiustate di nascosto:
lo stato vuoto **scorre** a 375×667 (la griglia sta sul vetro a 311.75 in 342.00, è il piè di
pagina della licenza a sfondare), e WEAPONS apre a **11.557px, 33,8 schermate** — il doppio del
previsto, per cui l'intestazione è diventata appiccicata *e un controllo che chiude il blocco*.

Sei mutanti, sei uccisi, **due solo dopo aver riparato la guardia**: quello del silenzio onesto era
sopravvissuto perché ogni navigazione nei test era piena, e quella frase scatta solo su una lista
vuota — serve un dataset con un capitolo assottigliato.

`CHAPTER_OPENS` sta nella guardia e non in `src/`: `orphans.test.ts` ha ragione che un export senza
chiamanti è una funzionalità spedita spenta, e tenerlo lì rende il ricalcolo un secondo parere
invece che la tabella d'accordo con la costante da cui è nata.

## 8. Da dove ripartire

1. **Verificare la CI della #51 e unirla.** `gh run list --branch search-topic-index`, non solo
   `gh pr view`: una PR può dire CLEAN con zero check.
2. **Eseguire la corsia C** dal suo piano. È la rete.
3. **Poi B**, dal suo piano. Wave A (quattro corsie disgiunte) → Wave B (una corsia, un commit,
   atomica: non si può spezzare) → Wave C.

**Prima che B tocchi la campagna vera del proprietario, C deve essere spedita.** È il motivo
dell'ordine.

## 9. Regole che non si negoziano

Tutte quelle di `HANDOFF-2026-08-27-sera.md` §6 restano. Ribadite quelle che questa sessione ha
messo alla prova:

- `. ./env.sh` prima di ogni comando npm. Mai `git add -A`.
- **Non camminare l'app sui dati del proprietario: 5199 è la campagna vera.** Qui è stata usata la
  5203, IndexedDB vuota.
- `gh pr merge` è ciò che pubblica.
- **Un mutante sopravvissuto va affrontato, non nascosto.** Stanotte ne sono sopravvissuti due e
  hanno trovato due buchi veri nelle guardie.
- **Il rig di misura sta fuori dal repo** e si riusa:
  `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/`.
  Caso nuovo scritto qui e riusabile: `cases-index.json`. Si lancia con
  `AUDIT_ORIGIN=http://localhost:52xx AUDIT_PORT=93xx node run.mjs <file>` — **mai** 5199.
- **Prima di quotare un «X è un incidente, non una decisione» da qualunque documento, cercare una
  ratifica successiva in `docs/handoff/DECISIONI-*`.** §5.1 è costata una decisione del
  proprietario presa su una premessa falsa.
