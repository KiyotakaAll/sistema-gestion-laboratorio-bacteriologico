/** Reglas puras: no confundir material biológico con localización anatómica. */
export const normalizarCatalogo = (valor: string) => valor.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');

export const listaTextos = (valor: unknown): string[] => Array.isArray(valor)
  ? valor.filter((v): v is string => typeof v === 'string') : [];

export function tipoCompatible(requerido: string, elegido: string): boolean {
  return normalizarCatalogo(requerido) === 'variable'
    || normalizarCatalogo(requerido) === normalizarCatalogo(elegido);
}

export function sitioCompatible(tipos: unknown, tipo: string): boolean {
  return listaTextos(tipos).some(t => normalizarCatalogo(t) === normalizarCatalogo(tipo));
}
