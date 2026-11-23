/** Calendario civil compartido con frontend. No interpreta un DATE como hora local. */
export function fechaCivilValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [y, m, d] = valor.split('-').map(Number) as [number, number, number];
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const fecha = new Date(0);
  fecha.setUTCFullYear(y, m - 1, d);
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

/** Día civil del laboratorio en Colombia; independiente de TZ del servidor/navegador. */
export function diaColombia(instante = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  const parte = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

export type EdadCivil = { valor: number; unidad: 'años' | 'meses' | 'días' };

/** Aniversario estricto: 29-feb cumple el 1-mar en año no bisiesto.
 * Un mes completo exige alcanzar el mismo día; 31-ene -> 28-feb son días, no un mes.
 */
export function edadCivil(nacimiento: string, referencia: string): EdadCivil | null {
  if (!fechaCivilValida(nacimiento) || !fechaCivilValida(referencia) || nacimiento > referencia) return null;
  const [y, m, d] = nacimiento.split('-').map(Number) as [number, number, number];
  const [ry, rm, rd] = referencia.split('-').map(Number) as [number, number, number];
  const cumple = rm > m || (rm === m && rd >= d);
  const anios = ry - y - (cumple ? 0 : 1);
  if (anios >= 1) return { valor: anios, unidad: 'años' };
  const meses = (ry - y) * 12 + rm - m - (rd < d ? 1 : 0);
  if (meses >= 1) return { valor: meses, unidad: 'meses' };
  const dias = (valor: string) => {
    const [a, b, c] = valor.split('-').map(Number) as [number, number, number];
    const f = new Date(0); f.setUTCFullYear(a, b - 1, c); f.setUTCHours(0, 0, 0, 0);
    return f.getTime() / 86400000;
  };
  return { valor: dias(referencia) - dias(nacimiento), unidad: 'días' };
}
