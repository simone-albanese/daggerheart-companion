# Handoff — branch `beast-sheets`, 24 agosto 2026

> **Sostituisce `HANDOFF-beast-sheets-2026-08-23.md`**, che porta un cartello e non è stato
> riscritto: era accurato per il suo momento, e i suoi §3 e §4 sono stati ri-verificati uno per uno
> e reggono. Quello che è cambiato sta fuori dalla sua vista — la verifica del branch è morta a
> mezz'ora dalla sua ultima riga, e il proprietario ha risposto alle nove domande la mattina dopo.
>
> **`HANDOFF-2026-08-23.md` nella radice resta l'autorità su `main`.** `main` è ancora `f0c23f1` /
> `0.5.0`, pubblicata e verificata. Questo descrive un branch **non unito e non pushato**.

---

## 1. Le due cose che devi sapere prima di decidere qualsiasi cosa

### 1.1 La verifica del branch è girata, ed è andata male

`docs/handoff/VERIFICA-BRANCH-2026-08-23.md` (`b6a1ccd`) **non esisteva** quando è stato scritto il
handoff precedente. Il workflow che doveva produrlo è stato ucciso dalla chiusura della sessione:
110 agenti partiti, 102 rientrati, e le fasi 4 e 5 — quella che doveva *scrivere il rapporto* — non
sono mai partite. È stato ricostruito dal journal il 24 mattina.

Dice tre cose che cambiano la domanda «unisco?»:

- **Sei delle sette correzioni di `c88bd21` sono incomplete**, e la **#4 è una regressione**: ha
  tolto i glifi `☑`/`☐` dalla stampa e ha messo `Taken` solo sulle opzioni marcate, quindi le sette
  non marcate stampano **un nome e nessuna casella**, sotto un'intestazione che continua a contare
  «1 marked · 4 earned». La primitiva giusta era già nel file e inutilizzata (`.dhc-tick`,
  `sheet.css:468`).
- **Le due regole di punta del branch non sono trattenute da nessun test.** Invertendo
  `Play.tsx:261` (`setTrait('spellcast')`, la frase per cui esiste il commit `19ddfa8`) e
  `Play.tsx:248` (`setTrait(form.attack.trait)`), la suite resta **134/134 file e 3273/3273 test
  verdi**. Misurato due volte da agenti indipendenti, eseguendo la suite intera. In tutto **cinque
  test dimostrati vacui**.
- Restano difetti vivi che il branch ha creato: il tratto Beastform che resta quello vecchio dopo
  un cambio di forma (`Play.tsx:246`, 3 verificatori su 3, gravità alta su tutti), e due crash
  della classe che il branch aveva già corretto una volta.

**Ma quel run è a sua volta incompleto** — fase 3 arrivata a 29 candidati su 36, Critic e Synthesis
mai partite — quindi i suoi rilievi non hanno passato il vaglio che il suo stesso disegno prevedeva.
Le **nove prove per mutazione** che avrebbero deciso sono elencate in §38 di quel file con il colore
atteso, e **non sono mai state eseguite**.

### 1.2 Le nove domande hanno avuto risposta, e tre di esse costano insieme

`docs/handoff/DECISIONI-2026-08-23.md` (`78b10fc`). Nessuna è stata eseguita.

Le decisioni **1, 6 e 8** — una scena diventa una riga sola, la sessione guadagna un ciclo di vita,
un countdown registra la triade — **finiscono tutte e tre in `Campaign`** e passano tutte da
`CAMPAIGN_SCHEMA_VERSION` (oggi **2**, `shared/campaigns.ts:99`). Farle separate significa tre bump,
tre convertitori, tre giri di fixture e tre volte i test di trasferimento. `BACKLOG.md:3129` porta
già questa lezione scritta per un caso più piccolo.

E una trappola di lettura: **`:3136` è chiusa sulla carta e non in `BACKLOG.md`.** Le righe `:3136`
e `:3140` sono ancora `- [ ]` sotto *«Still open»*, e `:3138` dice ancora «ask Giorgio». Spuntarle è
lavoro da fare.

---

## 2. Stato, misurato il 24 agosto

- Branch **`beast-sheets`**, sopra `main` (= `f0c23f1`, invariato). **Conta i commit con
  `git rev-list --count main..HEAD` invece di fidarti di un numero scritto** — questo numero è già
  andato stantio due volte, e `e69cf17` è un commit che esiste solo per averlo corretto una volta.
- **3273 test su 134 file**, verdi. `tsc --noEmit` pulito. `npm run build` verde.
- Node **v24.19.0** via `. ./env.sh`. Il Node di sistema è **26** e nasconde `localStorage` a jsdom:
  una suite verde sotto quello è **più debole** di quella di CI. Ogni conteggio in ogni documento è
  stato preso sotto il 24.
- **Non unito, non pushato.** Nessun `origin/beast-sheets`. Altri branch: `backup-pre-rewrite`.
- `data/srd-1.0.json` **ricostruito** su questo branch: 80 sezioni di regole (erano 75 su `main`).

### La riga che il handoff precedente sbagliava, e conta più delle altre

Diceva **«il branch è completo e verificato»**. I cancelli verdi **non sono la verifica**: la suite è
verde attraversando l'inversione delle due regole per cui il branch esiste. Il branch è **completo**,
la sua **verifica è aperta**.

---

## 3. Cosa fa il branch

Il Beastform del Druido e il compagno del Ranger, resi giocabili. **Tutti e tredici gli hash
verificati uno per uno, e ogni messaggio corrisponde alla sua glossa.**

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
| `c88bd21` | l'audit del branch e le sue correzioni — **vedi §5, sei delle sette sono incomplete** |

Sopra questi, i commit di documento: `9b83e8f`, `60884db`, `e69cf17`, `508fb45`, `78b10fc`, e del 24
agosto `b6a1ccd` (la verifica recuperata) e `accf7d8` (i journal svuotati).

---

## 4. Tre scostamenti dalle decisioni prese, tutti ancora validi

Ri-verificati nel codice il 24 agosto. Sono decisioni, non sviste.

1. **Il folio 19 è escluso.** È il ROGUE. `shared/parsers/rules.ts:34-36` lo dice; pinnato da
   `tests/ui/srdReference.test.ts:927`.
2. **Il codec binario resta al formato 2.** Il numero successivo è **4**, non 3 — ri-derivato in
   modo indipendente: Hamming(1,2)=2, il 3 sta a un bit da entrambi e degrada al formato 1, che non
   ha checksum. Il bump di *schema* è stato fatto. I file portano `damageType`, il QR no: **quarta
   perdita deliberata**, asserita su entrambe le strade (`codec.test.ts:641-668`,
   `fileIo.test.ts:445,450`).
   **Debito aperto:** `Architecture.md:461-462` dice ancora *«un elenco che deve restare di tre voci
   esatte»* mentre `codec.ts:34` ne dichiara **quattro**. Quella frase era stata scritta dal bump
   precedente (`18265c5`) proprio per costringere l'aggiornamento, e **questo branch non ha toccato
   nessun `.md`**.
3. **L'Esperienza del compagno al level-up è applicata, non offerta** (`levelUp.ts:487-506`), perché
   *"your companion also gains one"* non offre niente.

E una cosa lasciata fuori di proposito: **le righe del loadout non sono marcate** in forma animale.
Su una riga da 46px a 393px l'unico segno che ci sta è un colore, e questo progetto non accetta il
colore da solo (`prefs.shapeCoding` è la prova).

---

## 5. L'audit del branch, e cosa la verifica ne ha detto

`c88bd21`. **Sette rilievi, tutti veri**: la verifica li ha ri-controllati eseguendo e tutti e sette
hanno retto (`fixIsCorrect: true` su tutti e sette).

**Le correzioni sono un'altra cosa.** Sei delle sette sono incomplete e cinque portano rischio di
regressione. Il dettaglio sta in `VERIFICA-BRANCH-2026-08-23.md` §1, una per una. La più cara è la
#4, che è una regressione vera e propria (§1.1 qui sopra), e la #6, che ha sostituito
un'asserzione debole con **un'asserzione che riproduce esattamente il difetto che sostituiva** — e
la cui lane ha poi trovato gli altri cinque test vacui.

Il P0 originale resta descritto correttamente: il party board del DM **andava in crash** su
qualunque compagno salvato prima di questo branch, perché `readPartyMember`
(`shared/campaigns.ts:628`) fa `sheet as unknown as PartyMember['sheet']` e **la catena di
migrazione dei personaggi non gira mai** su quelle copie. Una correzione mirata è stata fatta e i
suoi test la trattengono. La **classe** di difetto no.

---

## 6. Il pericolo che resta in piedi — misurato, ed è peggio di come era scritto

Le schede conservate dentro una campagna **non passano mai dalla catena di migrazione dei
personaggi**. `readPartyMember` (`shared/campaigns.ts:617-634`) guarda **due cose sole** — che
`sheet` sia un oggetto e che `sheet.name` sia una stringa — e poi fa
`sheet as unknown as PartyMember['sheet']` alla riga **628**. `migrateCharacterRecord` non è mai
chiamato. `readCampaignRecord` gira solo `CAMPAIGN_MIGRATIONS`, la cui unica voce ha per corpo
`(r) => ({ ...r })`: non cambia nessun campo e **non scende mai dentro `party`**.

**Ogni percorso di caricamento arriva a quel cast**: IndexedDB (`src/store/campaigns.ts:72` e
`:162`), un `.dhcampaign` da disco (`src/transfer/campaignFile.ts:155`), e — il peggiore —
`campaignFromLegacy` (`src/store/campaignMigration.ts:209`), che passa `party: legacy['party']`
dritto dal vecchio blob `dhc.gm.v1` in localStorage: schede scritte da build a schema **3 o 4**,
mai migrate da allora.

### Otto modi di far cadere il party board, riprodotti eseguendo

Non dedotti: costruiti come riga di party attraverso `readCampaignRecord` e renderizzati.

| campo mancante o sbagliato | dove | cosa succede |
|---|---|---|
| `levelUpHistory` | `PartyBoard.tsx:357` → `character.ts:227` | `.filter` su `undefined` — **prima che si disegni qualsiasi cosa** |
| `subclassRefs` / `ancestryRefs` | `:663` / `:664` | `not iterable`, e scatta **prima** che il drawer sia aperto |
| `experiences` | `:620` / `:629` | `.length` su `undefined`; `Experiences` è su ogni riga, non dietro un fold |
| `companion.damage` | `:528` → `companion.ts:83` → `dice.ts:245` | `.replace` su `undefined` |
| `companion.name` assente o numerico | `:541` | `.toUpperCase` — e `=== ''` non copre né l'uno né l'altro |
| `companion.stress` | `:529`, `:546-547` | `.max` su `undefined` |
| i quattro contatori | `gmStore.ts:1093` → `party.ts:38-41` | dentro un'**azione di store**, cioè **fuori** dal confine d'errore di React |

E il controllo che dice tutto: **un compagno senza `damageType` si disegna benissimo.**
L'unico campo che ha un test di regressione è l'unico campo che non esplode.

`PartyBoard.tsx:503-517` porta un docblock che dichiara *«NOTHING HERE MAY ASSUME A FIELD IS
PRESENT… this reads by comparison and never by method call»*. La riga **541**, dentro il componente
che quel docblock introduce, è `companion.name.toUpperCase()`.

**Non sono violazioni**, per il verbale: `:545` `String(companion.range).toUpperCase()` — `String()`
la rende totale; `:546` `companion.damageType === 'mag' ? …` — è la correzione di schema 5, verificata
sicura.

### La regola va allargata

> Niente in `src/ui/gm/` può chiamare un metodo su un campo di `PartyMember.sheet`, **né passarlo a
> una funzione che lo fa**.

`PartyBoard.tsx:528` non chiama un metodo sul campo: lo passa a `companionDamage`, che scende a
`parseDamage` e finisce su `spec.replace()`. La regola vecchia lo mancava. E nota la forma della
svista: `parseDamage` è **totale per una stringa spazzatura** (`parseDamage('nonsense')` torna
`null` e il board stampa `NO DIE`) e **fatale per l'assenza** — la sua unica guardia,
`if (!parsed) return null`, sta **una riga troppo tardi**.

### E due porte che nessuna regola su `src/ui/gm/` poteva chiudere

`checkShapes` (`src/transfer/fileIo.ts:277-282`) valida `companion` **solo per «è un oggetto»**:
non nomina `name`, `damage`, `range`, `stress`, `evasion`, `damageType`, `experiences` né
`upgrades`. `companion: {}` viene accettato e riesce fuori identico.

1. **`attack.ts:373` passa `companion.damageType` grezzo, `:578` gli chiama `.toUpperCase()`.**
   L'asimmetria è il difetto: il ramo dell'arma, a `attack.ts:220`, **coercizza**
   (`weapon.damageType === 'mag' ? 'mag' : 'phy'`). Un `.dhchar` modificato a mano con
   `damageType: 42`: se è **timbrato 5 o non timbrato**, zero convertitori, il 42 sopravvive e
   esplode al primo tiro di danno. Se è timbrato **4**, il convertitore lo riscrive a `'phy'`.
   **È il timbro vecchio a salvarti, non quello onesto.**
2. **`src/ui/print/CharacterSheet.tsx:377`** chiama `sheet.companion.range.toLowerCase()` — la stessa
   classe, sulla strada della stampa invece che su quella del DM.

### Quanto costa chiuderlo davvero

La correzione strutturale è far girare `readCharacterRecord` dentro `readPartyMember`, ma oggi quella
funzione **ripara** dove il lettore dei personaggi **rifiuta o mette in quarantena**: è un cambio di
design, e la decisione è del proprietario. **Il momento naturale per prenderla è il bump di
`CAMPAIGN_SCHEMA_VERSION` che le decisioni 1+6+8 impongono comunque** — e quel bump è stato
dimensionato: **ventiquattro punti**, fra cui tre file di fixture nuovi da committare, `v1` e `v2`
da tenere **byte per byte** immutati (`campaignSchema.test.ts:494-511` confronta sotto
`JSON.stringify`, quindi basta una chiave riordinata per fallire), due `2` scritti a mano che si
rompono (`campaignSchema.test.ts:511`, `campaignFile.test.ts:290`), e il docblock di
`countdownTemplates.ts:19-32` che **argomenta per esteso contro** l'aggiunta di un decimo campo a
`Campaign` proprio perché forzerebbe questo bump — argomento che la decisione 8 riapre.
**Le «tre suite di test» di `PROGETTO-GM` §6 step 7 sono una sottostima.**

## 7. Cosa fare, in ordine

Questo ordine sostituisce il §7 precedente, che è stato scritto prima delle risposte e prima della
verifica. **Undici delle sue diciotto affermazioni sono state trovate false o superate.**

### Il cancello prima del merge — circa una giornata

Non perché siano stati trovati trenta difetti: la maggior parte è normale arretrato. Perché **le sei
correzioni incomplete stanno nel commit il cui unico scopo era rendere questo branch idoneo**, e
perché le due regole per cui il branch esiste non sono trattenute da niente.

1. **Trattieni le due regole di punta.** Test che diventano **rossi** invertendo `Play.tsx:248` e
   `:261`. Le mutazioni sono già state eseguite: si sa che oggi restano verdi. *(2-3 h, cinque test.)*
2. **Disfa la regressione di stampa.** `.dhc-tick` è già nel file. *(< 1 h, col test.)*
3. **Chiudi i due crash vivi** — `attack.ts:373`/`:578` e la clausola mancante di `checkShapes`.
   *(2-3 h, due test rossi prima.)*
4. **Il tratto Beastform stantio** (`Play.tsx:246`): un effetto di ri-sincronizzazione, più il caso
   DROP-poi-trasforma che nessuno aveva visto. *(mezza giornata.)*
5. **Paga il debito `.md` e di fixture del bump 4→5** — `Architecture.md`, `HANDOFF.md:65-66`,
   `tools/sampleCharacters.ts`, le fixture `v5` inerti. Con esso le **sei affermazioni false** che
   `c88bd21` ha aggiunto o mancato: nessuna prova per mutazione può prenderle, perché sono prosa.
   *(3-4 h, un solo passaggio.)*
6. **Le nove prove per mutazione**, `VERIFICA` §38 (a)–(i): una alla volta, mai in parallelo, in una
   directory dal nome unico, col mutante verificato presente **prima e dopo**. Eseguile contro
   l'albero **corretto**, così una prova che resta verde è un risultato e non rumore.

Poi, e solo poi: **7. la decisione su `beast-sheets`** — merge, PR o lasciarlo. `main` è fermo a
`f0c23f1` con 0.5.0 pubblicata, quindi **aspettare non costa niente**, e decidere adesso vuol dire
decidere su prove che non hai ancora letto.

### Dopo il merge

8. **La sezione Legal del README** (`DECISIONI` §3) — l'unica decisione senza codice, senza dataset e
   senza schema. Indipendente da tutto. *(1-2 h.)*
9. **Il passaggio su `BACKLOG.md`**: un commit solo, prima di ogni codice. Usa gli **undici blocchi
   già scritti** in `RECUPERO-JOURNAL-2026-08-24.md` §1 invece di riderivarli. Nello stesso commit,
   apri le voci che `VERIFICA` ha trovato e che nessuno ha ancora archiviato. *(90 min.)*
10. **Witherwild fuori** e la **rinomina totale** (`DECISIONI` §4 e §5). Comportano una ricostruzione
    del dataset e il rimescolamento di stampe e test.
11. **Il bump unico `CAMPAIGN_SCHEMA_VERSION` 2→3**, che porta le decisioni 1+6+8 **insieme**, e dove
    si decide anche `readPartyMember`. *(più giorni.)*
12. **`PROGETTO-GM` §6 step 1 — verità sul vetro.** Nessuno schema, nessuna dipendenza da Layout B, e
    il blocco di valore più grande che non aspetta niente. Può correre in parallelo con 10 e 11.
13. **Layout B**, col **vincolo duro** di `DECISIONI` §2: **THE NIGHT è una scheda, non un modale** —
    oggi ogni strumento DM monta a `inset: 0; z-index: 30` con `useDialog` che intrappola il Tab,
    quindi mentre la scena è aperta **il Fear è coperto e irraggiungibile da tastiera**.
14. **Il tiro dei danni legge le riserve** (`BACKLOG-PLAN` §2 #3, Design C) — e nello stesso passaggio
    i due difetti vivi che `RECUPERO-JOURNAL` ha recuperato: `DualityRoll.tsx:791` non ha `bonus` nel
    tipo di `fixed`, e `DicePools.tsx:191` chiama `cryptoRng` senza leggere nessuna preferenza.
    **La nota «bloccato» in due documenti va cancellata, non aggiornata.**
15. `PROGETTO-GM` §6 step 3-6, poi **il passaggio di misura in Chrome — una lane sola, un rig solo,
    tutto insieme.**

---

## 8. Cosa non toccare

- **Il cancello H-9 resta chiuso**: inset orizzontali, rail dei Cards, overlay, `--control`,
  voci 7, 8 e 19. `GmTabs` entra in quella lista, non ne chiede l'esenzione.
- Le sezioni rilasciate di `CHANGELOG.md`.
- Di `HANDOFF.md` si mantiene **solo il cartello** — e proprio per questo il fatto che
  `HANDOFF.md:65-66` sia stantio (dice `SCHEMA_VERSION` 4, `shared/types.ts:16` dice 5) è un
  conflitto vero, da decidere esplicitamente e non da correggere di nascosto.
- **Mai `git add -A`.** `node_modules`, `.tools` e `Manuali` sono directory vere nella radice e
  symlink solo dentro i worktree.
- **Non spuntare niente in `BACKLOG.md` su un «probabilmente».** Il giro di confutazione **è stato
  fatto**: cinque spunte, uno split, un reword, tre restano aperte.
- **`:1653` va spezzata, non spuntata.** `AppBoundary.tsx:60-62` porta ancora il difetto identico.
- **`SESSION_ITEM_KINDS` che omette `url` e `note` è deliberato** e pinnato da un test.

---

## 9. Cinque cose sul codice che costano un pomeriggio se le riscopri da solo

- **`readPartyMember` non migra le schede.** §6. È la più cara.
- **`update` nello store è l'unico imbuto** di ogni scrittura **sulla scheda** di un personaggio: 26
  siti in `src/ui` ci passano, e `dropFormOnLastHitPoint` ha un solo chiamante in `src/`
  (`state.ts:466`, dentro `update`). Gli altri cinque siti assegnano l'**array** `characters` —
  boot, create, remove, import, resolveImport — e nessuno muta una scheda esistente. Non deve
  diventare un hook di normalizzazione: `syncCounters` e `boundCounters` sono la forma per quello.
  *(Un giro di audit ha sostenuto che fossero «sei scrittori e cinque bypassano il drop». La
  confutazione l'ha smontato: non è fortuna, è costruzione, ed è pinnato.)*
- **La stampa disegna «hairlines instead of filled panels, outlines instead of solid pips»** — così
  dice il rigo 7 del suo foglio di stile, e **non** «non riempie mai». `PrintDomainMark` e `CoinRow`
  riempiono di proposito. La parafrasi più forte è una delle affermazioni false che `c88bd21` ha
  introdotto (`CharacterSheet.tsx:419`): non portarla avanti. Resta vero che `TickRow` è l'idioma e
  che un glifo Unicode è tofu dove il font non lo copre.
- **`parseRules` esige che ogni unità appartenga a una sezione**: una contaminazione da un folio
  vicino è **silenziosa**, con la validazione ancora verde. Per questo esistono i test sul ROGUE.
- **jsdom non misura niente.** Le superfici cambiate e mai misurate sono **sei**, non due:
  (1) `SpellcastLine` — che vive in **due** posti, `Identity` nel cockpit (`Play.tsx:587`) e
  `Lineage` sul telefono (`:662`); (2) la scatola ATTACK del compagno; (3) `CompanionLine` sul party
  board — e questa non è un pixel non misurato ma **una possibile violazione di `shapeCoding`,
  perché `· OUT OF THE SCENE` è l'ultima cosa sotto `nowrap`/`ellipsis` e a troncarsi resta il solo
  colore; (4) il `BeastformSeal`; (5) la nuova riga d'attacco Beastform; (6) la sezione compagno
  della pagina stampata. Il rig di misura esiste già: **riusalo, non ricostruirlo.**
