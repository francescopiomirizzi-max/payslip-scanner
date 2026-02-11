import React, { useMemo, useState } from 'react';
import { Worker, AnnoDati, parseFloatSafe, YEARS, getColumnsByProfile } from '../types';
import {
  Printer,
  ArrowLeft,
  FileDown,
  FileSpreadsheet,
  LayoutGrid,
  FileText,
  Gavel,
  CalendarPlus,
  AlertCircle,
  Info // <--- 1. IMPORTIAMO L'ICONA INFO
} from 'lucide-react';
import { RelazioneModal } from '../RelazioneModal';
import { motion, AnimatePresence } from 'framer-motion'; // <--- 2. IMPORTIAMO FRAMER MOTION
// LIBRERIE PDF NATIVE
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TableComponentProps {
  worker: Worker;
  onBack: () => void;
  onEdit: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const TableComponent: React.FC<TableComponentProps> = ({ worker, onBack, onEdit }) => {

  const [isRelazioneOpen, setIsRelazioneOpen] = useState(false);

  // --- STATO PER IL TETTO FERIE (28 vs 32) ---
  const [includeExFest, setIncludeExFest] = useState(false);

  // --- STATO PER IL TOOLTIP INFORMATIVO ---
  const [showInfoTetto, setShowInfoTetto] = useState(false);

  // --- 1. LOGICA DATI CORRETTA CON TETTO FERIE (MESE PER MESE) ---
  const tableData = useMemo(() => {
    const sortedYears = [...YEARS].sort((a: number, b: number) => a - b);

    // Definiamo il limite annuale
    const TETTO_FERIE = includeExFest ? 32 : 28;

    return sortedYears.map(year => {
      const yearRows = worker.anni?.filter(r => r.year === year) || [];

      // Accumulatori per i dati da visualizzare (Statistici)
      let displayTotalVoci = 0;
      let displayTotalDaysWorked = 0;

      // Accumulatori FINANZIARI (Somma dei calcoli mensili)
      let yearlyGrossAmount = 0; // Totale Lordo (Somma dei lordi mensili)
      let yearlyPercepitoVal = 0;
      let yearlyTicketVal = 0;
      let yearlyDaysVacationUtili = 0;

      // Contatore per il limite annuale (si resetta a ogni anno)
      let ferieCumulateCounter = 0;

      const profileColumns = getColumnsByProfile(worker.profilo);

      // Ordiniamo le righe per mese per garantire il calcolo progressivo corretto
      const sortedRows = [...yearRows].sort((a, b) => a.monthIndex - b.monthIndex);

      sortedRows.forEach(row => {
        // A. Calcolo Voci del MESE
        let monthlyVoci = 0;
        profileColumns.forEach(col => {
          // MODIFICA FONDAMENTALE: Aggiunto 'arretrati' per escluderlo dal conteggio lordo
          if (!['month', 'total', 'daysWorked', 'daysVacation', 'ticket', 'coeffPercepito', 'coeffTicket', 'note', 'arretrati'].includes(col.id)) {
            monthlyVoci += parseFloatSafe(row[col.id]);
          }
        });

        // B. Recupera Giorni MESE
        const gLav = parseFloatSafe(row.daysWorked);
        const gFerieReali = parseFloatSafe(row.daysVacation);

        // --- C. LOGICA CRUCIALE: FILTRO GIORNI UTILI ---
        const prevTotal = ferieCumulateCounter;
        ferieCumulateCounter += gFerieReali;

        let gFerieUtili = 0;
        if (prevTotal < TETTO_FERIE) {
          const spazioRimanente = TETTO_FERIE - prevTotal;
          gFerieUtili = Math.min(gFerieReali, spazioRimanente);
        } else {
          gFerieUtili = 0; // Tetto superato
        }

        // Aggiorniamo i contatori statistici
        displayTotalVoci += monthlyVoci;
        displayTotalDaysWorked += gLav;
        yearlyDaysVacationUtili += gFerieUtili;

        // D. CALCOLO FINANZIARIO PUNTUALE (MESE PER MESE)
        // Questo garantisce che la cifra sia identica alla "AnnualCalculationTable"
        let monthlySpettante = 0;
        if (gLav > 0) {
          // (Totale Mese / Giorni Lav Mese) * Giorni Ferie Utili Mese
          monthlySpettante = (monthlyVoci / gLav) * gFerieUtili;
        }
        yearlyGrossAmount += monthlySpettante;

        // E. Calcolo Percepito e Ticket sui GG UTILI
        const coeffPercepito = parseFloatSafe(row.coeffPercepito);
        const coeffTicket = parseFloatSafe(row.coeffTicket);

        yearlyPercepitoVal += (gFerieUtili * coeffPercepito);
        yearlyTicketVal += (gFerieUtili * coeffTicket);
      });

      // Calcolo Netto Annuale
      const netAmount = (yearlyGrossAmount - yearlyPercepitoVal) + yearlyTicketVal;

      // Calcolo Incidenza Media (Solo per visualizzazione nel report)
      // Se ho pagato 1000€ per 10 giorni di ferie, la media è 100€/giorno
      const avgDailyIncidence = yearlyDaysVacationUtili > 0
        ? yearlyGrossAmount / yearlyDaysVacationUtili
        : 0;

      return {
        anno: year,
        totaleVoci: displayTotalVoci,        // Solo statistico
        divisore: displayTotalDaysWorked,    // Solo statistico
        incidenzaGiornata: avgDailyIncidence,// Media Ponderata Reale
        giornateFerie: yearlyDaysVacationUtili,
        incidenzaTotale: yearlyGrossAmount,  // SOMMA ESATTA DEI MESI
        indennitaPercepita: yearlyPercepitoVal,
        totaleDaPercepire: netAmount,
        indennitaPasto: yearlyTicketVal
      };
    })
      // AGGIUNGI QUESTO FILTRO:
      .filter(row => row.anno >= 2008);
  }, [worker, includeExFest]);

  // 2. CALCOLO TOTALI GENERALI
  const totals = useMemo(() => {
    return tableData.reduce((acc, row) => ({
      incidenzaTotale: acc.incidenzaTotale + row.incidenzaTotale,
      indennitaPercepita: acc.indennitaPercepita + row.indennitaPercepita,
      totaleDaPercepire: acc.totaleDaPercepire + row.totaleDaPercepire,
      indennitaPasto: acc.indennitaPasto + row.indennitaPasto
    }), {
      incidenzaTotale: 0,
      indennitaPercepita: 0,
      totaleDaPercepire: 0,
      indennitaPasto: 0
    });
  }, [tableData]);

  // Prende il primo anno effettivamente visibile in tabella (es. 2008)
  const startYear = tableData.length > 0 ? tableData[0].anno : 2008;
  const endYear = tableData.length > 0 ? tableData[tableData.length - 1].anno : 2025;

  // STAMPA SCHERMO
  const handlePrint = () => {
    window.print();
  };

  // --- GENERAZIONE DIFFIDA LEGALE (AGGIORNATA CASS. 20216/2022) ---
  const handlePrintDiffida = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const today = new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });

    // Configurazione Font
    doc.setFont("times", "roman");
    doc.setTextColor(0, 0, 0);

    // 1. INTESTAZIONE STUDIO / UFFICIO
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text("UFFICIO VERTENZE E LEGALE", 20, 20);
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    doc.text("SEDE TERRITORIALE", 20, 25);

    // 2. DATI E OGGETTO
    doc.setFontSize(11);
    doc.text(`Luogo, lì ${today}`, 140, 40);

    doc.setFont("times", "bold");
    doc.text("Spett.le Azienda", 120, 55);
    doc.text("Direzione Risorse Umane", 120, 60);
    doc.text("(c.a. Responsabile p.t.)", 120, 65);
    doc.text("SEDE", 120, 70);

    doc.setFont("times", "bold");
    doc.text(`OGGETTO: Diffida ad adempiere e costituzione in mora - Ricalcolo Retribuzione Feriale.`, 20, 90);
    doc.text(`Lavoratore: ${worker.cognome} ${worker.nome} (Matr. ${worker.id})`, 20, 95);

    // 3. CORPO DEL TESTO (Basato su Cass. 20216/2022 e Documenti Utente)
    doc.setFont("times", "normal");

    // Logica per i codici specifici (da foto ricorso)
    let testoCodici = "";
    if (worker.profilo === 'RFI' || !worker.profilo) {
      testoCodici = "L'analisi ha evidenziato la mancata inclusione delle voci variabili ricorrenti, tra cui a titolo esemplificativo: Straordinario Diurno (0152), Notturno (0421), Chiamata (0470, 0496), Reperibilità (0482), Ind. Linea (0687), Trasferta (0AA1) e altre indennità accessorie contrattualmente previste.";
    } else if (worker.profilo === 'REKEEP') {
      testoCodici = "L'analisi ha evidenziato la mancata inclusione delle indennità specifiche di appalto (Turni non cadenzati, Ind. Sussidiaria, Maggiorazioni) previste dal CCNL Multiservizi/Ferroviario.";
    }

    const bodyText = `
Scrivo in nome e per conto del Sig. ${worker.nome} ${worker.cognome}, vostro dipendente, il quale mi ha conferito espresso mandato per la tutela dei suoi diritti patrimoniali.

Dall'esame della documentazione retributiva relativa al periodo ${startYear} - ${endYear}, è emerso che la Vostra Società non ha correttamente incluso le voci retributive accessorie e variabili nella base di calcolo della retribuzione feriale, in violazione dell'Art. 36 della Costituzione, della Direttiva 2003/88/CE e dei principi di diritto consolidati dalla Corte di Cassazione (Sent. n. 20216 del 23/06/2022).

Nello specifico, il ricalcolo è stato effettuato applicando il "principio di onnicomprensività" della retribuzione feriale, utilizzando come divisore le giornate lavorative effettive e come moltiplicatore i giorni di ferie fruiti (entro il limite del periodo minimo protetto di ${includeExFest ? "32" : "28"} giorni annui).

${testoCodici}

Tutto ciò premesso, con la presente

VI INVITO E DIFFIDO

a corrispondere al mio assistito, entro e non oltre 10 giorni dal ricevimento della presente, la somma complessiva di:

EURO ${formatCurrency(totals.totaleDaPercepire)} (Netto differenze ricalcolate)

Tale somma è comprensiva delle differenze retributive maturate e del valore dei buoni pasto non riconosciuti, oltre agli interessi legali e alla rivalutazione monetaria maturati dal dovuto al saldo effettivo.

In difetto di riscontro entro il termine assegnato, sarò costretto ad adire l'Autorità Giudiziaria competente per il recupero coattivo del credito e delle spese legali, senza ulteriore avviso.

Distinti saluti.
    `;

    // Gestione del testo lungo su più pagine se necessario
    const splitText = doc.splitTextToSize(bodyText.trim(), 170);
    let currentY = 110;

    // Controllo se il testo sfora la pagina
    if (splitText.length > 30) {
      doc.addPage();
      currentY = 20;
    }

    doc.text(splitText, 20, currentY);

    // 4. FIRME
    const signY = currentY + (splitText.length * 5) + 20; // Posizione dinamica in base alla lunghezza testo

    // Se siamo troppo in basso, nuova pagina per le firme
    if (signY > 250) {
      doc.addPage();
      doc.text("Firme:", 20, 20);
    }

    doc.setFont("times", "bold");
    doc.text("Il Lavoratore (per ratifica)", 30, signY > 250 ? 40 : signY);
    doc.text("L'Ufficio Vertenze / Legale", 120, signY > 250 ? 40 : signY);

    doc.setLineWidth(0.1);
    doc.line(30, (signY > 250 ? 40 : signY) + 15, 90, (signY > 250 ? 40 : signY) + 15);
    doc.line(120, (signY > 250 ? 40 : signY) + 15, 180, (signY > 250 ? 40 : signY) + 15);

    // Salvataggio
    doc.save(`Diffida_${worker.cognome}_${worker.nome}.pdf`);
  };

  // --- GENERAZIONE REPORT PDF UFFICIALE ---
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const fmt = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-';
    const fmtNum = (n: number) => n !== 0 ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

    doc.setFillColor(23, 37, 84);
    doc.rect(0, 0, 297, 25, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("PROSPETTO UFFICIALE DI RICALCOLO", 14, 12);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 200);
    doc.text(`Dipendente: ${worker.cognome} ${worker.nome} (Matr. ${worker.id})`, 14, 18);
    doc.text(`Periodo: ${startYear} - ${endYear}`, 14, 22);

    const tableBody = tableData.map(row => [
      row.anno,
      fmt(row.totaleVoci),
      fmtNum(row.divisore),
      fmt(row.incidenzaGiornata),
      fmtNum(row.giornateFerie), // Usa giorni UTILI
      fmt(row.incidenzaTotale),
      fmt(row.indennitaPercepita),
      fmt(row.totaleDaPercepire),
      fmt(row.indennitaPasto)
    ]);

    tableBody.push([
      'TOTALE',
      '-',
      '-',
      '-',
      '-',
      fmt(totals.incidenzaTotale),
      fmt(totals.indennitaPercepita),
      fmt(totals.totaleDaPercepire),
      fmt(totals.indennitaPasto)
    ]);

    autoTable(doc, {
      startY: 35,
      head: [[
        'ANNO',
        'TOT. VOCI\nRETRIBUTIVE',
        'DIVISORE\nANNUO',
        'INCIDENZA\nGIORNALIERA',
        'GIORNI FERIE\n(PAGABILI)',
        'LORDO\nFERIE',
        'INDENNITÀ\nPERCEPITA',
        'NETTO DA\nPERCEPIRE',
        'CREDITO\nTICKET'
      ]],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle',
        halign: 'right',
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        textColor: [50, 50, 50]
      },
      headStyles: {
        fillColor: [23, 37, 84],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] },
        3: { textColor: [30, 64, 175], fontStyle: 'bold' },
        7: { fontStyle: 'bold', fillColor: [254, 249, 195], textColor: [0, 0, 0], fontSize: 10 },
        8: { textColor: [22, 163, 74] }
      },
      didParseCell: (data) => {
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
          if (data.column.index === 0) {
            data.cell.styles.halign = 'left';
            data.cell.styles.fillColor = [22, 163, 74];
            data.cell.styles.textColor = [255, 255, 255];
          } else if (data.column.index === 7) {
            data.cell.styles.fillColor = [220, 38, 38];
            data.cell.styles.textColor = [255, 255, 255];
          }
        }
      }
    });

    // @ts-ignore
    let finalY = doc.lastAutoTable.finalY + 30;
    if (finalY > 170) { doc.addPage(); finalY = 40; }

    doc.setFontSize(10);
    doc.setTextColor(0);

    doc.text("Firma del Dipendente", 60, finalY, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(30, finalY + 10, 90, finalY + 10);

    doc.text("Timbro e Firma Responsabile", 230, finalY, { align: 'center' });
    doc.line(200, finalY + 10, 260, finalY + 10);

    doc.save(`Prospetto_${worker.cognome}_${worker.nome}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col items-center font-sans text-gray-900 pb-20">

      {/* CSS STAMPA BROWSER */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 0mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; zoom: 75%; padding: 10mm; }
          .no-print { display: none !important; }
          .print-container { overflow: visible !important; width: 100% !important; display: block !important; }
          table { width: 100% !important; font-size: 12px !important; }
          tr.bg-blue-header { background-color: #7EB6D3 !important; color: black !important; }
          td.bg-green-total { background-color: #92D050 !important; }
          td.bg-red-total { background-color: #FF5050 !important; color: white !important; }
          td.bg-yellow-cell { background-color: #fef08a !important; }
        }
      `}</style>

      {/* HEADER NAV */}
      <div className="no-print w-full p-5 bg-slate-900 text-white flex justify-between items-center shadow-2xl sticky top-0 z-50 border-b border-slate-700">
        <div className="flex items-center gap-8">
          {/* TASTO DASHBOARD */}
          <button
            onClick={onBack}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.5} />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center gap-4 border-l border-slate-700 pl-8 h-full">
            <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
              <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wide text-slate-100">Prospetto Ufficiale</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm uppercase font-medium text-slate-400 tracking-wider">Report Annuale</p>

                {/* BADGE INDICATORE TETTO */}
                <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${includeExFest ? 'text-amber-400 border-amber-500 bg-amber-500/10' : 'text-slate-400 border-slate-500'}`}>
                  {includeExFest ? <AlertCircle size={10} /> : null}
                  {includeExFest ? 'Tetto 32gg' : 'Tetto 28gg'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">

          {/* --- NUOVO GRUPPO TOGGLE CON INFO --- */}
          <div className="relative flex items-center gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">

            {/* Tasto Toggle */}
            <button
              onClick={() => setIncludeExFest(!includeExFest)}
              className={`group relative px-4 py-2 rounded-xl font-bold text-xs shadow-lg transition-all duration-300 flex items-center gap-2 ${includeExFest
                ? 'bg-amber-600 text-white border border-amber-400'
                : 'bg-slate-700 text-slate-300 border border-slate-600 hover:text-white'
                }`}
            >
              <CalendarPlus className="w-4 h-4" />
              <div className="flex flex-col items-start leading-none">
                <span>{includeExFest ? "Includi Ex-Fest" : "Escludi Ex-Fest"}</span>
                <span className="text-[9px] opacity-80 font-normal mt-0.5">{includeExFest ? "Max 32gg/anno" : "Max 28gg/anno"}</span>
              </div>
            </button>

            {/* Tasto Info */}
            <button
              onClick={() => setShowInfoTetto(!showInfoTetto)}
              className={`p-2 rounded-xl transition-all ${showInfoTetto ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
            >
              <Info className="w-5 h-5" />
            </button>

            {/* --- TOOLTIP/MODALE INFORMATIVO FLUTTUANTE --- */}
            <AnimatePresence>
              {showInfoTetto && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-4 w-96 bg-white text-slate-800 p-5 rounded-2xl shadow-2xl border border-slate-200 z-[100] text-left"
                >
                  {/* Freccetta in alto */}
                  <div className="absolute -top-2 right-12 w-4 h-4 bg-white transform rotate-45 border-t border-l border-slate-200"></div>

                  <h4 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Nota Metodologica
                  </h4>

                  <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                      <strong className="block text-green-700 mb-1">🟢 Tetto 28 Giorni (Standard Legale)</strong>
                      Si basa sul periodo minimo di ferie (4 settimane) garantito dalla <strong>Direttiva UE 2003/88</strong> e dall'Art. 36 Cost. È il parametro "blindato" confermato dalla Cassazione n. 20216/2022. <span className="underline decoration-green-300">Opzione consigliata per evitare contestazioni.</span>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <strong className="block text-amber-700 mb-1">🟠 Tetto 32 Giorni (Esteso)</strong>
                      Include nel calcolo anche le 4 giornate di <strong>Ex-Festività</strong> (permessi soppressi). Sebbene aumenti l'importo recuperabile, questa estensione non è esplicitamente coperta dalla sentenza 20216/2022 e potrebbe essere oggetto di eccezione da parte dell'azienda.
                    </div>
                  </div>

                  <button
                    onClick={() => setShowInfoTetto(false)}
                    className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-colors"
                  >
                    Ho capito
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* TASTO DIFFIDA */}
          <button
            onClick={handlePrintDiffida}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #7c3aed 0%, #9333ea 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <Gavel className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
            <span>Diffida</span>
          </button>

          {/* TASTO RELAZIONE */}
          <button
            onClick={() => setIsRelazioneOpen(true)}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <FileText className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
            <span>Relazione</span>
          </button>

          {/* TASTO GESTIONE DATI */}
          <button
            onClick={onEdit}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #059669 0%, #14b8a6 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <LayoutGrid className="w-5 h-5 transition-transform duration-500 group-hover:rotate-90" strokeWidth={2.5} />
            <span>Gestione Dati</span>
          </button>

          {/* TASTO DOWNLOAD PDF */}
          <button
            onClick={handleDownloadPDF}
            className="group relative px-6 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #dc2626 0%, #e11d48 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <FileDown className="w-5 h-5 transition-transform duration-500 group-hover:bounce" strokeWidth={2.5} />
            <span>PDF</span>
          </button>

          {/* TASTO STAMPA */}
          <button
            onClick={handlePrint}
            className="group relative px-8 py-3 rounded-xl font-bold text-lg text-white shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 border border-white/10 overflow-hidden flex items-center gap-3"
            style={{ background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 rotate-12"></div>
            <Printer className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12" strokeWidth={2.5} />
            <span>Stampa</span>
          </button>
        </div>
      </div>

      {/* TABELLA HTML */}
      <div id="report-content" className="w-full flex flex-col items-center">
        <div className="print-container overflow-x-auto print:overflow-visible w-full flex justify-center print:block print:w-full mt-12">
          <div className="inline-block min-w-[1200px] w-full max-w-[1400px] border-2 border-black bg-white shadow-2xl print:shadow-none print:w-full print:border-none rounded-2xl overflow-hidden print:rounded-none">

            <div className="bg-gray-200 border-b border-black text-center py-6 print:bg-gray-200 print:border-black print:py-4 relative">
              <div className="font-black text-2xl uppercase mb-2 print:text-xl">
                Incidenza degli elementi accessori ai fini del calcolo annuale della retribuzione feriale lavoratore:
              </div>
              <div className="text-lg font-normal normal-case print:text-base">
                <span className="font-bold mr-2">{worker.cognome} {worker.nome}</span> (Matr. {worker.id})
              </div>
              <div className="text-lg font-normal normal-case print:text-base">
                Periodo interessato: dal 01-01-{startYear} al 31-12-{endYear}
              </div>
            </div>

            <table className="w-full border-collapse text-sm text-center">
              <thead>
                <tr className="bg-[#7EB6D3] bg-blue-header text-black print:bg-[#7EB6D3] print:text-black h-12" style={{ backgroundColor: '#7EB6D3' }}>
                  <th className="border border-black p-2 font-bold text-base w-20 align-middle">Anno</th>
                  <th className="border border-black p-2 font-bold text-base w-40 align-middle">Totale Voci<br />Retributive<br />Accessorie</th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle">Divisore Annuo<br /><span className="text-sm font-normal">(media gg lav.)</span></th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle">Incidenza per<br />Giornate di<br />Ferie</th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle bg-yellow-50 print:bg-yellow-50">
                    Giornate Ferie<br />
                    <span className="text-xs font-normal">(Pagabili {includeExFest ? "32" : "28"})</span>
                  </th>
                  <th className="border border-black p-2 font-bold text-base w-28 align-middle">Incidenza<br />(Lordo)</th>
                  <th className="border border-black p-2 font-bold text-base w-40 align-middle">INDENNITA'<br />PERCEPITA X<br />gg DI FERIE</th>
                  <th className="border border-black p-2 font-black text-base w-40 align-middle">TOTALE<br />INDENNITA' DA<br />PERCEPIRE</th>
                  <th className="border border-black p-2 font-bold text-base w-40 align-middle">CREDITO<br />TICKET<br />RESTAURANT</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr key={row.anno} className="h-10 text-base">
                    <td className="border border-black px-2 py-1 text-center bg-gray-100 bg-gray-row font-bold print:bg-gray-100">{row.anno}</td>
                    <td className="border border-black px-2 py-1 text-right">{formatCurrency(row.totaleVoci)}</td>
                    <td className="border border-black px-2 py-1 text-center">{formatNumber(row.divisore)}</td>
                    <td className="border border-black px-2 py-1 text-right text-blue-800 font-medium">{formatCurrency(row.incidenzaGiornata)}</td>
                    <td className="border border-black px-2 py-1 text-center font-bold bg-yellow-50 print:bg-yellow-50">{formatNumber(row.giornateFerie)}</td>
                    <td className="border border-black px-2 py-1 text-right font-medium">{formatCurrency(row.incidenzaTotale)}</td>
                    <td className="border border-black px-2 py-1 text-right text-orange-600 font-medium">{formatCurrency(row.indennitaPercepita)}</td>
                    <td className="border border-black px-2 py-1 text-right font-black bg-yellow-100 bg-yellow-cell print:bg-yellow-50 text-lg">{formatCurrency(row.totaleDaPercepire)}</td>
                    <td className="border border-black px-2 py-1 text-right text-green-700 font-medium">{formatCurrency(row.indennitaPasto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="h-14 font-black text-lg">
                  <td colSpan={5} className="border border-black bg-[#92D050] bg-green-total text-left px-6 relative align-middle uppercase print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>TOTALE DOVUTO</td>
                  <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.incidenzaTotale)}</td>
                  <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle text-orange-800 print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.indennitaPercepita)}</td>
                  <td className="border border-black bg-[#FF5050] bg-red-total text-right px-2 align-middle text-white text-xl print:bg-[#FF5050] print:text-white" style={{ backgroundColor: '#FF5050', color: 'white' }}>{formatCurrency(totals.totaleDaPercepire)}</td>
                  <td className="border border-black bg-[#92D050] bg-green-total text-right px-2 align-middle text-green-900 print:bg-[#92D050]" style={{ backgroundColor: '#92D050' }}>{formatCurrency(totals.indennitaPasto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="hidden print:flex mt-16 w-full max-w-[1200px] px-8 justify-between text-base font-medium">
          <div className="text-center"><p className="mb-16">Firma del Dipendente</p><div className="border-t-2 border-black w-72"></div></div>
          <div className="text-center"><p className="mb-16">Timbro e Firma Responsabile</p><div className="border-t-2 border-black w-72"></div></div>
        </div>
      </div>

      {isRelazioneOpen && (
        <RelazioneModal
          isOpen={isRelazioneOpen}
          onClose={() => setIsRelazioneOpen(false)}
          worker={worker}
          includeExFest={includeExFest} // <--- FONDAMENTALE: Dice alla relazione se è 28 o 32 gg
          totals={{
            grandTotal: {
              // Passiamo tutti i dati disaggregati per la tabella della perizia
              incidenzaTotale: totals.incidenzaTotale,       // Lordo Spettante
              indennitaPercepita: totals.indennitaPercepita, // Già Percepito
              indennitaPasto: totals.indennitaPasto,         // Ticket
              totalNet: totals.totaleDaPercepire             // Netto Finale
            }
          }}
        />
      )}
    </div>
  );
};

export default TableComponent;