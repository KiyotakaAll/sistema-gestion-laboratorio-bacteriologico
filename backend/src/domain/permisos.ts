/** Política pura compartida con el cliente. No importa configuración, Prisma ni JWT. */
export const ROLES_HISTORICOS = ['ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO', 'VALIDADOR'] as const;
export const PERFILES_OPERATIVOS = ['AUXILIAR', 'BACTERIOLOGO'] as const;
export const ROLES = [...ROLES_HISTORICOS, 'AUXILIAR'] as const;
export type RolNombre = (typeof ROLES)[number];
export type PerfilOperativo = (typeof PERFILES_OPERATIVOS)[number];
export const PERMISOS = [
  'panel.ver', 'configuracion.ver', 'admision.acceder', 'recepcion.acceder',
  'pacientes.leer', 'pacientes.escribir', 'solicitudes.leer', 'solicitudes.escribir',
  'medicos.leer', 'medicos.escribir', 'examenes.leer', 'muestras.leer',
  'muestras.registrar', 'muestras.receptar', 'muestras.procesar', 'muestras.rechazar',
  'resultados.worklist', 'resultados.leer', 'resultados.escribir', 'resultados.validar',
  'usuarios.administrar',
] as const;
export type Permiso = (typeof PERMISOS)[number];
export type VersionPolitica = 'historica-v1' | 'operativa-v1';
export interface Autorizacion {
  politica: VersionPolitica;
  perfilOperativo: PerfilOperativo | null;
  permisos: readonly Permiso[];
}

const comunes: readonly Permiso[] = ['panel.ver', 'configuracion.ver', 'pacientes.leer', 'solicitudes.leer',
  'medicos.leer', 'examenes.leer', 'muestras.leer'];
const auxiliar: readonly Permiso[] = [...comunes, 'admision.acceder', 'recepcion.acceder', 'pacientes.escribir',
  'solicitudes.escribir', 'medicos.escribir', 'muestras.registrar', 'muestras.receptar', 'muestras.rechazar'];
const profesional: readonly Permiso[] = [...comunes, 'recepcion.acceder', 'muestras.procesar', 'muestras.rechazar',
  'resultados.worklist', 'resultados.leer', 'resultados.escribir'];
const historica: Record<RolNombre, readonly Permiso[]> = {
  ADMINISTRADOR: [...auxiliar, 'resultados.worklist', 'resultados.leer', 'usuarios.administrar'],
  RECEPCIONISTA: auxiliar, BACTERIOLOGO: profesional,
  VALIDADOR: [...comunes, 'resultados.leer', 'resultados.validar'], AUXILIAR: [],
};
const operativa: Record<RolNombre, readonly Permiso[]> = {
  AUXILIAR: auxiliar, BACTERIOLOGO: [...profesional, 'resultados.validar'],
  // Adaptadores temporales: no convierten cuentas ni otorgan administración/procesamiento nuevos.
  RECEPCIONISTA: historica.RECEPCIONISTA, ADMINISTRADOR: historica.ADMINISTRADOR,
  VALIDADOR: [...comunes, 'resultados.leer'],
};
export function esRolConocido(rol: string): rol is RolNombre { return ROLES.some(r => r === rol); }
export function rolHabilitado(rol: string, nuevaPolitica: boolean): boolean {
  return esRolConocido(rol) && (nuevaPolitica || rol !== 'AUXILIAR');
}
export function autorizacionPara(rol: string, nuevaPolitica = false): Autorizacion {
  const permisos = esRolConocido(rol) ? (nuevaPolitica ? operativa : historica)[rol] : [];
  return {
    politica: nuevaPolitica ? 'operativa-v1' : 'historica-v1',
    perfilOperativo: nuevaPolitica
      ? rol === 'BACTERIOLOGO' ? 'BACTERIOLOGO' : rol === 'AUXILIAR' || rol === 'RECEPCIONISTA' ? 'AUXILIAR' : null
      : null,
    permisos: Object.freeze([...permisos]),
  };
}
export function permite(rol: string, permiso: Permiso, nuevaPolitica = false): boolean {
  return autorizacionPara(rol, nuevaPolitica).permisos.includes(permiso);
}
/** La administración es una responsabilidad explícita histórica, nunca un perfil clínico. */
export function esCuentaAdministrativa(rol: string): boolean { return rol === 'ADMINISTRADOR'; }
