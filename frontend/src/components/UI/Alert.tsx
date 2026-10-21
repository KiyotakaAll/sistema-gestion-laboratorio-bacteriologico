import { AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DetalleCampo } from '../../services/api';

interface AlertProps {
  tipo?: 'error' | 'aviso' | 'info';
  children: ReactNode;
  detalles?: DetalleCampo[];
}

const ESTILO = {
  error: 'border-rose-300 bg-rose-50 text-rose-900',
  aviso: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
} as const;

export function Alert({ tipo = 'error', children, detalles = [] }: AlertProps) {
  const Icono = tipo === 'info' ? Info : AlertTriangle;
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-sm border px-3 py-2 text-sm ${ESTILO[tipo]}`}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p>{children}</p>
        {detalles.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs">
            {detalles.map((d) => (
              <li key={`${d.campo}-${d.mensaje}`}>
                <span className="font-semibold">{d.campo}:</span> {d.mensaje}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
