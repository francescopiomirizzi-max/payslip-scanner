import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { IslandProvider } from './IslandContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Split di entry: il telefono che scansiona il QR atterra su ?mobile=true.
// Senza questo split scaricava tutto App.tsx (AppRouter, useWorkers che fa
// query Supabase, modali, dashboard, ...) per poi mostrare solo
// MobileUploadPage — molti secondi di latenza percepita in WiFi mobile.
// Con il lazy import vite emette due chunk distinti: il telefono prende solo
// quello che gli serve.
const App = lazy(() => import('./App'));
const MobileUploadPage = lazy(() => import('./pages/MobileUploadPage'));

const params = new URLSearchParams(window.location.search);
const isMobileEntry = params.get('mobile') === 'true';
const mobileSessionId = params.get('session') || '';

const Loader: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#0B1120', color: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    letterSpacing: '0.1em', fontSize: 12, textTransform: 'uppercase',
  }}>
    Caricamento...
  </div>
);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <IslandProvider>
        <Suspense fallback={<Loader />}>
          {isMobileEntry ? <MobileUploadPage sessionId={mobileSessionId} /> : <App />}
        </Suspense>
      </IslandProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
