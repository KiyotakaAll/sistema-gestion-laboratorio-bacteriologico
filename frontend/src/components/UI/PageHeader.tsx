import type { ReactNode } from 'react';

/** Encabezado editorial de las pantallas de trabajo; la barra superior queda discreta. */
export function PageHeader({ titulo, contexto, descripcion, acciones }: {
  titulo: string;
  contexto: string;
  descripcion: ReactNode;
  acciones?: ReactNode;
}) {
  return <div className="lz-page-header">
    <div className="lz-page-intro">
      <p className="lz-eyebrow">{contexto}</p>
      <h1>{titulo}</h1>
      <p className="lz-page-description">{descripcion}</p>
    </div>
    {acciones && <div className="lz-page-actions">{acciones}</div>}
  </div>;
}

export function PanelHeading({ titulo, descripcion, acciones }: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return <div className="lz-panel-heading">
    <div><h2>{titulo}</h2>{descripcion && <p>{descripcion}</p>}</div>
    {acciones && <div className="lz-panel-actions">{acciones}</div>}
  </div>;
}
