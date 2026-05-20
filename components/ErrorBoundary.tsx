import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Rete di sicurezza globale: intercetta qualsiasi eccezione di rendering React
 * nel sottoalbero ed evita la "schermata bianca" totale. I dati persistiti
 * (Supabase / localStorage) non vengono toccati: basta ricaricare per ripartire.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('💥 ErrorBoundary — crash intercettato:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-5">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
            Si è verificato un errore imprevisto
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            L'applicazione ha incontrato un problema. I tuoi dati salvati sono al sicuro:
            ricarica la pagina per continuare.
          </p>
          {this.state.error?.message && (
            <pre className="text-left text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl p-3 mb-6 overflow-auto max-h-32 whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Ricarica l'applicazione
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
