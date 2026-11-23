import { z } from 'zod';
import { errorPasswordNueva } from '../domain/password';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario o correo').max(120),
  // No se aplica trim ni longitud mínima: la contraseña se compara tal cual con el hash.
  password: z.string().min(1, 'Ingrese su contraseña').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Campos compartidos por registro histórico y alta administrativa; mismas reglas de contraseña. */
export const camposRegistroSchema = z.object({
  nombreCompleto: z.string().trim().min(3, 'Ingrese su nombre completo').max(120),
  email: z.string().trim().toLowerCase().email('Ingrese un correo válido').max(120),
  password: z.string({ required_error: 'Ingrese una contraseña', invalid_type_error: 'Ingrese una contraseña como texto' })
    .superRefine((valor, ctx) => {
      const mensaje = errorPasswordNueva(valor);
      if (mensaje) ctx.addIssue({ code: z.ZodIssueCode.custom, message: mensaje });
    }),
  confirmacion: z.string(),
}).strict();

export const registroSchema = camposRegistroSchema.refine((v) => v.password === v.confirmacion, {
  message: 'Las contraseñas no coinciden', path: ['confirmacion'],
});

export type RegistroInput = z.infer<typeof registroSchema>;
