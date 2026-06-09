import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

/**
 * "Fotografa" un nodo del DOM (il prospetto del report a schermo) e lo impagina in un
 * PDF A4 orizzontale — l'equivalente programmatico del tasto Stampa, che fa di fatto uno
 * screenshot della pagina. Si usa html-to-image (SVG foreignObject) e non html2canvas
 * perché il primo delega il rendering al browser e gestisce i colori `oklch` di Tailwind v4.
 *
 * L'immagine viene scalata per stare INTERA in una pagina (come lo zoom della stampa),
 * mantenendo le proporzioni e centrata.
 */
export async function captureReportPdfBlob(node: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,            // alta risoluzione, testo nitido
    backgroundColor: '#ffffff',
    cacheBust: true,
  });

  // Dimensioni reali (px) dell'immagine catturata, per calcolare le proporzioni.
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Immagine del report non caricabile'));
    img.src = dataUrl;
  });

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const ratio = Math.min((pageW - margin * 2) / img.width, (pageH - margin * 2) / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  pdf.addImage(dataUrl, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);

  return pdf.output('blob');
}
