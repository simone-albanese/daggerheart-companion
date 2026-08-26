# Handoff — 26 agosto 2026, sera

**Autorità su `main`.** `main` è `27628f0`, ed è **anche lo stato del lavoro**: zero PR aperte,
zero rami non spinti con lavoro dentro, deploy verde. È la prima volta da giorni che il handoff
non deve aprire con un avvertimento.

**148 file / 3844 test**, `tsc --noEmit` pulito, `vite build` verde.

Leggi, in quest'ordine: questo file, poi `DECISIONI-2026-08-25.md` (**diciotto** decisioni, non
dieci — le §11-§18 sono di oggi), poi `SCENE-MODEL-2026-08-26.md` e
`PIANO-SCENE-PARALLELE-2026-08-26.md` se tocchi le scene.

---

## 1. Cosa è uscito il 26 agosto, in undici merge

| PR | cosa |
|---|---|
| #16 | `wave5-pin`: la prova di `LINK → Rule`, e la frase che diceva che non ce l'aveva |
| #17 | `wave5-step5-replan`: lo step 5 ri-progettato |
| #18 | `wave5-handoff`: il handoff del mattino |
| #19 | `wave5-carta`: la piega della `CombatantCard`, i Minion nella banda, i numeri misurati |
| #20 | `wave5-catalogo`: il catalogo delle domande, i chip momento, le porte a una riga |
| #21 | il registro delle sette decisioni del 26 |
| #22 | il commento su `ShowDoor.body`, e il test dei 0.3px |
| #23 | `SCENE-MODEL-2026-08-26.md` |
| #24 | `--control` su `any-pointer`, la guardia invertita, la misura |
| #25 | `VULNERABLE` sugli avversari a Stress pieno |
| #26 | il registro della §18 |

**La wave 5 è stata spedita con la procedura decisa** — cinque PR dalla più piccola alla più
grande, con la **#20 riallineata su `main` prima del merge**. Quel verde ha girato sul base
giusto, a differenza di quello della #14 del 25.

Il conto è passato da **147 / 3789** a **148 / 3844**.

---

## 2. Le otto decisioni nuove, §11-§18 del registro

§11 `ShowDoor.body` resta ed è canonico · §12 `--control` segue `any-pointer` · §13 il test dei
0.3px · §14 il fixture porta un gruppo di Minion · §15 la lista delle 35 sezioni è confermata
senza correzioni · §16 le due cose che un rig non può misurare si guardano **dopo** · §17 un
avversario a Stress pieno è Vulnerable · **§18 le scene si parcheggiano, e l'interruttore sta sul
runner.**

Le §11-§14 e §17 sono **eseguite**. La §15 e la §16 sono risposte. **La §18 non è eseguita** ed è
il lavoro che viene.

---

## 3. Tre cose che oggi ha trovato guardando, non progettando

1. **`tokens.css` si contraddiceva da solo.** La nota accanto a `--pip-h` registrava che il blocco
   era caduto (*«a live defect rather than a decision»*), e sessanta righe più giù la stessa
   pagina diceva *«`--control` must not follow it — see the note beside `--pip-h`»*, **puntando
   alla nota che sosteneva l'opposto.** E un test pinnava la ragione scaduta. Il rimando è ciò
   che lo faceva sembrare controllato.
2. **La riga scena possiede `combatants` dallo schema 3 e nessuno lo scrive.** Il record è stato
   sistemato il 23 agosto e lo schermo non l'ha mai seguito: tutti i verbi della rissa stanno su
   `EncounterArm`, cioè sul tipo che `SESSION_ITEM_KINDS` non lascia più creare.
3. **Una memoria di lavoro era falsa.** Diceva che `SESSION_ITEM_KINDS` omette `url` e `note`; li
   omette non più — gli item 12 e 14 l'hanno allargata entrambi. Corretta.

---

## 4. Cosa è stato misurato in Chrome, e cosa ha risposto

### 4.1 `--control` su profilo `hybrid`, dieci casi, `dist` ricostruito per ciascuna metà

| | controlli sotto i 44px |
|---|---|
| **prima** | **272** sui dieci casi |
| **dopo** | **1** |

L'unico superstite è una checkbox da 20px in Settings: corta in **larghezza**, non dimensionata da
quel token. Sotto il pavimento c'erano **tutte le linguette di schermo**, le sei chiavi del danno
su Play e le sette sezioni di Settings. La paura della vecchia guardia — contenuto tagliato da un
antenato che non si può scorrere — **non si è avverata: 0 → 0 su GM, Build e Settings.**

**Il costo è vero ed è sulla griglia Cards.** Una carta è alta fissa col testo in ciò che avanza,
quindi i dieci pixel escono dal testo: l'anteprima va **110 → 100** a 1440×900 e **112 → 102** a
1280×800. Dodici carte in più a 1440 passano da intere a troncate. Accettato dal proprietario a
ragion veduta: 145 erano già troncate lì, e il testo intero è a un tocco.

### 4.2 `VULNERABLE` sulla banda, 393×852, insets 47/34, coarse

Carta **471.00 con la parola e 471.00 senza**, banda **31** in entrambe. La parola è **66.00 ×
10.00** e prende il posto del divisore, non della riga. Nessun termine della derivazione a nove
termini si muove.

---

## 5. Il prototipo, e cosa ha già cambiato

`https://claude.ai/code/artifact/82474e75-9af8-4302-a729-6ccf73d5d6ac`

Cliccabile, due rese (telefono 393 / portatile 1180), coi token veri dell'app. **Non è l'app.**

Serve a una cosa sola ed è già servita: **due proposte fatte a voce sono state smontate prima di
diventare codice** — la striscia da 61px e il modello senza copia. Entrambe le correzioni sono
nel preambolo di `PIANO-SCENE-PARALLELE-2026-08-26.md`.

---

## 6. Alla ripresa: la verifica prima, e il parallelo dove è lecito

### 6.1 Il cancello d'ingresso, e gira in parallelo

Tre controlli indipendenti, **da lanciare insieme**, prima di toccare qualunque cosa:

- `. ./env.sh && npx vitest run` → attesi **148 file / 3844 test**;
- `. ./env.sh && npx tsc --noEmit` → pulito;
- `. ./env.sh && npx vite build` → verde, più `gh run list --workflow=deploy.yml --limit 1` che
  deve dire `success` su `27628f0`.

Se uno dei tre non torna quello che c'è scritto qui, **fermati e scoprilo prima di costruire.**

### 6.2 Poi la §18, e il parallelo NON è totale

`PIANO-SCENE-PARALLELE-2026-08-26.md` §8 ha già fatto la mappa delle collisioni, ed è la cosa da
leggere prima di distribuire il lavoro:

> **Ordine: 0 → 1 → (2 ∥ 3).**

- **Lane 0** — schema, reader, plumbing. **Deve atterrare da sola.** Tutto il resto importa il
  tipo: i due campi nuovi sono obbligatori, quindi ogni literal nel repo è un errore di
  compilazione finché lane 0 non è dentro.
- **Lane 1** — park and resume. Dopo lane 0.
- **Lane 2** (lo switcher) **e lane 3** (i countdown per scena) **possono girare in parallelo**,
  dopo lane 1 — **con una sola eccezione**: `tests/gm/gmScreen.test.tsx`, che entrambe
  toccherebbero. Assegnalo a lane 3 e fai che lane 2 non lo apra.

**Le lane 1 e 3 NON possono girare in parallelo.** Scrivono entrambe `gmStore.ts`,
`SessionBody.tsx`, `session.ts`, `Scene.tsx` e `shared/campaigns.ts` — **cinque file**. È
esattamente l'errore che questo repo ha già pagato due volte, e questa volta è scritto prima
invece che dopo.

### 6.3 Il cancello di misurazione, che non è una cortesia

**La lane 2 non si spedisce senza Chrome.** §3.5 del piano elenca cosa. E la resa a due colonne
sopra i 1180px **non è stata misurata da nessuno**: è disegnata nel prototipo, non verificata. Se
una colonna da ~590px fa incartare la carta del combattente, quel numero cambia — ed è la stessa
trappola che ha già colpito due volte.

Il rig sta in `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/`,
accetta `AUDIT_ORIGIN`, e il suo fixture va **ripristinato** dopo ogni modifica: oggi è stato
alterato per misurare la carta del Vulnerable e rimesso a posto (`region: encounter`,
`combatants: []`). Verificalo prima di usarlo.

---

## 7. Cosa resta aperto

**Deciso e non fatto:** la §18, tutta.

**Aperto e non deciso:**

1. Le **voci 13-48 del catalogo**: 27 sezioni di mezza scena scoperte, pinnate come `toEqual`
   esatto. È una lista di cose da fare che va rossa da entrambi i lati, di proposito.
2. I **✕ «Remove X from the scene» a 34px di larghezza** contro un pavimento di 44, su un'azione
   irreversibile. Pre-esistente, misurato identico oggi.
3. Lo **step 5**, ri-progettato e mai eseguito.
4. **`PROGETTO-GM §7` voce 6** — se un terzo gruppo QUESTIONS spinga il primo risultato sotto la
   piega. Misurabile adesso, sui 308px.
5. Le **due cose che un rig non può misurare** — il `<mark>` in una stanza buia, i chip a metà
   spaziatura. La §16 dice **dopo**, e «dopo» è adesso.
6. Le **tre voci da ratificare** elencate in `SCENE-MODEL-2026-08-26.md` §6. Non sono
   ribaltamenti, ma non vanno date per scontate.

---

## 8. Cosa non toccare, e sono decisioni

Le voci di `WAVE3 §8` e di `HANDOFF-2026-08-26 §8` restano in vigore. Ripetute quelle che il
lavoro imminente sfiora:

- **`encounter` non rientra in `SESSION_ITEM_KINDS`**, e la catena non converte mai una riga da
  sola. `url` e `note` invece **ci sono** — la vecchia frase che diceva il contrario è stale.
- **`ShowDoor.body` non si cancella**: è la formulazione canonica, e il docblock sul campo dice
  perché (§11).
- **`--control` non torna a `pointer: coarse`.** La guardia adesso asserisce il contrario, e la
  vecchia è citata dentro di essa perché la sua ragione era scaduta (§12).
- **Il docblock di `Countdowns.tsx` non si revoca**; **`combatantHit` prende il flag del Massive
  come opzione obbligatoria**; **la marcatura accende solo il blocco d'atterraggio**;
  **`DB_NAME` non si muove**; **`gmPartySize` non si deriva da `party.length`**; **la schermata
  Play scorre**.
- **Le sezioni rilasciate di `CHANGELOG.md` non si riscrivono**, e la voce `## Unreleased` la
  scrive **una sola** lane, quella che spedisce.
- **Mai `git add -A`.**
- **Le prove per mutazione in una copia isolata**, col mutante **grepato presente prima e dopo**.
  Oggi quella regola ha beccato due proof che riportavano «sopravvissuto» senza essere mai state
  applicate.
- **`. ./env.sh` prima di ogni comando npm.** Il node di sistema è 26 e nasconde `localStorage` a
  jsdom.
- **`build:srd -- --check` è il cancello vero** per qualunque cosa tocchi dataset o parser.

---

## 9. Per riprendere

Il cancello del §6.1, in parallelo. Poi lane 0 da sola, lane 1, e (2 ∥ 3) con
`tests/gm/gmScreen.test.tsx` assegnato alla 3.

**La domanda viva per il proprietario è una sola**, ed è nel piano §10: se al tavolo si salti fra
le scene tanto quanto si crede. Se si salta molto meno — perché si narra un blocco intero prima di
passare — allora il valore è tutto nel parcheggio, la lane 2 vale molto meno di quanto costa, e la
funzione da costruire è metà.
