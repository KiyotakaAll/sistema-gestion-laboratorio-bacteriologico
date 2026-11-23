import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { normalizarCatalogo, sitioCompatible, tipoCompatible, listaTextos } from '../domain/catalogo-clinico';
import type { TxClient, AuditContext } from '../types/dto';
import { AppError } from '../types/errors';
import { registrarLog } from './auditoria.service';
import { exigirPermisoClinico, transaccionClinica } from './flujo-clinico.service';
import type { z } from 'zod';
import type { sitioSchema, plantillaSchema, examenSolicitadoSchema } from '../validators/catalogo.validator';

export const ordenesAsistidasActivas = () => env.ORDENES_ASISTIDAS_HABILITADAS === true;

/** Proyección explícita: el cliente nuevo sigue funcionando contra el esquema antiguo. */
export const seleccionExamen = () => ({ id: true, codigo: true, nombre: true,
  tipoMuestraRequerida: true, descripcion: true, precio: true, activo: true,
  ...(ordenesAsistidasActivas() ? { instruccionesToma: true, sitiosPermitidos: true } as const : {}),
} as const);

export async function exigirOrdenesAsistidas(cliente: Pick<TxClient, '$queryRaw'> = prisma) {
  if (!ordenesAsistidasActivas()) throw new AppError(503,
    'El flujo asistido requiere activar su migración y bandera.', 'ORDENES_NO_DISPONIBLES');
  const filas = await cliente.$queryRaw<{ tabla: string; columna: string }[]>`
    SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN
    ('solicitudes_examenes','sitios_anatomicos','plantillas_examenes','examenes')`;
  const campos: Record<string, string[]> = {
    solicitudes_examenes: ['id','solicitud_id','examen_id','tipo_muestra','sitio_anatomico_id','sitio_anatomico','instrucciones_toma'],
    sitios_anatomicos: ['id','nombre','clave','tipos_muestra','activo'],
    plantillas_examenes: ['id','nombre','clave','examen_ids','activo'],
    examenes: ['instrucciones_toma','sitios_permitidos'],
  };
  if (!Object.entries(campos).every(([tabla, columnas]) => columnas.every(columna =>
    filas.some(f => f.tabla === tabla && f.columna === columna)))) {
    throw new AppError(503, 'Falta preparar el esquema de órdenes y catálogos.', 'ORDENES_ESQUEMA_PENDIENTE');
  }
}

export async function catalogoFlujo() {
  if (!ordenesAsistidasActivas()) return { habilitado: false, tiposMuestra: [], sitios: [], plantillas: [] };
  await exigirOrdenesAsistidas();
  const [examenes, sitios, plantillas] = await Promise.all([
    prisma.examen.findMany({ where: { activo: true }, select: { tipoMuestraRequerida: true } }),
    prisma.sitioAnatomico.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, tiposMuestra: true } }),
    prisma.plantillaExamenes.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, examenIds: true } }),
  ]);
  const tiposMuestra = [...new Set(examenes.map(e => e.tipoMuestraRequerida))]
    .filter(t => normalizarCatalogo(t) !== 'variable');
  return { habilitado: true, tiposMuestra, sitios, plantillas };
}

function duplicado(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    throw new AppError(409, 'Ya existe una opción con ese nombre.', 'CATALOGO_DUPLICADO');
  throw error;
}

export async function crearSitio(input: z.infer<typeof sitioSchema>, ctx: AuditContext) {
  await exigirOrdenesAsistidas();
  try {
    return await transaccionClinica(async tx => {
      await exigirPermisoClinico(tx, ctx, 'usuarios.administrar');
      const tipos = await tx.examen.findMany({ where: { activo: true }, select: { tipoMuestraRequerida: true } });
      const canonicos = input.tiposMuestra.map(t => tipos.find(e => normalizarCatalogo(e.tipoMuestraRequerida) === normalizarCatalogo(t))?.tipoMuestraRequerida);
      if (canonicos.some(t => !t || normalizarCatalogo(t) === 'variable'))
        throw new AppError(422, 'Seleccione tipos de muestra existentes en el catálogo.', 'TIPO_MUESTRA_INVALIDO');
      const clave = normalizarCatalogo(input.nombre);
      if (['orina','sangre','esputo','heces','exudado','secrecion','liquido cefalorraquideo','variable'].includes(clave))
        throw new AppError(422, 'Ese término es un material o tipo de muestra, no un sitio anatómico.', 'CATEGORIA_ANATOMICA_INVALIDA');
      const sitio = await tx.sitioAnatomico.create({ data: { nombre: input.nombre, clave,
        tiposMuestra: [...new Set(canonicos as string[])] }, select: { id: true, nombre: true, tiposMuestra: true } });
      await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'CATALOGO', entidadId: sitio.id,
        accion: 'CREAR_SITIO', detalle: { nombre: sitio.nombre, tiposMuestra: sitio.tiposMuestra }, ip: ctx.ip });
      return sitio;
    });
  } catch (e) { return duplicado(e); }
}

export async function crearPlantilla(input: z.infer<typeof plantillaSchema>, ctx: AuditContext) {
  await exigirOrdenesAsistidas();
  try {
    return await transaccionClinica(async tx => {
      await exigirPermisoClinico(tx, ctx, 'solicitudes.escribir');
      const n = await tx.examen.count({ where: { id: { in: input.examenIds }, activo: true } });
      if (n !== input.examenIds.length) throw new AppError(422, 'La selección contiene exámenes inactivos o inexistentes.', 'EXAMEN_INVALIDO');
      const plantilla = await tx.plantillaExamenes.create({ data: { nombre: input.nombre,
        clave: normalizarCatalogo(input.nombre), examenIds: input.examenIds },
        select: { id: true, nombre: true, examenIds: true } });
      await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'CATALOGO', entidadId: plantilla.id,
        accion: 'CREAR_PLANTILLA', detalle: { examenIds: input.examenIds }, ip: ctx.ip });
      return plantilla;
    });
  } catch (e) { return duplicado(e); }
}

export async function prepararExamenesSolicitados(tx: TxClient, items: z.infer<typeof examenSolicitadoSchema>[]) {
  const examenes = await tx.examen.findMany({ where: { id: { in: items.map(i => i.examenId) }, activo: true }, select: seleccionExamen() });
  const tipos = await tx.examen.findMany({ where: { activo: true }, select: { tipoMuestraRequerida: true } });
  return Promise.all(items.map(async item => {
    const examen = examenes.find(e => e.id === item.examenId);
    if (!examen) throw new AppError(422, 'Algún examen no existe o está inactivo.', 'EXAMEN_INVALIDO');
    if (!tipoCompatible(examen.tipoMuestraRequerida, item.tipoMuestra))
      throw new AppError(422, 'El tipo de muestra no corresponde al examen.', 'MUESTRA_INCOMPATIBLE');
    const canonico = tipos.find(t => normalizarCatalogo(t.tipoMuestraRequerida) !== 'variable' && normalizarCatalogo(t.tipoMuestraRequerida) === normalizarCatalogo(item.tipoMuestra));
    if (!canonico)
      throw new AppError(422, 'El tipo de muestra no está en el catálogo.', 'TIPO_MUESTRA_INVALIDO');
    const sitio = item.sitioAnatomicoId ? await tx.sitioAnatomico.findUnique({ where: { id: item.sitioAnatomicoId } }) : null;
    if (examen.sitiosPermitidos != null && (!Array.isArray(examen.sitiosPermitidos)
      || !examen.sitiosPermitidos.length || examen.sitiosPermitidos.some(v => typeof v !== 'string' || !v.trim())))
      throw new AppError(503, 'El catálogo del examen requiere revisar sus sitios permitidos.', 'CATALOGO_CLINICO_INVALIDO');
    const permitidos = listaTextos(examen.sitiosPermitidos);
    if ((item.sitioAnatomicoId && !sitio?.activo) || (sitio && !sitioCompatible(sitio.tiposMuestra, item.tipoMuestra))
      || (permitidos.length && (!sitio || !permitidos.includes(normalizarCatalogo(sitio.nombre))))
      || (['exudado','secrecion'].includes(normalizarCatalogo(item.tipoMuestra)) && !sitio))
      throw new AppError(422, 'Seleccione un sitio anatómico compatible con el examen y la muestra.', 'SITIO_INCOMPATIBLE');
    return { examenId: examen.id, tipoMuestra: canonico.tipoMuestraRequerida,
      sitioAnatomicoId: sitio?.id ?? null, sitioAnatomico: sitio?.nombre ?? null,
      instruccionesToma: examen.instruccionesToma ?? null };
  }));
}
