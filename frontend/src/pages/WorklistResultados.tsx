import { useMemo, useState } from 'react';
import { EstadoResultadoBadge, ETIQUETA_ESTADO_RESULTADO, PrioridadBadge } from '../components/UI/Badge';
import { DataTable, type Column } from '../components/UI/DataTable';
import { ResultadoFormModal } from '../components/resultados/ResultadoFormModal';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { resultadosApi } from '../services/laboratorio';
import type { WorklistItem } from '../types/api';
import { formatFechaHora, nombrePaciente } from '../utils/format';

export default function WorklistResultados() {
  const { tieneRol } = useAuth();
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [seleccionado, setSeleccionado] = useState<WorklistItem | null>(null);

  const { datos, cargando, error, recargar } = useCarga(() => resultadosApi.worklist(soloPendientes), [soloPendientes]);

  const columnas = useMemo<Column<WorklistItem>[]>(
    () => [
      { id: 'prioridad', header: 'Prioridad', accessor: (i) => i.muestra.solicitud.prioridad, cell: (i) => <PrioridadBadge prioridad={i.muestra.solicitud.prioridad} />, width: '6.5rem' },
      { id: 'codigo', header: 'Código de barras', accessor: (i) => i.muestra.codigoBarras, width: '10rem', cell: (i) => <span className="font-mono text-xs">{i.muestra.codigoBarras}</span> },
      { id: 'paciente', header: 'Paciente', accessor: (i) => nombrePaciente(i.muestra.solicitud.paciente), cell: (i) => <span className="font-semibold text-slate-900">{nombrePaciente(i.muestra.solicitud.paciente)}</span> },
      { id: 'examen', header: 'Examen', accessor: (i) => i.examen.nombre },
      { id: 'tipo', header: 'Muestra', accessor: (i) => i.muestra.tipoMuestra },
      { id: 'toma', header: 'Toma', accessor: (i) => i.muestra.fechaToma, cell: (i) => formatFechaHora(i.muestra.fechaToma), width: '11rem' },
      {
        id: 'resultado',
        header: 'Resultado',
        accessor: (i) => (i.resultado ? ETIQUETA_ESTADO_RESULTADO[i.resultado.estado] : 'Sin resultado'),
        cell: (i) => (i.resultado ? <EstadoResultadoBadge estado={i.resultado.estado} /> : <span className="text-slate-500">Sin resultado</span>),
        width: '11rem',
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columnas={columnas}
        filas={datos ?? []}
        clave={(i) => i.id}
        alHacerClic={setSeleccionado}
        cargando={cargando}
        error={error}
        placeholderFiltro="Filtrar por paciente, código, examen o estado"
        mensajeVacio={soloPendientes ? 'No hay exámenes esperando resultado. Las muestras aparecen aquí cuando inicia su procesamiento.' : 'No hay muestras en procesamiento.'}
        barra={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} className="h-3.5 w-3.5 accent-violeta-700" />
            Solo exámenes sin resultado
          </label>
        }
      />

      {seleccionado && (
        <ResultadoFormModal
          key={seleccionado.id}
          item={seleccionado}
          puedeEditar={tieneRol('BACTERIOLOGO')}
          onCerrar={() => setSeleccionado(null)}
          onGuardado={() => {
            setSeleccionado(null);
            recargar();
          }}
        />
      )}
    </>
  );
}
