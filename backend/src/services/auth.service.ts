import { autorizacionVigente, politicaOperativaActiva, rolRegistroPublico } from './permisos.service';
import { rolHabilitado } from '../domain/permisos';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ROLES, type AuthenticatedUser, type RolNombre } from '../types/auth';
import { AppError } from '../types/errors';
import type { LoginInput, RegistroInput } from '../validators/auth.validator';
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
  if (!rolHabilitado(rol, politicaOperativaActiva()))
    throw new AppError(403, 'El perfil operativo aún no está habilitado.', 'PERFIL_NO_HABILITADO');
  return rol;
}

export interface SesionIniciada {
  token: string;
  usuario: AuthenticatedUser;
}

export async function iniciarSesion(input: LoginInput, ip: string | null): Promise<SesionIniciada> {
  const porUsername = await prisma.usuario.findUnique({
    where: { username: input.username },
    include: { rol: { select: { nombre: true } } },
  });
  // Se conserva la prioridad de los nombres de usuario de cuentas existentes.
  const usuario = porUsername ?? (input.username.includes('@')
    ? await prisma.usuario.findUnique({
      where: { email: input.username.toLowerCase() },
      include: { rol: { select: { nombre: true } } },
    }) : null);

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
    { sub: String(usuario.id), username: usuario.username, nombre: usuario.nombreCompleto, rol,
      ...(politicaOperativaActiva() ? { politica: 'operativa-v1' } : {}),
    },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN_SECONDS },
  );

  return {
    token,
    usuario: { id: usuario.id, username: usuario.username, email: usuario.email, nombreCompleto: usuario.nombreCompleto, rol, autorizacion: autorizacionVigente(rol) },
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
    email: usuario.email,
    nombreCompleto: usuario.nombreCompleto,
    rol: validarRol(usuario.rol.nombre),
    autorizacion: autorizacionVigente(usuario.rol.nombre),
  };
}

/** No emite tokens. La activación continúa bajo control institucional. */
export async function registrarCuenta(input: RegistroInput): Promise<{ mensaje: string }> {
  try {
    return await crearCuentaInactiva(input);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(503, 'No se pudo procesar la solicitud. Intente más tarde.', 'REGISTRO_NO_DISPONIBLE');
  }
}

async function crearCuentaInactiva(input: RegistroInput): Promise<{ mensaje: string }> {
  const nombreRol = rolRegistroPublico();
  if (nombreRol === null) throw new AppError(403,
    'El registro público está deshabilitado. Contacte a la administración del laboratorio.', 'REGISTRO_PUBLICO_DESHABILITADO');
  const respuesta = { mensaje: 'Solicitud recibida. Si el correo está disponible, la cuenta quedará pendiente de activación por el laboratorio. Después podrá iniciar sesión con su correo.' };
  // Se calcula también para duplicados para no exponer la existencia del correo.
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const existente = await prisma.usuario.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existente) return respuesta;
  const rol = await prisma.rol.findUnique({ where: { nombre: nombreRol }, select: { id: true } });
  if (!rol) throw new AppError(503, 'El registro no está disponible. Contacte al laboratorio.', 'REGISTRO_NO_DISPONIBLE');
  try {
    await prisma.usuario.create({ data: {
      nombreCompleto: input.nombreCompleto, email: input.email,
      username: `r_${randomUUID().replace(/-/g, '')}`,
      passwordHash, rolId: rol.id, activo: false,
    }, select: { id: true } });
  } catch (error) {
    // La restricción única de la BD cubre registros simultáneos.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw new AppError(503, 'No se pudo procesar la solicitud. Intente más tarde.', 'REGISTRO_NO_DISPONIBLE');
    }
  }
  return respuesta;
}
