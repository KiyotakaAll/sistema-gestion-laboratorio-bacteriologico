// Ignora rechazos asíncronos del motor de Prisma si no hay MySQL disponible (estos casos no consultan la BD).
process.on('unhandledRejection', () => undefined);
process.env.DATABASE_URL = 'mysql://root@localhost:3306/laboratorio_bacteriologico';
process.env.JWT_SECRET = 'x'.repeat(40);
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';

const SECRET = process.env.JWT_SECRET as string;
const token = (rol: string, opts: jwt.SignOptions = {}) =>
  jwt.sign({ sub: '7', username: 'u', nombre: 'Usuario Prueba', rol }, SECRET, { algorithm: 'HS256', expiresIn: 600, ...opts });

let fallos = 0;
async function caso(nombre: string, esperadoStatus: number, esperadoCode: string | null, req: { method?: string; path: string; token?: string; body?: string; raw?: boolean }, base: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (req.token) headers.Authorization = `Bearer ${req.token}`;
  const res = await fetch(base + req.path, { method: req.method ?? 'GET', headers, body: req.body });
  const json: any = await res.json().catch(() => ({}));
  const code = json?.error?.code ?? null;
  const ok = res.status === esperadoStatus && (esperadoCode === null || code === esperadoCode);
  if (!ok) fallos++;
  const extra = json?.error?.details ? ' ' + JSON.stringify(json.error.details).slice(0, 110) : '';
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(res.status)} ${String(code).padEnd(22)} ${nombre}${extra}`);
}

(async () => {
  const { default: app } = await import('../src/app');
  const server: Server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: '7', username: 'u', nombre: 'x', rol: 'ADMINISTRADOR' })).toString('base64url') + '.';

  await caso('sin token', 401, 'NO_AUTENTICADO', { path: '/api/muestras' }, base);
  await caso('token basura', 401, 'TOKEN_INVALIDO', { path: '/api/muestras', token: 'abc.def.ghi' }, base);
  await caso('token firmado con otro secreto', 401, 'TOKEN_INVALIDO', { path: '/api/muestras', token: jwt.sign({ sub: '1', username: 'u', nombre: 'n', rol: 'ADMINISTRADOR' }, 'y'.repeat(40)) }, base);
  await caso('ataque alg:none', 401, 'TOKEN_INVALIDO', { path: '/api/muestras', token: none }, base);
  await caso('token expirado', 401, 'TOKEN_EXPIRADO', { path: '/api/muestras', token: token('ADMINISTRADOR', { expiresIn: -10 }) }, base);
  await caso('rol inexistente en payload', 401, 'TOKEN_INVALIDO', { path: '/api/muestras', token: token('SUPERUSER') }, base);
  await caso('RECEPCIONISTA no puede procesar', 403, 'ACCESO_DENEGADO', { method: 'PATCH', path: '/api/muestras/1/procesar', token: token('RECEPCIONISTA') }, base);
  await caso('BACTERIOLOGO no puede validar', 403, 'ACCESO_DENEGADO', { method: 'PATCH', path: '/api/resultados/1/validar', token: token('BACTERIOLOGO') }, base);
  await caso('ADMIN sin bypass en doble firma', 403, 'ACCESO_DENEGADO', { method: 'PATCH', path: '/api/resultados/1/validar', token: token('ADMINISTRADOR') }, base);
  await caso('RECEPCIONISTA no ve resultados', 403, 'ACCESO_DENEGADO', { path: '/api/resultados', token: token('RECEPCIONISTA') }, base);
  await caso('POST muestra vacio -> Zod', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/muestras', token: token('RECEPCIONISTA'), body: '{}' }, base);
  await caso('JSON malformado', 400, 'JSON_INVALIDO', { method: 'POST', path: '/api/muestras', token: token('RECEPCIONISTA'), body: '{"a":' }, base);
  await caso('fecha de toma futura', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/muestras', token: token('RECEPCIONISTA'), body: JSON.stringify({ solicitudId: 1, tipoMuestra: 'Orina', fechaToma: '2099-01-01', examenIds: [1] }) }, base);
  await caso('examenes repetidos', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/muestras', token: token('RECEPCIONISTA'), body: JSON.stringify({ solicitudId: 1, tipoMuestra: 'Orina', fechaToma: '2026-10-01', examenIds: [1, 1] }) }, base);
  await caso('rechazo sin motivo', 400, 'VALIDACION_FALLIDA', { method: 'PATCH', path: '/api/muestras/1/rechazar', token: token('RECEPCIONISTA'), body: '{}' }, base);
  await caso('id no numerico', 400, 'VALIDACION_FALLIDA', { path: '/api/muestras/abc', token: token('ADMINISTRADOR') }, base);
  await caso('page=0', 400, 'VALIDACION_FALLIDA', { path: '/api/muestras?page=0', token: token('ADMINISTRADOR') }, base);
  await caso('codigo de barras invalido', 400, 'VALIDACION_FALLIDA', { path: '/api/muestras/codigo/ab', token: token('ADMINISTRADOR') }, base);
  await caso('antibiograma sin bacteria', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/resultados', token: token('BACTERIOLOGO'), body: JSON.stringify({ muestraExamenId: 1, hallazgoGram: 'Cocos Gram +', antibiograma: [{ antibiotico: 'Amoxicilina', sensibilidad: 'S' }] }) }, base);
  await caso('resultado sin ningun hallazgo', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/resultados', token: token('BACTERIOLOGO'), body: JSON.stringify({ muestraExamenId: 1 }) }, base);
  await caso('antibiotico repetido', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/resultados', token: token('BACTERIOLOGO'), body: JSON.stringify({ muestraExamenId: 1, bacteriaAislada: 'E. coli', antibiograma: [{ antibiotico: 'Amoxicilina', sensibilidad: 'S' }, { antibiotico: 'amoxicilina', sensibilidad: 'R' }] }) }, base);
  await caso('sensibilidad invalida', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/resultados', token: token('BACTERIOLOGO'), body: JSON.stringify({ muestraExamenId: 1, bacteriaAislada: 'E. coli', antibiograma: [{ antibiotico: 'Amoxicilina', sensibilidad: 'X' }] }) }, base);
  await caso('login vacio', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/auth/login', body: '{}' }, base);
  await caso('paciente cedula invalida', 400, 'VALIDACION_FALLIDA', { method: 'POST', path: '/api/pacientes', token: token('RECEPCIONISTA'), body: JSON.stringify({ cedula: '1', nombres: 'A', apellidos: 'B', fechaNacimiento: '2999-01-01', sexo: 'Z' }) }, base);
  await caso('solicitudes sin token', 401, 'NO_AUTENTICADO', { path: '/api/solicitudes' }, base);
  await caso('examenes sin token', 401, 'NO_AUTENTICADO', { path: '/api/examenes' }, base);
  await caso('RESULTADO: BACTERIOLOGO no crea solicitudes', 403, 'ACCESO_DENEGADO', { method: 'POST', path: '/api/solicitudes', token: token('BACTERIOLOGO'), body: '{}' }, base);
  await caso('BACTERIOLOGO no crea pacientes', 403, 'ACCESO_DENEGADO', { method: 'POST', path: '/api/pacientes', token: token('BACTERIOLOGO'), body: '{}' }, base);
  await caso('ruta inexistente', 404, 'RUTA_NO_ENCONTRADA', { path: '/api/nope' }, base);
  server.close();
  console.log(fallos === 0 ? '\nTODOS LOS CASOS PASARON' : `\n${fallos} CASOS FALLARON`);
  process.exit(fallos === 0 ? 0 : 1);
})();
