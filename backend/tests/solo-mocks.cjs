// Precarga de seguridad para las suites *.test.cjs. No usar con smoke.ts.
// Las rutas reales se prueban en memoria: cualquier conexión o PrismaClient real falla.
const Module = require('node:module');
const net = require('node:net');
const tls = require('node:tls');
const cargar = Module._load;
const bloquearConexion = () => { throw new Error('Prueba aislada: conexión de red prohibida'); };
net.Socket.prototype.connect = bloquearConexion;
tls.connect = bloquearConexion;
globalThis.fetch = bloquearConexion;

Module._load = function (nombre, ...args) {
  if (nombre === 'dotenv' || nombre.startsWith('dotenv/')) {
    throw new Error('Prueba aislada: dotenv prohibido; sustituya config/env antes de cargar rutas');
  }
  const modulo = cargar.call(this, nombre, ...args);
  if (nombre !== '@prisma/client') return modulo;
  return new Proxy(modulo, {
    get(objeto, clave) {
      if (clave === 'PrismaClient') return class {
        constructor() { throw new Error('Prueba aislada: PrismaClient real prohibido'); }
      };
      return Reflect.get(objeto, clave);
    },
  });
};
