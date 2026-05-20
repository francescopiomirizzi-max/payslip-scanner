// ============================================================
// components/RagAdminPanel.tsx
// Pannello admin per indicizzare documenti legali nel corpus RAG.
// Stile RailFlow: glassmorphism, ambient glow indigo/violet (AI theme),
// drag-and-drop PDF, progress bar live durante embedding.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Upload, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle,
  Scale, BookOpen, Library, Database, Trash2, RefreshCw,
} from 'lucide-react';
import { FRAMER_PHYSICS } from '../framerConfig';
import { useRagIngestion, type IngestionInput } from '../hooks/useRagIngestion';
import { listLegalDocuments, type DocType } from '../lib/ragRepository';
import { ollamaHealthCheck, type OllamaHealth } from '../lib/ollama';
import { detectDocumentFormat, PDF_MIME, DOCX_MIME } from '../lib/pdfChunker';

// MIME + estensioni accettate dal selector di file
const ACCEPTED_FILE_TYPES = `${PDF_MIME},${DOCX_MIME},.pdf,.docx`;

interface RagAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOC_TYPE_OPTIONS: Array<{ value: DocType; label: string; icon: React.ElementType }> = [
  { value: 'ccnl',       label: 'CCNL',              icon: BookOpen },
  { value: 'sentenza',   label: 'Sentenza',          icon: Scale },
  { value: 'interpello', label: 'Interpello',        icon: FileText },
  { value: 'circolare',  label: 'Circolare',         icon: FileText },
  { value: 'dottrina',   label: 'Dottrina',          icon: Library },
  { value: 'altro',      label: 'Altro',             icon: Database },
];

const INITIAL_FORM: IngestionInput = {
  title: '',
  doc_type: 'ccnl',
  source_ref: '',
  ccnl_ref: '',
  doc_date: '',
};

const RagAdminPanel: React.FC<RagAdminPanelProps> = ({ isOpen, onClose }) => {
  const { ingestDocument, progress, isIngesting, error, reset, abort } = useRagIngestion();

  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<IngestionInput>(INITIAL_FORM);
  const [isDragOver, setIsDragOver] = useState(false);
  const [health, setHealth] = useState<OllamaHealth | null>(null);
  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof listLegalDocuments>>>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Health check on mount + reload elenco docs
  const loadDocs = useCallback(async () => {
    try {
      setDocsLoading(true);
      const docs = await listLegalDocuments();
      setDocuments(docs);
    } catch (e) {
      console.warn('Lista documenti fallita:', e);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    ollamaHealthCheck().then(setHealth);
    loadDocs();
  }, [isOpen, loadDocs]);

  const handleFileSelect = useCallback((f: File | null) => {
    if (!f) return;
    const fmt = detectDocumentFormat(f);
    if (!fmt) {
      alert('Formato non supportato. Accettati: PDF (.pdf) o Word (.docx). I file .doc legacy non sono supportati.');
      return;
    }
    setFile(f);
    // Auto-popola title se vuoto (rimuovendo estensione)
    setForm(prev =>
      prev.title.trim()
        ? prev
        : { ...prev, title: f.name.replace(/\.(pdf|docx)$/i, '').replace(/[_-]+/g, ' ').trim() }
    );
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileSelect(e.dataTransfer.files?.[0] ?? null);
    },
    [handleFileSelect]
  );

  const isFormValid = useMemo(
    () => Boolean(file && form.title.trim() && form.doc_type),
    [file, form]
  );

  const handleSubmit = useCallback(async () => {
    if (!file || !isFormValid) return;
    try {
      await ingestDocument(file, {
        title: form.title.trim(),
        doc_type: form.doc_type,
        source_ref: form.source_ref?.trim() || undefined,
        ccnl_ref: form.ccnl_ref?.trim() || undefined,
        doc_date: form.doc_date || undefined,
      });
      // Successo: reset form e reload elenco
      setFile(null);
      setForm(INITIAL_FORM);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocs();
      setTimeout(reset, 4000);
    } catch (e) {
      // Errore già in `error` dell'hook
    }
  }, [file, form, isFormValid, ingestDocument, loadDocs, reset]);

  // SSR safety: il portal richiede document; durante SSR ritorna null.
  if (typeof document === 'undefined') return null;

  const healthOk = health?.ok && health.hasEmbedding;
  const healthLabel = !health
    ? 'Verifica Ollama...'
    : !health.ok
    ? 'Ollama offline'
    : !health.hasEmbedding
    ? 'nomic-embed-text mancante'
    : 'Avvocato pronto';

  // ──────────────────────────────────────────────────────────────
  // PORTAL su document.body — necessario perché la DynamicIsland ha
  // `backdrop-filter` su antenati, che crea un containing block per
  // i `position: fixed` discendenti. Senza portal il modale verrebbe
  // ancorato alla pill della DynamicIsland invece che al viewport
  // (appare come rettangolo nero confinato). Il portal lo monta come
  // sibling diretto del body, dove `fixed inset-0` torna a riferirsi
  // correttamente all'intera viewport.
  // ──────────────────────────────────────────────────────────────
  return createPortal(
    <AnimatePresence>
      {isOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop — niente backdrop-blur (causerebbe corner-clip + overhead) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={isIngesting ? undefined : onClose}
          className="absolute inset-0 bg-[#0a0f1e]/85"
        />

        {/* Modal card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 60 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 40 }}
          transition={FRAMER_PHYSICS.heavyBounce}
          className="relative w-full max-w-[820px] max-h-[90vh] overflow-y-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] border-2 border-white/60 dark:border-slate-700"
          style={{
            boxShadow: '0 40px 100px -30px rgba(99, 102, 241, 0.5), inset 0 2px 20px rgba(255,255,255,0.6)',
          }}
        >
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] overflow-hidden">
            <div
              className="absolute top-[-30%] left-[-10%] w-[60%] h-[140%] rounded-full blur-[120px] opacity-25"
              style={{ background: '#6366f1' }}
            />
            <div
              className="absolute top-[-20%] right-[-20%] w-[50%] h-[120%] rounded-full blur-[110px] opacity-20"
              style={{ background: '#8b5cf6' }}
            />
          </div>

          {/* Header */}
          <div className="relative px-10 pt-10 pb-6 z-10">
            <div className="flex justify-between items-start gap-6">
              <div className="flex items-center gap-5">
                <motion.div
                  animate={{ rotate: [0, 6, -6, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  className="p-4 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-2xl ring-1 ring-white/40"
                >
                  <Sparkles className="w-8 h-8" strokeWidth={1.5} />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white leading-none">
                    Corpus Legale
                  </h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-2">
                    Avvocato Virtuale · Indicizzazione documenti
                  </p>
                </div>
              </div>

              {/* Health badge */}
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border backdrop-blur-md ${
                    healthOk
                      ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50'
                      : 'bg-red-100/50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      healthOk ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ boxShadow: `0 0 12px ${healthOk ? '#10b981' : '#ef4444'}` }}
                  />
                  {healthLabel}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isIngesting}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Chiudi"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative px-10 pb-10 z-10 space-y-7">
            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !isIngesting && fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-300 p-8 text-center ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 scale-[1.01]'
                  : file
                  ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/40 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20'
              } ${isIngesting ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={e => handleFileSelect(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-3">
                {file ? (
                  <>
                    <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-md">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-800 dark:text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFile(null); }}
                      className="text-[11px] font-bold uppercase tracking-wider text-red-600 hover:text-red-700 mt-1"
                    >
                      Rimuovi
                    </button>
                  </>
                ) : (
                  <>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-700 dark:text-slate-300">
                        Trascina qui un PDF o Word
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        o clicca per selezionare · <span className="font-mono">.pdf</span> · <span className="font-mono">.docx</span>
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">
                        CCNL · Sentenze · Interpelli · Dottrina
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Form metadata */}
            <div className="grid grid-cols-2 gap-5">
              <FormField
                label="Titolo"
                required
                value={form.title}
                onChange={v => setForm({ ...form, title: v })}
                placeholder="CCNL Multiservizi 2023..."
                disabled={isIngesting}
              />
              <FormField
                label="Source ref"
                value={form.source_ref ?? ''}
                onChange={v => setForm({ ...form, source_ref: v })}
                placeholder="Cass. Sez. Lav. 20216/2022"
                disabled={isIngesting}
              />
              <FormField
                label="CCNL rif."
                value={form.ccnl_ref ?? ''}
                onChange={v => setForm({ ...form, ccnl_ref: v })}
                placeholder="Multiservizi"
                disabled={isIngesting}
              />
              <FormField
                label="Data documento"
                type="date"
                value={form.doc_date ?? ''}
                onChange={v => setForm({ ...form, doc_date: v })}
                disabled={isIngesting}
              />
            </div>

            {/* Doc type selector */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-3 block">
                Tipo Documento
              </label>
              <div className="grid grid-cols-6 gap-2">
                {DOC_TYPE_OPTIONS.map(opt => {
                  const isSel = form.doc_type === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, doc_type: opt.value })}
                      disabled={isIngesting}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all duration-300 ${
                        isSel
                          ? 'border-indigo-500 bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-indigo-700 dark:text-indigo-300 shadow-md'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress / Error */}
            <AnimatePresence>
              {(isIngesting || progress.phase === 'done' || progress.phase === 'error') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className={`p-5 rounded-2xl border-2 ${
                      progress.phase === 'error'
                        ? 'bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-700/50'
                        : progress.phase === 'done'
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/50'
                        : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {progress.phase === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : progress.phase === 'done' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      )}
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {progress.message || error}
                      </span>
                    </div>
                    {isIngesting && (
                      <div className="relative h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <motion.div
                          className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500 to-violet-500"
                          animate={{ width: `${progress.percent}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-4 items-center pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isIngesting}
                className="py-3.5 px-7 rounded-2xl font-bold text-slate-500 bg-white/60 border-2 border-slate-200 hover:border-slate-300 hover:bg-white hover:text-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Chiudi
              </button>

              {isIngesting && (
                <button
                  type="button"
                  onClick={abort}
                  className="py-3.5 px-7 rounded-2xl font-bold text-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-200 transition-all"
                >
                  Annulla
                </button>
              )}

              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || isIngesting || !healthOk}
                whileHover={isFormValid && !isIngesting && healthOk ? { scale: 1.02 } : {}}
                whileTap={isFormValid && !isIngesting && healthOk ? { scale: 0.97 } : {}}
                className={`flex-1 py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-3 transition-all shadow-2xl ${
                  !isFormValid || isIngesting || !healthOk
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300'
                    : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:shadow-[0_10px_30px_-10px_rgba(99,102,241,0.6)]'
                }`}
              >
                {isIngesting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Indicizzazione...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Indicizza nel Corpus</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* Lista documenti già indicizzati */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Library className="w-5 h-5 text-slate-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Documenti nel corpus ({documents.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={loadDocs}
                  disabled={docsLoading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
                  aria-label="Ricarica"
                >
                  <RefreshCw className={`w-4 h-4 ${docsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400">
                  Nessun documento indicizzato ancora.
                </div>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-2">
                  {documents.map(doc => {
                    const typeOpt = DOC_TYPE_OPTIONS.find(o => o.value === doc.doc_type);
                    const Icon = typeOpt?.icon ?? FileText;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all"
                      >
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                            {doc.title}
                          </p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">
                            {doc.doc_type}
                            {doc.source_ref && ` · ${doc.source_ref}`}
                            {doc.ccnl_ref && ` · CCNL ${doc.ccnl_ref}`}
                            {doc.doc_date && ` · ${doc.doc_date}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ============================================================
// Sub-component: FormField — input con label uniforme allo stile RailFlow
// ============================================================
interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}

const FormField: React.FC<FormFieldProps> = ({
  label, value, onChange, placeholder, type = 'text', required, disabled,
}) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 mb-2 block">
      {label}
      {required && <span className="text-indigo-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-700 outline-none transition-all font-semibold text-sm text-slate-700 dark:text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 backdrop-blur-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    />
  </div>
);

export default RagAdminPanel;
