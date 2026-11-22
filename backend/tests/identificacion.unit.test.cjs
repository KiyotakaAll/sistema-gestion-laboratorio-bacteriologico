const assert = require('node:assert/strict');
const { test } = require('node:test');
require('./solo-mocks.cjs');
const { ZodError } = require('zod');
const { CATALOGO_DOCUMENTOS, ESTADOS_IDENTIFICACION, LONGITUD_MAXIMA_CLAVE } =
  require('../src/domain/identificacion/catalogo.ts');
const {
  validarTipoDocumento, validarEstadoIdentificacion, normalizarNumeroDocumento,
  resolverPaisEmisor, validarIdentificacionDocumentada, validarIdentificacionSinDocumento,
  validarNuevaIdentificacion, generarClaveCanonica, adaptarIdentificacionLegada, aIdentificacionPublica,
} = require('../src/domain/identificacion/identificacion.ts');

// Sin Prisma ni simulación SQL: estas pruebas NO acreditan unicidad, FK, CHECK ni concurrencia.
const documentada = (tipo = 'CC', numero = '00123456', extras = {}) => ({ estado: 'DOCUMENTADO', tipo, numero, ...extras });
const ausente = (estado = 'SIN_DOCUMENTO_ASIGNADO', extras = {}) => ({
  estado, tipo: null, numero: null, paisEmisor: null,
  motivoAusencia: 'Documento aún no asignado.', ...extras,
});
function invalido(fn, campo) {
  assert.throws(fn, (error) => error instanceof ZodError &&
    (!campo || error.issues.some((issue) => issue.path.includes(campo))));
}

const casos = [
  { tipo: 'CC', numero: '00123456', min: 1, max: 12 },
  { tipo: 'TI', numero: '0012345678', min: 5, max: 12 },
  { tipo: 'RC', numero: 'rc001-23', min: 5, max: 20 },
  { tipo: 'CE', numero: 'ce0-123', min: 3, max: 20 },
  { tipo: 'PA', numero: 'ab001-X', min: 3, max: 20, paisEmisor: 've' },
  { tipo: 'PPT', numero: 'ppt01-23', min: 5, max: 20 },
];

test('catálogo central: seis tipos, cuatro estados e inmutabilidad de reglas', () => {
  assert.deepEqual(Object.keys(CATALOGO_DOCUMENTOS).sort(), ['CC', 'CE', 'PA', 'PPT', 'RC', 'TI']);
  assert.deepEqual([...ESTADOS_IDENTIFICACION], ['DOCUMENTADO', 'SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE', 'LEGADO_POR_REVISAR']);
  assert.equal(Object.isFrozen(CATALOGO_DOCUMENTOS), true);
  assert.equal(Object.isFrozen(ESTADOS_IDENTIFICACION), true);
  for (const { tipo, min, max } of casos) {
    assert.equal(CATALOGO_DOCUMENTOS[tipo].minLongitud, min);
    assert.equal(CATALOGO_DOCUMENTOS[tipo].maxLongitud, max);
    assert.equal(Object.isFrozen(CATALOGO_DOCUMENTOS[tipo]), true);
    assert.equal(Reflect.set(CATALOGO_DOCUMENTOS[tipo], 'minLongitud', 0), false);
  }
});

for (const { tipo, numero, min, max, paisEmisor } of casos) {
  test(`${tipo}: documento válido, capitalización original y normalización exclusiva para comparar`, () => {
    const entrada = Object.freeze(documentada(` ${tipo.toLowerCase()} `, ` ${numero} `,
      paisEmisor ? { paisEmisor } : {}));
    const original = structuredClone(entrada);
    const resultado = validarNuevaIdentificacion(entrada);
    assert.equal(resultado.estado, 'DOCUMENTADO');
    assert.equal(resultado.tipo, tipo);
    assert.equal(resultado.numero, numero);
    assert.equal(resultado.paisEmisor, paisEmisor ? 'VE' : null);
    assert.equal(resultado.claveCanonica, `${tipo}:${paisEmisor ? 'VE' : 'CO'}:${numero.toUpperCase()}`);
    assert.equal(resultado.motivoAusencia, null);
    assert.equal(Object.isFrozen(resultado), true);
    assert.deepEqual(entrada, original);
    assert.deepEqual(normalizarNumeroDocumento(tipo, ` ${numero} `), {
      numeroMostrado: numero, numeroNormalizado: numero.toUpperCase(),
    });
  });

  test(`${tipo}: límites mínimo y máximo inclusivos; fuera de rango se rechaza`, () => {
    for (const longitud of [min, max]) {
      const numeroLimite = '0'.repeat(longitud);
      const r = validarIdentificacionDocumentada(documentada(tipo, numeroLimite, paisEmisor ? { paisEmisor } : {}));
      assert.equal(r.numero, numeroLimite);
    }
    for (const longitud of [min - 1, max + 1]) {
      invalido(() => normalizarNumeroDocumento(tipo, '0'.repeat(longitud)), 'numero');
    }
  });
}

for (const valor of [undefined, null, 123456, true, {}, [], new String('123456')]) {
  test(`número: rechaza valor no textual ${Object.prototype.toString.call(valor)}`, () => {
    for (const { tipo } of casos) invalido(() => normalizarNumeroDocumento(tipo, valor), 'numero');
  });
}

for (const [nombre, numero] of [
  ['vacío', ''], ['espacios', '   '], ['espacio interior', '00 123'],
  ['espacio Unicode interior', '00\u00A0123'], ['punto', '00.123'],
  ['delimitador', '00:123'], ['barra', '00/123'], ['guion Unicode', '00–123'],
  ['letra con tilde', 'áb123'], ['dígitos de ancho completo', '１２３４５'],
  ['letra Unicode que cambia al convertir mayúsculas', 'ſ1234'],
  ['carácter invisible', '00\u200B123'], ['NUL', '00\u0000123'],
  ['tabulador exterior', '\t00123'], ['salto exterior', '00123\n'],
  ['retorno exterior', '\r00123'], ['DEL', '00\u007F123'], ['control C1', '00\u0085123'],
]) test(`número: rechaza ${nombre} sin borrar caracteres`, () => {
  for (const { tipo } of casos) invalido(() => normalizarNumeroDocumento(tipo, numero), 'numero');
});

test('CC y TI solo permiten dígitos; los demás tipos preservan letras y guiones', () => {
  for (const tipo of ['CC', 'TI']) {
    invalido(() => normalizarNumeroDocumento(tipo, 'ab123'), 'numero');
    invalido(() => normalizarNumeroDocumento(tipo, '00-123'), 'numero');
  }
  for (const tipo of ['RC', 'CE', 'PA', 'PPT']) {
    assert.deepEqual(normalizarNumeroDocumento(tipo, 'aB0-123'), {
      numeroMostrado: 'aB0-123', numeroNormalizado: 'AB0-123',
    });
  }
});

for (const valor of ['XX', 'C:C', 'C C', 'ſc', 'ＣＣ', '', null, undefined, 123, {}, 'toString', '__proto__', 'CC\n']) {
  test(`tipo: rechaza código no admitido ${JSON.stringify(valor)}`, () => {
    invalido(() => validarTipoDocumento(valor), 'tipo');
  });
}

test('tipo y estado: no hay inferencia; solo tipo normaliza espacios exteriores y mayúsculas', () => {
  assert.equal(validarTipoDocumento(' ppt '), 'PPT');
  for (const estado of ESTADOS_IDENTIFICACION) assert.equal(validarEstadoIdentificacion(estado), estado);
  for (const valor of ['documentado', ' DOCUMENTADO ', 'DESCONOCIDO', null, 1]) {
    invalido(() => validarEstadoIdentificacion(valor));
  }
  invalido(() => validarNuevaIdentificacion({ numero: '00123456' }), 'estado');
  invalido(() => validarNuevaIdentificacion({ estado: 'DOCUMENTADO', numero: '00123456' }), 'tipo');
});

for (const tipo of ['CC', 'TI', 'RC', 'CE', 'PPT']) {
  test(`${tipo}: CO implícito y explícito, almacenamiento null y país público CO`, () => {
    for (const pais of [undefined, 'CO', ' co ']) {
      assert.deepEqual(resolverPaisEmisor(tipo, pais), { paisEmisor: null, paisEmisorEfectivo: 'CO' });
      const r = validarNuevaIdentificacion(documentada(tipo, '00123456', pais === undefined ? {} : { paisEmisor: pais }));
      assert.equal(r.paisEmisor, null);
      assert.equal(aIdentificacionPublica(r).paisEmisor, 'CO');
    }
    invalido(() => resolverPaisEmisor(tipo, 'VE'), 'paisEmisor');
    // Entrada nueva: omitir o indicar CO. null es la representación INTERNA de almacenamiento.
    invalido(() => resolverPaisEmisor(tipo, null), 'paisEmisor');
  });
}

test('PA: exige país, conserva origen variable y no confunde emisor con nacionalidad', () => {
  assert.deepEqual(resolverPaisEmisor('pa', ' ve '), { paisEmisor: 'VE', paisEmisorEfectivo: 'VE' });
  assert.deepEqual(resolverPaisEmisor('PA', 'CO'), { paisEmisor: 'CO', paisEmisorEfectivo: 'CO' });
  // ZZ es estructuralmente válido: NO se está validando un catálogo oficial.
  assert.deepEqual(resolverPaisEmisor('PA', 'zz'), { paisEmisor: 'ZZ', paisEmisorEfectivo: 'ZZ' });
});

for (const pais of [undefined, null, '', 'C', 'COL', 'C0', '1O', 'C O', 'C:O', 'ſx', 'ß', 'ＣＯ', 'CO\n', 57, {}, []]) {
  test(`PA: rechaza país ausente o mal formado ${JSON.stringify(pais)}`, () => {
    invalido(() => resolverPaisEmisor('PA', pais), 'paisEmisor');
    invalido(() => validarNuevaIdentificacion(documentada('PA', 'ab001-X', { paisEmisor: pais })), 'paisEmisor');
  });
}

for (const campo of ['tipo', 'numero']) {
  test(`documento incompleto: falta ${campo}`, () => {
    const entrada = documentada(); delete entrada[campo];
    invalido(() => validarNuevaIdentificacion(entrada), campo);
  });
}

test('documentado: motivo null u omitido; ningún texto de ausencia es admisible', () => {
  assert.equal(validarNuevaIdentificacion(documentada('CC', '00123', { motivoAusencia: null })).motivoAusencia, null);
  for (const motivoAusencia of ['', 'No disponible', '   ']) {
    invalido(() => validarNuevaIdentificacion(documentada('CC', '00123', { motivoAusencia })), 'motivoAusencia');
  }
});

for (const estado of ['SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE']) {
  test(`${estado}: ausencia real, motivo recortado y clave null en dos admisiones independientes`, () => {
    const entrada = Object.freeze(ausente(estado, { motivoAusencia: ' Documento pendiente. ' }));
    const r1 = validarIdentificacionSinDocumento(entrada);
    const r2 = validarNuevaIdentificacion(entrada);
    assert.deepEqual(r1, { estado, tipo: null, numero: null, paisEmisor: null,
      motivoAusencia: 'Documento pendiente.', claveCanonica: null });
    assert.deepEqual(r1, r2);
    assert.notEqual(r1, r2);
    assert.equal(generarClaveCanonica(r1), null);
    assert.equal(generarClaveCanonica(r2), null);
    assert.equal(Object.isFrozen(r1), true);
    // No se crean pacientes ni se afirma aquí que MySQL acepte esas dos filas.
  });

  test(`${estado}: motivo de 5 a 255 caracteres y rechazo de vacío, controles y no texto`, () => {
    for (const cantidad of [5, 255]) {
      assert.equal(validarNuevaIdentificacion(ausente(estado, { motivoAusencia: 'a'.repeat(cantidad) })).motivoAusencia.length, cantidad);
    }
    for (const motivo of [undefined, null, '', '    ', 'abcd', 'a'.repeat(256), 123, {}, 'Motivo\n']) {
      invalido(() => validarNuevaIdentificacion(ausente(estado, { motivoAusencia: motivo })), 'motivoAusencia');
    }
  });

  for (const [campo, valor] of [['tipo', 'CC'], ['numero', '00123'], ['paisEmisor', 'CO'],
    ['tipo', ''], ['numero', ''], ['paisEmisor', '']]) {
    test(`${estado}: rechaza ${campo}=${JSON.stringify(valor)} en vez de borrarlo`, () => {
      invalido(() => validarNuevaIdentificacion(ausente(estado, { [campo]: valor })), campo);
    });
  }

  test(`${estado}: los componentes deben ser null explícito, no omitidos`, () => {
    for (const campo of ['tipo', 'numero', 'paisEmisor']) {
      const entrada = ausente(estado); delete entrada[campo];
      invalido(() => validarNuevaIdentificacion(entrada), campo);
    }
  });
}

test('LEGADO: estado reconocido, pero prohibido en nuevas admisiones y validadores específicos', () => {
  const entrada = { estado: 'LEGADO_POR_REVISAR', tipo: null, numero: null, paisEmisor: null, valorLegado: '00123456' };
  invalido(() => validarNuevaIdentificacion(entrada), 'estado');
  invalido(() => validarIdentificacionDocumentada(entrada), 'estado');
  invalido(() => validarIdentificacionSinDocumento(entrada), 'estado');
});

for (const original of ['00123456', 'ab-123', ' \tÁB.001\n', '', '00000']) {
  test(`legado: conserva exactamente ${JSON.stringify(original)} sin inferir tipo`, () => {
    const pacientePrevio = Object.freeze({ cedula: original });
    const r = adaptarIdentificacionLegada(pacientePrevio.cedula);
    assert.deepEqual(r, { estado: 'LEGADO_POR_REVISAR', tipo: null, numero: null,
      paisEmisor: null, motivoAusencia: null, claveCanonica: null, valorLegado: original });
    assert.equal(pacientePrevio.cedula, original);
    assert.equal(generarClaveCanonica(r), null);
    assert.equal(Object.isFrozen(r), true);
  });
}

test('legado: no convierte números ni objetos con cedula en documentos', () => {
  for (const valor of [null, undefined, 123456, { cedula: '00123456' }]) {
    invalido(() => adaptarIdentificacionLegada(valor), 'cedula');
  }
  invalido(() => validarNuevaIdentificacion({ cedula: '00123456' }));
});

test('clave: determinista, sensible a tipo/país y conserva ceros', () => {
  const claves = casos.map(({ tipo }) => generarClaveCanonica(validarNuevaIdentificacion(
    documentada(tipo, '00123456', tipo === 'PA' ? { paisEmisor: 'CO' } : {}))));
  assert.equal(new Set(claves).size, 6);
  const cc = validarNuevaIdentificacion(documentada('CC', '00123456'));
  assert.equal(generarClaveCanonica(cc), 'CC:CO:00123456');
  assert.equal(generarClaveCanonica(cc), generarClaveCanonica(cc));
  assert.notEqual(generarClaveCanonica(validarNuevaIdentificacion(documentada('CC', '00123'))),
    generarClaveCanonica(validarNuevaIdentificacion(documentada('CC', '123'))));
  const ve = validarNuevaIdentificacion(documentada('PA', 'ab001-X', { paisEmisor: 'VE' }));
  const mx = validarNuevaIdentificacion(documentada('PA', 'ab001-X', { paisEmisor: 'MX' }));
  assert.equal(generarClaveCanonica(ve), 'PA:VE:AB001-X');
  assert.notEqual(generarClaveCanonica(ve), generarClaveCanonica(mx));
  const mayusculas = validarNuevaIdentificacion(documentada('pa', 'AB001-x', { paisEmisor: 've' }));
  assert.equal(generarClaveCanonica(ve), generarClaveCanonica(mayusculas));
  assert.equal(ve.numero, 'ab001-X');
  assert.equal(mayusculas.numero, 'AB001-x');
});

test('clave: se calcula a partir de componentes validados, no de la propiedad claveCanonica', () => {
  const r = validarNuevaIdentificacion(documentada());
  assert.equal(generarClaveCanonica({ ...r, claveCanonica: 'NO-CONFIAR' }), 'CC:CO:00123456');
});

test('clave: cota de todas las combinaciones admitidas, incluidos ASCII y ambos delimitadores', () => {
  assert.equal(LONGITUD_MAXIMA_CLAVE, 64);
  for (const { tipo } of casos) {
    const longitudNumero = CATALOGO_DOCUMENTOS[tipo].maxLongitud;
    // Tipo es del catálogo, país siempre tiene dos letras y número solo contiene ASCII.
    // Esta cota no depende de enumerar cada número o código de país posible.
    const longitudMaxima = tipo.length + 1 + 2 + 1 + longitudNumero;
    assert.ok(longitudMaxima <= 64);
    const r = validarNuevaIdentificacion(documentada(tipo, '0'.repeat(longitudNumero), tipo === 'PA' ? { paisEmisor: 'ZZ' } : {}));
    assert.equal(r.claveCanonica.length, longitudMaxima);
    assert.equal(Buffer.byteLength(r.claveCanonica, 'utf8'), longitudMaxima);
  }
});

for (const campo of ['claveCanonica', 'claveIdentificacion', 'numeroNormalizado', 'versionIdentificacion',
  'valorLegado', 'cedula', 'id', 'paisEmisorEfectivo']) {
  test(`contrato externo: rechaza campo ajeno o interno ${campo}`, () => {
    for (const entrada of [documentada(), ausente(), ausente('DOCUMENTO_NO_DISPONIBLE')]) {
      invalido(() => validarNuevaIdentificacion({ ...entrada, [campo]: null }));
    }
  });
}

for (const entrada of [null, undefined, [], '00123456', 123]) {
  test(`contrato externo: rechaza identificación no estructurada ${JSON.stringify(entrada)}`, () => {
    invalido(() => validarNuevaIdentificacion(entrada));
  });
}

test('representación pública: lista explícita sin claves ni metadatos internos en ninguno de los estados', () => {
  const estados = [
    [validarNuevaIdentificacion(documentada()), { estado: 'DOCUMENTADO', tipo: 'CC', numero: '00123456', paisEmisor: 'CO' }],
    [validarNuevaIdentificacion(documentada('PA', 'ab001-X', { paisEmisor: 've' })),
      { estado: 'DOCUMENTADO', tipo: 'PA', numero: 'ab001-X', paisEmisor: 'VE' }],
    ...['SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE'].map((estado) => [validarNuevaIdentificacion(ausente(estado)),
      { estado, tipo: null, numero: null, paisEmisor: null, motivoAusencia: 'Documento aún no asignado.' }]),
    [adaptarIdentificacionLegada(' 00123 '), { estado: 'LEGADO_POR_REVISAR', tipo: null,
      numero: null, paisEmisor: null, valorLegado: ' 00123 ' }],
  ];
  for (const [interno, esperado] of estados) {
    const contaminado = { ...interno, versionIdentificacion: 99, claveIdentificacion: 'INTERNA', auditoria: { usuarioId: 7 } };
    const publico = aIdentificacionPublica(contaminado);
    assert.deepEqual(publico, esperado);
    assert.equal(Object.isFrozen(publico), true);
    const json = JSON.stringify(publico);
    for (const campo of ['claveCanonica', 'claveIdentificacion', 'numeroNormalizado', 'versionIdentificacion', 'auditoria']) {
      assert.equal(Object.hasOwn(publico, campo), false);
      assert.equal(json.includes(campo), false);
    }
  }
});

test('núcleo puro: no carga Prisma, configuración de entorno, servicios, rutas ni aplicación', () => {
  const cargados = Object.keys(require.cache).map((p) => p.replaceAll('\\', '/'));
  assert.deepEqual(cargados.filter((p) => /\/@prisma\/|\/src\/(config|services|controllers|routes)\/|\/src\/app\.ts$|\/dotenv\//.test(p)), []);
});
