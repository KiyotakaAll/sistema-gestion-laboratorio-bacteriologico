import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuditContext } from '../types/dto';
import { AppError } from '../types/errors';

/**
 * Express 4 no captura las promesas rechazadas de handlers async. Este wrapper
 * reenvía cualquier error a `next`, que lo entrega a `errorHandler`. Así los
 * controladores quedan sin try/catch repetidos.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/** Construye el contexto de auditoría a partir del usuario autenticado. */
export function auditContext(req: Request): AuditContext {
  if (!req.user) {
    throw new AppError(401, 'Se requiere autenticación.', 'NO_AUTENTICADO');
  }
  return { usuarioId: req.user.id, ip: req.ip ?? null };
}
