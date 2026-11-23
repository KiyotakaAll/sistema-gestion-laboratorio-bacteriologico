import { describe, expect, it } from 'vitest';
import { diaColombia, edadCivil, edadALaToma, fechaCivilValida, formatEdad } from '../utils/format';

describe('Edad civil con referencia explícita', () => {
  it.each([
    ['1990-05-12', '2026-11-22', '36 años'], ['1990-12-12', '2026-11-22', '35 años'],
    ['2026-03-22', '2026-11-22', '8 meses'], ['2026-11-10', '2026-11-22', '12 días'],
    ['2026-11-22', '2026-11-22', '0 días'], ['2026-11-21', '2026-11-22', '1 día'],
    ['2026-10-22', '2026-11-22', '1 mes'], ['2025-11-22', '2026-11-22', '1 año'],
    ['2025-12-31', '2026-01-01', '1 día'], ['2025-01-31', '2025-02-28', '28 días'],
    ['2025-01-31', '2025-03-01', '1 mes'], ['2024-02-29', '2025-02-28', '11 meses'],
    ['2024-02-29', '2025-03-01', '1 año'], ['2024-02-28', '2024-03-01', '2 días'],
  ])('%s a %s -> %s', (nacimiento, referencia, esperado) => {
    expect(formatEdad(nacimiento, referencia)).toBe(esperado);
    expect(formatEdad(nacimiento + 'T00:00:00.000Z', referencia)).toBe(esperado);
  });
  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-01', '2026-1-01', '', 'no-es-fecha'])('rechaza civil inválida %s sin NaN', fecha => {
    expect(fechaCivilValida(fecha)).toBe(false); expect(formatEdad(fecha, '2026-11-22')).toBe('—');
  });
  it('no admite referencias inválidas o anteriores al nacimiento', () => {
    expect(edadCivil('2026-11-22', '2026-11-21')).toBeNull();
    expect(edadCivil('2020-01-01', '2026-02-30')).toBeNull();
  });
  it('cambio de día usa Colombia, aunque el instante esté expresado en UTC', () => {
    expect(diaColombia(new Date('2026-11-22T04:59:59Z'))).toBe('2026-11-21');
    expect(diaColombia(new Date('2026-11-22T05:00:00Z'))).toBe('2026-11-22');
    expect(edadALaToma('2026-11-20', '2026-11-22T04:59:59Z')).toBe('1 día');
    expect(edadALaToma('2026-11-20', '2026-11-22T05:00:00Z')).toBe('2 días');
  });
  it('toma inválida o anterior al nacimiento muestra ausencia controlada', () => {
    expect(edadALaToma('2026-11-20', 'inválida')).toBe('—');
    expect(edadALaToma('2026-11-20', '2026-11-19T12:00:00Z')).toBe('—');
  });
});
