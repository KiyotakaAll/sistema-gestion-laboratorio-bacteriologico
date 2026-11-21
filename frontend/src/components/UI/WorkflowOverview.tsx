import type { ReactNode } from 'react';
import { PanelHeading } from './PageHeader';

/** Summary of the currently loaded data, with its scope stated by the caller. */
export function WorkflowOverview({ titulo, descripcion, children }: {
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  return <section className="lz-panel lz-workflow-overview" aria-label={titulo}>
    <PanelHeading titulo={titulo} descripcion={descripcion} />
    {children}
  </section>;
}
