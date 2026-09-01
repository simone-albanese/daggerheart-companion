# Handoff — il Focus e il Favor su Gioco: progettato, misurato, non costruito

**LEGGI PRIMA LA §1 E PONI LE OTTO DOMANDE.** Il proprietario ha chiesto
esplicitamente che una ripresa a contesto pulito **cominci chiedendo**, non
costruendo. Nessuna riga di codice prima delle risposte.

Il progetto della §2 è misurato e regge; quello che manca sono decisioni, non
indagini. I commit si citano **per oggetto, mai per SHA**.

---

## 0. Stato, misurato — 1 settembre 2026

Tutto unito e **pubblicato**, verificato sul sito e non dedotto.

```
main                        «Merge pull request #68 from simone-albanese/readme-srd-2»
sw.js pubblicato            cc88c0d2c149cf961beb469e3886c589919dac38  (combacia)
npx tsc --noEmit            0 errori
npx vitest run              186 file / 4624 test
build:srd --check           entrambi i libri combaciano con la sorgente
build:registry --check      1368 id, 9 conservati
```

Tre PR unite oggi: **#66** (l'SRD 2.0), **#67** (il cancello sulla sottoclasse),
**#68** (il README). L'app pubblica SRD 2.0: `SCHEMA_VERSION` 8, `CODEC_VERSION`
8, 16 collezioni, 74 regole, 16 stance.

**UNIRE È IL DEPLOY.** `deploy.yml` parte su ogni push a `main`. Spingere un ramo
non lo è. Il proprietario dà il via con la parola «vai».

---

## 1. LE OTTO DOMANDE — porle tutte, prima di qualunque cosa

Raggruppate; le prime tre bloccano il lavoro, le altre lo indirizzano.

### Bloccanti

1. **Il seme del Favor in migrazione.** Il libro dice *«You start with 3
   Favor»*, ma una migrazione non crea un personaggio: aggiorna uno che gioca
   già. Seminare 3 a un Warlock a metà campagna è inventargli uno stato che non
   ha guadagnato. Le due ondate precedenti hanno seminato **vuoto**
   (`stanceRefs: []`, `focus: {0, MAX_FOCUS}`).
   *Proposta:* `favor: {marked: 0, max: 6}` in migrazione, e il 3 solo per un
   personaggio **nuovo**, dove la frase del libro parla davvero.

2. **Dove esattamente su Gioco.** `Vitals` disegna HP, Stress, Speranza, caselle
   d'armatura. Il Focus e il Favor vanno **in quella fila** (una traccia in più
   accanto alle altre) o in **una riga propria** sotto?
   *Nota di ergonomia:* si spendono nel mezzo di un tiro, quindi devono stare
   nell'arco del pollice, vicino al controllo del tiro. Vedi la memoria
   `reason-about-screen-ergonomics`: serve un ragionamento esplicito su
   arco-del-pollice, dimensione del bersaglio e leggere-contro-toccare, e la
   misura va fatta in Chrome a 393×852, non dedotta.

3. **Il Focus resta anche in Build?** Oggi è **solo** lì (sezione Martial
   Stances, con lo stepper). Se compare su Gioco: resta in tutte e due, o si
   toglie da Build? Due controlli sullo stesso numero su due schermi è una
   scelta, non un incidente — la scheda di Build è dove si *conoscono* le
   stance, Gioco è dove si *spende*.

### Di indirizzo

4. **Il Patron Die: solo pool, o anche armabile?** `dicePools.ts` è la casa
   giusta (il suo docblock cita come esempio motivante proprio la scala
   d6→d8-al-5). Ma `heldDice.ts` è il *vassoio* da cui un dado si arma dentro un
   tiro. Il Patron Die si spende **prima** di un tiro d'azione e si somma al
   totale: va armato come gli altri, o basta mostrarlo?

5. **«Gain a Favor instead of a Hope».** Su un successo con Speranza il Warlock
   può prendere un Favor al posto della Speranza. Serve un controllo sul
   risultato del Duality Roll che lo offra, o resta a mano? *L'app propone e non
   applica* — offrirlo sarebbe coerente; non offrirlo è una traccia in meno.

6. **La stance `invigorating`** dà un Focus su un 4 di un d4, dopo un attacco
   riuscito. Offrire il tiro come si fa col danno, o lasciarlo a mano?

### Pulizia

7. **Il ramo `srd-2` e il suo worktree** hanno finito: uniti in `main`.
   Rimuoverli libera anche ~1,9 GB. Procedo?

8. **Uno scratchpad orfano da 1,3 GB** di una sessione più vecchia
   (`f24758f6-…`). Cancellarlo?

---

## 2. Il progetto, e la misura su cui poggia

**Sono la stessa cosa due volte: due tracce con lo stesso tetto stampato, 6.**

### Il Focus — Martial Artist

Già modellato dalla #66. `Character.focus` è un `Counter`, il tetto è
`MAX_FOCUS = 6` da una frase del folio 13, e la regola di ricarica è nel dataset
dalla #66 (`rules/focus`: una volta per riposo, azzeri, tiri d6 pari all'Istinto,
prendi il più alto). **È disegnato solo in Build.** Un Martial Artist deve
uscire da Gioco per spendere un Focus: è il difetto segnalato.

Cancello: la sottoclasse `martial-artist`, lo stesso che la #67 ha spedito.

### Il Favor — Warlock

**Non modellato affatto.** `Character` non ha il campo. Il libro lo definisce per
intero, nella feature di classe del Warlock:

> *"You start with 3 Favor. You can use a downtime move to show tribute to your
> patron. Describe how and gain Favor equal to your Spellcast trait.
> Additionally, when you succeed on an action roll with Hope, you can choose to
> gain a Favor instead of a Hope. **The maximum Favor you can hold at one time
> is 6.**"*

E il dado:

> *"Before making an action roll that relates to your patron's sphere of
> influence, you can spend a Favor to call upon their aid, rolling your Patron
> Die and adding its result to the total. **Your Patron Die starts at a d6 and
> increases to a d8 at level 5.**"*

Cancello: la classe `warlock`.

> **TRAPPOLA MISURATA.** Cercare `Favor` nel dataset dà 15 siti e **tre sono
> inglese comune**: *"in favor of the PCs"* (regole), *"They owe me a favor"*
> (syndicate), *"garner favor"* (endless-charisma). E le classi **non hanno**
> `features`: hanno `hopeFeature` e `classFeatures`. Una sonda che cerca
> `c.features` trova zero per tutte e tredici e fa concludere che il libro taccia.
> Io ci sono cascato e stavo per riferire un difetto del parser inesistente.

### Cosa costa costruirlo

1. **`Character.favor`**, un `Counter`. Schema **8 → 9**, con una migrazione
   (vedi domanda 1). Il codec va bumpato: `CODEC_VERSION` è 8 e
   `READABLE_CODEC_VERSIONS` è `[1,2,4,8]`; **8 era l'ultimo nibble utilizzabile**
   — il docblock di `codec.ts` dice che il prossimo bump deve **allargare
   l'header**, non scegliere un numero peggiore. Questo è quel bump.
2. **Le quattro liste di guardia**, ed è la parte che si dimentica:
   `readCounter` in `readCharacterRecord`, le chiavi di `checkShapes`,
   `boundCounters` in `src/store/state.ts`, e il codec. Vedi la memoria
   `the-guard-is-a-list`: tre campi in tre ondate sono arrivati senza. La prova
   è un confronto — dare al campo nuovo lo stesso abuso che si dà a `hp` e
   vedere se risponde allo stesso modo.
3. **`Vitals.tsx`**: disegnare le due tracce, ciascuna col suo cancello.
4. **`dicePools.ts`**: il Patron Die come pool, taglia d6 → d8 al livello 5.

---

## 3. Le regole macchina che mordono

- **`. ./env.sh >/dev/null 2>&1 && node -v` deve dire v24. MAI `. ./env.sh | head`**:
  la pipe crea una subshell e lascia Node 26 sul PATH del padre, che nasconde
  `localStorage` a jsdom — una suite verde in locale è più debole di quella di CI.
- **Per annullare una mutazione su un file con modifiche NON committate si usa
  `cp`, mai `git checkout`**: checkout riporta a HEAD e cancella la riparazione
  insieme al mutante. È successo oggi. Il controllo dopo il ripristino è *grep
  del mutante E grep della riparazione*, non «i test sono verdi».
- Una probe deve stare nella **radice** dell'albero o `tsx` fallisce, e va
  cancellata.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- **Mai la porta 5199**: è la campagna vera del proprietario.
- **Verificare che una run CI esista** e sia sul commit esatto prima di unire.
- Il PDF dell'SRD 1 è `Manuali/Daggerheart-SRD-9-09-25.pdf`; l'SRD 2 è
  `DH_SRD_2_2026_08_25.pdf`. Nessun file ha «srd» e «1» insieme nel nome.

---

## 4. Cosa ha sbagliato questa sessione

Sei errori, tutti trovati dalla misura e non dal ragionamento. La forma si
ripete: **leggere una fonte una volta sola e trattare quella lettura come
definitiva.**

1. Ho dichiarato finita un'ondata che aveva **tre fasi** che non avevo visto,
   perché avevo letto il journal una volta sola quando era ancora a due righe.
2. Ho integrato la **prima** consegna di una corsia che poi ne ha fatta una
   seconda migliore, avendo controllato la *coincidenza* e non la *quiete*.
3. Il mio primo test passava sul codice rotto: l'ago `'a'` era soddisfatto dal
   nome del record e `matches` faceva corto circuito prima delle etichette.
4. Ho cercato `stance` e trovato **circum*stance***; poi `c.features` sulle
   classi, che non esiste. Due volte la stessa forma.
5. Ho annullato un mutante con `git checkout` cancellando una riparazione non
   committata.
6. Ho lasciato cadere una condizione (`all.length === 0`) mentre stringevo un
   cancello, e un test esistente l'ha preso.

---

## 5. Lasciato di proposito

- Il debito dell'SRD 2 è nella §4 di `HANDOFF-SRD-2-2026-08-31.md`: 6 voci in
  `UNPRICED_AMOUNT`, 13 in `UNPRICED_LANE`, 32 in `SITUATIONAL`; lo sweep
  percorre 12 collezioni su 16; gli undici sottosistemi delle Supplemental
  Campaign Mechanics che nulla legge; `srdIndex` che non indicizza livello né
  modulo per le armi; `Item.roll` chiamato d100 quando è 1..60.
- L'ondata `wf_dc7af188-94f` è chiusa: 5 agenti, 5 risultati, 0 errori. Journal
  e transcript sono in `~/.claude/projects/…/subagents/workflows/`, **fuori**
  dagli scratchpad, e sopravvivono a qualunque pulizia.
