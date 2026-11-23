/** Política de contraseñas NUEVAS. Pura y compartida con el navegador; nunca se aplica al login. */
export const REGLA_PASSWORD = 'Use al menos 8 caracteres y como máximo 72 bytes UTF-8. Se permiten frases, espacios y Unicode; no se exigen mayúsculas, números ni símbolos. Evite contraseñas muy comunes.';

// Lista local de elecciones extremadamente comunes, no un listado completo de claves filtradas.
// Se compara la contraseña completa, no palabras contenidas en una frase.
const MUY_COMUNES = new Set([
  '12345678', '123456789', '1234567890', '12345678910', '12345678901',
  '87654321', '11111111', '00000000', '22222222', '12341234', '12121212',
  'aaaaaaaa', 'abcdefgh', 'abcd1234', 'abc12345', '1234abcd',
  'password', 'password1', 'password12', 'password123', 'password1234', 'password1!',
  'qwertyui', 'qwertyuiop', 'qwerty123', 'qwerty12345', '1q2w3e4r',
  'admin123', 'admin1234', 'admin12345', 'administrator', 'administrador',
  'contraseña', 'contraseña1', 'contraseña123', 'contrasena', 'contrasena1', 'contrasena123',
  'bienvenido', 'bienvenido1', 'bienvenido123', 'welcome1', 'welcome123',
  'changeme', 'changeme123', 'letmein1', 'iloveyou', 'sunshine', 'princess',
  'football', 'baseball', 'superman', 'monkey123', 'dragon123', 'trustno1',
]);

export function errorPasswordNueva(password: string): string | null {
  // Puntos de código Unicode: un emoji no se cuenta dos veces por usar dos unidades UTF-16.
  if (Array.from(password).length < 8) return 'Use al menos 8 caracteres en la contraseña.';
  if (new TextEncoder().encode(password).length > 72)
    return 'La contraseña supera el máximo de 72 bytes UTF-8. Los caracteres Unicode pueden ocupar varios bytes.';
  // Normalización exclusivamente para detectar elecciones comunes; el secreto original no se modifica.
  if (/^\s+$/u.test(password) || MUY_COMUNES.has(password.normalize('NFKC').trim().toLocaleLowerCase('es')))
    return 'Esta contraseña es demasiado común. Elija otra o use una frase menos predecible.';
  return null;
}
