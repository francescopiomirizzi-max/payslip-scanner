// Completa il caricamento in archivio delle buste Elior (Ghiro + Mastropasqua).
// Idempotente: rilegge da payslip_metadata cosa c'è già e carica SOLO i mesi
// mancanti (storage payslips_archive + riga DB), replicando il formato dell'app
// (mese MAIUSCOLO, storage_path owner/worker/ANNO_MM_NomeFile.pdf, extracted_data {}).
//
// La service_role key NON va sulla riga di comando: mettila in .env.local come
//   SUPABASE_SERVICE_ROLE_KEY=...
// poi:  node scripts/upload-elior-archive.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = 'https://bpnkjfboijfhnqovymwg.supabase.co';
const BUCKET = 'payslips_archive';
const OWNER_ID = '7fec036e-d081-4a8f-9da7-5d9c6e7cfc70';
const MASTER = '/Users/francescopiomirizzi/Desktop/Pratiche_differenze_ retributive_ indennità/Cedolini Lavoratori/ELIOR';
const WORKERS = [
  { id: 'fab7ed02-a7c8-455f-b211-c86debd5250f', dir: 'GHIRO GIANLUCA' },
  { id: '091d915d-168d-4c4b-a8fa-b75592f8ebc6', dir: 'MASTROPASQUA GIOVANNI' },
];
const MONTHS = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];

function readEnvKey() {
  for (const f of ['.env.local', '.env']) {
    try {
      const txt = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      const m = txt.match(/^\s*(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY)\s*=\s*(.+)\s*$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch {}
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function parseFromFilename(name) {
  const base = name.toLowerCase().replace(/\.pdf$/i, '');
  let monthIndex = MONTHS.findIndex(m => base.includes(m.toLowerCase()));
  const ym = base.match(/\b(20[0-2]\d|19[9]\d)\b/);
  const year = ym ? parseInt(ym[1]) : null;
  return { year, monthIndex: monthIndex >= 0 ? monthIndex : null };
}

const KEY = readEnvKey();
if (!KEY) {
  console.error('❌ Manca SUPABASE_SERVICE_ROLE_KEY in .env.local (o .env). Aggiungila e rilancia.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

const DRY = process.env.DRY_RUN === '1';

async function existingKeys(workerId) {
  const set = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('payslip_metadata')
      .select('year, month')
      .eq('worker_id', workerId)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data) set.add(`${r.year}|${String(r.month).toUpperCase()}`);
    if (data.length < 1000) break;
    from += 1000;
  }
  return set;
}

let totUp = 0, totSkip = 0, totErr = 0;
for (const w of WORKERS) {
  const present = await existingKeys(w.id);
  const bp = path.join(MASTER, w.dir, 'buste paga');
  const years = fs.readdirSync(bp).filter(y => /^\d{4}$/.test(y)).sort();
  let up = 0, skip = 0;
  for (const y of years) {
    for (const file of fs.readdirSync(path.join(bp, y)).filter(f => f.toLowerCase().endsWith('.pdf')).sort()) {
      const { year, monthIndex } = parseFromFilename(file);
      if (year === null || monthIndex === null) { console.warn(`  ?? non parsato: ${file}`); continue; }
      const MONTH = MONTHS[monthIndex];
      if (present.has(`${year}|${MONTH}`)) { skip++; totSkip++; continue; }
      const safe = file.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${OWNER_ID}/${w.id}/${year}_${String(monthIndex).padStart(2,'0')}_${safe}`;
      if (DRY) { console.log(`  [DRY] ${w.dir} ${MONTH} ${year} -> ${storagePath}`); up++; totUp++; continue; }
      const buf = fs.readFileSync(path.join(bp, y, file));
      const upRes = await supabase.storage.from(BUCKET).upload(storagePath, buf, { upsert: true, contentType: 'application/pdf' });
      if (upRes.error) { console.error(`  ✗ storage ${file}: ${upRes.error.message}`); totErr++; continue; }
      const insRes = await supabase.from('payslip_metadata').insert({
        owner_id: OWNER_ID, worker_id: w.id, storage_path: storagePath,
        filename: file, year, month: MONTH, extracted_data: {},
      });
      if (insRes.error) {
        console.error(`  ✗ insert ${file}: ${insRes.error.message}`);
        await supabase.storage.from(BUCKET).remove([storagePath]);
        totErr++; continue;
      }
      up++; totUp++;
      // mark present to avoid double within run
      present.add(`${year}|${MONTH}`);
    }
  }
  console.log(`[${w.dir}] caricate ora: ${up} | già presenti: ${skip}`);
}
console.log(`\n${DRY ? '[DRY RUN] ' : ''}TOTALE — caricate: ${totUp} | saltate (già c'erano): ${totSkip} | errori: ${totErr}`);
