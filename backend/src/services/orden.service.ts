import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuditContext, Paginado } from '../types/dto';
import { AppError } from '../types/errors';
import type {
  CrearSolicitudInput,
  ListarSolicitudesQuery,
} from '../validators/orden.validator';
import { registrarLog } from './auditoria.service';

const MAX_REINTENTOS_CODIGO = 3;

const solicitudInclude = {
  paciente: true,
  registradoPor: { select: { id: true, username: true, nombreCompleto: true } },
  muestras: {
    include: { examenes: { include: { examen: { select: { id: true, codigo: true, nombre: true } } } } },
    orderBy: { fechaToma: 'asc' },
  },
} satisfies Prisma.SolicitudInclude;

/** Calcula el siguiente código SOL-AAAA-NNNNNN del año en curso. */
async function siguienteCodigo(tx: Prisma.TransactionClient): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `SOL-${anio}-`;
  const ultima = await tx.solicitud.findFirst({
    where: { codigo: { startsWith: prefijo } },
    orderBy: { codigo: 'desc' },
    select: { codigo: true },
  });
  const secuencia = ultima ? Number(ultima.codigo.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(secuencia).padStart(6, '0')}`;
}

function esColisionDeCodigo(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    String(error.meta?.target ?? '').includes('codigo')
  );
}

/**
 * Crea la solicitud con un código correlativo. Dos recepcionistas creando a la
 * vez pueden calcular el mismo número: el UNIQUE de BD rechaza el segundo y
 * aquí se reintenta la transacción completa con un número nuevo.
 */
export async function crearSolicitud(input: CrearSolicitudInput, ctx: AuditContext) {
  for (let intento = 1; intento <= MAX_REINTENTOS_CODIGO; intento += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const paciente = await tx.paciente.findUnique({
          where: { id: input.pacienteId },
          select: { id: true },
        });
        if (!paciente) {
          throw new AppError(404, 'El paciente no existe.', 'PACIENTE_NO_ENCONTRADO');
        }

        const solicitud = await tx.solicitud.create({
          data: {
            codigo: await siguienteCodigo(tx),
            pacienteId: input.pacienteId,
            usuarioIdRegistra: ctx.usuarioId,
            medicoSolicitante: input.medicoSolicitante,
            diagnosticoPresuntivo: input.diagnosticoPresuntivo,
            prioridad: input.prioridad,
            observaciones: input.observaciones,
          },
          include: solicitudInclude,
        });

        await registrarLog(tx, {
          usuarioId: ctx.usuarioId,
          entidad: 'SOLICITUD',
          entidadId: solicitud.id,
          accion: 'CREAR',
          detalle: { codigo: solicitud.codigo, pacienteId: input.pacienteId },
          ip: ctx.ip,
        });

        return solicitud;
      });
    } catch (error) {
      if (esColisionDeCodigo(error) && intento < MAX_REINTENTOS_CODIGO) {
        continue;
      }
      throw error;
    }
  }
  // Inalcanzable: el último intento siempre retorna o lanza. Satisface noImplicitReturns.
  throw new AppError(500, 'No fue posible generar el código de la solicitud.', 'CODIGO_NO_GENERADO');
}

export async function listarSolicitudes(filtros: ListarSolicitudesQuery) {
  const where: Prisma.SolicitudWhereInput = {
    ...(filtros.pacienteId ? { pacienteId: filtros.pacienteId } : {}),
    ...(filtros.prioridad ? { prioridad: filtros.prioridad } : {}),
    ...(filtros.cedula ? { paciente: { cedula: { contains: filtros.cedula } } } : {}),
    ...(filtros.desde || filtros.hasta
      ? {
          fechaSolicitud: {
            ...(filtros.desde ? { gte: filtros.desde } : {}),
            ...(filtros.hasta ? { lte: filtros.hasta } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.solicitud.findMany({
      where,
      include: {
        paciente: { select: { id: true, cedula: true, nombres: true, apellidos: true } },
        _count: { select: { muestras: true } },
      },
      orderBy: { fechaSolicitud: 'desc' },
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.solicitud.count({ where }),
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

export async function obtenerSolicitudPorId(id: number) {
  const solicitud = await prisma.solicitud.findUnique({ where: { id }, include: solicitudInclude });
  if (!solicitud) {
    throw new AppError(404, 'La solicitud no existe.', 'SOLICITUD_NO_ENCONTRADA');
  }
  return solicitud;
}

/** Catálogo de exámenes activos para los formularios de registro de muestras. */
export async function listarExamenes() {
  return prisma.examen.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
  });
}
