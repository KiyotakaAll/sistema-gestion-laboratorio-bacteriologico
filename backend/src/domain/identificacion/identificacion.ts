import { z } from 'zod';
import {
  CATALOGO_DOCUMENTOS,
  ESTADOS_IDENTIFICACION,
  LIMITES_MOTIVO_AUSENCIA,
  LONGITUD_MAXIMA_CLAVE,
  type EstadoIdentificacion,
  type TipoDocumento,
  type TipoDocumentoEmisorFijo,
  type TipoDocumentoEmisorVariable,
} from './catalogo';

type DocumentoBase = Readonly<{
  estado: 'DOCUMENTADO';
  numero: string;
  claveCanonica: string;
  motivoAusencia: null;
}>;

/** País de almacenamiento: el emisor fijo se deriva del catálogo, no se repite. */
export type IdentificacionDocumentada = DocumentoBase & (
  | Readonly<{ tipo: TipoDocumentoEmisorFijo; paisEmisor: null }>
  | Readonly<{ tipo: TipoDocumentoEmisorVariable; paisEmisor: string }>
);

export type IdentificacionSinDocumento = Readonly<{
  estado: 'SIN_DOCUMENTO_ASIGNADO' | 'DOCUMENTO_NO_DISPONIBLE';
  tipo: null;
  numero: null;
  paisEmisor: null;
  claveCanonica: null;
  motivoAusencia: string;
}>;

export type IdentificacionLegada = Readonly<{
  estado: 'LEGADO_POR_REVISAR';
  tipo: null;
  numero: null;
  paisEmisor: null;
  claveCanonica: null;
  motivoAusencia: null;
  valorLegado: string;
}>;

export type IdentificacionNueva = IdentificacionDocumentada | IdentificacionSinDocumento;
export type Identificacion = IdentificacionNueva | IdentificacionLegada;

export type IdentificacionPublica =
  | Readonly<{ estado: 'DOCUMENTADO'; tipo: TipoDocumento; numero: string; paisEmisor: string }>
  | Readonly<{ estado: IdentificacionSinDocumento['estado']; tipo: null; numero: null;
      paisEmisor: null; motivoAusencia: string }>
  | Readonly<{ estado: 'LEGADO_POR_REVISAR'; tipo: null; numero: null;
      paisEmisor: null; valorLegado: string }>;

export interface NumeroDocumentoNormalizado {
  readonly numeroMostrado: string;
  readonly numeroNormalizado: string;
}

export interface PaisEmisorResuelto {
  readonly paisEmisor: string | null;
  readonly paisEmisorEfectivo: string;
}

// C0, DEL y C1: se comprueban ANTES del trim para no borrar controles exteriores.
const CONTROLES = /[\u0000-\u001F\u007F-\u009F]/;

function rechazar(campo: string, mensaje: string): never {
  throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: [campo], message: mensaje }]);
}

function textoLimpio(valor: unknown, campo: string): string {
  if (typeof valor !== 'string') return rechazar(campo, 'El valor debe ser texto.');
  if (CONTROLES.test(valor)) return rechazar(campo, 'No se admiten caracteres de control.');
  return valor.trim();
}

export function validarTipoDocumento(valor: unknown): TipoDocumento {
  const texto = textoLimpio(valor, 'tipo');
  // Validar ASCII antes de toUpperCase evita convertir letras Unicode en códigos válidos.
  if (!/^[A-Za-z]{2,10}$/.test(texto)) return rechazar('tipo', 'Tipo documental inválido.');
  const tipo = texto.toUpperCase();
  if (!Object.hasOwn(CATALOGO_DOCUMENTOS, tipo)) return rechazar('tipo', 'Tipo documental no admitido.');
  return tipo as TipoDocumento;
}

export function validarEstadoIdentificacion(valor: unknown): EstadoIdentificacion {
  // Los estados son códigos exactos; solo tipo y país admiten normalización de mayúsculas.
  return z.enum(ESTADOS_IDENTIFICACION).parse(valor);
}

export function normalizarNumeroDocumento(tipoEntrada: unknown, valor: unknown): NumeroDocumentoNormalizado {
  const tipo = validarTipoDocumento(tipoEntrada);
  const numeroMostrado = textoLimpio(valor, 'numero');
  const regla = CATALOGO_DOCUMENTOS[tipo];
  if (numeroMostrado.length < regla.minLongitud || numeroMostrado.length > regla.maxLongitud) {
    return rechazar('numero', `El documento ${tipo} debe tener entre ${regla.minLongitud} y ${regla.maxLongitud} caracteres.`);
  }
  const patron = regla.caracteres === 'DIGITOS' ? /^[0-9]+$/ : /^[0-9A-Za-z-]+$/;
  if (!patron.test(numeroMostrado)) return rechazar('numero', 'El número contiene caracteres no admitidos para su tipo.');
  return Object.freeze({ numeroMostrado, numeroNormalizado: numeroMostrado.toUpperCase() });
}

/** Solo estructura de dos letras ASCII: NO verifica existencia, vigencia ni reconocimiento del país. */
export function resolverPaisEmisor(tipoEntrada: unknown, valor?: unknown): PaisEmisorResuelto {
  const tipo = validarTipoDocumento(tipoEntrada);
  const fijo = CATALOGO_DOCUMENTOS[tipo].paisEmisorFijo;
  if (valor === undefined && fijo !== null) {
    return Object.freeze({ paisEmisor: null, paisEmisorEfectivo: fijo });
  }
  const texto = textoLimpio(valor, 'paisEmisor');
  if (!/^[A-Za-z]{2}$/.test(texto)) return rechazar('paisEmisor', 'Indique dos letras ASCII para el país emisor.');
  const pais = texto.toUpperCase();
  if (fijo !== null && pais !== fijo) return rechazar('paisEmisor', `El emisor de ${tipo} debe ser ${fijo}.`);
  return Object.freeze({ paisEmisor: fijo === null ? pais : null, paisEmisorEfectivo: pais });
}

function claveDocumental(tipo: TipoDocumento, pais: string, numeroNormalizado: string): string {
  const clave = `${tipo}:${pais}:${numeroNormalizado}`;
  if (clave.length > LONGITUD_MAXIMA_CLAVE) return rechazar('numero', 'La identificación excede la capacidad de la clave interna.');
  return clave;
}

const documentadaSchema = z.object({
  estado: z.literal('DOCUMENTADO'),
  tipo: z.unknown(),
  numero: z.unknown(),
  paisEmisor: z.unknown().optional(),
  motivoAusencia: z.null().optional(),
}).strict();

const sinDocumentoSchema = z.object({
  estado: z.enum(['SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE']),
  tipo: z.null(),
  numero: z.null(),
  paisEmisor: z.null(),
  motivoAusencia: z.string(),
}).strict();

function esEmisorFijo(tipo: TipoDocumento): tipo is TipoDocumentoEmisorFijo {
  return CATALOGO_DOCUMENTOS[tipo].paisEmisorFijo !== null;
}

/** Entrada externa estricta. No admite claves, números normalizados ni otros campos internos. */
export function validarIdentificacionDocumentada(entrada: unknown): IdentificacionDocumentada {
  const datos = documentadaSchema.parse(entrada);
  const tipo = validarTipoDocumento(datos.tipo);
  const numero = normalizarNumeroDocumento(tipo, datos.numero);
  const pais = resolverPaisEmisor(tipo, datos.paisEmisor);
  const base: DocumentoBase = {
    estado: 'DOCUMENTADO', numero: numero.numeroMostrado, motivoAusencia: null,
    claveCanonica: claveDocumental(tipo, pais.paisEmisorEfectivo, numero.numeroNormalizado),
  };
  if (esEmisorFijo(tipo)) return Object.freeze({ ...base, tipo, paisEmisor: null });
  return Object.freeze({ ...base, tipo, paisEmisor: pais.paisEmisorEfectivo });
}

/** Los tres componentes documentales deben enviarse explícitamente como null. */
export function validarIdentificacionSinDocumento(entrada: unknown): IdentificacionSinDocumento {
  const datos = sinDocumentoSchema.parse(entrada);
  const motivo = textoLimpio(datos.motivoAusencia, 'motivoAusencia');
  if (motivo.length < LIMITES_MOTIVO_AUSENCIA.min || motivo.length > LIMITES_MOTIVO_AUSENCIA.max) {
    return rechazar('motivoAusencia', `El motivo debe tener entre ${LIMITES_MOTIVO_AUSENCIA.min} y ${LIMITES_MOTIVO_AUSENCIA.max} caracteres.`);
  }
  return Object.freeze({ estado: datos.estado, tipo: null, numero: null, paisEmisor: null,
    claveCanonica: null, motivoAusencia: motivo });
}

/** Frontera para NUEVAS admisiones; deliberadamente separada del adaptador de legado. */
export function validarNuevaIdentificacion(entrada: unknown): IdentificacionNueva {
  const { estado } = z.object({ estado: z.enum(ESTADOS_IDENTIFICACION) }).parse(entrada);
  switch (estado) {
    case 'DOCUMENTADO': return validarIdentificacionDocumentada(entrada);
    case 'SIN_DOCUMENTO_ASIGNADO':
    case 'DOCUMENTO_NO_DISPONIBLE': return validarIdentificacionSinDocumento(entrada);
    case 'LEGADO_POR_REVISAR': return rechazar('estado', 'El legado está reservado para migración y compatibilidad.');
  }
}

/** Recibe un valor de dominio validado; nunca toma la clave que pudiera aportar un cliente. */
export function generarClaveCanonica(identificacion: Identificacion): string | null {
  if (identificacion.estado !== 'DOCUMENTADO') return null;
  const numero = normalizarNumeroDocumento(identificacion.tipo, identificacion.numero);
  const pais = resolverPaisEmisor(identificacion.tipo,
    identificacion.paisEmisor === null ? undefined : identificacion.paisEmisor);
  return claveDocumental(identificacion.tipo, pais.paisEmisorEfectivo, numero.numeroNormalizado);
}

/** Preserva el original EXACTO, incluso si es vacío o incompatible con reglas nuevas. Sin inferencia. */
export function adaptarIdentificacionLegada(cedula: unknown): IdentificacionLegada {
  if (typeof cedula !== 'string') return rechazar('cedula', 'El valor legado debe ser texto.');
  return Object.freeze({ estado: 'LEGADO_POR_REVISAR', tipo: null, numero: null, paisEmisor: null,
    claveCanonica: null, motivoAusencia: null, valorLegado: cedula });
}

/** Proyección por lista explícita de campos: no serializar el valor interno con spread. */
export function aIdentificacionPublica(identificacion: Identificacion): IdentificacionPublica {
  switch (identificacion.estado) {
    case 'DOCUMENTADO': {
      const pais = resolverPaisEmisor(identificacion.tipo,
        identificacion.paisEmisor === null ? undefined : identificacion.paisEmisor);
      return Object.freeze({ estado: identificacion.estado, tipo: identificacion.tipo,
        numero: identificacion.numero, paisEmisor: pais.paisEmisorEfectivo });
    }
    case 'SIN_DOCUMENTO_ASIGNADO':
    case 'DOCUMENTO_NO_DISPONIBLE':
      return Object.freeze({ estado: identificacion.estado, tipo: null, numero: null,
        paisEmisor: null, motivoAusencia: identificacion.motivoAusencia });
    case 'LEGADO_POR_REVISAR':
      return Object.freeze({ estado: identificacion.estado, tipo: null, numero: null,
        paisEmisor: null, valorLegado: identificacion.valorLegado });
  }
}
