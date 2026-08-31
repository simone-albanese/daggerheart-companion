# Handoff — l'ondata SRD 2, dove si è fermata

**Le decisioni stanno in `DECISIONI-SRD-2-2026-08-31.md`. Questo dice dove siamo e cosa morde.**
I commit di questo ramo si citano **per oggetto, mai per SHA**: il ramo si ribasa e gli hash muoiono.

---

## 0. Stato, misurato

Ramo `srd-2`, cutato da `main` dopo l'unione della #65. **Undici commit, spinto, nessuna PR aperta.**

```
npx tsc --noEmit              0 errori
npx vitest run                159 file / 4214 test, 0 falliti, 0 saltati
npm run build:srd -- --check  data/srd-1.0.json matches the source
```

**`data/srd-1.0.json` è byte-identico dall'inizio dell'ondata a qui.** È la sola prova che tutto
ciò che è stato fatto è un *allargamento* e non una riscrittura: ogni parser è stato cambiato per
leggere anche il libro nuovo, e il vecchio produce ancora esattamente gli stessi byte. **Chi
continua non deve perdere questa proprietà**: si verifica con quel comando, a ogni passo.

## 1. Come si esegue la pipeline sul libro nuovo

```
npm run build:srd -- --check --pdf Manuali/DH_SRD_2_2026_08_25.pdf
```

`--pdf` sceglie fra i libri **noti** (`BOOKS` in `tools/loadSrd.ts`) e **non** salta il lucchetto
sull'hash. `--check` non scrive nulla.

## 2. Dove si ferma oggi

```
ParseError: no Name/Trait/Range/Damage/Burden/Feature table on folio 45
```

**Superano già:** domini (10), carte di dominio (210), stirpi (24), comunità (15).
**Restano:** equipment, loot, beastforms, adversaries, environments, classes (collegato ma non
ancora esercitato oltre l'equipaggiamento).

## 3. Le tre lezioni che si pagano di nuovo se si dimenticano

1. **Il libro va misurato, non ragionato.** Ogni singolo difetto di questa ondata è stato trovato
   eseguendo la pipeline o guardando la pagina, mai leggendo il codice. La forma di Dread, i tre
   glifi, il banner che attraversa la pagina, la famiglia Elemental Kin: tutti.
2. **Una build verde non è un output giusto.** `Elemental Kin` è finito su venti stirpi senza che
   nulla esplodesse; l'ha trovato un probe che stampava il *risultato*. Dopo ogni parser: stampare
   i conteggi e qualche record, non fidarsi dell'assenza di eccezioni.
3. **`DOMAINS` è ciò che il codice sa rappresentare, `ds.domains` è ciò che quel libro stampa.**
   Confonderle ha rotto due parser su un libro che leggono perfettamente. Vale per ogni collezione.

## 4. Trappole già pagate, che aspettano il prossimo

- **Un capitolo finisce sulla pagina in cui comincia il successivo.** `sectionRange` sovrappone di
  una pagina apposta e restituisce `next`; usare **`sliceSection`, che taglia a entrambi i capi**.
  Tagliare solo la coda ha fatto leggere `Simiah` alle comunità.
- **`sectionRange` non basta sempre**: `loot.ts` copre Loot *e* Consumables, quindi vuole
  `rangeBetween` con due estremi nominati. E nell'SRD 2 la voce si chiama **`Loot & Items`** —
  è l'unica rinomina fra i due indici, e `folioOf` accetta alternative apposta.
- **Beastforms, adversaries ed environments non hanno una voce d'indice propria.** Stanno dentro
  `Classes` e `Adversaries and Environments`. Serviranno àncore di contenuto, non di indice.
- **I glifi PUA fermano la build da soli** se ne compare uno nuovo. È il comportamento voluto:
  derivarne il valore **rendendo la pagina**, mai per continuazione della serie.

## 5. Rilievi verificati e NON riparati — non perderli

1. **Il formato di trasporto perde Dread in silenzio.** Un dispositivo con nove domini che riceve
   un QR con dieci mette `multiclassDomain: null` e non dice nulla; rilanciare la scheda avanti e
   indietro la perde **definitivamente**. Il dominio è **l'unico campo sul filo senza una
   rappresentazione "irrisolto"**: ogni `Ref` sconosciuto viene parcheggiato e segnalato, un indice
   di dominio sconosciuto diventa `null`. `CODEC_VERSION` non si muove aggiungendo un dominio,
   quindi nessun cancello di versione scatta. **È una modifica al codec e una decisione a sé.**
2. **La striscia di chip dei domini misura 853px a nove e 930px a dieci: +77px**, e compra una riga
   in più in due fasce di viewport. Va misurata sullo schermo, non dedotta.
3. **Le 9 armi tolte dall'SRD 2** restano una decisione **rinviata** (§3 delle decisioni).

## 6. Il prossimo passo, e uno che va fatto prima di credere ai conteggi

`tools/validate.ts` fissa **nove conteggi esatti come errori fatali**, tutti numeri dell'SRD 1.
Rifiuterà l'SRD 2 in partenza. Vanno separati come sono stati separati i domini: quanto un dataset
*deve* contenere dipende dal libro, e il modo giusto è farlo dire al libro o parametrizzarlo per
revisione — **non allentare il cancello**.

E **86 file di test su 159 leggono il dataset**, con **208 record fissati per nome**. Quando si
scambierà il dataset, la decisione già presa è: **ri-puntare sul successore con una nota**, mai
cancellare l'asserzione.
