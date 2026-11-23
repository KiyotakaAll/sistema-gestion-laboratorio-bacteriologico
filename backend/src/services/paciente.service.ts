import { seleccionSolicitudBase } from './medicos-disponibilidad';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuditContext, Paginado } from '../types/dto';
import { AppError } from '../types/errors';
import type {
  ActualizarPacienteInput,
  ActualizarIdentificacionInput,
  CrearPacienteInput,
  ListarPacientesQuery,
} from '../validators/paciente.validator';
import { registrarLog } from './auditoria.service';
import { asegurarEsquemaIdentificacion, camposIdentificacion, filtroDocumento, filtroTipoNumero,
  identificacionActiva, publicarPacientes, seleccionPaciente } from './identificacion-paciente';

function conflictoDocumental(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
    throw new AppError(409, 'Ya existe un paciente con esa identificación.', 'PACIENTE_DUPLICADO');
  }
  throw error;
}

export async function crearPaciente(input: CrearPacienteInput, ctx: AuditContext) {
  const nueva = 'identificacion' in input;
  if (nueva) await asegurarEsquemaIdentificacion();
  else if (identificacionActiva()) throw new AppError(400, 'Envíe el objeto identificacion.', 'IDENTIFICACION_REQUERIDA');
  try { return await prisma.$transaction(async (tx) => {
    // Chequeo explícito para dar un mensaje claro; el UNIQUE de BD sigue siendo la garantía final.
    const clave = nueva ? input.identificacion.claveCanonica : input.cedula;
    const existente = clave === null ? null : await tx.paciente.findUnique({
      where: nueva ? { claveIdentificacion: clave } : { cedula: clave },
      select: { id: true },
    });
    if (existente) {
      throw new AppError(409, nueva ? 'Ya existe un paciente con esa identificación.' : 'Ya existe un paciente con esa cédula.', 'PACIENTE_DUPLICADO', {
        pacienteId: existente.id,
      });
    }

    const data = nueva ? (() => {
      const { identificacion, ...demografia } = input;
      return { ...demografia, cedula: null, ...camposIdentificacion(identificacion), versionIdentificacion: 0 };
    })() : input;
    const paciente = await tx.paciente.create({ data, select: seleccionPaciente() });

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'PACIENTE',
      entidadId: paciente.id,
      accion: 'CREAR',
      ip: ctx.ip,
    });

    return paciente;
  }); } catch (e) {
    if (nueva) return conflictoDocumental(e);
    throw e; // Mantener traducción histórica de P2002 en modo antiguo.
  }
}

export async function actualizarPaciente(id: number, input: ActualizarPacienteInput, ctx: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const existente = await tx.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      throw new AppError(404, 'El paciente no existe.', 'PACIENTE_NO_ENCONTRADO');
    }

    // Ausencia conserva; null o vacío validado limpia. No toca identificación ni relaciones.
    const paciente = await tx.paciente.update({
      where: { id },
      data: {
        nombres: input.nombres,
        apellidos: input.apellidos,
        fechaNacimiento: input.fechaNacimiento,
        sexo: input.sexo,
        ...(input.telefono !== undefined ? { telefono: input.telefono } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.direccion !== undefined ? { direccion: input.direccion } : {}),
      },
      select: seleccionPaciente(),
    });

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'PACIENTE',
      entidadId: id,
      accion: 'ACTUALIZAR',
      ip: ctx.ip,
    });

    return paciente;
  });
}

export async function listarPacientes(filtros: ListarPacientesQuery) {
  const busqueda: Prisma.PacienteWhereInput = filtros.q
    ? {
        OR: [
          filtroDocumento(filtros.q),
          { apellidos: { contains: filtros.q } },
          { nombres: { contains: filtros.q } },
        ],
      }
    : {};
  const where: Prisma.PacienteWhereInput = filtros.tipoDocumento && filtros.numeroDocumento
    ? { AND: [busqueda, filtroTipoNumero(filtros.tipoDocumento, filtros.numeroDocumento, filtros.paisEmisorDocumento)] }
    : busqueda;

  const [data, total] = await prisma.$transaction([
    prisma.paciente.findMany({
      where,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
      select: seleccionPaciente(),
    }),
    prisma.paciente.count({ where }),
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

/** Detalle del paciente con sus últimas solicitudes (panel Master-Detail de admisión). */
export async function obtenerPacientePorId(id: number) {
  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: { ...seleccionPaciente(),
      solicitudes: {
        orderBy: { fechaSolicitud: 'desc' },
        take: 20,
        select: { ...await seleccionSolicitudBase(), _count: { select: { muestras: true } } },
      },
    },
  });
  if (!paciente) {
    throw new AppError(404, 'El paciente no existe.', 'PACIENTE_NO_ENCONTRADO');
  }
  return paciente;
}

/** CAS por ID+versión; auditoría y cambio en la misma transacción existente. */
export async function actualizarIdentificacion(id: number, input: ActualizarIdentificacionInput, ctx: AuditContext) {
  await asegurarEsquemaIdentificacion();
  try { return await prisma.$transaction(async tx => {
    const anterior = await tx.paciente.findUnique({ where: { id }, select: seleccionPaciente() });
    if (!anterior) throw new AppError(404, 'El paciente no existe.', 'PACIENTE_NO_ENCONTRADO');
    if (anterior.versionIdentificacion !== input.versionIdentificacion) {
      throw new AppError(409, 'La identificación cambió. Recargue la ficha antes de reintentar.', 'VERSION_IDENTIFICACION_CONFLICTO');
    }
    const cambio = await tx.paciente.updateMany({
      where: { id, versionIdentificacion: input.versionIdentificacion },
      data: { ...camposIdentificacion(input.identificacion), versionIdentificacion: { increment: 1 } },
    });
    if (cambio.count !== 1) throw new AppError(409, 'La identificación cambió. Recargue la ficha.', 'VERSION_IDENTIFICACION_CONFLICTO');
    const posterior = await tx.paciente.findUniqueOrThrow({ where: { id }, select: seleccionPaciente() });
    const antes = publicarPacientes(anterior) as unknown as { identificacion: Prisma.InputJsonValue };
    const despues = publicarPacientes(posterior) as unknown as { identificacion: Prisma.InputJsonValue };
    await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'PACIENTE', entidadId: id,
      accion: 'CAMBIAR_IDENTIFICACION', ip: ctx.ip,
      detalle: { motivo: input.motivoCambio, anterior: antes.identificacion, nuevo: despues.identificacion,
        versionAnterior: input.versionIdentificacion, versionNueva: input.versionIdentificacion + 1 } });
    return posterior;
  }); } catch (e) { return conflictoDocumental(e); }
}
