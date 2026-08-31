# Handoff — l'ondata SRD 2, dopo l'integrazione

**Le decisioni stanno in `DECISIONI-SRD-2-2026-08-31.md`.** Questo dice dove siamo, cosa è cambiato
rispetto alla versione precedente di questo stesso file, e cosa aspetta il proprietario.
I commit si citano **per oggetto, mai per SHA**: il ramo si ribasa e gli hash muoiono.

---

## 0. Stato, misurato

```
npx tsc --noEmit                                        0 errori
npx vitest run                                          168 file / 4292 test, 0 falliti
npm run build:srd -- --check                            data/srd-1.0.json matches the source.
npm run build:srd -- --check --pdf Manuali/DH_SRD_2...  1 errore, e uno solo
```

**`data/srd-1.0.json` è ancora byte-identico.** È la sola prova che tutto questo è un allargamento.
Si verifica con quel comando, a ogni passo, e non si perde.

### Cosa legge oggi l'SRD 2, da capo a fondo

```
domains 10   domainCards 210   classes 13   subclasses 26   beastforms 22
ancestries 24   communities 15   weapons 315   armors 69   loot 120
consumables 120   adversaries 264   environments 47   rules 69
```

Il documento precedente si fermava a `ParseError ... folio 45`. Non si ferma più.

---

## 1. L'UNICA cosa che blocca una build verde

```
ERROR   environments/hold-the-line: duplicate id, already used by domainCards
```

L'SRD 1 pubblica una carta di dominio **Hold the Line** (Valor, livello 9). L'SRD 2 aggiunge un
ambiente **Hold the Line** (Tier 1, Event, folio 164).

**Non è un cavillo, ed è stato verificato:** `src/transfer/registry.ts` dichiara
`ids: Record<string, number>` — **uno slug, un id, in tutto il dataset**. Le bande per collezione
(5000 carte, 11000 ambienti) decidono *quale* numero, non *quante* voci può avere uno slug. Due
record con lo stesso slug non possono coesistere: uno vince, e un ambiente si decodificherebbe come
una carta sul QR di qualcuno.

**È una decisione del proprietario e tocca il formato di trasporto. §5.**

---

## 2. Cosa è stato fatto, in quattro commit

1. *«Take the last folio numbers out of the parsers»* — sei parser e il cancello. Dove l'indice del
   libro nomina la sezione, l'intervallo viene da lì; dove non la nomina (beastform dentro
   `Classes`, avversari e ambienti dentro `Adversaries and Environments`) viene da un **banner che
   la pagina stampa**. `tools/validate.ts` smette di fissare nove conteggi dell'SRD 1: cinque il
   libro li dichiara in prosa e il cancello confronta **per nome**, non per numero.
2. *«Learn the ring bullet»* — due guasti silenziosi su parser che *passavano*. §3.
3. *«Pin the name census»* — «839 su 849» confermato esatto; due affermazioni del repo ritirate. §4.
4. *«Disarm the write path»* — i difetti che solo la composizione poteva mostrare. §3.

---

## 3. I quattro guasti che nessuna corsia poteva vedere da sola

- **L'arma innescata.** `build-srd.ts` aveva `const OUT = 'data/srd-1.0.json'` e `--pdf` non lo
  toccava. Innocuo **solo finché l'SRD 2 lanciava un'eccezione**: farlo funzionare avrebbe reso
  `npm run build:srd -- --pdf <SRD 2>` un comando che sovrascrive il dataset dell'SRD 1 — cioè
  distrugge la prova stessa che l'ondata non ha rotto nulla. Ora `OUT` è `Book.datasetPath`, l'SRD 2
  ha `null`, e la scrittura **si rifiuta** invece di scegliere un altro nome.
- **Il pallino a cerchietto.** L'SRD 2 apre le liste di opzioni dentro una capacità con **U+25E6**,
  172 volte, zero nell'SRD 1. Nessun parser lo conosceva, e **un pallino non riconosciuto non è un
  errore da nessuna parte**: la lista smette solo di essere una lista. 41 record sbagliati, build
  verde.
- **`Line.column` che mente.** Folio 26 mette un riquadro a tre colonne dentro la colonna destra;
  la sua prima sotto-colonna rivendica `column 0` a x=313, lo stesso indice della colonna sinistra
  vera a x=57. Otto parole finite dentro la descrizione del Warlock. Solo una non sembrava inglese.
- **Due guardie che non potevano fallire.** I test di `rules.ts` nominavano la sezione sbagliata.
  Misurato cancellando ciascuna guardia e leggendo **dove finisce davvero il testo**.

---

## 4. Numeri e frasi corretti in questa sessione

| affermazione | verdetto |
|---|---|
| «~135 avversari» | **264**, per quattro conte indipendenti |
| «839 su 849 nomi» | **esatto**, ma le assenze sono 8 armi + 2 titoli, non 9+2 |
| «due sezioni di regole rinominate» | **zero**: quei due nomi li ha inventati `rules.ts`, non il libro |
| «U+00AD e U+200B rompono il confronto per nome» | **falso**: valgono 0 riscontri. Ne vale 9 U+2011 |
| «1982 trattini ASCII» | **1993** |
| «68 pagine contro 224» | confronta spread con pagine: il rapporto onesto è **135 → 224** |
| «SRD 2 sposta i beastform in Transformations» | **falso**: sono dove erano, dentro `Classes`, identici parola per parola. Transformations è un capitolo NUOVO con sei carte diverse |
| «7 dei 13 riquadri di rules.ts sono in coordinate dello spread» | vero, e sono spariti tutti |
| «una continuazione ha bisogno di quattro fatti insieme» | **falso**: ognuno è rimovibile da solo senza far diventare rosso nulla |
| «una sola intestazione in corsivo» | **due** |
| «i folio 67/89 non votano» → «votano» | **entrambe sbagliate**: si astengono **nove** pagine per libro, e 67/89 si astengono da un ramo diverso |

L'ultima riga è la lezione: un numero ereditato è stato corretto da un revisore che **anche lui non
l'aveva misurato**. Strumentare il ciclo ha richiesto tre minuti.

---

## 5. Le decisioni che aspettano il proprietario

1. **`hold-the-line`.** Due strade vere: (a) indicizzare il registro per `collezione/slug`,
   conservando i numeri già assegnati — il filo non si rompe, ma `data/registry.json` si riscrive e
   `REGISTRY_VERSION` sale; (b) rinominare l'id di uno dei due — una riga, ma lo slug smette di
   seguire il libro e la prossima collisione vuole lo stesso trucco. **Nessuna delle due è in corsia.**
2. **`Transformations`, folio 42-45.** Sei carte (DEMIGOD, GHOST, REANIMATED, SHAPESHIFTER, VAMPIRE,
   WEREWOLF). **Nessun parser le legge e nessuna collezione le contiene.** Entrano o no?
3. **`Supplemental Campaign Mechanics`, folio 190-205**, undici sottosezioni. Quattro di quei folio
   portano tabelle di equipaggiamento **della forma esatta** che `equipment.ts` già legge (43 armi,
   4 armature). Escluse apposta. Entrano o no?
4. **SRD 1 e SRD 2: due dataset o due strati?** Decide `datasetPath`, decide `sourcePage` sui record
   che condividono un id, e decide se serve un bump di `SCHEMA_VERSION` per due libri.
5. **`Convergence, the City of Portals`** — l'intestazione del blocco contro la forma abbreviata
   dell'indice. Va decisa **una volta per `environments.ts` e `adversaries.ts` insieme**.
6. **`--Forest Sprites`** (folio 220): il libro stampa due trattini ASCII. Si pubblica com'è?

---

## 6. Il debito tecnico che resta, con il suo prezzo

- **`shared/types.ts` vuole UN solo bump, non tre.** Quattro richieste indipendenti: `DamageKind`
  non contiene né `phy or mag` né `phy/mag` (oggi passano per un cast); `Feature.kind` non contiene
  `Evolution` (6 record); `Adversary.stress: number` non può dire «nessuna traccia di Stress»
  (Spellbound Armor, folio 110, salvato come 0); `Feature` non ha posto per le 7 sotto-capacità
  annidate sotto 4 Evolution. Tutte e quattro vogliono `SCHEMA_VERSION` 5 → 6, **con un converter e
  una fixture**. Applicarne uno alla volta significa tre bump.
- **Sette stringhe d'ancoraggio vivono in più file senza una costante condivisa.**
  `USING ENVIRONMENTS` sta in tre parser, `BEASTFORM OPTIONS` in due, `'Loot & Items'` in tre.
  Peggio: `adversaries.ts` rivendica un intervallo di **righe**, `environments.ts` un intervallo di
  **folio**, e `rules.ts` copre il buco fra i due — oggi combaciano, **e nulla lo verifica**.
  Toccarne uno fa cadere materiale in silenzio. Il rimedio chiesto da tre corsie: sollevare
  `sectionByBanner(pages, capitolo, banner)` in `contents.ts`; il prototipo funzionante è
  `beastformSection` in `beastforms.ts`.
- **`LEGENDARY BEAST` e `MYTHIC BEAST`** sono scartate in **entrambi** i libri: sono modelli
  «(Upgraded ...)» senza tratto, Evasione o attacco, e `Beastform` non può esprimerli. Preesistente,
  mai deciso.
- **La tabella `BENCHMARK STATISTICS FOR ENVIRONMENTS BY TIER`** (folio 159) è letta e buttata.
- **`Item.roll` non è più unico dentro una collezione** ora che l'SRD 2 stampa due tabelle per tipo
  (Core Set e Hope & Fear). Due schermi lo stampano senza il prodotto accanto: `GearPicker.tsx:1314`
  e `Merchant.tsx:384` mostrerebbero due oggetti diversi con la stessa etichetta.
- **`src/ui/shared/srdIndex.ts` scorre `dataset.domains`**, che sull'SRD 2 **non è alfabetico**:
  `codex` è all'indice 7 perché è lì che il folio 7 lo stampa.

---

## 7. CI non copre quasi niente di tutto questo

Nascondendo `Manuali/`, **49 dei 111 test in `tests/tools` si saltano**. Quattro file spariscono
interi: `rules`, `environments`, `loot`, `audit-core`. I manuali sono del proprietario e non stanno
nel repository, e il passo `build:srd --check` **è saltato in ogni run di CI**. Quindi:

> **La metà SRD 2 di questa ondata non ha alcun cancello automatico, da nessuna parte.**

Sopravvivono `validate.test.ts` (20/20, legge il JSON committato), i due fixture ermetici di
`equipment` e il libro sintetico di `adversaries`. Ogni test nuovo che **non** ha bisogno del PDF
vale più di tre che ce l'hanno.

---

## 8. Le regole macchina, che mordono ancora

- **`. ./env.sh >/dev/null 2>&1 && node -v` → deve dire v24. MAI `. ./env.sh | head`**: la pipe crea
  una subshell e lascia Node **26** sul PATH del padre. Il banner mente.
- Una probe **deve stare nella radice dell'albero**, o `tsx` risponde *«Top-level await is currently
  not supported with the cjs output format»*. E va cancellata dopo.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- Chi muta lavora in una copia `rsync` senza `.git`, mai nel worktree condiviso.
- **Mai la porta 5199**: è la campagna vera del proprietario.
- **Misura, non ereditare.** Vedi l'ultima riga della §4: è successo di nuovo, in questa sessione,
  a un revisore il cui mestiere era proprio non farlo.
