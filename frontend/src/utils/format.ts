import type { Sexo } from '../types/api';

const VACIO = '—';

const fechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
const fecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
// Las columnas DATE de MySQL llegan como medianoche UTC: se formatean en UTC
// para que un paciente nacido el 12 no aparezca como nacido el 11 en zonas UTC-5.
const fechaUtc = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' });

export function formatFechaHora(iso?: string | null): string {
  return iso ? fechaHora.format(new Date(iso)) : VACIO;
}

export function formatFecha(iso?: string | null): string {
  return iso ? fecha.format(new Date(iso)) : VACIO;
}

export function formatFechaDia(iso?: string | null): string {
  return iso ? fechaUtc.format(new Date(iso)) : VACIO;
}

export function calcularEdad(fechaNacimientoIso: string): number {
  const nacimiento = new Date(fechaNacimientoIso);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getUTCFullYear();
  const mes = hoy.getMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getUTCDate())) {
    edad -= 1;
  }
  return edad;
}

export function nombrePaciente(p: { nombres: string; apellidos: string }): string {
  return `${p.apellidos}, ${p.nombres}`;
}

export function aInputFecha(iso: string): string {
  return iso.slice(0, 10);
}

/** Valor para <input type="datetime-local"> con la hora local actual. */
export function ahoraParaInput(): string {
  const ahora = new Date();
  ahora.setSeconds(0, 0);
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function inicioDelDia(fechaInput: string): string {
  return new Date(`${fechaInput}T00:00:00`).toISOString();
}

export function finDelDia(fechaInput: string): string {
  return new Date(`${fechaInput}T23:59:59.999`).toISOString();
}

export const SEXO_ETIQUETA: Record<Sexo, string> = { M: 'Masculino', F: 'Femenino', O: 'Otro' };

/** Quita claves vacías para no enviar `?cedula=` al API. */
export function limpiarParams<T extends object>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== ''),
  ) as T;
}

/** Texto opcional de formulario: cadena vacía pasa a `undefined`. */
export function opcional(valor: string): string | undefined {
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : undefined;
}

export function numeroDeParametro(valor: string | null): number | null {
  if (!valor) return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}
