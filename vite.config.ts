import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Utile per evitare problemi di rete locale
    // CONFIGURAZIONE PROXY PERFETTA PER IL TUO CASO
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888', // <--- ECCO LA CHIAVE: Punta alla 8888
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});