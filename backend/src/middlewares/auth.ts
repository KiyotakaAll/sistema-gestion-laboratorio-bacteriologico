import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ROLES } from '../types/auth';
import { AppError } from '../types/errors';
import { autorizacionVigente, politicaOperativaActiva } from '../services/permisos.service';
import { rolHabilitado } from '../domain/permisos';

const tokenPayloadSchema = z.object({
  sub: z.string().regex(/^[1-9]\d*$/).refine(v => Number(v) <= 4294967295),
  username: z.string().min(1), nombre: z.string().min(1), rol: z.enum(ROLES),
  politica: z.enum(['historica-v1', 'operativa-v1']).optional(),
  sesion: z.number().int().min(0).max(4_294_967_295).optional(),
});

/** La política determina permisos; toda sesión comprueba la cuenta vigente. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  autenticar(req).then(() => next()).catch(next);
}

async function autenticar(req: Request): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Se requiere autenticación.', 'NO_AUTENTICADO');
  let payload: z.infer<typeof tokenPayloadSchema>;
  try {
    payload = tokenPayloadSchema.parse(jwt.verify(header.slice(7).trim(), env.JWT_SECRET, { algorithms: ['HS256'] }));
  } catch (error) {
    const expirado = error instanceof jwt.TokenExpiredError;
    throw new AppError(401, expirado ? 'La sesión ha expirado, inicie sesión nuevamente.' : 'Token inválido.',
      expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO');
  }
  const operativa = politicaOperativaActiva();
  if (!rolHabilitado(payload.rol, operativa)
    || (operativa ? payload.politica !== 'operativa-v1' : payload.politica === 'operativa-v1'))
    throw new AppError(401, 'La política de acceso cambió. Inicie sesión nuevamente.', 'POLITICA_SESION_CAMBIADA');
  // Los permisos nunca se toman del token. Un JWT anterior a una revocación no mantiene privilegios.
  let usuario;
  try {
    usuario = await prisma.usuario.findUnique({ where: { id: Number(payload.sub) },
      select: { id: true, activo: true, eliminadoAt: true, versionSesion: true,
        username: true, nombreCompleto: true, rol: { select: { nombre: true } } } });
  } catch {
    throw new AppError(503, 'No se pudo verificar la sesión vigente.', 'SESION_NO_DISPONIBLE');
  }
  if (!usuario?.activo || usuario.eliminadoAt || usuario.rol.nombre !== payload.rol
    || (usuario.versionSesion ?? 0) !== (payload.sesion ?? 0))
    throw new AppError(401, 'La sesión ya no es válida. Inicie sesión nuevamente.', 'SESION_INVALIDA');
  req.user = { id: usuario.id, username: usuario.username, nombreCompleto: usuario.nombreCompleto,
    rol: payload.rol, autorizacion: autorizacionVigente(payload.rol) };
}
