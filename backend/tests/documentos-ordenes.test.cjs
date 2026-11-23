const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { mkdtempSync, writeFileSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
require('./solo-mocks.cjs');
function sustituir(ruta, exports) {
  const id=require.resolve(ruta), m=new Module(id); Object.assign(m,{exports,loaded:true});require.cache[id]=m;
}
const { Prisma } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const env={ JWT_SECRET:'clave-ficticia-documentos-sin-red-offline', NODE_ENV:'test',
  PERMISOS_OPERATIVOS_HABILITADOS:true, PACIENTES_IDENTIFICACION_HABILITADA:false,
  MEDICOS_REMITENTES_HABILITADOS:false, ORDENES_ASISTIDAS_HABILITADAS:false };
const instante=new Date('2026-11-23T12:00:00.000Z');
const ctx={usuarioId:1,ip:'127.0.0.1'};
let db, llamadas, auditoriaFalla, esquema;
const persona=(id,nombreCompleto,rol='BACTERIOLOGO')=>({id,nombreCompleto,rol:{nombre:rol}});
const examen=(id=10,tipoMuestraRequerida='Orina')=>({id,codigo:'EX-'+id,nombre:'Examen real '+id,
  tipoMuestraRequerida,activo:true,descripcion:null,precio:'0',instruccionesToma:null,sitiosPermitidos:null});
function resultado() {return {id:30,estado:'VALIDADO',usuarioIdRegistra:2,usuarioIdValida:3,
  fechaRegistro:instante,fechaValidacion:instante,updatedAt:instante,hallazgoGram:null,colonias:null,
  bacteriaAislada:'Bacteria de prueba',observaciones:'Observación validada de prueba',
  registradoPor:persona(2,'Profesional que registra'),validadoPor:persona(3,'Profesional que valida'),
  antibiograma:[{antibiotico:'Antibiótico registrado',sensibilidad:'S',haloMm:'18.5'}]};}
function solicitud() {return {id:1,codigo:'SOL-2026-000001',fechaSolicitud:instante,prioridad:'RUTINA',
  medicoSolicitante:'Remitente histórico original',diagnosticoPresuntivo:null,observaciones:'Nota de admisión',
  paciente:{id:9,cedula:'00123',nombres:'Paciente',apellidos:'Sintético',fechaNacimiento:new Date('2026-11-10Z')},
  muestras:[{id:20,codigoBarras:'M261123-ABC234',estado:'PROCESADA',tipoMuestra:'Orina',sitioAnatomico:null,
    fechaToma:instante,fechaRecepcion:instante,examenes:[{id:22,examenId:10,examen:examen(),resultado:resultado()}]}]};}
const proy=(fila,select)=>!fila?null:select?Object.fromEntries(Object.entries(select).filter(([,v])=>v).map(([k])=>[k,fila[k]])):structuredClone(fila);
const columnas={solicitudes_examenes:['id','solicitud_id','examen_id','tipo_muestra','sitio_anatomico_id','sitio_anatomico','instrucciones_toma'],
  sitios_anatomicos:['id','nombre','clave','tipos_muestra','activo'],plantillas_examenes:['id','nombre','clave','examen_ids','activo'],examenes:['instrucciones_toma','sitios_permitidos']};
const encontrarExamen=id=>db.muestras.flatMap(m=>m.examenes.map(e=>({...e,muestraId:m.id,muestra:m}))).find(e=>e.id===id);
const encontrarResultado=id=>db.muestras.flatMap(m=>m.examenes).find(e=>e.resultado?.id===id)?.resultado;
const leerResultado=id=>{const r=encontrarResultado(id);return r?{...r,muestraExamen:encontrarExamen(r.muestraExamenId)}:null;};
const prisma={
  $queryRaw:async(parts,...valores)=>{const sql=parts.join('?');llamadas.push(['sql',sql,valores]);
    return sql.includes('information_schema') ? (esquema?Object.entries(columnas).flatMap(([tabla,cols])=>cols.map(columna=>({tabla,columna}))):[]) : [{id:valores[0]}];},
  usuario:{findUnique:async({where})=>db.cuentas[where.id]??null},
  solicitud:{
    findUnique:async({where,select})=>proy(where.id===db.solicitud?.id?db.solicitud:null,select),
    findFirst:async()=>null,
    create:async({data,select})=>{db.lineas=(data.examenesSolicitados?.create??[]).map(l=>({...l,examen:db.examenes.find(e=>e.id===l.examenId)}));db.solicitud={...solicitud(),...data,id:2,muestras:[],examenesSolicitados:db.lineas};return proy(db.solicitud,select);},
  },
  solicitudExamen:{findMany:async()=>{llamadas.push(['lineas']);return structuredClone(db.lineas);}},
  examen:{
    findMany:async({where={},select}={})=>{llamadas.push(['examenes',select]);return db.examenes.filter(e=>(!where.activo||e.activo)&&(!where.id||where.id.in.includes(e.id))).map(e=>proy(e,select));},
    count:async({where})=>db.examenes.filter(e=>e.activo&&where.id.in.includes(e.id)).length,
  },
  paciente:{findUnique:async()=>({id:9})},
  sitioAnatomico:{
    findUnique:async({where})=>db.sitios.find(s=>s.id===where.id)??null,
    findMany:async()=>structuredClone(db.sitios.filter(s=>s.activo)),
    create:async({data})=>{if(db.sitios.some(s=>s.clave===data.clave))throw new Prisma.PrismaClientKnownRequestError('Duplicado',{code:'P2002',clientVersion:'6.19.3'});const s={id:db.sitios.length+1,...data};db.sitios.push({...s,activo:true});return s;},
  },
  plantillaExamenes:{findMany:async()=>db.plantillas,create:async({data})=>{const p={id:1,...data};db.plantillas.push(p);return p;}},
  muestra:{
    findUnique:async({where})=>db.muestras.find(m=>where.id?m.id===where.id:m.codigoBarras===where.codigoBarras)??null,
    findUniqueOrThrow:async({where})=>db.muestras.find(m=>m.id===where.id),
    create:async({data})=>{const m={...data,id:88,estado:'REGISTRADA',fechaRecepcion:null,sitioAnatomico:data.sitioAnatomico??null,
      examenes:data.examenes.create.map((e,i)=>({...e,id:900+i,muestraId:88,examen:db.examenes.find(x=>x.id===e.examenId),resultado:null}))};
      db.muestras.push(m);db.solicitud.muestras.push(m);return m;},
    updateMany:async({where,data})=>{const m=db.muestras.find(m=>m.id===where.id&&m.estado===where.estado);if(!m)return{count:0};Object.assign(m,data);return{count:1};},
  },
  muestraExamen:{
    findUnique:async({where})=>encontrarExamen(where.id),
    count:async({where})=>where.muestraId?db.muestras.find(m=>m.id===where.muestraId).examenes.filter(e=>!e.resultado).length:db.asignados,
  },
  resultado:{
    findUnique:async({where})=>leerResultado(where.id),findUniqueOrThrow:async({where})=>leerResultado(where.id),
    create:async({data})=>{const e=encontrarExamen(data.muestraExamenId);const original=db.muestras.find(m=>m.id===e.muestraId).examenes.find(x=>x.id===e.id);
      const r={...resultado(),...data,id:70,estado:'PENDIENTE_VALIDACION',usuarioIdValida:null,fechaValidacion:null,antibiograma:data.antibiograma.create};original.resultado=r;return r;},
    updateMany:async({where,data})=>{const r=encontrarResultado(where.id);if(!r||r.estado!==where.estado||r.updatedAt.getTime()!==where.updatedAt.getTime())return{count:0};Object.assign(r,data);if(data.usuarioIdValida)r.validadoPor=persona(data.usuarioIdValida,'Profesional que valida');return{count:1};},
  },
  logAuditoria:{create:async({data})=>{if(auditoriaFalla)throw new Error('Auditoría offline fallida');db.logs.push(data);return data;}},
  // Rollback simulado: no acredita aislamiento/bloqueos de MySQL.
  $transaction:async(fn,opciones)=>{llamadas.push(['tx',opciones]);const copia=structuredClone(db);try{return await fn(prisma);}catch(e){db=copia;throw e;}},
};
sustituir('../src/config/env.ts',{env});sustituir('../src/config/prisma.ts',{prisma});
const documentos=require('../src/services/documento.service.ts');
const pdf=require('../src/services/pdf.service.ts');
const catalogo=require('../src/services/catalogo.service.ts');
const ordenes=require('../src/services/orden.service.ts');
const muestras=require('../src/services/muestra.service.ts');
const resultados=require('../src/services/resultado.service.ts');
const { exigirInformeFinal }=require('../src/domain/documentos.ts');
const { sitioSchema,plantillaSchema }=require('../src/validators/catalogo.validator.ts');
const { crearSolicitudSchema }=require('../src/validators/orden.validator.ts');
const router=require('../src/routes/documento.routes.ts').default;
const catalogoRouter=require('../src/routes/catalogo.routes.ts').default;
const { errorHandler }=require('../src/middlewares/errorHandler.ts');
beforeEach(()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=false;env.PERMISOS_OPERATIVOS_HABILITADOS=true;esquema=true;auditoriaFalla=false;llamadas=[];
  db={solicitud:solicitud(),lineas:[],examenes:[examen(),examen(11,'Exudado')],sitios:[],plantillas:[],muestras:[],asignados:0,logs:[],
    cuentas:{1:{id:1,activo:true,rol:{nombre:'AUXILIAR'}},2:{id:2,activo:true,rol:{nombre:'BACTERIOLOGO'}},
      3:{id:3,activo:true,rol:{nombre:'BACTERIOLOGO'}},4:{id:4,activo:true,rol:{nombre:'ADMINISTRADOR'}}}};
});
function request(url,{rol='AUXILIAR',id=1,method='GET',body={},r=router}={}) {
  return new Promise((resolve,reject)=>{
    const token=rol?jwt.sign({sub:String(id),username:'prueba',nombre:'Prueba',rol,
      ...(env.PERMISOS_OPERATIVOS_HABILITADOS?{politica:'operativa-v1'}:{})},env.JWT_SECRET,{algorithm:'HS256'}):null;
    const req={method,url,originalUrl:url,body,query:{},ip:'127.0.0.1',headers:token?{authorization:'Bearer '+token}:{}};
    const res={statusCode:200,headers:{},status(n){this.statusCode=n;return this;},setHeader(k,v){this.headers[k]=v;},
      send(body){resolve({status:this.statusCode,body,headers:this.headers});},json(body){resolve({status:this.statusCode,body});}};
    r.handle(req,res,e=>e?errorHandler(e,req,res,reject):resolve({status:404}));
  });
}
function texto(buffer) {
  const dir=mkdtempSync(join(tmpdir(),'labzen-pdf-'));const ruta=join(dir,'salida.pdf');writeFileSync(ruta,buffer);
  return execFileSync('pdftotext',['-layout',ruta,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
}
test('informe real PDF A4 autorizado, identidad, solicitud, antibiograma y profesionales',async()=>{
  const r=await request('/solicitudes/1/informe.pdf');assert.equal(r.status,200);assert.equal(r.body.subarray(0,5).toString(),'%PDF-');
  assert.equal(r.headers['Content-Type'],'application/pdf');assert.match(r.headers['Cache-Control'],/no-store/);
  const t=texto(r.body);for(const literal of ['INF-SOL-2026-000001','Paciente','00123','Remitente histórico original','M261123-ABC234','Profesional que registra','Profesional que valida','18.5','13 días','Página 1'])assert.ok(t.includes(literal),literal);
  assert.ok(!t.includes('Nota de admisión'));assert.ok(!t.includes('password'));
  assert.equal(db.logs[0].accion,'EMITIR_INFORME');assert.deepEqual(db.logs[0].detalle.resultadoIds,[30]);assert.match(db.logs[0].detalle.sha256,/^[a-f0-9]{64}$/);
  assert.equal(llamadas.find(l=>l[0]==='tx')[1].isolationLevel,'RepeatableRead');
});
for(const alterar of [s=>s.muestras[0].estado='REGISTRADA',s=>s.muestras[0].estado='RECHAZADA',s=>s.muestras[0].fechaRecepcion=null,
  s=>s.muestras[0].examenes[0].resultado=null,s=>s.muestras[0].examenes[0].resultado.estado='PENDIENTE_VALIDACION',
  s=>s.muestras[0].examenes[0].resultado.fechaValidacion=null,s=>s.muestras[0].examenes[0].resultado.usuarioIdValida=2,
  s=>s.muestras[0].examenes[0].resultado.validadoPor=persona(3,'Administrador','ADMINISTRADOR'),
  s=>{const r=s.muestras[0].examenes[0].resultado;r.bacteriaAislada=null;r.observaciones=null;r.antibiograma=[];}]) {
  test('bloquea informe no final o sin doble firma: '+String(alterar),async()=>{alterar(db.solicitud);const r=await request('/solicitudes/1/informe.pdf');assert.equal(r.status,409);assert.equal(db.logs.length,0);});
}
test('un examen validado no oculta otro pendiente',async()=>{
  db.solicitud.muestras[0].examenes.push({examen:examen(11),resultado:null});assert.equal((await request('/solicitudes/1/informe.pdf')).status,409);
});
test('orden estructurada pendiente no permite informe incompleto',async()=>{
  const s=solicitud();s.examenesSolicitados=[{examenId:11,tipoMuestra:'Orina',sitioAnatomico:null}];assert.throws(()=>exigirInformeFinal(s),e=>e.statusCode===409);
});
test('informe conserva documentos históricos y no consulta tablas nuevas con bandera apagada',async()=>{
  await documentos.documentoSolicitud(1,'informe',ctx);assert.ok(!llamadas.some(l=>l[0]==='lineas'||l[0]==='sql'&&l[1].includes('information_schema')));
  assert.equal(db.solicitud.medicoSolicitante,'Remitente histórico original');assert.equal(catalogo.seleccionExamen().instruccionesToma,undefined);
});
test('paciente sin documento no recibe un identificador inventado',async()=>{
  db.solicitud.paciente.cedula=null;db.solicitud.paciente.estadoIdentificacion='SIN_DOCUMENTO_ASIGNADO';
  assert.match(texto((await documentos.documentoSolicitud(1,'informe',ctx)).pdf),/Sin documento asignado/);
});
test('sin sesión no descarga PDF',async()=>assert.equal((await request('/solicitudes/1/informe.pdf',{rol:null})).status,401));
test('cuenta revocada no descarga PDF',async()=>{db.cuentas[1].activo=false;assert.equal((await request('/solicitudes/1/informe.pdf')).status,401);});
test('permisos cambiados después de JWT se rechazan',async()=>{db.cuentas[1].rol.nombre='ADMINISTRADOR';assert.equal((await request('/solicitudes/1/informe.pdf')).status,401);});
test('política histórica también revalida la cuenta al descargar',async()=>{
  env.PERMISOS_OPERATIVOS_HABILITADOS=false;db.cuentas[1].activo=false;
  assert.equal((await request('/solicitudes/1/informe.pdf',{rol:'RECEPCIONISTA'})).status,401);
});
test('auditoría fallida impide entregar el PDF',async()=>{auditoriaFalla=true;await assert.rejects(documentos.documentoSolicitud(1,'informe',ctx));assert.equal(db.logs.length,0);});
test('solicitud inexistente responde 404',async()=>assert.equal((await request('/solicitudes/999/informe.pdf')).status,404));
test('orden PDF muestra solo los exámenes seleccionados, sin resultados clínicos',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;
  db.lineas=[{examenId:11,tipoMuestra:'Exudado',sitioAnatomico:'Faríngeo',instruccionesToma:'Texto del catálogo autorizado de prueba',examen:examen(11,'Exudado')}];
  const t=texto((await documentos.documentoSolicitud(1,'orden',ctx)).pdf);
  assert.ok(t.includes('Examen real 11'));assert.ok(!t.includes('Examen real 10'));assert.ok(t.includes('Faríngeo'));assert.ok(t.includes('Texto del catálogo autorizado de prueba'));
  assert.ok(!t.includes('Bacteria de prueba'));assert.ok(t.includes('SIN RESULTADOS'));
});
test('remisión vacía es PDF imprimible sin datos del paciente',async()=>{
  const t=texto((await documentos.remisionVacia(ctx)).pdf);assert.ok(t.includes('REMISIÓN EN BLANCO'));assert.ok(!t.includes('00123'));assert.ok(!t.includes('Sintético'));
});
test('texto largo y antibiograma completo generan páginas numeradas sin truncar hallazgos',async()=>{
  const s=solicitud();s.muestras[0].examenes[0].resultado.observaciones='Hallazgo extendido '.repeat(500)+'FIN_CLINICO';
  const t=texto(await pdf.generarInformePdf(s,s.muestras,instante));assert.ok(t.includes('FIN_CLINICO'));assert.match(t,/Página 2 de/);
});
test('PDF conserva tildes, símbolos clínicos y edad singular',async()=>{
  db.solicitud.paciente.fechaNacimiento=new Date('2026-11-22Z');
  db.solicitud.muestras[0].examenes[0].resultado.colonias='≥10⁵ UFC/mL; ≤20 µm';
  const t=texto((await documentos.documentoSolicitud(1,'informe',ctx)).pdf);
  assert.ok(t.includes('≥10⁵ UFC/mL'));assert.ok(t.includes('≤20 µm'));assert.ok(t.includes('1 día'));assert.ok(!t.includes('1 días'));
});
test('carácter no soportado bloquea emisión en vez de alterar identidad o hallazgos',async()=>{
  db.solicitud.paciente.nombres='漢';
  await assert.rejects(documentos.documentoSolicitud(1,'informe',ctx),e=>e.code==='PDF_CARACTER_NO_SOPORTADO');assert.equal(db.logs.length,0);
});
test('con bandera apagada catálogo no consulta esquema ni tablas nuevas',async()=>{
  assert.deepEqual(await catalogo.catalogoFlujo(),{habilitado:false,tiposMuestra:[],sitios:[],plantillas:[]});assert.equal(llamadas.length,0);
});
test('bandera activa sin esquema bloquea de forma controlada',async()=>{env.ORDENES_ASISTIDAS_HABILITADAS=true;esquema=false;await assert.rejects(catalogo.catalogoFlujo(),e=>e.statusCode===503);});
for(const valor of [{nombre:'A',tiposMuestra:['Exudado']},{nombre:'Sitio\nFalso',tiposMuestra:['Exudado']},{nombre:'Faríngeo',tiposMuestra:[]},{nombre:'Nasal',tiposMuestra:['Exudado'],activo:true}])
  test('validador de sitio rechaza '+JSON.stringify(valor),()=>assert.equal(sitioSchema.safeParse(valor).success,false));
test('sitio normalizado, persistido y reutilizable; duplicado sin acentos devuelve 409',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;const admin={...ctx,usuarioId:4};
  const sitio=await catalogo.crearSitio(sitioSchema.parse({nombre:'  Nasofaríngeo  ',tiposMuestra:['exudado']}),admin);
  assert.equal(db.sitios[0].clave,'nasofaringeo');assert.ok((await catalogo.catalogoFlujo()).sitios.some(s=>s.id===sitio.id));
  await assert.rejects(catalogo.crearSitio({nombre:'Nasofaringeo',tiposMuestra:['Exudado']},admin),e=>e.statusCode===409);
});
test('auxiliar no administra sitios ni mediante acceso directo',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;
  assert.equal((await request('/sitios',{method:'POST',body:{nombre:'Nasal',tiposMuestra:['Exudado']},r:catalogoRouter})).status,403);
});
test('no convierte un material biológico en sitio anatómico',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;
  await assert.rejects(catalogo.crearSitio({nombre:'Orina',tiposMuestra:['Orina']},{...ctx,usuarioId:4}),e=>e.code==='CATEGORIA_ANATOMICA_INVALIDA');
});
test('compatibilidad de sitio y restricción del examen se validan en backend',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;db.sitios=[{id:1,nombre:'Nasal',activo:true,tiposMuestra:['Exudado']}];db.examenes[1].sitiosPermitidos=['faringeo'];
  await assert.rejects(catalogo.prepararExamenesSolicitados(prisma,[{examenId:11,tipoMuestra:'Exudado',sitioAnatomicoId:1}]),e=>e.code==='SITIO_INCOMPATIBLE');
  await assert.rejects(catalogo.prepararExamenesSolicitados(prisma,[{examenId:10,tipoMuestra:'Sangre',sitioAnatomicoId:1}]),e=>e.code==='MUESTRA_INCOMPATIBLE');
});
test('catálogo malformado no convierte un examen restringido en uno sin restricciones',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;db.examenes[0].sitiosPermitidos={sitio:'incorrecto'};
  await assert.rejects(catalogo.prepararExamenesSolicitados(prisma,[{examenId:10,tipoMuestra:'Orina'}]),e=>e.code==='CATALOGO_CLINICO_INVALIDO');
});
test('plantilla guarda solo IDs reales; no diagnósticos ni resultados',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;
  assert.equal(plantillaSchema.safeParse({nombre:'Frecuente',examenIds:[10],diagnostico:'inventado'}).success,false);
  const p=await catalogo.crearPlantilla({nombre:'Selección diaria',examenIds:[10]},ctx);assert.deepEqual(p.examenIds,[10]);
  await assert.rejects(catalogo.crearPlantilla({nombre:'Inexistente',examenIds:[999]},ctx),e=>e.code==='EXAMEN_INVALIDO');
});
test('orden guarda exámenes e instrucciones del catálogo y su auditoría en una transacción',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;db.examenes[0].instruccionesToma='Instrucción autorizada en catálogo';
  await ordenes.crearSolicitud(crearSolicitudSchema.parse({pacienteId:9,examenesSolicitados:[{examenId:10,tipoMuestra:'Orina'}]}),ctx);
  assert.equal(db.lineas[0].instruccionesToma,'Instrucción autorizada en catálogo');assert.deepEqual(db.logs[0].detalle.examenIds,[10]);
});
test('no acepta instrucciones inyectadas ni exámenes repetidos',()=>{
  for(const items of [[{examenId:10,tipoMuestra:'Orina',instruccionesToma:'Inventada'}],[{examenId:10,tipoMuestra:'Orina'},{examenId:10,tipoMuestra:'Orina'}]])
    assert.equal(crearSolicitudSchema.safeParse({pacienteId:9,examenesSolicitados:items}).success,false);
});
test('muestra de la orden conserva códigos y solo admite sus exámenes; repetición conflictiva',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;db.lineas=[{examenId:10,tipoMuestra:'Orina',sitioAnatomicoId:null}];
  const input={solicitudId:1,tipoMuestra:'Orina',fechaToma:instante,examenIds:[10]};
  const m=await muestras.registrarMuestra(input,ctx,'AUXILIAR');assert.match(m.codigoBarras,/^M\d{6}-[A-Z0-9]{6}$/);assert.deepEqual(m.examenes.map(e=>e.examenId),[10]);
  db.asignados=1;await assert.rejects(muestras.registrarMuestra(input,ctx,'AUXILIAR'),e=>e.statusCode===409);
});
test('fallo de auditoría revierte la orden nueva',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;auditoriaFalla=true;
  await assert.rejects(ordenes.crearSolicitud(crearSolicitudSchema.parse({pacienteId:9,examenesSolicitados:[{examenId:10,tipoMuestra:'Orina'}]}),ctx));
  assert.equal(db.lineas.length,0);assert.equal(db.solicitud.id,1);
});
test('recorrido integrado offline: paciente existente → orden → muestra → procesamiento → resultado → doble firma → informe',async()=>{
  env.ORDENES_ASISTIDAS_HABILITADAS=true;
  const orden=await ordenes.crearSolicitud(crearSolicitudSchema.parse({pacienteId:9,examenesSolicitados:[{examenId:10,tipoMuestra:'Orina'}]}),ctx);
  const m=await muestras.registrarMuestra({solicitudId:orden.id,tipoMuestra:'Orina',fechaToma:instante,examenIds:[10]},ctx,'AUXILIAR');
  await muestras.receptarMuestra(m.id,ctx,'AUXILIAR');
  await muestras.iniciarProcesamiento(m.id,{...ctx,usuarioId:2},'BACTERIOLOGO');
  const r=await resultados.registrarResultado({muestraExamenId:m.examenes[0].id,observaciones:'Hallazgo introducido por el profesional de prueba',antibiograma:[]},{...ctx,usuarioId:2});
  await assert.rejects(resultados.validarResultado(r.id,ctx,r.updatedAt.toISOString()),e=>e.statusCode===403);
  await assert.rejects(resultados.validarResultado(r.id,{...ctx,usuarioId:2},r.updatedAt.toISOString()),e=>e.code==='DOBLE_FIRMA_VIOLADA');
  const firmado=await resultados.validarResultado(r.id,{...ctx,usuarioId:3},r.updatedAt.toISOString());assert.equal(firmado.estado,'VALIDADO');
  const t=texto((await documentos.documentoSolicitud(orden.id,'informe',ctx)).pdf);
  assert.ok(t.includes(orden.codigo));assert.ok(t.includes(m.codigoBarras));assert.ok(t.includes('Hallazgo introducido por el profesional de prueba'));
  for(const accion of ['CREAR','REGISTRAR','RECEPTAR','INICIAR_PROCESAMIENTO','COMPLETAR_PROCESAMIENTO','VALIDAR','EMITIR_INFORME'])assert.ok(db.logs.some(l=>l.accion===accion),accion);
});
