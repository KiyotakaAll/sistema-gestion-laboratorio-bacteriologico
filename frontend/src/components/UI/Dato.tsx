import type { ReactNode } from 'react';

/** Par etiqueta/valor para los bloques "maestro" de los modales. */
export function Dato({ etiqueta, children, className = '' }: { etiqueta: string; children?: ReactNode; className?: string }) {
  const vacio = children === null || children === undefined || children === '';
  return (
    <div className={className}>
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className={vacio ? 'text-slate-400' : 'text-slate-900'}>{vacio ? '—' : children}</dd>
    </div>
  );
}

/** Rejilla de datos (lista de descripción). */
export function Datos({ children, columnas = 4 }: { children: ReactNode; columnas?: 2 | 3 | 4 }) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columnas];
  return <dl className={`grid gap-x-6 gap-y-2 ${cols}`}>{children}</dl>;
}

/** Sección con título, para el bloque "detalle" de los modales. */
export function Seccion({ titulo, acciones, children }: { titulo: string; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-slate-200 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold text-slate-900">{titulo}</h3>
        {acciones}
      </div>
      {children}
    </section>
  );
}
