import { z } from 'zod';
import { paginacionSchema, textoOpcional } from './common.validator';

const ESTADOS_MUESTRA = ['REGISTRADA', 'RECEPTADA', 'EN_PROCESAMIENTO', 'PROCESADA', 'RECHAZADA'] as const;

/** Tolerancia de 5 min por diferencias de reloj entre equipos del laboratorio. */
const TOLERANCIA_RELOJ_MS = 5 * 60 * 1000;

export const registrarMuestraSchema = z.object({
  solicitudId: z.number().int().positive(),
  tipoMuestra: z.string().trim().min(2, 'Indique el tipo de muestra').max(60),
  sitioAnatomico: textoOpcional(80),
  fechaToma: z.coerce
    .date()
    .refine((fecha) => fecha.getTime() <= Date.now() + TOLERANCIA_RELOJ_MS, {
      message: 'La fecha de toma no puede estar en el futuro',
    }),
  examenIds: z
    .array(z.number().int().positive())
    .min(1, 'Seleccione al menos un examen')
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Hay exámenes repetidos' }),
});

export const rechazarMuestraSchema = z.object({
  motivoRechazo: z.string().trim().min(5, 'Describa el motivo del rechazo').max(255),
});

export const listarMuestrasQuerySchema = paginacionSchema.extend({
  estado: z.enum(ESTADOS_MUESTRA).optional(),
  codigoBarras: z.string().trim().min(1).max(30).optional(),
  cedula: z.string().trim().min(1).max(20).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export const codigoBarrasParamSchema = z.object({
  codigoBarras: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{8,30}$/, 'Código de barras inválido'),
});

export type RegistrarMuestraInput = z.infer<typeof registrarMuestraSchema>;
export type RechazarMuestraInput = z.infer<typeof rechazarMuestraSchema>;
export type ListarMuestrasQuery = z.infer<typeof listarMuestrasQuerySchema>;
