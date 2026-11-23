
import { IconoBuscar } from '../icons/LabZenIcon';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { catalogosApi } from '../../services/catalogos';
import { SitioSelector } from './SitioSelector';
import { normalizarBusqueda } from '../UI/controlTypes';
import { useToast } from '../../context/ToastContext';
import { useCarga } from '../../hooks/useCarga';
import {
  detallesDeError,
  mensajeDeError,
  type DetalleCampo,
} from '../../services/api';
import {
  examenesApi,
  muestrasApi,
  solicitudesApi,
} from '../../services/laboratorio';
import type {
  MuestraDetalle,
  SolicitudLista,
  SolicitudDetalle,
} from '../../types/api';
import {
  ahoraParaInput,
  formatFechaHora,
  nombrePaciente,
  opcional,
} from '../../utils/format';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { Campo, Input } from '../UI/Form';
import { Combobox } from '../UI/Combobox';
import { DateTimePicker } from '../UI/DateTimePicker';
import { Modal } from '../UI/Modal';

interface Props {
  solicitudIdInicial: number | null;
  onCerrar: () => void;
  onRegistrada: (muestra: MuestraDetalle) => void;
}

interface SolicitudElegida {
  id: number;
  codigo: string;
  paciente: string;
}

const TIPOS_FRECUENTES = [
  'Orina',
  'Heces',
  'Sangre',
  'Esputo',
  'Exudado faríngeo',
  'Secreción de herida',
  'Líquido cefalorraquídeo',
];

const ID_FORMULARIO = 'form-muestra';

const ESTILO_SECCION =
  'min-w-0 rounded-xl border border-line bg-subtle px-5 py-4';

const ESTILO_TITULO =
  'mb-3 font-serif text-lg font-semibold text-heading';

export function MuestraFormModal({
  solicitudIdInicial,
  onCerrar,
  onRegistrada,
}: Props) {
  const toast = useToast();
  const { puede } = useAuth();
  const examenes = useCarga(() => examenesApi.listar(), []);
  const catalogo = useCarga(() => catalogosApi.flujo(), []);
  const asistida = catalogo.datos?.habilitado === true;
  const [orden, setOrden] = useState<SolicitudDetalle | null>(null);
  const [sitioId, setSitioId] = useState<number | null>(null);
  const [buscarExamen, setBuscarExamen] = useState('');

  const [solicitud, setSolicitud] =
    useState<SolicitudElegida | null>(null);

  const [cedula, setCedula] = useState('');
  const [encontradas, setEncontradas] =
    useState<SolicitudLista[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] =
    useState<string | null>(null);

  const [tipoMuestra, setTipoMuestra] = useState('');
  const [sitio, setSitio] = useState('');
  const [fechaToma, setFechaToma] =
    useState(ahoraParaInput());
  const [elegidos, setElegidos] = useState<number[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] =
    useState<DetalleCampo[]>([]);

  function cargarOrden(s: SolicitudDetalle) {
    setOrden(s);
    const asignados = new Set((s.muestras ?? []).filter(m => m.estado !== 'RECHAZADA').flatMap(m => m.examenes.map(e => e.examen.id)));
    const pendiente = s.examenesSolicitados?.find(e => !asignados.has(e.examenId));
    if (pendiente) elegirGrupo(s, pendiente);
  }
  function elegirGrupo(s: SolicitudDetalle, linea: NonNullable<SolicitudDetalle['examenesSolicitados']>[number]) {
    const asignados = new Set(s.muestras.filter(m => m.estado !== 'RECHAZADA').flatMap(m => m.examenes.map(e => e.examen.id)));
    setTipoMuestra(linea.tipoMuestra); setSitioId(linea.sitioAnatomicoId);
    setElegidos((s.examenesSolicitados ?? []).filter(e => !asignados.has(e.examenId)
      && e.tipoMuestra === linea.tipoMuestra && e.sitioAnatomicoId === linea.sitioAnatomicoId).map(e => e.examenId));
  }

  // Conserva la solicitud preseleccionada.
  useEffect(() => {
    if (solicitudIdInicial === null) return;

    let vigente = true;

    solicitudesApi
      .obtener(solicitudIdInicial)
      .then((s) => {
        if (vigente) {
          cargarOrden(s);
          setSolicitud({
            id: s.id,
            codigo: s.codigo,
            paciente: nombrePaciente(s.paciente),
          });
        }
      })
      .catch((e: unknown) => {
        if (vigente) {
          setError(mensajeDeError(e));
        }
      });

    return () => {
      vigente = false;
    };
  }, [solicitudIdInicial]);

  useEffect(() => {
    if (!asistida || !solicitud || orden?.id === solicitud.id) return;
    let vigente = true;
    solicitudesApi.obtener(solicitud.id).then(s => { if (vigente) cargarOrden(s); })
      .catch(e => { if (vigente) setError(mensajeDeError(e)); });
    return () => { vigente = false; };
  }, [asistida, solicitud?.id]);

  async function buscarSolicitudes() {
    if (!cedula.trim()) return;

    setBuscando(true);
    setErrorBusqueda(null);

    try {
      const respuesta = await solicitudesApi.listar({
        ...(/^\d+$/.test(cedula.trim()) ? { cedula: cedula.trim() } : { q: cedula.trim() }),
        pageSize: 20,
      });

      setEncontradas(respuesta.data);
    } catch (e) {
      setErrorBusqueda(mensajeDeError(e));
    } finally {
      setBuscando(false);
    }
  }

  function alternarExamen(
    id: number,
    tipoRequerido: string,
  ) {
    setElegidos((actuales) =>
      actuales.includes(id)
        ? actuales.filter((x) => x !== id)
        : [...actuales, id],
    );

    // Conserva la sugerencia automática del tipo.
    if (
      !tipoMuestra &&
      tipoRequerido.toLowerCase() !== 'variable'
    ) {
      setTipoMuestra(tipoRequerido);
    }
  }

  async function enviar(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    if (!solicitud) {
      setError(
        'Seleccione la solicitud a la que pertenece la muestra.',
      );
      return;
    }

    setGuardando(true);
    setError(null);
    setDetalles([]);

    try {
      const muestra = await muestrasApi.registrar({
        solicitudId: solicitud.id,
        tipoMuestra: tipoMuestra.trim(),
        ...(asistida ? { sitioAnatomicoId: sitioId ?? undefined } : { sitioAnatomico: opcional(sitio) }),
        fechaToma: new Date(fechaToma).toISOString(),
        examenIds: elegidos,
      });

      toast.exito(
        `Muestra registrada con código ${muestra.codigoBarras}`,
      );

      onRegistrada(muestra);
    } catch (e) {
      setError(mensajeDeError(e));
      setDetalles(detallesDeError(e));
      setGuardando(false);
    }
  }

  const puedeGuardar =
    !catalogo.cargando && !catalogo.error &&
    (!asistida || orden?.id === solicitud?.id) &&
    solicitud !== null &&
    tipoMuestra.trim().length >= 2 &&
    elegidos.length > 0 &&
    fechaToma !== '';

  return (
    <Modal
      abierto
      ancho="lg"
      titulo="Registrar muestra"
      subtitulo="El código de barras único se genera al guardar."
      onCerrar={() => { if (!guardando) onCerrar(); }}
      pie={
        <>
          <Button
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            form={ID_FORMULARIO}
            variante="primario"
            cargando={guardando}
            disabled={!puedeGuardar}
          >
            Registrar muestra
          </Button>
        </>
      }
    >
      <form
        id={ID_FORMULARIO}
        onSubmit={enviar}
        className="space-y-4"
      >
        {error && (
          <Alert detalles={detalles}>{error}</Alert>
        )}

        {/* SECCIÓN 1: SOLICITUD */}
        <fieldset className={ESTILO_SECCION}>
          <legend className={ESTILO_TITULO}>
            Solicitud
          </legend>

          {solicitud ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-accent-soft px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">
                  Solicitud seleccionada
                </p>

                <p className="mt-1 break-words text-sm text-heading">
                  <span className="font-mono font-semibold text-accent">
                    {solicitud.codigo}
                  </span>
                  {' · '}
                  <span className="font-semibold">
                    {solicitud.paciente}
                  </span>
                </p>
              </div>

              <Button
                tamano="sm"
                variante="fantasma"
                onClick={() => { setSolicitud(null); setOrden(null); setElegidos([]); setSitioId(null); setTipoMuestra(''); setSitio(''); }}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <Campo
                  etiqueta="Identificación del paciente"
                  className="min-w-[220px] flex-1"
                >
                  <Input
                    placeholder="Identificación, nombre o código de solicitud"
                    value={cedula}
                    onChange={(e) =>
                      setCedula(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void buscarSolicitudes();
                      }
                    }}
                    autoFocus
                  />
                </Campo>

                <Button
                  onClick={() =>
                    void buscarSolicitudes()
                  }
                  cargando={buscando}
                  disabled={!cedula.trim()}
                  icono={
                    <IconoBuscar
                      className="h-4 w-4"
                      aria-hidden
                    />
                  }
                >
                  Buscar solicitudes
                </Button>
              </div>

              {errorBusqueda && (
                <Alert>{errorBusqueda}</Alert>
              )}

              {encontradas &&
                encontradas.length === 0 && (
                  <Alert tipo="aviso">
                    No hay solicitudes para esa búsqueda.
                    Cree una desde «Admisión de
                    pacientes».
                  </Alert>
                )}

              {encontradas &&
                encontradas.length > 0 && (
                  <ul className="max-h-44 overflow-y-auto rounded-lg border border-line bg-surface">
                    {encontradas.map((s) => (
                      <li
                        key={s.id}
                        className="border-b border-line last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSolicitud({
                              id: s.id,
                              codigo: s.codigo,
                              paciente: nombrePaciente(
                                s.paciente,
                              ),
                            });
                            setOrden(null); setElegidos([]); setTipoMuestra(''); setSitioId(null); setSitio('');
                          }}
                          className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-accent-soft"
                        >
                          <span className="min-w-0 text-sm text-heading">
                            <span className="font-mono text-xs text-accent">
                              {s.codigo}
                            </span>
                            {' '}
                            <span className="font-semibold">
                              {nombrePaciente(
                                s.paciente,
                              )}
                            </span>
                          </span>

                          <span className="text-xs text-muted">
                            {`${formatFechaHora(
                              s.fechaSolicitud,
                            )}, ${s._count.muestras} muestras`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}
        </fieldset>

        {/* SECCIÓN 2: MUESTRA */}
        <fieldset
          className={`${ESTILO_SECCION} grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-3`}
        >
          <legend className={ESTILO_TITULO}>
            Muestra
          </legend>
          {asistida && !!orden?.examenesSolicitados?.length && <Campo etiqueta="Grupo de la orden" className="md:col-span-3">
            <Combobox aria-label="Grupo de la orden" value={`${tipoMuestra}|${sitioId ?? ''}`}
              options={Array.from(new Map(orden.examenesSolicitados.map(l => [`${l.tipoMuestra}|${l.sitioAnatomicoId ?? ''}`,{
                value: `${l.tipoMuestra}|${l.sitioAnatomicoId ?? ''}`, label: `${l.tipoMuestra}${l.sitioAnatomico ? ` · ${l.sitioAnatomico}` : ''}`,
              }])).values())}
              onValueChange={v => { const l = orden.examenesSolicitados?.find(l => `${l.tipoMuestra}|${l.sitioAnatomicoId ?? ''}` === v); if (l) elegirGrupo(orden,l); }} />
          </Campo>}

          <Campo etiqueta="Tipo de muestra">
            <Combobox value={tipoMuestra} onValueChange={t => { setTipoMuestra(t); setSitioId(null); }} aria-label="Tipo de muestra"
              options={(asistida ? catalogo.datos!.tiposMuestra : TIPOS_FRECUENTES).map((t) => ({ value: t, label: t }))}
              allowFreeText={!asistida} disabled={asistida && !!orden?.examenesSolicitados?.length} required />
          </Campo>

          {asistida ? <SitioSelector value={sitioId} onChange={setSitioId} tipoMuestra={tipoMuestra}
            sitios={catalogo.datos!.sitios} puedeCrear={puede('usuarios.administrar')} onCreado={catalogo.recargar}
            permitidos={examenes.datos?.filter(e => elegidos.includes(e.id)).flatMap(e => e.sitiosPermitidos ?? [])}
            disabled={!!orden?.examenesSolicitados?.length} /> : <Campo etiqueta="Sitio anatómico">
            <Input
              value={sitio}
              onChange={(e) =>
                setSitio(e.target.value)
              }
            />
          </Campo>}

          <Campo etiqueta="Fecha y hora de toma">
            <DateTimePicker value={fechaToma} onValueChange={setFechaToma} max={ahoraParaInput()} required />
          </Campo>
        </fieldset>

        {/* SECCIÓN 3: EXÁMENES */}
        <fieldset className={ESTILO_SECCION}>
          <legend className={ESTILO_TITULO}>
            Exámenes a realizar
          </legend>

          {examenes.error && (
            <Alert>{examenes.error}</Alert>
          )}

          {examenes.cargando && (
            <p className="text-sm text-muted">
              Cargando catálogo de exámenes
            </p>
          )}
          <Campo etiqueta="Buscar examen"><Input type="search" value={buscarExamen} onChange={e => setBuscarExamen(e.target.value)} /></Campo>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {examenes.datos?.filter(e => normalizarBusqueda(`${e.nombre} ${e.codigo}`).includes(normalizarBusqueda(buscarExamen))).map((examen) => {
              const seleccionado =
                elegidos.includes(examen.id);

              return (
                <label
                  key={examen.id}
                  className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    seleccionado
                      ? 'border-[#c8b5e1] bg-accent-soft'
                      : 'border-line bg-surface hover:border-line hover:bg-accent-soft'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={asistida && !!orden?.examenesSolicitados?.length}
                    checked={seleccionado}
                    onChange={() =>
                      alternarExamen(
                        examen.id,
                        examen.tipoMuestraRequerida,
                      )
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#60379a]"
                  />

                  <span className="min-w-0 text-sm leading-5 text-heading">
                    <span className="font-medium">
                      {examen.nombre}
                    </span>

                    <span className="ml-1 text-xs text-muted">
                      ({examen.tipoMuestraRequerida})
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {asistida && elegidos.map(id => {
          const e = orden?.examenesSolicitados?.find(l => l.examenId === id) ?? examenes.datos?.find(e => e.id === id);
          return e?.instruccionesToma ? <p key={id} className="text-sm text-muted">Instrucciones del catálogo: {e.instruccionesToma}</p> : null;
        })}
      </form>
    </Modal>
  );
}
