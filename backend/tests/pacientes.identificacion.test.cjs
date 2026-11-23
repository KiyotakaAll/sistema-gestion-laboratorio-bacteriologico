const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const Module = require('node:module');
require('./solo-mocks.cjs');
function sustituir(ruta, exports) {
  const id = require.resolve(ruta); const m = new Module(id);
  Object.assign(m, { exports, loaded: true }); require.cache[id] = m;
}
const env = { NODE_ENV: 'production', JWT_SECRET: 'clave-sintetica-pruebas-identificacion', PACIENTES_IDENTIFICACION_HABILITADA: true };
let calls, actual, existe, duplicado, cantidad, fallaLog, esquemaListo, filtros;
const datos = { nombres: 'Persona Sintética', apellidos: 'Paciente Prueba', fechaNacimiento: '2020-02-29', sexo: 'O' };
const doc = (tipo = 'CC', numero = '00123456', pais) => ({ estado: 'DOCUMENTADO', tipo, numero, ...(pais ? { paisEmisor: pais } : {}) });
const ausencia = estado => ({ estado, tipo: null, numero: null, paisEmisor: null, motivoAusencia: 'Motivo sintético válido' });
const columnas = [
  ['id', 'NO', 'int unsigned', null], ['cedula', 'YES', 'varchar(20)', 'utf8mb4_unicode_ci'],
  ['estado_identificacion', 'NO', 'varchar(32)', 'utf8mb4_0900_bin'],
  ['tipo_documento', 'YES', 'varchar(3)', 'utf8mb4_0900_bin'],
  ['numero_documento', 'YES', 'varchar(20)', 'utf8mb4_0900_bin'],
  ['pais_emisor_documento', 'YES', 'varchar(2)', 'utf8mb4_0900_bin'],
  ['clave_identificacion', 'YES', 'varchar(64)', 'utf8mb4_0900_bin'],
  ['motivo_ausencia_documento', 'YES', 'varchar(255)', 'utf8mb4_0900_bin'],
  ['version_identificacion', 'NO', 'int unsigned', null],
].map(([nombre, nullable, tipo, collation]) => ({ nombre, nullable, tipo, collation }));
const paciente = {
  findUnique: async args => { calls.push(['findUnique', args]); return args.where.id ? (existe ? { ...actual } : null) : null; },
  findUniqueOrThrow: async args => { calls.push(['findUniqueOrThrow', args]); return { ...actual }; },
  create: async args => { calls.push(['create', args]); if (duplicado) throw duplicado; actual = { ...actual, ...args.data }; return { ...actual }; },
  update: async args => { calls.push(['update', args]); actual = { ...actual, ...args.data }; return { ...actual }; },
  updateMany: async args => { calls.push(['updateMany', args]); if (duplicado) throw duplicado;
    if (cantidad === 1) actual = { ...actual, ...args.data, versionIdentificacion: actual.versionIdentificacion + 1 }; return { count: cantidad }; },
  findMany: async args => { calls.push(['findMany', args]); filtros = args; return [actual]; },
  count: async () => 1,
};
const tx = { paciente, logAuditoria: { create: async args => {
  calls.push(['audit-tx', args]); if (fallaLog) throw new Error('Auditoría simulada no disponible'); return {};
} } };
const prisma = { paciente,
  logAuditoria: { create: () => { throw new Error('Auditoría fuera de transacción prohibida'); } },
  $queryRaw: async strings => {
    const sql = strings.join(''); calls.push(['metadata', sql]);
    if (!esquemaListo) return [];
    if (sql.includes('COLUMNS')) return columnas;
    if (sql.includes('STATISTICS')) return [{ nombre: 'uq_pacientes_clave_identificacion', columna: 'clave_identificacion', noUnico: 0 }];
    return ['estado', 'formato', 'clave'].map(n => ({ nombre: 'ck_pacientes_ident_' + n, enforced: 'YES' }));
  },
  $transaction: async action => {
    if (typeof action !== 'function') return Promise.all(action);
    calls.push(['tx-inicio']);
    try { const r = await action(tx); calls.push(['tx-fin']); return r; }
    catch (e) { calls.push(['tx-error']); throw e; }
  },
};
sustituir('../src/config/prisma.ts', { prisma }); sustituir('../src/config/env.ts', { env });
const { Prisma } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = require('../src/routes/paciente.routes.ts').default;
const { errorHandler } = require('../src/middlewares/errorHandler.ts');
const { publicarPacientes, seleccionPaciente, seleccionPacienteResumen } = require('../src/services/identificacion-paciente.ts');
const consultas = nombre => calls.filter(c => c[0] === nombre);
function request(method, url, body = {}, rol = 'RECEPCIONISTA', query = {}) {
  return new Promise((resolve, reject) => {
    const token = rol ? jwt.sign({ sub: '7', username: 'prueba', nombre: 'Prueba', rol }, env.JWT_SECRET, { algorithm: 'HS256' }) : null;
    const req = { method, url, originalUrl: url, body, query, ip: '127.0.0.1', headers: token ? { authorization: 'Bearer ' + token } : {} };
    const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(v) { resolve({ status: this.statusCode, body: JSON.parse(JSON.stringify(v)) }); } };
    router.handle(req, res, e => e ? errorHandler(e, req, res, reject) : reject(new Error('Ruta no atendida')));
  });
}
beforeEach(() => {
  calls = []; existe = true; duplicado = null; cantidad = 1; fallaLog = false; esquemaListo = true;
  env.PACIENTES_IDENTIFICACION_HABILITADA = true;
  actual = { id: 73, ...datos, cedula: '00-legado', fechaNacimiento: new Date('2020-02-29T00:00:00Z'),
    telefono: '3000000000', email: 'prueba@example.test', direccion: 'Dirección sintética',
    estadoIdentificacion: 'LEGADO_POR_REVISAR', tipoDocumento: null, numeroDocumento: null,
    paisEmisorDocumento: null, motivoAusenciaDocumento: null, claveIdentificacion: null, versionIdentificacion: 0 };
});

for (const [tipo, numero, pais, clave] of [
  ['CC', '00123456', undefined, 'CC:CO:00123456'], ['TI', '00012345', undefined, 'TI:CO:00012345'],
  ['RC', 'ab-001', undefined, 'RC:CO:AB-001'], ['CE', 'ce-001', undefined, 'CE:CO:CE-001'],
  ['PA', 'ab001-X', 've', 'PA:VE:AB001-X'], ['PPT', 'ppt-001', undefined, 'PPT:CO:PPT-001'],
]) test('POST integra el núcleo para ' + tipo + ' sin inventar cédula ni exponer clave', async () => {
  const r = await request('POST', '/', { ...datos, identificacion: doc(tipo, numero, pais) });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.id, 73); assert.equal(r.body.data.cedula, null);
  assert.equal(r.body.data.identificacion.tipo, tipo); assert.equal(r.body.data.identificacion.numero, numero);
  const data = consultas('create')[0][1].data;
  assert.equal(data.claveIdentificacion, clave); assert.equal(data.cedula, null);
  assert.equal(data.versionIdentificacion, 0);
  assert.equal(JSON.stringify(r.body).includes('claveIdentificacion'), false);
  assert.equal(consultas('audit-tx')[0][1].data.usuarioId, 7);
});
for (const estado of ['SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE']) test('POST ' + estado + ': dos admisiones sin clave ni búsqueda NULL', async () => {
  for (let n = 0; n < 2; n++) assert.equal((await request('POST', '/', { ...datos, identificacion: ausencia(estado) })).status, 201);
  assert.equal(consultas('create').length, 2); assert.equal(consultas('findUnique').length, 0);
  assert.ok(consultas('create').every(c => c[1].data.claveIdentificacion === null));
  // No afirma IDs autoincrementales distintos ni UNIQUE real: el doble no es MySQL.
});
for (const identificacion of [doc('PA', 'abc'), doc('CC', 'A123'), { ...ausencia('SIN_DOCUMENTO_ASIGNADO'), numero: '12345' },
  { ...doc(), claveIdentificacion: 'externa' }, { estado: 'LEGADO_POR_REVISAR', cedula: '00123456' }]) {
  test('POST rechaza identificación incoherente ' + JSON.stringify(identificacion), async () => {
    assert.equal((await request('POST', '/', { ...datos, identificacion })).status, 400);
    assert.equal(calls.length, 0);
  });
}
for (const fechaNacimiento of [null, '2026-02-30', '2025-02-29', '2020-2-29', '2020-02-29T00:00:00Z', '2999-01-01']) {
  test('fecha estricta rechaza ' + fechaNacimiento, async () => {
    assert.equal((await request('POST', '/', { ...datos, fechaNacimiento, identificacion: doc() })).status, 400);
    assert.equal(calls.length, 0);
  });
}
test('capacidad apagada no consulta metadatos y rechaza escritura nueva', async () => {
  env.PACIENTES_IDENTIFICACION_HABILITADA = false;
  assert.deepEqual((await request('GET', '/capacidades')).body, { data: { identificacionPacientes: false, registroPacientes: true } });
  assert.equal((await request('POST', '/', { ...datos, identificacion: doc() })).status, 503);
  assert.equal((await request('PATCH', '/73/identificacion', { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0 })).status, 503);
  assert.deepEqual(calls, []);
});
test('activación requiere esquema verificado antes de anunciarse o escribir', async () => {
  esquemaListo = false;
  assert.equal((await request('GET', '/capacidades')).body.data.identificacionPacientes, false);
  assert.equal((await request('GET', '/capacidades')).body.data.registroPacientes, false);
  assert.equal((await request('POST', '/', { ...datos, identificacion: doc() })).status, 503);
  assert.equal(consultas('create').length, 0); assert.equal(consultas('tx-inicio').length, 0);
});
test('capacidad solo se anuncia tras comprobar columnas, índice y CHECK', async () => {
  assert.equal((await request('GET', '/capacidades')).body.data.identificacionPacientes, true);
  assert.equal(consultas('metadata').length, 3);
});
test('fallo de lectura de metadatos cierra la escritura con 503, sin filtrar detalles', async t => {
  t.mock.method(prisma, '$queryRaw', async () => { throw new Error('Detalle técnico sintético'); });
  const r = await request('POST', '/', { ...datos, identificacion: doc() });
  assert.equal(r.status, 503); assert.equal(r.body.error.code, 'IDENTIFICACION_ESQUEMA_PENDIENTE');
  assert.equal(JSON.stringify(r.body).includes('Detalle técnico'), false);
  assert.equal(consultas('create').length, 0);
});
test('selecciones antiguas no incluyen columnas nuevas, tampoco en resúmenes', () => {
  env.PACIENTES_IDENTIFICACION_HABILITADA = false;
  assert.deepEqual(Object.keys(seleccionPaciente()).sort(), ['id', 'cedula', 'nombres', 'apellidos', 'fechaNacimiento', 'sexo', 'telefono', 'email', 'direccion', 'createdAt', 'updatedAt'].sort());
  assert.deepEqual(seleccionPacienteResumen(), { id: true, cedula: true, nombres: true, apellidos: true });
});
test('histórico se devuelve sin inferencia documental', async () => {
  const r = await request('GET', '/73');
  assert.deepEqual(r.body.data.identificacion, { estado: 'LEGADO_POR_REVISAR', tipo: null, numero: null, paisEmisor: null, valorLegado: '00-legado' });
  assert.equal(r.body.data.versionIdentificacion, 0);
});
test('PATCH utiliza ID+versión, conserva cédula y audita ambos valores con motivo', async () => {
  const r = await request('PATCH', '/73/identificacion', { identificacion: doc('PA', 'ab001-X', 'VE'), motivoCambio: 'Documento confirmado', versionIdentificacion: 0 });
  assert.equal(r.status, 200); assert.equal(r.body.data.versionIdentificacion, 1);
  assert.deepEqual(consultas('updateMany')[0][1].where, { id: 73, versionIdentificacion: 0 });
  assert.equal(Object.hasOwn(consultas('updateMany')[0][1].data, 'cedula'), false);
  assert.equal(actual.cedula, '00-legado');
  const log = consultas('audit-tx')[0][1].data;
  assert.equal(log.accion, 'CAMBIAR_IDENTIFICACION'); assert.equal(log.entidadId, 73);
  assert.equal(log.detalle.anterior.valorLegado, '00-legado'); assert.equal(log.detalle.nuevo.numero, 'ab001-X');
  assert.equal(log.detalle.motivo, 'Documento confirmado');
  assert.ok(!JSON.stringify(log).includes('claveIdentificacion'));
  assert.equal(calls.at(-1)[0], 'tx-fin');
});
test('repetición con versión antigua devuelve 409 sin otra escritura ni auditoría', async () => {
  const body = { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0 };
  assert.equal((await request('PATCH', '/73/identificacion', body)).status, 200);
  assert.equal((await request('PATCH', '/73/identificacion', body)).body.error.code, 'VERSION_IDENTIFICACION_CONFLICTO');
  assert.equal(consultas('updateMany').length, 1); assert.equal(consultas('audit-tx').length, 1);
});
test('completar identificación posterior a una ausencia conserva ID e histórico', async () => {
  assert.equal((await request('PATCH', '/73/identificacion', { identificacion: ausencia('SIN_DOCUMENTO_ASIGNADO'), motivoCambio: 'Ausencia confirmada', versionIdentificacion: 0 })).status, 200);
  const r = await request('PATCH', '/73/identificacion', { identificacion: doc('TI', '00012345'), motivoCambio: 'Documento recibido', versionIdentificacion: 1 });
  assert.equal(r.status, 200); assert.equal(r.body.data.id, 73); assert.equal(r.body.data.versionIdentificacion, 2);
  assert.equal(r.body.data.identificacion.tipo, 'TI'); assert.equal(actual.cedula, '00-legado');
  assert.equal(actual.motivoAusenciaDocumento, null);
});
test('CAS perdido después de leer devuelve 409 sin auditar', async () => {
  cantidad = 0;
  assert.equal((await request('PATCH', '/73/identificacion', { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0 })).status, 409);
  assert.equal(consultas('audit-tx').length, 0);
});
test('error de auditoría rechaza la misma transacción (rollback SQL pendiente de integración)', async () => {
  fallaLog = true;
  assert.equal((await request('PATCH', '/73/identificacion', { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0 })).status, 500);
  assert.equal(calls.at(-1)[0], 'tx-error'); assert.equal(consultas('tx-fin').length, 0);
});
test('paciente inexistente devuelve 404 sin cambios', async () => {
  existe = false;
  assert.equal((await request('PATCH', '/999/identificacion', { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0 })).status, 404);
  assert.equal(consultas('updateMany').length, 0);
});
for (const rol of [null, 'BACTERIOLOGO', 'VALIDADOR']) test('PATCH respeta autorización actual: ' + rol, async () => {
  assert.equal((await request('PATCH', '/73/identificacion', { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0 }, rol)).status, rol ? 403 : 401);
  assert.deepEqual(calls, []);
});
for (const rol of ['ADMINISTRADOR', 'RECEPCIONISTA']) test('PATCH permitido a ' + rol, async () => {
  assert.equal((await request('PATCH', '/73/identificacion', { identificacion: ausencia('DOCUMENTO_NO_DISPONIBLE'), motivoCambio: 'Cambio confirmado', versionIdentificacion: 0 }, rol)).status, 200);
});
for (const cambios of [{ motivoCambio: '' }, { versionIdentificacion: undefined }, { versionIdentificacion: -1 }, { claveIdentificacion: 'externa' }]) {
  test('PATCH exige contrato completo ' + JSON.stringify(cambios), async () => {
    assert.equal((await request('PATCH', '/73/identificacion', { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0, ...cambios })).status, 400);
    assert.equal(calls.length, 0);
  });
}
for (const method of ['POST', 'PATCH']) test(method + ': P2002 simulado da conflicto documental identificable', async () => {
  duplicado = new Prisma.PrismaClientKnownRequestError('Simulado', { code: 'P2002', clientVersion: '6.19.3', meta: { target: 'uq_pacientes_clave_identificacion' } });
  const r = method === 'POST' ? await request('POST', '/', { ...datos, identificacion: doc() })
    : await request('PATCH', '/73/identificacion', { identificacion: doc(), motivoCambio: 'Motivo válido', versionIdentificacion: 0 });
  assert.equal(r.status, 409); assert.equal(r.body.error.code, 'PACIENTE_DUPLICADO');
  assert.equal(consultas('audit-tx').length, 0);
});
test('búsqueda tipificada normaliza clave; mantiene paginación y búsqueda nominal/legado', async () => {
  const r = await request('GET', '/', {}, 'RECEPCIONISTA', { tipoDocumento: 'pa', numeroDocumento: 'ab001-X', paisEmisorDocumento: 've', page: '2', pageSize: '5', q: 'Persona' });
  assert.equal(r.status, 200); assert.equal(filtros.skip, 5); assert.equal(filtros.take, 5);
  assert.equal(filtros.where.AND[1].claveIdentificacion, 'PA:VE:AB001-X');
  assert.ok(JSON.stringify(filtros.where).includes('nombres')); assert.ok(JSON.stringify(filtros.where).includes('cedula'));
});
test('proyecciones clínicas eliminan claves y conservan IDs y referencia temporal', () => {
  const cadena = { paciente: { ...actual, claveIdentificacion: 'interna' }, pacienteId: 73, muestras: [{ id: 9, solicitudId: 8, fechaToma: new Date('2026-01-01Z') }] };
  const r = publicarPacientes(cadena);
  assert.equal(r.pacienteId, 73); assert.deepEqual(r.muestras, cadena.muestras);
  assert.equal('claveIdentificacion' in r.paciente, false);
});
test('PUT no acepta identificación, motivo ni versión como edición demográfica', async () => {
  assert.equal((await request('PUT', '/73', { ...datos, identificacion: doc() })).status, 400);
  assert.equal(consultas('update').length, 0);
});
for (const [campo, valor, esperado] of [['telefono', null, null], ['email', '', null], ['direccion', '  ', null], ['telefono', ' 3001112222 ', '3001112222']]) {
  test('contacto explícito ' + campo + '=' + JSON.stringify(valor), async () => {
    assert.equal((await request('PUT', '/73', { ...datos, [campo]: valor })).status, 200);
    const data = consultas('update')[0][1].data;
    assert.equal(data[campo], esperado);
    for (const otro of ['telefono', 'email', 'direccion'].filter(x => x !== campo)) assert.equal(Object.hasOwn(data, otro), false);
  });
}
