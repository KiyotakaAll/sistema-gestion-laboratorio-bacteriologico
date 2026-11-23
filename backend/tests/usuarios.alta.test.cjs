const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
require('./solo-mocks.cjs');
function sustituir(ruta, exports) {
  const id = require.resolve(ruta), modulo = new Module(id);
  Object.assign(modulo, { exports, loaded: true }); require.cache[id] = modulo;
}
const env = { NODE_ENV: 'development', JWT_SECRET: 'clave-ficticia-alta-administrativa-offline',
  JWT_EXPIRES_IN_SECONDS: 60, BCRYPT_ROUNDS: 4, PERMISOS_OPERATIVOS_HABILITADOS: false };
let cuentas, roles, logs, consultas, escrituras, checks, fallo, revocarEnHash, hashes;
const input = { nombreCompleto: 'Persona Nueva', username: 'persona.nueva', email: 'persona@example.test',
  password: 'ClaveSegura!123', confirmacion: 'ClaveSegura!123', rol: 'BACTERIOLOGO' };
const clausulaNueva = "(`nombre` in (_utf8mb4'ADMINISTRADOR',_utf8mb4'RECEPCIONISTA',_utf8mb4'BACTERIOLOGO',_utf8mb4'VALIDADOR',_utf8mb4'AUXILIAR'))";
const proyectar = (obj, select) => obj && (select ? Object.fromEntries(Object.entries(select).map(([k, valor]) =>
  [k, valor === true ? obj[k] : proyectar(obj[k], valor.select)])) : obj);
const igual = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const conRol = u => u && { ...u, rol: roles.get(u.rolId) };
const prisma = {
  $queryRaw: async (partes, ...valores) => {
    const sql = partes.join('?'); consultas.push(['sql', sql, valores]);
    if (sql.includes('information_schema')) {
      if (fallo === 'metadata') throw new Error('mysql://privado:secreto@servidor/base');
      return checks;
    }
    if (sql.includes('FROM roles') && fallo === 'catalogo cambia') roles.delete(3);
    return [{ id: valores[0] }];
  },
  usuario: {
    findUnique: async ({ where, select }) => {
      consultas.push(['usuario', where, select]);
      if (fallo === 'cuenta') throw new Error('mysql://privado:secreto@servidor/base');
      const u = [...cuentas.values()].find(u => Object.entries(where).every(([k, v]) => igual(u[k], v)));
      return proyectar(conRol(u), select) ?? null;
    },
    findFirst: async ({ where, select }) => {
      consultas.push(['duplicado', where]);
      const u = [...cuentas.values()].find(u => where.OR.some(cond => Object.entries(cond).every(([k, v]) => igual(u[k], v))));
      return proyectar(conRol(u), select) ?? null;
    },
    create: async ({ data, select }) => {
      if (fallo === 'duplicado') throw new Prisma.PrismaClientKnownRequestError('detalle confidencial', { code: 'P2002', clientVersion: 'offline', meta: { target: 'interno' } });
      if (fallo === 'crear') throw new Error('mysql://privado:secreto@servidor/base');
      const u = { ...data, id: 42, createdAt: new Date() }; cuentas.set(u.id, u); escrituras.push(data);
      return proyectar(conRol(u), select);
    },
    count: async () => cuentas.size,
    findMany: async ({ select }) => [...cuentas.values()].map(u => proyectar(conRol(u), select)),
    update: async ({ where, data }) => Object.assign(cuentas.get(where.id), data),
    updateMany: async ({ where, data }) => {
      const u = cuentas.get(where.id);
      if (!u || u.activo !== where.activo || u.rolId !== where.rolId) return { count: 0 };
      Object.assign(u, data); return { count: 1 };
    },
  },
  rol: { findUnique: async ({ where, select }) => {
    consultas.push(['rol', where.nombre]);
    return proyectar([...roles.values()].find(r => r.nombre === where.nombre), select) ?? null;
  } },
  logAuditoria: { create: async ({ data }) => {
    if (fallo === 'auditoria') throw new Error('passwordHash: detalle privado');
    logs.push(data); return {};
  } },
  $transaction: async (operacion, opciones) => {
    consultas.push(['transaccion', opciones]); const antes = structuredClone(cuentas), auditoria = structuredClone(logs);
    try { return await operacion(prisma); } catch (err) { cuentas = antes; logs = auditoria; throw err; }
  },
};
sustituir('../src/config/env.ts', { env }); sustituir('../src/config/prisma.ts', { prisma });
const { Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const hashReal = bcrypt.hash;
bcrypt.hash = async (...args) => {
  hashes++; const hash = await hashReal(...args);
  if (revocarEnHash === 'activo') cuentas.get(7).activo = false;
  if (revocarEnHash === 'rol') cuentas.get(7).rolId = 3;
  return hash;
};
const jwt = require('jsonwebtoken');
const usuarios = require('../src/routes/usuario.routes.ts').default;
const auth = require('../src/routes/auth.routes.ts').default;
const { crearUsuario } = require('../src/services/usuario.service.ts');
const { crearUsuarioSchema } = require('../src/validators/usuario.validator.ts');
const { errorHandler } = require('../src/middlewares/errorHandler.ts');
function token(rol = 'ADMINISTRADOR') {
  return jwt.sign({ sub: '7', username: 'admin', nombre: 'Administración', rol,
    ...(env.PERMISOS_OPERATIVOS_HABILITADOS ? { politica: 'operativa-v1' } : {}) }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 60 });
}
let ip = 0;
function request(router, method, url, body = {}, sesion = token()) {
  return new Promise((resolve, reject) => {
    const req = { method, url, originalUrl: url, body, query: {}, ip: `alta-aislada-${++ip}`, headers: sesion ? { authorization: 'Bearer ' + sesion } : {} };
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { resolve({ status: this.statusCode, body }); } };
    router.handle(req, res, err => err ? errorHandler(err, req, res, reject) : reject(new Error('Ruta no atendida')));
  });
}
const alta = (body = input, sesion = token()) => request(usuarios, 'POST', '/', body, sesion);
const capacidades = (sesion = token()) => request(usuarios, 'GET', '/capacidades', {}, sesion);
function prepararAuxiliar() {
  env.PERMISOS_OPERATIVOS_HABILITADOS = true; roles.set(5, { id: 5, nombre: 'AUXILIAR' });
  checks = [{ clausula: clausulaNueva, aplicado: 'YES' }];
}
beforeEach(() => {
  env.PERMISOS_OPERATIVOS_HABILITADOS = false;
  roles = new Map(['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR'].map((nombre, i) => [i + 1, { id: i + 1, nombre }]));
  cuentas = new Map([[7, { id: 7, rolId: 1, activo: true, nombreCompleto: 'Administración', username: 'admin', email: 'admin@example.test', passwordHash: 'hash-anterior-ficticio', createdAt: new Date() }]]);
  logs = []; consultas = []; escrituras = []; checks = []; fallo = null; revocarEnHash = null; hashes = 0;
});
for (const activa of [false, true]) {
  for (const rol of [null, 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR', 'AUXILIAR']) test(`alta y capacidades rechazan ${rol ?? 'sin sesión'}, política nueva=${activa}`, async () => {
    env.PERMISOS_OPERATIVOS_HABILITADOS = activa;
    const sesion = rol ? token(rol) : null;
    for (const r of [await alta(input, sesion), await capacidades(sesion)]) assert.ok([401, 403].includes(r.status));
    assert.equal(escrituras.length, 0); assert.equal(hashes, 0);
  });
  for (const cambio of ['inactiva', 'eliminada', 'revocada']) test(`JWT administrativo no conserva alta con cuenta ${cambio}, política nueva=${activa}`, async () => {
    env.PERMISOS_OPERATIVOS_HABILITADOS = activa; const sesion = token();
    if (cambio === 'inactiva') cuentas.get(7).activo = false;
    if (cambio === 'eliminada') cuentas.delete(7);
    if (cambio === 'revocada') cuentas.get(7).rolId = 3;
    for (const r of [await alta(input, sesion), await capacidades(sesion)]) assert.ok([401, 403].includes(r.status));
    assert.equal(escrituras.length, 0); assert.equal(hashes, 0);
  });
  for (const rol of ['ADMINISTRADOR', 'RECEPCIONISTA', 'VALIDADOR']) test(`no permite crear ${rol}, política nueva=${activa}`, async () => {
    env.PERMISOS_OPERATIVOS_HABILITADOS = activa;
    assert.equal((await alta({ ...input, rol })).status, 400); assert.equal(escrituras.length, 0); assert.equal(hashes, 0);
  });
}
for (const extra of [{ rolId: 1 }, { permisos: ['usuarios.administrar'] }, { activo: true }, { passwordHash: 'hash-enviado' }, { roles: ['ADMINISTRADOR'] }, { rol: { nombre: 'ADMINISTRADOR' } }]) test(`rechaza asignación adicional ${Object.keys(extra)[0]}`, async () => {
  assert.equal((await alta({ ...input, ...extra })).status, 400); assert.equal(hashes, 0); assert.equal(escrituras.length, 0);
});
for (const [caso, datos] of [
  ['nombre ausente', { nombreCompleto: '' }], ['correo inválido', { email: 'sin correo' }],
  ['username con espacios', { username: 'persona nueva' }], ['username con @', { username: 'otra@example.test' }],
  ['username largo', { username: 'x'.repeat(41) }], ['username corto', { username: 'ab' }],
  ['password débil', { password: '123', confirmacion: '123' }], ['confirmación distinta', { confirmacion: 'otra' }],
  ['password ausente', { password: undefined }],
  ['límite bcrypt UTF-8', { password: 'Á'.repeat(40) + 'a1!', confirmacion: 'Á'.repeat(40) + 'a1!' }],
]) test(`validación: ${caso}`, async () => {
  assert.equal((await alta({ ...input, ...datos })).status, 400); assert.equal(escrituras.length, 0);
});
test('normaliza nombre, username y correo sin alterar contraseña', () => {
  const r = crearUsuarioSchema.parse({ ...input, nombreCompleto: '  Persona Nueva  ', username: ' PERSONA.NUEVA ', email: ' PERSONA@EXAMPLE.TEST ' });
  assert.equal(r.nombreCompleto, input.nombreCompleto); assert.equal(r.username, input.username); assert.equal(r.email, input.email); assert.equal(r.password, input.password);
});
for (const rol of ['BACTERIOLOGO', 'AUXILIAR']) test(`crea ${rol} inactivo, hash bcrypt real, selección segura y auditoría atómica`, async () => {
  if (rol === 'AUXILIAR') prepararAuxiliar();
  const anterior = structuredClone(cuentas.get(7)); const r = await alta({ ...input, rol });
  assert.equal(r.status, 201); assert.equal(r.body.data.activo, false); assert.equal(r.body.data.rol, rol);
  assert.equal(r.body.data.username, input.username); assert.equal(escrituras.length, 1);
  const nueva = cuentas.get(42); assert.equal(await bcrypt.compare(input.password, nueva.passwordHash), true);
  assert.notEqual(nueva.passwordHash, input.password); assert.equal(nueva.password, undefined); assert.equal(nueva.confirmacion, undefined);
  assert.deepEqual(cuentas.get(7), anterior);
  for (const sensible of [input.password, nueva.passwordHash, 'passwordHash', 'confirmacion', 'rolId', 'token']) {
    assert.ok(!JSON.stringify(r).includes(sensible)); assert.ok(!JSON.stringify(logs).includes(sensible));
  }
  assert.deepEqual([logs[0].usuarioId, logs[0].entidad, logs[0].entidadId, logs[0].accion, logs[0].estadoNuevo], [7, 'USUARIO', 42, 'CREAR', 'INACTIVO']);
  assert.deepEqual(logs[0].detalle, { rol });
  const sql = consultas.filter(c => c[0] === 'sql').map(c => c[1]);
  assert.ok(sql.some(s => s.includes('FROM usuarios') && s.includes('FOR SHARE')));
  assert.ok(sql.some(s => s.includes('FROM roles') && s.includes('FOR SHARE')));
});
test('capacidad histórica solo ofrece BACTERIOLOGO sin inspeccionar CHECK ni crear roles', async () => {
  roles.set(5, { id: 5, nombre: 'AUXILIAR' });
  assert.deepEqual((await capacidades()).body.data, { roles: ['BACTERIOLOGO'] });
  assert.ok(!consultas.some(c => c[0] === 'sql' && c[1].includes('information_schema')));
  assert.equal((await alta({ ...input, rol: 'AUXILIAR' })).status, 503); assert.equal(escrituras.length, 0);
});
test('capacidad nueva exige AUXILIAR en el catálogo y CHECK preparado', async () => {
  prepararAuxiliar(); assert.deepEqual((await capacidades()).body.data.roles, ['AUXILIAR', 'BACTERIOLOGO']);
  roles.delete(5); assert.deepEqual((await capacidades()).body.data.roles, ['BACTERIOLOGO']);
  assert.equal((await alta({ ...input, rol: 'AUXILIAR' })).status, 503);
});
for (const caso of ['ausente', 'historico', 'no aplicado', 'expresion desconocida', 'espacio dentro del literal']) test(`AUXILIAR bloqueado con CHECK ${caso}`, async () => {
  prepararAuxiliar();
  if (caso === 'ausente') checks = [];
  if (caso === 'historico') checks[0].clausula = "nombre in ('ADMINISTRADOR','RECEPCIONISTA','BACTERIOLOGO','VALIDADOR')";
  if (caso === 'no aplicado') checks[0].aplicado = 'NO';
  if (caso === 'expresion desconocida') checks[0].clausula += " AND nombre <> 'AUXILIAR'";
  if (caso === 'espacio dentro del literal') checks[0].clausula = "nombre in ('AUX ILIAR')";
  assert.deepEqual((await capacidades()).body.data.roles, ['BACTERIOLOGO']);
  assert.equal((await alta({ ...input, rol: 'AUXILIAR' })).status, 503); assert.equal(escrituras.length, 0);
});
test('BACTERIOLOGO ausente en catálogo falla sin inventar registros', async () => {
  roles.delete(3); assert.deepEqual((await capacidades()).body.data.roles, []);
  assert.equal((await alta()).status, 503); assert.equal(escrituras.length, 0);
});
for (const [campo, valor] of [['username', 'PERSONA.NUEVA'], ['email', 'PERSONA@EXAMPLE.TEST'], ['username', input.email]]) test(`duplicado por ${campo}=${valor} devuelve 409 y conserva la cuenta`, async () => {
  cuentas.set(9, { id: 9, rolId: 3, [campo]: valor, activo: true }); const antes = structuredClone(cuentas);
  assert.equal((await alta()).status, 409); assert.deepEqual(cuentas, antes); assert.equal(logs.length, 0);
});
test('duplicado concurrente P2002 se traduce a 409 sin detalles de Prisma', async () => {
  fallo = 'duplicado'; const r = await alta(); assert.equal(r.status, 409); assert.equal(r.body.error.code, 'USUARIO_DUPLICADO');
  assert.equal(r.body.error.details, undefined); assert.equal(cuentas.has(42), false); assert.equal(logs.length, 0);
});
for (const cambio of ['activo', 'rol']) test(`recomprueba ${cambio} después del hash y antes del INSERT`, async () => {
  revocarEnHash = cambio; const r = await alta(); assert.ok([401, 403].includes(r.status));
  assert.equal(hashes, 1); assert.equal(escrituras.length, 0); assert.equal(logs.length, 0);
});
for (const tipo of ['cuenta', 'crear', 'auditoria', 'metadata']) test(`error de ${tipo}: respuesta saneada y sin creación parcial`, async () => {
  if (tipo === 'metadata') prepararAuxiliar(); fallo = tipo;
  const r = await alta({ ...input, rol: tipo === 'metadata' ? 'AUXILIAR' : 'BACTERIOLOGO' });
  assert.equal(r.status, 503); assert.ok(!/mysql:|passwordHash|privado|secreto/.test(JSON.stringify(r)));
  assert.equal(r.body.error.details, undefined); assert.equal(cuentas.has(42), false); assert.equal(logs.length, 0);
});
test('el servicio también rechaza rol administrativo y campos extra sin pasar por HTTP', async () => {
  await assert.rejects(async () => crearUsuario({ ...input, rol: 'ADMINISTRADOR' }, { usuarioId: 7, ip: null }));
  await assert.rejects(async () => crearUsuario({ ...input, rolId: 1 }, { usuarioId: 7, ip: null }));
  assert.equal(escrituras.length, 0);
});
for (const operativa of [false, true]) test(`alta → login bloqueado → activación existente → login permitido, política nueva=${operativa}`, async () => {
  if (operativa) prepararAuxiliar();
  const rol = operativa ? 'AUXILIAR' : 'BACTERIOLOGO'; assert.equal((await alta({ ...input, rol })).status, 201);
  const login = () => request(auth, 'POST', '/login', { username: input.username, password: input.password }, null);
  assert.equal((await login()).status, 401);
  assert.equal((await request(usuarios, 'PATCH', '/42/activar')).status, 200);
  const sesion = await login(); assert.equal(sesion.status, 200); assert.equal(sesion.body.data.usuario.rol, rol);
});
test('registro público sigue bloqueado en modo nuevo incluso con JWT administrativo', async () => {
  prepararAuxiliar();
  const { rol, username, ...publico } = input;
  for (const sesion of [null, token()]) assert.equal((await request(auth, 'POST', '/register', publico, sesion)).status, 403);
  assert.equal(hashes, 0); assert.equal(escrituras.length, 0);
});
test('registro público histórico conserva recepción inactiva y no recibe privilegios administrativos', async () => {
  const { rol, username, ...publico } = input;
  assert.equal((await request(auth, 'POST', '/register', publico, null)).status, 202);
  assert.equal(cuentas.get(42).rolId, 2); assert.equal(cuentas.get(42).activo, false);
});
