import { z } from 'zod';
import { paginacionSchema, textoOpcional } from './common.validator';

export const crearSolicitudSchema = z.object({
  pacienteId: z.number().int().positive(),
  medicoSolicitante: textoOpcional(120),
  medicoRemitenteId: z.number().int().positive().max(4294967295).nullable().optional(),
  diagnosticoPresuntivo: textoOpcional(255),
  prioridad: z.enum(['RUTINA', 'URGENTE']).default('RUTINA'),
  observaciones: textoOpcional(255),
}).refine(v => v.medicoRemitenteId == null || v.medicoSolicitante === undefined, {
  message: 'Seleccione un médico por ID o escriba un remitente, no ambos', path: ['medicoRemitenteId'],
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
