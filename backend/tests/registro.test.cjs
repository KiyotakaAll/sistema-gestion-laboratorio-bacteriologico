const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const Module = require('node:module');
require('./solo-mocks.cjs');
// No se importa PrismaClient ni dotenv: las rutas y bcrypt sí son reales.
function sustituir(ruta, exports) {
  const id = require.resolve(ruta);
  const modulo = new Module(id);
  Object.assign(modulo, { exports, loaded: true });
  require.cache[id] = modulo;
}
const secreto = 'secreto-ficticio-solo-pruebas-en-memoria';
let cuentas, fallo, rolDisponible, escrituras;
const prisma = {
  $queryRaw: async () => [],
  usuario: {
    findUnique: async ({ where }) => {
      if (fallo === 'consulta') throw new Error('Detalle interno confidencial');
      return cuentas.find((u) => Object.entries(where).every(([k, v]) => u[k] === v)) ?? null;
    },
    create: async ({ data }) => {
      if (fallo === 'duplicado') throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
      if (fallo === 'crear') throw new Error('Detalle interno confidencial');
      const usuario = { ...data, id: 42, rol: { nombre: 'RECEPCIONISTA' } };
      cuentas.push(usuario); escrituras.push(data);
      return { id: usuario.id };
    },
    update: async () => ({}),
  },
  rol: { findUnique: async () => rolDisponible ? { id: 2 } : null },
  logAuditoria: { create: async () => ({}) },
  $transaction: async (fn) => fn(prisma),
};
sustituir('../src/config/prisma.ts', { prisma });
sustituir('../src/config/env.ts', { env: { JWT_SECRET: secreto, JWT_EXPIRES_IN_SECONDS: 60, BCRYPT_ROUNDS: 4, NODE_ENV: 'production' } });
const { Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = require('../src/routes/auth.routes.ts').default;
const { errorHandler } = require('../src/middlewares/errorHandler.ts');
const { registroSchema } = require('../src/validators/auth.validator.ts');
const { limitarRegistro } = require('../src/middlewares/limitarRegistro.ts');
const valido = { nombreCompleto: 'Persona Prueba', email: 'persona@example.test', password: 'ClaveSegura!123', confirmacion: 'ClaveSegura!123' };
let numeroIp = 0;
function peticion(url, body = {}, token, ip = `test-${++numeroIp}`, method = 'POST') {
  return new Promise((resolve, reject) => {
    const req = { method, url, originalUrl: url, query: {}, body, ip, headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = {
      statusCode: 200, setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, body: data }); },
    };
    router.handle(req, res, (error) => error ? errorHandler(error, req, res, reject) : reject(new Error('Ruta no encontrada')));
  });
}
beforeEach(() => { cuentas = []; escrituras = []; fallo = null; rolDisponible = true; });

for (const [nombre, cambio] of [
  ['nombre obligatorio', { nombreCompleto: '' }], ['correo inválido', { email: 'sin-correo' }],
  ['clave débil', { password: 'abc', confirmacion: 'abc' }], ['confirmación distinta', { confirmacion: 'otra' }],
  ['clave extremadamente común', { password: '12345678', confirmacion: '12345678' }],
  ['más de 72 bytes ASCII', { password: 'r'.repeat(73), confirmacion: 'r'.repeat(73) }],
  ['límite bcrypt en bytes', { password: 'Á'.repeat(40) + 'a1!', confirmacion: 'Á'.repeat(40) + 'a1!' }],
  ['rol administrativo', { rol: 'ADMINISTRADOR' }], ['permisos', { permisos: ['todo'] }],
  ['activación pública', { activo: true }], ['rolId público', { rolId: 1 }],
]) test(`registro rechaza ${nombre} sin escrituras`, async () => {
  const r = await peticion('/register', { ...valido, ...cambio });
  assert.equal(r.status, 400); assert.equal(escrituras.length, 0);
});

test('normaliza nombre y correo', () => {
  const input = registroSchema.parse({ ...valido, nombreCompleto: '  Persona Prueba  ', email: '  PERSONA@example.test  ' });
  assert.equal(input.email, valido.email); assert.equal(input.nombreCompleto, valido.nombreCompleto);
});
test('registro real crea hash bcrypt y cuenta inactiva con rol fijo, sin token', async () => {
  const r = await peticion('/register', valido);
  assert.equal(r.status, 202); assert.equal(r.body.data.token, undefined);
  assert.equal(escrituras.length, 1);
  const data = escrituras[0];
  assert.equal(data.activo, false); assert.equal(data.rolId, 2);
  assert.ok(data.username.length <= 40);
  assert.notEqual(data.passwordHash, valido.password);
  assert.equal(await bcrypt.compare(valido.password, data.passwordHash), true);
  assert.equal(data.confirmacion, undefined);
  const login = await peticion('/login', { username: valido.email, password: valido.password });
  assert.equal(login.status, 401); assert.equal(login.body.data, undefined);
  assert.equal((await peticion('/me', {}, undefined, undefined, 'GET')).status, 401);
});
for (const [caso, password] of [['ocho caracteres', 'calmaluz'], ['frase con Unicode y espacios', '  mi café mira al mar  ']]) {
  test(`registro histórico admite ${caso} sin conceder privilegios`, async () => {
    const r=await peticion('/register',{...valido,password,confirmacion:password});
    assert.equal(r.status,202);assert.equal(r.body.data.token,undefined);assert.equal(escrituras.length,1);
    assert.equal(escrituras[0].rolId,2);assert.equal(escrituras[0].activo,false);
    assert.equal(await bcrypt.compare(password,escrituras[0].passwordHash),true);
    assert.ok(!JSON.stringify(r).includes(password));assert.ok(!JSON.stringify(r).includes('passwordHash'));
  });
}
test('duplicado devuelve la misma respuesta y no cambia cuenta existente', async () => {
  const primera = await peticion('/register', valido);
  const original = { ...cuentas[0] };
  const duplicada = await peticion('/register', valido);
  assert.deepEqual(duplicada, primera); assert.equal(escrituras.length, 1);
  assert.deepEqual(cuentas[0], original);
});
test('duplicado concurrente no revela la restricción única', async () => {
  const primera = await peticion('/register', valido);
  cuentas = []; fallo = 'duplicado';
  assert.deepEqual(await peticion('/register', valido), primera);
});
test('error de creación devuelve 503 sin detalles internos', async () => {
  fallo = 'crear';
  const r = await peticion('/register', valido);
  assert.equal(r.status, 503); assert.ok(!JSON.stringify(r).includes('confidencial'));
});
test('error de consulta devuelve 503 sin detalles internos', async () => {
  fallo = 'consulta';
  const r = await peticion('/register', valido);
  assert.equal(r.status, 503); assert.ok(!JSON.stringify(r).includes('confidencial'));
});
test('rol ausente impide registro sin inventar roles', async () => {
  rolDisponible = false;
  assert.equal((await peticion('/register', valido)).status, 503);
  assert.equal(escrituras.length, 0);
});
test('usuarios actuales conservan login por username y el perfil incluye correo', async () => {
  cuentas.push({ id: 7, username: 'actual', email: valido.email, nombreCompleto: 'Actual', activo: true, rol: { nombre: 'ADMINISTRADOR' }, passwordHash: await bcrypt.hash(valido.password, 4) });
  for (const username of ['actual', valido.email]) {
    const r = await peticion('/login', { username, password: valido.password });
    assert.equal(r.status, 200); assert.equal(r.body.data.usuario.rol, 'ADMINISTRADOR');
    const perfil = await peticion('/me', {}, r.body.data.token, undefined, 'GET');
    assert.equal(perfil.body.data.email, valido.email);
    assert.equal(jwt.verify(r.body.data.token, secreto).rol, 'ADMINISTRADOR');
  }
});
for (const [caso, password] of [['corta histórica', 'lab'], ['común histórica', '12345678'],
  ['frase y Unicode', '  mi café mira al mar  '], ['larga histórica', 'á'.repeat(40)]]) {
  test(`hash existente: login conserva ${caso} sin rehash`, async () => {
    const hashAnterior = await bcrypt.hash(password, 4);
    const cuenta = { id: 7, username: 'cuenta.anterior', email: 'anterior@example.test',
      nombreCompleto: 'Cuenta Anterior', activo: true, rol: { nombre: 'ADMINISTRADOR' }, passwordHash: hashAnterior };
    cuentas.push(cuenta);
    const hashOriginal = bcrypt.hash;
    bcrypt.hash = async () => { throw new Error('El login no debe rehashear'); };
    try {
      assert.equal((await peticion('/login', { username: cuenta.username, password })).status, 200);
      assert.equal((await peticion('/login', { username: cuenta.username, password: 'clave equivocada' })).status, 401);
      assert.equal(cuenta.passwordHash, hashAnterior);assert.equal(escrituras.length, 0);
    } finally { bcrypt.hash = hashOriginal; }
  });
}
test('limita intentos de registro antes de calcular hashes', () => {
  let ultimo, espera;
  for (let i = 0; i < 6; i++) limitarRegistro({ ip: 'limite-aislado' }, { setHeader: (_, v) => { espera = v; } }, (err) => { ultimo = err; });
  assert.equal(ultimo.statusCode, 429); assert.ok(Number(espera) > 0);
});
