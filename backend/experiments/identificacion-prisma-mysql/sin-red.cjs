'use strict';

// Preload exclusivo de las comprobaciones SIN base. Se hereda por los hijos Node.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const tls = require('node:tls');
function bloquearRed() { throw new Error('Ensayo offline: acceso de red prohibido.'); }
net.Socket.prototype.connect = bloquearRed;
tls.connect = bloquearRed;
globalThis.fetch = bloquearRed;
function comprobarArchivo(file) {
  if (typeof file === 'number') return;
  const nombre = path.basename(file instanceof URL ? file.pathname : String(file));
  if (nombre === '.env' || nombre.startsWith('.env.')) {
    throw new Error('Ensayo offline: lectura de .env prohibida.');
  }
}
for (const metodo of ['readFileSync', 'readFile']) {
  const original = fs[metodo];
  fs[metodo] = function (file, ...args) { comprobarArchivo(file); return original.call(this, file, ...args); };
}
const leer = fs.promises.readFile.bind(fs.promises);
fs.promises.readFile = (file, ...args) => { comprobarArchivo(file); return leer(file, ...args); };
