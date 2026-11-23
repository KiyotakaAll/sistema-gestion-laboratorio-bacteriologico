import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calcularEdad } from '../utils/format';

describe('Adaptador de años completos: referencia controlada en Colombia', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 1.3C: referencia estable en Colombia, independiente de TZ del equipo.
    vi.setSystemTime(new Date('2026-11-22T17:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ['adulto con cumpleaños cumplido', '1990-05-12T00:00:00.000Z', 36],
    ['adulto antes del cumpleaños', '1990-12-12T00:00:00.000Z', 35],
    ['cumpleaños de hoy', '1990-11-22T00:00:00.000Z', 36],
    ['menor de un año: adaptador numérico devuelve años completos', '2026-03-22T00:00:00.000Z', 0],
    ['nacido hoy: adaptador numérico devuelve cero años', '2026-11-22T00:00:00.000Z', 0],
  ])('%s', (_nombre, nacimiento, esperado) => {
    expect(calcularEdad(nacimiento)).toBe(esperado);
  });

  it('cambio de año: espera el aniversario del 31 de diciembre, no solo el año numérico', () => {
    vi.setSystemTime(new Date('2026-01-01T05:05:00Z'));
    expect(calcularEdad('2025-12-31T00:00:00.000Z')).toBe(0);
    vi.setSystemTime(new Date('2026-12-31T17:00:00Z'));
    expect(calcularEdad('2025-12-31T00:00:00.000Z')).toBe(1);
  });

  it('29 de febrero: actualmente cumple años el 1 de marzo de un año no bisiesto', () => {
    vi.setSystemTime(new Date('2025-02-28T17:00:00Z'));
    expect(calcularEdad('2000-02-29T00:00:00.000Z')).toBe(24);
    vi.setSystemTime(new Date('2025-03-01T17:00:00Z'));
    expect(calcularEdad('2000-02-29T00:00:00.000Z')).toBe(25);
  });

  it('CORREGIDO 1.3C: nacimiento futuro devuelve ausencia de edad válida', () => {
    expect(calcularEdad('2026-11-23T00:00:00.000Z')).toBeNull();
  });

  it('CORREGIDO 1.3C: fecha inválida devuelve null, nunca NaN', () => {
    expect(calcularEdad('no-es-fecha')).toBeNull();
  });
});
