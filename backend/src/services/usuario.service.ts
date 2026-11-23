import { puedeRol } from './permisos.service';
import { esCuentaAdministrativa } from '../domain/permisos';
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
  createdAt: true, rol: { select: { nombre: true } },
} as const;

async function exigirAdministradorVigente(tx: TxClient, id: number, bloquear = false): Promise<void> {
  if (bloquear) await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${id} FOR SHARE`;
  // El JWT existente es stateless. Para administrar cuentas se verifica además el estado vigente.
  const administrador = await tx.usuario.findUnique({
    where: { id }, select: { activo: true, rol: { select: { nombre: true } } },
  });
  if (!administrador?.activo) throw new AppError(401, 'La sesión ya no es válida.', 'SESION_INVALIDA');
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
