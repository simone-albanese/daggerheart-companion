# Decisioni del 18 agosto 2026 — le 42 domande, risposte dal proprietario

Registro fedele delle risposte. Destinato a `BACKLOG.md` P5 (voce 42, approvata).
Dove la risposta cambia il prezzo rispetto a come la domanda era stata posta, è segnato **[COSTO CAMBIATO]**.

## A · Le richieste nuove

| № | Decisione |
|---|---|
| 1 | **Entrambe.** Anteprima in sola lettura (2h) e bottone che apre lo scontro (5h). |
| 2 | **Conferma sempre**, non solo a Scena occupata. *(più severo di quanto proposto: costa un tap anche a tavolo vuoto)* |
| 3 | **Sì a entrambe** — correggere `×3` → gruppi, e dire il `+1D4` fuori dal builder. |
| 4 | **Sì al builder** environment, **e overlay nel `.dhbackup`** (+4h). Riscrive `Architecture.md` §4. |
| 5 | **Template** di countdown, non contatore con stato. |
| 6 | **Rinomina** (1h) **e** numeri **sulla riga del tipo, non sul nome**. |
| 7 | **APERTO** — «scena = luogo o rissa?» da decidere dopo. |
| 8 | **DA RIVEDERE** — spiegazione dovuta da me. Vedi sotto. |
| 9 | **Strumento GM**, non riga salvata (7h, nessun bump). |
| 10 | **(b)** — rendere la tabella *Average Costs* dell'SRD. Ripara anche le altre 11 tabelle. |
| 11 | **(a)** — tier solo su armi e armature. Niente tier inventati su loot/consumabili. |
| 12 | **Quinto tipo di riga** con campo `href`. Non un sesto `LINK_KIND`. |
| 13 | **Tutte e sei** le mitigazioni, applicate nel reader. |
| 14 | **[COSTO CAMBIATO]** Blocco nota con **testo formattato** — grassetto, corsivo, elenchi puntati, centratura — **esportabile e importabile**. Non è più lo stopgap da 2h. |

## B · Il GM screen

| № | Decisione |
|---|---|
| 15 | **Sì** — errore di scrittura campagna pubblicato sulla shell. |
| 16 | **Sì** — `renameCampaign` che non arriva sul disco. |
| 17 | **Sì** — creazione attiva dopo scrittura fallita, e guardia mancante sulla cancellazione. |
| 18 | **Sì** — le riparazioni ricalcolate a ogni avvio. |
| 19 | **Sì** — insets orizzontali: `GmBar`, i cinque overlay, la ✕ di `GmSheet`, più `GmSheet.tsx:77`. *Dipende dalla misura della voce 36.* |
| 20 | ~~Registro datato~~ → **ANNULLATA. Non fare nulla.** Niente registro, niente annulla, niente storia. `CAMPAIGN_MIGRATIONS` resta vuota **per quanto riguarda questa voce**, e `Countdown.notes` resta non disegnato. *Conseguenza: la 14 ha dovuto pagarsi il proprio bump — e l'ha fatto il 18/08, `CAMPAIGN_SCHEMA_VERSION` 1→2 con un convertitore che non cambia alcun campo.* |
| 21 | **Misura** la tastiera prima di spedire il campo di testo. |
| 22 | **Chiudi** `~2003` e `~2157`. **Apri** CLOSE / FAR / VERY FAR sul foglio giocatore. |
| 23 | **No a tutte e cinque** *(ma vedi la contraddizione con la richiesta nuova sulla ricerca regole)*. |

## C · Il reflow

| № | Decisione |
|---|---|
| 24 | **Fai la prosa** (quattordici punti su sei file) più il test anti-deriva. |
| 25 | **Chiudi** — «aria vera» vale anche per la reach. |
| 26 | **Sì** — correggi i due difetti nel docblock di `Carried`. |
| 27 | **No al taglio, sì all'anello** — `outlineOffset: -2px`. |
| 28 | **Chiusi** — 320/344 e i due banner. |
| 29 | **Sistema il banner e copri le due azioni.** Opzione 4 (la rete) non scelta. |

## D · Il backlog

| № | Decisione |
|---|---|
| 30 | **Sì** — barra le 19 già fatte, più le due caselle e il marcatore sbagliato. |
| 31 | **Sì** — il chip ARM. |
| 32 | **Riscrivi la frase**, non collegare il risolutore. |
| 33 | **Tutte e tre** le porte del nome unico. |
| 34 | **P3-12 per prima e riclassificata P1.** Poi P2-6. **P2-3 rimandata.** |
| 35 | **QR sì** (import dinamico). `--control` dipende dalla misura della 36. |

## E · La sera col telefono

| № | Decisione |
|---|---|
| 36 | **Sì, e prima di qualunque lavoro sugli inset.** |
| 37 | **Sì** — orologio dell'eviction iOS fatto partire oggi. |
| 38 | **Sonda usa-e-getta.** |
| 39 | **Sì** — tutte e otto le prove nella stessa serata. |

## F · Igiene

| № | Decisione |
|---|---|
| 40 | **Sì** — pulizia dei worktree. |
| 41 | **Cancella, ma verifica prima.** Rete di sicurezza già creata: tag `safety/a2-play-cockpit`, `safety/backup-pre-rewrite`, più un bundle. |
| 42 | **Sì** — richieste in `BACKLOG.md` P5, e `reflow-handoff.md` **dentro** il repo. |

---

## Le cinque richieste aggiunte dopo

1. **Proposta di navigazione migliore per tutta la parte GM.**
2. **Alternativa comprensibile a SHOW**, leggibile senza contesto.
3. **Tips in inglese** sulle regole e su come si usa la app, nella parte GM.
4. **Le informazioni dei due PDF dello schermo GM**, organizzate come lì:
   `Manuali/GM Screen Daggerheart - Landscape 3 Panel.pdf` (3 pannelli) e
   `Manuali/GM Screen Daggerheart - Portrait_BN_con_metri.pdf` (A4, aggiunge i metri).
5. **Ricerca delle regole in SHOW**, con un indice organizzato. *Confermata esplicitamente il 18/08.*
6. **Generatore randomico di nomi**, cognomi, regioni e luoghi — costruito su tabelle **nostre**, ispirate al genere,
   così è legalmente pulito **senza bisogno di import manuale**. Riapre `~2129` per la porta che `~2129` stessa
   aveva lasciato aperta: *«se il proprietario vuole dei generatori, sono un item nuovo con una fonte propria, e
   quella fonte non possono essere i libri in licenza.»*

### Precisazioni del 18/08, secondo giro

- **8 — confermata la lettura cara.** Se si annida, l'annidamento è una **preferenza vera**: entrambe le rese,
  entrambi i modelli di riordino, e una campagna scritta annidata deve restare corretta riletta piatta. Resta
  però subordinata alla **7**, ancora aperta: se «scena» non conterrà nulla, non c'è niente da impostare.
- **20 — annullata** dopo la spiegazione. Vedi sopra.
- **Pannelli dei PDF:** non una riorganizzazione del Reference, ma **pannelli già pronti sulla home del DM**.
  Da decidere quando ci saranno i pixel: pannelli e lista di sessione si contendono lo stesso spazio, quindi
  o convivono richiudibili, o la home diventa a schede.
- **Nomi: zero nell'SRD.** Verificato con script — 0/10 nomi di battesimo, 0/10 luoghi; «Xuria» era un falso
  positivo (esiste solo in *Feast of Xuria*, un consumabile), e l'SRD non ha nessuna tabella di nomi.
  `README.md:284` e `Architecture.md:1394`: l'SRD è ridistribuibile sotto DPCGL, il Core Book no.
  Da qui la scelta del generatore procedurale su tabelle nostre.

---

## Tre cose che il proprietario deve rivedere

### La 8, che non era chiara — spiegazione

Giorgio ha scritto che una scena «può avere dentro sia incontro che counter insieme. **Ma da settare**».
Quella frase si può leggere in due modi, e costano diverso:

- **«Da settare» = è un'impostazione.** Il GM sceglie, scena per scena, se quella scena contiene un
  incontro e un counter oppure no. Questo obbliga la app a far funzionare **entrambe** le rese — annidata
  e piatta — **entrambi** i modelli di riordino, e a garantire che una campagna scritta annidata resti
  corretta quando viene riletta piatta. È la lettura cara, e va decisa **prima** di costruire, perché
  aggiungerla dopo costa più della prima versione.
- **«Da settare» = non ci ho ancora pensato.** È solo un pensiero non finito, e allora l'annidamento è
  un disegno unico e fisso, senza preferenza.

Siccome la 7 è rimasta aperta, la 8 resta parcheggiata con lei. Serve solo quando si decide la 7.

### La 20 costa più di quanto sembrasse quando l'hai approvata

«Registro datato» era il ramo esplicitamente marcato **+6-9h e migrazione**. Scegliendolo hai autorizzato
la **prima migrazione di campagna della storia del progetto**: un convertitore, una fixture v2, la finestra
di versione del `.dhcampaign`, e il docblock di `shared/campaigns.ts` che spiega perché la catena è vuota
va riscritto. Non è un problema — è la cosa giusta se vuoi il registro — ma non è più un item da 4 ore.

### La 23 e la richiesta nuova numero 5 si contraddicono

Alla 23 hai risposto **no a tutte**, e fra quelle c'era `~1980`: *«SEARCH è una lacuna della 1.0 o una voce
1.1?»*. Poi hai chiesto: *«Il DM in Show deve poter cercare le regole e poterle navigare in un indice
organizzato»*.

Prendo la seconda come quella buona, perché è più recente e più esplicita — e perché non sono la stessa
cosa: `~1980` parlava di una SEARCH generica sulla barra, tu chiedi la ricerca **delle regole dentro SHOW**.
L'obiezione registrata nel backlog era che «quello che un GM cerca davvero al tavolo è già il filtro del
Bestiario»: vale per gli avversari, non per le regole. Ma la parte di `~1980` che dicevi di non volere
torna dentro da questa porta, quindi te lo dico invece di farlo in silenzio.

---

## Le due risposte della sera, dopo la passata a onde

Arrivate quando l'onda 1 era già costruita e in riparazione. Sono decisioni, non preferenze: chiudono
due delle domande lasciate aperte in `HANDOFF-2026-08-18.md` §16.3.

### B5 — SHOW diventa **BROWSE**

Scelto fra i cinque candidati. È l'unico che aveva già una provenienza dentro l'albero invece che nella
testa di chi proponeva: `src/ui/onboarding/Onboarding.tsx:32` e `HANDOFF.md:281` chiamano già bestiario e
party board *«the GM browse tools»*. Ed è **intransitivo**, quindi l'obiezione che ha condannato SHOW —
verbo transitivo senza oggetto sullo schermo — non si ripresenta. `GmBar.tsx:5-18` sostiene che sulla
barra stanno verbi e non destinazioni: BROWSE lascia quella dottrina da correggere, non da riscrivere.

**Ma si applica dopo la richiesta ⑤, non prima**, ed è l'unica parte di questa decisione che non è una
questione di gusto. ⑤ mette una **terza** cosa dietro quel bottone, ed è proprio la cosa che avrebbe
giustificato LOOK UP. Rinominare contro una forcella a due voci significa rileggere le occorrenze due
volte. Quindi: ⑤ prima, il nome dopo, nell'onda 3.

**Tre correzioni al preventivo, misurate e non dedotte:**

- le occorrenze sono **circa 130, non 114**: la ricerca ne ha contate 130 (23 meccaniche e 107 che
  vanno lette, perché sono prosa che *discute la parola*), e un conteggio indipendente a confine di
  parola su tutto l'albero ne dà **132** — `src` 43, `tests` 39, `docs` 8, `BACKLOG.md` 17,
  `HANDOFF-2026-08-18.md` 9, `CHANGELOG.md` 7, `Architecture.md` 5, `HANDOFF.md` 4. I due metodi non
  coincidono al singolo colpo e non serve che coincidano: quello che conta è che **114 era sbagliato
  per difetto** e che il grosso del lavoro è lettura, non sostituzione;
- `src/ui/gm/Scene.tsx:315` è un **SHOW diverso** e non va spazzato con gli altri;
- con esattamente una preferenza accesa, SHOW è oggi un **menu a una voce** — due tap per una
  destinazione sola. È un difetto dell'albero di oggi, indipendente da come si chiama il bottone, e va
  aperto come voce sua invece di essere risolto di straforo dalla rinomina.

### B6a — la scala di Difficoltà: **non si cambia niente**

Avevi detto «controlla e segui SRD». Controllato: **l'app è già giusta**, e la voce di backlog si chiude
con un record invece che con una modifica.

`DifficultyLadder` stampa i 108 esempi lavorati dell'SRD a 5/10/15/20/25/30 e **nessun aggettivo**, che è
esattamente quello che `data/srd-1.0.json` contiene. `tests/ui/srdReference.test.ts:576-600` già impedisce
che gli aggettivi vengano digitati dentro `src/` o dentro il dataset.

Il verdetto sui due PDF, che era la domanda:

- il **Landscape** è quello sbagliato sul punto chiesto — `5 = Easy` è un refuso per *Very Easy*;
- ma il **Portrait non è corretto neanche lui**: perde `Nearly Impossible` e sbaglia le etichette di 25 e
  di 30.

La scala a sei etichette (5 Very Easy · 10 Easy · 15 Average · 20 Hard · 25 Very Hard · 30 Nearly
Impossible) è materiale del **Core Book p.157**, **assente dall'SRD**, quindi non può entrare nell'albero:
è la stessa ragione di licenza che ha già cancellato `engine/encounter.ts::TIER_BENCHMARKS` e che tiene
fuori la colonna metrica.

**Conseguenza per la richiesta ④**, se i pannelli si costruiranno mai: il pannello DIFFICULTY va costruito
da `rules['difficulty-benchmarks']` e **non deve portare aggettivi da nessuno dei due PDF**.
