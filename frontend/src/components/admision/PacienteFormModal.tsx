import { useState, type FormEvent } from 'react';
import { useToast } from '../../context/ToastContext';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import { pacientesApi } from '../../services/laboratorio';
import type { Paciente, Sexo } from '../../types/api';
import { aInputFecha, opcional } from '../../utils/format';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { Campo, Input, Select } from '../UI/Form';
import { Modal } from '../UI/Modal';

interface Props {
  /** null = registrar un paciente nuevo; con valor = editar (la cédula no se modifica). */
  paciente: Paciente | null;
  onCerrar: () => void;
  onGuardado: (paciente: Paciente) => void;
}

const ID_FORMULARIO = 'form-paciente';

export function PacienteFormModal({ paciente, onCerrar, onGuardado }: Props) {
  const toast = useToast();
  const [cedula, setCedula] = useState(paciente?.cedula ?? '');
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
      telefono: opcional(telefono),
      email: opcional(email),
      direccion: opcional(direccion),
    };

    try {
      const guardado = paciente
        ? await pacientesApi.actualizar(paciente.id, datos)
        : await pacientesApi.crear({ cedula: cedula.trim(), ...datos });
      toast.exito(paciente ? 'Datos del paciente actualizados' : 'Paciente registrado');
      onGuardado(guardado);
    } catch (e) {
      setError(mensajeDeError(e));
      setDetalles(detallesDeError(e));
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto
      ancho="md"
      titulo={paciente ? 'Editar paciente' : 'Registrar paciente'}
      subtitulo={paciente ? `Cédula ${paciente.cedula}` : undefined}
      onCerrar={onCerrar}
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
      <form id={ID_FORMULARIO} onSubmit={enviar} className="grid grid-cols-2 gap-3">
        {error && (
          <div className="col-span-2">
            <Alert detalles={detalles}>{error}</Alert>
          </div>
        )}
        <Campo etiqueta="Cédula">
          <Input value={cedula} onChange={(e) => setCedula(e.target.value)} disabled={paciente !== null} required autoFocus={!paciente} />
        </Campo>
        <Campo etiqueta="Fecha de nacimiento">
          <Input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Nombres">
          <Input value={nombres} onChange={(e) => setNombres(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Apellidos">
          <Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Sexo">
          <Select value={sexo} onChange={(e) => setSexo(e.target.value as Sexo)}>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="O">Otro</option>
          </Select>
        </Campo>
        <Campo etiqueta="Teléfono">
          <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </Campo>
        <Campo etiqueta="Correo electrónico" className="col-span-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etiqueta="Dirección" className="col-span-2">
          <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </Campo>
      </form>
    </Modal>
  );
}
