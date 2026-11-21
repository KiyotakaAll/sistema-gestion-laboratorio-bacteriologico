/** Fechas civiles: aritmética UTC solo como calendario, nunca como instante local. */
export function civilParts(value: string): [number, number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return [year, month, day];
}
export function daysInMonth(year: number, month: number) {
  const d = new Date(0); d.setUTCFullYear(year, month, 0); return d.getUTCDate();
}
export function civilValue(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function civilDate(value: string) {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(0); date.setUTCFullYear(y, m - 1, d); date.setUTCHours(12, 0, 0, 0); return date;
}
export function addDays(value: string, amount: number) {
  const date = civilDate(value); date.setUTCDate(date.getUTCDate() + amount);
  return civilValue(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
export function addMonths(value: string, amount: number) {
  const [y, m, d] = civilParts(value)!;
  const date = civilDate(civilValue(y, m, 1)); date.setUTCMonth(date.getUTCMonth() + amount);
  return civilValue(date.getUTCFullYear(), date.getUTCMonth() + 1, Math.min(d, daysInMonth(date.getUTCFullYear(), date.getUTCMonth() + 1)));
}
export function todayCivil() {
  const now = new Date(); return civilValue(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
export function displayCivil(value: string) {
  return civilParts(value) ? value.split('-').reverse().join('/') : value;
}
export function parseCivilText(text: string) {
  const value = /^\d{8}$/.test(text)
    ? `${text.slice(4)}-${text.slice(2, 4)}-${text.slice(0, 2)}`
    : /^\d{2}\/\d{2}\/\d{4}$/.test(text) ? text.split('/').reverse().join('-') : text;
  return civilParts(value) ? value : null;
}
export function withinBounds(value: string, min?: string, max?: string) {
  return !!civilParts(value) && (!min || value >= min) && (!max || value <= max);
}
export function bounded(value: string, min = '0001-01-01', max = '9999-12-31') {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}
