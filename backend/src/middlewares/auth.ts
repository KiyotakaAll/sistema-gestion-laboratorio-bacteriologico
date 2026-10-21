import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { ROLES } from '../types/auth';
import { AppError } from '../types/errors';

/**
 * Estructura que esperamos dentro del JWT. Se valida con Zod en lugar de hacer
 * un cast: un token firmado correctamente pero con payload distinto (p. ej.
 * emitido por otra versión del sistema) se rechaza igualmente.
 * `sub` es el id del usuario, serializado como string según el estándar JWT.
 */
const tokenPayloadSchema = z.object({
  sub: z.string().regex(/^\d+$/),
  username: z.string().min(1),
  nombre: z.string().min(1),
  rol: z.enum(ROLES),
});

/**
 * Exige un header `Authorization: Bearer <token>` válido y no expirado, y
 * deja el usuario en `req.user`.
 *
 * Decisión: la autenticación es stateless (sin consultar la BD en cada
 * petición) para mantener el API rápido. Contrapartida asumida: un usuario
 * desactivado conserva su token hasta que expire (8 h por defecto).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'Se requiere autenticación.', 'NO_AUTENTICADO'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    // Se fija el algoritmo para impedir ataques de confusión de algoritmo (alg: none).
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const payload = tokenPayloadSchema.parse(decoded);

    req.user = {
      id: Number(payload.sub),
      username: payload.username,
      nombreCompleto: payload.nombre,
      rol: payload.rol,
    };
    next();
  } catch (error) {
    const expirado = error instanceof jwt.TokenExpiredError;
    next(
      new AppError(
        401,
        expirado ? 'La sesión ha expirado, inicie sesión nuevamente.' : 'Token inválido.',
        expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
      ),
    );
  }
}
