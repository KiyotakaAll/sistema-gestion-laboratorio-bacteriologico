import type { RequestHandler } from 'express';
import type { RolNombre } from '../types/auth';
import { AppError } from '../types/errors';

/**
 * Control de acceso basado en roles (RBAC). Fábrica de middlewares:
 *
 *   router.post('/validar', authenticate, requireRoles('VALIDADOR'), ctrl.validar);
 *
 * Decisión: NO existe un bypass implícito para ADMINISTRADOR. En un laboratorio
 * la validación formal (doble firma) debe ser ejecutada solo por quien tiene
 * esa responsabilidad; si el administrador debe poder hacerlo, se lista
 * explícitamente en la ruta. Debe usarse siempre DESPUÉS de `authenticate`.
 */
export function requireRoles(...rolesPermitidos: RolNombre[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, 'Se requiere autenticación.', 'NO_AUTENTICADO'));
      return;
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      next(
        new AppError(
          403,
          'Su rol no tiene permisos para realizar esta operación.',
          'ACCESO_DENEGADO',
          { rolActual: req.user.rol, rolesPermitidos },
        ),
      );
      return;
    }

    next();
  };
}
