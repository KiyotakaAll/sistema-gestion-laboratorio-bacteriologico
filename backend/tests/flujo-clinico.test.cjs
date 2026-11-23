const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
require('./solo-mocks.cjs');
function sustituir(ruta, exports) {
  const id = require.resolve(ruta), modulo = new Module(id);
  Object.assign(modulo, { exports, loaded: true }); require.cache[id] = modulo;
}
const env = { NODE_ENV: 'production', JWT_SECRET: 'clave-ficticia-aislada-flujo-clinico',
  PERMISOS_OPERATIVOS_HABILITADOS: true, PACIENTES_IDENTIFICACION_HABILITADA: false,
  MEDICOS_REMITENTES_HABILITADOS: false };
let db, llamadas, logFallido, perderCAS, errorTx, cola = Promise.resolve();
const fecha = new Date('2026-01-01T00:00:00.000Z');
const ctx = { usuarioId: 7, ip: '127.0.0.1' };
const entrada = { muestraExamenId: 10, observaciones: 'Sin crecimiento', antibiograma: [] };
const copiar = value => structuredClone(value);
function resultado(id = 20) {
  return { id, muestraExamenId: 10, usuarioIdRegistra: 8, estado: 'PENDIENTE_VALIDACION',
    hallazgoGram: null, colonias: null, bacteriaAislada: null, observaciones: 'Sin crecimiento',
    usuarioIdValida: null, fechaValidacion: null, updatedAt: fecha, antibiograma: [] };
}
function lecturaResultado(id) {
  const fila = db.resultados.find(r => r.id === id);
  return fila ? { ...copiar(fila), muestraExamen: { muestraId: 3, muestra: copiar(db.muestra) } } : null;
}
const prisma = {
  $queryRaw: async (partes, ...valores) => { llamadas.push(['lock', partes.join('?'), valores]); return [{ id: valores[0] }]; },
  usuario: { findUnique: async () => { llamadas.push(['cuenta']); return copiar(db.cuenta); } },
  muestra: {
    findUnique: async args => { llamadas.push(['muestra.leer', args]); return db.muestra ? copiar(db.muestra) : null; },
    findUniqueOrThrow: async () => copiar(db.muestra),
    updateMany: async ({ where, data }) => {
      llamadas.push(['muestra.escribir', where, data]);
      if (perderCAS === 'muestra' || !db.muestra || db.muestra.estado !== where.estado) return { count: 0 };
      Object.assign(db.muestra, data); return { count: 1 };
    },
  },
  muestraExamen: {
    findUnique: async ({ where }) => { llamadas.push(['examen.leer']); return db.examenes.includes(where.id) ? {
      id: where.id, muestraId: 3, muestra: copiar(db.muestra),
      resultado: copiar(db.resultados.find(r => r.muestraExamenId === where.id) ?? null),
    } : null; },
    count: async () => db.examenes.filter(id => !db.resultados.some(r => r.muestraExamenId === id)).length,
  },
  resultado: {
    findUnique: async args => { llamadas.push(['resultado.leer', args]); return lecturaResultado(args.where.id); },
    findUniqueOrThrow: async args => { llamadas.push(['resultado.respuesta', args]); return lecturaResultado(args.where.id); },
    create: async ({ data }) => {
      llamadas.push(['resultado.crear']);
      const fila = { ...resultado(20 + db.resultados.length), ...data, updatedAt: new Date(), antibiograma: data.antibiograma.create };
      db.resultados.push(fila); return copiar(fila);
    },
    updateMany: async ({ where, data }) => {
      llamadas.push(['resultado.escribir', where, data]);
      const fila = db.resultados.find(r => r.id === where.id);
      if (perderCAS === 'resultado' || !fila || fila.estado !== where.estado ||
        fila.updatedAt.getTime() !== where.updatedAt.getTime() ||
        (where.usuarioIdRegistra !== undefined && fila.usuarioIdRegistra !== where.usuarioIdRegistra)) return { count: 0 };
      Object.assign(fila, data); return { count: 1 };
    },
  },
  resultadoAntibiograma: {
    deleteMany: async ({ where }) => { db.resultados.find(r => r.id === where.resultadoId).antibiograma = []; },
    createMany: async ({ data }) => { db.resultados.find(r => r.id === data[0].resultadoId).antibiograma = copiar(data); },
  },
  logAuditoria: { create: async ({ data }) => {
    llamadas.push(['auditoria', data]);
    if (logFallido === data.accion) throw new Error('Fallo sintético de auditoría');
    db.logs.push({ ...copiar(data), id: db.logs.length + 1, fechaEvento: new Date() });
  } },
  // Simulación serializada con rollback: NO prueba bloqueos ni aislamiento reales de MySQL.
  $transaction: async (fn, opciones) => {
    const anterior = cola; let liberar;
    cola = new Promise(resolve => { liberar = resolve; }); await anterior;
    llamadas.push(['transaccion', opciones]); const respaldo = copiar(db);
    try { if (errorTx) throw errorTx; return await fn(prisma); }
    catch (e) { db = respaldo; throw e; } finally { liberar(); }
  },
};
sustituir('../src/config/env.ts', { env }); sustituir('../src/config/prisma.ts', { prisma });
const muestras = require('../src/services/muestra.service.ts');
const resultados = require('../src/services/resultado.service.ts');
const politica = require('../src/domain/flujo-clinico.ts');
const validadores = require('../src/validators/resultado.validator.ts');
const { siguienteVersion } = require('../src/services/flujo-clinico.service.ts');
const { Prisma } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = require('../src/routes/resultado.routes.ts').default;
const { errorHandler } = require('../src/middlewares/errorHandler.ts');
beforeEach(() => {
  env.PERMISOS_OPERATIVOS_HABILITADOS = true;
  db = { cuenta: { activo: true, rol: { nombre: 'BACTERIOLOGO' } },
    muestra: { id: 3, estado: 'EN_PROCESAMIENTO', fechaRecepcion: fecha,
      solicitudId: 2, codigoBarras: 'M260101-ABC234', fechaToma: fecha,
      solicitud: { id: 2, medicoSolicitante: 'Remitente histórico', pacienteId: 1 } },
    examenes: [10, 11], resultados: [resultado()], logs: [] };
  llamadas = []; logFallido = null; perderCAS = null; errorTx = null;
});
const esperadoError = (status, code) => e => e.statusCode === status && (!code || e.code === code);
const estados = ['REGISTRADA', 'RECEPTADA', 'EN_PROCESAMIENTO', 'PROCESADA', 'RECHAZADA'];
const acciones = {
  RECEPTAR: { desde: ['REGISTRADA'], rol: 'RECEPCIONISTA', hasta: 'RECEPTADA', fn: () => muestras.receptarMuestra(3, ctx, 'RECEPCIONISTA') },
  INICIAR_PROCESAMIENTO: { desde: ['RECEPTADA'], rol: 'BACTERIOLOGO', hasta: 'EN_PROCESAMIENTO', fn: () => muestras.iniciarProcesamiento(3, ctx, 'BACTERIOLOGO') },
  RECHAZAR: { desde: ['REGISTRADA', 'RECEPTADA'], rol: 'RECEPCIONISTA', hasta: 'RECHAZADA', fn: () => muestras.rechazarMuestra(3, 'Volumen insuficiente', ctx, 'RECEPCIONISTA') },
};
for (const [accion, regla] of Object.entries(acciones)) for (const estado of estados) {
  test(`${accion}: muestra ${estado}`, async () => {
    db.muestra.estado = estado; db.cuenta.rol.nombre = regla.rol;
    assert.equal(politica.permiteTransicionMuestra(estado, accion), regla.desde.includes(estado));
    if (!regla.desde.includes(estado)) {
      await assert.rejects(regla.fn(), esperadoError(409, 'TRANSICION_INVALIDA')); assert.equal(db.logs.length, 0); return;
    }
    await regla.fn(); assert.equal(db.muestra.estado, regla.hasta);
    const log = db.logs[0];
    assert.deepEqual([log.usuarioId, log.entidad, log.entidadId, log.estadoAnterior, log.estadoNuevo], [7, 'MUESTRA', 3, estado, regla.hasta]);
    assert.ok(log.fechaEvento instanceof Date);
    await assert.rejects(regla.fn(), esperadoError(409)); assert.equal(db.logs.length, 1);
  });
}
for (const estado of estados) test(`registrar resultado con muestra ${estado}`, async () => {
  db.muestra.estado = estado; db.resultados = [];
  if (estado !== 'EN_PROCESAMIENTO') {
    await assert.rejects(resultados.registrarResultado(entrada, ctx), esperadoError(409, 'MUESTRA_NO_EN_PROCESAMIENTO'));
    assert.equal(db.resultados.length, 0);
  } else { await resultados.registrarResultado(entrada, ctx); assert.equal(db.resultados.length, 1); assert.equal(db.muestra.estado, 'EN_PROCESAMIENTO'); }
});
test('examen inexistente conserva 404', async () => {
  await assert.rejects(resultados.registrarResultado({ ...entrada, muestraExamenId: 999 }, ctx), esperadoError(404));
});
test('no registra dos veces el examen ni duplica su auditoría', async () => {
  await assert.rejects(resultados.registrarResultado(entrada, ctx), esperadoError(409, 'RESULTADO_DUPLICADO')); assert.equal(db.logs.length, 0);
});
test('últimos dos resultados cierran la muestra una sola vez, con bloqueo y aislamiento explícitos', async () => {
  db.resultados = [];
  await Promise.all([resultados.registrarResultado(entrada, ctx), resultados.registrarResultado({ ...entrada, muestraExamenId: 11 }, ctx)]);
  assert.equal(db.resultados.length, 2); assert.equal(db.muestra.estado, 'PROCESADA');
  assert.equal(db.logs.filter(l => l.accion === 'COMPLETAR_PROCESAMIENTO').length, 1);
  assert.ok(llamadas.filter(l => l[0] === 'transaccion').every(l => l[1].isolationLevel === 'ReadCommitted'));
  for (const indice of llamadas.flatMap((l, i) => l[0] === 'resultado.crear' ? [i] : []))
    assert.ok(llamadas.slice(0, indice).some(l => l[0] === 'lock' && l[1] === 'SELECT id FROM muestras WHERE id = ? FOR UPDATE'));
});
test('pérdida del cierre condicional revierte resultado y auditoría', async () => {
  db.examenes = [10]; db.resultados = []; perderCAS = 'muestra'; const antes = copiar(db);
  await assert.rejects(resultados.registrarResultado(entrada, ctx), esperadoError(409)); assert.deepEqual(db, antes);
});
for (const accion of ['RECEPTAR', 'RECHAZAR', 'INICIAR_PROCESAMIENTO', 'REGISTRAR', 'CORREGIR', 'VALIDAR', 'COMPLETAR_PROCESAMIENTO']) {
  test(`fallo de auditoría ${accion} revierte todos los cambios`, async () => {
    logFallido = accion; let fn;
    if (acciones[accion]) { const regla = acciones[accion]; db.muestra.estado = regla.desde[0]; db.cuenta.rol.nombre = regla.rol; fn = regla.fn; }
    else if (accion === 'REGISTRAR' || accion === 'COMPLETAR_PROCESAMIENTO') {
      db.resultados = []; db.examenes = [10]; fn = () => resultados.registrarResultado(entrada, ctx);
    } else if (accion === 'CORREGIR') fn = () => resultados.actualizarResultado(20, { ...entrada, updatedAt: fecha.toISOString() }, ctx);
    else fn = () => resultados.validarResultado(20, ctx, fecha.toISOString());
    const antes = copiar(db); await assert.rejects(fn(), /Fallo sintético/); assert.deepEqual(db, antes);
  });
}
for (const operacion of ['corregir', 'validar']) {
  for (const estado of estados) test(`${operacion} resultado con muestra ${estado}`, async () => {
    db.muestra.estado = estado;
    const fn = () => operacion === 'corregir'
      ? resultados.actualizarResultado(20, { ...entrada, updatedAt: fecha.toISOString() }, ctx)
      : resultados.validarResultado(20, ctx, fecha.toISOString());
    if (['EN_PROCESAMIENTO', 'PROCESADA'].includes(estado)) await fn();
    else { await assert.rejects(fn(), esperadoError(409, 'ESTADO_MUESTRA_INVALIDO')); assert.equal(db.logs.length, 0); }
  });
  test(`${operacion} rechaza versión ausente, ajena y resultado validado`, async () => {
    const fn = version => operacion === 'corregir'
      ? resultados.actualizarResultado(20, { ...entrada, updatedAt: version }, ctx)
      : resultados.validarResultado(20, ctx, version);
    await assert.rejects(fn(), esperadoError(400, 'VERSION_REQUERIDA'));
    await assert.rejects(fn('2025-01-01T00:00:00.000Z'), esperadoError(409));
    db.resultados[0].estado = 'VALIDADO'; await assert.rejects(fn(fecha.toISOString()), esperadoError(409, 'RESULTADO_YA_VALIDADO'));
  });
  test(`${operacion}: CAS perdedor no altera hallazgos, antibiograma ni firma`, async () => {
    perderCAS = 'resultado'; const antes = copiar(db);
    const fn = operacion === 'corregir'
      ? resultados.actualizarResultado(20, { ...entrada, updatedAt: fecha.toISOString() }, ctx)
      : resultados.validarResultado(20, ctx, fecha.toISOString());
    await assert.rejects(fn, esperadoError(409)); assert.deepEqual(db, antes);
  });
}
test('dos correcciones con igual versión: una gana y la otra no sobrescribe', async () => {
  const intento = observaciones => resultados.actualizarResultado(20, { ...entrada, observaciones, updatedAt: fecha.toISOString() }, ctx);
  const respuestas = await Promise.allSettled([intento('Primera corrección'), intento('Segunda corrección')]);
  assert.deepEqual(respuestas.map(r => r.status), ['fulfilled', 'rejected']);
  assert.equal(respuestas[1].reason.statusCode, 409); assert.equal(db.resultados[0].observaciones, 'Primera corrección');
  assert.equal(db.logs.length, 1); assert.equal(db.resultados[0].usuarioIdRegistra, 7);
});
test('firma de versión revisada antes de una corrección queda rechazada', async () => {
  await resultados.actualizarResultado(20, { ...entrada, updatedAt: fecha.toISOString() }, ctx);
  await assert.rejects(resultados.validarResultado(20, { ...ctx, usuarioId: 9 }, fecha.toISOString()), esperadoError(409));
  assert.equal(db.resultados[0].estado, 'PENDIENTE_VALIDACION');
});
test('la corrección transfiere autoría y prohíbe firmar contenido propio', async () => {
  await resultados.actualizarResultado(20, { ...entrada, updatedAt: fecha.toISOString() }, ctx);
  await assert.rejects(resultados.validarResultado(20, ctx, db.resultados[0].updatedAt.toISOString()), esperadoError(403, 'DOBLE_FIRMA_VIOLADA'));
});
test('firma ganadora impide una corrección posterior y una segunda firma', async () => {
  await resultados.validarResultado(20, ctx, fecha.toISOString());
  await assert.rejects(resultados.actualizarResultado(20, { ...entrada, updatedAt: fecha.toISOString() }, ctx), esperadoError(409));
  await assert.rejects(resultados.validarResultado(20, { ...ctx, usuarioId: 9 }, fecha.toISOString()), esperadoError(409));
  assert.equal(db.logs.length, 1); assert.equal(db.resultados[0].usuarioIdValida, 7);
});
test('versión avanza aun con reloj atrasado o dos escrituras en el mismo ms', () => {
  const futuro = new Date(Date.now() + 100000); assert.equal(siguienteVersion(futuro).getTime(), futuro.getTime() + 1);
});
for (const alteracion of ['vacio', 'blancos', 'sin bacteria', 'duplicados', 'sensibilidad', 'halo']) test(`no firma resultado incompleto/inconsistente: ${alteracion}`, async () => {
  const r = db.resultados[0];
  if (alteracion === 'vacio') r.observaciones = null;
  if (alteracion === 'blancos') r.observaciones = '   ';
  if (['sin bacteria', 'duplicados', 'sensibilidad', 'halo'].includes(alteracion)) r.antibiograma = [{ antibiotico: 'Amikacina', sensibilidad: 'S', haloMm: null }];
  if (alteracion !== 'sin bacteria' && r.antibiograma.length) r.bacteriaAislada = 'Bacteria ficticia';
  if (alteracion === 'duplicados') r.antibiograma.push({ antibiotico: 'amikacina', sensibilidad: 'R' });
  if (alteracion === 'sensibilidad') r.antibiograma[0].sensibilidad = 'X';
  if (alteracion === 'halo') r.antibiograma[0].haloMm = 100;
  await assert.rejects(resultados.validarResultado(20, ctx, fecha.toISOString()), esperadoError(409, 'RESULTADO_INCOMPLETO')); assert.equal(db.logs.length, 0);
});
for (const activa of [false, true]) for (const rol of ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR', 'AUXILIAR']) {
  test(`firma con permiso vigente: ${rol}, política nueva ${activa}`, async () => {
    env.PERMISOS_OPERATIVOS_HABILITADOS = activa; db.cuenta.rol.nombre = rol;
    const puede = activa ? rol === 'BACTERIOLOGO' : rol === 'VALIDADOR';
    if (puede) await resultados.validarResultado(20, ctx, fecha.toISOString());
    else await assert.rejects(resultados.validarResultado(20, ctx, fecha.toISOString()), esperadoError(403, 'FIRMA_PROFESIONAL_REQUERIDA'));
  });
}
for (const cambio of ['inactiva', 'eliminada', 'rol revocado']) test(`no confía en el rol pasado al servicio: cuenta ${cambio}`, async () => {
  db.muestra.estado = 'RECEPTADA';
  if (cambio === 'inactiva') db.cuenta.activo = false;
  if (cambio === 'eliminada') db.cuenta = null;
  if (cambio === 'rol revocado') db.cuenta.rol.nombre = 'RECEPCIONISTA';
  await assert.rejects(muestras.iniciarProcesamiento(3, ctx, 'BACTERIOLOGO'), esperadoError(403)); assert.equal(db.logs.length, 0);
});
test('conserva referencias históricas y no consulta nuevas columnas/tablas', async () => {
  const historica = copiar(db.muestra.solicitud); db.examenes = [10]; db.resultados = [];
  await resultados.registrarResultado(entrada, ctx); assert.deepEqual(db.muestra.solicitud, historica);
  const consulta = llamadas.find(l => l[0] === 'resultado.respuesta')[1];
  const seleccion = consulta.include.muestraExamen.include.muestra.include.solicitud.select;
  assert.equal(seleccion.medicoRemitenteId, undefined); assert.equal(seleccion.paciente.select.tipoIdentificacion, undefined);
  assert.ok(llamadas.filter(l => l[0] === 'lock').every(l => !/medicos|pacientes|roles/.test(l[1])));
  assert.ok(!/Sin crecimiento|token|password/i.test(JSON.stringify(db.logs)));
});
for (const codigo of ['P2034', 'P2028', 'P2010']) test(`conflicto transaccional ${codigo} se traduce a 409`, async () => {
  errorTx = new Prisma.PrismaClientKnownRequestError('sintético', { code: codigo, clientVersion: 'offline', meta: { code: '1213' } });
  await assert.rejects(resultados.validarResultado(20, ctx, fecha.toISOString()), esperadoError(409, 'CONFLICTO_CONCURRENCIA'));
});
function request(method, url, body = {}, rol = 'BACTERIOLOGO') {
  const token = rol && jwt.sign({ sub: '7', username: 'prueba', nombre: 'Prueba', rol, politica: 'operativa-v1' }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 60 });
  return new Promise((resolve, reject) => {
    const req = { method, url, originalUrl: url, query: {}, body, ip: ctx.ip, headers: token ? { authorization: 'Bearer ' + token } : {} };
    const res = { statusCode: 200, status(status) { this.statusCode = status; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
    router.handle(req, res, e => e ? errorHandler(e, req, res, reject) : reject(new Error('Ruta sin handler')));
  });
}
test('HTTP versión antigua devuelve conflicto controlado 409', async () => {
  const r = await request('PUT', '/20', { ...entrada, updatedAt: '2025-01-01T00:00:00.000Z' });
  assert.equal(r.status, 409); assert.equal(r.body.error.code, 'CONFLICTO_CONCURRENCIA'); assert.equal(db.logs.length, 0);
});
test('HTTP firma requiere versión, permiso y autenticación', async () => {
  assert.equal((await request('PATCH', '/20/validar')).status, 400);
  assert.equal((await request('PATCH', '/20/validar', { updatedAt: fecha.toISOString() }, null)).status, 401);
  db.cuenta.rol.nombre = 'ADMINISTRADOR';
  assert.equal((await request('PATCH', '/20/validar', { updatedAt: fecha.toISOString() }, 'ADMINISTRADOR')).status, 403);
});
test('HTTP firma válida y repetida conserva un único evento', async () => {
  const body = { updatedAt: fecha.toISOString() };
  assert.equal((await request('PATCH', '/20/validar', body)).status, 200);
  assert.equal((await request('PATCH', '/20/validar', body)).status, 409); assert.equal(db.logs.length, 1);
});
test('Zod no permite corrección sin versión ni hallazgos', () => {
  assert.equal(validadores.actualizarResultadoSchema.safeParse(entrada).success, false);
  assert.equal(validadores.actualizarResultadoSchema.safeParse({ updatedAt: fecha.toISOString() }).success, false);
});

test('dos recepciones concurrentes solo registran la transición ganadora', async () => {
  db.muestra.estado = 'REGISTRADA'; db.cuenta.rol.nombre = 'RECEPCIONISTA';
  // Dos recepciones contra la misma versión de estado; rechazo de RECEPTADA sigue siendo un paso posterior legal.
  const respuestas = await Promise.allSettled([acciones.RECEPTAR.fn(), acciones.RECEPTAR.fn()]);
  assert.deepEqual(respuestas.map(r => r.status), ['fulfilled', 'rejected']);
  assert.equal(respuestas[1].reason.statusCode, 409); assert.equal(db.logs.length, 1);
});
test('inicio de procesamiento ganador impide rechazo simultáneo', async () => {
  db.muestra.estado = 'RECEPTADA';
  const respuestas = await Promise.allSettled([acciones.INICIAR_PROCESAMIENTO.fn(), acciones.RECHAZAR.fn()]);
  assert.deepEqual(respuestas.map(r => r.status), ['fulfilled', 'rejected']);
  assert.equal(db.muestra.estado, 'EN_PROCESAMIENTO'); assert.equal(db.logs.length, 1);
});
test('CAS perdedor en recepción no produce fecha, usuario ni auditoría', async () => {
  db.muestra.estado = 'REGISTRADA'; db.cuenta.rol.nombre = 'RECEPCIONISTA'; perderCAS = 'muestra';
  const antes = copiar(db); await assert.rejects(acciones.RECEPTAR.fn(), esperadoError(409)); assert.deepEqual(db, antes);
});
test('reemplazo de antibiograma fallido conserva todas las filas originales', async () => {
  db.resultados[0].antibiograma = [{ antibiotico: 'Amikacina', sensibilidad: 'S', haloMm: '15.0' }];
  db.resultados[0].bacteriaAislada = 'Bacteria histórica'; logFallido = 'CORREGIR'; const antes = copiar(db);
  await assert.rejects(resultados.actualizarResultado(20, { ...entrada, updatedAt: fecha.toISOString() }, ctx), /Fallo sintético/);
  assert.deepEqual(db, antes);
});
test('registro y corrección vacíos se rechazan también al invocar directamente los servicios', async () => {
  await assert.rejects(resultados.registrarResultado({ muestraExamenId: 11, antibiograma: [] }, ctx));
  await assert.rejects(resultados.actualizarResultado(20, { updatedAt: fecha.toISOString(), antibiograma: [] }, ctx));
  assert.equal(db.logs.length, 0);
});

test('HTTP correcciones en el mismo segundo y ms: versión distinta y perdedor 409 sin sobrescribir', async t => {
  t.mock.method(Date, 'now', () => fecha.getTime());
  const body = observaciones => ({ ...entrada, observaciones, updatedAt: fecha.toISOString() });
  const respuestas = await Promise.all([
    request('PUT', '/20', body('Hallazgo ganador')),
    request('PUT', '/20', body('Hallazgo perdedor')),
  ]);
  assert.deepEqual(respuestas.map(r => r.status), [200, 409]);
  assert.equal(respuestas[1].body.error.code, 'CONFLICTO_CONCURRENCIA');
  assert.equal(db.resultados[0].observaciones, 'Hallazgo ganador');
  assert.equal(db.resultados[0].updatedAt.getTime(), fecha.getTime() + 1);
  assert.equal(db.logs.length, 1);

  // Con el reloj aún detenido, una corrección que sí revisó la versión nueva avanza otro ms.
  const revisada = db.resultados[0].updatedAt.toISOString();
  assert.equal((await request('PUT', '/20', { ...entrada, observaciones: 'Hallazgo revisado', updatedAt: revisada })).status, 200);
  assert.equal(db.resultados[0].updatedAt.getTime(), fecha.getTime() + 2);
  assert.equal(Math.floor(db.resultados[0].updatedAt.getTime() / 1000), Math.floor(fecha.getTime() / 1000));

  // Cada escritura lee los datos clínicos después de adquirir ambos bloqueos,
  // y compara la versión en el WHERE además de comprobar la recibida del cliente.
  for (const [i, llamada] of llamadas.entries()) {
    if (llamada[0] !== 'resultado.escribir') continue;
    const inicio = llamadas.slice(0, i).findLastIndex(l => l[0] === 'transaccion');
    const tramo = llamadas.slice(inicio, i);
    const muestraLock = tramo.findIndex(l => l[0] === 'lock' && l[1] === 'SELECT id FROM muestras WHERE id = ? FOR UPDATE');
    const resultadoLock = tramo.findIndex(l => l[0] === 'lock' && l[1] === 'SELECT id FROM resultados WHERE id = ? FOR UPDATE');
    const lecturaClinica = tramo.findIndex(l => l[0] === 'resultado.leer' && l[1].include);
    assert.ok(muestraLock >= 0 && resultadoLock > muestraLock && lecturaClinica > resultadoLock);
    assert.ok(llamada[2].updatedAt.getTime() > llamada[1].updatedAt.getTime());
  }
});

test('HTTP firma en el mismo ms incrementa versión y rechaza una corrección de la copia revisada antes', async t => {
  t.mock.method(Date, 'now', () => fecha.getTime());
  const respuesta = await request('PATCH', '/20/validar', { updatedAt: fecha.toISOString() });
  assert.equal(respuesta.status, 200);
  assert.equal(db.resultados[0].updatedAt.getTime(), fecha.getTime() + 1);
  const firmada = copiar(db.resultados[0]);
  const conflicto = await request('PUT', '/20', { ...entrada, observaciones: 'No debe reemplazar la firma', updatedAt: fecha.toISOString() });
  assert.equal(conflicto.status, 409);
  assert.deepEqual(db.resultados[0], firmada);
  assert.equal(db.logs.length, 1);
});
