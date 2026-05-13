import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Trash2, ExternalLink, Archive, Loader2,
    AlertTriangle, Bot, CheckCircle2, ChevronDown, FolderOpen, Folder,
    ShieldCheck, Download,
} from 'lucide-react';
import { zip } from 'fflate';
import { usePayslipArchive, PayslipRecord, VerifyLogEntry } from '../../hooks/usePayslipArchive';
import { notifyIsland } from '../DynamicIsland';

interface PayslipArchiveTabProps {
    workerId: string;
    workerProfilo: string;
    workerEliorType?: string;
    workerName?: string;
    onCountChange?: (count: number) => void;
}

const MONTH_ORDER: Record<string, number> = {
    GENNAIO: 0, FEBBRAIO: 1, MARZO: 2, APRILE: 3, MAGGIO: 4, GIUGNO: 5,
    LUGLIO: 6, AGOSTO: 7, SETTEMBRE: 8, OTTOBRE: 9, NOVEMBRE: 10, DICEMBRE: 11,
};

const MONTH_SHORT: Record<string, string> = {
    GENNAIO: 'GEN', FEBBRAIO: 'FEB', MARZO: 'MAR', APRILE: 'APR',
    MAGGIO: 'MAG', GIUGNO: 'GIU', LUGLIO: 'LUG', AGOSTO: 'AGO',
    SETTEMBRE: 'SET', OTTOBRE: 'OTT', NOVEMBRE: 'NOV', DICEMBRE: 'DIC',
};

const MONTH_COLOR: Record<string, string> = {
    GENNAIO:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    FEBBRAIO:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    MARZO:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    APRILE:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    MAGGIO:    'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
    GIUGNO:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    LUGLIO:    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    AGOSTO:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    SETTEMBRE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    OTTOBRE:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    NOVEMBRE:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    DICEMBRE:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
};

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PayslipArchiveTab({ workerId, workerProfilo, workerEliorType, workerName, onCountChange }: PayslipArchiveTabProps) {
    const { getPayslipsByWorker, deletePayslip, getSignedUrl, getSignedUrls, updateExtractedData } = usePayslipArchive();

    const [records, setRecords] = useState<PayslipRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
    const [reanalyzedId, setReanalyzedId] = useState<string | null>(null);
    const [reanalyzeErrorId, setReanalyzeErrorId] = useState<string | null>(null);
    const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
    // Track which year folders are open (most recent starts open)
    const [openYears, setOpenYears] = useState<Set<number>>(new Set());

    const load = useCallback(async () => {
        setIsLoading(true);
        const data = await getPayslipsByWorker(workerId);
        setRecords(data);
        onCountChange?.(data.length);
        setIsLoading(false);
        // Auto-open the most recent year
        if (data.length > 0) {
            const maxYear = Math.max(...data.map(r => r.year));
            setOpenYears(new Set([maxYear]));
        }
    }, [workerId]);

    useEffect(() => { load(); }, [load]);

    // Group records by year, sorted by month within each year
    const byYear = useMemo(() => {
        const groups: Record<number, PayslipRecord[]> = {};
        records.forEach(r => {
            if (!groups[r.year]) groups[r.year] = [];
            groups[r.year].push(r);
        });
        Object.values(groups).forEach(list =>
            list.sort((a, b) => (MONTH_ORDER[a.month] ?? 0) - (MONTH_ORDER[b.month] ?? 0))
        );
        return groups;
    }, [records]);

    const sortedYears = useMemo(
        () => Object.keys(byYear).map(Number).sort((a, b) => b - a),
        [byYear]
    );

    // Aggregate verification statistics across all records
    const verifyStats = useMemo(() => {
        let total = 0, success = 0, warning = 0, error = 0, discrepancies = 0;
        records.forEach(r => {
            (r.verify_history || []).forEach((e: VerifyLogEntry) => {
                total++;
                if (e.status === 'success') success++;
                else if (e.status === 'warning') warning++;
                else error++;
                discrepancies += e.discrepancy_count;
            });
        });
        return { total, success, warning, error, discrepancies };
    }, [records]);

    const toggleYear = (year: number) => {
        setOpenYears(prev => {
            const next = new Set(prev);
            next.has(year) ? next.delete(year) : next.add(year);
            return next;
        });
    };

    const handleView = async (record: PayslipRecord) => {
        setOpeningId(record.id);
        const url = await getSignedUrl(record.storage_path);
        setOpeningId(null);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleDelete = async (record: PayslipRecord) => {
        setDeletingId(record.id);
        await deletePayslip(record.id, record.storage_path);
        setRecords(prev => {
            const next = prev.filter(r => r.id !== record.id);
            onCountChange?.(next.length);
            return next;
        });
        setDeletingId(null);
        setConfirmDeleteId(null);
    };

    const handleReanalyze = async (record: PayslipRecord) => {
        setReanalyzingId(record.id);
        setReanalyzeErrorId(null);
        try {
            const url = await getSignedUrl(record.storage_path);
            if (!url) throw new Error('URL firmato non disponibile');

            const response = await fetch(url);
            const blob = await response.blob();
            const mimeType = blob.type || 'application/pdf';
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onload = () => {
                    const result = reader.result as string;
                    resolve(result.includes(',') ? result.split(',')[1] : result);
                };
                reader.onerror = reject;
            });

            const netlifyRes = await fetch('/.netlify/functions/scan-payslip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileData: base64, mimeType, company: workerProfilo, eliorType: workerEliorType }),
            });

            const responseText = await netlifyRes.text();
            let aiResult: any;
            try {
                let parsed = JSON.parse(responseText);
                if (Array.isArray(parsed)) parsed = parsed[0];
                if (parsed?.data) parsed = parsed.data;
                if (parsed?.payslip) parsed = parsed.payslip;
                if (parsed?.risultato) parsed = parsed.risultato;
                aiResult = parsed;
            } catch { throw new Error('Risposta AI non valida'); }

            if (!netlifyRes.ok || !aiResult || aiResult.error)
                throw new Error(aiResult?.error ?? `Errore server ${netlifyRes.status}`);

            await updateExtractedData(record.id, aiResult);
            setRecords(prev => prev.map(r => r.id === record.id ? { ...r, extracted_data: aiResult } : r));
            setReanalyzedId(record.id);
            setTimeout(() => setReanalyzedId(null), 2500);
        } catch (err) {
            console.error('[Archive] Ri-analisi fallita:', err);
            setReanalyzeErrorId(record.id);
            setTimeout(() => setReanalyzeErrorId(null), 3000);
        } finally {
            setReanalyzingId(null);
        }
    };

    const handleDownloadAllZip = async () => {
        if (zipProgress) return;
        setZipProgress({ done: 0, total: records.length });

        // 1 API call per tutti gli URL firmati invece di N chiamate
        const urlMap = await getSignedUrls(records.map(r => r.storage_path));

        const fileEntries: Record<string, Uint8Array> = {};
        let done = 0;

        await Promise.all(
            records.map(async (record) => {
                try {
                    const url = urlMap[record.storage_path];
                    if (!url) return;
                    const res = await fetch(url);
                    const buf = await res.arrayBuffer();
                    const monthIdx = String((MONTH_ORDER[record.month.toUpperCase()] ?? 0) + 1).padStart(2, '0');
                    const safeFilename = record.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                    fileEntries[`${record.year}/${monthIdx}_${record.month.toUpperCase()}_${safeFilename}`] = new Uint8Array(buf);
                } catch (e) {
                    console.error('[ZIP] Errore scaricamento:', record.filename, e);
                } finally {
                    done++;
                    setZipProgress({ done, total: records.length });
                }
            })
        );

        const safeName = (workerName ?? workerProfilo).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        zip(fileEntries, { level: 0 }, (err, data) => {
            setZipProgress(null);
            if (err) {
                console.error('[ZIP] Errore compressione:', err);
                notifyIsland('Errore creazione ZIP', 'error');
                return;
            }
            const blob = new Blob([data], { type: 'application/zip' });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${safeName}_buste_paga.zip`;
            a.click();
            URL.revokeObjectURL(blobUrl);
            notifyIsland(`ZIP pronto — ${records.length} buste scaricate`, 'success');
        });
    };

    // ── LOADING ────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
        );
    }

    // ── EMPTY STATE ────────────────────────────────────────────────────────────
    if (records.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
                <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-3xl">
                    <Archive className="w-12 h-12 text-slate-400" />
                </div>
                <p className="text-lg font-bold text-slate-600 dark:text-slate-300">Archivio vuoto</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
                    Le buste paga analizzate con l'OCR o via QR vengono salvate qui automaticamente.
                </p>
            </div>
        );
    }

    // ── MAIN LIST ──────────────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-auto custom-scrollbar p-4 space-y-3">

            {/* Totale + Download ZIP */}
            <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {records.length} busta{records.length !== 1 ? ' paga archiviate' : ' paga archiviata'}
                    {' · '}
                    {sortedYears.length} ann{sortedYears.length !== 1 ? 'i' : 'o'}
                </p>
                <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={handleDownloadAllZip}
                    disabled={!!zipProgress}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                        bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700
                        text-white shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Scarica tutte le buste paga come ZIP suddiviso per anno"
                >
                    {zipProgress ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {zipProgress.done}/{zipProgress.total}
                        </>
                    ) : (
                        <>
                            <Download className="w-3.5 h-3.5" />
                            Scarica ZIP
                            <span className="opacity-70">· {records.length}</span>
                        </>
                    )}
                </motion.button>
            </div>

            {/* Banner statistiche verifiche AI */}
            {verifyStats.total > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Verifiche AI
                        </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-[12px] font-semibold">
                        {verifyStats.success > 0 && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                {verifyStats.success} OK
                            </span>
                        )}
                        {verifyStats.warning > 0 && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                                {verifyStats.warning} Avvisi
                            </span>
                        )}
                        {verifyStats.error > 0 && (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                {verifyStats.error} Errori
                            </span>
                        )}
                        <span className="text-slate-400 dark:text-slate-500 font-normal">·</span>
                        <span className="text-slate-500 dark:text-slate-400 font-normal">
                            {verifyStats.discrepancies} discrepanz{verifyStats.discrepancies === 1 ? 'a' : 'e'} trovate
                        </span>
                    </div>
                </div>
            )}

            {/* Cartelle per anno */}
            {sortedYears.map(year => {
                const yearRecords = byYear[year];
                const isOpen = openYears.has(year);
                const FolderIcon = isOpen ? FolderOpen : Folder;

                return (
                    <div key={year} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">

                        {/* ── HEADER ANNO ────────────────────────────────── */}
                        <button
                            onClick={() => toggleYear(year)}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors text-left"
                        >
                            <FolderIcon className="w-5 h-5 text-amber-500 shrink-0" />
                            <span className="text-base font-bold text-slate-700 dark:text-slate-200 flex-1">
                                {year}
                            </span>
                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 mr-2">
                                {yearRecords.length} busta{yearRecords.length !== 1 ? ' paga' : ''}
                            </span>
                            <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </motion.div>
                        </button>

                        {/* ── LISTA MESI ─────────────────────────────────── */}
                        <AnimatePresence initial={false}>
                            {isOpen && (
                                <motion.div
                                    key="content"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {yearRecords.map((record, idx) => {
                                            const monthKey = record.month.toUpperCase();
                                            const shortName = MONTH_SHORT[monthKey] ?? monthKey.slice(0, 3);
                                            const colorClass = MONTH_COLOR[monthKey] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

                                            return (
                                                <motion.div
                                                    key={record.id}
                                                    layout
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 40, scale: 0.95 }}
                                                    transition={{ type: 'spring', stiffness: 350, damping: 30, delay: idx * 0.03 }}
                                                    className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                                                >
                                                    {/* Badge mese */}
                                                    <div className={`w-10 h-8 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${colorClass}`}>
                                                        {shortName}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                                            {record.month.charAt(0) + record.month.slice(1).toLowerCase()}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate leading-tight">
                                                            {record.filename}
                                                            <span className="mx-1 opacity-50">·</span>
                                                            {formatDate(record.uploaded_at)}
                                                        </p>
                                                    </div>

                                                    {/* Badge ultima verifica */}
                                                    {(() => {
                                                        const history = record.verify_history;
                                                        if (!history || history.length === 0) return null;
                                                        const last = history[history.length - 1];
                                                        const dotColor =
                                                            last.status === 'success' ? 'bg-emerald-500' :
                                                            last.status === 'warning'  ? 'bg-amber-500'  : 'bg-red-500';
                                                        const textColor =
                                                            last.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                                                            last.status === 'warning'  ? 'text-amber-600 dark:text-amber-400'  : 'text-red-600 dark:text-red-400';
                                                        return (
                                                            <div
                                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${textColor}`}
                                                                title={`${history.length} verific${history.length === 1 ? 'a' : 'he'} · ultima: ${new Date(last.run_at).toLocaleDateString('it-IT')}${last.discrepancy_count > 0 ? ` · ${last.discrepancy_count} disc.` : ''}`}
                                                            >
                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                                                {history.length}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Azioni */}
                                                    <div className="flex items-center gap-0.5 shrink-0">

                                                        {/* Ri-analizza */}
                                                        <motion.button
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={() => handleReanalyze(record)}
                                                            disabled={reanalyzingId === record.id || reanalyzedId === record.id}
                                                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                                                                reanalyzeErrorId === record.id
                                                                    ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                                                                    : reanalyzedId === record.id
                                                                    ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                                                    : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 dark:hover:text-violet-400'
                                                            }`}
                                                            title="Ri-analizza con AI"
                                                        >
                                                            {reanalyzingId === record.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : reanalyzedId === record.id ? (
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                            ) : reanalyzeErrorId === record.id ? (
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <Bot className="w-3.5 h-3.5" />
                                                            )}
                                                        </motion.button>

                                                        {/* Visualizza */}
                                                        <motion.button
                                                            whileTap={{ scale: 0.9 }}
                                                            onClick={() => handleView(record)}
                                                            disabled={openingId === record.id}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
                                                            title="Visualizza PDF"
                                                        >
                                                            {openingId === record.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <ExternalLink className="w-3.5 h-3.5" />
                                                            }
                                                        </motion.button>

                                                        {/* Elimina con conferma */}
                                                        <AnimatePresence mode="wait">
                                                            {confirmDeleteId === record.id ? (
                                                                <motion.div
                                                                    key="confirm"
                                                                    initial={{ opacity: 0, scale: 0.85 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    exit={{ opacity: 0, scale: 0.85 }}
                                                                    className="flex items-center gap-1 ml-1"
                                                                >
                                                                    <button
                                                                        onClick={() => setConfirmDeleteId(null)}
                                                                        className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                                                                    >
                                                                        No
                                                                    </button>
                                                                    <motion.button
                                                                        whileTap={{ scale: 0.9 }}
                                                                        onClick={() => handleDelete(record)}
                                                                        disabled={deletingId === record.id}
                                                                        className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-0.5"
                                                                    >
                                                                        {deletingId === record.id
                                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                            : <AlertTriangle className="w-3 h-3" />
                                                                        }
                                                                        Sì
                                                                    </motion.button>
                                                                </motion.div>
                                                            ) : (
                                                                <motion.button
                                                                    key="delete-btn"
                                                                    whileTap={{ scale: 0.9 }}
                                                                    onClick={() => setConfirmDeleteId(record.id)}
                                                                    className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                    title="Elimina"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </motion.button>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}
