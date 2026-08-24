# Messaggio di ripresa — branch `beast-sheets`

Da incollare in una sessione nuova. Aggiornato il **24 agosto 2026**, dopo che tutti e tre i
workflow del 23 sono stati svuotati nel repo e le nove domande hanno avuto risposta.

---

Riprendiamo il Daggerheart Companion, sul branch **`beast-sheets`**.

Leggi `docs/handoff/HANDOFF-beast-sheets-2026-08-24.md`. È l'autorità su questo branch;
`HANDOFF-beast-sheets-2026-08-23.md` porta un cartello e **non** va riscritto. `HANDOFF-2026-08-23.md`
nella radice resta l'autorità su `main`, che è fermo a `f0c23f1` / `0.5.0`, pubblicata e verificata.
Il branch **non è unito e non è pushato**.

Le sette cose da sapere subito.

**1. NON DEVI RECUPERARE NIENTE DA NESSUN JOURNAL.** Tutti e tre i workflow del 23 agosto sono
atterrati nel repo. `wf_6a80a4c1-7a8` → `BACKLOG-PLAN-2026-08-23.md`. `wf_d5464f24-a49` →
`PROGETTO-GM-2026-08-23.md`. `wf_226cd659-47e` **era stato ucciso a metà e non aveva scritto niente**:
il suo rapporto è stato ricostruito dal disco in **`VERIFICA-BRANCH-2026-08-23.md`**. Ciò che resta
nei journal è solo dettaglio non riprodotto, ed è indicizzato in `RECUPERO-JOURNAL-2026-08-24.md`.
*(Gli script di quei workflow sono nella cartella di sessione, **non** in `workflows/scripts/` dentro
il repo: quel percorso non è mai esistito, e i due handoff precedenti ci mandavano per errore.)*

**2. IL BRANCH È COMPLETO, MA LA SUA VERIFICA È APERTA — E QUESTA È LA PRIMA COSA DA LEGGERE.**
3273 test su 134 file verdi, `tsc` pulito, build verde, albero pulito, Node **v24.19.0** via
`. ./env.sh` (il Node di sistema è 26 e nasconde `localStorage` a jsdom: una suite verde sotto
quello è più debole di quella di CI). **Ma i cancelli verdi non sono la verifica.** Leggi
`VERIFICA-BRANCH-2026-08-23.md` **prima** di qualunque decisione di merge:

- **sei delle sette correzioni di `c88bd21` sono incomplete**, e la **#4 è una regressione** — ha
  tolto la casella di spunta dalla stampa e non ha messo niente al suo posto per le opzioni non
  marcate, sotto un'intestazione che continua a contarle;
- **le due regole per cui il branch esiste non sono trattenute da nessun test**: invertendo
  `Play.tsx:248` e `Play.tsx:261` la suite resta **134/134 e 3273/3273 verde**. Misurato due volte,
  da agenti indipendenti, eseguendo. In tutto **cinque test dimostrati vacui**;
- **quel run è però a sua volta incompleto** — Critic e Synthesis mai partite — quindi i suoi rilievi
  non hanno passato il vaglio che il suo disegno prevedeva. Le **nove prove per mutazione** sono
  elencate in §38 col colore atteso, e **non sono mai state eseguite**.

**3. NON CONTARE I COMMIT LEGGENDOLI IN UN DOCUMENTO.** Usa `git rev-list --count main..HEAD`.
Quel numero è già andato stantio due volte, e c'è un commit (`e69cf17`) che esiste solo per averlo
corretto una volta.

**4. LE NOVE DOMANDE HANNO AVUTO RISPOSTA, E NESSUNA È STATA ESEGUITA.**
`DECISIONI-2026-08-23.md`. La conseguenza che conta: le decisioni **1, 6 e 8** finiscono tutte e tre
in `Campaign` e devono condividere **un solo bump** di `CAMPAIGN_SCHEMA_VERSION` (2→3). Farle
separate significa tre convertitori, tre giri di fixture e tre passate sui test di trasferimento.
E attenzione: **`:3136` è chiusa sulla carta e non in `BACKLOG.md`** — `:3136` e `:3140` sono ancora
`- [ ]` sotto «Still open», e `:3138` dice ancora «ask Giorgio».

**5. IL PERICOLO STRUTTURALE È PEGGIO DI COME ERA SCRITTO, ED È STATO MISURATO.** Le schede
conservate dentro una campagna **non passano mai dalla catena di migrazione dei personaggi**:
`readPartyMember` (`shared/campaigns.ts:628`) guarda due campi e poi fa il cast. **Otto modi di far
cadere il party board sono stati riprodotti eseguendo** — fra cui `levelUpHistory`, che esplode in
`deriveStats` **prima che si disegni qualsiasi cosa**, e i quattro contatori in `gmStore.ts:1093`,
che esplodono dentro un'azione di store, cioè **fuori dal confine d'errore di React**. Il controllo
che dice tutto: **un compagno senza `damageType` si disegna benissimo** — l'unico campo con un test
di regressione è l'unico che non esplode. La regola va allargata a *«né passarlo a una funzione che
lo fa»*, ed è violata in `PartyBoard.tsx` a `:528 :541 :629 :663 :664`, più `attack.ts:373`/`:578` e
`print/CharacterSheet.tsx:377` **fuori** da `src/ui/gm/`. La correzione strutturale va decisa dentro
il bump 2→3, che è stato dimensionato: **ventiquattro punti**, non tre suite di test.

**6. TRE SCOSTAMENTI DALLE DECISIONI, TUTTI ARGOMENTATI E TUTTI ANCORA VALIDI.** Folio 19 escluso
(è il ROGUE); **codec al formato 2** (il numero libero è 4, non 3 — ri-derivato in modo
indipendente), col bump di *schema* fatto; Esperienza del compagno **applicata, non offerta**.
Ma il bump si è fermato prima del suo precedente: `Architecture.md:461` dice ancora «tre voci
esatte» dove `codec.ts:34` ne dichiara **quattro**, e questo branch **non ha toccato nessun `.md`**.

**7. jsdom NON MISURA NIENTE.** Le superfici cambiate e mai misurate sono **sei**, non due — e una
di esse (`CompanionLine` sul party board) non è un pixel non misurato ma una possibile violazione di
`shapeCoding`: `· OUT OF THE SCENE` è l'ultima cosa sotto `nowrap`/`ellipsis`, e a troncarsi resta il
solo colore. Il rig di misura in Chrome **esiste già: riusalo, non ricostruirlo.**

## Cosa fare, in ordine

**Prima del merge, e vale circa una giornata:** trattieni le due regole di punta con test che
diventano rossi; disfa la regressione di stampa (`.dhc-tick` è già nel file); chiudi i due crash
vivi; sistema il tratto Beastform stantio; paga il debito `.md` e di fixture del bump 4→5 insieme
alle sei affermazioni false che nessuna mutazione può prendere; **poi** esegui le nove prove per
mutazione — **una alla volta, mai in parallelo**, in una directory dal nome unico, col mutante
verificato presente prima e dopo.

**Poi**, e solo poi, la decisione su `beast-sheets`. `main` è fermo, quindi aspettare non costa
niente, e decidere adesso vuol dire decidere su prove che non hai ancora letto.

**Dopo il merge**, nell'ordine: la sezione Legal del README; il passaggio su `BACKLOG.md` in un
commit solo, usando gli **undici blocchi già scritti** di `RECUPERO-JOURNAL-2026-08-24.md` §1 invece
di riderivarli; Witherwild fuori e la rinomina; **il bump unico 2→3** con dentro la decisione su
`readPartyMember`; `PROGETTO-GM` §6 step 1; **Layout B** col vincolo duro che **THE NIGHT è una
scheda, non un modale** (oggi ogni strumento DM copre il Fear e lo rende irraggiungibile da
tastiera); il tiro dei danni che legge le riserve; e infine **un solo passaggio di misura in Chrome,
tutto insieme**.

## Cosa non toccare, e sono decisioni

Il **cancello H-9 resta chiuso** (inset orizzontali, rail dei Cards, overlay, `--control`, voci 7, 8
e 19). Le sezioni rilasciate di `CHANGELOG.md`. Di `HANDOFF.md` si mantiene **solo il cartello**.
**Mai `git add -A`.** **Niente si spunta in `BACKLOG.md` su un «probabilmente»** — il giro di
confutazione è stato fatto e dà **cinque spunte, uno split, un reword, tre che restano aperte**.
**`:1653` va spezzata, non spuntata.** E **`SESSION_ITEM_KINDS` che omette `url` e `note` è
deliberato**, pinnato da un test: allargarlo è una mossa già respinta, non una svista.
