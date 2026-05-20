import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { IslandProvider } from './IslandContext'; // ✨ 1. IMPORTIAMO IL CERVELLO
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* ✨ 2. AVVOLGIAMO L'INTERA APP NELLA RETE NEURALE DELL'ISOLA */}
    <ErrorBoundary>
      <IslandProvider>
        <App />
      </IslandProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
