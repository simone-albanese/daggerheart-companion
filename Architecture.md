# Daggerheart Companion — Architettura

Scheda personaggio digitale e strumenti da GM. Locale-first, offline, senza account.
L'app **nasce già con tutte le regole**: l'SRD 1.0 è contenuto pubblico ridistribuibile
e viene estratto una volta sola in fase di build. Il manuale completo è un'aggiunta
facoltativa, importata dall'utente per avere le illustrazioni.

---

## 0. Decisioni prese

| Scelta | Valore | Conseguenza |
|---|---|---|
| Dati SRD | **Estratti in build, committati** | Avvio istantaneo, dati deterministici, parser testabile in CI |
| Dati manuale | Parsing in-app, opzionale, **desktop** | Il parser fragile non blocca più nessuno |
| Sovrapposizione | Il manuale sovrascrive l'SRD, campo per campo | Togliere il manuale non perde nulla |
| Motore regole | Solo aritmetica non ambigua | Le feature sono testo, le applica il giocatore |
| Niente scroll | Vale per Play lato giocatore | Encounter e Bestiary scorrono nel corpo |
| Mobile | **Ciclo di vita completo della scheda** | Solo l'import dell'arte è da desktop |
| Trasferimento | File `.dhchar` **e** QR animato | Il file è affidabilità, il QR è comodità |
| Persistenza | IndexedDB + export automatico | iOS può cancellare i dati locali |
| Campagne | Store IndexedDB e schema propri | Più tavoli, e le schede altrui fuori da localStorage |
| Lingua | **Inglese: interfaccia e dati** | Nessun layer di traduzione |
| Contenuti | Solo ufficiali, niente homebrew | Dataset immutabile, QR minuscolo per sempre |
| Multiplayer | Nessuno: ognuno gestisce la sua scheda | Zero networking, zero permessi |
| Distribuzione | Static site su GitHub Pages, PWA | Zero backend |

---

## 1. Le due pipeline

La distinzione più importante del progetto: **due parser diversi, in due momenti diversi,
con due profili di rischio opposti.**

```
BUILD TIME (la tua macchina, CI)          RUNTIME (browser dell'utente)
─────────────────────────────────         ─────────────────────────────────
tools/build-srd.ts                        src/import/*
     ↓                                         ↓
SRD 1.0 (68 pp, 0,9 MB)                   Core Rulebook (397 pp, 318 MB)
     ↓                                         ↓
data/srd-1.0.json  (~341 KB)              strato "core" in IndexedDB
     ↓                                         ↓
committato nel repo                       arte + flavour + campaign frame
     ↓                                         ↓
precache del service worker               facoltativo, solo desktop
```

Se il parser di build sbaglia, **se ne accorge la CI**. Se sbagliasse il parser
runtime, se ne accorgerebbe l'utente a tavolo, mentre gioca, e tu non riusciresti
a riprodurre il caso. Questa asimmetria giustifica da sola tutta la separazione.

### 1.1 Build time — `tools/build-srd.ts`

Gira in Node, non nel browser: può usare poppler, che sull'SRD legge il testo
in modo pulito e senza perdere le legature.

```
tools/
├─ build-srd.ts          # orchestratore
├─ fetchSrd.ts           # scarica il PDF, verifica lo SHA-256 atteso
├─ glyphs.ts             # rimappatura Private Use Area  ⚠
├─ textLayout.ts         # de-colonnazione (condiviso col runtime)
├─ parsers/              # condivisi col runtime
└─ validate.ts           # conteggi attesi, fallisce la build
```

Il PDF **non si committa**: lo scarica lo script, con l'hash bloccato.

```ts
const SRD = {
  url: 'https://www.daggerheart.com/wp-content/uploads/2025/09/Daggerheart-SRD-9-09-25.pdf',
  sha256: '<da calcolare al primo run>',
  revision: 'srd-1.0-2025-09-09',
};
```

Così la build è riproducibile, il repo resta leggero, e quando esce una revisione
nuova l'hash non torna e te ne accorgi subito.

### 1.2 La trappola dei glifi invisibili ⚠

Nell'SRD i numeri di tier degli stat block **non sono cifre**: sono glifi decorativi
nella Private Use Area. Un parser normale li scarta senza errori e produce un dataset
che *sembra* corretto.

```
Estrazione grezza:  "Tier \uE541 Solo"        atteso: "Tier 1 Solo"
                    "Horde (\uE542/HP)"       atteso: "Horde (2/HP)"
                    "Horde (\uE541\uE53F/HP)" atteso: "Horde (10/HP)"
```

| Codepoint | Valore | Occorrenze |
|---|---|---|
| `U+E53F` | `0` | 1 |
| `U+E541` | `1` | 63 |
| `U+E542` | `2` | 43 |
| `U+E543` | `3` | 29 |
| `U+E544` | `4` | 23 |
| `U+E545` | `5` | 1 |
| `U+E546` | `6` | 1 |
| `U+F0E0` | `→` | 4 |

Colpisce `Tier N Tipo`, `Horde (N/HP)`, `Minion (N)`, `Countdown (Loop N)`.

**Tripla difesa**, perché la tabella può cambiare in una revisione futura:

1. Rimappa i PUA con la tabella sopra.
2. Deduci comunque il tier dall'intestazione di sezione (`TIER 1 ADVERSARIES`).
3. Recupera `Minion (N)` e `Horde (N)` dal testo delle FEATURES, dove gli stessi
   numeri compaiono in cifre normali.

E soprattutto: **se un PUA sconosciuto sopravvive al parsing, fallisci la build.**

### 1.3 Validazione che blocca la build

```
domini 9 · carte dominio 189 (21 per dominio) · classi 9 · sottoclassi 18
ancestry 18 · community 9 · beastform 22 · avversari ~129 · ambienti 19
0 caratteri PUA residui · 0 token con legature perse
```

Test di regressione sulle legature, perché dipendono dall'estrattore:

```ts
expect(text).not.toMatch(/\b(diculty|benets|modier|nesse|specic|reect)\b/i);
expect(text).toMatch(/\bDifficulty\b/);
```

Le fixture ricavate dall'SRD **si possono committare**: è Public Game Content.
Quelle ricavate dal manuale no.

### 1.4 Runtime — solo il manuale

`src/import/` gestisce esclusivamente il Core Rulebook, con pdf.js in un Web Worker.
Riusa `textLayout.ts` e i `parsers/` dalla pipeline di build, ma non ha più bisogno
di `glyphs.ts`: il manuale usa cifre vere.

Compiti: estrarre l'arte delle carte, il flavour text più ricco, i campaign frame,
e i contenuti presenti nel manuale ma non nell'SRD.

**Solo desktop.** Renderizzare 30 pagine a scala 2.0 e ricomprimere 200 ritagli in
WebP da un file di 318 MB è un candidato serio all'out-of-memory su mobile.
Dalla schermata su telefono l'opzione appare disabilitata, con una riga che spiega
perché e come portare l'arte dal computer (§ 5.4).

---

## 2. Primo avvio

L'app non è più vuota. All'apertura hai già 189 carte dominio, 129 avversari,
tutte le classi e tutte le tabelle. **Il primo schermo è "crea un personaggio",
non "carica un PDF".**

L'invito all'acquisto resta, ma smette di essere un pedaggio e diventa un'offerta:
una riga discreta e persistente nelle impostazioni, più una comparsa contestuale
la prima volta che apri una carta senza illustrazione.

> Cards here are text-only — the free SRD doesn't include artwork.
> Own the **Daggerheart Core Rulebook** PDF? Load it from a computer and the app
> will use the official illustrations. Don't own it? Buying it supports the people
> who made the game → daggerheart.com/buy

Attribuzione richiesta, sempre visibile nel footer e nel README:

> This product includes materials from the Daggerheart System Reference Document 1.0,
> © Critical Role, LLC, under the terms of the Darrington Press Community Gaming License.
> More information at www.daggerheart.com.
> Daggerheart Compatible. Independent community content, not affiliated with or
> endorsed by Critical Role, LLC or Darrington Press.

### 2.1 Una lingua sola: inglese

Interfaccia, dati, messaggi di errore, nomi dei file: tutto in inglese.

Non è solo una scelta di comodità. I dati dell'SRD sono in inglese e i termini
di gioco sono **meccanici**, non descrittivi: quando una carta dice *"mark a Stress"*,
un'etichetta tradotta accanto crea un attimo di traduzione mentale a ogni sguardo —
esattamente ciò che il vincolo del mezzo secondo vuole eliminare. Meglio zero
attrito e una lingua sola che due lingue che si rincorrono.

Conseguenze pratiche:

- Niente `i18n`, niente file di stringhe, niente selettore di lingua. Un sottosistema
  intero che non esiste.
- Le stringhe stanno inline nei componenti. Se un giorno servisse la traduzione,
  estrarle è lavoro meccanico.
- L'app è pubblicabile a chiunque nel mondo senza lavoro aggiuntivo.
- Anche codice, commenti e commit in inglese: coerenza dall'alto in basso.

Questo documento resta in italiano perché è il tuo documento di lavoro; tutte le
stringhe citate qui dentro sono quelle vere, in inglese.

---

## 3. Cosa fa e cosa non fa il motore

La ragione per cui le schede digitali di GDR diventano ingestibili è che provano
a eseguire le regole. Qui il confine è dichiarato.

### 3.1 Calcola (aritmetica, nessuna ambiguità)

- Soglie di danno = soglie base dell'armatura + livello
- Danno in ingresso → HP da segnare (Minor 1, Major 2, Severe 3), con la riduzione
  di un gradino se si segna uno slot armatura
- Proficiency per livello (1 · +1 a liv. 2 · +1 a liv. 5 · +1 a liv. 8)
- Tiro di danno = Proficiency × dado dell'arma + modificatore fisso
- Esito del Duality Roll: successo/fallimento, con Hope o Fear, critico sui pari
- Loadout massimo 5, Recall Cost da pagare in Stress
- Conversione dell'oro (10 manciate = 1 sacca, 10 sacche = 1 forziere)
- Battle points del GM: `(3 × PG) + 2`, con i costi per ruolo
- Vincoli di livellamento: quali avanzamenti sono disponibili in quale tier

### 3.2 Non calcola (mostra il testo, applica l'utente)

- Le feature di classe, sottoclasse, ancestry e community
- Il testo delle 189 carte dominio
- Le feature di avversari e ambienti
- I countdown: li mostra e li fa scorrere a mano, non deduce quando avanzano
- Condizioni (Hidden, Restrained, Vulnerable, e tutte quelle speciali)
- Qualsiasi regola della casa

Il motivo non è pigrizia: è che modellare 189 carte con le loro eccezioni è un
progetto più grande di tutto il resto insieme, e ogni tavolo con una variante
finirebbe a combattere contro l'app invece di usarla.

**Via di mezzo utile:** le feature con un effetto numerico dichiarato ottengono un
pulsante che *propone* l'azione — "Tusks: +1d6 al danno" applica il bonus al tiro
corrente se lo tocchi. Proposta, mai automatismo.

---

## 4. Sorgenti a strati

```ts
type Layer = { id: string; label: string; priority: number; importedAt?: string };

const layers = [
  { id: 'srd-1.0-2025-09-09', label: 'SRD 1.0',       priority: 0 },  // sempre presente
  { id: 'core-2025-09-07',    label: 'Core Rulebook', priority: 1 },  // facoltativo
];
```

**Niente homebrew.** Solo contenuto ufficiale: il dataset è immutabile, non serve
un editor, né validazione dei contenuti utente, né allocazione dinamica di ID.
Il QR non deve mai trasportare definizioni di carte, solo riferimenti — e resta
minuscolo per sempre.

Costa zero però lasciare la porta socchiusa, perché l'homebrew è la richiesta numero
uno per app di questo tipo e Daggerheart lo incoraggia esplicitamente:

- `priority: 2` resta libero nel modello a strati
- gli **ID ≥ 60000 sono riservati** nel registry ai futuri contenuti utente

Due righe oggi che evitano una migrazione dolorosa domani. Non implementare nulla.

Risoluzione **campo per campo**: vince lo strato di priorità più alta che definisce
la proprietà. Il manuale porta `art`, `flavorText`, `sourcePage` senza cancellare
quello che l'SRD aveva già. Rimuovere il manuale riporta all'SRD senza riparsare.

Abbinamento fra strati con slug normalizzato condiviso:

```ts
const slugify = (s: string) => s
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[\u2018\u2019']/g, '')      // Monett's Cloak → monetts-cloak
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
```

Dopo l'import del manuale, **schermata di riconciliazione**: quanti abbinati, quanti
solo nel manuale, quanti solo nell'SRD, con abbinamento manuale per i casi dubbi.

---

## 5. Trasferimento e mobilità

Tutto passa dallo stesso codec. Cambia solo il vettore.

### 5.1 Registro degli ID stabili

`data/registry.json`, committato, **append-only**. Generato dalla build dell'SRD,
poi mai rinumerato.

```json
{ "version": 1, "ids": { "arcana-rune-ward": 5101, "wizard": 1009, "elf": 3004 } }
```

Serve perché il QR trasporta interi, non slug: è la differenza fra 604 e 147 byte.
Test in CI che fallisce se un ID esistente cambia o sparisce.

Fasce assegnate: `1000–1999` classi · `2000–2999` sottoclassi · `3000–3999` ancestry ·
`4000–4999` community · `5000–5999` carte dominio · `7000–7999` armi ·
`8000–8999` armature · `9000–9999` oggetti · **`≥ 60000` riservati** (mai emessi).

### 5.2 Codec

```
1. Serializzazione binaria compatta
   - ogni Ref → varint dal registry
   - testo libero → UTF-8 con prefisso di lunghezza varint
2. deflate raw (applicato solo se riduce davvero)
3. crc32 del payload, dentro il payload
4. framing multi-frame (solo per il QR)
```

**Formato 2** (quello scritto oggi):

```
byte 0     versione nel nibble basso, 0x80 se il corpo è deflated
byte 1-4   crc32 big-endian su tutto il payload con questi quattro byte azzerati
byte 5..   il corpo
```

Il formato 1 — stesso header, corpo dal byte 1, nessun checksum — si **legge e non
si scrive più**. Il passaggio vecchio-telefono → nuovo-telefono è il caso per cui
questo vettore esiste, e lì il mittente *è* la build vecchia.

Il checksum sta qui e non solo nel frame perché è una proprietà del formato, non
del canale: misurati 8136 flip di un bit su 15 schede reali, il 30,9 % decodificava
in un personaggio **diverso** senza alcun errore. Il crc32 del frame li prendeva
tutti, ma copriva le due superfici di ricezione che l'app spedisce, e lì la verifica
è un'opzione di chi chiama (`qr.ts`). Un payload che arrivasse in qualunque altro
modo non ereditava nulla.

Misure reali, wizard di livello 5 con 5 carte in loadout, 6 nel vault, 3 esperienze:

| Codifica | Dimensione |
|---|---|
| JSON con slug | 796 byte |
| JSON + deflate | 451 byte |
| JSON + deflate + base64 | 604 caratteri |
| **Binario con ID dal registry** | **147 byte** |
| Con 400 caratteri di note e connessioni | ~580 byte |

### 5.3 I due vettori

**File `.dhchar`** — JSON leggibile, contiene solo riferimenti e valori. È il backup,
il canale affidabile e il formato condivisibile senza problemi di copyright.
Funziona identico su desktop e mobile: share sheet su iOS/Android, download su desktop.

**QR animato** — header di 11 byte per frame:

```
"DH1" | transferId u16 | index u8 | total u8 | crc32 del payload completo u32 | chunk
```

- `transferId` casuale: distingue trasferimenti concorrenti allo stesso tavolo
- `crc32` sul payload ricostruito: rifiuta le mescolanze. È un'affermazione sul
  *set* — i chunk arrivati sono quelli spediti, nell'ordine giusto, da un solo
  mittente — diversa da quella del codec (§5.2), che vale anche per un payload
  che non è mai passato dai frame
- chunk ≤ 180 byte → QR versione ≤ 12 (65×65 moduli), correzione M

Il mittente **cicla i frame in loop a 5 fps**. Il ricevente tiene puntata la fotocamera,
accumula gli indici e mostra "4 di 6 ricevuti". Nessun handshake, nessun ordine da
rispettare, nessuna rete.

- Scheda tipica: 1 frame, istantanea
- Con note lunghe: 4 frame, ciclo completo in 0,8 s
- Oltre ~15 frame: l'app propone il file al posto del QR

Contro i limiti fisici della scansione schermo-fotocamera (riflessi, moiré fra le due
griglie di pixel, autofocus ravvicinato): massima luminosità automatica sul mittente,
quiet zone generosa, correzione M anziché L.

**Import degradato, sempre.** Se il ricevente non riconosce alcuni ID, importa lo stesso
e segnala. I riferimenti ignoti restano nella scheda come `unresolvedRefs` e si
risolvono da soli quando arriva la fonte mancante. Non scartare mai nulla.

### 5.4 Portare l'arte dal computer al telefono

L'import dell'arte è da desktop, ma l'arte deve poter arrivare sul telefono.
Stesso principio del trasferimento schede: un file.

**Art pack** (`.dhart`) — generato dal desktop dopo l'import del manuale.
Contiene solo le WebP a 600 px indicizzate per slug, senza testo.

- Pacchetto completo: ~20 MB
- Per singolo dominio: ~2 MB — chi gioca un Wizard scarica Codex e Splendor e basta

Sul telefono si importa dal file picker come qualsiasi altro file. Nessun PDF,
nessun parsing, nessun rischio di memoria.

> ⚠️ L'art pack contiene illustrazioni del manuale: è per uso personale sui propri
> dispositivi, non si condivide. L'app lo dice esplicitamente al momento della creazione.

### 5.5 Il telefono deve bastare

Tutto il ciclo di vita della scheda funziona su mobile, senza mai toccare un computer:

creare un personaggio · giocare · salire di livello · gestire loadout e vault ·
inventario e oro · esportare e importare via file o QR · backup e ripristino ·
usare gli strumenti da GM

L'unica cosa che il telefono non fa è **estrarre l'arte da un PDF di 318 MB**.
Riceverla in un art pack, sì.

---

## 6. Persistenza e durabilità

| Cosa | Dove | Perché |
|---|---|---|
| Dataset SRD | Precache del service worker (~97 KB gzip) | Immutabile, versionato col deploy |
| Strato manuale | IndexedDB, store separato | Rimuoverlo non tocca l'SRD |
| Arte | IndexedDB `art` | Blob nativi, niente base64 |
| Personaggi | IndexedDB `characters` | Multi-personaggio |
| Campagne | IndexedDB `campaigns` | Multi-campagna, e contengono schede altrui |
| Preferenze | localStorage | Piccole e sincrone |
| I PDF | **mai salvati** | Si ri-importano |

Le campagne stavano in una sola chiave di localStorage, `dhc.gm.v1`, riscritta
in modo sincrono a ogni `+1` di Fear. Misurato su un tavolo reale — quattro PG
di livello 5, sei combattenti, quattro countdown — il blob è di 7.662 byte, di
cui 5.464 sono **quattro schede personaggio complete**: la party board tiene le
schede intere di proposito (`src/ui/gm/party.ts`). Tenere le schede di altre
persone nello store che iOS cancella per primo era l'unico punto dell'app in cui
niente di questa sezione era mai stato applicato.

Una campagna possiede: nome, session list, Fear, countdown (uno può essere il
primario), party importata e il tavolo vivo. **Non** possiede i personaggi che
l'utente gioca: quelli restano in `characters`, non c'è nessun `campaignId` su
`Character`, e cambiare campagna non tocca quello store. Così una scheda può
stare su due tavoli senza che i due si contraddicano.

### Il problema iOS, trattato seriamente

ITP può cancellare IndexedDB dopo circa **sette giorni di inattività**, e
`navigator.storage.persist()` viene concesso in modo incostante. Un gruppo che gioca
ogni tre settimane perde il personaggio fra una sessione e l'altra.

1. Richiedi `navigator.storage.persist()` alla creazione del primo personaggio,
   spiegando perché — l'installazione della PWA in home screen aumenta molto le
   probabilità che venga concesso.
2. **Export automatico** a fine sessione e alla chiusura dell'app, nella cartella
   scelta dall'utente (File System Access API dove c'è, share sheet altrove).
3. Indicatore permanente e discreto: *"ultimo backup: 3 giorni fa"*, che diventa
   evidente dopo cinque.
4. Sopra i 7 giorni di inattività, all'apertura: verifica l'integrità e proponi il
   ripristino dall'ultimo export.

Il personaggio è il lavoro di mesi dell'utente. Perderlo è l'unico bug davvero
imperdonabile di un'app come questa.

### 6.1 Regola dello schema: nessuno schema parte senza il suo convertitore

`SCHEMA_VERSION` (`shared/types.ts`) governa i file `.dhchar` e `.dhbackup` **e**
i record in IndexedDB. Alzarlo è un'operazione incompleta finché non ci sono
tutte e tre queste cose, e `tests/store/migrations.test.ts` fallisce se ne manca
una:

1. un convertitore in `shared/migrations.ts` con chiave sulla versione che si
   lascia — la catena avanza di un passo per volta, così nessuno dovrà mai
   scrivere un convertitore da N a corrente;
2. una fixture committata in `tests/fixtures/schema/` scritta dalla build che si
   sta superando, mai rigenerata dalla build nuova: una fixture riscritta
   dimostrerebbe soltanto che il codice attuale sa leggere il proprio output,
   che non è la domanda;
3. `DB_VERSION` con il suo ramo `oldVersion` in `src/store/db.ts`, se cambia
   anche la forma del database.

Il motivo è che questa app fa **convivere due build sullo stesso dispositivo per
scelta**: `UpdateBanner` propone il worker in attesa invece di sostituire il
bundle a sessione aperta. Senza il controllo, la build vecchia legge un record
nuovo, lo interpreta con il proprio schema e lo riscrive attraverso il debounce
di 400 ms — degradando il personaggio sul posto, nell'unica copia, senza una
parola sullo schermo. Perciò `readLibrary()` mette in quarantena ciò che è più
recente della build invece di renderizzarlo, e `putCharacter()` si rifiuta di
scriverci sopra.

`OLDEST_READABLE` è 3 e non 1 perché gli schemi 1 e 2 non sono mai esistiti fuori
dallo sviluppo: `SCHEMA_VERSION` vale 3 dal primo commit. Scrivere convertitori
per loro significherebbe inventarsi una storia con cui essere compatibili.

#### Una regola sola, due numerazioni

`CAMPAIGN_SCHEMA_VERSION` (`shared/campaigns.ts`) governa i record `campaigns` e
i file `.dhcampaign`. È un numero separato **di proposito**: una campagna è un
record diverso in uno store diverso con una storia diversa, e infilarla dentro
`SCHEMA_VERSION` renderebbe ogni futuro campo di campagna una migrazione di
personaggi, obbligando a riscrivere ogni fixture committata per un campo che
nessun personaggio ha.

Quello che *non* è separato è la regola. Stessi tre requisiti, stessa
macchinaria: `CAMPAIGN_MIGRATIONS` usa l'interfaccia `Migration` e le funzioni
di `shared/migrations.ts` — `versionOf`, `checkReadable`, `applyChain`,
`missingConverters` prendono i numeri come parametri invece di leggerli inline —
la fixture committata è `tests/fixtures/schema/v1.campaign.json`, e
`tests/store/campaignSchema.test.ts` chiede al secondo numero esattamente ciò
che `tests/store/migrations.test.ts` chiede al primo, compreso il test che
domanda cosa mancherebbe se la costante salisse di uno.

`readCampaigns()` mette in quarantena un record più recente della build e
`putCampaign()` si rifiuta di scriverci sopra, per lo stesso motivo delle loro
controparti sui personaggi — con in più che qui il record contiene le schede di
altre persone.

Terzo requisito, esercitato per la prima volta: `DB_VERSION` è passato da 1 a 2
con il suo ramo `oldVersion < 2`. È il primo secondo ramo che questo database
abbia mai avuto, e il test che lo copre parte da un database di versione 1 con
un personaggio dentro e verifica che il personaggio ci sia ancora dopo l'upgrade.

### 6.2 Se il bundle non si valuta: cosa c'è sullo schermo, e la leva per ritirarlo

Il guasto residuo che nessun error boundary può vedere, perché un boundary vive
dentro il grafo dei moduli e qui il grafo non è mai esistito: un chunk con hash
che risponde 404 dopo che `pruneAssets()` ha spazzato la build precedente, una
sintassi che il motore non sa leggere, un throw a module scope. Il deadline di
otto secondi di `init()` copre il caso adiacente — l'app monta e poi si pianta —
non questo. Arriva su tutti i dispositivi installati nello stesso momento, e il
rimedio che dà qualunque pagina di supporto (cancella i dati del sito,
disinstalla e reinstalla la PWA) distrugge l'unica copia del personaggio che
esiste.

Perciò `index.html` non è più `<div id="root"></div>` e basta:

- **Testo statico dentro `#root`**, che React sovrascrive al mount. Rivelato a
  3 s da uno script inline e non prima: prima di quel momento la frase «l'app non
  è partita» sarebbe sullo schermo anche durante un primo caricamento lento e
  perfettamente sano. Dice cos'è l'app, che i personaggi sono intatti nello
  storage del browser, cosa fare, e — esplicitamente — di **non** cancellare i
  dati del sito.
- **Una via d'uscita che non passa dal bundle.** A 10 s un secondo script inline,
  in ES5 (niente moduli, niente import: uno dei modi in cui un bundle non si
  valuta è un motore troppo vecchio per leggerlo, e una scialuppa scritta nella
  sintassi che ha affondato la nave non salva nessuno) apre IndexedDB, legge lo
  store `characters` e offre la libreria come `.dhbackup` e come testo
  selezionabile — una PWA iOS installata inghiotte il download in silenzio. Si
  mostra solo se trova qualcosa, così un primo accesso su rete lenta non lo vede
  mai. Apre **senza versione**, per sopravvivere a un `DB_VERSION` che si muove,
  e aborta l'`upgradeneeded`: un `open` nudo su un dispositivo che non ha mai
  aperto l'app creerebbe il database vuoto a versione 1, e il vero
  `openDB(nome, 1)` troverebbe la versione che voleva, salterebbe il proprio
  `upgrade` e non creerebbe mai i quattro store.
- I due nomi, `daggerheart-companion` e `characters`, sono scritti a mano lì
  dentro perché non possono essere importati. `tests/pwa/bootFallback.test.ts`
  esegue davvero quello script contro un database scritto da `db.ts` e rilegge
  ciò che produce con `parseBackupFile`: se un nome deriva la CI fallisce, invece
  di scoprirlo alle due di notte con la produzione morta.

**La leva.** Alzare `VERSION` in `public/sw.js` rinomina entrambe le cache —
`dhc-shell-<VERSION>` e `dhc-assets-<VERSION>` — quindi `takeOver()` le vede
vecchie, le cancella, e `ensurePrecached()` ricostruisce dalla rete. Costa un
download completo a ogni client installato (documento, bundle, chunk SRD, font,
icone) più 1.6 MB di worker pdf.js a chi aveva usato l'importer, e non è
immediato: il worker non chiama `skipWaiting()`, quindi il rimpiazzo resta in
`waiting` finché l'utente non accetta il prompt o non chiude ogni scheda. Nella
maggior parte dei casi non serve — una build corretta viene adottata da sola,
perché il documento è servito stale-while-revalidate e la seconda apertura online
è già quella giusta. Il runbook completo è nel README, in inglese, che è dove si
guarda quando si è nel panico.

---

## 7. Modello dati

```ts
type Ref = string;  // slug: "arcana-rune-ward"

interface Dataset {
  schemaVersion: 3;
  layers: Layer[];
  domains: Domain[]; domainCards: DomainCard[];
  classes: CharClass[]; subclasses: Subclass[]; beastforms: Beastform[];
  ancestries: Ancestry[]; communities: Community[];
  weapons: Weapon[]; armors: Armor[]; loot: Item[]; consumables: Item[];
  adversaries: Adversary[]; environments: Environment[];
}

interface DomainCard {
  id: Ref; name: string; domain: Ref;
  level: number; type: 'Spell' | 'Ability' | 'Grimoire';
  recallCost: number; text: string;
  artKey?: string;
  provenance: Record<string, string>;   // campo → strato che lo definisce
}

interface Adversary {
  id: Ref; name: string; tier: 1|2|3|4; role: AdversaryRole;
  description: string; motives: string[];
  difficulty: number | 'special';
  thresholds: [number, number] | null;  // i Minion non le hanno
  hp: number; stress: number;
  attack: { bonus: number; name: string; range: Range; damage: string };
  experiences: { name: string; bonus: number }[];
  features: Feature[];                  // testo, mai eseguito
}

interface Character {
  id: string; schemaVersion: 3;
  name: string; pronouns: string;
  classRef: Ref; subclassRefs: Ref[]; ancestryRefs: Ref[]; communityRef: Ref;
  level: number; proficiency: number;
  traits: Record<Trait, number>;
  hp: Counter; stress: Counter; hope: Counter; armorSlots: Counter;
  evasion: number; thresholds: [number, number];
  loadout: Ref[]; vault: Ref[];
  activeWeapons: Ref[]; activeArmor: Ref | null; inventory: InventoryEntry[];
  experiences: { name: string; bonus: number }[];
  gold: { handfuls: number; bags: number; chests: number };
  connections: string[]; notes: string;
  levelUpHistory: LevelUpChoice[];
  unresolvedRefs?: number[];
}
```

**Regola d'oro**: il personaggio salva solo `Ref` e valori, mai copie dei contenuti.
Aggiornare il dataset non tocca i personaggi.

---

## 8. Struttura del repo

```
daggerheart-companion/
├─ tools/                      # ⭐ gira in Node, non spedito al browser
│  ├─ build-srd.ts  fetchSrd.ts  glyphs.ts  validate.ts
│  └─ buildRegistry.ts
├─ data/                       # ⭐ l'unico contenuto committato
│  ├─ srd-1.0.json             # ~341 KB, generato dalla build
│  └─ registry.json            # slug ↔ ID, append-only
├─ shared/                     # usato sia da tools/ che da src/
│  ├─ textLayout.ts  slugify.ts  types.ts  migrations.ts  campaigns.ts
│  └─ parsers/
│     ├─ domainCards.ts  adversaries.ts  environments.ts
│     ├─ classes.ts      ancestries.ts   communities.ts
│     └─ beastforms.ts   equipment.ts    loot.ts
├─ src/
│  ├─ import/                  # SOLO manuale, solo desktop
│  │  ├─ worker.ts  detectSource.ts  reconcile.ts  art.ts  artPack.ts
│  ├─ engine/                  # PURO: zero UI, zero pdf.js
│  │  ├─ character.ts  levelUp.ts  loadout.ts  damage.ts  dice.ts  encounter.ts
│  ├─ transfer/
│  │  ├─ codec.ts  frames.ts  qrOut.tsx  qrIn.tsx  fileIo.ts  campaignFile.ts
│  ├─ store/  db.ts  state.ts  backup.ts  campaigns.ts  campaignMigration.ts
│  ├─ ui/
│  │  ├─ shell/  player/  gm/  settings/  shared/
│  └─ main.tsx
├─ public/  manifest.webmanifest  sw.js
└─ tests/fixtures/             # righe di testo dall'SRD, MAI un PDF
```

`.gitignore`, prima riga: `*.pdf`

---

## 9. UI

È un **cockpit**, non un documento. `100dvh`, CSS Grid, `clamp()` sui font.

### 9.1 Regola dello scroll, per modalità

| Modalità | Scroll | Perché |
|---|---|---|
| **Play** (giocatore) | **Sì, nel corpo** | La regola «nessuno scroll» è caduta con `91097eb`: affamava il loadout e tagliava il controllo di tiro. Restano fissi l'identità e il blocco del tiro |
| **Cards** | Nella griglia | 189 carte, ovvio |
| **Build** | Nel pannello del passo | Wizard a step, intestazione fissa |
| **GM** | **Nella lista della serata** | Fissa solo la barra in alto — nome della campagna, Fear, countdown primario. Scorre la lista; una riga si apre in posto |
| **Strumenti GM** (Encounter, Scene, Bestiary, Party, Countdown) | Nel corpo | Non sono più regioni di primo livello: si aprono *sopra* la lista, a tutta finestra, e ognuno tiene lo scroll che aveva |

Il vincolo cade dove è aritmeticamente impossibile: Adult Flickerfly ha sette feature,
Battle Box ne ha una con una tabella di sei voci. Tre avversari di Tier 3 più un
ambiente e due countdown non entrano in 390×844 a corpo leggibile. Fingere di sì
produce testo a 9px, che a tavolo non si legge.

### 9.2 Desktop / Mac — 3 colonne

```
┌──────────────────────────────────────────────────────────┐
│ Kaelith  Wizard Lv.5   [Build][Play][Cards]       ☰      │
├──────────────┬──────────────────────┬────────────────────┤
│ TRAITS       │ LOADOUT (5 cards)    │ DUALITY ROLL       │
│ Agi +1 Str+0 │ ┌────┐┌────┐┌────┐   │  ⬡ Hope  ⬡ Fear   │
│ Fin +1 Ins+2 │ │    ││    ││    │   │   [ ROLL ]         │
│ Pre −1 Kno+3 │ └────┘└────┘└────┘   ├────────────────────┤
├──────────────┤ ┌────┐┌────┐         │ LOG                │
│ HP  ●●○○○○○  │ │    ││    │         │ 14 vs 12 · Hope    │
│ Str ●●●○○○   │ └────┘└────┘         │ 3d6+4 → 17 dmg     │
│ Hope ●●●●○○  ├──────────────────────┤                    │
│ Arm ●○○○     │ WEAPON · Impr. Wand  │                    │
│ Evasion 12   │ 3d6+4 mag · Far      │                    │
│ Thresh 14/25 │ [ ATTACK ]           │                    │
└──────────────┴──────────────────────┴────────────────────┘
```

### 9.3 Tablet — 2 colonne + drawer · Telefono — 1 colonna + tab bar

```
┌─────────────────┐
│ Kaelith · Wiz 5 │
├─────────────────┤
│  HP  ●●○○○○○    │
│  Str ●●●○○○     │
│  Hope ●●●●○○    │
│                 │
│  Agi +1  Str +0 │
│  Fin +1  Ins +2 │
│  Pre −1  Kno +3 │
├─────────────────┤
│ [🎲 ROLL]       │
├─────────────────┤
│ Stats│Cards│Gear│
└─────────────────┘
```

### 9.4 Dettagli che contano a tavolo

- Tap target minimo 44 px; contatori: tap segna, pressione lunga libera
- `user-select: none` ovunque tranne le note
- Wake lock durante la sessione
- Tema scuro predefinito, alto contrasto: si gioca in stanze buie
- Nessuna animazione oltre 150 ms, tranne il QR animato
- La carta dominio ha **due stati** — con arte e solo testo — ed entrambi devono
  sembrare voluti. Senza manuale, il solo testo è lo stato normale.

---

## 10. Strumenti GM

Stesso motore, stesso dataset. **Nessuna rete**: il GM non vede le schede dei
giocatori e non c'è niente da sincronizzare. Sono strumenti personali — consultazione
e tracciamento — non un tavolo condiviso. Niente WebRTC, niente discovery sulla LAN,
niente stati di connessione da gestire o da spiegare.

Il canale di trasferimento (§ 5) serve quindi soprattutto a **spostare il tuo
personaggio fra i tuoi dispositivi**: costruito su desktop, giocato su telefono,
consultato su tablet. In secondo piano, passare un pregenerato a un giocatore nuovo.

**La casa del GM è la lista della serata** (P5-2). Fino a `f7a59fc` questa
schermata era una striscia di cinque tab — encounter, scene, party, bestiary,
countdown — e ognuna funzionava; quello che nessuna era è *la serata*. Il record
della campagna porta una `session: SessionItem[]` da quando esistono le
campagne e nessuno l'aveva mai disegnata. Ora la lista **è** la schermata: le
righe si aprono in posto, e i cinque strumenti qui sotto sono ciò che una riga
apre, sopra la lista, dentro `GmSheet`. Uno strumento chiuso è **smontato**, mai
nascosto: lo scanner della PartyBoard apre la fotocamera in un effetto e la
chiude allo smontaggio.

`board.region` resta nel record e cambia significato: non più «quale tab era
selezionata» ma «quale strumento è stato aperto per ultimo». Quattro punti fuori
da `Gm.tsx` ci navigano scrivendoci dentro (Encounter manda il roster alla
scena, Bestiary butta dentro un avversario, la scena vuota offre gli altri due)
e nessuno di loro è stato toccato: `Gm.tsx` segue i *cambiamenti* di quel campo,
mai il valore che ci trova al mount — altrimenti arrivare sulla schermata GM
riaprirebbe l'encounter builder ogni volta, che è esattamente il comportamento a
menù che P5-2 elimina.

- **Encounter builder**: `(3 × PG) + 2` battle points. Costi: gruppo di Minion 1,
  Social/Support 1, Horde/Ranged/Skulk/Standard 2, Leader 3, Bruiser 4, Solo 5.
  Aggiustamenti: −1 più facile, −2 con 2+ Solo, +1 da tier inferiore, +2 più duro.
- **Tracker di scena**: HP e Stress tappabili, soglie sempre visibili, spotlight.
- **Fear pool**: contatore grande, massimo 12, fisso in cima; il numero apre la
  board dove lo si imposta di netto.
- **Countdown**: standard, dinamici, loop, long-term. Si fanno scorrere a mano.
  Uno può essere **primario** e allora sta nella barra in alto.
- **Ambienti**: le feature dell'ambiente attivo affiancate agli avversari.

**La barra in basso, dentro la sezione GM**, porta i verbi del GM: **ADD**,
**SHOW**, **SAVE**. Non sono destinazioni, sono verbi — `aria-haspopup="dialog"`
e mai `aria-current` — e le colonne sono `repeat(n, 1fr)` sul numero di verbi,
così togliendone uno la barra si ridistribuisce invece di lasciare un buco.
**SEARCH non c'è**: la ricerca full-text delle regole è rinviata a 1.1, e la
ricerca che un GM fa davvero a tavolo è già il filtro del Bestiary dietro SHOW.
Un bottone che non apre niente è peggio di un bottone che non c'è.

- **ADD** scrive le quattro righe — scena con ambiente, encounter (che può
  prendere il roster che è sul tavolo adesso, mai i combattenti), link a
  qualcosa già dentro l'app, countdown (pinnabile subito). Ogni riga nasce
  chiusa e in fondo alla lista, e la sheet lo dice.
- **SHOW** biforca nei due strumenti che nessuna riga apre: Bestiary in sola
  consultazione e la party board. Erano due chip in cima finché la barra non
  esisteva; se ne sono andati con questa.
- **SAVE** non è il bottone che salva. La campagna è già scritta 400 ms dopo
  l'ultima modifica e di nuovo su `pagehide`; la sheet fa un flush, poi dice
  *quando* l'ultima scrittura è arrivata davvero sul disco — `updatedAt`, che
  `writeActive` sposta dentro `campaigns` solo nel ramo di successo di
  `putCampaign` — mostra `writeError` al posto del timbro quando c'è, e offre la
  copia `.dhcampaign` dicendo che **nessuna parte di questa build sa rileggerla**.

Una riga della sessione porta il **suo** piano — roster, aggiustamenti,
ambiente — e la campagna porta **un** tavolo solo (`GmBoard`). Sono due cose
diverse con la stessa forma, e le righe lo dicono: METTI SUL TAVOLO e TIENI QUI
QUELLO CHE C'È SUL TAVOLO, costruiti solo con azioni che lo store ha già. Ciò
che non ha un verbo è scritto come fatto senza controllo — i `combatants`
salvati su una riga non si rimettono, perché nessuna azione dello store imposta
la lista dei combattenti in blocco.

---

## 11. Roadmap

La sequenza è cambiata: il parser fragile è finito in fondo, dove non blocca nulla.

**Fase 1 — Il dataset.** `tools/build-srd.ts` completo: glifi PUA, de-colonnazione,
tutti i parser, validazione che fallisce la build. Deliverable: `data/srd-1.0.json`
committato e verde in CI. *Nessuna UI.* È il fondamento di tutto.

**Fase 2 — Motore e persistenza.** `engine/` puro con test, IndexedDB, scheda in
sola lettura che renderizza un personaggio scritto a mano.

**Fase 3 — Play.** Contatori, dadi, loadout, log. La schermata che si usa il 90%
del tempo. Con questa l'app è già utile a tavolo.

**Fase 4 — Build.** Creazione e passaggio di livello.

**Fase 5 — Trasferimento e backup.** Registry, codec, file `.dhchar`, QR animato,
export automatico, ripristino.

**Fase 6 — Strumenti GM.** Encounter, Bestiary, Fear, countdown.

**Fase 7 — PWA.** Service worker, installazione, wake lock, `persist()`.

**Fase 8 — Manuale completo (facoltativa).** Parser runtime, riconciliazione,
pipeline arte, art pack. Se non la fai mai, l'app resta completa.

---

## 12. Legale

- Nel repo: codice, `data/srd-1.0.json`, `data/registry.json`. Nessun PDF, nessuna arte.
- L'SRD 1.0 è Public Game Content sotto DPCGL: ridistribuibile con attribuzione.
- Il manuale completo no: resta sul dispositivo dell'utente, l'art pack è personale.
- Nessun logo ufficiale. Per un marchio, usa i loghi "Daggerheart Compatible" della
  licenza: `https://darringtonpress.com/license/`
- Attribuzione SRD nel footer e nel README.
- Nessuna telemetria, nessuna analitica.

---

## 13. Rischi residui

| Rischio | Mitigazione |
|---|---|
| Glifi PUA cambiati in una revisione futura | Tripla difesa + build che fallisce, mai in produzione |
| Revisioni SRD con correzioni meccaniche | SHA-256 bloccato: la build si rompe e te ne accorgi |
| De-colonnazione fragile su certe pagine | Fixture committabili + validazione sui conteggi |
| Safari iOS cancella IndexedDB | `persist()` + export automatico + indicatore di backup |
| Scansione QR difficile schermo-fotocamera | Luminosità automatica, ECC M, quiet zone, e il file come alternativa |
| Import del manuale che esaurisce la memoria | Solo desktop, dichiarato; l'arte viaggia in art pack |
| Abbinamento sbagliato fra SRD e manuale | Schermata di riconciliazione con abbinamento manuale |
| Aspettativa che l'app "esegua" le regole | Confine dichiarato nel README e nell'onboarding |
| Richieste di homebrew (arriveranno) | `priority: 2` e ID ≥ 60000 già riservati: aggiungerlo non richiede migrazioni |