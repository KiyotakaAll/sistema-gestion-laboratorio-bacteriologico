import { identificacionTexto } from '../utils/identificacion';
import { IconoValidacion } from '../components/icons/LabZenIcon';
import { useMemo, useState } from 'react';
import { EstadoResultadoBadge, ETIQUETA_ESTADO_RESULTADO, PrioridadBadge } from '../components/UI/Badge';
import { DataTable, type Column } from '../components/UI/DataTable';
import { PageHeader } from '../components/UI/PageHeader';
import { WorkflowOverview } from '../components/UI/WorkflowOverview';
import { Campo, Select } from '../components/UI/Form';
import { ResultadoRevisionModal } from '../components/resultados/ResultadoRevisionModal';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { resultadosApi } from '../services/laboratorio';
import type { EstadoResultado, ResultadoDetalle } from '../types/api';
import { formatFechaHora, limpiarParams, nombrePaciente } from '../utils/format';

export default function ValidacionAthenea() {
  const { usuario, puede } = useAuth();
  const puedeValidar = puede('resultados.validar');
  const [estado, setEstado] = useState<EstadoResultado | ''>(() => puede('resultados.escribir') ? '' : 'PENDIENTE_VALIDACION');
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
      { id: 'cedula', header: 'Identificación', accessor: (r) => identificacionTexto(r.muestraExamen.muestra.solicitud.paciente), width: '8rem' },
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
      <PageHeader contexto="Revisión y consulta" titulo="Resultados del laboratorio"
        descripcion={puedeValidar ? 'Revisa los hallazgos y valida los registrados por otra persona.' : 'Consulta los hallazgos registrados y el estado de su validación.'} />
      <div className="lz-notice"><IconoValidacion size={20} strokeWidth={1.7} aria-hidden /><div><strong>Validación independiente</strong>
        <p>{puedeValidar ? 'Revise los resultados y valide los registrados por otra persona.' : 'Consulte los resultados registrados, incluidos los de muestras procesadas. Su rol tiene acceso de solo lectura en esta pantalla.'}</p></div></div>
      <WorkflowOverview titulo="Resultados por revisar" descripcion="Resumen de la página cargada, según los filtros seleccionados.">
        <dl className="lz-result-summary">
          <div><dt>Pendientes en esta página</dt><dd>{cargando || error ? '—' : datos?.data.filter(r => r.estado === 'PENDIENTE_VALIDACION').length ?? 0}</dd></div>
          <div><dt>Validados en esta página</dt><dd>{cargando || error ? '—' : datos?.data.filter(r => r.estado === 'VALIDADO').length ?? 0}</dd></div>
        </dl>
      </WorkflowOverview>
      <DataTable titulo={puedeValidar ? 'Validación de resultados' : 'Consulta de resultados'} descripcion="La búsqueda de texto filtra únicamente la página actual."
        columnas={columnas}
        filas={datos?.data ?? []}
        clave={(r) => r.id}
        alHacerClic={setSeleccionado}
        cargando={cargando}
        error={error}
        placeholderFiltro="Filtrar esta página por paciente, examen o bacteria"
        mensajeVacio={estado === 'PENDIENTE_VALIDACION' ? 'No hay resultados esperando validación.' : 'No hay resultados con ese estado.'}
        ordenInicial={{ columna: 'fecha', direccion: 'asc' }}
        paginacion={datos ? { page: datos.page, totalPages: datos.totalPages, total: datos.total, onCambiarPagina: setPagina } : undefined}
        barra={
          <Campo etiqueta="Estado del resultado"><Select
            className="w-full"
            aria-label="Estado del resultado"
            value={estado}
            onValueChange={(value) => {
              setEstado(value as EstadoResultado | '');
              setPagina(1);
            }}
          >
            <option value="PENDIENTE_VALIDACION">Pendientes de validación</option>
            <option value="VALIDADO">Validados</option>
            <option value="">Todos</option>
          </Select></Campo>
        }
      />

      {seleccionado && usuario && (
        <ResultadoRevisionModal
          key={seleccionado.id}
          resultado={seleccionado}
          usuarioActualId={usuario.id}
          puedeValidar={puedeValidar}
          onCerrar={() => setSeleccionado(null)}
          onValidado={() => recargar()}
        />
      )}
    </>
  );
}
