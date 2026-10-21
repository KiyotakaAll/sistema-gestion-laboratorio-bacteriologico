import { useMemo, useState } from 'react';
import { EstadoResultadoBadge, ETIQUETA_ESTADO_RESULTADO, PrioridadBadge } from '../components/UI/Badge';
import { DataTable, type Column } from '../components/UI/DataTable';
import { Select } from '../components/UI/Form';
import { ResultadoRevisionModal } from '../components/resultados/ResultadoRevisionModal';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { resultadosApi } from '../services/laboratorio';
import type { EstadoResultado, ResultadoDetalle } from '../types/api';
import { formatFechaHora, limpiarParams, nombrePaciente } from '../utils/format';

export default function ValidacionAthenea() {
  const { usuario, tieneRol } = useAuth();
  const [estado, setEstado] = useState<EstadoResultado | ''>('PENDIENTE_VALIDACION');
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<ResultadoDetalle | null>(null);

  const { datos, cargando, error, recargar } = useCarga(
    () => resultadosApi.listar(limpiarParams({ estado: estado || undefined, page: pagina, pageSize: 25 })),
    [estado, pagina],
  );

  const columnas = useMemo<Column<ResultadoDetalle>[]>(
    () => [
      { id: 'prioridad', header: 'Prioridad', accessor: (r) => r.muestraExamen.muestra.solicitud.prioridad, cell: (r) => <PrioridadBadge prioridad={r.muestraExamen.muestra.solicitud.prioridad} />, width: '6.5rem' },
      { id: 'paciente', header: 'Paciente', accessor: (r) => nombrePaciente(r.muestraExamen.muestra.solicitud.paciente), cell: (r) => <span className="font-semibold text-slate-900">{nombrePaciente(r.muestraExamen.muestra.solicitud.paciente)}</span> },
      { id: 'cedula', header: 'Cédula', accessor: (r) => r.muestraExamen.muestra.solicitud.paciente.cedula, width: '8rem' },
      { id: 'examen', header: 'Examen', accessor: (r) => r.muestraExamen.examen.nombre },
      { id: 'bacteria', header: 'Bacteria aislada', accessor: (r) => r.bacteriaAislada, cell: (r) => (r.bacteriaAislada ? <span className="italic">{r.bacteriaAislada}</span> : <span className="text-slate-400">—</span>) },
      { id: 'registro', header: 'Registró', accessor: (r) => r.registradoPor.nombreCompleto },
      { id: 'fecha', header: 'Fecha de registro', accessor: (r) => r.fechaRegistro, cell: (r) => formatFechaHora(r.fechaRegistro), width: '11rem' },
      { id: 'estado', header: 'Estado', accessor: (r) => ETIQUETA_ESTADO_RESULTADO[r.estado], cell: (r) => <EstadoResultadoBadge estado={r.estado} />, width: '12rem' },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columnas={columnas}
        filas={datos?.data ?? []}
        clave={(r) => r.id}
        alHacerClic={setSeleccionado}
        cargando={cargando}
        error={error}
        placeholderFiltro="Filtrar por paciente, examen o bacteria"
        mensajeVacio={estado === 'PENDIENTE_VALIDACION' ? 'No hay resultados esperando validación.' : 'No hay resultados con ese estado.'}
        ordenInicial={{ columna: 'fecha', direccion: 'asc' }}
        paginacion={datos ? { page: datos.page, totalPages: datos.totalPages, total: datos.total, onCambiarPagina: setPagina } : undefined}
        barra={
          <Select
            className="!h-7 w-56"
            aria-label="Estado del resultado"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoResultado | '');
              setPagina(1);
            }}
          >
            <option value="PENDIENTE_VALIDACION">Pendientes de validación</option>
            <option value="VALIDADO">Validados</option>
            <option value="">Todos</option>
          </Select>
        }
      />

      {seleccionado && usuario && (
        <ResultadoRevisionModal
          key={seleccionado.id}
          resultado={seleccionado}
          usuarioActualId={usuario.id}
          puedeValidar={tieneRol('VALIDADOR')}
          onCerrar={() => setSeleccionado(null)}
          onValidado={() => recargar()}
        />
      )}
    </>
  );
}
