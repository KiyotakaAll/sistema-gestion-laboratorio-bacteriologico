export interface RegistroEntrada {
  nombreCompleto: string;
  email: string;
  password: string;
  confirmacion: string;
}
export const REGLA_PASSWORD = 'Use entre 12 y 72 caracteres (máximo 72 bytes), con mayúscula, minúscula, número y símbolo.';
export function validarRegistro(datos: RegistroEntrada): Partial<Record<keyof RegistroEntrada, string>> {
  const errores: Partial<Record<keyof RegistroEntrada, string>> = {};
  if (datos.nombreCompleto.trim().length < 3 || datos.nombreCompleto.trim().length > 120)
    errores.nombreCompleto = 'Ingrese su nombre completo (3 a 120 caracteres).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim()) || datos.email.trim().length > 120)
    errores.email = 'Ingrese un correo electrónico válido (máximo 120 caracteres).';
  if (datos.password.length < 12 || new TextEncoder().encode(datos.password).length > 72
    || !/[a-z]/.test(datos.password) || !/[A-Z]/.test(datos.password)
    || !/[0-9]/.test(datos.password) || !/[^A-Za-z0-9\s]/.test(datos.password))
    errores.password = REGLA_PASSWORD;
  if (!datos.confirmacion || datos.password !== datos.confirmacion)
    errores.confirmacion = 'Las contraseñas no coinciden.';
  return errores;
}
