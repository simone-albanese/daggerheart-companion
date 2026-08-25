# Messaggio di ripresa — branch `schema-wave-v3`

> **CONSUMATO. Sostituito da `WAVE3-2026-08-24.md`.** Questo file è stato letto e
> eseguito: i quattro punti rimasti del suo §4 sono fatti, e la decisione aperta del suo
> §3 — la ricerca multi-termine — è stata presa, in forma **AND di riga**, rispondendo
> all'obiezione invece di cancellarla. **Non è stato riscritto**: le sue misure erano vere
> il 24 agosto e riscriverle falsificherebbe il registro. Dove è superato, lo dice il
> file nuovo.

Da incollare in una sessione nuova. Scritto il **24 agosto 2026**, mettendo in pausa a metà
dello step 3 del piano di `PROGETTO-GM` §6.

---

Riprendiamo il Daggerheart Companion — l'app si chiama **Duality Companion** — sul branch
**`schema-wave-v3`**, che sta su **PR #7**, aperta e verde.

**PRIMA COSA: decidi se unire la PR #7, ed è una decisione, non un gesto.** Unire pubblica: è il
**merge** a far partire `deploy.yml`, non il push. Misurato il 24 agosto: merge alle 09:52:44,
deploy partito alle 09:52:47 sul commit di merge, e il `git push origin main` successivo ha
risposto `Everything up-to-date`. **Non esiste un ordine dei gesti che unisca senza pubblicare.**

Leggi, in quest'ordine: **`HANDOFF-2026-08-24.md`** nella radice (autorità su `main`), poi questo
file, poi `docs/handoff/PROGETTO-GM-2026-08-23.md` §6, che è il piano da cui vengono gli step.
`docs/handoff/DECISIONI-2026-08-23.md` è il registro delle nove decisioni del proprietario.

## 1. Node 24, sempre

`. ./env.sh` prima di ogni cosa. Il Node di sistema è **26** e **nasconde `localStorage` a
jsdom**: una suite verde sotto quello è **più debole** di quella di CI, non uguale.

Riferimento su questo branch: **135 file / 3302 test**, `tsc` pulito, `npm run build` verde,
`npm run build:srd -- --check` allineato a **69** sezioni. Al punto di partenza (`main`,
`03268f7`) erano 134 / 3283. **Rimisura, non fidarti di questi numeri** — è la regola che questo
repo ha imparato pagandola quattro volte in una sessione sola.

## 2. Cosa c'è dentro questo branch, in due commit

**`168e5fa` — `CAMPAIGN_SCHEMA_VERSION` 2 → 3, con le decisioni 1, 6 e 8 insieme.**

- **§1** la riga `scene` assorbe `roster`, `adjustments`, `combatants`. `encounter` **resta
  nell'unione come legacy** e **non è stato convertito**: riscrivere righe salvate cambierebbe il
  *kind* di una cosa che il GM ha nominato, cosa che questa catena non ha mai fatto. «Non più
  creabile» si scrive **uscendo da `SESSION_ITEM_KINDS`**; `ADD_FORMS` è un
  `Record<SessionItemKind, …>`, quindi il compilatore toglie la form da solo. `newEncounter` è
  **cancellato**, non deprecato.
- **§8** `Countdown` guadagna la triade Activation / Advancement / Effect, `owner`, e `beats`.
  `owner` è un ref e **il reader non lo verifica** contro la squadra, di proposito.
- **§6** `Campaign` guadagna `archive` (serate chiuse, ognuna con le righe **copiate**) e
  `register` (persone, luoghi, accordi, archi, fatti — la casa della §7), con arm `unreadable`.
- **`readPartyMember` non fa più il cast** — la classe di difetto della prova (f). Una conversione
  riuscita **non avvisa**; una scheda rifiutata lascia cadere la propria riga e lo dice.

Tre prove per mutazione, mutante verificato presente prima e dopo, file ripristinato identico:
togliere `roster` dall'arm scena → 1 test rosso; togliere la triade da `readCountdown` → 1 rosso;
togliere l'archivio dal reader → 1 rosso.

**`bcf2715` — i primi due punti di `PROGETTO-GM` §6 step 1.**

- **§4.1(e) chiuso.** Il motivo per cui mancava non è una scelta andata storta: la prima riga di
  `ATTRIBUTION` è **il modello combinato di §4.3 meno la sua ultima frase**. Ripristinata con le
  parole di DRP, più la metà di questo progetto (il libro è *riordinato*, `deriveStats`
  *calcola*) e l'URL della licenza, che chiude §4.1(d). `attribution.test.tsx` adesso verifica
  §4.1 **clausola per clausola**: ogni altro test lì dentro passerebbe su un avviso che non dice
  niente.
- **I filtri del bestiario raggiungono `f.text`.** Misurato sul libro spedito: **17 avversari e 2
  ambienti** impongono *Restrained* nel testo di una feature e non lo dicono da nessun'altra
  parte. Il test legge il dataset vero, non una fixture.

## 3. LA DECISIONE APERTA, ed è tua

**La ricerca multi-termine di `PROGETTO-GM` §6 step 1 non è stata fatta, di proposito.**

`tests/gm/ruleSearch.test.tsx` pinna la corrispondenza a **frase intera** — `searchRules(rules,
'close very')` deve dare `[]` — e non descrive un comportamento: registra una decisione con una
ragione scritta accanto. *«Un AND su termini separati risponderebbe anche con ogni sezione che
dice "close" in un paragrafo e "very" in un altro, e dovrebbe poi una riga di anteprima che non
esiste.»*

Quella obiezione è **ancora viva**: è un problema tecnico vero, non una preferenza. E
`PROGETTO-GM` è una **proposta**, non una delle nove decisioni — la ricerca non era fra le domande
che il proprietario ha risposto. Rovesciare una decisione pinnata da un test con motivazione
scritta è la mossa che questa sessione ha evitato tre volte di proposito (`:2117` riscritta e non
spuntata, `encounter` tenuto come legacy invece che convertito, l'82.6 marcato invece che
sostituito).

Se la si vuole, va fatta rispondendo all'obiezione, non ignorandola: ogni hit deve portare una
riga che contenga almeno un termine, e lo schermo deve dire onestamente che i termini sono stati
trovati in posti diversi — che è esattamente il «labelled header» del fallback AND→OR.

## 4. Cosa resta, in ordine

**Lo step 3 è a metà.** Restano i cinque punti di `PROGETTO-GM` §6 step 1 non fatti:

- motivi (`motives`) su `CombatantCard`; impulsi e avversari potenziali in `EnvironmentBand`; la
  riga della Difficoltà derivata;
- `SEND` che nomina l'ambiente che si è portato dietro, e `END SCENE` che dice cosa sta finendo;
- la tabella di avanzamento sul `CountdownArm` di `SessionBody` — la superficie che un GM apre
  **perché** sta pensando a quell'orologio;
- il disaccordo sulla dimensione della squadra reso visibile;
- (e la ricerca multi-termine, che è §3 qui sopra e non è mia da decidere).

**Poi lo step 4 — il cancello, e non è iniziato.** `PROGETTO-GM` §6 step 2. Ogni strumento DM
monta a `position: fixed; inset: 0; z-index: 30` con `useDialog` che intrappola il Tab, quindi
**mentre la scena è aperta il Fear è coperto e irraggiungibile da tastiera** — e il docblock di
`FearPool.tsx` afferma il contrario come ragione per cui esiste. Nessun test lo copre. Il vincolo
duro è che **THE NIGHT è una scheda, non un modale** (decisione 2): qualunque cosa sia Layout B,
non può essere un modale `size="full"`, perché è quello a togliere il Fear dal vetro. Tutto lo
step 4 di `PROGETTO-GM` (il polso degli esiti di tiro) è bloccato su questo.

**Poi**, in ordine di valore: il tiro dei danni che legge le riserve, e nello stesso passaggio i
due difetti recuperati (`DualityRoll.tsx:791` non ha `bonus` nel tipo di `fixed`;
`DicePools.tsx:191` chiama `cryptoRng` senza leggere nessuna preferenza). Infine **un solo
passaggio di misura in Chrome, sette superfici insieme** — il rig esiste già, va riusato — dove la
settima è l'**82.6px** di `RuleSearch.tsx`, marcato come non attuale perché il suo soggetto era
proprio la sezione Witherwild rimossa.

## 5. Cosa non toccare, e sono decisioni

- **Il cancello H-9 resta chiuso.** `HANDOFF-2026-08-23.md` §8 è ancora l'autorità.
- **Le sezioni rilasciate di `CHANGELOG.md`.** Aggiungerne sopra è normale; `Unreleased` esiste
  già e porta le due decisioni del 24.
- **`DB_NAME` non si muove.** Vale `'daggerheart-companion'` in **due** posti (`store/db.ts` e
  `index.html`) e la rinomina del repo è rimandata. IndexedDB è per **origine**, non per percorso:
  le schede sopravvivono a una rinomina **solo** finché quella costante non la segue.
- **`encounter` non si converte** e non torna in `SESSION_ITEM_KINDS`.
- **Mai `git add -A`.** `node_modules`, `.tools` e `Manuali` sono directory vere nella radice.
- **Niente si spunta in `BACKLOG.md` su un «probabilmente».**
- **Le prove per mutazione si eseguono in una copia isolata**, una alla volta, col mutante
  verificato presente prima e dopo. Il metodo sta in `CANCELLO-MERGE-2026-08-24.md` §3.
- **`build:srd -- --check` è il cancello vero** per qualunque cosa tocchi dataset o parser.
