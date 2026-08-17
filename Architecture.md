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
| Scroll | **Ovunque**; su Play non è fisso più niente | La regola «niente scroll su Play» è caduta con `91097eb`, e con P5-5 è caduto anche il blocco fisso che l'aveva sostituita: nell'ordine di Giorgio ROLL arriva a 385 di 730 a 393×852 e a 385 di 545 a 375×667, senza pin. § 9.1 dice cosa resta fisso sulle altre schermate |
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

Attribuzione richiesta, **in fondo allo scroll di ogni schermata** e nel README:

> This product includes materials from the Daggerheart System Reference Document 1.0,
> © Critical Role, LLC, under the terms of the Darrington Press Community Gaming License.
> More information at www.daggerheart.com.
> Daggerheart Compatible. Independent community content, not affiliated with or
> endorsed by Critical Role, LLC or Darrington Press.

Questa riga diceva *«sempre visibile nel footer»*, e per due volte non è stata
vera. Prima non c'era nessun `<footer>` in tutta l'app e l'avviso viveva dentro
`EmptyState`, cioè spariva per sempre appena facevi un personaggio (P3-10).
Poi c'era, ma su quattro schermate su cinque e in tre forme diverse — striscia
fissa su Cards, Build e Settings, `marginTop: auto` dentro lo scroll GM, niente
su Play (P5-6). Adesso è una forma sola: **l'ultima cosa dentro lo scroll della
schermata, su tutte e cinque**, Play compreso. Non è «sempre visibile»: scorri
fino in fondo e c'è. La DPCGL chiede che sia *mostrata*, e una striscia fissa
costa una banda a ogni frame — cioè dà a ogni passata di layout un motivo per
toglierla, che è esattamente come Play era arrivato a non averla.
`tests/ui/attribution.test.tsx` è la guardia: chiede tutte e cinque le
schermate, e chiede che l'avviso sia dentro una regione che scorre e che dopo
non ci sia altro.

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
- Danno da incantesimo = un dado per ogni punto del tratto Spellcast (**non** la
  Proficiency: è una regola diversa); il dado e il modificatore vengono dalla
  carta e li indica il giocatore. A +0 o meno non si tira nulla, e l'app lo dice
  con la frase dell'SRD invece di tirare zero dadi
- Attacco senza armi = `[Proficiency]d4`. Il tratto no: *"Strength or Finesse
  (GM's choice)"*, quindi lo dichiara il tavolo e non l'app
- Esito del Duality Roll: successo/fallimento, con Hope o Fear, critico sui pari
- Loadout massimo 5, Recall Cost da pagare in Stress — zero durante un riposo,
  che è lo stesso `canAddToLoadout` con un flag e non un secondo tetto
- Riposi: 1d4+Tier su Ferite, Stress e slot armatura, tagliato a quanto è
  davvero segnato; Hope da Prepare (1 da solo, 2 con il gruppo); Fear del GM
  (1d4 sul breve, 1d4 + PG sul lungo); e il conteggio dei riposi brevi
  consecutivi, che è ciò che fa scattare la regola dei tre
- Conversione dell'oro (10 manciate = 1 sacca, 10 sacche = 1 forziere)
- Battle points del GM: `(3 × PG) + 2`, con i costi per ruolo
- Vincoli di livellamento: quali avanzamenti sono disponibili in quale tier
- Conversione da piedi a metri per le distanze (piede internazionale, 0,3048 m;
  arrotondata al mezzo metro sotto i dieci e al metro sopra). **L'SRD non stampa
  nessuna colonna metrica**: quel numero non è una citazione ma un conto
  dell'app, e lo schermo lo dichiara sulla riga stessa della cifra — una misura
  senza etichetta accanto a un timbro `SRD 1.0 · P.40` sarebbe l'app che cita sé
  stessa spacciandosi per il manuale. Dove l'SRD non dà un numero, l'app non ne
  inventa uno. La conversione sta sulle **righe dei range** — una forbice
  (`5-10 feet`) o una cifra sola (`30 feet`), la forbice per prima perché il
  pattern a una cifra su `20 - 40 feet` prenderebbe il 40 — e **non** sulla
  prosa attorno, che resta esattamente com'è scritta: annotare una frase citata
  vorrebbe dire riscriverla, oppure appendere una riga dell'app a un paragrafo
  dove niente dice quale delle sue cifre sia stata convertita. La legenda sullo
  schermo dichiara questo confine invece di prometterne uno più largo.

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

**Via di mezzo utile — progettata, non ancora costruita:** le feature con un
effetto numerico dichiarato dovranno ottenere un pulsante che *propone* l'azione
— "Tusks: +1d6 al danno" applica il bonus al tiro corrente se lo tocchi.
Proposta, mai automatismo. Oggi non esiste, e questa riga lo diceva al presente
come se esistesse: `rollDamage` accetta solo un `extraModifier` piatto e non ha
alcuna nozione di dadi aggiuntivi, e il vassoio dei dadi tenuti alimenta il tiro
d'attacco, non quello di danno. Sta in `BACKLOG.md` P1-1, sotto ciò che resta
fuori.

Il riposo (P1-7) è la stessa forma portata all'estremo, ed è il caso che la
rende una regola invece che un'abitudine: `takeRest` tira i dadi, quindi
l'anteprima chiama *la stessa funzione* con ogni 1d4 fissato a 1 e poi a 4 e le
passa un `Rng` che solleva un'eccezione. Il giocatore vede la forbice — "3–5
Ferite di 5" — prima di toccare qualsiasi cosa, e i dadi veri vengono tirati
solo al commit. Un'anteprima che tirasse davvero spenderebbe i dadi del tavolo
per disegnare uno schermo, e un tiro che avviene perché hai aperto una
schermata è un tiro che non puoi rifiutare. Corollario: dell'unica riga che
l'app non sa calcolare — la Fear del GM, che non è ancora stata tirata —
l'anteprima stampa il dado e non un numero.

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

**Cosa il QR non porta, per scelta.** Tre perdite, tutte documentate nell'header
di `src/transfer/codec.ts` — un elenco che deve restare di tre voci esatte,
perché una quarta non scritta da nessuna parte è il modo in cui un formato
smette di essere affidabile. Le prime due sono handle locali e nessuno le può
osservare: `Experience.id`, che è una chiave React e costerebbe 16 byte l'una su
un payload di 147, e l'ordine della coppia di tratti di un avanzamento, che le
regole trattano come insieme. La terza si vede: `consecutiveShortRests` arriva a
zero. Non è il byte — è un varint in 0..3 — è il numero di formato: portarlo
richiederebbe il formato 3, e da 3 un singolo bit ribaltato nel nibble di
versione dà 2 e 1, entrambi leggibili e uno dei due privo di checksum, mentre da
2 dà 3, 0, 6 e 10. Quella proprietà vale più di un conteggio di riposi. Il
file `.dhchar` lo porta esatto: la conseguenza è che una scheda passata via QR
arriva senza aver contato nulla, e nessuna schermata può presentare quel numero
come la storia del tavolo.

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
dallo sviluppo: `SCHEMA_VERSION` è valso 3 dal primo commit fino a P1-7.
Scrivere convertitori per loro significherebbe inventarsi una storia con cui
essere compatibili. Resta 3 anche dopo il passaggio a 4, perché 3 è esattamente
la versione dei file che sono già sui dischi delle persone.

#### Il primo scalino vero, e quanto è costato

P1-7 ha portato `SCHEMA_VERSION` da 3 a 4 aggiungendo `consecutiveShortRests`
al `Character`. È la prima volta che questa sezione viene esercitata su file
reali invece che su migrazioni sintetiche, e il conto è questo:

- **un convertitore**, `from: 3`, che scrive `consecutiveShortRests: 0`. Zero e
  non una stima: una build a schema 3 non contava, quindi l'app non sa cosa sia
  successo al tavolo, e zero è il valore che lascia la scelta ai giocatori
  invece di negare un riposo che nessuno ha registrato. Sovrascrive invece di
  conservare una chiave già presente, perché un record che si dichiara 3 e
  porta un campo di schema 4 è un record la cui intestazione è sbagliata;
- **due fixture nuove**, `v4.dhchar` e `v4.dhbackup`, prodotte facendo passare
  la `v3.dhchar` committata attraverso questa build. `v3.dhchar` e
  `v3.dhbackup` **non sono state toccate**: sono la prova che il convertitore
  funziona, e riscriverle dimostrerebbe soltanto che il codice attuale sa
  leggere il proprio output. Che non portino il campo *è* il test;
- **`DB_VERSION` fermo a 2**: il terzo requisito è condizionale — «se cambia
  anche la forma del database» — e aggiungere un campo a un record non cambia
  né gli object store né gli indici;
- **`CODEC_VERSION` fermo a 2**: il campo resta fuori dal QR (§5.3);
- **lo stamp del dataset**, `data/srd-1.0.json`, portato a 4. `Dataset` arriva
  all'app con un cast `as unknown as Dataset`, quindi uno stamp vecchio non
  produce alcun errore di compilazione: produce solo un tipo che afferma un
  numero e una schermata About che ne stampa un altro. Il test che lo tiene
  fermo sta in `tests/store/migrations.test.ts`.

Conseguenza operativa, perché non venga scoperta sul campo: al primo avvio dopo
l'aggiornamento `readLibrary()` converte ogni personaggio e `init()` lo
riprogramma attraverso il debounce di 400 ms, quindi l'intera libreria viene
riscritta una volta. Questo sposta anche l'impronta `count:maxUpdatedAt` di
`runBackup`, che produce un `.dhbackup` fresco. Innocuo, ma vuol dire che
l'avvio che non deve fallire è proprio il primo dopo il passaggio.

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

**L'unica eccezione, e perché è una sola.** P5-3 ha allargato `GmRegion` con
`'reference'` senza alzare `CAMPAIGN_SCHEMA_VERSION`. Sulla carta è proprio ciò
che questa sezione vieta: una build vecchia legge un record che dice
`region: 'reference'`, `readBoard` non riconosce il valore e ripiega su
`'encounter'`, e il debounce di 400 ms riscrive il record con la sostituzione —
senza quarantena e senza una parola. La differenza è *cosa* viene sovrascritto:
«quale strumento era aperto quando hai chiuso l'app», un valore che la build
vecchia avrebbe comunque rimpiazzato al primo strumento aperto, che non porta
sessione, campagna né tiri. Ogni altro campo del record sopravvive intatto, e il
fallback che lo rende sopravvivibile è esattamente il convertitore che altrimenti
sarebbe stato obbligatorio. Vale per questo campo e per nessun altro: un campo
che porta *dati* non può essere allargato così.

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
  schemaVersion: 4;
  layers: Layer[];
  domains: Domain[]; domainCards: DomainCard[];
  classes: CharClass[]; subclasses: Subclass[]; beastforms: Beastform[];
  ancestries: Ancestry[]; communities: Community[];
  weapons: Weapon[]; armors: Armor[]; loot: Item[]; consumables: Item[];
  adversaries: Adversary[]; environments: Environment[];
  rules: RulesSection[];                // testo e tabelle, con `sourcePage`
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
  id: string; schemaVersion: 4;
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
  consecutiveShortRests: number;   // riposi brevi di fila, azzerati da uno lungo
  unresolvedRefs?: number[];
}
```

Il blocco `Character` qui sopra è uno **schizzo della forma**, non l'interfaccia
verbatim: `shared/types.ts` è la fonte. Alcuni campi sono stati normalizzati da
allora — `evasion` e `thresholds` esistono come `evasionOverride` e
`thresholdOverride`, `activeWeapons` come due riferimenti separati, `proficiency`
è derivata e non salvata — e non vanno riconciliati leggendo di qui.

**Regola d'oro**: il personaggio salva solo `Ref` e valori, mai copie dei contenuti.
Aggiornare il dataset non tocca i personaggi.

**Nomi uguali** (P5-1(b)). Due personaggi collidono quando coincide il nome
*come lo pronuncia l'app*, non la stringa salvata: `nameKey` in
`src/store/merge.ts` toglie gli spazi ai bordi, riduce a uno le sequenze di
spazi, ignora maiuscole e minuscole, e legge la stringa vuota come `Unnamed` —
la parola che tredici punti di visualizzazione già stampano al posto di un nome
mancante. La definizione è una sola ed è privata; `freeName` e `nameHolder` sono
i due modi di interrogarla.

La regola è applicata in **due punti, non ovunque**: il controllo di rinomina
(`src/ui/shared/RenameField.tsx`, raggiunto dalla scheda in Play e dal form in
Build) e la copia *keep-both* di `duplicateFor`. **Non è un invariante del
device.** Restano scoperte la creazione (`create()` in `state.ts`, che non
confronta nulla) e l'import di un personaggio con `id` nuovo (`importCharacters`
decide su `id` e scrive senza guardare i nomi): due `Ilya` possono ancora
esistere sullo stesso telefono passando da quelle porte — vedi `BACKLOG.md`
P5-1(c).

Il record può contenere `''`. Nessuna scrittura mette mai la parola `Unnamed`
sulla scheda: `Unnamed` è ciò che lo schermo stampa, non ciò che il file
contiene.

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
| **Play** (giocatore) | **Tutto, in una colonna sola: non è fisso niente** | La regola «nessuno scroll» è caduta con `91097eb`; il blocco fisso che l'aveva sostituita è caduto con P5-5. Il contenuto non è più «6 tratti e 4 contatori» ma la scheda intera, che non ci sta — e con i contatori e le soglie in cima e le Experience in una tendina, ROLL sta sopra la piega senza essere fissato a **entrambe** le larghezze di riferimento: 385 su 730 a 393×852, 385 su 545 a 375×667 |
| **Cards** | Nella griglia | 189 carte, ovvio |
| **Build** | Nel pannello del passo | Wizard a step, intestazione fissa |
| **GM** | **Nella lista della serata** | Fisse la barra in alto — MENU col nome della campagna, Fear, countdown primario — e `GmBar` in basso, ADD/SHOW/SAVE al posto della tab bar. Scorre la lista; una riga si apre in posto. Finché una scrittura sta fallendo è fisso anche l'avviso che lo dice, fra le due barre: ~143px dei 551 della lista, e c'è solo mentre è vero |

**In fondo a ognuno di quei cinque scroll c'è l'avviso di licenza, e non c'è
niente dopo** (P5-6). Non è chrome: è l'ultimo blocco del contenuto, un filetto
e del testo attenuato. Su Play sta sotto l'ultima tendina, quindi *dopo* i 697px
che la scheda misura chiusa, e non entra in nessuno dei due totali del budget —
`playSheet.test.tsx` conta dodici figli della colonna e chiede che il
dodicesimo sia un `<footer>` e sia l'ultimo, perché «fuori dal budget» deve
restare una frase su quell'elemento e non un buco in cui infilare altro.
Misurato in Chrome a 393×852 sono 126px, che prima erano una striscia fissa e
adesso sono 126px oltre la fine della pagina.

`env(safe-area-inset-bottom)` lo paga **una cosa sola per schermata**, quella
davvero ultima nella finestra: `TabBar` sul telefono, `GmBar` nella sezione GM,
la nav del wizard e quella del level-up su Build sopra i 720px, e l'avviso stesso
dove non c'è nessuna delle tre. Pagato due volte lascia 34px di pannello vuoto,
mai lascia l'ultima riga sotto l'home indicator. Le tre barre lo dichiarano come
`calc(0px + env(...))`: il parser CSS di jsdom butta via un `env()` nudo, quindi
finché era nudo nessun test poteva leggerlo — dentro `calc()` sopravvive, e
`attribution.test.tsx` conta i pagatori su ogni schermata a due larghezze.
| **Strumenti GM** (Encounter, Scene, Bestiary, Party, Countdown, Riferimento) | Nel corpo | Non sono più regioni di primo livello: si aprono *sopra* la lista, a tutta finestra, e ognuno tiene lo scroll che aveva — il Riferimento incluso, che è l'unico ad arrivare da MENU e non da una riga |

Il vincolo cade dove è aritmeticamente impossibile: Adult Flickerfly ha sette feature,
Battle Box ne ha una con una tabella di sei voci. Tre avversari di Tier 3 più un
ambiente e due countdown non entrano in 390×844 a corpo leggibile. Fingere di sì
produce testo a 9px, che a tavolo non si legge.

**Ed è caduto anche su Play** (`91097eb`), che è la riga su cui questa tabella è
stata sbagliata più a lungo. "Nessuno" descriveva una schermata con sei tratti e
quattro contatori; da quando Play *è* la scheda — identità, difese, verbi dei
tratti, equipaggiamento, loadout, vault, oro, condizioni — il contenuto non ci
sta e non ci sta a nessuna larghezza.

**E poi è caduto anche il blocco fisso** (P5-5). Per un po' restava fisso ciò che
un pollice tocca a ogni azione — la riga dei tratti e il blocco del tiro, con un
pavimento di 88px sotto la parte che scorre. Quel pin comprava una portata che
adesso la fornisce l'ordine: con i quattro contatori e le soglie in cima, dove il
messaggio di Giorgio li mette, con le Experience dietro una tendina sotto ROLL e
senza più la riga MODIFIERS permanente, e da P5-6 con i quattro contatori a
griglia 2×2 (94px invece di 194) e la casella del danno dentro la banda delle
difese (che non cresce di un pixel), il bordo inferiore di ROLL cade a **385
di 730** px di colonna utile a 393×852 (852 meno 53 di header, 61 di tab bar, 8
di padding) e a **385 di 545** a 375×667. Fissato, ROLL stava 8px sopra un
bersaglio di 98×60 che porta via dalla schermata; libero, ne sta 353 sopra.
Non è solo aritmetica dichiarata: misurato in Chrome via `preview.html` col
fixture `playedCharacter`, ogni sezione viene disegnata esattamente all'altezza
che dichiara e ROLL finisce a 385.
Niente su Play è fisso, non c'è più uno scroller interno e non c'è più il
pavimento, che esisteva solo perché un blocco fisso poteva affamare lo scroll.

L'ordine è quello del messaggio: identità, le quattro difese **con la casella
del danno come quinta cella** — sta accanto alle due soglie contro cui la si
legge, e prima stampava `8/16` in 10px accanto a sé perché le soglie le serviva
e non le vedeva — i quattro contatori **due per riga**, i tratti, ROLL, e poi le
tendine: armi e armature, Experience, inventario (con l'oro sull'intestazione),
carte (col vault dentro), riposo e per ultima la lineage, che apre coi domini.
Ogni tendina parte chiusa, perché il conto qui sopra è fatto a tendine chiuse e
un default che lo contraddicesse renderebbe il numero una finzione.

**Le condizioni non sono più una riga di quell'elenco** (P5-8). Non si disegna
niente per dire che non c'è niente: la striscia compare solo quando qualcosa è
attivo, nel posto che aveva sempre avuto, e la porta permanente è
`ConditionsControl` — 44×44 in fondo alla riga della classe dell'identità,
accanto a RENAME, in una banda che RENAME tiene già aperta a 44, quindi costa
alla colonna esattamente zero. Con la scheda pulita il controllo è vuoto e legge
`— COND`; con qualcosa attivo si riempie, conta quante sono e il suo nome
accessibile le elenca tutte, Vulnerable derivato dallo Stress pieno incluso. La
regola fondante vale anche qui: una condizione è uno stato che il GM ti ha
inflitto, quindi l'unica cosa che questa forma non può fare è tacerne una.
Sul desktop non cambia niente — `Vitals` monta `ActiveConditions` senza prop,
la striscia è permanente e la sua chip `+ NAME` resta l'unica porta.

Nella banda le quattro celle non sono più larghe uguali: `EVASION` a `.t-meta`
misura 47.75px, quindi quattro celle uguali più la casella non ci stanno neanche
a 393 (386.29 contro 369). Dimensionate al contenuto i quattro numeri fanno
230.08 e la casella prende il resto — 114.92 a 393, 96.92 a 375, contro i 91.29
che le servono. Mentre c'è un numero nella casella il verdetto occupa una seconda
riga larga tutta la banda e la banda passa a 108: è l'unico stato di questa
schermata che sposta ciò che ha sotto, ed è lo stato in cui ciò che ha sotto non
è ciò che stai guardando.

L'aritmetica non è prosa: sta in `playSheet.test.tsx`, nel describe «the budget
the pin came off for», che somma le altezze *dichiarate* — jsdom non ha motore di
layout e il test dice da sé cosa può e cosa non può dimostrare. Dice anche le
cifre che non fanno bella figura. Il margine sotto ROLL a 375×667 era di 10px ed
è di **160**, e **nessuno** degli stati che il conto non vede se lo mangia: dadi
digitati (+68), un compagno (+50), un Beastform (+52), i 34px dell'inset
dell'home indicator, e i pip, che sono il più caro dei cinque a **+100**. I pip
restano a tutta larghezza — una traccia da 12 caselle in una cella da 172px
andrebbe a capo sotto il pavimento WCAG di 24px — quindi il blocco dei contatori
è 94 a numeri e 194 a pip, misurato in Chrome col fixture a entrambe le
larghezze, e non va a capo niente: con i pip ROLL cade a 485 sui 545 della
colonna piccola, con 60px di avanzo. Questo repo ha scritto **+149 su un
«base 144»** in quattro documenti per due passate; erano tutti e due inventati —
il termine del budget è 2×44 + 6 = 94 — e la conclusione che ne discendeva era
sbagliata anche di segno.

**E la scheda piegata intera ci sta: 697 contro 730 a 393×852, con 33px di
avanzo.** È la prima volta, ed è la condizione che la decisione 1 di P5-5 aveva
messo sulla rimozione del pin: 899 con P5-5 (169 di troppo), 749 con P5-6 (19 di
troppo), 697 con P5-8. A 744×1133 ci sta con 375px di avanzo. A 375×667 è ancora
**152px di troppo**, dove erano 204, e nessuna disposizione di questa scheda lo
chiude: 152 sono tre intestazioni di tendina e le tendine sono sei.

Gli ultimi 52 sono venuti dalle condizioni e da nient'altro. I tre risparmi di
P5-6 erano stimati 198 e valevano 150: la griglia 2×2 vale i 100 previsti, la
casella del danno 50 invece di 46 perché la banda non è dovuta crescere, e
mettere le condizioni dietro una tendina vale **zero** — una `Disclosure` chiusa
è 44 più gli 8 di gap della colonna, cioè esattamente ciò che era la striscia.
L'unica forma che toglie quei 52 è quella della decisione 6, e P5-8 l'ha presa.
Il test lo dice con dei numeri invece che con un silenzio, e nessuno di quei
numeri è comprato stringendo un gap.

**Una cosa che non ci sta ancora, detta e non arrotondata.** Un iPhone con home
indicator installato come PWA paga `env(safe-area-inset-bottom)`, 34px, che
questo repo ha sempre trattato come 0: la colonna a 393×852 passa da 730 a 696 e
i 697 diventano **un pixel di troppo**. «Tutta la scheda in una volta sola» è
vera nel browser su quel telefono e falsa per un capello nell'app installata, e
l'inset sul telefono del proprietario non l'ha ancora misurato nessuno.

**Dov'è ROLL sul vetro, e quanto costa.** Misurato in Chrome col fixture, tendine
chiuse, in cima allo scroll: la riga di ROLL va da y372 a y438 a entrambe le
larghezze di riferimento, perché tutto ciò che le sta sopra è alto uguale. A
393×852 sono **414–480px sopra il bordo inferiore** e 353 sopra la tab bar; a
375×667 sono 229–295 sopra il bordo. Il commento in `Play.tsx` ha portato per due
passate le coordinate di prima della griglia (y522-588, «264–330px dal bordo,
*dentro* una spazzata del pollice di ~330px») e con i numeri si è ribaltata la
conclusione: a 414–480 ROLL è **fuori** da quell'arco sul telefono grande, e
dentro su quello piccolo. È un costo vero della rimozione del pin ed è scritto
come tale; quello che compra è la scheda intera leggibile in un colpo e 353px di
distanza da un controllo che porta via dalla schermata a metà turno. La colonna
scorre, quindi la portata al momento del tiro se la sceglie il giocatore, mentre
gli 88px di chrome fisso non se li sceglieva nessuno — per questo il pin non
torna. `playSheet.test.tsx`, «says where on the glass ROLL is drawn», ricava
tutti e sei quei numeri dalla tabella del budget e dalle tre costanti della
shell, così non possono più invecchiare di 150px in silenzio.

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

**La casa del GM è la lista della serata** (P5-2). Fino a `eab26d8` questa
schermata era una striscia di cinque tab — encounter, scene, party, bestiary,
countdown — e ognuna funzionava; quello che nessuna era è *la serata*. Il record
della campagna porta una `session: SessionItem[]` da quando esistono le
campagne e nessuno l'aveva mai disegnata. Ora la lista **è** la schermata: le
righe si aprono in posto, e i primi cinque strumenti qui sotto sono ciò che apre
una riga (o, per Fear e countdown, il numero in cima), sopra la lista, dentro
`GmSheet`. Il sesto, il Riferimento, è l'unico che nessuna riga può contenere e
arriva da MENU. Uno strumento chiuso è **smontato**, mai nascosto: lo scanner
della PartyBoard apre la fotocamera in un effetto e la chiude allo smontaggio.

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
- **Riferimento** (P5-3): le tabelle che il GM cerca a mano, in sette temi —
  benchmark per tier (avversari e ambienti), benchmark di Difficoltà, Fear per
  tipo di scena, avanzamento dei countdown dinamici, distanze, mosse e principi
  del GM, Experience per gli avversari. **Ogni parola è letta da
  `data/srd-1.0.json` al momento del disegno** e il timbro `SRD 1.0 · P.NN` sta
  accanto alla singola tabella, mai in cima al tema: il tema *improvvisa* mette
  insieme p.73 e p.102, e un timbro solo stamperebbe un numero di pagina sopra
  un testo che non ci sta. Non è uno strumento disattivabile e non apre da una
  riga della sessione: si apre da **MENU**, perché cercare una regola ferma il
  gioco, capita una o due volte a sera e si legge invece di premerlo. Le due
  parti che servono *durante* un gesto sono ripiegate accanto al controllo a cui
  appartengono — la guida sul Fear sotto i dodici bersagli della board, la
  tabella di avanzamento sotto la riga di un countdown dinamico — chiuse finché
  non le si chiede, e disegnate dagli stessi componenti: una piega è una seconda
  porta, mai una seconda copia. Da cui una regola che vale per ogni componente
  con due porte: **non descrive lo schermo in cui non si trova**. Lo stato vuoto
  della guida sul Fear dice «il contatore qui sopra funziona ancora» solo sulla
  board, dove il contatore c'è; quello della tabella di avanzamento manda al
  `−`/`+` solo sulla riga che li ha; e la nota che spiega la colonna marcata nei
  benchmark si disegna solo se una colonna è stata marcata davvero — il tier si
  legge dall'intestazione e uno strato che non ci mette un numero non ne marca
  nessuna. Sono `countdown`, `besidePool` e `marked`: tre condizioni per tre
  frasi, invece di tre frasi sempre vere a metà.

**La barra in basso, dentro la sezione GM, prende il posto della tab bar**:
`App.tsx` non disegna `TabBar` su `screen === 'gm'`, e la via d'uscita verso
Play, Cards e Build sta in **MENU**, che è tutta la prima riga della barra in
alto — il nome della campagna è dentro il bottone, non accanto. Le due metà
arrivano insieme di proposito: togliere la tab bar prima che MENU esista
lascerebbe un telefono dentro la sezione GM con il solo bottone SETTINGS
dell'header. MENU **non** porta Settings, che è già nell'header su ogni
schermata.

Anche l'avviso di licenza si sposta con loro, e **non se ne va**: entra nello
scroll della lista invece di restare una striscia fissa sopra la barra. Sono
126px su un telefono, ma un avviso che la DPCGL chiede di *mostrare* non è ciò
che paga un layout. `LicenceFooter` è un modulo suo — il chunk GM è importato
*da* `App.tsx`, quindi importarlo al contrario sarebbe un ciclo.

Questa schermata è stata la prima a farlo e l'aveva fatto a metà: `marginTop:
auto` metteva l'avviso in fondo alla *regione* e non dopo il contenuto, quindi
una lista più corta del vetro — cioè ogni lista all'inizio di una serata —
pagava la stessa banda della striscia fissa che avrebbe dovuto migliorare. È
quella la schermata dello screenshot dell'owner. Con P5-6 l'`auto` non c'è più
qui e non c'è da nessuna parte, e le altre quattro sono entrate nel proprio
scroll invece del contrario: su una serata vuota sono 236px che tornano a essere
lista.

Il prop non è più `bottomMost` ma `pinnedBelow`, ed è l'inverso di quello che
sembra: `bottomMost` chiedeva a ogni chiamante la *risposta* — sicuro con due
chiamanti, una trappola con sette — mentre `pinnedBelow` chiede a ognuno l'unico
*fatto* che ha solo lui, «sotto questo scroll c'è una mia barra». L'aritmetica
sta in un posto solo. Qui è `true` a ogni larghezza, perché `GmBar` è sotto a
ogni larghezza ed è lei a pagare `env(safe-area-inset-bottom)`.

I verbi della barra sono **ADD**, **SHOW**, **SAVE**. Non sono destinazioni,
sono verbi — `aria-haspopup="dialog"`
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
- **MENU** porta la via d'uscita, le campagne — cambia, nuova, rinomina,
  rimuovi dietro due tap — e il blocco «questo dispositivo»: `notices`,
  `quarantined` e lo stato prima che il database abbia risposto, tre campi che
  lo store portava da sempre e che nessuno aveva mai disegnato. Rinominare è
  offerto **solo** sulla campagna aperta, con la ragione scritta accanto:
  `patchCampaign` programma una scrittura solo per l'id attivo e `writeActive`
  raccoglie solo quel record, quindi un rename su un'altra riga sembrerebbe
  giusto fino al reload. Un nome vuoto è **rifiutato a parole**, non riscritto
  in silenzio. La lista non si riordina mentre è aperta: la campagna attiva
  viene scritta ogni 400 ms, e riordinare per `updatedAt` in render sposterebbe
  in cima proprio quella riga, sotto il pollice.

**La sezione intera si spegne da Settings, e con lei i due strumenti che nessuna
riga apre.** `gmSection`, `gmBestiary` e `gmPartyBoard` stanno su `Prefs`,
quindi in `localStorage`: sono fatti su *questo dispositivo*, non sul record,
nessuno schema si muove e §6.1 non viene toccata. La parte che conta non è
l'interruttore ma cosa resta dietro, e la regola è una funzione sola —
`allowedScreen(prefs, screen)`, che sostituisce `'gm'` con `'play'` quando la
sezione è spenta. La usano in tre punti, per tre ragioni diverse:
`openingScreen` all'avvio (un `lastScreen: 'gm'` salvato prima che la sezione
venisse spenta non riapre una schermata senza tab, e la regola più vecchia —
libreria vuota → Build — resta la prima), `App.tsx` a ogni render (`setScreen`
accetta tutti e cinque i valori, e la sezione può spegnersi a metà sessione:
senza questo resterebbero header, barra e 700px di niente in mezzo), e le due
navigazioni — `TabBar` e `Header` — che chiedono «lo shell la disegnerebbe?»
invece di controllare la preferenza per conto loro. Filtrare solo la tab bar
avrebbe lasciato un bottone GM vivo su ogni portatile.

Gli strumenti disattivabili sono **due su sei**, ed è una riduzione scritta,
non un'omissione. Encounter builder e scene runner sono il *contenuto di una
riga*: un interruttore che li nascondesse renderebbe inapribile una riga già
scritta. Fear e countdown si aprono dal numero in cima e non da una riga, ma il
Fear non è opzionale a un tavolo Daggerheart — la board dietro quel numero è
l'unico posto dove lo si imposta di netto invece che un punto per volta. Il
Riferimento è l'SRD che l'app già spedisce e già cita sulle schermate del
giocatore, dietro un menù che non ha interruttori: `gmSection` porta via tutto
insieme a lui.
`BACKLOG.md` porta entrambe le ragioni. Con i due strumenti spenti **SHOW esce
dalla barra** e i 131px per verbo diventano 196 su un telefono da 393; con uno
solo, la sheet si riduce a quella metà e il dialog prende il *suo* nome invece
di annunciarsi come entrambi; e la scena vuota smette di offrire il bestiary —
bottone e frase, perché una frase che nomina uno strumento che non c'è è lo
stesso difetto un gradino più piano.

**Una scrittura che non è arrivata si legge sulla schermata dov'è successa.**
`writeError` dello store è una striscia `role="alert"` fra la barra in alto e la
lista, con le parole dello store e un TRY AGAIN che chiama `flushGm` — ogni
percorso che imposta quel campo lascia la campagna `dirty` apposta, quindi il
bottone ha sempre qualcosa da scrivere. Non si chiude: un avviso archiviato su
lavoro non salvato è esattamente la falsa rassicurazione che questa app non può
dare. SAVE continua a mostrarlo, e non è un doppione: le due frasi vengono dallo
stesso campo, e una sheet che dicesse «già su questo dispositivo» mentre la
striscia sotto dice il contrario sarebbe peggio di tutte e due.

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
- Attribuzione SRD in fondo allo scroll di ogni schermata — le cinque, Play
  compreso — e nel README. Un solo literal, in `CompatibleMark.tsx::ATTRIBUTION`;
  `attribution.test.tsx` fallisce se ne compare un secondo in `src/`. Vedi §2.
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