import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario').max(40),
  // No se aplica trim ni longitud mínima: la contraseña se compara tal cual con el hash.
  password: z.string().min(1, 'Ingrese su contraseña').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
