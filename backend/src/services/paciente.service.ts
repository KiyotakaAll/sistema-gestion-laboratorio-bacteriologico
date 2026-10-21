import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuditContext, Paginado } from '../types/dto';
import { AppError } from '../types/errors';
import type {
  ActualizarPacienteInput,
  CrearPacienteInput,
  ListarPacientesQuery,
} from '../validators/paciente.validator';
import { registrarLog } from './auditoria.service';

export async function crearPaciente(input: CrearPacienteInput, ctx: AuditContext) {
  return prisma.$transaction(async (tx) => {
    // Chequeo explícito para dar un mensaje claro; el UNIQUE de BD sigue siendo la garantía final.
    const existente = await tx.paciente.findUnique({
      where: { cedula: input.cedula },
      select: { id: true },
    });
    if (existente) {
      throw new AppError(409, 'Ya existe un paciente con esa cédula.', 'PACIENTE_DUPLICADO', {
        pacienteId: existente.id,
      });
    }

    const paciente = await tx.paciente.create({ data: input });

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'PACIENTE',
      entidadId: paciente.id,
      accion: 'CREAR',
      ip: ctx.ip,
    });

    return paciente;
  });
}

export async function actualizarPaciente(id: number, input: ActualizarPacienteInput, ctx: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const existente = await tx.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!existente) {
      throw new AppError(404, 'El paciente no existe.', 'PACIENTE_NO_ENCONTRADO');
    }

    // `?? null` permite vaciar campos opcionales (teléfono, correo, dirección).
    const paciente = await tx.paciente.update({
      where: { id },
      data: {
        nombres: input.nombres,
        apellidos: input.apellidos,
        fechaNacimiento: input.fechaNacimiento,
        sexo: input.sexo,
        telefono: input.telefono ?? null,
        email: input.email ?? null,
        direccion: input.direccion ?? null,
      },
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
  const where: Prisma.PacienteWhereInput = filtros.q
    ? {
        OR: [
          { cedula: { contains: filtros.q } },
          { apellidos: { contains: filtros.q } },
          { nombres: { contains: filtros.q } },
        ],
      }
    : {};

  const [data, total] = await prisma.$transaction([
    prisma.paciente.findMany({
      where,
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
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
    include: {
      solicitudes: {
        orderBy: { fechaSolicitud: 'desc' },
        take: 20,
        include: { _count: { select: { muestras: true } } },
      },
    },
  });
  if (!paciente) {
    throw new AppError(404, 'El paciente no existe.', 'PACIENTE_NO_ENCONTRADO');
  }
  return paciente;
}
