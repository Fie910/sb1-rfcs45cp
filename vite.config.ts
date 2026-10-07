// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-xlsx': ['xlsx'],
          'vendor-qr': ['qrcode', 'qrcode.react', 'html5-qrcode'],
          'vendor-icons': ['lucide-react'],

          // =====================================================================
          // PDF — dipisah jadi 2 group
          // =====================================================================

          // Generator PDF — dipakai untuk bikin surat/notulensi/label
          'vendor-pdf-gen': ['jspdf', 'jspdf-autotable', 'pdf-lib'],

          // Reader PDF — ~1 MB, dipakai hanya untuk preview PDF
          'vendor-pdf-read': ['pdfjs-dist'],
        },
      },
    },
  },
});