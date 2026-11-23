import { politicaOperativaActiva } from './permisos.service';
import { PERFILES_OPERATIVOS, type PerfilOperativo } from '../domain/permisos';
import type { TxClient } from '../types/dto';

/** Solo admite la forma IN del CHECK preparado en 3.1; cualquier variante desconocida falla cerrada. */
function checkAuxiliarPreparado(clausula: string): boolean {
  const normalizada = clausula.replace(/`/g, '').replace(/_(?:utf8mb4|utf8mb3|utf8|ascii|latin1)(?=')/gi, '')
    .replace(/'[^']*'|\s+/g, token => token.startsWith("'") ? token : '').toUpperCase();
  if (!/^\(*NOMBREIN\('[A-Z_]+'(?:,'[A-Z_]+')*\)\)*$/.test(normalizada)) return false;
  return normalizada.match(/'([A-Z_]+)'/g)?.includes("'AUXILIAR'") === true;
}

/** Lectura únicamente: nunca inserta roles ni intenta ensayar una escritura contra el CHECK. */
export async function rolOperativoDisponible(tx: TxClient, nombre: PerfilOperativo) {
  if (nombre === 'AUXILIAR' && !politicaOperativaActiva()) return null;
  const rol = await tx.rol.findUnique({ where: { nombre }, select: { id: true, nombre: true } });
  if (!rol || rol.nombre !== nombre) return null;
  if (nombre === 'AUXILIAR') {
    const checks = await tx.$queryRaw<{ clausula: string; aplicado: string }[]>`
      SELECT cc.CHECK_CLAUSE AS clausula, tc.ENFORCED AS aplicado
      FROM information_schema.TABLE_CONSTRAINTS tc
      JOIN information_schema.CHECK_CONSTRAINTS cc
        ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'roles'
        AND tc.CONSTRAINT_NAME = 'ck_roles_nombre' AND tc.CONSTRAINT_TYPE = 'CHECK'`;
    if (checks.length !== 1 || checks[0]?.aplicado !== 'YES' || !checkAuxiliarPreparado(checks[0].clausula)) return null;
  }
  return rol;
}

export async function rolesDisponiblesParaAlta(tx: TxClient): Promise<PerfilOperativo[]> {
  const roles: PerfilOperativo[] = [];
  for (const nombre of PERFILES_OPERATIVOS) {
    if (await rolOperativoDisponible(tx, nombre)) roles.push(nombre);
  }
  return roles;
}
