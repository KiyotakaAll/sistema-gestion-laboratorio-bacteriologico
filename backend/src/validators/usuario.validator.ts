import { z } from 'zod';
import { idParamSchema, paginacionSchema } from './common.validator';

export const usuarioIdSchema = idParamSchema.extend({
  id: idParamSchema.shape.id.max(4_294_967_295),
});
export const listarUsuariosSchema = paginacionSchema.extend({
  q: z.string().trim().max(120).default(''),
  estado: z.enum(['todos', 'inactivos', 'activos']).default('todos'),
});
// La acción solo cambia activo; rechaza intentos de cambiar roles o datos de perfil.
export const activarUsuarioSchema = z.object({}).strict();
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosSchema>;
