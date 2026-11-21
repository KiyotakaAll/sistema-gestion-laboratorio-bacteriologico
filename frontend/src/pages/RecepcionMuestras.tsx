import { ArrowRight, RotateCcw } from 'lucide-react';
import { IconoNuevo, IconoMuestras } from '../components/icons/LabZenIcon';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MuestraDetalleModal } from '../components/muestras/MuestraDetalleModal';
import { MuestraFormModal } from '../components/muestras/MuestraFormModal';
import { EstadoMuestraBadge, ETIQUETA_ESTADO_MUESTRA, PrioridadBadge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { DataTable, type Column } from '../components/UI/DataTable';
import { PageHeader } from '../components/UI/PageHeader';
import { WorkflowOverview } from '../components/UI/WorkflowOverview';
import { DatePicker } from '../components/UI/DatePicker';
import { Campo, Select } from '../components/UI/Form';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCarga } from '../hooks/useCarga';
import { useDebounce } from '../hooks/useDebounce';
import { mensajeDeError } from '../services/api';
import { muestrasApi } from '../services/laboratorio';
import type { EstadoMuestra, MuestraLista } from '../types/api';
import { finDelDia, formatFechaHora, inicioDelDia, limpiarParams, nombrePaciente, numeroDeParametro } from '../utils/format';

const ESTADOS = Object.keys(ETIQUETA_ESTADO_MUESTRA) as EstadoMuestra[];
const PATRON_CODIGO = /^[A-Z0-9-]{8,30}$/;

const claseFiltro =
  'ui-control h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-heading placeholder:text-muted';

export default function RecepcionMuestras() {
  const { tieneRol } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const puedeRegistrar = tieneRol('ADMINISTRADOR', 'RECEPCIONISTA');

  // Los parámetros de URL (desde el panel o la admisión) solo inicializan el estado.
  const [estado, setEstado] = useState<EstadoMuestra | ''>(() => {
    const valor = params.get('estado');
    return ESTADOS.includes(valor as EstadoMuestra) ? (valor as EstadoMuestra) : '';
  });
  const [detalleId, setDetalleId] = useState<number | null>(() => numeroDeParametro(params.get('muestraId')));
  const [solicitudInicial] = useState<number | null>(() => numeroDeParametro(params.get('solicitudId')));
  const [registrando, setRegistrando] = useState<boolean>(() => numeroDeParametro(params.get('solicitudId')) !== null);

  const [codigo, setCodigo] = useState('');
  const [cedula, setCedula] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const codigoRetrasado = useDebounce(codigo.trim(), 300);
  const cedulaRetrasada = useDebounce(cedula.trim(), 300);

  // Una vez consumidos, se quitan de la URL para que recargar la página no reabra los modales.
  useEffect(() => {
    if (params.has('muestraId') || params.has('solicitudId')) {
      const limpio = new URLSearchParams(params);
      limpio.delete('muestraId');
      limpio.delete('solicitudId');
      setParams(limpio, { replace: true });
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { datos, cargando, error, recargar } = useCarga(
    () =>
      muestrasApi.listar(
        limpiarParams({
          estado: estado || undefined,
          codigoBarras: codigoRetrasado,
          cedula: cedulaRetrasada,
          desde: desde ? inicioDelDia(desde) : undefined,
          hasta: hasta ? finDelDia(hasta) : undefined,
          page: pagina,
          pageSize: 25,
        }),
      ),
    [estado, codigoRetrasado, cedulaRetrasada, desde, hasta, pagina],
  );

  /** Los lectores de código de barras "escriben" el código y pulsan Enter. */
  async function abrirPorCodigo() {
    const candidato = codigo.trim().toUpperCase();
    if (!PATRON_CODIGO.test(candidato)) return;
    try {
      const muestra = await muestrasApi.porCodigo(candidato);
      setDetalleId(muestra.id);
      setCodigo('');
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  const columnas = useMemo<Column<MuestraLista>[]>(
    () => [
      { id: 'codigo', header: 'Código de barras', accessor: (m) => m.codigoBarras, width: '10rem', cell: (m) => <span className="font-mono text-xs">{m.codigoBarras}</span> },
      { id: 'paciente', header: 'Paciente', accessor: (m) => nombrePaciente(m.solicitud.paciente), cell: (m) => <span className="font-semibold text-slate-900">{nombrePaciente(m.solicitud.paciente)}</span> },
      { id: 'cedula', header: 'Cédula', accessor: (m) => m.solicitud.paciente.cedula, width: '8rem' },
      { id: 'examenes', header: 'Exámenes', accessor: (m) => m.examenes.map((e) => e.examen.codigo).join(', ') },
      { id: 'tipo', header: 'Tipo', accessor: (m) => m.tipoMuestra },
      { id: 'prioridad', header: 'Prioridad', accessor: (m) => m.solicitud.prioridad, cell: (m) => <PrioridadBadge prioridad={m.solicitud.prioridad} />, width: '6.5rem' },
      { id: 'toma', header: 'Toma', accessor: (m) => m.fechaToma, cell: (m) => formatFechaHora(m.fechaToma), width: '11rem' },
      { id: 'estado', header: 'Estado', accessor: (m) => ETIQUETA_ESTADO_MUESTRA[m.estado], cell: (m) => <EstadoMuestraBadge estado={m.estado} />, width: '10rem' },
    ],
    [],
  );

  function alFiltrar<T>(asignar: (valor: T) => void) {
    return (valor: T) => {
      asignar(valor);
      setPagina(1);
    };
  }

  return (
    <>
      <PageHeader contexto="Recepción y trazabilidad" titulo="Recepción de muestras"
        descripcion="Identifica cada muestra, verifica su recepción y sigue su recorrido por el laboratorio."
        acciones={puedeRegistrar ? <Button variante="primario" icono={<IconoNuevo size={17} aria-hidden />} onClick={() => setRegistrando(true)}>Registrar muestra</Button> : undefined} />
      <WorkflowOverview titulo="Flujo de una muestra" descripcion="Desde el registro hasta el procesamiento, cada etapa queda identificada.">
        <ol className="lz-sample-journey" aria-label="Etapas de una muestra">
          {['Registrada', 'Receptada', 'En procesamiento', 'Procesada'].map((etapa, i) => <li key={etapa}>
            <span className="lz-journey-icon"><IconoMuestras size={17} aria-hidden /></span><span>{etapa}</span>
            {i < 3 && <ArrowRight size={16} aria-hidden />}
          </li>)}
        </ol>
        <p className="lz-section-description">Las muestras rechazadas conservan su motivo e historial de trazabilidad.</p>
      </WorkflowOverview>
      <DataTable titulo="Registro y trazabilidad" descripcion="Busca por código de barras o acota el listado con los filtros."

        columnas={columnas}
        filas={datos?.data ?? []}
        clave={(m) => m.id}
        alHacerClic={(m) => setDetalleId(m.id)}
        cargando={cargando}
        error={error}
        ocultarFiltro
        mensajeVacio="No hay muestras que coincidan con los filtros."
        paginacion={datos ? { page: datos.page, totalPages: datos.totalPages, total: datos.total, onCambiarPagina: setPagina } : undefined}
        barra={
          <div className="lz-filters-grid">
            <Campo etiqueta="Estado de la muestra">
              <Select aria-label="Filtrar por estado de la muestra" value={estado} onValueChange={(value) => alFiltrar(setEstado)(value as EstadoMuestra | '')}>
                <option value="">Todos los estados</option>
                {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO_MUESTRA[e]}</option>)}
              </Select>
            </Campo>
            <Campo etiqueta="Código de barras">
              <input className={`${claseFiltro} font-mono text-xs`} aria-label="Filtrar por código de barras" placeholder="Escanear o escribir código" value={codigo}
                onChange={(e) => alFiltrar(setCodigo)(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void abrirPorCodigo(); }} />
            </Campo>
            <Campo etiqueta="Cédula"><input className={claseFiltro} aria-label="Filtrar por cédula" placeholder="Buscar identificación" value={cedula} onChange={(e) => alFiltrar(setCedula)(e.target.value)} /></Campo>
            <Campo etiqueta="Toma desde"><DatePicker aria-label="Toma desde" value={desde} onValueChange={alFiltrar(setDesde)} /></Campo>
            <Campo etiqueta="Toma hasta"><DatePicker aria-label="Toma hasta" value={hasta} onValueChange={alFiltrar(setHasta)} /></Campo>
            <Button variante="fantasma" icono={<RotateCcw size={15} aria-hidden />} onClick={() => { setEstado(''); setCodigo(''); setCedula(''); setDesde(''); setHasta(''); setPagina(1); }}>Limpiar filtros</Button>
          </div>
        }
      />

      {registrando && (
        <MuestraFormModal
          solicitudIdInicial={solicitudInicial}
          onCerrar={() => setRegistrando(false)}
          onRegistrada={(muestra) => {
            setRegistrando(false);
            recargar();
            setDetalleId(muestra.id);
          }}
        />
      )}

      {detalleId !== null && <MuestraDetalleModal muestraId={detalleId} onCerrar={() => setDetalleId(null)} onCambio={recargar} />}
    </>
  );
}
