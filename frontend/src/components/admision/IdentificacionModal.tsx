import { useState, type FormEvent } from 'react';
import type { Paciente } from '../../types/api';
import { pacientesApi } from '../../services/laboratorio';
import { mensajeDeError, detallesDeError, type DetalleCampo } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../UI/Modal';
import { Button } from '../UI/Button';
import { Alert } from '../UI/Alert';
import { Campo, Textarea } from '../UI/Form';
import { IdentificacionCampos, identificacionInicial, entradaIdentificacion, ErrorIdentificacionFormulario } from './IdentificacionCampos';

export function IdentificacionModal({ paciente, onCerrar, onGuardado }: {
  paciente: Paciente; onCerrar: () => void; onGuardado: () => void;
}) {
  const toast = useToast();
  const [valor, setValor] = useState(() => identificacionInicial(paciente.identificacion));
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleCampo[]>([]);
  async function enviar(e: FormEvent) {
    e.preventDefault(); setError(null); setDetalles([]); setGuardando(true);
    try {
      if (paciente.versionIdentificacion === undefined) throw new ErrorIdentificacionFormulario('Recargue la ficha antes de cambiar la identificación.');
      await pacientesApi.identificar(paciente.id, { identificacion: entradaIdentificacion(valor),
        motivoCambio: motivo.trim(), versionIdentificacion: paciente.versionIdentificacion });
      toast.exito('Identificación actualizada'); onGuardado();
    } catch (e) { setError(e instanceof ErrorIdentificacionFormulario ? e.message : mensajeDeError(e)); setDetalles(detallesDeError(e)); }
    finally { setGuardando(false); }
  }
  return <Modal abierto ancho="md" titulo="Actualizar identificación" onCerrar={() => { if (!guardando) onCerrar(); }}
    pie={<><Button onClick={onCerrar} disabled={guardando}>Cancelar</Button>
      <Button variante="primario" type="submit" form="form-identificacion" cargando={guardando}>Guardar identificación</Button></>}>
    <form id="form-identificacion" onSubmit={enviar} className="lz-patient-form">
      {error && <Alert detalles={detalles}>{error}</Alert>}
      {paciente.identificacion?.estado === 'LEGADO_POR_REVISAR' && <p className="text-sm text-body">
        Valor histórico: {paciente.identificacion.valorLegado}. Seleccione el tipo confirmado; el original se conservará.
      </p>}
      <IdentificacionCampos value={valor} onChange={setValor} />
      <Campo etiqueta="Motivo del cambio"><Textarea value={motivo} onChange={e => setMotivo(e.target.value)} required minLength={5} maxLength={255} /></Campo>
    </form>
  </Modal>;
}
