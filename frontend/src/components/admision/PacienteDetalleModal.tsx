import { Pencil, Plus, TestTubes } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useCarga } from '../../hooks/useCarga';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import { pacientesApi, solicitudesApi } from '../../services/laboratorio';
import type { PacienteDetalle, Prioridad } from '../../types/api';
import { SEXO_ETIQUETA, calcularEdad, formatFechaDia, formatFechaHora, nombrePaciente, opcional } from '../../utils/format';
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
  const [editando, setEditando] = useState(false);
  const [nuevaSolicitud, setNuevaSolicitud] = useState(false);

  const columnas = useMemo<Column<SolicitudFila>[]>(
    () => [
      { id: 'codigo', header: 'Solicitud', accessor: (s) => s.codigo, cell: (s) => <span className="font-mono text-xs">{s.codigo}</span> },
      { id: 'fecha', header: 'Fecha', accessor: (s) => s.fechaSolicitud, cell: (s) => formatFechaHora(s.fechaSolicitud) },
      { id: 'prioridad', header: 'Prioridad', accessor: (s) => s.prioridad, cell: (s) => <PrioridadBadge prioridad={s.prioridad} /> },
      { id: 'medico', header: 'Médico solicitante', accessor: (s) => s.medicoSolicitante },
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
            <Button tamano="sm" variante="fantasma" icono={<TestTubes className="h-3.5 w-3.5" aria-hidden />} onClick={() => navigate(`/recepcion?solicitudId=${s.id}`)}>
              Registrar muestra
            </Button>
          ) : null,
      },
    ],
    [puedeEscribir, navigate],
  );

  return (
    <>
      <Modal
        abierto
        ancho="xl"
        titulo={paciente ? nombrePaciente(paciente) : 'Paciente'}
        subtitulo={paciente ? `Cédula ${paciente.cedula}` : undefined}
        onCerrar={onCerrar}
        pie={<Button onClick={onCerrar}>Cerrar</Button>}
      >
        {error && <Alert>{error}</Alert>}
        {cargando && !paciente && <p className="text-slate-500">Cargando datos del paciente</p>}
        {paciente && (
          <>
            <div className="flex items-start justify-between gap-4">
              <Datos columnas={4}>
                <Dato etiqueta="Edad">{`${calcularEdad(paciente.fechaNacimiento)} años`}</Dato>
                <Dato etiqueta="Fecha de nacimiento">{formatFechaDia(paciente.fechaNacimiento)}</Dato>
                <Dato etiqueta="Sexo">{SEXO_ETIQUETA[paciente.sexo]}</Dato>
                <Dato etiqueta="Teléfono">{paciente.telefono}</Dato>
                <Dato etiqueta="Correo electrónico" className="col-span-2">{paciente.email}</Dato>
                <Dato etiqueta="Dirección" className="col-span-2">{paciente.direccion}</Dato>
              </Datos>
              {puedeEscribir && (
                <Button tamano="sm" icono={<Pencil className="h-3.5 w-3.5" aria-hidden />} onClick={() => setEditando(true)}>
                  Editar datos
                </Button>
              )}
            </div>

            <Seccion
              titulo="Solicitudes médicas"
              acciones={
                puedeEscribir && !nuevaSolicitud ? (
                  <Button tamano="sm" variante="primario" icono={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={() => setNuevaSolicitud(true)}>
                    Nueva solicitud
                  </Button>
                ) : undefined
              }
            >
              {nuevaSolicitud && (
                <NuevaSolicitudForm
                  pacienteId={paciente.id}
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
    </>
  );
}

function NuevaSolicitudForm({ pacienteId, onCancelar, onCreada }: { pacienteId: number; onCancelar: () => void; onCreada: (codigo: string) => void }) {
  const [prioridad, setPrioridad] = useState<Prioridad>('RUTINA');
  const [medico, setMedico] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
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
        medicoSolicitante: opcional(medico),
        diagnosticoPresuntivo: opcional(diagnostico),
        observaciones: opcional(observaciones),
      });
      onCreada(solicitud.codigo);
    } catch (e) {
      setError(mensajeDeError(e));
      setDetalles(detallesDeError(e));
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mb-3 grid grid-cols-3 gap-3 rounded border border-violeta-200 bg-violeta-50/50 p-3">
      {error && (
        <div className="col-span-3">
          <Alert detalles={detalles}>{error}</Alert>
        </div>
      )}
      <Campo etiqueta="Prioridad">
        <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
          <option value="RUTINA">Rutina</option>
          <option value="URGENTE">Urgente</option>
        </Select>
      </Campo>
      <Campo etiqueta="Médico solicitante">
        <Input value={medico} onChange={(e) => setMedico(e.target.value)} />
      </Campo>
      <Campo etiqueta="Diagnóstico presuntivo">
        <Input value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} />
      </Campo>
      <Campo etiqueta="Observaciones" className="col-span-3">
        <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
      </Campo>
      <div className="col-span-3 flex justify-end gap-2">
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
