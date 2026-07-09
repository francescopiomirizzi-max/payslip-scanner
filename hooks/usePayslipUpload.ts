import React, { useState, useRef, useEffect } from 'react';
import { useIsland } from '../IslandContext';
import { Worker, AnnoDati, getColumnsByProfile, MONTH_NAMES } from '../types';
import { isSystemProfile } from '../config/profiles';
import { parseLocalFloat } from '../utils/formatters';
import { IS_DEMO } from '../config/demo';
import { buildDemoExtraction } from '../fixtures/demoScan';

// Mappa il mese letto dall'AI (testo "Dicembre" / "12" / "dic"…) a un indice 0-11,
// oppure -1 se non riconosciuto. Stessa logica del fallback nel parsing della data,
// isolata qui per riusarla nella guardia mese/anno.
const aiMonthToIndex = (rawMonth: any): number => {
  if (rawMonth === undefined || rawMonth === null) return -1;
  const mesiStr = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const monthRaw = String(rawMonth).toLowerCase().trim();
  let idx = mesiStr.findIndex(m => monthRaw.includes(m));
  if (idx === -1) {
    const numMatch = monthRaw.match(/\b(0?[1-9]|1[0-2])\b/);
    if (numMatch) idx = parseInt(numMatch[1]) - 1;
    else if (monthRaw.length >= 5) {
      const firstTwo = parseInt(monthRaw.substring(0, 2));
      if (firstTwo >= 1 && firstTwo <= 12) idx = firstTwo - 1;
    }
  }
  return idx >= 0 && idx <= 11 ? idx : -1;
};

interface UsePayslipUploadOptions {
  worker: Worker;
  monthlyInputs: AnnoDati[];
  setMonthlyInputs: React.Dispatch<React.SetStateAction<AnnoDati[]>>;
  setCurrentYear: (year: number) => void;
  onArchive?: (file: File, year: number, month: string, monthIndex: number, extractedData: any) => Promise<void>;
}

export function usePayslipUpload({
  worker,
  monthlyInputs,
  setMonthlyInputs,
  setCurrentYear,
  onArchive,
}: UsePayslipUploadOptions) {
  const { startUpload, updateUploadProgress, finishUpload } = useIsland();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchNotification, setBatchNotification] = useState<{
    msg: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (batchNotification) {
      // Errori/avvisi restano più a lungo: l'utente deve leggere la lista dei file falliti.
      const ms = batchNotification.type === 'success' ? 4000 : 8000;
      const timer = setTimeout(() => setBatchNotification(null), ms);
      return () => clearTimeout(timer);
    }
  }, [batchNotification]);

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        let result = reader.result as string;
        if (result.includes(',')) result = result.split(',')[1];
        resolve(result);
      };
      reader.onerror = error => reject(error);
    });
  };

  const getCustomColumnsForAI = () => {
    if (worker.profilo === 'ELIOR' && worker.eliorType === 'magazzino') {
      const columns = getColumnsByProfile(worker.profilo, worker.eliorType);
      return columns.filter(
        (c: any) => c.id !== 'month' && c.id !== 'total' && c.id !== 'note' && c.id !== 'arretrati'
      );
    }
    if (isSystemProfile(worker.profilo)) return null;
    try {
      const saved = localStorage.getItem('customCompanies');
      if (saved) {
        const companies = JSON.parse(saved);
        if (companies[worker.profilo]?.columns) {
          return companies[worker.profilo].columns.filter(
            (c: any) => c.id !== 'month' && c.id !== 'total' && c.id !== 'note' && c.id !== 'arretrati'
          );
        }
      }
    } catch (e) {
      console.error('Errore lettura custom companies per AI', e);
    }
    return null;
  };

  // --- FUNZIONE CHE RICEVE I DATI DAL TELEFONO (ANTI-SOVRASCRITTURA DEFINITIVA FIXATA) ---
  const handleQRData = (aiResult: any) => {
    if (!aiResult) return;

    // TRADUTTORE TITANIUM PER L'ANNO (Fuori dallo State Updater per Side Effects)
    let targetYear = parseInt(String(aiResult.year || '').replace(/[^\d]/g, ''));
    if (isNaN(targetYear) || targetYear < 2000) {
      const yMatchMonth = String(aiResult.month || '').match(/(20\d{2})/);
      if (yMatchMonth) targetYear = parseInt(yMatchMonth[1]);
      else return;
    }

    // TRADUTTORE TITANIUM PER IL MESE
    const isCUD = aiResult.isCUD === true;
    let targetMonthIndex = -1;

    if (isCUD) {
      targetMonthIndex = 11;
    } else if (aiResult.month) {
      const mesiStr = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
      let monthRaw = String(aiResult.month).toLowerCase().trim();
      targetMonthIndex = mesiStr.findIndex(m => monthRaw.includes(m));

      if (targetMonthIndex === -1) {
        const numMatch = monthRaw.match(/\b(0?[1-9]|1[0-2])\b/);
        if (numMatch) {
          targetMonthIndex = parseInt(numMatch[1]) - 1;
        } else if (monthRaw.length >= 5) {
          const firstTwo = parseInt(monthRaw.substring(0, 2));
          if (firstTwo >= 1 && firstTwo <= 12) targetMonthIndex = firstTwo - 1;
        }
      }
    }

    if (targetMonthIndex < 0 || targetMonthIndex > 11) {
      console.error('Mese non riconosciuto dal QR:', aiResult.month);
      targetMonthIndex = 0;
    }

    setCurrentYear(targetYear);
    window.dispatchEvent(
      new CustomEvent('island-scan-label', {
        detail: `${MONTH_NAMES[targetMonthIndex]} ${targetYear}`,
      })
    );

    const fondoPregresso =
      aiResult.fondo_pregresso_31_12 !== undefined
        ? parseLocalFloat(aiResult.fondo_pregresso_31_12)
        : null;
    if (fondoPregresso !== null && !isNaN(fondoPregresso) && fondoPregresso > 0) {
      window.dispatchEvent(
        new CustomEvent('ai-found-tfr-base', {
          detail: { amount: fondoPregresso, year: targetYear - 1 },
        })
      );
    }

    setMonthlyInputs(prevInputs => {
      let currentAnni = JSON.parse(JSON.stringify(prevInputs));

      let rowIndex = currentAnni.findIndex(
        (r: any) => Number(r.year) === targetYear && r.monthIndex === targetMonthIndex
      );

      if (rowIndex === -1) {
        currentAnni.push({
          id: Date.now().toString() + Math.random().toString(),
          year: targetYear,
          monthIndex: targetMonthIndex,
          month: MONTH_NAMES[targetMonthIndex],
          daysWorked: 0,
          daysVacation: 0,
          ticket: 0,
          arretrati: 0,
          note: '',
          coeffTicket: 0,
          coeffPercepito: 0,
        });
        rowIndex = currentAnni.length - 1;
      }

      const row = currentAnni[rowIndex];

      if (!isCUD) {
        if (aiResult.daysWorked !== undefined && aiResult.daysWorked !== null)
          row.daysWorked = parseLocalFloat(aiResult.daysWorked);
        if (aiResult.daysVacation !== undefined && aiResult.daysVacation !== null)
          row.daysVacation = parseLocalFloat(aiResult.daysVacation);
        if (aiResult.daysPaidLeave !== undefined && aiResult.daysPaidLeave !== null)
          row.daysPaidLeave = parseLocalFloat(aiResult.daysPaidLeave);
      }

      const ticketVal = parseLocalFloat(aiResult.ticketRate);
      if (!isNaN(ticketVal) && ticketVal > 0) row.coeffTicket = ticketVal;

      const arretratiVal = parseLocalFloat(aiResult.arretrati);
      if (!isNaN(arretratiVal) && arretratiVal !== 0) row.arretrati = arretratiVal;

      const sep = '  •  ';
      if (isCUD && !row.note?.includes('CUD'))
        row.note = row.note ? `[📄 Dati da CUD]${sep}${row.note}` : `[📄 Dati da CUD]`;
      if (aiResult.eventNote && !row.note?.includes(aiResult.eventNote))
        row.note = row.note ? `${row.note}${sep}[${aiResult.eventNote}]` : `[${aiResult.eventNote}]`;
      if (
        aiResult.aiWarning &&
        aiResult.aiWarning !== 'Nessuna anomalia' &&
        !row.note?.includes('⚠️')
      )
        row.note = row.note
          ? `${row.note}${sep}[⚠️ AI: ${aiResult.aiWarning}]`
          : `[⚠️ AI: ${aiResult.aiWarning}]`;

      // MERCITALIA: i ticket non hanno colonna, vengono isolati nella nota del mese
      if (worker.profilo === 'MERCITALIA') {
        const ticketCount = parseLocalFloat(aiResult.count);
        if (ticketCount > 0 && ticketVal > 0 && !row.note?.includes('ticket restaurant')) {
          const ticketNote = `Erogati ${Math.round(ticketCount)} ticket restaurant da ${ticketVal.toFixed(2)}€`;
          row.note = row.note ? `${row.note}${sep}[${ticketNote}]` : `[${ticketNote}]`;
        }
        // Storno ferie (righe 3833 negative): correzione retroattiva, isolata nella nota
        const ferieStorno = parseLocalFloat(aiResult.ferieStorno);
        if (ferieStorno > 0 && !row.note?.includes('storno ferie')) {
          const stornoNote = `Rilevato storno ferie periodi prec.: -${ferieStorno.toFixed(1)} gg`;
          row.note = row.note ? `${row.note}${sep}[${stornoNote}]` : `[${stornoNote}]`;
        }
      }

      if (aiResult.imponibile_tfr_mensile !== undefined) {
        const newVal = parseLocalFloat(aiResult.imponibile_tfr_mensile);
        row.imponibile_tfr_mensile = isCUD ? newVal : (row.imponibile_tfr_mensile || 0) + newVal;
      }

      if (fondoPregresso !== null && !isNaN(fondoPregresso)) {
        row.fondo_pregresso_31_12 = fondoPregresso;
      }

      if (aiResult.codes) {
        const expectedColumns = getColumnsByProfile(worker.profilo, worker.eliorType) || [];
        Object.entries(aiResult.codes).forEach(([code, value]) => {
          const numValue = parseLocalFloat(value);
          if (!isNaN(numValue) && numValue !== 0) {
            const matchedCol = expectedColumns.find(c =>
              code.toUpperCase() === c.id.toUpperCase()
            );
            if (matchedCol) {
              row[matchedCol.id] = numValue;
            } else {
              row[code] = numValue;
            }
          }
        });
      }

      currentAnni[rowIndex] = row;
      currentAnni.sort(
        (a: any, b: any) => a.year - b.year || a.monthIndex - b.monthIndex
      );

      return currentAnni;
    });

    // Archive the file when received via QR (fileData included by MobileUploadPage AI mode)
    if (onArchive && aiResult.fileData && !isNaN(targetYear) && targetMonthIndex >= 0) {
      try {
        const mimeType = aiResult.mimeType || 'image/jpeg';
        const binary = atob(aiResult.fileData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mimeType });
        const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
        const file = new File(
          [blob],
          `payslip_${targetYear}_${targetMonthIndex + 1}.${ext}`,
          { type: mimeType }
        );
        void onArchive(file, targetYear, MONTH_NAMES[targetMonthIndex], targetMonthIndex, aiResult);
      } catch (e) {
        console.error('QR archive error:', e);
      }
    }
  };

  // Guardia anti-doppio-batch: due batch simultanei partirebbero ciascuno dal
  // proprio snapshot di monthlyInputs e l'ultimo setMonthlyInputs cancellerebbe
  // i risultati dell'altro. (isBatchProcessing non è cablato di proposito:
  // pilotava il vecchio HUD bloccante, sostituito dalla Dynamic Island.)
  const batchRunningRef = useRef(false);

  // Tiene solo PDF e immagini: il picker-cartella (webkitdirectory) e il drop di
  // cartelle ignorano `accept` e portano dentro anche .DS_Store, Excel, ecc.
  const filterPayslipFiles = (list: File[]): File[] =>
    list.filter(
      f =>
        !f.name.startsWith('.') &&
        (f.type === 'application/pdf' ||
          f.type.startsWith('image/') ||
          /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name))
    );

  // --- LOGICA UPLOAD COLLEGATA ALLA DYNAMIC ISLAND (CON PARSER TITANIUM V2) ---
  // Core del batch: riceve File già filtrati, dall'input file/cartella o dal drop.
  // fromFolder accende la Live Activity "cartella" dell'island (tema ambra,
  // avanzamento %/ETA): stessa meccanica del batch, solo presentazione diversa.
  const runBatch = async (files: File[], isSingle: boolean, fromFolder = false) => {
    if (files.length === 0) return;

    if (batchRunningRef.current) {
      setBatchNotification({
        type: 'warning',
        msg: 'Un caricamento è già in corso: attendi che finisca prima di lanciarne un altro.',
      });
      return;
    }

    const uploadType = isSingle ? 'single' : fromFolder ? 'folder' : 'batch';
    startUpload(uploadType, files.length);

    let currentAnni = JSON.parse(JSON.stringify(monthlyInputs));
    let successCount = 0;
    let errorCount = 0;
    let lastDetectedYear = null;
    const failedFiles: string[] = []; // feedback per-file: quali buste paga non sono passate
    const mismatchFiles: string[] = []; // buste col periodo della testata (AI) diverso dal nome file → da verificare

    // --- MISURA BATCH (passo 1: tempi reali + throttle, per dimensionare chiavi/pool) ---
    const batchT0 = performance.now();
    const fileDurations: number[] = [];
    let retryCount = 0;          // tentativi oltre il primo (coda lunga/timeout Gemini)
    let geminiThrottleCount = 0; // quota / RESOURCE_EXHAUSTED da Gemini → serve più quota (chiavi)
    let ipLimitCount = 0;        // 429 dal nostro _rateLimit per IP → alzare il rate limit

    const expectedColumns = getColumnsByProfile(worker.profilo, worker.eliorType) || [];

    // Flush incrementale: snapshot dello stato ogni FLUSH_EVERY buste completate.
    // Cadenza ~1 per anno = stesse scritture Supabase del vecchio flusso manuale
    // per-anno (ogni setMonthlyInputs innesca l'autosave debounced del parent);
    // così un crash del tab a metà di un batch multi-anno non perde le scansioni
    // già riuscite.
    const FLUSH_EVERY = 12;
    let completedCount = 0;
    const flushPartial = () => {
      const snapshot: AnnoDati[] = JSON.parse(JSON.stringify(currentAnni));
      snapshot.sort((a, b) => a.year - b.year || a.monthIndex - b.monthIndex);
      setMonthlyInputs(snapshot);
    };

    const processFile = async (file: File) => {
      const fileT0 = performance.now();
      const monthNames = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
      ];
      let label = file.name;
      const foundMonthUiIndex = monthNames.findIndex(m =>
        file.name.toLowerCase().includes(m.toLowerCase())
      );
      // Con l'upload-cartella i file sono spesso "Gennaio.pdf" dentro la cartella
      // "2022": l'anno si cerca anche nel nome della cartella IMMEDIATA. Solo
      // quella: usare l'intero percorso regalerebbe a tutti i file l'anno di una
      // eventuale cartella madre tipo "Avella 2008-2025".
      const relPath: string =
        (file as any).webkitRelativePath || (file as any).relativePath || '';
      const parentDir = relPath.split('/').slice(-2, -1)[0] || '';
      const yearMatchUI =
        file.name.match(/(20\d{2})/) || parentDir.match(/(20\d{2})/);

      if (foundMonthUiIndex !== -1) {
        label = yearMatchUI
          ? `${monthNames[foundMonthUiIndex]} ${yearMatchUI[1]}`
          : monthNames[foundMonthUiIndex];
      } else {
        label = file.name.length > 18 ? file.name.substring(0, 18) + '...' : file.name;
      }
      window.dispatchEvent(new CustomEvent('island-scan-label', { detail: label }));

      try {
        const base64String = await toBase64(file);

        // Retry automatico contro la coda lunga/throttle di Gemini: fino a 2 retry (3 tentativi
        // totali) con backoff crescente. Ogni tentativo re-invoca la Function → nuova rotazione
        // chiavi + budget fresco → quasi sempre passa entro il 2°/3° giro. Costo zero se la 1ª va
        // (solo le buste che falliscono ritentano): recupera i ~1% "Nessun dato valido".
        const MAX_ATTEMPTS = 3;
        const scanBody = JSON.stringify({
          fileData: base64String,
          mimeType: file.type || 'application/pdf',
          company: worker.profilo,
          eliorType: worker.eliorType,
          customColumns: getCustomColumnsForAI(),
        });

        let response: Response | null = null;
        let responseText = '';
        let aiResult: any = null;
        let success = false;

        // Demo: estrazione SIMULATA (nessuna chiamata a Gemini). Finta latenza
        // per mostrare l'animazione "sto analizzando…", poi un risultato di esempio
        // nello stesso formato della pipeline reale.
        if (IS_DEMO) {
          await new Promise(r => setTimeout(r, 1400));
          aiResult = buildDemoExtraction(worker);
          success = true;
        }

        for (let attempt = 1; !IS_DEMO && attempt <= MAX_ATTEMPTS; attempt++) {
          response = await fetch('/.netlify/functions/scan-payslip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: scanBody,
          });
          responseText = await response.text();
          if (response.status === 429) ipLimitCount++;

          try {
            let parsed = JSON.parse(responseText);
            // Scudo anti-allucinazioni strutturali dell'IA
            if (Array.isArray(parsed)) parsed = parsed[0];
            if (parsed && parsed.data) parsed = parsed.data;
            if (parsed && parsed.payslip) parsed = parsed.payslip;
            if (parsed && parsed.risultato) parsed = parsed.risultato;
            aiResult = parsed;
          } catch (e) {
            aiResult = null;
          }

          if (/quota|resource_exhausted/i.test(String(aiResult?.error ?? responseText ?? ''))) geminiThrottleCount++;

          if (response.ok && aiResult && !aiResult.error) {
            success = true;
            break;
          }

          if (attempt < MAX_ATTEMPTS) {
            retryCount++;
            console.warn(`⏳ Retry automatico per ${file.name} (${attempt + 1}/${MAX_ATTEMPTS}) dopo fallimento`);
            // Backoff crescente (0,6s poi 1,2s): un fallimento è spesso un momento di coda/throttle;
            // una breve pausa lo lascia passare e dà tempo alla rotazione chiavi lato Function.
            await new Promise(r => setTimeout(r, 600 * attempt));
          }
        }

        if (!success) {
          if (aiResult === null) {
            console.error(`❌ Il server ha fallito sul file ${file.name}. Risposta:`, responseText);
          } else {
            console.error(`Errore file ${file.name}`, aiResult?.error || 'Nessun dato valido');
          }
          errorCount++;
          failedFiles.push(label);
          return;
        }

        // TRADUTTORE TITANIUM V3 — priorità assoluta all'anno nel nome file
        let targetYear: number;
        if (yearMatchUI) {
          targetYear = parseInt(yearMatchUI[1]);
        } else {
          targetYear = parseInt(String(aiResult.year || '').replace(/[^\d]/g, ''));
          if (isNaN(targetYear) || targetYear < 2000) {
            const yMatchMonth = String(aiResult.month || '').match(/(20\d{2})/);
            if (yMatchMonth) targetYear = parseInt(yMatchMonth[1]);
          }
        }

        let targetMonthIndex = foundMonthUiIndex;

        const isCUD = aiResult.isCUD === true;

        if (isCUD) {
          targetMonthIndex = 11;
        } else if (targetMonthIndex === -1 && aiResult.month) {
          const mesiStr = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
          let monthRaw = String(aiResult.month).toLowerCase().trim();
          targetMonthIndex = mesiStr.findIndex(m => monthRaw.includes(m));

          if (targetMonthIndex === -1) {
            const numMatch = monthRaw.match(/\b(0?[1-9]|1[0-2])\b/);
            if (numMatch) {
              targetMonthIndex = parseInt(numMatch[1]) - 1;
            } else if (monthRaw.length >= 5) {
              const firstTwo = parseInt(monthRaw.substring(0, 2));
              if (firstTwo >= 1 && firstTwo <= 12) targetMonthIndex = firstTwo - 1;
            }
          }
        }

        if (
          targetMonthIndex < 0 ||
          targetMonthIndex > 11 ||
          isNaN(targetYear) ||
          targetYear < 2000
        ) {
          console.error('❌ Impossibile determinare data per il file:', file.name);
          errorCount++;
          failedFiles.push(label);
          return;
        }

        lastDetectedYear = targetYear;

        let rowIndex = currentAnni.findIndex(
          (r: AnnoDati) => Number(r.year) === targetYear && r.monthIndex === targetMonthIndex
        );

        if (rowIndex === -1) {
          const newRow: AnnoDati = {
            id: Date.now().toString() + Math.random(),
            year: targetYear,
            monthIndex: targetMonthIndex,
            month: MONTH_NAMES[targetMonthIndex],
            daysWorked: 0,
            daysVacation: 0,
            ticket: 0,
            arretrati: 0,
            note: '',
            coeffTicket: 0,
            coeffPercepito: 0,
          };
          currentAnni.push(newRow);
          rowIndex = currentAnni.length - 1;
        }

        const row = currentAnni[rowIndex];

        if (!isCUD) {
          if (aiResult.daysWorked !== undefined && aiResult.daysWorked !== null)
            row.daysWorked = parseLocalFloat(aiResult.daysWorked);
          if (aiResult.daysVacation !== undefined && aiResult.daysVacation !== null)
            row.daysVacation = parseLocalFloat(aiResult.daysVacation);
          if (aiResult.daysPaidLeave !== undefined && aiResult.daysPaidLeave !== null)
            row.daysPaidLeave = parseLocalFloat(aiResult.daysPaidLeave);
        }

        const ticketVal = parseLocalFloat(aiResult.ticketRate);
        if (!isNaN(ticketVal) && ticketVal > 0) row.coeffTicket = ticketVal;

        const arretratiVal = parseLocalFloat(aiResult.arretrati);
        if (!isNaN(arretratiVal) && arretratiVal !== 0) row.arretrati = arretratiVal;

        const sep = '  •  ';
        if (isCUD && !row.note?.includes('CUD'))
          row.note = row.note ? `[📄 Dati da CUD]${sep}${row.note}` : `[📄 Dati da CUD]`;
        if (aiResult.eventNote && !row.note?.includes(aiResult.eventNote))
          row.note = row.note
            ? `${row.note}${sep}[${aiResult.eventNote}]`
            : `[${aiResult.eventNote}]`;
        if (
          aiResult.aiWarning &&
          aiResult.aiWarning !== 'Nessuna anomalia' &&
          !row.note?.includes('⚠️')
        )
          row.note = row.note
            ? `${row.note}${sep}[⚠️ AI: ${aiResult.aiWarning}]`
            : `[⚠️ AI: ${aiResult.aiWarning}]`;

        // GUARDIA MESE/ANNO (permanente): la busta viene archiviata sotto il mese/anno
        // del NOME FILE. Se la testata letta dall'AI indica un periodo diverso, NON
        // blocchiamo l'import (l'AI può leggere male la data — es. i cedolini RFI di
        // gennaio citano dicembre dell'anno prima) ma lo segnaliamo per verifica umana:
        // nota "Mese da verificare" sul mese + riepilogo a fine caricamento. CUD escluso
        // (il mese=12 è una convenzione, non un mese reale).
        if (!IS_DEMO && !isCUD) {
          const aiMonthIndex = aiMonthToIndex(aiResult.month);
          const aiYearRaw = parseInt(String(aiResult.year || '').replace(/[^\d]/g, ''));
          const aiYear = !isNaN(aiYearRaw) && aiYearRaw >= 2000 ? aiYearRaw : NaN;
          const meseDiverso =
            foundMonthUiIndex !== -1 && aiMonthIndex !== -1 && aiMonthIndex !== targetMonthIndex;
          const annoDiverso = !!yearMatchUI && !isNaN(aiYear) && aiYear !== targetYear;
          if (meseDiverso || annoDiverso) {
            const archiviato = `${monthNames[targetMonthIndex]} ${targetYear}`;
            const testata = `${aiMonthIndex !== -1 ? monthNames[aiMonthIndex] : '?'} ${!isNaN(aiYear) ? aiYear : '?'}`;
            mismatchFiles.push(`${label}: archiviato ${archiviato}, ma il cedolino sembra ${testata}`);
            if (!row.note?.includes('Mese da verificare')) {
              const nota = `[⚠️ Mese da verificare: archiviato ${archiviato}, il cedolino sembra ${testata}]`;
              row.note = row.note ? `${row.note}${sep}${nota}` : nota;
            }
          }
        }
        // MERCITALIA isola i ticket nella nota con dicitura esatta; gli altri usano il tag generico
        if (worker.profilo === 'MERCITALIA') {
          const ticketCount = parseLocalFloat(aiResult.count);
          if (ticketCount > 0 && ticketVal > 0 && !row.note?.includes('ticket restaurant')) {
            const ticketNote = `Erogati ${Math.round(ticketCount)} ticket restaurant da ${ticketVal.toFixed(2)}€`;
            row.note = row.note ? `${row.note}${sep}[${ticketNote}]` : `[${ticketNote}]`;
          }
          // Storno ferie (righe 3833 negative): correzione retroattiva, isolata nella nota
          const ferieStorno = parseLocalFloat(aiResult.ferieStorno);
          if (ferieStorno > 0 && !row.note?.includes('storno ferie')) {
            const stornoNote = `Rilevato storno ferie periodi prec.: -${ferieStorno.toFixed(1)} gg`;
            row.note = row.note ? `${row.note}${sep}[${stornoNote}]` : `[${stornoNote}]`;
          }
        } else if (!isNaN(ticketVal) && ticketVal > 0 && !row.note?.includes('Ticket')) {
          row.note = row.note
            ? `${row.note}${sep}[🎫 Ticket: €${ticketVal.toFixed(2)}]`
            : `[🎫 Ticket: €${ticketVal.toFixed(2)}]`;
        }

        if (aiResult.imponibile_tfr_mensile !== undefined) {
          const newVal = parseLocalFloat(aiResult.imponibile_tfr_mensile);
          row.imponibile_tfr_mensile = isCUD ? newVal : (row.imponibile_tfr_mensile || 0) + newVal;
        }

        if (aiResult.fondo_pregresso_31_12 !== undefined) {
          const fondoTrovato = parseLocalFloat(aiResult.fondo_pregresso_31_12);
          row.fondo_pregresso_31_12 = fondoTrovato;

          if (fondoTrovato > 0) {
            window.dispatchEvent(
              new CustomEvent('ai-found-tfr-base', {
                detail: {
                  amount: fondoTrovato,
                  year: targetYear - 1,
                },
              })
            );
          }
        }

        if (aiResult.codes && typeof aiResult.codes === 'object') {
          Object.entries(aiResult.codes).forEach(([code, value]) => {
            const numValue = parseLocalFloat(value);
            if (!isNaN(numValue) && numValue !== 0) {
              const matchedCol = expectedColumns.find(c =>
                code.toUpperCase() === c.id.toUpperCase()
              );
              if (matchedCol) {
                row[matchedCol.id] = numValue;
              } else {
                row[code] = numValue;
              }
            }
          });
        }

        currentAnni[rowIndex] = row;
        successCount++;

        // Archivia il PDF in background — non blocca il loop.
        // In demo NON si archivia (nessuno storage Supabase reale).
        if (onArchive && !IS_DEMO) {
          void onArchive(file, targetYear, MONTH_NAMES[targetMonthIndex], targetMonthIndex, aiResult);
        }
      } catch (error) {
        console.error('Errore generico batch', error);
        errorCount++;
        failedFiles.push(label);
      } finally {
        fileDurations.push(performance.now() - fileT0);
        completedCount++;
        if (!isSingle) {
          updateUploadProgress(completedCount);
          if (completedCount % FLUSH_EVERY === 0 && completedCount < files.length) {
            flushPartial();
          }
        }
      }
    };

    // Pool di concorrenza: 3 scansioni simultanee invece del giro sequenziale con
    // pausa fissa di 1.5s — il throttling lo fa la dimensione del pool. Il backend
    // parte da una chiave API casuale del suo pool da 3: statisticamente le
    // richieste parallele non si accodano sullo stesso progetto GCP. Le mutazioni
    // su currentAnni avvengono in blocchi sincroni (nessun await tra findIndex/push
    // e le scritture) → nessuna race tra file dello stesso mese.
    // MISURA (passo 1): default alzato a 10 (era 3). Override a caldo senza redeploy per
    // fare lo sweep dei valori: in console `localStorage.scan_concurrency = '12'` (clamp 1..24),
    // poi rilancia il batch. `localStorage.removeItem('scan_concurrency')` torna al default 10.
    const SCAN_CONCURRENCY = (() => {
      let n = 10;
      try {
        const raw = localStorage.getItem('scan_concurrency');
        if (raw != null && raw.trim() !== '' && Number.isFinite(Number(raw))) n = Math.round(Number(raw));
      } catch { /* storage non disponibile */ }
      return Math.max(1, Math.min(24, n));
    })();
    let nextFile = 0;
    batchRunningRef.current = true;
    try {
      await Promise.all(
        Array.from({ length: Math.min(SCAN_CONCURRENCY, files.length) }, async () => {
          while (nextFile < files.length) {
            await processFile(files[nextFile++]);
          }
        })
      );
    } finally {
      batchRunningRef.current = false;
    }

    // --- RIEPILOGO MISURA (console + notifica) — passo 1 per dimensionare chiavi/pool ---
    const wallSec = (performance.now() - batchT0) / 1000;
    const sumSec = fileDurations.reduce((a, b) => a + b, 0) / 1000;
    const avgSec = fileDurations.length ? sumSec / fileDurations.length : 0;
    const maxSec = fileDurations.length ? Math.max(...fileDurations) / 1000 : 0;
    const effConc = wallSec > 0 ? sumSec / wallSec : 0;      // concorrenza reale ottenuta
    const perMin = wallSec > 0 ? (files.length / wallSec) * 60 : 0;
    const measureLine =
      `⏱️ Misura batch: ${files.length} buste in ${wallSec.toFixed(0)}s ` +
      `(${perMin.toFixed(1)}/min · ~${avgSec.toFixed(0)}s/busta · max ${maxSec.toFixed(0)}s · ` +
      `conc. ${SCAN_CONCURRENCY}→eff ${effConc.toFixed(1)}) · retry ${retryCount} · ` +
      `throttle Gemini ${geminiThrottleCount} · 429 IP ${ipLimitCount}`;
    console.log(
      '%c📊 MISURA BATCH SCAN',
      'font-weight:bold;font-size:13px;color:#0891b2',
      {
        file_totali: files.length, ok: successCount, falliti: errorCount,
        concorrenza_impostata: SCAN_CONCURRENCY,
        tempo_totale_s: +wallSec.toFixed(1),
        buste_al_minuto: +perMin.toFixed(1),
        sec_per_busta_medio: +avgSec.toFixed(1),
        sec_per_busta_max: +maxSec.toFixed(1),
        concorrenza_effettiva: +effConc.toFixed(1),
        retry: retryCount,
        throttle_gemini: geminiThrottleCount,
        limite_ip_429: ipLimitCount,
      }
    );

    currentAnni.sort((a: AnnoDati, b: AnnoDati) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIndex - b.monthIndex;
    });

    setMonthlyInputs(currentAnni);
    if (lastDetectedYear) setCurrentYear(lastDetectedYear);

    finishUpload(successCount, errorCount, uploadType);

    // Feedback per-file a fine caricamento: errori (quali buste riprovare) e mismatch
    // mese/anno (quali buste verificare). I mismatch si mostrano anche sull'upload
    // singolo: un singolo file mal-nominato è proprio il caso tipico (vedi Mottola).
    const MAX_LISTED = 6;
    const formatList = (arr: string[]) => {
      const listed = arr.slice(0, MAX_LISTED).map(name => `•  ${name}`).join('\n');
      const extra = arr.length > MAX_LISTED ? `\n•  …e altri ${arr.length - MAX_LISTED}` : '';
      return `${listed}${extra}`;
    };

    const segments: string[] = [];
    let notifType: 'success' | 'warning' | 'error' = 'success';

    if (!isSingle) segments.push(measureLine);

    if (!isSingle && errorCount > 0) {
      notifType = successCount > 0 ? 'warning' : 'error';
      segments.push(
        `${successCount} buste paga importate, ${errorCount} non riuscite.\nRiprova questi file:\n${formatList(failedFiles)}`
      );
    }

    if (mismatchFiles.length > 0) {
      segments.push(
        `⚠️ ${mismatchFiles.length} busta/e da verificare: archiviata col mese/anno del nome file, ma il cedolino sembra di un altro periodo:\n${formatList(mismatchFiles)}`
      );
    }

    if (segments.length > 0) {
      setBatchNotification({ type: notifType, msg: segments.join('\n\n') });
    }
  };

  const handleBatchUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isSingle = false
  ) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    const files = filterPayslipFiles(Array.from(rawFiles));
    // Reset subito: ri-selezionare la stessa cartella/file ri-scatta onChange.
    e.target.value = '';
    // webkitRelativePath è valorizzato SOLO dal picker-cartella (webkitdirectory):
    // è il discriminante naturale per la Live Activity "cartella".
    const fromFolder = files.some(f => (f as any).webkitRelativePath);
    await runBatch(files, isSingle, !isSingle && fromFolder);
  };

  // --- DROP DI FILE E CARTELLE (anche più cartelle-anno in un colpo solo) ---
  // dataTransfer.files per una cartella trascinata contiene la directory stessa
  // (size 0, illeggibile): i file veri si raccolgono attraversando le entry con
  // webkitGetAsEntry. readEntries restituisce blocchi da max 100 e va richiamato
  // finché non torna vuoto. Ogni file è annotato con il percorso relativo per il
  // riconoscimento dell'anno dalla cartella che lo contiene.
  const collectEntryFiles = async (entry: any, collected: File[]): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      const f: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
      (f as any).relativePath = entry.fullPath || f.name;
      collected.push(f);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      while (true) {
        const batch: any[] = await new Promise((resolve, reject) =>
          reader.readEntries(resolve, reject)
        );
        if (batch.length === 0) break;
        for (const child of batch) await collectEntryFiles(child, collected);
      }
    }
  };

  const handleBatchDrop = async (dataTransfer: DataTransfer) => {
    // Le entry vanno estratte SINCRONAMENTE: dopo il primo await il browser
    // invalida i DataTransferItem del drop.
    const entries = dataTransfer.items
      ? Array.from(dataTransfer.items)
          .map(it => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null))
          .filter(Boolean)
      : [];
    const hasFolder = entries.some((entry: any) => entry?.isDirectory);
    let dropped: File[] = [];
    if (entries.length > 0) {
      for (const entry of entries) await collectEntryFiles(entry, dropped);
    } else {
      dropped = Array.from(dataTransfer.files || []);
    }
    await runBatch(filterPayslipFiles(dropped), false, hasFolder);
  };

  // --- UPLOAD SINGOLO (wrapper) ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      await handleBatchUpload(event, true);
      if (scanRef.current) scanRef.current.value = '';
    }
  };

  return {
    isAnalyzing,
    isBatchProcessing,
    batchProgress,
    batchTotal,
    batchNotification,
    setBatchNotification,
    isQRModalOpen,
    setIsQRModalOpen,
    scanRef,
    handleBatchUpload,
    handleBatchDrop,
    handleFileUpload,
    handleQRData,
  };
}
