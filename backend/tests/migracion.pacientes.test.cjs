// Comprobaciones ESTÁTICAS. No validan sintaxis/eficacia SQL ni abren una conexión.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./solo-mocks.cjs');
const { Prisma } = require('@prisma/client');
const modelo = Prisma.dmmf.datamodel.models.find(m => m.name === 'Paciente');
const campo = nombre => modelo.fields.find(f => f.name === nombre);
const root = path.resolve(__dirname, '../..');
const sql = fs.readFileSync(path.join(root, 'database/migrations/20261122_001_identificacion_pacientes.sql'), 'utf8').replace(/--[^\n]*/g, '');

test('cliente generado conserva ID y relación; cédula histórica y clave son nullable únicas', () => {
  assert.equal(campo('id').type, 'Int'); assert.equal(campo('id').isId, true);
  assert.equal(campo('solicitudes').type, 'Solicitud');
  for (const nombre of ['cedula', 'claveIdentificacion']) {
    assert.equal(campo(nombre).isRequired, false); assert.equal(campo(nombre).isUnique, true);
  }
});
test('defaults nuevos son dbgenerated, no valores que Prisma deba materializar en INSERT antiguos', () => {
  assert.deepEqual(campo('estadoIdentificacion').default, { name: 'dbgenerated', args: ["'LEGADO_POR_REVISAR'"] });
  assert.deepEqual(campo('versionIdentificacion').default, { name: 'dbgenerated', args: ['0'] });
  // La SQL emitida por el motor ante una BD antigua sigue pendiente de integración MySQL.
});
test('migración candidata no contiene operaciones destructivas ni reescribe cédulas o IDs', () => {
  assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|DELETE|REPLACE)\b/i);
  const sentencias = sql.split(';').map(s => s.trim()).filter(Boolean);
  assert.ok(sentencias.every(s => /^(ALTER TABLE pacientes|UPDATE pacientes|SELECT|SHOW CREATE TABLE pacientes)\b/i.test(s)));
  const updates = sentencias.filter(s => /^UPDATE\b/.test(s));
  assert.equal(updates.length, 1);
  assert.match(updates[0], /^UPDATE pacientes SET estado_identificacion = 'LEGADO_POR_REVISAR'/);
  assert.doesNotMatch(sql, /(?:MODIFY|CHANGE|DROP)\s+(?:COLUMN\s+)?id\b/i);
});
test('declara UNIQUE completo y tres CHECK cerrados ante UNKNOWN', () => {
  assert.match(sql, /ADD UNIQUE KEY uq_pacientes_clave_identificacion \(clave_identificacion\)/);
  assert.equal((sql.match(/ADD CONSTRAINT ck_pacientes_ident_/g) || []).length, 3);
  assert.equal((sql.match(/IS TRUE/g) || []).length, 3);
  assert.doesNotMatch(sql, /NOT ENFORCED/);
  assert.match(sql, /CAST\(clave_identificacion AS BINARY\) = CAST\(CONCAT/);
});
test('expresa límites UTF-16 y blancos ECMAScript sin depender de escapes SQL de sesión', () => {
  assert.match(sql, /2 \* CHAR_LENGTH\(motivo_ausencia_documento\) - CHAR_LENGTH\(REGEXP_REPLACE/);
  const hex = sql.match(/CONVERT\(0x(20[0-9a-f]+) USING utf8mb4\)/)[1];
  const caracteres = [...Buffer.from(hex, 'hex').toString('utf8')];
  assert.equal(caracteres.length, 20);
  assert.ok(caracteres.every(c => c.trim() === ''));
  assert.match(sql, /\[\[:cntrl:\]\]/);
  // Esto verifica la especificación escrita, no la implementación ICU de MySQL.
});
test('los nueve CHECK del SQL histórico siguen presentes y no se eliminan en la propuesta', () => {
  const historico = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');
  const nombres = [...historico.matchAll(/CONSTRAINT (ck_\w+) CHECK/g)].map(m => m[1]);
  assert.deepEqual(nombres.sort(), ['ck_roles_nombre', 'ck_examenes_precio', 'ck_muestras_codigo_barras',
    'ck_muestras_rechazo', 'ck_muestras_recepcion', 'ck_muestras_fechas', 'ck_resultados_validacion',
    'ck_resultados_doble_firma', 'ck_antibiograma_halo'].sort());
  for (const nombre of nombres) assert.equal(sql.includes(nombre), false);
});
