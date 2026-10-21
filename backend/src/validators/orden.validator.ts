import { z } from 'zod';
import { paginacionSchema, textoOpcional } from './common.validator';

export const crearSolicitudSchema = z.object({
  pacienteId: z.number().int().positive(),
  medicoSolicitante: textoOpcional(120),
  diagnosticoPresuntivo: textoOpcional(255),
  prioridad: z.enum(['RUTINA', 'URGENTE']).default('RUTINA'),
  observaciones: textoOpcional(255),
});

export const listarSolicitudesQuerySchema = paginacionSchema.extend({
  pacienteId: z.coerce.number().int().positive().optional(),
  cedula: z.string().trim().min(1).max(20).optional(),
  prioridad: z.enum(['RUTINA', 'URGENTE']).optional(),
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
});

export type CrearSolicitudInput = z.infer<typeof crearSolicitudSchema>;
export type ListarSolicitudesQuery = z.infer<typeof listarSolicitudesQuerySchema>;
