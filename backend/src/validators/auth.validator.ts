import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario o correo').max(120),
  // No se aplica trim ni longitud mínima: la contraseña se compara tal cual con el hash.
  password: z.string().min(1, 'Ingrese su contraseña').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registroSchema = z.object({
  nombreCompleto: z.string().trim().min(3, 'Ingrese su nombre completo').max(120),
  email: z.string().trim().toLowerCase().email('Ingrese un correo válido').max(120),
  password: z.string().min(12, 'Use al menos 12 caracteres')
    .regex(/[a-z]/, 'Incluya una minúscula').regex(/[A-Z]/, 'Incluya una mayúscula')
    .regex(/[0-9]/, 'Incluya un número').regex(/[^A-Za-z0-9\s]/, 'Incluya un símbolo')
    .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Use como máximo 72 bytes'),
  confirmacion: z.string(),
}).strict().refine((v) => v.password === v.confirmacion, {
  message: 'Las contraseñas no coinciden', path: ['confirmacion'],
});

export type RegistroInput = z.infer<typeof registroSchema>;
