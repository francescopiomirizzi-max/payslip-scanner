#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTA CONCLUSE — helper locale (nessun deploy, gira solo sul Mac)
//
// Prende gli ZIP "Concluse_*.zip" scaricati dal sito (bottone "Esporta Concluse")
// dalla cartella Download e smista i 3 documenti di ogni pratica (Conteggi PDF,
// Riepilogo PDF, Relazione .docx) nelle cartelle "Cedolini Lavoratori" sul Desktop.
//
// MERGE INTELLIGENTE: l'archivio manuale non è uniforme (RFI è annidato sotto
// "Pratiche finite/<categoria>/", e i nomi cartella sono digitati in modi diversi:
// spazi finali, ordine cognome/nome invertito, apostrofi vs underscore, accenti).
// Per non creare doppioni né mettere documenti nel posto sbagliato:
//   • cerca la cartella esistente del lavoratore OVUNQUE sotto l'azienda, con
//     match "normalizzato" (ignora spazi/maiuscole/accenti/punteggiatura E ordine
//     dei token).
//   • 1 corrispondenza  → unisce lì dentro (preserva posizione e buste paga).
//   • 0 corrispondenze  → lavoratore nuovo: crea AZIENDA/COGNOME NOME/conteggi.
//   • >1 corrispondenze o match incerto → mette in "_DA SMISTARE/" e lo segnala.
// I file con lo stesso nome vengono sovrascritti. Lo ZIP importato viene archiviato.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, statSync, mkdirSync, renameSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const HOME = homedir();
const DOWNLOADS = join(HOME, 'Downloads');
const DESKTOP = join(HOME, 'Desktop');
const ARCHIVE = join(DOWNLOADS, '_Concluse_importati');
const TRAY_NAME = '_DA SMISTARE';

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

// Tutte le sottocartelle (ricorsivo) sotto root, escludendo le cartelle-foglia
// tecniche "conteggi" e "buste paga" e i loro contenuti.
function walkDirs(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const d of subDirs(cur)) {
      const b = basename(d).toLowerCase();
      if (b === 'conteggi' || b.startsWith('buste paga')) continue;
      out.push(d);
      stack.push(d);
    }
  }
  return out;
}

function findCedoliniDir() {
  if (!existsSync(DESKTOP)) return null;
  for (const entry of readdirSync(DESKTOP)) {
    const candidate = join(DESKTOP, entry, 'Cedolini Lavoratori');
    try { if (statSync(candidate).isDirectory()) return candidate; } catch { /* skip */ }
  }
  return null;
}

function findConcluseZips() {
  if (!existsSync(DOWNLOADS)) return [];
  return readdirSync(DOWNLOADS)
    .filter((f) => /^Concluse_.*\.zip$/i.test(f))
    .map((f) => ({ name: f, path: join(DOWNLOADS, f), mtime: statSync(join(DOWNLOADS, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
}

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// Copia tutti i file da srcDir a destDir (sovrascrive). Ritorna i nomi copiati.
function copyFiles(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const names = readdirSync(srcDir, { withFileTypes: true }).filter((e) => e.isFile() && e.name !== '.DS_Store').map((e) => e.name);
  for (const n of names) copyFileSync(join(srcDir, n), join(destDir, n));
  return names;
}

function main() {
  log('');
  log(`${C.bold}━━━ Importa Concluse ━━━${C.reset}`);
  log('');

  const ced = findCedoliniDir();
  if (!ced) {
    err('Non trovo la cartella "Cedolini Lavoratori" in nessuna sottocartella del Desktop.');
    process.exitCode = 1;
    return;
  }
  info(`Archivio: ${C.dim}${ced}${C.reset}`);

  const zips = findConcluseZips();
  if (zips.length === 0) {
    log('');
    log(`${C.yellow}Nessun file "Concluse_*.zip" nei Download.${C.reset}`);
    info('Genera lo ZIP dal sito (menu Dati → Esporta Concluse) e riprova.');
    return;
  }
  info(`ZIP da importare: ${C.bold}${zips.length}${C.reset}`);

  const report = { merged: [], created: [], tray: [] };

  for (const zip of zips) {
    log('');
    log(`${C.bold}» ${zip.name}${C.reset}`);

    const tmp = mkdtempSync(join(tmpdir(), 'concluse-'));
    try {
      execFileSync('unzip', ['-oq', zip.path, '-d', tmp], { encoding: 'utf8' });
    } catch (e) {
      err(`  Errore scompattando: ${(e.message || e).toString().split('\n')[0]}`);
      rmSync(tmp, { recursive: true, force: true });
      continue;
    }

    // Lo ZIP ha struttura AZIENDA/COGNOME NOME/conteggi/<files>
    for (const aziendaTmp of subDirs(tmp)) {
      const aziendaZip = basename(aziendaTmp);
      const aziendaKey = normKey(aziendaZip);

      // Cartella azienda esistente (match normalizzato), altrimenti la creo.
      let aziendaDir = subDirs(ced).find((d) => normKey(basename(d)) === aziendaKey);
      if (!aziendaDir) {
        aziendaDir = join(ced, aziendaZip);
        mkdirSync(aziendaDir, { recursive: true });
      }

      for (const workerTmp of subDirs(aziendaTmp)) {
        const workerZip = basename(workerTmp);
        const workerKey = normKey(workerZip);
        const srcConteggi = join(workerTmp, 'conteggi');
        if (!existsSync(srcConteggi)) continue;

        // Cerca la cartella del lavoratore ovunque sotto l'azienda.
        const matches = walkDirs(aziendaDir).filter((d) => normKey(basename(d)) === workerKey);

        let destWorker, kind;
        if (matches.length === 1) {
          destWorker = matches[0]; kind = 'merged';
        } else if (matches.length === 0) {
          destWorker = join(aziendaDir, workerZip); kind = 'created';
        } else {
          destWorker = join(ced, TRAY_NAME, aziendaZip, workerZip); kind = 'tray';
        }

        const copied = copyFiles(srcConteggi, join(destWorker, 'conteggi'));
        const rel = destWorker.replace(ced + '/', '');
        const label = `${aziendaZip} / ${workerZip} → ${rel} (${copied.length} file)`;
        if (kind === 'merged') { report.merged.push(label); ok(`  unito:  ${rel}`); }
        else if (kind === 'created') { report.created.push(label); info(`  nuovo:  ${rel}`); }
        else { report.tray.push(label); warn(`  da smistare: ${aziendaZip} / ${workerZip} (match incerto)`); }
      }
    }

    rmSync(tmp, { recursive: true, force: true });

    // Archivia lo ZIP importato (non lo cancella).
    try {
      if (!existsSync(ARCHIVE)) mkdirSync(ARCHIVE, { recursive: true });
      renameSync(zip.path, join(ARCHIVE, `${timestamp()}__${zip.name}`));
    } catch {
      warn('  (non sono riuscito ad archiviare lo ZIP: resta nei Download)');
    }
  }

  log('');
  log(`${C.bold}━━━ Riepilogo ━━━${C.reset}`);
  ok(`Uniti a pratiche esistenti: ${report.merged.length}`);
  if (report.created.length) info(`Nuove pratiche create: ${report.created.length}`);
  if (report.tray.length) {
    warn(`Da smistare a mano: ${report.tray.length} → cartella "${TRAY_NAME}"`);
    report.tray.forEach((t) => log(`   ${C.yellow}-${C.reset} ${t.split(' → ')[0]}`));
  }
  log('');
  log(`${C.dim}ZIP importati in: ${ARCHIVE}${C.reset}`);
  log('');
}

main();
