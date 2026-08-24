# Messaggio di ripresa — branch `beast-sheets`

> **QUESTO MESSAGGIO È STATO CONSUMATO, il 24 agosto.** È stato incollato, e tutto quello che
> ordinava è stato fatto: PR #1 unita (`a115f2d`), 0.6.0 pubblicata, **A** e **B** eseguiti e
> aperti come PR #2 e PR #3. Non va incollato una seconda volta. Il punto di ripresa vivo è
> `CANCELLO-MERGE-2026-08-24.md`, che porta il suo cartello.
>
> **Da qui in giù solo il cartello è mantenuto**, per la ragione che `HANDOFF.md` porta scritta:
> correggere le frasi dentro un documento superato lo fa sembrare mantenuto. Cosa è falso, per
> nome:
>
> - **§1 sbaglia il meccanismo, ed è la frase più importante del file.** Dice *«unire la PR non
>   pubblica niente: è il push di `main` che pubblica 0.6.0»*. È il contrario. `gh pr merge`
>   scrive il commit di merge su `main` **lato GitHub**, e quello *è* un push event: è il merge
>   che ha fatto partire il deploy. Misurato — merge alle 09:52:44, deploy `32713871427` partito
>   alle 09:52:47 sul commit di merge, e il `git push origin main` successivo ha risposto
>   `Everything up-to-date`. Quello che resta vero è la metà che riguarda i branch: pushare un
>   branch che non sia `main` non pubblica niente.
> - **§1 dice «branch a 30 commit»**. Erano **31**, contati con `git rev-list --count main..HEAD`,
>   che è esattamente ciò che quel paragrafo dice di fare invece di fidarsi del numero scritto.
> - **§4 e §5 sono eseguiti.** A1, A2, Witherwild e la rinomina sono fatti; l'app si chiama
>   **Duality Companion**. Le avvertenze misurate in §4 si sono rivelate esatte tutte, tranne il
>   conteggio dei posti da muovere: erano **sette**, non sei.
> - **§2, §3 e §6 reggono.** Node 24, cosa ha fatto il cancello, e cosa non si tocca.

---

Riprendiamo il Daggerheart Companion, sul branch **`beast-sheets`**.

**PRIMA COSA, PRIMA DI QUALUNQUE ALTRA: unisci la PR #1 e pusha `main`.** È già stato deciso,
e non serve rileggere niente per farlo. Poi si parte da **A** e **B** qui sotto.

Leggi, in quest'ordine: `docs/handoff/CANCELLO-MERGE-2026-08-24.md` (è il documento vivo, e il
suo **§8 è il briefing su A e B**), poi `docs/handoff/HANDOFF-beast-sheets-2026-08-24.md`, che
porta un cartello: il suo §7 è **eseguito**, i suoi §2 e §4 sono invecchiati per nome nel
cartello, e i suoi **§5, §6, §8 e §9 reggono e sono la cosa più utile lì dentro**. Non riscrivere
né quel file né `HANDOFF-beast-sheets-2026-08-23.md`, che porta il suo cartello a sua volta.
`HANDOFF-2026-08-23.md` nella radice resta l'autorità su `main`.

---

## 1. Il gesto di apertura, e cosa fa davvero

`gh pr merge 1` e poi `git push origin main`.

- **`deploy.yml` gira solo su push a `main`.** Quindi unire la PR non pubblica niente: **è il
  push di `main` che pubblica 0.6.0** su GitHub Pages. Sono due gesti e due conseguenze diverse.
- `ci.yml` gira su `pull_request` e su push a `main`. L'ultimo giro sulla PR è stato **verde in
  2m6s** su Node `.nvmrc` = 24.
- Al momento in cui è stato scritto questo file: `origin/main == main == f0c23f1`, PR `MERGEABLE`
  e `CLEAN`, branch a 30 commit. **Rimisura**: `git rev-list --count main..HEAD` e
  `gh pr view 1 --json state,mergeable`. Non fidarti di questi numeri, che è la regola che questo
  repo ha imparato pagandola.

## 2. Node 24, sempre

`. ./env.sh` prima di ogni cosa. Il Node di sistema è **26** e **nasconde `localStorage` a
jsdom**: una suite verde sotto quello è **più debole** di quella di CI, non uguale. Ogni numero
in ogni documento è stato preso sotto il 24. Riferimento attuale: **134 file / 3283 test**,
`tsc` pulito, `npm run build` verde, `npm run build:srd -- --check` allineato a 80 sezioni.

## 3. Cos'è successo il 24 agosto, in una riga per punto

Il branch era **completo e la sua verifica era aperta**: la suite restava verde anche invertendo
le due frasi per cui il branch esiste. Nove commit dopo:

- le **due regole di punta sono trattenute** — sette asserzioni rifatte, non cinque;
- la **regressione di stampa** è disfatta, i **due crash vivi** sono chiusi, il **tratto
  Beastform** segue la forma e non sopravvive al DROP;
- il **debito 4→5** è pagato: prosa, fixture, e il generatore da 3240 schede che era **cieco** a
  `damageType`;
- le **nove prove per mutazione** sono state eseguite e scritte (`CANCELLO` §4);
- il **difetto 8** è chiuso come **deviazione dichiarata** (opzione A), e la versione fedele —
  un campo `away` esplicito — resta aperta perché costa uno schema;
- `CHANGELOG.md` ha la sua sezione e la versione è **0.6.0**, con `APP_VERSION` accanto.

Il criterio, ogni volta: **il test rosso prima**, e ogni mutazione eseguita davvero.

## 4. A e B — il lavoro che parte subito dopo il push

Sono indipendenti fra loro. Il briefing completo è in `CANCELLO` §8; qui c'è solo quanto basta a
non partire nella direzione sbagliata.

**A1 — sezione Legal del README** *(1-2 h)*. `DECISIONI-2026-08-23.md` §3. L'obiezione **va
scritta**, è il punto della decisione: metà dell'app è Adaptive Content ai sensi di §1.7, §2.1(b)
lo consente solo nei Permitted Formats, e §1.9 non elenca le app web. Dichiara la lettura **e**
il rischio accettato.

**A2 — `BACKLOG.md`, in un commit solo** *(90 min)*. **Usa gli undici blocchi già scritti** in
`RECUPERO-JOURNAL-2026-08-24.md` §1: cinque spunte, uno split chiuso, un reword, quattro che
restano aperte. **`:1653` va spezzata, non spuntata** — `AppBoundary.tsx:60-62` porta ancora il
difetto identico. **`:2117` va riscritta, non spuntata**: la decisione 8 la supera. **`:3136` è
chiusa sulla carta e non nel file.** Nello stesso commit apri le voci nuove di `CANCELLO` §5.

**B — Witherwild fuori, e la rinomina** (`DECISIONI` §4 e §5). Due avvertenze misurate:

- **Sono 11 sezioni, non 12.** `DECISIONI` §4 dice 12 e 28.549 caratteri; sul dataset di questo
  branch sono **11** (id `witherwild*`, pagine 113-118) e **27.679** caratteri di body. La quota
  regge: 21,7 %. Rimisura tu.
- **Il raggio d'esplosione è già mappato** in `CANCELLO` §8: `rules` va **80 → 69**, i
  paragrafi-lista **74 → 64**, e sei posti fra prosa e test portano quei numeri. Uno di quei test
  — `toHaveLength(74)` in `srdReference.test.ts` — **diventerà rosso apposta**: esiste perché la
  stessa frase era invecchiata in silenzio quando il dataset è andato 75 → 80.

`npm run build:srd -- --check` è il cancello vero della rimozione. E la rinomina del **repo**
cambia l'URL del remoto: `origin` va ripuntato.

## 5. Poi, in ordine — non cominciare da qui

**Il bump unico `CAMPAIGN_SCHEMA_VERSION` 2→3** che porta le decisioni **1+6+8 insieme**
(ventiquattro punti, non tre suite di test), ed è **lì che si decide `readPartyMember`** — la
prova (f) ha stabilito eseguendo che **nessun test lo trattiene in nessuna delle due direzioni**.
In parallelo può correre **`PROGETTO-GM` §6 step 1** (verità sul vetro), che non aspetta niente.
Poi **Layout B**, col vincolo duro che **THE NIGHT è una scheda, non un modale** — oggi ogni
strumento DM monta a `inset: 0` con `useDialog` che intrappola il Tab, quindi mentre la scena è
aperta il Fear è coperto e irraggiungibile da tastiera. Poi il **tiro dei danni che legge le
riserve**, e nello stesso passaggio i due difetti recuperati (`DualityRoll.tsx:791` non ha
`bonus` nel tipo di `fixed`, `DicePools.tsx:191` chiama `cryptoRng` senza leggere nessuna
preferenza). Infine **un solo passaggio di misura in Chrome**, sei superfici insieme: **il rig
esiste già, riusalo**. Una di quelle sei non è un pixel ma una possibile violazione di
`shapeCoding` — `· OUT OF THE SCENE` è l'ultima cosa sotto `ellipsis` sul party board, e a
troncarsi resta il solo colore.

## 6. Cosa non toccare, e sono decisioni

- **Il cancello H-9 resta chiuso**: inset orizzontali, rail dei Cards, overlay, `--control`,
  voci 7, 8 e 19.
- **Le sezioni rilasciate di `CHANGELOG.md`.** La 0.6.0 è appena stata scritta: aggiungerne una
  nuova sopra è normale, riscrivere quelle sotto no.
- **Di `HANDOFF.md` si mantiene solo il cartello**, e lo stesso vale ora per i due handoff di
  branch. Correggere le frasi dentro un documento superato lo fa sembrare mantenuto.
- **Mai `git add -A`.** `node_modules`, `.tools` e `Manuali` sono directory vere nella radice e
  symlink solo dentro le copie.
- **Niente si spunta in `BACKLOG.md` su un «probabilmente».**
- **`SESSION_ITEM_KINDS` che omette `url` e `note` è deliberato**, pinnato da un test: allargarlo
  è una mossa già respinta, non una svista.
- **Le prove per mutazione si eseguono in una copia isolata**, una alla volta, col mutante
  verificato presente prima e dopo. Il metodo sta in `CANCELLO` §3 e ha già evitato una volta di
  lasciare l'albero mutato.
