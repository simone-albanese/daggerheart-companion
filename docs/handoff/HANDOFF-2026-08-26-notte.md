# Handoff — 26 agosto 2026, notte

**Autorità su `main`.** `main` è `5c9f1cc`, ed è **anche lo stato del lavoro**: zero PR aperte,
zero rami non spinti con lavoro dentro, deploy `success`. Per la seconda sera di fila il handoff
non apre con un avvertimento.

**150 file / 3941 test**, `tsc --noEmit` pulito, `vite build` verde, `build:srd -- --check`
combacia.

Questo file **supersede `HANDOFF-2026-08-26-sera.md`** per tutto ciò che riguarda la §18, che era
l'unico «deciso e non fatto» che quel documento elencava. La §18 è **spedita, intera.**

Leggi, in quest'ordine: questo file, poi `PIANO-SCENE-PARALLELE-2026-08-26.md` §7 **solo se ti
serve la storia degli overturn** (le sue citazioni sono ora stale — vedi §5 qui sotto), poi
`RICERCA-SRD-2026-08-26.md` se tocchi la ricerca.

---

## 1. La §18 è chiusa, in quattro merge

| PR | lane | cosa |
|---|---|---|
| #28 | 0 | schema 3 → 4, i due campi, la pass di riparazione del lettore, `v4.campaign.json` |
| #29 | 1 | park & resume, i quattro overturn, `SceneArm` riscritto, tre difetti chiusi |
| #30 | 2 | lo switcher nella title row, col cancello Chrome **passato con misure vere** |
| #31 | 3 | i countdown per scena, più il `## Unreleased` di tutta la §18 |

Il conto è passato da **148 / 3844** a **150 / 3941**.

**L'ordine `0 → 1 → (2 ∥ 3)` ha retto.** Le lane 2 e 3 sono state tagliate in due worktree da
`main` locale e la 3 ha ribasato sulla 2 **senza un solo conflitto**, che è esattamente ciò che la
mappa delle collisioni del piano prometteva. La regola vale: le collisioni si scrivono prima.

---

## 2. Le dodici decisioni prese oggi dal proprietario

Otto chieste prima di scrivere una riga, quattro dopo che l'audit ha trovato cose che nessun
documento aveva visto.

1. **Piano additivo**, non il rifattoring radicale di `GmBoard.combatants` (§10.6). Registrata
   come decisione differita, non come idea persa.
2. **O1, O2, O3 approvati tutti e tre.**
3. **Al tavolo si salta molto fra le scene** → la lane 2 vale il suo costo, tutte e quattro le
   lane si costruiscono.
4. **Ambito: solo la §18.**
5. **Switcher in alto**, nella title row.
6. **Un `long-term` può appartenere a una scena**, e `RestControl` continua a elencarli tutti.
7. **Il bump viaggia da solo** — niente annidamento.
8. **Le tre ratifiche di `SCENE-MODEL` §6 confermate tutte e tre.**
9. **`END SCENE` è un quarto overturn, approvato**: scrive anche la riga e il pointer.
10. **«Conferma sempre» vale solo per ciò che distrugge** — il flip resta a un tap.
11. **`OPEN THE SCENE` non è più primario** su una riga né viva né con una rissa dentro.
12. **La deriva di `roster`/`adjustments` e dell'ambiente cambiato a metà rissa è accettata**
    com'è.

---

## 3. Tre difetti che nessuno dei due documenti aveva visto

Trovati confrontando i documenti **contro l'albero**, non leggendoli. Tutti e tre chiusi nella
lane 1.

1. **Il park poteva buttare un combattimento per terra.** Il lettore controlla `liveScene` contro
   l'id di **ogni** riga, non di ogni riga scena — una riga `unreadable` tiene il suo id apposta —
   quindi un file modificato a mano può puntare il board su una riga countdown. Il park matcha
   solo righe scena: la rissa non aveva dove andare e il `commit` la sovrascriveva. Ora un pointer
   che non nomina una riga scena è trattato come nessun pointer, e la rissa riceve una casa
   coniata.
2. **Il runner usava la stessa chiave React per due risse diverse.** `spawn` cerca l'indice libero
   solo sul board — il fatto stesso che rende `liveScene` non derivabile — quindi dungeon e
   foresta tengono entrambi `acid-burrower-0`. React riusava la carta attraverso un salto, e con
   lei il suo stato locale: **il numero di danno mezzo digitato e la piega aperta passavano da una
   rissa all'altra.** Ora la chiave è `${liveScene}:${c.id}`.
3. **`END SCENE` restava armato attraverso un salto.** `Scene` non si smonta quando il board
   cambia, quindi armarlo, saltare e ribattere entro quattro secondi **distruggeva la rissa appena
   raggiunta** invece di quella armata. Ora un salto disarma.

Più uno minore: `thresholds` è una tupla mutabile e attraversava per riferimento; adesso si copia
con `hp` e `stress`.

---

## 4. Il cancello Chrome della lane 2, e cosa ha risposto

Misurato a **393×852, insets 47/34, coarse**, quattro scene vive, contro un `dist` di questo ramo
**e un `dist` di controllo costruito da `main`**. Il fixture del rig è stato patchato per la misura
e **ripristinato — verificato** a `region: encounter`, `combatants: []`, nessun `liveScene`.

| | prima (`main`) | dopo |
|---|---|---|
| title row | 45.00 | **45.00** |
| scroller | 385.00 | **385.00** |
| pannello | 432.00 | **432.00** |
| ✕ | 44×44, right 386.00, top 326.00 | **identico** |

**Il costo verticale è 0.00px, misurato e non argomentato.**

La striscia è **315.00**, esattamente ciò che la sottrazione del piano prediceva. E **7.00px per
carattere**, tre fit esatti indipendenti: `DUNGEON` 7 caratteri a 69.00, `FOREST` 6 a 62.00, `GATE`
4 a 48.00 — ognuno `caratteri × 7 + 20` al centesimo. Quindi **il cap di sette caratteri a quattro
scene è reale**, non assunto: 74.00 ne tiene sette a 69.00 e un ottavo ne chiederebbe 76.00.

**Una correzione al piano.** Derivava lo scroller a 451.00 con un countdown pinnato e 501.00 senza,
marcandoli entrambi «(derivata)». Sulla campagna del rig è **385.00**. Niente vi poggia sopra — il
delta era la pretesa e il delta è zero — ma quelle due cifre vanno smesse di citare come se fossero
state in un browser.

---

## 5. Il piano della §18 è ora un documento storico, e le sue citazioni sono stale

`PIANO-SCENE-PARALLELE-2026-08-26.md` ha guidato bene questo lavoro ed è stato quasi sempre esatto.
Ma **è stato scritto contro `27628f0` e le lane 0-3 hanno mosso le righe sotto di lui.** Non
riparare le citazioni: il documento ha fatto il suo lavoro. Sappi solo che:

- la sua riga 30, *«NON È STATO ESEGUITO NIENTE»*, è falsa da questa mattina;
- **19 delle 21 citazioni di `shared/campaigns.ts` si sono spostate** di +5..+143 righe;
- il conto dei letterali countdown era 19, i veri erano **16**; il conto dei `beforeEach` era 15,
  i veri erano **16**;
- diceva che `campaignMigration.ts` sarebbe stato un errore di compilazione: **non lo è** — quella
  funzione ritorna `Record<string, unknown>`;
- diceva che `describeItem` ha ~20 call site: **ne ha due**;
- diceva che `tests/harness/orphans.test.ts` avrebbe fallito su un export di `shared/` senza
  chiamante: **non lo fa**, quel test cammina solo `src/`.

---

## 6. Cosa resta aperto

**Deciso e non fatto:** niente della §18.

**Il lavoro che viene** è in `RICERCA-SRD-2026-08-26.md`: rendere la consultazione dell'SRD un
sistema per **entrambi i lati del tavolo**. Quattro proposte, e la prima è l'indice che le altre
leggono.

**Aperto e non deciso, dal handoff della sera e ancora vero:**

1. Le **voci 13-48 del catalogo** delle domande: 27 sezioni di mezza scena scoperte.
2. I **✕ «Remove X from the scene» a 34px** contro un pavimento di 44, su un'azione irreversibile.
3. Lo **step 5**, ri-progettato e mai eseguito.
4. **`PROGETTO-GM §7` voce 6** — se un terzo gruppo QUESTIONS spinga il primo risultato sotto la
   piega.
5. Le **due cose che un rig non può misurare** — il `<mark>` in una stanza buia, i chip a metà
   spaziatura.

**Registrati come rischi accettati, non risolti** (§4.13 del piano): due tab sulla stessa campagna
possono ora sovrascrivere una rissa **parcheggiata** che non hanno mai visto; e due scene senza nome
danno due chip identici che dicono `SCENE`.

---

## 7. Cosa non toccare, e sono decisioni

Le voci di `WAVE3 §8` e di `HANDOFF-2026-08-26 §8` restano in vigore. Le nuove di oggi:

- **`liveScene` non è mai un indice.** `readCampaignRecord` riordina per `order` e rinumera a ogni
  load, quindi solo `id` è identità stabile.
- **Il park non scrive mai `environmentRef`.** `KEEP WHAT IS ON THE BOARD` resta l'unico verbo che
  scrive il piano di una riga.
- **`countdownsOf` continua a significare ogni orologio della campagna.** Lo scope è un argomento a
  un call site — `countdownsIn` — e mai un restringimento di quel nome. Un `countdownsOf` ristretto
  toglierebbe l'orologio a lungo termine della foresta dalla lista che un riposo può avanzare,
  **senza un messaggio d'errore da nessuna parte.**
- **`RestControl` elenca tutti i long-term**, etichettati per scena. Restringerlo è la regressione
  senza sintomo.
- **Niente ticchetta.** Non al park, non al resume, non a END SCENE.
- **Il pin non si disegna su una riga scoped**, invece di disegnarlo e rifiutarlo.
- **`encounter` non rientra in `SESSION_ITEM_KINDS`.**
- **Mai `git add -A`.** **`. ./env.sh` prima di ogni comando npm.** **Le prove per mutazione in una
  copia isolata.** **`build:srd -- --check` è il cancello vero.**
- **Il fixture del rig va ripristinato e verificato** dopo ogni misura. Oggi è stato patchato per
  quattro scene vive e rimesso a posto; controllalo prima di usarlo.

---

## 8. Per riprendere

Il cancello del §6.1 del handoff della sera, invariato e in parallelo: `vitest run` deve dire
**150 / 3941**, `tsc --noEmit` pulito, `vite build` verde e `gh run list --workflow=deploy.yml`
`success` su `5c9f1cc`. Se uno dei tre non torna quello che c'è scritto qui, **fermati e scoprilo
prima di costruire.**

Poi `RICERCA-SRD-2026-08-26.md`. **Quel lavoro non è parallelizzabile e il documento dice perché.**
