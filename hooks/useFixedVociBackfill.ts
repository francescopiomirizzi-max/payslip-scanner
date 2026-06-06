import { useState, useCallback, useRef } from 'react';
import { AnnoDati, MONTH_NAMES } from '../types';
import { mergeFixedVociIntoAnni, deriveFixedVociPeriod } from '../utils/fixedVociBackfill';
import { useIsland } from '../IslandContext';

export interface BackfillPick {
  storage_path: string;
  year: number;
  monthIdx: number;
}

export interface BackfillProgress {
  running: boolean;
  total: number;
  done: number;
  updated: number;
  errors: number;
}

const IDLE: BackfillProgress = { running: false, total: 0, done: 0, updated: 0, errors: 0 };

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      let r = reader.result as string;
      if (r.includes(',')) r = r.split(',')[1];
      resolve(r);
    };
    reader.onerror = reject;
  });

/**
 * Backfill MIRATO delle voci fisse (Quadro B) dalle buste già archiviate.
 * Per ogni busta: signed URL → immagine → action 'fixed-voci' (estrazione leggera) →
 * `mergeFixedVociIntoAnni` (scrive SOLO i 3B.., niente clobber). Alla fine richiama
 * `onResult` con il nuovo array `anni`. Sequenziale per non saturare la quota Gemini.
 */
export function useFixedVociBackfill() {
  const [progress, setProgress] = useState<BackfillProgress>(IDLE);
  const abortRef = useRef(false);
  const { startUpload, updateUploadProgress, finishUpload } = useIsland();

  // Richiesta di stop: il loop si ferma all'iterazione successiva (i mesi già fatti restano salvati).
  const stop = useCallback(() => { abortRef.current = true; }, []);

  const run = useCallback(async (params: {
    picks: BackfillPick[];
    anni: AnnoDati[];
    company: string;
    getSignedUrls: (paths: string[]) => Promise<Record<string, string>>;
    onResult: (anni: AnnoDati[]) => void;
  }): Promise<{ updated: number; errors: number }> => {
    const { picks, anni, company, getSignedUrls, onResult } = params;
    if (!Array.isArray(picks) || picks.length === 0) return { updated: 0, errors: 0 };

    abortRef.current = false;
    setProgress({ running: true, total: picks.length, done: 0, updated: 0, errors: 0 });
    startUpload('batch', picks.length); // avanzamento sulla Dynamic Island

    let working = anni;
    let updated = 0;
    let errors = 0;
    let done = 0;

    const urlMap = await getSignedUrls(picks.map(p => p.storage_path));

    // PIPELINE: scarica+codifica la busta dall'archivio. NON rigetta mai (null su errore),
    // così un prefetch ancora in volo non genera unhandled rejection se ci si ferma prima.
    const fetchImage = async (pick: BackfillPick): Promise<{ fileData: string; mimeType: string } | null> => {
      try {
        const url = urlMap[pick.storage_path];
        if (!url) return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return { fileData: await blobToBase64(blob), mimeType: blob.type || 'application/pdf' };
      } catch {
        return null;
      }
    };

    // Avvia subito il download della prima busta; poi, mentre l'AI lavora sulla busta i,
    // scarichiamo già la i+1 (download e AI sovrapposti). Le chiamate AI restano UNA per
    // volta (await in serie) → nessun aumento di concorrenza verso Gemini, niente rate-limit.
    let prefetch: Promise<{ fileData: string; mimeType: string } | null> = fetchImage(picks[0]);

    for (let i = 0; i < picks.length; i++) {
      if (abortRef.current) break; // stop richiesto: i mesi già fatti sono salvati a fine ciclo
      const pick = picks[i];
      const currentImage = prefetch;
      // Inizia il download della prossima ORA: girerà durante l'AI di questa busta.
      prefetch = (i + 1 < picks.length && !abortRef.current)
        ? fetchImage(picks[i + 1])
        : Promise.resolve(null);

      // Etichetta sull'isola: mese in lavorazione (es. "GEN 2013 · voci fisse")
      window.dispatchEvent(new CustomEvent('island-scan-label', {
        detail: `${(MONTH_NAMES[pick.monthIdx] || '').substring(0, 3)} ${pick.year} · voci fisse`,
      }));
      try {
        const img = await currentImage; // download (quasi sempre già pronto grazie al prefetch)
        if (!img) throw new Error('Immagine non disponibile');

        // Retry come usePayslipUpload: 1 secondo tentativo contro la coda lunga di Gemini.
        let codes: Record<string, number> | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const res = await fetch('/.netlify/functions/scan-payslip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'fixed-voci',
              fileData: img.fileData,
              mimeType: img.mimeType,
              company,
            }),
          });
          if (res.ok) {
            const j = await res.json();
            if (j && j.codes) { codes = j.codes; break; }
          }
        }
        if (!codes) throw new Error('Estrazione fallita');

        const merged = mergeFixedVociIntoAnni(working, pick.year, pick.monthIdx, codes);
        if (merged.updated) { working = merged.anni; updated++; }
      } catch {
        errors++;
      }
      done++;
      updateUploadProgress(done);
      setProgress({ running: true, total: picks.length, done, updated, errors });
    }

    if (updated > 0) onResult(working);
    finishUpload(updated, errors, 'batch');
    setProgress({ running: false, total: picks.length, done, updated, errors });
    return { updated, errors };
  }, [startUpload, updateUploadProgress, finishUpload]);

  /**
   * Variante per buste NON in archivio: estrae le voci fisse da FILE caricati dal disco
   * (stessa estrazione leggera `action: 'fixed-voci'`, stesso merge-safe). Il periodo
   * (anno/mese) arriva dall'AI (testata del cedolino) con fallback sul nome del file.
   * Se fornito, `onArchive(file, year, monthIdx)` archivia anche la busta (bonus): la
   * deduplica (saltare i mesi già in archivio) è a carico del chiamante, perché l'insert
   * dei metadati non è idempotente.
   */
  const runFromFiles = useCallback(async (params: {
    files: File[];
    anni: AnnoDati[];
    company: string;
    onResult: (anni: AnnoDati[]) => void;
    onArchive?: (file: File, year: number, monthIdx: number) => Promise<void>;
  }): Promise<{ updated: number; errors: number; skipped: number }> => {
    const { files, anni, company, onResult, onArchive } = params;
    if (!Array.isArray(files) || files.length === 0) return { updated: 0, errors: 0, skipped: 0 };

    abortRef.current = false;
    setProgress({ running: true, total: files.length, done: 0, updated: 0, errors: 0 });
    startUpload('batch', files.length);

    let working = anni;
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    let done = 0;

    for (const file of files) {
      if (abortRef.current) break;
      window.dispatchEvent(new CustomEvent('island-scan-label', {
        detail: `${(file.name || '').substring(0, 16)} · voci fisse`,
      }));
      try {
        const fileData = await blobToBase64(file);

        let parsed: { codes?: Record<string, number>; month?: number; year?: number } | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const res = await fetch('/.netlify/functions/scan-payslip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'fixed-voci',
              fileData,
              mimeType: file.type || 'application/pdf',
              company,
            }),
          });
          if (res.ok) {
            const j = await res.json();
            if (j && j.codes) { parsed = j; break; }
          }
        }
        if (!parsed || !parsed.codes) throw new Error('Estrazione fallita');

        const period = deriveFixedVociPeriod(parsed.month, parsed.year, file.name || '');
        if (!period) {
          skipped++; // periodo non identificabile: non indoviniamo dove scrivere
        } else {
          const merged = mergeFixedVociIntoAnni(working, period.year, period.monthIdx, parsed.codes);
          if (merged.updated) { working = merged.anni; updated++; }
          else skipped++; // nessuna riga per quel mese, o valori già identici
          if (onArchive) { try { await onArchive(file, period.year, period.monthIdx); } catch { /* archiviazione best-effort */ } }
        }
      } catch {
        errors++;
      }
      done++;
      updateUploadProgress(done);
      setProgress({ running: true, total: files.length, done, updated, errors });
    }

    if (updated > 0) onResult(working);
    finishUpload(updated, errors, 'batch');
    setProgress({ running: false, total: files.length, done, updated, errors });
    return { updated, errors, skipped };
  }, [startUpload, updateUploadProgress, finishUpload]);

  const reset = useCallback(() => setProgress(IDLE), []);

  return { progress, run, runFromFiles, stop, reset };
}
