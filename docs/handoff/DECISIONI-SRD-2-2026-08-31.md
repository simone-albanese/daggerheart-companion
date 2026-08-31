# Decisioni — l'ondata SRD 2, 31 agosto 2026

**Questo documento è l'autorità sulle decisioni.** Il piano di lavoro sta nei messaggi di commit
del ramo `srd-2`. I numeri qui sono stati **misurati in questa sessione**, non ereditati: dove un
documento precedente dice altro, quel documento è sbagliato e la §7 dice in cosa.

---

## 1. Ambito dell'ondata

**Dataset + le Transformations disegnate.** Dentro: dieci domini, tredici classi, ventiquattro
stirpi, quindici comunità, 210 carte, gli avversari, loot e consumabili raddoppiati, le sei
Transformations lette *e mostrate*, e il filtro Core Set della §4.

**Fuori, ognuno con la sua ondata:** il capitolo *Supplemental Campaign Mechanics* (16 pagine,
11 sottosistemi), le *Martial Stances* con la risorsa FOCUS, e *Pool*/*Evolution* sugli avversari.
Sono feature con schema e UI proprie: farle qui produrrebbe un'ondata che fa cinque cose.

## 2. Witherwild e i campaign frame: restano fuori

**Motivo: licenza, non schema.** L'esclusione originale fu presa su basi di licenza, e il documento
che la decise raccomandava di *chiedere all'editore e tenere le sezioni intanto* — lo strip che
seguì andò contro la sua stessa raccomandazione. La decisione **non cambia senza il proprietario**.

Chi legge il codice deve trovare scritto che la ragione è legale: senza quella riga, la prossima
persona la legge come un limite tecnico e prova a «ripararla».

## 3. Le 9 armi che l'SRD 2 toglie — **decisione rinviata**

Axe of Fortunis, Blessed Anlace, Ghostblade, Runes of Ruination, Widogast Pendant, Gilded Bow,
Firestaff, Mage Orb, Ilmari's Rifle. Sono un blocco contiguo: ogni arma magica di terzo livello con
nome proprio, tutte sulla stessa pagina stampata del libro vecchio. **Sono l'unica perdita reale di
contenuto dell'intero dataset.**

**Restano nel dataset come sono.** Nessun campo nuovo, nessuna modifica al selettore. Un personaggio
che ne ha una equipaggiata non cambia. Questa è una decisione **rinviata e non risolta**: le tre
strade vere restano «marcarle come eredità», «lasciarle sparire e affidarsi al riferimento
irrisolto», «rimapparle ai successori». La terza richiede una prova che oggi **non esiste**: l'SRD 2
sembra averle sostituite con famiglie scalate per livello (Shadowblade, Bloodstaff, Wand of Essek),
ma la corrispondenza uno-a-uno non è verificata, e rimappare senza prova cambierebbe le statistiche
di un'arma su una scheda esistente senza dirlo.

## 4. Provenienza Core Set / Hope & Fear: registrata **e** filtrabile

L'SRD 2 dichiara quali contenuti stanno nella scatola fisica e quali vengono dall'espansione; l'SRD
1 non lo faceva. Ogni voce si porta la sua provenienza, **e** Impostazioni riceve un interruttore
per vedere solo ciò che si possiede.

Registrare costa poco adesso e diventa impossibile dopo senza rifare l'estrazione. Il filtro è
superficie UI nuova: vale la regola dello schermo di questo repo — arco del pollice, dimensione del
bersaglio, e la distinzione fra ciò che si legge e ciò che si tocca, argomentata e non dedotta.

## 5. I moduli opzionali: dentro, marcati

*Everyday Hero*, *Western*, *Monster Hunting* portano 43 armi e 4 armature. Entrano nelle stesse
collezioni con un campo che dice da quale modulo vengono. Il dataset resta fedele al libro, e chi
disegnerà il selettore ha di che raggrupparle o nasconderle.

## 6. Il cancello del dataset resta locale, e il codice smette di dire il contrario

Nulla verifica automaticamente che il JSON corrisponda al PDF: il passo di riestrazione è **saltato
in ogni run di CI**, perché i manuali sono del proprietario e non stanno nel repository. La fedeltà
è controllata a mano, una volta, da chi costruisce.

**Si lascia così e si scrive.** Ciò che va riparato non è il cancello ma la prosa: `tools/build-srd.ts`
documenta `--check` come *«this is CI»*, e CI non lo esegue mai — esegue la build che scrive e poi
`git diff`, dietro un `if` su un PDF che `.gitignore` esclude. Una frase falsa nel posto in cui si va
a cercare la garanzia è peggio dell'assenza della garanzia.

## 7. Dread va **in fondo** all'array, non in ordine alfabetico

**Questa non è una scelta: è forzata, e la ragione è il formato di trasporto.**

`src/transfer/codec.ts:537` scrive `DOMAINS.indexOf(dominio) + 1` come un **u8 sul filo**, e `:859`
lo rilegge come `DOMAINS[i-1]`. La posizione nell'array *è* il formato. `dread` si ordina fra `codex`
e `grace`: inserirlo lì sposterebbe di uno ogni dominio da `grace` in poi, e **ogni QR già generato e
ogni `.dhchar` già salvato leggerebbe un multiclasse Grace come Midnight**, in silenzio.

Appeso in indice 9, gli indici 0-8 non si muovono e tutto ciò che è già stato scambiato continua a
decodificarsi identico. **L'ordine alfabetico è una cosa da fare al momento di disegnare.**

Il secondo accoppiamento — la finestra di id delle carte, che si calcolava da `DOMAINS.indexOf` — è
già stato tolto in `baeaeb8`: il decimo dominio ci finiva a 6001-6099, **dentro la banda dei
beastform**, e una carta di dominio si sarebbe decodificata come `bear`.

## 8. I tre glifi nuovi: letti sulla pagina, non dedotti

**Fatto**, in `<COMMIT>`. E547=7, E548=8, E549=9 — che è la continuazione della serie, ed è
esattamente per questo che non è stata presa su quella base. Una cifra indovinata è il guasto che
`glyphs.ts` esiste per impedire: passa i parser, passa la validazione, ed è sbagliata su numeri che
un GM legge al tavolo.

Ogni glifo è stato reso in immagine e guardato, e due portano anche il riscontro in prosa che il
docblock del modulo chiede:

- **E547**, p122: `Minion (7)`, e la riga dopo *«For every 7 damage a PC deals to the Recruit»*
- **E548**, p99: `Tier 1 Horde (8/HP)` (Darkweave Swarmlings); di nuovo a p112 (Will-o'-the-Wisps)
- **E549**, p135: `Minion (9)`, e la riga dopo *«For every 9 damage a PC deals to the Elemental»*

Il metodo è stato validato prima su due glifi il cui valore era già fissato: E545 rende
`Tier 1 Horde (5/HP)` e E546 rende `Horde (1d6+3)`, con la stessa riga che ripete `1d6+3`.

## 9. Le altre tre risposte, per quando la misura arriverà

- **Slug delle regole:** gli slug seguono il libro, e una **tabella di alias vecchio→nuovo**
  scritta a mano tiene in piedi il catalogo delle domande e i momenti. La tabella è anche il posto
  dove si legge cosa il libro ha rinominato.
- **I 208 record fissati nei test:** quando uno sparisce o cambia nome, il test **ri-punta sul
  successore con una nota** che dice quale ha sostituito quale. Non si cancella l'asserzione: ogni
  cancellazione porta via anche la proprietà che quel test difendeva.
- **Le 135 schede avversario:** se usano campi che lo schema non ha, lo schema **si estende con
  campi opzionali** e `SCHEMA_VERSION` sale, col suo converter e la sua fixture. Non si scartano
  campi in silenzio: una scheda mutilata al tavolo è peggio di un bump.

---

## 10. Numeri misurati in questa sessione, con la loro definizione

| | SRD 1 | SRD 2 |
|---|---|---|
| pagine PDF | 68 | 224 |
| **pagine stampate** | **135** (1 copertina + 67 spread 1224×792) | **224** (tutte 612×792) |
| domini / classi | 9 / 9 | 10 / 13 |
| carte di dominio | 189 | 210 |
| stirpi / comunità | 18 / 9 | 24 / 15 |
| loot / consumabili | 60 / 60 | 120 / 120 |
| trattini U+2011 | 0 | **12** (di cui 9 sono le carte `‑TOUCHED`) |
| glifi PUA | E53F, E541-E546 | **+ E547, E548, E549** |

**Nomi dell'1.0 ritrovati nell'SRD 2: 839 su 849.** Le assenze sono le 9 armi della §3 più due
sezioni di regole **rinominate, non rimosse** (`Companion: Taking Damage as Stress` →
`TAKING DAMAGE AS STRESS`; `Making GM Moves` → `GM MOVES AND ADVERSARY ACTIONS`).

## 11. Tre affermazioni di documenti precedenti che sono sbagliate

1. **«772 voci su 780»** — il denominatore escludeva le 69 sezioni di regole. Con esse è 849, e le
   assenze vanno riesaminate contro il testo perché due sono rinomine.
2. **«I trattini sono U+2011»** — l'SRD 2 ha **1982 trattini ASCII contro 12** U+2011. La
   normalizzazione serve, ma chi legge quella frase può fare una sostituzione globale inutile. E i
   caratteri che rompono davvero il confronto per nome sono **invisibili**: U+00AD e U+200B, che
   nessun documento nomina.
3. **«68 pagine contro 224»** — confronta spread con pagine singole. Il rapporto onesto è 135 → 224.

## 12. Il lavoro di geometria è più piccolo di quanto detto

`layoutPages` divide una pagina **solo se è più larga che alta**, e l'SRD 2 non lo è: passa intera,
senza modifiche. Le colonne non sono numeri fissi, le trova dal bianco.

**Un solo file porta coordinate assolute: `shared/parsers/rules.ts`**, e 7 dei suoi 13 riquadri sono
in coordinate della metà destra dello spread — selezionano zero run su una pagina da 612 punti, che
è un errore netto e non una degradazione. `equipment.ts` e `loot.ts` leggono i run grezzi ma
ricavano la griglia dalle intestazioni stampate, quindi uno spostamento di pagina non li tocca.
