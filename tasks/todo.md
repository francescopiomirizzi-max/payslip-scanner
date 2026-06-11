# Todo — Serata UX/estetica 2026-06-10

Piano approvato in conversazione: cross-link funzionali sul dettaglio Riposi + bundle N+S dashboard.
(La sessione precedente — UX fixes 2026-06-09, otto giri — è completata e committata; v. git history.)

- [x] 0. Commit del diff pendente su RiposiPraticaDetail (servLabel + turni alfanumerici) → 177f359
- [x] 1. Click su violazione → apre il mese corrispondente nel tab Prospetto → e9236dc
- [x] 2. Barre "Andamento per anno" cliccabili → filtrano l'elenco violazioni (toggle + chip per azzerare) → e9236dc
- [x] 3. Frecce mese precedente/successivo in MeseFocus (con scavalco anno se esiste) → e9236dc
- [x] 4. N — glass shimmer on hover sulle 3 card stat della DashboardPage → a3077b5
- [x] 5. S — cursor highlight (radial gradient) nella hero/home della DashboardPage → a3077b5
- [x] 6. Test verdi + tsc + build, poi commit per blocchi logici

## Secondo giro (feedback utente)

- [x] 7. S RIMOSSO — il glow cursor-following non piace all'utente (hook eliminato,
      backlog aggiornato: non riproporre la famiglia cursor-following, K incluso)
- [x] 8. Inizio calcoli in BLOCCO dalla barra di selezione: select 2008-2025 +
      Applica, stessa doppia scrittura del dettaglio (startClaimYear via
      updateWorkerById → auto-sync debounced + mirror localStorage startYear_<id>);
      toast con promemoria anno precedente completo

## Terzo giro — loghi aziendali (solo UI, mai nei documenti)

- [x] 9. Asset: SVG ufficiali da Wikimedia Commons in public/logos/ — RFI,
      Trenitalia (viewBox aggiunto a mano, il file ne era privo), Mercitalia Rail,
      Elior. Clean Service NON ha logo pubblico affidabile → fallback.
- [x] 10. Infrastruttura: getCompanyLogo() in config/profiles.ts (mappa estendibile,
      null per Clean Service/custom) + componente ui/CompanyLogo (pastiglia bianca,
      necessaria in dark e su sfondi colorati; null se senza logo → il chiamante
      tiene il fallback colorato esistente).
- [x] 11. Superfici (scelte dall'utente, tutte e 4): WorkerCard (badge → logo,
      suffisso Viag./Mag. conservato per Elior), filtri azienda + chips footer
      card Pratiche (dot+nome → logo), header dettaglio, colonna lavoratori Archivio.
- [x] 12. Verifica visiva: preview Chrome headless dei loghi a 12/14/16px su
      pastiglia, light+dark — leggibili. tsc pulito · build ok · 171 test verdi.

## Review

- Verifica: `npx tsc --noEmit` pulito · `vite build` ok · **171 test verdi**.
- Scelte tecniche degne di nota:
  - keyframe `card-sweep` dedicato invece di riusare `shimmer`: il nome era già
    doppiamente definito (index.css background-position vs tailwind.config translateX)
    e il transform del keyframe avrebbe schiacciato lo skew — risolto con wrapper
    che trasla + figlio skewato; animazione SOLO in :hover (niente GPU a riposo).
  - `useMouseGlow`: CSS custom properties + requestAnimationFrame, zero re-render React.
  - cross-link violazione→mese: `v.inizio` è ISO, `year` state è 'yyyy' da dd/mm/yyyy —
    combaciano via slice(0,4).
- ux-backlog.md aggiornato (N+S spuntati); prossimi del bundle: E (tilt 3D), O (skeleton).
- NON deployato (batching Netlify, deploy fissato 2026-06-17).

# Upload massivo parallelo (2026-06-11)

Obiettivo: batch 2008–2025 in un colpo solo, non presidiato, senza cambiare
NIENTE della logica di estrazione/applicazione dati (Titanium V3 intatto).

- [x] 1. usePayslipUpload: pool di concorrenza 3 (una per chiave API) al posto
      del for sequenziale; via la pausa fissa 1500ms; progresso = completati.
      Il corpo per-file resta IDENTICO (solo estratto in funzione): le mutazioni
      su currentAnni sono in blocchi sincroni → nessuna race su findIndex/push.
- [x] 2. Flush incrementale: setMonthlyInputs con snapshot deep-copy ogni 12
      buste completate (stessa cadenza di scritture Supabase del flusso manuale
      attuale, via autosave debounced 300ms) — un crash a metà non perde tutto.
- [x] 3. _rateLimit: bucket IP 60→300 / 5 min (il batch desktop non manda
      sessionId: conta solo l'IP; 216 file + retry a pool 3 ≈ 75 req/5min).
      Bucket sessione QR resta 30/5min.
- [x] 4. Verifica: tsc --noEmit pulito · vite build ok · **173 test verdi** ·
      diff riletto a freddo.

## Review (upload parallelo)

- Il corpo per-file è IDENTICO al precedente (solo estratto in `processFile`,
  `continue`→`return`): zero modifiche alla logica Titanium V3 / merge codici.
- Sicurezza concorrenza: dopo l'ultimo `await` (fetch) l'applicazione del
  risultato a `currentAnni` è un unico blocco sincrono → niente race su
  findIndex/push anche con 3 file in volo.
- Progresso island = buste completate (in parallelo "file corrente" non ha
  più senso); flush ogni 12 completate ma MAI sull'ultima (il flush finale
  c'è già, si evita il doppio autosave).
- Resa attesa: anno da ~3 min → ~1 min; archivio intero 2008-2025 caricabile
  in un colpo (~15 min non presidiati) grazie al bucket IP 300/5min.
- NON deployato (batching Netlify, deploy ufficiale 2026-06-18).
