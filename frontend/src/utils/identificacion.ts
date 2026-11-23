import type { PacienteResumen } from '../types/api';
export { CATALOGO_DOCUMENTOS } from '../../../backend/src/domain/identificacion/catalogo';

export function identificacionTexto(p: Pick<PacienteResumen, 'cedula' | 'identificacion'>): string {
  const i = p.identificacion;
  if (!i) return p.cedula ?? 'Sin identificación disponible';
  switch (i.estado) {
    case 'DOCUMENTADO': return `${i.tipo} ${i.numero}${i.tipo === 'PA' ? ` (${i.paisEmisor})` : ''}`;
    case 'SIN_DOCUMENTO_ASIGNADO': return 'Sin documento asignado';
    case 'DOCUMENTO_NO_DISPONIBLE': return 'Documento no disponible';
    case 'LEGADO_POR_REVISAR': return `${i.valorLegado} · Pendiente de clasificación`;
  }
}
