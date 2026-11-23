'use strict';

// NO se ejecuta al importar. Solo ensayo.cjs aporta un cliente aislado y vigilado.
const assert = require('node:assert/strict');
const { validarNuevaIdentificacion, adaptarIdentificacionLegada } = require('../../src/domain/identificacion/identificacion.ts');

function persistible(v) {
  return { cedula: v.estado === 'LEGADO_POR_REVISAR' ? v.valorLegado : null,
    estadoIdentificacion: v.estado, tipoDocumento: v.tipo, numeroDocumento: v.numero,
    paisEmisorDocumento: v.paisEmisor, claveIdentificacion: v.claveCanonica,
    motivoAusenciaDocumento: v.motivoAusencia, versionIdentificacion: 0 };
}
function documentada(tipo, numero, paisEmisor) {
  return persistible(validarNuevaIdentificacion({ estado: 'DOCUMENTADO', tipo, numero,
    ...(paisEmisor === undefined ? {} : { paisEmisor }) }));
}
function ausente(estado = 'SIN_DOCUMENTO_ASIGNADO') {
  return persistible(validarNuevaIdentificacion({ estado, tipo: null, numero: null,
    paisEmisor: null, motivoAusencia: 'Motivo sintético de ensayo' }));
}

async function ejecutarIntegracion(client, { Prisma, guard }) {
  assert.equal(typeof guard, 'function');
  await guard();
  const resultados = [];
  const errores = [];
  async function caso(nombre, fn) {
    try { await fn(); resultados.push({ nombre, resultado: 'APROBADO' }); }
    catch (e) { resultados.push({ nombre, resultado: 'FALLO', codigo: e.code || e.name, mensaje: e.message }); }
  }
  async function conflicto(fn) {
    await assert.rejects(fn, e => {
      errores.push({ contexto: 'duplicado', codigo: e.code, meta: e.meta });
      return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
    });
  }
  async function rechazoSQL(fn) {
    await assert.rejects(fn, e => {
      // No se adivina el código Prisma de CHECK: se registra para el informe real.
      errores.push({ contexto: 'CHECK', codigo: e.code, meta: e.meta, mensaje: e.message });
      return e instanceof Prisma.PrismaClientKnownRequestError
        && e.code !== 'P2002' && /3819|check constraint/i.test(JSON.stringify(e.meta) + e.message);
    });
  }

  await caso('índice real UNIQUE nullable y collation NO PAD', async () => {
    const indices = await client.$queryRawUnsafe(`SELECT NON_UNIQUE, COLUMN_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ensayo_pacientes' AND INDEX_NAME = 'uq_ensayo_clave'`);
    assert.equal(indices.length, 1);
    assert.equal(Number(indices[0].NON_UNIQUE), 0);
    assert.equal(indices[0].COLUMN_NAME, 'claveIdentificacion');
    const columnas = await client.$queryRawUnsafe(`SELECT IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, COLLATION_NAME
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ensayo_pacientes' AND COLUMN_NAME = 'claveIdentificacion'`);
    assert.equal(columnas[0].IS_NULLABLE, 'YES');
    assert.equal(Number(columnas[0].CHARACTER_MAXIMUM_LENGTH), 64);
    assert.equal(columnas[0].COLLATION_NAME, 'utf8mb4_0900_bin');
    const coll = await client.$queryRawUnsafe("SELECT PAD_ATTRIBUTE FROM information_schema.COLLATIONS WHERE COLLATION_NAME='utf8mb4_0900_bin'");
    assert.equal(coll[0].PAD_ATTRIBUTE, 'NO PAD');
  });
  await caso('tres CHECK nuevos están ENFORCED', async () => {
    const checks = await client.$queryRawUnsafe(`SELECT CONSTRAINT_NAME, ENFORCED
      FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ensayo_pacientes' AND CONSTRAINT_TYPE = 'CHECK'`);
    assert.deepEqual(checks.map(c => c.CONSTRAINT_NAME).sort(), ['ck_ensayo_clave', 'ck_ensayo_estado', 'ck_ensayo_formato']);
    assert.ok(checks.every(c => c.ENFORCED === 'YES'));
  });
  await caso('tres pacientes con clave NULL y ambos estados de ausencia', async () => {
    const filas = [];
    for (const estado of ['SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE', 'SIN_DOCUMENTO_ASIGNADO']) {
      filas.push(await client.paciente.create({ data: ausente(estado) }));
    }
    assert.equal(new Set(filas.map(f => f.id)).size, 3);
    assert.ok(filas.every(f => f.claveIdentificacion === null));
  });
  for (const [tipo, numero, pais] of [['CC', '00123456'], ['TI', '123456'], ['RC', 'ab-001'],
    ['CE', 'x-123'], ['PA', 'ab001-X', 'VE'], ['PPT', 'ppt-001']]) {
    await caso('creación y findUnique: ' + tipo, async () => {
      const data = documentada(tipo, numero, pais);
      const fila = await client.paciente.create({ data });
      const encontrada = await client.paciente.findUnique({ where: { claveIdentificacion: data.claveIdentificacion } });
      assert.equal(encontrada.id, fila.id);
      assert.equal(encontrada.numeroDocumento, numero);
    });
  }
  await caso('findUnique con NULL se rechaza como consulta inválida', async () => {
    await assert.rejects(() => client.paciente.findUnique({ where: { claveIdentificacion: null } }),
      e => e instanceof Prisma.PrismaClientValidationError);
  });
  await caso('duplicado documental exacto devuelve P2002', async () => {
    await conflicto(() => client.paciente.create({ data: documentada('CC', '00123456') }));
  });
  await caso('mismo número con diferente tipo', async () => {
    const a = await client.paciente.create({ data: documentada('CC', '777777') });
    const b = await client.paciente.create({ data: documentada('TI', '777777') });
    assert.notEqual(a.id, b.id);
  });
  await caso('mismo pasaporte con diferente país', async () => {
    const a = await client.paciente.create({ data: documentada('PA', 'pais-001', 'VE') });
    const b = await client.paciente.create({ data: documentada('PA', 'pais-001', 'CO') });
    assert.notEqual(a.id, b.id);
  });
  await caso('capitalización mostrada distinta conserva unicidad normalizada', async () => {
    await client.paciente.create({ data: documentada('PA', 'Mixto-001', 'US') });
    await conflicto(() => client.paciente.create({ data: documentada('PA', 'mIXTO-001', 'US') }));
  });
  await caso('ceros iniciales distinguen documentos', async () => {
    const a = await client.paciente.create({ data: documentada('CC', '00042') });
    const b = await client.paciente.create({ data: documentada('CC', '42') });
    assert.notEqual(a.claveIdentificacion, b.claveIdentificacion);
    assert.equal(a.numeroDocumento, '00042');
  });
  await caso('actualización a clave ocupada falla sin alterar la fila', async () => {
    const origen = await client.paciente.create({ data: documentada('CC', '888888') });
    await conflicto(() => client.paciente.update({ where: { id: origen.id }, data: documentada('CC', '00123456') }));
    assert.equal((await client.paciente.findUnique({ where: { id: origen.id } })).claveIdentificacion, origen.claveIdentificacion);
  });
  await caso('collation distingue ASCII, acentos y espacios finales', async () => {
    const [v] = await client.$queryRawUnsafe(`SELECT
      (_utf8mb4'A' COLLATE utf8mb4_0900_bin = _utf8mb4'a') AS mayusculas,
      (_utf8mb4'a' COLLATE utf8mb4_0900_bin = _utf8mb4'á') AS acentos,
      (_utf8mb4'a' COLLATE utf8mb4_0900_bin = _utf8mb4'a ') AS espacios`);
    assert.deepEqual([Number(v.mayusculas), Number(v.acentos), Number(v.espacios)], [0, 0, 0]);
  });

  const base = documentada('PA', 'check-001', 'VE');
  const invalidas = [
    ['sin tipo', { tipoDocumento: null }], ['sin número', { numeroDocumento: null }],
    ['sin clave', { claveIdentificacion: null }], ['sin país PA', { paisEmisorDocumento: null }],
    ['con motivo', { motivoAusenciaDocumento: 'Motivo incompatible' }],
    ['tipo desconocido', { tipoDocumento: 'XX', claveIdentificacion: 'XX:VE:CHECK-001' }],
    ['tipo minúsculo', { tipoDocumento: 'pa', claveIdentificacion: 'pa:VE:CHECK-001' }],
    ['país minúsculo', { paisEmisorDocumento: 've', claveIdentificacion: 'PA:ve:CHECK-001' }],
    ['país con dígitos', { paisEmisorDocumento: 'V1', claveIdentificacion: 'PA:V1:CHECK-001' }],
    ['clave de otro número', { claveIdentificacion: 'PA:VE:CHECK-002' }],
    ['clave minúscula', { claveIdentificacion: 'PA:VE:check-001' }],
    ['clave con espacio final', { claveIdentificacion: 'PA:VE:CHECK-001 ' }],
    ['clave con delimitador extra', { claveIdentificacion: 'PA:VE:CHECK-001:X' }],
  ];
  for (const [nombre, cambios] of invalidas) await caso('CHECK documentado: ' + nombre, () =>
    rechazoSQL(() => client.paciente.create({ data: { ...base, ...cambios } })));
  await caso('VARCHAR(20) rechaza longitud excesiva sin truncar: P2000', async () => {
    await assert.rejects(() => client.paciente.create({ data: { ...base,
      numeroDocumento: 'a'.repeat(21), claveIdentificacion: 'PA:VE:' + 'A'.repeat(21) } }), e => e.code === 'P2000');
  });
  for (const numero of ['', 'a', 'aa bb', 'ab.cd', 'ab:cd', 'ab/cd',
    ' abcd', 'abcd ', 'ab\ncd', 'abcd\n', 'ab\u0000cd', 'ab\u0085cd', 'ábcde', 'ab—cd', 'abſcd', 'ＡＢ１２３']) {
    await caso('CHECK formato: ' + JSON.stringify(numero), () => rechazoSQL(() =>
      client.paciente.create({ data: { ...base, numeroDocumento: numero,
        claveIdentificacion: 'PA:VE:' + numero.toUpperCase() } })));
  }
  await caso('CHECK país fijo almacenado como NULL', () => rechazoSQL(() =>
    client.paciente.create({ data: { ...documentada('CC', '55555'), paisEmisorDocumento: 'CO' } })));
  for (const estado of ['SIN_DOCUMENTO_ASIGNADO', 'DOCUMENTO_NO_DISPONIBLE']) {
    for (const [nombre, cambios] of [['tipo presente', { tipoDocumento: 'CC' }],
      ['número presente', { numeroDocumento: '55555' }], ['país presente', { paisEmisorDocumento: 'CO' }],
      ['clave presente', { claveIdentificacion: 'CC:CO:55555' }], ['motivo NULL', { motivoAusenciaDocumento: null }],
      ['motivo vacío', { motivoAusenciaDocumento: '' }], ['motivo blanco', { motivoAusenciaDocumento: '     ' }]]) {
      await caso('CHECK ' + estado + ': ' + nombre, () => rechazoSQL(() =>
        client.paciente.create({ data: { ...ausente(estado), ...cambios } })));
    }
  }
  await caso('legado conserva exactamente cédula y permite clasificar sin cambiar ID', async () => {
    const original = '00ab-001';
    const legacy = await client.paciente.create({ data: persistible(adaptarIdentificacionLegada(original)) });
    const actualizada = await client.paciente.update({ where: { id: legacy.id },
      data: { ...documentada('CE', 'ce-900'), cedula: original, versionIdentificacion: { increment: 1 } } });
    assert.equal(actualizada.id, legacy.id);
    assert.equal(actualizada.cedula, original);
    assert.equal(actualizada.versionIdentificacion, 1);
  });
  await caso('CHECK legado sin valor histórico se rechaza', () => rechazoSQL(() =>
    client.paciente.create({ data: { ...persistible(adaptarIdentificacionLegada('99999')), cedula: null } })));
  await caso('CHECK legado no permite inferencia documental', () => rechazoSQL(() =>
    client.paciente.create({ data: { ...persistible(adaptarIdentificacionLegada('99999')), tipoDocumento: 'CC' } })));
  await caso('CHECK estado desconocido se rechaza', () => rechazoSQL(() =>
    client.paciente.create({ data: { ...ausente(), estadoIdentificacion: 'OTRO' } })));

  await caso('CHECK simple acepta UNKNOWN; IS TRUE lo rechaza', async () => {
    await client.$executeRawUnsafe('CREATE TABLE ensayo_unknown (valor INT NULL, CHECK (valor > 0))');
    await client.$executeRawUnsafe('INSERT INTO ensayo_unknown (valor) VALUES (NULL)');
    const [fila] = await client.$queryRawUnsafe('SELECT COUNT(*) AS cantidad FROM ensayo_unknown');
    assert.equal(Number(fila.cantidad), 1);
    await client.$executeRawUnsafe('CREATE TABLE ensayo_true (valor INT NULL, CHECK ((valor > 0) IS TRUE))');
    await rechazoSQL(() => client.$executeRawUnsafe('INSERT INTO ensayo_true (valor) VALUES (NULL)'));
  });
  await caso('concurrencia real: una creación y un P2002, sin filas parciales', async () => {
    let liberar;
    const barrera = new Promise(resolve => { liberar = resolve; });
    const data = documentada('PA', 'race-001', 'US');
    const intento = async () => { await barrera; return client.paciente.create({ data: { ...data,
      solicitudes: { create: { muestras: { create: { examenes: { create: { resultado: { create: {} } } } } } } } } }); };
    const antes = await client.solicitud.count();
    const operaciones = [intento(), intento()];
    liberar();
    const salidas = await Promise.allSettled(operaciones);
    assert.equal(salidas.filter(r => r.status === 'fulfilled').length, 1);
    const error = salidas.find(r => r.status === 'rejected').reason;
    assert.equal(error.code, 'P2002');
    errores.push({ contexto: 'concurrencia', codigo: error.code, meta: error.meta });
    assert.equal(await client.paciente.count({ where: { claveIdentificacion: data.claveIdentificacion } }), 1);
    assert.equal(await client.solicitud.count(), antes + 1);
    const fila = await client.paciente.findUnique({ where: { claveIdentificacion: data.claveIdentificacion },
      include: { solicitudes: { include: { muestras: { include: { examenes: { include: { resultado: true } } } } } } } });
    assert.equal(fila.solicitudes.length, 1);
    assert.ok(fila.solicitudes[0].muestras[0].examenes[0].resultado);
  });
  await caso('cambiar identificación conserva toda la cadena de IDs', async () => {
    const anterior = await client.paciente.create({ data: { ...ausente(), solicitudes: { create: {
      muestras: { create: { examenes: { create: { resultado: { create: {} } } } } } } } },
    include: { solicitudes: { include: { muestras: { include: { examenes: { include: { resultado: true } } } } } } } });
    await client.paciente.update({ where: { id: anterior.id }, data: documentada('CC', '31415926') });
    const posterior = await client.paciente.findUnique({ where: { id: anterior.id },
      include: { solicitudes: { include: { muestras: { include: { examenes: { include: { resultado: true } } } } } } } });
    assert.deepEqual(posterior.solicitudes, anterior.solicitudes);
  });
  await caso('FK real rechaza solicitud sin paciente: P2003', async () => {
    await assert.rejects(() => client.solicitud.create({ data: { pacienteId: 4294967295 } }), e => e.code === 'P2003');
  });
  await caso('DML revierte completamente ante conflicto documental', async () => {
    const antes = await client.solicitud.count();
    await conflicto(() => client.$transaction(async tx => {
      await tx.paciente.create({ data: { ...documentada('CC', '27182818'), solicitudes: { create: {} } } });
      await tx.paciente.create({ data: documentada('CC', '00123456') });
    }));
    assert.equal(await client.paciente.count({ where: { claveIdentificacion: 'CC:CO:27182818' } }), 0);
    assert.equal(await client.solicitud.count(), antes);
  });
  await caso('DDL hace commit implícito: ROLLBACK no elimina columna ni inserción previa', async () => {
    await client.$executeRawUnsafe('CREATE TABLE ensayo_ddl (id INT PRIMARY KEY)');
    await assert.rejects(() => client.$transaction(async tx => {
      await tx.$executeRawUnsafe('INSERT INTO ensayo_ddl (id) VALUES (1)');
      await tx.$executeRawUnsafe('ALTER TABLE ensayo_ddl ADD COLUMN agregado INT NULL');
      throw new Error('fallo deliberado posterior al DDL');
    }));
    const fila = await client.$queryRawUnsafe('SELECT id, agregado FROM ensayo_ddl');
    assert.deepEqual(fila, [{ id: 1, agregado: null }]);
  });
  await caso('ensayo aditivo mínimo conserva cédula, ID y FK existentes', async () => {
    await client.$executeRawUnsafe('CREATE TABLE ensayo_antes (id INT UNSIGNED PRIMARY KEY, cedula VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE)');
    await client.$executeRawUnsafe('CREATE TABLE ensayo_hija (id INT PRIMARY KEY, pacienteId INT UNSIGNED NOT NULL, FOREIGN KEY (pacienteId) REFERENCES ensayo_antes(id))');
    await client.$executeRawUnsafe("INSERT INTO ensayo_antes VALUES (17, '00ab-001')");
    await client.$executeRawUnsafe('INSERT INTO ensayo_hija VALUES (1, 17)');
    await client.$executeRawUnsafe('ALTER TABLE ensayo_antes ADD COLUMN estado VARCHAR(32) NULL, ADD COLUMN clave VARCHAR(64) COLLATE utf8mb4_0900_bin NULL');
    await client.$executeRawUnsafe("UPDATE ensayo_antes SET estado='LEGADO_POR_REVISAR' WHERE estado IS NULL");
    await client.$executeRawUnsafe('ALTER TABLE ensayo_antes MODIFY estado VARCHAR(32) NOT NULL, MODIFY cedula VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL, ADD UNIQUE KEY uq_aditivo_clave (clave)');
    const filas = await client.$queryRawUnsafe('SELECT p.id, p.cedula, p.estado, p.clave, h.pacienteId FROM ensayo_antes p JOIN ensayo_hija h ON h.pacienteId=p.id');
    assert.deepEqual(filas, [{ id: 17, cedula: '00ab-001', estado: 'LEGADO_POR_REVISAR', clave: null, pacienteId: 17 }]);
  });
  const fallos = resultados.filter(r => r.resultado === 'FALLO');
  if (fallos.length) throw new Error(JSON.stringify({ resultados, errores }, null, 2));
  return { total: resultados.length, resultados, errores };
}

module.exports = { ejecutarIntegracion };
