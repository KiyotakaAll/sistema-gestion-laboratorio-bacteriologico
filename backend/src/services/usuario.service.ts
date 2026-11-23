import { puedeRol } from './permisos.service';
import { esCuentaAdministrativa } from '../domain/permisos';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuditContext, TxClient } from '../types/dto';
import { AppError } from '../types/errors';
import type { ListarUsuariosQuery } from '../validators/usuario.validator';
import { registrarLog } from './auditoria.service';

const seleccionUsuario = {
  id: true, username: true, nombreCompleto: true, email: true, activo: true,
  createdAt: true, rol: { select: { nombre: true } },
} as const;

async function exigirAdministradorVigente(tx: TxClient, id: number): Promise<void> {
  // El JWT existente es stateless. Para administrar cuentas se verifica además el estado vigente.
  const administrador = await tx.usuario.findUnique({
    where: { id }, select: { activo: true, rol: { select: { nombre: true } } },
  });
  if (!administrador?.activo) throw new AppError(401, 'La sesión ya no es válida.', 'SESION_INVALIDA');
  if (!puedeRol(administrador.rol.nombre, 'usuarios.administrar'))
    throw new AppError(403, 'No tiene permisos para administrar usuarios.', 'ACCESO_DENEGADO');
}

async function operacionSegura<T>(operacion: () => Promise<T>): Promise<T> {
  try { return await operacion(); }
  catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'No se pudo completar la operación. Intente de nuevo.', 'USUARIOS_NO_DISPONIBLES');
  }
}

export function listarUsuarios(filtros: ListarUsuariosQuery, administradorId: number) {
  return operacionSegura(() => prisma.$transaction(async (tx) => {
    await exigirAdministradorVigente(tx, administradorId);
    const where: Prisma.UsuarioWhereInput = {
      ...(filtros.estado !== 'todos' ? { activo: filtros.estado === 'activos' } : {}),
      ...(filtros.q ? { OR: [
        { nombreCompleto: { contains: filtros.q } }, { email: { contains: filtros.q } },
        { username: { contains: filtros.q } },
      ] } : {}),
    };
    const total = await tx.usuario.count({ where });
    const filas = await tx.usuario.findMany({
      where, select: seleccionUsuario, skip: (filtros.page - 1) * filtros.pageSize, take: filtros.pageSize,
      orderBy: [{ activo: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      data: filas.map((u) => ({ ...u, rol: u.rol.nombre })), total,
      page: filtros.page, pageSize: filtros.pageSize, totalPages: Math.ceil(total / filtros.pageSize),
    };
  }));
}

export function activarUsuario(id: number, ctx: AuditContext) {
  return operacionSegura(() => prisma.$transaction(async (tx) => {
    await exigirAdministradorVigente(tx, ctx.usuarioId);
    if (id === ctx.usuarioId)
      throw new AppError(403, 'No puede activar su propia cuenta.', 'AUTOACTIVACION_NO_PERMITIDA');
    const usuario = await tx.usuario.findUnique({
      where: { id }, select: { id: true, activo: true, rolId: true, rol: { select: { nombre: true } } },
    });
    if (!usuario) throw new AppError(404, 'El usuario no existe.', 'USUARIO_NO_ENCONTRADO');
    if (esCuentaAdministrativa(usuario.rol.nombre))
      throw new AppError(403, 'Esta acción no permite activar cuentas administrativas.', 'ACTIVACION_RESTRINGIDA');
    if (usuario.activo) throw new AppError(409, 'El usuario ya está activo. Actualice la lista.', 'USUARIO_YA_ACTIVO');
    const cambio = await tx.usuario.updateMany({
      where: { id, activo: false, rolId: usuario.rolId }, data: { activo: true },
    });
    if (cambio.count !== 1)
      throw new AppError(409, 'La cuenta cambió durante la operación. Actualice la lista.', 'CONFLICTO_ACTIVACION');
    await registrarLog(tx, {
      usuarioId: ctx.usuarioId, entidad: 'USUARIO', entidadId: id, accion: 'ACTIVAR',
      estadoAnterior: 'INACTIVO', estadoNuevo: 'ACTIVO', ip: ctx.ip,
    });
    return { id, activo: true as const };
  }));
}
