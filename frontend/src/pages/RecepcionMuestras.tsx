import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MuestraDetalleModal } from '../components/muestras/MuestraDetalleModal';
import { MuestraFormModal } from '../components/muestras/MuestraFormModal';
import { EstadoMuestraBadge, ETIQUETA_ESTADO_MUESTRA, PrioridadBadge } from '../components/UI/Badge';
import { Button } from '../components/UI/Button';
import { DataTable, type Column } from '../components/UI/DataTable';
import { Select } from '../components/UI/Form';
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
  'h-7 rounded-sm border border-slate-300 bg-white px-2 text-sm placeholder:text-slate-400 focus:border-violeta-500';

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
      <DataTable
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
          <>
            <Select className="!h-7 w-44" aria-label="Filtrar por estado de la muestra" value={estado} onChange={(e) => alFiltrar(setEstado)(e.target.value as EstadoMuestra | '')}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_MUESTRA[e]}
                </option>
              ))}
            </Select>
            <input
              className={`${claseFiltro} w-52 font-mono text-xs`}
              aria-label="Filtrar por código de barras"
              placeholder="Escanear o escribir código"
              value={codigo}
              onChange={(e) => alFiltrar(setCodigo)(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void abrirPorCodigo();
              }}
            />
            <input className={`${claseFiltro} w-36`} aria-label="Filtrar por cédula" placeholder="Cédula" value={cedula} onChange={(e) => alFiltrar(setCedula)(e.target.value)} />
            <input className={claseFiltro} type="date" aria-label="Toma desde" value={desde} onChange={(e) => alFiltrar(setDesde)(e.target.value)} />
            <input className={claseFiltro} type="date" aria-label="Toma hasta" value={hasta} onChange={(e) => alFiltrar(setHasta)(e.target.value)} />
            {puedeRegistrar && (
              <Button tamano="sm" variante="primario" icono={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={() => setRegistrando(true)}>
                Registrar muestra
              </Button>
            )}
          </>
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
