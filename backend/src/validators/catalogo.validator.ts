import { z } from 'zod';

const nombre = z.string().trim().min(2).max(80)
  .regex(/^[\p{L}\p{N} .()\-]+$/u, 'Use un nombre sin saltos de línea ni caracteres especiales')
  .transform(v => v.replace(/\s+/g, ' '));
export const sitioSchema = z.object({
  nombre,
  tiposMuestra: z.array(z.string().trim().min(2).max(60)).min(1).max(30),
}).strict();
export const plantillaSchema = z.object({
  nombre,
  examenIds: z.array(z.number().int().positive()).min(1).max(50)
    .refine(ids => new Set(ids).size === ids.length, 'No repita exámenes'),
}).strict();
export const examenSolicitadoSchema = z.object({
  examenId: z.number().int().positive(),
  tipoMuestra: z.string().trim().min(2).max(60),
  sitioAnatomicoId: z.number().int().positive().optional(),
}).strict();
