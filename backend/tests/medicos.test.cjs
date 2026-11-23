const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
require('./solo-mocks.cjs');
function sustituir(ruta, exports) {
  const id = require.resolve(ruta), m = new Module(id);
  Object.assign(m, { exports, loaded: true }); require.cache[id] = m;
}
const env = { NODE_ENV: 'production', JWT_SECRET: 'clave-ficticia-pruebas-medicos-offline', MEDICOS_REMITENTES_HABILITADOS: true };
let medicos, solicitudes, calls, logs, fallo, esquema, seq;
const ficha = { nombres: 'Ana', apellidos: 'Prueba', registroProfesional: null, especialidad: null,
  telefono: null, email: null, institucion: null };
const medico = (id, extra = {}) => ({ id, ...ficha, activo: true, createdAt: new Date('2026-01-01Z'), updatedAt: new Date('2026-01-01Z'), ...extra });
const original = { id: 20, codigo: 'SOL-2026-000020', pacienteId: 73, usuarioIdRegistra: 7,
  medicoSolicitante: ' Dr. Histórico  Original ', medicoRemitenteId: null, medicoRemitenteNombre: null,
  prioridad: 'RUTINA', fechaSolicitud: new Date(), createdAt: new Date(), updatedAt: new Date(),
  diagnosticoPresuntivo: null, observaciones: null };
const project = (row, select) => row && (select ? Object.fromEntries(Object.entries(select).filter(([,v]) => v === true).map(([k]) => [k,row[k]])) : { ...row });
function matches(row, where = {}) {
  return Object.entries(where).every(([k,v]) => k === 'AND' ? v.every(w => matches(row,w)) : k === 'OR' ? v.some(w => matches(row,w))
    : v && typeof v === 'object' && 'contains' in v ? (row[k] ?? '').toLowerCase().includes(v.contains.toLowerCase()) : row[k] === v);
}
const capture = (name, fn) => async args => { calls.push([name,args]); return fn(args); };
function unique(data, id) {
  if ([...medicos.values()].some(m => m.id !== id && (data.registroProfesional && m.registroProfesional === data.registroProfesional
    || data.claveDuplicado && m.claveDuplicado === data.claveDuplicado))) {
    throw new Prisma.PrismaClientKnownRequestError('Conflicto simulado', { code: 'P2002', clientVersion: '6.19.3' });
  }
}
const prisma = {
  medicoRemitente: {
    create: capture('medico.create', ({data,select}) => { unique(data); const m=medico(++seq,data); medicos.set(m.id,m); return project(m,select); }),
    update: capture('medico.update', ({where,data,select}) => { unique(data,where.id); const m={...medicos.get(where.id),...data}; medicos.set(m.id,m);return project(m,select); }),
    findUnique: capture('medico.findUnique', ({where,select}) => project(medicos.get(where.id),select) ?? null),
    count: capture('medico.count', ({where}) => [...medicos.values()].filter(m => matches(m,where)).length),
    findMany: capture('medico.findMany', ({where,select,skip,take}) => [...medicos.values()].filter(m => matches(m,where)).slice(skip,skip+take).map(m => project(m,select))),
  },
  solicitud: {
    findFirst: capture('solicitud.findFirst', () => null),
    create: capture('solicitud.create', ({data,select}) => { const s={...original,id:21,...data};solicitudes.set(s.id,s);return project(s,select); }),
    update: capture('solicitud.update', ({where,data,select}) => { const s={...solicitudes.get(where.id),...data};solicitudes.set(s.id,s);return project(s,select); }),
    findUnique: capture('solicitud.findUnique', ({where,select}) => project(solicitudes.get(where.id),select) ?? null),
    findMany: capture('solicitud.findMany', ({select}) => [...solicitudes.values()].map(s => project(s,select))),
    count: capture('solicitud.count', () => solicitudes.size),
  },
  paciente: { findUnique: capture('paciente.findUnique', () => ({id:73})) },
  muestra: { findUnique: capture('muestra.findUnique', () => ({id:30})) },
  resultado: { findUnique: capture('resultado.findUnique', () => ({id:40})), findMany: capture('resultado.findMany', () => []), count: async () => 0 },
  muestraExamen: { findMany: capture('muestraExamen.findMany', () => []) },
  logAuditoria: { create: capture('audit', ({data}) => { if(fallo==='audit') throw new Error('Error interno ficticio');logs.push(data);return {}; }) },
  $queryRaw: async (strings,...params) => {
    const sql = strings.join('?');calls.push(['sql',sql,params]);
    if (fallo==='metadata' && sql.includes('information_schema')) throw new Error('Fallo simulado');
    if (sql.includes('COLUMNS')) return esquema ? [
      ...['id','nombres','apellidos','registro_profesional','especialidad','telefono','email','institucion','clave_duplicado','activo','created_at','updated_at'].map(nombre => ({tabla:'medicos_remitentes',nombre,tipo:nombre==='id'?'int unsigned':'varchar(120)',nullable:'YES'})),
      {tabla:'solicitudes',nombre:'medico_remitente_id',tipo:'int unsigned',nullable:'YES'},
      {tabla:'solicitudes',nombre:'medico_remitente_nombre',tipo:'varchar(120)',nullable:'YES'},
    ] : [];
    if (sql.includes('STATISTICS')) return [ ['uq_medicos_registro','registro_profesional'],['uq_medicos_duplicado','clave_duplicado'] ].map(([nombre,columna]) => ({nombre,columna,noUnico:0}));
    if (sql.includes('KEY_COLUMN_USAGE')) return [{columna:'medico_remitente_id',tabla:'medicos_remitentes',referida:'id'}];
    if (sql.includes('FROM medicos_remitentes')) return medicos.has(params[0]) ? [medicos.get(params[0])] : [];
    return [];
  },
  $transaction: async fn => {
    if (Array.isArray(fn)) return Promise.all(fn);
    const copia = structuredClone([medicos,solicitudes,logs]);
    try { return await fn(prisma); } catch(e) { [medicos,solicitudes,logs]=copia;throw e; }
  },
};
sustituir('../src/config/env.ts',{env});sustituir('../src/config/prisma.ts',{prisma});
const { Prisma } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const router = require('../src/routes/medico.routes.ts').default;
const ordenRouter = require('../src/routes/orden.routes.ts').default;
const { errorHandler } = require('../src/middlewares/errorHandler.ts');
const disponibilidad = require('../src/services/medicos-disponibilidad.ts');
const pacientes = require('../src/services/paciente.service.ts');
const muestras = require('../src/services/muestra.service.ts');
const resultados = require('../src/services/resultado.service.ts');
function request(method, url, body={}, rol='RECEPCIONISTA', query={}, r=router) {
  return new Promise((resolve,reject) => {
    const token=rol?jwt.sign({sub:'7',username:'prueba',nombre:'Prueba',rol},env.JWT_SECRET,{algorithm:'HS256'}):null;
    const req={method,url,originalUrl:url,body,query,ip:'127.0.0.1',headers:token?{authorization:'Bearer '+token}:{}};
    const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){resolve({status:this.statusCode,body:JSON.parse(JSON.stringify(body))});}};
    r.handle(req,res,e=>e?errorHandler(e,req,res,reject):resolve({status:404}));
  });
}
const solicitud = (method,url,body={},rol) => request(method,url,body,rol,{},ordenRouter);
beforeEach(() => {
  medicos=new Map();solicitudes=new Map([[20,structuredClone(original)]]);calls=[];logs=[];fallo=null;esquema=true;seq=0;
  env.MEDICOS_REMITENTES_HABILITADOS=true;
});
for (const body of [ {...ficha,nombres:''}, {...ficha,apellidos:' '}, {...ficha,email:'incorrecto'},
  {...ficha,telefono:'letras'}, {...ficha,telefono:'-----'}, {...ficha,nombres:'a'.repeat(81)}, {...ficha,nombres:'a'.repeat(80),apellidos:'a'.repeat(80)},
  {...ficha,nombres:'Ana\nOtra'}, {...ficha,activo:false}, {...ficha,claveDuplicado:'externa'}, {...ficha,registroProfesional:'ß'.repeat(50)} ]) {
  test('valida ficha sin escribir: '+JSON.stringify(body), async () => {
    const r=await request('POST','/',body);assert.equal(r.status,400);assert.equal(calls.length,0);
  });
}
test('crea sin registro inventado y no expone la clave interna; audita con el usuario',async()=>{
  const r=await request('POST','/',{...ficha,nombres:' Ana ',email:' ANA@example.test ',registroProfesional:' '});
  assert.equal(r.status,201);assert.equal(r.body.data.nombres,'Ana');assert.equal(r.body.data.email,'ana@example.test');
  assert.equal(r.body.data.registroProfesional,null);assert.equal(r.body.data.activo,true);
  assert.equal('claveDuplicado' in r.body.data,false);assert.equal(logs[0].usuarioId,7);
});
test('permite homónimos sin contacto y sin registro',async()=>{
  assert.equal((await request('POST','/',ficha)).status,201);assert.equal((await request('POST','/',ficha)).status,201);assert.equal(medicos.size,2);
});
test('registro profesional normalizado y único incluso inactivo',async()=>{
  await request('POST','/',{...ficha,registroProfesional:' rp-01 '});
  await request('PATCH','/1/estado',{activo:false});
  const r=await request('POST','/',{...ficha,nombres:'Otra',registroProfesional:'RP-01'});
  assert.equal(r.status,409);assert.equal(r.body.error.code,'MEDICO_DUPLICADO');assert.equal(medicos.size,1);
});
test('evita una ficha idéntica con contacto, admite datos distintos y actualizarse a sí misma',async()=>{
  const f={...ficha,email:'ana@example.test'};await request('POST','/',f);
  assert.equal((await request('POST','/',{...f,nombres:'ANA'})).status,409);
  assert.equal((await request('POST','/',{...f,institucion:'Otra institución'})).status,201);
  assert.equal((await request('PUT','/1',f)).status,200);
});
test('normaliza formato del teléfono para impedir el duplicado exacto de una ficha',async()=>{
  assert.equal((await request('POST','/',{...ficha,telefono:'300 123-4567'})).status,201);
  assert.equal((await request('POST','/',{...ficha,telefono:'3001234567'})).status,409);
});
test('una actualización duplicada no altera la ficha anterior',async()=>{
  await request('POST','/',{...ficha,registroProfesional:'RP-01'});
  await request('POST','/',{...ficha,nombres:'Luisa',registroProfesional:'RP-02'});
  assert.equal((await request('PUT','/2',{...ficha,registroProfesional:'RP-01'})).status,409);
  assert.equal(medicos.get(2).registroProfesional,'RP-02');
});
test('actualización permite limpiar opcionales sin modificar snapshots de solicitudes',async()=>{
  await request('POST','/',{...ficha,telefono:'3001234567',especialidad:'General'});
  const r=await request('PUT','/1',{...ficha,nombres:'Nombre actualizado'});
  assert.equal(r.status,200);assert.equal(r.body.data.telefono,null);assert.equal(r.body.data.especialidad,null);
  assert.deepEqual(solicitudes.get(20),original);
});
test('actualizar y consultar inexistentes devuelve 404',async()=>{
  assert.equal((await request('GET','/99')).status,404);assert.equal((await request('PUT','/99',ficha)).status,404);
  assert.equal((await request('PATCH','/99/estado',{activo:true})).status,404);
});
test('consulta por ID devuelve solo la proyección pública',async()=>{
  await request('POST','/',{...ficha,email:'ana@example.test'});
  const r=await request('GET','/1');assert.equal(r.status,200);assert.equal(r.body.data.id,1);assert.equal('claveDuplicado' in r.body.data,false);
});
test('búsqueda por palabras, registro e institución; pagina y filtra activos',async()=>{
  await request('POST','/',{...ficha,registroProfesional:'RP-01',institucion:'Clínica Norte'});
  await request('POST','/',{...ficha,nombres:'Luisa'});
  for(const q of ['Ana Prueba','rp-01','Clínica Norte']) {
    const r=await request('GET','/',{},'VALIDADOR',{q,page:'1',pageSize:'1'});
    assert.equal(r.status,200);assert.equal(r.body.total,1);assert.equal(r.body.data[0].id,1);
  }
  const p=await request('GET','/',{},'RECEPCIONISTA',{page:'2',pageSize:'1'});
  assert.equal(p.body.data[0].id,2);assert.equal(p.body.totalPages,2);
  await request('PATCH','/1/estado',{activo:false});
  const activos=await request('GET','/',{},'RECEPCIONISTA',{estado:'activos'});
  assert.deepEqual(activos.body.data.map(m=>m.id),[2]);
  const inactivos=await request('GET','/',{},'RECEPCIONISTA',{estado:'inactivos'});assert.equal(inactivos.body.data[0].id,1);
  assert.equal((await request('PATCH','/1/estado',{activo:true})).body.data.activo,true);
});
for(const query of [{page:'0'},{pageSize:'101'},{estado:'cualquiera'},{q:'a'.repeat(121)}])test('rechaza filtros inválidos '+JSON.stringify(query),async()=>{
  assert.equal((await request('GET','/',{},'RECEPCIONISTA',query)).status,400);assert.equal(calls.length,0);
});
for(const rol of [null,'BACTERIOLOGO','VALIDADOR'])for(const [method,url,body]of[['POST','/',ficha],['PUT','/1',ficha],['PATCH','/1/estado',{activo:false}]])test(`${method} autoriza antes de consultar: ${rol}`,async()=>{
  assert.equal((await request(method,url,body,rol)).status,rol?403:401);assert.equal(calls.length,0);
});
for(const rol of ['ADMINISTRADOR','RECEPCIONISTA'])test('permite escritura al rol existente '+rol,async()=>{
  assert.equal((await request('POST','/',ficha,rol)).status,201);
});
for(const url of ['/','/1','/capacidades'])test('lectura exige autenticación '+url,async()=>{
  assert.equal((await request('GET',url,{},null)).status,401);assert.equal(calls.length,0);
});
test('no existe eliminación física',async()=>{assert.equal((await request('DELETE','/1')).status,404);assert.equal(calls.length,0);});
test('auditoría y ficha se revierten juntas en el doble transaccional',async()=>{
  fallo='audit';const r=await request('POST','/',ficha);assert.equal(r.status,503);assert.equal(medicos.size,0);assert.equal(logs.length,0);
  assert.equal(JSON.stringify(r).includes('Error interno'),false);
});
test('bandera apagada: capacidad false y ninguna consulta nueva, ni metadatos',async()=>{
  env.MEDICOS_REMITENTES_HABILITADOS=false;
  assert.deepEqual((await request('GET','/capacidades')).body,{data:{directorioMedicos:false}});
  assert.equal((await request('GET','/')).status,503);assert.equal((await request('POST','/',ficha)).status,503);
  assert.deepEqual(calls,[]);
});
test('la verificación dentro de una transacción utiliza su cliente y no otra conexión global',async()=>{
  const consulta=prisma.$queryRaw;
  const tx={ $queryRaw: consulta };
  prisma.$queryRaw=()=>{throw new Error('Consulta global fuera de transacción');};
  try {
    assert.equal((await disponibilidad.seleccionSolicitudBase(tx)).medicoRemitenteId,true);
  } finally { prisma.$queryRaw=consulta; }
});
for(const modo of ['ausente','error'])test('bandera prematura no habilita esquema '+modo,async()=>{
  if(modo==='ausente')esquema=false;else fallo='metadata';
  assert.equal((await request('GET','/capacidades')).body.data.directorioMedicos,false);
  assert.equal((await request('POST','/',ficha)).status,503);
  assert.equal(calls.some(([n])=>n.startsWith('medico.')),false);
  assert.equal('medicoRemitenteId' in await disponibilidad.seleccionSolicitudBase(),false);
  const r=await solicitud('POST','/solicitudes',{pacienteId:73,medicoSolicitante:'Remitente libre'});
  assert.equal(r.status,201);assert.equal(r.body.data.medicoSolicitante,'Remitente libre');
  assert.equal('medicoRemitenteId' in r.body.data,false);
});
test('solicitud crea vínculo opcional y snapshot, sin tocar paciente ni relaciones clínicas',async()=>{
  medicos.set(1,medico(1));
  const r=await solicitud('POST','/solicitudes',{pacienteId:73,medicoRemitenteId:1});
  assert.equal(r.status,201);assert.equal(r.body.data.pacienteId,73);assert.equal(r.body.data.medicoRemitenteId,1);
  assert.equal(r.body.data.medicoSolicitante,'Ana Prueba');assert.equal(r.body.data.medicoRemitenteNombre,'Ana Prueba');
  assert.ok(calls.some(([n,sql])=>n==='sql'&&sql.includes('FOR UPDATE')));
});
test('edita vínculo conservando el texto histórico; cambios de ficha no reescriben snapshot',async()=>{
  medicos.set(1,medico(1));
  let r=await solicitud('PATCH','/solicitudes/20/remitente',{medicoRemitenteId:1});
  assert.equal(r.status,200);assert.equal(r.body.data.medicoSolicitante,original.medicoSolicitante);
  await request('PUT','/1',{...ficha,nombres:'Renombrada'});
  assert.equal(solicitudes.get(20).medicoRemitenteNombre,'Ana Prueba');
  await request('PATCH','/1/estado',{activo:false});
  assert.equal((await solicitud('PATCH','/solicitudes/20/remitente',{medicoRemitenteId:1})).status,200);
  r=await solicitud('PATCH','/solicitudes/20/remitente',{medicoRemitenteId:null});
  assert.equal(r.body.data.medicoRemitenteId,null);assert.equal(r.body.data.medicoSolicitante,original.medicoSolicitante);
});
test('no asigna médico ausente o inactivo ni admite texto e ID simultáneos',async()=>{
  assert.equal((await solicitud('POST','/solicitudes',{pacienteId:73,medicoRemitenteId:99})).status,404);
  medicos.set(1,medico(1,{activo:false}));
  assert.equal((await solicitud('POST','/solicitudes',{pacienteId:73,medicoRemitenteId:1})).status,409);
  assert.equal((await solicitud('POST','/solicitudes',{pacienteId:73,medicoRemitenteId:1,medicoSolicitante:'Otro'})).status,400);
  assert.equal(solicitudes.size,1);
});
for(const rol of [null,'BACTERIOLOGO','VALIDADOR'])test('asignación exige los mismos permisos de admisión '+rol,async()=>{
  assert.equal((await solicitud('PATCH','/solicitudes/20/remitente',{medicoRemitenteId:1},rol)).status,rol?403:401);assert.equal(calls.length,0);
});
test('rollback de asignación si falla auditoría conserva histórico y vínculo',async()=>{
  medicos.set(1,medico(1));fallo='audit';
  // ErrorHandler devuelve un error genérico de producción; el doble restaura la transacción.
  const viejo=console.error;console.error=()=>{};
  try { assert.equal((await solicitud('PATCH','/solicitudes/20/remitente',{medicoRemitenteId:1})).status,500); }
  finally { console.error=viejo; }
  assert.deepEqual(solicitudes.get(20),original);
});
test('modo apagado conserva creación antigua y rechaza asociaciones sin escribir',async()=>{
  env.MEDICOS_REMITENTES_HABILITADOS=false;
  assert.equal((await solicitud('POST','/solicitudes',{pacienteId:73,medicoSolicitante:'Texto sin clasificar'})).status,201);
  const args=calls.find(([n])=>n==='solicitud.create')[1];
  assert.equal(args.data.medicoSolicitante,'Texto sin clasificar');assert.equal(JSON.stringify(args).includes('medicoRemitente'),false);
  calls=[];
  assert.equal((await solicitud('POST','/solicitudes',{pacienteId:73,medicoRemitenteId:1})).status,503);
  assert.equal((await solicitud('PATCH','/solicitudes/20/remitente',{medicoRemitenteId:null})).status,503);assert.deepEqual(calls,[]);
});
test('compatibilidad apagada en listado, detalle, paciente, muestra, worklist y resultados: selecciones explícitas',async()=>{
  env.MEDICOS_REMITENTES_HABILITADOS=false;
  assert.equal((await solicitud('GET','/solicitudes')).status,200);
  assert.equal((await solicitud('GET','/solicitudes/20')).body.data.medicoSolicitante,original.medicoSolicitante);
  await pacientes.obtenerPacientePorId(73);await muestras.obtenerMuestraPorId(30,'RECEPCIONISTA');
  await resultados.obtenerResultadoPorId(40);await resultados.obtenerWorklist({soloPendientes:true});
  await resultados.listarResultados({page:1,pageSize:25});
  assert.equal(calls.some(([n])=>n==='sql'),false);
  assert.equal(JSON.stringify(calls).includes('medicoRemitente'),false);
  for(const [name,args]of calls) {
    if(name.startsWith('solicitud.')&&args.select)assert.equal(args.select.medicoSolicitante,true);
    if(name==='paciente.findUnique')assert.equal(args.select.solicitudes.select.medicoSolicitante,true);
    if(name==='muestra.findUnique')assert.equal(args.include.solicitud.select.medicoSolicitante,true);
    if(name==='resultado.findUnique')assert.equal(args.include.muestraExamen.include.muestra.include.solicitud.select.medicoSolicitante,true);
  }
});
test('migración solo añade directorio y columnas nullable, sin DML histórico, cascadas ni defaults de vínculo',()=>{
  const sql=fs.readFileSync(require.resolve('../../database/migrations/20261122_002_medicos_remitentes.sql'),'utf8').replace(/--[^\n]*/g,'');
  assert.match(sql,/CREATE TABLE medicos_remitentes/);assert.match(sql,/ADD COLUMN medico_remitente_id INT UNSIGNED NULL/);
  assert.doesNotMatch(sql,/\b(UPDATE|DELETE|INSERT|DROP|TRUNCATE)\b(?! NO ACTION)/i);
  assert.match(sql,/ON DELETE NO ACTION ON UPDATE NO ACTION/);
  const campos=Prisma.dmmf.datamodel.models.find(m=>m.name==='Solicitud').fields;
  for(const name of ['medicoRemitenteId','medicoRemitenteNombre']){const f=campos.find(f=>f.name===name);assert.equal(f.isRequired,false);assert.equal(f.hasDefaultValue,false);}
});
