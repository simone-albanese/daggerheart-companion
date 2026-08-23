# Messaggio di ripresa — branch `beast-sheets`

Da incollare in una sessione nuova.

---

Riprendiamo il Daggerheart Companion, sul branch **`beast-sheets`**.

Leggi `docs/handoff/HANDOFF-beast-sheets-2026-08-23.md`, e dentro quel file vai a **§1 prima di
ogni altra cosa**: dice dove sono finiti i risultati di tre workflow lasciati girare, e perché non
si possono riprendere ma solo leggere. Poi §2 (stato misurato), §6 (il pericolo che resta) e §7
(cosa fare, in ordine).

`HANDOFF-2026-08-23.md` nella radice **resta l'autorità su `main`** e non è stato riscritto:
`main` è ancora `f0c23f1` / `0.5.0`, pubblicata e verificata. Il branch non è unito né pushato.

Le sei cose da sapere subito:

0. **UNO DEI TRE WORKFLOW È GIÀ ATTERRATO E IL SUO RISULTATO È NEL REPO.**
   `wf_6a80a4c1-7a8` (handoff §6) ha finito: 24 agenti, 0 errori. Il piano completo è
   **`docs/handoff/BACKLOG-PLAN-2026-08-23.md`**, committato. Il giro di confutazione che
   mancava alle 10 voci `[NON verificato]` **è stato fatto**: 7 giudicate spuntabili, 3 restano
   aperte, e **nessuno dei 30 verdetti `[retto]` è scaduto**. Non serve leggerne il journal se
   non per i dettagli per-agente. Gli altri due restano da recuperare come al punto 1.

1. **GLI ALTRI DUE WORKFLOW NON SI POSSONO RIPRENDERE.** `resumeFromRunId`
   vale solo nella stessa sessione. Quello che resta è su disco, ed è quasi tutto: in
   `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/b9563823-72a2-4816-be80-b8e823d1a7e4/subagents/workflows/<runId>/`
   c'è **`journal.jsonl`**, che registra il valore di ritorno di ogni agente, e le trascrizioni
   `agent-*.jsonl`. Gli script sono in `workflows/scripts/`. I run sono `wf_226cd659-47e`
   (verifica dell'audit), `wf_6a80a4c1-7a8` (handoff §6), `wf_d5464f24-a49` (Core Book, scene,
   regole, domanda locale). **Leggi i journal prima di concludere che manchi qualcosa**, e se una
   lane non era arrivata in fondo rilancia *solo quella*, non lo script intero.

2. **IL BRANCH È COMPLETO E VERIFICATO, MA NON UNITO.** 13 commit, **3273 test su 134 file** verdi,
   `tsc --noEmit` pulito, build verde, albero pulito, su Node **v24.19.0** via `. ./env.sh`. Il
   Node di sistema è 26 e nasconde `localStorage` a jsdom: una suite verde sotto quello è **più
   debole** di quella di CI. Decidere cosa farne — merge, PR, o lasciarlo — è la prima domanda.

3. **C'È UN PERICOLO STRUTTURALE ANCORA APERTO, ED È IL LASCITO PIÙ IMPORTANTE DI QUESTA SESSIONE.**
   Le schede conservate dentro una campagna **non passano mai dalla catena di migrazione dei
   personaggi**: `readPartyMember` in `shared/campaigns.ts` fa il cast diretto a `Character`. Il
   prossimo campo che aggiungi a un personaggio mancherà su ogni riga di party già esistente.
   Questo branch ci ha già fatto andare in crash il party board del DM, ed è stato corretto — ma
   **la classe di difetto no**. Regola finché non si decide altro: niente in `src/ui/gm/` può
   chiamare un metodo su un campo di `PartyMember.sheet`. §6 del handoff ha il resto.

4. **TRE SCOSTAMENTI DALLE DECISIONI PRESE, TUTTI ARGOMENTATI NEI COMMIT.** Il folio 19 è escluso
   (è il ROGUE); il **codec binario resta al formato 2** contro quanto concordato, perché il 3 è
   escluso da una proprietà già fissata in `tests/adversarial.test.ts` e il 4 romperebbe la
   ricezione QR di ogni telefono non aggiornato — il bump di *schema* invece è stato fatto;
   e l'Esperienza del compagno al level-up è **applicata, non offerta**, perché la regola non offre
   nulla. §4 del handoff.

5. **NON SPUNTARE NIENTE IN `BACKLOG.md` SU UN "PROBABILMENTE".** Le **10 voci `[NON verificato]`**
   non si spuntano senza il giro di confutazione — che è esattamente ciò che `wf_6a80a4c1-7a8` ha
   fatto girare, quindi i suoi journal sono la prova, se c'è. E **`:1653` va spezzata, non
   spuntata**: `AppBoundary.tsx` porta ancora il difetto identico.

6. **jsdom non misura niente.** Sul branch ci sono due superfici cambiate e mai misurate: la riga
   Spellcast in `Identity` (il cockpit) e la geometria della scatola ATTACK nel pannello del
   compagno. Una suite verde non dice nulla su quelle: si misurano in Chrome o non sono misurate.

Cosa fare, nell'ordine di §7:

- **leggere i journal** dei tre workflow, ed eseguire le **prove per mutazione** dei rilievi
  sopravvissuti — una alla volta, mai in parallelo;
- decidere cosa fare del branch;
- **applicare `BACKLOG.md`** col piano di `wf_6a80a4c1-7a8`, rispettando il punto 5;
- **il Layout B** (home del DM a schede THE NIGHT / REFERENCE), deciso il 19 agosto, zero righe;
- **farmi tutte le domande** prodotte da `wf_d5464f24-a49` in una volta sola — fra queste c'è
  `:3136`, «una scena è un luogo o un combattimento?», che ne blocca un'altra sotto;
- il tiro dei danni non legge le riserve di dadi.

Cosa non toccare, e sono decisioni: il **cancello H-9 resta chiuso** (inset orizzontali, rail dei
Cards, overlay, `--control`, voci 7, 8 e 19); le sezioni rilasciate di `CHANGELOG.md`; di
`HANDOFF.md` si mantiene **solo il cartello**; **mai `git add -A`**.
