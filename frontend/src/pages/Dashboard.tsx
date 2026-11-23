import { ArrowRight } from 'lucide-react';
import { IconoEnProceso, IconoResultados, IconoWorklist, IconoPendiente, IconoMuestras, IconoRechazado, IconoPacientes } from '../components/icons/LabZenIcon';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, PanelHeading } from '../components/UI/PageHeader';
import { permisoDeRuta } from '../components/navigation';
import { EstadoMuestraBadge, ETIQUETA_ESTADO_MUESTRA } from '../components/UI/Badge';
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
  const { usuario, puede } = useAuth();
  const veRecepcion = puede(permisoDeRuta('/recepcion'));
  const veResultados = puede(permisoDeRuta('/validacion'));
  const rutaResultados = puede('resultados.escribir') ? '/worklist' : '/validacion';
  const abreResultados = puede(permisoDeRuta(rutaResultados));
  const IndicadorMuestra = veRecepcion ? 'button' : 'div';
  const IndicadorResultados = abreResultados ? 'button' : 'div';

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

  const columnasMuestras = useMemo<Column<MuestraLista>[]>(() => [
    { id: 'codigo', header: 'Código de barras', accessor: (m) => m.codigoBarras, cell: (m) => <span className="font-mono text-xs">{m.codigoBarras}</span> },
    { id: 'paciente', header: 'Paciente', accessor: (m) => nombrePaciente(m.solicitud.paciente), cell: (m) => <strong>{nombrePaciente(m.solicitud.paciente)}</strong> },
    { id: 'estado', header: 'Estado', accessor: (m) => ETIQUETA_ESTADO_MUESTRA[m.estado], cell: (m) => <EstadoMuestraBadge estado={m.estado} /> },
  ], []);

  const total = conteos.datos;
  const totalMuestras = total ? ESTADOS.reduce((suma, estado) => suma + total[estado], 0) : null;
  const accesos = [
    { ruta: '/admision', titulo: 'Pacientes', detalle: 'Pacientes y solicitudes · Admisión y consulta', icono: IconoPacientes },
    { ruta: '/recepcion', titulo: 'Muestras', detalle: 'Recepción de muestras · Registro y trazabilidad', icono: IconoMuestras },
    { ruta: '/worklist', titulo: 'Worklist', detalle: `${puede('resultados.escribir') ? 'Ingresar resultados' : 'Consultar worklist'} · Exámenes en procesamiento`, icono: IconoWorklist },
    { ruta: '/validacion', titulo: 'Resultados', detalle: 'Consultar resultados · Revisión de hallazgos', icono: IconoResultados },
  ].filter((acceso) => puede(permisoDeRuta(acceso.ruta)));

  return <>
    <PageHeader contexto="Visión operativa del laboratorio"
      titulo={usuario ? `Buenos días, ${usuario.nombreCompleto.trim().split(/\s+/)[0]}.` : 'Panel general'}
      descripcion="Aquí puedes visualizar el flujo del laboratorio y dar seguimiento a las tareas prioritarias." />
    <section aria-label="Muestras por estado" className="lz-dashboard">
      <div className="lz-stats">
        <IndicadorMuestra type={veRecepcion ? 'button' : undefined}
          onClick={veRecepcion ? () => navigate('/recepcion') : undefined} className="lz-stat">
          <span className="lz-stat-label">Total de muestras</span>
          <strong>{totalMuestras ?? '—'}</strong><small>Todos los estados</small><IconoMuestras aria-hidden />
        </IndicadorMuestra>
        <IndicadorMuestra type={veRecepcion ? 'button' : undefined}
          onClick={veRecepcion ? () => navigate('/recepcion?estado=EN_PROCESAMIENTO') : undefined} className="lz-stat">
          <span className="lz-stat-label">En proceso</span>
          <strong>{total?.EN_PROCESAMIENTO ?? '—'}</strong><small>Trabajo activo</small><IconoEnProceso aria-hidden />
        </IndicadorMuestra>
        {veResultados ? <IndicadorResultados type={abreResultados ? 'button' : undefined}
          onClick={abreResultados ? () => navigate(rutaResultados) : undefined} className="lz-stat" aria-label={`Resultados por validar ${pendientes.datos?.total ?? '—'}`}>
          <span className="lz-stat-label">Resultados por validar</span>
          <strong>{pendientes.datos?.total ?? '—'}</strong><small>Requieren revisión</small><IconoPendiente aria-hidden />
        </IndicadorResultados> : <IndicadorMuestra type={veRecepcion ? 'button' : undefined}
          onClick={veRecepcion ? () => navigate('/recepcion?estado=REGISTRADA') : undefined} className="lz-stat">
          <span className="lz-stat-label">Por recibir</span><strong>{total?.REGISTRADA ?? '—'}</strong><small>Muestras registradas</small><IconoPendiente aria-hidden />
        </IndicadorMuestra>}
        <IndicadorMuestra type={veRecepcion ? 'button' : undefined}
          onClick={veRecepcion ? () => navigate('/recepcion?estado=RECHAZADA') : undefined} className="lz-stat lz-stat-warning" aria-label={`Rechazadas ${total?.RECHAZADA ?? '—'}`}>
          <span className="lz-stat-label">Rechazadas</span><strong>{total?.RECHAZADA ?? '—'}</strong><small>Revisar motivos</small><IconoRechazado aria-hidden />
        </IndicadorMuestra>
      </div>
      {conteos.error && <p role="alert" className="lz-inline-error">{conteos.error}</p>}
      <div className="lz-dashboard-columns">
        <section className="lz-panel lz-activity">
          <PanelHeading titulo="El laboratorio, de un vistazo" descripcion="Estado actual del recorrido de las muestras." />
          <div className="lz-flow" aria-label="Flujo de muestras">
            {FLUJO.map((estado) => <IndicadorMuestra key={estado} type={veRecepcion ? 'button' : undefined}
              onClick={veRecepcion ? () => navigate(`/recepcion?estado=${estado}`) : undefined} className="lz-flow-step" aria-label={`${ETIQUETA_ESTADO_MUESTRA[estado]} ${total?.[estado] ?? '—'}`}>
              <span>{ETIQUETA_ESTADO_MUESTRA[estado]}</span><strong>{total?.[estado] ?? '—'}</strong>
            </IndicadorMuestra>)}
          </div>
          <PanelHeading titulo="Actividad reciente" descripcion="Las últimas cuatro muestras y su estado actual."
            acciones={veRecepcion ? <button type="button" className="lz-text-action" onClick={() => navigate('/recepcion')}>Ver muestras <ArrowRight size={16} aria-hidden /></button> : undefined} />
          <DataTable variante="integrada" columnas={columnasMuestras} filas={recientes.datos?.data.slice(0, 4) ?? []} clave={(m) => m.id}
            alHacerClic={veRecepcion ? (m) => navigate(`/recepcion?muestraId=${m.id}`) : undefined}
            cargando={recientes.cargando} error={recientes.error} ocultarFiltro mensajeVacio="Todavía no se han registrado muestras." />
        </section>
        <div className="lz-dashboard-aside">
          <section className="lz-panel" aria-label="Accesos rápidos">
            <PanelHeading titulo="Accesos rápidos" descripcion="Empieza por la tarea que necesitas." />
            <div className="lz-quick-actions">
              {accesos.map(({ ruta, titulo, detalle, icono: Icono }) => <button key={ruta} type="button" title={detalle} aria-label={detalle} onClick={() => navigate(ruta)}>
                <Icono size={17} strokeWidth={1.7} aria-hidden /><strong>{titulo}</strong><ArrowRight size={16} aria-hidden />
              </button>)}
            </div>
          </section>
          {veResultados ? <section className="lz-panel lz-pending">
            <PanelHeading titulo="Trabajo pendiente" descripcion="Resultados que esperan validación."
              acciones={<span className="lz-queue-count" aria-label={`${pendientes.datos?.total ?? '—'} pendientes`}>{pendientes.datos?.total ?? '—'}</span>} />
            {pendientes.cargando && <p role="status" className="lz-section-description">Consultando resultados…</p>}
            {pendientes.error && <p role="alert" className="lz-inline-error">{pendientes.error}</p>}
            {!pendientes.cargando && !pendientes.error && !pendientes.datos?.data.length && <p className="lz-section-description">No hay resultados pendientes de validación.</p>}
            <ul className="lz-task-list">
              {pendientes.datos?.data.slice(0, 4).map((r: ResultadoDetalle) => {
                const contenido = <><span className="lz-task-dot" aria-hidden /><span><strong>{nombrePaciente(r.muestraExamen.muestra.solicitud.paciente)}</strong><span>{r.muestraExamen.examen.nombre}</span><small>{formatFechaHora(r.fechaRegistro)}</small></span><ArrowRight size={16} aria-hidden /></>;
                return <li key={r.id}>{(puede('usuarios.administrar') || puede('resultados.validar'))
                  ? <button type="button" onClick={() => navigate('/validacion')}>{contenido}</button>
                  : <div>{contenido}</div>}</li>;
              })}
            </ul>
            <button type="button" className="lz-text-action lz-queue-link" onClick={() => navigate('/validacion')}>Consultar resultados <ArrowRight size={16} aria-hidden /></button>
          </section> : <section className="lz-panel lz-next-task">
            <PanelHeading titulo="Trabajo pendiente" descripcion="Continúa con la recepción de muestras." />
            <div><span className="lz-task-icon"><IconoMuestras size={24} strokeWidth={1.7} aria-hidden /></span><p><strong>{total?.REGISTRADA ?? '—'} por recibir</strong><span>Consulta las muestras registradas y verifica su recepción.</span></p></div>
            <button type="button" className="lz-text-action" onClick={() => navigate('/recepcion?estado=REGISTRADA')}>Ir a recepción <ArrowRight size={16} aria-hidden /></button>
          </section>}
        </div>
      </div>
    </section>
  </>;
}
