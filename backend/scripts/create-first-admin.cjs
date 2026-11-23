'use strict';

// Herramienta manual. No importa dotenv, env.ts, seed ni el servidor.
// --help y node --check son seguros: no cargan Prisma ni abren conexiones.
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');

class OperatorError extends Error {}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    console.log('Uso: node backend/scripts/create-first-admin.cjs');
    console.log('Solo tras autorizar la inicializacion. Requiere TTY privada, conexion autorizada,');
    console.log('dependencias existentes y Prisma Client generado. Solicita URL y claves sin eco.');
    console.log('No lee .env ni DATABASE_URL, no admite credenciales por argumentos.');
    return;
  }
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new OperatorError('Ejecute sin argumentos en una terminal privada e interactiva.');
  }

  // Readline escribe el eco en esta salida; las entradas secretas se silencian.
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  // Sin historial: una flecha arriba en un prompt visible no debe recuperar secretos.
  const rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const abort = new AbortController();
  rl.on('SIGINT', () => abort.abort());
  async function ask(label, secret = false) {
    if (secret) process.stdout.write(label);
    muted = secret;
    try {
      return await rl.question(secret ? '' : label, { signal: abort.signal });
    } finally {
      muted = false;
      if (secret) process.stdout.write('\n');
    }
  }

  let prisma;
  let connectionUrl = '';
  let password = '';
  let confirmation = '';
  try {
    connectionUrl = await ask('URL MySQL autorizada (oculta, con password URL-encoded): ', true);
    let target;
    try { target = new URL(connectionUrl); }
    catch { throw new OperatorError('URL MySQL invalida. No se ha conectado.'); }
    if (target.protocol !== 'mysql:' || !target.hostname || !target.username || !target.password
        || !/^\/[^/]+$/.test(target.pathname) || target.hash
        || target.searchParams.get('sslaccept') === 'accept_invalid_certs') {
      throw new OperatorError('URL incompleta o insegura. Revise la guia de conexion.');
    }
    const database = decodeURIComponent(target.pathname.slice(1));
    if (['mysql', 'sys', 'performance_schema', 'information_schema'].includes(database.toLowerCase())) {
      throw new OperatorError('No se permiten bases de sistema.');
    }
    console.log('Destino:', JSON.stringify({ host: target.hostname, port: target.port || '3306', database }));
    const username = (await ask('Username del primer administrador: ')).trim();
    const email = (await ask('Correo institucional: ')).trim().toLowerCase();
    const nombreCompleto = (await ask('Nombre completo: ')).trim();
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username)) {
      throw new OperatorError('Username: 3 a 40 caracteres, letras, numeros, punto, guion o guion bajo.');
    }
    const { z } = require('zod');
    if (!z.string().email().max(120).safeParse(email).success
        || nombreCompleto.length < 3 || nombreCompleto.length > 120) {
      throw new OperatorError('Revise correo (maximo 120) y nombre completo (3 a 120).');
    }
    password = await ask('Nueva contraseña (oculta): ', true);
    confirmation = await ask('Repita la contraseña (oculta): ', true);
    // Misma politica de registro; bcrypt solo considera hasta 72 bytes.
    if (password !== confirmation || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72
        || !/[a-z]/.test(password) || !/[A-Z]/.test(password)
        || !/[0-9]/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) {
      throw new OperatorError('Las claves deben coincidir: 12+ caracteres, maximo 72 bytes, mayuscula, minuscula, numero y simbolo.');
    }
    if (await ask(`Para autorizar UN usuario y su auditoria, escriba CREAR ${database}: `) !== `CREAR ${database}`) {
      throw new OperatorError('Operacion cancelada. No se ha conectado.');
    }

    const bcrypt = require('bcrypt');
    const { PrismaClient, Prisma } = require('@prisma/client');
    const passwordHash = await bcrypt.hash(password, 12);
    password = '';
    confirmation = '';
    // Sin logs de consultas/errores: no se imprimen URL, hashes ni objetos Prisma.
    prisma = new PrismaClient({ datasources: { db: { url: connectionUrl } }, log: [] });
    connectionUrl = '';
    target = null;
    const id = await prisma.$transaction(async (tx) => {
      const roles = await tx.rol.findMany({ select: { id: true, nombre: true } });
      const expected = ['ADMINISTRADOR', 'BACTERIOLOGO', 'RECEPCIONISTA', 'VALIDADOR'];
      if (roles.length !== 4 || roles.map((r) => r.nombre).sort().join(',') !== expected.join(',')) {
        throw new OperatorError('No estan los cuatro roles exactos; verifique la inicializacion.');
      }
      // Bootstrap exclusivamente: no eleva, actualiza ni reemplaza cuentas existentes.
      if (await tx.usuario.count() !== 0) {
        throw new OperatorError('Ya existen usuarios. Se cancela la creacion del primer administrador.');
      }
      const adminRole = roles.find((r) => r.nombre === 'ADMINISTRADOR');
      const user = await tx.usuario.create({
        data: { username, email, nombreCompleto, passwordHash, rolId: adminRole.id, activo: true },
        select: { id: true },
      });
      await tx.logAuditoria.create({
        data: { usuarioId: user.id, entidad: 'USUARIO', entidadId: user.id, accion: 'CREAR_ADMIN_INICIAL' },
        select: { id: true },
      });
      return user.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    console.log(`Administrador inicial creado (id ${id}). Ejecute la verificacion de solo lectura.`);
  } finally {
    password = '';
    confirmation = '';
    connectionUrl = '';
    rl.close();
    if (prisma) await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof OperatorError ? error.message
    : 'Operacion interrumpida o fallida. No se muestran detalles sensibles. Verifique mediante consultas de solo lectura antes de reintentar.');
  process.exitCode = 1;
});
