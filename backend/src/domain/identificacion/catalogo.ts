/** Límites provisionales del proyecto académico; no son normas oficiales de expedición. */
interface ReglaDocumento {
  readonly etiqueta: string;
  readonly minLongitud: number;
  readonly maxLongitud: number;
  readonly caracteres: 'DIGITOS' | 'ALFANUMERICO_GUION';
  readonly paisEmisorFijo: 'CO' | null;
}

// Cambiar límites y formatos aquí; las funciones no infieren tipos por apariencia o edad.
export const CATALOGO_DOCUMENTOS = Object.freeze({
  CC: Object.freeze({ etiqueta: 'Cédula de ciudadanía', minLongitud: 1, maxLongitud: 12,
    caracteres: 'DIGITOS', paisEmisorFijo: 'CO' }),
  TI: Object.freeze({ etiqueta: 'Tarjeta de identidad', minLongitud: 5, maxLongitud: 12,
    caracteres: 'DIGITOS', paisEmisorFijo: 'CO' }),
  RC: Object.freeze({ etiqueta: 'Registro civil', minLongitud: 5, maxLongitud: 20,
    caracteres: 'ALFANUMERICO_GUION', paisEmisorFijo: 'CO' }),
  CE: Object.freeze({ etiqueta: 'Cédula de extranjería', minLongitud: 3, maxLongitud: 20,
    caracteres: 'ALFANUMERICO_GUION', paisEmisorFijo: 'CO' }),
  PA: Object.freeze({ etiqueta: 'Pasaporte', minLongitud: 3, maxLongitud: 20,
    caracteres: 'ALFANUMERICO_GUION', paisEmisorFijo: null }),
  PPT: Object.freeze({ etiqueta: 'Permiso por Protección Temporal', minLongitud: 5, maxLongitud: 20,
    caracteres: 'ALFANUMERICO_GUION', paisEmisorFijo: 'CO' }),
} as const satisfies Record<string, ReglaDocumento>);

export type TipoDocumento = keyof typeof CATALOGO_DOCUMENTOS;
export type TipoDocumentoEmisorFijo = {
  [T in TipoDocumento]: (typeof CATALOGO_DOCUMENTOS)[T]['paisEmisorFijo'] extends string ? T : never;
}[TipoDocumento];
export type TipoDocumentoEmisorVariable = Exclude<TipoDocumento, TipoDocumentoEmisorFijo>;

export const ESTADOS_IDENTIFICACION = Object.freeze([
  'DOCUMENTADO', 'SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE', 'LEGADO_POR_REVISAR',
] as const);
export type EstadoIdentificacion = (typeof ESTADOS_IDENTIFICACION)[number];

export const LONGITUD_MAXIMA_CLAVE = 64;
export const LIMITES_MOTIVO_AUSENCIA = Object.freeze({ min: 5, max: 255 });
