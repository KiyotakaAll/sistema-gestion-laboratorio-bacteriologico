
import { Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
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
  'min-w-0 rounded-xl border border-[#e3e7ed] bg-[#fafbfd] px-5 py-4';

const ESTILO_TITULO =
  'mb-3 font-serif text-lg font-semibold text-[#30203f]';

export function MuestraFormModal({
  solicitudIdInicial,
  onCerrar,
  onRegistrada,
}: Props) {
  const toast = useToast();
  const examenes = useCarga(() => examenesApi.listar(), []);

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

  // Conserva la solicitud preseleccionada.
  useEffect(() => {
    if (solicitudIdInicial === null) return;

    let vigente = true;

    solicitudesApi
      .obtener(solicitudIdInicial)
      .then((s) => {
        if (vigente) {
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

  async function buscarSolicitudes() {
    if (!cedula.trim()) return;

    setBuscando(true);
    setErrorBusqueda(null);

    try {
      const respuesta = await solicitudesApi.listar({
        cedula: cedula.trim(),
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
        sitioAnatomico: opcional(sitio),
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
      onCerrar={onCerrar}
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ded4ee] bg-[#f5f1fb] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#68758a]">
                  Solicitud seleccionada
                </p>

                <p className="mt-1 break-words text-sm text-[#30203f]">
                  <span className="font-mono font-semibold text-[#60379a]">
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
                onClick={() => setSolicitud(null)}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <Campo
                  etiqueta="Cédula del paciente"
                  className="min-w-[220px] flex-1"
                >
                  <Input
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
                    <Search
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
                    No hay solicitudes para esa cédula.
                    Cree una desde «Admisión de
                    pacientes».
                  </Alert>
                )}

              {encontradas &&
                encontradas.length > 0 && (
                  <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#e3e7ed] bg-white">
                    {encontradas.map((s) => (
                      <li
                        key={s.id}
                        className="border-b border-[#edf0f4] last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSolicitud({
                              id: s.id,
                              codigo: s.codigo,
                              paciente: nombrePaciente(
                                s.paciente,
                              ),
                            })
                          }
                          className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#f5f1fb]"
                        >
                          <span className="min-w-0 text-sm text-[#30203f]">
                            <span className="font-mono text-xs text-[#60379a]">
                              {s.codigo}
                            </span>
                            {' '}
                            <span className="font-semibold">
                              {nombrePaciente(
                                s.paciente,
                              )}
                            </span>
                          </span>

                          <span className="text-xs text-[#68758a]">
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

          <Campo etiqueta="Tipo de muestra">
            <Input
              value={tipoMuestra}
              onChange={(e) =>
                setTipoMuestra(e.target.value)
              }
              list="tipos-muestra"
              required
            />

            <datalist id="tipos-muestra">
              {TIPOS_FRECUENTES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Campo>

          <Campo etiqueta="Sitio anatómico">
            <Input
              value={sitio}
              onChange={(e) =>
                setSitio(e.target.value)
              }
            />
          </Campo>

          <Campo etiqueta="Fecha y hora de toma">
            <Input
              type="datetime-local"
              value={fechaToma}
              max={ahoraParaInput()}
              onChange={(e) =>
                setFechaToma(e.target.value)
              }
              required
            />
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
            <p className="text-sm text-[#68758a]">
              Cargando catálogo de exámenes
            </p>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {examenes.datos?.map((examen) => {
              const seleccionado =
                elegidos.includes(examen.id);

              return (
                <label
                  key={examen.id}
                  className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    seleccionado
                      ? 'border-[#c8b5e1] bg-[#f5f1fb]'
                      : 'border-[#e8ebf1] bg-white hover:border-[#d5c6e9] hover:bg-[#faf7fe]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={seleccionado}
                    onChange={() =>
                      alternarExamen(
                        examen.id,
                        examen.tipoMuestraRequerida,
                      )
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#60379a]"
                  />

                  <span className="min-w-0 text-sm leading-5 text-[#30203f]">
                    <span className="font-medium">
                      {examen.nombre}
                    </span>

                    <span className="ml-1 text-xs text-[#68758a]">
                      ({examen.tipoMuestraRequerida})
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
