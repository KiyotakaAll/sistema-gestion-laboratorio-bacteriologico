const assert = require('node:assert/strict');
const { test } = require('node:test');
require('./solo-mocks.cjs');
const { errorPasswordNueva } = require('../src/domain/password.ts');
const { registroSchema, loginSchema } = require('../src/validators/auth.validator.ts');
const { crearUsuarioSchema } = require('../src/validators/usuario.validator.ts');
const { validarRegistro } = require('../../frontend/src/utils/registro.ts');
const base = { nombreCompleto: 'Persona Prueba', email: 'persona@example.test' };

const casos = [
  ['ocho caracteres sin mayúsculas, números ni símbolos', 'calmaluz', null],
  ['solo mayúsculas', 'CASCADAS', null],
  ['solo números no comunes', '81249376', null],
  ['frase con espacios', 'mi mesa tiene cuatro libros', null],
  ['espacios iniciales y finales', '  mi café mira al mar  ', null],
  ['Unicode español', 'caféazul', null],
  ['Unicode no latino', '庭の木には青い鳥がいる', null],
  ['ocho emojis', '🔬'.repeat(8), null],
  ['símbolos sin categorías obligatorias', '#~?¡¿<>@', null],
  ['72 bytes ASCII', 'r'.repeat(72), null],
  ['72 bytes Unicode', 'á'.repeat(36), null],
  ['72 bytes emojis', '🔬'.repeat(18), null],
  ['vacía', '', '8 caracteres'],
  ['siete caracteres', 'calmalu', '8 caracteres'],
  ['cuatro emojis no equivalen a ocho caracteres', '🔬'.repeat(4), '8 caracteres'],
  ['secuencia extremadamente común', '12345678', 'demasiado común'],
  ['palabra extremadamente común', 'password', 'demasiado común'],
  ['común con mayúscula y espacios', ' Password1! ', 'demasiado común'],
  ['común en español', 'contraseña', 'demasiado común'],
  ['común en español sin tilde', 'contrasena', 'demasiado común'],
  ['equivalente Unicode de una clave común', '１２３４５６７８', 'demasiado común'],
  ['solo espacios', ' '.repeat(8), 'demasiado común'],
  ['73 bytes ASCII', 'r'.repeat(73), '72 bytes UTF-8'],
  ['74 bytes Unicode', 'á'.repeat(37), '72 bytes UTF-8'],
  ['76 bytes emojis', '🔬'.repeat(19), '72 bytes UTF-8'],
];
for (const [nombre, password, esperado] of casos) test('misma política frontend/backend: '+nombre, () => {
  const datos = { ...base, password, confirmacion: password };
  const registro = registroSchema.safeParse(datos);
  const alta = crearUsuarioSchema.safeParse({ ...datos, username: 'persona.prueba', rol: 'BACTERIOLOGO' });
  const frontend = validarRegistro(datos).password;
  assert.equal(registro.success, esperado === null);
  assert.equal(alta.success, registro.success);
  assert.equal(frontend ?? null, errorPasswordNueva(password));
  if (esperado) {
    const mensaje = registro.error.issues.find(i => i.path[0] === 'password').message;
    assert.ok(mensaje.includes(esperado));assert.equal(mensaje, frontend);
    assert.equal(alta.error.issues.find(i => i.path[0] === 'password').message, mensaje);
  } else {
    assert.equal(registro.data.password, password); assert.equal(alta.data.password, password);
  }
});
test('no bloquea una frase solo porque contiene una palabra común', () => {
  assert.equal(errorPasswordNueva('mi password para mirar las estrellas'), null);
});
test('confirmación exacta: no recorta ni normaliza Unicode o espacios del secreto', () => {
  for (const [password, confirmacion] of [['  mi patio azul  ', 'mi patio azul'], ['caféazul', 'cafe\u0301azul']]) {
    const datos = { ...base, password, confirmacion };
    assert.equal(registroSchema.safeParse(datos).success, false);
    assert.ok(validarRegistro(datos).confirmacion);
  }
});
test('la nueva política no se aplica al login de cuentas existentes', () => {
  for (const password of ['lab', '12345678', 'á'.repeat(40)]) {
    assert.ok(errorPasswordNueva(password));
    assert.equal(loginSchema.parse({ username: 'cuenta.anterior', password }).password, password);
  }
});
