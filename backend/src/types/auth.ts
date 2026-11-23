/**
 * Catálogo conocido por el código. AUXILIAR requiere la política nueva y su
 * futura incorporación al CHECK y a la tabla roles; no convierte usuarios.
 */
export { ROLES, type RolNombre } from '../domain/permisos';
import type { Autorizacion, RolNombre } from '../domain/permisos';

/** Usuario autenticado que los middlewares adjuntan a `req.user`. */
export interface AuthenticatedUser {
  id: number;
  username: string;
  email?: string;
  nombreCompleto: string;
  rol: RolNombre;
  autorizacion?: Autorizacion;
}
