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
