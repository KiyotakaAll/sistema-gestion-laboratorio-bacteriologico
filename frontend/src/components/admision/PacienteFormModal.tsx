import { useState, type FormEvent } from 'react';
import { useToast } from '../../context/ToastContext';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import { pacientesApi } from '../../services/laboratorio';
import type { Paciente, Sexo } from '../../types/api';
import { aInputFecha, opcional, diaColombia } from '../../utils/format';
import { identificacionTexto } from '../../utils/identificacion';
import { IdentificacionCampos, identificacionInicial, entradaIdentificacion, ErrorIdentificacionFormulario } from './IdentificacionCampos';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { Campo, Input, Select } from '../UI/Form';
import { DatePicker } from '../UI/DatePicker';
import { Modal } from '../UI/Modal';

interface Props {
  /** null = registrar un paciente nuevo; con valor = editar (la cédula no se modifica). */
  paciente: Paciente | null;
  onCerrar: () => void;
  onGuardado: (paciente: Paciente) => void;
  identificacionHabilitada?: boolean;
}

const ID_FORMULARIO = 'form-paciente';

export function PacienteFormModal({ paciente, onCerrar, onGuardado, identificacionHabilitada = false }: Props) {
  const toast = useToast();
  const [cedula, setCedula] = useState(paciente?.cedula ?? '');
  const [identificacion, setIdentificacion] = useState(() => identificacionInicial());
  const [nombres, setNombres] = useState(paciente?.nombres ?? '');
  const [apellidos, setApellidos] = useState(paciente?.apellidos ?? '');
  const [fechaNacimiento, setFechaNacimiento] = useState(paciente ? aInputFecha(paciente.fechaNacimiento) : '');
  const [sexo, setSexo] = useState<Sexo>(paciente?.sexo ?? 'F');
  const [telefono, setTelefono] = useState(paciente?.telefono ?? '');
  const [email, setEmail] = useState(paciente?.email ?? '');
  const [direccion, setDireccion] = useState(paciente?.direccion ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleCampo[]>([]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    setDetalles([]);

    const datos = {
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      fechaNacimiento,
      sexo,
      telefono: opcional(telefono) ?? (paciente ? null : undefined),
      email: opcional(email) ?? (paciente ? null : undefined),
      direccion: opcional(direccion) ?? (paciente ? null : undefined),
    };

    try {
      const guardado = paciente
        ? await pacientesApi.actualizar(paciente.id, datos)
        : await pacientesApi.crear({ ...datos, ...(identificacionHabilitada
          ? { identificacion: entradaIdentificacion(identificacion) } : { cedula: cedula.trim() }) });
      toast.exito(paciente ? 'Datos del paciente actualizados' : 'Paciente registrado');
      onGuardado(guardado);
    } catch (e) {
      setError(e instanceof ErrorIdentificacionFormulario ? e.message : mensajeDeError(e));
      setDetalles(detallesDeError(e));
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      ancho="md"
      titulo={paciente ? 'Editar paciente' : 'Registrar paciente'}
      subtitulo={paciente ? (paciente.identificacion ? identificacionTexto(paciente) : paciente.cedula ? `Cédula ${paciente.cedula}` : 'Identificación no disponible') : undefined}
      onCerrar={() => { if (!guardando) onCerrar(); }}
      pie={
        <>
          <Button onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form={ID_FORMULARIO} variante="primario" cargando={guardando}>
            {paciente ? 'Guardar cambios' : 'Registrar paciente'}
          </Button>
        </>
      }
    >
      <form id={ID_FORMULARIO} onSubmit={enviar} className="lz-patient-form">
        {error && (
          <div className="col-span-2">
            <Alert detalles={detalles}>{error}</Alert>
          </div>
        )}
        {!paciente && identificacionHabilitada && <IdentificacionCampos value={identificacion} onChange={setIdentificacion} />}
        <fieldset className="lz-form-section"><legend>Datos del paciente</legend><div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {!identificacionHabilitada && !paciente?.identificacion &&
        <Campo etiqueta="Cédula">
          <Input value={cedula} onChange={(e) => setCedula(e.target.value)} disabled={paciente !== null} required autoFocus={!paciente} />
        </Campo>}
        <Campo etiqueta="Fecha de nacimiento">
          <DatePicker value={fechaNacimiento} onValueChange={setFechaNacimiento} min="1900-01-01" max={diaColombia()} required />
        </Campo>
        <Campo etiqueta="Nombres">
          <Input value={nombres} onChange={(e) => setNombres(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Apellidos">
          <Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Sexo">
          <Select value={sexo} onValueChange={(value) => setSexo(value as Sexo)}>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="O">Otro</option>
          </Select>
        </Campo>
        </div></fieldset>
        <fieldset className="lz-form-section"><legend>Información de contacto</legend><div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Campo etiqueta="Teléfono">
          <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Campo>
        <Campo etiqueta="Correo electrónico" className="col-span-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etiqueta="Dirección" className="col-span-2">
          <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </Campo>
        </div></fieldset>
      </form>
    </Modal>
  );
}
