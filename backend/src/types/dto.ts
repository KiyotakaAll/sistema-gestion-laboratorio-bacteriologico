import type { Prisma } from '@prisma/client';

/**
 * Cliente que recibe el callback de `prisma.$transaction(async (tx) => ...)`.
 * Los servicios auxiliares (p. ej. auditoría) lo reciben por parámetro para
 * participar en la MISMA transacción: si el cambio de estado falla, el log
 * también se revierte, y viceversa.
 */
export type TxClient = Prisma.TransactionClient;

/** Contexto de quien ejecuta la operación; se propaga a la auditoría. */
export interface AuditContext {
  usuarioId: number;
  ip: string | null;
}

/** Respuesta paginada estándar de los listados. */
export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Entrada del historial de trazabilidad (BigInt convertido a number para JSON). */
export interface EventoTrazabilidad {
  id: number;
  accion: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  detalle: unknown;
  fechaEvento: Date;
  usuario: { id: number; username: string; nombreCompleto: string } | null;
}
