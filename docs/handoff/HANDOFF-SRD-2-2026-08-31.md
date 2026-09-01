# Handoff — l'SRD 2 è acceso, e non è ancora unito

**Le decisioni stanno in `DECISIONI-SRD-2-2026-08-31.md`.** Questo dice dove siamo, cosa aspetta il
proprietario, e cosa NON è finito. I commit si citano **per oggetto, mai per SHA**.

---

## 0. Stato, misurato

Ramo `srd-2`, spinto, **nessuna PR aperta** — quindi nulla è sui dispositivi.

```
npx tsc --noEmit                     0 errori
npx vitest run                       184 file / 4533 test
npm run build:srd -- --check         data/srd-2.0.json matches the source.     <- il libro NUOVO
npm run build:srd -- --check --pdf <SRD 1>   data/srd-1.0.json matches the source.
npm run build:registry -- --check    9 righe conservate; registry up to date: 1352 ids
npx vite build                       esce 0
```

**L'app pubblica l'SRD 2.** `data/srd-2.0.json`: domini 10, carte 210, classi 13, sottoclassi 26,
beastform 22, stirpi 24, comunità 15, **trasformazioni 6**, armi 391, armature 85, bottino 120,
consumabili 120, avversari 264, ambienti 47, regole 69.

`data/srd-1.0.json` **resta committato e resta controllato**: è l'unica prova che il vecchio parse
non si è rotto. Nullarne il `datasetPath` toglie quel cancello — misurato: con quello a `null`,
`--check --pdf <SRD 1>` esce 0 **con il file cancellato dal disco**.

---

## 1. LA COSA CHE BLOCCA LA PUBBLICAZIONE, e non è codice

`src/legal/dpcgl-2025-07-30.txt` §1.6 dichiara Public Game Content: *«Daggerheart System Reference
Document **1.0** (including Domain icons) and Candela Obscura»*. **Non nomina l'SRD 2.**

Il folio 1 del libro nuovo dice: *«This document, including the Witherwild Campaign Frame, is
considered Public Game Content per the Darrington Press Community Gaming License.»*

Quindi o esiste un'edizione più recente della licenza e va pubblicata al posto di questa, oppure
l'app pubblicherebbe l'SRD 2 sotto un testo di licenza che non lo elenca. **Verificato in tutti e
tre i punti. È una decisione del proprietario, non di un ingegnere.**

L'attribuzione sullo schermo — §4.1(a) — **è già riparata**: era il letterale `1.0` e ora deriva dal
dataset pubblicato. Due test tenevano verde il valore sbagliato.

---

## 2. Cosa perde un personaggio già salvato: le nove armi, e nient'altro

3333 schede costruite sull'SRD 1 e risolte contro l'SRD 2, **59.256 riferimenti percorsi**:

```
classi 0 · sottoclassi 0 · stirpi 0 · comunità 0 · carte 0 · beastform 0
armature 0 · bottino 0 · consumabili 0 · avversari 0 · ambienti 0 · armi 9
```

**186 schede su 3333** ne tengono una, sempre nello slot primario. Delle 840 voci stampate da
entrambi i libri, 667 sono identiche e 173 cambiano un campo — **nessuno è un numero**: 138 hanno
guadagnato la provenienza, 11 carte hanno cambiato un codepoint del nome, il resto è riscrittura del
libro. Una sola carta, *Notorious*, perde una frase che l'SRD 2 non stampa più.

E la perdita **si vede**: l'arma sparita si annuncia su Gioco, in Modifica e sulla pagina stampata.
Prima non lasciava traccia da nessuna parte, mentre un'armatura nella stessa posizione sì.

---

## 3. Cosa il libro contiene e l'app NON legge

- **Martial Stances, folio 13.** Sedici pose su quattro livelli, più la traccia **Focus**. Non
  esiste una collezione, non esiste un campo. E l'app **stampa la conseguenza sulla scheda**: la
  capacità *Stance Fighter* di un Brawler/Martial Artist dice al giocatore *«prendi la scheda
  Martial Stances e scegli due pose»* — una scheda che l'app non ha. Il folio 13 sta **dentro**
  l'intervallo delle classi già letto, ed è l'unica pagina di quell'intervallo che produce zero
  record. **Decisione del proprietario: «non ancora» o «no».**
- **Supplemental Campaign Mechanics, folio 190 e 193-205.** Undici sottosistemi, **82.876 caratteri**
  di regole. L'app ne pubblica **92 pezzi d'equipaggiamento** timbrati `WESTERN CAMPAIGNS`,
  `MONSTER HUNTING CAMPAIGNS`, `EVERYDAY HERO STARTING EQUIPMENT` — e non c'è nessun posto dove
  leggere cosa siano quelle campagne.
- **Witherwild, folio 185-189.** Fuori per decisione. Ma il §8 delle decisioni chiedeva che il
  codice dicesse che la ragione è **legale**: `shared/parsers/rules.ts` cita solo un documento, e il
  folio 1 del libro dice che Witherwild **È** Public Game Content. Chi legge concluderà che è un
  difetto. **Due frasi in quel docblock chiudono la cosa.**

---

## 4. Debito dichiarato, non nascosto

- **Dieci bonus statici veri che il motore non sa calcolare**, in `UNPRICED_AMOUNT`
  (`tests/engine/modifiers.test.ts`). `Amount` è `number | 'proficiency'` e non può dire «pari al
  tuo tratto Spellcast» o «pari alla tua Presenza». **Uno è `mage-robes`, armatura iniziale di
  livello 1.** Sono in una mappa separata dalle situazionali apposta: metterli fra quelle sarebbe
  la disonestà che quel controllo esiste per impedire. Per chiuderne uno: allarga `Amount` e
  risolvilo in `collectModifiers` come già si fa con `'proficiency'`.
- **`srdIndex.ts` non indicizza né LIVELLO né MODULO per le armi.** Con la scala per livelli, 11
  nomi coprono 44 record: cercare «Blessed Brass Knuckles» dà quattro righe identiche tranne il
  dado, senza dire quale livello.
- **`shared/types.ts` chiama `Item.roll` un d100.** È 1..60, in entrambi i libri.
- **Prosa stantia**: `HANDOFF.md` dice `SCHEMA_VERSION` 5 e `CODEC_VERSION` 2 — sono **7** e **4**.
  42 menzioni di `srd-1.0` in 21 file, molte con una misura fatta sull'SRD 1. **Rimisurare o
  marcare, mai `sed`.**

---

## 5. Buchi nella prova, misurati e non chiusi

Ognuno lascia verde l'intera suite. Sono elencati perché un buco noto è debito, uno ignoto è una
trappola.

- `codec.ts:951` e `:1478` — i due controlli di collezione che sono **l'intera difesa** della
  collisione `vampire` in lettura. Toglierne uno decodifica l'id della carta come l'avversario.
- `GearPicker.tsx:1249/1430` — dare al filtro le proprie righe già filtrate è una porta a
  senso unico: tocchi `Base`, il controllo sparisce, non si torna ad `All`.
- `gear.ts` `origin()` usa `(s): s is string => s !== null` dove il valore può essere `undefined`:
  un `set` fuori unione fa cadere il selettore alla prima lettera digitata. Non raggiungibile da
  nessuno dei due libri. `typeof s === 'string'` chiude.
- `holdings.ts` `ref !== ''` e la porta «Nothing equipped» di Gioco non hanno test.

---

## 6. Le regole macchina

- **`. ./env.sh >/dev/null 2>&1 && node -v` → deve dire v24. MAI `. ./env.sh | head`**: la pipe crea
  una subshell e lascia Node **26** sul PATH del padre. Il banner mente, e Node 26 nasconde
  `localStorage` a jsdom, quindi una suite verde in locale è **più debole** di quella di CI.
- Una probe **deve stare nella radice dell'albero**, o `tsx` risponde *«Top-level await ... cjs»*.
  E va cancellata.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- **Mai la porta 5199**: è la campagna vera del proprietario.
- **Unire È il deploy**: `deploy.yml` parte su ogni push a `main`. E una PR può risultare pulita
  **senza che alcun controllo sia girato**: verificare che una run esista, prima di unire.
- **Misura, non ereditare.** In quattro ondate quasi ogni cifra che questo repository diceva di sé
  è risultata sbagliata quando controllata — e una volta la correzione di un revisore era sbagliata
  a sua volta, perché aveva ri-implementato un ramo invece di strumentare il ciclo.
