# Handoff — la giornata del feedback, e l'ondata lasciata a metà

**Al 1 settembre 2026, notte.** Quattro PR unite e pubblicate; una quinta ondata **in volo**,
non finita, con lavoro non committato in due dei tre worktree. Chi riprende legga la §1 prima
di toccare qualunque cosa.

I commit si citano **per oggetto, mai per SHA**. Non fidarti di uno SHA scritto qui: `git log -1`.

---

## 0. Stato, misurato

```
main                        «Merge pull request #69 from …/handoff-focus-favor»
sw.js pubblicato            b905021a3b…  (combacia con main, scaricato dal sito)
npx tsc --noEmit            0 errori
npx vitest run              192 file / 4776 test
build:srd --check           entrambi i libri combaciano
build:registry --check      1368 id
SCHEMA_VERSION / CODEC      9 / 9
```

**UNIRE È IL DEPLOY.** `deploy.yml` parte su ogni push a `main`; spingere un ramo non lo è.
Il proprietario dà il via con la parola «vai», e la dà **una volta per passo**: il «vai» che
autorizza ad aprire le PR non è quello che autorizza a unirle.

---

## 1. L'ONDATA IN VOLO — leggere prima di tutto

Un workflow stava costruendo **la UI di Focus e Favor** quando questa consegna è stata
scritta. **Non era finito.**

| corsia | ramo | worktree | stato all'ultima misura |
|---|---|---|---|
| V — la riga sotto `Vitals` | `favor-riga-vitals` | `…/scratchpad/wt2/V` | **0 commit, 4 file modificati** |
| D — il Patron Die | `favor-patron-die` | `…/scratchpad/wt2/D` | **2 commit, albero pulito** |
| R — l'offerta sul tiro | `favor-sul-tiro` | `…/scratchpad/wt2/R` | **0 commit, 4 file modificati** |

**AGGIORNATO ALLA PAUSA.** Prima di fermarsi, ciò che le corsie avevano **committato** è stato
spinto su origin, così uno scratchpad spazzato non può più portarselo via: `favor-patron-die`
(2 commit) e `favor-sul-tiro` (1 commit) **esistono su origin**. `favor-riga-vitals` no: aveva
**0 commit e 7 file in lavorazione**, e quel lavoro vive solo nel worktree. È l'unica cosa di
questa giornata che una pulizia distruggerebbe.

Lo scratchpad è
`/private/tmp/claude-501/-Users-simonealbanese-Documents-Daggerheart-Companion/cb40716f-…/`.
Il journal e i transcript degli agenti vivono in
`~/.claude/projects/…/subagents/workflows/wf_7c6439b6-0d2/` e **sopravvivono a qualunque
pulizia degli scratchpad**.

**COSA FARE ALLA RIPRESA, in quest'ordine:**

1. **Guarda se i worktree esistono ancora.** Se lo scratchpad è stato spazzato, i rami
   `favor-*` sono locali e non hanno mai avuto un upstream: quello che non era committato
   **è perso**, e va ricostruito dal progetto qui sotto.
2. **`git status` e `git log --oneline main..HEAD` in tutti e tre.** Un albero con modifiche
   non committate è lavoro a metà, non lavoro rotto: leggilo prima di buttarlo.
3. **Non rilanciare il workflow sugli stessi rami** finché non sai se un agente sta ancora
   scrivendo: due scrittori in un worktree si sovrascrivono. *«started senza result più
   cinque minuti di silenzio NON è prova di morte.»*
4. **Componi tu.** Nessuna corsia vede ciò che la composizione mostra — vedi §4.

### Il progetto delle tre corsie, se va ricostruito

Le decisioni sono **prese** e stanno in `HANDOFF-FOCUS-FAVOR-2026-09-01.md` §1. In breve:

- **V.** Le due tracce in una **riga propria sotto `Vitals`**, non nella fila delle quattro
  (6 card in un wrap premono: il min-content di una card è 44+44). Si disegnano **solo a chi
  ne ha diritto** — Focus al Martial Artist, Favor al Warlock — chiesto **al dataset per nome
  di feature** e guardando **`multiclassRef`**, come fanno `hasBeastform` e `grantsFavor`. Se
  non ha diritto a nessuna delle due, la riga non si disegna. Il Focus **resta anche in
  Build**: due controlli sullo stesso numero, deliberati.
- **D.** Il **Patron Die** in `src/engine/dicePools.ts` (d6, d8 dal livello 5 — precedente
  esatto: il **Rally Die**, stessa scala, stesso file) **e armabile** in
  `src/ui/player/heldDice.ts` (che sta in `src/ui/player/`, non nel motore). Si spende **un
  Favor** per tirarlo: armare il dado e pagare devono essere la stessa decisione, e lo stato
  divergente va reso **irrappresentabile**, non solo evitato. Con 0 Favor il dado non si arma
  e la ragione deve essere leggibile.
- **R.** L'offerta *«gain a Favor instead of a Hope»* sul risultato del Duality Roll, in
  `src/ui/player/DualityRoll.tsx`. Cinque insidie scritte nel prompt e tutte reali: solo a chi
  ha il Favor; **solo su un successo con Speranza** (verifica nel codice se un critico lo è —
  non dedurlo); il tetto di 6; **è uno scambio, non un regalo** (chi finisce con Speranza *e*
  Favor ha ricevuto due cose per una); una volta sola per tiro.

**Non serve nessun bump.** Il formato è già stato allargato apposta: `Character.favor` esiste,
è migrato, guardato e trasportato. Nessuna schermata lo mostra ancora — è esattamente il buco
che questa ondata chiude.

---

## 2. Cosa è stato pubblicato oggi

Quattro PR, unite in quest'ordine perché la prima tocca `shared/types.ts` e la terza il dataset.

- **Il formato nuovo.** Header allargato (escape `0x0f` nel nibble basso del byte 0, versione
  nel byte 1, crc32 ai byte 2-5), `NARROW_CODEC_VERSIONS = [1,2,4,8]`,
  `WIDE_CODEC_VERSIONS = [9]`. Dentro: `Character.favor`, lo **scambio dello Step Four** del
  level-up, e la **✕ sulle carte di dominio** — che prima non si potevano restituire.
- **Il wizard dice invece di imporre.** Era la contraddizione più vecchia del progetto: il
  foglio si rifiutava di imporre *con una motivazione scritta nel suo docblock*, il wizard
  imponeva. Ora il wizard segue il foglio, e la frase che dice è **vera** perché consulta
  `hasCombatTraining`: un Warrior ignora il burden. Più la ✕ mancante su primaria e armatura,
  il `role="status"`, e la **✕ delle stance armata** dove non si torna indietro.
- **I folii 55-83 nel dataset.** Otto capitoli, `rules` da 69→77 e 74→82. E il libro, una
  volta dentro, ha **cambiato una decisione**: sull'ingombro si ferma al numero, sul tier
  spende un verbo — quindi il tier **rifiuta** e il burden **dice**.
- **Il verbale del Focus/Favor**, riscritto da promemoria a verbale.

---

## 3. Le regole macchina che mordono

- **`. ./env.sh >/dev/null 2>&1 && node -v` deve dire v24. MAI `. ./env.sh | head`**: la pipe
  crea una subshell e lascia Node 26 sul PATH del padre, che nasconde `localStorage` a jsdom.
- **Per annullare una mutazione su un file con modifiche NON committate si usa `cp`, mai
  `git checkout`.** Il controllo dopo il ripristino è *grep del mutante E grep della
  riparazione*, non «i test sono verdi».
- **Mai la porta 5199**: è la campagna vera del proprietario. Usa 522x.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`. E `.gitignore`
  porta entrambe le grafie, con e senza slash, apposta.
- **Verificare che una run CI esista *e sia sul commit esatto*** prima di unire: confronta
  `gh pr view --json headRefOid` con `head_sha` della run. L'evento `pull_request` in questo
  repo è già sparito una volta, lasciando una PR «CLEAN» che non aveva eseguito nulla.
- **`build:srd --check` NON gira in CI** — senza `Manuali/` quello step è saltato in ogni run.
  Un test che legge `data/*.json` e non ha bisogno del PDF vale più di tre che ce l'hanno.
- **Un conflitto sui due `data/srd-*.json` non si risolve scegliendo un lato: si rigenera.**
  Sono file di **una riga sola**, quindi due rami che ne toccano parti diverse toccano
  comunque la stessa riga. `npm run build:srd` per entrambi i libri dà esattamente l'unione.
  Le due risoluzioni ingenue sono **entrambe rosse**, misurato.
- **Il rig di misura esiste e non va ricostruito**: `~/.claude/projects/…/audit-harness/`.
  `resize_window` di `claude-in-chrome` **non scende sotto un minimo di finestra** e ti lascia
  a 529×675 con `pointer: fine` — non è la misura dell'audit. Il rig dà 393×852, dpr 3,
  `pointer: coarse`.
- **Una fixture di misura con uno `schemaVersion` vecchio si vede azzerare i campi nuovi dalla
  migrazione** prima che si misuri qualunque cosa. Per uno stato introdotto dopo un bump, la
  fixture deve dichiarare uno schema **oltre** quel bump.
- **Nel bundle pubblicato, le stringhe di `gear.ts` stanno nel chunk `Fold-*`, non in
  `Build-*`.** Cercarle nel posto sbagliato si legge come un deploy rotto.
- **Un hash di chunk diverso non è una prova di divergenza.** Il `Fold` locale e quello
  servito differivano per **sette caratteri** — il solo nome del chunk d'ingresso dentro
  l'`import`, perché la build incorpora lo SHA. Guarda i byte prima di gridare.

---

## 4. Le due lezioni che sono costate di più oggi

**Una segnalazione può essere giusta nel sintomo e sbagliata nella causa.** Il tester ha
segnalato tre cose: erano vere tutte e tre, e **nessuna per il motivo che credeva**. Va
creduta sul sintomo e verificata sulla causa.

**Anche un verificatore sbaglia, e il suo errore sembra una prova.** Una passata avversariale
ha dichiarato «citazione inventata» una frase che esisteva davvero — aveva cercato nel
worktree di una corsia diversa da quella che possedeva il file. **Prima di chiamare inventata
una cosa, controlla di non essere nell'albero sbagliato.** È il quinto caso in questo progetto
di una «correzione» a sua volta falsa.

E la terza, che è la ragione per cui la composizione esiste: **i numeri di tre suite verdi
separate non predicono quelli della suite composta.** Nella composizione di oggi due test sono
diventati rossi, e nessuna corsia poteva vederli — una cercava la frase del burden nel
capitolo `equipment`, ma il libro la stampa in `weapons` (entrambi al folio 55, quindi la
citazione era giusta e sbagliato era solo il `find`).

---

## 5. Il debito, e le decisioni che aspettano il proprietario

**Decise appena prima della pausa — non riproporle:**

- **I 58 rami uniti su origin: cancellati.** Erano provati ancestri di `main`, quindi niente di
  pubblicato si è perso e la storia resta intera nei commit. **Origin ora ha due rami soli**:
  `main` e `handoff-2026-09-01-notte` (questa PR). Prima ne aveva sessanta, ed era impossibile
  vedere quale fosse vivo.
- **Al tester va mandata una pagina** con cosa ha trovato, cosa era davvero il difetto e cosa
  vedrà adesso — **non ancora fatta**, è il primo debito di questa consegna. In coda vanno le
  **tre domande** che chiudono i casi ambigui: se la carta che non riusciva a togliere fosse
  una carta di dominio su Gioco o uno slot nel wizard; se il messaggio l'avesse visto nel
  wizard o sulla scheda; e se abbia creato personaggi il 1 settembre **fra le 11:46 e le
  14:17**, la finestra in cui poteva nascere una stance orfana.
- **Dopo il Focus/Favor viene il debito dell'SRD 2** (l'elenco è qui sotto), non il
  ballottaggio dei momenti e non la prosa stantia. Una sessione nuova può quindi spendere
  tutto il contesto sull'ondata, sapendo cosa la aspetta.

**Debito dichiarato:**

- Le **otto sezioni nuove** del dataset non compaiono sotto nessun chip di ShowSheet: serve un
  terzo ballottaggio dei momenti. Lo stato `UNRATIFIED` in `tests/gm/moments.test.ts` lo tiene
  visibile invece di lasciarlo silenzioso. `armor` e `consumables` sono le due che più
  evidentemente un momento ce l'hanno.
- La **seconda metà di Combat Training** (+livello al tiro di danno fisico) resta testo:
  `modifiers.ts` esclude **per scelta documentata** i bonus al tiro, e aprire quel canale
  rende candidati i 79 testi del dataset che dicono «damage roll».
- *«They can't equip armor while in danger or under pressure»* è **deliberatamente non
  implementata** — è uno stato di gioco, e nessun campo di nessuna scheda dice se sei in
  pericolo. Un test lo asserisce, così non è una dimenticanza che nessuno ha scritto.
- Il debito dell'SRD 2: 6 voci in `UNPRICED_AMOUNT`, 13 in `UNPRICED_LANE`, 32 in
  `SITUATIONAL`; lo sweep percorre 12 collezioni su 16 (fuori: `domains`, `adversaries`,
  `environments`, `rules`); gli 11 sottosistemi delle Supplemental Campaign Mechanics che
  nulla legge; `srdIndex` che non indicizza livello né modulo per le armi; `Item.roll`
  chiamato d100 quando è 1..60.
- **Prosa stantia ereditata**: `srdIndex.ts` dice «69 sezioni / 1438 record» (sono 82 e 1451),
  `RuleSearch.tsx` dice «69 e 780», `HANDOFF.md` cita `CODEC_VERSION` 2 e `SCHEMA_VERSION`
  4/5. Erano **già false prima di oggi** e ora lo sono di un passo in più. `Architecture.md`
  è stata corretta.
