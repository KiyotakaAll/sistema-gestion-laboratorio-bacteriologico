import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Decisión de arquitectura: en desarrollo, Vite hace de proxy de `/api` hacia
 * el backend (puerto 3000). El navegador solo habla con el origen de Vite, así
 * que no hay problemas de CORS y el cliente Axios usa la ruta relativa `/api`
 * tanto en desarrollo como detrás de un proxy inverso en producción.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
  },
});
