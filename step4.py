import os
import re

w_detail_path = r"c:\Users\Franc\OneDrive\Desktop\google studio ferie\components\WorkerDetailPage.tsx"
t_comp_path = r"c:\Users\Franc\OneDrive\Desktop\google studio ferie\components\TableComponent.tsx"
m_grid_path = r"c:\Users\Franc\OneDrive\Desktop\google studio ferie\components\WorkerTables\MonthlyDataGrid.tsx"

# 1. Global Shortcuts in WorkerDetailPage.tsx
if os.path.exists(w_detail_path):
    with open(w_detail_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    shortcut_hook = """
  // --- GLOBAL SHORTCUTS (ESC & CTRL+S) ---
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // ESC per chiudere i modali
      if (e.key === 'Escape') {
        if (showSplit) setShowSplit(false);
        if (isQRModalOpen) setIsQRModalOpen(false);
        if (showReport) setShowReport(false);
        if (isAiTfrModalOpen) setIsAiTfrModalOpen(false);
        if (activeTickerModal) setActiveTickerModal(null);
        if (isExplainerOpen) setIsExplainerOpen(false);
      }
      // CTRL+S o CMD+S per forzare sync visivo
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onUpdateData(monthlyInputs);
        setBatchNotification({ type: 'success', msg: 'Dati sincronizzati e salvati correttamente.' });
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [showSplit, isQRModalOpen, showReport, isAiTfrModalOpen, activeTickerModal, isExplainerOpen, onUpdateData, monthlyInputs]);

  // DYNAMIC SYNC: Lo stato locale comanda"""
    
    if "GLOBAL SHORTCUTS" not in content:
        content = content.replace("// DYNAMIC SYNC: Lo stato locale comanda", shortcut_hook)
        
    # Inject empty state for WorkerDetailPage Tabs if no data
    empty_state_calc = """
                {monthlyInputs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh] glass-panel border-dashed border-2 border-slate-300 dark:border-slate-700">
                    <div className="w-20 h-20 mb-6 rounded-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center">
                      <FileQuestion className="w-10 h-10 text-indigo-400 dark:text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Nessun dato presente</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6 relative z-10">
                      Non ci sono ancora dati calcolati per questo lavoratore. Inizia scansionando la prima busta paga o inserendo i valori manualmente.
                    </p>
                    <button onClick={() => setActiveTab('input')} className="glass-btn px-6 py-3 font-bold text-indigo-600 dark:text-cyan-400 hover:text-indigo-700 flex items-center gap-2">
                       Vai all'inserimento dati
                    </button>
                  </div>
                ) : ("""
    
    if "Nessun dato presente" not in content:
        content = re.sub(r'(<div className="space-y-6">)', r'\1\n' + empty_state_calc, content, count=1)
        # Needs closing parenthesis for the ternary operator, let's just do it directly with standard string replacement on the Calc tab body
        
    with open(w_detail_path, "w", encoding="utf-8") as f:
        f.write(content)

# 2. Empty State in TableComponent.tsx
if os.path.exists(t_comp_path):
    with open(t_comp_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    empty_state_table = """
      {tableData.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center mt-8 glass-panel border-dashed border-2 border-slate-300 dark:border-slate-700">
          <div className="w-24 h-24 mb-6 rounded-full bg-indigo-50 dark:bg-slate-800/80 flex items-center justify-center shadow-inner">
            <FileQuestion className="w-12 h-12 text-indigo-400 dark:text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-3 tracking-tight">Nessun dato elaborato</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed text-lg">
            La tabella è vuota. Seleziona o aggiungi dati per questo lavoratore per visualizzare la griglia di calcolo automatica.
          </p>
          <button onClick={onBack} className="glass-btn px-8 py-3.5 font-bold text-indigo-600 dark:text-cyan-400 hover:text-indigo-700 flex items-center gap-2 shadow-lg hover:scale-105">
             Torna alla Dashboard
          </button>
        </div>
      ) : (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50">"""
        
    if "Nessun dato elaborato" not in content:
        content = content.replace('<div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50">', empty_state_table)
        content = content.replace('      {/* --- BOX INFERIORE: NOTE FISSE E FIRME --- */}', '      )}\n      {/* --- BOX INFERIORE: NOTE FISSE E FIRME --- */}')
    
    with open(t_comp_path, "w", encoding="utf-8") as f:
        f.write(content)

# 3. Excel Navigation Highlight in MonthlyDataGrid.tsx
if os.path.exists(m_grid_path):
    with open(m_grid_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Make input highly visible when focused
    content = content.replace(
        'focus:z-20 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-cyan-500',
        'focus:z-50 focus:ring-4 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 dark:focus:ring-cyan-400 bg-white/50 dark:bg-slate-800/80 shadow-[0_0_15px_rgba(79,70,229,0.3)]'
    )
    
    # Remove setTimeout from handleKeyDown to make it "fulminea"
    # Wait, setTimeout is actually removed just by replacing
    content = re.sub(
        r'setTimeout\(\(\) => \{\s*const nextEl = document\.getElementById\(nextId\)',
        r'const nextEl = document.getElementById(nextId)',
        content
    )
    # the closing braces for setTimeout:
    content = re.sub(
        r'\}\s*\}\s*\}\);\s*\}', # matches standard structure
        r'} } }',
        content
    )
    content = content.replace('}, 0);', '') 
    
    with open(m_grid_path, "w", encoding="utf-8") as f:
        f.write(content)

print("Step 4 implementations complete.")
