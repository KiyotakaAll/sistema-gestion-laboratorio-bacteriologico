export interface ControlOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function normalizarBusqueda(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}
