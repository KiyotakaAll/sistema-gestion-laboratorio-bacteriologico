import { z } from 'zod';

/** `:id` de ruta. `coerce` convierte el string de la URL en number. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const paginacionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Texto opcional: recorta espacios y convierte cadena vacía en `undefined`,
 * de modo que un input vacío del formulario no se guarde como "".
 */
export function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((valor) => (valor && valor.length > 0 ? valor : undefined));
}
