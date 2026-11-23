'use strict';

const assert = require('node:assert/strict');
const LABEL = 'labzen.ensayo.identificacion13b';

function entornoLimpio(extras = {}) {
  // Nunca propagar process.env: DATABASE_URL, DOCKER_HOST, credenciales, etc.
  return { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', TZ: 'UTC',
    PRISMA_GENERATE_SKIP_AUTOINSTALL: '1', CHECKPOINT_DISABLE: '1',
    PRISMA_HIDE_UPDATE_MESSAGE: '1', TSX_DISABLE_CACHE: '1', ...extras };
}

function validarDestino(url, contexto) {
  const u = new URL(url);
  assert.equal(u.protocol, 'mysql:');
  assert.equal(u.hostname, '127.0.0.1');
  assert.equal(u.port, String(contexto.port));
  assert.equal(u.pathname, '/' + contexto.database);
  assert.match(contexto.token, /^[a-f0-9]{24}$/);
  assert.equal(contexto.database, 'labzen_ident_13b_' + contexto.token);
  assert.equal(u.username, 'ensayo13b');
  assert.equal(u.password, contexto.password);
  assert.equal(u.hash, '');
  assert.match(contexto.password, /^[a-f0-9]{48}$/);
  assert.deepEqual([...u.searchParams], [['connection_limit', '4']]);
}

function validarAislamiento(container, network, contexto) {
  assert.equal(container.Id, contexto.containerId);
  assert.equal(container.Config.Labels[LABEL], contexto.token);
  assert.equal(container.Image, contexto.imageId);
  assert.equal(container.State.Running, true);
  assert.ok(Date.parse(container.Created) >= contexto.createdAfter,
    'La instancia debe haberse creado durante esta ejecución.');
  assert.equal(container.HostConfig.Privileged, false);
  assert.equal(container.HostConfig.Binds?.length ?? 0, 0);
  assert.equal(container.HostConfig.VolumesFrom?.length ?? 0, 0);
  assert.equal(container.HostConfig.NetworkMode, contexto.networkName);
  assert.equal(container.HostConfig.PidMode, '');
  assert.equal(container.HostConfig.IpcMode, 'private');
  assert.equal(container.HostConfig.CapAdd?.length ?? 0, 0);
  assert.ok(container.HostConfig.Tmpfs['/var/lib/mysql']);
  assert.equal(container.Mounts.length, 1);
  assert.equal(container.Mounts[0].Type, 'tmpfs');
  assert.equal(container.Mounts[0].Destination, '/var/lib/mysql');
  assert.deepEqual(Object.keys(container.NetworkSettings.Networks), [contexto.networkName]);
  assert.equal(container.NetworkSettings.Networks[contexto.networkName].NetworkID, contexto.networkId);
  const ports = container.NetworkSettings.Ports;
  assert.deepEqual(Object.keys(ports).filter(key => ports[key] !== null), ['3306/tcp']);
  assert.deepEqual(ports['3306/tcp'], [{ HostIp: '127.0.0.1', HostPort: String(contexto.port) }]);
  assert.equal(network.Id, contexto.networkId);
  assert.equal(network.Name, contexto.networkName);
  assert.equal(network.Labels[LABEL], contexto.token);
  assert.equal(network.Internal, true);
  assert.equal(network.Driver, 'bridge');
  assert.deepEqual(Object.keys(network.Containers), [contexto.containerId]);
}

module.exports = { LABEL, entornoLimpio, validarDestino, validarAislamiento };
