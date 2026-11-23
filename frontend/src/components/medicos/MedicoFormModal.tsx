import { useRef, useState, type FormEvent } from 'react';
import { Alert } from '../UI/Alert';
import { Button } from '../UI/Button';
import { Campo, Input } from '../UI/Form';
import { Modal } from '../UI/Modal';
import { detallesDeError, mensajeDeError, type DetalleCampo } from '../../services/api';
import { medicosApi } from '../../services/medicos';
import type { DatosMedico, MedicoRemitente } from '../../types/medicos';

const campos = [
  ['nombres', 'Nombres', 80], ['apellidos', 'Apellidos', 80],
  ['registroProfesional', 'Registro profesional', 50], ['especialidad', 'Especialidad', 100],
  ['telefono', 'Teléfono', 25], ['email', 'Correo electrónico', 120], ['institucion', 'Institución', 120],
] as const;

export function MedicoFormModal({ medico, onCerrar, onGuardado }: {
  medico?: MedicoRemitente; onCerrar: () => void; onGuardado: () => void;
}) {
  const [datos, setDatos] = useState(() => Object.fromEntries(campos.map(([k]) => [k, medico?.[k] ?? ''])) as Record<keyof DatosMedico, string>);
  const [guardando, setGuardando] = useState(false);
  const bloqueo = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleCampo[]>([]);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (bloqueo.current) return;
    bloqueo.current = true; setGuardando(true); setError(null); setDetalles([]);
    const cuerpo = Object.fromEntries(campos.map(([k]) => [k, datos[k].trim() || null])) as DatosMedico;
    try {
      if (medico) await medicosApi.actualizar(medico.id, cuerpo); else await medicosApi.crear(cuerpo);
      onGuardado();
    } catch (err) { setError(mensajeDeError(err)); setDetalles(detallesDeError(err)); }
    finally { bloqueo.current = false; setGuardando(false); }
  }
  return <Modal abierto titulo={medico ? 'Editar médico remitente' : 'Nuevo médico remitente'}
    onCerrar={() => { if (!bloqueo.current) onCerrar(); }} ancho="md">
    <form onSubmit={enviar} className="space-y-4" aria-busy={guardando}>
      {error && <Alert detalles={detalles}>{error}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {campos.map(([k, label, max]) => <Campo key={k} etiqueta={label}
          ayuda={k === 'registroProfesional' ? 'Opcional. Registre únicamente el dato confirmado.' : undefined}>
          <Input value={datos[k]} required={k === 'nombres' || k === 'apellidos'} maxLength={max}
            type={k === 'email' ? 'email' : k === 'telefono' ? 'tel' : 'text'} disabled={guardando}
            onChange={e => setDatos(prev => ({ ...prev, [k]: e.target.value }))} />
        </Campo>)}
      </div>
      <div className="flex justify-end gap-3 border-t border-line pt-4">
        <Button onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button type="submit" variante="primario" cargando={guardando}>Guardar médico</Button>
      </div>
    </form>
  </Modal>;
}
