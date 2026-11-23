const assert = require('node:assert/strict');
const { beforeEach, test } = require('node:test');
const Module = require('node:module');
require('./solo-mocks.cjs');
function sustituir(ruta, exports) {
  const id = require.resolve(ruta); const modulo = new Module(id);
  Object.assign(modulo, { exports, loaded: true }); require.cache[id] = modulo;
}
// Base ficticia en memoria: nunca se instancia PrismaClient ni se carga dotenv.
let cuentas, logs, cambios, consultas, fallo;
const seleccionar = (u, select) => u && Object.fromEntries(Object.entries(select).map(([key, v]) =>
  [key, v === true ? u[key] : seleccionar(u[key], v.select)]));
const coincide = (u, where = {}) => Object.entries(where).every(([k,v]) =>
  k === 'OR' ? v.some(cond => coincide(u,cond)) : k === 'rol' ? coincide(u.rol,v)
  : typeof v === 'object' && v !== null ? ('not' in v ? u[k] !== v.not : 'contains' in v ? String(u[k]).includes(v.contains) : false)
  : u[k] === v);
const prisma = {
  $queryRaw: async (sql) => sql.join('').includes('information_schema') ? [{clausula: "nombre in ('ADMINISTRADOR','RECEPCIONISTA','BACTERIOLOGO','VALIDADOR','AUXILIAR')",aplicado:'YES'}] : [],
  usuario: {
    findUnique: async ({ where, select }) => {
      consultas.push({ where, select });
      if (fallo === 'consulta') throw new Error('mysql://usuario:secreto@servidor/privado');
      const u = [...cuentas.values()].find((u) => Object.entries(where).every(([k, v]) => u[k] === v));
      return select ? seleccionar(u, select) : u ?? null;
    },
    count: async ({ where } = {}) => [...cuentas.values()].filter(u => coincide(u,where)).length,
    findMany: async (args) => {
      consultas.push(args);
      return [...cuentas.values()].filter(u => coincide(u,args.where)).slice(args.skip, args.skip + args.take).map((u) => seleccionar(u, args.select));
    },
    updateMany: async ({ where, data }) => {
      if (fallo === 'escritura') throw new Error('mysql://usuario:secreto@servidor/privado');
      cambios.push({ where, data });
      const u = cuentas.get(where.id);
      if (fallo === 'conflicto' || !u || u.activo !== where.activo || ('rolId' in where && u.rolId !== where.rolId) || u.eliminadoAt !== where.eliminadoAt || u.versionSesion !== where.versionSesion) return { count: 0 };
      Object.assign(u, { ...data, versionSesion: u.versionSesion + (data.versionSesion?.increment ?? 0) }); return { count: 1 };
    },
    update: async () => ({}),
    create: async ({ data }) => {
      const u = { ...data, eliminadoAt: null, versionSesion: 0, id: 100, createdAt: new Date(), rol: { nombre: 'RECEPCIONISTA' } };
      cuentas.set(u.id, u); return { id: u.id };
    },
  },
  rol: { findUnique: async ({where}) => ({ id: where.nombre === 'AUXILIAR' ? 5 : 2, nombre: where.nombre }) },
  logAuditoria: { create: async ({ data }) => {
    if (fallo === 'auditoria') throw new Error('Detalle confidencial de auditoría');
    logs.push(data); return {};
  } },
  $transaction: async (fn) => {
    const respaldo = structuredClone(cuentas), logsPrevios = [...logs];
    try { return await fn(prisma); } catch (err) { cuentas = respaldo; logs = logsPrevios; throw err; }
  },
};
const secreto = 'secreto-ficticio-solo-pruebas-usuarios-aisladas';
sustituir('../src/config/prisma.ts', { prisma });
const env = { JWT_SECRET: secreto, JWT_EXPIRES_IN_SECONDS: 60, BCRYPT_ROUNDS: 4, NODE_ENV: 'development', PERMISOS_OPERATIVOS_HABILITADOS: false };
sustituir('../src/config/env.ts', { env });
const jwt = require('jsonwebtoken');
const usuarios = require('../src/routes/usuario.routes.ts').default;
const auth = require('../src/routes/auth.routes.ts').default;
const { errorHandler } = require('../src/middlewares/errorHandler.ts');
const token = (rol = 'ADMINISTRADOR', id = 7) => jwt.sign({ sub: String(id), username: 'prueba', nombre: 'Usuario Prueba', rol, ...(env.PERMISOS_OPERATIVOS_HABILITADOS ? {politica:'operativa-v1'} : {}) }, secreto, { expiresIn: 60, algorithm: 'HS256' });
function peticion(router, method, url, sesion, body = {}, query = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, url, originalUrl: url, body, query, ip: '127.0.0.1', headers: sesion ? { authorization: `Bearer ${sesion}` } : {} };
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); } };
    router.handle(req, res, (err) => err ? errorHandler(err, req, res, reject) : reject(new Error('Ruta no atendida')));
  });
}
const activar = (id = 42, sesion = token(), body = {}) => peticion(usuarios, 'PATCH', `/${id}/activar`, sesion, body);
const listar = (sesion = token(), query = {}) => peticion(usuarios, 'GET', '/', sesion, {}, query);
beforeEach(() => {
  env.PERMISOS_OPERATIVOS_HABILITADOS = false;
  const usuario = (id, rolId, nombre, activo) => ({ id, rolId, rol: { nombre }, activo, username: `user${id}`,
    eliminadoAt: null, versionSesion: 0, email: `user${id}@example.test`, nombreCompleto: `Usuario ${id}`, passwordHash: 'hash-confidencial', createdAt: new Date('2026-11-18') });
  cuentas = new Map([usuario(7, 1, 'ADMINISTRADOR', true), usuario(8, 1, 'ADMINISTRADOR', false),
    usuario(42, 2, 'RECEPCIONISTA', false), usuario(43, 3, 'BACTERIOLOGO', true)].map((u) => [u.id, u]));
  logs = []; cambios = []; consultas = []; fallo = null;
});
for (const operacion of ['GET', 'PATCH']) {
  for (const rol of [null, 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR']) test(`${operacion}: rechaza ${rol ?? 'sin sesión'} sin modificar usuarios`, async () => {
    if (rol) cuentas.get(7).rol.nombre = rol;
    const sesion = rol ? token(rol) : undefined;
    const r = await peticion(usuarios, operacion, operacion === 'GET' ? '/' : '/42/activar', sesion);
    assert.equal(r.status, rol ? 403 : 401); assert.equal(cambios.length, 0);
  });
}
for (const operacion of ['listar', 'activar']) {
  test(`${operacion}: rechaza un administrador desactivado con JWT vigente`, async () => {
    cuentas.get(7).activo = false;
    const r = operacion === 'listar' ? await listar() : await activar();
    assert.equal(r.status, 401); assert.equal(cambios.length, 0);
  });
  test(`${operacion}: rechaza un JWT administrativo cuyo rol fue revocado`, async () => {
    cuentas.get(7).rol.nombre = 'RECEPCIONISTA'; cuentas.get(7).rolId = 2;
    const r = operacion === 'listar' ? await listar() : await activar();
    assert.equal(r.status, 401); assert.equal(cambios.length, 0);
  });
}
for (const id of ['abc', '0', '-1', '1.5', '4294967296', 'Infinity']) test(`rechaza identificador ${id}`, async () => {
  assert.equal((await activar(id)).status, 400); assert.equal(cambios.length, 0);
});
for (const body of [{ rol: 'ADMINISTRADOR' }, { rolId: 1 }, { permisos: ['todo'] }, { activo: false }, { email: 'otro@example.test' }])
  test(`rechaza datos ajenos a la activación: ${Object.keys(body)[0]}`, async () => {
    assert.equal((await activar(42, token(), body)).status, 400); assert.equal(cambios.length, 0);
  });
test('lista usuarios paginados sin hash ni campos internos', async () => {
  const r = await listar(); assert.equal(r.status, 200); assert.equal(r.body.total, 4);
  assert.equal(r.body.data[0].rol, 'ADMINISTRADOR');
  for (const u of r.body.data) { assert.equal(u.passwordHash, undefined); assert.equal(u.rolId, undefined); }
  const consulta = consultas.at(-1); assert.equal(consulta.take, 25); assert.equal(consulta.skip, 0);
  assert.equal(consulta.select.passwordHash, undefined);
});
test('aplica filtros y limita el tamaño de página', async () => {
  assert.equal((await listar(token(), { q: 'persona', estado: 'inactivos', page: '2', pageSize: '10' })).status, 200);
  const consulta = consultas.at(-1); assert.equal(consulta.where.activo, false);
  assert.equal(consulta.where.OR[0].nombreCompleto.contains, 'persona'); assert.equal(consulta.skip, 10); assert.equal(consulta.take, 10);
  assert.equal((await listar(token(), { pageSize: '101' })).status, 400);
});
test('activa solo el estado y registra la auditoría con el actor', async () => {
  const anterior = structuredClone(cuentas.get(42));
  const r = await activar(); assert.equal(r.status, 200); assert.deepEqual(r.body.data, { id: 42, activo: true, eliminadoAt: null });
  assert.deepEqual(cuentas.get(42), { ...anterior, activo: true, versionSesion: 1 });
  assert.deepEqual(cambios[0], { where: { id: 42, activo: false, rolId: 2, eliminadoAt: null, versionSesion: 0 }, data: { activo: true, eliminadoAt: null, versionSesion: { increment: 1 } } });
  assert.equal(logs.length, 1); assert.equal(logs[0].usuarioId, 7); assert.equal(logs[0].entidadId, 42); assert.equal(logs[0].accion, 'ACTIVAR');
});
test('rechaza autoactivación', async () => { assert.equal((await activar(7)).status, 403); assert.equal(cambios.length, 0); });
test('no permite activar administradores inactivos', async () => { assert.equal((await activar(8)).status, 403); assert.equal(cambios.length, 0); });
test('usuario inexistente devuelve 404', async () => { assert.equal((await activar(999)).status, 404); assert.equal(cambios.length, 0); });
test('activación repetida devuelve 409 sin duplicar cambios o auditoría', async () => {
  assert.equal((await activar()).status, 200); assert.equal((await activar()).status, 409);
  assert.equal(cambios.length, 1); assert.equal(logs.length, 1);
});
test('cambio concurrente devuelve 409 sin registrar una activación', async () => {
  fallo = 'conflicto'; assert.equal((await activar()).status, 409); assert.equal(logs.length, 0); assert.equal(cuentas.get(42).activo, false);
});
for (const tipo of ['consulta', 'escritura', 'auditoria']) test(`error de ${tipo}: respuesta saneada y sin activación parcial`, async () => {
  fallo = tipo; const r = await activar(); assert.equal(r.status, 503);
  assert.equal(JSON.stringify(r).includes('confidencial'), false); assert.equal(JSON.stringify(r).includes('mysql://'), false);
  assert.equal(r.body.error.details, undefined); assert.equal(cuentas.get(42).activo, false); assert.equal(logs.length, 0);
});
test('registro público → login bloqueado → activación administrativa → login permitido', async () => {
  const input = { nombreCompleto: 'Persona Nueva', email: 'nueva@example.test', password: 'ClaveSegura!123', confirmacion: 'ClaveSegura!123' };
  assert.equal((await peticion(auth, 'POST', '/register', undefined, input)).status, 202);
  assert.equal(cuentas.get(100).activo, false); assert.equal(cuentas.get(100).rolId, 2);
  const login = () => peticion(auth, 'POST', '/login', undefined, { username: input.email, password: input.password });
  assert.equal((await login()).status, 401);
  assert.equal((await activar(100)).status, 200);
  const sesion = await login(); assert.equal(sesion.status, 200);
  assert.equal(sesion.body.data.usuario.rol, 'RECEPCIONISTA'); assert.ok(sesion.body.data.token);
});

const desactivar = (id=43,sesion=token(),body={}) => peticion(usuarios,'PATCH',`/${id}/desactivar`,sesion,body);
const eliminar = (id=43,sesion=token(),body={}) => peticion(usuarios,'DELETE',`/${id}`,sesion,body);
test('desactivar revoca JWT y la reactivación no recupera un token anterior',async()=>{
  const t=token('BACTERIOLOGO',43);
  assert.equal((await peticion(auth,'GET','/me',t)).status,200);
  assert.equal((await desactivar()).status,200); assert.equal(cuentas.get(43).versionSesion,1);
  assert.equal((await peticion(auth,'GET','/me',t)).status,401);
  assert.equal((await activar(43)).status,200);
  assert.equal((await peticion(auth,'GET','/me',t)).status,401);
  assert.equal(logs.filter(l=>['ACTIVAR','DESACTIVAR'].includes(l.accion)).length,2);
});
test('eliminación lógica conserva hash, rol, identidad y auditoría; oculta del listado normal',async()=>{
  const anterior=structuredClone(cuentas.get(43)),t=token('BACTERIOLOGO',43);
  assert.equal((await eliminar()).status,200);
  const u=cuentas.get(43);assert.ok(u.eliminadoAt instanceof Date);assert.equal(u.activo,false);
  for(const k of ['passwordHash','rolId','nombreCompleto','username'])assert.equal(u[k],anterior[k]);
  assert.equal((await peticion(auth,'GET','/me',t)).status,401);
  assert.equal((await activar(43)).status,409);
  assert.equal((await listar()).body.data.some(u=>u.id===43),false);
  assert.deepEqual((await listar(token(),{estado:'eliminados'})).body.data.map(u=>u.id),[43]);
  assert.equal(logs.at(-1).accion,'ELIMINAR');assert.equal(logs.at(-1).estadoNuevo,'ELIMINADO');
});
for(const op of [desactivar,eliminar]){
  test(op.name+': protege la propia cuenta administrativa',async()=>{
    assert.equal((await op(7)).status,403);assert.equal(cuentas.get(7).activo,true);assert.equal(logs.length,0);
  });
  test(op.name+': rollback si falla auditoría',async()=>{
    fallo='auditoria';assert.equal((await op()).status,503);assert.equal(cuentas.get(43).activo,true);
    assert.equal(cuentas.get(43).eliminadoAt,null);assert.equal(cuentas.get(43).versionSesion,0);
  });
  test(op.name+': conflicto de escritura controlado sin auditoría',async()=>{
    fallo='conflicto';assert.equal((await op()).status,409);assert.equal(logs.length,0);
  });
  for(const rol of ['AUXILIAR','BACTERIOLOGO'])test(op.name+': deniega administración a '+rol,async()=>{
    env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuentas.get(7).rol.nombre=rol;
    assert.equal((await op(43,token(rol))).status,403);assert.equal(cambios.length,0);
  });
}
test('con política operativa, roles antiguos requieren asignación explícita y cuentas inactivas',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  assert.equal((await activar()).status,409);
  const asignar=(body)=>peticion(usuarios,'PATCH','/42/perfil',token(),body);
  for(const rol of ['ADMINISTRADOR','RECEPCIONISTA','VALIDADOR']) assert.equal((await asignar({rol})).status,400);
  assert.equal((await asignar({rol:'AUXILIAR',activo:true})).status,400);
  assert.equal((await asignar({rol:'AUXILIAR'})).status,200);assert.equal(cuentas.get(42).activo,false);
  assert.equal(cuentas.get(42).rolId,5);assert.equal(logs.at(-1).accion,'ASIGNAR_PERFIL');
  assert.equal((await peticion(usuarios,'PATCH','/43/perfil',token(),{rol:'AUXILIAR'})).status,409);
});
test('no se puede asignar perfil a una cuenta eliminada ni modificar el administrador',async()=>{
  assert.equal((await eliminar()).status,200);
  for(const id of [43,7,8])assert.ok([403,409].includes((await peticion(usuarios,'PATCH',`/${id}/perfil`,token(),{rol:'AUXILIAR'})).status));
});
for(const campo of ['rol','rolId','activo','eliminadoAt','versionSesion'])test('estado no acepta campos manipulados: '+campo,async()=>{
  for(const op of [desactivar,eliminar])assert.equal((await op(43,token(),{[campo]:true})).status,400);
  assert.equal(cambios.length,0);
});
test('desactivación repetida y eliminación repetida no duplican auditoría',async()=>{
  assert.equal((await desactivar()).status,200);assert.equal((await desactivar()).status,409);
  assert.equal((await eliminar()).status,200);assert.equal((await eliminar()).status,409);assert.equal(logs.length,2);
});
