import { randomInt } from 'node:crypto';
import { EstadoMuestra, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { RolNombre } from '../types/auth';
import type { AuditContext, EventoTrazabilidad, Paginado } from '../types/dto';
import { AppError } from '../types/errors';
import type {
  ListarMuestrasQuery,
  RegistrarMuestraInput,
} from '../validators/muestra.validator';
import { obtenerHistorial, registrarLog } from './auditoria.service';

/** Datos livianos para tablas densas (sin antibiograma ni resultados completos). */
const muestraListaInclude = {
  solicitud: {
    select: {
      id: true,
      codigo: true,
      prioridad: true,
      paciente: { select: { id: true, cedula: true, nombres: true, apellidos: true } },
    },
  },
  examenes: { select: { id: true, examen: { select: { id: true, codigo: true, nombre: true } } } },
} satisfies Prisma.MuestraInclude;

/** Solo los roles clínicos autorizados consultan la relación de resultados. */
function muestraDetalleInclude(rol: RolNombre) {
  const puedeVerResultados = ['BACTERIOLOGO', 'VALIDADOR', 'ADMINISTRADOR'].includes(rol);
  return {
    solicitud: { include: { paciente: true } },
    recepcionadoPor: { select: { id: true, username: true, nombreCompleto: true } },
    examenes: {
      include: {
        examen: true,
        ...(puedeVerResultados
          ? { resultado: { include: { antibiograma: { orderBy: { antibiotico: 'asc' as const } } } } }
          : {}),
      },
    },
  } satisfies Prisma.MuestraInclude;
}

/**
 * Máquina de estados de la muestra:
 *
 *   REGISTRADA ──receptar──▶ RECEPTADA ──procesar──▶ EN_PROCESAMIENTO ──(todos los
 *       │                       │                       resultados cargados)──▶ PROCESADA
 *       └──────rechazar─────────┴──▶ RECHAZADA (exige motivo)
 *
 * El paso EN_PROCESAMIENTO → PROCESADA lo ejecuta resultado.service al cargar
 * el último resultado pendiente de la muestra.
 */

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1: evita confusión al leer la etiqueta

/** Formato: M + AAMMDD + - + 6 caracteres (p. ej. M260714-K7QX2P). Cumple ck_muestras_codigo_barras. */
function generarCodigoBarras(): string {
  const fecha = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  let sufijo = '';
  for (let i = 0; i < 6; i += 1) {
    sufijo += ALFABETO_CODIGO.charAt(randomInt(ALFABETO_CODIGO.length));
  }
  return `M${fecha}-${sufijo}`;
}

export async function registrarMuestra(input: RegistrarMuestraInput, ctx: AuditContext, rol: RolNombre) {
  return prisma.$transaction(async (tx) => {
    const solicitud = await tx.solicitud.findUnique({
      where: { id: input.solicitudId },
      select: { id: true },
    });
    if (!solicitud) {
      throw new AppError(404, 'La solicitud indicada no existe.', 'SOLICITUD_NO_ENCONTRADA');
    }

    const examenes = await tx.examen.findMany({
      where: { id: { in: input.examenIds }, activo: true },
      select: { id: true },
    });
    if (examenes.length !== input.examenIds.length) {
      throw new AppError(
        422,
        'Alguno de los exámenes no existe o está inactivo.',
        'EXAMEN_INVALIDO',
      );
    }

    // La unicidad real la garantiza el UNIQUE de BD; este bucle solo evita el reintento manual.
    let codigoBarras = generarCodigoBarras();
    while (await tx.muestra.findUnique({ where: { codigoBarras }, select: { id: true } })) {
      codigoBarras = generarCodigoBarras();
    }

    const muestra = await tx.muestra.create({
      data: {
        codigoBarras,
        solicitudId: input.solicitudId,
        tipoMuestra: input.tipoMuestra,
        sitioAnatomico: input.sitioAnatomico,
        fechaToma: input.fechaToma,
        examenes: { create: input.examenIds.map((examenId) => ({ examenId })) },
      },
      include: muestraDetalleInclude(rol),
    });

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'MUESTRA',
      entidadId: muestra.id,
      accion: 'REGISTRAR',
      estadoNuevo: muestra.estado,
      detalle: { codigoBarras, examenIds: input.examenIds },
      ip: ctx.ip,
    });

    return muestra;
  });
}

export async function listarMuestras(filtros: ListarMuestrasQuery) {
  const where: Prisma.MuestraWhereInput = {
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.codigoBarras ? { codigoBarras: { contains: filtros.codigoBarras.toUpperCase() } } : {}),
    ...(filtros.cedula ? { solicitud: { paciente: { cedula: { contains: filtros.cedula } } } } : {}),
    ...(filtros.desde || filtros.hasta
      ? {
          fechaToma: {
            ...(filtros.desde ? { gte: filtros.desde } : {}),
            ...(filtros.hasta ? { lte: filtros.hasta } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.muestra.findMany({
      where,
      include: muestraListaInclude,
      orderBy: { fechaToma: 'desc' },
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.muestra.count({ where }),
  ]);

  const respuesta: Paginado<(typeof data)[number]> = {
    data,
    total,
    page: filtros.page,
    pageSize: filtros.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filtros.pageSize)),
  };
  return respuesta;
}

export async function obtenerMuestraPorId(id: number, rol: RolNombre) {
  const muestra = await prisma.muestra.findUnique({ where: { id }, include: muestraDetalleInclude(rol) });
  if (!muestra) {
    throw new AppError(404, 'La muestra no existe.', 'MUESTRA_NO_ENCONTRADA');
  }
  return muestra;
}

/** Búsqueda por lectura de código de barras (índice UNIQUE → O(log n)). */
export async function obtenerMuestraPorCodigoBarras(codigoBarras: string, rol: RolNombre) {
  const muestra = await prisma.muestra.findUnique({
    where: { codigoBarras },
    include: muestraDetalleInclude(rol),
  });
  if (!muestra) {
    throw new AppError(404, 'No existe una muestra con ese código de barras.', 'MUESTRA_NO_ENCONTRADA');
  }
  return muestra;
}

export async function obtenerTrazabilidadMuestra(id: number): Promise<EventoTrazabilidad[]> {
  const existe = await prisma.muestra.findUnique({ where: { id }, select: { id: true } });
  if (!existe) {
    throw new AppError(404, 'La muestra no existe.', 'MUESTRA_NO_ENCONTRADA');
  }
  return obtenerHistorial('MUESTRA', id);
}

interface Transicion {
  id: number;
  desde: EstadoMuestra[];
  hasta: EstadoMuestra;
  accion: string;
  ctx: AuditContext;
  rol: RolNombre;
  /** Campos adicionales a escribir; recibe la fecha de recepción actual por si ya existe. */
  datos: (actual: { fechaRecepcion: Date | null }) => Prisma.MuestraUncheckedUpdateManyInput;
  detalle?: Prisma.InputJsonValue;
}

/**
 * Cambio de estado atómico y a prueba de concurrencia:
 *  1. Lee el estado actual y valida que la transición sea legal.
 *  2. `updateMany` con `estado` en el WHERE: si otro usuario cambió la muestra
 *     entre el paso 1 y el 2, count = 0 y se aborta (bloqueo optimista).
 *  3. Registra la auditoría en la misma transacción.
 */
async function transicionar({ id, desde, hasta, accion, ctx, rol, datos, detalle }: Transicion) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.muestra.findUnique({
      where: { id },
      select: { estado: true, fechaRecepcion: true },
    });
    if (!actual) {
      throw new AppError(404, 'La muestra no existe.', 'MUESTRA_NO_ENCONTRADA');
    }
    if (!desde.includes(actual.estado)) {
      throw new AppError(
        409,
        `No es posible ejecutar "${accion}" sobre una muestra en estado ${actual.estado}.`,
        'TRANSICION_INVALIDA',
        { estadoActual: actual.estado, estadosPermitidos: desde },
      );
    }

    const { count } = await tx.muestra.updateMany({
      where: { id, estado: actual.estado },
      data: { estado: hasta, ...datos({ fechaRecepcion: actual.fechaRecepcion }) },
    });
    if (count !== 1) {
      throw new AppError(
        409,
        'La muestra fue modificada por otro usuario. Actualice e intente de nuevo.',
        'CONFLICTO_CONCURRENCIA',
      );
    }

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'MUESTRA',
      entidadId: id,
      accion,
      estadoAnterior: actual.estado,
      estadoNuevo: hasta,
      detalle,
      ip: ctx.ip,
    });

    return tx.muestra.findUniqueOrThrow({ where: { id }, include: muestraDetalleInclude(rol) });
  });
}

export function receptarMuestra(id: number, ctx: AuditContext, rol: RolNombre) {
  return transicionar({
    id,
    ctx,
    rol,
    desde: [EstadoMuestra.REGISTRADA],
    hasta: EstadoMuestra.RECEPTADA,
    accion: 'RECEPTAR',
    datos: () => ({ fechaRecepcion: new Date(), usuarioIdRecepciona: ctx.usuarioId }),
  });
}

export function iniciarProcesamiento(id: number, ctx: AuditContext, rol: RolNombre) {
  return transicionar({
    id,
    ctx,
    rol,
    desde: [EstadoMuestra.RECEPTADA],
    hasta: EstadoMuestra.EN_PROCESAMIENTO,
    accion: 'INICIAR_PROCESAMIENTO',
    datos: () => ({ fechaProcesamiento: new Date() }),
  });
}

/**
 * Rechazo con motivo. Si la muestra aún no se había receptado, el rechazo
 * ocurre en el mesón de recepción: se completan fecha y usuario de recepción
 * para cumplir ck_muestras_recepcion (estado ≠ REGISTRADA ⇒ fecha_recepcion).
 */
export function rechazarMuestra(id: number, motivoRechazo: string, ctx: AuditContext, rol: RolNombre) {
  return transicionar({
    id,
    ctx,
    rol,
    desde: [EstadoMuestra.REGISTRADA, EstadoMuestra.RECEPTADA],
    hasta: EstadoMuestra.RECHAZADA,
    accion: 'RECHAZAR',
    detalle: { motivoRechazo },
    datos: (actual) => ({
      motivoRechazo,
      ...(actual.fechaRecepcion
        ? {}
        : { fechaRecepcion: new Date(), usuarioIdRecepciona: ctx.usuarioId }),
    }),
  });
}
