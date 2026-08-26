# La gestione delle scene — cosa è rotto, e cosa dovrebbe essere

**26 agosto 2026.** Nato da una frase del proprietario al tavolo: *«non si capisce niente di
questa gestione delle scene, come dovrebbe funzionare?»*, dopo che aprendo la seconda di due
righe `SCENE` l'app gli aveva aperto la prima.

Solo documento. Nessuna riga di codice cambia con questo commit.

---

## 1. Il modello, come lo si direbbe a un GM

> **Ogni riga del piano di stasera è una battuta: un luogo, e la rissa che ci succede dentro.**
>
> **Il tavolo ne fa girare una alla volta — quella riga dice che è lei, e tutte le altre dicono
> qual è.**
>
> **Far partire una riga sul tavolo sgombera quello che ci ha lasciato la riga precedente, e ti
> dice quante ferite segnate costa prima di farlo.**

Tre frasi, nessun gergo. Nessuna delle tre è vera oggi. **La prima è già vera nel record dal
23 agosto e falsa sullo schermo.**

---

## 2. Il buco vero: la decisione 1 ha spostato i campi e ha lasciato indietro i verbi

`DECISIONI-2026-08-23.md` §1 ha dato alla riga scena i tre campi della rissa. Il record lo dice,
e il suo docblock la chiama con le parole che il proprietario si aspettava —
*«A beat of the evening: a place, and the fight that happens in it.»*

```ts
// shared/campaigns.ts:338-344
| (SessionItemBase & {
    kind: 'scene';
    environmentRef: Ref | null;
    roster: RosterEntry[];
    adjustments: EncounterAdjustments;
    combatants: SceneCombatant[];
  })
```

**`SceneArm` non legge nessuno dei tre.** Disegna un `<select>` e tre verbi. Verificato con un
grep sul corpo della funzione: zero occorrenze di `roster`, `adjustments`, `combatants`.

Tutti i controlli della rissa — la lista roster, i chip degli adjustment, la citazione del damage
bump, `PUT THIS ROSTER ON THE BOARD` (`SessionBody.tsx:564`), `KEEP THE BOARD'S ROSTER HERE`
(`:570`), `OPEN THE BUILDER` (`:573`), `OPEN THE FIGHT` (`:585`) — stanno su `EncounterArm`, cioè
sul tipo che **nessuno può più creare**: `SESSION_ITEM_KINDS` (`shared/campaigns.ts:279-291`)
elenca `scene`, `link`, `url`, `countdown`, `note`, e `encounter` non c'è, per decisione.

La conseguenza si vede a occhio nudo: `AddSheet`'s `TAKE THE n ON THE BOARD NOW` scrive un roster
sulla riga scena, `describeItem` lo stampa sull'intestazione chiusa come `3 PLANNED`
(`src/ui/gm/session.ts:214`), il GM apre la riga e trova un menu a tendina.

**Questo è lavoro non finito, non una decisione.** Nessun registro dice che la riga scena debba
essere muta sulla rissa che porta.

### 2.1 Il verbo che mente, e la didascalia che se ne scusa

`OPEN THE SCENE` (`SessionBody.tsx:361`) è `onOpenTool('scene')`: pura navigazione. Dodici righe,
dodici pulsanti identici, una schermata sola dietro tutti. E due centimetri sopra, `:343-346`:

> *«This is the plan. The scene runner shows whatever environment is on the board right now, which
> is one per campaign — {onBoard ? 'and it is this one.' : '**and it is not this one.**'}»*

**L'app dice al GM che il pulsante è sbagliato, e poi lo disegna comunque.** È la frase su cui è
caduto l'occhio del proprietario.

Peggio per chi usa VoiceOver: `Verb` mette il nome della riga nel nome accessibile
(`SessionBody.tsx:253`), quindi il bottone si annuncia `OPEN THE SCENE — kok` — promette *kok* per
nome — e la didascalia che lo smentisce non è dentro il controllo.

### 2.2 Due promesse già false in prosa

- `AddSheet.tsx:157` — la scena *«carries a roster you can put back on the board»*. **Non esiste
  nessun controllo del genere.**
- `AddSheet.tsx:53-61` — descrive ancora `encounter` come uno dei form che ADD offre. Falso dallo
  schema 3.

---

## 3. Decisione contro incidente — la distinzione che conta più di tutto il resto

| Fatto | Cos'è | Prova |
|---|---|---|
| Una scena è **una riga sola** per battuta | **DECISIONE**, eseguita | `DECISIONI-2026-08-23.md` §1; `shared/campaigns.ts:324-344` |
| `encounter` non si converte da solo e non rientra in `SESSION_ITEM_KINDS` | **DECISIONE**, viva, coi denti | `shared/campaigns.ts:345-359` |
| `END SCENE` = `commit({ combatants: [] })` e nient'altro | **DECISIONE** | `gmStore.ts:840`; `Scene.tsx:232-241` |
| La riga legacy `ENCOUNTER` offre di diventare una scena, un tocco, al suo posto | **DECISIONE presa, mai eseguita** | `HANDOFF-2026-08-25.md` §2.1; deprioritizzata a `HANDOFF-2026-08-26.md` §7 punto 9 |
| «Conferma sempre, non solo a Scena occupata» | **DECISIONE presa, mai eseguita** — oggi è un *avviso* (`SessionBody.tsx:547-553`) accanto a un `openFight` che parte al primo tocco | `DECISIONI-2026-08-18.md` §A punto 2 |
| **«un ambiente per campagna» / «una scena viva per campagna»** | **INCIDENTE.** Nessun registro lo decide | Cade fuori da `Campaign.board` che è un oggetto solo (`shared/campaigns.ts:501-508`). Il suo docblock a `:494-499` giustifica **a chi appartiene** la board, mai **quante ne esistano** |
| **`SceneArm` senza verbi di rissa** | **INCIDENTE.** Non deciso: non testato. Ogni fixture scena sparge `NO_FIGHT` (`tests/fixtures/factories.ts:249`), quindi quel braccio è genuinamente scoperto | §2 |
| **`OPEN THE FIGHT` che aggiunge invece di sostituire** | **INCIDENTE argomentato in un docblock** (`SessionBody.tsx:60-74`), non nel registro | `DECISIONI-2026-08-18.md` punto 1 chiede «un pulsante che apre la rissa», non «additivo» |

**La riga che conta: tutto ciò che rende confusa la gestione delle scene sta nella colonna
INCIDENTE. Non serve ribaltare niente per sistemarla.**

---

## 4. La raccomandazione, in due fasi che si fermano bene entrambe

### Fase 1 — nessun cambio di schema. `CAMPAIGN_SCHEMA_VERSION` resta 3.

**4.1 `src/ui/gm/FightBlock.tsx`, nuovo file.** Il corpo di sola lettura estratto da `EncounterArm`
— **spostato, non riscritto**: lista roster con le disclosure `AdversaryBlock`, chip degli
adjustment, citazione del damage bump, il fatto sulla rissa salvata. Montato da **tutti e due** i
bracci. Questo da solo chiude il §2: `3 PLANNED` sull'intestazione e il roster sotto smettono di
essere due app diverse.

**4.2 I verbi della riga scena.**

| Etichetta | Cosa fa | Spento quando |
|---|---|---|
| `PUT THIS PLACE ON THE BOARD` | `setEnvironment(item.environmentRef)` — la capacità odierna sopravvive intatta, col nome che dice cosa muove | già viva ∥ ref `null` |
| `KEEP WHAT IS ON THE BOARD` | `patch(...)` allargata ai tre campi | i tre coincidono |
| `OPEN THE BUILDER` | `onOpenTool('encounter')` | mai |
| **`START THE FIGHT HERE`** *(primario, si arma)* | `clearScene()` → `setEnvironment(...)` → `spawn(...)` per ogni voce → `onOpenTool('scene')` | niente da far partire |
| `GO TO THE SCENE` *(primario **al posto** di START quando non c'è rissa)* | `onOpenTool('scene')`, non scrive mai | mai |

**`OPEN THE SCENE` sparisce.** Lo slot primario resta uno solo per riga — la regola è già a
`SessionBody.tsx:574-579` — e la sua parola diventa vera.

**4.3 L'armamento chiude il punto 2 del 18 agosto.** `START THE FIGHT HERE` si arma **sempre**,
anche a tavolo vuoto: `Scene.tsx:68-79` ha già respinto per nome la variante condizionale — *«un
controllo il cui numero di tap dipende da uno stato che il GM non sta guardando»*. Etichetta
armata: `TAP AGAIN — CLEARS 4 MARKED`, oppure `TAP AGAIN TO START THIS FIGHT`.

**È un cambio di comportamento e va detto ad alta voce:** oggi `openFight` **accoda** e avvisa; da
qui **sostituisce** e conferma. Il gesto additivo resta dove appartiene — `ADD TO THE SCENE` nel
bestiario e `send` nel builder, che continuano ad accodare. È la ragione per cui i goblin smettono
di seguirvi dal cancello al boschetto.

**4.4 La didascalia va cancellata, non riscritta** — `WAVE3-2026-08-24.md` §6: una pretesa che non
discende più da una dichiarazione apribile si rimuove. Al suo posto il paragrafo del costo, nella
forma già approvata di `Scene.tsx:253-258`:

> *Il tavolo tiene 4 avversari. Far partire questa riga li butta, con ogni segno su di loro. Ci
> mette 6 avversari a PF pieni, nel Burning Heart of the Woods. La riserva di Fear e i countdown
> restano.*

Il conteggio viene da `plannedAdversaries` — oggi `const` privato a `session.ts:172`, **da
esportare** — così l'intestazione chiusa e la frase non possono litigare su quanti corpi sia un
gruppo di Minion.

**Dopo la fase 1** il GM ha una riga che mostra la rissa che porta, un pulsante primario che fa
quello che dice, una conferma prima di buttare dei segni, e la frase *«and it is not this one»*
sparita. Quello che **non** ha: sapere quale riga sta girando guardando la lista chiusa.

### Fase 2 — un campo solo, `CAMPAIGN_SCHEMA_VERSION` 3 → 4.

`GmBoard` guadagna `runningItemId: string | null`, e **la sua semantica è la metà del valore**:
non significa *«la board contiene questa riga»* — pretesa che diventa falsa appena il bestiario
accoda — ma *«il GM ha fatto partire il tavolo da questa riga e non ne ha fatta partire un'altra»*.
Un fatto storico, che non può diventare falso. La deriva si **mostra**, non si sincronizza: quando
`live !== item.environmentRef` la riga stampa *«The table's place is no longer this row's»*, e il
conto degli avversari viene da `combatants.length`, mai dal roster della riga.

**Il precedente è già in casa:** `gmPartySize` non si deriva da `party.length`, e la risposta
spedita è `partySizeDisagreement` — una schermata che *mostra* il disaccordo invece di risolverlo.
Questa è la stessa mossa su un secondo campo.

Compra il chip **`● ON THE TABLE`** sull'intestazione chiusa, su una riga sola. Con la lista chiusa
il GM vede dove sta senza aprire niente.

Il convertitore è una **copia pura** come gli altri due, perché il lettore fornisce il default:
`shared/campaigns.ts` dice di quella catena *«Both entries are deliberately empty of work, and that
is the point rather than an omission»*, e il test che la pinna si intitola *«carries one converter
per bump, in order, and none of them is a repair»*.

### Cosa è stato progettato e rifiutato

**La rissa viva per riga** — cancellare `GmBoard.combatants` e darla alla riga. È il modello più
pulito e non si spedisce: **~716 test**, il primo convertitore non puro di una catena il cui
docblock dice che i convertitori non riparano, l'archivio che registrerebbe per sempre risse mai
finite come «cosa è successo», e i tap del combattimento che scrivono nello stesso array che il
drag riordina. La sua stessa sezione di ripiego dà le identiche tre frasi del §1 a un terzo del
costo.

**RESUME / il parcheggio delle scene** batte sé stesso, e ha ragione: una rissa non è
`SceneCombatant[]`, è anche PF, Stress e Speranza dei giocatori, che vivono in `src/store/state.ts`
dove `gmStore` non arriva. RESUME rimetterebbe a posto la metà del GM e lascerebbe cadere in
silenzio quella del tavolo, sotto una parola che promette tutto.

---

## 5. Quanto costa, e il cancello che non è una cortesia

**Fase 1:** cinque file. **~28 test toccati su ~3208** (0,9%), **~22 nuovi** — fra cui i primi
test in assoluto di un braccio scena con un roster reso, che oggi non esistono. Restano intatti i
~477 semi `useGm.setState`, i test di persistenza, le quattro fixture congelate.

**Fase 2:** più `shared/campaigns.ts`, `gmStore.ts`, `SessionRow.tsx`, `campaignMigration.ts`, e
una fixture congelata `v4.campaign.json` in più. `OLDEST_READABLE_CAMPAIGN` resta 1, `DB_VERSION`
resta 2, `DB_NAME` non si muove.

**La misura in Chrome è un cancello, non una cortesia.** `useSessionDrag.ts:44` registra che
*«opening the first scene row measures it at 384.72»* contro un passo chiuso di 62.00, e il braccio
passa da *(select + un Fact + tre bottoni)* a *(select + disclosure roster + chip + fino a tre Fact
+ paragrafo del costo + cinque verbi)*. `HANDOFF-2026-08-26.md` §5.1 è l'avvertimento contro la
stima: **l'ultima misura di questo tipo è tornata più dura della domanda** — 471.00px di carta
contro un pannello da 498, *«non ci stava una carta, non due»*.

Da misurare a 393×852: l'altezza della riga aperta a 0, 1, 3 e 6 voci di roster; il passo di
`useSessionDrag` con una riga aperta in una serata da dodici; e **le righe a capo della striscia
dei verbi** — cinque bottoni a `var(--tap)` su un `flexWrap` a 393px prendono verosimilmente tre
righe. Se succede, la risposta è un `Fold`: **H-9 è chiuso, quindi una rail laterale non c'è**
(`WAVE3` §8). Attenzione, però: il grosso dell'altezza è la lista roster, che un `Fold` sui verbi
non tocca.

---

## 6. Le decisioni in piedi, e nessuna va ribaltata

Rispettano e completano: `DECISIONI-2026-08-23.md` §1; il *«Legacy. Readable and editable, and no
longer creatable»* di `shared/campaigns.ts:345`; `END SCENE`; il punto 9 del 18 agosto; il
`gmPartySize` di `WAVE3` §8, di cui la fase 2 **estende il principio**.

Rispetta anche la regola fondativa citata a `SessionBody.tsx:53-58` — *«no action in `gmStore` sets
the combatant list wholesale, and inventing a button that silently dropped them would be exactly
the kind of quiet wrongness the founding rule is about»*. `START` è **composta** da `clearScene` +
`setEnvironment` + `spawn`: nessuna primitiva nuova, e i segni non cadono in silenzio — cadono
sotto un'etichetta armata che li conta.

**Tre voci vanno ratificate esplicitamente, non date per scontate:**

1. **`SessionBody.tsx:60-74`** argomenta che `OPEN THE FIGHT` è additivo per scelta. Non è una voce
   di registro — il punto 1 del 18 agosto chiede un pulsante che *apra* la rissa, non che accodi —
   ma è comunque un cambio visibile.
2. **`DECISIONI-2026-08-18.md` §A punto 2** dice «conferma sempre». La proposta la stringe a *«arma
   ciò che sostituisce, non ciò che accoda»*. È **più stretto** di quanto deciso.
3. **`PROGETTO-GM-2026-08-23.md:95`** — *«Neither *stored row* is a scene. **The board is.**»* La
   fase 2 la tiene vera e le aggiunge una memoria. Non c'è regola da violare, ma è una lettura del
   proprietario e non va ratificata per silenzio.

---

## 7. Le domande aperte

1. **«Non si capisce niente» voleva dire *non capisco cosa fanno questi pulsanti*, o *ho pianificato
   quattro scene e l'app ne regge una sola*?** La prima: la fase 1 la chiude quasi tutta, la fase 2
   la chiude. La seconda: nessuna delle due la risolve — due risse vive in parallelo è il modello
   rifiutato al §4. **Se è la seconda, questa proposta è comunque la prima metà**, perché *quale
   riga* è la domanda a cui quel design deve rispondere prima di ogni altra.
2. **Il bump 3→4 viaggia da solo o porta con sé l'annidamento?** L'annidamento è *sbloccato ma non
   deciso* (`DECISIONI-2026-08-18.md` punto 8) e vorrà un campo su `SessionItemBase`. Se si decide
   adesso, viaggiano insieme; se no, la fase 2 spende il bump e il prossimo sarà il quinto.
3. **Dopo la fase 1, volete ancora la fase 2?** La fase 1 si ferma bene da sola. Provatela a un
   tavolo vero prima di spendere il bump.

---

## 8. Provenienza, e cosa è stato verificato a mano

L'indagine è un workflow a quattordici agenti — cinque lettori in parallelo sullo store, sul
runner, sui bracci del piano, sui documenti e sui test; quattro progetti indipendenti da angoli
diversi; quattro giudici avversari; una sintesi. Run `wf_17067b53-89d`.

Le prove su cui questo documento poggia sono state **rilette a mano** dopo, non prese per buone:
la forma della riga scena a `shared/campaigns.ts:338-344`; il grep sul corpo di `SceneArm` che non
trova nessuno dei tre campi; `SESSION_ITEM_KINDS` senza `encounter`; i quattro verbi di rissa su
`EncounterArm`; la promessa falsa di `AddSheet.tsx:157`; il `3 PLANNED` di `session.ts:214`; il
`case 'encounter':` a `SessionBody.tsx:281`; il 384.72 di `useSessionDrag.ts:44`; `NO_FIGHT` a
`factories.ts:249`; e la frase di `PROGETTO-GM-2026-08-23.md:95`.

Una citazione dei giudici era sbagliata ed è corretta qui: la frase *«a pointer from the campaign
to "the primary…"»* sta a `shared/campaigns.ts:633`, dentro il docblock di `countdownsOf`, non
accanto a `withPrimaryCountdown`, che è a `:654`.

**Una memoria di lavoro è stata trovata falsa e riscritta nello stesso giro:** diceva che
`SESSION_ITEM_KINDS` ometteva `url` e `note` di proposito. Le omette non più — gli item 12 e 14
l'hanno allargata entrambi, e il literal porta ora un commento che dice perché i due posti stanno
lontani. Ciò che resta vero, e ha i denti, è che `encounter` non ci rientra.
