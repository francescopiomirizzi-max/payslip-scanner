import React, { useState, useRef } from 'react';
import { AnnoDati, ColumnDef, MONTH_NAMES } from '../types';

interface UseOCRSniperOptions {
  monthlyInputs: AnnoDati[];
  setMonthlyInputs: React.Dispatch<React.SetStateAction<AnnoDati[]>>;
  currentYear: number;
  activeCell: { row: number; col: string } | null;
  currentFileUrl?: string | null;
  columnDefs?: ColumnDef[];
}

const SPECIAL_COL_LABELS: Record<string, string> = {
  daysWorked: 'Giorni Lavorati (Presenze / GG INPS)',
  daysVacation: 'Giorni di Ferie godute nel mese',
  ticket: 'Ticket Restaurant — valore unitario del singolo buono pasto',
  arretrati: 'Arretrati o importi una tantum',
};

export function useOCRSniper({
  monthlyInputs,
  setMonthlyInputs,
  currentYear,
  activeCell,
  currentFileUrl,
  columnDefs = [],
}: UseOCRSniperOptions) {
  const [isSniperMode, setIsSniperMode] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    x: number; y: number; w: number; h: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateDataWithOcr = (value: string) => {
    if (!activeCell) return;
    const { row, col } = activeCell;
    const existingRow = monthlyInputs.find(
      d => d.year === currentYear && d.monthIndex === row
    );
    const updatedRow = {
      ...(existingRow || {
        year: currentYear,
        monthIndex: row,
        month: MONTH_NAMES[row],
        daysWorked: 0,
        daysVacation: 0,
        ticket: 0,
      }),
      [col]: value,
    };
    const otherData = monthlyInputs.filter(
      d => !(d.year === currentYear && d.monthIndex === row)
    );
    setMonthlyInputs([...otherData, updatedRow]);
  };

  const performOcr = async (_crop: { x: number; y: number; w: number; h: number }) => {
    if (!activeCell) {
      setSelectionBox(null);
      setIsSniperMode(false);
      return;
    }

    setIsProcessing(true);

    const colDef = columnDefs.find(c => c.id === activeCell.col);
    const colLabel = SPECIAL_COL_LABELS[activeCell.col]
      ?? (colDef ? `${colDef.label} (codice ${activeCell.col})` : `codice ${activeCell.col}`);

    try {
      const fileUrl = currentFileUrl ?? (imgRef.current?.src ?? '');
      if (!fileUrl) throw new Error('Nessun file disponibile nel visore');

      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const base64Full = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      const mimeType = blob.type || 'application/pdf';

      const netlifyRes = await fetch('/.netlify/functions/scan-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData: base64Full, mimeType, action: 'ocr', colLabel })
      });

      const data = await netlifyRes.json();
      if (!netlifyRes.ok) {
        console.error('OCR Netlify error:', data.error ?? netlifyRes.status);
      } else {
        const rawText = (data.value ?? '').trim();
        const cleaned = rawText.replace(/[^\d,.\-]/g, '').replace(',', '.');
        if (cleaned && isFinite(parseFloat(cleaned))) {
          updateDataWithOcr(cleaned);
        }
      }
    } catch (err) {
      console.error('Errore OCR:', err);
    }

    setIsProcessing(false);
    setSelectionBox(null);
    setIsSniperMode(false);
  };

  const onSniperMouseDown = (
    e: React.MouseEvent,
    imgScale: number,
    imgPos: { x: number; y: number }
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left - imgPos.x) / imgScale;
    const startY = (e.clientY - rect.top - imgPos.y) / imgScale;
    setSelectionBox({ x: startX, y: startY, w: 0, h: 0 });
    setIsSelecting(true);
  };

  const onSniperMouseMove = (
    e: React.MouseEvent,
    imgScale: number,
    imgPos: { x: number; y: number }
  ) => {
    if (!isSelecting || !selectionBox || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left - imgPos.x) / imgScale;
    const currentY = (e.clientY - rect.top - imgPos.y) / imgScale;
    setSelectionBox({ ...selectionBox, w: currentX - selectionBox.x, h: currentY - selectionBox.y });
  };

  const onSniperMouseUp = () => {
    if (!isSelecting || !selectionBox) return;
    const finalBox = {
      x: selectionBox.w > 0 ? selectionBox.x : selectionBox.x + selectionBox.w,
      y: selectionBox.h > 0 ? selectionBox.y : selectionBox.y + selectionBox.h,
      w: Math.abs(selectionBox.w),
      h: Math.abs(selectionBox.h),
    };
    if (finalBox.w > 5 && finalBox.h > 5) {
      performOcr(finalBox);
    } else {
      setSelectionBox(null);
    }
    setIsSelecting(false);
  };

  return {
    isSniperMode,
    setIsSniperMode,
    selectionBox,
    isSelecting,
    isProcessing,
    imgRef,
    containerRef,
    onSniperMouseDown,
    onSniperMouseMove,
    onSniperMouseUp,
  };
}
