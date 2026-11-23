import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { esRolConocido, type Permiso } from '../domain/permisos';
import type { AuditContext, TxClient } from '../types/dto';
import { AppError } from '../types/errors';
import { puedeRol } from './permisos.service';

export function conflictoClinico(): never {
  throw new AppError(409, 'El registro cambió. Actualice los datos y revise los cambios antes de continuar.', 'CONFLICTO_CONCURRENCIA');
}

/** READ COMMITTED evita conservar una fotografía anterior a la espera del bloqueo. */
export async function transaccionClinica<T>(operacion: (tx: TxClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(operacion, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2028' ||
        (error.code === 'P2010' && ['1205', '1213'].includes(String(error.meta?.code))))) conflictoClinico();
    throw error;
  }
}

/** Orden de bloqueo para todas las escrituras: cuenta → muestra → resultado. */
export async function exigirPermisoClinico(tx: TxClient, ctx: AuditContext, permiso: Permiso) {
  await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${ctx.usuarioId} FOR SHARE`;
  const usuario = await tx.usuario.findUnique({ where: { id: ctx.usuarioId },
    select: { activo: true, eliminadoAt: true, rol: { select: { nombre: true } } } });
  if (!usuario?.activo || usuario.eliminadoAt || !esRolConocido(usuario.rol.nombre) || !puedeRol(usuario.rol.nombre, permiso)) {
    throw new AppError(403, 'La cuenta vigente no autoriza esta operación clínica.',
      permiso === 'resultados.validar' ? 'FIRMA_PROFESIONAL_REQUERIDA' : 'PERMISO_CLINICO_REQUERIDO');
  }
  return usuario.rol.nombre;
}

/** Serializa también resultados de exámenes distintos de la misma muestra. */
export async function bloquearMuestra(tx: TxClient, id: number) {
  await tx.$queryRaw`SELECT id FROM muestras WHERE id = ${id} FOR UPDATE`;
}

export function exigirVersion(actual: Date, esperada: string | undefined): void {
  if (!esperada || !Number.isFinite(Date.parse(esperada))) {
    throw new AppError(400, 'Debe enviar la fecha de actualización del resultado revisado.', 'VERSION_REQUERIDA');
  }
  if (actual.getTime() !== Date.parse(esperada)) conflictoClinico();
}

/** updated_at ya es DATETIME(3); incluso dos escrituras en el mismo ms cambian la versión. */
export function siguienteVersion(actual: Date): Date {
  return new Date(Math.max(Date.now(), actual.getTime() + 1));
}
