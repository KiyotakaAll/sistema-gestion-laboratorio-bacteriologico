import { EstadoMuestra, EstadoResultado, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuditContext, Paginado } from '../types/dto';
import { AppError } from '../types/errors';
import type {
  ActualizarResultadoInput,
  ListarResultadosQuery,
  RegistrarResultadoInput,
  WorklistQuery,
} from '../validators/resultado.validator';
import { registrarLog } from './auditoria.service';

const usuarioResumen = { select: { id: true, username: true, nombreCompleto: true } } as const;

const resultadoInclude = {
  antibiograma: { orderBy: { antibiotico: 'asc' } },
  registradoPor: usuarioResumen,
  validadoPor: usuarioResumen,
  muestraExamen: {
    include: {
      examen: true,
      muestra: { include: { solicitud: { include: { paciente: true } } } },
    },
  },
} satisfies Prisma.ResultadoInclude;

/**
 * Worklist del bacteriólogo: exámenes de muestras EN_PROCESAMIENTO.
 * Orden: primero solicitudes URGENTES (el enum se ordena por su definición:
 * RUTINA < URGENTE, por eso `desc`), luego las más antiguas.
 */
export async function obtenerWorklist({ soloPendientes }: WorklistQuery) {
  return prisma.muestraExamen.findMany({
    where: {
      muestra: { estado: EstadoMuestra.EN_PROCESAMIENTO },
      ...(soloPendientes ? { resultado: { is: null } } : {}),
    },
    include: {
      examen: true,
      muestra: { include: { solicitud: { include: { paciente: true } } } },
      resultado: { include: { antibiograma: { orderBy: { antibiotico: 'asc' } } } },
    },
    orderBy: [
      { muestra: { solicitud: { prioridad: 'desc' } } },
      { muestra: { fechaToma: 'asc' } },
    ],
  });
}

export async function listarResultados(filtros: ListarResultadosQuery) {
  const where: Prisma.ResultadoWhereInput = {
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.desde || filtros.hasta
      ? {
          fechaRegistro: {
            ...(filtros.desde ? { gte: filtros.desde } : {}),
            ...(filtros.hasta ? { lte: filtros.hasta } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.resultado.findMany({
      where,
      include: resultadoInclude,
      orderBy: { fechaRegistro: 'desc' },
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.resultado.count({ where }),
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

export async function obtenerResultadoPorId(id: number) {
  const resultado = await prisma.resultado.findUnique({ where: { id }, include: resultadoInclude });
  if (!resultado) {
    throw new AppError(404, 'El resultado no existe.', 'RESULTADO_NO_ENCONTRADO');
  }
  return resultado;
}

/**
 * Registra el resultado de un examen y su antibiograma. Si con este resultado
 * la muestra queda sin exámenes pendientes, la marca PROCESADA. Todo ocurre en
 * una sola transacción: resultado + antibiograma + auditoría + cierre de muestra.
 */
export async function registrarResultado(input: RegistrarResultadoInput, ctx: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const muestraExamen = await tx.muestraExamen.findUnique({
      where: { id: input.muestraExamenId },
      select: {
        id: true,
        muestraId: true,
        muestra: { select: { estado: true } },
        resultado: { select: { id: true } },
      },
    });
    if (!muestraExamen) {
      throw new AppError(404, 'El examen de la muestra no existe.', 'MUESTRA_EXAMEN_NO_ENCONTRADO');
    }
    if (muestraExamen.muestra.estado !== EstadoMuestra.EN_PROCESAMIENTO) {
      throw new AppError(
        409,
        'Solo se pueden cargar resultados de muestras en procesamiento.',
        'MUESTRA_NO_EN_PROCESAMIENTO',
        { estadoMuestra: muestraExamen.muestra.estado },
      );
    }
    if (muestraExamen.resultado) {
      throw new AppError(409, 'Este examen ya tiene un resultado registrado.', 'RESULTADO_DUPLICADO');
    }

    const resultado = await tx.resultado.create({
      data: {
        muestraExamenId: input.muestraExamenId,
        usuarioIdRegistra: ctx.usuarioId,
        hallazgoGram: input.hallazgoGram,
        colonias: input.colonias,
        bacteriaAislada: input.bacteriaAislada,
        observaciones: input.observaciones,
        antibiograma: { create: input.antibiograma },
      },
      select: { id: true, estado: true },
    });

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'RESULTADO',
      entidadId: resultado.id,
      accion: 'REGISTRAR',
      estadoNuevo: resultado.estado,
      detalle: { muestraId: muestraExamen.muestraId, antibioticos: input.antibiograma.length },
      ip: ctx.ip,
    });

    // ¿Quedan exámenes de la muestra sin resultado?
    const pendientes = await tx.muestraExamen.count({
      where: { muestraId: muestraExamen.muestraId, resultado: { is: null } },
    });

    if (pendientes === 0) {
      const { count } = await tx.muestra.updateMany({
        where: { id: muestraExamen.muestraId, estado: EstadoMuestra.EN_PROCESAMIENTO },
        data: { estado: EstadoMuestra.PROCESADA },
      });
      if (count === 1) {
        await registrarLog(tx, {
          usuarioId: ctx.usuarioId,
          entidad: 'MUESTRA',
          entidadId: muestraExamen.muestraId,
          accion: 'COMPLETAR_PROCESAMIENTO',
          estadoAnterior: EstadoMuestra.EN_PROCESAMIENTO,
          estadoNuevo: EstadoMuestra.PROCESADA,
          ip: ctx.ip,
        });
      }
    }

    return tx.resultado.findUniqueOrThrow({ where: { id: resultado.id }, include: resultadoInclude });
  });
}

/**
 * Corrección de un resultado aún NO validado. Quien guarda la corrección pasa
 * a ser el firmante de registro (`usuario_id_registra`): así el validador
 * nunca firma contenido que él mismo editó (doble firma real).
 */
export async function actualizarResultado(id: number, input: ActualizarResultadoInput, ctx: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.resultado.findUnique({ where: { id }, select: { estado: true } });
    if (!actual) {
      throw new AppError(404, 'El resultado no existe.', 'RESULTADO_NO_ENCONTRADO');
    }
    if (actual.estado === EstadoResultado.VALIDADO) {
      throw new AppError(409, 'Un resultado validado no puede modificarse.', 'RESULTADO_YA_VALIDADO');
    }

    // Se escribe `null` (no `undefined`) para poder limpiar campos que el usuario vació.
    await tx.resultado.update({
      where: { id },
      data: {
        usuarioIdRegistra: ctx.usuarioId,
        hallazgoGram: input.hallazgoGram ?? null,
        colonias: input.colonias ?? null,
        bacteriaAislada: input.bacteriaAislada ?? null,
        observaciones: input.observaciones ?? null,
      },
    });

    await tx.resultadoAntibiograma.deleteMany({ where: { resultadoId: id } });
    if (input.antibiograma.length > 0) {
      await tx.resultadoAntibiograma.createMany({
        data: input.antibiograma.map((item) => ({ ...item, resultadoId: id })),
      });
    }

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'RESULTADO',
      entidadId: id,
      accion: 'CORREGIR',
      estadoAnterior: actual.estado,
      estadoNuevo: actual.estado,
      detalle: { antibioticos: input.antibiograma.length },
      ip: ctx.ip,
    });

    return tx.resultado.findUniqueOrThrow({ where: { id }, include: resultadoInclude });
  });
}

/**
 * DOBLE FIRMA / VALIDACIÓN FORMAL (requerimiento 4).
 * Transacción atómica que:
 *  1. verifica que el resultado exista y siga PENDIENTE_VALIDACION;
 *  2. verifica que quien valida sea distinto de quien registró (regla de
 *     negocio; ck_resultados_doble_firma la refuerza en BD);
 *  3. cambia a VALIDADO fijando `usuario_id_valida` y `fecha_validacion`, con
 *     el estado en el WHERE para que dos validaciones simultáneas no pasen;
 *  4. registra la auditoría en la misma transacción.
 */
export async function validarResultado(id: number, ctx: AuditContext) {
  return prisma.$transaction(async (tx) => {
    const actual = await tx.resultado.findUnique({
      where: { id },
      select: { estado: true, usuarioIdRegistra: true, muestraExamen: { select: { muestraId: true } } },
    });
    if (!actual) {
      throw new AppError(404, 'El resultado no existe.', 'RESULTADO_NO_ENCONTRADO');
    }
    if (actual.estado === EstadoResultado.VALIDADO) {
      throw new AppError(409, 'El resultado ya fue validado.', 'RESULTADO_YA_VALIDADO');
    }
    if (actual.usuarioIdRegistra === ctx.usuarioId) {
      throw new AppError(
        403,
        'Doble firma: quien registró el resultado no puede validarlo.',
        'DOBLE_FIRMA_VIOLADA',
      );
    }

    const fechaValidacion = new Date();
    const { count } = await tx.resultado.updateMany({
      where: { id, estado: EstadoResultado.PENDIENTE_VALIDACION },
      data: {
        estado: EstadoResultado.VALIDADO,
        usuarioIdValida: ctx.usuarioId,
        fechaValidacion,
      },
    });
    if (count !== 1) {
      throw new AppError(
        409,
        'El resultado fue modificado por otro usuario. Actualice e intente de nuevo.',
        'CONFLICTO_CONCURRENCIA',
      );
    }

    await registrarLog(tx, {
      usuarioId: ctx.usuarioId,
      entidad: 'RESULTADO',
      entidadId: id,
      accion: 'VALIDAR',
      estadoAnterior: EstadoResultado.PENDIENTE_VALIDACION,
      estadoNuevo: EstadoResultado.VALIDADO,
      detalle: {
        muestraId: actual.muestraExamen.muestraId,
        usuarioIdRegistra: actual.usuarioIdRegistra,
        fechaValidacion: fechaValidacion.toISOString(),
      },
      ip: ctx.ip,
    });

    return tx.resultado.findUniqueOrThrow({ where: { id }, include: resultadoInclude });
  });
}
