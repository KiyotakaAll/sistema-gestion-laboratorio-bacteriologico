import { z } from 'zod';
import { diaColombia, fechaCivilValida } from '../domain/fechaCivil';
import { validarNuevaIdentificacion, validarTipoDocumento } from '../domain/identificacion/identificacion';
import { paginacionSchema } from './common.validator';

const contacto = (max: number) => z.string().trim().max(max).nullable().optional()
  .transform(v => v === undefined ? undefined : v === null || v === '' ? null : v);
const email = contacto(120).refine(v => v == null || z.string().email().safeParse(v).success, 'Correo electrónico inválido');
export const nacimientoSchema = z.string().refine(fechaCivilValida, 'Fecha civil inexistente o formato distinto de YYYY-MM-DD')
  .refine(v => v >= '1900-01-01', 'Fecha de nacimiento inválida')
  .refine(v => v <= diaColombia(), 'La fecha de nacimiento no puede ser futura')
  .transform(v => new Date(`${v}T00:00:00.000Z`));

const demografia = z.object({
  nombres: z.string().trim().min(2, 'Ingrese los nombres').max(80),
  apellidos: z.string().trim().min(2, 'Ingrese los apellidos').max(80),
  fechaNacimiento: nacimientoSchema,
  sexo: z.enum(['M', 'F', 'O']),
  telefono: contacto(20), email, direccion: contacto(200),
});

export const identificacionSchema = z.unknown().transform((valor, ctx) => {
  try { return validarNuevaIdentificacion(valor); }
  catch (e) {
    if (!(e instanceof z.ZodError)) throw e;
    for (const issue of e.issues) ctx.addIssue(issue);
    return z.NEVER;
  }
});
/** Contrato antiguo mientras la activación permanezca apagada. */
export const crearPacienteSchema = demografia.extend({
  cedula: z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/, 'La cédula debe tener entre 5 y 20 caracteres alfanuméricos'),
}).strict();
export const crearPacienteIdentificadoSchema = demografia.extend({ identificacion: identificacionSchema }).strict();
/** PUT demográfico: documentos solo por PATCH explícito y auditado. */
export const actualizarPacienteSchema = demografia.strict();
export const actualizarIdentificacionSchema = z.object({
  identificacion: identificacionSchema,
  motivoCambio: z.string().trim().min(5).max(255).regex(/^[^\u0000-\u001F\u007F-\u009F]+$/, 'No se admiten controles'),
  versionIdentificacion: z.number().int().min(0).max(4294967294),
}).strict();

export const listarPacientesQuerySchema = paginacionSchema.extend({
  /** Búsqueda libre: cédula, nombres o apellidos. */
  q: z.string().trim().min(1).max(80).optional(),
  tipoDocumento: z.string().transform(validarTipoDocumento).optional(),
  numeroDocumento: z.string().trim().min(1).max(20).optional(),
  paisEmisorDocumento: z.string().trim().regex(/^[A-Za-z]{2}$/).transform(v => v.toUpperCase()).optional(),
}).refine(v => (!!v.tipoDocumento === !!v.numeroDocumento) && (!v.paisEmisorDocumento || !!v.tipoDocumento),
  'La búsqueda tipificada requiere tipo y número');

export type CrearPacienteInput = z.infer<typeof crearPacienteSchema> | z.infer<typeof crearPacienteIdentificadoSchema>;
export type ActualizarPacienteInput = z.infer<typeof actualizarPacienteSchema>;
export type ActualizarIdentificacionInput = z.infer<typeof actualizarIdentificacionSchema>;
export type ListarPacientesQuery = z.infer<typeof listarPacientesQuerySchema>;
