import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../types/errors';
import type { TxClient } from '../types/dto';

type ConsultaEsquema = Pick<TxClient, '$queryRaw'>;

/** Sin bandera no se consulta ni siquiera information_schema. No almacena un éxito obsoleto. */
export async function directorioMedicosDisponible(cliente: ConsultaEsquema = prisma): Promise<boolean> {
  if (env.MEDICOS_REMITENTES_HABILITADOS !== true) return false;
  try {
    const columnas = await cliente.$queryRaw<{ tabla: string; nombre: string; tipo: string; nullable: string }[]>`
      SELECT TABLE_NAME AS tabla, COLUMN_NAME AS nombre, COLUMN_TYPE AS tipo, IS_NULLABLE AS nullable
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('medicos_remitentes', 'solicitudes')`;
    const medico = new Map(columnas.filter(c => c.tabla === 'medicos_remitentes').map(c => [c.nombre, c]));
    const solicitud = new Map(columnas.filter(c => c.tabla === 'solicitudes').map(c => [c.nombre, c]));
    if (!['id', 'nombres', 'apellidos', 'registro_profesional', 'especialidad', 'telefono', 'email',
      'institucion', 'clave_duplicado', 'activo', 'created_at', 'updated_at'].every(c => medico.has(c))
      || medico.get('id')?.tipo !== 'int unsigned'
      || solicitud.get('medico_remitente_id')?.tipo !== 'int unsigned'
      || solicitud.get('medico_remitente_id')?.nullable !== 'YES'
      || solicitud.get('medico_remitente_nombre')?.tipo !== 'varchar(120)'
      || solicitud.get('medico_remitente_nombre')?.nullable !== 'YES') return false;
    const indices = await cliente.$queryRaw<{ nombre: string; columna: string; noUnico: number }[]>`
      SELECT INDEX_NAME AS nombre, COLUMN_NAME AS columna, NON_UNIQUE AS noUnico
      FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicos_remitentes'`;
    if (![['uq_medicos_registro', 'registro_profesional'], ['uq_medicos_duplicado', 'clave_duplicado']].every(([n, c]) =>
      indices.filter(i => i.nombre === n).length === 1 && indices.some(i => i.nombre === n && i.columna === c && Number(i.noUnico) === 0))) return false;
    const fk = await cliente.$queryRaw<{ columna: string; tabla: string; referida: string }[]>`
      SELECT COLUMN_NAME AS columna, REFERENCED_TABLE_NAME AS tabla, REFERENCED_COLUMN_NAME AS referida
      FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'solicitudes'
      AND CONSTRAINT_NAME = 'fk_solicitudes_medico_remitente'`;
    return fk.length === 1 && fk[0]?.columna === 'medico_remitente_id'
      && fk[0]?.tabla === 'medicos_remitentes' && fk[0]?.referida === 'id';
  } catch { return false; }
}

export async function exigirDirectorioMedicos(): Promise<void> {
  if (!await directorioMedicosDisponible()) throw new AppError(503,
    'El directorio de médicos aún no está habilitado o su esquema está pendiente.', 'MEDICOS_NO_DISPONIBLES');
}

/** Prisma nuevo contra esquema antiguo: nunca SELECT * de solicitudes, tampoco en relaciones. */
export async function seleccionSolicitudBase(cliente: ConsultaEsquema = prisma) {
  return {
    id: true, codigo: true, pacienteId: true, usuarioIdRegistra: true, medicoSolicitante: true,
    diagnosticoPresuntivo: true, prioridad: true, fechaSolicitud: true, observaciones: true,
    createdAt: true, updatedAt: true,
    ...(await directorioMedicosDisponible(cliente) ? { medicoRemitenteId: true, medicoRemitenteNombre: true } as const : {}),
  } as const;
}
