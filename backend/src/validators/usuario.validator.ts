import { z } from 'zod';
import { idParamSchema, paginacionSchema } from './common.validator';
import { camposRegistroSchema } from './auth.validator';
import { PERFILES_OPERATIVOS } from '../domain/permisos';

export const usuarioIdSchema = idParamSchema.extend({
  id: idParamSchema.shape.id.max(4_294_967_295),
});
export const listarUsuariosSchema = paginacionSchema.extend({
  q: z.string().trim().max(120).default(''),
  estado: z.enum(['todos', 'inactivos', 'activos']).default('todos'),
});
// La acción solo cambia activo; rechaza intentos de cambiar roles o datos de perfil.
export const activarUsuarioSchema = z.object({}).strict();
export const crearUsuarioSchema = camposRegistroSchema.extend({
  username: z.string().trim().toLowerCase().min(3, 'Use entre 3 y 40 caracteres').max(40)
    .regex(/^[a-z0-9][a-z0-9_.-]*$/, 'Use letras sin acentos, números, punto, guion o guion bajo; comience con letra o número'),
  rol: z.enum(PERFILES_OPERATIVOS),
}).strict().refine(v => v.password === v.confirmacion, {
  message: 'Las contraseñas no coinciden', path: ['confirmacion'],
});
export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosSchema>;
