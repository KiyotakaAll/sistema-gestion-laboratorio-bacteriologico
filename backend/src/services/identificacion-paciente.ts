import type { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { adaptarIdentificacionLegada, aIdentificacionPublica, normalizarNumeroDocumento,
  validarNuevaIdentificacion, validarTipoDocumento } from '../domain/identificacion/identificacion';
import type { IdentificacionNueva } from '../domain/identificacion/identificacion';
import { AppError } from '../types/errors';

export const identificacionActiva = () => env.PACIENTES_IDENTIFICACION_HABILITADA === true;
const resumen = { id: true, cedula: true, nombres: true, apellidos: true } as const;
const antiguos = { ...resumen, fechaNacimiento: true, sexo: true, telefono: true,
  email: true, direccion: true, createdAt: true, updatedAt: true } as const;
const nuevos = { estadoIdentificacion: true, tipoDocumento: true, numeroDocumento: true,
  paisEmisorDocumento: true, motivoAusenciaDocumento: true, versionIdentificacion: true } as const;

/** Fundamental con cliente regenerado y BD antigua: nunca usar paciente: true ni SELECT *. */
export const seleccionPaciente = () => ({ ...antiguos, ...(identificacionActiva() ? nuevos : {}) });
export const seleccionPacienteResumen = () => ({ ...resumen, ...(identificacionActiva() ? nuevos : {}) });

/** Solo se consulta al activar la función. Ninguna consulta de metadatos en modo antiguo. */
async function comprobarEsquemaIdentificacion(): Promise<void> {
  const columnas = await prisma.$queryRaw<{ nombre: string; nullable: string; tipo: string; collation: string | null }[]>`
    SELECT COLUMN_NAME AS nombre, IS_NULLABLE AS nullable, COLUMN_TYPE AS tipo, COLLATION_NAME AS collation
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pacientes'`;
  const indices = await prisma.$queryRaw<{ nombre: string; columna: string; noUnico: number }[]>`
    SELECT INDEX_NAME AS nombre, COLUMN_NAME AS columna, NON_UNIQUE AS noUnico
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pacientes'`;
  const checks = await prisma.$queryRaw<{ nombre: string; enforced: string }[]>`
    SELECT CONSTRAINT_NAME AS nombre, ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pacientes' AND CONSTRAINT_TYPE = 'CHECK'`;
  const porNombre = new Map(columnas.map(c => [c.nombre, c]));
  const requeridas = ['estado_identificacion', 'tipo_documento', 'numero_documento', 'pais_emisor_documento',
    'clave_identificacion', 'motivo_ausencia_documento', 'version_identificacion'];
  const listo = requeridas.every(c => porNombre.has(c))
    && porNombre.get('cedula')?.nullable === 'YES'
    && porNombre.get('id')?.tipo === 'int unsigned'
    && porNombre.get('estado_identificacion')?.nullable === 'NO'
    && porNombre.get('version_identificacion')?.tipo === 'int unsigned'
    && porNombre.get('version_identificacion')?.nullable === 'NO'
    && porNombre.get('clave_identificacion')?.nullable === 'YES'
    && porNombre.get('clave_identificacion')?.tipo === 'varchar(64)'
    && ['estado_identificacion', 'tipo_documento', 'numero_documento', 'pais_emisor_documento', 'clave_identificacion']
      .every(c => porNombre.get(c)?.collation === 'utf8mb4_0900_bin')
    && indices.filter(i => i.nombre === 'uq_pacientes_clave_identificacion').length === 1
    && indices.some(i => i.nombre === 'uq_pacientes_clave_identificacion' && i.columna === 'clave_identificacion' && Number(i.noUnico) === 0)
    && ['ck_pacientes_ident_estado', 'ck_pacientes_ident_formato', 'ck_pacientes_ident_clave']
      .every(n => checks.some(c => c.nombre === n && c.enforced === 'YES'));
  if (!listo) throw new AppError(503, 'La base requiere aplicar y verificar la migración de identificación.', 'IDENTIFICACION_ESQUEMA_PENDIENTE');
}

export async function asegurarEsquemaIdentificacion(): Promise<void> {
  if (!identificacionActiva()) throw new AppError(503, 'La identificación ampliada todavía no está habilitada.', 'IDENTIFICACION_DESHABILITADA');
  try { await comprobarEsquemaIdentificacion(); }
  catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(503, 'No se pudo verificar la disponibilidad de identificación.', 'IDENTIFICACION_ESQUEMA_PENDIENTE');
  }
}

export async function capacidadesIdentificacion() {
  if (!identificacionActiva()) return { identificacionPacientes: false, registroPacientes: true };
  try { await asegurarEsquemaIdentificacion(); return { identificacionPacientes: true, registroPacientes: true }; }
  catch { return { identificacionPacientes: false, registroPacientes: false }; }
}

export function camposIdentificacion(v: IdentificacionNueva) {
  return { estadoIdentificacion: v.estado, tipoDocumento: v.tipo, numeroDocumento: v.numero,
    paisEmisorDocumento: v.paisEmisor, claveIdentificacion: v.claveCanonica, motivoAusenciaDocumento: v.motivoAusencia };
}

/** Frontera de salida compartida por pacientes y proyecciones clínicas. Nunca serializar claves. */
export function publicarPacientes<T>(valor: T): T {
  function recorrer(v: unknown): unknown {
    if (v === null || typeof v !== 'object' || v instanceof Date) return v;
    if (Array.isArray(v)) return v.map(recorrer);
    const original = v as Record<string, unknown>;
    const copia = Object.fromEntries(Object.entries(original).filter(([k]) => k !== 'claveIdentificacion').map(([k, x]) => [k, recorrer(x)]));
    if (!('cedula' in original && 'nombres' in original && 'apellidos' in original && 'id' in original)) return copia;
    for (const key of Object.keys(nuevos)) delete copia[key];
    if (!identificacionActiva()) return copia;
    const identificacion = original.estadoIdentificacion === 'LEGADO_POR_REVISAR'
      ? adaptarIdentificacionLegada(original.cedula)
      : validarNuevaIdentificacion({ estado: original.estadoIdentificacion, tipo: original.tipoDocumento,
        numero: original.numeroDocumento,
        ...(original.paisEmisorDocumento === null && original.estadoIdentificacion === 'DOCUMENTADO'
          ? {} : { paisEmisor: original.paisEmisorDocumento }),
        motivoAusencia: original.motivoAusenciaDocumento });
    return { ...copia, cedula: identificacion.estado === 'LEGADO_POR_REVISAR' ? original.cedula : null,
      identificacion: aIdentificacionPublica(identificacion), versionIdentificacion: original.versionIdentificacion };
  }
  return recorrer(valor) as T;
}

export function filtroDocumento(texto: string): Prisma.PacienteWhereInput {
  if (!identificacionActiva()) return { cedula: { contains: texto } };
  return { OR: [{ cedula: { contains: texto } }, { claveIdentificacion: { contains: texto.toUpperCase() } }] };
}

export function filtroTipoNumero(tipo: string, numero: string, pais?: string): Prisma.PacienteWhereInput {
  if (!identificacionActiva()) throw new AppError(503, 'Búsqueda documental ampliada deshabilitada.', 'IDENTIFICACION_DESHABILITADA');
  const t = validarTipoDocumento(tipo);
  const n = normalizarNumeroDocumento(t, numero).numeroNormalizado;
  if (t === 'PA' && !pais) return { tipoDocumento: t, claveIdentificacion: { endsWith: ':' + n } };
  const v = validarNuevaIdentificacion({ estado: 'DOCUMENTADO', tipo: t, numero,
    ...(pais ? { paisEmisor: pais } : {}) });
  return { claveIdentificacion: v.claveCanonica };
}
