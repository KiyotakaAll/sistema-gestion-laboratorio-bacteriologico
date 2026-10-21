import type { EstadoMuestra, EstadoResultado, Prioridad, Sensibilidad } from '../../types/api';

type Tono = 'gris' | 'cielo' | 'violeta' | 'verde' | 'ambar' | 'rojo' | 'rosa';

const TONOS: Record<Tono, { caja: string; punto: string }> = {
  gris: { caja: 'bg-slate-100 text-slate-700 border-slate-300', punto: 'bg-slate-400' },
  cielo: { caja: 'bg-sky-50 text-sky-800 border-sky-300', punto: 'bg-sky-500' },
  violeta: { caja: 'bg-violeta-50 text-violeta-800 border-violeta-300', punto: 'bg-violeta-500' },
  verde: { caja: 'bg-emerald-50 text-emerald-800 border-emerald-300', punto: 'bg-emerald-500' },
  ambar: { caja: 'bg-amber-50 text-amber-900 border-amber-300', punto: 'bg-amber-500' },
  rojo: { caja: 'bg-rose-50 text-rose-800 border-rose-300', punto: 'bg-rose-500' },
  rosa: { caja: 'bg-pink-50 text-pink-800 border-pink-300', punto: 'bg-pink-500' },
};

export function Badge({ tono, children }: { tono: Tono; children: string }) {
  const estilo = TONOS[tono];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 text-xs font-semibold leading-5 ${estilo.caja}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${estilo.punto}`} aria-hidden />
      {children}
    </span>
  );
}

export const ETIQUETA_ESTADO_MUESTRA: Record<EstadoMuestra, string> = {
  REGISTRADA: 'Registrada',
  RECEPTADA: 'Receptada',
  EN_PROCESAMIENTO: 'En procesamiento',
  PROCESADA: 'Procesada',
  RECHAZADA: 'Rechazada',
};

const TONO_ESTADO_MUESTRA: Record<EstadoMuestra, Tono> = {
  REGISTRADA: 'gris',
  RECEPTADA: 'cielo',
  EN_PROCESAMIENTO: 'violeta',
  PROCESADA: 'verde',
  RECHAZADA: 'rojo',
};

export function EstadoMuestraBadge({ estado }: { estado: EstadoMuestra }) {
  return <Badge tono={TONO_ESTADO_MUESTRA[estado]}>{ETIQUETA_ESTADO_MUESTRA[estado]}</Badge>;
}

export const ETIQUETA_ESTADO_RESULTADO: Record<EstadoResultado, string> = {
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  VALIDADO: 'Validado',
};

export function EstadoResultadoBadge({ estado }: { estado: EstadoResultado }) {
  return (
    <Badge tono={estado === 'VALIDADO' ? 'verde' : 'ambar'}>{ETIQUETA_ESTADO_RESULTADO[estado]}</Badge>
  );
}

export function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
  return prioridad === 'URGENTE' ? <Badge tono="rosa">Urgente</Badge> : <span className="text-slate-500">Rutina</span>;
}

export const ETIQUETA_SENSIBILIDAD: Record<Sensibilidad, string> = {
  S: 'Sensible',
  I: 'Intermedio',
  R: 'Resistente',
};

const TONO_SENSIBILIDAD: Record<Sensibilidad, Tono> = { S: 'verde', I: 'ambar', R: 'rojo' };

export function SensibilidadBadge({ sensibilidad }: { sensibilidad: Sensibilidad }) {
  return (
    <Badge tono={TONO_SENSIBILIDAD[sensibilidad]}>{`${sensibilidad} - ${ETIQUETA_SENSIBILIDAD[sensibilidad]}`}</Badge>
  );
}
