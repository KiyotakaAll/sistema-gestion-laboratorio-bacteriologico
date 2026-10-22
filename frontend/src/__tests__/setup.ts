import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Almacenamiento aislado en memoria: no depende del localStorage nativo de Node.
const almacenamiento = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (clave: string) => almacenamiento.get(clave) ?? null,
  setItem: (clave: string, valor: string) => almacenamiento.set(clave, String(valor)),
  removeItem: (clave: string) => almacenamiento.delete(clave),
  clear: () => almacenamiento.clear(),
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
