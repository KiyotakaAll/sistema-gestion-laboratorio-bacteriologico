import { errorPasswordNueva } from '../../../backend/src/domain/password';
export { REGLA_PASSWORD } from '../../../backend/src/domain/password';

export interface RegistroEntrada {
  nombreCompleto: string;
  email: string;
  password: string;
  confirmacion: string;
}
export function validarRegistro(datos: RegistroEntrada): Partial<Record<keyof RegistroEntrada, string>> {
  const errores: Partial<Record<keyof RegistroEntrada, string>> = {};
  if (datos.nombreCompleto.trim().length < 3 || datos.nombreCompleto.trim().length > 120)
    errores.nombreCompleto = 'Ingrese su nombre completo (3 a 120 caracteres).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim()) || datos.email.trim().length > 120)
    errores.email = 'Ingrese un correo electrónico válido (máximo 120 caracteres).';
  const errorPassword = errorPasswordNueva(datos.password);
  if (errorPassword) errores.password = errorPassword;
  if (!datos.confirmacion || datos.password !== datos.confirmacion)
    errores.confirmacion = 'Las contraseñas no coinciden.';
  return errores;
}
