# Handoff — l'SRD 2 è acceso, la PR è aperta, il deploy non è stato fatto

**Le decisioni stanno in `DECISIONI-SRD-2-2026-08-31.md`.** Questo dice dove siamo, cosa è già
deciso (**non ri-chiederlo**), cosa è dichiarato come debito, e cosa NON è finito.
I commit si citano **per oggetto, mai per SHA**: il ramo si ribasa e gli hash muoiono.

---

## 0. Stato, misurato — 1 settembre 2026

Ramo `srd-2`, spinto. **PR #66 APERTA, NON UNITA.** 27 commit, 144 file, +18.116 / −1.369.

```
npx tsc --noEmit                              0 errori
npx vitest run                                184 file / 4533 test
npm run build:srd -- --check                  data/srd-2.0.json matches the source.
npm run build:srd -- --check --pdf <SRD 1>    data/srd-1.0.json matches the source.
npm run build:registry -- --check             1352 ids, 9 conservati, zero numeri spostati
npx vite build                                esce 0
CI sulla PR                                   verde, 2m35s, run 33463548440
```

**UNIRE È IL DEPLOY**: `deploy.yml` parte su ogni push a `main`. Il proprietario ha chiesto
esplicitamente di **fermarsi prima di unire** e non ha ancora dato il via.

### Cosa pubblica l'app

`data/srd-2.0.json`: domini 10, carte 210, classi 13, sottoclassi 26, beastform 22, stirpi 24,
comunità 15, **trasformazioni 6**, armi 391, armature 85, bottino 120, consumabili 120,
avversari 264, ambienti 47, regole 69. `SCHEMA_VERSION` 7, `CODEC_VERSION` 4, registro v2.

`data/srd-1.0.json` **resta committato e resta controllato**: è l'unica prova che il vecchio parse
non si è rotto. Nullarne il `datasetPath` toglie quel cancello — misurato: con `null`,
`--check --pdf <SRD 1>` esce 0 **con il file cancellato dal disco**.

---

## 1. ONDATA IN VOLO al momento di scrivere

Due corsie lanciate e non ancora rientrate: **Martial Stances** e **i dieci prezzi** (§4).

```
run id     wf_dc7af188-94f
journal    ~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/
           10931c5a-4c3c-45a2-8973-0e1761c339d4/subagents/workflows/wf_dc7af188-94f/journal.jsonl
consegne   /private/tmp/claude-501/-Users-.../10931c5a-.../scratchpad/out5/<corsia>/
```

**I risultati stanno nel journal, non nel repository.** Una riga `{"type":"result"}` per agente.
Se la sessione è cambiata, leggi quel file **prima** di concludere che l'ondata non ha prodotto
nulla. Le consegne si applicano copiando `out5/<corsia>/` sull'albero ai percorsi relativi.

---

## 2. Le decisioni del proprietario. NON RI-CHIEDERLE.

Prese il 31 agosto e il 1 settembre 2026.

1. **Le 9 armi tolte dall'SRD 2 SPARISCONO.** Non tenute, non marcate eredità, **non rimappate**.
   La prova che il documento diceva mancante è stata cercata e **non esiste**: 0 provate,
   1 plausibile, 8 senza erede. Vedi §5.
2. **Una perdita deve VEDERSI.** Costruito: l'arma sparita si annuncia su Gioco, in Modifica e
   sulla pagina stampata, come già faceva un'armatura.
3. **Superficie UI completa prima dell'accensione.** Fatto.
4. **Un personaggio può TENERE una trasformazione**, aggiunta dalla scheda, **non** dalla creazione.
5. **Mostrata, non applicata**: non muove Evasione, Soglie o Stress. C'è un test che lo prova.
6. **Viaggia sul filo.** Non farlo ripeterebbe il difetto già registrato per il dominio Dread.
7. **La striscia dei domini va misurata, non dedotta.** Fatto.
8. **Witherwild e i campaign frame restano FUORI, e la ragione è LEGALE.** Ora scritto nel codice
   (`shared/parsers/rules.ts`): il folio 1 del libro dice che Witherwild **È** Public Game Content,
   quindi senza quella frase il prossimo lettore lo legge come un difetto e prova a «ripararlo».
9. **`--Forest Sprites` si pubblica come stampato.** È un refuso del libro (folio 220), reso fedele.
10. **Martial Stances: sviluppare adesso.** In volo, §1.
11. **I dieci bonus: prezzarli prima di unire.** In volo, §1.
12. **Il `Revolver` resta quattro record** (uno per livello), non uno con la scala dentro.

---

## 3. La licenza: era un blocco, è sciolto

L'app spediva la DPCGL del 30 luglio 2025, il cui §1.6 elenca come Public Game Content **solo
l'SRD 1.0**. L'app pubblica il 2.0.

**Esiste la DPCGL 2.0**, pubblicata il **26 agosto 2026** — il giorno dopo il libro. Scaricata,
estratta con `pdftotext -layout`, letta. Il suo §1.6 nomina **«Daggerheart System Reference
Document 2.0 (including Domain icons) and Candela Obscura»** e aggiunge che l'SRD 1.0 resta Public
Game Content per i contenuti legacy. Il modello di attribuzione del §4 è **identico al precedente
tranne il numero di versione**.

Spedita al posto di quella vecchia, con l'hash fissato in `tests/ui/licences.test.tsx`, la
citazione in `LICENSE` e la frase di provenienza in `About` mosse **insieme**, come il commento di
quel test esige. Il PDF stampa «Last Updated 8/05/2026» mentre l'indice dell'editore e il nome del
file dicono 26 agosto: **tre settimane di scarto, registrate entrambe** in `LICENSE`.

---

## 4. Debito DICHIARATO, non nascosto

- **Dieci bonus statici veri che il motore non calcola**, in `UNPRICED_AMOUNT`
  (`tests/engine/modifiers.test.ts`). `Amount` è `number | 'proficiency'` e non può dire «pari al
  tratto Spellcast» o «pari alla Presenza». **Uno è `mage-robes`, armatura iniziale di livello 1.**
  Mappa **separata** dalle situazionali di proposito: metterli fra quelle sarebbe la disonestà che
  quel controllo esiste per impedire. *(La corsia in volo sta provando a chiuderli.)*
- **`everySite()` legge 8 collezioni su 15**: `domainCards`, `beastforms` e `transformations` non
  sono mai percorse. Ci sono altri bonus non calcolati lì dentro, alcuni **preesistenti all'SRD 2**.
- **Supplemental Campaign Mechanics, folio 190 e 193-205**: undici sottosistemi, **82.876 caratteri**
  che nulla legge — mentre l'app pubblica **92 pezzi d'equipaggiamento** timbrati con i nomi di
  quelle campagne, e non c'è nessun posto dove leggere cosa siano.
- **`srdIndex.ts` non indicizza né LIVELLO né MODULO per le armi.** Con la scala per livelli, 11
  nomi coprono 44 record: cercare «Blessed Brass Knuckles» dà quattro righe identiche tranne il dado.
- **`shared/types.ts` chiama `Item.roll` un d100.** È 1..60, in entrambi i libri.
- **Prosa stantia**: `HANDOFF.md` dice `SCHEMA_VERSION` 5 e `CODEC_VERSION` 2 — sono 7 e 4. 42
  menzioni di `srd-1.0` in 21 file, molte con una misura fatta sull'SRD 1. **Rimisurare o marcare,
  mai `sed`.**

---

## 5. Cosa perde un personaggio già salvato

3333 schede costruite sull'SRD 1 e risolte contro l'SRD 2: **59.256 riferimenti percorsi**.

```
classi 0 · sottoclassi 0 · stirpi 0 · comunità 0 · carte 0 · beastform 0
armature 0 · bottino 0 · consumabili 0 · avversari 0 · ambienti 0 · armi 9
```

**186 schede su 3333** ne tengono una, sempre nello slot primario. Delle 840 voci stampate da
entrambi i libri, 667 identiche e 173 con un campo cambiato — **nessuno è un numero**. Nessuna
classe cambia i Punti Ferita iniziali. Una sola carta, *Notorious*, perde una frase che l'SRD 2 non
stampa più.

**Perché non si rimappa.** Il documento diceva che l'SRD 2 aveva sostituito le nove con «famiglie
scalate: Shadowblade, Bloodstaff, Wand of Essek». **Due di quei tre erano già nell'SRD 1**, folio
51, due pagine dopo le nove, con le stesse capacità. Una ricerca per etichetta di capacità li trova
— ed è esattamente per questo che **non è una prova**. E 195 armi su 195 sopravvissute sono
identiche campo per campo: «rinominata e riscalata» non ha un precedente nel libro.

---

## 6. Buchi nella prova, misurati e non chiusi

Ognuno lascia verde l'intera suite. Un buco scritto è debito; uno taciuto è una trappola.

- `codec.ts:951` e `:1478` — i due controlli di collezione, **l'intera difesa** della collisione
  `vampire` in lettura. Toglierne uno decodifica l'id della carta come l'avversario.
- `GearPicker.tsx:1249/1430` — dare al filtro le proprie righe già filtrate è una porta a senso
  unico: tocchi `Base`, il controllo sparisce, non si torna ad `All`.
- `gear.ts` `origin()` usa `(s): s is string => s !== null` dove il valore può essere `undefined`:
  un `set` fuori unione fa cadere il selettore alla prima lettera digitata. `typeof s === 'string'`
  chiude. Non raggiungibile da nessuno dei due libri.
- `holdings.ts` `ref !== ''` e la porta «Nothing equipped» di Gioco non hanno test.

---

## 7. Le regole macchina

- **`. ./env.sh >/dev/null 2>&1 && node -v` → deve dire v24. MAI `. ./env.sh | head`**: la pipe crea
  una subshell e lascia Node **26** sul PATH del padre. Il banner mente, e Node 26 nasconde
  `localStorage` a jsdom: una suite verde in locale è **più debole** di quella di CI.
- Una probe **deve stare nella radice dell'albero**, o `tsx` risponde *«Top-level await ... cjs»*.
  E va cancellata: una probe lasciata nell'albero è un incidente già successo qui.
- In un worktree i symlink sono **tre**: `node_modules`, `.tools`, `Manuali`.
- Chi muta lavora in una copia `rsync` **senza `.git`**, mai nel worktree condiviso.
- **Mai la porta 5199**: è la campagna vera del proprietario.
- **Una PR può risultare pulita senza che alcun controllo sia girato.** Verificare che una run
  esista, prima di unire.
- **CI non estrae mai il dataset**: il passo è dietro una sonda sul PDF che nessun runner soddisfa.
  Nascondendo `Manuali/`, 78 test su 226 in `tests/tools` si saltano. **Un test nuovo che non ha
  bisogno del PDF vale più di tre che ce l'hanno.**

---

## 8. Le due cose che ho sbagliato a dire, perché non si ripetano

1. **«Il riferimento non risolto è visibile, quindi non si perde in silenzio.»** Vero per le
   armature, **falso per le armi**: un'arma sparita non lasciava traccia da nessuna parte, e l'unico
   segno era un contatore che scendeva di uno. Due decisioni del proprietario poggiavano su quella
   frase e sono state riprese. Il segno ora esiste.
2. **Ogni cifra che questo repository diceva di sé è stata sbagliata più spesso che giusta.** E una
   volta la **correzione di un revisore era sbagliata a sua volta**, perché aveva ri-implementato un
   ramo invece di strumentare il ciclo: la risposta vera era nove pagine per libro, non otto, e per
   due rami diversi. **Ri-implementare non è strumentare.**
