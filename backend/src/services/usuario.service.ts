import { puedeRol } from './permisos.service';
import { esCuentaAdministrativa, PERFILES_OPERATIVOS, type PerfilOperativo } from '../domain/permisos';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import type { AuditContext, TxClient } from '../types/dto';
import { AppError } from '../types/errors';
import { crearUsuarioSchema, type CrearUsuarioInput, type ListarUsuariosQuery } from '../validators/usuario.validator';
import { registrarLog } from './auditoria.service';
import { rolesDisponiblesParaAlta, rolOperativoDisponible } from './usuarios-disponibilidad';

const seleccionUsuario = {
  id: true, username: true, nombreCompleto: true, email: true, activo: true,
  eliminadoAt: true, createdAt: true, rol: { select: { nombre: true } },
} as const;

async function exigirAdministradorVigente(tx: TxClient, id: number, bloquear = false): Promise<void> {
  if (bloquear) {
    // Mutex de administración compartido por altas, estados y asignaciones.
    // Evita que dos administradores desactiven simultáneamente la última cuenta.
    await tx.$queryRaw`SELECT id FROM roles WHERE nombre = 'ADMINISTRADOR' FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${id} FOR SHARE`;
  }
  // La administración vuelve a comprobar el estado vigente dentro de su transacción.
  const administrador = await tx.usuario.findUnique({
    where: { id }, select: { activo: true, eliminadoAt: true, rol: { select: { nombre: true } } },
  });
  if (!administrador?.activo || administrador.eliminadoAt) throw new AppError(401, 'La sesión ya no es válida.', 'SESION_INVALIDA');
  if (!esCuentaAdministrativa(administrador.rol.nombre) || !puedeRol(administrador.rol.nombre, 'usuarios.administrar'))
    throw new AppError(403, 'No tiene permisos para administrar usuarios.', 'ACCESO_DENEGADO');
}

export function capacidadesAltaUsuarios(administradorId: number) {
  return operacionSegura(() => prisma.$transaction(async tx => {
    await exigirAdministradorVigente(tx, administradorId);
    return { roles: await rolesDisponiblesParaAlta(tx) };
  }));
}

/** El alta siempre queda pendiente de activación; no acepta estado, IDs de rol ni permisos del cliente. */
export function crearUsuario(input: CrearUsuarioInput, ctx: AuditContext) {
  const datos = crearUsuarioSchema.parse(input);
  return operacionSegura(async () => {
    // Evita calcular hashes para JWT administrativos revocados; se comprueba otra vez después del hash.
    await exigirAdministradorVigente(prisma, ctx.usuarioId);
    const passwordHash = await bcrypt.hash(datos.password, env.BCRYPT_ROUNDS);
    try {
      return await prisma.$transaction(async tx => {
        await exigirAdministradorVigente(tx, ctx.usuarioId, true);
        const rol = await rolOperativoDisponible(tx, datos.rol);
        if (!rol) throw new AppError(503, 'El perfil seleccionado aún no está disponible para crear cuentas.', 'PERFIL_ALTA_NO_DISPONIBLE');
        await tx.$queryRaw`SELECT id FROM roles WHERE id = ${rol.id} FOR SHARE`;
        const vigente = await tx.rol.findUnique({ where: { nombre: datos.rol }, select: { id: true } });
        if (vigente?.id !== rol.id) throw new AppError(409, 'El catálogo cambió. Actualice los perfiles disponibles.', 'CATALOGO_ROLES_CAMBIADO');
        const existente = await tx.usuario.findFirst({
          // También evita un correo nuevo que coincida con el username histórico de otra cuenta.
          where: { OR: [{ username: datos.username }, { email: datos.email }, { username: datos.email }] }, select: { id: true },
        });
        if (existente) throw new AppError(409, 'El nombre de usuario o correo ya está registrado.', 'USUARIO_DUPLICADO');
        const usuario = await tx.usuario.create({ data: {
          nombreCompleto: datos.nombreCompleto, username: datos.username, email: datos.email,
          passwordHash, rolId: rol.id, activo: false,
        }, select: seleccionUsuario });
        await registrarLog(tx, {
          usuarioId: ctx.usuarioId, entidad: 'USUARIO', entidadId: usuario.id, accion: 'CREAR',
          estadoAnterior: null, estadoNuevo: 'INACTIVO', detalle: { rol: datos.rol }, ip: ctx.ip,
        });
        return { ...usuario, rol: usuario.rol.nombre };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new AppError(409, 'El nombre de usuario o correo ya está registrado.', 'USUARIO_DUPLICADO');
        if (['P2034', 'P2028'].includes(error.code)) throw new AppError(409, 'La operación encontró un conflicto. Actualice la lista antes de reintentar.', 'CONFLICTO_ALTA_USUARIO');
      }
      throw error;
    }
  });
}

async function operacionSegura<T>(operacion: () => Promise<T>): Promise<T> {
  try { return await operacion(); }
  catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (['P2034', 'P2028'].includes(error.code) ||
        (error.code === 'P2010' && ['1205', '1213'].includes(String(error.meta?.code)))))
      throw new AppError(409, 'La cuenta cambió durante la operación. Actualice la lista.', 'CONFLICTO_USUARIO');
    throw new AppError(503, 'No se pudo completar la operación. Intente de nuevo.', 'USUARIOS_NO_DISPONIBLES');
  }
}

export function listarUsuarios(filtros: ListarUsuariosQuery, administradorId: number) {
  return operacionSegura(() => prisma.$transaction(async (tx) => {
    await exigirAdministradorVigente(tx, administradorId);
    const where: Prisma.UsuarioWhereInput = {
      eliminadoAt: filtros.estado === 'eliminados' ? { not: null } : null,
      ...(['activos', 'inactivos'].includes(filtros.estado) ? { activo: filtros.estado === 'activos' } : {}),
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
  return cambiarEstadoUsuario(id, 'ACTIVAR', ctx);
}

export function desactivarUsuario(id: number, ctx: AuditContext) {
  return cambiarEstadoUsuario(id, 'DESACTIVAR', ctx);
}

export function eliminarUsuario(id: number, ctx: AuditContext) {
  return cambiarEstadoUsuario(id, 'ELIMINAR', ctx);
}

async function usuarioBloqueado(tx: TxClient, id: number) {
  await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${id} FOR UPDATE`;
  const usuario = await tx.usuario.findUnique({ where: { id }, select: {
    id: true, activo: true, eliminadoAt: true, versionSesion: true, rolId: true,
    rol: { select: { nombre: true } },
  } });
  if (!usuario) throw new AppError(404, 'El usuario no existe.', 'USUARIO_NO_ENCONTRADO');
  if (usuario.eliminadoAt) throw new AppError(409, 'La cuenta fue eliminada y no puede reactivarse.', 'USUARIO_ELIMINADO');
  if (usuario.versionSesion >= 4_294_967_295)
    throw new AppError(409, 'La cuenta requiere revisión administrativa de sesiones.', 'VERSION_SESION_AGOTADA');
  return usuario;
}

function cambiarEstadoUsuario(id: number, accion: 'ACTIVAR' | 'DESACTIVAR' | 'ELIMINAR', ctx: AuditContext) {
  return operacionSegura(() => prisma.$transaction(async (tx) => {
    await exigirAdministradorVigente(tx, ctx.usuarioId, true);
    if (id === ctx.usuarioId)
      throw new AppError(403, 'No puede cambiar el estado de su propia cuenta.', 'CUENTA_PROPIA_PROTEGIDA');
    const usuario = await usuarioBloqueado(tx, id);
    const activar = accion === 'ACTIVAR';
    if (activar && esCuentaAdministrativa(usuario.rol.nombre))
      throw new AppError(403, 'Esta acción no permite activar cuentas administrativas.', 'ACTIVACION_RESTRINGIDA');
    if (activar && env.PERMISOS_OPERATIVOS_HABILITADOS && !PERFILES_OPERATIVOS.some(rol => rol === usuario.rol.nombre))
      throw new AppError(409, 'Asigne Auxiliar o Bacteriólogo antes de activar la cuenta.', 'PERFIL_REQUIERE_ASIGNACION');
    if (accion !== 'ELIMINAR' && usuario.activo === activar)
      throw new AppError(409, activar ? 'El usuario ya está activo.' : 'El usuario ya está inactivo.',
        activar ? 'USUARIO_YA_ACTIVO' : 'USUARIO_YA_INACTIVO');
    if (!activar && usuario.activo && esCuentaAdministrativa(usuario.rol.nombre)) {
      const administradores = await tx.usuario.count({ where: {
        activo: true, eliminadoAt: null, rol: { nombre: 'ADMINISTRADOR' },
      } });
      if (administradores <= 1) throw new AppError(409, 'Debe conservar al menos un administrador activo.', 'ULTIMO_ADMINISTRADOR');
    }
    const eliminadoAt = accion === 'ELIMINAR' ? new Date() : null;
    const cambio = await tx.usuario.updateMany({
      where: { id, activo: usuario.activo, rolId: usuario.rolId, eliminadoAt: null, versionSesion: usuario.versionSesion },
      data: { activo: activar, eliminadoAt, versionSesion: { increment: 1 } },
    });
    if (cambio.count !== 1)
      throw new AppError(409, 'La cuenta cambió durante la operación. Actualice la lista.', 'CONFLICTO_ACTIVACION');
    await registrarLog(tx, {
      usuarioId: ctx.usuarioId, entidad: 'USUARIO', entidadId: id, accion,
      estadoAnterior: usuario.activo ? 'ACTIVO' : 'INACTIVO',
      estadoNuevo: eliminadoAt ? 'ELIMINADO' : activar ? 'ACTIVO' : 'INACTIVO', ip: ctx.ip,
    });
    return { id, activo: activar, eliminadoAt };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }));
}

export function asignarPerfilUsuario(id: number, rol: PerfilOperativo, ctx: AuditContext) {
  return operacionSegura(() => prisma.$transaction(async tx => {
    await exigirAdministradorVigente(tx, ctx.usuarioId, true);
    if (id === ctx.usuarioId) throw new AppError(403, 'No puede modificar su propio perfil.', 'CUENTA_PROPIA_PROTEGIDA');
    const usuario = await usuarioBloqueado(tx, id);
    if (usuario.activo) throw new AppError(409, 'Desactive la cuenta antes de asignar su perfil.', 'USUARIO_DEBE_ESTAR_INACTIVO');
    if (esCuentaAdministrativa(usuario.rol.nombre)) throw new AppError(403, 'La administración interna está protegida.', 'ADMINISTRADOR_PROTEGIDO');
    if (!PERFILES_OPERATIVOS.some(perfil => perfil === rol)) throw new AppError(400, 'Perfil operativo inválido.', 'PERFIL_INVALIDO');
    const disponible = await rolOperativoDisponible(tx, rol);
    if (!disponible) throw new AppError(503, 'El perfil aún no está disponible.', 'PERFIL_ALTA_NO_DISPONIBLE');
    const cambio = await tx.usuario.updateMany({
      where: { id, activo: false, eliminadoAt: null, versionSesion: usuario.versionSesion },
      data: { rolId: disponible.id, versionSesion: { increment: 1 } },
    });
    if (cambio.count !== 1) throw new AppError(409, 'La cuenta cambió. Actualice la lista.', 'CONFLICTO_USUARIO');
    await registrarLog(tx, { usuarioId: ctx.usuarioId, entidad: 'USUARIO', entidadId: id, accion: 'ASIGNAR_PERFIL',
      estadoAnterior: 'INACTIVO', estadoNuevo: 'INACTIVO', detalle: { rolAnterior: usuario.rol.nombre, rolNuevo: rol }, ip: ctx.ip });
    return { id, activo: false, rol };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }));
}
