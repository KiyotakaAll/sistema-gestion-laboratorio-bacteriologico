'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { LABEL, entornoLimpio, validarDestino, validarAislamiento } = require('./seguridad.cjs');
const backend = path.resolve(__dirname, '../..');
const dockerSocket = 'unix:///var/run/docker.sock';
let dockerConfig;

function ejecutar(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: 120000,
    maxBuffer: 8 * 1024 * 1024, env: entornoLimpio(), ...options });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${path.basename(command)}: ${r.stderr || r.stdout || r.status}`);
  return r.stdout;
}

function docker(args) {
  assert.ok(dockerConfig, 'Docker requiere un directorio de configuración vacío propio.');
  return ejecutar('/usr/bin/docker', ['--config', dockerConfig, '--host', dockerSocket, ...args]);
}
function inspeccionar(tipo, id) { return JSON.parse(docker([tipo, 'inspect', id]))[0]; }

function prepararOffline() {
  for (const pkg of ['prisma', '@prisma/client']) {
    const version = JSON.parse(fs.readFileSync(path.join(backend, 'node_modules', pkg, 'package.json'))).version;
    assert.equal(version, '6.19.3', `Se exige ${pkg} 6.19.3, sin instalar otra versión.`);
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'labzen-ident-13b-'));
  fs.chmodSync(work, 0o700);
  fs.writeFileSync(path.join(work, 'package.json'), JSON.stringify({ name: 'labzen-ensayo-13b', private: true }));
  fs.copyFileSync(path.join(__dirname, 'schema.prisma'), path.join(work, 'schema.prisma'));
  fs.mkdirSync(path.join(work, 'node_modules', '@prisma'), { recursive: true });
  // Solo resolución del generador instalado. La salida se escribe en work/generated/client.
  fs.symlinkSync(path.join(backend, 'node_modules', '@prisma/client'), path.join(work, 'node_modules/@prisma/client'), 'dir');
  const env = entornoLimpio({
    ENSAYO_DATABASE_URL: 'mysql://ensayo13b:offline@127.0.0.1:1/labzen_ident_13b_offline',
    NODE_OPTIONS: `--require=${path.join(__dirname, 'sin-red.cjs')}`,
  });
  const cli = path.join(backend, 'node_modules/prisma/build/index.js');
  const run = args => ejecutar(process.execPath, [cli, ...args], { cwd: work, env });
  console.log(run(['--version']));
  console.log(run(['validate', '--schema', path.join(work, 'schema.prisma')]));
  console.log(run(['generate', '--schema', path.join(work, 'schema.prisma')]));
  // Renderiza SQL desde el modelo vacío, SIN base origen/destino ni aplicación de DDL.
  const ddl = run(['migrate', 'diff', '--from-empty', '--to-schema-datamodel',
    path.join(work, 'schema.prisma'), '--script']);
  assert.match(ddl, /`claveIdentificacion` VARCHAR\(64\) NULL/);
  assert.match(ddl, /UNIQUE (?:INDEX|KEY) `uq_ensayo_clave`\s*\(`claveIdentificacion`\)/);
  assert.doesNotMatch(ddl, /\bCHECK\s*\(/);
  fs.writeFileSync(path.join(work, 'representacion-prisma-no-aplicar.sql'), ddl);
  console.log('DDL renderizado sin ejecutarlo: clave nullable UNIQUE; CHECK deben mantenerse en SQL explícito.');

  fs.writeFileSync(path.join(work, 'comprobar-generado.cjs'), `
    const assert = require('node:assert/strict');
    const { Prisma } = require('./generated/client');
    assert.equal(Prisma.prismaVersion.client, '6.19.3');
    const paciente = Prisma.dmmf.datamodel.models.find(m => m.name === 'Paciente');
    const clave = paciente.fields.find(f => f.name === 'claveIdentificacion');
    assert.equal(clave.type, 'String');
    assert.equal(clave.isRequired, false);
    assert.equal(clave.isUnique, true);
    console.log(JSON.stringify({ cliente: Prisma.prismaVersion, claveNullableUnica: true }));
  `);
  console.log(ejecutar(process.execPath, [path.join(work, 'comprobar-generado.cjs')], { cwd: work, env }));
  fs.writeFileSync(path.join(work, 'contrato-generado.ts'), `
    import { Prisma } from './generated/client';
    const nueva: Prisma.PacienteCreateInput = { estadoIdentificacion: 'SIN_DOCUMENTO_ASIGNADO', claveIdentificacion: null };
    const consulta: Prisma.PacienteWhereUniqueInput = { claveIdentificacion: 'CC:CO:00123456' };
    // @ts-expect-error NULL no es una identidad confirmada para findUnique.
    const consultaNula: Prisma.PacienteWhereUniqueInput = { claveIdentificacion: null };
    void [nueva, consulta, consultaNula];
  `);
  ejecutar(process.execPath, [path.join(backend, 'node_modules/typescript/bin/tsc'),
    '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'commonjs',
    '--moduleResolution', 'node', path.join(work, 'contrato-generado.ts')], { cwd: work, env });
  console.log('Contrato generado: nullable en creación; null rechazado en WhereUniqueInput. Typecheck aprobado.');
  console.log('Artefactos offline independientes:', work);
  return work;
}

async function ejecutarMySQL(work) {
  // Sin --pull: solo imagen que YA esté instalada. No sudo, contextos remotos ni credenciales del proyecto.
  dockerConfig = path.join(work, 'docker-config');
  fs.mkdirSync(dockerConfig, { mode: 0o700 });
  docker(['version', '--format', '{{.Server.Version}}']);
  const image = JSON.parse(docker(['image', 'inspect', 'mysql:8.4']))[0];
  const token = crypto.randomBytes(12).toString('hex');
  const contexto = { token, database: 'labzen_ident_13b_' + token,
    password: crypto.randomBytes(24).toString('hex'), imageId: image.Id,
    networkName: 'labzen-ident-13b-' + token, createdAfter: Date.now(), parentPid: process.pid };
  const rootPassword = crypto.randomBytes(24).toString('hex');
  const credenciales = path.join(work, 'servidor-desechable.list');
  fs.writeFileSync(credenciales, `MYSQL_DATABASE=${contexto.database}\nMYSQL_USER=ensayo13b\nMYSQL_PASSWORD=${contexto.password}\nMYSQL_ROOT_PASSWORD=${rootPassword}\n`, { mode: 0o600 });
  try {
    contexto.networkId = docker(['network', 'create', '--internal', '--driver', 'bridge',
      '--label', `${LABEL}=${token}`, contexto.networkName]).trim();
    contexto.containerId = docker(['run', '--detach', '--pull=never',
      '--name', contexto.networkName, '--label', `${LABEL}=${token}`,
      '--network', contexto.networkName, '--ipc=private',
      '--publish', '127.0.0.1::3306', '--tmpfs', '/var/lib/mysql:rw,nosuid,size=512m',
      '--env-file', credenciales, image.Id,
      '--bind-address=0.0.0.0', '--mysqlx=0', '--skip-name-resolve',
      '--character-set-server=utf8mb4', '--collation-server=utf8mb4_0900_bin',
      '--sql-mode=STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION']).trim();
    const container = inspeccionar('container', contexto.containerId);
    contexto.port = container.NetworkSettings.Ports['3306/tcp'][0].HostPort;
    const url = `mysql://ensayo13b:${contexto.password}@127.0.0.1:${contexto.port}/${contexto.database}?connection_limit=4`;
    const guard = async () => {
      validarDestino(url, contexto);
      validarAislamiento(inspeccionar('container', contexto.containerId),
        inspeccionar('network', contexto.networkId), contexto);
    };
    await guard();
    // Solo un hijo de entorno limpio importa el cliente, sin dotenv ni configuración de LabZen.
    const contextoPath = path.join(work, 'contexto-desechable.json');
    fs.writeFileSync(contextoPath, JSON.stringify({ ...contexto, url, work }), { mode: 0o600 });
    console.log('Instancia NUEVA:', contexto.containerId, 'red interna:', contexto.networkId);
    // El hijo usa exactamente el mismo guard antes de cada consulta.
    ejecutar(process.execPath, [__filename, '--hijo-mysql', contextoPath], {
      cwd: work, timeout: 300000, env: entornoLimpio(),
    });
    console.log(fs.readFileSync(path.join(work, 'resultado-mysql.json'), 'utf8'));
  } finally {
    // Solo IDs creados en ESTA ejecución y con etiqueta coincidente; nunca limpieza global.
    if (contexto.containerId) {
      const actual = inspeccionar('container', contexto.containerId);
      assert.equal(actual.Config.Labels[LABEL], token);
      docker(['container', 'rm', '--force', contexto.containerId]);
    }
    if (contexto.networkId) {
      const actual = inspeccionar('network', contexto.networkId);
      assert.equal(actual.Labels[LABEL], token);
      docker(['network', 'rm', contexto.networkId]);
    }
    fs.unlinkSync(credenciales);
  }
}

async function hijoMySQL(file) {
  const contexto = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(path.dirname(file), contexto.work);
  assert.equal(process.ppid, contexto.parentPid, 'El hijo debe pertenecer al proceso que creó la instancia.');
  dockerConfig = path.join(contexto.work, 'docker-config');
  validarDestino(contexto.url, contexto);
  const guard = async () => validarAislamiento(inspeccionar('container', contexto.containerId),
    inspeccionar('network', contexto.networkId), contexto);
  await guard();
  const { PrismaClient, Prisma } = require(path.join(contexto.work, 'generated/client'));
  const base = new PrismaClient({ datasources: { db: { url: contexto.url } } });
  const client = base.$extends({ query: { async $allOperations({ args, query }) {
    await guard();
    return query(args);
  } } });
  try {
    // Readiness exclusivamente en el servidor recién creado, por un máximo de 60 segundos.
    const deadline = Date.now() + 60000;
    while (true) {
      await guard();
      try { await client.$queryRawUnsafe('SELECT 1'); break; }
      catch (error) {
        if (!['P1001', 'P1002', 'P1017'].includes(error.errorCode || error.code) || Date.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    const version = await client.$queryRawUnsafe('SELECT VERSION() AS version, DATABASE() AS db, @@sql_mode AS modo');
    assert.match(version[0].version, /^8\.4\./);
    assert.doesNotMatch(version[0].version, /mariadb/i);
    assert.equal(version[0].db, contexto.database);
    assert.match(version[0].modo, /STRICT_ALL_TABLES/);
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8').replace(/--[^\n]*/g, '');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      assert.match(statement, /^CREATE TABLE ensayo_[a-z_]+\s*\(/);
      await client.$executeRawUnsafe(statement);
    }
    require('tsx/cjs');
    const { ejecutarIntegracion } = require('./integracion.cjs');
    const resultado = await ejecutarIntegracion(client, { Prisma, guard });
    fs.writeFileSync(path.join(contexto.work, 'resultado-mysql.json'), JSON.stringify({
      mysql: version, prisma: Prisma.prismaVersion, ...resultado,
    }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } finally { await base.$disconnect(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--hijo-mysql' && args.length === 2) return hijoMySQL(args[1]);
  assert.ok(args.length === 1 && args[0] === '--offline'
    || args.length === 2 && args[0] === '--mysql' && args[1] === '--confirmar-instancia-nueva',
  'Uso: node ensayo.cjs --offline | --mysql --confirmar-instancia-nueva');
  const work = prepararOffline();
  if (args[0] === '--mysql') await ejecutarMySQL(work);
}
if (require.main === module) main().catch(error => {
  console.error(error.message.replace(/mysql:\/\/\S+/g, '[URL sintética omitida]'));
  process.exitCode = 1;
});
