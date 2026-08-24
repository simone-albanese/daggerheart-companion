# Decisioni del proprietario — 23 agosto 2026

Prese sul progetto prodotto da `wf_d5464f24-a49` (`docs/handoff/PROGETTO-GM-2026-08-23.md`),
nove domande, tutte risposte. **Nessuna di queste è stata ancora eseguita.**

---

## 1. Una scena è una riga sola — `:3136` è chiusa

**Una riga per battuta della serata.** Il braccio scena guadagna i tre campi dell'encounter;
`encounter` resta nell'unione come tipo **legacy**: leggibile e modificabile, non più creabile.

Questo sblocca ciò che `:3136` bloccava, e in particolare `:3140` (l'annidamento).

Il difetto che chiude: `Encounter.tsx:542` manda un combattimento sul board senza portarsi
l'ambiente, quindi la rissa si apre in silenzio nel luogo della scena *precedente*. E `END SCENE`
oggi svuota i combattenti lasciando in piedi l'ambiente — cioè l'app stava già rispondendo a
questa domanda per conto suo, nella stessa direzione.

## 2. THE NIGHT è una scheda, non un modale

**Vincolo duro per Layout B.** La barra resta sul vetro sotto: riserva di Fear, countdown pinnato,
ADD/SHOW/SAVE.

Oggi ogni strumento DM monta a `position: fixed; inset: 0; z-index: 30` con `useDialog` che
intrappola il Tab: mentre la scena è aperta il Fear è **coperto e irraggiungibile da tastiera**.

## 3. Licenza: pubblica, rischio accettato consapevolmente

Decisa con il testo della DPCGL sotto gli occhi, non a scatola chiusa. La lettura accettata è che
§2.1(a) — *«reproduce and Share the Public Game Content in whole or in part»*, senza limiti di
formato dichiarati — copra ciò che l'app fa.

**L'obiezione che resta in piedi, e va scritta nel README perché sia una posizione dichiarata e
non inesaminata:** metà dell'app è Adaptive Content ai sensi di §1.7 (il dataset è il PDF
*riordinato*; `deriveStats` *trasforma*), §2.1(b) consente l'Adaptive Content **solo nei Permitted
Formats**, e §1.9 elenca stampa, streaming, podcast e VTT autorizzati — **un'app web non è in
quell'elenco**, e la clausola chiude escludendo *«any other audiovisual medium not expressly
permitted»*. §1.9.1 nomina il rimedio: approvazione scritta di DRP.

→ **Azione: sezione Legal del README che dichiara la lettura e il rischio accettato.**

## 4. Witherwild: fuori

12 sezioni, 28.549 caratteri, il **22%** del corpus. Da togliere da `data/srd-1.0.json` e da
`shared/parsers/rules.ts`. Comporta una ricostruzione del dataset e il rimescolamento di stampe e
test che ne consegue.

## 5. Nome: rinomina totale

Un titolo che non si apre col Name Mark, con «Daggerheart Compatible» come descrittore. Tocca
nome, repo, URL del deploy. §2.5(a) e (b) vietano il marchio nel titolo e in copertina; (c) esige
«Compatible» adiacente nel testo descrittivo. Oggi `manifest.short_name` è la parola nuda.

## 6. `Campaign.session` guadagna un ciclo di vita — versione piena

Una sessione si può chiudere, le sue righe si archiviano con cosa è successo, e accanto al piano
sta un **registro di campagna durevole**.

## 7. Le parole del tavolo hanno una terza casa

Accordi di sessione zero, persone e luoghi inventati, note d'arco: dato di campagna dietro una
porta propria, **mai nello stesso scroll della prosa SRD**, con una porta veloce da THE NIGHT per
lines & veils. REFERENCE continua a significare esattamente ciò che dice la sua intestazione.

## 8. Un countdown registra tutto — `:2117` è riaperta di proposito

Triade Attivazione / Avanzamento / Effetto, più il campo «di chi è», più le battute per-tick sugli
orologi a lungo termine.

`:2117` («`Countdown.notes` resta non disegnato») era una decisione registrata e viene **superata
esplicitamente**, non ignorata. La voce va riscritta, non spuntata.

## 9. Catalogo di domande: 48 adesso

Con i chip «momento» e il test che accorge quando un'ancora marcisce. Cresce sull'uso reale: la
voce 49 la decide il tavolo, non un elenco scritto a tavolino.

---

## LA CONSEGUENZA CHE NASCE DA QUESTE RISPOSTE, E CHE COSTA SE LA SI SCOPRE DOPO

**Le decisioni 1, 6 e 8 toccano tutte e tre lo stesso schema.**

- **1** cambia la forma di una riga di sessione (la scena assorbe i campi dell'encounter)
- **6** aggiunge un confine di sessione, un archivio e un record di campagna
- **8** aggiunge tre campi più le battute a ogni countdown

Tutte e tre vivono in `Campaign` e passano da `CAMPAIGN_SCHEMA_VERSION` (oggi **2**) e dalla
catena in `shared/campaigns.ts`. Farle in tre momenti diversi significa **tre bump, tre
convertitori, tre giri di fixture e tre volte il rimescolamento dei test di trasferimento**.

`BACKLOG.md:3129` porta già esattamente questa lezione, scritta per un caso più piccolo:

> *«Decide the URL row and the note row together so the schema is bumped once, not twice.»*

→ **Progettare 1, 6 e 8 insieme e bumpare una volta sola a `CAMPAIGN_SCHEMA_VERSION = 3`.**

E una nota che vale più della migrazione: la stessa sessione ha scoperto che **le schede dei
giocatori dentro una campagna non passano mai dalla catena di migrazione dei *personaggi*»
(`readPartyMember` fa il cast diretto). Se si apre comunque il file delle campagne per il bump,
quello è il momento naturale per decidere anche quella — vedi §6 di
`docs/handoff/HANDOFF-beast-sheets-2026-08-23.md`.

---

## Ordine suggerito

1. Le due decisioni già approvate per l'esecuzione immediata: **Witherwild fuori** e **rinomina**
   (§4, §5), più la sezione Legal del README (§3). Sono indipendenti da tutto il resto.
2. Il **bump unico** di `CAMPAIGN_SCHEMA_VERSION` che porta 1 + 6 + 8 insieme.
3. Layout B, col vincolo di §2.
4. Il catalogo di §9 e la terza casa di §7.
