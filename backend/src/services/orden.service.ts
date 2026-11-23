import { exigirDirectorioMedicos, seleccionSolicitudBase } from './medicos-disponibilidad';
import { medicoActivoParaSolicitud } from './medico.service';
import { seleccionPaciente, seleccionPacienteResumen, filtroDocumento } from './identificacion-paciente';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuditContext, Paginado } from '../types/dto';
import { AppError } from '../types/errors';
import type {
  CrearSolicitudInput,
  ListarSolicitudesQuery,
} from '../validators/orden.validator';
import { registrarLog } from './auditoria.service';
import { exigirOrdenesAsistidas, ordenesAsistidasActivas, prepararExamenesSolicitados, seleccionExamen } from './catalogo.service';
import { exigirPermisoClinico } from './flujo-clinico.service';

const MAX_REINTENTOS_CODIGO = 3;

const solicitudSelect = async () => ({
  ...await seleccionSolicitudBase(),
  paciente: { select: seleccionPaciente() },
  registradoPor: { select: { id: true, username: true, nombreCompleto: true } },
  ...(ordenesAsistidasActivas() ? { examenesSolicitados: { include: { examen: { select: seleccionExamen() } } } } : {}),
  muestras: {
    include: { examenes: { include: { examen: { select: { id: true, codigo: true, nombre: true } } } } },
    orderBy: { fechaToma: 'asc' },
  },
}) satisfies Prisma.SolicitudSelect;

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
  if (ordenesAsistidasActivas() && !input.examenesSolicitados?.length)
    throw new AppError(422, 'Seleccione al menos un examen para la orden.', 'EXAMENES_ORDEN_REQUERIDOS');
  if (input.examenesSolicitados !== undefined) await exigirOrdenesAsistidas();
  if (input.medicoRemitenteId !== undefined) await exigirDirectorioMedicos();
  const select = await solicitudSelect();
  for (let intento = 1; intento <= MAX_REINTENTOS_CODIGO; intento += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (input.examenesSolicitados) await exigirPermisoClinico(tx, ctx, 'solicitudes.escribir');
        const paciente = await tx.paciente.findUnique({
          where: { id: input.pacienteId },
          select: { id: true },
        });
        if (!paciente) {
          throw new AppError(404, 'El paciente no existe.', 'PACIENTE_NO_ENCONTRADO');
        }

        const remitente: { medicoRemitenteId?: number; medicoRemitenteNombre?: string } = input.medicoRemitenteId != null
          ? await medicoActivoParaSolicitud(tx, input.medicoRemitenteId) : {};
        const lineas = input.examenesSolicitados ? await prepararExamenesSolicitados(tx, input.examenesSolicitados) : null;
        const solicitud = await tx.solicitud.create({
          data: {
            codigo: await siguienteCodigo(tx),
            pacienteId: input.pacienteId,
            usuarioIdRegistra: ctx.usuarioId,
            medicoSolicitante: remitente.medicoRemitenteNombre ?? input.medicoSolicitante,
            ...remitente,
            diagnosticoPresuntivo: input.diagnosticoPresuntivo,
            prioridad: input.prioridad,
            observaciones: input.observaciones,
            ...(lineas ? { examenesSolicitados: { create: lineas } } : {}),
          },
          select,
        });

        await registrarLog(tx, {
          usuarioId: ctx.usuarioId,
          entidad: 'SOLICITUD',
          entidadId: solicitud.id,
          accion: 'CREAR',
          detalle: { codigo: solicitud.codigo, pacienteId: input.pacienteId,
            ...(lineas ? { examenIds: lineas.map(l => l.examenId) } : {}),
            ...(input.medicoRemitenteId != null ? { medicoRemitenteId: input.medicoRemitenteId,
              medicoRemitenteNombre: remitente.medicoRemitenteNombre ?? null } : {}),
          },
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
    ...(filtros.q ? { OR: [{ codigo: { contains: filtros.q } },
      { paciente: { OR: [{ nombres: { contains: filtros.q } }, { apellidos: { contains: filtros.q } }, filtroDocumento(filtros.q)] } }] } : {}),
    ...(filtros.pacienteId ? { pacienteId: filtros.pacienteId } : {}),
    ...(filtros.prioridad ? { prioridad: filtros.prioridad } : {}),
    ...(filtros.cedula ? { paciente: filtroDocumento(filtros.cedula) } : {}),
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
      select: {
        ...await seleccionSolicitudBase(),
        paciente: { select: seleccionPacienteResumen() },
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
  const solicitud = await prisma.solicitud.findUnique({ where: { id }, select: await solicitudSelect() });
  if (!solicitud) {
    throw new AppError(404, 'La solicitud no existe.', 'SOLICITUD_NO_ENCONTRADA');
  }
  return solicitud;
}

/** Catálogo de exámenes activos para los formularios de registro de muestras. */
export async function listarExamenes() {
  return prisma.examen.findMany({
    where: { activo: true },
    select: seleccionExamen(),
    orderBy: { nombre: 'asc' },
  });
}

/** Cambia únicamente el vínculo y su instantánea; nunca reescribe medicoSolicitante histórico. */
export async function actualizarRemitente(id: number, medicoRemitenteId: number | null, ctx: AuditContext) {
  await exigirDirectorioMedicos();
  const select = await solicitudSelect();
  return prisma.$transaction(async tx => {
    // Serializa modificaciones simultáneas de esta solicitud.
    await tx.$queryRaw`SELECT id FROM solicitudes WHERE id = ${id} FOR UPDATE`;
    const anterior = await tx.solicitud.findUnique({ where: { id }, select });
    if (!anterior) throw new AppError(404, 'La solicitud no existe.', 'SOLICITUD_NO_ENCONTRADA');
    if (anterior.medicoRemitenteId === medicoRemitenteId) return anterior;
    const data = medicoRemitenteId === null
      ? { medicoRemitenteId: null, medicoRemitenteNombre: null }
      : await medicoActivoParaSolicitud(tx, medicoRemitenteId);
    const solicitud = await tx.solicitud.update({ where: { id }, data, select });
    await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'SOLICITUD', entidadId: id,
      accion: 'CAMBIAR_REMITENTE', detalle: {
        medicoAnteriorId: anterior.medicoRemitenteId ?? null,
        nombreAnterior: anterior.medicoRemitenteNombre ?? null, ...data,
      }, ip: ctx.ip });
    return solicitud;
  });
}
