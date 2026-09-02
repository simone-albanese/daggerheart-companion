# Handoff — la notte in cui l'ondata non era ferma

**Al 2 settembre 2026, mattina.** Focus e Favor sono **pubblicati**. Due PR unite, una terza
aperta e verde. Chi riprende: la §0 è misurata, la §5 è ciò che aspetta.

I commit si citano **per oggetto, mai per SHA**. Non fidarti di uno SHA scritto qui: `git log -1`.

---

## 0. Stato, misurato

```
main                        «Merge pull request #73 …/handoff-2026-09-01-notte»
sito servito                e1c1bb7…  = main, verificato SCARICANDO sw.js
npx tsc --noEmit            0 errori
npx vitest run              195 file / 4855 test        (su main)
PR #75 aperta               196 file / 4861 test, CI verde sul commit esatto
build:registry --check      1368 id
SCHEMA_VERSION / CODEC      9 / 9   (nessun bump: il formato era già allargato)
```

**UNIRE È IL DEPLOY.** `deploy.yml` parte su ogni push a `main`; spingere un ramo non lo è.
Il proprietario dà il via con «vai», e la dà **una volta per passo**.

---

## 1. LA COSA PIÙ IMPORTANTE: la consegna di ieri diceva il falso, e come accorgersene

La consegna del 1 settembre annunciava un'ondata **«lasciata a metà»**, con lavoro non
committato a rischio di sparire, e dava istruzioni per ricostruirlo. **Era falso al momento
della lettura: il workflow stava ancora girando.** Il `/clear` aveva azzerato il contesto ma
non il processo.

**Esiste una prova positiva di vita, e si prende in due minuti.** Le tre, in ordine di costo:

1. **I transcript MIGRANO.** Dopo un `/clear`, la directory del workflow esiste sotto
   **entrambe** le sessioni: `…/<sessione-vecchia>/subagents/workflows/<wf-id>/` (file grandi,
   fermi) e `…/<sessione-nuova>/subagents/workflows/<wf-id>/` (file piccoli, **che crescono**).
   Una directory sotto la sessione **corrente** con un mtime recente è la prova che gira ora.
2. **`ps` nomina il worktree.** Le shell delle corsie portano `cd "<worktree>" && …` nella
   riga di comando e hanno per padre il `claude` di lunga vita.
3. **Gli mtime dei file**, incrociati con `git status` — ma vedi la trappola qui sotto.

**TRAPPOLA: un file toccato ma pulito NON è lavoro perduto.** Quattro file di una corsia
avevano mtime di 90 secondi prima e `git status` li dava puliti — che è esattamente l'aspetto
di un `git checkout` che ha mangiato del lavoro non committato. Erano le copie che **il rig
A/B rimette a posto** dopo la misura. Cerca il `*.after.tsx` nello scratchpad prima di
concludere qualunque cosa.

**E prima di rifare a mano il lavoro di un workflow, LEGGI IL SUO SCRIPT.** È salvato in
`…/<sessione>/workflows/scripts/<nome>-<wf-id>.js` e il suo `meta.phases` è tutto il piano.
Quello di ieri aveva una terza fase, *Composizione*, che poneva già la domanda su cui stavo
spendendo contesto a mano. Comporre avrebbe fatto di me il secondo scrittore.

---

## 2. Cosa è stato pubblicato

- **#74 — la composizione Focus/Favor.** Tre corsie in tre worktree, nove verificatori ostili,
  un compositore. 18 file, +3440/−96. Entra: la **riga FOCUS/FAVOR** sotto `Vitals` (disegnata
  solo a chi ne ha diritto: **11 schede su 13 non la vedono mai**), il **Patron Die** (quarto
  pool, d6→d8 al livello 5), e l'offerta ***gain a Favor instead of a Hope*** sul tiro.
- **#73 — la consegna di ieri**, con in testa alla §1 la correzione della §1 stessa.

**Il reperto della composizione: due nomi, una funzione.** Due corsie avevano scritto lo stesso
`some(grantsFavor)` con nomi diversi; git ha fuso i **corpi** e ha litigato solo sul docblock.
È sopravvissuto il permissivo (`drawsFavor`), perché lo stretto avrebbe negato l'offerta
**esattamente alle schede a cui la riga disegna già la traccia**. Non è costato un test.

Il cancello del **dado** resta diverso di proposito: si apre su `Patron's Pact` (la feature che
dà il dado), non su `favor` (quella che dà la valuta). Classe ignota con 2 Favor: traccia sì,
offerta sì, **dado no**. Non puoi invocare un patrono che non hai.

---

## 3. LE DECISIONI DEL PROPRIETARIO — prese, non riproporle

1. **Lo scorrimento del pannello del tiro è spendibile, ed è stato speso.** A 1180×695, con la
   piega dei dadi aperta e un tiro sul vetro, `ROLL` è dipinto **7,3 dei suoi 54** e richiede
   uno scroll; su main prima era intero. Deciso con il numero sotto gli occhi. Il docblock di
   `Vitals` che diceva il contrario **è stato riscritto** (nella #75).
2. **Il controllo del Patron Die fuori schermo va bene**: sta dentro una piega che l'utente
   apre deliberatamente, e chi apre una piega si aspetta di scorrere.
3. **Le tre porte di scrittura su `favor.marked` restano tre**, documentate. Una coppia
   `spendFavor`/`gainFavor` atterrerebbe in `character.ts`, il file che le corsie si
   contendevano: si farà quando l'albero è uno solo.
4. **I cinque debiti in una PR loro** → è la **#75**.
5. **La pagina per il tester** è scritta, verificata contro il codice e pubblicata privata:
   https://claude.ai/code/artifact/87854956-6dc3-4b5d-b2ae-8366ce05eb94
   **La condivide il proprietario.** In coda porta le tre domande che chiudono i casi ambigui.

---

## 4. Le regole macchina che mordono

- **`. ./env.sh >/dev/null 2>&1 && node -v` deve dire v24. MAI `. ./env.sh | head`**: la pipe
  crea una subshell e lascia Node 26 sul PATH del padre, che nasconde `localStorage` a jsdom.
- **`mergeStateStatus: CLEAN` NON significa «i controlli sono passati».** Significa «nessun
  controllo obbligatorio blocca». Prima di unire, verifica che esista una run **con evento
  `pull_request`** e **con `conclusion: success` sul commit ESATTO** (`headRefOid`). In questo
  repo l'evento `pull_request` è già sparito una volta.
- **«Deploy: success» è il verdetto di GitHub, non del sito.** La conferma è scaricare
  `sw.js` e confrontare lo SHA che dichiara con `origin/main`. Fatto due volte oggi.
- **Per annullare una mutazione su un file con modifiche NON committate si usa `cp`, mai
  `git checkout`.** Il controllo dopo il ripristino è *grep del mutante E grep della
  riparazione*, non «i test sono verdi».
- **Mai la porta 5199**: è la campagna vera del proprietario. Usa 522x.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- **Il rig di misura esiste e non va ricostruito**: `~/.claude/projects/…/audit-harness/`.
  `resize_window` non è il rig: non scende sotto un minimo di finestra e lascia a 529×675 con
  `pointer: fine`.
- **Un rosso sotto carico non è un reperto.** Con nove verificatori insieme la macchina ha
  toccato **load 101 su 10 core con 0,6 GB liberi**, e `gearRandomiser.test.tsx` è andato in
  timeout a 30s dopo averne impiegati 36,5 — da solo ne impiega 2,8. Rifallo da solo prima di
  crederci.

---

## 5. IL DEBITO — in ordine

1. **`src/ui/player/Cards.tsx` — `placeholder="Search 189 cards"` è testo VIVO e sbagliato.**
   È il sito di maggior valore rimasto: la casella di ricerca dichiara a ogni utente un numero
   dell'SRD 1.0. Il libro spedito ne ha **210**.
2. **`src/ui/gm/Bestiary.tsx`** dice «129 adversaries and 19 environments»: sono **264 e 47**.
3. La cifra **`43 of the 189 domain cards`** è stata **ritirata invece che ricontata**: nessuna
   lettura del libro la riproduce. Chi la vuole indietro deve prima decidere cosa contava.
4. **Il debito dell'SRD 2**: 6 voci in `UNPRICED_AMOUNT`, 13 in `UNPRICED_LANE`, 32 in
   `SITUATIONAL`; lo sweep percorre 12 collezioni su 16; gli 11 sottosistemi delle Supplemental
   Campaign Mechanics che nulla legge; `srdIndex` che non indicizza livello né modulo per le
   armi; `Item.roll` chiamato d100 quando è 1..60.
5. **Le otto sezioni nuove del dataset** non compaiono sotto nessun chip di ShowSheet: serve un
   terzo ballottaggio dei momenti. `armor` e `consumables` sono le due che più evidentemente un
   momento ce l'hanno.
6. La **seconda metà di Combat Training** (+livello al tiro di danno fisico) resta testo:
   `modifiers.ts` esclude **per scelta documentata** i bonus al tiro.

---

## 6. Le tre lezioni che sono costate di più

**Una correzione può essere sbagliata, e questa volta la mia lo era.** Avevo detto al
proprietario, e scritto nel brief di una corsia, che l'opzione rifiutata a suo tempo costava
84px e la riga nuova 56: che il prezzo fosse la differenza. Rifatta l'aritmetica dai token:
`2+24+90+6+90+10+45 = 267` e `211+46+10 = 267`. **Costano lo stesso, al pixel.** L'84 era la
stessa opzione misurata contro una baseline diversa. La decisione regge lo stesso, ma per
l'altra colonna del registro — la riga compra una capacità che non esiste altrove e la pagano
2 classi su 13; la cella da 90 non compra niente e la paga ogni scheda.

**Un verificatore sbaglia, e il suo errore sembra una prova.** Il compositore ha dichiarato
falsa l'affermazione di una corsia («NON ho spinto»): la corsia diceva il vero, avevo spinto io
come rete di sicurezza. È il **sesto** caso in questo progetto di una correzione a sua volta
falsa. Nella stessa giornata un altro verificatore ha aperto un sospetto sull'aritmetica di un
docblock e **l'ha refutato da solo** rifacendola: è così che dovrebbe finire.

**Verifica nella direzione giusta.** Per un momento è sembrato che `origin/main` fosse tornato
indietro di tre merge — cioè che le PR del giorno prima non fossero mai state pubblicate. Falso:
una PR con numero più basso era stata unita **per ultima**, e avevo controllato l'antenato
nella direzione sbagliata. Un `git merge-base --is-ancestor` fatto al contrario è
indistinguibile da una catastrofe.
