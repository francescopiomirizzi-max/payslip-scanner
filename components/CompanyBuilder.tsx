import React, { useState, useEffect, useRef } from 'react';
import { useUserSettings } from '../hooks/useUserSettings';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Building2, Plus, Trash2, Save, Database,
    Settings2, Server, Eye, CheckCircle2, AlertCircle,
    GripVertical, Hash, Euro, Sparkles, Layout, ChevronDown, Check, Palette
} from 'lucide-react';
import { ColumnDef } from '../types';
import { SYSTEM_PROFILE_KEYS } from '../config/profiles';

interface CompanyBuilderProps {
    isOpen: boolean;
    onClose: () => void;
}

const SYSTEM_COMPANIES = SYSTEM_PROFILE_KEYS;

const COLOR_OPTIONS = [
    { id: 'indigo',  hex: '#6366f1', light: '#e0e7ff' },
    { id: 'sky',     hex: '#0ea5e9', light: '#e0f2fe' },
    { id: 'emerald', hex: '#10b981', light: '#d1fae5' },
    { id: 'amber',   hex: '#f59e0b', light: '#fef3c7' },
    { id: 'rose',    hex: '#f43f5e', light: '#ffe4e6' },
    { id: 'violet',  hex: '#8b5cf6', light: '#ede9fe' },
    { id: 'orange',  hex: '#f97316', light: '#ffedd5' },
    { id: 'cyan',    hex: '#06b6d4', light: '#cffafe' },
];

const getColorHex = (colorId?: string) =>
    COLOR_OPTIONS.find(c => c.id === colorId)?.hex ?? '#6366f1';

const CompanyBuilder: React.FC<CompanyBuilderProps> = ({ isOpen, onClose }) => {
    const generateUID = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
    const { customCompanies, setCustomCompanies } = useUserSettings();
    const [companies, setCompanies] = useState<Record<string, any>>({});
    const [activeCompany, setActiveCompany] = useState<string | null>(null);
    const [tempColumns, setTempColumns] = useState<any[]>([]);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        let _cols = [...tempColumns];
        const dragged = _cols.splice(dragItem.current, 1)[0];
        _cols.splice(dragOverItem.current, 0, dragged);
        dragItem.current = null;
        dragOverItem.current = null;
        setTempColumns(_cols);
        setHasUnsavedChanges(true);
    };

    const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({
        show: false, msg: '', type: 'success'
    });

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    useEffect(() => {
        if (isOpen) setCompanies(customCompanies);
    }, [isOpen, customCompanies]);

    const handleAddCompany = () => {
        const name = newCompanyName.trim().toUpperCase();
        if (!name) return;
        if (SYSTEM_COMPANIES.includes(name) || companies[name]) {
            showToast('Nome già in uso o riservato!', 'error');
            return;
        }
        const newComps = { ...companies, [name]: { columns: [], color: 'indigo' } };
        setCompanies(newComps);
        setActiveCompany(name);
        setTempColumns([]);
        setNewCompanyName('');
        void setCustomCompanies(newComps);
        showToast(`Modello ${name} creato.`);
    };

    const handleDeleteCompany = (name: string) => {
        const newComps = { ...companies };
        delete newComps[name];
        setCompanies(newComps);
        if (activeCompany === name) setActiveCompany(null);
        void setCustomCompanies(newComps);
        showToast('Modello rimosso.', 'error');
    };

    const handleDeleteClick = (e: React.MouseEvent, comp: string) => {
        e.stopPropagation();
        if (confirmDelete === comp) {
            handleDeleteCompany(comp);
            setConfirmDelete(null);
        } else {
            setConfirmDelete(comp);
            setTimeout(() => setConfirmDelete(null), 3000);
        }
    };

    const handleSelectCompany = (name: string) => {
        setActiveCompany(name);
        setConfirmDelete(null);
        const cols = companies[name]?.columns.map((c: any) => ({ ...c, _uid: generateUID() })) || [];
        setTempColumns(cols);
        setHasUnsavedChanges(false);
    };

    const handleColorChange = (color: string) => {
        if (!activeCompany) return;
        const newComps = { ...companies, [activeCompany]: { ...companies[activeCompany], color } };
        setCompanies(newComps);
        void setCustomCompanies(newComps);
    };

    const addColumn = () => {
        setTempColumns([...tempColumns, { id: '', label: '', type: 'currency', width: 'min-w-[120px]', _uid: generateUID() }]);
        setHasUnsavedChanges(true);
    };

    const updateColumn = (index: number, field: string, value: string) => {
        const updated = [...tempColumns];
        updated[index] = { ...updated[index], [field]: value };
        setTempColumns(updated);
        setHasUnsavedChanges(true);
    };

    const removeColumn = (index: number) => {
        setTempColumns(tempColumns.filter((_, i) => i !== index));
        setHasUnsavedChanges(true);
    };

    const saveColumns = () => {
        if (!activeCompany) return;
        const hasEmptyFields = tempColumns.some(c => c.id.trim() === '' || c.label.trim() === '');
        if (hasEmptyFields) { showToast('Compila tutti i campi obbligatori!', 'error'); return; }
        const ids = tempColumns.map(c => c.id);
        if (new Set(ids).size !== ids.length) { showToast('Rilevati codici busta duplicati!', 'error'); return; }
        const cleanCols = tempColumns.map(({ _uid, ...rest }) => rest);
        const newComps = { ...companies, [activeCompany]: { ...companies[activeCompany], columns: cleanCols } };
        setCompanies(newComps);
        void setCustomCompanies(newComps);
        setHasUnsavedChanges(false);
        showToast('Configurazione salvata e motore AI aggiornato.');
    };

    if (!isOpen) return null;

    const activeColor = activeCompany ? (companies[activeCompany]?.color ?? 'indigo') : 'indigo';
    const activeHex = getColorHex(activeColor);

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex bg-[#020617] font-sans"
        >
            {/* AMBIENT LIGHTS */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none" />

            {/* TOAST */}
            <AnimatePresence>
                {toast.show && (
                    <motion.div
                        initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.5 }}
                        className={`fixed top-10 right-10 z-[100000] flex items-center gap-4 px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border backdrop-blur-xl ${
                            toast.type === 'success'
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : 'bg-red-500/20 border-red-500/50 text-red-400'
                        }`}
                    >
                        {toast.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        <span className="font-bold tracking-wide text-white">{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SIDEBAR ── */}
            <div className="w-80 bg-slate-900/40 border-r border-white/5 flex flex-col relative z-10 shrink-0 backdrop-blur-md">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Server className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="font-black text-white tracking-tighter text-xl">DATABASE</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
                    {/* Custom models list */}
                    <section>
                        <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-4 pl-2 flex items-center gap-2">
                            <Database className="w-3 h-3" /> Modelli Custom
                        </p>

                        <div className="space-y-2 px-2">
                            <AnimatePresence mode="popLayout">
                                {Object.keys(companies).length === 0 && (
                                    <motion.p
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="text-[11px] text-slate-600 font-medium text-center py-4 italic"
                                    >
                                        Nessun modello creato
                                    </motion.p>
                                )}
                                {Object.keys(companies).map(comp => {
                                    const isActive = activeCompany === comp;
                                    const colorHex = getColorHex(companies[comp]?.color);
                                    const colCount = (companies[comp]?.columns ?? []).length;
                                    const isConfirming = confirmDelete === comp;

                                    return (
                                        <motion.div
                                            layout key={comp}
                                            onClick={() => handleSelectCompany(comp)}
                                            className={`group flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                                                isActive
                                                    ? 'border-white/20 text-white shadow-xl translate-x-1.5'
                                                    : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:border-white/10'
                                            }`}
                                            style={isActive ? { backgroundColor: `${colorHex}22`, borderColor: `${colorHex}55` } : {}}
                                        >
                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                {/* Color dot */}
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: colorHex }}
                                                />
                                                <span className="font-black text-sm truncate">{comp}</span>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                {/* Column count badge */}
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                                    isActive ? 'bg-white/10 text-white' : 'bg-slate-700/60 text-slate-500'
                                                }`}>
                                                    {colCount} col
                                                </span>

                                                {/* Delete / confirm */}
                                                {isActive && (
                                                    isConfirming ? (
                                                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={e => handleDeleteClick(e, comp)}
                                                                className="flex items-center gap-1 px-2 py-1 bg-red-500 hover:bg-red-400 text-white rounded-lg text-[10px] font-black transition-colors"
                                                            >
                                                                <Check className="w-3 h-3" /> Elimina
                                                            </button>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                                                                className="p-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={e => handleDeleteClick(e, comp)}
                                                            className="p-1.5 bg-black/20 hover:bg-red-500/80 text-white/60 hover:text-white rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </section>

                    {/* Add new company */}
                    <section className="px-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <Plus className="w-3 h-3" /> Nuova azienda
                        </p>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-all shadow-inner">
                                <input
                                    type="text"
                                    value={newCompanyName}
                                    onChange={e => setNewCompanyName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddCompany()}
                                    placeholder="NOME AZIENDA..."
                                    className="w-full bg-transparent text-xs text-white px-3 py-3 outline-none uppercase font-black placeholder:text-slate-700"
                                />
                            </div>
                            <button
                                onClick={handleAddCompany}
                                disabled={!newCompanyName.trim()}
                                className="px-3 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                            >
                                <Plus className="w-4 h-4" strokeWidth={3} />
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            {/* ── MAIN AREA ── */}
            <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
                {!activeCompany ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="relative mb-8"
                        >
                            <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full" />
                            <Database className="w-32 h-32 text-slate-800 relative z-10" strokeWidth={1} />
                        </motion.div>
                        <h2 className="text-4xl font-black text-white tracking-tighter mb-4">Seleziona un'entità aziendale.</h2>
                        <p className="text-slate-500 max-w-sm leading-relaxed">Costruisci la struttura dati per le tue buste paga. Ogni parametro aggiunto permetterà all'intelligenza artificiale di mappare i crediti corretti.</p>
                    </div>
                ) : (
                    <>
                        {/* HEADER */}
                        <header className="p-10 pb-8 border-b border-white/5 bg-slate-900/20 shrink-0">
                            <div className="flex justify-between items-start gap-6">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span
                                            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border"
                                            style={{ backgroundColor: `${activeHex}22`, borderColor: `${activeHex}44`, color: activeHex }}
                                        >
                                            MODELLO ATTIVO
                                        </span>
                                        <span className="text-slate-600 font-mono text-[10px]">ID_{activeCompany.replace(/\s/g, '_')}</span>
                                    </div>
                                    <h1 className="text-6xl font-black text-white tracking-tighter uppercase mb-5 truncate">{activeCompany}</h1>

                                    {/* Color picker */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Palette className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Colore badge</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {COLOR_OPTIONS.map(opt => {
                                                const isSelected = activeColor === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => handleColorChange(opt.id)}
                                                        className="relative w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                                                        style={{ backgroundColor: opt.hex }}
                                                        title={opt.id}
                                                    >
                                                        {isSelected && (
                                                            <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white" strokeWidth={3} />
                                                        )}
                                                        {isSelected && (
                                                            <div
                                                                className="absolute inset-0 rounded-full"
                                                                style={{ boxShadow: `0 0 0 2px #020617, 0 0 0 4px ${opt.hex}` }}
                                                            />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    onClick={saveColumns}
                                    className={`flex items-center gap-3 px-8 py-4 rounded-3xl font-black text-sm tracking-widest transition-all shadow-2xl shrink-0 ${
                                        hasUnsavedChanges
                                            ? 'bg-indigo-600 text-white shadow-indigo-600/40 ring-4 ring-indigo-500/20'
                                            : 'bg-slate-800 text-slate-500 border border-white/5'
                                    }`}
                                >
                                    <Save className={`w-5 h-5 ${hasUnsavedChanges ? 'animate-bounce' : ''}`} />
                                    SALVA E SINCRONIZZA
                                </motion.button>
                            </div>
                        </header>

                        {/* MAIN CONTENT */}
                        <main className="flex-1 overflow-y-auto custom-scrollbar p-10 flex flex-col xl:flex-row gap-12">

                            {/* COLUMNS INPUT */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: activeHex }} />
                                    <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                                        <Layout className="w-5 h-5 text-slate-500" />
                                        ARCHITETTURA COLONNE
                                    </h3>
                                </div>

                                <div className="flex gap-3 px-8 pb-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
                                    <div className="w-5" />
                                    <div className="w-28">Codice Busta</div>
                                    <div className="flex-1">Nome Etichetta</div>
                                    <div className="w-32">Tipo Dato</div>
                                    <div className="w-12 text-right" />
                                </div>

                                <div className="space-y-3">
                                    <AnimatePresence mode="popLayout">
                                        {tempColumns.map((col: any, index) => (
                                            <motion.div
                                                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                                                key={col._uid || index}
                                                draggable
                                                onDragStart={(e: any) => { dragItem.current = index; e.currentTarget.classList.add('opacity-50'); }}
                                                onDragEnter={() => { dragOverItem.current = index; }}
                                                onDragEnd={(e: any) => { e.currentTarget.classList.remove('opacity-50'); handleSort(); }}
                                                onDragOver={e => e.preventDefault()}
                                                className="flex items-center gap-3 bg-slate-900/60 border border-white/5 p-4 rounded-3xl hover:border-white/10 transition-all group backdrop-blur-sm cursor-grab active:cursor-grabbing"
                                            >
                                                <div className="flex justify-center cursor-grab active:cursor-grabbing px-2">
                                                    <GripVertical className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                                                </div>

                                                <div className="w-28">
                                                    <input
                                                        type="text" value={col.id}
                                                        onChange={e => updateColumn(index, 'id', e.target.value.toUpperCase())}
                                                        placeholder="Es: 1050"
                                                        className={`w-full bg-black/40 border ${col.id === '' && hasUnsavedChanges ? 'border-red-500/50' : 'border-white/10'} rounded-2xl px-3 py-3 text-white font-mono font-bold focus:border-indigo-500 outline-none transition-all text-center placeholder:text-slate-800`}
                                                    />
                                                </div>

                                                <div className="flex-1 flex gap-3">
                                                    <input
                                                        type="text" value={col.label}
                                                        onChange={e => updateColumn(index, 'label', e.target.value)}
                                                        placeholder="Nome Indennità..."
                                                        className={`w-full bg-black/40 border ${col.label === '' && hasUnsavedChanges ? 'border-red-500/50' : 'border-white/10'} rounded-2xl px-4 py-3 text-white font-bold focus:border-indigo-500 outline-none transition-all placeholder:text-slate-800`}
                                                    />
                                                    {col.type === 'formula' && (
                                                        <input
                                                            type="text"
                                                            value={col.formula || ''}
                                                            onChange={e => updateColumn(index, 'formula', e.target.value)}
                                                            placeholder="Es: [1050] * 0.15"
                                                            className="w-full bg-indigo-900/30 border border-indigo-500/50 rounded-2xl px-4 py-3 text-indigo-300 font-mono font-bold focus:border-indigo-400 outline-none transition-all placeholder:text-indigo-900/50"
                                                        />
                                                    )}
                                                </div>

                                                <div className="w-32 relative">
                                                    <select
                                                        value={col.type || 'currency'}
                                                        onChange={e => updateColumn(index, 'type', e.target.value)}
                                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-3 py-3 text-slate-400 font-bold outline-none appearance-none cursor-pointer hover:text-white transition-all text-sm"
                                                    >
                                                        <option value="currency">Valuta (€)</option>
                                                        <option value="integer">Intero (#)</option>
                                                        <option value="formula">Formula (fx)</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
                                                </div>

                                                <div className="flex justify-end pl-2">
                                                    <button onClick={() => removeColumn(index)} className="p-3 text-slate-600 hover:text-red-500 transition-colors bg-black/20 hover:bg-red-500/10 rounded-xl">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    <motion.button
                                        whileHover={{ scale: 1.01, backgroundColor: 'rgba(99,102,241,0.05)' }}
                                        onClick={addColumn}
                                        className="w-full mt-6 py-8 rounded-3xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 text-slate-600 hover:text-indigo-400 font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
                                    >
                                        <Plus className="w-5 h-5" strokeWidth={3} /> AGGIUNGI PARAMETRO
                                    </motion.button>
                                </div>
                            </div>

                            {/* LIVE PREVIEW */}
                            <div className="xl:w-[550px] shrink-0">
                                <div className="sticky top-0">
                                    <div className="flex items-center gap-3 text-slate-500 font-black text-xs uppercase tracking-[0.2em] mb-6 pl-4">
                                        <Eye className="w-5 h-5 text-cyan-400" /> RENDERING INTERFACCIA
                                    </div>

                                    <div className="bg-slate-50 rounded-[3rem] p-10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white relative overflow-hidden">
                                        <div
                                            className="absolute top-0 left-0 right-0 h-2"
                                            style={{ background: `linear-gradient(to right, ${activeHex}, #06b6d4, ${activeHex})` }}
                                        />

                                        {/* macOS dots */}
                                        <div className="flex justify-between items-center mb-10 border-b border-slate-200/60 pb-4">
                                            <div className="flex gap-2 items-center pl-2">
                                                <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]" />
                                                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]" />
                                                <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]" />
                                            </div>
                                            <div className="px-4 py-1.5 bg-white rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 shadow-sm flex items-center gap-2">
                                                <Layout className="w-3 h-3" style={{ color: activeHex }} />
                                                Live Mockup
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto custom-scrollbar-light pb-6">
                                            <table className="w-full text-left border-separate border-spacing-0 text-[11px] whitespace-nowrap">
                                                <thead>
                                                    <tr>
                                                        <th className="p-3 font-black text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Mese</th>
                                                        <th className="p-3 font-bold text-slate-500 text-center border-b-2 border-slate-200">GG Lav</th>
                                                        <th className="p-3 font-bold text-slate-500 text-center border-b-2 border-slate-200 bg-yellow-50/50">Ferie</th>
                                                        {tempColumns.length === 0 ? (
                                                            <th className="p-3 font-bold text-slate-400 italic border-b-2 border-slate-200 text-center">Aggiungi voci per l'anteprima...</th>
                                                        ) : (
                                                            tempColumns.map((c, i) => (
                                                                <th key={i} className="p-3 border-b-2 border-slate-200 text-right" style={{ backgroundColor: `${activeHex}08` }}>
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-slate-700 font-black text-[11px] leading-none mb-1 uppercase tracking-tight">{c.label || 'VOCE'}</span>
                                                                        <span className="font-mono text-[9px] font-bold" style={{ color: activeHex }}>[{c.id || '???'}]</span>
                                                                    </div>
                                                                </th>
                                                            ))
                                                        )}
                                                        <th className="p-3 font-black text-slate-700 text-right border-b-2 border-slate-200 bg-slate-100">Totale</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { label: 'GENNAIO', dot: '#38bdf8', gg: 20, ferie: 2 },
                                                        { label: 'FEBBRAIO', dot: '#6366f1', gg: 21, ferie: 0 },
                                                    ].map(row => (
                                                        <tr key={row.label} className="group hover:bg-slate-50 transition-colors">
                                                            <td className="p-2 border-b border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10">
                                                                <div className="flex items-center gap-2 font-black text-slate-700 text-xs">
                                                                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: row.dot }} />
                                                                    {row.label}
                                                                </div>
                                                            </td>
                                                            <td className="p-2 border-b border-slate-100">
                                                                <div className="w-12 mx-auto bg-slate-100 border border-slate-200 rounded-lg px-2 py-2 text-center text-slate-500 font-bold">{row.gg}</div>
                                                            </td>
                                                            <td className="p-2 border-b border-slate-100 bg-yellow-50/30">
                                                                <div className="w-12 mx-auto bg-white border border-yellow-200 rounded-lg px-2 py-2 text-center text-slate-500 font-bold shadow-sm">{row.ferie}</div>
                                                            </td>
                                                            {tempColumns.length === 0 && <td className="p-2 border-b border-slate-100 text-center text-slate-300">-</td>}
                                                            {tempColumns.map((c, i) => (
                                                                <td key={i} className="p-2 border-b border-slate-100" style={{ backgroundColor: `${activeHex}05` }}>
                                                                    <div className="flex items-center justify-end gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm w-24 ml-auto cursor-not-allowed">
                                                                        {c.type === 'currency' ? <Euro className="w-3 h-3 text-slate-400" /> : <Hash className="w-3 h-3 text-slate-400" />}
                                                                        <span className="font-bold text-slate-400">0,00</span>
                                                                    </div>
                                                                </td>
                                                            ))}
                                                            <td className="p-2 border-b border-slate-100 bg-slate-50/50 text-right">
                                                                <span className="font-black text-slate-800 text-xs">€ 0,00</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="mt-8 p-5 rounded-3xl border flex items-start gap-4" style={{ backgroundColor: `${activeHex}0d`, borderColor: `${activeHex}30` }}>
                                            <div className="p-3 bg-white rounded-2xl shadow-sm" style={{ color: activeHex }}><Sparkles className="w-5 h-5" /></div>
                                            <div className="flex-1">
                                                <h4 className="text-xs font-black mb-1 uppercase tracking-tight" style={{ color: activeHex }}>Addestramento Motore AI</h4>
                                                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                                    Questi dati definiscono i parametri che l'agente Gemini utilizzerà per mappare le competenze nei documenti scansionati.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </main>
                    </>
                )}
            </div>

            <style>{`
                .custom-scrollbar-light::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar-light::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar-light::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                .animate-spin-slow { animation: spin 8s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </motion.div>
    );
};

export default CompanyBuilder;
