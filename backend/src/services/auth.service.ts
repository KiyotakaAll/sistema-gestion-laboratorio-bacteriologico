import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ROLES, type AuthenticatedUser, type RolNombre } from '../types/auth';
import { AppError } from '../types/errors';
import type { LoginInput } from '../validators/auth.validator';
import { registrarLog } from './auditoria.service';

/**
 * Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe:
 * sin esto, "usuario inexistente" respondería mucho más rápido que "clave
 * incorrecta" y un atacante podría enumerar usuarios midiendo latencia.
 */
const HASH_FICTICIO = bcrypt.hashSync('contrasena-ficticia-no-valida', env.BCRYPT_ROUNDS);

/** Mensaje único para cualquier fallo de credenciales (no revela cuál falló). */
function credencialesInvalidas(): AppError {
  return new AppError(401, 'Usuario o contraseña incorrectos.', 'CREDENCIALES_INVALIDAS');
}

function validarRol(nombre: string): RolNombre {
  const rol = ROLES.find((r) => r === nombre);
  if (!rol) {
    throw new AppError(500, 'El usuario tiene un rol no reconocido.', 'ROL_INVALIDO');
  }
  return rol;
}

export interface SesionIniciada {
  token: string;
  usuario: AuthenticatedUser;
}

export async function iniciarSesion(input: LoginInput, ip: string | null): Promise<SesionIniciada> {
  const usuario = await prisma.usuario.findUnique({
    where: { username: input.username },
    include: { rol: { select: { nombre: true } } },
  });

  const coincide = await bcrypt.compare(input.password, usuario?.passwordHash ?? HASH_FICTICIO);

  if (!usuario) {
    throw credencialesInvalidas();
  }

  if (!coincide || !usuario.activo) {
    // Se audita el intento fallido de un usuario real (entidad_id no admite NULL).
    await prisma.$transaction(async (tx) => {
      await registrarLog(tx, {
        usuarioId: usuario.id,
        entidad: 'USUARIO',
        entidadId: usuario.id,
        accion: 'LOGIN_FALLIDO',
        detalle: { motivo: usuario.activo ? 'CLAVE_INCORRECTA' : 'USUARIO_INACTIVO' },
        ip,
      });
    });
    throw credencialesInvalidas();
  }

  const rol = validarRol(usuario.rol.nombre);

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: usuario.id }, data: { ultimoAcceso: new Date() } });
    await registrarLog(tx, {
      usuarioId: usuario.id,
      entidad: 'USUARIO',
      entidadId: usuario.id,
      accion: 'LOGIN',
      ip,
    });
  });

  const token = jwt.sign(
    { sub: String(usuario.id), username: usuario.username, nombre: usuario.nombreCompleto, rol },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN_SECONDS },
  );

  return {
    token,
    usuario: { id: usuario.id, username: usuario.username, nombreCompleto: usuario.nombreCompleto, rol },
  };
}

/** Perfil vigente: verifica contra la BD que el usuario siga existiendo y activo. */
export async function obtenerPerfil(usuarioId: number): Promise<AuthenticatedUser> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { rol: { select: { nombre: true } } },
  });
  if (!usuario || !usuario.activo) {
    throw new AppError(401, 'La sesión ya no es válida.', 'SESION_INVALIDA');
  }
  return {
    id: usuario.id,
    username: usuario.username,
    nombreCompleto: usuario.nombreCompleto,
    rol: validarRol(usuario.rol.nombre),
  };
}
