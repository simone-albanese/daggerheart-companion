# Handoff — sera del 6 settembre 2026: due PR unite, due ondate in volo

**Al 6 settembre 2026, ore 18:40 circa.** `main` = *«Merge pull request #78 …/riparazioni»*. Tutto ciò
che l'audit del 3–4 settembre aveva di S1/S2 riparabile in un giorno è in produzione, insieme alla
rampa di leggibilità. **Due ondate girano adesso** (§2) e chi riprende deve prima capire se sono
vive, poi raccoglierne il risultato. I commit si citano per oggetto; `git log -1` prima di fidarsi
di uno SHA. **UNIRE È IL DEPLOY** (`gh pr merge`); il «vai» si dà **una volta per passo**.

---

## 0. Stato

```
main                  «Merge pull request #78» (bb160a3 quando scritto; = origin/main)
                      = #76 + #77 (rampa in rem) + #78 (30 S1/S2 + sweep + 12 residui di prosa chiusi)
suite su main         206 file / 5013 test, tsc pulito, Node 24; CI verde su ogni commit esatto
rami remoti           solo main (leggibilita e riparazioni cancellati dopo il merge)
rami locali           leggibilita, riparazioni (uniti; worktree dh-wt/leggibilita e dh-wt/riparazioni
                      ancora montati, puliti: rimuovibili), backup-pre-rewrite (vecchio, non toccato),
                      fix-T1..T4 (ondata S2, §2), quattro-al-tavolo (composizione, vuoto = main),
                      consegna-2026-09-06 (questo documento)
rerere                acceso nel repo; nove risoluzioni #77×#78 in .git/rr-cache (ormai storiche)
```

Handoff precedente: `HANDOFF-2026-09-06.md` (§3 i residui chiusi, §7 le nove decisioni del
proprietario). Rapporto dell'audit: `AUDIT-2026-09-04.md`.

## 1. Cosa è successo oggi

1. I dodici residui di prosa del handoff del mattino sono stati chiusi in **tre giri** di corsie con
   verificatore (62 file di sola prosa); lezione: uno sweep di cifre ha una coda, il terzo giro si
   chiude con una lista finita (memoria «figure-sweeps-have-a-tail»).
2. Le due PR **confliggevano in nove file** (non «a righe diverse»): risoluzioni provate su un ramo
   usa-e-getta e registrate da `rerere`; #77 unita alle 17:54 UTC, #78 allineata con un commit di
   merge e unita alle 17:59 UTC.
3. Il proprietario ha preso **nove decisioni** (HANDOFF-2026-09-06.md §7): ordine delle PR, merge
   non rebase, Scene.tsx solo prosa, l'ondata dei quattro S2 visibili al tavolo, poi B2-2/B2-3/B7-1,
   S3 solo visibili, stampa 9pt con misura, `user-select: text` in lettura, validazione del JSON in
   CI, pulizia.
4. L'ondata dei quattro S2 è stata lanciata su Fable e **è morta due volte al primo messaggio**
   («safeguards flagged … [reasoning_extraction]», zero azioni; riformulare non è servito); ha
   girato su Opus per un quarto d'ora senza toccare file; poi il proprietario ha chiesto di
   **riprovarla con Fable** e di lanciare in parallelo **un secondo audit completo** con Fable.
   Entrambe sono in volo (§2).

## 2. LE DUE ONDATE IN VOLO — leggi prima di fare qualunque cosa

Journal (una riga `result` per agente finito, con il valore di ritorno intero):
`~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/5d2588f6-6f8a-403a-965a-4933cd76685e/subagents/workflows/<run>/journal.jsonl`.
Un'ondata è viva se i suoi `agent-*.jsonl` crescono (memoria «stalled-wave-is-not-a-dead-wave»):
`ls -lt <run>/agent-*.jsonl | head` e `grep -c tool_use` sui più recenti. Dopo un `/clear` i
transcript migrano nella sessione nuova (memoria «workflows-share-one-agent-pool»).

### 2a. L'ondata dei quattro S2 — run `wf_93de2361-f5f`

- Script: `~/.claude/projects/…/5d2588f6-…/workflows/scripts/four-s2-at-the-table-wf_93de2361-f5f.js`
  (sul modello di sessione, cioè Fable; se muore ancora con `[reasoning_extraction]`, rimettere
  `model: 'opus'` sugli `agent()` di fix e repair e rilanciare con `resumeFromRunId`).
- Brief: `~/.claude/projects/…/audit-harness/audit-2026-09-06/WAVE-BRIEF.md` (copia stabile).
- Corsie e worktree, tutti da `main` bb160a3: **T1** = S2-2 Combo Die del Brawler
  (`~/Documents/dh-wt/fix-T1`, ramo `fix-T1`), **T2** = S3-2 Beastform Evolved (`fix-T2`),
  **T3** = S6c-1 ATK +2d4 (`fix-T3`), **T4** = S8a-4 danno diretto/resistenza (`fix-T4`).
  Ogni corsia committa sul proprio ramo; poi un verificatore su Fable riesegue la riproduzione
  dell'audit con la correzione applicata e tolta.
- **Alla consegna** (o se è morta: `Workflow({scriptPath, resumeFromRunId: 'wf_93de2361-f5f'})`
  senza cambiare i prompt): nel worktree `~/Documents/dh-wt/quattro` (ramo `quattro-al-tavolo`,
  = main) `git merge fix-T1 fix-T2 fix-T3 fix-T4` uno per volta; `shared/types.ts` e
  `data/srd-2.0.json` sono toccati da più corsie: risolvere `types.ts` a mano, per il JSON
  prendere una parte qualunque e poi **rigenerare una volta** con `npm run build:srd` e
  `npm run build:srd -- --check`, provando con uno script che cambino solo i record attesi
  (2 beastform nuove, 1 avversario). Poi tsc, suite intera su Node 24, push, PR pronta con corpo
  nello stile di #78, CI sul commit esatto, «vai».

### 2b. Il secondo audit — run `wf_06d8b9b9-c3b`

- Script: `~/.claude/projects/…/audit-harness/audit-2026-09-06/dhc-audit-find-2026-09-06.js`
  (lo script magro del 3 settembre con i percorsi aggiornati: 23 corsie di ricerca in sola lettura,
  poi verificatori che rieseguono; i «known» non si rieseguono; S3/S4 verificati a gruppi).
- Brief: `…/audit-2026-09-06/BRIEF.md`. Contiene il **registro dei 152 rilievi del 4 settembre**:
  64 riparati (da riportare solo se REGREDITI), 88 aperti (solo con prove NUOVE, `known` valorizzato),
  e l'avviso che S2-2/S3-2/S6c-1/S8a-4 sono in riparazione in parallelo.
- Pagine del libro, stavolta **persistenti**: `…/audit-2026-09-06/srd2/pages/pNNN.txt` (224),
  `srd2-raw.txt`, `srd2-layout.txt`. Scratch delle corsie: `…/audit-2026-09-06/lanes/<lane>/`,
  verifiche in `…/verify/<id>/`.
- **Alla consegna**: il sintetizzatore scrive il rapporto (campo `reportPath` nel risultato); leggere
  il journal per i conteggi per corsia (n, confirmed, refuted); poi come il 4 settembre: rapporto in
  `docs/handoff/AUDIT-2026-09-06.md`, pagina privata, e le corsie di riparazione al «vai».
  Se è morta: `Workflow({scriptPath, resumeFromRunId: 'wf_06d8b9b9-c3b'})` rigioca dalla cache
  ogni `agent()` già consegnato.

## 3. Regole macchina confermate oggi

- **Fable può bloccare le corsie al primo messaggio** (`[reasoning_extraction]`, 3–4 s, zero
  azioni): non riformulare, cambiare modello sulle corsie e rilanciare dalla cache.
- `. ./env.sh >/dev/null 2>&1 && node -v` → v24; mai la porta 5199; un file di test alla volta
  nelle corsie, la suite intera solo a composizione; `mergeStateStatus: CLEAN` non è una CI verde,
  serve un run sull'HEAD esatto; una PR può restare senza evento `pull_request`.
- `rerere` è acceso: dopo un conflitto risolto e committato, lo stesso conflitto si risolve da solo.
- I worktree si tagliano da `main` locale con i tre symlink (`node_modules`, `.tools`, `Manuali`).

## 4. Dove sta tutto

- Harness stabile: `~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/audit-harness/audit-2026-09-04/`
  (i 152 rilievi con verdetto in `findings/`, il brief, lo script magro) e `…/audit-2026-09-06/`
  (brief, script, pagine, WAVE-BRIEF.md).
- Journal di oggi: `wf_74ba74a0-015` (residui, giro 1), `wf_5aa5940a-db4` (giro 2),
  `wf_d236a1bf-00c` (giro 3), `wf_93de2361-f5f` (ondata S2), `wf_06d8b9b9-c3b` (audit 2).
- Memorie: `daggerheart-triage-42` (punto di ripresa), `decisions-2026-09-06`,
  `figure-sweeps-have-a-tail`, `fable-safeguard-blocks-repair-lanes`.
