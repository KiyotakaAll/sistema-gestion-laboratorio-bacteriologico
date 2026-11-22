const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const Module = require('node:module');
require('./solo-mocks.cjs');

function sustituir(ruta, exports) {
  const id = require.resolve(ruta);
  const modulo = new Module(id);
  Object.assign(modulo, { exports, loaded: true });
  require.cache[id] = modulo;
}

// Dobles deliberadamente pequeños: capturan consultas y devuelven respuestas configuradas.
// NO implementan UNIQUE, FK, collation, orden SQL ni rollback; eso requiere MySQL aislado.
let consultas, registro, encontrado, filas, total, falloUnique;
const copiar = (valor) => structuredClone(valor);
const consultar = (metodo, respuesta) => async (args) => {
  consultas.push({ metodo, args: copiar(args) });
  return copiar(respuesta());
};
const prisma = {
  paciente: {
    findUnique: consultar('paciente.findUnique', () => encontrado),
    findMany: consultar('paciente.findMany', () => filas),
    count: consultar('paciente.count', () => total),
    create: async (args) => {
      consultas.push({ metodo: 'paciente.create', args: copiar(args) });
      if (falloUnique) throw falloUnique;
      return { ...copiar(registro), ...copiar(args.data) };
    },
    update: consultar('paciente.update', () => registro),
  },
  solicitud: {
    findFirst: consultar('solicitud.findFirst', () => null),
    create: consultar('solicitud.create', () => ({ id: 314, pacienteId: 73, codigo: 'SOL-2026-000001' })),
    findMany: consultar('solicitud.findMany', () => []),
    count: consultar('solicitud.count', () => 0),
  },
  muestra: { update: () => { throw new Error('No debe modificar muestras'); } },
  resultado: { update: () => { throw new Error('No debe modificar resultados'); } },
  logAuditoria: { create: consultar('logAuditoria.create', () => ({ id: 1n })) },
  $transaction: async (accion) => typeof accion === 'function' ? accion(prisma) : Promise.all(accion),
};
const secreto = 'secreto-sintetico-caracterizacion-pacientes';
sustituir('../src/config/prisma.ts', { prisma });
sustituir('../src/config/env.ts', { env: { JWT_SECRET: secreto, NODE_ENV: 'production' } });
const { Prisma } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = require('../src/routes/paciente.routes.ts').default;
const { errorHandler } = require('../src/middlewares/errorHandler.ts');
const pacientes = require('../src/services/paciente.service.ts');
const ordenes = require('../src/services/orden.service.ts');
const { listarSolicitudesQuerySchema } = require('../src/validators/orden.validator.ts');
const { listarMuestrasQuerySchema } = require('../src/validators/muestra.validator.ts');
const ctx = { usuarioId: 7, ip: '127.0.0.1' };
const valido = {
  cedula: '00Ab-123', nombres: 'Persona Sintética', apellidos: 'Paciente Prueba',
  fechaNacimiento: '1990-05-12', sexo: 'F', telefono: '3000000000',
  email: 'paciente@example.test', direccion: 'Dirección sintética',
};
const edicion = () => {
  const { cedula, ...datos } = valido;
  return datos;
};
const llamadas = (metodo) => consultas.filter((c) => c.metodo === metodo);

// Router, autenticación, controlador, validación y servicio reales; sin app.listen ni sockets.
function peticion(method, url = '/', body = {}, query = {}) {
  return new Promise((resolve, reject) => {
    const token = jwt.sign({ sub: '7', username: 'recepcion-prueba', nombre: 'Prueba', rol: 'RECEPCIONISTA' },
      secreto, { algorithm: 'HS256', expiresIn: 60 });
    const req = { method, url, originalUrl: url, body, query, ip: ctx.ip,
      headers: { authorization: `Bearer ${token}` } };
    const res = { statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, body: JSON.parse(JSON.stringify(data)) }); },
    };
    router.handle(req, res, (error) => error
      ? errorHandler(error, req, res, reject)
      : reject(new Error('Ruta no atendida')));
  });
}

beforeEach((t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 22, 17) });
  consultas = []; encontrado = null; filas = []; total = 0; falloUnique = null;
  registro = { id: 73, ...valido, fechaNacimiento: new Date('1990-05-12T00:00:00Z'),
    createdAt: new Date('2026-01-01T12:00:00Z'), updatedAt: new Date('2026-01-01T12:00:00Z') };
});

for (const [nombre, cedula] of [
  ['omitido', undefined], ['nulo', null], ['vacío', ''], ['solo espacios', '   '],
  ['numérico en JSON', 123456], ['cuatro caracteres', '1234'],
  ['veintiún caracteres', 'A'.repeat(21)], ['espacio interior', 'AB 123'],
  ['puntuación no admitida', 'AB.123'], ['letra fuera de ASCII', 'ÁB123'],
]) test(`creación: rechaza documento ${nombre} antes de consultar Prisma`, async () => {
  const r = await peticion('POST', '/', { ...valido, cedula });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'VALIDACION_FALLIDA');
  assert.ok(r.body.error.details.some((d) => d.campo === 'cedula'));
  assert.deepEqual(consultas, []);
});

for (const cedula of ['12345', 'A'.repeat(20), '00Ab-123', '00123456']) {
  test(`creación: admite texto ${cedula} sin conversión numérica`, async () => {
    const r = await peticion('POST', '/', { ...valido, cedula: ` ${cedula} ` });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.cedula, cedula);
    assert.equal(typeof r.body.data.cedula, 'string');
    assert.equal(r.body.data.id, 73);
    assert.deepEqual(llamadas('paciente.findUnique')[0].args.where, { cedula });
    assert.equal(llamadas('paciente.create')[0].args.data.cedula, cedula);
  });
}

test('creación: normaliza demografía, conserva contrato JSON y audita con el ID interno', async () => {
  const r = await peticion('POST', '/', { ...valido, nombres: ' Persona Sintética ', apellidos: ' Paciente Prueba ' });
  assert.equal(r.status, 201);
  assert.deepEqual(Object.keys(r.body), ['data']);
  assert.deepEqual(r.body.data, { ...registro, nombres: valido.nombres, apellidos: valido.apellidos,
    fechaNacimiento: '1990-05-12T00:00:00.000Z',
    createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z' });
  const log = llamadas('logAuditoria.create')[0].args.data;
  assert.equal(log.entidad, 'PACIENTE');
  assert.equal(log.entidadId, 73);
  assert.equal(log.accion, 'CREAR');
  assert.equal(log.usuarioId, 7);
});

test('creación: documento encontrado devuelve 409 sin crear ni auditar', async () => {
  encontrado = { id: 91 };
  const r = await peticion('POST', '/', valido);
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: { code: 'PACIENTE_DUPLICADO',
    message: 'Ya existe un paciente con esa cédula.', details: { pacienteId: 91 } } });
  assert.equal(llamadas('paciente.create').length, 0);
  assert.equal(llamadas('logAuditoria.create').length, 0);
});

test('creación: traduce un P2002 simulado, sin afirmar unicidad SQL ni concurrencia', async () => {
  falloUnique = new Prisma.PrismaClientKnownRequestError('Duplicado simulado', {
    code: 'P2002', clientVersion: 'test', meta: { target: 'uq_pacientes_cedula' },
  });
  const r = await peticion('POST', '/', valido);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'REGISTRO_DUPLICADO');
  assert.equal(llamadas('logAuditoria.create').length, 0);
});

for (const [campo, valor] of [
  ['nombres', 'A'], ['apellidos', 'B'], ['sexo', 'X'],
  ['email', 'sin-correo'], ['fechaNacimiento', '2999-01-01'], ['fechaNacimiento', 'no-es-fecha'],
]) test(`demografía: rechaza ${campo}=${valor}`, async () => {
  const r = await peticion('POST', '/', { ...valido, [campo]: valor });
  assert.equal(r.status, 400);
  assert.ok(r.body.error.details.some((d) => d.campo === campo));
  assert.deepEqual(consultas, []);
});

test('LIMITACIÓN: nacimiento null se convierte en 1970; todavía no se valida como fecha civil estricta', async () => {
  const r = await peticion('POST', '/', { ...valido, fechaNacimiento: null });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.fechaNacimiento, '1970-01-01T00:00:00.000Z');
});

test('LIMITACIÓN: JavaScript normaliza el 30 de febrero antes de validar el nacimiento', async () => {
  const r = await peticion('POST', '/', { ...valido, fechaNacimiento: '2026-02-30' });
  assert.equal(r.status, 201);
  assert.equal(r.body.data.fechaNacimiento, '2026-03-02T00:00:00.000Z');
});

test('actualización: busca y escribe por ID, conserva cédula y no solicita cambios de relaciones', async () => {
  encontrado = { id: 73 };
  const r = await peticion('PUT', '/73', { ...edicion(), nombres: 'Nombre actualizado' });
  assert.equal(r.status, 200);
  assert.deepEqual(llamadas('paciente.findUnique')[0].args, { where: { id: 73 }, select: { id: true } });
  const cambio = llamadas('paciente.update')[0].args;
  assert.deepEqual(cambio.where, { id: 73 });
  assert.equal(cambio.data.nombres, 'Nombre actualizado');
  assert.deepEqual(Object.keys(cambio.data).sort(),
    ['nombres', 'apellidos', 'fechaNacimiento', 'sexo', 'telefono', 'email', 'direccion'].sort());
  assert.equal(r.body.data.cedula, valido.cedula);
  assert.deepEqual(consultas.map((c) => c.metodo),
    ['paciente.findUnique', 'paciente.update', 'logAuditoria.create']);
  assert.equal(llamadas('logAuditoria.create')[0].args.data.entidadId, 73);
});

test('LIMITACIÓN: PUT con otra cédula la ignora silenciosamente y devuelve 200', async () => {
  encontrado = { id: 73 };
  const r = await peticion('PUT', '/73', { ...edicion(), cedula: 'CAMBIO-999' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.cedula, valido.cedula);
  assert.equal(Object.hasOwn(llamadas('paciente.update')[0].args.data, 'cedula'), false);
});

test('actualización: paciente inexistente devuelve 404 sin escritura ni auditoría', async () => {
  const r = await peticion('PUT', '/999', edicion());
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'PACIENTE_NO_ENCONTRADO');
  assert.equal(llamadas('paciente.update').length, 0);
  assert.equal(llamadas('logAuditoria.create').length, 0);
});

for (const campo of ['nombres', 'apellidos', 'fechaNacimiento', 'sexo']) {
  test(`actualización: PUT exige ${campo}; no es una edición parcial`, async () => {
    const datos = edicion(); delete datos[campo];
    const r = await peticion('PUT', '/73', datos);
    assert.equal(r.status, 400);
    assert.deepEqual(consultas, []);
  });
}

test('LIMITACIÓN: PUT borra contactos opcionales omitidos en lugar de conservarlos', async () => {
  encontrado = { id: 73 };
  const { telefono, email, direccion, ...datos } = edicion();
  const r = await peticion('PUT', '/73', datos);
  assert.equal(r.status, 200);
  const cambio = llamadas('paciente.update')[0].args.data;
  assert.equal(cambio.telefono, null);
  assert.equal(cambio.email, null);
  assert.equal(cambio.direccion, null);
  // Se comprueba el comando real enviado a Prisma, no una persistencia inventada por el doble.
});

test('actualización: contactos explícitos conservan su texto y vacíos se convierten en null', async () => {
  encontrado = { id: 73 };
  await peticion('PUT', '/73', { ...edicion(), telefono: ' 3001112222 ', email: '', direccion: ' ' });
  const cambio = llamadas('paciente.update')[0].args.data;
  assert.equal(cambio.telefono, '3001112222');
  assert.equal(cambio.email, null);
  assert.equal(cambio.direccion, null);
});

for (const q of ['00Ab', 'Persona', 'Paciente']) {
  test(`listado: búsqueda ${q} envía OR documental y demográfico con paginación`, async () => {
    filas = [registro]; total = 6;
    const r = await peticion('GET', '/', {}, { q: ` ${q} `, page: '2', pageSize: '2' });
    assert.equal(r.status, 200);
    const where = { OR: [{ cedula: { contains: q } }, { apellidos: { contains: q } }, { nombres: { contains: q } }] };
    assert.deepEqual(llamadas('paciente.findMany')[0].args, {
      where, orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }], skip: 2, take: 2,
    });
    assert.deepEqual(llamadas('paciente.count')[0].args, { where });
    assert.deepEqual(Object.keys(r.body).sort(), ['data', 'total', 'page', 'pageSize', 'totalPages'].sort());
    assert.equal(r.body.data[0].id, 73);
    assert.equal(r.body.data[0].cedula, valido.cedula);
    assert.deepEqual([r.body.total, r.body.page, r.body.pageSize, r.body.totalPages], [6, 2, 2, 3]);
    // No se imita la collation ni la selección de filas de MySQL.
  });
}

test('listado vacío: usa valores por defecto y al menos una página', async () => {
  const r = await peticion('GET');
  assert.deepEqual(r.body, { data: [], total: 0, page: 1, pageSize: 25, totalPages: 1 });
  assert.deepEqual(llamadas('paciente.findMany')[0].args.where, {});
});

for (const query of [{ page: '0' }, { pageSize: '101' }, { q: '' }]) {
  test(`listado: rechaza filtros ${JSON.stringify(query)} sin consultas`, async () => {
    assert.equal((await peticion('GET', '/', {}, query)).status, 400);
    assert.deepEqual(consultas, []);
  });
}

test('detalle: usa ID y solicita las últimas veinte solicitudes, no todo el historial', async () => {
  encontrado = { ...registro, solicitudes: [{ id: 314, pacienteId: 73, _count: { muestras: 2 } }] };
  const r = await peticion('GET', '/73');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.solicitudes[0].pacienteId, 73);
  assert.deepEqual(llamadas('paciente.findUnique')[0].args, {
    where: { id: 73 }, include: { solicitudes: {
      orderBy: { fechaSolicitud: 'desc' }, take: 20, include: { _count: { select: { muestras: true } } },
    } },
  });
});

test('detalle: conserva 404 e ID inválido se rechaza antes de Prisma', async () => {
  const r = await peticion('GET', '/999');
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'PACIENTE_NO_ENCONTRADO');
  consultas = [];
  assert.equal((await peticion('GET', '/no-id')).status, 400);
  assert.deepEqual(consultas, []);
});

test('solicitud: el servicio solo necesita pacienteId y recibe un paciente sin cédula en su proyección', async () => {
  encontrado = { id: 73 };
  const r = await ordenes.crearSolicitud({ pacienteId: 73, prioridad: 'RUTINA' }, ctx);
  assert.equal(r.pacienteId, 73);
  assert.deepEqual(llamadas('paciente.findUnique')[0].args, { where: { id: 73 }, select: { id: true } });
  const datos = llamadas('solicitud.create')[0].args.data;
  assert.equal(datos.pacienteId, 73);
  assert.equal(Object.hasOwn(datos, 'cedula'), false);
  assert.equal(datos.codigo, 'SOL-2026-000001');
  assert.equal(llamadas('logAuditoria.create')[0].args.data.detalle.pacienteId, 73);
});

test('solicitud: paciente inexistente impide crear la solicitud', async () => {
  await assert.rejects(ordenes.crearSolicitud({ pacienteId: 999, prioridad: 'RUTINA' }, ctx),
    (e) => e.statusCode === 404 && e.code === 'PACIENTE_NO_ENCONTRADO');
  assert.equal(llamadas('solicitud.create').length, 0);
});

test('servicio: editar demografía mantiene el ID que utiliza la siguiente solicitud', async () => {
  encontrado = { id: 73 };
  const actualizado = await pacientes.actualizarPaciente(73, { ...edicion(), nombres: 'Otro nombre' }, ctx);
  await ordenes.crearSolicitud({ pacienteId: actualizado.id, prioridad: 'URGENTE' }, ctx);
  assert.deepEqual(llamadas('paciente.update')[0].args.where, { id: 73 });
  assert.equal(llamadas('solicitud.create')[0].args.data.pacienteId, 73);
  assert.deepEqual(consultas.map((c) => c.metodo), [
    'paciente.findUnique', 'paciente.update', 'logAuditoria.create',
    'paciente.findUnique', 'solicitud.findFirst', 'solicitud.create', 'logAuditoria.create',
  ]);
});

test('solicitudes: filtro documental parcial coexiste con pacienteId y prioridad', async () => {
  const filtros = listarSolicitudesQuerySchema.parse({ cedula: ' 00Ab ', pacienteId: '73', prioridad: 'URGENTE', page: '2', pageSize: '20' });
  const r = await ordenes.listarSolicitudes(filtros);
  const consulta = llamadas('solicitud.findMany')[0].args;
  assert.deepEqual(consulta.where, { pacienteId: 73, prioridad: 'URGENTE', paciente: { cedula: { contains: '00Ab' } } });
  assert.equal(consulta.skip, 20);
  assert.equal(consulta.take, 20);
  assert.deepEqual(consulta.include.paciente.select, { id: true, cedula: true, nombres: true, apellidos: true });
  assert.equal(r.page, 2);
});

test('filtros documentales de solicitudes y muestras admiten texto y rechazan más de veinte caracteres', () => {
  for (const schema of [listarSolicitudesQuerySchema, listarMuestrasQuerySchema]) {
    assert.equal(schema.parse({ cedula: ' 00Ab-123 ' }).cedula, '00Ab-123');
    assert.equal(schema.safeParse({ cedula: 'A'.repeat(21) }).success, false);
    assert.equal(schema.safeParse({ cedula: '' }).success, false);
  }
});
