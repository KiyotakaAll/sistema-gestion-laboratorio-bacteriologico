/** Política compartida de estados. No depende de Prisma ni de configuración de servidor. */
export const TRANSICIONES_MUESTRA = {
  RECEPTAR: { desde: ['REGISTRADA'], hasta: 'RECEPTADA' },
  INICIAR_PROCESAMIENTO: { desde: ['RECEPTADA'], hasta: 'EN_PROCESAMIENTO' },
  RECHAZAR: { desde: ['REGISTRADA', 'RECEPTADA'], hasta: 'RECHAZADA' },
  COMPLETAR_PROCESAMIENTO: { desde: ['EN_PROCESAMIENTO'], hasta: 'PROCESADA' },
} as const;
export type AccionMuestra = keyof typeof TRANSICIONES_MUESTRA;

export function permiteTransicionMuestra(estado: string, accion: AccionMuestra): boolean {
  return TRANSICIONES_MUESTRA[accion].desde.some(desde => desde === estado);
}

export function permiteResultado(estadoMuestra: string, operacion: 'registrar' | 'corregir' | 'validar'): boolean {
  return estadoMuestra === 'EN_PROCESAMIENTO' ||
    (operacion !== 'registrar' && estadoMuestra === 'PROCESADA');
}
