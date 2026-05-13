import React, { useState, useRef, useEffect } from 'react';
import { useIsland } from '../IslandContext';
import { Worker, AnnoDati, getColumnsByProfile, MONTH_NAMES } from '../types';
import { parseLocalFloat } from '../utils/formatters';

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
  const batchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (batchNotification) {
      const timer = setTimeout(() => setBatchNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [batchNotification]);

  const delay = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

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
    if (['RFI', 'ELIOR', 'REKEEP'].includes(worker.profilo)) return null;
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
              code.toUpperCase().includes(c.id.toUpperCase())
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

  // --- LOGICA UPLOAD COLLEGATA ALLA DYNAMIC ISLAND (CON PARSER TITANIUM V2) ---
  const handleBatchUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isSingle = false
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    startUpload(isSingle ? 'single' : 'batch', files.length);

    let currentAnni = JSON.parse(JSON.stringify(monthlyInputs));
    let successCount = 0;
    let errorCount = 0;
    let lastDetectedYear = null;

    const expectedColumns = getColumnsByProfile(worker.profilo, worker.eliorType) || [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const monthNames = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
      ];
      let label = file.name;
      const foundMonthUiIndex = monthNames.findIndex(m =>
        file.name.toLowerCase().includes(m.toLowerCase())
      );
      const yearMatchUI = file.name.match(/(20\d{2})/);

      if (foundMonthUiIndex !== -1) {
        label = yearMatchUI
          ? `${monthNames[foundMonthUiIndex]} ${yearMatchUI[1]}`
          : monthNames[foundMonthUiIndex];
      } else {
        label = file.name.length > 18 ? file.name.substring(0, 18) + '...' : file.name;
      }
      window.dispatchEvent(new CustomEvent('island-scan-label', { detail: label }));

      if (!isSingle) updateUploadProgress(i + 1);

      try {
        const base64String = await toBase64(file);

        const response = await fetch('/.netlify/functions/scan-payslip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64String,
            mimeType: file.type || 'application/pdf',
            company: worker.profilo,
            eliorType: worker.eliorType,
            customColumns: getCustomColumnsForAI(),
          }),
        });

        const responseText = await response.text();
        let aiResult;

        try {
          let parsed = JSON.parse(responseText);

          // Scudo anti-allucinazioni strutturali dell'IA
          if (Array.isArray(parsed)) parsed = parsed[0];
          if (parsed && parsed.data) parsed = parsed.data;
          if (parsed && parsed.payslip) parsed = parsed.payslip;
          if (parsed && parsed.risultato) parsed = parsed.risultato;

          aiResult = parsed;
        } catch (e) {
          console.error(`❌ Il server ha fallito sul file ${file.name}. Risposta:`, responseText);
          errorCount++;
          continue;
        }

        if (!response.ok || !aiResult || aiResult.error) {
          console.error(`Errore file ${file.name}`, aiResult?.error || 'Nessun dato valido');
          errorCount++;
          continue;
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
          continue;
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
        if (!isNaN(ticketVal) && ticketVal > 0 && !row.note?.includes('Ticket'))
          row.note = row.note
            ? `${row.note}${sep}[🎫 Ticket: €${ticketVal.toFixed(2)}]`
            : `[🎫 Ticket: €${ticketVal.toFixed(2)}]`;

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
                code.toUpperCase().includes(c.id.toUpperCase())
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

        // Archivia il PDF in background — non blocca il loop
        if (onArchive) {
          void onArchive(file, targetYear, MONTH_NAMES[targetMonthIndex], targetMonthIndex, aiResult);
        }
      } catch (error) {
        console.error('Errore generico batch', error);
        errorCount++;
      }

      if (!isSingle && i < files.length - 1) {
        await delay(1500);
      }
    }

    currentAnni.sort((a: AnnoDati, b: AnnoDati) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthIndex - b.monthIndex;
    });

    setMonthlyInputs(currentAnni);
    if (lastDetectedYear) setCurrentYear(lastDetectedYear);

    if (batchInputRef.current) batchInputRef.current.value = '';

    finishUpload(successCount, errorCount, isSingle ? 'single' : 'batch');
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
    batchInputRef,
    handleBatchUpload,
    handleFileUpload,
    handleQRData,
    getCustomColumnsForAI,
  };
}
