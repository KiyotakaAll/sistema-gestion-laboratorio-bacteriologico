import type { RequestHandler } from 'express';
import type { Permiso } from '../domain/permisos';
import { puedeRol } from '../services/permisos.service';
import { AppError } from '../types/errors';

/** No consume permisos del JWT ni de la petición: el servidor aplica su política. */
export function requirePermiso(permiso: Permiso): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) { next(new AppError(401, 'Se requiere autenticación.', 'NO_AUTENTICADO')); return; }
    if (!puedeRol(req.user.rol, permiso)) {
      next(new AppError(403, 'Su perfil no tiene permisos para realizar esta operación.', 'ACCESO_DENEGADO'));
      return;
    }
    next();
  };
}
