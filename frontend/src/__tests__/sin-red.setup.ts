// Red de seguridad adicional a los mocks de servicios/adaptadores de cada suite.
// Instalar directamente: vi.restoreAllMocks de las suites existentes no retira la protección.
const bloquear = () => { throw new Error('Prueba aislada: use un mock; la red está prohibida'); };
globalThis.fetch = bloquear;
XMLHttpRequest.prototype.open = bloquear;
