const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const Module = require('node:module');

// Sustituir ambos módulos ANTES de cargar las rutas: no se carga dotenv,
// no se construye PrismaClient y no existe conexión a MySQL en estas pruebas.
function sustituirModulo(ruta, exports) {
  const id = require.resolve(ruta);
  const modulo = new Module(id);
  modulo.exports = exports;
  modulo.loaded = true;
  require.cache[id] = modulo;
}

const consultas = [];
const paciente = { id: 1, cedula: 'FICTICIA', nombres: 'Paciente', apellidos: 'Prueba' };
const solicitud = { id: 2, codigo: 'SOL-PRUEBA', paciente, prioridad: 'RUTINA' };
const examen = { id: 4, codigo: 'URO', nombre: 'Urocultivo' };
const evento = {
  id: 1n, accion: 'RECEPTAR', estadoAnterior: 'REGISTRADA', estadoNuevo: 'RECEPTADA',
  detalle: null, fechaEvento: new Date('2026-01-01'), usuario: { id: 7, nombreCompleto: 'Prueba' },
};
let estadoMuestra;
let resultado;
let noExiste;

function detalle(args) {
  consultas.push(args);
  const seleccion = args.include.examenes;
  const incluyeResultado = Boolean(seleccion.include?.resultado);
  return {
    id: 3, codigoBarras: 'M261014-ABC234', solicitudId: 2, tipoMuestra: 'Orina',
    estado: estadoMuestra, solicitud, recepcionadoPor: { id: 7, nombreCompleto: 'Prueba' },
    examenes: [{ id: 5, muestraId: 3, examenId: 4, examen,
      ...(incluyeResultado ? { resultado } : {}),
    }],
  };
}

const prisma = {
  muestra: {
    findUnique: async (args) => {
      if (noExiste) return null;
      if (args.include) return detalle(args);
      if (args.where.codigoBarras) return null; // Código libre para el registro.
      return { id: 3, estado: estadoMuestra, fechaRecepcion: null };
    },
    findUniqueOrThrow: async (args) => detalle(args),
    findMany: async (args) => [detalle(args)],
    count: async () => 1,
    create: async (args) => { estadoMuestra = 'REGISTRADA'; return detalle(args); },
    updateMany: async (args) => { estadoMuestra = args.data.estado; return { count: 1 }; },
  },
  solicitud: { findUnique: async () => ({ id: 2 }) },
  examen: { findMany: async () => [{ id: 4 }] },
  logAuditoria: { create: async () => ({}), findMany: async () => [evento] },
  $transaction: async (accion) => typeof accion === 'function' ? accion(prisma) : Promise.all(accion),
};

sustituirModulo('../src/config/prisma.ts', { prisma });
const secretoFicticio = 'clave-exclusivamente-ficticia-para-pruebas-aisladas';
sustituirModulo('../src/config/env.ts', { env: { JWT_SECRET: secretoFicticio } });
const jwt = require('jsonwebtoken');
const muestras = require('../src/routes/muestra.routes.ts').default;
const resultados = require('../src/routes/resultado.routes.ts').default;

// Ejecutar el router real (autenticación, permisos, controlador y servicio)
// en memoria, sin iniciar un servidor ni abrir sockets.
function peticion(router, method, url, rol, body = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method, url, originalUrl: url, query: {}, body, ip: '127.0.0.1',
      headers: rol ? { authorization: `Bearer ${jwt.sign({
        sub: '7', username: 'prueba', nombre: 'Usuario Prueba', rol,
      }, secretoFicticio, { algorithm: 'HS256', expiresIn: 60 })}` } : {},
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, body: JSON.parse(JSON.stringify(data)) }); },
    };
    router.handle(req, res, (error) => {
      if (!error) return reject(new Error(`Ruta no atendida: ${method} ${url}`));
      if (!error.statusCode) return reject(error);
      resolve({ status: error.statusCode, body: { error: { code: error.code } } });
    });
  });
}

beforeEach(() => {
  consultas.length = 0;
  estadoMuestra = 'RECEPTADA';
  noExiste = false;
  resultado = {
    id: 8, hallazgoGram: 'Gram ficticio', colonias: 'Colonias ficticias',
    bacteriaAislada: 'Bacteria ficticia', observaciones: 'Observación ficticia',
    estado: 'PENDIENTE_VALIDACION', usuarioIdRegistra: 9,
    antibiograma: [{ antibiotico: 'Antibiótico ficticio', sensibilidad: 'R', haloMm: '12.0' }],
  };
});

function verificarDetalle(respuesta, rol) {
  assert.ok([200, 201].includes(respuesta.status));
  const muestra = respuesta.body.data;
  assert.deepEqual(muestra.solicitud, solicitud);
  assert.equal(muestra.tipoMuestra, 'Orina');
  assert.equal(muestra.estado, estadoMuestra);
  assert.equal(muestra.recepcionadoPor.id, 7);
  assert.deepEqual(muestra.examenes[0].examen, examen);
  const consulta = consultas.at(-1);
  if (rol === 'RECEPCIONISTA') {
    assert.equal(Object.hasOwn(muestra.examenes[0], 'resultado'), false);
    assert.equal(Object.hasOwn(consulta.include.examenes.include, 'resultado'), false);
    assert.equal(JSON.stringify(muestra).includes('antibiograma'), false);
    assert.equal(JSON.stringify(muestra).includes('Bacteria ficticia'), false);
  } else {
    assert.equal(Object.hasOwn(muestra.examenes[0], 'resultado'), true);
    assert.deepEqual(muestra.examenes[0].resultado, resultado);
    assert.deepEqual(consulta.include.examenes.include.resultado.include.antibiograma,
      { orderBy: { antibiotico: 'asc' } });
  }
}

const roles = ['RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR', 'ADMINISTRADOR'];
for (const rol of roles) {
  for (const url of ['/3', '/codigo/M261014-ABC234']) {
    for (const estado of ['PENDIENTE_VALIDACION', 'VALIDADO', null]) {
      test(`${rol}: GET ${url}, resultado ${estado}`, { timeout: 2000 }, async () => {
        resultado = estado === null ? null : { ...resultado, estado };
        verificarDetalle(await peticion(muestras, 'GET', url, rol), rol);
      });
    }
  }

  test(`${rol}: conserva listado operativo y trazabilidad`, { timeout: 2000 }, async () => {
    const lista = await peticion(muestras, 'GET', '/', rol);
    assert.equal(lista.status, 200);
    assert.equal(Object.hasOwn(lista.body.data[0].examenes[0], 'resultado'), false);
    const traza = await peticion(muestras, 'GET', '/3/trazabilidad', rol);
    assert.equal(traza.status, 200);
    assert.equal(traza.body.data[0].accion, 'RECEPTAR');
    assert.equal(traza.body.data[0].usuario.id, 7);
  });
}

const operaciones = [
  { method: 'POST', url: '/', permitidos: ['RECEPCIONISTA', 'ADMINISTRADOR'],
    body: { solicitudId: 2, tipoMuestra: 'Orina', fechaToma: '2026-01-01', examenIds: [4] } },
  { method: 'PATCH', url: '/3/receptar', inicial: 'REGISTRADA', permitidos: ['RECEPCIONISTA', 'ADMINISTRADOR'] },
  { method: 'PATCH', url: '/3/procesar', inicial: 'RECEPTADA', permitidos: ['BACTERIOLOGO'] },
  { method: 'PATCH', url: '/3/rechazar', inicial: 'RECEPTADA',
    permitidos: ['RECEPCIONISTA', 'BACTERIOLOGO', 'ADMINISTRADOR'], body: { motivoRechazo: 'Motivo ficticio' } },
];
for (const rol of roles) {
  for (const operacion of operaciones) {
    test(`${rol}: ${operacion.method} ${operacion.url}`, { timeout: 2000 }, async () => {
      estadoMuestra = operacion.inicial ?? 'REGISTRADA';
      const respuesta = await peticion(muestras, operacion.method, operacion.url, rol, operacion.body);
      if (operacion.permitidos.includes(rol)) verificarDetalle(respuesta, rol);
      else {
        assert.equal(respuesta.status, 403);
        assert.equal(consultas.length, 0);
      }
    });
  }
}

for (const url of ['/', '/3', '/codigo/M261014-ABC234', '/3/trazabilidad']) {
  test(`GET ${url}: sin sesión devuelve 401`, { timeout: 2000 }, async () => {
    assert.equal((await peticion(muestras, 'GET', url)).status, 401);
    assert.equal(consultas.length, 0);
  });
}
for (const url of ['/', '/8', '/worklist']) {
  test(`Recepción: sigue sin acceso directo a resultados ${url}`, { timeout: 2000 }, async () => {
    assert.equal((await peticion(resultados, 'GET', url, 'RECEPCIONISTA')).status, 403);
  });
}
for (const url of ['/3', '/codigo/M261014-ABC234']) {
  test(`Muestra inexistente ${url}: conserva 404`, { timeout: 2000 }, async () => {
    noExiste = true;
    assert.equal((await peticion(muestras, 'GET', url, 'RECEPCIONISTA')).status, 404);
  });
}
