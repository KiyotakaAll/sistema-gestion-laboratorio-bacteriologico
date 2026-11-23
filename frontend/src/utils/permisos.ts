import { permite, type Permiso } from '../../../backend/src/domain/permisos';
import type { UsuarioSesion } from '../types/api';
export { esCuentaAdministrativa, type Permiso } from '../../../backend/src/domain/permisos';

/** Compatibilidad con API anterior: solo política histórica. Capacidades presentes nunca se infieren. */
export function puedeUsuario(usuario: UsuarioSesion | null, permiso: Permiso | undefined): boolean {
  if (!usuario || !permiso) return false;
  const a = usuario.autorizacion;
  if (a === undefined) return permite(usuario.rol, permiso, false);
  if (a.politica !== 'historica-v1' && a.politica !== 'operativa-v1') return false;
  return Array.isArray(a.permisos) && a.permisos.includes(permiso)
    && permite(usuario.rol, permiso, a.politica === 'operativa-v1');
}
