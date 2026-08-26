# Handoff — 26 agosto 2026, tarda sera

**Supersede `HANDOFF-2026-08-26-srd-deciso.md` su un punto solo, e su quello lo contraddice:
la voce 1 del suo §5 — «il numero mente» — è basata su una premessa falsa.** Tutto il resto di
quel documento regge e resta l'autorità.

`main` è ancora **`f30cc01`**. Il lavoro di oggi è in **PR #37**, non unito.

---

## 1. Il cancello, ricontrollato su `main` a inizio sessione

Node **v24.19.0** via `. ./env.sh`. Passato per intero, e i numeri non si erano mossi.

| | atteso | esito |
|---|---|---|
| `npx vitest run` | 150 file / 3947 test | **combacia** |
| `npx tsc --noEmit` | pulito | **pulito** |
| `npx vite build` | verde | **verde, 2.26s** |
| `npm run build:srd -- --check` | combacia | **`matches the source`** |
| `sw.js` pubblicato | il commit di `main` | **`f30cc01`** |

`git status --short --untracked-files=all` vuoto: nessuna sonda lasciata in giro.

---

## 2. LA COSA DA LEGGERE PRIMA DI TUTTO: `SEND 3` non mentiva

Il handoff precedente apriva il §5 così:

> *«Tre gruppi di Giant Rat con quattro giocatori: il bottone dice **3**, la riga chiusa dice
> **12**, e ne arrivano dodici. Quale dei due numeri è quello giusto è una decisione.»*

**Ne arrivano dodici *ratti* e tre *carte*.** Il documento confondeva le due cose, e la confusione
è arrivata fino a una proposta scritta e mezza implementata prima che un test la fermasse.

Il meccanismo, verificato riga per riga:

```
Encounter.tsx:601   for (const e of entries) spawn(e.adversary, partySize, e.count);
gmStore.ts:870      spawn(a, partySize, times) → il ciclo gira `times` volte
encounter.ts:193    ...(a.role === 'Minion' ? { minionsRemaining: partySize } : {})
Scene.tsx:931       ogni carta Minion disegna uno stepper  MINIONS − 4 +
```

`spawn` gira **una volta per `count`**, non per corpo. Una carta Minion **è** un gruppo, e porta
il gruppo dentro di sé come contatore. Quindi:

- **`SEND 3`** predice le **3 carte** che compaiono. **È giusto.**
- **`12 PLANNED`** conta i **12 ratti**. **È giusto anche lui.**

Sono due domande diverse in due unità diverse. **Non c'è nessuna decisione da prendere fra i due
numeri: erano già tutti e due veri.**

### Come è stata presa, e perché va raccontato

La proposta di far dire `SEND 12` era scritta, argomentata con cinque motivi e già nel codice.
L'ha uccisa **un test scritto per confermarla**:

```ts
const said = /SEND (\d+) /.exec(sendButton().textContent)?.[1];
act(() => { sendButton().click(); });
expect(useGm.getState().combatants).toHaveLength(Number(said));
//  → expected [...3 items] to have a length of 12 but got 3
```

Il test leggeva l'etichetta dal vetro, toccava, e contava cosa arrivava — invece di confrontarla
con un `12` scritto nel test. **Un letterale avrebbe confermato la lettura sbagliata.** È la
regola che il blocco di test porta scritta adesso, ed è la lezione più riutilizzabile della
giornata.

**Se `SEND 12` viene riproposto citando «ne arrivano dodici», la citazione è vera sui ratti e
falsa sulle carte, e produrrebbe tre carte sotto un'etichetta che ne promette dodici.**

---

## 3. Cosa c'è dentro PR #37

Ramo `scene-count-and-words`, commit `9c72fb0`. CI presa da un runner in 37 secondi.

| | |
|---|---|
| `vitest` | **150 file / 3953 test** (+6) |
| `tsc` | pulito |
| `vite build` | verde |
| `build:srd -- --check` | combacia |

### 3.1 Il conteggio che *era* sbagliato: il costruttore di scene

`AddSheet.tsx:332` sommava `count` grezzo mentre la riga che quel bottone crea legge `12 PLANNED`
sullo stesso roster. Era **l'unico dei tre punti che non sapeva predire il proprio risultato**.
Ora chiama `plannedAdversaries`, esportato apposta da `session.ts`.

### 3.2 Le parole — la decisione del proprietario, applicata dove è giusta

Deciso: «the scene» ovunque. **Applicato solo dove i due nomi indicano davvero la stessa cosa**,
perché applicato alla lettera avrebbe distrutto una distinzione viva:

```
SessionBody:467   adversaries on the board belonging to no row of the plan
```

Quella frase è **impossibile** se board e scene sono la stessa parola. In questo codice il
**piano** è la lista, una **scena** è una riga, il **board** è il vetro dove stanno i segnalini.
Tre concetti, non due.

Il difetto vero era in un posto solo, e lì la decisione era giusta: `AddSheet:385` chiamava
«the board» il **roster**, due righe sopra la propria didascalia che dice *«The roster is the
plan»*. Ora legge `CARRY THE 12 INTO THIS SCENE`. **Il vocabolario di `SessionBody` non è stato
toccato.**

### 3.3 I due ✕ distruttivi arrivano al pavimento

`Scene.tsx` (rimuovi avversario) e `Countdowns.tsx` (elimina countdown) scrivevano `width: 34`
come letterale accanto a un'altezza `var(--control)`. Su un telefono: **34px di larghezza sotto
un pollice, su un'azione irreversibile.**

`Countdowns.tsx:60` lo aveva già scritto — *«due ✕ più vecchi di questo scaffale non lo
rispettano»* — e lo aveva **rimandato per mancanza di misure in un browser**.

**Nessun browser è servito.** `tokens.css:369` tiene già `--control` a 44px su ogni puntatore
grossolano; era **solo la larghezza** a non adattarsi. Ora entrambi leggono `var(--control)`: 44
sotto un pollice, 34 sotto un mouse. Nessun numero nuovo.

**Il costo è dichiarato dove atterra:** dieci pixel orizzontali sul nome dell'avversario a 393.
`Scene.tsx` porta l'aritmetica aggiornata, 271 → 261. **Il corpo del testo non cambia** — il nome
tronca dieci pixel prima, non rimpicciolisce.

### 3.4 Tre affermazioni di prosa false, corrette dove stanno

1. `AddButton` si diceva *«l'ultima superficie che stampa un conto di gruppi dove si legge un
   conto di corpi»*. Ne restavano due.
2. `AddSheet:242` citava *«il modulo encounter due schermi più giù dice TAKE THE 3 ON THE BOARD
   NOW»* — la stringa era **sua**, e l'encounter dice `SEND n TO THE SCENE`.
3. `Countdowns` diceva che i due ✕ non erano stati cambiati «deliberatamente».

---

## 4. Le corsie parallele: com'è andata

Verificato **prima** di partire, non supposto: le due corsie **non condividono un file**.

| corsia | file | esito |
|---|---|---|
| **B — scene** | `Encounter`, `AddSheet`, `session.ts`, `Scene`, `Countdowns` | **PR #37** |
| **A — SRD 2.1** | `srdIndex.ts`, `srdReference.ts`, `RuleSearch.tsx` | **mai partita** |

L'unico contatto è che `SessionBody.tsx:198` *legge* `srdReference.ts`, e la 2.1 vi **aggiunge**
`searchSrd` senza toccare `ruleSection`. La verifica regge ancora: **A e B restano
parallelizzabili.**

Il worktree della corsia A e il ramo `srd-index` sono stati **rimossi** (zero commit) per non
lasciare un ramo vuoto che sembra lavoro.

---

## 5. Da riprendere, in quest'ordine

1. **Unire #37** quando la CI è verde. `gh pr merge` è ciò che pubblica; il `git push origin main`
   successivo è un no-op.
2. **La corsia A — SRD 2.1 — non è mai partita e il suo piano è intatto.** `src/ui/shared/srdIndex.ts`
   nuovo, 849 record → `{ kind, id, name, page, haystack }`, `searchSrd` **accanto** a
   `searchRules`. **Deve CABLARLO**, non solo costruirlo: `tests/harness/orphans.test.ts` cammina
   `src/` e fallisce su un export senza chiamante. Poi 2.2 → 2.3 → 2.4, **sequenziali, una PR per
   parte** — scrivono tutte `RuleSearch.tsx`.
3. **Resta da misurare una cosa sola:** la lista dei risultati dentro Play. Colonna diversa da
   quella di `ShowSheet`, i suoi 294.3px non si trasportano. **Il rig esiste** — `ls` diretto, mai
   un `find` sulla home:
   `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/`

---

## 6. Una domanda aperta, e tre voci ancora ferme

**Aperta, registrata e non indovinata:** `SEND 3` è un numero nudo, e la regola che questo repo
scrive per `AddButton` è che *un numero nudo si legge come corpi*. Oggi resta onesto grazie al
vicino — il pannello pochi pixel sopra stampa `3 GROUPS OF 4`, e ogni carta che arriva dice
`MINIONS 4`. **Se il bottone debba scrivere i gruppi da sé è una decisione del proprietario.**
Il codice porta la domanda scritta accanto al bottone.

Delle cinque voci del §5 del handoff precedente, **due sono chiuse in #37** (le parole, il ✕),
**una si è rivelata inesistente** (il conteggio di `SEND`), **una era reale ed è riparata**
(`AddSheet`). **Restano ferme:**

- **Il roster di una riga scena è a scrittura unica.** Una riga creata prima della rissa non può
  più ricevere avversari, e nessun messaggio lo dice. *(Rovina una serata.)*
- **`adjustments` su una riga scena è scritto alla creazione e letto da nulla.**

---

## 7. Nuovo vincolo del proprietario, in vigore da oggi

**Leggibilità e colpo d'occhio nella consultazione. Niente cose troppo piccole.**

Conseguenza operativa immediata, da applicare alla 2.1–2.4: **la lista dei risultati dentro Play
non si fa entrare rimpicciolendo il testo.** Se non entra, si taglia il numero di risultati
visibili o si scorre. **Non si scende di corpo.**

È anche il motivo per cui `SEND 3 GROUPS · 12 ADVERSARIES` era da scartare a prescindere dal
merito: su un primario a piena larghezza a 375px o va a capo o rimpicciolisce.

---

## 8. Cosa non toccare

Restano in vigore tutti i divieti di `HANDOFF-2026-08-26-srd-deciso §6`. Più, da oggi:

- **`SEND n TO THE SCENE` conta le carte, ed è giusto.** Il motivo è scritto accanto al bottone.
  Chi lo "corregge" a 12 mette tre carte sotto un'etichetta che ne promette dodici.
- **`the board`, `the plan` e `a scene` sono tre concetti distinti**, non tre nomi per uno.
  `SessionBody:467` è la frase che lo prova.
- **La larghezza di un bersaglio distruttivo è `var(--control)`, non un letterale.**
- **Un test che porta la risposta attesa come letterale è un test che conferma qualunque cosa il
  codice faccia dopo.** Il blocco SEND legge l'etichetta dal vetro e conta cosa arriva.
