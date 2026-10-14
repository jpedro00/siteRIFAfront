import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Caminho publico do app. Padrao "/" (projeto proprio). No site unico o script scripts/build-site.mjs
 * define VITE_BASE_PATH=/painel/ (Organizer) e /admin/ (Admin) para servir os tres sob o mesmo dominio.
 */
export default defineConfig({
  base: process.env['VITE_BASE_PATH'] ?? '/',
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
