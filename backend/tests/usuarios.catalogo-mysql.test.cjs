const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
require('./solo-mocks.cjs');

const id = require.resolve('../src/services/permisos.service.ts');
const mock = new Module(id);
Object.assign(mock, { loaded: true, exports: { politicaOperativaActiva: () => true } });
require.cache[id] = mock;
const { rolesDisponiblesParaAlta } = require('../src/services/usuarios-disponibilidad.ts');

const catalogo = ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR', 'AUXILIAR'];
const check = (escaped) => '(`nombre` in (' + catalogo.map(nombre =>
  "_utf8mb4" + (escaped ? "\\'" : "'") + nombre + (escaped ? "\\'" : "'")).join(',') + '))';
const tx = (clausula, aplicado = 'YES') => ({
  rol: { findUnique: async ({ where }) => ({ id: where.nombre === 'AUXILIAR' ? 5 : 3, nombre: where.nombre }) },
  $queryRaw: async () => [{ clausula, aplicado }],
});

for (const escaped of [false, true]) test('alta ofrece los dos perfiles con CHECK de MySQL; comillas escapadas: ' + escaped, async () => {
  assert.deepEqual(await rolesDisponiblesParaAlta(tx(check(escaped))), ['AUXILIAR', 'BACTERIOLOGO']);
});

for (const clausula of [
  "(`nombre` in ('ADMINISTRADOR','BACTERIOLOGO'))",
  "(`nombre` in ('AUXILIAR')) OR 1=1",
  "(`nombre` like 'AUXILIAR')",
  "(`nombre` in ('AUXILIAR\\'OTRO'))",
]) test('no habilita auxiliar ante CHECK ausente o no reconocido: ' + clausula, async () => {
  assert.deepEqual(await rolesDisponiblesParaAlta(tx(clausula)), ['BACTERIOLOGO']);
});

test('no habilita auxiliar si el CHECK no está aplicado', async () => {
  assert.deepEqual(await rolesDisponiblesParaAlta(tx(check(true), 'NO')), ['BACTERIOLOGO']);
});
