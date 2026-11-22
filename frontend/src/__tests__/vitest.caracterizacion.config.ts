import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { InlineConfig } from 'vite';
import { mergeConfig } from 'vitest/config';
import configuracion from '../../vite.config';

// Configuración exclusiva de pruebas: conserva React/jsdom y el setup existente.
// Ejecutar desde frontend con --configLoader runner para no generar un bundle de configuración.
const aislada = {
  envFile: false,
  cacheDir: join(tmpdir(), 'labzen-pacientes-vitest'),
  test: {
    setupFiles: ['./src/__tests__/sin-red.setup.ts'],
  },
} satisfies InlineConfig & { test: { setupFiles: string[] } };

export default mergeConfig(configuracion, aislada);
