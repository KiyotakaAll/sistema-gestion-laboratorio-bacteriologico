import { z } from 'zod';
import { paginacionSchema } from './common.validator';

const sinControles = (s: string) => !/[\u0000-\u001f\u007f-\u009f]/u.test(s);
const texto = (max: number) => z.string().trim().min(1).max(max).refine(sinControles, 'No se permiten caracteres de control');
const opcional = (max: number) => z.preprocess(
  v => typeof v === 'string' ? v.trim() || null : v,
  texto(max).nullable().optional().transform(v => v ?? null),
);

export const datosMedicoSchema = z.object({
  nombres: texto(80), apellidos: texto(80),
  registroProfesional: opcional(50).transform(v => v?.normalize('NFC').replace(/\s+/g, ' ').toUpperCase() ?? null)
    .pipe(z.string().max(50).nullable()),
  especialidad: opcional(100),
  telefono: opcional(25).refine(v => v === null || (/^[+\d() .-]{5,25}$/.test(v) && v.replace(/\D/g, '').length >= 5), 'Teléfono inválido'),
  email: opcional(120).refine(v => v === null || z.string().email().safeParse(v).success, 'Correo inválido')
    .transform(v => v?.toLowerCase() ?? null),
  institucion: opcional(120),
}).strict().refine(v => `${v.nombres} ${v.apellidos}`.length <= 120, {
  message: 'El nombre completo admite hasta 120 caracteres', path: ['apellidos'],
});

export const estadoMedicoSchema = z.object({ activo: z.boolean() }).strict();
export const listarMedicosSchema = paginacionSchema.extend({
  q: z.string().trim().max(120).optional(),
  estado: z.enum(['activos', 'inactivos', 'todos']).default('todos'),
}).strict();
export const remitenteSolicitudSchema = z.object({
  medicoRemitenteId: z.number().int().positive().max(4294967295).nullable(),
}).strict();
export type DatosMedicoInput = z.infer<typeof datosMedicoSchema>;
export type ListarMedicosQuery = z.infer<typeof listarMedicosSchema>;
