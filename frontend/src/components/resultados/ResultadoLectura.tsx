import type { AntibiogramaItem } from '../../types/api';
import { SensibilidadBadge } from '../UI/Badge';
import { Dato, Datos, Seccion } from '../UI/Dato';

interface Props {
  resultado: {
    hallazgoGram: string | null;
    colonias: string | null;
    bacteriaAislada: string | null;
    observaciones: string | null;
    antibiograma: AntibiogramaItem[];
  };
}

/** Vista de solo lectura de los hallazgos de un resultado y su antibiograma. */
export function ResultadoLectura({ resultado }: Props) {
  return (
    <>
      <Datos columnas={2}>
        <Dato etiqueta="Hallazgo microscópico (Gram)">
          <span className="whitespace-pre-line">{resultado.hallazgoGram}</span>
        </Dato>
        <Dato etiqueta="Colonias">
          <span className="whitespace-pre-line">{resultado.colonias}</span>
        </Dato>
        <Dato etiqueta="Bacteria aislada">
          <span className="font-semibold italic">{resultado.bacteriaAislada}</span>
        </Dato>
        <Dato etiqueta="Observaciones">
          <span className="whitespace-pre-line">{resultado.observaciones}</span>
        </Dato>
      </Datos>

      {resultado.antibiograma.length > 0 && (
        <Seccion titulo="Antibiograma">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th scope="col" className="border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold text-slate-600">Antibiótico</th>
                <th scope="col" className="border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold text-slate-600">Interpretación</th>
                <th scope="col" className="border-b border-slate-300 px-2 py-1 text-right text-xs font-semibold text-slate-600">Halo (mm)</th>
              </tr>
            </thead>
            <tbody>
              {resultado.antibiograma.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-1">{item.antibiotico}</td>
                  <td className="px-2 py-1">
                    <SensibilidadBadge sensibilidad={item.sensibilidad} />
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{item.haloMm ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}
    </>
  );
}
