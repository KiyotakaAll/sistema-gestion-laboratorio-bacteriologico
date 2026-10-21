/**
 * Roles del sistema. Deben coincidir con los registros de la tabla `roles`
 * (ver ck_roles_nombre en database/schema.sql).
 */
export const ROLES = ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR'] as const;

export type RolNombre = (typeof ROLES)[number];

/** Usuario autenticado que los middlewares adjuntan a `req.user`. */
export interface AuthenticatedUser {
  id: number;
  username: string;
  nombreCompleto: string;
  rol: RolNombre;
}
