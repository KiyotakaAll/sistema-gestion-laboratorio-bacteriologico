import { env } from '../config/env';
import { autorizacionPara, permite, type Permiso } from '../domain/permisos';

export const politicaOperativaActiva = () => env.PERMISOS_OPERATIVOS_HABILITADOS === true;
export const autorizacionVigente = (rol: string) => autorizacionPara(rol, politicaOperativaActiva());
export const puedeRol = (rol: string, permiso: Permiso) => permite(rol, permiso, politicaOperativaActiva());
/** Sin rol público en modo nuevo: la inactividad no sustituye la asignación autorizada. */
export const rolRegistroPublico = (): 'RECEPCIONISTA' | null => politicaOperativaActiva() ? null : 'RECEPCIONISTA';
