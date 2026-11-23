const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
require('./solo-mocks.cjs');
function sustituir(ruta, exports) {
  const id = require.resolve(ruta), m = new Module(id);
  Object.assign(m, { exports, loaded: true }); require.cache[id] = m;
}
const env = { NODE_ENV: 'production', JWT_SECRET: 'clave-sintetica-exclusiva-politica-offline',
  JWT_EXPIRES_IN_SECONDS: 60, BCRYPT_ROUNDS: 4, PERMISOS_OPERATIVOS_HABILITADOS: false };
let cuenta, consultas, cambios, logs, autor, estado, cantidad, fallo, rolDisponible, registro, consultaMuestra;
const version = '2026-01-01T00:00:00.000Z';
const prisma = {
  $queryRaw: async () => [],
  usuario: {
    findUnique: async () => {
      consultas.push('usuario');
      if (fallo === 'cuenta') throw new Error('Error interno sintético');
      return cuenta;
    },
    findMany: async () => [], count: async () => 0,
    create: async ({ data }) => { registro = data; return { id: 42 }; },
    update: async ({ data }) => { cambios.push(data); return {}; },
  },
  rol: { findUnique: async ({where}) => { consultas.push(['rol',where.nombre]);return rolDisponible ? {id:where.nombre==='AUXILIAR'?5:2}:null; } },
  resultado: {
    findUnique: async () => ({ estado, updatedAt: new Date(version), observaciones: 'Sin crecimiento', antibiograma: [], usuarioIdRegistra: autor, muestraExamen: { muestraId: 3, muestra: { estado: 'PROCESADA' } } }),
    updateMany: async ({data}) => { cambios.push(data); return {count:cantidad}; },
    findUniqueOrThrow: async () => ({id:20,estado:'VALIDADO'}),
  },
  muestra: { findUnique: async args => { consultaMuestra = args; return {id:3}; } },
  logAuditoria: { create: async ({data}) => { logs.push(data);return {}; } },
  $transaction: async fn => {
    const respaldo=[...cambios], auditoria=[...logs];
    try { return await fn(prisma); } catch(e) { cambios=respaldo;logs=auditoria;throw e; }
  },
};
sustituir('../src/config/env.ts',{env});sustituir('../src/config/prisma.ts',{prisma});
// Pruebas de las rutas y middlewares reales; los handlers no clínicos son centinelas.
const centinela = (_req,res) => res.json({data:{autorizado:true}});
for (const [modulo,nombres] of Object.entries({
  paciente:['listar','capacidades','obtener','crear','actualizar','actualizarIdentificacion'],
  orden:['listar','obtener','crear','examenes','actualizarRemitente'],
  medico:['capacidades','listar','obtener','crear','actualizar','estado'],
  muestra:['listar','obtenerPorCodigoBarras','obtener','trazabilidad','registrar','receptar','procesar','rechazar'],
  usuario:['listar','activar','desactivar','eliminar','asignarPerfil','capacidades','crear'],
})) sustituir('../src/controllers/'+modulo+'.controller.ts',Object.fromEntries(nombres.map(n=>[n,centinela])));
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const politica = require('../src/domain/permisos.ts');
const { validarResultado } = require('../src/services/resultado.service.ts');
const { listarUsuarios } = require('../src/services/usuario.service.ts');
const { registrarCuenta } = require('../src/services/auth.service.ts');
const { rolRegistroPublico } = require('../src/services/permisos.service.ts');
const { obtenerMuestraPorId } = require('../src/services/muestra.service.ts');
const { asyncHandler } = require('../src/utils/http.ts');
sustituir('../src/controllers/resultado.controller.ts',{
  worklist:centinela,listar:centinela,obtener:centinela,registrar:centinela,actualizar:centinela,
  validar:asyncHandler(async(req,res)=>{ res.json({data:await validarResultado(Number(req.params.id),{usuarioId:req.user.id,ip:null},version)}); }),
});
const routers = Object.fromEntries(['paciente','orden','medico','muestra','resultado','usuario','auth'].map(n=>[n,require('../src/routes/'+n+'.routes.ts').default]));
const {errorHandler}=require('../src/middlewares/errorHandler.ts');
const claveHash=bcrypt.hashSync('ClaveFicticia!123',4);
function token(rol='AUXILIAR',extra={},secret=env.JWT_SECRET) {
  return jwt.sign({sub:'7',username:'prueba',nombre:'Persona Prueba',rol,
    ...(env.PERMISOS_OPERATIVOS_HABILITADOS?{politica:'operativa-v1'}:{}),...extra},secret,{algorithm:'HS256',expiresIn:60});
}
let numeroPeticion=0;
function request(modulo,method,url,rol='AUXILIAR',body={},opciones={}) {
  const sesion=opciones.token===undefined?(rol?token(rol):null):opciones.token;
  return new Promise((resolve,reject)=>{
    const req={method,url,originalUrl:url,body,query:{},ip:'aislada-permisos-'+(++numeroPeticion),headers:sesion?{authorization:'Bearer '+sesion}:{}};
    const res={statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){resolve({status:this.statusCode,body:JSON.parse(JSON.stringify(body))});}};
    routers[modulo].handle(req,res,e=>e?errorHandler(e,req,res,reject):resolve({status:404}));
  });
}
beforeEach(()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=false;
  cuenta={id:7,username:'prueba',nombreCompleto:'Persona Prueba',email:'persona@example.test',activo:true,
    rol:{nombre:'AUXILIAR'},passwordHash:claveHash};
  consultas=[];cambios=[];logs=[];autor=8;estado='PENDIENTE_VALIDACION';cantidad=1;fallo=null;rolDisponible=true;registro=null;consultaMuestra=null;
});
const rutas=[
  ['paciente','GET','/','pacientes.leer'],['paciente','POST','/','pacientes.escribir'],
  ['paciente','PUT','/73','pacientes.escribir'],['paciente','PATCH','/73/identificacion','pacientes.escribir'],
  ['orden','GET','/solicitudes','solicitudes.leer'],['orden','POST','/solicitudes','solicitudes.escribir'],
  ['orden','PATCH','/solicitudes/20/remitente','solicitudes.escribir'],['orden','GET','/examenes','examenes.leer'],
  ['medico','GET','/','medicos.leer'],['medico','POST','/','medicos.escribir'],['medico','PUT','/3','medicos.escribir'],
  ['medico','PATCH','/3/estado','medicos.escribir'],['muestra','GET','/','muestras.leer'],
  ['muestra','POST','/','muestras.registrar'],['muestra','PATCH','/3/receptar','muestras.receptar'],
  ['muestra','PATCH','/3/procesar','muestras.procesar'],['muestra','PATCH','/3/rechazar','muestras.rechazar'],
  ['resultado','GET','/worklist','resultados.worklist'],['resultado','GET','/','resultados.leer'],
  ['resultado','POST','/','resultados.escribir'],['resultado','PUT','/20','resultados.escribir'],
  ['resultado','PATCH','/20/validar','resultados.validar'],
  ['usuario','GET','/','usuarios.administrar'],['usuario','PATCH','/42/activar','usuarios.administrar'],
  ['usuario','GET','/capacidades','usuarios.administrar'],['usuario','POST','/','usuarios.administrar'],
];
// Matriz esperada independiente de la función de política bajo prueba.
const esperados={
  ADMINISTRADOR:['pacientes.leer','pacientes.escribir','solicitudes.leer','solicitudes.escribir','medicos.leer','medicos.escribir','examenes.leer','muestras.leer','muestras.registrar','muestras.receptar','muestras.rechazar','resultados.worklist','resultados.leer','usuarios.administrar'],
  RECEPCIONISTA:['pacientes.leer','pacientes.escribir','solicitudes.leer','solicitudes.escribir','medicos.leer','medicos.escribir','examenes.leer','muestras.leer','muestras.registrar','muestras.receptar','muestras.rechazar'],
  BACTERIOLOGO:['pacientes.leer','solicitudes.leer','medicos.leer','examenes.leer','muestras.leer','muestras.procesar','muestras.rechazar','resultados.worklist','resultados.leer','resultados.escribir'],
  VALIDADOR:['pacientes.leer','solicitudes.leer','medicos.leer','examenes.leer','muestras.leer','resultados.leer','resultados.validar'],
};
for(const activa of [false,true])for(const rol of politica.ROLES)test(`rutas directas: ${rol}, política nueva=${activa}`,async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=activa;cuenta.rol.nombre=rol;
  const permisos=activa&&rol==='AUXILIAR'?esperados.RECEPCIONISTA:[...(esperados[rol]??[])];
  if(activa&&rol==='BACTERIOLOGO')permisos.push('resultados.validar');
  if(activa&&['RECEPCIONISTA','VALIDADOR'].includes(rol))permisos.splice(0);
  for(const [mod,method,url,permiso] of rutas){
    const r=await request(mod,method,url,rol);
    const esperado=(rol==='AUXILIAR'&&!activa)||(activa&&['RECEPCIONISTA','VALIDADOR'].includes(rol))?401:permisos.includes(permiso)?200:403;
    assert.equal(r.status,esperado,`${method} ${mod}${url}, ${permiso}`);
  }
});
test('adaptadores históricos no aumentan permisos; bacteriólogo solo añade la firma solicitada',()=>{
  for(const rol of ['ADMINISTRADOR','RECEPCIONISTA','VALIDADOR']){
    const antiguos=politica.autorizacionPara(rol,false).permisos;
    for(const p of politica.autorizacionPara(rol,true).permisos)assert.ok(antiguos.includes(p));
  }
  const viejo=politica.autorizacionPara('BACTERIOLOGO',false).permisos;
  assert.deepEqual(politica.autorizacionPara('BACTERIOLOGO',true).permisos.filter(p=>!viejo.includes(p)),['resultados.validar']);
  for(const rol of ['AUXILIAR','BACTERIOLOGO','RECEPCIONISTA','VALIDADOR'])assert.equal(politica.permite(rol,'usuarios.administrar',true),false);
  assert.deepEqual(politica.autorizacionPara('DESCONOCIDO',true).permisos,[]);
});
test('las proyecciones de muestras ocultan hallazgos clínicos a AUXILIAR también en el servicio',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  for(const rol of politica.ROLES){
    await obtenerMuestraPorId(3,rol);
    const incluye=Object.hasOwn(consultaMuestra.include.examenes.include,'resultado');
    assert.equal(incluye,['BACTERIOLOGO','ADMINISTRADOR'].includes(rol));
  }
});
for(const [mod,method,url] of rutas)test('sin JWT no accede a '+mod+' '+method+' '+url,async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  assert.equal((await request(mod,method,url,null)).status,401);assert.deepEqual(consultas,[]);assert.deepEqual(cambios,[]);
});
test('modo histórico comprueba estado vigente incluso con JWT anterior',async()=>{
  cuenta.rol.nombre='RECEPCIONISTA';
  assert.equal((await request('paciente','POST','/','RECEPCIONISTA')).status,200);
  assert.deepEqual(consultas,['usuario']);
});
test('activar o apagar la política obliga a renovar JWT y evita ampliar una sesión antigua',async()=>{
  const antiguo=token('BACTERIOLOGO');env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre='BACTERIOLOGO';
  assert.equal((await request('resultado','PATCH','/20/validar','BACTERIOLOGO',{}, {token:antiguo})).status,401);
  assert.deepEqual(consultas,[]);const nuevo=token('BACTERIOLOGO');env.PERMISOS_OPERATIVOS_HABILITADOS=false;
  assert.equal((await request('paciente','GET','/','BACTERIOLOGO',{}, {token:nuevo})).status,401);
});
for(const cambio of ['inactivo','eliminado','revocado','fallo'])test('JWT vigente no conserva acceso con cuenta '+cambio,async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre='BACTERIOLOGO';const t=token('BACTERIOLOGO');
  if(cambio==='inactivo')cuenta.activo=false;if(cambio==='eliminado')cuenta=null;
  if(cambio==='revocado')cuenta.rol.nombre='AUXILIAR';if(cambio==='fallo')fallo='cuenta';
  const r=await request('resultado','PATCH','/20/validar','BACTERIOLOGO',{}, {token:t});
  assert.equal(r.status,cambio==='fallo'?503:401);assert.deepEqual(cambios,[]);
});
test('ignora permisos y administración incluidos en JWT o body',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  const t=token('AUXILIAR',{permisos:['usuarios.administrar','resultados.validar'],admin:true,perfilOperativo:'BACTERIOLOGO'});
  for(const [mod,method,url]of[['usuario','GET','/'],['resultado','PATCH','/20/validar']])
    assert.equal((await request(mod,method,url,'AUXILIAR',{rol:'BACTERIOLOGO',admin:true},{token:t})).status,403);
  assert.deepEqual(cambios,[]);
});
for(const extra of [{sub:'0'},{sub:'4294967296'},{rol:'SUPERADMIN'},{politica:'desconocida'}])test('rechaza JWT malformado '+JSON.stringify(extra),async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  assert.equal((await request('paciente','GET','/','AUXILIAR',{}, {token:token('AUXILIAR',extra)})).status,401);
  assert.deepEqual(consultas,[]);
});
test('rechaza firma ajena, JWT expirado y algoritmo none sin consultar cuentas',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  const expirado=jwt.sign({sub:'7',username:'p',nombre:'p',rol:'AUXILIAR',politica:'operativa-v1'},env.JWT_SECRET,{expiresIn:-1,algorithm:'HS256'});
  const ninguno=jwt.sign({sub:'7',rol:'BACTERIOLOGO'},'',{algorithm:'none'});
  for(const t of [token('AUXILIAR',{},'otra-clave'),expirado,ninguno])
    assert.equal((await request('paciente','GET','/','AUXILIAR',{}, {token:t})).status,401);
  assert.deepEqual(consultas,[]);
});
test('bacteriólogo valida el trabajo ajeno y queda auditoría profesional',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre='BACTERIOLOGO';
  assert.equal((await request('resultado','PATCH','/20/validar','BACTERIOLOGO')).status,200);
  assert.equal(cambios[0].usuarioIdValida,7);assert.equal(logs[0].accion,'VALIDAR');
});
test('doble firma impide validar el resultado propio también con el perfil nuevo',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre='BACTERIOLOGO';autor=7;
  const r=await request('resultado','PATCH','/20/validar','BACTERIOLOGO');
  assert.equal(r.status,403);assert.equal(r.body.error.code,'DOBLE_FIRMA_VIOLADA');assert.deepEqual(cambios,[]);
});
for(const rol of ['AUXILIAR','RECEPCIONISTA','VALIDADOR','ADMINISTRADOR'])test('servicio clínico tampoco permite firma no profesional '+rol,async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre=rol;
  await assert.rejects(validarResultado(20,{usuarioId:7,ip:null},version),e=>e.code==='FIRMA_PROFESIONAL_REQUERIDA');assert.deepEqual(cambios,[]);
});
test('mantiene resultado validado inmutable y conflicto de validación concurrente',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre='BACTERIOLOGO';estado='VALIDADO';
  assert.equal((await request('resultado','PATCH','/20/validar','BACTERIOLOGO')).status,409);
  estado='PENDIENTE_VALIDACION';cantidad=0;
  assert.equal((await request('resultado','PATCH','/20/validar','BACTERIOLOGO')).status,409);assert.deepEqual(cambios,[]);
});
for(const rol of ['AUXILIAR','BACTERIOLOGO','RECEPCIONISTA','VALIDADOR'])test('servicio de usuarios tampoco concede administración a '+rol,async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre=rol;
  await assert.rejects(listarUsuarios({estado:'todos',page:1,pageSize:25},7),e=>e.statusCode===403);
});
test('login emite versión de política y capacidades, no permisos dentro del JWT',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  const r=await request('auth','POST','/login',null,{username:'prueba',password:'ClaveFicticia!123'});
  assert.equal(r.status,200);const sesion=r.body.data;
  const payload=jwt.verify(sesion.token,env.JWT_SECRET);
  assert.equal(payload.politica,'operativa-v1');assert.equal(payload.permisos,undefined);
  assert.equal(sesion.usuario.autorizacion.perfilOperativo,'AUXILIAR');
  assert.ok(!sesion.usuario.autorizacion.permisos.includes('usuarios.administrar'));
  const perfil=await request('auth','GET','/me','AUXILIAR',{}, {token:sesion.token});
  assert.deepEqual(perfil.body.data.autorizacion,sesion.usuario.autorizacion);
});
test('rol AUXILIAR no inicia sesión si se desactiva la política',async()=>{
  const r=await request('auth','POST','/login',null,{username:'prueba',password:'ClaveFicticia!123'});
  assert.equal(r.status,403);assert.deepEqual(cambios,[]);
});
const registroValido={nombreCompleto:'Persona Sintética',email:'nueva@example.test',password:'ClaveFicticia!123',confirmacion:'ClaveFicticia!123'};
test('rolRegistroPublico conserva RECEPCIONISTA histórico y no ofrece rol con política nueva',()=>{
  assert.equal(rolRegistroPublico(),'RECEPCIONISTA');
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  assert.equal(rolRegistroPublico(),null);
});
test('registro público no autenticado se bloquea antes de hashes o consultas en modo nuevo',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta=null;
  const hashOriginal=bcrypt.hash;
  bcrypt.hash=()=>{throw new Error('No debe calcular hash de un registro bloqueado');};
  try {
    for(const disponible of [true,false]){
      rolDisponible=disponible;
      const r=await request('auth','POST','/register',null,registroValido);
      assert.equal(r.status,403);assert.equal(r.body.error.code,'REGISTRO_PUBLICO_DESHABILITADO');
      assert.equal(r.body.data,undefined);assert.equal(registro,null);assert.deepEqual(consultas,[]);assert.deepEqual(cambios,[]);
    }
  } finally {bcrypt.hash=hashOriginal;}
});
test('registro público bloqueado no se habilita presentando un JWT administrativo',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;cuenta.rol.nombre='ADMINISTRADOR';
  const r=await request('auth','POST','/register','ADMINISTRADOR',registroValido);
  assert.equal(r.status,403);assert.equal(r.body.error.code,'REGISTRO_PUBLICO_DESHABILITADO');
  assert.equal(registro,null);assert.deepEqual(consultas,[]);assert.deepEqual(cambios,[]);
});
test('registro público bloqueado también impide crear usuarios llamando directamente al servicio',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=true;
  await assert.rejects(registrarCuenta(registroValido),e=>e.statusCode===403&&e.code==='REGISTRO_PUBLICO_DESHABILITADO');
  assert.equal(registro,null);assert.deepEqual(consultas,[]);assert.deepEqual(cambios,[]);
});
test('registro público histórico crea solo RECEPCIONISTA inactivo sin token',async()=>{
  cuenta=null;
  const r=await request('auth','POST','/register',null,registroValido);
  assert.equal(r.status,202);assert.equal(registro.rolId,2);assert.equal(registro.activo,false);
  assert.equal(r.body.data.token,undefined);assert.equal(r.body.data.usuario,undefined);
  assert.ok(consultas.some(c=>Array.isArray(c)&&c[0]==='rol'&&c[1]==='RECEPCIONISTA'));
  assert.ok(!consultas.some(c=>Array.isArray(c)&&c[1]==='AUXILIAR'));
});
for(const activa of [false,true])for(const rol of ['AUXILIAR','BACTERIOLOGO','ADMINISTRADOR'])
test(`registro rechaza rol ${rol} y capacidades del solicitante, política nueva=${activa}`,async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=activa;cuenta=null;
  const body={...registroValido,rol,autorizacion:{permisos:['usuarios.administrar']}};
  assert.equal((await request('auth','POST','/register',null,body)).status,400);
  assert.equal(registro,null);assert.deepEqual(consultas,[]);assert.deepEqual(cambios,[]);
});
test('SQL solo amplía catálogo y CHECK: no convierte cuentas, elimina históricos ni altera contraseñas',()=>{
  const sql=fs.readFileSync(require.resolve('../../database/migrations/20261122_003_roles_operativos.sql'),'utf8').replace(/--[^\n]*/g,'');
  assert.match(sql,/ALTER TABLE roles/);assert.match(sql,/INSERT INTO roles/);
  for(const rol of politica.ROLES)assert.ok(sql.includes("'"+rol+"'"));
  assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|TRUNCATE)\b|ALTER TABLE usuarios|password_hash|rol_id/i);
});
