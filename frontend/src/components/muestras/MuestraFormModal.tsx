import { Search } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '../../context/ToastContext';
import { useCarga } from '../../hooks/useCarga';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import { examenesApi, muestrasApi, solicitudesApi } from '../../services/laboratorio';
import type { MuestraDetalle, SolicitudLista } from '../../types/api';
import { ahoraParaInput, formatFechaHora, nombrePaciente, opcional } from '../../utils/format';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { Campo, Input } from '../UI/Form';
import { Modal } from '../UI/Modal';

interface Props {
  /** Si viene de la admisión de un paciente, la solicitud llega preseleccionada. */
  solicitudIdInicial: number | null;
  onCerrar: () => void;
  onRegistrada: (muestra: MuestraDetalle) => void;
}

interface SolicitudElegida {
  id: number;
  codigo: string;
  paciente: string;
}

const TIPOS_FRECUENTES = ['Orina', 'Heces', 'Sangre', 'Esputo', 'Exudado faríngeo', 'Secreción de herida', 'Líquido cefalorraquídeo'];
const ID_FORMULARIO = 'form-muestra';

export function MuestraFormModal({ solicitudIdInicial, onCerrar, onRegistrada }: Props) {
  const toast = useToast();
  const examenes = useCarga(() => examenesApi.listar(), []);

  const [solicitud, setSolicitud] = useState<SolicitudElegida | null>(null);
  const [cedula, setCedula] = useState('');
  const [encontradas, setEncontradas] = useState<SolicitudLista[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const [tipoMuestra, setTipoMuestra] = useState('');
  const [sitio, setSitio] = useState('');
  const [fechaToma, setFechaToma] = useState(ahoraParaInput());
  const [elegidos, setElegidos] = useState<number[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleCampo[]>([]);

  // Solicitud preseleccionada (viene del detalle del paciente).
  useEffect(() => {
    if (solicitudIdInicial === null) return;
    let vigente = true;
    solicitudesApi
      .obtener(solicitudIdInicial)
      .then((s) => {
        if (vigente) setSolicitud({ id: s.id, codigo: s.codigo, paciente: nombrePaciente(s.paciente) });
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeDeError(e));
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
      const respuesta = await solicitudesApi.listar({ cedula: cedula.trim(), pageSize: 20 });
      setEncontradas(respuesta.data);
    } catch (e) {
      setErrorBusqueda(mensajeDeError(e));
    } finally {
      setBuscando(false);
    }
  }

  function alternarExamen(id: number, tipoRequerido: string) {
    setElegidos((actuales) => (actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]));
    // Sugerencia: si aún no se indicó el tipo de muestra, se toma del examen elegido.
    if (!tipoMuestra && tipoRequerido.toLowerCase() !== 'variable') {
      setTipoMuestra(tipoRequerido);
    }
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!solicitud) {
      setError('Seleccione la solicitud a la que pertenece la muestra.');
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
      toast.exito(`Muestra registrada con código ${muestra.codigoBarras}`);
      onRegistrada(muestra);
    } catch (e) {
      setError(mensajeDeError(e));
      setDetalles(detallesDeError(e));
      setGuardando(false);
    }
  }

  const puedeGuardar = solicitud !== null && tipoMuestra.trim().length >= 2 && elegidos.length > 0 && fechaToma !== '';

  return (
    <Modal
      abierto
      ancho="lg"
      titulo="Registrar muestra"
      subtitulo="El código de barras único se genera al guardar."
      onCerrar={onCerrar}
      pie={
        <>
          <Button onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form={ID_FORMULARIO} variante="primario" cargando={guardando} disabled={!puedeGuardar}>
            Registrar muestra
          </Button>
        </>
      }
    >
      <form id={ID_FORMULARIO} onSubmit={enviar} className="space-y-4">
        {error && <Alert detalles={detalles}>{error}</Alert>}

        <fieldset className="space-y-2">
          <legend className="mb-1 font-serif text-base font-semibold text-slate-900">Solicitud</legend>
          {solicitud ? (
            <div className="flex items-center justify-between rounded border border-violeta-200 bg-violeta-50 px-3 py-2">
              <p className="text-sm">
                <span className="font-mono text-xs">{solicitud.codigo}</span> para <span className="font-semibold">{solicitud.paciente}</span>
              </p>
              <Button tamano="sm" variante="fantasma" onClick={() => setSolicitud(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <Campo etiqueta="Cédula del paciente" className="w-64">
                  <Input
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void buscarSolicitudes();
                      }
                    }}
                    autoFocus
                  />
                </Campo>
                <Button onClick={() => void buscarSolicitudes()} cargando={buscando} disabled={!cedula.trim()} icono={<Search className="h-3.5 w-3.5" aria-hidden />}>
                  Buscar solicitudes
                </Button>
              </div>
              {errorBusqueda && <Alert>{errorBusqueda}</Alert>}
              {encontradas && encontradas.length === 0 && (
                <Alert tipo="aviso">No hay solicitudes para esa cédula. Cree una desde «Admisión de pacientes».</Alert>
              )}
              {encontradas && encontradas.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded border border-slate-300">
                  {encontradas.map((s) => (
                    <li key={s.id} className="border-b border-slate-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setSolicitud({ id: s.id, codigo: s.codigo, paciente: nombrePaciente(s.paciente) })}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-violeta-50"
                      >
                        <span>
                          <span className="font-mono text-xs">{s.codigo}</span> <span className="font-semibold">{nombrePaciente(s.paciente)}</span>
                        </span>
                        <span className="text-xs text-slate-500">{`${formatFechaHora(s.fechaSolicitud)}, ${s._count.muestras} muestras`}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </fieldset>

        <fieldset className="grid grid-cols-3 gap-3">
          <legend className="mb-1 font-serif text-base font-semibold text-slate-900">Muestra</legend>
          <Campo etiqueta="Tipo de muestra">
            <Input value={tipoMuestra} onChange={(e) => setTipoMuestra(e.target.value)} list="tipos-muestra" required />
            <datalist id="tipos-muestra">
              {TIPOS_FRECUENTES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Campo>
          <Campo etiqueta="Sitio anatómico">
            <Input value={sitio} onChange={(e) => setSitio(e.target.value)} />
          </Campo>
          <Campo etiqueta="Fecha y hora de toma">
            <Input type="datetime-local" value={fechaToma} max={ahoraParaInput()} onChange={(e) => setFechaToma(e.target.value)} required />
          </Campo>
        </fieldset>

        <fieldset>
          <legend className="mb-1 font-serif text-base font-semibold text-slate-900">Exámenes a realizar</legend>
          {examenes.error && <Alert>{examenes.error}</Alert>}
          {examenes.cargando && <p className="text-slate-500">Cargando catálogo de exámenes</p>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {examenes.datos?.map((examen) => (
              <label key={examen.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-violeta-50">
                <input
                  type="checkbox"
                  checked={elegidos.includes(examen.id)}
                  onChange={() => alternarExamen(examen.id, examen.tipoMuestraRequerida)}
                  className="h-3.5 w-3.5 accent-violeta-700"
                />
                <span>
                  {examen.nombre} <span className="text-xs text-slate-500">({examen.tipoMuestraRequerida})</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
