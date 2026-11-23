import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuditContext, TxClient } from '../types/dto';
import { AppError } from '../types/errors';
import type { DatosMedicoInput, ListarMedicosQuery } from '../validators/medico.validator';
import { registrarLog } from './auditoria.service';
import { exigirDirectorioMedicos } from './medicos-disponibilidad';

export const seleccionMedico = {
  id: true, nombres: true, apellidos: true, registroProfesional: true, especialidad: true,
  telefono: true, email: true, institucion: true, activo: true, createdAt: true, updatedAt: true,
} as const;

function claveDuplicado(input: DatosMedicoInput): string | null {
  // Dos homónimos sin contacto se permiten. La huella incluye TODOS los datos de la ficha.
  if (!input.email && !input.telefono) return null;
  const campos = ['nombres', 'apellidos', 'registroProfesional', 'especialidad', 'telefono', 'email', 'institucion'] as const;
  const canonico = campos.map(k => k === 'telefono' ? input[k]?.replace(/\D/g, '') ?? null
    : input[k]?.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es') ?? null);
  return createHash('sha256').update(JSON.stringify(canonico)).digest('hex');
}

async function operacion<T>(fn: () => Promise<T>): Promise<T> {
  await exigirDirectorioMedicos();
  try { return await fn(); }
  catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new AppError(409, 'Ya existe ese registro profesional o una ficha idéntica con contacto. Revise también los inactivos.', 'MEDICO_DUPLICADO');
    throw new AppError(503, 'No se pudo completar la operación del directorio.', 'MEDICOS_NO_DISPONIBLES');
  }
}

export function listarMedicos(f: ListarMedicosQuery) {
  return operacion(() => prisma.$transaction(async tx => {
    const palabras = f.q?.split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.MedicoRemitenteWhereInput = {
      ...(f.estado !== 'todos' ? { activo: f.estado === 'activos' } : {}),
      ...(palabras.length ? { AND: palabras.map(q => ({ OR: [
        { nombres: { contains: q } }, { apellidos: { contains: q } },
        { registroProfesional: { contains: q.toUpperCase() } }, { institucion: { contains: q } },
      ] })) } : {}),
    };
    const total = await tx.medicoRemitente.count({ where });
    const data = await tx.medicoRemitente.findMany({ where, select: seleccionMedico,
      skip: (f.page - 1) * f.pageSize, take: f.pageSize, orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }, { id: 'asc' }] });
    return { data, total, page: f.page, pageSize: f.pageSize, totalPages: Math.max(1, Math.ceil(total / f.pageSize)) };
  }));
}

export async function obtenerMedicoTx(tx: TxClient, id: number) {
  const m = await tx.medicoRemitente.findUnique({ where: { id }, select: seleccionMedico });
  if (!m) throw new AppError(404, 'El médico no existe.', 'MEDICO_NO_ENCONTRADO');
  return m;
}
export function obtenerMedico(id: number) { return operacion(() => obtenerMedicoTx(prisma, id)); }

export function guardarMedico(id: number | null, input: DatosMedicoInput, ctx: AuditContext) {
  return operacion(() => prisma.$transaction(async tx => {
    if (id !== null) await obtenerMedicoTx(tx, id);
    const data = { ...input, claveDuplicado: claveDuplicado(input) };
    const medico = id === null
      ? await tx.medicoRemitente.create({ data, select: seleccionMedico })
      : await tx.medicoRemitente.update({ where: { id }, data, select: seleccionMedico });
    await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'MEDICO', entidadId: medico.id,
      accion: id === null ? 'CREAR' : 'ACTUALIZAR', ip: ctx.ip });
    return medico;
  }));
}

export function cambiarEstadoMedico(id: number, activo: boolean, ctx: AuditContext) {
  return operacion(() => prisma.$transaction(async tx => {
    await obtenerMedicoTx(tx, id);
    const medico = await tx.medicoRemitente.update({ where: { id }, data: { activo }, select: seleccionMedico });
    await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'MEDICO', entidadId: id,
      accion: activo ? 'ACTIVAR' : 'DESACTIVAR', ip: ctx.ip });
    return medico;
  }));
}

/** Bloquea la fila hasta confirmar la solicitud: una desactivación concurrente debe esperar. */
export async function medicoActivoParaSolicitud(tx: TxClient, id: number) {
  const filas = await tx.$queryRaw<{ id: number; nombres: string; apellidos: string; activo: boolean | number }[]>`
    SELECT id, nombres, apellidos, activo FROM medicos_remitentes WHERE id = ${id} FOR UPDATE`;
  const medico = filas[0];
  if (!medico) throw new AppError(404, 'El médico no existe.', 'MEDICO_NO_ENCONTRADO');
  if (!medico.activo) throw new AppError(409, 'El médico está inactivo. Seleccione otro registro.', 'MEDICO_INACTIVO');
  // $queryRaw puede devolver INT UNSIGNED como bigint; el ID buscado ya es UInt32 validado.
  return { medicoRemitenteId: id, medicoRemitenteNombre: `${medico.nombres} ${medico.apellidos}` };
}
