'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { LABEL, entornoLimpio, validarDestino, validarAislamiento } = require('./seguridad.cjs');

function fixture() {
  const token = 'a'.repeat(24);
  const contexto = { token, containerId: 'b'.repeat(64), networkId: 'c'.repeat(64),
    imageId: 'sha256:' + 'd'.repeat(64), networkName: 'labzen-ident-13b-' + token,
    port: '49123', database: 'labzen_ident_13b_' + token, password: 'e'.repeat(48), createdAfter: 1000 };
  const container = { Id: contexto.containerId, Image: contexto.imageId, Created: new Date(2000).toISOString(),
    Config: { Labels: { [LABEL]: token } }, State: { Running: true },
    HostConfig: { Privileged: false, Binds: null, VolumesFrom: null, NetworkMode: contexto.networkName,
      PidMode: '', IpcMode: 'private', CapAdd: null, Tmpfs: { '/var/lib/mysql': 'rw,nosuid,size=512m' } },
    Mounts: [{ Type: 'tmpfs', Destination: '/var/lib/mysql' }],
    NetworkSettings: { Networks: { [contexto.networkName]: { NetworkID: contexto.networkId } },
      Ports: { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: contexto.port }], '33060/tcp': null } } };
  const network = { Id: contexto.networkId, Name: contexto.networkName,
    Labels: { [LABEL]: token }, Internal: true, Driver: 'bridge',
    Containers: { [contexto.containerId]: {} } };
  const url = `mysql://ensayo13b:${contexto.password}@127.0.0.1:${contexto.port}/${contexto.database}?connection_limit=4`;
  return { contexto, container, network, url };
}

test('acepta únicamente la forma de instancia efímera prevista (no demuestra un Docker real)', () => {
  const f = fixture();
  validarDestino(f.url, f.contexto);
  validarAislamiento(f.container, f.network, f.contexto);
});

for (const [nombre, mutar] of [
  ['host remoto', u => { u.hostname = 'ejemplo.invalid'; }],
  ['localhost ambiguo', u => { u.hostname = 'localhost'; }],
  ['puerto diferente', u => { u.port = '3306'; }],
  ['base ajena', u => { u.pathname = '/laboratorio_bacteriologico'; }],
  ['usuario ajeno', u => { u.username = 'root'; }],
  ['contraseña ajena', u => { u.password = 'otra'; }],
  ['parámetros extra', u => { u.searchParams.set('socket', '/tmp/mysql.sock'); }],
  ['fragmento extra', u => { u.hash = '#otro'; }],
  ['protocolo ajeno', u => { u.protocol = 'postgresql:'; }],
]) test('destino: rechaza ' + nombre, () => {
  const f = fixture();
  const u = new URL(f.url);
  mutar(u);
  assert.throws(() => validarDestino(u.href, f.contexto));
});

for (const [nombre, mutar] of [
  ['otro contenedor', f => { f.container.Id = 'ajeno'; }],
  ['otra etiqueta', f => { f.container.Config.Labels[LABEL] = 'ajena'; }],
  ['otra imagen', f => { f.container.Image = 'ajena'; }],
  ['servidor detenido', f => { f.container.State.Running = false; }],
  ['instancia anterior', f => { f.container.Created = new Date(0).toISOString(); }],
  ['privileged', f => { f.container.HostConfig.Privileged = true; }],
  ['bind mount', f => { f.container.HostConfig.Binds = ['/datos:/var/lib/mysql']; }],
  ['volumen heredado', f => { f.container.HostConfig.VolumesFrom = ['otra-base']; }],
  ['volumen persistente', f => { f.container.Mounts[0].Type = 'volume'; }],
  ['tmpfs faltante', f => { delete f.container.HostConfig.Tmpfs['/var/lib/mysql']; }],
  ['mount adicional', f => { f.container.Mounts.push({ Type: 'bind', Destination: '/etc/mysql' }); }],
  ['red host', f => { f.container.HostConfig.NetworkMode = 'host'; }],
  ['red adicional', f => { f.container.NetworkSettings.Networks.otra = { NetworkID: 'otra' }; }],
  ['publicación externa', f => { f.container.NetworkSettings.Ports['3306/tcp'][0].HostIp = '0.0.0.0'; }],
  ['puerto adicional', f => { f.container.NetworkSettings.Ports['33060/tcp'] = [{ HostIp: '127.0.0.1', HostPort: '49124' }]; }],
  ['red con salida', f => { f.network.Internal = false; }],
  ['otra instancia conectada', f => { f.network.Containers.ajeno = {}; }],
  ['PID host', f => { f.container.HostConfig.PidMode = 'host'; }],
  ['IPC host', f => { f.container.HostConfig.IpcMode = 'host'; }],
  ['capacidad adicional', f => { f.container.HostConfig.CapAdd = ['NET_ADMIN']; }],
]) test('aislamiento: rechaza ' + nombre, () => {
  const f = fixture();
  mutar(f);
  assert.throws(() => validarAislamiento(f.container, f.network, f.contexto));
});

test('el entorno hijo se construye sin copiar ninguna variable heredada', () => {
  assert.deepEqual(Object.keys(entornoLimpio()).sort(), [
    'PATH', 'LANG', 'TZ', 'PRISMA_GENERATE_SKIP_AUTOINSTALL',
    'CHECKPOINT_DISABLE', 'PRISMA_HIDE_UPDATE_MESSAGE', 'TSX_DISABLE_CACHE',
  ].sort());
});

for (const [nombre, code] of [
  ['TCP', "require('node:net').connect(3306, '127.0.0.1')"],
  ['TLS', "require('node:tls').connect(443, 'ejemplo.invalid')"],
  ['fetch', "fetch('https://ejemplo.invalid')"],
  ['archivo .env', "require('node:fs').readFileSync('/archivo-inexistente/.env')"],
  ['archivo .env.local', "require('node:fs').readFileSync('/archivo-inexistente/.env.local')"],
]) test('preload offline bloquea ' + nombre + ' antes de acceder', () => {
  const child = spawnSync(process.execPath, ['--require', path.join(__dirname, 'sin-red.cjs'), '-e', code],
    { env: entornoLimpio(), encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Ensayo offline:/);
});
