import { medicosApi } from '../../services/medicos';
import { MedicoSelector } from '../medicos/MedicoSelector';
import { RemitenteSolicitudModal } from '../medicos/RemitenteSolicitudModal';
import { IconoEditar, IconoSolicitudes, IconoMuestras } from '../icons/LabZenIcon';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useCarga } from '../../hooks/useCarga';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import { pacientesApi, solicitudesApi } from '../../services/laboratorio';
import type { PacienteDetalle, Prioridad } from '../../types/api';
import { SEXO_ETIQUETA, formatEdad, formatFechaDia, formatFechaHora, nombrePaciente, opcional } from '../../utils/format';
import { identificacionTexto } from '../../utils/identificacion';
import { IdentificacionModal } from './IdentificacionModal';
import { PrioridadBadge } from '../UI/Badge';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { DataTable, type Column } from '../UI/DataTable';
import { Dato, Datos, Seccion } from '../UI/Dato';
import { Campo, Input, Select, Textarea } from '../UI/Form';
import { Modal } from '../UI/Modal';
import { PacienteFormModal } from './PacienteFormModal';

type SolicitudFila = PacienteDetalle['solicitudes'][number];

interface Props {
  pacienteId: number;
  puedeEscribir: boolean;
  onCerrar: () => void;
  /** Se invoca cuando cambian datos que afectan al listado de fondo. */
  onCambio: () => void;
}

/** Modal Master-Detail: datos del paciente (maestro) y sus solicitudes (detalle). */
export function PacienteDetalleModal({ pacienteId, puedeEscribir, onCerrar, onCambio }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { datos: paciente, cargando, error, recargar } = useCarga(() => pacientesApi.obtener(pacienteId), [pacienteId]);
  const capacidadMedicos = useCarga(() => medicosApi.capacidades(), []);
  const directorioMedicos = capacidadMedicos.datos?.directorioMedicos === true;
  const [remitenteSolicitud, setRemitenteSolicitud] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [identificando, setIdentificando] = useState(false);
  const [nuevaSolicitud, setNuevaSolicitud] = useState(false);
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);

  const columnas = useMemo<Column<SolicitudFila>[]>(
    () => [
      { id: 'codigo', header: 'Solicitud', accessor: (s) => s.codigo, cell: (s) => <span className="font-mono text-xs">{s.codigo}</span> },
      { id: 'fecha', header: 'Fecha', accessor: (s) => s.fechaSolicitud, cell: (s) => formatFechaHora(s.fechaSolicitud) },
      { id: 'prioridad', header: 'Prioridad', accessor: (s) => s.prioridad, cell: (s) => <PrioridadBadge prioridad={s.prioridad} /> },
      { id: 'medico', header: 'Médico solicitante', accessor: (s) => s.medicoRemitenteNombre ?? s.medicoSolicitante },
      { id: 'diagnostico', header: 'Diagnóstico presuntivo', accessor: (s) => s.diagnosticoPresuntivo },
      { id: 'muestras', header: 'Muestras', accessor: (s) => s._count.muestras, align: 'right' },
      {
        id: 'accion',
        header: 'Acción',
        sortable: false,
        accessor: () => null,
        align: 'right',
        cell: (s) =>
          puedeEscribir ? (
            <div className="flex flex-wrap gap-2">{directorioMedicos && <Button tamano="sm" onClick={() => setRemitenteSolicitud(s.id)} aria-label={`Editar remitente de ${s.codigo}`}>Remitente</Button>}
            <Button tamano="sm" variante="fantasma" icono={<IconoMuestras className="h-3.5 w-3.5" aria-hidden />} onClick={() => navigate(`/recepcion?solicitudId=${s.id}`)}>
              Registrar muestra
            </Button></div>
          ) : null,
      },
    ],
    [puedeEscribir, navigate, directorioMedicos],
  );

  return (
    <>
      <Modal
        abierto
        ancho="xl"
        titulo={paciente ? nombrePaciente(paciente) : 'Paciente'}
        subtitulo={paciente ? (paciente.identificacion ? identificacionTexto(paciente) : paciente.cedula ? `Cédula ${paciente.cedula}` : 'Identificación no disponible') : undefined}
        onCerrar={() => { if (!guardandoSolicitud) onCerrar(); }}
        pie={<Button onClick={onCerrar} disabled={guardandoSolicitud}>Cerrar</Button>}
      >
        {error && <Alert>{error}</Alert>}
        {cargando && !paciente && <p className="text-slate-500">Cargando datos del paciente</p>}
        {paciente && (
          <>
            <div className="flex items-start justify-between gap-5 rounded-xl border border-line bg-subtle p-5">
                <Datos columnas={4}>
                <Dato etiqueta="Edad actual">{formatEdad(paciente.fechaNacimiento)}</Dato>
                {paciente.identificacion && 'motivoAusencia' in paciente.identificacion &&
                  <Dato etiqueta="Motivo de ausencia documental">{paciente.identificacion.motivoAusencia}</Dato>}
                <Dato etiqueta="Fecha de nacimiento">{formatFechaDia(paciente.fechaNacimiento)}</Dato>
                <Dato etiqueta="Sexo">{SEXO_ETIQUETA[paciente.sexo]}</Dato>
                <Dato etiqueta="Teléfono">{paciente.telefono}</Dato>
                <Dato etiqueta="Correo electrónico" className="col-span-2">{paciente.email}</Dato>
                <Dato etiqueta="Dirección" className="col-span-2">{paciente.direccion}</Dato>
              </Datos>
              {puedeEscribir && (
                <div className="flex flex-col gap-3"><Button tamano="sm" icono={<IconoEditar className="h-3.5 w-3.5" aria-hidden />} onClick={() => setEditando(true)}>
                  Editar datos
                </Button>
                {paciente.identificacion && paciente.versionIdentificacion !== undefined &&
                  <Button tamano="sm" onClick={() => setIdentificando(true)}>
                    {paciente.identificacion.estado === 'LEGADO_POR_REVISAR' ? 'Revisar identificación' : 'Actualizar identificación'}
                  </Button>}
                </div>
              )}
            </div>

            <Seccion
              titulo="Solicitudes médicas"
              acciones={
                puedeEscribir && !nuevaSolicitud ? (
                  <Button tamano="sm" variante="primario" icono={<IconoSolicitudes className="h-3.5 w-3.5" aria-hidden />} onClick={() => setNuevaSolicitud(true)}>
                    Nueva solicitud
                  </Button>
                ) : undefined
              }
            >
              {nuevaSolicitud && (
                <NuevaSolicitudForm
                  pacienteId={paciente.id}
                  directorioMedicos={directorioMedicos}
                  guardando={guardandoSolicitud}
                  setGuardando={setGuardandoSolicitud}
                  onCancelar={() => setNuevaSolicitud(false)}
                  onCreada={(codigo) => {
                    toast.exito(`Solicitud ${codigo} creada. Ya puede registrar sus muestras.`);
                    setNuevaSolicitud(false);
                    recargar();
                    onCambio();
                  }}
                />
              )}
              <DataTable
                columnas={columnas}
                filas={paciente.solicitudes}
                clave={(s) => s.id}
                ocultarFiltro
                mensajeVacio="Este paciente aún no tiene solicitudes. Cree la primera con «Nueva solicitud»."
                ordenInicial={{ columna: 'fecha', direccion: 'desc' }}
              />
            </Seccion>
          </>
        )}
      </Modal>

      {remitenteSolicitud !== null && <RemitenteSolicitudModal solicitudId={remitenteSolicitud}
        onCerrar={() => setRemitenteSolicitud(null)} onGuardado={() => { setRemitenteSolicitud(null); recargar(); onCambio(); }} />}
      {editando && paciente && (
        <PacienteFormModal
          paciente={paciente}
          onCerrar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            recargar();
            onCambio();
          }}
        />
      )}
      {identificando && paciente && <IdentificacionModal paciente={paciente} onCerrar={() => setIdentificando(false)}
        onGuardado={() => { setIdentificando(false); recargar(); onCambio(); }} />}
    </>
  );
}

function NuevaSolicitudForm({ directorioMedicos, pacienteId, onCancelar, onCreada, guardando, setGuardando }: {
  pacienteId: number;
  directorioMedicos: boolean;
  onCancelar: () => void;
  onCreada: (codigo: string) => void;
  guardando: boolean;
  setGuardando: (guardando: boolean) => void;
}) {
  const [prioridad, setPrioridad] = useState<Prioridad>('RUTINA');
  const [medico, setMedico] = useState('');
  const [medicoId, setMedicoId] = useState<number | null>(null);
  const [diagnostico, setDiagnostico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleCampo[]>([]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setDetalles([]);
    try {
      const solicitud = await solicitudesApi.crear({
        pacienteId,
        prioridad,
        ...(directorioMedicos && medicoId !== null ? { medicoRemitenteId: medicoId } : { medicoSolicitante: opcional(medico) }),
        diagnosticoPresuntivo: opcional(diagnostico),
        observaciones: opcional(observaciones),
      });
      setGuardando(false);
      onCreada(solicitud.codigo);
    } catch (e) {
      setError(mensajeDeError(e));
      setDetalles(detallesDeError(e));
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mb-4 grid grid-cols-1 gap-x-5 gap-y-4 rounded-xl border border-line bg-subtle p-5 md:grid-cols-3">
      {error && (
        <div className="md:col-span-3">
          <Alert detalles={detalles}>{error}</Alert>
        </div>
      )}
      <Campo etiqueta="Prioridad">
        <Select value={prioridad} onValueChange={(value) => setPrioridad(value as Prioridad)}>
          <option value="RUTINA">Rutina</option>
          <option value="URGENTE">Urgente</option>
        </Select>
      </Campo>
      <Campo etiqueta="Médico solicitante">
        <Input maxLength={120} disabled={guardando || (directorioMedicos && medicoId !== null)} value={medico} onChange={(e) => setMedico(e.target.value)} />
      </Campo>
      {directorioMedicos && <div className="md:col-span-2"><MedicoSelector value={medicoId} onChange={setMedicoId} disabled={guardando} /></div>}
      <Campo etiqueta="Diagnóstico presuntivo">
        <Input value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
      </Campo>
      <Campo etiqueta="Observaciones" className="md:col-span-3">
        <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
      </Campo>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4 md:col-span-3">
        <Button onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variante="primario" cargando={guardando}>
          Crear solicitud
        </Button>
      </div>
    </form>
  );
}
