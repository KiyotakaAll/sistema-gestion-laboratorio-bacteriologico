import { z } from 'zod';
import { paginacionSchema, textoOpcional } from './common.validator';

export const crearPacienteSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{5,20}$/, 'La cédula debe tener entre 5 y 20 caracteres alfanuméricos'),
  nombres: z.string().trim().min(2, 'Ingrese los nombres').max(80),
  apellidos: z.string().trim().min(2, 'Ingrese los apellidos').max(80),
  fechaNacimiento: z.coerce
    .date()
    .refine((fecha) => fecha.getTime() <= Date.now(), { message: 'La fecha de nacimiento no puede ser futura' })
    .refine((fecha) => fecha.getFullYear() >= 1900, { message: 'Fecha de nacimiento inválida' }),
  sexo: z.enum(['M', 'F', 'O']),
  telefono: textoOpcional(20),
  email: z
    .string()
    .trim()
    .email('Correo electrónico inválido')
    .max(120)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  direccion: textoOpcional(200),
});

/** En la edición la cédula no cambia (es la clave de negocio del paciente). */
export const actualizarPacienteSchema = crearPacienteSchema.omit({ cedula: true });

export const listarPacientesQuerySchema = paginacionSchema.extend({
  /** Búsqueda libre: cédula, nombres o apellidos. */
  q: z.string().trim().min(1).max(80).optional(),
});

export type CrearPacienteInput = z.infer<typeof crearPacienteSchema>;
export type ActualizarPacienteInput = z.infer<typeof actualizarPacienteSchema>;
export type ListarPacientesQuery = z.infer<typeof listarPacientesQuerySchema>;
