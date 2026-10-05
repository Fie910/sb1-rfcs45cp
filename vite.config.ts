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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor utama — jarang berubah, di-cache lama
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],

          // Berat & jarang dipakai — dipisah agar tidak masuk initial load
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'pdf-lib', 'pdfjs-dist'],
          'vendor-xlsx': ['xlsx'],
          'vendor-qr': ['qrcode', 'qrcode.react', 'html5-qrcode'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});