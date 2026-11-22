import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calcularEdad } from '../utils/format';

describe('Edad actual: años completos, con fecha local de referencia controlada', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // Constructor local intencional: producción mezcla hoy local y nacimiento UTC.
    vi.setSystemTime(new Date(2026, 10, 22, 12));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ['adulto con cumpleaños cumplido', '1990-05-12T00:00:00.000Z', 36],
    ['adulto antes del cumpleaños', '1990-12-12T00:00:00.000Z', 35],
    ['cumpleaños de hoy', '1990-11-22T00:00:00.000Z', 36],
    ['menor de un año (limitación: no devuelve meses)', '2026-03-22T00:00:00.000Z', 0],
    ['nacido hoy (limitación: no devuelve días)', '2026-11-22T00:00:00.000Z', 0],
  ])('%s', (_nombre, nacimiento, esperado) => {
    expect(calcularEdad(nacimiento)).toBe(esperado);
  });

  it('cambio de año: espera el aniversario del 31 de diciembre, no solo el año numérico', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 0, 5));
    expect(calcularEdad('2025-12-31T00:00:00.000Z')).toBe(0);
    vi.setSystemTime(new Date(2026, 11, 31, 12));
    expect(calcularEdad('2025-12-31T00:00:00.000Z')).toBe(1);
  });

  it('29 de febrero: actualmente cumple años el 1 de marzo de un año no bisiesto', () => {
    vi.setSystemTime(new Date(2025, 1, 28, 12));
    expect(calcularEdad('2000-02-29T00:00:00.000Z')).toBe(24);
    vi.setSystemTime(new Date(2025, 2, 1, 12));
    expect(calcularEdad('2000-02-29T00:00:00.000Z')).toBe(25);
  });

  it('LIMITACIÓN: nacimiento futuro produce edad negativa en vez de un error controlado', () => {
    expect(calcularEdad('2026-11-23T00:00:00.000Z')).toBe(-1);
  });

  it('LIMITACIÓN: fecha inválida produce NaN', () => {
    expect(calcularEdad('no-es-fecha')).toBeNaN();
  });
});
