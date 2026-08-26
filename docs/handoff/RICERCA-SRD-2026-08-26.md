# Consultare l'SRD — il piano

> **CORRETTO IL 26 AGOSTO. Non eseguire questo file da solo.**
>
> `DECISIONI-2026-08-26.md` risponde alle tre domande della §6 e **corregge sette punti** di
> questo piano. Due di quelle correzioni sono portanti, non cosmetiche:
>
> - **§2.1 e §4.4 dicono il falso.** *«`ask.ts` continua a chiamare `searchRules`»* — non lo
>   chiama. Il pagliaio di `searchAsk` non contiene una parola del dataset. La conclusione della
>   §6.1 resta (il catalogo non si allarga), ma per un motivo semantico, non meccanico.
> - **§2.3 dice il falso.** *«il campo vuoto oggi disegna una lista vuota»* — disegna i sei chip
>   dei momenti e le porte, e li disegnava già al commit a cui questo piano si àncora.
>
> Le altre cinque — il 34 che è 33, le «tre bande» che sono cinque, i «venti campi corti» che non
> esistono, le sei righe dei momenti già misurate, il meccanismo del rigetto a buon mercato —
> sono elencate in `DECISIONI-2026-08-26.md` §1 e §2 e nel §5 di
> `HANDOFF-2026-08-26-scene-wiring.md`.
>
> **Le §5.1 e §5.2 non sono più «da misurare».** La porta è misurata e decisa: una quinta voce
> della TabBar, costo verticale 0.00px a 393×852 e a 375×667. Resta da misurare solo la lista dei
> risultati dentro Play.

Ancorato a `main` `5c9f1cc`, **150 file / 3941 test**. Le cifre qui sono lette da
`data/srd-1.0.json` a quel commit; quelle marcate **(da misurare)** non sono mai state in un
browser.

---

## 1. Le due misure che riformulano la domanda

### 1.1 La ricerca vede l'8,1% di ciò che l'app spedisce

`searchRules(rules, query)` prende `RulesSection[]`: **69 sezioni, 100.165 caratteri**. Tutto il
resto del dataset è fuori dal pagliaio.

| fuori dal pagliaio | record |
|---|---|
| `weapons` | 204 |
| `domainCards` | 189 |
| `adversaries` | 129 |
| `loot` | 60 |
| `consumables` | 60 |
| `armors` | 34 |
| `beastforms` | 22 |
| `environments` | 19 |
| `ancestries` | 18 |
| `subclasses` | 18 |
| `classes` + `communities` + `domains` | 27 |
| **totale** | **780** |

69 su 849 è **8,1%**. Scrivere `Rally` dà il silenzio onesto che la ricerca disegna per una parola
che non è nel libro — ed è una carta di dominio. Scrivere `Acid Burrower` idem, ed è un avversario
nel bestiario di questa stessa app.

### 1.2 Un giocatore non ha una porta

`src/ui/gm/RuleSearch.tsx` monta **solo** dentro `ShowSheet`, dietro il verbo SHOW della barra GM.
La schermata Play non ha nessuna ricerca. *Attacking*, *Conditions*, *Death*, *Stress* e
*Downtime* sono cercabili da una persona sola al tavolo, e non è quella che tiene il personaggio.

Il motore è già condiviso — `searchRules` sta in `src/ui/shared/srdReference.ts`. **È lo schermo a
essere GM-only**, quindi è uno spostamento più una porta, non una seconda ricerca.

### 1.3 Due fatti sulla forma

- **156 sottotitoli `##`, zero `###`.** **34 sezioni su 69 non ne hanno nessuno**, quindi sono un
  blocco solo dall'inizio alla fine. Su metà del libro la banda IN A HEADING non ha niente da
  offrire.
- **I sei momenti di `ask.ts` esistono e coprono dodici voci.** Non ne taggano nessuna delle 69
  sezioni e nessuno dei 780 record.

---

## 2. LE QUATTRO PARTI

### 2.1 Un indice solo, con dentro tutto lo spedito

Un `SrdRecord` unificato in un file nuovo — `src/ui/shared/srdIndex.ts` — che appiattisce ogni
record del dataset in `{ kind, id, name, page, haystack }`. `searchSrd` cerca su quello; le tre
bande sopravvivono intatte perché il nome di un'arma è un title hit e il testo della sua feature è
un body hit.

**Quattro renderer su cinque esistono già.** `DomainCardView` disegna una carta, `StatBlock` un
avversario e un ambiente, `BlockView` una sezione, `RuleTableView` una tabella. Ciò che è nuovo è
l'adattatore, **non un secondo modo di disegnare niente** — che è la proprietà che `RuleSearch.tsx`
già difende a lungo su `BlockView`.

`searchRules` **non si cancella e non si restringe**: `ask.ts` lo chiama, e il suo nome significa
«le sezioni delle regole». `searchSrd` è un secondo nome accanto, come `countdownsIn` sta accanto a
`countdownsOf`.

### 2.2 La stessa ricerca dove siede il giocatore

`RuleSearch.tsx` si sposta in `src/ui/shared/`, e Play guadagna una porta. Non una seconda ricerca:
lo stesso indice, le stesse tre bande, lo stesso atterraggio. Cambia **l'ambito predefinito** — un
giocatore apre già ristretto a ciò che ha in mano, e un tap allarga a tutto il libro.

Il restringimento conta più della porta. Chi scrive `rally` intende *la mia carta*, non le sei
sezioni che nominano il rally.

### 2.3 Una seconda organizzazione: per momento, non per libro

I sei momenti di `ask.ts` estesi a tutto il corpus **come appartenenza, non come spostamento**.
Niente si riordina e niente si rinomina: una sezione entra in uno o più momenti e resta dov'è.

È ciò che risponde al **campo vuoto**, che oggi disegna una lista vuota. E ripara la §1.3 senza
toccare i dati: una sezione senza sottotitoli non ha niente per la banda IN A HEADING, ma può
appartenere a *damage*.

**È l'unica parte che può marcire.** Spedisce col test che cammina ogni sezione e fallisce su una
che non appartiene a niente.

### 2.4 Risposta prima, per le domande con un numero dentro

Un **puntatore a una riga**, risolto al disegno, **mai una copia**. `ask.ts` non ha un campo
`answer` di proposito: le parole escono da `dataset.rules` al disegno e il timbro di pagina da
`sourcePage`, così **nessuna parola dell'SRD è mai ribattuta in questo repository.** Quella
proprietà è di licenza prima che di design e non si tocca.

---

## 3. BUILD ORDER — ed è UNA LANE, non quattro

**Le quattro parti scrivono tutte `RuleSearch.tsx`.** Tre su quattro scrivono anche
`srdReference.ts`. Non possono girare in parallelo, e non è un'opinione: è l'errore che questo
repo ha già pagato, e che una memoria di lavoro registra per nome — *«quattro pezzi che scrivono
tutti RuleSearch.tsx e si contendono `blockOf`»*.

| parte | file di produzione |
|---|---|
| 2.1 | `srdIndex.ts` **(nuovo)**, `srdReference.ts`, `RuleSearch.tsx` |
| 2.2 | `RuleSearch.tsx` **(si sposta)**, `ShowSheet.tsx`, `Play.tsx`, `srdIndex.ts` |
| 2.3 | `ask.ts`, `srdIndex.ts`, `RuleSearch.tsx` |
| 2.4 | `srdReference.ts`, `RuleSearch.tsx` |

**Ordine: 2.1 → 2.2 → 2.3 → 2.4.** Sequenziale, una PR per parte, ognuna verde per conto suo.

- **2.1 prima**, perché è l'indice che le altre tre leggono e perché è l'unica che cambia se la
  ricerca è *vera*.
- **2.2 seconda**, perché è uno spostamento di file: farlo dopo che altre due parti hanno riscritto
  quel file significa spostare un file più grande.
- **2.3 terza**, perché è l'unica che chiede una decisione per riga.
- **2.4 ultima**, perché è l'unica dove una scorciatoia costa una proprietà di licenza.

---

## 4. GLI EDGE CASE

1. **Un record senza testo cercabile.** Un `domain` è nove parole. Entra comunque: un title hit su
   nove parole è ancora la risposta giusta a chi ha scritto quel nome.
2. **Nomi che collidono fra kind.** Esistono un'arma e una carta che condividono parole. La banda
   dice il *kind*, quindi due hit con lo stesso nome sono distinguibili senza aprirli.
3. **Il rigetto a buon mercato è scritto per corpi di sezione**, e va riscritto per un record con
   venti campi corti. È l'unica parte di 2.1 con un rischio di prestazioni.
4. **`ask.ts` continua a chiamare `searchRules`.** Le sue dodici voci sono domande sulle *regole*,
   non su un'arma; allargare il suo pagliaio cambierebbe cosa il catalogo è.
5. **L'ambito del giocatore quando non c'è un personaggio aperto.** Play senza scheda non ha un
   loadout: l'ambito predefinito degenera a tutto il libro, che è corretto e non vuoto.
6. **Un momento senza membri.** Non si disegna, per la stessa ragione per cui una scena senza
   orologi non prende un'intestazione: una sezione vuota è la promessa di qualcosa che non c'è.

---

## 5. COSA VA MISURATO IN CHROME

**(da misurare)**, e sono un cancello sulla parte 2.2, non sulla 2.1.

1. **La porta su Play**, contro il pavimento di 44 e contro l'arco del pollice. Play scorre — la
   vecchia regola «niente scroll qui» è stata revocata — ma una porta nuova in cima costa comunque
   alla piega.
2. **La lista dei risultati dentro Play**, che è una colonna diversa da quella di `ShowSheet`.
3. **Le sei righe dei momenti sopra il campo** (2.3): `PROGETTO-GM §7` voce 6 chiede già se un
   terzo gruppo spinga il primo risultato sotto la piega, sui 308px. Sei righe sono più di un
   gruppo.

---

## 6. LE DOMANDE APERTE

1. **Il catalogo `ask.ts` si allarga ai record?** Il piano dice no (§4.4). Se sì, è una quinta
   parte.
2. **La porta su Play è un verbo o una barra?** Non decisa. La misura di §5.1 la informa.
3. **Chi scrive l'appartenenza ai momenti per le 69 sezioni?** È una decisione per riga, ed è del
   proprietario, non del codice.
