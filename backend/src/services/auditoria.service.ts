import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { EventoTrazabilidad, TxClient } from '../types/dto';

export interface RegistroLog {
  usuarioId: number | null;
  entidad: 'MUESTRA' | 'RESULTADO' | 'USUARIO' | 'PACIENTE' | 'SOLICITUD';
  entidadId: number;
  accion: string;
  estadoAnterior?: string | null;
  estadoNuevo?: string | null;
  detalle?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Inserta un evento de auditoría usando el cliente de la transacción en curso
 * (`tx`). Decisión: NUNCA usa el `prisma` global; así el log y el cambio de
 * estado se confirman o se revierten juntos y la trazabilidad no puede quedar
 * desincronizada con los datos.
 */
export async function registrarLog(tx: TxClient, registro: RegistroLog): Promise<void> {
  await tx.logAuditoria.create({
    data: {
      usuarioId: registro.usuarioId,
      entidad: registro.entidad,
      entidadId: registro.entidadId,
      accion: registro.accion,
      estadoAnterior: registro.estadoAnterior ?? null,
      estadoNuevo: registro.estadoNuevo ?? null,
      detalle: registro.detalle,
      ipOrigen: registro.ip ?? null,
    },
  });
}

/** Historial cronológico de una entidad (trazabilidad de una muestra o resultado). */
export async function obtenerHistorial(
  entidad: RegistroLog['entidad'],
  entidadId: number,
): Promise<EventoTrazabilidad[]> {
  const eventos = await prisma.logAuditoria.findMany({
    where: { entidad, entidadId },
    orderBy: { fechaEvento: 'asc' },
    include: { usuario: { select: { id: true, username: true, nombreCompleto: true } } },
  });

  // `id` es BigInt en BD y JSON.stringify no sabe serializar BigInt: se convierte aquí.
  return eventos.map((evento) => ({
    id: Number(evento.id),
    accion: evento.accion,
    estadoAnterior: evento.estadoAnterior,
    estadoNuevo: evento.estadoNuevo,
    detalle: evento.detalle,
    fechaEvento: evento.fechaEvento,
    usuario: evento.usuario,
  }));
}
