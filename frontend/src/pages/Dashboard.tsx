import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EstadoMuestraBadge, ETIQUETA_ESTADO_MUESTRA, PrioridadBadge } from '../components/UI/Badge';
import { DataTable, type Column } from '../components/UI/DataTable';
import { useAuth } from '../context/AuthContext';
import { useCarga } from '../hooks/useCarga';
import { muestrasApi, resultadosApi } from '../services/laboratorio';
import type { EstadoMuestra, MuestraLista, ResultadoDetalle } from '../types/api';
import { formatFechaHora, nombrePaciente } from '../utils/format';

const FLUJO: EstadoMuestra[] = ['REGISTRADA', 'RECEPTADA', 'EN_PROCESAMIENTO', 'PROCESADA'];
const ESTADOS: EstadoMuestra[] = [...FLUJO, 'RECHAZADA'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { tieneRol } = useAuth();
  const veResultados = tieneRol('ADMINISTRADOR', 'BACTERIOLOGO', 'VALIDADOR');

  // El API no tiene un endpoint de resumen: se consulta `total` de cada estado con pageSize=1.
  const conteos = useCarga(async () => {
    const pares = await Promise.all(
      ESTADOS.map(async (estado) => [estado, (await muestrasApi.listar({ estado, pageSize: 1 })).total] as const),
    );
    return Object.fromEntries(pares) as Record<EstadoMuestra, number>;
  }, []);

  const recientes = useCarga(() => muestrasApi.listar({ pageSize: 10 }), []);
  const pendientes = useCarga(
    async () => (veResultados ? resultadosApi.listar({ estado: 'PENDIENTE_VALIDACION', pageSize: 8 }) : null),
    [veResultados],
  );

  const columnasMuestras = useMemo<Column<MuestraLista>[]>(
    () => [
      { id: 'codigo', header: 'Código de barras', accessor: (m) => m.codigoBarras, cell: (m) => <span className="font-mono text-xs">{m.codigoBarras}</span> },
      { id: 'paciente', header: 'Paciente', accessor: (m) => nombrePaciente(m.solicitud.paciente) },
      { id: 'tipo', header: 'Tipo', accessor: (m) => m.tipoMuestra },
      { id: 'prioridad', header: 'Prioridad', accessor: (m) => m.solicitud.prioridad, cell: (m) => <PrioridadBadge prioridad={m.solicitud.prioridad} /> },
      { id: 'estado', header: 'Estado', accessor: (m) => ETIQUETA_ESTADO_MUESTRA[m.estado], cell: (m) => <EstadoMuestraBadge estado={m.estado} /> },
      { id: 'toma', header: 'Toma', accessor: (m) => m.fechaToma, cell: (m) => formatFechaHora(m.fechaToma) },
    ],
    [],
  );

  const columnasPendientes = useMemo<Column<ResultadoDetalle>[]>(
    () => [
      { id: 'paciente', header: 'Paciente', accessor: (r) => nombrePaciente(r.muestraExamen.muestra.solicitud.paciente) },
      { id: 'examen', header: 'Examen', accessor: (r) => r.muestraExamen.examen.nombre },
      { id: 'bacteria', header: 'Bacteria aislada', accessor: (r) => r.bacteriaAislada },
      { id: 'registro', header: 'Registrado', accessor: (r) => r.fechaRegistro, cell: (r) => formatFechaHora(r.fechaRegistro) },
    ],
    [],
  );

  const total = conteos.datos;

  return (
    <div className="space-y-4">
      <section aria-label="Muestras por estado" className="flex rounded border border-slate-300 bg-white">
        {FLUJO.map((estado, indice) => (
          <button
            key={estado}
            type="button"
            onClick={() => navigate(`/recepcion?estado=${estado}`)}
            className="relative flex-1 border-r border-slate-200 px-4 py-3 text-left hover:bg-violeta-50"
          >
            <span className="block text-sm text-slate-600">{ETIQUETA_ESTADO_MUESTRA[estado]}</span>
            <span className="block font-serif text-3xl font-semibold tabular-nums text-violeta-900">{total ? total[estado] : '—'}</span>
            {indice < FLUJO.length - 1 && (
              <ChevronRight className="absolute -right-2.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full bg-white text-violeta-400" aria-hidden />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => navigate('/recepcion?estado=RECHAZADA')}
          className="flex-1 border-r border-slate-200 bg-rose-50/40 px-4 py-3 text-left hover:bg-rose-50"
        >
          <span className="block text-sm text-rose-800">Rechazadas</span>
          <span className="block font-serif text-3xl font-semibold tabular-nums text-rose-800">{total ? total.RECHAZADA : '—'}</span>
        </button>
        {veResultados && (
          <button
            type="button"
            onClick={() => navigate(tieneRol('BACTERIOLOGO') ? '/worklist' : '/validacion')}
            className="flex-1 bg-amber-50/50 px-4 py-3 text-left hover:bg-amber-50"
          >
            <span className="block text-sm text-amber-900">Resultados por validar</span>
            <span className="block font-serif text-3xl font-semibold tabular-nums text-amber-900">{pendientes.datos ? pendientes.datos.total : '—'}</span>
          </button>
        )}
      </section>

      {conteos.error && <p className="text-sm text-rose-700">{conteos.error}</p>}

      <div className={`grid gap-4 ${veResultados ? 'grid-cols-5' : 'grid-cols-1'}`}>
        <section className={veResultados ? 'col-span-3' : ''}>
          <h2 className="mb-1.5 font-serif text-base font-semibold text-slate-900">Muestras más recientes</h2>
          <DataTable
            columnas={columnasMuestras}
            filas={recientes.datos?.data ?? []}
            clave={(m) => m.id}
            alHacerClic={tieneRol('ADMINISTRADOR', 'RECEPCIONISTA', 'BACTERIOLOGO') ? (m) => navigate(`/recepcion?muestraId=${m.id}`) : undefined}
            cargando={recientes.cargando}
            error={recientes.error}
            ocultarFiltro
            mensajeVacio="Todavía no se han registrado muestras."
          />
        </section>
        {veResultados && (
          <section className="col-span-2">
            <h2 className="mb-1.5 font-serif text-base font-semibold text-slate-900">Esperando validación</h2>
            <DataTable
              columnas={columnasPendientes}
              filas={pendientes.datos?.data ?? []}
              clave={(r) => r.id}
              alHacerClic={tieneRol('ADMINISTRADOR', 'VALIDADOR') ? () => navigate('/validacion') : undefined}
              cargando={pendientes.cargando}
              error={pendientes.error}
              ocultarFiltro
              mensajeVacio="No hay resultados pendientes de validación."
            />
          </section>
        )}
      </div>
    </div>
  );
}
