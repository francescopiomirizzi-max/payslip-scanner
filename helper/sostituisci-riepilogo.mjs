#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// SOSTITUISCI RIEPILOGO — helper locale (nessun deploy, gira solo sul Mac)
//
// Sostituisce il vecchio "Riepilogo_somme_richieste_*.pdf" nelle cartelle
// "conteggi/" dei lavoratori conclusi con quello NUOVO generato dal tasto
// "Stampa" della pagina report (la tabella fedele al report).
//
// FLUSSO: sul sito apri il report del lavoratore → "Stampa" → "Salva come PDF".
// Il file esce già col nome giusto (Riepilogo_somme_richieste_<Cognome>_<Nome>.pdf,
// perché la stampa imposta quel titolo) e finisce nei Download. Lancia questo
// helper: prende quei PDF e li mette al posto del vecchio nella cartella giusta.
//
// ABBINAMENTO (mai un file nel posto sbagliato):
//   1. nome file IDENTICO a un Riepilogo già presente in una sola "conteggi/"
//      → sovrascrive lì (caso normale: il vecchio e il nuovo hanno lo stesso nome).
//   2. altrimenti match sul nome lavoratore normalizzato (ignora spazi/maiuscole/
//      accenti/ordine), se UNA sola cartella corrisponde → mette lì.
//   3. 0 o >1 corrispondenze → sposta in "_DA SMISTARE/" sul Desktop e lo segnala.
// Tocca SOLO il Riepilogo: Conteggi PDF, buste paga e Relazione non si toccano.
// I PDF importati vengono archiviati in Download/_Riepilogo_sostituiti/.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, statSync, mkdirSync, renameSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';

const HOME = homedir();
const DOWNLOADS = join(HOME, 'Downloads');
const DESKTOP = join(HOME, 'Desktop');
const ARCHIVE = join(DOWNLOADS, '_Riepilogo_sostituiti');
const TRAY = join(DESKTOP, '_DA SMISTARE');
const PREFIX = 'Riepilogo_somme_richieste_';

// --- Opzioni da riga di comando (tutte facoltative) ---
//   --da <cartella>   sorgente dei PDF (default: Download)
//   --in <cartella>   "Cedolini Lavoratori" di destinazione (default: auto sul Desktop)
//   --copia           copia i PDF senza spostarli/archiviarli (lascia intatta la sorgente)
// Esempio pen drive (riusa i master già salvati, senza ristampare):
//   node sostituisci-riepilogo.mjs --da ~/Downloads/_Riepilogo_sostituiti \
//        --in "/Volumes/PENDRIVE/Cedolini Lavoratori" --copia
function parseArgs(argv) {
  const o = { da: null, in: null, copia: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--da') o.da = argv[++i];
    else if (argv[i] === '--in') o.in = argv[++i];
    else if (argv[i] === '--copia') o.copia = true;
  }
  return o;
}
const ARGS = parseArgs(process.argv.slice(2));
const SOURCE = ARGS.da || DOWNLOADS;

const C = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m' };
const log = (s = '') => process.stdout.write(s + '\n');
const ok = (s) => log(`${C.green}✓${C.reset} ${s}`);
const warn = (s) => log(`${C.yellow}⚠${C.reset} ${s}`);
const err = (s) => log(`${C.red}✗${C.reset} ${s}`);
const info = (s) => log(`${C.cyan}•${C.reset} ${s}`);

// Chiave normalizzata: minuscolo, senza accenti, punteggiatura→spazio, token
// ordinati alfabeticamente (così "D'ERRICO PAOLO" == "PAOLO D_ERRICO").
function normKey(s) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ').filter(Boolean).sort().join(' ');
}

function subDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(dir, e.name));
}

function findCedoliniDir() {
  // --in esplicito (es. pen drive) ha la precedenza.
  if (ARGS.in) {
    try { if (statSync(ARGS.in).isDirectory()) return ARGS.in; } catch { /* skip */ }
    return null;
  }
  if (!existsSync(DESKTOP)) return null;
  for (const entry of readdirSync(DESKTOP)) {
    const candidate = join(DESKTOP, entry, 'Cedolini Lavoratori');
    try { if (statSync(candidate).isDirectory()) return candidate; } catch { /* skip */ }
  }
  return null;
}

// Tutte le cartelle "conteggi/" sotto root (ricorsivo).
function findConteggiDirs(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const d of subDirs(cur)) {
      if (basename(d).toLowerCase() === 'conteggi') { out.push(d); continue; }
      stack.push(d);
    }
  }
  return out;
}

// Nome canonico: toglie il prefisso-data dell'archivio
// ("2026-05-31T21-38-11__Riepilogo…" → "Riepilogo…") e il suffisso " (1)", " (2)"…
// che il browser aggiunge se scarichi più volte lo stesso file.
function canonicalName(name) {
  return name
    .replace(/^\d{4}-\d{2}-\d{2}T[\d-]+__/, '')
    .replace(/ \(\d+\)(?=\.pdf$)/i, '');
}

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// Elenco dei file (path completi) sotto dir; ricorsivo solo se richiesto.
function listFiles(dir, recursive) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (recursive) out.push(...listFiles(p, true)); }
    else out.push(p);
  }
  return out;
}

// Cerca i Riepilogo nella sorgente. Con --da (es. l'albero del Desktop o una pen
// drive) scava ricorsivamente; nei Download (default) guarda solo il primo livello.
function findRiepilogoPdfs() {
  return listFiles(SOURCE, !!ARGS.da)
    .filter((p) => /\.pdf$/i.test(p) && canonicalName(basename(p)).toLowerCase().startsWith(PREFIX.toLowerCase()))
    .map((p) => ({ name: basename(p), path: p, mtime: statSync(p).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
}

// Dopo aver copiato il PDF nella cartella giusta archivia la sorgente (rete di
// sicurezza). In modalità --copia la sorgente è un master da preservare: non si tocca.
function archiveSource(srcPath, displayName) {
  if (ARGS.copia) return;
  try {
    if (!existsSync(ARCHIVE)) mkdirSync(ARCHIVE, { recursive: true });
    renameSync(srcPath, join(ARCHIVE, `${timestamp()}__${displayName}`));
  } catch {
    warn('  (non sono riuscito ad archiviare il PDF: resta nei Download)');
  }
}

function main() {
  log('');
  log(`${C.bold}━━━ Sostituisci Riepilogo ━━━${C.reset}`);
  log('');

  const ced = findCedoliniDir();
  if (!ced) {
    err(ARGS.in
      ? `Non trovo la cartella indicata con --in: ${ARGS.in}`
      : 'Non trovo la cartella "Cedolini Lavoratori" in nessuna sottocartella del Desktop.');
    process.exitCode = 1;
    return;
  }
  info(`Sorgente:     ${C.dim}${SOURCE}${C.reset}`);
  info(`Destinazione: ${C.dim}${ced}${C.reset}`);
  if (ARGS.copia) info(`Modalità:     ${C.bold}copia${C.reset} (sorgente preservata)`);

  const pdfs = findRiepilogoPdfs();
  if (pdfs.length === 0) {
    log('');
    log(`${C.yellow}Nessun "${PREFIX}*.pdf" in ${SOURCE}.${C.reset}`);
    if (!ARGS.in) info('Sul sito: report del lavoratore → "Stampa" → "Salva come PDF", poi riprova.');
    return;
  }
  info(`PDF da sostituire: ${C.bold}${pdfs.length}${C.reset}`);

  const conteggiDirs = findConteggiDirs(ced);
  const report = { replaced: [], placed: [], tray: [] };

  for (const pdf of pdfs) {
    const target = canonicalName(pdf.name);
    const workerKey = normKey(target.slice(PREFIX.length).replace(/\.pdf$/i, ''));

    // 1. nome file identico già presente in una "conteggi/"
    let hits = conteggiDirs.filter((d) => existsSync(join(d, target)));
    let kind = 'replaced';

    // 2. fallback: match sul nome lavoratore (cartella che CONTIENE la conteggi/)
    if (hits.length !== 1) {
      const byWorker = conteggiDirs.filter((d) => normKey(basename(dirname(d))) === workerKey);
      if (byWorker.length === 1) { hits = byWorker; kind = 'placed'; }
      else hits = byWorker; // 0 o >1 → finirà in _DA SMISTARE
    }

    if (hits.length === 1) {
      const dest = join(hits[0], target);
      copyFileSync(pdf.path, dest);
      const rel = dest.replace(ced + '/', '');
      archiveSource(pdf.path, target);
      if (kind === 'replaced') { report.replaced.push(rel); ok(`  sostituito: ${rel}`); }
      else { report.placed.push(rel); info(`  inserito:   ${rel}`); }
    } else {
      const why = hits.length === 0 ? 'nessuna cartella corrispondente' : `${hits.length} cartelle corrispondono`;
      // In --copia la sorgente è un master: NON la spostiamo, segnaliamo soltanto.
      if (!ARGS.copia) {
        mkdirSync(TRAY, { recursive: true });
        renameSync(pdf.path, join(TRAY, target));
      }
      report.tray.push(`${target} (${why})`);
      warn(`  da smistare: ${target} → ${why}`);
    }
  }

  log('');
  log(`${C.bold}━━━ Riepilogo ━━━${C.reset}`);
  ok(`Sostituiti (stesso nome): ${report.replaced.length}`);
  if (report.placed.length) info(`Inseriti per nome lavoratore: ${report.placed.length}`);
  if (report.tray.length) {
    warn(ARGS.copia
      ? `Non abbinati (lasciati nella sorgente): ${report.tray.length}`
      : `Da smistare a mano: ${report.tray.length} → cartella "${TRAY}"`);
    report.tray.forEach((t) => log(`   ${C.yellow}-${C.reset} ${t}`));
  }
  log('');
  if (!ARGS.copia) log(`${C.dim}PDF importati archiviati in: ${ARCHIVE}${C.reset}`);
  log('');
}

main();
